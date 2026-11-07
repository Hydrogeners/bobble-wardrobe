"""Original armless bobble, including the previously omitted rolling lower base.
No game geometry/textures are imported into this asset. Blender 4.5 background.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parent
ASSETS=OUT/'assets';ASSETS.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)

def linear(code):
    values=[int(code[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)

def material(name,code,rough=.72,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*linear(code),1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    bs.inputs['Specular IOR Level'].default_value=.28
    m.diffuse_color=(*linear(code),1);return m

M={k:material(*args) for k,args in {
 'skin':('Warm peach','F0B68A',.75), 'skinShade':('Ear and neck peach','DFA079',.78),
 'hair':('Soft black hair','151719',.76), 'hairLight':('Subtle charcoal strand relief','25282C',.77),
 'cap':('Chestnut cap','754027',.85), 'capLight':('Cap lit panel','80472C',.87),
 'capDark':('Cap seam and band','60321E',.85), 'coat':('Brown coat body','793D23',.82),
 'coatLight':('Folded brown lapels','8B492A',.8), 'coatDark':('Coat facing and hem','522817',.85),
 'white':('Ivory collar and shirt','ECEBE6',.73), 'whiteShade':('Collar fold','BFC1BD',.78),
 'vest':('Charcoal waistcoat','282A2C',.85), 'vestLight':('Waistcoat lapel','35373A',.82),
 'tie':('Lavender tie','AAA0C1',.65), 'tieLight':('Tie silk ridge','BEB4D3',.64),
 'tieDark':('Tie side fold','877B9A',.75), 'frame':('Black acetate glasses','181A1C',.4),
 'lens':('Pale silver lenses','CAD4D6',.28,.18), 'glint':('Lens reflection','F5F8F6',.33),
 'ink':('Brows and smirk','3E2A20',.8),
}.items()}
objects=[];heads=[]
def finish(o,name,mat,head=False,smooth=True):
    o.name=name;o.data.materials.append(M[mat])
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=smooth
    objects.append(o)
    if head:heads.append(o)
    return o

def mesh(name,verts,faces,mat,head=False,smooth=True):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(d);bm.free()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    return finish(o,name,mat,head,smooth)

def ellipsoid(name,loc,scale,mat,head=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=loc)
    o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,head)

def curve(name,points,mat,radius=.009,head=False):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=16
    s=d.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    d.bevel_depth=radius;d.bevel_resolution=2
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,mat,head)

def interp(points,t):
    i=min(len(points)-2,int(t));u=t-i
    a=Vector(points[max(0,i-1)]);b=Vector(points[i]);c=Vector(points[i+1]);d=Vector(points[min(len(points)-1,i+2)])
    return .5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)

def radii(profile,z):
    z=max(profile[0][0],min(profile[-1][0],z));lo=0.;hi=len(profile)-1.
    for _ in range(18):
        t=(lo+hi)/2
        if interp(profile,t).x<z:lo=t
        else:hi=t
    _,rx,ry=interp(profile,(lo+hi)/2);return rx,ry

def lathe(name,profile,mat,head=False,center=.03,rows=56,segments=64):
    verts=[];faces=[]
    for j in range(rows):
        z,rx,ry=interp(profile,(len(profile)-1)*j/(rows-1))
        for k in range(segments):
            a=math.tau*k/segments;verts.append((rx*math.sin(a),center-ry*math.cos(a),z))
    for j in range(rows-1):
        for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((rows-1)*segments+k for k in range(segments))])
    return mesh(name,verts,faces,mat,head)

# These profiles describe ONLY the upper torso. The complete official assembly
# also has BALL_GEO at Y=.5, bounds about [-.5,.5], which v2 omitted incorrectly.
# Keep the approved head/hair; shift the upper assembly onto a separate base.
BODY=[(.035,1.055,1.03),(.09,1.09,1.065),(.25,1.14,1.115),(.45,1.10,1.075),(.75,.94,.92),(1.02,.72,.70),(1.20,.48,.47),(1.285,.24,.24)]
HEAD=[(1.115,.04,.05),(1.20,.36,.37),(1.38,.66,.59),(1.67,.86,.76),(2.03,.98,.85),(2.38,.94,.82),(2.69,.77,.68),(2.93,.44,.41),(3.055,.025,.025)]
body=lathe('Coat · single armless flared body',BODY,'coat')
head=lathe('Head · organic rounded cheeks and skull',HEAD,'skin',True,rows=64)
lathe('Coat · integrated bottom hem',[(.028,1.04,1.015),(.055,1.075,1.05),(.125,1.105,1.08),(.15,1.115,1.09)],'coatDark',rows=12)

def front(x,z,offset=.025,profile=BODY):
    rx,ry=radii(profile,z)
    return .03-ry*math.sqrt(max(.01,1-(min(abs(x)/max(rx,.001),.995))**2))-offset

def face(x,z,offset=.025):return front(x,z,offset,HEAD)

def patch(name,outline,mat,surface=front,offset=.025,head=False,thickness=.012,smooth=True):
    o=mesh(name,[(x,0,z) for x,z in outline],[tuple(range(len(outline)))],mat,head,smooth)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=bm.faces)
    for _ in range(3):bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=1,use_grid_fill=True)
    for v in bm.verts:v.co.y=surface(v.co.x,v.co.z,offset)
    bm.to_mesh(o.data);bm.free()
    if thickness:
        solid=o.modifiers.new('Thin surface thickness','SOLIDIFY');solid.thickness=thickness
    return o

# Tailoring follows the same single flared body, as on actual bobbles.
patch('Vest · curved front',[(-.29,1.19),(.29,1.19),(.44,.34),(0,.20),(-.44,.34)],'vest',offset=.031)
patch('Shirt · small ivory opening',[(-.23,1.23),(.23,1.23),(.10,.94),(0,.86),(-.12,.94)],'white',offset=.056)
for side in [-1,1]:
    mirror=lambda ps:[(side*x,z) for x,z in ps]
    patch('Coat · flush lapel '+str(side),mirror([(.27,1.20),(.43,1.17),(.68,1.03),(.81,.79),(.64,.83),(.51,.70),(.35,.92)]),'coatLight',offset=.072)
    patch('Coat · open front facing '+str(side),mirror([(.26,1.12),(.36,.96),(.46,.65),(.50,.34),(.40,.24),(.32,.39),(.31,.76)]),'coatDark',offset=.057)
    patch('Vest · narrow lower ivory piping '+str(side),mirror([(.02,.21),(.39,.30),(.43,.40),(.37,.36),(.02,.26)]),'whiteShade',offset=.063,thickness=.008)
    curve('Coat · clean front opening '+str(side),[(side*x,front(side*x,z,.086),z) for x,z in [(.29,1.07),(.35,.83),(.43,.53),(.43,.30)]],'coatDark',.008)
curve('Coat · center back seam',[(0,.06-front(0,z,.008),z) for z in [1.16,.96,.72,.42,.19]],'coatDark',.006)
patch('Tie · lavender neck fold',[(-.18,1.08),(0,.94),(.18,1.08),(.13,.96),(0,.84),(-.13,.96)],'tieDark',offset=.082)
patch('Tie · tapered lavender tail',[(-.065,.92),(.062,.92),(.12,.36),(0,.25),(-.12,.35)],'tie',offset=.092)
patch('Tie · silk ridge',[(-.05,.87),(-.017,.88),(.015,.31),(0,.25),(-.045,.30)],'tieLight',offset=.107,thickness=.006)
patch('Tie · folded knot',[(-.115,1.015),(.11,1.015),(.083,.895),(-.052,.878),(-.108,.94)],'tie',offset=.117)

# Collar is a shallow sculpted wrap, not floating arm-shaped shoulder pieces.
def collar_front(x,z,offset=.0):
    return -.58+.15*abs(x)+.18*(z-1.25)-offset
for side in [-1,1]:
    ps=[(side*x,z) for x,z in [(.13,1.08),(.20,1.43),(.56,1.57),(.70,1.32),(.48,1.17)]]
    patch('Collar · raised ivory wing '+str(side),ps,'white',collar_front,.04,thickness=.035,smooth=False)
curve('Collar · round back roll',[(-.60,.08,1.27),(-.40,.43,1.31),(0,.53,1.32),(.40,.43,1.31),(.60,.08,1.27)],'whiteShade',.065)

# Organic scalp follows the rounded skull, with a different hairline at front,
# temples and nape. This is NOT a cube, paired earmuff masses, or a full helmet.
verts=[];faces=[];segments=96;rows=32
for j in range(rows):
    t=j/(rows-1)
    for k in range(segments):
        a=math.tau*k/segments;back=(1-math.cos(a))*.5
        low=2.62-.96*back+.025*math.sin(7*a)+.018*math.sin(11*a)
        z=low+(3.058-low)*t;rx,ry=radii(HEAD,min(z,3.05))
        taper=math.sin(math.pi*t)*.012
        verts.append(((rx+.027+taper)*math.sin(a),.03-(ry+.032+taper)*math.cos(a),z))
for j in range(rows-1):
    for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
scalp=mesh('Hair · curved continuous scalp with tapered nape',verts,faces,'hair',True)
solid=scalp.modifiers.new('Fine hairline edge','SOLIDIFY');solid.thickness=.014

def lock(name,xz,widths,mat='hair',offset=.060):
    verts=[];faces=[];steps=(len(xz)-1)*9;ring=12
    points=[(x,face(x,z,offset),z) for x,z in xz]
    for j in range(steps+1):
        t=(len(points)-1)*j/steps;p=interp(points,t);i=min(len(widths)-2,int(t));u=t-i
        w=max(.002,widths[i]*(1-u)+widths[i+1]*u)
        tangent=(interp(points,min(len(points)-1,t+.008))-interp(points,max(0,t-.008))).normalized()
        across=Vector((tangent.z,0,-tangent.x)).normalized()
        for k in range(ring):
            a=math.tau*k/ring;v=p+across*(math.cos(a)*w)+Vector((0,math.sin(a)*w*.20,0));verts.append(tuple(v))
    for j in range(steps):
        for k in range(ring):faces.append((j*ring+k,j*ring+(k+1)%ring,(j+1)*ring+(k+1)%ring,(j+1)*ring+k))
    faces.extend([tuple(range(ring-1,-1,-1)),tuple(steps*ring+k for k in range(ring))])
    return mesh(name,verts,faces,mat,True)

lock('Hair · asymmetric long swept fringe',[(-.57,2.87),(-.50,2.68),(-.20,2.39),(.15,2.08)],[.14,.19,.14,.002],offset=.075)
lock('Hair · layered upper sweep',[(-.26,2.94),(-.08,2.77),(.20,2.55),(.43,2.31)],[.13,.16,.12,.002],offset=.067)
lock('Hair · short parting lock',[(-.77,2.73),(-.72,2.52),(-.55,2.31)],[.09,.11,.002],offset=.065)
lock('Hair · fine swept strand',[(-.51,2.76),(-.34,2.54),(-.08,2.30)],[.012,.016,.001],'hairLight',offset=.119)
for side in [-1,1]:
    lock('Hair · tapered temple wisp '+str(side),[(side*.78,2.60),(side*.89,2.36),(side*.86,2.14)],[.09,.065,.002],offset=.044)
    ellipsoid('Ear · small rounded form '+str(side),(side*.93,.005,1.97),(.095,.13,.18),'skinShade',True)
for i,a in enumerate([1.58,1.96,2.38,2.80,3.22,3.64,4.06,4.48,4.73]):
    pts=[];low=2.62-.96*(1-math.cos(a))*.5
    for t in [0,.32,.67,1]:
        z=2.78+(low+.08-2.78)*t;angle=a+.10*math.sin(math.pi*t);rx,ry=radii(HEAD,z)
        pts.append(((rx+.038)*math.sin(angle),.03-(ry+.043)*math.cos(angle),z))
    curve('Hair · curved rear strand '+str(i),pts,'hairLight',.005,True)

# Cap reduced from v2's over-inflated 1.16 vertical multiplier; brim unchanged.
CAP=[(2.77,.94,.81),(2.88,1.065,.92),(3.06,1.10,.97),(3.28,.99,.88),(3.48,.72,.68),(3.62,.36,.35),(3.67,.025,.025)]
verts=[];faces=[];rows=48;segments=72
def cap_point(z,rx,ry,a,push=0):
    return ((rx+push)*math.sin(a)-.095*(z-2.77),.025-(ry+push)*math.cos(a),z+.035*math.sin(a))
for j in range(rows):
    z,rx,ry=interp(CAP,(len(CAP)-1)*j/(rows-1))
    for k in range(segments):verts.append(cap_point(z,rx,ry,math.tau*k/segments))
for j in range(rows-1):
    for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
faces.extend([tuple(range(segments-1,-1,-1)),tuple((rows-1)*segments+k for k in range(segments))])
cap=mesh('Cap · fuller rounded paneled crown',verts,faces,'cap',True)
cap.data.materials.append(M['capLight']);cap.data.materials.append(M['capDark'])
for j in range(rows-1):
    for k in range(segments):cap.data.polygons[j*segments+k].material_index=[0,1,0,0,0,1,0,0][k//9]
for i in range(8):
    a=math.tau*i/8;pts=[cap_point(z,rx,ry,a,.006) for z,rx,ry in CAP[1:-1]]
    curve('Cap · fine panel seam '+str(i),pts,'capDark',.005,True)
curve('Cap · lower stitched band',[cap_point(2.785,.95,.82,math.tau*k/48,.004) for k in range(49)],'capDark',.018,True)
verts=[];faces=[];n=40
for outer in [0,1]:
    for k in range(n+1):
        a=-1.15+2.30*k/n;rx=.94 if not outer else 1.035;ry=.81 if not outer else 1.045
        verts.append((rx*math.sin(a),.025-ry*math.cos(a),2.79-.075*outer*math.cos(a)+.035*math.sin(a)))
for k in range(n):faces.append((k,k+1,n+2+k,n+1+k))
brim=mesh('Cap · gently curved short brim',verts,faces,'cap',True);solid=brim.modifiers.new('Brim thickness','SOLIDIFY');solid.thickness=.033
ellipsoid('Cap · small covered button',(-.085,.025,3.675),(.05,.05,.022),'capDark',True)

# Frames and lenses conform to the curved face instead of requiring a flat head.
def frame(name,outline):
    cx=sum(x for x,z in outline)/4;cz=sum(z for x,z in outline)/4
    inner=[(cx+(x-cx)*.84,cz+(z-cz)*.77) for x,z in outline]
    for i in range(4):
        j=(i+1)%4;patch(name+' · rim '+str(i),[outline[i],outline[j],inner[j],inner[i]],'frame',face,.13,True,.028)
    patch(name+' · silver lens',inner,'lens',face,.121,True,.009)
    x0,z0=inner[0];x1,z1=inner[1];x2,z2=inner[2];x3,z3=inner[3]
    patch(name+' · diagonal soft reflection',[(x0+.035,z0+.025),(x0+.082,z0+.025),(x2-.045,z2-.020),(x2-.10,z2-.020)],'glint',face,.137,True,.003)
frame('Glasses · left',[(-.79,2.01),(-.80,2.38),(-.12,2.33),(-.13,1.98)])
frame('Glasses · right',[(.13,1.98),(.12,2.33),(.80,2.38),(.79,2.01)])
curve('Glasses · bridge',[(x,face(x,z,.143),z) for x,z in [(-.13,2.29),(0,2.31),(.13,2.29)]],'frame',.019,True)
for side in [-1,1]:
    curve('Glasses · thin temple '+str(side),[(side*.79,face(side*.79,2.28,.13),2.28),(side*.94,-.25,2.25),(side*.95,.05,2.16)],'frame',.017,True)
    curve('Face · eyebrow '+str(side),[(side*x,face(side*x,z,.017),z) for x,z in [(.25,2.48),(.51,2.53),(.73,2.56)]],'ink',.010,True)
# Reference: a fine closed smile, almost level on the left, rising on the right.
curve('Face · closed asymmetric smile',[(x,face(x,z,.026),z) for x,z in [(-.31,1.68),(-.16,1.675),(0,1.685),(.17,1.715),(.31,1.75),(.34,1.78)]],'ink',.0065,True)
for side in [-1,1]:
    ellipsoid('Glasses · hinge stud '+str(side),(side*.765,face(side*.765,2.30,.155),2.30),(.024,.014,.024),'glint',True)
    for i,stroke in enumerate([[ (.51,1.05),(.69,.99),(.85,.91)],[(.55,.92),(.72,.85),(.88,.81)],[(.63,.75),(.80,.70),(.96,.60)]]):
        curve('Cape · draped fold '+str(side)+' '+str(i),[(side*x,front(side*x,z,.024),z) for x,z in stroke],'coatDark',.006)

# Restore the part absent from the earlier reference, using newly authored
# geometry, not a copied game mesh. Its separate pivot can later follow the
# original rolling visual independently of the upper body/head.
UPPER_OFFSET=1.05645
for o in objects:o.location.z+=UPPER_OFFSET
lower_base=ellipsoid('Base · separate rounded rolling lower section',(0,.03,1.0),(1.0,.98,1.0),'coat')

# Cosmetic-only anchors, no arm objects, bones, scripts or game components.
root=bpy.data.objects.new('HYDRO_Bobble',None);bpy.context.collection.objects.link(root)
body_root=bpy.data.objects.new('BodyRoot',None);bpy.context.collection.objects.link(body_root);body_root.parent=root
head_root=bpy.data.objects.new('HeadRoot',None);bpy.context.collection.objects.link(head_root);head_root.parent=root;head_root.location=(0,0,1.20+UPPER_OFFSET)
base_root=bpy.data.objects.new('BaseRoot',None);bpy.context.collection.objects.link(base_root);base_root.parent=root;base_root.location=(0,0,1.0)
bpy.context.view_layer.update()
for o in objects:
    world=o.matrix_world.copy();o.parent=base_root if o==lower_base else head_root if o in heads else body_root;o.matrix_world=world
root['revision']=3;root['cosmetic_only']=True;root['reference']='Complete assembly study includes BALL_GEO lower base, upper torso and head. All custom geometry original; unseen sides inferred.'
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
    for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
    o.select_set(False)
model_objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in model_objects+[root,body_root,head_root,base_root]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'hydro-bobble.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=False)

# Studio, not part of GLB export. Same neutral presentation, more useful profile.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Neutral studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(*linear('D8D9DD'),1);world.node_tree.nodes['Background'].inputs[1].default_value=.32;scene.world=world
ground=material('Studio ground','DDDEE1',.85)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.023));bpy.context.object.name='STUDIO_ground';bpy.context.object.data.materials.append(ground)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size in [('Key',(-3.4,-4.5,7),500,4),('Fill',(3.7,-2,4),260,3.5),('Rim',(1,3,6),420,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;aim(o,(0,0,2.3))
d=bpy.data.cameras.new('Portrait camera');camera=bpy.data.objects.new('Portrait camera',d);bpy.context.collection.objects.link(camera);scene.camera=camera;d.type='ORTHO';d.ortho_scale=5.4
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
camera.location=(4.5,-10,5.1);aim(camera,(0,0,2.37))
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/'hydro-bobble.blend'))
views={'front':(0,-10,4.3),'three-quarter':(5,-10,5.1),'back':(4,10,4.9),'profile':(10,0,3.9)}
for name,loc in views.items():
    camera.location=loc;aim(camera,(0,0,2.37));scene.render.filepath=str(ASSETS/(name+'.png'));bpy.ops.render.render(write_still=True)
metadata={'name':'HYDRO bobble','revision':3,'meshes':len(model_objects),'triangles':sum(len(p.vertices)-2 for o in model_objects for p in o.data.polygons),'materials':len(M),'armless':True,'complete_lower_base':True,'head_construction':'unchanged organic rounded head from approved v2','hair_construction':'unchanged curved scalp and tapered asymmetric locks','upper_torso_only_height_width':(1.285-.035)/(2*1.14),'full_body_height_width':(1.285+UPPER_OFFSET)/(2*1.14),'bare_core_height_width':(3.055+UPPER_OFFSET)/(2*1.14),'bare_head_height_width':(3.055-1.115)/(2*.98),'cap_profile_crown_height':.9,'separate_base_body_head':True,'game_assets_in_export':False,'unseen_sides_inferred':True,'installed_in_discord':False}
(ASSETS/'model.json').write_text(json.dumps(metadata,indent=2));print('MODEL_RESULT '+json.dumps(metadata))
