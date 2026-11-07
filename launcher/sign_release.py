"""Offline maintainer tool. Never bundled into the end-user application."""
import argparse
import base64
import getpass
import hashlib
import json
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from install_core import FILES, atomic
from signed_updates import MAX_FILE, MAX_ENVELOPE, verify
from payload_limits import file_limit

def sign(bundle: Path,number: int,key: Ed25519PrivateKey):
    if type(number) is not int or number<1:raise ValueError('Use a positive monotonic release counter')
    files={}
    for name in FILES:
        content=(bundle/name).read_bytes()
        if not content or len(content)>file_limit(name):raise ValueError('Release file exceeds allowed size')
        content.decode('utf-8')
        files[name]={'sha256':hashlib.sha256(content).hexdigest(),'content':base64.b64encode(content).decode('ascii')}
    document=json.dumps({'schema':1,'product':'bobble-wardrobe','release':number,'files':files},sort_keys=True,separators=(',',':')).encode()
    envelope=json.dumps({'signed':base64.b64encode(document).decode('ascii'),'signature':base64.b64encode(key.sign(document)).decode('ascii')},separators=(',',':')).encode()
    if len(envelope)>MAX_ENVELOPE:raise ValueError('Signed release exceeds update response limit')
    public=key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex()
    verify(envelope,public,0) # Validate the exact wire artifact before it can be published.
    return envelope,public

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,required=True)
    parser.add_argument('--release',type=int,required=True)
    parser.add_argument('--private-key',type=Path,required=True,help='External Ed25519 PEM key, never inside the project')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.private_key.resolve().is_relative_to(Path(__file__).parent.resolve()):raise SystemExit('Keep the private signing key outside the project')
    pem=args.private_key.read_bytes()
    password=getpass.getpass('Signing-key passphrase: ').encode() if b'ENCRYPTED PRIVATE KEY' in pem else None
    key=serialization.load_pem_private_key(pem,password=password)
    if not isinstance(key,Ed25519PrivateKey):raise SystemExit('An Ed25519 signing key is required')
    artifact,public=sign(args.bundle,args.release,key)
    if args.output.exists():raise SystemExit('Output already exists; refusing to overwrite a published release')
    atomic(args.output,artifact)
    print(json.dumps({'release':args.release,'publicKey':public,'bytes':len(artifact)}))

if __name__=='__main__':main()
