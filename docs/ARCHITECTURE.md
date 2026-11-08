# Architecture

## Desktop → Discord → activity

`launcher.py` is a Tk desktop hub. `install_core.py` journals wrapper installation,
preserves original bootstraps, and restores only owned bytes. `channel_manager.py`
tracks versions and approved payload snapshots. `background.py` maintains the
newest discovered Stable version only while that channel is fully closed.

`main.cjs` is the Discord Electron wrapper/bridge, using an in-process debugger
transport rather than a listening debugging port. It restricts injection to Bobble
activity origins. `activity.js` captures the approved Unity module and initializes
the Wardrobe bundle once per document. Late recovery reads only the callback's
bound receiver's `unityInstance.Module`; it does not enumerate the receiver or call
the game callback.

## Cosmetic controller

`build-wardrobe.py` bundles the authored data and `visual-template.js` controller
factory with the club catalog, manager, accent controls and showroom. Function
identity/arity and build guards must match before guarded native calls are used.
The controller pins original renderer resources, creates owned replacements,
verifies assignments and restores originals before freeing owned resources.

`skin-manager.js` manages supported-club assignments and optional current-team
selection. `skin-preview.js` renders independently of the game's graphics context.
`skin-showroom.js` supplies the browser UI. Native indicator recoloring remains gated.

`skin-team.js` resolves the current local side through relay/context/visual
backlinks and live BallBobble roots, including mirror clubs. It does not infer
ownership from club names, positions or turn order. Auto mode suppresses manual
overrides; unverified ownership restores originals. Remembered auto selections
can resume after reload; manual-only configurations start disabled.

## Manual Power Tracker

`power-tracker-core.js` validates manual checklist state and shortcuts;
`power-tracker.js` mounts a separate compact Shadow DOM panel inside the activity.
It uses no game-memory reads, network requests or global keyboard hooks. Preferences
use localStorage, but marks do not persist. Plain 1–4 shortcuts yield while hidden,
typing, configuring settings or another add-on owns focus. The same signed
`wardrobe-live.js` transports all three mods; uninstalling the shared loader removes all three.

## Recorder

`recorder/UPSTREAM.json` pins the allowlisted recorder-only source commit and
normalized SHA-256 manifest. `launcher/recorder_bundle.py` verifies it and appends
the recorder modules to the shared payload under a separate error boundary. The
standalone Unity hook and Electron wrapper are not duplicated; all three use the
existing activity bootstrap. Cosmetic initialization failure does not prevent
the recorder from starting. Native readers are read-only; recording starts off.

The only build-time recorder adaptation is user-facing sharing instructions that
refer to the combined launcher's **Start clip sharing** action rather than the
standalone `.cmd`. The optional localhost worker is the reviewed Node helper,
explicitly started by `recorder_helper.py` only on user request. It binds
127.0.0.1:8789, requires Node.js 22+, and stops when its owning launcher closes.
It never auto-starts with Discord/Windows and never uploads without per-clip consent.
An existing unknown listener is not killed. The helper's code is packaged as
`recorder-tools/clip_host.cjs`; helper binary/source changes require a new signed
launcher, while recorder activity changes travel in the shared signed JS payload.
Private assistance is excluded.

## Updates

`signed_updates.py` downloads/verifies the signed envelope; `sign_release.py` creates
it offline. `sign_windows_release.py` uses the maintainer's external DPAPI-protected
key. `publish_preview.py` uploads the portable prerelease binary; it does not publish
private keys. Signing and publishing are not build prerequisites.

`launcher_updates.py` separately verifies a bounded Ed25519 descriptor for product
`bobble-wardrobe-launcher`. Only this repository's immutable GitHub release-asset
URLs are accepted. Binary redirects are HTTPS-only and restricted to GitHub's
asset hosts. Exact length, MZ header and signed SHA-256 must match before staging
and again before process handoff. A signed cache records the highest downloaded
release; older descriptors and same-counter content changes are rejected. Files
under `%LOCALAPPDATA%/BobbleWardrobe/launcher-updates` are retained, not overwritten
if modified. The original portable launcher stays a bootstrap. This is not a
Windows Authenticode signature or an unattended resident-helper replacement.

The public feed can change, but accepted changes must verify under the public key
pinned in the executable and have an increasing release number. The helper does
not rewrite itself. Uninstall first disables maintenance and leaves a durable opt-out.
