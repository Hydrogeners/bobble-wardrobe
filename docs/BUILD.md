# Build and test on Windows

No private signing key, Discord account, original game assets or maintainer drive
layout is required to build the app. The checked-in runtime models and JS bundle
are provided so Blender is optional.

## Launcher

Install 64-bit Python 3.14 (with Tcl/Tk), Node.js 24, Git and PowerShell.

```powershell
git clone https://github.com/Hydrogeners/bobble-wardrobe.git
cd bobble-wardrobe
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r launcher/requirements-build.txt
cd launcher
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

Output: `launcher/release-preview-5/BobbleWardrobe-Preview.exe`.
The script prepares the bundle, runs installer/update/transport tests, packages
Python/Tk with PyInstaller, and tests the frozen helper against isolated fixtures.
It does not register real startup work or modify a real Discord installation.
If the old output is open, close it yourself or use `-DistPath release-custom`.

To run from source for UI inspection: `python launcher.py`. The source GUI cannot
install a standalone executable helper; use the built executable for end-user setup.

## Wardrobe tests / rebuild

From `hydro/integration`:

```powershell
node preview-test.cjs --quality
node visual-test.cjs --quality
node wardrobe-test.cjs
node aim-accent-test.cjs
$env:BOBBLE_ASSET_VARIANT='quality'
python -m unittest -v test_visual_envelope.py test_nebula_rig.py test_fitted_assets.py test_base_styles.py test_native_scale.py
python build-wardrobe.py --quality
```

Then rerun `launcher/build.ps1` to copy the new JS bundle and package it.
Use `python -m http.server 8765 --bind 127.0.0.1` in `hydro/integration` for
`http://127.0.0.1:8765/tests/showroom-fixture.html` (simulated club state, not native proof).
The existing browser resize regression has an unresolved failure in some automated
browser environments; it is not a completed Discord pop-out validation.

## Quality model source

The nine canonical `visual-*-quality.json` files are the inspectable runtime
geometry and atlases. Rebuilding the bundle/launcher needs no Blender, game
assets or paid service. Gzipped payload-10/11 JSON fixtures under `hydro/assets/`
let preservation tests verify the quality and native-size transforms.

`hydro/fit_meshy.py`, `rolling_base.py`, and
`integration/simplify-quality.mjs`, `prepare_visual.py`, `base_styles.py` and
`native_scale.py` and `polish_atlas.py` document the authoring pipeline. The original private Meshy
study `.blend` files and reference illustrations are not redistributed. To
re-author from your own study, use Blender 4.5 and the vendored meshoptimizer
simplifier (license in `integration/lib/`). Pillow is pinned in build requirements
for the atlas-preservation tests; ordinary builds use the canonical JSON instead.

Historical authoring assets/tests remain as preservation fixtures. The retired
skin is not part of the active catalog or distributed runtime bundle. Ordinary
builds use only the nine canonical quality JSONs. Do not regenerate rig transforms
from proprietary bundles for ordinary builds.

## Publishing and trust

Preview 4+ uses `wardrobe-quality-update.json`; do not replace the legacy
`wardrobe-update.json` with a quality payload. Older launchers have smaller
size limits. The one-time migration is downloading the new executable and
choosing Install Wardrobe while Discord is closed. The signed feed updates
JavaScript payloads. Preview 5 additionally uses `launcher-update.json` for signed
desktop handoff; the resident helper still upgrades only through explicit Install.

Signing/publishing scripts are maintainer-only and not packaged. Forks can build
without a signing key; before distributing a fork, replace or disable the upstream
feed/key and `launcher_updates.FEED` rather than implicitly trusting upstream code.
Rebuilds are not claimed bit-for-bit reproducible: Python/PyInstaller, Windows,
timestamps and dependencies can affect binary hashes. Verify payload hashes
independently using [VERIFY.md](VERIFY.md).
