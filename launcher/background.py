"""Per-user maintenance runtime. No elevated rights, process kills or debug port."""
from __future__ import annotations
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import time
import winreg
from channel_manager import ChannelManager, plain
from install_core import atomic, digest, operation_lock, write_json
from signed_updates import fetch

RUN_KEY=r'Software\Microsoft\Windows\CurrentVersion\Run'
RUN_NAME='BobbleWardrobe'
HELPER='BobbleWardrobe-maintenance.exe'

class RunStore:
    def __init__(self,key=RUN_KEY,name=RUN_NAME):self.key=key;self.name=name
    def get(self):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,self.key) as key:
                value,kind=winreg.QueryValueEx(key,self.name)
            if kind!=winreg.REG_SZ:raise RuntimeError('Existing startup entry has an unsupported type')
            return value
        except FileNotFoundError:return None
    def set(self,value):
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER,self.key,0,winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key,self.name,0,winreg.REG_SZ,value)
    def delete(self):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,self.key,0,winreg.KEY_SET_VALUE) as key:winreg.DeleteValue(key,self.name)
        except FileNotFoundError:pass

class StopEvent:
    def __init__(self,home,reset=False):
        self.kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        self.kernel.CreateEventW.argtypes=[ctypes.c_void_p,wintypes.BOOL,wintypes.BOOL,wintypes.LPCWSTR]
        self.kernel.CreateEventW.restype=wintypes.HANDLE
        self.kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD]
        self.kernel.WaitForSingleObject.restype=wintypes.DWORD
        for name in ('SetEvent','ResetEvent','CloseHandle'):
            getattr(self.kernel,name).argtypes=[wintypes.HANDLE]
            getattr(self.kernel,name).restype=wintypes.BOOL
        self.handle=self.kernel.CreateEventW(None,True,False,'Local\\BobbleWardrobe-stop-'+digest(str(home).casefold().encode()))
        if not self.handle:raise ctypes.WinError(ctypes.get_last_error())
        if reset:self.kernel.ResetEvent(self.handle)
    def set(self):
        if not self.kernel.SetEvent(self.handle):raise ctypes.WinError(ctypes.get_last_error())
    def wait(self,seconds):
        result=self.kernel.WaitForSingleObject(self.handle,max(0,int(seconds*1000)))
        if result not in (0,258):raise RuntimeError('Maintenance stop event failed')
        return result==0
    def close(self):
        if self.handle:self.kernel.CloseHandle(self.handle);self.handle=None

def stop_helper(home: Path,timeout=25):
    stop=StopEvent(home)
    try:
        stop.set();deadline=time.monotonic()+timeout
        while True:
            try:
                with operation_lock(home/'resident-instance'):return
            except RuntimeError:
                if time.monotonic()>=deadline:raise RuntimeError('Maintenance is still stopping; retry shortly. No process was killed.')
                time.sleep(.1)
    finally:stop.close()

class BackgroundInstall:
    def __init__(self,home: Path,store=None):
        self.home=home.absolute();self.store=store if store is not None else RunStore()
        self.helper=self.home/HELPER;self.record=self.home/'background.json'
        self.command=subprocess.list2cmdline([str(self.helper),'--maintain'])
    def preflight(self):
        plain(self.home);plain(self.helper);plain(self.record)
        current=self.store.get()
        if current not in (None,self.command):raise RuntimeError('An unrelated BobbleWardrobe startup entry exists; it was not changed')
        if self.helper.exists() and not self.record.exists():raise RuntimeError('Untracked maintenance executable retained')
        if self.record.exists():
            state=json.loads(self.record.read_text('utf-8'))
            if state.get('command')!=self.command or state.get('file')!=HELPER:raise RuntimeError('Invalid background ownership record')
            if self.helper.exists() and digest(self.helper.read_bytes())!=state.get('sha256'):raise RuntimeError('Maintenance executable was modified; retained')
    def install(self,executable: Path):
        with operation_lock(self.home):
            self.preflight();data=executable.read_bytes()
            if not data:raise RuntimeError('Empty helper executable')
            self.home.mkdir(parents=True,exist_ok=True)
            if self.helper.exists() and self.helper.read_bytes()!=data:
                raise RuntimeError('Installed helper differs; remove its verified old copy before upgrading')
            write_json(self.record,{'file':HELPER,'sha256':digest(data),'command':self.command})
            if not self.helper.exists():atomic(self.helper,data)
            self.store.set(self.command)
    def unregister(self):
        with operation_lock(self.home):
            plain(self.record)
            if not self.record.exists():return
            state=json.loads(self.record.read_text('utf-8'))
            if state.get('command')!=self.command or state.get('file')!=HELPER:raise RuntimeError('Invalid background ownership record')
            # An entry changed by another program/user is never deleted.
            if self.store.get()==self.command:self.store.delete()
    def remove_files(self):
        with operation_lock(self.home):
            plain(self.helper);plain(self.record)
            if not self.record.exists():return
            state=json.loads(self.record.read_text('utf-8'))
            if state.get('file')!=HELPER or state.get('command')!=self.command:raise RuntimeError('Invalid background ownership record')
            if self.helper.exists():
                if digest(self.helper.read_bytes())!=state['sha256']:raise RuntimeError('Changed maintenance executable retained')
                # A one-file packager's parent may still be releasing the EXE
                # briefly after its Python worker released the runtime mutex.
                deadline=time.monotonic()+5
                while True:
                    try:self.helper.unlink();break
                    except PermissionError:
                        if time.monotonic()>=deadline:raise RuntimeError('Helper is still exiting; retry Uninstall. No process was killed.')
                        time.sleep(.1)
                        plain(self.helper)
                        if digest(self.helper.read_bytes())!=state['sha256']:raise RuntimeError('Changed maintenance executable retained')
            self.record.unlink()
    def launch(self):
        self.preflight()
        return subprocess.Popen([str(self.helper),'--maintain'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=0x08000000)

def periodic(manager,policy,stop,interval=15,update_interval=3600,clock=time.monotonic):
    next_update=0
    def report(phase,error=''):
        plain(manager.home/'maintenance-status.json')
        write_json(manager.home/'maintenance-status.json',{'phase':phase,'time':datetime.now(timezone.utc).isoformat(),'error':error[:300]})
    while not stop.wait(0):
        try:
            state=manager.load()
            if not state['enabled']:return
            phase=manager.tick()
            if policy.get('feed') and policy.get('publicKey') and clock()>=next_update:
                next_update=clock()+update_interval
                release=fetch(policy,manager.load()['current'])
                if release is not None and not stop.wait(0):phase=manager.accept_release(release)
            report(phase)
        except Exception as exc:
            try:report('needs-attention',str(exc))
            except Exception:pass
        if stop.wait(interval):return

def run_background(manager,policy):
    with operation_lock(manager.home/'resident-instance'):
        if not manager.load()['enabled']:return
        stop=StopEvent(manager.home,reset=True)
        try:periodic(manager,policy,stop)
        finally:stop.close()

def default_home():return Path(os.environ['LOCALAPPDATA'])/'BobbleWardrobe'/'maintenance'

def install_persistent(manager,executable: Path,registration=None,start=True,resources=None):
    registration=registration if registration is not None else BackgroundInstall(manager.home)
    with operation_lock(manager.home/'lifecycle'):
        registration.preflight()
        if manager.is_running():raise RuntimeError('Fully quit Discord before installing Wardrobe')
        manager.disable();registration.unregister();stop_helper(manager.home)
        registration.remove_files()
        try:
            registration.install(executable)
            state=manager.enable(resources if resources is not None else discover_selected(manager))
            if start:registration.launch()
            return state
        except Exception:
            manager.disable();registration.unregister()
            raise

def discover_selected(manager):
    from channel_manager import discover
    versions=discover(manager.discord)
    if not versions:raise RuntimeError('Discord Stable was not found')
    return versions[0]

def uninstall_persistent(manager,registration=None):
    registration=registration if registration is not None else BackgroundInstall(manager.home)
    with operation_lock(manager.home/'lifecycle'):
        manager.recover_pending_for_removal()
        manager.disable();registration.unregister();stop_helper(manager.home)
        result=manager.uninstall()
        manager.clear_cache();registration.remove_files()
        return result
