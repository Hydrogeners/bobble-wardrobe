# Local quality preview — payload 12

Payload 12 corrects undersized conversion against extracted human-bobble visual
rest dimensions: 1.0-unit rolling-ball diameter, 1.14345-unit torso width and
0.94032-unit head-core width. Head scaling is uniform and excludes the hat from
the sizing sample; face textures, topology, source winding and rig pivots remain
unchanged. Only owned replacement vertices/normals change, never game transforms,
colliders or physics. The AUGUSTO cloak hem stays above the floor at rest.
Use `release-preview-native-scale/BobbleWardrobe-Preview.exe` for this revision.
Payloads 10 and 11 are preserved in their previous output folders.

Payload 11 reviews all nine rolling bases against the illustrations. MIKO regains
gold bands, Spark an ivory/gold lotus base, SUPA purple/dark wings, DUOLINGO
snow/orange wings, and the remaining bases receive restrained material shading.
AUGUSTO gains a longer, body-parented pearl/gold cloak rather than an isolated
plain sphere. Head geometry and its texture region are unchanged from payload 10.
`release-preview-bottoms` is the preserved payload-11 build;
`release-preview-quality` is the preserved payload-10 build.

This is a **local development preview**, not a public release or official Discord
software. The previous `release-preview-fitted` model build was rejected and
should not be installed. Public Preview 3 and the signed update feed are unchanged.

## What changed

- Preserves the original orientation of Meshy's disconnected surface patches.
  The old normals-recalculation step could flip patches inward, making them
  disappear under back-face culling and look like crumpled/torn paper.
- Retains approximately 82,200 triangles per character instead of 11,700–15,100.
- Uses UV/normal-aware, index-only simplification, with no source-vertex welding
  and no separate height-band stretching.
- Uses 512px atlases with a 448px artwork region instead of a 192px artwork region.
- Keeps smooth, complete rolling balls in stable character colors rather than
  carrying distorted clothing projections around with the rolling part.
- Preserves head/body/base pivots, classic Nebula, skin IDs and restoration.

The higher quality costs more memory and rendering work. Live match performance,
animation clearance and exact collider alignment are **not verified** by the
offline geometry, browser, mock-native and installer tests. Actual hitboxes,
physics and original game resources are not changed.

## Build and try

Build with `build.ps1 -Quality -DistPath release-preview-native-scale` after rebuilding
the quality assets as described in `hydro/integration/MESHY-WARDROBE.md`.

Use `release-preview-native-scale/BobbleWardrobe-Preview.exe`. Fully quit Discord
before choosing **Install Wardrobe**, then reopen Discord. No manual console
pasting is required. Emergency cosmetic restoration remains **Ctrl+Alt+Shift+H**.

The user additionally authorized updating their existing managed installation and
the current live activity without a restart. The one-session helper uses their
already-running origin-scoped cosmetic bridge, restores old meshes before swapping,
and preserves assignments. It does not install or modify Equicord, recorder code,
or startup imports. This helper is not a new launcher dependency. No public
publishing or new Meshy generation is part of this repair. Source Meshy `.blend`
studies and the rejected prototype are retained.

## Size compatibility

Only `wardrobe-live.js` gets a larger, bounded 24 MiB allowance. `main.cjs` and
`activity.js` remain limited to 6 MiB each. Signed envelopes are bounded to 48 MiB;
signature, digest, exact-file-set and replay checks remain enabled. Older preview
launchers cannot accept this larger payload through their original update limits.
Do not publish it to their feed without a migration plan.
