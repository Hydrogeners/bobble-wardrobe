import base64
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import launcher_updates as U
from test_support import TEST_TEMP

class LauncherUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=TEST_TEMP);self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.home=self.root/'cache'
        self.key=Ed25519PrivateKey.generate()
        self.public=self.key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
        self.exe=self.root/'source.exe';self.exe.write_bytes(b'MZverified-test-executable')
        self.url='https://github.com/Hydrogeners/bobble-wardrobe/releases/download/v0.1.0-preview.5/BobbleWardrobe-Preview.exe'
        self.raw=U.sign(self.exe,14,self.url,self.key)
    def check(self,raw=None,current=13,fetch_binary=None):
        return U.check(self.home,self.public,current,lambda _:raw or self.raw,fetch_binary or (lambda _:self.exe.read_bytes()))
    def resign(self,**fields):
        outer=json.loads(self.raw);doc=json.loads(base64.b64decode(outer['signed']));doc.update(fields)
        raw=json.dumps(doc).encode()
        return json.dumps({'signed':base64.b64encode(raw).decode(),'signature':base64.b64encode(self.key.sign(raw)).decode()}).encode()
    def test_verified_download_and_recheck_before_handoff(self):
        target=self.check();self.assertEqual(target.read_bytes(),self.exe.read_bytes())
        with patch.object(U.subprocess,'Popen') as launch:
            U.launch_verified(target,self.home,self.public,13)
            self.assertEqual(launch.call_args.args[0],[str(target)])
    def test_current_does_not_download(self):
        self.assertIsNone(self.check(current=14,fetch_binary=lambda _:self.fail('Unneeded download')))
    def test_offline_reuses_only_verified_newer_cache(self):
        target=self.check()
        def offline(_):raise OSError('Offline')
        self.assertEqual(U.check(self.home,self.public,13,offline),target)
        self.assertIsNone(U.check(self.home,self.public,14,offline))
    def test_tampered_cached_binary_never_launches(self):
        target=self.check();target.write_bytes(b'MZtampered')
        with patch.object(U.subprocess,'Popen') as launch:
            with self.assertRaises(ValueError):U.launch_verified(target,self.home,self.public,13)
            launch.assert_not_called()
    def test_tampered_network_binary_is_not_written(self):
        with self.assertRaises(ValueError):self.check(fetch_binary=lambda _:b'MZbad')
        self.assertFalse((self.home/'launcher-14.exe').exists())
    def test_signature_is_required(self):
        outer=json.loads(self.raw);outer['signature']=base64.b64encode(bytes(64)).decode()
        with self.assertRaises(Exception):self.check(json.dumps(outer).encode())
    def test_wrong_product_urls_and_sizes_are_refused(self):
        for fields in [{'product':'bobble-wardrobe'},{'schema':True},{'release':True},{'size':U.MAX_BINARY+1},{'url':'http://github.com/a.exe'},{'url':'https://github.com/other/repo/releases/download/v1/BobbleWardrobe-Preview.exe'},{'url':self.url+'?token=secret'},{'sha256':'nope'}]:
            with self.subTest(fields=fields),self.assertRaises(ValueError):U.verify(self.resign(**fields),self.public)
    def test_rollback_and_release_reuse_are_refused(self):
        self.check()
        with self.assertRaises(ValueError):self.check(self.resign(release=13))
        with self.assertRaises(ValueError):self.check(self.resign(sha256='0'*64))
    def test_handoff_path_must_match_signed_record(self):
        self.check()
        with self.assertRaises(ValueError):U.launch_verified(self.exe,self.home,self.public,13)
    def test_redirect_allowlist(self):
        for url in ['https://release-assets.githubusercontent.com/a?sig=1','https://github.com/a']:
            self.assertTrue(U.allowed_redirect(url))
        for url in ['http://github.com/a','https://evil.example/a','https://github.com.evil.example/a','https://u:p@github.com/a','https://github.com:444/a']:
            self.assertFalse(U.allowed_redirect(url))
    def test_unknown_cached_file_is_preserved(self):
        self.home.mkdir();target=self.home/'launcher-14.exe';target.write_bytes(b'MZuntracked')
        with self.assertRaises(ValueError):self.check()
        self.assertEqual(target.read_bytes(),b'MZuntracked')

if __name__=='__main__':unittest.main()
