import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
import time
import uuid
import winreg
from unittest.mock import patch
from background import BackgroundInstall, StopEvent, RunStore, install_persistent, uninstall_persistent, periodic
from channel_manager import ChannelManager
from install_core import FILES, Installer
from signed_updates import Release

class MemoryRunStore:
    def __init__(self,value=None):self.value=value
    def get(self):return self.value
    def set(self,value):self.value=value
    def delete(self):self.value=None

class OneCycle:
    def __init__(self):self.completed=False
    def wait(self,seconds):
        if seconds:self.completed=True
        return self.completed

class BackgroundTests(unittest.TestCase):
    def setUp(self):
        from test_support import TEST_TEMP
        self.tmp=tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.root=Path(self.tmp.name);self.home=self.root/'maintenance';self.discord=self.root/'Discord'
        self.resources=self.discord/'app-1.0.1'/'resources';self.resources.mkdir(parents=True)
        (self.resources.parent/'Discord.exe').write_bytes(b'executable fixture');(self.resources/'app.asar').write_bytes(b'stock archive')
        self.bundle=self.root/'bundle';self.bundle.mkdir()
        for name in FILES:(self.bundle/name).write_bytes(b'// original')
        self.running=False
        self.manager=ChannelManager(self.home,self.discord,self.bundle,lambda:self.running)
        self.exe=self.root/'portable.exe';self.exe.write_bytes(b'helper executable fixture')
        self.store=MemoryRunStore();self.registration=BackgroundInstall(self.home,self.store)
    def tearDown(self):self.tmp.cleanup()
    def test_owned_startup_install_remove(self):
        self.registration.install(self.exe);self.assertEqual(self.store.value,self.registration.command)
        self.registration.unregister();self.registration.remove_files();self.assertIsNone(self.store.value)
        self.assertFalse(self.registration.helper.exists())
    def test_existing_foreign_startup_not_overwritten(self):
        self.store.value='user-owned command'
        with self.assertRaises(RuntimeError):self.registration.install(self.exe)
        self.assertEqual(self.store.value,'user-owned command');self.assertFalse(self.home.exists())
    def test_changed_startup_not_deleted(self):
        self.registration.install(self.exe);self.store.value='later user change'
        self.registration.unregister();self.assertEqual(self.store.value,'later user change')
    def test_changed_executable_not_deleted(self):
        self.registration.install(self.exe);self.registration.helper.write_bytes(b'user change')
        with self.assertRaises(RuntimeError):self.registration.remove_files()
        self.assertEqual(self.registration.helper.read_bytes(),b'user change')
    def test_persistent_lifecycle_fixture(self):
        install_persistent(self.manager,self.exe,self.registration,start=False)
        self.assertTrue(self.manager.load()['enabled']);self.assertEqual(self.store.value,self.registration.command)
        uninstall_persistent(self.manager,self.registration)
        self.assertFalse(self.manager.load()['enabled']);self.assertIsNone(self.store.value)
        self.assertTrue((self.resources/'app.asar').is_file());self.assertFalse(self.registration.helper.exists())
    def test_install_failure_unregisters_and_stays_disabled(self):
        with patch.object(self.manager,'enable',side_effect=OSError('fixture failure')):
            with self.assertRaises(OSError):install_persistent(self.manager,self.exe,self.registration,start=False)
        self.assertFalse(self.manager.load()['enabled']);self.assertIsNone(self.store.value)
    def test_uninstall_running_stops_maintenance_and_startup_first(self):
        install_persistent(self.manager,self.exe,self.registration,start=False);self.running=True
        with self.assertRaises(RuntimeError):uninstall_persistent(self.manager,self.registration)
        self.assertIsNone(self.store.value);self.assertFalse(self.manager.load()['enabled'])
        self.assertTrue((self.resources/'app.asar').is_dir())
    def test_unconfigured_service_never_fetches(self):
        self.manager.enable(self.resources)
        with patch('background.fetch') as fetch:
            periodic(self.manager,{'feed':None,'publicKey':None},OneCycle());fetch.assert_not_called()
        status=json.loads((self.home/'maintenance-status.json').read_text());self.assertEqual(status['phase'],'ready')
    def test_signed_result_is_cached_while_running_then_applied(self):
        self.manager.enable(self.resources);self.running=True
        release=Release(2,{name:b'// verified new' for name in FILES})
        with patch('background.fetch',return_value=release):periodic(self.manager,{'feed':'configured','publicKey':'configured'},OneCycle())
        self.assertEqual(self.manager.load()['current'],2)
        self.assertEqual(Installer(self.resources,self.bundle).status()['release'],1)
        self.running=False;self.manager.tick()
        self.assertEqual(Installer(self.resources,self.bundle).status()['release'],2)
    def test_disable_during_download_prevents_update(self):
        self.manager.enable(self.resources)
        def fetched(*args):
            self.manager.disable();return Release(2,{name:b'// new' for name in FILES})
        with patch('background.fetch',side_effect=fetched):periodic(self.manager,{'feed':'configured','publicKey':'configured'},OneCycle())
        self.assertEqual(self.manager.load()['current'],1);self.assertFalse(self.manager.load()['enabled'])
    def test_windows_stop_event_roundtrip(self):
        stop=StopEvent(self.home,reset=True)
        try:self.assertFalse(stop.wait(0));stop.set();self.assertTrue(stop.wait(0))
        finally:stop.close()
    def test_real_registry_in_non_autorun_sandbox_only(self):
        key=r'Software\BobbleWardrobe-Test-'+uuid.uuid4().hex
        store=RunStore(key)
        try:
            self.assertIsNone(store.get());store.set('fixture command');self.assertEqual(store.get(),'fixture command')
            store.delete();self.assertIsNone(store.get())
        finally:
            store.delete()
            try:winreg.DeleteKey(winreg.HKEY_CURRENT_USER,key)
            except FileNotFoundError:pass
    def test_real_worker_repairs_version_and_exits_on_named_event(self):
        self.manager.enable(self.resources)
        code=('import sys;from pathlib import Path;from background import run_background;'
              'from channel_manager import ChannelManager;'
              'm=ChannelManager(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]),lambda:False);'
              'run_background(m,{"feed":None,"publicKey":None})')
        process=subprocess.Popen([sys.executable,'-c',code,str(self.home),str(self.discord),str(self.bundle)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            deadline=time.monotonic()+12
            while not (self.home/'maintenance-status.json').exists():
                if process.poll() is not None:raise AssertionError(process.communicate())
                if time.monotonic()>deadline:raise AssertionError('Worker did not start')
                time.sleep(.05)
            second=self.discord/'app-1.0.2'/'resources';second.mkdir(parents=True)
            (second.parent/'Discord.exe').write_bytes(b'executable fixture');(second/'app.asar').write_bytes(b'new stock archive')
            deadline=time.monotonic()+22
            while not Installer(second,self.bundle).status()['installed']:
                if time.monotonic()>deadline:raise AssertionError('Worker did not repair new version')
                time.sleep(.1)
            self.assertTrue(Installer(second,self.bundle).status()['installed'])
        finally:
            self.manager.disable();stop=StopEvent(self.home)
            try:stop.set();output=process.communicate(timeout=10)
            finally:stop.close()
        self.assertEqual(process.returncode,0,output)
        self.manager.uninstall();self.assertTrue((second/'app.asar').is_file())

if __name__=='__main__':unittest.main()
