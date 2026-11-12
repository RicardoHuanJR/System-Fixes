import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


class StagedImportTests(unittest.TestCase):
    def test_published_zip_never_overwrites_equal_or_newer_source(self):
        spec = importlib.util.spec_from_file_location("staged", Path(__file__).parents[1] / "scripts/import_staged_system_fixes.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for version in ("1.27.13", "1.27.14"):
            with self.subTest(version=version), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
                root = Path(directory)
                module.INCOMING = root / "incoming"
                module.DEST = root / "module"
                module.INCOMING.mkdir()
                module.DEST.mkdir()
                (module.INCOMING / "oprpg-system-fixes-v1.27.13.zip").write_bytes(b"must not be extracted")
                (module.DEST / "module.json").write_text(json.dumps({"version": version}))
                sentinel = module.DEST / "new-source.js"
                sentinel.write_text("preserve")
                module.main()
                self.assertEqual(sentinel.read_text(), "preserve")


if __name__ == "__main__":
    unittest.main()
