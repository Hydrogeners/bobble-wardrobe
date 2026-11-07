import base64
import importlib.util
from pathlib import Path
import struct
import unittest

spec=importlib.util.spec_from_file_location('visual_envelope',Path(__file__).with_name('audit-visual-envelope.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class EnvelopeTests(unittest.TestCase):
    def fixture(self,points):
        return {'parts':{'base':{'vertices':len(points),'position':base64.b64encode(b''.join(struct.pack('<fff',*p) for p in points)).decode()}}}
    def test_measures_radial_distance_and_rest_offset(self):
        result=audit.audit(self.fixture([(0,0,0),(.6,0,0)]))['parts']['base']
        self.assertAlmostEqual(result['maxHorizontalRadius'],.6,places=6)
        self.assertEqual(result['outsideVisualReferenceRadius'],1)
        self.assertEqual(result['boundsWorldRest'][0][1],.5)
    def test_rejects_truncated_geometry(self):
        fixture=self.fixture([(0,0,0)]);fixture['parts']['base']['vertices']=2
        with self.assertRaises(ValueError):audit.audit(fixture)
    def test_rejects_nonfinite_geometry(self):
        with self.assertRaises(ValueError):audit.audit(self.fixture([(float('nan'),0,0)]))

if __name__=='__main__':unittest.main()
