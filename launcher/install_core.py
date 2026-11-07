"""Reversible, offline installer foundation. Never launches or terminates Discord."""
from __future__ import annotations
import hashlib
import base64
import ctypes
from contextlib import contextmanager
from functools import wraps
import json
import os
import stat
from pathlib import Path

MARKER = '/* Bobble Wardrobe managed bootstrap v1 */'
FILES = ('main.cjs', 'activity.js', 'wardrobe-live.js')
PACKAGE = b'{"name":"discord","main":"index.js"}'

@contextmanager
def operation_lock(resources):
    if os.name != 'nt':
        raise RuntimeError('The installer supports Windows only')
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p,wintypes.BOOL,wintypes.LPCWSTR]
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE,wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.ReleaseMutex.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    name = 'Local\\BobbleWardrobe-' + digest(str(resources).casefold().encode())
    handle = kernel.CreateMutexW(None, False, name)
    if not handle: raise ctypes.WinError(ctypes.get_last_error())
    acquired = False
    try:
        result = kernel.WaitForSingleObject(handle,0)
        if result not in (0,0x80): raise RuntimeError('Another launcher is changing this installation')
        acquired = True
        yield
    finally:
        if acquired: kernel.ReleaseMutex(handle)
        kernel.CloseHandle(handle)

def serialized(fn):
    @wraps(fn)
    def wrapped(self,*args,**kwargs):
        with operation_lock(self.resources): return fn(self,*args,**kwargs)
    return wrapped

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def atomic(path: Path, data: bytes) -> None:
    temp = path.with_name(path.name + '.wardrobe-tmp')
    if temp.exists():
        raise RuntimeError(f'Unfinished write exists: {temp}')
    created = False
    try:
        with temp.open('xb') as f:
            created = True
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    except BaseException:
        if created: temp.unlink(missing_ok=True)
        raise

def write_json(path: Path, data: dict) -> None:
    atomic(path, json.dumps(data, indent=2).encode('utf-8'))

class Installer:
    def __init__(self, resources: Path, bundle: Path):
        self.resources = Path(os.path.abspath(resources))
        self.bundle = bundle.resolve()
        self.app = self.resources / 'app.asar'
        self.owned = self.resources / 'bobble-wardrobe'
        self.manifest = self.owned / 'installation.json'
        self.original_archive = self.resources / 'wardrobe-original.asar'

    def _safe_paths(self):
        # Refuse redirects before resolving paths or reading ownership records.
        paths = [self.resources, *self.resources.parents, self.app, self.owned, self.original_archive]
        for directory in (self.app, self.owned):
            if directory.is_dir() and not directory.is_symlink() and not directory.is_junction():
                paths.extend(directory.iterdir())
        for path in paths:
            try: attributes = path.lstat().st_file_attributes
            except FileNotFoundError: continue
            if attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise RuntimeError(f'Redirected installation path refused: {path}')

    def status(self) -> dict:
        self._safe_paths()
        if not self.manifest.exists():
            return {'installed': False, 'resources': str(self.resources)}
        state = json.loads(self.manifest.read_text('utf-8'))
        if (state.get('version') != 1 or state.get('mode') not in ('archive', 'directory')
                or state.get('phase') not in ('prepared', 'installed', 'restored')
                or Path(state.get('resources', '')).resolve() != self.resources.resolve()
                or set(state.get('files', {})) != set(FILES)):
            raise RuntimeError('Invalid installation ownership record; no files changed')
        return {**state, 'installed': state.get('phase') == 'installed'}

    @serialized
    def install(self, release: int | None = None) -> dict:
        self._safe_paths()
        if not self.resources.is_dir() or self.resources.is_symlink():
            raise RuntimeError('Select an existing Discord resources directory')
        if self.owned.exists():
            raise RuntimeError('Existing installation or recovery journal found; uninstall/recover first')
        payloads = {name: (self.bundle / name).read_bytes() for name in FILES}
        if any(not data for data in payloads.values()):
            raise RuntimeError('Empty release file')
        # Validate before making any application changes.
        if self.app.is_symlink() or self.original_archive.exists():
            raise RuntimeError('Unexpected existing bootstrap or backup; refusing to overwrite')
        if self.app.is_file():
            mode = 'archive'
            original = self.app.read_bytes()
            index = (MARKER + '\ntry { require("../bobble-wardrobe/main.cjs"); } '
                     'catch (e) { console.error("Wardrobe startup failed", e.message); }\n'
                     'require("electron").app.setAppPath(require("node:path").join(__dirname,"../wardrobe-original.asar"));\n'
                     'require("../wardrobe-original.asar");\n').encode()
        elif self.app.is_dir():
            mode = 'directory'
            entry = self.app / 'index.js'
            package = json.loads((self.app / 'package.json').read_text('utf-8'))
            if package.get('main', 'index.js') != 'index.js' or not entry.is_file() or entry.is_symlink():
                raise RuntimeError('Unsupported existing bootstrap entry; nothing changed')
            original = entry.read_bytes()
            if MARKER.encode() in original:
                raise RuntimeError('Untracked Wardrobe bootstrap; refusing duplicate installation')
            # Preserve the existing mod/bootstrap byte for byte after our guarded import.
            index = (MARKER + '\ntry { require("../bobble-wardrobe/main.cjs"); } '
                     'catch (e) { console.error("Wardrobe startup failed", e.message); }\n').encode() + original
        else:
            raise RuntimeError('Discord app.asar not found')
        metadata=self.bundle/'release.json'
        if release is None:release=json.loads(metadata.read_text('utf-8'))['release'] if metadata.exists() else 1
        if type(release) is not int or release<1: raise RuntimeError('Invalid bundled release counter')
        self.owned.mkdir()
        state = {'version': 1, 'release':release, 'mode': mode, 'phase': 'prepared',
                 'resources': str(self.resources), 'originalHash': digest(original),
                 'bootstrapHash': digest(index), 'files': {k: digest(v) for k, v in payloads.items()}}
        # Journal and backup precede any edit to Discord's startup.
        (self.owned / 'original-bootstrap.bin').write_bytes(original if mode == 'directory' else b'')
        for name, data in payloads.items():
            (self.owned / name).write_bytes(data)
        write_json(self.manifest, state)
        if mode == 'archive':
            self.app.rename(self.original_archive)
            self.app.mkdir()
            (self.app / 'package.json').write_text('{"name":"discord","main":"index.js"}', encoding='utf-8')
            atomic(self.app / 'index.js', index)
        else:
            atomic(self.app / 'index.js', index)
        state['phase'] = 'installed'
        write_json(self.manifest, state)
        return self.status()

    def _assert_bootstrap(self,state):
        index=self.app/'index.js'
        if not index.is_file() or digest(index.read_bytes())!=state['bootstrapHash']:
            raise RuntimeError('Startup bootstrap changed; refusing to update it')
        if state['mode']=='archive' and (self.app/'package.json').read_bytes()!=PACKAGE:
            raise RuntimeError('Managed package.json changed; refusing to overwrite or remove it')
        for name,expected in state['files'].items():
            path=self.owned/name
            if name not in FILES or not path.is_file() or digest(path.read_bytes())!=expected:
                raise RuntimeError('Installed payload changed; refusing to overwrite or remove it')

    @serialized
    def recover_update(self):
        self._safe_paths()
        journal=self.owned/'update.json'
        if not journal.exists(): return
        data=json.loads(journal.read_text('utf-8'))
        old=data['old']
        if set(data['oldFiles'])!=set(FILES) or set(data['newFiles'])!=set(FILES):raise RuntimeError('Invalid update journal')
        originals={name:base64.b64decode(data['oldFiles'][name],validate=True) for name in FILES}
        for name in FILES:
            if digest(originals[name])!=old['files'][name]:raise RuntimeError('Update backup digest failed')
            current=digest((self.owned/name).read_bytes())
            if current not in (old['files'][name],data['newFiles'][name]):raise RuntimeError('Payload changed during update; recovery retained')
        for name,content in originals.items():atomic(self.owned/name,content)
        write_json(self.manifest,old)
        journal.unlink()

    @serialized
    def update(self, bundle: Path, release: int) -> dict:
        self.recover_update()
        state=self.status()
        if not state.get('installed'):raise RuntimeError('Install Wardrobe before updating')
        self._assert_bootstrap(state)
        if type(release) is not int or release<=state.get('release',1):return state
        contents={name:(bundle/name).read_bytes() for name in FILES}
        if any(not content or len(content)>6*1024*1024 for content in contents.values()):raise RuntimeError('Invalid update file size')
        journal={'old':state,'oldFiles':{name:base64.b64encode((self.owned/name).read_bytes()).decode() for name in FILES},'newFiles':{name:digest(value) for name,value in contents.items()}}
        write_json(self.owned/'update.json',journal)
        try:
            for name,content in contents.items():atomic(self.owned/name,content)
            new={**state,'release':release,'files':journal['newFiles']}
            write_json(self.manifest,new)
            (self.owned/'update.json').unlink()
        except Exception:
            self.recover_update()
            raise
        return self.status()

    @serialized
    def uninstall(self) -> dict:
        self.recover_update()
        state = self.status()
        if 'mode' not in state:
            return {'installed': False, 'message': 'Nothing installed'}
        if state.get('phase') not in ('prepared', 'installed', 'restored'):
            raise RuntimeError('Unknown recovery state')
        restored = self.app if state['mode'] == 'archive' else self.app/'index.js'
        # A previous restore may have completed before its final journal write.
        if (restored.is_file() and digest(restored.read_bytes()) == state['originalHash']
                and (state['mode'] != 'archive' or not self.original_archive.exists())):
            state['phase'] = 'restored'
        if state.get('phase')=='installed':self._assert_bootstrap(state)
        if state['phase']=='restored':
            for name, expected in state['files'].items():
                payload=self.owned/name
                if payload.exists() and digest(payload.read_bytes())!=expected:
                    raise RuntimeError('Payload changed after restoration; retained user edits')
        index = self.app / 'index.js'
        if state['phase'] == 'restored':
            restored = self.app if state['mode'] == 'archive' else index
            if not restored.is_file() or digest(restored.read_bytes()) != state['originalHash']:
                raise RuntimeError('Restored startup changed; retained ownership records')
        elif state['mode'] == 'directory':
            backup = (self.owned / 'original-bootstrap.bin').read_bytes()
            if digest(backup) != state['originalHash']:
                raise RuntimeError('Backup changed; refusing restoration')
            current = index.read_bytes()
            if digest(current) not in (state['bootstrapHash'], state['originalHash']):
                raise RuntimeError('Another tool changed the bootstrap; refusing to overwrite it')
            if digest(current) != state['originalHash']:
                atomic(index, backup)
        elif state['mode'] == 'archive':
            if self.original_archive.is_file():
                if digest(self.original_archive.read_bytes()) != state['originalHash']:
                    raise RuntimeError('Original Discord archive changed; refusing restoration')
                if self.app.exists():
                    if not self.app.is_dir() or set(p.name for p in self.app.iterdir()) - {'index.js', 'package.json'}:
                        raise RuntimeError('Unexpected files in managed bootstrap; refusing removal')
                    if index.exists() and digest(index.read_bytes()) != state['bootstrapHash']:
                        raise RuntimeError('Another tool changed managed bootstrap')
                    package=self.app/'package.json'
                    if package.exists() and package.read_bytes()!=PACKAGE:
                        raise RuntimeError('Another tool changed managed package.json')
                    for name in ('index.js', 'package.json'):
                        (self.app / name).unlink(missing_ok=True)
                    self.app.rmdir()
                self.original_archive.rename(self.app)
            elif not self.app.is_file() or digest(self.app.read_bytes()) != state['originalHash']:
                raise RuntimeError('Cannot identify original Discord archive')
        else:
            raise RuntimeError('Unknown install mode')
        state['phase'] = 'restored'
        write_json(self.manifest, state)
        # Remove only named, owned files; never recurse through Discord's directory.
        expected = set(FILES) | {'installation.json', 'original-bootstrap.bin', 'bridge-status.json'}
        if set(p.name for p in self.owned.iterdir()) - expected:
            raise RuntimeError('Bootstrap restored; unexpected files retained in Wardrobe folder')
        # Keep the recovery journal until every other named file was removed.
        for name in (*FILES, 'original-bootstrap.bin', 'bridge-status.json'):
            (self.owned / name).unlink(missing_ok=True)
        self.manifest.unlink()
        self.owned.rmdir()
        return {'installed': False, 'message': 'Bootstrap restored; restart Discord to unload running bridge'}
