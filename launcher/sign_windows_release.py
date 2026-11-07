"""Maintainer-only Windows-account-protected signing. Never shipped in the app.

The key is stored outside this project using current-user Windows DPAPI.
Back up the Windows profile/key custody separately; this is not a portable key.
"""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sign_release import sign


class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def protect(data, decrypt=False):
    if os.name != 'nt':
        raise RuntimeError('Windows DPAPI is required')
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    source = Blob(len(data), buffer)
    output = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        fn = crypt.CryptUnprotectData
        description = None
    else:
        fn = crypt.CryptProtectData
        description = 'Bobble Wardrobe release signing key'
    fn.restype = wintypes.BOOL
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p if decrypt else wintypes.LPCWSTR,
                   ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD,
                   ctypes.POINTER(Blob)]
    if not fn(ctypes.byref(source), description, None, None, None, 1, ctypes.byref(output)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        kernel.LocalFree(output.data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--initialize', action='store_true', help='Create the key once; never replaces an existing key')
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--release', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('Output exists; refusing to overwrite')
    key_path = Path(os.environ['LOCALAPPDATA']) / 'BobbleWardrobeSigning' / 'release-key.dpapi'
    if args.initialize:
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key = Ed25519PrivateKey.generate()
        raw = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
        with key_path.open('xb') as stream:
            stream.write(protect(raw))
    key = Ed25519PrivateKey.from_private_bytes(protect(key_path.read_bytes(), decrypt=True))
    artifact, public = sign(args.bundle, args.release, key)
    with args.output.open('xb') as stream:
        stream.write(artifact)
    print(json.dumps({'release': args.release, 'publicKey': public, 'bytes': len(artifact), 'protectedKey': str(key_path)}))


if __name__ == '__main__':
    main()
