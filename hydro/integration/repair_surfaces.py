"""Offline, reviewed surface repair. Never weld UV islands or overwrite inputs.

Writes candidate owned meshes; keeps all vertices, UVs and triangles. Winding is
corrected only where the original vertex normals strongly agree it is reversed.
"""
import argparse,base64,copy,gzip,json,struct,io,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
from native_scale import ORIGIN,read,encode

def restore_texture_detail(data,name):
    """Resample the verified original 2048px artwork, not a blurred 448px atlas.

    Artwork UVs receive one affine remap. Existing ball/cloak strips retain their
    exact pixels in a separate 64px band. No texture-island color extrapolation.
    """
    path=Path(__file__).parent.parent/'assets/wardrobe-quality-uvsafe'/f'{name}-wardrobe.glb'
    raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==data['sourceSHA256']
    length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
    materials=[m for m in doc['materials'] if 'sphere' not in m.get('name','')]
    assert len(materials)==1
    texture=materials[0]['pbrMetallicRoughness']['baseColorTexture']['index'];image=doc['images'][doc['textures'][texture]['source']]
    view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
    source=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGBA')
    atlas=np.full((1024,1024,4),255,np.uint8);atlas[:960,:960]=np.asarray(source.resize((960,960),Image.Resampling.LANCZOS).transpose(Image.Transpose.FLIP_TOP_BOTTOM))
    # Remove sub-visible JPEG noise; max four RGB levels of error. This retains
    # eyes, outlines and cloth patterns while keeping the high-detail atlas small.
    rgb=atlas[:960,:960,:3].astype(float)
    atlas[:960,:960,:3]=np.clip(np.round(rgb/8)*8,0,255).astype(np.uint8)
    old=np.frombuffer(base64.b64decode(data['palette']),np.uint8).reshape(512,512,4);atlas[960:1024,:512]=old[448:512]
    for part in data['parts'].values():
        uv=np.frombuffer(base64.b64decode(part['uv']),'<f4').reshape(-1,2).astype(float)
        art=uv[:,1]<448/512
        uv[art]=((uv[art]*512-.5)*(959/447)+.5)/1024
        uv[~art,0]*=.5;uv[~art,1]=(uv[~art,1]*512+512)/1024
        part['uv']=encode(uv)
    data['palette']=base64.b64encode(atlas.tobytes()).decode();data['textureSize']=1024

def repair(data,name):
    data=copy.deepcopy(data);report={'revision':19,'reversedTriangles':{}}
    restore_texture_detail(data,name);report['sourceAtlasSize']=2048;report['textureSize']=1024;report['artRGBStep']=8
    for kind,part in data['parts'].items():
        p=read(part,'position');n=read(part,'normal')
        tri=np.frombuffer(base64.b64decode(part['index']),'<u2').reshape(-1,3).copy()
        face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
        normal=n[tri].mean(1);den=np.linalg.norm(face,axis=1)*np.linalg.norm(normal,axis=1)
        flipped=(face*normal).sum(1)<-.25*den
        flipped&=den>1e-12
        tri[flipped]=tri[flipped][:,[0,2,1]]
        part['index']=base64.b64encode(np.ascontiguousarray(tri,dtype='<u2')).decode()
        report['reversedTriangles'][kind]=int(flipped.sum())
        if name=='jjcho' and kind=='head':
            # A continuous 12% vertical lift around the chin, not disconnected
            # face bands; inverse-transpose normals follow the same transform.
            chin=p[:,1].min();p[:,1]=chin+(p[:,1]-chin)*1.12
            n[:,1]/=1.12;report['headVertical']=1.12
        if name=='augusto' and kind=='head':
            # Broader, shorter storybook proportions; keep crown/eyes/UV artwork.
            chin=p[:,1].min();p[:,0]*=1.10;p[:,1]=chin+(p[:,1]-chin)*.94
            n[:,0]/=1.10;n[:,1]/=.94;report['headShape']=[1.10,.94,1]
        if name=='duolingo' and kind=='body':
            world=p+ORIGIN[kind];weight=np.clip((.79-world[:,1])/.24,0,1)*np.clip((world[:,2]-.12)/.20,0,1)
            world[:,1]-=.11*weight
            # The coat remains outside the independent rolling sphere. Scarf,
            # upper coat, rear and the ball itself remain exactly untouched.
            front=np.sqrt(np.maximum(0,.520**2-world[:,0]**2-(world[:,1]-.5)**2))
            changed=weight>0;world[changed,2]=np.maximum(world[changed,2],front[changed])
            p=world-ORIGIN[kind]
            face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
            summed=np.zeros_like(n)
            for corner in range(3):np.add.at(summed,tri[:,corner],face)
            lengths=np.linalg.norm(summed,axis=1);valid=changed&(lengths>1e-9)
            n[valid]=summed[valid]/lengths[valid,None]
            report['coatFrontVertices']=int(changed.sum())
        if (name in ['jjcho','augusto'] and kind=='head') or (name=='duolingo' and kind=='body'):
            n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
            part['position']=encode(p);part['normal']=encode(n)
            local=read(part,'position');part['bounds']=[local.min(0).tolist(),local.max(0).tolist()]
    data['surfaceRepair']=report
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
    assert args.source.resolve()!=args.output.resolve(),'Candidate output must not overwrite source'
    args.output.mkdir(parents=True,exist_ok=True)
    for name in 'hydro miko todo jjcho augusto flair supa duolingo spark'.split():
        source=args.source/f'visual-{name}-quality.json'
        raw=source.read_bytes() if source.exists() else gzip.decompress(source.with_suffix('.json.gz').read_bytes())
        data=repair(json.loads(raw),name);(args.output/source.name).write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
        print(name,json.dumps(data['surfaceRepair']),flush=True)
