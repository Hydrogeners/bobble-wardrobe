"""Signed launcher handoff. Never replace a running EXE or restart Discord.

The portable download remains a bootstrap: newer verified launchers live in a
per-user cache. The resident helper continues signed payload maintenance; only
explicit Install upgrades that helper. No unsigned GitHub 'latest' execution.
"""
from __future__ import annotations
import base64
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse
from urllib.request import build_opener, HTTPRedirectHandler, Request
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from signed_updates import json_object, download
from channel_manager import plain
from install_core import atomic, operation_lock

FEED='https://raw.githubusercontent.com/Hydrogeners/bobble-wardrobe/main/launcher-update.json'
MAX_BINARY=128*1024*1024

@dataclass(frozen=True)
class LauncherRelease:
    number:int
    url:str
    sha256:str
    size:int

def verify(raw:bytes,public_key:str)->LauncherRelease:
    if len(raw)>16384:raise ValueError('Launcher descriptor exceeds size limit')
    envelope=json_object(raw)
    if set(envelope)!={'signed','signature'}:raise ValueError('Invalid launcher envelope')
    document=base64.b64decode(envelope['signed'],validate=True)
    signature=base64.b64decode(envelope['signature'],validate=True)
    Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key)).verify(signature,document)
    data=json_object(document)
    if set(data)!={'schema','product','release','url','sha256','size'} or type(data['schema']) is not int or data['schema']!=1 or data['product']!='bobble-wardrobe-launcher':raise ValueError('Wrong launcher product/schema')
    if type(data['release']) is not int or data['release']<1:raise ValueError('Invalid launcher release')
    if type(data['size']) is not int or not 2<=data['size']<=MAX_BINARY:raise ValueError('Invalid launcher size')
    if not isinstance(data['sha256'],str) or not re.fullmatch('[0-9a-f]{64}',data['sha256']):raise ValueError('Invalid launcher digest')
    if not isinstance(data['url'],str) or not re.fullmatch(r'https://github\.com/Hydrogeners/bobble-wardrobe/releases/download/v[0-9A-Za-z.\-]+/BobbleWardrobe-Preview\.exe',data['url']):raise ValueError('Untrusted launcher URL')
    return LauncherRelease(data['release'],data['url'],data['sha256'],data['size'])

def allowed_redirect(url):
    p=urlparse(url)
    return p.scheme=='https' and p.hostname in ('github.com','release-assets.githubusercontent.com','objects.githubusercontent.com') and p.port in (None,443) and not p.username and not p.password and not p.fragment

class AssetRedirects(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if not allowed_redirect(newurl):raise ValueError('Untrusted launcher redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def binary_download(release):
    request=Request(release.url,headers={'User-Agent':'BobbleWardrobe-Updater/1'})
    with build_opener(AssetRedirects()).open(request,timeout=30) as response:
        data=response.read(release.size+1)
    validate_binary(data,release)
    return data

def validate_binary(data,release):
    if len(data)!=release.size or not data.startswith(b'MZ') or hashlib.sha256(data).hexdigest()!=release.sha256:raise ValueError('Launcher failed signed integrity check')

def cached(home,raw,key,current):
    release=verify(raw,key)
    if release.number<=current:return None
    target=home/f'launcher-{release.number}.exe';plain(target)
    if not target.exists():return None
    validate_binary(target.read_bytes(),release)
    return target

def check(home:Path,key:str,current:int,fetch_descriptor=download,fetch_binary=binary_download):
    """Fetch or reuse a verified newer launcher; offline keeps a signed cache."""
    plain(home)
    with operation_lock(home):
        home.mkdir(parents=True,exist_ok=True)
        record=home/'latest-signed.json';plain(record)
        prior=record.read_bytes() if record.exists() else None
        highest=current
        previous=verify(prior,key) if prior else None
        if previous:highest=max(highest,previous.number)
        try:raw=fetch_descriptor(FEED)
        except Exception:
            if prior:return cached(home,prior,key,current)
            raise
        release=verify(raw,key)
        if previous and release.number==previous.number and release!=previous:raise ValueError('Launcher release counter reused')
        if release.number<highest:
            if previous and previous.number>current:raise ValueError('Launcher rollback refused')
            return None
        if release.number<=current:return None
        target=home/f'launcher-{release.number}.exe';plain(target)
        if target.exists():validate_binary(target.read_bytes(),release)
        else:
            data=fetch_binary(release);validate_binary(data,release)
            atomic(target,data)
        # Also check injected/download implementations before committing trust.
        validate_binary(target.read_bytes(),release)
        atomic(record,raw)
        return target

def launch_verified(target:Path,home:Path,key:str,current:int):
    plain(home);plain(target);record=home/'latest-signed.json';plain(record)
    expected=cached(home,record.read_bytes(),key,current)
    if target!=expected:raise ValueError('Launcher handoff path mismatch')
    return subprocess.Popen([str(target)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def sign(executable:Path,number:int,url:str,key):
    """Maintainer-only function; private key is never bundled."""
    data=executable.read_bytes()
    document=json.dumps({'schema':1,'product':'bobble-wardrobe-launcher','release':number,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)},sort_keys=True,separators=(',',':')).encode()
    raw=json.dumps({'signed':base64.b64encode(document).decode(),'signature':base64.b64encode(key.sign(document)).decode()},separators=(',',':')).encode()
    from cryptography.hazmat.primitives import serialization
    verify(raw,key.public_key().public_bytes(serialization.Encoding.Raw,serialization.PublicFormat.Raw).hex())
    return raw
