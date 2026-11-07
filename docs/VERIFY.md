# Verify Preview 5

The release contains the Windows executable; this repository contains its source,
bundled JS payloads, canonical quality models, authoring scripts and tests.
See `RELEASE-PREVIEW-5.json` and the release's `SHA256SUMS.txt` for hashes.
This is maintainer verification, not an independent audit.

```powershell
Get-FileHash .\BobbleWardrobe-Preview.exe -Algorithm SHA256
```

Compare against `executable.sha256` in `RELEASE-PREVIEW-5.json`. Executables are
not Windows code-signed and rebuilds are not claimed bit-for-bit reproducible.
The checked-in `launcher/bundle` files are the release payload. The older
`RELEASE-PREVIEW-3.json` record remains available for verifying Preview 3 at its tag.

## Verify feed signature and payload source

With the build dependencies installed, from `launcher`:

```powershell
python -c "import json; from pathlib import Path; from signed_updates import verify; policy=json.loads(Path('update-policy.json').read_text()); r=verify(Path('../wardrobe-quality-update.json').read_bytes(),policy['publicKey'],0); assert all(data==(Path('bundle')/name).read_bytes() for name,data in r.files.items()); print('Signature and source payload bytes match, release',r.number)"
```

The feed will evolve with later signed releases. Compare against the appropriate
Git commit/release, not an assumption that `main` always equals an older executable.
Cryptographic verification authenticates the signing key, not the safety of code.
The legacy `wardrobe-update.json` is deliberately unchanged for older launchers;
it does not match the current quality bundle.

Verify the separate signed desktop descriptor and executable:

```powershell
python -c "import json; from pathlib import Path; from launcher_updates import verify,validate_binary; p=json.loads(Path('update-policy.json').read_text()); r=verify(Path('../launcher-update.json').read_bytes(),p['publicKey']); validate_binary(Path('release-preview-5/BobbleWardrobe-Preview.exe').read_bytes(),r); print('Signed launcher bytes match, release',r.number)"
```

Tests cover wrong products/URLs/signatures, tampered binaries, replay, same-counter
reuse, offline signed-cache reuse and verification again before launch. This does
not prove future release handoff under every Windows/antivirus configuration.

The optional real-feed test uses temporary fake Discord resources, downloads a
signed update, applies it and checks byte-exact uninstall restoration:

```powershell
$env:WARDROBE_LIVE_UPDATE_TEST='1'
python -m unittest -v test_live_updates.py
```
