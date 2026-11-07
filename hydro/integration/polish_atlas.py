"""Targeted outfit atlas cleanup. Original geometry, UVs and heads are retained."""
import argparse
import base64
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

def decode(part,key,width,dtype='<f4'):
    return np.frombuffer(base64.b64decode(part[key]),dtype).reshape(-1,width)

def clean_source_atlas(data):
    """Remove only isolated outfit flecks; protect head texels and a gutter."""
    result=json.loads(json.dumps(data))
    source=np.frombuffer(base64.b64decode(data['palette']),np.uint8).reshape(512,512,4)
    def footprint(kind):
        part=data['parts'][kind]
        uv=decode(part,'uv',2)*512-.5;tri=decode(part,'index',3,'<u2')
        mask=Image.new('L',(512,512));draw=ImageDraw.Draw(mask)
        for ids in tri:draw.polygon([tuple(point) for point in uv[ids]],fill=255)
        return mask
    protected=np.asarray(footprint('head').filter(ImageFilter.MaxFilter(5)))>0
    body=np.asarray(footprint('body'))>0
    allowed=body&~protected
    allowed[448:]=False # Authored ball, armor and cloth strips stay exact.
    median=np.asarray(Image.fromarray(source).filter(ImageFilter.MedianFilter(3)))
    contrast=np.abs(source[:,:,:3].astype(int)-median[:,:,:3].astype(int))
    rgb=source[:,:,:3].astype(float)
    # Preserve small intentional gold buttons, red gems and colored details.
    detail=(rgb[:,:,0]>130)&((rgb[:,:,0]>rgb[:,:,1]*1.5)|((rgb[:,:,0]>rgb[:,:,2]*1.3)&(rgb[:,:,1]>rgb[:,:,2]*1.3)))
    suspects=allowed&~detail&(contrast.max(2)>42)&(contrast.sum(2)>90)
    seen=np.zeros((512,512),bool);pixels=[]
    for y,x in zip(*np.where(suspects)):
        if seen[y,x]:continue
        stack=[(int(y),int(x))];seen[y,x]=True;component=[]
        while stack:
            cy,cx=stack.pop();component.append((cy,cx))
            for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
                yy,xx=cy+dy,cx+dx
                if 0<=yy<512 and 0<=xx<512 and suspects[yy,xx] and not seen[yy,xx]:
                    seen[yy,xx]=True;stack.append((yy,xx))
        if len(component)<=6 and np.ptp(np.asarray(component),axis=0).max()<=5:pixels.extend(component)
    rgba=source.copy()
    if pixels:
        yy,xx=np.asarray(pixels).T
        rgba[yy,xx]=median[yy,xx]
    assert np.array_equal(rgba[protected],source[protected])
    result['palette']=base64.b64encode(rgba.tobytes()).decode()
    result['surfacePolish']={'revision':13,'method':'isolated outfit fleck cleanup with protected head footprint','headSamplingTexelsUnchanged':True,'cleanedOutfitTexels':len(pixels),'trianglesRemoved':0}
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args()
    result=clean_source_atlas(json.loads(args.source.read_text()))
    args.output.write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    print(json.dumps(result['surfacePolish']))
