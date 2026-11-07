from pathlib import Path
import tempfile
import unittest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sign_release import sign
from signed_updates import verify
from install_core import FILES

class SignTests(unittest.TestCase):
    def setUp(self):
        from test_support import TEST_TEMP
        self.tmp=tempfile.TemporaryDirectory(dir=TEST_TEMP);self.bundle=Path(self.tmp.name)
        for name in FILES:(self.bundle/name).write_bytes(b'// fixture')
    def tearDown(self):self.tmp.cleanup()
    def test_offline_signing_roundtrip(self):
        envelope,public=sign(self.bundle,3,Ed25519PrivateKey.generate())
        release=verify(envelope,public,2);self.assertEqual(release.number,3)
        self.assertEqual(set(release.files),set(FILES))
    def test_invalid_release_counter_refused(self):
        with self.assertRaises(ValueError):sign(self.bundle,0,Ed25519PrivateKey.generate())
    def test_missing_file_refused(self):
        (self.bundle/FILES[0]).unlink()
        with self.assertRaises(FileNotFoundError):sign(self.bundle,1,Ed25519PrivateKey.generate())

if __name__=='__main__':unittest.main()
