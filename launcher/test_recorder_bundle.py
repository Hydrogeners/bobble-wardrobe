"""Verify pinned recorder source, combined payload and packaged helper inputs."""
from pathlib import Path
import unittest
from recorder_bundle import MODULES,compose,verify_source,adapt_sharing_copy

ROOT=Path(__file__).parent
class RecorderBundleTests(unittest.TestCase):
    def test_reviewed_upstream_source(self):
        record=verify_source(ROOT.parent/'recorder')
        self.assertEqual(len(record['files']),25)
        self.assertEqual(record['version'],'0.3.0')
    def test_exact_three_addon_payload(self):
        source=(ROOT.parent/'hydro/integration/wardrobe-live.js').read_text(encoding='utf-8')
        bundle=(ROOT/'bundle/wardrobe-live.js').read_text(encoding='utf-8')
        self.assertEqual(bundle,compose(source,ROOT.parent/'recorder'))
        self.assertLess(len(bundle.encode()),24*1024*1024)
        for marker in ('__bobblePowerTracker','__bobbleWardrobe','BLVideoRecorder','video-replay-3-disk','mbps: 1'):
            self.assertIn(marker,bundle)
        for module in MODULES:
            self.assertIn(adapt_sharing_copy((ROOT.parent/'recorder/replay_lab'/module).read_text(encoding='utf-8')),bundle)
        self.assertNotIn('Start clip sharing.cmd',bundle)
        self.assertIn('Start clip sharing in the Bobble Addons launcher',bundle)
        self.assertNotIn("Object.defineProperty(window, 'createUnityInstance'",bundle,'Never double-hook the shared Unity loader')
        self.assertNotIn('localhost:9222',bundle)
    def test_helper_is_exact_reviewed_source(self):
        self.assertEqual((ROOT/'recorder-tools/clip_host.cjs').read_text(encoding='utf-8'),adapt_sharing_copy((ROOT.parent/'recorder/tools/clip_host.cjs').read_text(encoding='utf-8')))
        for file in ('index.html','video_offline.js'):
            self.assertEqual((ROOT/'recorder-tools'/file).read_text(encoding='utf-8'),(ROOT.parent/'recorder/replay_lab'/file).read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
