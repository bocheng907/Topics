import os
import sys
import tempfile
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

TEST_CACHE_PATH = Path(tempfile.gettempdir()) / (
    f"topics_translation_cache_test_{os.getpid()}.sqlite3"
)
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ["TRANSLATION_CACHE_PATH"] = str(TEST_CACHE_PATH)

import main  # noqa: E402


def tearDownModule() -> None:
    TEST_CACHE_PATH.unlink(missing_ok=True)


class PrescriptionParsingTests(unittest.TestCase):
    def test_unique_partial_chinese_name_is_completed(self) -> None:
        appearance = main.lookup_drug_appearance("暮帝納斯")

        self.assertIsNotNone(appearance)
        self.assertEqual(
            main.complete_drug_name("暮帝納斯", appearance),
            "暮帝納斯腹瀉整腸錠",
        )

    def test_ambiguous_partial_name_is_not_guessed(self) -> None:
        appearance = main.lookup_drug_appearance("普拿疼")

        self.assertIsNone(appearance)
        self.assertEqual(main.complete_drug_name("普拿疼", appearance), "普拿疼")

    def test_item_note_and_prescription_memo_stay_separate(self) -> None:
        medicine = main.MedicineItem(
            drug_name="測試藥品",
            dosage="1 錠",
            quantity="3 錠",
            usage_zh="每日三次",
            note_zh="飯後服用",
        )
        response = main.PrescriptionResponse(
            clinic_name="測試診所",
            medicines=[medicine],
            memo="若不適請回診",
        )

        payload = response.model_dump()
        self.assertEqual(payload["medicines"][0]["note_zh"], "飯後服用")
        self.assertEqual(payload["memo"], "若不適請回診")


if __name__ == "__main__":
    unittest.main()
