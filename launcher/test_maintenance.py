import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from install_core import Installer, FILES
from maintenance import check_updates
from signed_updates import Release
from test_support import TEST_TEMP

class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.root = Path(self.tmp.name)
        self.bundle = self.root/'bundle'; self.bundle.mkdir()
        for name in FILES: (self.bundle/name).write_bytes(b'// old')
        self.resources = self.root/'resources'; self.resources.mkdir()
        (self.resources/'app.asar').write_bytes(b'original')
        self.installer = Installer(self.resources,self.bundle); self.installer.install()
        self.policy = {'feed':'https://example.invalid/updates','publicKey':'0'*64}
        self.release = Release(2,{name:b'// new' for name in FILES})
    def tearDown(self): self.tmp.cleanup()
    def check(self,running=False):
        return check_updates([self.resources],self.bundle,self.policy,lambda:running,self.root/'cache')
    def test_applies_only_verified_fetch_result(self):
        with patch('maintenance.fetch',return_value=self.release):self.assertIn('release 2',self.check())
        self.assertEqual(self.installer.status()['release'],2)
        self.assertEqual(list((self.root/'cache').iterdir()),[])
    def test_running_discord_is_not_changed(self):
        with patch('maintenance.fetch',return_value=self.release):self.assertIn('quit Discord',self.check(True))
        self.assertEqual(self.installer.status()['release'],1)
        self.assertFalse((self.root/'cache').exists())
    def test_verification_failure_is_not_applied(self):
        with patch('maintenance.fetch',side_effect=ValueError('bad signature')):
            with self.assertRaises(ValueError):self.check()
        self.assertEqual(self.installer.status()['release'],1)
    def test_unconfigured_never_fetches(self):
        self.policy={'feed':None,'publicKey':None}
        with patch('maintenance.fetch') as fetch:self.assertIn('not configured',self.check());fetch.assert_not_called()

if __name__=='__main__':unittest.main()
