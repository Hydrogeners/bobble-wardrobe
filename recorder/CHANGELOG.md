# Changelog

## 0.2.0 — 2026-11-04

- Established a recording-only repository with fresh history.
- Included real canvas capture, bookmarks, post-match playback, indexing and clips.
- Included the consent-based clip-sharing helper and tests.
- Limited the native adapter's returned data to participation and match lifecycle.
- Removed the desktop command-file execution interface from this distribution.
- Added recorder-only build and distribution boundary checks.

Still pending: actual Discord upload handoff, real hosted clip playback, and
smoothness verification with a new real-match recording.
# Unreleased · UI refinement

- Clear auto-record control, recording state, memory usage and save-before-close guidance.
- Full-video saving is visible beside the recording title; clip tools scroll into view.
- Refined desktop/small-window layouts, playback controls and settings; Escape closes settings or the panel even from text fields.
- Recording-only distribution and live-match playback/export locks are unchanged.
# Unreleased · Disk recording and sharing hardening

- Added OPFS disk spooling with a bounded 32 MB encoded-byte queue and 8 GB local library budget; memory fallback remains explicitly limited.
- Recover completed disk videos for the same verified account; completion manifests exclude raw account IDs and native context data.
- Keep verified partial captures after capacity/backpressure stops instead of immediately discarding all bytes. Encoder/write/lifecycle failures remain fail-closed.
- A prolonged unknown status now stops capture and retains prior footage locked; it can release only after a later actual verified end for the same account/context. It never silently resumes capture across that gap.
- Added deletion-risk banners, first-record confirmation, Read first guidance, approximate capacity, cache/download distinctions, and irreversible-delete confirmations.
- Preserve prepared clips for upload retries or immediate download; bound clip encoding to 720p/30 FPS/4 Mbps and 96 MB, cancel stalled/hidden-tab work, and draw only new decoded frames.
- Added sharing progress/results, safer bounded provider responses, rejected redirects/duplicate multipart fields, one-upload-at-a-time limits, copy/recovery guidance, and a Windows helper starter.
- Cache immutable library summaries to avoid recopying markers on every UI tick; throttle the closed-panel HUD, serialize disk metadata updates, retain originals on indexing failures, and support offline WebMs up to 8 GB.
- Added a simulated one-hour/2.7-GB bounded-queue test, short real OPFS capture/recovery/navigation checks, and a real local-browser sharing handoff with mocked external service/media.
- Still unverified: actual Discord OPFS access, real-time one-hour game recording, and real public-provider/Discord sharing end-to-end. No live Discord restart, installation or uploads were performed.
- Reduced the default recording bitrate from 6 to 1 Mbps (~450 MB/hour instead of ~2.7 GB/hour); added a 0.6-Mbps Smallest option (~270 MB/hour) and 2-Mbps Clearer option. Higher presets remain optional; existing files are unchanged.
- Lowered browser/helper clip encoding from 4 to 1 Mbps (~11 MB for 90 seconds). Settings explain the size/quality tradeoff and show approximate hourly sizes.
