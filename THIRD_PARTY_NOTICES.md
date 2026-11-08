# Code, assets and third-party rights

The MIT license covers this project's original code and contributions to the
extent the contributors hold the rights. It does not grant rights to underlying
characters, trademarks, reference illustrations, Discord or Bobble League assets.

Hydro, MIKO, TODO, JJCHO, AUGUSTO, FLAIR, SUPA, DUOLINGO, Spark and classic Nebula
are fan-art bobble adaptations of user-supplied illustrations, including
references to Bungo Stray Dogs and Pokémon. The nine quality models were
generated using Meshy's image-to-3D service and subsequently fitted/repaired;
Meshy's service terms apply separately from this project's code license. Do not
assume the project's MIT license grants rights to generated or underlying art.
Original reference
illustrations are not redistributed. The authored mesh generators and exports
are included for inspection and editing; underlying character/design rights
remain with their respective owners. Do not assume a commercial character license.

No original Discord/Unity game meshes, textures, archives, WASM or profiles are
distributed. `preview-rig.*` contains numeric rest transforms, not game geometry.
Build identifiers and function signatures document compatibility checks.

## Dependencies

The manual in-activity Power Tracker interaction model is based on
[organpy/BLPT](https://github.com/organpy/BLPT), by **organ**, reviewed at commit
`d27522bdba74545fda47aaf9ca5ea21d10f59600`. Its full MIT copyright/license notice
is in [`launcher/third_party/BLPT-LICENSE.txt`](launcher/third_party/BLPT-LICENSE.txt)
and embedded in the runtime bundle. No upstream executables, game images or
bundled fonts are redistributed; this is not an official BLPT release.

Most dependencies are installed from their upstream distributions. Two JavaScript
libraries are vendored under `hydro/integration/lib/` with their full license texts:

- fflate 0.8.3: MIT, runtime gzip decoder (`fflate-LICENSE.txt`).
- meshoptimizer: MIT, offline mesh simplifier (`meshoptimizer-LICENSE.md`).

Their licenses and those below still apply to builds.

- Python / Tk / Tcl: PSF and Tcl/Tk licenses, included in their distributions.
- cryptography: Apache-2.0 OR BSD-3-Clause; includes upstream native dependencies.
- PyInstaller: GPL-2.0-or-later with its bootloader exception.
- NumPy: BSD-3-Clause (asset preparation only).
- Pillow: HPND (optional atlas preparation only).
- fast-simplification: MIT (asset preparation only).
- Blender: GPL (external model-authoring tool; not bundled into the launcher).

Consult the installed distributions for full license texts and transitive notices.
The launcher uses Windows APIs; Windows is not redistributed.
