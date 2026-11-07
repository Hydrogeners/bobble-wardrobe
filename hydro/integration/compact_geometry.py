"""Lossless transport for quality JSON's 1/16384-grid attributes.

No triangles are removed. Byte-plane ordering improves gzip compression.
Runtime meshes still use the existing validated Float32 arrays.
"""
import base64
import copy
import struct

SCALE=16384

def compact(models):
    models=copy.deepcopy(models)
    for data in models.values():
        if not data.get('qualityGeometry'):continue
        data['geometryEncoding']='signed16-byteplanes-16384'
        for part in data['parts'].values():
            for key in ['position','normal','uv']:
                raw=base64.b64decode(part[key])
                floats=struct.unpack('<'+'f'*(len(raw)//4),raw)
                numbers=[round(x*SCALE) for x in floats]
                assert all(-32768<=x<=32767 for x in numbers)
                encoded=struct.pack('<'+'h'*len(numbers),*numbers)
                part[key]=base64.b64encode(encoded[::2]+encoded[1::2]).decode()
    return models
