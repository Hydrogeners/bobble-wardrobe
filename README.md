# Bobble Addons · Wardrobe

An **open-source, unofficial Windows launcher** for local Bobble League cosmetics.
Wardrobe is the only implemented add-on. This repository is separate from Bobble Recorder.

## Download

**[Download Preview 4](https://github.com/Hydrogeners/bobble-wardrobe/releases/tag/v0.1.0-preview.4)** · [Build it yourself](docs/BUILD.md) · [Security and privacy](SECURITY.md)

> **Development preview, not a finished product.** Native in-match attachment,
> Discord pop-out behavior and fresh-machine installation still need validation.
> The Windows executable is not code-signed and may trigger SmartScreen. Public
> source and passing tests are not a guarantee of safety or Discord compatibility.

### Install or upgrade

1. Fully quit Discord Stable from its system tray menu.
2. Open `BobbleWardrobe-Preview.exe`, select your installation, and choose **Install Wardrobe**.
3. Reopen Discord and launch Bobble League. Use the Wardrobe button to select a skin.

**Preview 1–3 users:** download Preview 4 once and choose **Install Wardrobe**
again while Discord is fully closed. This upgrades the launcher/helper and moves
you to the quality-model feed. Older launchers cannot accept the larger models;
their original feed and Preview 3 remain available and unchanged. Launcher/helper
executables do not update themselves automatically.

To remove it, fully quit Discord, open the launcher and choose **Uninstall**.
Uninstall disables maintenance and removes the owned startup helper. Unknown
conflicts are retained rather than overwritten. See [how it works](docs/ARCHITECTURE.md).

## Skins

- **Hydro, MIKO, TODO, JJCHO, AUGUSTO, FLAIR, SUPA, DUOLINGO and Spark:** textured
  quality models with reference-specific rolling bases, repaired surface
  orientation and corrected head/body/ball dimensions.
- **Nebula · classic:** the earlier green field-jacket skin; saved IDs still work.

Preview 4 bundles payload **12**. Source winding, facial detail and rig pivots are
preserved; AUGUSTO has a body-parented pearl/gold cloak. See
[quality-model notes and remaining limitations](docs/QUALITY-MODELS.md).

Only the head/body/base meshes and cloned cosmetic materials are replaced.
There are no intended changes to physics, colliders, controls, animation or networking.
Assignments are local; custom cosmetics start disabled after reload.

## Signed updates

The launcher checks when opened; the installed helper checks hourly. It accepts
only Ed25519-signed payloads from the configured HTTPS feed. Updates apply only
while Discord is fully closed. This updates **three JavaScript payload files**,
not the launcher/helper executable. Binary updates still require a new download.

- [Quality-model feed (Preview 4+)](wardrobe-quality-update.json)
- [Legacy feed (Preview 3; unchanged)](wardrobe-update.json)
- [Pinned public key and URL](launcher/update-policy.json)
- [Verification code](launcher/signed_updates.py)
- [Release verification](docs/VERIFY.md)

## Read the code

- [`launcher/`](launcher/): desktop app, journaled installer, background helper,
  Electron bridge, update verification, signing/publishing tools and tests.
- [`hydro/integration/`](hydro/integration/): guarded Unity cosmetic controller,
  skin manager, showroom, preview renderer, asset preparation and tests.
- [`hydro/build_model_v3.py`](hydro/build_model_v3.py) and
  [`hydro/build_nebula.py`](hydro/build_nebula.py): editable Blender generators.
- [`launcher/bundle/`](launcher/bundle/): exact JS payloads supplied by Preview 4.
- [`docs/RELEASE-PREVIEW-4.json`](docs/RELEASE-PREVIEW-4.json): executable/payload hashes.
- [`docs/RELEASE-PREVIEW-3.json`](docs/RELEASE-PREVIEW-3.json): preserved earlier record.

The distributed app's source is included. Private signing keys, Discord profiles,
extracted game files, local debugging captures and unrelated recorder/assistant
overlays are **not** part of this repository or release.

## Limitations

- Guarded for game build `Prod-590-CL28650`; unknown builds/signatures are refused.
- Snow Ballers and native halo/arrow recoloring are unsupported; Accent Lab is preview-only.
- Discord updates that immediately relaunch may postpone repair until a later full exit.
- No clean-machine or complete native gameplay validation claim.
- This modifies a third-party client. Review Discord's applicable terms; this is
  not affiliated with or endorsed by Discord, Pokémon or Bungo Stray Dogs.

## Contributing and licensing

See [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) and
[asset/third-party notices](THIRD_PARTY_NOTICES.md). Suggestions and reproducible
bug reports are welcome. Please never post account tokens, profiles or private keys.
