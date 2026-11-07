"""Publish a new quality prerelease only; never overwrites an existing tag.

Uses Git's configured GitHub credential helper without printing credentials.
Requires an already-pushed source commit, signed feed, and built executable.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--exe',type=Path,required=True)
    parser.add_argument('--tag',required=True)
    parser.add_argument('--notes',type=Path,required=True)
    parser.add_argument('--record',type=Path,required=True)
    parser.add_argument('--title',required=True)
    args=parser.parse_args()
    source=args.source.resolve()
    if subprocess.check_output(['git','status','--porcelain'],cwd=source,text=True).strip():raise RuntimeError('Public checkout must be clean')
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
    remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/main'],cwd=source,text=True).split()[0]
    if remote!=commit:raise RuntimeError('Source commit is not the pushed main branch')
    record=json.loads(args.record.read_text(encoding='utf-8'))
    if record['tag']!=args.tag:raise RuntimeError('Release record tag mismatch')
    data=args.exe.read_bytes()
    sha=hashlib.sha256(data).hexdigest()
    if record['executable']['sha256']!=sha:raise RuntimeError('Executable differs from reviewed release record')
    import sys
    sys.path.insert(0,str(source/'launcher'))
    from signed_updates import verify
    policy=json.loads((source/'launcher/update-policy.json').read_text())
    feed=source/'wardrobe-quality-update.json'
    release=verify(feed.read_bytes(),policy['publicKey'],0)
    if release.number!=record['payloadRelease']:raise RuntimeError('Wrong quality release')
    for name,content in release.files.items():
        if content!=(source/'launcher/bundle'/name).read_bytes():raise RuntimeError('Feed does not match source bundle')
    from launcher_updates import verify as verify_launcher
    descriptor_bytes=(source/'launcher-update.json').read_bytes()
    descriptor=verify_launcher(descriptor_bytes,policy['publicKey'])
    expected_url=f'https://github.com/Hydrogeners/bobble-wardrobe/releases/download/{args.tag}/BobbleWardrobe-Preview.exe'
    if descriptor.number!=release.number or descriptor.sha256!=sha or descriptor.size!=len(data) or descriptor.url!=expected_url:raise RuntimeError('Launcher descriptor mismatch')
    credential=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True,timeout=15)
    values=dict(line.split('=',1) for line in credential.stdout.splitlines() if '=' in line)
    headers={'Authorization':'Bearer '+values['password'],'Accept':'application/vnd.github+json','User-Agent':'Bobble-Wardrobe-Maintainer','X-GitHub-Api-Version':'2022-11-28'}
    def request(url,method='GET',body=None,content_type='application/json'):
        req=urllib.request.Request(url,data=body,headers={**headers,'Content-Type':content_type},method=method)
        with urllib.request.urlopen(req,timeout=120) as response:return json.load(response)
    api='https://api.github.com/repos/Hydrogeners/bobble-wardrobe'
    try:request(api+'/releases/tags/'+args.tag)
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
    else:raise RuntimeError('Tag already exists; refusing to overwrite')
    notes=args.notes.read_text(encoding='utf-8')+'\n\nSource commit: `'+commit+'`\n\nExecutable SHA-256: `'+sha+'`\n'
    published=request(api+'/releases','POST',json.dumps({'tag_name':args.tag,'target_commitish':commit,'name':args.title,'body':notes,'draft':True,'prerelease':True}).encode())
    upload=published['upload_url'].split('{',1)[0]
    assets=[('BobbleWardrobe-Preview.exe',data,'application/octet-stream'),('SHA256SUMS.txt',(sha+'  BobbleWardrobe-Preview.exe\n').encode(),'text/plain'),('release-record.json',args.record.read_bytes(),'application/json'),('wardrobe-quality-update.json',feed.read_bytes(),'application/json')]
    assets.append(('launcher-update.json',descriptor_bytes,'application/json'))
    for name,content,kind in assets:
        asset=request(upload+'?name='+name,'POST',content,kind)
        if asset.get('size')!=len(content):raise RuntimeError('Uploaded size mismatch; draft retained')
    result=request(api+'/releases/'+str(published['id']),'PATCH',json.dumps({'draft':False,'prerelease':True,'make_latest':'false'}).encode())
    print(json.dumps({'url':result['html_url'],'commit':commit,'sha256':sha,'prerelease':result['prerelease'],'assets':[row[0] for row in assets]}))

if __name__=='__main__':main()
