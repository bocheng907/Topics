import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("GEMINI_API_KEY", "isolated-test-key")
_temp = tempfile.TemporaryDirectory()
os.environ["TRANSLATION_CACHE_PATH"] = str(Path(_temp.name) / "cache.sqlite3")
import main
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image


class ApiSecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.headers = {"Authorization": "Bearer isolated-token"}
        self.identity = patch("access_control.verify_user", return_value="alice")
        self.identity.start()
        self.quota = patch("main.consume_usage")
        self.quota_mock = self.quota.start()

    def tearDown(self):
        self.identity.stop()
        self.quota.stop()
        self.client.close()

    def test_unauthenticated_calls_rejected_for_every_paid_route(self):
        for path in ("/analyze/url", "/analyze/upload", "/translate", "/translate/batch"):
            self.assertEqual(self.client.post(path, json={}).status_code, 401)

    def test_preflight_and_health_do_not_require_login(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        response = self.client.options("/translate", headers={"Origin": "https://example.test", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
        self.assertEqual(response.status_code, 200)

    @patch("main.process_translation_with_gemini")
    def test_authenticated_translation_and_rate_limit(self, translate):
        translate.return_value = main.TranslationResult(detected_language="Chinese", target_language="English", translated_text="Good morning")
        response = self.client.post("/translate", json={"text": "早安", "target_language": "English"}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["translated_text"], "Good morning")
        self.quota_mock.side_effect = HTTPException(429, "busy")
        self.assertEqual(self.client.post("/translate", json={"text": "你好"}, headers=self.headers).status_code, 429)
        self.assertEqual(translate.call_count, 1)

    @patch("main.process_batch_translation_with_gemini")
    def test_batch_and_duplicate_input(self, translate):
        translate.return_value = [main.BatchTranslationResponseItem(key="a", translated_text="Hello", cached=False)]
        payload = {"items": [{"key": "a", "text": "你好"}], "target_language": "English"}
        self.assertEqual(self.client.post("/translate/batch", json=payload, headers=self.headers).status_code, 200)
        payload["items"] *= 2
        self.assertEqual(self.client.post("/translate/batch", json=payload, headers=self.headers).status_code, 400)
        self.assertEqual(translate.call_count, 1)

    @patch("main.process_prescription_with_gemini")
    @patch("main.download_prescription_image")
    def test_ocr_owner_check_and_valid_image(self, download, analyze):
        image = io.BytesIO()
        Image.new("RGB", (20, 20), "white").save(image, format="PNG")
        download.return_value = image.getvalue()
        analyze.return_value = main.PrescriptionResponse(clinic_name="Example", medicines=[])
        url = "https://firebasestorage.googleapis.com/v0/b/smart-care-system-1a41e.firebasestorage.app/o/prescriptions%2Fpatient%2Falice%2Fimage.png?alt=media&token=example"
        self.assertEqual(self.client.post("/analyze/url", json={"image_url": url}, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.post("/analyze/url", json={"image_url": url.replace("%2Falice%2F", "%2Fbob%2F")}, headers=self.headers).status_code, 400)
        self.assertEqual(download.call_count, 1)

    def test_size_and_mime_limits(self):
        response = self.client.post("/translate", content=b"{}", headers={**self.headers, "Content-Length": "999999999"})
        self.assertEqual(response.status_code, 413)
        response = self.client.post("/analyze/upload", files={"file": ("a.html", b"html", "text/html")}, headers=self.headers)
        self.assertEqual(response.status_code, 415)


if __name__ == "__main__":
    unittest.main()
