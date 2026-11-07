"""Original NEBULA bobble, authored from the supplied character reference.

No game geometry or textures are imported. Blender 4.5 background.
The silhouette keeps the approved Hydro rig proportions so native attachment,
preview pivots, and the rolling base stay compatible.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ASSETS = OUT / 'assets'
ASSETS.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)

def linear(code):
    values = [int(code[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)

def material(name, code, rough=.72, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*linear(code), 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Specular IOR Level'].default_value = .28
    m.diffuse_color = (*linear(code), 1)
    return m

M = {k: material(*args) for k, args in {
    'skin': ('Light peach skin', 'F2C39B', .75),
    'skinShade': ('Warm ear and neck shade', 'E0A87E', .78),
    'hair': ('Leaf green hair', '3FAE3A', .76),
    'hairLight': ('Bright green hair strands', '67C95A', .77),
    'hairDark': ('Deep green hair shadow', '2C7F2A', .80),
    'cap': ('Black cap crown', '161616', .55),
    'capLight': ('Silver white cap panel', 'D9D9D9', .60),
    'capDark': ('Black cap band and seams', '0B0B0B', .55),
    'jacket': ('Green field jacket', '55B93C', .78),
    'jacketLight': ('Lit green lapels', '7DD45F', .76),
    'jacketDark': ('Deep green jacket seams', '2F7A26', .82),
    'shirt': ('Black undershirt', '101010', .85),
    'shirtLight': ('Undershirt fold', '262626', .82),
    'white': ('Base white', 'F2F2EE', .72),
    'whiteShade': ('Base soft shade', 'D0D0CC', .78),
    'gold': ('Gold leaf', 'D8B25C', .45, .25),
    'goldLight': ('Gold leaf highlight', 'EAD08A', .40, .30),
    'eyeWhite': ('Eye white', 'F7F7F2', .55),
    'iris': ('Teal iris', '2FB7B0', .35),
    'irisDark': ('Deep teal iris', '1C7F7A', .40),
    'pupil': ('Pupil', '0A0A0A', .35),
    'ink': ('Brows and smile', '1A1A1A', .80),
    'flower': ('Cream flower petals', 'F2E2A6', .70),
    'flowerCenter': ('Flower center', 'E0B84C', .60),
    'pendant': ('Black planet pendant', '1A1A1A', .35, .20),
    'ring': ('Blue planet ring', '2E9BD6', .35, .35),
    'ringLight': ('Ring highlight', '63C4F0', .30, .40),
    'cord': ('Necklace cord', '141414', .75),
}.items()}

objects = []
heads = []

def finish(o, name, mat, head=False, smooth=True):
    o.name = name
    o.data.materials.append(M[mat])
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = smooth
    objects.append(o)
    if head:
        heads.append(o)
    return o

def mesh(name, verts, faces, mat, head=False, smooth=True):
    d = bpy.data.meshes.new(name)
    d.from_pydata(verts, [], faces)
    d.update()
    bm = bmesh.new()
    bm.from_mesh(d)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(d)
    bm.free()
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, head, smooth)

def ellipsoid(name, loc, scale, mat, head=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, head)

def petal(name, loc, scale, rot, mat, head=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=loc)
    o = bpy.context.object
    o.scale = scale
    o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(o, name, mat, head)

def curve(name, points, mat, radius=.009, head=False):
    d = bpy.data.curves.new(name, 'CURVE')
    d.dimensions = '3D'
    d.resolution_u = 16
    s = d.splines.new('BEZIER')
    s.bezier_points.add(len(points) - 1)
    for p, co in zip(s.bezier_points, points):
        p.co = co
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    d.bevel_depth = radius
    d.bevel_resolution = 2
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    return finish(o, name, mat, head)

def interp(points, t):
    i = min(len(points) - 2, int(t))
    u = t - i
    a = Vector(points[max(0, i - 1)])
    b = Vector(points[i])
    c = Vector(points[i + 1])
    d = Vector(points[min(len(points) - 1, i + 2)])
    return .5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)

def radii(profile, z):
    z = max(profile[0][0], min(profile[-1][0], z))
    lo = 0.
    hi = len(profile) - 1.
    for _ in range(18):
        t = (lo + hi) / 2
        if interp(profile, t).x < z:
            lo = t
        else:
            hi = t
    _, rx, ry = interp(profile, (lo + hi) / 2)
    return rx, ry

def lathe(name, profile, mat, head=False, center=.03, rows=56, segments=64):
    verts = []
    faces = []
    for j in range(rows):
        z, rx, ry = interp(profile, (len(profile) - 1) * j / (rows - 1))
        for k in range(segments):
            a = math.tau * k / segments
            verts.append((rx * math.sin(a), center - ry * math.cos(a), z))
    for j in range(rows - 1):
        for k in range(segments):
            faces.append((j * segments + k, j * segments + (k + 1) % segments, (j + 1) * segments + (k + 1) % segments, (j + 1) * segments + k))
    faces.extend([tuple(range(segments - 1, -1, -1)), tuple((rows - 1) * segments + k for k in range(segments))])
    return mesh(name, verts, faces, mat, head)

BODY = [(.035, 1.055, 1.03), (.09, 1.09, 1.065), (.25, 1.14, 1.115), (.45, 1.10, 1.075), (.75, .94, .92), (1.02, .72, .70), (1.20, .48, .47), (1.285, .24, .24)]
HEAD = [(1.115, .04, .05), (1.20, .36, .37), (1.38, .66, .59), (1.67, .86, .76), (2.03, .98, .85), (2.38, .94, .82), (2.69, .77, .68), (2.93, .44, .41), (3.055, .025, .025)]
body = lathe('Jacket · single armless flared body', BODY, 'jacket')
head = lathe('Head · organic rounded cheeks and skull', HEAD, 'skin', True, rows=64)
lathe('Jacket · integrated bottom hem', [(.028, 1.04, 1.015), (.055, 1.075, 1.05), (.125, 1.105, 1.08), (.15, 1.115, 1.09)], 'jacketDark', rows=12)

def front(x, z, offset=.025, profile=BODY):
    rx, ry = radii(profile, z)
    return .03 - ry * math.sqrt(max(.01, 1 - (min(abs(x) / max(rx, .001), .995)) ** 2)) - offset

def face(x, z, offset=.025):
    return front(x, z, offset, HEAD)

def patch(name, outline, mat, surface=front, offset=.025, head=False, thickness=.012, smooth=True):
    o = mesh(name, [(x, 0, z) for x, z in outline], [tuple(range(len(outline)))], mat, head, smooth)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for _ in range(3):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
    for v in bm.verts:
        v.co.y = surface(v.co.x, v.co.z, offset)
    bm.to_mesh(o.data)
    bm.free()
    if thickness:
        solid = o.modifiers.new('Thin surface thickness', 'SOLIDIFY')
        solid.thickness = thickness
    return o

def ellipse(cx, cz, rx, rz, n=24):
    return [(cx + rx * math.cos(math.tau * i / n), cz + rz * math.sin(math.tau * i / n)) for i in range(n)]

# Jacket: green field shirt over a black undershirt, with a planet pendant.
patch('Jacket · black undershirt V', [(-.18, 1.17), (.18, 1.17), (.08, .79), (0, .73), (-.08, .79)], 'shirt', offset=.031)
for side in [-1, 1]:
    mirror = lambda ps: [(side * x, z) for x, z in ps]
    patch('Jacket · green lapel ' + str(side), mirror([(.17, 1.18), (.37, 1.11), (.54, .92), (.42, .86), (.29, 1.00), (.19, 1.09)]), 'jacketLight', offset=.052)
    patch('Jacket · front facing ' + str(side), mirror([(.23, 1.05), (.32, .82), (.38, .48), (.30, .34), (.25, .50), (.24, .82)]), 'jacketDark', offset=.057)
    patch('Jacket · chest pocket ' + str(side), mirror([(.30, 1.02), (.49, .98), (.47, .86), (.28, .90)]), 'jacketLight', offset=.044, thickness=.008)
    curve('Jacket · clean front seam ' + str(side), [(side * x, front(side * x, z, .085), z) for x, z in [(.24, 1.02), (.30, .76), (.35, .46), (.34, .31)]], 'jacketDark', .008)
curve('Jacket · center opening', [(0, front(0, z, .065), z) for z in [1.10, .92, .70, .48, .32]], 'jacketDark', .007)
curve('Jacket · center back seam', [(0, .06 - front(0, z, .008), z) for z in [1.16, .96, .72, .42, .19]], 'jacketDark', .006)

# Collar: green raised wings with a black inner neckline.
def collar_front(x, z, offset=.0):
    return -.58 + .15 * abs(x) + .18 * (z - 1.25) - offset
for side in [-1, 1]:
    ps = [(side * x, z) for x, z in [(.12, 1.07), (.20, 1.42), (.55, 1.55), (.70, 1.30), (.47, 1.16)]]
    patch('Collar · green raised wing ' + str(side), ps, 'jacketLight', collar_front, .04, thickness=.032, smooth=False)
curve('Collar · round back roll', [(-.60, .08, 1.27), (-.40, .43, 1.31), (0, .53, 1.32), (.40, .43, 1.31), (.60, .08, 1.27)], 'jacketDark', .060)
patch('Collar · black inner neckline', [(-.13, 1.08), (.13, 1.08), (.10, 1.28), (-.10, 1.28)], 'shirt', offset=.035)

# Necklace: thin black cord and a black planet with a blue ring.
curve('Necklace · cord', [(-.32, front(-.32, 1.18, .12), 1.18), (-.18, front(-.18, 1.02, .14), 1.02), (0, front(0, .93, .15), .93), (.18, front(.18, 1.02, .14), 1.02), (.32, front(.32, 1.18, .12), 1.18)], 'cord', .008)
pendant_y = front(0, .93, .17)
ellipsoid('Pendant · black planet', (0, pendant_y, .93), (.10, .055, .10), 'pendant')
bpy.ops.mesh.primitive_torus_add(major_radius=.145, minor_radius=.012, major_segments=40, minor_segments=8, location=(0, pendant_y - .005, .93), rotation=(math.radians(70), 0, math.radians(-22)))
ring = bpy.context.object
ring.scale = (1, 1, .72)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
finish(ring, 'Pendant · blue ring', 'ring')
bpy.ops.mesh.primitive_torus_add(major_radius=.145, minor_radius=.004, major_segments=40, minor_segments=6, location=(0, pendant_y - .011, .93), rotation=(math.radians(70), 0, math.radians(-22)))
ring_hi = bpy.context.object
ring_hi.scale = (1, 1, .72)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
finish(ring_hi, 'Pendant · ring highlight', 'ringLight')

# Hair: green scalp, swept locks, and short spikes around the face and nape.
verts = []
faces = []
segments = 96
rows = 32
for j in range(rows):
    t = j / (rows - 1)
    for k in range(segments):
        a = math.tau * k / segments
        back = (1 - math.cos(a)) * .5
        low = 2.62 - .96 * back + .025 * math.sin(7 * a) + .018 * math.sin(11 * a)
        z = low + (3.058 - low) * t
        rx, ry = radii(HEAD, min(z, 3.05))
        taper = math.sin(math.pi * t) * .012
        verts.append(((rx + .027 + taper) * math.sin(a), .03 - (ry + .032 + taper) * math.cos(a), z))
for j in range(rows - 1):
    for k in range(segments):
        faces.append((j * segments + k, j * segments + (k + 1) % segments, (j + 1) * segments + (k + 1) % segments, (j + 1) * segments + k))
scalp = mesh('Hair · curved continuous scalp with tapered nape', verts, faces, 'hair', True)
solid = scalp.modifiers.new('Fine hairline edge', 'SOLIDIFY')
solid.thickness = .014

def lock(name, xz, widths, mat='hair', offset=.060):
    verts = []
    faces = []
    steps = (len(xz) - 1) * 9
    ring = 12
    points = [(x, face(x, z, offset), z) for x, z in xz]
    for j in range(steps + 1):
        t = (len(points) - 1) * j / steps
        p = interp(points, t)
        i = min(len(widths) - 2, int(t))
        u = t - i
        w = max(.002, widths[i] * (1 - u) + widths[i + 1] * u)
        tangent = (interp(points, min(len(points) - 1, t + .008)) - interp(points, max(0, t - .008))).normalized()
        across = Vector((tangent.z, 0, -tangent.x)).normalized()
        for k in range(ring):
            a = math.tau * k / ring
            v = p + across * (math.cos(a) * w) + Vector((0, math.sin(a) * w * .20, 0))
            verts.append(tuple(v))
    for j in range(steps):
        for k in range(ring):
            faces.append((j * ring + k, j * ring + (k + 1) % ring, (j + 1) * ring + (k + 1) % ring, (j + 1) * ring + k))
    faces.extend([tuple(range(ring - 1, -1, -1)), tuple(steps * ring + k for k in range(ring))])
    return mesh(name, verts, faces, mat, True)

lock('Hair · asymmetric long swept fringe', [(-.57, 2.87), (-.50, 2.68), (-.20, 2.39), (.15, 2.08)], [.14, .19, .14, .002], offset=.075)
lock('Hair · layered upper sweep', [(-.26, 2.94), (-.08, 2.77), (.20, 2.55), (.43, 2.31)], [.13, .16, .12, .002], offset=.067)
lock('Hair · short parting lock', [(-.77, 2.73), (-.72, 2.52), (-.55, 2.31)], [.09, .11, .002], offset=.065)
lock('Hair · fine swept strand', [(-.51, 2.76), (-.34, 2.54), (-.08, 2.30)], [.012, .016, .001], 'hairLight', offset=.119)
lock('Hair · front spike left', [(-.48, 2.82), (-.38, 2.62), (-.22, 2.46)], [.10, .12, .002], offset=.080)
lock('Hair · front spike right', [(.12, 2.86), (.26, 2.68), (.42, 2.54)], [.10, .12, .002], offset=.080)
for side in [-1, 1]:
    lock('Hair · tapered temple wisp ' + str(side), [(side * .78, 2.60), (side * .89, 2.36), (side * .86, 2.14)], [.09, .065, .002], offset=.044)
    lock('Hair · short temple spike ' + str(side), [(side * .80, 2.56), (side * .94, 2.40), (side * .98, 2.22)], [.07, .055, .002], offset=.050)
    lock('Hair · long pointed side lock ' + str(side), [(side * .79, 2.58), (side * .91, 2.29), (side * .86, 1.96)], [.12, .10, .002], offset=.065)
    ellipsoid('Ear · small rounded form ' + str(side), (side * .93, .005, 1.97), (.095, .13, .18), 'skinShade', True)
for i, a in enumerate([1.58, 1.96, 2.38, 2.80, 3.22, 3.64, 4.06, 4.48, 4.73]):
    pts = []
    low = 2.62 - .96 * (1 - math.cos(a)) * .5
    for t in [0, .32, .67, 1]:
        z = 2.78 + (low + .08 - 2.78) * t
        angle = a + .10 * math.sin(math.pi * t)
        rx, ry = radii(HEAD, z)
        pts.append(((rx + .038) * math.sin(angle), .03 - (ry + .043) * math.cos(angle), z))
    curve('Hair · curved rear strand ' + str(i), pts, 'hairLight', .005, True)

# Cap: black crown with a large silver-white front panel and a short black brim.
CAP = [(2.77, .94, .81), (2.88, 1.065, .92), (3.06, 1.10, .97), (3.28, .99, .88), (3.48, .72, .68), (3.62, .36, .35), (3.67, .025, .025)]
verts = []
faces = []
rows = 48
segments = 72

def cap_point(z, rx, ry, a, push=0):
    return ((rx + push) * math.sin(a) - .095 * (z - 2.77), .025 - (ry + push) * math.cos(a), z + .035 * math.sin(a))

for j in range(rows):
    z, rx, ry = interp(CAP, (len(CAP) - 1) * j / (rows - 1))
    for k in range(segments):
        verts.append(cap_point(z, rx, ry, math.tau * k / segments))
for j in range(rows - 1):
    for k in range(segments):
        faces.append((j * segments + k, j * segments + (k + 1) % segments, (j + 1) * segments + (k + 1) % segments, (j + 1) * segments + k))
faces.extend([tuple(range(segments - 1, -1, -1)), tuple((rows - 1) * segments + k for k in range(segments))])
cap = mesh('Cap · rounded paneled crown', verts, faces, 'cap', True)

def cap_front(x, z, offset=.0):
    xa = x + .095 * (z - 2.77)
    rx, ry = radii(CAP, z)
    return .025 - ry * math.sqrt(max(.01, 1 - (min(abs(xa) / max(rx, .001), .995)) ** 2)) - offset

curve('Cap · lower stitched band', [cap_point(2.785, .95, .82, math.tau * k / 48, .004) for k in range(49)], 'capDark', .018, True)
patch('Cap · silver white front panel', [(-.62, 2.92), (.62, 2.92), (.57, 3.28), (.28, 3.46), (-.28, 3.46), (-.57, 3.28)], 'capLight', cap_front, .025, True, .006)

verts = []
faces = []
n = 40
for outer in [0, 1]:
    for k in range(n + 1):
        a = -1.15 + 2.30 * k / n
        rx = .94 if not outer else 1.035
        ry = .81 if not outer else 1.045
        verts.append((rx * math.sin(a), .025 - ry * math.cos(a), 2.79 - .075 * outer * math.cos(a) + .035 * math.sin(a)))
for k in range(n):
    faces.append((k, k + 1, n + 2 + k, n + 1 + k))
brim = mesh('Cap · gently curved short brim', verts, faces, 'cap', True)
solid = brim.modifiers.new('Brim thickness', 'SOLIDIFY')
solid.thickness = .033
ellipsoid('Cap · small covered button', (-.085, .025, 3.675), (.05, .05, .022), 'capDark', True)

# Cream flower on the right side of the cap.
flower_loc = (.62, -.80, 3.23)
flower_size = .20
for i in range(5):
    a = math.tau * i / 5
    px = flower_loc[0] + math.cos(a) * flower_size * .55
    pz = flower_loc[2] + math.sin(a) * flower_size * .55
    petal('Flower · petal ' + str(i), (px, flower_loc[1], pz), (flower_size * .55, flower_size * .18, flower_size * .30), (0, a, 0), 'flower', True)
ellipsoid('Flower · center', flower_loc, (flower_size * .34, flower_size * .18, flower_size * .34), 'flowerCenter', True)

# Face: teal eyes, green brows, and a confident smile.
for side in [-1, 1]:
    cx = side * .33
    cz = 2.24
    # One continuous surface: no stacked disks, protruding whites or floating
    # pupils. The broad iris extends beyond both lids, as in the reference.
    def eye_bounds(u):
        taper = max(0, 1-u*u) ** .35
        return 2.235-.062*taper, 2.235+.080*taper
    verts, faces, eye_colors = [], [], []
    columns, rows = 80, 32
    for j in range(rows+1):
        for i in range(columns+1):
            u = -1+2*i/columns
            x = cx+.175*u
            low, high = eye_bounds(u)
            z = low+(high-low)*j/rows
            verts.append((x,face(x,z,.014),z))
    for j in range(rows):
        for i in range(columns):
            a=j*(columns+1)+i
            faces.append((a,a+1,a+columns+2,a+columns+1))
            x=sum(verts[k][0] for k in faces[-1])/4
            z=sum(verts[k][2] for k in faces[-1])/4
            r=((x-cx)/.098)**2+((z-2.25)/.125)**2
            color='eyeWhite'
            if r<1: color='irisDark'
            if r<.77: color='iris'
            if ((x-cx)/.040)**2+((z-2.25)/.073)**2<1: color='pupil'
            if ((x-(cx-.027))/.016)**2+((z-2.285)/.019)**2<1: color='eyeWhite'
            eye_colors.append(color)
    eye_obj=mesh('Eye · integrated relaxed gaze '+str(side),verts,faces,'eyeWhite',True)
    keys=['eyeWhite','irisDark','iris','pupil']
    for key in keys[1:]: eye_obj.data.materials.append(M[key])
    for poly,key in zip(eye_obj.data.polygons,eye_colors): poly.material_index=keys.index(key)
    for edge,mat,radius in [(1,'ink',.006),(0,'skinShade',.003)]:
        pts=[]
        for i in range(17):
            u=-1+2*i/16;x=cx+.175*u;z=eye_bounds(u)[edge]
            pts.append((x,face(x,z,.017),z))
        curve('Eye · fitted lid '+str(side)+' '+str(edge),pts,mat,radius,True)
    curve('Face · brow ' + str(side), [(side * x, face(side * x, z, .020), z) for x, z in [(.17, 2.43), (.32, 2.48), (.47, 2.45)]], 'hairDark', .012, True)
# The supplied bobble has a small, mostly white crescent, not an open black grin.
patch('Face · small white smile', [(-.245,1.72),(-.12,1.715),(0,1.71),(.12,1.72),(.245,1.735),(.16,1.68),(.08,1.655),(0,1.65),(-.08,1.655),(-.16,1.68)], 'eyeWhite', face, .033, True, .004)
curve('Face · upper smile line', [(x,face(x,z,.041),z) for x,z in [(-.27,1.72),(-.12,1.715),(0,1.71),(.12,1.72),(.26,1.735)]], 'ink', .006, True)
curve('Face · lower smile line', [(x,face(x,z,.039),z) for x,z in [(-.16,1.68),(-.08,1.655),(0,1.65),(.08,1.655),(.16,1.68)]], 'ink', .004, True)
for side in [-1,1]:
    for i,stroke in enumerate([[ (.48,1.04),(.68,.97),(.84,.88)],[(.51,.91),(.71,.84),(.90,.80)],[(.63,.74),(.82,.69),(.96,.60)]]):
        curve('Jacket · draped fold '+str(side)+' '+str(i),[(side*x,front(side*x,z,.025),z) for x,z in stroke],'jacketDark',.006)

# White rolling base with a gold leaf pattern on the lower front.
UPPER_OFFSET = 1.05645
for o in objects:
    o.location.z += UPPER_OFFSET
base_start = len(objects)
lower_base = ellipsoid('Base · separate rounded rolling lower section', (0, .03, 1.0), (1.0, .98, 1.0), 'white')

def base_surface(x, z, offset=.0):
    dz = z - 1.0
    return .03 - .98 * math.sqrt(max(.01, 1 - (x / 1.0) ** 2 - (dz / 1.0) ** 2)) - offset

leaves = [
    [(0, .16), (.08, .30), (.10, .55), (0, .82), (-.10, .55), (-.08, .30)],
    [(-.04, .18), (-.22, .34), (-.38, .56), (-.28, .76), (-.16, .54), (-.08, .34)],
    [(.04, .18), (.22, .34), (.38, .56), (.28, .76), (.16, .54), (.08, .34)],
    [(-.02, .14), (-.38, .24), (-.62, .38), (-.58, .56), (-.40, .46), (-.16, .30)],
    [(.02, .14), (.38, .24), (.62, .38), (.58, .56), (.40, .46), (.16, .30)],
]
for i, outline in enumerate(leaves):
    patch('Base · gold leaf ' + str(i), outline, 'gold', base_surface, .012, False, .006)
for tip in [(0, .80), (-.28, .74), (.28, .74), (-.56, .54), (.56, .54)]:
    curve('Base · gold vein', [(0, base_surface(0, .18, .02), .18), (tip[0] * .5, base_surface(tip[0] * .5, .45, .02), .45), (tip[0], base_surface(tip[0], tip[1], .02), tip[1])], 'goldLight', .006)
base_objects = set(objects[base_start:])

# Cosmetic-only anchors; no arms, bones, scripts, or game components.
root = bpy.data.objects.new('NEBULA_Bobble', None)
bpy.context.collection.objects.link(root)
body_root = bpy.data.objects.new('BodyRoot', None)
bpy.context.collection.objects.link(body_root)
body_root.parent = root
head_root = bpy.data.objects.new('HeadRoot', None)
bpy.context.collection.objects.link(head_root)
head_root.parent = root
head_root.location = (0, 0, 1.20 + UPPER_OFFSET)
base_root = bpy.data.objects.new('BaseRoot', None)
bpy.context.collection.objects.link(base_root)
base_root.parent = root
base_root.location = (0, 0, 1.0)
bpy.context.view_layer.update()
for o in objects:
    world = o.matrix_world.copy()
    o.parent = base_root if o in base_objects else head_root if o in heads else body_root
    o.matrix_world = world
root['revision'] = 3
root['cosmetic_only'] = True
root['reference'] = 'Original NEBULA character study from the supplied illustration; unseen sides inferred.'
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if o.type == 'CURVE':
        bpy.ops.object.convert(target='MESH')
    for modifier in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    o.select_set(False)
model_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in model_objects + [root, body_root, head_root, base_root]:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSETS / 'nebula-bobble.glb'), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_animations=False)

# Studio preview.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
world = bpy.data.worlds.new('Neutral studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (*linear('D8D9DD'), 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .32
scene.world = world
ground = material('Studio ground', 'DDDEE1', .85)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, .023))
bpy.context.object.name = 'STUDIO_ground'
bpy.context.object.data.materials.append(ground)

def aim(o, p):
    o.rotation_euler = (Vector(p) - o.location).to_track_quat('-Z', 'Y').to_euler()

for name, loc, power, size in [('Key', (-3.4, -4.5, 7), 500, 4), ('Fill', (3.7, -2, 4), 260, 3.5), ('Rim', (1, 3, 6), 420, 3)]:
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = power
    d.shape = 'DISK'
    d.size = size
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    aim(o, (0, 0, 2.3))
d = bpy.data.cameras.new('Portrait camera')
camera = bpy.data.objects.new('Portrait camera', d)
bpy.context.collection.objects.link(camera)
scene.camera = camera
d.type = 'ORTHO'
d.ortho_scale = 5.4
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
camera.location = (4.5, -10, 5.1)
aim(camera, (0, 0, 2.37))
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / 'nebula-bobble.blend'))
views = {'front': (0, -10, 4.3), 'three-quarter': (5, -10, 5.1), 'back': (4, 10, 4.9), 'profile': (10, 0, 3.9)}
for name, loc in views.items():
    camera.location = loc
    aim(camera, (0, 0, 2.37))
    scene.render.filepath = str(ASSETS / ('nebula-' + name + '.png'))
    bpy.ops.render.render(write_still=True)
metadata = {
    'name': 'NEBULA bobble',
    'revision': 3,
    'meshes': len(model_objects),
    'triangles': sum(len(p.vertices) - 2 for o in model_objects for p in o.data.polygons),
    'materials': len(M),
    'armless': True,
    'complete_lower_base': True,
    'head_construction': 'organic rounded head with teal eyes and green spiked hair',
    'hair_construction': 'curved green scalp with swept locks and short spikes',
    'upper_torso_only_height_width': (1.285 - .035) / (2 * 1.14),
    'full_body_height_width': (1.285 + UPPER_OFFSET) / (2 * 1.14),
    'bare_core_height_width': (3.055 + UPPER_OFFSET) / (2 * 1.14),
    'bare_head_height_width': (3.055 - 1.115) / (2 * .98),
    'cap_profile_crown_height': .9,
    'separate_base_body_head': True,
    'game_assets_in_export': False,
    'unseen_sides_inferred': True,
    'installed_in_discord': False,
}
(ASSETS / 'model-nebula.json').write_text(json.dumps(metadata, indent=2))
print('MODEL_RESULT ' + json.dumps(metadata))
