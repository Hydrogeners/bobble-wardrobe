const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events=new Map(),frames=new Map(),ctx2d={clearRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
const canvas={style:{},width:0,height:0,getContext:t=>t==='2d'?ctx2d:null,getBoundingClientRect:()=>({width:175,height:240}),setPointerCapture(){},addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
const context={window:{},devicePixelRatio:1,Uint8Array,Uint16Array,Float32Array,atob:s=>Buffer.from(s,'base64').toString('binary'),requestAnimationFrame:f=>{frames.set(1,f);return 1},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/preview-rig.js','utf8'),context);
vm.runInNewContext(fs.readFileSync(__dirname+'/skin-accents.js','utf8'),context);
vm.runInNewContext(fs.readFileSync(__dirname+'/skin-preview.js','utf8'),context);
const w=context.window;
const corners=new Float32Array([-1,-2,-1,1,-2,-1,-1,2,-1,1,2,-1,-1,-2,1,1,-2,1,-1,2,1,1,2,1]);
for(const aspect of [.5,1,2])for(const pitch of [-.3,.28,.3])for(let yaw=0;yaw<6.3;yaw+=.3){const fit=w.__bobblePreviewFit([corners],[0,0,0],2,yaw,pitch,1.1,aspect);for(let i=0;i<corners.length;i+=3){const [x,y,z]=corners.slice(i,i+3),xx=Math.cos(yaw)*x+Math.sin(yaw)*z,zz=-Math.sin(yaw)*x+Math.cos(yaw)*z,yy=Math.cos(pitch)*y-Math.sin(pitch)*zz;assert(Math.abs(xx*fit/aspect)<=.940001);assert(Math.abs(yy*fit)<=.940001);}}
for(const rect of [{width:379,height:60000},{width:60000,height:240},{width:0,height:0},{width:NaN,height:Infinity}]){const size=w.__bobblePreviewBufferSize(rect,3);assert(size.every(n=>Number.isInteger(n)&&n>=1&&n<=2048));}
for(const kind of ['body','base']){const p=new Float32Array(3),n=new Float32Array([0,1,0]);w.__transformBobblePreviewPart(p,n,kind);assert.deepEqual([...p],[0,.5,0]);}
const data=JSON.parse(fs.readFileSync(__dirname+'/visual-repaired-data.json','utf8'));
const errors=[],view=w.__createBobblePreview(canvas,e=>errors.push(e));view.setData(data);view.visible(true);frames.get(1)();frames.delete(1);
const hydroTriangles=Object.values(data.parts).reduce((sum,part)=>sum+part.triangles,0);
assert.equal(canvas.width,350);assert.equal(canvas.height,480);assert.equal(view.info().triangles,hydroTriangles);
const originalYaw=view.info().yaw;view.setAccents({halo:'#19b9ce',arrow:'#f0aa42'});assert.equal(view.info().meshes,3);assert.equal(view.info().triangles,hydroTriangles);assert.equal(view.info().yaw,originalYaw);assert.equal(view.info().accents.arrow,'#f0aa42');
assert.throws(()=>view.setAccents({halo:'bad',arrow:'#ffffff'}));assert.equal(view.info().accents.halo,'#19b9ce');
for(const p of w.__makeBobbleAccentParts({halo:'#ffffff',arrow:'#123456'})){assert(p.p.every(Number.isFinite));assert(p.indices.every(i=>i<p.p.length/3));for(let i=0;i<p.indices.length;i+=3){const [a,b,c]=[p.indices[i]*3,p.indices[i+1]*3,p.indices[i+2]*3];const up=(p.p[b+2]-p.p[a+2])*(p.p[c]-p.p[a])-(p.p[b]-p.p[a])*(p.p[c+2]-p.p[a+2]);assert(up>=-1e-8);}}
let prevented=false;events.get('wheel')({ctrlKey:false,deltaY:1000,preventDefault(){prevented=true}});assert.equal(prevented,false);assert.equal(view.info().zoom,1);
events.get('wheel')({ctrlKey:true,deltaY:100000,preventDefault(){prevented=true}});assert(prevented);assert.equal(view.info().zoom,.9);
events.get('wheel')({ctrlKey:true,deltaY:-100000,preventDefault(){}});assert.equal(view.info().zoom,1.1);
view.reset();const yaw=view.info().yaw;events.get('pointerdown')({button:0,pointerId:1,clientX:0,clientY:0});events.get('pointermove')({buttons:1,pointerId:1,clientX:100000,clientY:100000});assert(Math.abs(view.info().yaw-yaw)<=.321);assert(Math.abs(view.info().pitch)<=.3);
view.visible(false);view.visible(true);const stable=view.info().yaw;events.get('pointermove')({buttons:1,pointerId:1,clientX:200000,clientY:200000});assert.equal(view.info().yaw,stable);
view.rotate(1e8);assert(Math.abs(view.info().yaw)<Math.PI*2);view.setData(null);assert.equal(view.info().meshes,0);assert.equal(errors.length,0);view.dispose();assert.equal(events.size,0);assert.equal(frames.size,0);
const nebula=JSON.parse(fs.readFileSync(__dirname+'/visual-nebula-data.json','utf8'));
const events2=new Map(),errors2=[];
const canvas2={style:{},width:0,height:0,getContext:t=>t==='2d'?ctx2d:null,getBoundingClientRect:()=>({width:175,height:240}),setPointerCapture(){},addEventListener:(k,f)=>events2.set(k,f),removeEventListener:k=>events2.delete(k)};
const view2=w.__createBobblePreview(canvas2,e=>errors2.push(e));view2.setData(nebula);view2.visible(true);frames.get(1)();frames.delete(1);
assert.equal(view2.info().meshes,3);assert.equal(view2.info().triangles,nebula.parts.head.triangles+nebula.parts.body.triangles+nebula.parts.base.triangles);
assert.equal(errors2.length,0);view2.dispose();assert.equal(events2.size,0);assert.equal(frames.size,0);
for(const name of 'hydro miko todo jjcho augusto flair supa duolingo spark'.split(' ')){
 const suffix=process.argv.includes('--quality')?'quality':'fitted';
 const payload=JSON.parse(fs.readFileSync(__dirname+'/visual-'+name+'-'+suffix+'.json','utf8')),errors=[];
 const cv={...canvas,style:{},addEventListener(){},removeEventListener(){}};
 const v=w.__createBobblePreview(cv,e=>errors.push(e));v.setData(payload);v.visible(true);frames.get(1)();frames.delete(1);
 assert.equal(v.info().meshes,3,name);assert.equal(v.info().triangles,Object.values(payload.parts).reduce((sum,p)=>sum+p.indices/3,0));assert.equal(errors.length,0,name);v.dispose();
}
assert.equal(w.__bobbleTextureSize({}),32);assert.equal(w.__bobbleTextureSize({textureSize:256}),256);
assert.equal(w.__bobbleTextureSize({textureSize:1024}),1024);assert.throws(()=>w.__bobbleTextureSize({textureSize:2048}),/Unsupported/);
console.log('Preview regression checks passed: real rig, buffer bounds, controls, cleanup, classic Nebula and all nine fitted textured payloads');
