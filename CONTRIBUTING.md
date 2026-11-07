# Contributing

Start with [build instructions](docs/BUILD.md) and [architecture](docs/ARCHITECTURE.md).
Keep changes narrow and include tests. Do not weaken build/signature checks to
force a skin onto an unknown game version.

For bugs, include Windows/Discord/game versions, expected vs actual behavior,
whether the install is stock or modded, and a minimal reproduction. Redact private
paths/account information. Do not upload profiles, proprietary game assets or keys.

No real Discord installation should be touched by automated tests. Use temporary
fixtures; test new installer behavior for rollback, conflict retention and uninstall.
Mock tests do not establish native rendering or future Discord compatibility.

Model changes should include front/side previews and preserve renderer pivots.
Preview-only controls must not silently become native gameplay writes.
