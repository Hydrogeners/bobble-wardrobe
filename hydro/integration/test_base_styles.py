import base64
import json
import gzip
from pathlib import Path
import unittest
import numpy as np
from base_styles import STYLES,make_base,augusto_cloak_panels
from native_scale import fit_native_parts
from PIL import Image,ImageDraw,ImageFilter
from test_surface_repairs import seed

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
                # Preserve this stage's historical base/art guarantees; the
                # later seam/proportion patch has separate final-asset checks.
                after=seed(name)
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
                if 'surfacePolish' in after:
                    self.assertTrue(after['surfacePolish']['headSamplingTexelsUnchanged'])
                    part=after['parts']['head']
                    uv=np.frombuffer(base64.b64decode(part['uv']),'<f4').reshape(-1,2)*512-.5
                    tri=np.frombuffer(base64.b64decode(part['index']),'<u2').reshape(-1,3)
                    mask=Image.new('L',(512,512));draw=ImageDraw.Draw(mask)
                    for ids in tri:draw.polygon([tuple(point) for point in uv[ids]],fill=255)
                    protected=np.asarray(mask.filter(ImageFilter.MaxFilter(5)))>0
                    protected[448:]=False;protected[:,448:]=False
                    np.testing.assert_array_equal(a[protected],b[protected])
                    changed=np.any(a[:448,:448]!=b[:448,:448],axis=2)
                    self.assertEqual(int(changed.sum()),after['surfacePolish']['cleanedOutfitTexels'])
                    self.assertLess(int(changed.sum()),1000,'Outfit cleanup must remain targeted')
                else:np.testing.assert_array_equal(a[:448,:448],b[:448,:448])
                np.testing.assert_array_equal(b[448:512,:256],make_base(name,256,64))
                self.assertEqual(after['baseStyle'],STYLES[name][0])

    def test_augusto_chest_panel_clears_the_rolling_ball(self):
        data=json.loads((ROOT/'visual-augusto-quality.json').read_text())
        part=data['parts']['body']
        uv=np.frombuffer(base64.b64decode(part['uv']),'<f4').reshape(-1,2)
        if data.get('textureSize')==1024:
            uv=uv.copy();uv[:,0]*=2;uv[:,1]=uv[:,1]*2-1
        armor=(uv[:,0]>.75)&(uv[:,1]>.875)
        self.assertGreater(armor.sum(),500)
        p=np.frombuffer(base64.b64decode(part['position']),'<f4').reshape(-1,3)
        self.assertGreater(np.linalg.norm(p[armor],axis=1).min(),.5169)
        tri=np.frombuffer(base64.b64decode(part['index']),'<u2').reshape(-1,3)
        faces=tri[np.all(armor[tri],axis=1)]
        # Convex ball stays clear of faces as well as their vertices.
        self.assertGreater(np.linalg.norm(p[faces].mean(axis=1),axis=1).min(),.515)

if __name__=='__main__':unittest.main()
