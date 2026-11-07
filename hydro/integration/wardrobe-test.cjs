// Mock-native tests. Does not certify live rendering or every game build.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const root=__dirname;
const fixture=fs.readFileSync(path.join(root,'visual-test.cjs'),'utf8').split('let tests=0;')[0]
  .replace('return {ctx,window,owned,','return {names,counts,ctx,window,owned,');
const moduleStub={exports:{}};
vm.runInNewContext(fixture+'\nmodule.exports={setup,data};',{require,__dirname:root,Buffer,module:moduleStub});
const {setup,data}=moduleStub.exports;
const factory=fs.readFileSync(path.join(root,'visual-factory.js'),'utf8');
const manager=fs.readFileSync(path.join(root,'skin-manager.js'),'utf8');
function boot(options={}){
  const s=setup(options),store=new Map();
  if(options.saved)store.set('bobble-wardrobe.preferences.v1',JSON.stringify(options.saved));
  s.ctx.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(options.storageFail)throw Error('blocked');store.set(k,v);},removeItem:k=>store.delete(k)};
  s.ctx.console=console;s.window.__bobbleSkinAssets=options.assets||{hydro:data};s.window.__bobbleSkinCatalog=options.catalog;
  const originalCall=s.window.__hydroNativeProbe.call;
  s.window.__hydroNativeProbe.call=(key,...args)=>{
    if(key==='active'&&!s.window.__hydroNativeProbe.F.active)throw Error('Active getter was not registered');
    return originalCall(key,...args);
  };
  vm.runInNewContext(factory,s.ctx);vm.runInNewContext(manager,s.ctx);
  s.engine=s.window.__bobbleWardrobeEngine;s.store=store;return s;
}
let passed=0;
function test(name,fn){fn();passed++;console.log('ok',name);}
test('off by default, no allocations; wrong club untouched',()=>{
  const s=boot();assert.equal(s.engine.state().enabled,false);assert.equal(s.owned.size,0);
  s.engine.assign('Bear','hydro');s.engine.setEnabled(true);assert.equal(s.engine.state().attached,0);assert.equal(s.writes.length,0);s.engine.dispose();
});
test('auto follows resolved club without changing manual assignments; missing team restores',()=>{
  const s=boot();let own='Bull';s.window.__bobbleLocalClubTest=()=>own;
  s.engine.auto('hydro');s.engine.setEnabled(true);assert.equal(s.engine.state().autoClub,'Bull');assert.equal(s.engine.state().attached,1);assert.equal(s.engine.state().assignments.Bull,'original');
  own='Bear';s.advance(1200);assert.equal(s.engine.state().autoClub,'Bear');assert.equal(s.engine.state().attached,0);assert.equal(s.meshes.get(200),400);
  own='';s.advance(1200);assert.equal(s.engine.state().autoClub,'');assert.equal(s.engine.state().attached,0);
  own='Bull';s.advance(1200);assert.equal(s.engine.state().attached,1);s.engine.auto('');assert.equal(s.engine.state().attached,0);assert.equal(s.engine.state().assignments.Bull,'original');s.engine.dispose();
});
test('assign, enable, restore, re-enable and reset',()=>{
  const s=boot();s.engine.assign('Bull','hydro');s.engine.setEnabled(true);
  assert.equal(s.engine.state().counts.Bull,1);assert.equal(s.engine.state().attached,1);
  s.engine.restore();assert.equal(s.meshes.get(200),400);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);
  s.engine.setEnabled(true);assert.equal(s.engine.state().attached,1);
  s.engine.reset();assert.equal(s.engine.state().assignments.Bull,'original');assert.equal(s.owned.size,0);s.engine.dispose();assert.equal(s.timers.size,0);
});
test('switch to original frees resources immediately',()=>{
  const s=boot();s.engine.assign('Bull','hydro');s.engine.setEnabled(true);s.engine.assign('Bull','original');
  assert.equal(s.engine.state().attached,0);assert.equal(s.meshes.get(201),401);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);s.engine.dispose();
});
test('rollback after partial native failure, bounded retries',()=>{
  const s=boot({failSecond:true});s.engine.assign('Bull','hydro');s.engine.setEnabled(true);
  assert.equal(s.engine.state().attached,0);assert.equal(s.meshes.get(200),400);assert.equal(s.owned.size,0);
  assert.equal(s.engine.state().failures.length,1);const count=s.writes.length;s.advance(1200);assert.equal(s.writes.length,count);
  s.engine.retry();assert.equal(s.engine.state().attached,1);s.engine.dispose();assert.equal(s.owned.size,0);
});
test('global waiting expiry has no scene writes',()=>{
  const s=boot({wait:true});s.engine.assign('Bull','hydro');s.engine.setEnabled(true);s.advance(1800001);
  assert.equal(s.engine.state().expired,true);assert.equal(s.engine.state().enabled,false);assert.equal(s.writes.length,0);s.engine.dispose();
  assert.equal(s.engine.state().expired,false,'Explicit restore/dispose clears stale expiry');
});
test('preferences opt-in; disabled on load; unknown entries rejected',()=>{
  const s=boot();s.engine.assign('Bull','hydro');assert.equal(s.store.size,0);s.engine.remember(true);assert.equal(s.store.size,1);
  assert.throws(()=>s.engine.assign('Alien','hydro'),/Unknown/);assert.throws(()=>s.engine.assign('Bear','missing'),/Unknown/);
  s.engine.remember(false);assert.equal(s.store.size,0);s.engine.dispose();
});
test('retired assignment falls back to Original without losing supported choices',()=>{
  const s=boot({saved:{version:1,assignments:{Bull:'nebula',Bear:'hydro'}}});
  assert.equal(s.engine.state().assignments.Bull,'original');
  assert.equal(s.engine.state().assignments.Bear,'hydro');
  assert.equal(s.engine.state().enabled,false);assert.equal(s.engine.state().remember,true);
  assert.match(s.engine.state().storageWarning,/retired skin/);s.engine.dispose();
});
test('storage failure does not block native restoration',()=>{
  const s=boot({storageFail:true});s.engine.remember(true);assert.match(s.engine.state().storageWarning,/could not/);
  s.engine.assign('Bull','hydro');s.engine.setEnabled(true);assert.equal(s.engine.state().attached,1);assert(s.engine.restore());assert.equal(s.owned.size,0);s.engine.dispose();
});
test('future registered skin switches with rollback-safe lifecycle',()=>{
  const s=boot();s.engine.register({id:'future',name:'Future',data});s.engine.assign('Bull','hydro');s.engine.setEnabled(true);
  const old=s.meshes.get(200);s.engine.assign('Bull','future');assert.notEqual(s.meshes.get(200),old);assert.equal(s.engine.state().attached,1);
  assert.throws(()=>s.engine.register({id:'future',name:'duplicate',data}),/duplicate/);s.engine.dispose();assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);
});
test('authored catalog exposes only skins with bundled assets',()=>{
  const catalog=[{id:'hydro',name:'Hydro',description:'Chestnut cap'},{id:'nebula',name:'Nebula',description:'Green jacket'},{id:'missing',name:'Missing',description:'Not bundled'}];
  const s=boot({assets:{hydro:data,nebula:data},catalog});
  assert.equal(s.engine.state().catalog.map(x=>x.id).join(','),'hydro,nebula');
  assert.equal(s.engine.previewData('nebula'),data);
  assert.throws(()=>s.engine.assign('Bull','missing'),/Unknown/);
  s.engine.dispose();
});
test('real Nebula payload is revision 3 with complete palette and parts',()=>{
  const nebula=JSON.parse(fs.readFileSync(path.join(root,'visual-nebula-data.json'),'utf8'));
  assert.equal(nebula.revision,3);assert.equal(nebula.fullGeometry,true);
  assert.equal(Buffer.from(nebula.palette,'base64').length,4096);
  for(const kind of ['head','body','base']){
    const part=nebula.parts[kind];
    assert(part.vertices>0&&part.indices>0);
    assert.equal(Buffer.from(part.position,'base64').length,part.vertices*12);
    assert.equal(Buffer.from(part.normal,'base64').length,part.vertices*12);
    assert.equal(Buffer.from(part.uv,'base64').length,part.vertices*8);
    assert.equal(Buffer.from(part.index,'base64').length,part.indices*2);
  }
});
test('mascot skip releases unused geometry',()=>{
  const s=boot();s.names.set(400,'Body_Snowsgiving');s.engine.assign('Bull','hydro');s.engine.setEnabled(true);
  assert.equal(s.engine.state().attached,0);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);assert.equal(s.writes.length,0);s.engine.dispose();
});
test('scene disappearance restores; next match reattaches',()=>{
  const s=boot();s.engine.assign('Bull','hydro');s.engine.setEnabled(true);
  const find=s.window.__hydroNativeProbe.find;s.window.__hydroNativeProbe.find=()=>0;s.advance(1200);
  assert.equal(s.engine.state().attached,0);assert.equal(s.owned.size,0);
  s.window.__hydroNativeProbe.find=find;s.advance(1200);assert.equal(s.engine.state().attached,1);s.engine.dispose();
});
test('two clubs simultaneously, shared bridge and independent restore',()=>{
  const s=boot(),P=s.window.__hydroNativeProbe,oldCall=P.call;
  for(const [id,name]of [[140,'BODY_GEO'],[141,'HEAD_GEO'],[143,'BALL_GEO'],[142,'Team 7 Bear'],[600,'Body_Female_TeamBear'],[601,'Head_Female01'],[603,'Ball'],[700,'TeamBearMAT'],[701,'TeamBearMAT'],[703,'TeamBearMAT']])s.names.set(id,name);
  for(const [id,mesh]of [[230,600],[231,601],[233,603]])s.meshes.set(id,mesh);
  for(const [id,mat]of [[330,700],[331,701],[333,703]])s.mats.set(id,mat);
  P.call=(k,...a)=>{
    if(k==='childCount'&&a[0]===130)return 3;
    if(k==='child'&&a[0]===130&&a[1]===2)return 142;
    if(k==='childCount'&&a[0]===142)return 3;
    if(k==='child'&&a[0]===142)return [140,141,143][a[1]];
    if(k==='parent'&&a[0]===140)return 142;
    return oldCall(k,...a);
  };
  s.engine.assign('Bull','hydro');s.engine.assign('Bear','hydro');s.engine.setEnabled(true);
  assert.equal(s.engine.state().attached,2);s.engine.assign('Bull','original');assert.equal(s.engine.state().attached,1);
  assert.equal(s.meshes.get(200),400);assert.notEqual(s.meshes.get(230),600);
  s.engine.dispose();assert.equal(s.meshes.get(230),600);assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);
});
assert(!/call\(['"](?:set_position|set_rotation|set_local|SendMessage|BindUnity|set_parent)/.test(manager+factory));
test('restore failure retains resources and blocks new applications until recovered',()=>{
  const s=boot(),P=s.window.__hydroNativeProbe,old=P.call;
  let block=false;
  P.call=(k,...a)=>{if(block&&k==='setMesh'&&a[0]===201&&a[1]===401)throw Error('restore fault');return old(k,...a);};
  s.engine.assign('Bull','hydro');s.engine.setEnabled(true);block=true;
  assert.equal(s.engine.restore(),false);assert(s.owned.size>0);assert(s.pins.size>0);assert.match(s.engine.state().error,/Could not restore/);
  block=false;assert(s.engine.restore());assert.equal(s.owned.size,0);assert.equal(s.pins.size,0);s.engine.dispose();
});
console.log(JSON.stringify({passed,scope:'Mock-native wardrobe lifecycle; not live visual proof'}));
