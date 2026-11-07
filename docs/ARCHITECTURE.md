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

## Updates

`signed_updates.py` downloads/verifies the signed envelope; `sign_release.py` creates
it offline. `sign_windows_release.py` uses the maintainer's external DPAPI-protected
key. `publish_preview.py` uploads the portable prerelease binary; it does not publish
private keys. Signing and publishing are not build prerequisites.

The public feed can change, but accepted changes must verify under the public key
pinned in the executable and have an increasing release number. The helper does
not rewrite itself. Uninstall first disables maintenance and leaves a durable opt-out.
