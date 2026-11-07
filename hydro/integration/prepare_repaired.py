"""Offline edge-collapse simplification, independently per palette material."""
import sys
from pathlib import Path
import base64
import json
import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'vendor'))
import fast_simplification

data = json.loads((ROOT / 'visual-data.json').read_text())
report = {}
for name, part in data['parts'].items():
    def read(key, dtype, width):
        return np.frombuffer(base64.b64decode(part[key]), dtype=dtype).reshape(-1, width)
    p, uv = read('position', '<f4', 3), read('uv', '<f4', 2)
    faces = read('index', '<u2', 3)[:, [0, 2, 1]].copy()
    positions, normals, uvs, indices = [], [], [], []
    offset = 0
    # Every authored primitive uses a constant palette UV. Never merge colors.
    colors, labels = np.unique(uv[faces[:, 0]], axis=0, return_inverse=True)
    for label, color in enumerate(colors):
        f = faces[labels == label]
        used, inverse = np.unique(f, return_inverse=True)
        points = p[used].astype(np.float64)
        material = int(round((color[0]*32-2)/4)) + 8*int(round((color[1]*32-2)/4))
        if name == 'head':
            # Reduce the cap's overhang without removing any face geometry.
            if material in [9, 10, 11]:
                points[:, 0] *= .92
                points[:, 2] *= .92
                points[:, 1] = .78 + (points[:, 1]-.78)*.72
            # Tilt the authored face slightly upward for the fixed high camera.
            angle = np.deg2rad(-12)
            rotation = np.array([[1,0,0],[0,np.cos(angle),-np.sin(angle)],[0,np.sin(angle),np.cos(angle)]])
            pivot = np.array([0,.42,0])
            points = (points-pivot) @ rotation.T + pivot + [0,.06,0]
        elif name == 'body':
            points[:, 0] *= .90
            points[:, 2] *= .88
        elif name == 'base':
            points *= .82
        # Weld duplicated position vertices before topology-aware simplification.
        points, weld = np.unique(points, axis=0, return_inverse=True)
        f = weld[inverse.reshape(-1, 3)].astype(np.int32)
        if len(f) > 160:
            points, f = fast_simplification.simplify(points, f, target_reduction=0.80)
        cross = np.cross(points[f[:, 1]]-points[f[:, 0]], points[f[:, 2]]-points[f[:, 0]])
        keep = np.linalg.norm(cross, axis=1) > 1e-12
        f, cross = f[keep], cross[keep]
        n = np.zeros_like(points)
        for corner in range(3):
            np.add.at(n, f[:, corner], cross)
        lengths = np.linalg.norm(n, axis=1)
        valid = lengths > 1e-12
        n[valid] /= lengths[valid, None]
        n[~valid] = [0, 1, 0]
        positions.append(points); normals.append(n)
        uvs.append(np.tile(color, (len(points), 1)))
        indices.append(f + offset); offset += len(points)
    pp, nn, uu, ii = map(np.concatenate, [positions, normals, uvs, indices])
    assert len(pp) < 65536 and ii.max() < len(pp)
    assert np.isfinite(pp).all() and np.isfinite(nn).all()
    for key, array, dtype in [('position', pp, '<f4'), ('normal', nn, '<f4'), ('uv', uu, '<f4'), ('index', ii, '<u2')]:
        part[key] = base64.b64encode(np.asarray(array, dtype=dtype).tobytes()).decode()
    part.update(vertices=len(pp), indices=ii.size, triangles=len(ii), bounds=[pp.min(0).tolist(), pp.max(0).tolist()])
    report[name] = {'vertices': len(pp), 'triangles': len(ii)}
data.update(decimated=True, decimation={'method': 'quadric edge collapse per palette material'}, winding='outward CCW candidate')
packed = json.dumps(data, separators=(',', ':'))
(ROOT / 'visual-repaired-data.json').write_text(packed)
(ROOT / 'visual-repaired-live.js').write_text((ROOT / 'visual-template.js').read_text().replace('__VISUAL_DATA__', packed))
print(json.dumps(report, indent=2))
