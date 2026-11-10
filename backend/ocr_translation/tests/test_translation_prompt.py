import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("GEMINI_API_KEY", "isolated-test-key")
_temp = tempfile.TemporaryDirectory()
os.environ["TRANSLATION_CACHE_PATH"] = str(Path(_temp.name) / "cache.sqlite3")
import main


class TranslationPromptTests(unittest.TestCase):
    def test_single_translation_preserves_unspecified_people(self):
        response = SimpleNamespace(text=json.dumps({"detected_language": "Chinese", "target_language": "English", "translated_text": "Please remember to drink water."}), usage_metadata=None)
        generate = Mock(return_value=response)
        with patch.object(main, "client", SimpleNamespace(models=SimpleNamespace(generate_content=generate))), \
             patch.object(main, "get_cached_translation", return_value=None), \
             patch.object(main, "cache_translation"):
            result = main.process_translation_with_gemini("晚點再提醒喝水。", "English")
        prompt = generate.call_args.kwargs["contents"][0]
        self.assertIn("keep it ambiguous", prompt)
        self.assertIn("do not invent a first-person", prompt)
        self.assertIn("do not insert bracketed placeholders", prompt)
        self.assertIn("晚點再提醒喝水。", prompt)
        self.assertEqual(result.target_language, "English")

    def test_batch_detects_each_source_language_and_keeps_keys(self):
        response = SimpleNamespace(text=json.dumps({"translations": [{"key": "a", "translated_text": "Please drink water."}, {"key": "b", "translated_text": "Good morning."}]}), usage_metadata=None)
        generate = Mock(return_value=response)
        items = [main.BatchTranslationItem(key="a", text="請喝水"), main.BatchTranslationItem(key="b", text="Good morning")]
        with patch.object(main, "client", SimpleNamespace(models=SimpleNamespace(generate_content=generate))), \
             patch.object(main, "get_cached_translation", return_value=None), \
             patch.object(main, "cache_translation"):
            result = main.process_batch_translation_with_gemini(items, "English")
        prompt = generate.call_args.kwargs["contents"][0]
        self.assertIn("source language of each text independently", prompt)
        self.assertIn("keep each key unchanged", prompt)
        self.assertNotIn("from Traditional Chinese", prompt)
        self.assertEqual([item.key for item in result], ["a", "b"])

    def test_cache_connections_close_after_read_and_write(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(main, "TRANSLATION_CACHE_PATH", str(Path(directory) / "cache.sqlite3")):
                main.init_translation_cache()
                main.cache_translation("請喝水", "English", "Please drink water.")
                self.assertEqual(main.get_cached_translation("請喝水", "English"), "Please drink water.")

    def test_new_translation_rules_do_not_reuse_old_cache_key(self):
        with patch.object(main, "TRANSLATION_CACHE_VERSION", "v1"):
            old = main.translation_cache_key("請喝水", "English")
        self.assertNotEqual(old, main.translation_cache_key("請喝水", "English"))


if __name__ == "__main__":
    unittest.main()
