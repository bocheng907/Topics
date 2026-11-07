"""Firebase identity verification and persistent, single-host usage limits.

The verifier uses Google's public signing certificates, never a service-account
private key. Expose the API through TLS before sending Firebase ID tokens.
"""
from contextlib import closing
import hashlib
import os
import sqlite3
import threading
import time
from pathlib import Path

import cachecontrol
import requests
import anyio
from fastapi import Header, HTTPException
from starlette.responses import JSONResponse
from google.auth.transport.requests import Request
from google.oauth2 import id_token

PROJECT_ID = "smart-care-system-1a41e"
_session = cachecontrol.CacheControl(requests.Session())
_request = Request(session=_session)
_verify_lock = threading.Lock()


def _certificate_request(*args, **kwargs):
    kwargs["timeout"] = 10
    return _request(*args, **kwargs)


def verify_user(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "請先登入 App", headers={"WWW-Authenticate": "Bearer"})
    token = authorization[7:]
    if not token or len(token) > 8192:
        raise HTTPException(401, "請重新登入 App")
    try:
        with _verify_lock:
            claims = id_token.verify_firebase_token(
                token, _certificate_request, audience=PROJECT_ID
            )
        uid = claims.get("sub")
        if (claims.get("iss") != "https://securetoken.google.com/" + PROJECT_ID
                or claims.get("aud") != PROJECT_ID
                or not isinstance(uid, str) or not 1 <= len(uid) <= 128
                or claims.get("firebase", {}).get("sign_in_provider") in (None, "anonymous")
                or not isinstance(claims.get("auth_time"), (int, float))
                or claims["auth_time"] > time.time()):
            raise ValueError("Invalid identity")
        return uid
    except HTTPException:
        raise
    except Exception:
        # Do not log the token or provider response.
        raise HTTPException(401, "登入驗證暫時無法完成，請稍後再試") from None


class UsageLimits:
    """Atomic SQLite counters survive process restarts on this EC2 host."""
    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("CREATE TABLE IF NOT EXISTS usage (k TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL)")
        os.chmod(self.path, 0o600)

    def consume(self, uid, kind, cost=1, now=None):
        now = int(time.time() if now is None else now)
        user = hashlib.sha256(uid.encode()).hexdigest()
        # Separate OCR and translation budgets; quotas count attempted calls.
        per_minute, per_day, total_day = (6, 60, 300) if kind == "ocr" else (60, 1200, 6000)
        limits = [(f"{kind}:{user}:minute:{now // 60}", per_minute, (now // 60 + 1) * 60),
                  (f"{kind}:{user}:day:{now // 86400}", per_day, (now // 86400 + 1) * 86400),
                  (f"{kind}:global:day:{now // 86400}", total_day, (now // 86400 + 1) * 86400)]
        with closing(sqlite3.connect(self.path, timeout=10)) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM usage WHERE expires <= ?", (now,))
            for key, ceiling, expiry in limits:
                row = conn.execute("SELECT n FROM usage WHERE k=?", (key,)).fetchone()
                if (row[0] if row else 0) + cost > ceiling:
                    raise HTTPException(429, "目前使用次數較多，請稍後再試", headers={"Retry-After": str(expiry - now)})
            for key, _, expiry in limits:
                conn.execute("INSERT INTO usage VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n=n+excluded.n", (key, cost, expiry))


_limits = None
_limits_lock = threading.Lock()


def consume_usage(uid, kind, cost=1):
    global _limits
    with _limits_lock:
        if _limits is None:
            _limits = UsageLimits(os.getenv("OCR_USAGE_DB", "/tmp/topics-ocr/usage.sqlite3"))
    try:
        _limits.consume(uid, kind, cost)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "服務暫時無法使用，請稍後再試") from None


def require_user(authorization: str = Header(default="")) -> str:
    return verify_user(authorization)


class RequestSizeLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        async def reject(status, detail):
            await JSONResponse({"detail": detail}, status_code=status)(scope, receive, send)
        if not headers.get(b"authorization", b"").startswith(b"Bearer "):
            return await reject(401, "請先登入 App")
        limit = 13 * 1024 * 1024 if scope["path"] == "/analyze/upload" else 256 * 1024
        try:
            if int(headers.get(b"content-length", b"0")) > limit:
                return await reject(413, "內容太大，請縮小或分批重試")
        except ValueError:
            return await reject(400, "無法讀取請求內容")
        body = bytearray()
        try:
            with anyio.fail_after(20):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > limit:
                        return await reject(413, "內容太大，請縮小或分批重試")
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await reject(408, "上傳逾時，請重新嘗試")
        consumed = False
        async def buffered_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()
        await self.app(scope, buffered_receive, send)
