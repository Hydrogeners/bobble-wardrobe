import base64
import json
import gzip
from pathlib import Path
import unittest
import numpy as np
from base_styles import STYLES,make_base,augusto_cloak_panels
from native_scale import fit_native_parts

ROOT=Path(__file__).parent
BACKUP=ROOT.parent/'assets'/'quality-payload-10-json'

class BaseStyleTests(unittest.TestCase):
    def test_added_cloak_faces_outward_and_stays_on_body(self):
        p,n,uv,tri,texture=augusto_cloak_panels()
        face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
        centers=p[tri].mean(axis=1)
        self.assertTrue(np.all(face[:,0]*centers[:,0]+face[:,2]*centers[:,2]>0))
        self.assertLess(np.linalg.norm(p[:,[0,2]],axis=1).max(),.49)
        self.assertGreaterEqual(p[:,1].min(),.15)
    def test_patterns_are_nonflat_opaque_and_reference_specific(self):
        for name in STYLES:
            image=make_base(name,256,64)
            self.assertEqual(image.shape,(64,256,4))
            self.assertTrue(np.all(image[:,:,3]==255))
            self.assertGreater(len(np.unique(image[:,:,:3].reshape(-1,3),axis=0)),10,name)
        spark=make_base('spark',256,64)
        self.assertGreater(spark[-1,:,:3].mean(),200,'Spark must have an ivory base, not green')
        self.assertGreater(make_base('supa')[10,32,2],make_base('supa')[10,32,1],'SUPA center is purple')
    def test_face_geometry_and_artwork_are_preserved(self):
        for name in STYLES:
            with self.subTest(name=name):
                source=BACKUP/('visual-'+name+'-quality.json')
                before=json.loads(source.read_text() if source.exists() else gzip.decompress(source.with_suffix('.json.gz').read_bytes()))
                after=json.loads((ROOT/('visual-'+name+'-quality.json')).read_text())
                scaled=json.loads(json.dumps(before['parts']))
                fit_native_parts(scaled)
                self.assertEqual(scaled['head'],after['parts']['head'],'Face changes must be only the documented native-size transform')
                for key in ['position','normal','index','vertices','indices','bounds']:
                    self.assertEqual(scaled['base'][key],after['parts']['base'][key],'Ball may only receive the native-size transform')
                if name!='augusto':self.assertEqual(scaled['body'],after['parts']['body'])
                else:
                    for key in ['uv','index']:
                        original=base64.b64decode(before['parts']['body'][key])
                        self.assertEqual(original,base64.b64decode(after['parts']['body'][key])[:len(original)],'Extend the cloak without distorting the existing body')
                a=np.frombuffer(base64.b64decode(before['palette']),np.uint8).reshape(512,512,4)
                b=np.frombuffer(base64.b64decode(after['palette']),np.uint8).reshape(512,512,4)
                np.testing.assert_array_equal(a[:448,:448],b[:448,:448])
                np.testing.assert_array_equal(b[448:512,:256],make_base(name,256,64))
                self.assertEqual(after['baseStyle'],STYLES[name][0])

if __name__=='__main__':unittest.main()
