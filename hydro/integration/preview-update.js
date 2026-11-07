(() => {if(!window.__bobbleWardrobe?.detachUI)throw Error('Showroom required');window.__bobbleWardrobe.detachUI();
// Authored preview geometry; no Unity meshes or game contexts are used.
window.__bobbleAccentDefaults=Object.freeze({halo:'#19b9ce',arrow:'#f0aa42'});
window.__bobbleAccentSettings=window.__bobbleAccentSettings||{...window.__bobbleAccentDefaults};
window.__makeBobbleAccentParts=function(settings){
  const rgb=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Use a six-digit hex color');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);};
  const parts=[];
  function mesh(color){const p=[],index=[];return {p,index,finish(){const n=new Float32Array(p.length),colors=new Float32Array(p.length);for(let i=0;i<p.length;i+=3){n[i+1]=1;colors.set(color,i);}parts.push({p:new Float32Array(p),n,colors,indices:new Uint16Array(index)});}};}
  function band(radius,width,y,color,start=0,end=Math.PI*2){const m=mesh(color),segments=128;for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments;for(const r of [radius-width/2,radius+width/2])m.p.push(Math.sin(a)*r,y,Math.cos(a)*r);if(i){const j=(i-1)*2;m.index.push(j,j+1,j+2,j+1,j+3,j+2);}}m.finish();}
  const halo=rgb(settings.halo),arrow=rgb(settings.arrow);
  band(.69,.065,.035,halo);band(.765,.012,.036,halo.map(x=>x*.6));
  // Four short index marks give the halo the feel of a selection reticle.
  for(let i=0;i<4;i++)band(.815,.027,.038,halo,i*Math.PI/2-.07,i*Math.PI/2+.07);
  const m=mesh(arrow);m.p.push(-.075,.04,.77,.075,.04,.77,-.075,.04,1.17,.075,.04,1.17,-.22,.04,1.17,.22,.04,1.17,0,.04,1.55);m.index.push(0,2,1,1,2,3,4,6,5);m.finish();
  return parts;
};

window.__bobblePreviewRig={"source":"Team 1 Bug prefab rest pose","parts":{"base":{"origin":[0.0,0.5,0.0],"basis":[[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]]},"body":{"origin":[0.0,0.5,0.0],"basis":[[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]]},"head":{"origin":[-0.00811766181141138,1.2548877000808716,0.0849103182554245],"basis":[[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]]}}};

// Independent, on-demand WebGL preview. Never reads/writes the game's GL context.
window.__bobblePreviewBufferSize=function(rect,dpr){
  const w=Math.max(1,Number.isFinite(rect.width)?rect.width:1),h=Math.max(1,Number.isFinite(rect.height)?rect.height:1);
  const scale=Math.min(Math.max(2,Math.min(dpr||1,3)),2048/w,2048/h);
  return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))];
};
// Larger presentation, bounded by the actual rotated geometry rather than a
// conservative sphere. Recomputed only on demand, never on the game's context.
window.__bobblePreviewFit=function(arrays,center,radius,yaw,pitch,zoom,aspect){
  const a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(pitch),d=Math.sin(pitch);let mx=0,my=0;
  for(const p of arrays)for(let i=0;i<p.length;i+=3){const x=p[i]-center[0],y=p[i+1]-center[1],z=p[i+2]-center[2];mx=Math.max(mx,Math.abs(a*x+b*z));my=Math.max(my,Math.abs(c*y-d*(-b*x+a*z)));}
  return Math.min(1.7*zoom/(radius*Math.max(1,1/aspect)),.94*aspect/Math.max(mx,.001),.94/Math.max(my,.001));
};
window.__transformBobblePreviewPart=function(p,n,kind){
  const fallback={head:[-.0081176618,1.2548877001,.0849103183],body:[0,.5,0],base:[0,.5,0]};
  const rig=window.__bobblePreviewRig?.parts[kind],o=rig?.origin||fallback[kind],basis=rig?.basis||[[1,0,0],[0,1,0],[0,0,1]],a=basis[0],b=basis[1],c=basis[2];
  const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],co=[cross(b,c),cross(c,a),cross(a,b)];
  const det=a.reduce((s,x,i)=>s+x*co[0][i],0);if(!Number.isFinite(det)||Math.abs(det)<1e-8)throw Error('Invalid preview rig');
  for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2],nx=n[i],ny=n[i+1],nz=n[i+2];
    for(let j=0;j<3;j++){p[i+j]=o[j]+a[j]*x+b[j]*y+c[j]*z;n[i+j]=(co[0][j]*nx+co[1][j]*ny+co[2][j]*nz)/det;}
    const len=Math.hypot(n[i],n[i+1],n[i+2])||1;for(let j=0;j<3;j++)n[i+j]/=len;
  }
};
window.__bobbleTextureSize=function(data){
  const size=data.textureSize===undefined?32:data.textureSize;
  if(![32,128,192,256,512].includes(size))throw Error('Unsupported cosmetic texture size');
  return size;
};
window.__createBobblePreview=function(canvas,onError){
  'use strict';
  onError=onError||(()=>{});
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});
  if(!gl)return window.__createBobbleSoftwarePreview(canvas,onError);
  let program,texture=null,meshes=[],data=null,accents=null,visible=false,disposed=false,lost=false,frame=0;
  let yaw=-.28,pitch=.08,zoom=1,drag=null,center=[0,0,0],radius=1;
  const buffers=[],shaders=[];
  const decode=(s,Type)=>new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
  function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Preview shader could not compile');return s;}
  function init(){
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute vec2 uv;
      uniform vec3 center;uniform vec2 orbit;uniform vec2 fit;
      varying vec3 shade;varying vec2 texUV;
      vec3 turn(vec3 p){float a=cos(orbit.x),b=sin(orbit.x),c=cos(orbit.y),d=sin(orbit.y);vec3 q=vec3(a*p.x+b*p.z,p.y,-b*p.x+a*p.z);return vec3(q.x,c*q.y-d*q.z,d*q.y+c*q.z);}
      void main(){vec3 p=turn(position-center);vec3 n=normalize(turn(normal));
        float light=.54+.40*max(0.,dot(n,normalize(vec3(-.45,.8,1.))))+.09*max(0.,dot(n,normalize(vec3(1.,.2,-.5))));
        shade=color*light;texUV=uv;gl_Position=vec4(p.x*fit.x,p.y*fit.y,-p.z*.12,1.);}
    `));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 shade;varying vec2 texUV;uniform sampler2D atlas;uniform float useTexture;void main(){gl_FragColor=vec4(shade*mix(vec3(1.),texture2D(atlas,texUV).rgb,useTexture),1.);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Preview shader could not link');
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.frontFace(gl.CCW);gl.clearColor(0,0,0,0);
  }
  function clearMeshes(){for(const b of buffers)gl.deleteBuffer(b);buffers.length=0;meshes=[];if(texture){gl.deleteTexture(texture);texture=null;}}
  function attribute(values){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,values,gl.STATIC_DRAW);return b;}
  function setData(next){
    data=next;if(lost||disposed)return;
    clearMeshes();if(!next){request();return;}
    const palette=decode(next.palette,Uint8Array),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    try{
      const size=window.__bobbleTextureSize(next);
      if(palette.length!==size*size*4)throw Error('Invalid preview texture');
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,palette);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      for(const kind of ['head','body','base']){
        const part=next.parts[kind],p=decode(part.position,Float32Array),n=decode(part.normal,Float32Array),uv=decode(part.uv,Float32Array),indices=decode(part.index,Uint16Array),colors=new Float32Array(p.length);
        if(p.length!==part.vertices*3||n.length!==p.length||uv.length!==part.vertices*2||indices.length!==part.indices||!p.every(Number.isFinite)||!n.every(Number.isFinite)||!uv.every(Number.isFinite)||indices.some(i=>i>=part.vertices))throw Error('Invalid preview geometry');
        window.__transformBobblePreviewPart(p,n,kind);
        for(let i=0;i<part.vertices;i++){
          for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[i*3+j]);hi[j]=Math.max(hi[j],p[i*3+j]);}
          for(let j=0;j<3;j++)colors[i*3+j]=1;
        }
        const mesh={position:attribute(p),normal:attribute(n),color:attribute(colors),uv:attribute(uv),count:indices.length,index:gl.createBuffer(),coordinates:p};
        buffers.push(mesh.index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);meshes.push(mesh);
      }
      if(accents)for(const part of window.__makeBobbleAccentParts(accents)){
        const mesh={position:attribute(part.p),normal:attribute(part.n),color:attribute(part.colors),uv:attribute(new Float32Array(part.p.length/3*2)),count:part.indices.length,index:gl.createBuffer(),accent:true,coordinates:part.p};
        for(let i=0;i<part.p.length;i++) {const j=i%3;lo[j]=Math.min(lo[j],part.p[i]);hi[j]=Math.max(hi[j],part.p[i]);}
        buffers.push(mesh.index);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,part.indices,gl.STATIC_DRAW);meshes.push(mesh);
      }
      center=lo.map((v,i)=>(v+hi[i])/2);radius=Math.hypot(...lo.map((v,i)=>(hi[i]-v)/2))*1.05;
      yaw=-.28;pitch=.08;zoom=1;request();
    }catch(e){clearMeshes();onError(e.message);}
  }
  function draw(){
    frame=0;if(!visible||disposed||lost)return;
    const [width,height]=window.__bobblePreviewBufferSize(canvas.getBoundingClientRect(),devicePixelRatio);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    const aspect=width/height,fit=window.__bobblePreviewFit(meshes.map(m=>m.coordinates),center,radius,yaw,pitch,zoom,aspect);
    gl.uniform3fv(gl.getUniformLocation(program,'center'),center);gl.uniform2f(gl.getUniformLocation(program,'orbit'),yaw,pitch);gl.uniform2f(gl.getUniformLocation(program,'fit'),fit/aspect,fit);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(program,'atlas'),0);
    for(const mesh of meshes){
      gl.uniform1f(gl.getUniformLocation(program,'useTexture'),mesh.accent?0:1);
      for(const name of ['position','normal','color','uv']){const loc=gl.getAttribLocation(program,name);gl.bindBuffer(gl.ARRAY_BUFFER,mesh[name]);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,name==='uv'?2:3,gl.FLOAT,false,0,0);}
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
    }
  }
  function request(){if(visible&&!frame&&!disposed&&!lost)frame=requestAnimationFrame(draw);}
  function rotate(amount){yaw=(yaw+amount)%(Math.PI*2);request();}
  function reset(){yaw=-.28;pitch=accents?.28:.08;zoom=1;request();}
  function down(e){if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}
  function move(e){if(!drag||e.pointerId!==drag.id)return;if(e.buttons!==1){up();return;}yaw=(yaw+Math.max(-40,Math.min(40,e.clientX-drag.x))*.008)%(Math.PI*2);pitch=Math.max(-.3,Math.min(.3,pitch+Math.max(-40,Math.min(40,e.clientY-drag.y))*.004));drag.x=e.clientX;drag.y=e.clientY;request();}
  function up(){drag=null;canvas.style.cursor='grab';}
  function wheel(e){if(!e.ctrlKey)return;e.preventDefault();zoom=Math.max(.9,Math.min(1.1,zoom-e.deltaY*.0005));request();}
  function key(e){if(e.code==='KeyJ'||e.code==='KeyL'){e.preventDefault();rotate(e.code==='KeyJ'?-.18:.18);}if(e.code==='Home'){e.preventDefault();reset();}}
  function contextLost(e){e.preventDefault();lost=true;if(frame)cancelAnimationFrame(frame);frame=0;onError('Preview paused by the browser. Skin controls still work.');}
   function contextRestored(){lost=false;texture=null;buffers.length=0;meshes=[];shaders.length=0;try{init();onError('');setData(data);}catch(e){onError(e.message);}}
  try{init();}catch(e){for(const s of shaders)gl.deleteShader(s);if(program)gl.deleteProgram(program);throw e;}
  const events=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['wheel',wheel,{passive:false}],['keydown',key],['webglcontextlost',contextLost],['webglcontextrestored',contextRestored]];
  for(const [type,fn,options]of events)canvas.addEventListener(type,fn,options);
  const observer=new ResizeObserver(request);observer.observe(canvas);
  return Object.freeze({setData,rotate,reset,setAccents(next){if(next)window.__makeBobbleAccentParts(next);const view=[yaw,pitch,zoom];accents=next;setData(data);[yaw,pitch,zoom]=view;request();},visible(v){visible=!!v;if(!visible){up();if(frame){cancelAnimationFrame(frame);frame=0;}}request();},
    info:()=>({meshes:meshes.filter(m=>!m.accent).length,triangles:meshes.filter(m=>!m.accent).reduce((s,m)=>s+m.count/3,0),accents:accents&&{...accents},yaw,pitch,zoom,lost,visible}),
    dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();for(const [type,fn,options]of events)canvas.removeEventListener(type,fn,options);clearMeshes();for(const s of shaders)gl.deleteShader(s);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}});
};

// Real-geometry fallback for browsers that refuse an additional WebGL context.
// Painter-sorted, backface-culled triangles; never a static turntable image.
window.__createBobbleSoftwarePreview=function(canvas,onError){
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('3D preview unavailable. Skin controls still work.');
  let parts=[],data=null,accents=null,center=[0,0,0],radius=1,yaw=-.28,pitch=.08,zoom=1,visible=false,frame=0,disposed=false,drag=null;
  const decode=(s,Type)=>new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
  function draw(){
    frame=0;if(!visible||disposed)return;
    const [w,h]=window.__bobblePreviewBufferSize(canvas.getBoundingClientRect(),devicePixelRatio);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.clearRect(0,0,w,h);
    const a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(pitch),d=Math.sin(pitch),aspect=w/h,fit=window.__bobblePreviewFit(parts.map(p=>p.p),center,radius,yaw,pitch,zoom,aspect),triangles=[];
    const turn=(x,y,z)=>{const xx=a*x+b*z,zz=-b*x+a*z;return [xx,c*y-d*zz,d*y+c*zz];};
    for(const part of parts){
      const transformed=new Float32Array(part.p.length),normals=new Float32Array(part.n.length);
      for(let i=0;i<part.p.length;i+=3){transformed.set(turn(part.p[i]-center[0],part.p[i+1]-center[1],part.p[i+2]-center[2]),i);normals.set(turn(part.n[i],part.n[i+1],part.n[i+2]),i);}
      const point=i=>[w*(.5+transformed[i]*fit/aspect*.5),h*(.5-transformed[i+1]*fit*.5)];
      for(let i=0;i<part.indices.length;i+=3){
        const x=part.indices[i]*3,y=part.indices[i+1]*3,z=part.indices[i+2]*3;
        const cross=(transformed[y]-transformed[x])*(transformed[z+1]-transformed[x+1])-(transformed[y+1]-transformed[x+1])*(transformed[z]-transformed[x]);
        if(cross<=0)continue;
        let nx=normals[x]+normals[y]+normals[z],ny=normals[x+1]+normals[y+1]+normals[z+1],nz=normals[x+2]+normals[y+2]+normals[z+2];const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
        const shade=.54+.40*Math.max(0,(-.45*nx+.8*ny+nz)/Math.hypot(.45,.8,1))+.09*Math.max(0,(nx+.2*ny-.5*nz)/Math.hypot(1,.2,.5));
        const rgb=part.colors.subarray(x,x+3);triangles.push({depth:(transformed[x+2]+transformed[y+2]+transformed[z+2])/3,points:[point(x),point(y),point(z)],color:'rgb('+[...rgb].map(v=>Math.max(0,Math.min(255,Math.round(v*shade)))).join(',')+')'});
      }
    }
    triangles.sort((a,b)=>a.depth-b.depth);
    for(const t of triangles){ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(...t.points[0]);ctx.lineTo(...t.points[1]);ctx.lineTo(...t.points[2]);ctx.closePath();ctx.fill();}
  }
  function request(){if(visible&&!frame&&!disposed)frame=requestAnimationFrame(draw);}
  function setData(next){
    data=next;parts=[];if(!data){request();return;}const palette=decode(data.palette,Uint8Array),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    try{const size=window.__bobbleTextureSize(data);if(palette.length!==size*size*4)throw Error('Invalid preview texture');for(const kind of ['head','body','base']){
      const raw=data.parts[kind],p=decode(raw.position,Float32Array),n=decode(raw.normal,Float32Array),uv=decode(raw.uv,Float32Array),indices=decode(raw.index,Uint16Array),colors=new Float32Array(p.length);
      if(p.length!==raw.vertices*3||n.length!==p.length||uv.length!==raw.vertices*2||indices.length!==raw.indices||!p.every(Number.isFinite)||!n.every(Number.isFinite)||!uv.every(Number.isFinite)||indices.some(i=>i>=raw.vertices))throw Error('Invalid preview geometry');
      window.__transformBobblePreviewPart(p,n,kind);
      for(let i=0;i<raw.vertices;i++){for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[i*3+j]);hi[j]=Math.max(hi[j],p[i*3+j]);}const x=Math.max(0,Math.min(size-1,Math.floor(uv[i*2]*size))),y=Math.max(0,Math.min(size-1,Math.floor(uv[i*2+1]*size)));for(let j=0;j<3;j++)colors[i*3+j]=palette[(y*size+x)*4+j];}
      parts.push({p,n,indices,colors});
    }if(accents)for(const part of window.__makeBobbleAccentParts(accents)){for(let i=0;i<part.p.length;i++){const j=i%3;lo[j]=Math.min(lo[j],part.p[i]);hi[j]=Math.max(hi[j],part.p[i]);}parts.push({...part,colors:Float32Array.from(part.colors,x=>x*255),accent:true});}
    center=lo.map((v,i)=>(v+hi[i])/2);radius=Math.hypot(...lo.map((v,i)=>(hi[i]-v)/2))*1.05;reset();}catch(e){parts=[];onError(e.message);}
  }
  function rotate(value){yaw=(yaw+value)%(Math.PI*2);request();}function reset(){yaw=-.28;pitch=accents?.28:.08;zoom=1;request();}
  function down(e){if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}
  function move(e){if(!drag||drag.id!==e.pointerId)return;if(e.buttons!==1){up();return;}yaw=(yaw+Math.max(-40,Math.min(40,e.clientX-drag.x))*.008)%(Math.PI*2);pitch=Math.max(-.3,Math.min(.3,pitch+Math.max(-40,Math.min(40,e.clientY-drag.y))*.004));drag.x=e.clientX;drag.y=e.clientY;request();}
  function up(){drag=null;canvas.style.cursor='grab';}function wheel(e){if(!e.ctrlKey)return;e.preventDefault();zoom=Math.max(.9,Math.min(1.1,zoom-e.deltaY*.0005));request();}
  function key(e){if(['KeyJ','KeyL','Home'].includes(e.code)){e.preventDefault();if(e.code==='Home')reset();else rotate(e.code==='KeyJ'?-.18:.18);}}
  const events=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['wheel',wheel,{passive:false}],['keydown',key]];
  for(const [type,fn,options]of events)canvas.addEventListener(type,fn,options);const observer=new ResizeObserver(request);observer.observe(canvas);
  return Object.freeze({setData,rotate,reset,setAccents(next){if(next)window.__makeBobbleAccentParts(next);const view=[yaw,pitch,zoom];accents=next;setData(data);[yaw,pitch,zoom]=view;request();},visible(v){visible=!!v;if(!visible){up();if(frame){cancelAnimationFrame(frame);frame=0;}}request();},info:()=>({meshes:parts.filter(p=>!p.accent).length,triangles:parts.filter(p=>!p.accent).reduce((s,p)=>s+p.indices.length/3,0),accents:accents&&{...accents},yaw,pitch,zoom,visible,lost:false,renderer:'software'}),dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();for(const [type,fn,options]of events)canvas.removeEventListener(type,fn,options);parts=[];}});
};

/* THESIS: an Xbox 360–inspired avatar showroom, not a settings spreadsheet.
 * OWN-WORLD: pearl/silver blades, deep leaf green, Segoe UI, generous model stage.
 * STORY: browse, turn the real model, choose a club, explicitly apply or restore.
 * FIRST VIEWPORT: broad preview left, compact assignment blade right; live status below.
 * FORM: user-pinned 360 avatar selector; no game pause, scrim, or fake catalog items.
 * FINISH: inspect model, controls, small windows, cleanup, and document verified limits. */
(() => {
  'use strict';
  const engine=window.__bobbleWardrobeEngine;if(!engine)throw Error('Wardrobe engine unavailable');
  const catalog=window.__bobbleClubCatalog||{};
  const host=document.createElement('div');host.id='bobble-wardrobe';const root=host.attachShadow({mode:'open'});
  const style=document.createElement('style');style.textContent=`
    :host{all:initial;font:14px/1.45 "Segoe UI",system-ui,sans-serif;color:#283124;color-scheme:light}
    *{box-sizing:border-box}[hidden]{display:none!important}::selection{background:#d5e9b6;color:#243a12}
    button,select,input{font:inherit}button,select{color:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}
    button{border:1px solid #c8cec0;background:#fff;border-radius:5px;min-height:36px;padding:7px 12px}
    button:hover:not(:disabled){background:#edf4e5;border-color:#7b9a55}button:active:not(:disabled){background:#dcebc9}
    :focus-visible{outline:3px solid #3d7515;outline-offset:3px}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
    .launcher{position:fixed;right:12px;bottom:12px;z-index:2147483646;display:flex;align-items:center;gap:8px;background:#f5f7f1;box-shadow:0 4px 18px #0004;color:#375c21}.dot{width:7px;height:7px;border-radius:50%;background:#7e8876}.dot.on{background:#47831d}
    section{position:fixed;inset:0;margin:auto;width:min(850px,calc(100vw - 32px));height:min(600px,calc(100dvh - 80px));z-index:2147483646;display:flex;flex-direction:column;background:#f6f7f2;border:1px solid #a8b19c;border-radius:10px;box-shadow:0 18px 65px #0006;overflow:hidden}
    header{display:flex;gap:18px;align-items:center;padding:20px 26px;border-bottom:1px solid #d5dbcc;background:linear-gradient(#fff,#eef1e8);flex:none}h2{margin:0;font-size:27px;line-height:1.1;font-weight:400;letter-spacing:-.025em}.title{flex:1}.title p{margin:5px 0 0;color:#5b6552;font-size:12px}.close{border:0;background:transparent;padding:6px;min-width:34px}.toggle-wrap{display:flex;gap:9px;align-items:center;font-size:12px}
    .switch{position:relative;min-height:24px;width:42px;border-radius:16px;padding:0;background:#d9dfd1;border-color:#9ca58f}.switch:before{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;background:#fff;border-radius:50%;box-shadow:0 1px 3px #0003}.switch[aria-checked=true]{background:#4f8527;border-color:#3b681b}.switch[aria-checked=true]:before{left:21px}
    .content{min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(245px,1fr);overflow:auto;scrollbar-width:thin;scrollbar-color:#8e9b7e #edf0e7}
    .collection{min-width:0;display:flex;flex-direction:column;padding:12px 22px 18px;background:radial-gradient(ellipse at 50% 60%,#fff 5%,#eef1e7 70%,#e2e7da);position:relative}
    .stage{position:relative;flex:1;min-height:225px;display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center}.stage:before{content:"";position:absolute;width:47%;height:24px;background:#cdd5c2;border:1px solid #bec9af;border-radius:50%;bottom:23px;left:26.5%;box-shadow:0 7px 15px #63784e33;pointer-events:none}
    canvas{width:100%;height:100%;min-width:0;max-width:100%;min-height:225px;contain:size;display:block;touch-action:none;cursor:grab;position:relative}.arrow{position:relative;width:38px;height:38px;padding:8px;border-radius:50%;color:#3d711b;background:linear-gradient(#fff,#e9eee0);border-color:#bdcaaa;box-shadow:0 2px 4px #3c54231a}.arrow svg{width:18px;height:18px}
    .preview-error{position:absolute;inset:20% 48px auto;text-align:center;background:#f6f7f2;padding:12px;border:1px solid #c8cec0;font-size:12px}
    .view-tools{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:5px}.view-tools button{min-width:32px;min-height:30px;padding:4px 6px;border-color:transparent;background:transparent}.view-tools svg{width:17px;height:17px}.view-tools span{font-size:11px;color:#5b6552}.skin-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:12px}.skin-title h3{font-size:24px;font-weight:400;line-height:1.2;margin:0}.index{font-size:12px;color:#5b6552;font-variant-numeric:tabular-nums}.description{font-size:12px;margin:5px 0 0;color:#5b6552}
    .assignment{padding:22px 24px;background:linear-gradient(100deg,#e7ecdF,#f8f9f5 18%);border-left:1px solid #d5dbcc;min-width:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#8e9b7e #edf0e7}.assignment h3{font-size:18px;font-weight:400;margin:0 0 16px}.field-label{font-size:12px;display:block;font-weight:600;margin-bottom:6px}
    select{appearance:none;width:100%;min-height:40px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10' viewBox='0 0 14 10'%3E%3Cpath d='m2 2 5 5 5-5' fill='none' stroke='%233d711b' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid #b8c4a9;border-radius:5px;padding:8px 32px 8px 10px;cursor:pointer}.assigned{font-size:12px;color:#5b6552;min-height:36px;margin:9px 0 16px;overflow-wrap:anywhere}.primary{display:block;width:100%;background:linear-gradient(#548d29,#3e751a);color:#fff;border-color:#396c17;font-weight:600;min-height:42px;box-shadow:inset 0 1px #ffffff30,0 2px 3px #37501a20}.primary:hover:not(:disabled){background:#396e17;color:#fff;border-color:#315d14}.secondary{width:100%;margin-top:8px}.link{border:0;background:transparent;color:#3e6a20;padding:5px 0;min-height:28px;font-size:12px;text-align:left}.link:hover:not(:disabled){background:transparent;text-decoration:underline;text-underline-offset:3px}
    .divider{border:0;border-top:1px solid #d5dbcc;margin:18px 0 13px}.remember{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:#526048}.remember input{accent-color:#477e22;margin:2px 0 0;width:14px;height:14px;flex:none}.fine{font-size:11px;color:#5b6552;margin:7px 0}.notice{font-size:12px;background:#fff0cf;color:#634a15;border-radius:5px;padding:9px;white-space:pre-line;overflow-wrap:anywhere}
    footer{padding:12px 24px;display:flex;align-items:center;gap:16px;border-top:1px solid #d5dbcc;background:#e9eee1;flex:none}.status{font-size:12px;flex:1;margin:0;color:#40552d}.hints{font-size:11px;color:#5b6552;margin:0}.hints kbd{font:inherit;color:#3b6220}.foot-actions{display:flex;gap:6px}.foot-actions button{font-size:11px;min-height:30px;padding:5px 8px}.restore{border-color:#a8b799}
    @media(max-width:620px){section{width:calc(100vw - 20px);height:calc(100dvh - 70px)}header{padding:14px 16px;gap:10px}h2{font-size:23px}.toggle-label{display:none}.content{display:block}.collection{padding:10px 16px 18px}.stage{height:260px;min-height:200px;flex:none}.assignment{overflow:visible;padding:20px;border-left:0;border-top:1px solid #d5dbcc}.assignment h3{margin-bottom:12px}footer{padding:10px 14px;flex-wrap:wrap;gap:7px}.hints{display:none}.status{min-width:100%}.skin-title{margin-top:8px}}
    @media(max-height:360px){section{height:calc(100dvh - 12px);width:calc(100vw - 16px);display:block;overflow:auto;scroll-padding-top:86px;scroll-padding-bottom:12px}header{padding:10px 14px;position:sticky;top:0;z-index:3}.content{overflow:visible}.stage{height:240px}footer{position:relative}.assignment{overflow:visible}}
    @media(prefers-reduced-motion:no-preference){.switch:before{transition:left 140ms cubic-bezier(.16,1,.3,1)}}
  `;root.append(style);
  const div=document.createElement('div');div.innerHTML=`
    <button class="launcher" type="button" aria-controls="wardrobe-panel" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4 3 7l3 5 2-1v9h8v-9l2 1 3-5-5-3c0 4-8 4-8 0Z"/></svg>Wardrobe<span class="dot" aria-hidden="true"></span></button>
    <section id="wardrobe-panel" aria-labelledby="wardrobe-title" hidden>
      <header><div class="title"><h2 id="wardrobe-title">Wardrobe</h2><p>Nine styles. Visible only to you.</p></div><div class="toggle-wrap"><span class="toggle-label">Custom skins</span><button class="switch" role="switch" aria-label="Enable custom skins" aria-checked="false" type="button"></button></div><button class="close" type="button" aria-label="Close wardrobe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></header>
      <div class="content">
        <div class="collection"><div class="stage"><button class="arrow" id="previous" type="button" aria-label="Previous skin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><canvas tabindex="0" aria-label="3D skin preview. Drag to rotate, scroll to zoom. J and L rotate; Home resets. Left and right arrows browse skins."></canvas><button class="arrow" id="next" type="button" aria-label="Next skin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><p class="preview-error" role="status" hidden></p></div>
          <div class="view-tools"><button id="rotate-left" type="button" aria-label="Rotate model left"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a7 7 0 1 1-1 8M6 3v5H1"/></svg></button><span>Drag to rotate</span><button id="rotate-right" type="button" aria-label="Rotate model right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a7 7 0 1 0 1 8M18 3v5h5"/></svg></button><button id="reset-view" type="button" aria-label="Reset model view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-7 8 7M7 8v12h10V8M10 20v-7h4v7"/></svg></button></div>
          <div class="skin-title"><h3 id="skin-name"></h3><span class="index" id="skin-index"></span></div><p class="description" id="skin-description"></p>
        </div>
         <div class="assignment"><h3>Make it yours</h3><label class="field-label" for="skin-picker">Choose a skin</label><select id="skin-picker"></select><label class="field-label club-label" for="club">Apply to a club</label><select id="club"></select><p class="assigned" id="assigned"></p><button class="primary" id="apply" type="button">Use this skin</button><button class="secondary" id="original" type="button">Use original appearance</button><button class="link" id="apply-all" type="button">Use this skin for all clubs</button><hr class="divider"><label class="remember"><input id="remember" type="checkbox">Remember assignments on this device</label><p class="fine">Skins start off when the activity reloads. Saved club choices stay on this device.</p><div class="notice" id="notice" role="alert" hidden></div><button class="link" id="retry" type="button" hidden>Retry compatible bobbles</button></div>
      </div><footer><p class="status" role="status" aria-live="polite"></p><p class="hints"><kbd>← →</kbd> browse · <kbd>Esc</kbd> close</p><div class="foot-actions"><button class="restore" id="restore" type="button">Restore all</button><button id="reset" type="button">Reset clubs</button></div></footer>
    </section>`;root.append(div);document.documentElement.append(host);
  const $=s=>root.querySelector(s),panel=$('section'),club=$('#club');
  const autoControl=document.createElement('label');autoControl.className='remember';autoControl.style.margin='14px 0 4px';autoControl.innerHTML='<input id="auto-team" type="checkbox">Automatically use this skin for my team';$('#apply-all').after(autoControl);
  const autoNote=document.createElement('p');autoNote.className='fine';autoNote.id='auto-team-note';autoControl.after(autoNote);
  $('canvas').setAttribute('aria-label','3D skin preview. Drag to rotate; Ctrl+scroll to zoom. J and L rotate; Home resets. Left and right arrows browse skins.');
  $('.view-tools span').textContent='Drag to rotate · Ctrl+scroll zoom';
  const accentStyle=document.createElement('style');accentStyle.textContent=`
    .accent-lab{margin-top:16px;padding-top:14px;border-top:1px solid #cbd5be}.accent-heading{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}.accent-heading h4{margin:0;font-size:16px;font-weight:600}.accent-heading span{font-size:11px;color:#526048}.accent-colors{display:grid;grid-template-columns:1fr 1fr;gap:12px}.accent-color{display:grid;grid-template-columns:38px 1fr;gap:8px;align-items:center;min-width:0}.accent-color input[type=color]{width:38px;height:38px;padding:3px;border:1px solid #a3b295;border-radius:50%;background:#fff;cursor:pointer}.accent-color input::-webkit-color-swatch-wrapper{padding:0}.accent-color input::-webkit-color-swatch{border:0;border-radius:50%}.accent-color label{font-size:12px;font-weight:600}.accent-color output{display:block;font-size:11px;color:#526048;font-variant-numeric:tabular-nums}.accent-presets{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.accent-presets button{display:flex;align-items:center;gap:6px;font-size:11px;min-height:30px;padding:4px 8px}.accent-presets i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--sample);border:1px solid #28312440}.accent-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.accent-actions button{font-size:12px;min-height:34px}.accent-message{font-size:11px;color:#526048;margin:8px 0 0;line-height:1.5}.stage:before{display:none}
  `;root.append(accentStyle);
  accentStyle.textContent+='section{height:min(720px,calc(100dvh - 40px))}.accent-heading h4{font-size:18px}@media(max-width:620px){section{height:calc(100dvh - 40px)}}';
  // Never derive the stage's layout height from the canvas drawing-buffer size.
  // Pop-out/reparenting can otherwise amplify a percentage/intrinsic-size cycle.
  accentStyle.textContent+=`.collection{align-self:start;min-height:0}.stage{flex:none;height:clamp(225px,34dvh,280px);grid-template-rows:minmax(0,1fr)}.preview-viewport{position:relative;height:100%;min-width:0;min-height:0;overflow:hidden;contain:strict}.preview-viewport canvas{position:absolute;inset:0;width:100%;height:100%;min-height:0;max-height:100%}`;
  const previewCanvas=$('canvas'),viewport=document.createElement('div');viewport.className='preview-viewport';previewCanvas.before(viewport);viewport.append(previewCanvas);
   const lab=document.createElement('details');lab.className='accent-lab';lab.innerHTML=`<summary>Preview colors <span>Optional · preview only</span></summary>
    <div class="accent-heading"><h4>Accent Lab</h4><span>Halo + aim trail</span></div>
    <div class="accent-colors"><div class="accent-color"><input type="color" id="halo-color" aria-labelledby="halo-label"><div><label id="halo-label" for="halo-color">Selection halo</label><output id="halo-hex" for="halo-color"></output></div></div><div class="accent-color"><input type="color" id="aim-color" aria-labelledby="aim-label"><div><label id="aim-label" for="aim-color">Aiming arrow</label><output id="aim-hex" for="aim-color"></output></div></div></div>
    <div class="accent-presets" role="group" aria-label="Accent color presets"><button type="button" data-preset="hydro"><i style="--sample:#19b9ce" aria-hidden="true"></i>Hydro</button><button type="button" data-preset="aurora"><i style="--sample:#9865d9" aria-hidden="true"></i>Aurora</button><button type="button" data-preset="ember"><i style="--sample:#db6835" aria-hidden="true"></i>Ember</button><button type="button" data-preset="ice"><i style="--sample:#629ec7" aria-hidden="true"></i>Ice</button></div>
    <div class="accent-actions"><button type="button" id="apply-accents">Apply accents</button><button class="link" type="button" id="reset-accents">Reset colors</button></div>
     <p class="accent-message" id="accent-state" role="status" aria-live="polite"></p><p class="accent-message">Colors affect this preview only. In-game halo and arrow recoloring is unsupported.</p>`;
  $('.collection').append(lab);
  $('#halo-label').textContent='Selection halo · preview only';
   const defaults=window.__bobbleAccentDefaults||{halo:'#19b9ce',arrow:'#f0aa42'};
   accentStyle.textContent+=`.club-label{margin-top:18px}.accent-lab summary{cursor:pointer;font-size:13px;font-weight:600;min-height:36px;padding:8px 0}.accent-lab summary span{font-size:11px;font-weight:400;color:#526048;margin-left:8px}.accent-lab[open] summary{margin-bottom:12px}.accent-heading{display:none}.collection{align-self:stretch}.stage{height:clamp(260px,42dvh,360px)}.remember{font-size:12px;line-height:1.5}.remember input{width:16px;height:16px}.view-tools button{min-height:36px;min-width:36px}.close{min-height:40px;min-width:40px}@media(max-width:620px){.stage{height:290px}.collection{padding-bottom:12px}}`;
  let accentDraft={...(window.__bobbleAccentSettings||defaults)};
  function syncAccents(){
    for(const [key,id]of [['halo','halo'],['arrow','aim']]){$('#'+id+'-color').value=accentDraft[key];$('#'+id+'-hex').textContent=accentDraft[key].toUpperCase();}
    viewer?.setAccents?.(accentDraft);
    const applied=window.__bobbleAccentSettings||defaults,dirty=Object.keys(defaults).some(k=>accentDraft[k]!==applied[k]);
    $('#apply-accents').disabled=!dirty;$('#accent-state').textContent=dirty?'Previewing changes · not applied':'Current session colors';
  }
  let open=false,index=0,lastFocus=null,viewer=null,previewID='',state=engine.state(),disposed=false,lastStatus='';
   for(const key of engine.clubs){const o=document.createElement('option');o.value=key;o.textContent=catalog[key]?.name||key;club.append(o);}
   for(const skin of state.catalog){const o=document.createElement('option');o.value=skin.id;o.textContent=skin.name;$('#skin-picker').append(o);}
  for(const [key,c]of Object.entries(catalog))if(c.supported===false){const o=document.createElement('option');o.value=key;o.textContent=c.name+' · unsupported';o.disabled=true;club.append(o);}
  club.value=engine.clubs.find(c=>state.assignments[c]!=='original')||engine.clubs[0];
  function previewError(message){$('.preview-error').hidden=!message;$('.preview-error').textContent=message;}
  function selected(){return state.catalog[index];}
  function loadPreview(){
    if(!open||!selected()||previewID===selected().id&&viewer)return;
    try{
      if(!viewer)viewer=window.__createBobblePreview($('canvas'),previewError);
      previewError('');
      viewer.setData(null);previewID=selected().id;
      const data=engine.previewData?.(selected().id)||window.__bobbleSkinAssets?.[selected().id];
      if(!data)throw Error('This skin has no 3D preview yet. You can still apply it.');
      viewer.setData(data);viewer.setAccents?.(accentDraft);viewer.reset();viewer.visible(true);
    }catch(e){previewError(e.message);}
  }
  function update(s){
    const previous=selected()?.id;state=s;index=Math.min(index,Math.max(0,s.catalog.length-1));
    if(previous&&s.catalog.some(x=>x.id===previous))index=s.catalog.findIndex(x=>x.id===previous);
    const skin=selected(),current=s.assignments[club.value],currentSkin=s.catalog.find(x=>x.id===current);
    $('#skin-name').textContent=skin?.name||'No skins installed';$('#skin-description').textContent=skin?.description||'Register a prepared skin to begin.';
     $('#skin-index').textContent=s.catalog.length?String(index+1).padStart(2,'0')+' / '+String(s.catalog.length).padStart(2,'0'):'00 / 00';
     $('#skin-picker').value=skin?.id||'';$('#skin-picker').disabled=!skin;
    for(const id of ['#previous','#next']){$(id).disabled=s.catalog.length<2;$(id).title=s.catalog.length<2?'One skin installed. More skins will appear here when added.':'';}
    $('.switch').setAttribute('aria-checked',String(s.enabled));$('.dot').classList.toggle('on',s.enabled);$('#remember').checked=s.remember;
    $('#auto-team').checked=!!s.autoSkin;$('#auto-team').disabled=typeof engine.auto!=='function'||!skin;$('#auto-team-note').textContent=s.autoSkin?(s.autoClub?'Auto team: '+(catalog[s.autoClub]?.name||s.autoClub)+' · '+s.autoSkin:'Waiting to identify your supported club'):'Uses the displayed skin for your team; manual club choices remain unchanged.';
    const count=s.counts[club.value]||0,name=catalog[club.value]?.name||club.value;
    $('#assigned').textContent=count?name+' · '+count+' applied':(currentSkin?.name||'Original appearance')+(currentSkin?(s.enabled?' · waiting for a compatible bobble':' · skins off'):'');
    $('#apply').disabled=!skin;$('#apply').textContent=current===skin?.id&&s.enabled?'Equipped for this club':'Use this skin';
    $('#original').disabled=current==='original';$('#apply-all').disabled=!skin;
    const message=s.error?'Restore needs attention':s.expired?'Waiting expired. Switch skins on to retry.':!s.enabled?'Original visuals · custom skins off':s.attached?s.attached+' custom bobble'+(s.attached===1?'':'s')+' applied':'Custom skins on · waiting for a match';
    if(message!==lastStatus){$('.status').textContent=message;lastStatus=message;}
    const notices=[s.error,s.storageWarning,...s.failures].filter(Boolean);$('#notice').hidden=!notices.length;$('#notice').textContent=notices.join('\n');$('#retry').hidden=!s.failures.length&&!s.error;
    $('#restore').disabled=!s.enabled&&!s.attached&&!s.error;loadPreview();
  }
   function browse(delta){if(state.catalog.length<2)return;index=(index+delta+state.catalog.length)%state.catalog.length;previewID='';update(state);}
   $('#skin-picker').addEventListener('change',e=>{index=state.catalog.findIndex(s=>s.id===e.target.value);previewID='';update(state);});
  function show(value=true){if(disposed||open===value)return;open=value;panel.hidden=!value;$('.launcher').setAttribute('aria-expanded',String(value));if(value){lastFocus=document.activeElement;loadPreview();viewer?.visible(true);$('canvas').focus();}else{viewer?.visible(false);if(lastFocus?.isConnected)lastFocus.focus();else $('.launcher').focus();}}
  $('.launcher').addEventListener('click',()=>show(!open));$('.close').addEventListener('click',()=>show(false));$('#previous').addEventListener('click',()=>browse(-1));$('#next').addEventListener('click',()=>browse(1));
  $('#rotate-left').addEventListener('click',()=>viewer?.rotate(-.3));$('#rotate-right').addEventListener('click',()=>viewer?.rotate(.3));$('#reset-view').addEventListener('click',()=>viewer?.reset());club.addEventListener('change',()=>update(engine.state()));
  for(const [key,id]of [['halo','halo'],['arrow','aim']])$('#'+id+'-color').addEventListener('input',e=>{accentDraft[key]=e.target.value;syncAccents();});
  const presets={hydro:defaults,aurora:{halo:'#9865d9',arrow:'#45bfa6'},ember:{halo:'#db6835',arrow:'#f0bb52'},ice:{halo:'#629ec7',arrow:'#9d85d5'}};
  for(const button of lab.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{accentDraft={...presets[button.dataset.preset]};syncAccents();});
  $('#reset-accents').addEventListener('click',()=>{accentDraft={...defaults};syncAccents();});
  $('#apply-accents').addEventListener('click',()=>{window.__bobbleAccentSettings={...accentDraft};syncAccents();$('#accent-state').textContent='Saved for this session · halo is preview-only';});
  syncAccents();
  $('#apply').addEventListener('click',()=>{if(selected()){engine.assign(club.value,selected().id);if(!engine.state().enabled)engine.setEnabled(true);}});
  $('#original').addEventListener('click',()=>engine.assign(club.value,'original'));$('#apply-all').addEventListener('click',()=>{if(selected()){engine.assignAll(selected().id);if(!engine.state().enabled)engine.setEnabled(true);}});
  $('#auto-team').addEventListener('change',e=>{engine.auto(e.target.checked?selected()?.id:'');if(e.target.checked&&!engine.state().enabled)engine.setEnabled(true);});
  $('.switch').addEventListener('click',()=>engine.setEnabled(!engine.state().enabled));$('#remember').addEventListener('change',e=>engine.remember(e.target.checked));$('#restore').addEventListener('click',()=>engine.restore());$('#reset').addEventListener('click',()=>engine.reset());$('#retry').addEventListener('click',()=>engine.retry());
  for(const event of ['pointerdown','pointerup','pointermove','click','dblclick','wheel','keyup'])root.addEventListener(event,e=>e.stopPropagation());
  root.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();show(false);}else if(!['SELECT','INPUT'].includes(e.target.tagName)&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();browse(e.code==='ArrowLeft'?-1:1);}e.stopPropagation();});
  function key(e){if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.code==='KeyW'){e.preventDefault();show(!open);}}
  window.addEventListener('keydown',key,true);const unsubscribe=engine.subscribe(update);
  function detachUI(){disposed=true;unsubscribe();window.removeEventListener('keydown',key,true);viewer?.dispose();host.remove();}
  window.__bobbleWardrobe=Object.freeze({show:()=>show(true),hide:()=>show(false),status:engine.state,preview:()=>viewer?.info(),detachUI,
    uninstall(){if(!engine.dispose())return false;detachUI();delete window.__bobbleWardrobe;delete window.__bobbleWardrobeEngine;delete window.__bobbleCreateVisual;delete window.__bobbleSkinAssets;return true;}});
})();

window.__bobbleWardrobe.show();return JSON.stringify(window.__bobbleWardrobe.preview());})();
