"""Measured visual dimensions and preservation; no collider/live claims."""
import base64
import copy
import json
import gzip
from pathlib import Path
import unittest
import numpy as np
from native_scale import fit_native_parts,read,ORIGIN,HEAD_WIDTH,BODY_WIDTH,HEAD_LOW
from test_surface_repairs import seed

ROOT=Path(__file__).parent
BACKUP=ROOT.parent/'assets'/'quality-payload-11-json'
NAMES='hydro miko todo jjcho augusto flair supa duolingo spark'.split()

class NativeScaleTests(unittest.TestCase):
    def test_all_models_match_native_part_dimensions(self):
        for name in NAMES:
            with self.subTest(name=name):
                source=BACKUP/f'visual-{name}-quality.json'
                before=json.loads(source.read_text() if source.exists() else gzip.decompress(source.with_suffix('.json.gz').read_bytes()))
                # Native-fit stage remains tested byte-for-byte. Later requested
                # art changes are independently checked by test_surface_repairs.
                after=seed(name)
                expected=copy.deepcopy(before['parts'])
                metadata=fit_native_parts(expected)
                for kind in ['head','base']:
                    self.assertTrue(after['parts'][kind]==expected[kind],kind+' native transform changed')
                    self.assertEqual(after['nativeScale']['parts'][kind],metadata['parts'][kind])
                if name!='augusto':
                    self.assertTrue(after['parts']['body']==expected['body'],'Native torso transform changed')
                    self.assertEqual(after['nativeScale'],metadata)
                # Outfit/base artwork and AUGUSTO's added panels are now
                # deliberately revised; head texels and original body topology
                # are checked independently by test_base_styles.
                for kind,part in after['parts'].items():
                    old=before['parts'][kind]
                    for key in ['uv','index','vertices','indices','sourceNodes']:
                        if name=='augusto' and kind=='body':
                            if key=='sourceNodes':self.assertEqual(part[key],old[key])
                        else:self.assertTrue(part[key]==old[key],kind+' '+key)
                    self.assertLess(np.abs(np.linalg.norm(read(part,'normal'),axis=1)-1).max(),1e-4)
                ball=read(after['parts']['base'],'position')
                np.testing.assert_allclose(np.linalg.norm(ball,axis=1),.5,atol=.0001)
                body=read(after['parts']['body'],'position')+ORIGIN['body']
                self.assertAlmostEqual(np.ptp(body[:,0]),BODY_WIDTH,places=3)
                self.assertGreaterEqual(body[:,1].min(),.17)
                self.assertAlmostEqual(body[:,1].max(),1.1729294,places=3)
                source=read(before['parts']['head'],'position')+ORIGIN['head']
                mask=(source[:,1]>1.30)&(source[:,1]<1.65)
                head=read(after['parts']['head'],'position')+ORIGIN['head']
                self.assertAlmostEqual(np.ptp(head[mask,0]),HEAD_WIDTH,places=3)
                self.assertAlmostEqual(head[:,1].min(),HEAD_LOW,places=3)
                # A uniform positive head transform cannot melt facial geometry
                # or flip triangles; normals/topology are preserved exactly.
                self.assertEqual(before['parts']['head']['normal'],after['parts']['head']['normal'])
                scale=metadata['parts']['head']['uniform']
                delta=head-source*scale
                np.testing.assert_allclose(delta,np.broadcast_to(delta.mean(0),delta.shape),atol=.0001)

if __name__=='__main__':unittest.main()
