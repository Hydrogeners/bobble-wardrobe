import os
import unittest
from sign_windows_release import protect


@unittest.skipUnless(os.name == 'nt', 'Windows DPAPI required')
class WindowsSigningTests(unittest.TestCase):
    def test_account_protected_roundtrip(self):
        secret = os.urandom(32)
        encrypted = protect(secret)
        self.assertNotEqual(secret, encrypted)
        self.assertEqual(protect(encrypted, decrypt=True), secret)

    def test_invalid_ciphertext_refused(self):
        with self.assertRaises(OSError):
            protect(b'not a DPAPI key', decrypt=True)


if __name__ == '__main__':
    unittest.main()
