"""Opt-in test of the frozen executable; uses no real autostart entry/profile."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from background import BackgroundInstall, install_persistent, uninstall_persistent, StopEvent
from channel_manager import ChannelManager
from install_core import Installer
from windows_processes import discord_running

class SandboxRunStore:
    value=None
    def get(self):return self.value
    def set(self,value):self.value=value
    def delete(self):self.value=None

@unittest.skipUnless(os.environ.get('WARDROBE_PACKAGED_TEST')=='1','Build the executable first, then opt into the packaged test')
class PackagedBackgroundTests(unittest.TestCase):
    def test_frozen_repair_single_instance_and_full_uninstall(self):
        executable=Path(os.environ['WARDROBE_PACKAGED_EXE']) if os.environ.get('WARDROBE_PACKAGED_EXE') else Path(__file__).parent/'release-preview'/'BobbleWardrobe-Preview.exe'
        self.assertTrue(executable.is_file())
        from test_support import TEST_TEMP
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temporary:
            root=Path(temporary);discord=root/'Discord';home=root/'BobbleWardrobe'/'maintenance'
            def version(number):
                resources=discord/('app-'+number)/'resources';resources.mkdir(parents=True)
                (resources.parent/'Discord.exe').write_bytes(b'non-running process-image fixture')
                (resources/'app.asar').write_bytes(('stock fixture '+number).encode())
                return resources
            first=version('1.0.1');bundle=Path(__file__).parent/'bundle'
            manager=ChannelManager(home,discord,bundle,lambda:discord_running(discord))
            store=SandboxRunStore();registration=BackgroundInstall(home,store)
            install_persistent(manager,executable,registration,start=False)
            env=os.environ.copy();env['LOCALAPPDATA']=str(root)
            process=subprocess.Popen([str(registration.helper),'--maintain'],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                deadline=time.monotonic()+20
                while not (home/'maintenance-status.json').exists():
                    self.assertIsNone(process.poll(),'Packaged worker exited before reporting status')
                    if time.monotonic()>deadline:raise AssertionError('Packaged worker did not start')
                    time.sleep(.1)
                duplicate=subprocess.Popen([str(registration.helper),'--maintain'],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                self.assertEqual(duplicate.wait(timeout=15),0,'Second helper should exit without taking ownership')
                self.assertIsNone(process.poll())
                second=version('1.0.2');deadline=time.monotonic()+23
                while not Installer(second,bundle).status()['installed']:
                    if time.monotonic()>deadline:raise AssertionError('Frozen helper did not repair new Discord version')
                    time.sleep(.1)
                expected_release=json.loads((bundle/'release.json').read_text())['release']
                self.assertEqual(Installer(second,bundle).status()['release'],expected_release)
                uninstall_persistent(manager,registration)
                self.assertEqual(process.wait(timeout=10),0)
                self.assertIsNone(store.value);self.assertFalse(registration.helper.exists())
                self.assertEqual((first/'app.asar').read_bytes(),b'stock fixture 1.0.1')
                self.assertEqual((second/'app.asar').read_bytes(),b'stock fixture 1.0.2')
                third=version('1.0.3');self.assertEqual(manager.tick(),'disabled')
                self.assertTrue((third/'app.asar').is_file())
            finally:
                if process.poll() is None:
                    manager.disable();stop=StopEvent(home)
                    try:stop.set();process.wait(timeout=20)
                    finally:stop.close()

if __name__=='__main__':unittest.main()
