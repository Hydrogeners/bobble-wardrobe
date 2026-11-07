"""Reference-led rolling textures; never project ties/capes onto rolling balls.

Artwork is translated to seam-safe spherical patterns, not copied from the
reference image's background. Only intentional illustrated base details follow
the rolling sphere. Clothes and accessories remain body-parented.
"""
import numpy as np

STYLES={
    'hydro':('tailored-brown',(116,57,29)),
    'miko':('teal-double-gold-band',(0,165,150)),
    'todo':('midnight-satin',(39,38,56)),
    'jjcho':('navy-tailored',(37,35,54)),
    'augusto':('pearl-pointed-folds',(224,224,218)),
    'flair':('pearl-feather-tones',(245,246,239)),
    'supa':('purple-dark-wings',(91,59,132)),
    'duolingo':('snow-orange-wings',(232,235,232)),
    'spark':('ivory-gold-lotus',(236,234,222)),
}

def make_base(name,width=64,height=128):
    """Supersample narrow gold/feather edges before storing the small strip."""
    sample=_make_base(name,width*4,height*4)
    return np.round(sample.astype(float).reshape(height,4,width,4,4).mean((1,3))).astype(np.uint8)

def _make_base(name,width=64,height=128):
    style,color=STYLES[name]
    u=(np.arange(width)+.5)/width
    v=(np.arange(height)+.5)/height
    theta=(u[None,:]-.5)*np.pi*2
    latitude=(v[:,None]-.5)*np.pi
    x=np.cos(latitude)*np.sin(theta)
    y=np.broadcast_to(np.sin(latitude),(height,width))
    z=np.cos(latitude)*np.cos(theta)
    # Gentle material variation rather than a camera-painted bright spot.
    tone=1+.025*np.cos(theta*4)*np.cos(latitude)**2
    result=np.broadcast_to(np.array(color,dtype=float),(height,width,3)).copy()*tone[:,:,None]
    def paint(mask,color,blend=1):
        nonlocal result
        mask=np.broadcast_to(mask,(height,width))*blend
        result=result*(1-mask[:,:,None])+np.asarray(color)*mask[:,:,None]
    def smooth(a,b,value):
        t=np.clip((value-a)/(b-a),0,1);return t*t*(3-2*t)
    if name=='miko':
        # Parallel meridian bands visible at the reference's right-hand side;
        # x=.42 and .70 at the equator, continued around the entire sphere.
        d=np.abs(x-.58*z)
        gold=(smooth(.065,.075,d)-smooth(.18,.19,d))
        paint(gold,(211,165,54))
        paint((smooth(.071,.078,d)-smooth(.088,.095,d))*.5,(242,201,89))
        paint((smooth(.162,.169,d)-smooth(.179,.186,d))*.55,(137,94,25))
        paint((smooth(.116,.123,d)-smooth(.135,.142,d))*.30,(250,223,144))
    elif name in ['hydro','todo','jjcho']:
        # Broad cloth panels reproduce the illustrated tonal lobes, not logos.
        panels=.5+.5*np.cos(theta*3+.35*np.sin(latitude))
        if name in ['todo','jjcho']:
            # Dark navy still needs the reference's readable satin lobes;
            # a three-level near-black texture disappears at match scale.
            result=np.array(color)[None,None,:]*(.82+.72*panels[:,:,None])
        else:result*=1-.20*panels[:,:,None]
        seam=np.exp(-((np.sin(theta*2+.2*np.sin(latitude)))/.035)**2)
        paint(seam,(np.array(color)*.80),.22)
    elif name=='augusto':
        # The reference has a pearl center ending in a shield-like white point.
        point=np.clip(.75-np.abs(x)*1.5,0,1)
        fold=smooth(-.92,-.78,y)-smooth(-.2,.45,y)
        paint(fold*point,(248,246,238),.60)
        crease=np.exp(-((np.abs(x)-(.12+.24*(y+1)/2))/.028)**2)
        paint(crease,(173,177,178),.25)
        # The gold stays at the cloak sides, not an invented ring on the ball.
        side_edge=smooth(.55,.7,np.abs(x))*smooth(.15,.45,y)
        paint(side_edge,(206,181,121),.18)
    elif name=='flair':
        facets=.5+.5*np.cos(theta*3+.3*np.sin(latitude))
        paint(facets,(184,193,195),.16)
    elif name in ['supa','duolingo']:
        # Side wings have inward-pointing tips, as on both source illustrations.
        # One deliberate feather tip per side, not a wavy/scalloped blob.
        edge=.64-.27*np.maximum(0,1-np.abs(y+.24)/.24)
        if name=='supa':edge+=.8*smooth(.38,.70,-y)
        else:edge-=.11*smooth(.1,.7,-y)
        wings=smooth(edge-.02,edge+.02,np.abs(x))
        paint(wings,(32,31,39) if name=='supa' else (234,119,16))
        border=np.exp(-((np.abs(x)-edge)/.016)**2)
        paint(border,(22,22,29) if name=='supa' else (166,79,14),.50)
        if name=='duolingo':paint(np.maximum(0,-y)*(.5+.5*np.cos(theta*2)),(198,208,211),.10)
    elif name=='spark':
        # Gold leaf/lotus points grow from the bottom; a white base, not green.
        petal=.5+.5*np.cos(theta*10)
        top=-.72+.85*petal**2
        leaf=1-smooth(top-.025,top+.025,y)
        paint(leaf,(213,185,123))
        vein=np.exp(-(np.sin(theta*10)/.075)**2)*leaf
        paint(vein,(239,217,167),.55)
        rim=np.exp(-((y-top)/.018)**2)
        paint(rim,(175,141,79),.50)
        inner_top=-.93+.43*(.5+.5*np.cos(theta*10+np.pi))**2
        inner=1-smooth(inner_top-.02,inner_top+.02,y)
        paint(inner,(232,207,153),.68)
        paint(np.exp(-((y-inner_top)/.017)**2),(170,137,75),.42)
    rgba=np.empty((height,width,4),dtype=np.uint8)
    rgba[:,:,:3]=np.clip(np.round(result),0,255).astype(np.uint8)
    rgba[:,:,3]=255
    return rgba

def augusto_cloak_panels():
    """Open, body-anchored pearl cloak skirt; sphere remains free to roll.

    Unlike stretching the source cut caps, these panels have an intentional
    draped hem and a front opening that reveals the reference's white point.
    """
    columns,rows=96,24
    angles=np.linspace(.52,2*np.pi-.52,columns+1)
    p=[];uv=[];tri=[]
    for row in range(rows+1):
        t=row/rows
        for column,angle in enumerate(angles):
            hem=.19+.018*np.cos(angle*3)
            y=1.14*(1-t)+hem*t
            # A continuous shoulder-to-hem drape, never max(sphere, cone).
            # The previous spherical envelope created a horizontal padded bulge.
            radius=.29+.19*(1-(1-t)**3)
            radius+=.007*np.sin(angle*11)*np.sin(np.pi*t)
            p.append((radius*np.sin(angle),y,radius*np.cos(angle)))
            uv.append(((256.5+127*column/columns)/512,(448.5+63*(1-t))/512))
            if row<rows and column<columns:
                a=row*(columns+1)+column;b=a+1;c=a+columns+1;d=c+1
                tri.extend([(a,b,c),(b,d,c)])
    # Body-anchored central breastplate and pearl shield point: these belong
    # inside the opening, not painted onto the freely rotating ball.
    armor_columns,armor_rows=20,32
    offset=len(p)
    for row in range(armor_rows+1):
        t=row/armor_rows
        y=1.14-.96*t
        width=.125+.045*np.sin(np.pi*t)
        if t>.68:width*=max(.025,(1-t)/.32)
        for column in range(armor_columns+1):
            across=column/armor_columns
            x=(across*2-1)*width
            z=max(.29,np.sqrt(max(0,.45**2-(y-.5)**2)))+.018
            z=min(z,np.sqrt(max(0,.487**2-x*x)))
            z+=.003*(1-(across*2-1)**2)
            p.append((x,y,z))
            uv.append(((384.5+127*across)/512,(448.5+63*(1-t))/512))
            if row<armor_rows and column<armor_columns:
                a=offset+row*(armor_columns+1)+column;b=a+1;c=a+armor_columns+1;d=c+1
                tri.extend([(a,b,c),(b,d,c)])
    p=np.asarray(p);uv=np.asarray(uv);tri=np.asarray(tri,dtype=np.uint32)[:,[0,2,1]]
    face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
    normal=np.zeros_like(p)
    for corner in range(3):np.add.at(normal,tri[:,corner],face)
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12)
    x=(np.arange(128)+.5)/128;y=(np.arange(64)+.5)/64
    folds=(.5+.5*np.cos(x[None,:]*np.pi*14))*(.35+.65*(1-y[:,None]))
    cloth=np.empty((64,256,4),dtype=np.uint8)
    cloth[:,:128,:3]=np.clip(np.array([241,239,232])[None,None,:]-folds[:,:,None]*20,0,255)
    cloth[:,:2,:3]=(197,152,48);cloth[:,126:128,:3]=(197,152,48)
    cloth[:,2:3,:3]=(245,216,130);cloth[:,125:126,:3]=(245,216,130)
    tone=.87+.13*np.cos((x-.35)*np.pi)
    armor=np.broadcast_to(np.array([237,189,57])[None,None,:]*tone[None,:,None],(64,128,3)).copy()
    # The image rows run bottom-to-top; t=1-y matches the geometry.
    white=(y[:,None]<.32)
    pearl=np.broadcast_to(np.array([244,243,235])[None,None,:]*(.87+.13*np.cos(x*np.pi))[None,:,None],(64,128,3))
    armor=np.where(white[:,:,None],pearl,armor)
    highlight=(np.abs(x[None,:]-(.31+.23*y[:,None]))<.022)&~white
    armor[highlight]=[255,242,190]
    armor[:,0:2]=[164,119,31];armor[:,-2:]=[164,119,31]
    cloth[:,128:,:3]=np.clip(armor,0,255)
    cloth[:,:,3]=255
    return p,normal,uv,tri,cloth
