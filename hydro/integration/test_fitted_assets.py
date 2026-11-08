"""Runtime-envelope checks, not a claim of collider or in-match validation."""
import base64
import importlib.util
import json
from pathlib import Path
import struct
import unittest
import os

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('envelope',ROOT/'audit-visual-envelope.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
NAMES='hydro miko todo jjcho augusto flair supa duolingo spark'.split()
QUALITY=os.environ.get('BOBBLE_ASSET_VARIANT')=='quality'

class FittedAssetTests(unittest.TestCase):
    def test_conversion_preserves_source_orientation_and_does_not_weld_uv_islands(self):
        import ast
        tree=ast.parse((ROOT.parent/'fit_meshy.py').read_text())
        calls=[n.func.attr for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute)]
        self.assertNotIn('recalc_face_normals',calls,'Open UV-island components must not be independently flipped')
        self.assertNotIn('remove_doubles',calls,'Do not weld Meshy UV-island boundaries')
        preview=(ROOT/'skin-preview.js').read_text()
        self.assertIn('gl.enable(gl.CULL_FACE)',preview,'Do not hide orientation defects with double-sided rendering')
    def test_all_assets_are_bounded_complete_and_use_prefab_rest_pivots(self):
        for name in NAMES:
            with self.subTest(name=name):
                suffix='quality' if QUALITY else 'fitted'
                data=json.loads((ROOT/('visual-'+name+'-'+suffix+'.json')).read_text())
                self.assertEqual(data['revision'],3)
                self.assertTrue(data['fullGeometry'])
                self.assertEqual(set(data['parts']),{'head','body','base'})
                side=(1024 if 'surfaceRepair' in data else 512) if QUALITY else 256
                self.assertEqual(len(base64.b64decode(data['palette'])),side*side*4)
                measured=audit.audit(data)
                total=0
                for kind,part in data['parts'].items():
                    self.assertLess(part['vertices'],65536)
                    total+=part['indices']//3
                    self.assertLessEqual(measured['parts'][kind]['maxHorizontalRadius'],.80 if QUALITY else .491)
                    for key,width in [('position',12),('normal',12),('uv',8)]:
                        self.assertEqual(len(base64.b64decode(part[key])),part['vertices']*width)
                    indices=struct.unpack('<'+'H'*part['indices'],base64.b64decode(part['index']))
                    self.assertLess(max(indices),part['vertices'])
                    # End each part at the same rest-pose cut planes.
                    bounds=measured['parts'][kind]['boundsWorldRest']
                    limits=({'base':(0,1),'body':(.17 if name=='augusto' else .435 if name=='duolingo' and 'surfaceRepair' in data else .5457,1.173),'head':(1.0416,2.40)} if QUALITY else {'base':(.05,.95),'body':(.68,1.20),'head':(1.20,2.15)})[kind]
                    self.assertGreaterEqual(bounds[0][1],limits[0]-.002)
                    self.assertLessEqual(bounds[1][1],limits[1]+.002)
                self.assertLess(total,90000 if QUALITY else 18000)
                sphere=data['parts']['base']
                for x,y,z in struct.iter_unpack('<fff',base64.b64decode(sphere['position'])):
                    self.assertAlmostEqual((x*x+y*y+z*z)**.5,.50 if QUALITY else .45,places=3 if QUALITY else 5)
    def test_bundle_stays_inside_existing_signed_update_limit(self):
        self.assertLessEqual((ROOT/'wardrobe-live.js').stat().st_size,(24 if QUALITY else 6)*1024*1024)

if __name__=='__main__':unittest.main()
