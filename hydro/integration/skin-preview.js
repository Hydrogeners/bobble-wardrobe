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
  if(![32,128,192,256,512,1024].includes(size))throw Error('Unsupported cosmetic texture size');
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
