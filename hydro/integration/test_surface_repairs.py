"""User-requested silhouette and seam changes, with byte-exact rollback seeds."""
import base64,gzip,hashlib,json
from pathlib import Path
import unittest
import numpy as np
from native_scale import read,ORIGIN

ROOT=Path(__file__).parent
SEEDS=ROOT.parent/'assets/before-surface-repair-19'

def seed(name):
    data=json.loads((ROOT/f'visual-{name}-quality.json').read_text())
    if 'surfaceRepair' not in data:return data
    return json.loads(gzip.decompress((SEEDS/f'visual-{name}-quality.json.gz').read_bytes()))

class SurfaceRepairTests(unittest.TestCase):
    def test_only_explicit_geometry_changes_and_no_lost_topology(self):
        report=json.loads((ROOT/'surface-repair-report.json').read_text())
        for name,record in report.items():
            with self.subTest(name=name):
                old=gzip.decompress((SEEDS/f'visual-{name}-quality.json.gz').read_bytes());raw=(ROOT/f'visual-{name}-quality.json').read_bytes()
                self.assertEqual(hashlib.sha256(old).hexdigest(),record['beforeSHA256']);self.assertEqual(hashlib.sha256(raw).hexdigest(),record['afterSHA256'])
                a=json.loads(old);b=json.loads(raw);self.assertEqual(a['sourceSHA256'],b['sourceSHA256'])
                for kind,p in a['parts'].items():
                    q=b['parts'][kind]
                    for key in ['vertices','indices','sourceNodes']:self.assertEqual(p[key],q[key])
                    uv=lambda part:np.frombuffer(base64.b64decode(part['uv']),'<f4').reshape(-1,2)
                    olduv=uv(p).astype(float);expected=olduv.copy();art=olduv[:,1]<448/512
                    expected[art]=((olduv[art]*512-.5)*(959/447)+.5)/1024
                    expected[~art,0]*=.5;expected[~art,1]=(olduv[~art,1]*512+512)/1024
                    np.testing.assert_allclose(uv(q),expected,atol=1/16384)
                    index=lambda part:np.frombuffer(base64.b64decode(part['index']),'<u2').reshape(-1,3)
                    np.testing.assert_array_equal(np.sort(index(p),axis=1),np.sort(index(q),axis=1))
                    expected=(name in ['jjcho','augusto'] and kind=='head') or (name=='duolingo' and kind=='body')
                    if not expected:
                        self.assertEqual(p['position'],q['position']);self.assertEqual(p['normal'],q['normal'])
                    self.assertLess(np.max(np.abs(np.linalg.norm(read(q,'normal'),axis=1)-1)),.0001)
                x=np.frombuffer(base64.b64decode(a['palette']),np.uint8).reshape(512,512,4);y=np.frombuffer(base64.b64decode(b['palette']),np.uint8).reshape(1024,1024,4)
                np.testing.assert_array_equal(x[448:512],y[960:1024,:512],'No painted-ball/cloak-strip changes')

    def test_documented_head_proportions(self):
        for name,scale in [('jjcho',[1,1.12,1]),('augusto',[1.10,.94,1])]:
            a=read(seed(name)['parts']['head'],'position');b=read(json.loads((ROOT/f'visual-{name}-quality.json').read_text())['parts']['head'],'position')
            expected=a.copy();expected[:,0]*=scale[0];expected[:,1]=a[:,1].min()+(a[:,1]-a[:,1].min())*scale[1]
            np.testing.assert_allclose(b,expected,atol=1/16384)

    def test_duolingo_scarf_ball_and_upper_coat_untouched(self):
        a=seed('duolingo');b=json.loads((ROOT/'visual-duolingo-quality.json').read_text())
        p=read(a['parts']['body'],'position')+ORIGIN['body'];q=read(b['parts']['body'],'position')+ORIGIN['body']
        untouched=(p[:,1]>=.79)|(p[:,2]<=.12)
        np.testing.assert_array_equal(p[untouched],q[untouched]);self.assertEqual(a['parts']['base']['position'],b['parts']['base']['position'])
        changed=~untouched;self.assertLess(q[changed,1].min(),p[changed,1].min()-.09)
        self.assertGreaterEqual(np.linalg.norm(q[changed]-[0,.5,0],axis=1).min(),.5198)

if __name__=='__main__':unittest.main()
