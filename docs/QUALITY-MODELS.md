# Preview 5 / payload 13

Nine textured Meshy-derived character adaptations are included. The retired
tenth skin is no longer bundled/selectable; its saved assignments fall back to
Original with a notice. The rejected low-poly fitting is not used. Assets keep
about 82,200 triangles per character (88,095 for AUGUSTO's new panels) and a 512px
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
- Payload 13 straightens the cloak drape and adds a gold breastplate with a
  pointed pearl center. The new chest panel's vertices and triangle centers are
  tested clear of the visual rolling ball at rest, not throughout native motion.
  The garment changes AUGUSTO's body fitting envelope slightly; head and ball
  geometry remain unchanged from payload 12.
- Targeted outfit fleck cleanup protects original head atlas texels. Refined
  rolling-base tones, bands, wing tips and layered lotus patterns use 4x
  supersampling for narrow edges. Experimental projection atlases were rejected
  because they softened faces. No additional paid generations were used.

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

Preview 4+ pins the separate HTTPS quality feed and existing public key. Preview
4's helper can receive payload 13 automatically after Discord exits. Preview 5
adds signed desktop-launcher handoff; older launchers require one download for
that feature. Preview 1–3 require explicit reinstall to migrate feed/limits.
Legacy releases/feed stay preserved. No private signing key is distributed.
