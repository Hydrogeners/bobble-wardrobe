# Preview 4 / payload 12

Nine textured Meshy-derived character adaptations are included, plus classic
Nebula. The rejected low-poly fitting is not used. Quality assets keep about
82,200 triangles per character (85,087 for AUGUSTO's added cloak) and a 512px
atlas with a 448px face/outfit-art region.

## Surface and sizing repairs

- Preserve original winding of disconnected UV islands: recalculating each
  island's normals had inverted visible patches. Back-face culling stays on.
- Use UV/normal-aware, index-only simplification with locked borders; no source
  vertex welding or destructive face-band stretching.
- Correct the undersized whole-character envelope using extracted human Bug
  prefab **visual rest dimensions**, not colliders: ball diameter 1.0, torso
  width 1.143454 and face-core width .940315. Hats do not determine face size.
- Scale each head uniformly, preserving its topology, artwork and proportions.
  Rig origins, animation transforms, hitboxes and physics remain untouched.
- Use separate reference-led rolling textures, not projected clothing. AUGUSTO's
  open pearl/gold cloak belongs to the body, not the rolling ball.

## Validation and limits

Offline geometry/style checks, exact compression round-trips, preview rendering,
mock-native attachment/restoration, security/installer tests and the packaged
helper lifecycle passed locally. Payload 12 also loaded into an already-running
supported activity without a restart or engine error. Skins were off during that
load, so this **does not prove native in-match attachment, animation clearance,
live performance or collider alignment**. Clean-machine installation, Discord
pop-outs and update repair still need broader validation.

The executable is not Windows code-signed. This is a development prerelease,
not official Discord software. Snow Ballers and native indicator recoloring
remain unsupported. Emergency restore: **Ctrl+Alt+Shift+H**.

## Update compatibility

Only `wardrobe-live.js` has the 24 MiB quality-file budget. Other payload files
stay at 6 MiB; signed envelopes at 48 MiB; decoded compact assets at 64 MiB.
Signature, exact-file-set, digest and replay checks remain enabled.

Preview 4 pins a separate HTTPS quality feed and the existing signing public key.
The Preview 3 feed/binary remain available. Users must download Preview 4 once
and reinstall while Discord is closed; old launcher/helper binaries cannot
self-update to gain the larger limit. Subsequent signed quality payloads can
use the new feed normally. No private signing key is distributed.
