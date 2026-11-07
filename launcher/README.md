# Wardrobe launcher · Preview 5

Portable Windows development preview for nine local Bobble League skins.
Download: <https://github.com/Hydrogeners/bobble-wardrobe/releases/tag/v0.1.0-preview.5>.

## Install / upgrade

Fully quit Discord Stable, open `BobbleWardrobe-Preview.exe`, and choose
**Install Wardrobe** or **Update / repair Wardrobe**. Reopen Discord normally.
The helper checks hourly for signed skin/UI payloads and repairs new Discord
Stable versions only while Discord is fully closed. No process is force-killed.
Uninstall disables maintenance, removes its owned startup helper and restores
all tracked bootstrap bytes. Modified or unfamiliar files are retained.

Preview 4 installations receive payload 13 through the quality feed; download
Preview 5 once for the refreshed desktop and launcher auto-updates. Preview 1–3
need this one-time download/install to migrate from the unchanged smaller feed.

## Updates and trust

- `update-policy.json` pins the HTTPS quality-feed URL and Ed25519 public key.
- `signed_updates.py` accepts only the three owned JS files, with verified
  signature, digest, bounded size and increasing payload release counter.
- `launcher_updates.py` independently verifies `launcher-update.json` for the
  launcher product. It accepts only this repository's release-asset URLs, checks
  exact size/SHA-256, stages to a per-user cache and reverifies before opening a
  newer launcher. No running EXE is overwritten. Network failure leaves the
  current app usable; a previously verified signed cache can work offline.
- The original portable file remains a bootstrap. The resident helper does not
  rewrite itself; explicit Install upgrades it with Discord closed.
- The executable is **not Windows code-signed**; SmartScreen may still appear.
  An update signature establishes the trusted signer, not software safety.
- Same-user malware can tamper with local state; this is not an OS trust boundary.

State lives under `%LOCALAPPDATA%/BobbleWardrobe/maintenance`; verified launcher
copies live in the sibling `launcher-updates` directory. Uninstall removes the
startup integration, not portable launchers/cached launcher copies or optional
activity preferences. Those inactive copies can be removed manually when closed.

## Build / test

From this directory, with Python 3.14, Node 24 and build requirements installed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File build.ps1
```

Output: `release-preview-5/BobbleWardrobe-Preview.exe`. The build runs geometry,
transport, installer, signature, binary-updater and isolated packaged-helper tests.
It never registers real startup work or changes the user's Discord installation.
`python launcher.py` is for source UI inspection; only packaged builds install a
self-contained helper or perform signed binary handoff.

## Maintainer publishing

Use a new monotonic counter in `release-metadata.json`, rebuild, and sign both
the quality payload and launcher descriptor. The signing key is current-user
DPAPI encrypted **outside** the repository at
`%LOCALAPPDATA%/BobbleWardrobeSigning/release-key.dpapi`. Never publish it or
reinitialize it for a routine release. Portable key recovery remains unresolved.
`sign_windows_release.py` signs payloads; `launcher_updates.sign` signs the
launcher descriptor; `publish_quality_preview.py` uploads a new prerelease
without replacing earlier tags. Neither signing nor publishing is a build prerequisite.

Native in-match attachment/motion, pop-outs, clean-machine installation and
future Discord compatibility still need broader validation. No gameplay,
recorder or prediction/assistance code is distributed here.
