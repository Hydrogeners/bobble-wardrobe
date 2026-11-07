"""Pack original GLB geometry into two Unity-ready cosmetic meshes + palette.

The existing team-colored rolling base stays untouched. No game assets included.
"""
from pathlib import Path
import argparse, base64,json,hashlib,struct
import numpy as np
from base_styles import make_base, augusto_cloak_panels, STYLES
from native_scale import fit_native_parts,finish_augusto_armor

ROOT=Path(__file__).parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--glb',type=Path,default=ROOT.parent/'assets'/'hydro-bobble.glb')
parser.add_argument('--out',type=Path,default=ROOT/'visual-data.json')
parser.add_argument('--live',type=Path,default=ROOT/'visual-live.js')
parser.add_argument('--textured',action='store_true',help='Preserve GLB UVs and one base-color image, bounded to 192px')
parser.add_argument('--quality',action='store_true',help='512px atlas, preserving substantially more face detail')
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
        g=groups[group];origin=np.array([-.0081176618,1.2548877001,.0849103183]) if args.textured and group=='head' else np.array([0,1.2548999786,.0848999992]) if group=='head' else np.array([0,.5,0])
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            p=accessor(primitive['attributes']['POSITION']);n=accessor(primitive['attributes']['NORMAL'])
            p=(np.c_[p,np.ones(len(p))]@world.T)[:,:3]*(1 if args.textured else .5)-origin
            if args.textured:
                world_p=p+origin
                radius=np.linalg.norm(world_p[:,[0,2]],axis=1)
                factor=np.minimum(1,.49/np.maximum(radius,1e-12))
                # Do not clamp individual vertices: flattening boundary outliers
                # can crease the face and accessories. Audit the fitted mesh.
                p=world_p-origin
            n=n@np.linalg.inv(world[:3,:3]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
            material=primitive.get('material',0);uv=np.tile([((material%8)*4+2)/32,((material//8)*4+2)/32],(len(p),1))
            if args.textured:
                uv=accessor(primitive['attributes']['TEXCOORD_0']);uv[:,1]=1-uv[:,1]
                side=512 if args.quality else 256
                art=side-64
                if group=='base':
                    if args.quality:
                        uv[:,0]=np.clip(uv[:,0],0,1)*(255/side)+(.5/side)
                        uv[:,1]=np.clip(uv[:,1],0,1)*(63/side)+((art+.5)/side)
                    else:
                        uv[:,0]=np.clip(uv[:,0],0,1)*(63/side)+((art+.5)/side)
                        uv[:,1]=np.clip(uv[:,1],0,1)*(127/side)+(.5/side)
                else:uv=uv*((art-1)/side)+(.5/side)
            # Unity's front-face winding is clockwise; normals stay outward.
            indices=accessor(primitive['indices']).reshape((-1,3))[:,[0,2,1]].astype(np.uint32)+g['count']
            if args.textured:indices=indices[:,[0,2,1]]
            if args.quality:
                # Sub-pixel transport precision, not topology simplification.
                p=np.round(p*16384)/16384;n=np.round(n*16384)/16384;uv=np.round(uv*16384)/16384
                for array in [p,n,uv]:array[array==0]=0
            g['p'].append(p);g['n'].append(n);g['uv'].append(uv);g['i'].append(indices)
            g['count']+=len(p);g['names'].append(node['name'])
    for child in node.get('children',[]):walk(child,world,group)
for index in doc['scenes'][doc.get('scene',0)]['nodes']:walk(index,np.eye(4))

palette=np.full((32,32,4),255,dtype=np.uint8)
for index,m in enumerate(doc['materials']):
    c=np.array(m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3])
    srgb=np.where(c<=.0031308,c*12.92,1.055*np.maximum(c,0)**(1/2.4)-.055)
    x=(index%8)*4;y=(index//8)*4;palette[y:y+4,x:x+4,:3]=np.round(np.clip(srgb,0,1)*255).astype(np.uint8)

if args.textured:
    import io
    from PIL import Image
    textures={m['pbrMetallicRoughness']['baseColorTexture']['index'] for m in doc['materials']}
    assert len(textures)==2, 'Expected source atlas and baked rolling sphere'
    side=512 if args.quality else 256
    art=side-64
    palette=np.full((side,side,4),255,dtype=np.uint8)
    for texture in textures:
        image=doc['images'][doc['textures'][texture]['source']]
        view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
        atlas=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGBA')
        if atlas.size==(64,128):
            sphere=np.asarray(atlas.transpose(Image.Transpose.FLIP_TOP_BOTTOM)).copy()
            name=args.glb.stem.split('-')[0]
            # The rolling ball must not carry a baked tie/cape/jacket fragment.
            # Keep the illustrated band/leaf/feather decoration on other bases.
            if args.quality:
                sphere=make_base(name,256,64)
            elif name in ['hydro','todo','jjcho','flair','augusto']:
                colors=sphere[:64,:,:3].reshape(-1,3)
                if name in ['flair','augusto','duolingo']:
                    selected=colors[(colors.min(1)>130)&(colors.max(1)-colors.min(1)<45)]
                elif name in ['todo','jjcho','supa']:selected=colors[(colors.mean(1)<65)&(colors.max(1)-colors.min(1)<30)]
                elif name=='miko':selected=colors[(colors[:,1]>colors[:,0]*1.5)&(colors[:,2]>colors[:,0]*1.5)]
                elif name=='spark':selected=colors[(colors[:,1]>colors[:,0]*1.2)&(colors[:,1]>colors[:,2]*1.1)]
                else:selected=colors[(colors[:,0]>colors[:,1]*1.25)&(colors[:,1]>colors[:,2]*1.15)]
                assert len(selected), 'Could not identify base coat color'
                sphere[:,:,:3]=np.median(selected,axis=0).astype(np.uint8)
            else:
                sphere[64:]=sphere[63:64]
            if args.quality:palette[art:side,:256]=sphere
            else:palette[:128,art:side]=sphere
        else:
            atlas=atlas.resize((art,art),Image.Resampling.LANCZOS).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            palette[:art,:art]=np.asarray(atlas,dtype=np.uint8)

def encode(data,dtype):return base64.b64encode(np.ascontiguousarray(data,dtype=dtype).tobytes()).decode('ascii')
parts={}
for key,g in groups.items():
    p=np.concatenate(g['p']);n=np.concatenate(g['n']);uv=np.concatenate(g['uv']);i=np.concatenate(g['i'])
    if args.quality and args.glb.stem.split('-')[0]=='augusto' and key=='body':
        origin=np.array([0,.5,0])
        cp,cn,cu,ci,cloth=augusto_cloak_panels()
        ci+=len(p)
        p=np.concatenate([p,cp-origin]);n=np.concatenate([n,cn]);uv=np.concatenate([uv,cu]);i=np.concatenate([i,ci])
        palette[448:512,256:512]=cloth
        p=np.round(p*16384)/16384;n=np.round(n*16384)/16384;uv=np.round(uv*16384)/16384
        for array in [p,n,uv]:array[array==0]=0
    assert len(p)<65536 and i.max()<len(p)
    assert np.isfinite(p).all() and np.isfinite(n).all()
    assert np.max(np.abs(np.linalg.norm(n,axis=1)-1))<1e-4
    parts[key]={'vertices':len(p),'indices':i.size,'position':encode(p,'<f4'),'normal':encode(n,'<f4'),'uv':encode(uv,'<f4'),'index':encode(i,'<u2'),'bounds':[p.min(0).tolist(),p.max(0).tolist()],'sourceNodes':g['names']}
result={'revision':3,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'scale':.5,'fullGeometry':True,'palette':base64.b64encode(palette.tobytes()).decode(),'parts':parts}
if args.textured:result.update(textureSize=side,scale=1,winding='outward CCW',textured=True)
if args.quality:
    result['qualityGeometry']=True
    result['baseStyle']=STYLES[args.glb.stem.split('-')[0]][0]
    result['nativeScale']=fit_native_parts(parts)
    if args.glb.stem.split('-')[0]=='augusto':finish_augusto_armor(parts['body'])
    from polish_atlas import clean_source_atlas
    result=clean_source_atlas(result)
args.out.write_text(json.dumps(result,separators=(',',':')))
args.live.write_text((ROOT/'visual-template.js').read_text(encoding='utf-8').replace('__VISUAL_DATA__',json.dumps(result,separators=(',',':'))),encoding='utf-8')
print(json.dumps({'parts':{k:{x:v[x] for x in ['vertices','indices','bounds']}for k,v in parts.items()},'fullGeometry':True,'originalGameGeometryIncluded':False},indent=2))
