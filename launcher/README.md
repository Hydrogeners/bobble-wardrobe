# Bobble Addons · Preview 6

Preview 6 includes **Wardrobe, Power Tracker and Recorder in one install**.
The minimal in-activity tracker is rebuilt from organpy/BLPT; see
[POWER-TRACKER.md](POWER-TRACKER.md). Recorder safety and sharing details are in
[RECORDER.md](../docs/RECORDER.md).
Payload **17** includes the UI refresh, ownership-checked auto-team skins,
and plain 1–4 tracker shortcuts without reusing prior release counters. The
release executable is `release-preview-6/BobbleWardrobe-Preview.exe`.
GitHub and both signed quality/launcher feeds carry this preview. No private assister is
included. All three share the activity installer; uninstall removes all three.

### UI and auto-team fixes

- Wardrobe's main action is **Use on my team**. Manual club assignments are
  tucked under **Manual club overrides** and are disabled while auto-team is on.
- Auto-team suppresses manual assignments, including old opponent-club choices.
  It requires the current relay/context/visuals backlinks and the local side's
  live BallBobble membership, not a club-name or position guess. Mirror clubs
  are distinguished by visual roots; missing/stale ownership restores originals.
- With **Remember my choices** checked, the auto skin is saved and re-enabled
  next activity load. Manual-only preferences still start disabled. Auto mode
  can wait in the lobby without the manual-mode 30-minute timeout.
- Power Tracker retains its tiny 216px panel and 1–4 defaults, with clearer
  marked rows, keycaps, and controls. Its launcher sits above the separate
  recorder HUD; number shortcuts yield to other add-ons owning focus.
- Recorder 0.3.0 is bundled from allowlisted, commit/hash-pinned source under
  `recorder/`. It starts off, targets ~450 MB/hour by default (~270 MB/hour
  optional), uses disk storage when available, and includes playback/clip tools.
  The private assister is excluded.
- **Start clip sharing** explicitly launches the bundled localhost helper using
  Node.js 22+ (not bundled). Keep the launcher open while sharing. Recording and
  local saving need no Node.js; no helper/uploads start automatically.

Native ownership is covered by synthetic-heap tests for both sides, mirror
clubs, stale contexts, spectators and invalid lists. Live in-match ownership and
rendering still require verification; browser fixture screenshots are not game
screenshots. Building from source does not restart Discord or publish update feeds.

## Download: Wardrobe Preview 6

Portable Windows development preview for nine local Bobble League skins.
Download: <https://github.com/Hydrogeners/bobble-wardrobe/releases/tag/v0.1.0-preview.6>.

## Install / upgrade

Fully quit Discord Stable, open `BobbleWardrobe-Preview.exe`, and choose
**Install activity mods** or **Update / repair mods** in the local build
(Preview 5 calls these **Install Wardrobe** / **Update / repair Wardrobe**).
Reopen Discord normally.
The helper checks hourly for signed skin/UI payloads and repairs new Discord
Stable versions only while Discord is fully closed. No process is force-killed.
Uninstall disables maintenance, removes its owned startup helper and restores
all tracked bootstrap bytes. Modified or unfamiliar files are retained.

Preview 4+ installations receive payload 17 through the quality feed; Preview 5
can discover the newer signed launcher. Preview 1–3
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

Output: `release-preview-power-tracker/BobbleWardrobe-Preview.exe`. The build runs geometry,
transport, recorder/provenance, installer, signature, binary-updater and isolated packaged-helper tests.
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
future Discord compatibility still need broader validation. Recorder is included;
private prediction/assistance code is not. Real-time one-hour Discord recording,
actual Discord OPFS availability and real public-host handoff remain unverified.
