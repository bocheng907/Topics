"""Fetch only prescription images stored in this Firebase project."""
from urllib.parse import parse_qs, unquote, urlsplit

import requests

BUCKET = "smart-care-system-1a41e.firebasestorage.app"
MAX_IMAGE_BYTES = 12 * 1024 * 1024


def validate_prescription_url(value: str, uid=None) -> None:
    try:
        parts = urlsplit(value)
        port = parts.port
        query = parse_qs(parts.query, keep_blank_values=True)
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid image address") from exc
    prefix = f"/v0/b/{BUCKET}/o/"
    path = unquote(parts.path)
    object_path = path[len(prefix):] if path.startswith(prefix) else ""
    segments = object_path.split("/")
    if (
        parts.scheme != "https"
        or parts.hostname != "firebasestorage.googleapis.com"
        or parts.username is not None
        or parts.password is not None
        or port not in (None, 443)
        or parts.fragment
        or len(segments) != 4
        or segments[0] != "prescriptions"
        or (uid is not None and segments[2] != uid)
        or any(not x or x in (".", "..") or "\\" in x for x in segments)
        or query.get("alt") != ["media"]
        or len(query.get("token", [])) != 1
        or not query["token"][0]
    ):
        raise ValueError("Image address is not an allowed prescription")


def download_prescription_image(url: str) -> bytes:
    validate_prescription_url(url)
    with requests.get(url, timeout=(5, 20), allow_redirects=False, stream=True) as response:
        if response.status_code != 200:
            raise ValueError("Image download failed")
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type not in {"image/jpeg", "image/png"}:
            raise ValueError("Unsupported image type")
        length = response.headers.get("Content-Length")
        if length is not None and (not length.isdecimal() or int(length) > MAX_IMAGE_BYTES):
            raise ValueError("Image is too large")
        result = bytearray()
        for chunk in response.iter_content(chunk_size=65536):
            result.extend(chunk)
            if len(result) > MAX_IMAGE_BYTES:
                raise ValueError("Image is too large")
        if not result:
            raise ValueError("Empty image")
        return bytes(result)
