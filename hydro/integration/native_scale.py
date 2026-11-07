"""Fit visual parts to measured human-prefab dimensions, never colliders.

Measurements: audit-native-scale.py, Team 1 Bug / Ball, Body_Male_TeamBug,
Head_Male01, Prod-590-CL28650. Accessory extents are not used to shrink faces.
Transforms/pivots are untouched; only owned replacement mesh data is fitted.
"""
import base64
import numpy as np

ORIGIN={'base':np.array([0,.5,0]),'body':np.array([0,.5,0]),'head':np.array([-.0081176618,1.2548877001,.0849103183])}
BODY_WIDTH=1.1434540748596191
BODY_LOW=.5457254648208618
BODY_HIGH=1.1729294061660767
HEAD_WIDTH=.9403152465820312
HEAD_LOW=1.041654348373413
HEAD_CENTER_X=-.00811766181141138
HEAD_CENTER_Z=.04286892712116242

def read(part,key):return np.frombuffer(base64.b64decode(part[key]),'<f4').reshape(-1,3).astype(float)
def encode(array):
    array=np.round(array*16384)/16384
    array[array==0]=0
    return base64.b64encode(np.ascontiguousarray(array,dtype='<f4').tobytes()).decode()

def fit_native_parts(parts):
    factors={}
    for kind,part in parts.items():
        p=read(part,'position')+ORIGIN[kind]
        n=read(part,'normal')
        if kind=='base':
            scale=.5/.45
            p=(p-ORIGIN[kind])*scale+ORIGIN[kind]
            factors[kind]={'uniform':scale,'radius':.5}
        elif kind=='body':
            center=(p.min(0)+p.max(0))*.5
            scale=BODY_WIDTH/np.ptp(p[:,0])
            p[:,0]=(p[:,0]-center[0])*scale
            p[:,2]=(p[:,2]-center[2])*scale+.00006309151649475
            slope=(BODY_HIGH-BODY_LOW)/(1.20-.68)
            # Keep the new cloak hem above the floor while fitting the stock
            # torso. The anatomical torso uses one continuous affine map.
            vertical=np.where(p[:,1]<.68,.70,slope)
            p[:,1]=BODY_LOW+(p[:,1]-.68)*vertical
            n[:,0]/=scale;n[:,2]/=scale;n[:,1]/=vertical
            n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
            factors[kind]={'horizontal':scale,'vertical':slope,'width':BODY_WIDTH}
        else:
            mask=(p[:,1]>1.30)&(p[:,1]<1.65)
            assert mask.sum()>20,'Missing face-core sample'
            face=p[mask]
            center=(face.min(0)+face.max(0))*.5
            scale=HEAD_WIDTH/np.ptp(face[:,0])
            p[:,0]=(p[:,0]-center[0])*scale+HEAD_CENTER_X
            p[:,2]=(p[:,2]-center[2])*scale+HEAD_CENTER_Z
            p[:,1]=HEAD_LOW+(p[:,1]-p[:,1].min())*scale
            factors[kind]={'uniform':scale,'faceWidth':HEAD_WIDTH,'faceSampleSourceY':[1.30,1.65],'minimumY':HEAD_LOW}
        part['position']=encode(p-ORIGIN[kind])
        part['normal']=encode(n)
        local=read(part,'position')
        part['bounds']=[local.min(0).tolist(),local.max(0).tolist()]
    return {'revision':12,'reference':'Prod-590-CL28650 / Team 1 Bug human visual rest bounds, not colliders','parts':factors}
