"""Pack original GLB geometry into two Unity-ready cosmetic meshes + palette.

The existing team-colored rolling base stays untouched. No game assets included.
"""
from pathlib import Path
import argparse, base64,json,hashlib,struct
import numpy as np

ROOT=Path(__file__).parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--glb',type=Path,default=ROOT.parent/'assets'/'hydro-bobble.glb')
parser.add_argument('--out',type=Path,default=ROOT/'visual-data.json')
parser.add_argument('--live',type=Path,default=ROOT/'visual-live.js')
args=parser.parse_args()
raw=args.glb.read_bytes()
length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]);binary=raw[28+length:]

def accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return np.ndarray((a['count'],dims),dtype=dtype,buffer=binary,offset=start,strides=(v.get('byteStride',np.dtype(dtype).itemsize*dims),np.dtype(dtype).itemsize)).copy()

def matrix(node):
    if 'matrix'in node:return np.array(node['matrix']).reshape((4,4),order='F')
    x,y,z,w=node.get('rotation',[0,0,0,1])
    r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    out=np.eye(4);out[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));out[:3,3]=node.get('translation',[0,0,0]);return out

groups={key:{'p':[],'n':[],'uv':[],'i':[],'names':[],'count':0} for key in ['head','body','base']}
def walk(index,parent,group=None):
    node=doc['nodes'][index];world=parent@matrix(node)
    if node.get('name')=='HeadRoot':group='head'
    elif node.get('name')=='BodyRoot':group='body'
    elif node.get('name')=='BaseRoot':group='base'
    if 'mesh'in node and group:
        g=groups[group];origin=np.array([0,1.2548999786,.0848999992]) if group=='head' else np.array([0,.5,0])
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            p=accessor(primitive['attributes']['POSITION']);n=accessor(primitive['attributes']['NORMAL'])
            p=(np.c_[p,np.ones(len(p))]@world.T)[:,:3]*.5-origin
            n=n@np.linalg.inv(world[:3,:3]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
            material=primitive.get('material',0);uv=np.tile([((material%8)*4+2)/32,((material//8)*4+2)/32],(len(p),1))
            # Unity's front-face winding is clockwise; normals stay outward.
            indices=accessor(primitive['indices']).reshape((-1,3))[:,[0,2,1]].astype(np.uint32)+g['count']
            g['p'].append(p);g['n'].append(n);g['uv'].append(uv);g['i'].append(indices)
            g['count']+=len(p);g['names'].append(node['name'])
    for child in node.get('children',[]):walk(child,world,group)
for index in doc['scenes'][doc.get('scene',0)]['nodes']:walk(index,np.eye(4))

palette=np.full((32,32,4),255,dtype=np.uint8)
for index,m in enumerate(doc['materials']):
    c=np.array(m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3])
    srgb=np.where(c<=.0031308,c*12.92,1.055*np.maximum(c,0)**(1/2.4)-.055)
    x=(index%8)*4;y=(index//8)*4;palette[y:y+4,x:x+4,:3]=np.round(np.clip(srgb,0,1)*255).astype(np.uint8)

def encode(data,dtype):return base64.b64encode(np.ascontiguousarray(data,dtype=dtype).tobytes()).decode('ascii')
parts={}
for key,g in groups.items():
    p=np.concatenate(g['p']);n=np.concatenate(g['n']);uv=np.concatenate(g['uv']);i=np.concatenate(g['i'])
    assert len(p)<65536 and i.max()<len(p)
    assert np.isfinite(p).all() and np.isfinite(n).all()
    assert np.max(np.abs(np.linalg.norm(n,axis=1)-1))<1e-4
    parts[key]={'vertices':len(p),'indices':i.size,'position':encode(p,'<f4'),'normal':encode(n,'<f4'),'uv':encode(uv,'<f4'),'index':encode(i,'<u2'),'bounds':[p.min(0).tolist(),p.max(0).tolist()],'sourceNodes':g['names']}
result={'revision':3,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'scale':.5,'fullGeometry':True,'palette':base64.b64encode(palette.tobytes()).decode(),'parts':parts}
args.out.write_text(json.dumps(result,separators=(',',':')))
args.live.write_text((ROOT/'visual-template.js').read_text(encoding='utf-8').replace('__VISUAL_DATA__',json.dumps(result,separators=(',',':'))),encoding='utf-8')
print(json.dumps({'parts':{k:{x:v[x] for x in ['vertices','indices','bounds']}for k,v in parts.items()},'fullGeometry':True,'originalGameGeometryIncluded':False},indent=2))
