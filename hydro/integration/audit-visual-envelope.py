"""Measure a Wardrobe asset's visual silhouette; never reads or changes game physics.

The 0.5-unit comparison is the extracted Bug prefab BALL_GEO rest bounding
radius, NOT a verified collider/hitbox. Vertices in each part are local to its
renderer and are transformed using the extracted preview rest translations.
"""
import argparse
import base64
import json
import math
from pathlib import Path
import struct

HERE=Path(__file__).parent
ORIGIN={'base':(0,.5,0),'body':(0,.5,0),'head':(-.00811766181141138,1.2548877000808716,.0849103182554245)}

def audit(data,reference=.5):
    results={}
    for name,part in data['parts'].items():
        if name not in ORIGIN:raise ValueError('Unknown renderer part: '+name)
        raw=base64.b64decode(part['position'],validate=True)
        if len(raw)!=part['vertices']*12:raise ValueError('Position count mismatch: '+name)
        vertices=list(struct.iter_unpack('<fff',raw))
        if not vertices or any(not math.isfinite(n) for v in vertices for n in v):raise ValueError('Invalid positions: '+name)
        ox,oy,oz=ORIGIN[name]
        radial=[math.hypot(x+ox,z+oz) for x,y,z in vertices]
        # Ignore head height when making the specific rolling-base comparison.
        results[name]={'vertices':len(vertices),'maxHorizontalRadius':max(radial),
                       'boundsWorldRest':[[min(v[i]+ORIGIN[name][i] for v in vertices) for i in range(3)],
                                          [max(v[i]+ORIGIN[name][i] for v in vertices) for i in range(3)]],
                       'outsideVisualReferenceRadius':sum(r>reference for r in radial)}
    return {'referenceRadius':reference,'referenceMeaning':'Bug BALL_GEO visual rest bound, not measured collider',
            'alignment':'extracted Bug prefab renderer translations; other clubs and animation unverified',
            'parts':results}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('asset',nargs='?',type=Path,default=HERE/'visual-repaired-data.json')
    args=parser.parse_args()
    print(json.dumps(audit(json.loads(args.asset.read_text('utf-8'))),indent=2))

if __name__=='__main__':main()
