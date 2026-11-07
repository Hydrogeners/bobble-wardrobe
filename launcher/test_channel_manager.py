import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from channel_manager import ChannelManager
from install_core import FILES, Installer

class ChannelTests(unittest.TestCase):
    def setUp(self):
        from test_support import TEST_TEMP
        self.tmp=tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.root=Path(self.tmp.name);self.discord=self.root/'Discord';self.discord.mkdir()
        self.bundle=self.root/'bundle';self.bundle.mkdir()
        for name in FILES:(self.bundle/name).write_bytes(b'// original payload')
        self.running=False
        self.manager=ChannelManager(self.root/'maintenance',self.discord,self.bundle,lambda:self.running)
        self.first=self.version('1.0.1')
    def tearDown(self):self.tmp.cleanup()
    def version(self,number):
        app=self.discord/('app-'+number);app.mkdir();(app/'Discord.exe').write_bytes(b'executable fixture')
        resources=app/'resources';resources.mkdir();(resources/'app.asar').write_bytes(('stock '+number).encode())
        return resources
    def test_opt_in_and_deferred_version_repair(self):
        self.manager.enable(self.first);second=self.version('1.0.2');self.running=True
        self.assertEqual(self.manager.tick(),'waiting-for-discord-exit');self.assertTrue((second/'app.asar').is_file())
        self.running=False;self.assertEqual(self.manager.tick(),'repaired-new-discord-version')
        self.assertTrue(Installer(second,self.bundle).status()['installed'])
    def test_no_opt_in_never_installs(self):
        self.assertEqual(self.manager.tick(),'disabled');self.assertTrue((self.first/'app.asar').is_file())
    def test_install_while_running_refused(self):
        self.running=True
        with self.assertRaises(RuntimeError):self.manager.enable(self.first)
        self.assertFalse(self.manager.config.exists())
    def test_uninstall_all_versions_and_never_reinstall(self):
        self.manager.enable(self.first);second=self.version('1.0.2');self.manager.tick()
        self.manager.uninstall();self.assertTrue((self.first/'app.asar').is_file());self.assertTrue((second/'app.asar').is_file())
        third=self.version('1.0.3');self.assertEqual(self.manager.tick(),'disabled');self.assertTrue((third/'app.asar').is_file())
    def test_failed_uninstall_still_disables_maintenance(self):
        self.manager.enable(self.first);bootstrap=self.first/'app.asar'/'index.js';bootstrap.write_bytes(b'user edit')
        with self.assertRaises(RuntimeError):self.manager.uninstall()
        self.assertFalse(self.manager.load()['enabled']);self.assertEqual(bootstrap.read_bytes(),b'user edit')
        self.assertEqual(self.manager.tick(),'disabled')
    def test_running_uninstall_disables_without_touching_bridge(self):
        self.manager.enable(self.first);self.running=True
        with self.assertRaises(RuntimeError):self.manager.uninstall()
        self.assertFalse(self.manager.load()['enabled']);self.assertTrue((self.first/'app.asar').is_dir())
    def test_missing_original_version_keeps_approved_snapshot(self):
        self.manager.enable(self.first)
        # Simulate Discord retiring a version; move only this test-owned fixture.
        self.first.parent.rename(self.root/'retired-version')
        second=self.version('1.0.2');self.assertEqual(self.manager.tick(),'repaired-new-discord-version')
        self.assertTrue(Installer(second,self.bundle).status()['installed'])
    def test_modified_cache_never_installed(self):
        self.manager.enable(self.first);state=self.manager.load()
        (self.manager.home/'payload-1'/FILES[0]).write_bytes(b'user edit')
        second=self.version('1.0.2')
        with self.assertRaises(RuntimeError):self.manager.tick()
        self.assertTrue((second/'app.asar').is_file())
    def test_failed_migration_remains_tracked_for_uninstall(self):
        self.manager.enable(self.first);second=self.version('1.0.2')
        with patch('channel_manager.Installer.install',side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):self.manager.tick()
        self.assertIn(str(second),self.manager.load()['managed']);self.manager.uninstall()
        self.assertTrue((second/'app.asar').is_file())
    def test_outside_version_refused(self):
        other=self.root/'Other'/'app-1.0.2'/'resources';other.mkdir(parents=True)
        with self.assertRaises(RuntimeError):self.manager.enable(other)
        self.assertFalse(self.manager.config.exists())
    def test_uninstall_and_named_cache_cleanup(self):
        self.manager.enable(self.first);unrelated=self.manager.home/'user.txt';unrelated.write_text('keep')
        self.manager.uninstall();self.manager.clear_cache()
        self.assertFalse((self.manager.home/'payload-1').exists());self.assertEqual(unrelated.read_text(),'keep')
    def test_unknown_cached_file_preserved(self):
        self.manager.enable(self.first);self.manager.uninstall()
        extra=self.manager.home/'payload-1'/'user.txt';extra.write_text('keep')
        with self.assertRaises(RuntimeError):self.manager.clear_cache()
        self.assertTrue(extra.exists())
    def test_pending_config_write_blocks_automatic_repair(self):
        self.manager.enable(self.first);second=self.version('1.0.2')
        self.manager.config.with_name('channel.json.wardrobe-tmp').write_bytes(b'partial opt-out write')
        with self.assertRaises(RuntimeError):self.manager.tick()
        self.assertTrue((second/'app.asar').is_file())
    def test_newer_embedded_release_upgrades_adopted_install(self):
        Installer(self.first,self.bundle).install()
        (self.bundle/'release.json').write_text(json.dumps({'release':2}))
        for name in FILES:(self.bundle/name).write_bytes(b'// newer embedded release')
        self.manager.enable(self.first)
        self.assertEqual(Installer(self.first,self.bundle).status()['release'],2)
        self.assertEqual(self.manager.load()['current'],2)
    def test_accepted_release_migrates_when_old_discord_version_is_retired(self):
        from signed_updates import Release
        self.manager.enable(self.first);self.running=True
        self.assertEqual(self.manager.accept_release(Release(2,{name:b'// verified release' for name in FILES})),'update-cached-until-discord-exits')
        self.first.parent.rename(self.root/'retired-version');second=self.version('1.0.2');self.running=False
        self.manager.tick();self.assertEqual(Installer(second,self.bundle).status()['release'],2)
    def test_uninstall_recovers_pending_config_without_discarding_it(self):
        self.manager.enable(self.first)
        pending=self.manager.config.with_name('channel.json.wardrobe-tmp');pending.write_bytes(b'partial opt-out or user work')
        self.manager.uninstall()
        recovery=list(self.manager.home.glob('channel-recovery-*.bin'))
        self.assertEqual(len(recovery),1);self.assertEqual(recovery[0].read_bytes(),b'partial opt-out or user work')
        self.assertFalse(self.manager.load()['enabled']);self.assertTrue((self.first/'app.asar').is_file())
    def test_opt_out_tombstone_overrides_old_enabled_json(self):
        self.manager.enable(self.first);self.manager.request_removal();second=self.version('1.0.2')
        self.assertFalse(self.manager.load()['enabled']);self.assertEqual(self.manager.tick(),'disabled')
        self.assertTrue((second/'app.asar').is_file())
    def test_explicit_reinstall_can_clear_own_opt_out_tombstone(self):
        self.manager.enable(self.first);self.manager.uninstall();self.manager.clear_cache()
        self.manager.enable(self.first)
        self.assertTrue(self.manager.load()['enabled']);self.assertFalse(self.manager.opt_out.exists())
    def test_migration_preserves_higher_manually_updated_release(self):
        self.manager.enable(self.first)
        upgraded=self.root/'upgraded';upgraded.mkdir()
        for name in FILES:(upgraded/name).write_bytes(b'// newer verified installation')
        Installer(self.first,self.bundle).update(upgraded,3)
        second=self.version('1.0.2');self.manager.tick()
        self.assertEqual(Installer(second,self.bundle).status()['release'],3)
        self.assertEqual(self.manager.load()['current'],3)

if __name__=='__main__':unittest.main()
