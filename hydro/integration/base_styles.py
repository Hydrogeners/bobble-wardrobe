"""Reference-led rolling textures; never project ties/capes onto rolling balls.

Artwork is translated to seam-safe spherical patterns, not copied from the
reference image's background. Only intentional illustrated base details follow
the rolling sphere. Clothes and accessories remain body-parented.
"""
import numpy as np

STYLES={
    'hydro':('tailored-brown',(103,51,28)),
    'miko':('teal-double-gold-band',(0,165,150)),
    'todo':('midnight-satin',(33,32,49)),
    'jjcho':('navy-tailored',(31,30,48)),
    'augusto':('pearl-pointed-folds',(224,224,218)),
    'flair':('pearl-feather-tones',(230,232,227)),
    'supa':('purple-dark-wings',(91,59,132)),
    'duolingo':('snow-orange-wings',(232,235,232)),
    'spark':('ivory-gold-lotus',(236,234,222)),
}

def make_base(name,width=64,height=128):
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
        paint(gold,(190,139,35))
        paint((smooth(.071,.078,d)-smooth(.088,.095,d))*.5,(242,201,89))
    elif name in ['hydro','todo','jjcho']:
        # Broad cloth panels reproduce the illustrated tonal lobes, not logos.
        panels=.5+.5*np.cos(theta*3+.6*np.sin(latitude))
        if name in ['todo','jjcho']:
            # Dark navy still needs the reference's readable satin lobes;
            # a three-level near-black texture disappears at match scale.
            result=np.array(color)[None,None,:]*(.65+1.05*panels[:,:,None])
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
        edge=.54+.17*np.cos((y+.4)*3.8)+.055*np.sin((y+.35)*12)
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
    rgba=np.empty((height,width,4),dtype=np.uint8)
    rgba[:,:,:3]=np.clip(np.round(result),0,255).astype(np.uint8)
    rgba[:,:,3]=255
    return rgba

def augusto_cloak_panels():
    """Open, body-anchored pearl cloak skirt; sphere remains free to roll.

    Unlike stretching the source cut caps, these panels have an intentional
    draped hem and a front opening that reveals the reference's white point.
    """
    columns,rows=80,18
    angles=np.linspace(.46,2*np.pi-.46,columns+1)
    p=[];uv=[];tri=[]
    for row in range(rows+1):
        t=row/rows
        for column,angle in enumerate(angles):
            hem=.19+.035*np.cos(angle*3)
            y=.86*(1-t)+hem*t
            # Flared hem, not a second ball-shaped shell: reference cloak
            # hangs past the widest point instead of narrowing into a globe.
            radius=max(.31+.16*t,np.sqrt(max(0,.45**2-(y-.5)**2))+.012)
            radius+=.002*np.sin(angle*13)*np.sin(np.pi*t)
            p.append((radius*np.sin(angle),y,radius*np.cos(angle)))
            uv.append(((256.5+255*column/columns)/512,(448.5+63*(1-t))/512))
            if row<rows and column<columns:
                a=row*(columns+1)+column;b=a+1;c=a+columns+1;d=c+1
                tri.extend([(a,b,c),(b,d,c)])
    p=np.asarray(p);uv=np.asarray(uv);tri=np.asarray(tri,dtype=np.uint32)[:,[0,2,1]]
    face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
    normal=np.zeros_like(p)
    for corner in range(3):np.add.at(normal,tri[:,corner],face)
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12)
    x=(np.arange(256)+.5)/256;y=(np.arange(64)+.5)/64
    folds=(.5+.5*np.cos(x[None,:]*np.pi*18))*(.4+.6*(1-y[:,None]))
    cloth=np.empty((64,256,4),dtype=np.uint8)
    cloth[:,:,:3]=np.clip(np.array([218,218,214])[None,None,:]-folds[:,:,None]*10,0,255)
    cloth[:,:3,:3]=(195,157,68);cloth[:,-3:,:3]=(195,157,68)
    cloth[:,:,3]=255
    return p,normal,uv,tri,cloth
