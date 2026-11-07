"""Publish one explicitly labeled preview; never uploads source or private keys."""
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

REPOSITORY='Hydrogeners/bobble-wardrobe'
TAG='v0.1.0-preview.3'
ASSET=Path(__file__).parent/'release-preview-updates'/'BobbleWardrobe-Preview.exe'
data=ASSET.read_bytes()
sha=hashlib.sha256(data).hexdigest()
credential=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True,timeout=15)
values=dict(line.split('=',1) for line in credential.stdout.splitlines() if '=' in line)
headers={'Authorization':'Bearer '+values['password'],'Accept':'application/vnd.github+json','User-Agent':'Bobble-Addons-Preview','X-GitHub-Api-Version':'2022-11-28'}
def request(url,method='GET',body=None,content_type='application/json'):
    head={**headers,'Content-Type':content_type}
    with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=head,method=method),timeout=120) as response:
        return json.load(response)
api='https://api.github.com/repos/'+REPOSITORY
try:
    request(api+'/releases/tags/'+TAG)
except urllib.error.HTTPError as exc:
    if exc.code!=404:raise
else:raise SystemExit('Release tag already exists; refusing to overwrite it')
notes=f'''## Development preview

Windows portable launcher for Bobble League add-ons. Wardrobe is the only add-on currently available.

**Not a finished release.** Native in-game skin attachment, fresh-machine installation, Discord pop-out compatibility, and future Discord updates need further validation. The executable is not Windows code-signed and may trigger a SmartScreen warning. This is an unofficial third-party modification, not affiliated with Discord.

### Signed updates enabled

This launcher includes the trusted HTTPS feed and Ed25519 public key for Wardrobe payload updates. It checks when opened; the installed maintenance helper checks hourly. Updates are applied only while Discord is fully closed. The launcher can cache a verified update until Discord exits.

**Coming from Preview 1 or 2:** download this executable once, fully quit Discord, and select **Install Wardrobe** again to replace the old helper and payload. Old preview copies cannot discover this configuration themselves. Future signed skin/JS payload updates do not require a new executable; launcher/helper binary self-updates are not supported.

Includes the revised character expressions and integrated teal eyes, and fixes the gold base decoration so it belongs to the rolling mesh. Appearance remains under development.

### Bundled Wardrobe skins

- **Hydro** — chestnut cap, glasses and a tailored coat.
- **Nebula** — green field jacket, silver-panel cap with a cream flower, a planet pendant, and a white rolling base with a gold leaf pattern.

Both replace only the head, body and rolling base. Movement, colliders, animation, inputs, networking and shared game assets are untouched. The original appearance remains one selection away.

### Installation

1. Fully quit Discord Stable using its system-tray menu.
2. Download and open `BobbleWardrobe-Preview.exe`.
3. Select your Discord installation and choose **Install Wardrobe**.
4. Open Discord and launch Bobble League. Use the in-game Wardrobe button.

Installation adds a per-user background helper that starts at sign-in and attempts version repair while Discord is closed. To remove Wardrobe and the helper, fully quit Discord, reopen the launcher and choose **Uninstall**. Conflicts with later changes are retained rather than overwritten.

Tested on Windows with Discord Stable 1.0.9267 and game build `Prod-590-CL28650`; future compatibility is not guaranteed. Snow Ballers and in-game accent coloring are unsupported. Future add-ons are placeholders only.

SHA-256 (`BobbleWardrobe-Preview.exe`): `{sha}`
'''
release=request(api+'/releases','POST',json.dumps({'tag_name':TAG,'name':'Bobble Addons 0.1.0 Preview 3 — signed updates','body':notes,'draft':True,'prerelease':True}).encode())
try:
    upload=release['upload_url'].split('{',1)[0]+'?name='+ASSET.name
    asset=request(upload,'POST',data,'application/octet-stream')
    if asset.get('size')!=len(data):raise RuntimeError('Uploaded size mismatch; draft retained')
    result=request(api+'/releases/'+str(release['id']),'PATCH',json.dumps({'draft':False,'prerelease':True}).encode())
    print(json.dumps({'url':result['html_url'],'asset':asset['browser_download_url'],'sha256':sha,'prerelease':result['prerelease']}))
except Exception:
    print('Release remains a draft; inspect it before retrying.')
    raise
