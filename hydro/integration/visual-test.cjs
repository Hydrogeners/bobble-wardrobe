// Lifecycle tests with mocked Unity APIs; does not claim live rendering proof.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const template=fs.readFileSync(__dirname+'/visual-template.js','utf8');
const b64=x=>Buffer.from(x.buffer).toString('base64');
const part={vertices:3,indices:3,position:b64(new Float32Array([0,0,0,1,0,0,0,1,0])),normal:b64(new Float32Array([0,0,1,0,0,1,0,0,1])),uv:b64(new Float32Array(6)),index:b64(new Uint16Array([0,2,1]))};
const data={revision:3,fullGeometry:true,sourceSHA256:'test',palette:Buffer.alloc(4096,255).toString('base64'),parts:{head:part,body:part,base:part}};
function setup(options={}){
  let id=1000,ptr=1024,handle=1,now=0,failed=false;
  const owned=new Set(),pins=new Set(),destroyed=[],writes=[],timers=new Map(),names=new Map([[110,'BODY_GEO'],[111,'HEAD_GEO'],[113,'BALL_GEO'],[112,'Team 6 Bull'],[120,'BODY_GEO'],[130,'Visuals'],[410,'Body_Snowsgiving'],[400,'Body_Male_TeamBear'],[401,'Head_Male01'],[403,'Ball'],[500,options.plainMaterial?'TeamBear':'TeamBearMAT'],[501,'TeamBearMAT'],[503,'TeamBearMAT']]);
  const meshes=new Map([[200,400],[201,401],[203,403],[210,410]]),mats=new Map([[300,500],[301,501],[303,503]]),counts=new Map(),tex=new Map(),events=new Map();
  const M={HEAPU8:new Uint8Array(4*1024*1024),_malloc(n){const p=ptr;ptr+=n;return p;},_free(){}};
  const F=Object.fromEntries(['create','type','clone','destroy','white','resize','rawTexture','apply','setTexture','channel','indices','indexFormat','submeshes','bounds','setMesh','setMaterial','setName'].map(k=>[k,()=>{}]));
  M.HEAPF32=new Float32Array(M.HEAPU8.buffer);
  function call(k,...a){
    switch(k){
      case'type':return 900;case'create':case'clone':{const n=id++;owned.add(n);return n;}
      case'pin':{const h=handle++;pins.add(h);return h;}case'unpin':assert(pins.delete(a[0]));return;
      case'setName':names.set(a[0],a[1]);return;case'white':return 800;
      case'resize':return options.failPalette?0:1;case'rawTexture':return 1;case'apply':case'indexFormat':case'submeshes':case'bounds':return;
      case'channel':if(a[1]===0)counts.set(a[0],a[5]);return;
      case'indices':counts.set('i'+a[0],a[6]);return;case'vertices':return counts.get(a[0])||3;
      case'submeshCount':return 1;case'indexCount':return counts.get('i'+a[0]);
      case'propertyID':return a[0];case'colorInjected':case'scaleInjected':case'offsetInjected':case'setTextureNamed':case'setIntNamed':return 0;case'gameObject':return a[0]-100;case'transform':return a[0]+100;
      case'parent':return a[0]===110?112:a[0]===120?130:0;
      case'childCount':return a[0]===112?3:a[0]===130?2:0;
      case'child':return a[0]===130?(a[1]===0?120:112):[110,111,113][a[1]];
      case'active':case'exists':return 1;
      case'mesh':return meshes.get(a[0]);case'material':return mats.get(a[0]);
      case'texture':return tex.get(a[0]);case'setTexture':tex.set(a[0],a[1]);return;
      case'setMesh':
        if(options.failSecond&&!failed&&a[0]===201&&owned.has(a[1])){failed=true;throw Error('injected assignment failure');}
        writes.push([k,...a]);meshes.set(a[0],a[1]);return;
      case'setMaterial':writes.push([k,...a]);mats.set(a[0],a[1]);return;
      case'destroy':assert(owned.has(a[0]),'Must never destroy original assets');owned.delete(a[0]);destroyed.push(a[0]);return;
      default:throw Error('Unexpected native method '+k);
    }
  }
  const sigs={18790:['1825',2],17835:['2639',2],17977:['10897',3],19150:['18836',3],19157:['18831',3],17554:['20333',4],17268:['570',2],17622:['20305',4],17628:['20287',4],17627:['20288',4]};
  const P={M,F,call,withString:(s,f)=>f(s),name:o=>names.get(o)||'',find:s=>{if(s==='Visuals')return options.wait?0:30;if(s==='Main Camera')return 0;assert.equal(s,'BODY_GEO');return options.wait?0:options.firstMascot?20:10;},component:(go,s)=>s==='MeshFilter'?go+190:go+290,T:{get(slot){const [name,length]=sigs[slot];const f=()=>{};Object.defineProperties(f,{name:{value:name},length:{value:length}});return f;}}};
  const window={__hydroNativeProbe:P,__hydroAllocationCheck:{ok:true},addEventListener:(k,f)=>events.set(k,f),removeEventListener:(k,f)=>events.delete(k)};
  const ctx={window,Uint8Array,Uint16Array,Float32Array,atob:s=>Buffer.from(s,'base64').toString('binary'),Date:{now:()=>now},setInterval:f=>{const id=timers.size+1;timers.set(id,f);return id;},clearInterval:id=>timers.delete(id)};
  return {ctx,window,owned,pins,writes,meshes,mats,timers,events,run:payload=>vm.runInNewContext(template.replace('__VISUAL_DATA__',JSON.stringify(payload||data)),ctx),advance:ms=>{now+=ms;for(const f of [...timers.values()])f();}};
}
let tests=0;
{
 const s=setup();s.run();assert.equal(s.window.__hydroModel.status().phase,'ready');assert.equal(s.writes.length,0);
 assert.equal(s.window.__hydroModel.arm().phase,'active');assert(s.window.__hydroModel.status().verifiedNativeAssignments);assert.equal(s.writes.length,6);
 assert.equal(s.window.__hydroModel.restore().phase,'restored');assert.equal(s.meshes.get(200),400);assert.equal(s.meshes.get(201),401);assert.equal(s.meshes.get(203),403);assert.equal(s.mats.get(300),500);assert.equal(s.mats.get(301),501);assert.equal(s.mats.get(303),503);
 assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);assert.equal(s.events.size,0);tests++;
}
{
 const s=setup();s.run();s.window.__hydroModel.arm();
 const bodyMesh=s.meshes.get(200),firstMaterial=s.mats.get(300);
 assert.notEqual(bodyMesh,400);
 s.meshes.set(200,400); // game reverted one mesh after a scene refresh
 s.advance(1200);
 assert.equal(s.window.__hydroModel.status().phase,'active');
 assert.equal(s.meshes.get(200),bodyMesh,'Watchdog must reattach after a revert');
 assert.notEqual(s.mats.get(300),firstMaterial,'Watchdog must use a fresh material');
 s.window.__hydroModel.restore();
 assert.equal(s.meshes.get(200),400);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
{
 const s=setup({failSecond:true});s.run();assert.equal(s.window.__hydroModel.arm().phase,'failed-restored');assert.equal(s.meshes.get(200),400);assert.equal(s.meshes.get(201),401);assert.equal(s.meshes.get(203),403);assert.equal(s.mats.get(300),500);assert.equal(s.mats.get(301),501);assert.equal(s.mats.get(303),503);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
{
 const s=setup({wait:true});s.run();assert.equal(s.window.__hydroModel.arm().phase,'armed');assert.equal(s.timers.size,1);s.window.__hydroModel.restore();assert.equal(s.timers.size,0);assert.equal(s.writes.length,0);assert.equal(s.owned.size,0);tests++;
}
{
 const s=setup({wait:true});s.run();s.window.__hydroModel.arm();s.advance(1800001);assert.equal(s.window.__hydroModel.status().phase,'expired');assert.equal(s.timers.size,0);assert.equal(s.pins.size,0);tests++;
}
{
 const s=setup({failPalette:true});assert.throws(()=>s.run(),/Palette texture/);assert.equal(s.writes.length,0);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
{
 const s=setup();const bad=structuredClone(data);bad.parts.head.normal='';assert.throws(()=>s.run(bad),/normal length/);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);assert.equal(s.writes.length,0);tests++;
}
assert(!/call\(['"](?:set_position|set_rotation|set_local|SendMessage|BindUnity|set_parent)/.test(template));
{
 const s=setup({firstMascot:true,plainMaterial:true});s.run();assert.equal(s.window.__hydroModel.arm().phase,'active');assert.equal(s.meshes.get(210),410,'Mascot must remain untouched');s.window.__hydroModel.restore();assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
{
 const nebula=JSON.parse(fs.readFileSync(__dirname+'/visual-nebula-data.json','utf8'));
 const s=setup();s.run(nebula);assert.equal(s.window.__hydroModel.status().phase,'ready');
 assert.equal(s.window.__hydroModel.status().headVertices,nebula.parts.head.vertices);
 assert.equal(s.window.__hydroModel.arm().phase,'active');assert.equal(s.window.__hydroModel.status().attached,true);assert.equal(s.writes.length,6);
 s.window.__hydroModel.restore();assert.equal(s.meshes.get(200),400);assert.equal(s.meshes.get(201),401);assert.equal(s.meshes.get(203),403);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
for(const name of ['hydro','miko','todo','jjcho','augusto','flair','supa','duolingo','spark']){
 const suffix=process.argv.includes('--quality')?'quality':'fitted';
 const payload=JSON.parse(fs.readFileSync(__dirname+'/visual-'+name+'-'+suffix+'.json','utf8'));
 const s=setup();s.run(payload);assert.equal(s.window.__hydroModel.arm().phase,'active',name);
 s.window.__hydroModel.restore();assert.equal(s.meshes.get(200),400);assert.equal(s.meshes.get(201),401);assert.equal(s.meshes.get(203),403);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
for(const size of [128,192,256,512]){
 const s=setup(),payload={...data,textureSize:size,palette:Buffer.alloc(size*size*4,255).toString('base64')};
 s.run(payload);assert.equal(s.window.__hydroModel.arm().phase,'active');s.window.__hydroModel.restore();assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
for(const size of [0,33,1024,'256']){
 const s=setup();assert.throws(()=>s.run({...data,textureSize:size}),/Unsupported cosmetic texture/);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);assert.equal(s.writes.length,0);tests++;
}
{
 const s=setup();assert.throws(()=>s.run({...data,textureSize:256}),/Invalid palette length/);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);tests++;
}
console.log(JSON.stringify({passed:tests,scope:'mocked preparation, attachment, rollback, texture bounds and cleanup; not live appearance proof'}));
