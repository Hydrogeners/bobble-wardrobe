# Security and privacy

This is a development preview and a third-party client modification. Read the
source and limitations before installing. Do not treat signatures as a malware
scan or the availability of source as proof that a binary was independently built.

## What changes

- Own per-user files under `%LOCALAPPDATA%/BobbleWardrobe`.
- A `BobbleWardrobe` value in `HKCU/Software/Microsoft/Windows/CurrentVersion/Run`.
  Discord's startup entry is not modified.
- An owned wrapper/backup in selected Discord Stable `resources` directories.
  Existing archive/bootstrap bytes are journaled for restoration.
- In the activity: locally cloned meshes/materials, subject to build/signature guards.

It never intentionally force-kills Discord, reads login tokens/profiles, changes
gameplay/networking, exposes a TCP debugging port or includes telemetry. The
Electron bridge does attach an in-process debugger, which may conflict with other
debugger users. Inspect `main.cjs` for the exact allowlist and recovery path.

## Network

The update-enabled launcher/helper fetches the public URL in `launcher/update-policy.json`:
GitHub's raw content host. GitHub receives ordinary connection metadata (such as
IP address and user-agent). No Discord credentials or game state are attached.
The desktop launcher also checks the pinned `launcher_updates.FEED` raw URL.
Verified newer launchers download from this repository's GitHub release assets;
HTTPS redirects are restricted to GitHub's allowlisted asset hosts. There is no
analytics service or account system operated by this project.

The user still has Discord's normal network connections; those are not controlled
by this project. Maintainer publishing scripts use GitHub credentials through Git,
but are not packaged into the application.

## Update trust

The bundled Ed25519 public key verifies the exact signed bytes before executable
payload content is parsed/applied. HTTPS, size limits, file-name allowlists and
digests are checked. Payload redirects, invalid signatures and older/equal release counters
are refused. Updates are not applied to a running Discord installation.

The trusted files are `main.cjs`, `activity.js` and `wardrobe-live.js`. They are
executable code, not just passive skins. A compromised signing key can authorize
malicious updates. Local state is not tamper-proof against a same-user attacker.
Windows code signing is not implemented. Preview 5 adds a separate signed binary
descriptor and verified cached-launcher handoff; see `launcher_updates.py`. No
unsigned GitHub latest-release response authorizes executable code. The resident
helper is replaced only by explicit Install with Discord fully closed.

The maintainer key is DPAPI encrypted outside the repository. DPAPI is not a
defense against malware already running as that Windows user. The private key
must never be uploaded, included in releases or added to CI secrets without a
separately reviewed custody design. No private key is needed to build or test.

## Removal and conflicts

Uninstall disables maintenance first, stops its helper through an owned event,
removes owned startup registration, and restores tracked bridges. Later user/mod
edits are retained as conflicts, not overwritten. Opt-out/recovery records can
remain; optional activity localStorage preferences are not erased automatically.
Portable launchers and inactive cached launcher copies also remain. They have no
autostart registration and can be deleted manually after closing them.

## Reporting

Use GitHub's private vulnerability reporting feature if available. Otherwise
contact the repository owner privately before posting exploit details. Do not
attach Discord archives, profiles, authentication data or signing material.
