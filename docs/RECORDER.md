# Recorder · third addon in Bobble Addons

Install once through the launcher, then open Bobble League → **Recordings**.
Preview 7 puts **Turn on auto-record** in a fixed control row, outside all library
and playback scrolling. Normal playback/save/clip-entry controls fit desktop,
compact and mobile views; expanded trimming and long libraries can still scroll.
The recorder starts **off**. Read **Read first**, then enable auto-record for
matches you participate in. It captures silent game-canvas WebM, not desktop,
microphone or voice chat. It does not predict, simulate or automate gameplay.

## Size and performance

- Default Compact: 1 Mbps, roughly **450 MB/hour**.
- Smallest: 0.6 Mbps, roughly **270 MB/hour**; Clearer: 2 Mbps, **900 MB/hour**.
- Higher 3/6/12-Mbps presets remain optional. Lower bitrate may soften motion or
  small details, especially on large canvases. These are targets, not hard caps.
- Disk mode writes encoded chunks rather than keeping the video in RAM. The
  encoded-byte queue is capped at 32 MB; the library budget is 8 GB. This does not
  cap Discord/Unity/encoder/browser/OS memory. Leave free disk space for the game.
- Check the UI's **Local disk** / **Memory only** status. Browser quota estimates
  may exceed actual disk space. RAM fallback is not the hour-long recording mode.
- Keep the activity visible; background throttling can freeze/drop frames.

## What can be lost

The disk cache is browser origin-private storage, **not** your Videos folder or a
backup. Completed videos can recover for the same verified account; playback and
export still require verified post-match status. Closing/crashing before a
verified match end, stopping early, unresolved participation at closure, disk
errors or encoder failure can lose unfinished video. Clearing activity/site data,
profile removal or browser eviction can delete completed cached videos too.
Memory-only recordings disappear on activity close/reload.

Capacity/backpressure stops retain a locked partial until an actual verified end
for the same account/context. Unknown state never silently resumes recording
across a prolonged gap. Failed/unverified footage is not released as a live replay.

**Save full video** or **Save clip**, then check the file completed in Downloads.
A download request is not proof of a saved file. Cached-video deletion has no undo;
it does not delete separately downloaded files or revoke public clip links.
Uninstalling all three removes the shared loader; save important videos first.

## Optional public sharing

Recording, playback and local saving need no external service or Node.js. For
public clip links, install Node.js 22+, keep the launcher open, and choose
**Start clip sharing**. No helper is autostarted with Windows/Discord. No Node.js
runtime is bundled; the launcher gives a clear dependency message if it is absent.

Inside Recordings: **Create clip** → select 0.2–90 seconds → **Create link** →
confirm **Upload clip**. Encoding takes real time, up to 720p / 30 FPS / 1 Mbps
(~11 MB for 90 seconds). Keep the tab visible. Upload progress and results appear
in a separate tab. A prepared clip can be retried or saved without re-encoding.

Nothing uploads until you confirm. Litterbox receives the selected clip, including
visible player names. Anyone with the link can watch. Links expire or may be
removed earlier; removal/revocation is not guaranteed. Keep a local copy. Closing
the upload tab or owning launcher may cancel the request, but cannot recall bytes
already received by the host. The original completed recording is separate.

The localhost helper is restricted to the exact activity Origin/Host and a
hardcoded provider. Unknown listeners on its port are not stopped or taken over.
Private assistance is not included.

## Verification limits

Pinned recorder source and manifest: [`recorder/UPSTREAM.json`](../recorder/UPSTREAM.json).
Synthetic hour accounting, bounded-queue/recovery tests and short actual Chromium
encode/decode/clip/OPFS tests pass. Combined-addon tests cover error isolation and
UI coexistence, not live game ownership or rendered motion. **Actual Discord OPFS
access, a real-time one-hour Discord game soak and real public-provider/Discord
handoff remain unverified.** External-service test traffic is mocked, not footage uploads.
