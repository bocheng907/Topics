import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from safe_image import MAX_IMAGE_BYTES, download_prescription_image, validate_prescription_url

VALID = ("https://firebasestorage.googleapis.com/v0/b/"
         "smart-care-system-1a41e.firebasestorage.app/o/"
         "prescriptions%2Fpatient%2Fuid%2Fimage.jpg?alt=media&token=example")


class ImageSafetyTests(unittest.TestCase):
    def test_project_prescription_url_allowed(self):
        validate_prescription_url(VALID)

    def test_other_hosts_buckets_paths_and_credentials_rejected(self):
        for url in [
            "http://127.0.0.1/private", "http://169.254.169.254/",
            VALID.replace("firebasestorage.googleapis.com", "evil.example"),
            VALID.replace("smart-care-system-1a41e.firebasestorage.app", "other.appspot.com"),
            VALID.replace("prescriptions%2F", "profile_images%2F"),
            VALID.replace("https://", "https://evil@"),
            VALID.replace("https://", "http://"),
            VALID + "#fragment",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_prescription_url(url)

    @patch("safe_image.requests.get")
    def test_redirects_disabled_and_stream_limited(self, get):
        response = get.return_value.__enter__.return_value
        response.status_code = 302
        with self.assertRaises(ValueError):
            download_prescription_image(VALID)
        self.assertFalse(get.call_args.kwargs["allow_redirects"])
        response.status_code = 200
        response.headers = {"Content-Type": "image/jpeg"}
        response.iter_content.return_value = [b"a" * (MAX_IMAGE_BYTES + 1)]
        with self.assertRaises(ValueError):
            download_prescription_image(VALID)

    @patch("safe_image.requests.get")
    def test_valid_image_passes(self, get):
        response = get.return_value.__enter__.return_value
        response.status_code = 200
        response.headers = {"Content-Type": "image/png", "Content-Length": "3"}
        response.iter_content.return_value = [b"abc"]
        self.assertEqual(download_prescription_image(VALID), b"abc")


if __name__ == "__main__":
    unittest.main()
