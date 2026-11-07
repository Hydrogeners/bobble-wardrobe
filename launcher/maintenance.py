"""Launcher-open maintenance. Never modifies Discord while it is running."""
from pathlib import Path
import tempfile
from install_core import Installer
from signed_updates import fetch, stage

def check_updates(resources, bundle: Path, policy: dict, is_running, cache: Path):
    installed = []
    for path in resources:
        installer = Installer(path, bundle)
        state = installer.status()
        if state.get('phase') in ('prepared', 'restored'):
            raise RuntimeError('An interrupted installation needs recovery before updates')
        if state['installed']: installed.append((installer, state))
    if not policy.get('feed') or not policy.get('publicKey'):
        return 'Signed update service is not configured.'
    if not installed: return 'Install Wardrobe before checking for updates.'
    release = fetch(policy, min(state.get('release', 1) for _, state in installed))
    if release is None: return 'Installed Wardrobe is up to date.'
    if is_running(): return f'Release {release.number} is available. Fully quit Discord, then reopen this launcher to apply it.'
    cache.mkdir(parents=True, exist_ok=True)
    # Use only freshly signature-verified content; never trust a cached manifest.
    with tempfile.TemporaryDirectory(prefix='verified-', dir=cache) as temporary:
        staged = stage(release, Path(temporary))
        for installer, state in installed:
            if state.get('release', 1) >= release.number: continue
            if is_running(): raise RuntimeError('Discord started during maintenance; remaining updates deferred')
            installer.update(staged, release.number)
    return f'Updated installed Wardrobe payloads to release {release.number}.'
