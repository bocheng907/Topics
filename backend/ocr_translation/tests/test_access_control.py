import os
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from access_control import PROJECT_ID, UsageLimits, verify_user


class IdentityTests(unittest.TestCase):
    def claims(self, uid="alice"):
        return {"sub": uid, "iss": "https://securetoken.google.com/" + PROJECT_ID,
                "aud": PROJECT_ID, "auth_time": int(time.time()) - 60,
                "firebase": {"sign_in_provider": "password"}}

    def test_missing_or_malformed_token_is_rejected(self):
        for value in ("", "Basic abc", "Bearer ", "Bearer " + "a" * 8200):
            with self.assertRaises(HTTPException) as ctx:
                verify_user(value)
            self.assertEqual(ctx.exception.status_code, 401)

    @patch("access_control.id_token.verify_firebase_token")
    def test_all_registered_users_allowed_without_ip_allowlist(self, verify):
        for user in ("alice", "bob", "caregiver", "family", "agency"):
            verify.return_value = self.claims(user)
            self.assertEqual(verify_user("Bearer signed-token"), user)
        self.assertEqual(verify.call_args.kwargs["audience"], PROJECT_ID)

    @patch("access_control.id_token.verify_firebase_token")
    def test_wrong_project_issuer_anonymous_and_invalid_uid_rejected(self, verify):
        for change in ({"aud": "another-project"}, {"iss": "attacker"}, {"sub": ""},
                       {"sub": 5}, {"firebase": {"sign_in_provider": "anonymous"}},
                       {"auth_time": time.time() + 1000}):
            verify.return_value = {**self.claims(), **change}
            with self.assertRaises(HTTPException):
                verify_user("Bearer token")

    @patch("access_control.id_token.verify_firebase_token", side_effect=ValueError("expired or forged private details"))
    def test_verification_failure_never_reaches_handler_or_leaks_details(self, verify):
        with self.assertRaises(HTTPException) as ctx:
            verify_user("Bearer forged-token")
        self.assertNotIn("private", ctx.exception.detail)


class QuotaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "usage.sqlite3"
        self.limits = UsageLimits(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_quota_persists_and_users_are_independent(self):
        for _ in range(6):
            self.limits.consume("alice", "ocr", now=1000)
        with self.assertRaises(HTTPException) as ctx:
            UsageLimits(self.path).consume("alice", "ocr", now=1000)
        self.assertEqual(ctx.exception.status_code, 429)
        self.limits.consume("bob", "ocr", now=1000)
        self.limits.consume("alice", "ocr", now=1060)

    def test_concurrent_requests_cannot_bypass_limit(self):
        def attempt(_):
            try:
                self.limits.consume("alice", "ocr", now=1000)
                return 1
            except HTTPException:
                return 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(attempt, range(16))), 6)

    def test_global_quota_and_window_reset(self):
        for n in range(300):
            self.limits.consume(str(n), "ocr", now=1000)
        with self.assertRaises(HTTPException):
            self.limits.consume("new-user", "ocr", now=1000)
        self.limits.consume("new-user", "ocr", now=86401)


if __name__ == "__main__":
    unittest.main()
