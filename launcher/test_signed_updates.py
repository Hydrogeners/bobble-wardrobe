import base64
import hashlib
import json
import unittest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from signed_updates import verify, fetch, download
from install_core import FILES

class UpdateTests(unittest.TestCase):
    def setUp(self):
        # Ephemeral test key. No private release key is written to disk or shipped.
        self.key = Ed25519PrivateKey.generate()
        self.public = self.key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
        self.data = {'schema':1,'product':'bobble-wardrobe','release':2,'files':{name:{'sha256':hashlib.sha256(b'// test').hexdigest(),'content':base64.b64encode(b'// test').decode()} for name in FILES}}
    def signed(self, data=None, raw=None):
        document = raw if raw is not None else json.dumps(data or self.data).encode()
        return json.dumps({'signed':base64.b64encode(document).decode(),'signature':base64.b64encode(self.key.sign(document)).decode()}).encode()
    def test_verified(self): self.assertEqual(verify(self.signed(),self.public,1).number,2)
    def test_replay(self): self.assertIsNone(verify(self.signed(),self.public,2))
    def test_bad_signature(self):
        raw=json.loads(self.signed());raw['signed']=base64.b64encode(b'{}').decode()
        with self.assertRaises(InvalidSignature): verify(json.dumps(raw).encode(),self.public,1)
    def test_other_key(self):
        key=Ed25519PrivateKey.generate().public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
        with self.assertRaises(InvalidSignature):verify(self.signed(),key,1)
    def test_other_product(self):
        self.data['product']='another-app'
        with self.assertRaises(ValueError):verify(self.signed(),self.public,1)
    def test_path_escape(self):
        self.data['files']['../evil.js']=self.data['files'].pop(FILES[0])
        with self.assertRaises(ValueError):verify(self.signed(),self.public,1)
    def test_wrong_digest(self):
        self.data['files'][FILES[0]]['sha256']='0'*64
        with self.assertRaises(ValueError):verify(self.signed(),self.public,1)
    def test_duplicate_keys(self):
        with self.assertRaises(ValueError):verify(self.signed(raw=b'{"schema":1,"schema":1}'),self.public,1)
    def test_http_refused_without_network(self):
        with self.assertRaises(ValueError):download('http://example.com/update')
    def test_unconfigured_no_network(self):self.assertIsNone(fetch({'feed':None,'publicKey':None},1))

if __name__=='__main__':unittest.main()
