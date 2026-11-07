# Verify Preview 3

The release contains the Windows executable; this repository contains its source,
bundled JS payloads, model generators and tests. See `RELEASE-PREVIEW-3.json` for
hashes. The GitHub-hosted executable was downloaded after publishing and its SHA-256
matched the local build. This is maintainer verification, not an independent audit.

```powershell
Get-FileHash .\BobbleWardrobe-Preview.exe -Algorithm SHA256
```

Expected executable SHA-256:
`59c1a0418c5cd89ddbc97b947c9696fdf7d85d0652bca946fffb9b02be31c265`

The source was published after Preview 3. Portable test-directory/build tooling and
documentation were added for public contributors; the checked-in `launcher/bundle`
files are the actual release payload, not a claim that later tooling was in the EXE.

## Verify feed signature and payload source

With the build dependencies installed, from `launcher`:

```powershell
python -c "import json; from pathlib import Path; from signed_updates import verify; policy=json.loads(Path('update-policy.json').read_text()); r=verify(Path('../wardrobe-update.json').read_bytes(),policy['publicKey'],0); assert all(data==(Path('bundle')/name).read_bytes() for name,data in r.files.items()); print('Signature and source payload bytes match, release',r.number)"
```

The feed will evolve with later signed releases. Compare against the appropriate
Git commit/release, not an assumption that `main` always equals an older executable.
Cryptographic verification authenticates the signing key, not the safety of code.

The optional real-feed test uses temporary fake Discord resources, downloads a
signed update, applies it and checks byte-exact uninstall restoration:

```powershell
$env:WARDROBE_LIVE_UPDATE_TEST='1'
python -m unittest -v test_live_updates.py
```
