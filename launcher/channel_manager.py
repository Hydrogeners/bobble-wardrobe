"""Persistent ownership and safe, deferred repair of Discord Stable versions."""
from __future__ import annotations
import json
from pathlib import Path
import re
import stat
import os
import uuid
from install_core import Installer, FILES, digest, atomic, write_json, operation_lock

VERSION = re.compile(r'app-(\d+(?:\.\d+){2,3})\Z')

def plain(path: Path):
    for candidate in (path, *path.parents):
        try: attributes = candidate.lstat().st_file_attributes
        except FileNotFoundError: continue
        if attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise RuntimeError(f'Redirected maintenance path refused: {candidate}')

def discover(root: Path):
    plain(root)
    found=[]
    if not root.is_dir(): return found
    for app in root.glob('app-*'):
        match=VERSION.fullmatch(app.name)
        if not match: continue
        plain(app)
        resources=app/'resources'
        if (app/'Discord.exe').is_file() and resources.is_dir() and (resources/'app.asar').exists():
            plain(resources)
            found.append(resources)
    return sorted(found,key=lambda p:tuple(map(int,VERSION.fullmatch(p.parent.name)[1].split('.'))),reverse=True)

class ChannelManager:
    def __init__(self, home: Path, discord: Path, bundle: Path, is_running):
        self.home=Path(home).absolute()
        self.discord=Path(discord).absolute()
        self.bundle=Path(bundle).absolute()
        self.is_running=is_running
        self.config=self.home/'channel.json'
        self.opt_out=self.home/'removal.guard'

    def load(self,_allow_pending=False):
        plain(self.home);plain(self.config);plain(self.discord);plain(self.opt_out)
        if not _allow_pending and self.config.with_name(self.config.name+'.wardrobe-tmp').exists():
            raise RuntimeError('An unfinished ownership write was retained; maintenance is paused for recovery')
        if not self.config.exists():
            return {'schema':1,'discordRoot':str(self.discord),'enabled':False,'phase':'inactive','managed':[],'snapshots':{},'current':None}
        state=json.loads(self.config.read_text('utf-8'))
        if (state.get('schema')!=1 or state.get('discordRoot')!=str(self.discord)
                or type(state.get('enabled')) is not bool or not isinstance(state.get('managed'),list)
                or not isinstance(state.get('snapshots'),dict)):
            raise RuntimeError('Invalid channel ownership record')
        for resources in state['managed']: self.validate_resources(Path(resources))
        for number, hashes in state['snapshots'].items():
            if not number.isdecimal() or int(number)<1 or set(hashes)!=set(FILES):
                raise RuntimeError('Invalid cached payload ownership')
        plain(self.opt_out)
        if self.opt_out.exists():state['enabled']=False
        return state

    def request_removal(self):
        # A zero-byte, fsynced tombstone can be checked without parsing a
        # potentially interrupted JSON write. Only explicit Install clears it.
        with operation_lock(self.home):
            plain(self.home);plain(self.opt_out);self.home.mkdir(parents=True,exist_ok=True)
            if not self.opt_out.exists():
                with self.opt_out.open('xb') as file:os.fsync(file.fileno())

    def recover_pending_for_removal(self):
        with operation_lock(self.home):
            self.request_removal()
            pending=self.config.with_name(self.config.name+'.wardrobe-tmp');plain(pending)
            if pending.exists():
                if not pending.is_file():raise RuntimeError('Unexpected pending-write directory retained')
                state=self.load(_allow_pending=True)
                # Preserve every byte, including unfamiliar/partial content.
                recovery=self.home/('channel-recovery-'+uuid.uuid4().hex+'.bin')
                pending.rename(recovery)
                state['enabled']=False;self.save(state)

    def validate_resources(self, resources):
        if resources.parent.parent!=self.discord or resources.name!='resources' or not VERSION.fullmatch(resources.parent.name):
            raise RuntimeError('Discord version is outside the selected channel')
        plain(resources)

    def save(self,state):
        plain(self.home);plain(self.config)
        self.home.mkdir(parents=True,exist_ok=True)
        write_json(self.config,state)

    def snapshot(self,state,source: Path,release: int):
        if type(release) is not int or release<1:raise RuntimeError('Invalid release counter')
        content={name:(source/name).read_bytes() for name in FILES}
        hashes={name:digest(data) for name,data in content.items()}
        if any(not data or len(data)>6*1024*1024 for data in content.values()):raise RuntimeError('Invalid payload size')
        key=str(release)
        previous=state['snapshots'].get(key)
        if previous and previous!=hashes:raise RuntimeError('Release counter reused for different payloads')
        if state['current'] is not None and release<state['current']:raise RuntimeError('Refusing cached payload downgrade')
        state['snapshots'][key]=hashes
        self.save(state) # Declare exact file ownership before creating the snapshot.
        target=self.home/('payload-'+key);plain(target);target.mkdir(exist_ok=True)
        if set(p.name for p in target.iterdir())-set(FILES):raise RuntimeError('Unexpected cached payload files retained')
        for name,data in content.items():
            path=target/name;plain(path)
            if path.exists():
                if digest(path.read_bytes())!=hashes[name]:raise RuntimeError('Cached payload was changed')
            else:atomic(path,data)
        state['current']=release;self.save(state)
        return target

    def cached(self,state):
        release=state['current']
        if type(release) is not int or str(release) not in state['snapshots']:raise RuntimeError('No approved cached payload')
        target=self.home/('payload-'+str(release));plain(target)
        for name,expected in state['snapshots'][str(release)].items():
            path=target/name;plain(path)
            if not path.is_file() or digest(path.read_bytes())!=expected:raise RuntimeError('Cached payload failed integrity check')
        return target

    def enable(self, resources: Path):
        with operation_lock(self.home):
            resources=Path(resources).absolute();self.validate_resources(resources)
            if self.is_running():raise RuntimeError('Fully quit Discord before installing maintenance')
            state=self.load();state['enabled']=False;state['phase']='installing';self.save(state)
            installer=Installer(resources,self.bundle)
            installed=installer.status()
            metadata=self.bundle/'release.json'
            bundled=json.loads(metadata.read_text('utf-8'))['release'] if metadata.exists() else 1
            if type(bundled) is not int or bundled<1:raise RuntimeError('Invalid bundled release counter')
            if installed['installed']:
                installer._assert_bootstrap(installed)
                if installed.get('release',1)>=(state['current'] or 0):
                    self.snapshot(state,installer.owned,installed.get('release',1))
                if bundled>(state['current'] or 0):self.snapshot(state,self.bundle,bundled)
                if installed.get('release',1)<state['current']:
                    if self.is_running():raise RuntimeError('Discord started during installation; maintenance remains disabled')
                    installer.update(self.cached(state),state['current'])
            elif installer.manifest.exists():
                raise RuntimeError('Recover the interrupted Wardrobe installation first')
            else:
                if state['current'] is None:
                    self.snapshot(state,self.bundle,bundled)
                elif bundled>state['current']:self.snapshot(state,self.bundle,bundled)
                installer.bundle=self.cached(state)
                if str(resources) not in state['managed']:
                    state['managed'].append(str(resources));self.save(state)
                if self.is_running():raise RuntimeError('Discord started during installation; maintenance remains disabled')
                installer.install(release=state['current'])
            if str(resources) not in state['managed']:state['managed'].append(str(resources))
            state['enabled']=True;state['phase']='active';self.save(state)
            if self.opt_out.exists():
                if not self.opt_out.is_file() or self.opt_out.stat().st_size!=0:raise RuntimeError('Unfamiliar opt-out marker retained; maintenance stays disabled')
                self.opt_out.unlink()
            return state

    def tick(self):
        with operation_lock(self.home):
            state=self.load()
            if not state['enabled']:return 'disabled'
            if state['phase']!='active':raise RuntimeError('Maintenance recovery is required')
            if self.is_running():return 'waiting-for-discord-exit'
            source=self.cached(state)
            # A legacy/manual launcher may have updated a tracked older host.
            # Retain the highest verified installed payload before migrating.
            for tracked in state['managed']:
                previous=Installer(Path(tracked),source)
                older=previous.status()
                if older['installed'] and older.get('release',1)>state['current']:
                    previous._assert_bootstrap(older)
                    source=self.snapshot(state,previous.owned,older['release'])
            versions=discover(self.discord)
            if not versions:return 'discord-not-found'
            resources=versions[0]
            installer=Installer(resources,source)
            current=installer.status()
            if current.get('phase') in ('prepared','restored'):raise RuntimeError('Interrupted bootstrap needs recovery')
            if not current['installed']:
                if str(resources) not in state['managed']:
                    state['managed'].append(str(resources));self.save(state)
                if self.is_running():return 'waiting-for-discord-exit'
                installer.install(release=state['current'])
                return 'repaired-new-discord-version'
            installer._assert_bootstrap(current)
            if current.get('release',1)>state['current']:
                self.snapshot(state,installer.owned,current['release'])
            elif current.get('release',1)<state['current']:
                if self.is_running():return 'waiting-for-discord-exit'
                installer.update(source,state['current'])
            if str(resources) not in state['managed']:
                state['managed'].append(str(resources));self.save(state)
            return 'ready'

    def disable(self):
        with operation_lock(self.home):
            state=self.load();state['enabled']=False;state['phase']='disabled';self.save(state)

    def accept_release(self,release):
        with operation_lock(self.home):
            state=self.load()
            if not state['enabled']:return 'disabled'
            if release.number<=state['current']:return 'up-to-date'
            # Signature verification happens before this boundary. A unique
            # temporary directory is used only to pass the verified bytes on.
            import tempfile
            with tempfile.TemporaryDirectory(prefix='verified-',dir=self.home) as temporary:
                source=Path(temporary)
                for name in FILES:atomic(source/name,release.files[name])
                self.snapshot(state,source,release.number)
            if self.is_running():return 'update-cached-until-discord-exits'
            for resources in state['managed']:
                installer=Installer(Path(resources),self.bundle)
                current=installer.status()
                if not current['installed']:continue
                if current.get('release',1)>=release.number:continue
                if self.is_running():return 'update-cached-until-discord-exits'
                installer.update(self.cached(state),release.number)
            return 'updated'

    def uninstall(self):
        with operation_lock(self.home):
            self.recover_pending_for_removal()
            # Persist opt-out before touching any bridge. A failed removal can
            # never cause the helper to reinstall it behind the user's back.
            state=self.load();state['enabled']=False;state['phase']='removing';self.save(state)
            if self.is_running():raise RuntimeError('Maintenance disabled. Fully quit Discord, then retry Uninstall.')
            paths={Path(p) for p in state['managed']}
            paths.update(p for p in discover(self.discord) if (p/'bobble-wardrobe'/'installation.json').exists())
            failures=[]
            for resources in sorted(paths):
                self.validate_resources(resources)
                installer=Installer(resources,self.bundle)
                if not installer.manifest.exists():
                    if installer.owned.exists():failures.append(f'{resources.parent.name}: untracked Wardrobe folder retained')
                    continue
                try:
                    if self.is_running():raise RuntimeError('Discord started; remaining removals deferred')
                    installer.uninstall()
                except Exception as exc:failures.append(f'{resources.parent.name}: {exc}')
            if failures:raise RuntimeError('Maintenance disabled; some bridges retained: '+'; '.join(failures))
            state['managed']=[];state['phase']='removed';self.save(state)
            return {'installed':False,'message':'Wardrobe removed from all tracked Discord versions. Maintenance is disabled.'}

    def clear_cache(self):
        with operation_lock(self.home):
            state=self.load()
            if state['enabled'] or state['managed']:raise RuntimeError('Uninstall managed bridges before clearing cached payloads')
            # Preflight every file before deleting any cache. No recursive delete.
            known=[]
            for number,hashes in state['snapshots'].items():
                folder=self.home/('payload-'+number);plain(folder)
                if not folder.exists():continue
                if set(p.name for p in folder.iterdir())-set(FILES):raise RuntimeError('Unknown cache files retained')
                for name,expected in hashes.items():
                    file=folder/name;plain(file)
                    if file.exists() and digest(file.read_bytes())!=expected:raise RuntimeError('Modified cache file retained')
                known.append(folder)
            for folder in known:
                for name in FILES:(folder/name).unlink(missing_ok=True)
                folder.rmdir()
            state['snapshots']={};state['current']=None;self.save(state)
