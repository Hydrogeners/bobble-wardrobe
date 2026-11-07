"""Complete rolling sphere with source-atlas UV transfer, geometry only."""
import bpy
import bmesh
import math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

def complete_base(source):
    source.calc_loop_triangles()
    vertices=[v.co.copy() for v in source.vertices]
    # Exclude cut-plane caps: their synthesized UVs are not artwork.
    triangles=[t for t in source.loop_triangles if max(vertices[i].z for i in t.vertices)-min(vertices[i].z for i in t.vertices)>1e-6]
    assert triangles and source.uv_layers.active
    tree=BVHTree.FromPolygons(vertices,[tuple(t.vertices) for t in triangles],all_triangles=True)
    bm=bmesh.new()
    bmesh.ops.create_uvsphere(bm,u_segments=48,v_segments=24,radius=.45)
    for v in bm.verts:v.co.z+=.5
    uv=bm.loops.layers.uv.new('Generated atlas UV')
    for face in bm.faces:
        coords=[]
        for loop in face.loops:
            p=loop.vert.co
            coords.append((math.atan2(p.x,-p.y)/math.tau+.5,math.asin(max(-1,min(1,(p.z-.5)/.45)))/math.pi+.5))
        crosses=max(u for u,v in coords)-min(u for u,v in coords)>.5
        for loop,(u,v) in zip(face.loops,coords):loop[uv].uv=(u+1 if crosses and u<.5 else u,v)
    # Bake once to a new continuous spherical atlas. Directly interpolating
    # source-atlas coordinates across generated triangles crosses UV islands.
    material=source.materials[0]
    shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    image=shader.inputs['Base Color'].links[0].from_node.image
    width,height=image.size
    pixels=np.empty(width*height*4,dtype=np.float32);image.pixels.foreach_get(pixels)
    pixels=pixels.reshape(height,width,4)
    baked=np.zeros((128,64,4),dtype=np.float32)
    for iy in range(128):
        lat=((iy+.5)/128-.5)*math.pi
        for ix in range(64):
            theta=((ix+.5)/64-.5)*math.tau
            query=Vector((.45*math.sin(theta)*math.cos(lat),-.45*math.cos(theta)*math.cos(lat),min(.675,.5+.45*math.sin(lat))))
            point,normal,index,distance=tree.find_nearest(query)
            triangle=triangles[index]
            points=[vertices[i] for i in triangle.vertices]
            uvs=[Vector((*source.uv_layers.active.data[i].uv,0)) for i in triangle.loops]
            result=barycentric_transform(point,*points,*uvs)
            x=max(0,min(width-1,int(result.x*width)));y=max(0,min(height-1,int(result.y*height)))
            baked[iy,ix]=pixels[y,x]
    texture=bpy.data.images.new(source.name+'_sphere_color',width=64,height=128,alpha=True)
    texture.pixels.foreach_set(baked.ravel());texture.pack()
    sphere_material=bpy.data.materials.new(source.name+'_sphere_material');sphere_material.use_nodes=True
    shader=next(n for n in sphere_material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=sphere_material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=texture
    sphere_material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value=.75
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    mesh=bpy.data.meshes.new(source.name+'_complete_sphere')
    bm.to_mesh(mesh);bm.free()
    mesh.materials.append(sphere_material)
    for p in mesh.polygons:p.use_smooth=True
    return mesh
