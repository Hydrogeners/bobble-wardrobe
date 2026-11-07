"""Actual signed quality bundle through the resident updater; fake Discord only."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from background import periodic
from channel_manager import ChannelManager
from install_core import Installer,FILES
from sign_release import sign
from signed_updates import verify
from test_support import TEST_TEMP

class OneCycle:
    def wait(self,seconds):return bool(seconds)

class QualityMigrationTests(unittest.TestCase):
    def test_automatic_previous_release_to_current_defers_and_restores_exactly(self):
        bundle=Path(__file__).parent/'bundle'
        current=json.loads((bundle/'release.json').read_text())['release']
        envelope,key=sign(bundle,current,Ed25519PrivateKey.generate())
        release=verify(envelope,key,current-1)
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temporary:
            root=Path(temporary);discord=root/'Discord'
            resources=discord/'app-1.0.1'/'resources';resources.mkdir(parents=True)
            (resources.parent/'Discord.exe').write_bytes(b'non-running test fixture')
            original=b'byte-exact original archive fixture'
            (resources/'app.asar').write_bytes(original)
            old=root/'old-bundle';old.mkdir()
            for name in FILES:(old/name).write_bytes(b'// previous-release fixture')
            (old/'release.json').write_text(json.dumps({'release':current-1}))
            running=False
            manager=ChannelManager(root/'maintenance',discord,old,lambda:running)
            manager.enable(resources)
            bootstrap=(resources/'app.asar'/'index.js').read_bytes()
            running=True
            with patch('background.fetch',return_value=release):
                periodic(manager,{'feed':'test HTTPS feed','publicKey':key},OneCycle())
            self.assertEqual(manager.load()['current'],current)
            self.assertEqual(Installer(resources,bundle).status()['release'],current-1)
            self.assertEqual((resources/'app.asar'/'index.js').read_bytes(),bootstrap)
            self.assertEqual(json.loads((manager.home/'maintenance-status.json').read_text())['phase'],'update-cached-until-discord-exits')
            running=False;manager.tick()
            installer=Installer(resources,bundle)
            self.assertEqual(installer.status()['release'],current)
            for name in FILES:self.assertEqual((installer.owned/name).read_bytes(),release.files[name])
            self.assertEqual((resources/'app.asar'/'index.js').read_bytes(),bootstrap)
            self.assertIsNone(verify(envelope,key,current))
            manager.disable();manager.uninstall();manager.clear_cache()
            self.assertEqual((resources/'app.asar').read_bytes(),original)

if __name__=='__main__':unittest.main()
