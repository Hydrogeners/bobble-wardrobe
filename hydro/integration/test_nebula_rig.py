"""Verify the authored base details belong to the rolling renderer."""
import json
from pathlib import Path
import struct
import unittest


class NebulaRigTests(unittest.TestCase):
    def test_base_details_are_parented_to_base_root(self):
        raw = (Path(__file__).parent.parent / 'assets' / 'nebula-bobble.glb').read_bytes()
        length = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + length])
        nodes = doc['nodes']
        parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
        details = [i for i, node in enumerate(nodes) if node.get('name', '').startswith('Base · gold')]
        self.assertEqual(len(details), 10)
        for index in details:
            names = []
            while index in parents:
                index = parents[index]
                names.append(nodes[index].get('name'))
            self.assertIn('BaseRoot', names)
            self.assertNotIn('BodyRoot', names)


if __name__ == '__main__':
    unittest.main()
