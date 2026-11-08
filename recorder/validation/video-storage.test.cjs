// Synthetic-time hour test: 2.7 GB accounted, never allocated. Separate small
// OPFS-adapter tests exercise actual Blob writes/close/recovery with a fake FS.
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const {create:createStore}=require('../replay_lab/video_store.js'),{create}=require('../replay_lab/video.js');
const tick=()=>new Promise(r=>setImmediate(r));let checks=0;
function filesystem(){
 const entries=new Map();let fail=false;
 const dir={async getDirectoryHandle(){return dir;},async getFileHandle(name,opts){
  if(!entries.has(name)){if(!opts?.create)throw Object.assign(Error('missing'),{name:'NotFoundError'});entries.set(name,new Blob());}
  return {kind:'file',async getFile(){return new File([entries.get(name)],name);},async createWritable(){let parts=[];return {async write(data){if(fail)throw Error('quota exceeded');parts.push(data);},async close(){entries.set(name,new Blob(parts));},async abort(){parts=[];}};}};
 },async removeEntry(name){if(!entries.delete(name))throw Object.assign(Error('missing'),{name:'NotFoundError'});},async *entries(){for(const name of entries.keys())yield [name,await dir.getFileHandle(name)];}};
 const navigator={storage:{getDirectory:async()=>dir,estimate:async()=>({quota:16*1073741824,usage:0}),persisted:async()=>false,persist:async()=>true}};
 return {navigator,entries,setFail:v=>fail=v};
}
function record(){return {id:'unused',title:'Long match',file:'bobble-test',created:Date.now(),duration:3600,marks:[{t:3500,label:'Late moment'}],fps:30,width:1280,height:720,warnings:[],partial:true,downloaded:false};}
async function main(){
 const fs=filesystem(),store=createStore({navigator:fs.navigator,crypto});await store.ready;assert(store.status().available);checks++;
 const sink=await store.open();await sink.append(new Blob(['encoded'.repeat(40)]));const row=record(),result=await sink.finish(row,'private-local-owner');
 assert(result.blob.size>100);assert.equal(sink.stats().queuedBytes,0);checks+=2;
 assert.equal((await store.load('another-owner')).length,0);assert.equal((await store.load('private-local-owner')).length,1);checks+=2;
 const manifest=await fs.entries.get(result.id+'.json').text();assert(!manifest.includes('private-local-owner'));assert(!manifest.includes('context'));checks+=2;
 const reload=createStore({navigator:fs.navigator,crypto});const recovered=await reload.load('private-local-owner');assert.equal(recovered[0].duration,3600);assert.equal(recovered[0].marks[0].t,3500);checks+=2;
 const corrupt=JSON.parse(manifest);corrupt.width=999999;fs.entries.set(result.id+'.json',new Blob([JSON.stringify(corrupt)]));assert.equal((await reload.load('private-local-owner')).length,0);fs.entries.set(result.id+'.json',new Blob([manifest]));checks++;
 const other=await store.open();await other.append(new Blob(['incomplete'.repeat(30)]));assert.equal((await reload.load('private-local-owner')).length,1);await other.abort();assert(!fs.entries.has(other.id+'.webm'));checks+=2;
 const broken=await store.open();fs.setFail(true);await assert.rejects(broken.append(new Blob(['data'])),/quota/);await assert.rejects(broken.finish(record(),'owner'),/quota/);fs.setFail(false);assert(!(await fs.entries.get(broken.id+'.webm').text()).length);checks+=3;
 const full=await store.open();await assert.rejects(full.append({size:33*1048576}),/32 MB/);await full.abort();checks++;
 const metaFailure=await store.open();await metaFailure.append(new Blob(['verified-video'.repeat(30)]));fs.setFail(true);const retained=await metaFailure.finish(record(),'metadata-owner');fs.setFail(false);assert(retained.blob.size>100&&retained.recoveryWarning.includes('Download'));assert.equal((await store.load('metadata-owner')).length,0);await store.remove(retained.id);checks+=2;
 const update=store.update(Object.assign({},row,{title:'Renamed'}),'private-local-owner');await store.remove(result.id);await update;assert.equal((await store.load('private-local-owner')).length,0);await assert.rejects(store.update(row,'private-local-owner'),/removed/);assert((await store.persist()).persistent);checks+=3;
 const unavailable=createStore({navigator:{storage:{getDirectory:async()=>{throw Error('denied');}}},crypto});await unavailable.ready;assert(!unavailable.status().available&&unavailable.status().error.includes('denied'));checks++;
 // Stress the optional 6-Mbps preset, beyond the compact default.
 let time=0,encoder,captures=0,written=0;
 const track={stop(){}},stream={getTracks:()=>[track],getVideoTracks:()=>[track],getAudioTracks:()=>[]};
 class Encoder{static isTypeSupported(){return true;}constructor(){encoder=this;this.state='inactive';}start(){this.state='recording';captures++;}stop(){this.state='inactive';this.onstop();}}
 const storage={status:()=>({ready:true,available:true,persistent:true,quota:16*1073741824,usage:0}),persist:async()=>{},load:async()=>[],open:async()=>({append:async b=>{written+=b.size;},abort:async()=>{},finish:async row=>({id:'video-synthetic-hour',blob:{size:written,type:'video/webm'}})})};
 const r=create({storage,now:()=>time,MediaRecorder:Encoder,canvas:()=>({width:1280,height:720,captureStream:()=>stream})});
 r.configure({mbps:6});
 const sample={phase:'active',role:'player',identity:'owner',context:'hour-match'};r.arm(true);r.observe(sample);await tick();
 for(let i=0;i<3600;i++){time+=1000;r.observe(sample);encoder.ondataavailable({data:{size:750000}});await Promise.resolve();await Promise.resolve();}
 await tick();const status=r.status();assert.equal(status.capturedSeconds,3600);assert.equal(captures,1);assert.equal(status.bytes,2700000000);assert.equal(status.chunks,0);assert(status.peakQueuedBytes<=1500000);assert.equal(status.memoryBytes,0);assert(!status.canView);checks+=7;
 r.observe({...sample,phase:'completed',role:'former-player',winner:0,endReason:0});time+=2100;r.observe({...sample,phase:'idle',role:'former-player'});await tick();
 assert.equal(r.status().savedCount,1);assert(r.status().recordings[0].bytes>2.5*1073741824);assert.equal(r.recording(r.status().recordings[0].id).duration,3600);checks+=3;
 r.dispose();
 // A stalled writer stops at the queue ceiling, preserves a contiguous prefix,
 // and cannot publish even that prefix until the observed match actually ends.
 let resolvers=[],slowWrites=[],slowBytes=0;
 const slow=Object.assign({},storage,{open:async()=>({append:b=>{slowBytes+=b.size;const task=new Promise(resolve=>resolvers.push(resolve));slowWrites.push(task);return task;},abort:async()=>{resolvers.forEach(f=>f());},finish:async()=>{await Promise.all(slowWrites);return {id:'video-slow-disk',blob:{size:slowBytes,type:'video/webm'}};}})});
 const bounded=create({storage:slow,now:()=>time,MediaRecorder:Encoder,canvas:()=>({width:1280,height:720,captureStream:()=>stream})});bounded.arm(true);bounded.observe(sample);await tick();
 for(let i=0;i<40;i++){time+=50;bounded.observe(sample);encoder.ondataavailable({data:{size:1048576}});}
 assert.equal(bounded.status().state,'paused');assert.equal(bounded.status().bytes,32*1048576);assert.equal(bounded.status().memoryBytes,32*1048576);assert(!bounded.status().canView);assert(bounded.status().warnings.some(w=>w.includes('incomplete')));checks+=5;
 resolvers.forEach(f=>f());await tick();assert.equal(bounded.status().memoryBytes,0);assert(!bounded.status().canView);checks+=2;bounded.dispose();
 console.log(`${checks} disk spool/recovery/bounded-queue checks passed, including a simulated 60-minute 6-Mbps capture (2.7 GB; encoded chunk RAM queue <=1.5 MB). Not a real-time game soak.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
