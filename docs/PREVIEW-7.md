# Preview 7 · payload 19

All three add-ons remain in one shared install. Preview 5/6 users can update
without uninstalling: check for launcher updates, fully quit Discord, then choose
**Update / repair mods** in Preview 7. Saved preferences and downloaded videos
are retained. Recording starts off until explicitly enabled.

## Changes

- **Power Tracker** replaces the shortened button/header. A visible **Edit names**
  action focuses labeled fields; Save persists names. Cancel/Escape discard drafts.
  An early bootstrap guard shields typing from Unity window-capture handlers.
- **Halo & aiming arrow** controls are always visible, no disclosure. These are
  preview-only controls; in-game recoloring is not supported. Character names
  are uppercase.
- JJCHO head is 12% taller around the chin; AUGUSTO head is 10% broader and 6%
  shorter for cartoon proportions. DUOLINGO's lower coat front extends over its
  former cut, without moving the scarf, upper garment or rolling-base vertices.
- Original verified 2048px artwork is resampled to 1024px atlases to reduce tiny
  seam lines. RGB noise rounding has at most four levels of error. The old
  ball/cloak-strip pixels are retained exactly. Strongly reversed tiny triangles
  are corrected using original vertex normals; no triangles are deleted or UV
  islands welded. Source/output hashes: `hydro/integration/surface-repair-report.json`.
- Recorder's **Turn on auto-record** stays outside scrolling content. Normal
  playback/save/clip-entry controls fit desktop, compact and mobile views;
  expanded trim tools and long libraries can scroll. Data-loss warnings remain.

## Preservation and verification

Rollback seeds: `hydro/assets/before-surface-repair-19/*.json.gz`. Recreate candidates
with `repair_surfaces.py SEED_DIRECTORY NEW_OUTPUT_DIRECTORY` and the verified
owned authoring GLBs; source GLBs are not required for normal builds.
Historical native-fit/base tests cover the seed stage; separate final-asset tests
check output hashes, bounds, UV affine remap, silhouette changes, unchanged scarf
geometry, texture strips and triangle membership. Lossless row-delta byte-plane
texture transport remains inside the existing signed-update limits and all nine
decoded assets are checked byte-for-byte against source.

1024px native textures cost about 4 MB per instantiated atlas versus 1 MB before.
Native in-game performance/appearance, real Discord OPFS, real-time hour-long
recording and real public-provider/Discord sharing remain unverified. Browser
fixtures use synthetic native bindings or labeled calibration video, not game
proof. No footage was publicly uploaded. No paid generation or private assistance
is included. The Windows EXE is not Authenticode-signed.
