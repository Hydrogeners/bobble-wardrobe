# Bobble Recorder

Recording add-on for the official Bobble League Discord activity. This repository
contains **only the recorder, player, clip sharing, integration and tests**.
It starts with fresh Git history, not a fork of another project's history.

## Features

- Actual game-canvas video, silent WebM recording and timestamp bookmarks.
- Participant-only capture and post-match playback; no live replay previews.
- One custom playback bar, seeking, speed, fullscreen and background indexing.
- Clip trimming and optional, explicitly confirmed expiring Litterbox links.
- Local offline player for saved videos.
- Local disk spooling for long sessions, with completed-video recovery for the
  same verified account. A denied disk API falls back to explicitly warned RAM mode.

No aiming assistance, prediction, opponent-arrow tools, gameplay automation,
simulator, research tools, official game binaries or extracted assets are shipped.
Nothing uploads automatically. Visible game names remain visible in footage.

## Download

[Recorder 0.3.0 preview](https://github.com/Hydrogeners/bobble-recorder/releases/tag/v0.3.0)
contains the recorder-only source, generated activity scripts and offline player.
It is still a developer-style integration, **not** a one-click Discord installer.
Wardrobe/Power Tracker use their [separate launcher](https://github.com/Hydrogeners/bobble-wardrobe/releases/tag/v0.1.0-preview.6).

## Long recordings: read before relying on them

The default disk path is Chromium's origin-private file storage (OPFS), **not**
your Videos folder. Encoded chunks are written as they arrive. The write queue is
capped at **32 MB**; the local recording library budget is **8 GB**. This bounds
the recorder's encoded-byte queue, not all memory used by Discord, Unity, the
encoder, browser caches or the operating system.

- One hour at the default Compact 1 Mbps targets roughly **450 MB**, about
  **83% smaller** than the previous default. Allow at least about **600 MB free**
  for video/storage headroom, plus room for Discord/the game and other apps.
- Smallest 0.6 Mbps targets **270 MB/hour**; Clearer 2 Mbps about **900 MB/hour**.
  Higher-quality 3/6/12 Mbps remain optional. Smaller files can look softer,
  especially during fast movement or at large canvas resolutions. These settings
  affect future recordings, not existing files.
  Encoder bitrate and browser quota estimates are not guarantees of free space.
- **Disk mode must be available.** Check the UI: it shows Local disk or Memory
  only, estimated budget, queue use, and whether eviction protection was granted.
  Memory fallback still has 128/256/384 MB per-match and 512 MB total limits;
  it is **not an hour-long recording mode**.
- Completed disk videos are retained across normal document reloads and recovered
  for the same verified account. Viewing still requires verified post-match state.
  Recovery is a local policy, not server-enforced authorization.
- There is no automatic deletion of older completed recordings. When a recording
  budget/write queue fills, capture stops; the retained partial remains locked
  until an actual verified match end. Disk-write errors can still lose unfinished
  video. Save/delete old cached videos or free disk before long matches.

**What can delete or lose videos:** closing/reloading/crashing before completion,
stopping auto-record early, leaving a match without a verified end, prolonged
unresolved participation at closure, failed disk writes/encoding, cleared site/activity data,
profile removal, storage eviction, or deleting a cached recording. Memory-only
videos disappear on close. OPFS is a cache, **not a backup**. Save full videos or
clips to Downloads and check that the downloads completed. A download request
does not prove the browser saved the file. Deleting a cache entry does not delete
your separate downloaded file and does not revoke a public clip URL.

Validation includes a **simulated** 60-minute 6-Mbps/2.7-GB accounting test with
bounded queued bytes, real short Chromium OPFS capture/recovery, and actual
encode/decode/trim tests. A real-time one-hour Discord game soak and OPFS access
in the actual Discord activity remain unverified. Do not treat this as guaranteed
hour-long recording on every machine.

## Build and test

Requires Node.js 22+ and Python 3. No npm dependencies:

```sh
npm test
python tools/build_recorder.py
```

Build output is `dist/bl-recorder-payload.js` and `dist/bl-recorder-main.js`.
`npm test` includes a distribution boundary check that rejects unrelated tracked
files and checks the generated payload contains only recording modules.

The offline player is `replay_lab/index.html`. Open a previously saved WebM and,
optionally, its timestamp JSON. It cannot connect to or record a live game.

## Desktop integration

**Developer integration, not a one-click Discord plugin installer.** The main
module must be loaded by an existing compatible Equicord/Vencord main-process
integration, with both generated files in the same directory. Do not edit an
unrelated Discord installation or restart an ongoing game to try this out.

The bridge discovers the activity's Unity instance. A read-only, build-specific
adapter verifies local participation and actual match completion. Internal object
validity checks read game memory; no memory/game-state writes, aiming controls,
packet tools or external arbitrary-JavaScript command channel are included.
This is an unofficial add-on, not approved or distributed by Discord/the game.

## Clip links

Run `node tools/clip_host.cjs` locally. In the player, choose **Create clip**,
set start/end, **Create link**, then **Upload clip** and confirm public sharing.
Only the prepared clip is sent. Links default to 24-hour expiry; anyone with the
link can watch, and free-host availability/Discord embeds are not guaranteed.

On Windows, double-click **Start clip sharing.cmd** (Node.js 22+ required) and
keep that window open. FFmpeg is optional for helper media processing; the
in-activity browser clip encoder does not require it. Clip creation is real-time,
up to **90 seconds**, at up to **1280×720 / 30 FPS / 1 Mbps** (roughly **11 MB**
for 90 seconds). Keep the activity
visible during encoding. Full recordings retain their original capture format.

Prepared clips are kept in the current UI session. After upload failure, choose
**Upload clip** to retry without re-encoding, or **Save clip** to download it.
The sharing tab displays upload-in-progress and then a playable link/copy button
or clear failure guidance. It can take up to five minutes. Closing the upload tab
cancels the request, but cannot retract bytes already received by the provider.
Closing the activity or selecting a different recording loses the prepared clip;
the completed original disk recording is separate and is not deleted by sharing.
Links are public, expire, may disappear earlier, and have no guaranteed revocation.

The helper binds only `127.0.0.1:8789`. Never expose it on a LAN. Discord blocks
local fetch, so sharing uses a user-initiated top-level form/tab handoff.
**That Discord handoff and real hosted playback are not yet verified end-to-end.**
Local-browser form submission, streaming progress/results, copy-button execution,
provider failure/retry handling and playable media responses are exercised in
tests. Provider requests/media responses are mocked; tests do not upload footage.

## Limitations

- Memory-only videos disappear when the activity closes; disk-cache deletion risks
  and unfinished-video loss are detailed above and in the UI's **Read first**.
- Match-end release is local policy, not tamper-proof server authorization.
- Game updates can invalidate the native lifecycle adapter; it must fail closed.
- Background indexing improves missing duration/seeking metadata. It cannot repair
  frozen or dropped frames already encoded. New real-match smoothness still needs
  verification.
- Browser/media integration tests currently use local Windows Chrome/QA paths;
  media-helper checks also need FFmpeg/ffprobe and the browser calibration fixture.

See `CHANGELOG.md` for updates. Download/share **this repository only**; it has
clean recorder-only history. While private, downloads require collaborator access.
