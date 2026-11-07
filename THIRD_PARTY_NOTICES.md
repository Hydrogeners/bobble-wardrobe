# Code, assets and third-party rights

The MIT license covers this project's original code and contributions to the
extent the contributors hold the rights. It does not grant rights to underlying
characters, trademarks, reference illustrations, Discord or Bobble League assets.

Hydro and Nebula are fan-art bobble adaptations of user-supplied illustrations,
referencing Ranpo Edogawa (Bungo Stray Dogs) and N (Pokémon). Original reference
illustrations are not redistributed. The authored mesh generators and exports
are included for inspection and editing; underlying character/design rights
remain with their respective owners. Do not assume a commercial character license.

No original Discord/Unity game meshes, textures, archives, WASM or profiles are
distributed. `preview-rig.*` contains numeric rest transforms, not game geometry.
Build identifiers and function signatures document compatibility checks.

## Dependencies

Dependencies are installed from their upstream distributions; third-party source
and native libraries are not vendored here. Their licenses still apply to builds.

- Python / Tk / Tcl: PSF and Tcl/Tk licenses, included in their distributions.
- cryptography: Apache-2.0 OR BSD-3-Clause; includes upstream native dependencies.
- PyInstaller: GPL-2.0-or-later with its bootloader exception.
- NumPy: BSD-3-Clause (asset preparation only).
- fast-simplification: MIT (asset preparation only).
- Blender: GPL (external model-authoring tool; not bundled into the launcher).

Consult the installed distributions for full license texts and transitive notices.
The launcher uses Windows APIs; Windows is not redistributed.
