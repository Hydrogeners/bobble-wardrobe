"""Offline, non-destructive Meshy -> three-root Wardrobe conversion.

Run with Blender -b -P fit_meshy.py -- SOURCE.blend OUTPUT_DIRECTORY.
The source file is never saved or overwritten. Cut landmarks are normalized
reference-art proportions, not collider measurements. Geometry only.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
from rolling_base import complete_base

arguments=sys.argv[sys.argv.index('--') + 1:]
source, output = map(Path, arguments[:2])
preserve_topology=True  # The old collapsing/welding conversion is retired.
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
specs = {
    'miko': (.245, .585), 'hydro': (.205, .585),
    'flair': (.235, .585), 'spark': (.245, .590),
    'todo': (.255, .590), 'jjcho': (.245, .590),
    'augusto': (.145, .595), 'supa': (.250, .585),
    'duolingo': (.245, .570),
}
report = {}
originals = {o.name.split('_')[0].lower(): o for o in bpy.context.scene.objects if '_Meshy_' in o.name}
assert set(specs) <= set(originals), 'Source must contain all nine generated studies'
for name, (base_cut, head_cut) in specs.items():
    original = originals[name]
    bpy.ops.object.select_all(action='DESELECT')
    work = bpy.data.objects.new(name + '_working', original.data.copy())
    bpy.context.collection.objects.link(work)
    work.matrix_world = original.matrix_world.copy()
    work.select_set(True)
    bpy.context.view_layer.objects.active = work
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = work.data
    lo = Vector(tuple(min(v.co[i] for v in mesh.vertices) for i in range(3)))
    hi = Vector(tuple(max(v.co[i] for v in mesh.vertices) for i in range(3)))
    height = hi.z-lo.z
    center = (lo+hi)*.5
    # One continuous transform: never stretch face/clothing bands separately.
    for v in mesh.vertices:
        t = (v.co.z-lo.z)/height
        z = .05 + 2.10*t
        v.co = ((v.co.x-center.x)/height, (v.co.y-center.y)/height, z)
    radial = max(math.hypot(v.co.x,v.co.y) for v in mesh.vertices)
    for v in mesh.vertices:
        v.co.x *= .49/radial
        v.co.y *= .49/radial
    before = len(mesh.polygons)
    # Do not weld coincident source vertices: Meshy splits texture islands there.
    # Export original topology; simplify-quality.mjs performs attribute-aware,
    # index-only simplification after segmentation without moving vertices.
    root = bpy.data.objects.new(name.upper()+'_Wardrobe',None)
    bpy.context.collection.objects.link(root)
    root['cosmetic_only'] = True
    root['reference_landmarks'] = [base_cut,head_cut]
    parts=[]
    for kind, low, high, origin in [
        ('base', -1, .68, (0,0,.5)),
        ('body', .68, 1.20, (0,0,.5)),
        ('head', 1.20, 4, (-.0081176618,-.0849103183,1.2548877001)),
    ]:
        bm=bmesh.new(); bm.from_mesh(work.data)
        for cut, below in [(low,True),(high,False)]:
            if cut in (-1,4):continue
            result=bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                plane_co=(0,0,cut),plane_no=(0,0,1),dist=1e-7,
                clear_inner=below,clear_outer=not below)
            edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut)<1e-5 for v in e.verts)]
            if edges:
                filled=bmesh.ops.holes_fill(bm,edges=edges,sides=0)['faces']
                uv=bm.loops.layers.uv.active
                if uv:
                    for f in filled:
                        for loop in f.loops:
                            neighbors=[l for l in loop.vert.link_loops if l.face not in filled]
                            if neighbors:loop[uv].uv=neighbors[0][uv].uv
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        # Preserve original triangle orientation. Meshy's UV-island components
        # are open; recalc_face_normals can invert entire patches independently,
        # causing visible holes under back-face culling and crumpled shading.
        data=bpy.data.meshes.new(name+'_'+kind);bm.to_mesh(data);bm.free()
        assert len(data.polygons)>0, (name,kind)
        for material in original.data.materials:data.materials.append(material)
        if kind=='base':data=complete_base(data)
        anchor=bpy.data.objects.new(kind.title()+'Root',None)
        bpy.context.collection.objects.link(anchor);anchor.parent=root;anchor.location=origin
        obj=bpy.data.objects.new(name+'_'+kind,data)
        bpy.context.collection.objects.link(obj);obj.parent=anchor
        for vertex in data.vertices:vertex.co-=Vector(origin)
        for polygon in data.polygons:polygon.use_smooth=True
        parts.extend([anchor,obj])
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*parts]:obj.hide_set(False);obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output/(name+'-wardrobe.glb')),export_format='GLB',
        use_selection=True,export_yup=True,export_animations=False,export_extras=True)
    stats={o.name.rsplit('_',1)[-1]:len(o.data.polygons) for o in parts if o.type=='MESH'}
    report[name]={'sourceTriangles':before,'triangles':stats,'totalTriangles':sum(stats.values()),
                  'visualRadius':.49,'baseSeam':.68,'headSeam':1.2,'totalHeight':2.15,'completeRollingSphereRadius':.45,
                  'quality':'Original topology for attribute-aware offline simplification' if preserve_topology else '60000 triangle target; no source weld; continuous height transform',
                  'warning':'Bug visual rest dimensions only; collider dimensions are unmeasured'}
    for obj in [work,*parts,root]:bpy.data.objects.remove(obj,do_unlink=True)
    print('FITTED',name,report[name]['totalTriangles'],flush=True)
(output/'fit-report.json').write_text(json.dumps(report,indent=2))
