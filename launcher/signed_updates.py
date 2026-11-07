"""Signed, bounded Wardrobe updates. No unsigned/HTTP/redirect fallback."""
from __future__ import annotations
import base64
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import build_opener, HTTPRedirectHandler, Request
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from install_core import FILES, atomic, write_json

MAX_ENVELOPE = 12 * 1024 * 1024
MAX_FILE = 6 * 1024 * 1024

def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result: raise ValueError('Duplicate JSON key')
        result[key] = value
    return result

def json_object(raw):
    result = json.loads(raw, object_pairs_hook=unique_pairs)
    if not isinstance(result, dict): raise ValueError('Expected JSON object')
    return result

@dataclass(frozen=True)
class Release:
    number: int
    files: dict[str, bytes]

def verify(envelope: bytes, public_key: str, current: int) -> Release | None:
    if len(envelope) > MAX_ENVELOPE: raise ValueError('Update manifest is too large')
    if len(public_key) != 64: raise ValueError('Update public key is not configured')
    outer = json_object(envelope)
    if set(outer) != {'signed', 'signature'}: raise ValueError('Unexpected signature envelope')
    document = base64.b64decode(outer['signed'], validate=True)
    signature = base64.b64decode(outer['signature'], validate=True)
    # Verify the exact received bytes before parsing any executable content.
    Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key)).verify(signature, document)
    data = json_object(document)
    if set(data) != {'schema', 'product', 'release', 'files'} or type(data['schema']) is not int or data['schema'] != 1 or data['product'] != 'bobble-wardrobe':
        raise ValueError('Wrong update product or schema')
    number = data['release']
    if type(number) is not int or number < 1: raise ValueError('Invalid release counter')
    if not isinstance(data['files'], dict) or set(data['files']) != set(FILES):
        raise ValueError('Update must contain only the three Wardrobe payload files')
    files = {}
    for name in FILES:
        entry = data['files'][name]
        if not isinstance(entry, dict) or set(entry) != {'sha256', 'content'}: raise ValueError('Invalid file entry')
        content = base64.b64decode(entry['content'], validate=True)
        if not content or len(content) > MAX_FILE: raise ValueError('Invalid update file size')
        if hashlib.sha256(content).hexdigest() != entry['sha256']: raise ValueError('File digest mismatch')
        content.decode('utf-8')  # JS payloads only; refuse malformed text.
        files[name] = content
    if number <= current: return None
    return Release(number, files)

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Update redirects are not allowed')

def download(feed: str) -> bytes:
    parsed = urlparse(feed)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('A fixed HTTPS update feed is required')
    request = Request(feed, headers={'User-Agent': 'BobbleWardrobe-Updater/1'})
    with build_opener(NoRedirect()).open(request, timeout=12) as response:
        data = response.read(MAX_ENVELOPE + 1)
    if len(data) > MAX_ENVELOPE: raise ValueError('Update response exceeds size limit')
    return data

def fetch(policy: dict, current: int) -> Release | None:
    if set(policy) != {'feed', 'publicKey'}: raise ValueError('Invalid bundled update policy')
    if not policy['feed'] or not policy['publicKey']: return None
    return verify(download(policy['feed']), policy['publicKey'], current)

def stage(release: Release, parent: Path) -> Path:
    parent.mkdir(parents=True, exist_ok=True)
    target = parent / ('release-' + str(release.number))
    target.mkdir(exist_ok=True)
    expected = set(FILES) | {'release.json'}
    if set(p.name for p in target.iterdir()) - expected: raise RuntimeError('Unexpected staged files retained')
    for name, content in release.files.items(): atomic(target / name, content)
    write_json(target / 'release.json', {'release': release.number, 'files': {k: hashlib.sha256(v).hexdigest() for k,v in release.files.items()}})
    return target
