"""Opt-in real-feed test. Only temporary fake Discord resources are changed."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from install_core import Installer, FILES
from maintenance import check_updates
from signed_updates import fetch


@unittest.skipUnless(os.environ.get('WARDROBE_LIVE_UPDATE_TEST') == '1', 'Opt into live HTTPS feed testing')
class LiveUpdateTests(unittest.TestCase):
    def test_download_upgrade_and_byte_exact_uninstall(self):
        here = Path(__file__).parent
        policy = json.loads((here / 'update-policy.json').read_text())
        release = fetch(policy, 0)
        self.assertIsNotNone(release)
        from test_support import TEST_TEMP
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temporary:
            root = Path(temporary)
            bundle = root / 'old-bundle'
            bundle.mkdir()
            for name in FILES:
                (bundle / name).write_bytes(b'// isolated old payload')
            resources = root / 'resources'
            resources.mkdir()
            original = b'isolated stock archive fixture'
            (resources / 'app.asar').write_bytes(original)
            installer = Installer(resources, bundle)
            installer.install(release=1)
            result = check_updates([resources], bundle, policy, lambda: False, root / 'staging')
            self.assertIn('release ' + str(release.number), result)
            self.assertEqual(installer.status()['release'], release.number)
            self.assertIsNone(fetch(policy, release.number))
            installer.uninstall()
            self.assertEqual((resources / 'app.asar').read_bytes(), original)
