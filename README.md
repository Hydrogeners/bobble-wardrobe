# Bobble Addons · Wardrobe

An **open-source, unofficial Windows launcher** with three Bobble League add-ons:
**Wardrobe, Power Tracker and Recorder**. One shared install, independent controls.

## Download

**[Download Preview 6](https://github.com/Hydrogeners/bobble-wardrobe/releases/tag/v0.1.0-preview.6)** · [Build it yourself](docs/BUILD.md) · [Security and privacy](SECURITY.md)

> **Development preview, not a finished product.** Native in-match attachment,
> Discord pop-out behavior and fresh-machine installation still need validation.
> The Windows executable is not code-signed and may trigger SmartScreen. Public
> source and passing tests are not a guarantee of safety or Discord compatibility.

### Install or upgrade

1. Fully quit Discord Stable from its system tray menu.
2. Open `BobbleWardrobe-Preview.exe`, select your installation, and choose **Install activity mods** or **Update / repair mods**.
3. Reopen Discord and launch Bobble League. Use **Wardrobe**, **Powers**, or **Recordings**.
   Recorder starts off; turn on auto-record only after reading its storage warnings.

**Already installed?** Helpers on the quality feed receive payload **17** after a
full Discord exit. Preview 5 launchers can discover the signed Preview 6 launcher
update. Download Preview 6 directly if necessary. Choose **Update / repair mods**
with Discord fully closed to upgrade the resident helper too.

**Preview 1–3 users:** download Preview 6 once and choose **Install activity mods**
with Discord fully closed to migrate to the quality feed. Their smaller legacy
feed stays unchanged; old executables cannot learn binary auto-updating remotely.

To remove it, fully quit Discord, open the launcher and choose **Uninstall all three**.
Uninstall disables maintenance and removes the owned startup helper. Unknown
conflicts are retained rather than overwritten. See [how it works](docs/ARCHITECTURE.md).

## Skins

- **Hydro, MIKO, TODO, JJCHO, AUGUSTO, FLAIR, SUPA, DUOLINGO and Spark:** textured
  quality models with reference-specific rolling bases, repaired surface
  orientation and corrected head/body/ball dimensions.

Preview 6 bundles payload **17**, retaining Preview 5's straighter pearl cloak, gold chest panel and
pointed white center for AUGUSTO; targeted outfit cleanup across all nine; refined
rolling-base colors and patterns. Facial geometry and source winding are retained.
The retired tenth skin is no longer bundled or selectable; its old assignments
fall back to Original with a notice. Other saved assignments remain intact. See
[quality-model notes and remaining limitations](docs/QUALITY-MODELS.md).

Only the head/body/base meshes and cloned cosmetic materials are replaced.
There are no intended changes to physics, colliders, controls, animation or networking.
Assignments are local. **Use on my team** uses current native team membership,
not club names or screen positions, and suppresses old manual/opponent overrides.
Uncertain ownership leaves originals. With **Remember my choices** enabled,
auto-team choices resume after reload; manual-only choices still start disabled.
Live ownership/rendering verification remains incomplete; synthetic tests are not
proof of correct native appearance in every match.

## Power Tracker

A small draggable checklist inside the activity, not a desktop overlay. Click a
player or use **1–4** to mark/unmark an observed power box. It is manual: no
automatic power detection or game-memory reads. Names, shortcuts, theme and
placement can be customized; match marks never persist. Shortcuts pause while
hidden, typing, editing settings, or another add-on owns focus. Wardrobe and the
tracker and recorder have independent state but share one loader; **Uninstall all three** removes
that shared integration. See [controls, limitations and BLPT attribution](launcher/POWER-TRACKER.md).

## Recorder

Included in the same executable and shared activity install. Silent game-canvas
recording, post-match playback/seeking, timestamps, full-video saving and clips up
to 90 seconds. Compact defaults target **~450 MB/hour**, with **~270 MB/hour**
Smallest available. Smaller files can soften fast motion; these are estimates,
not file-size guarantees. Recording is off until you enable it.

Disk mode writes chunks with a bounded 32 MB queue and 8 GB library budget.
Completed videos can recover for the same verified account. **Cache is not a
backup:** closing/crashing before verified completion, clearing site/profile data,
eviction or failed writes can lose footage. Memory fallback is limited and loses
unsaved videos on close. Save important files to Downloads and verify them.
Viewing/export stays locked during live or unknown play. Keep the activity visible.

For optional public links, install **Node.js 22+**, open this launcher and choose
**Start clip sharing**. Keep the launcher open while uploading. Create/confirm a
clip in **Recordings**; nothing uploads automatically. Links expire, anyone with
the link can watch, and revocation is not guaranteed. Recording and local saving
do **not** require Node.js. The Windows executable does not bundle Node.js.

See [recording, storage and sharing limitations](docs/RECORDER.md).
The recorder-only [upstream repository](https://github.com/Hydrogeners/bobble-recorder)
and developer download remain available; the combined launcher is the one-install
option. Private assistance is not included.

![Wardrobe Preview 5 showing AUGUSTO and club controls. Simulated club state, not a game screenshot.](docs/images/showroom-preview.png)

## Signed updates

**Skins + in-game UI:** the launcher checks when opened, and the installed helper
checks hourly. Only Ed25519-signed payloads from the pinned HTTPS feed are accepted.
Updates to the three owned JavaScript files are cached while Discord runs and
applied after a full exit. Discord is never killed or restarted.

**Desktop launcher (Preview 5+):** on opening, a separate signed descriptor can
download a newer executable to a per-user cache, verify its exact size/hash and
signature, then open it automatically. The original portable file remains a
bootstrap; no running executable is overwritten. Failed/offline checks leave the
current launcher usable. Cached launchers are reverified before handoff.

The resident helper is **not** silently replaced: use **Update / repair Wardrobe**
with Discord closed when upgrading it. Binary signing here is our Ed25519 update
verification, **not** Windows Authenticode; SmartScreen may still appear.

- [Quality-model feed (Preview 4+)](wardrobe-quality-update.json)
- [Signed launcher descriptor (Preview 5+)](launcher-update.json)
- [Legacy feed (Preview 3; unchanged)](wardrobe-update.json)
- [Pinned public key and URL](launcher/update-policy.json)
- [Verification code](launcher/signed_updates.py)
- [Release verification](docs/VERIFY.md)

## Read the code

- [`launcher/`](launcher/): desktop app, journaled installer, background helper,
  Electron bridge, update verification, signing/publishing tools and tests.
- [`hydro/integration/`](hydro/integration/): guarded Unity cosmetic controller,
  skin manager, showroom, preview renderer, asset preparation and tests.
- [`launcher/launcher_updates.py`](launcher/launcher_updates.py): signed binary verification and handoff.
- [`launcher/bundle/`](launcher/bundle/): exact three-addon JS payloads supplied by Preview 6.
- [`recorder/`](recorder/): allowlisted recorder-only source pinned by `UPSTREAM.json`; no private code.
- [`docs/RELEASE-PREVIEW-6.json`](docs/RELEASE-PREVIEW-6.json): current executable/payload hashes.
- [`docs/RELEASE-PREVIEW-5.json`](docs/RELEASE-PREVIEW-5.json): preserved previous executable/payload hashes.
- [`docs/RELEASE-PREVIEW-4.json`](docs/RELEASE-PREVIEW-4.json): executable/payload hashes.
- [`docs/RELEASE-PREVIEW-3.json`](docs/RELEASE-PREVIEW-3.json): preserved earlier record.

The distributed app's source is included. Private signing keys, Discord profiles,
extracted game files, local debugging captures and private assistant/prediction
tools are **not** part of this repository or release. The recorder is included.

## Limitations

- Guarded for game build `Prod-590-CL28650`; unknown builds/signatures are refused.
- Snow Ballers and native halo/arrow recoloring are unsupported; optional color controls are preview-only.
- Discord updates that immediately relaunch may postpone repair until a later full exit.
- No clean-machine or complete native gameplay validation claim.
- Actual Discord OPFS availability, a real-time one-hour game soak and real
  public-provider/Discord sharing remain unverified; external sharing tests are mocked.
- This modifies a third-party client. Review Discord's applicable terms; this is
  not affiliated with or endorsed by Discord, Pokémon or Bungo Stray Dogs.

## Contributing and licensing

See [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) and
[asset/third-party notices](THIRD_PARTY_NOTICES.md). Suggestions and reproducible
bug reports are welcome. Please never post account tokens, profiles or private keys.
