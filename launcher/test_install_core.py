import json
import os
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from install_core import Installer, FILES
from test_support import TEST_TEMP

class InstallTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=TEST_TEMP)
        self.root = Path(self.tmp.name)
        self.resources = self.root / 'resources'; self.resources.mkdir()
        self.bundle = self.root / 'bundle'; self.bundle.mkdir()
        for name in FILES: (self.bundle / name).write_text('// fixture '+name)
        self.i = Installer(self.resources, self.bundle)
    def tearDown(self): self.tmp.cleanup()
    def archive(self): (self.resources / 'app.asar').write_bytes(b'original archive fixture')
    def directory(self):
        app = self.resources / 'app.asar'; app.mkdir()
        (app / 'package.json').write_text(json.dumps({'main':'index.js'}))
        (app / 'index.js').write_bytes(b'// existing mod\r\nrequire("other-mod");\r\n')
    def test_stock_roundtrip(self):
        self.archive(); original=self.i.app.read_bytes()
        self.assertTrue(self.i.install()['installed']); self.i.uninstall()
        self.assertEqual(self.i.app.read_bytes(),original); self.assertFalse(self.i.owned.exists())
    def test_existing_mod_roundtrip(self):
        self.directory(); original=(self.i.app/'index.js').read_bytes()
        self.i.install(); self.assertTrue((self.i.app/'index.js').read_bytes().endswith(original))
        self.i.uninstall(); self.assertEqual((self.i.app/'index.js').read_bytes(),original)
    def test_modified_bootstrap_retained(self):
        self.directory(); self.i.install(); (self.i.app/'index.js').write_bytes(b'new user work')
        with self.assertRaises(RuntimeError): self.i.uninstall()
        self.assertEqual((self.i.app/'index.js').read_bytes(),b'new user work')
        self.assertTrue(self.i.manifest.exists())
    def test_duplicate_refused(self):
        self.archive(); self.i.install()
        with self.assertRaises(RuntimeError): self.i.install()
    def test_missing_payload_no_changes(self):
        self.archive(); (self.bundle/FILES[0]).unlink()
        with self.assertRaises(FileNotFoundError): self.i.install()
        self.assertTrue(self.i.app.is_file()); self.assertFalse(self.i.owned.exists())
    def test_partial_archive_recovery(self):
        self.archive(); self.i.install()
        state=json.loads(self.i.manifest.read_text());state['phase']='prepared';self.i.manifest.write_text(json.dumps(state))
        self.i.uninstall();self.assertTrue(self.i.app.is_file())
    def test_unrelated_file_not_removed(self):
        self.archive(); self.i.install(); (self.i.app/'user.txt').write_text('keep')
        with self.assertRaises(RuntimeError): self.i.uninstall()
        self.assertTrue((self.i.app/'user.txt').exists())
    def test_noop_uninstall(self): self.assertFalse(self.i.uninstall()['installed'])
    def updated_bundle(self):
        new=self.root/'new';new.mkdir()
        for name in FILES:(new/name).write_text('// new '+name)
        return new
    def test_update_preserves_original_archive(self):
        self.archive();original=self.i.app.read_bytes();self.i.install()
        self.assertEqual(self.i.update(self.updated_bundle(),2)['release'],2)
        self.i.uninstall();self.assertEqual(self.i.app.read_bytes(),original)
    def test_update_failure_rolls_back(self):
        import install_core
        self.directory();self.i.install();old={name:(self.i.owned/name).read_bytes() for name in FILES}
        atomic=install_core.atomic;failed=False
        def fault(path,data):
            nonlocal failed
            if path.name=='activity.js' and not failed:failed=True;raise OSError('simulated disk write failure')
            return atomic(path,data)
        with patch('install_core.atomic',fault):
            with self.assertRaises(OSError):self.i.update(self.updated_bundle(),2)
        self.assertEqual(self.i.status()['release'],1)
        for name,data in old.items():self.assertEqual((self.i.owned/name).read_bytes(),data)
        self.assertFalse((self.i.owned/'update.json').exists());self.i.uninstall()
    def test_update_refuses_modified_payload(self):
        self.directory();self.i.install();(self.i.owned/FILES[0]).write_bytes(b'user change')
        with self.assertRaises(RuntimeError):self.i.update(self.updated_bundle(),2)
        with self.assertRaises(RuntimeError):self.i.uninstall()
        self.assertEqual((self.i.owned/FILES[0]).read_bytes(),b'user change')
    def test_update_counter_does_not_decrease(self):
        self.archive();self.i.install();new=self.updated_bundle();self.i.update(new,3)
        self.assertEqual(self.i.update(new,2)['release'],3);self.i.uninstall()
    def test_uninstall_can_retry_after_unknown_owned_file(self):
        self.archive();self.i.install();unknown=self.i.owned/'user.txt';unknown.write_text('keep')
        with self.assertRaises(RuntimeError):self.i.uninstall()
        self.assertEqual(self.i.status()['phase'],'restored');self.assertTrue(unknown.exists())
        unknown.unlink() # Test-owned fixture only.
        self.i.uninstall();self.assertFalse(self.i.owned.exists());self.assertTrue(self.i.app.is_file())
    def test_manifest_cannot_override_installed_status(self):
        self.archive();self.i.install()
        state=json.loads(self.i.manifest.read_text());state['phase']='prepared';state['installed']=True
        self.i.manifest.write_text(json.dumps(state));self.assertFalse(self.i.status()['installed'])
    def test_reparse_owned_directory_refused(self):
        import subprocess
        self.archive();outside=self.root/'outside';outside.mkdir();(outside/'keep.txt').write_text('keep')
        subprocess.run(['cmd','/c','mklink','/J',str(self.i.owned),str(outside)],check=True,capture_output=True)
        try:
            with self.assertRaises(RuntimeError):self.i.install()
            with self.assertRaises(RuntimeError):self.i.uninstall()
            self.assertEqual((outside/'keep.txt').read_text(),'keep')
        finally:self.i.owned.rmdir()
    def test_atomic_failed_replace_cleans_own_temp(self):
        import install_core
        target=self.root/'atomic.txt';target.write_bytes(b'original')
        with patch('install_core.os.replace',side_effect=OSError('simulated lock')):
            with self.assertRaises(OSError):install_core.atomic(target,b'new')
        self.assertEqual(target.read_bytes(),b'original');self.assertFalse((self.root/'atomic.txt.wardrobe-tmp').exists())
    def test_modified_package_retained(self):
        self.archive();self.i.install();package=self.i.app/'package.json';package.write_bytes(b'{"main":"user.js"}')
        with self.assertRaises(RuntimeError):self.i.uninstall()
        self.assertEqual(package.read_bytes(),b'{"main":"user.js"}')
    def test_retry_after_restore_journal_failure(self):
        import install_core
        self.archive();self.i.install();write_json=install_core.write_json
        def fault(path,data):
            if data.get('phase')=='restored':raise OSError('simulated journal lock')
            return write_json(path,data)
        with patch('install_core.write_json',fault):
            with self.assertRaises(OSError):self.i.uninstall()
        self.assertTrue(self.i.app.is_file());self.i.uninstall();self.assertFalse(self.i.owned.exists())
    def test_failed_payload_cleanup_keeps_recovery_manifest(self):
        self.archive();self.i.install();unlink=Path.unlink;failed=False
        def fault(path,*args,**kwargs):
            nonlocal failed
            if path==self.i.owned/'activity.js' and not failed:
                failed=True;raise PermissionError('simulated antivirus lock')
            return unlink(path,*args,**kwargs)
        with patch.object(Path,'unlink',fault):
            with self.assertRaises(PermissionError):self.i.uninstall()
        self.assertTrue(self.i.manifest.exists());self.assertEqual(self.i.status()['phase'],'restored')
        self.i.uninstall();self.assertFalse(self.i.owned.exists())

if __name__=='__main__': unittest.main()
