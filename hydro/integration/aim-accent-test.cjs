const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const objects=new Map(),materials=new Map();let id=10,offset=64,tick,listener,enabled=true;
const node=(name,parent=0)=>{const p=id++;objects.set(p,{name,parent,children:[],active:true,position:[0,0,0]});if(parent)objects.get(parent).children.push(p);return p;};
const visuals=node('Visuals'),globals=node('Globals(Clone)'),plan=node('C_Plan',globals),pool=node('PoolRoot',globals),body=node('BODY_GEO',visuals);objects.get(body).mesh=node('HYDRO test body');
function arrow(name,material,parent=plan){const p=node(name+'(Clone)',parent),aim=node('Aim',p),r=node('renderer'),mat=node(material);materials.set(mat,{colors:{1:[0,1,1,.4],2:[0,1,1,.4]}});objects.get(aim).renderer=r;objects.get(r).material=mat;return {r,mat,p};}
const editable=arrow('MoveArrowWithWithoutHandleVisuals','AimMAT'),placed=arrow('MoveArrowQueuedAllyVisuals','AimQueuedAllyMAT'),opponent=arrow('MoveArrowQueuedOpponentVisuals','AimQueuedOpponentMAT'),pooled=arrow('MoveArrowQueuedAllyVisuals','AimQueuedAllyMAT',pool),far=arrow('MoveArrowQueuedAllyVisuals','AimQueuedAllyMAT');objects.get(far.p).position=[30,0,0];
const memory=new ArrayBuffer(8192),M={HEAPF32:new Float32Array(memory),_malloc(){const p=offset;offset+=32;return p;},_free(){},stackSave(){return 0;},stackRestore(){}};
const functions=new Map();function bind(slot,name,fn){Object.defineProperty(fn,'name',{value:String(name)});functions.set(slot,fn);}
bind(17624,20303,function(mat,prop,p,last){M.HEAPF32.set(materials.get(mat).colors[prop],p/4);});
bind(17622,20305,function(mat,prop,p,last){materials.get(mat).colors[prop]=Array.from(M.HEAPF32.subarray(p/4,p/4+4));});
bind(17268,570,function(name,last){return name==='_BaseColor'?1:2;});
bind(19150,18836,function(t,p,last){M.HEAPF32.set(objects.get(t).position,p/4);});
const P={M,T:{get:k=>functions.get(k)},find:n=>[...objects].find(([k,o])=>o.name===n)?.[0]||0,name:p=>objects.get(p)?.name||'',withString:(s,f)=>f(s),component(go,type){const o=objects.get(go);return type==='MeshFilter'&&o.mesh?go:type==='SkinnedMeshRenderer'?o.renderer||0:0;},call(k,...a){const o=objects.get(a[0]);switch(k){case'transform':case'gameObject':return a[0];case'active':return o.active;case'parent':return o.parent;case'childCount':return o.children.length;case'child':return o.children[a[1]];case'mesh':return o.mesh;case'material':return o.material;case'pin':return a[0];case'unpin':return;case'exists':return objects.has(a[0]);case'clone':{const p=node('clone');materials.set(p,structuredClone(materials.get(a[0])));return p;}case'setMaterial':o.material=a[1];return;case'destroy':materials.delete(a[0]);objects.delete(a[0]);return;default:throw Error(k);}}};
const window={__hydroNativeProbe:P,__bobbleAccentSettings:{arrow:'#cc6600'},__bobbleWardrobeEngine:{state:()=>({enabled,disposed:false}),subscribe(fn){listener=fn;return()=>{listener=null;}}},addEventListener(){},removeEventListener(){}};
const source=fs.readFileSync(__dirname+'/hydro-aim-accent.js','utf8');
vm.runInNewContext(source,{window,setInterval(){throw Error('Disabled patch must not start');},clearInterval(){}});assert.equal(window.__hydroAimAccent,undefined);
window.__bobbleIndicatorAccentsEnabled=true;
vm.runInNewContext(source,{window,setInterval(fn){tick=fn;return 1;},clearInterval(){}});
assert.equal(window.__hydroAimAccent.status().attached,2);assert.equal(window.__hydroAimAccent.status().error,'');
for(const a of [editable,placed]){assert.notEqual(objects.get(a.r).material,a.mat);const c=materials.get(objects.get(a.r).material).colors[1];assert(Math.abs(c[0]-.8)<1e-5);assert(Math.abs(c[3]-.4)<1e-5);assert.equal(materials.get(a.mat).colors[1][0],0);}
for(const a of [opponent,pooled,far])assert.equal(objects.get(a.r).material,a.mat);
window.__bobbleAccentSettings.arrow='#112233';tick();assert.equal(window.__hydroAimAccent.status().attached,2);enabled=false;listener({enabled:false});assert.equal(window.__hydroAimAccent.status().attached,0);for(const a of [editable,placed])assert.equal(objects.get(a.r).material,a.mat);assert(window.__hydroAimAccent.dispose());
console.log('PASS: editable + placed ally colors, original alpha/material preservation, opponent/pool/distant exclusion, recolor, off restoration, disposal (mock native)');
