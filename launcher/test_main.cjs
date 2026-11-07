// Transport tests with mocked Electron. Not a native activity/gameplay pass.
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8');
const origin='https://947957217959759964.discordsays.com';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(attached=false){
  const app=new EventEmitter();app.whenReady=()=>Promise.resolve();
  const wc=new EventEmitter();wc.isDestroyed=()=>false;wc.getURL=()=> 'https://discord.com/app';
  const calls=[],executed=[],reports=[];
  wc.mainFrame={url:'https://discord.com/app',frames:[
    {url:origin+'/frame',frames:[],executeJavaScript:async text=>executed.push(text)},
    {url:origin+'.evil.invalid/frame',frames:[],executeJavaScript:async()=>{throw Error('Spoof frame executed');}}
  ]};
  wc.debugger=new EventEmitter();wc.debugger.isAttached=()=>attached;
  wc.debugger.attach=version=>calls.push({method:'attach',version});
  wc.debugger.sendCommand=async(method,args,sid)=>{
    calls.push({method,args,sid});
    if(method==='Target.getTargets')return {targetInfos:[]};
    return {};
  };
  const modules={electron:{app,webContents:{getAllWebContents:()=>[wc]}},
    'node:fs':{readFileSync:file=>file.endsWith('activity.js')?'__WARDROBE_PAYLOAD_STRING__':'// wardrobe fixture',writeFileSync:(_file,text)=>reports.push(JSON.parse(text))},'node:path':path};
  vm.runInNewContext(source,{require:name=>{assert(name in modules);return modules[name];},__dirname,URL,setTimeout,clearTimeout,setInterval:()=>({unref(){}}),clearInterval:()=>{},process:{versions:{electron:'test'}}});
  return {app,wc,calls,executed,reports};
}
(async()=>{
  const f=fixture();await flush();
  assert.equal(f.calls.filter(c=>c.method==='attach').length,1);
  f.app.emit('web-contents-created',null,f.wc);await flush();
  assert.equal(f.calls.filter(c=>c.method==='attach').length,1,'install once per webContents');
  assert(!f.calls.some(c=>c.method==='Runtime.evaluate'),'do not evaluate Discord main page');
  const target=(url,id,sid)=>f.wc.debugger.emit('message',null,'Target.attachedToTarget',{targetInfo:{targetId:id,url},sessionId:sid});
  target(origin+'.evil.invalid/frame','bad','bad-session');await flush();
  assert(!f.calls.some(c=>c.method==='Runtime.evaluate'));
  target(origin+'/frame','game','game-session');await flush();
  assert(f.calls.some(c=>c.method==='Runtime.evaluate'&&c.sid==='game-session'));
  assert(f.calls.some(c=>c.method==='Page.addScriptToEvaluateOnNewDocument'&&c.sid==='game-session'));
  f.wc.debugger.emit('message',null,'Target.targetInfoChanged',{targetInfo:{targetId:'game',url:origin+'/reopened'}});await flush();
  assert.equal(f.calls.filter(c=>c.method==='Page.addScriptToEvaluateOnNewDocument').length,1);
  const coexist=fixture(true);await flush();
  assert.equal(coexist.calls.length,0,'do not take over an existing debugger');
  assert.equal(coexist.executed.length,1,'existing-debugger fallback is activity-only');
  const early=fixture();await flush();
  early.wc.debugger.emit('message',null,'Target.attachedToTarget',{targetInfo:{targetId:'early',url:origin+'/frame',type:'iframe'},sessionId:'early-session',waitingForDebugger:true});await flush();
  const registration=early.calls.findIndex(c=>c.method==='Page.addScriptToEvaluateOnNewDocument');
  const resume=early.calls.findIndex(c=>c.method==='Runtime.runIfWaitingForDebugger');
  assert(registration>=0&&resume>registration,'register early hook before resuming new iframe');
  assert(early.calls[registration].args.runImmediately,'also cover current document at startup');
  const unrelated=fixture();await flush();
  unrelated.wc.debugger.emit('message',null,'Target.attachedToTarget',{targetInfo:{targetId:'other',url:'https://unrelated.invalid/',type:'iframe'},sessionId:'other-session',waitingForDebugger:true});await flush();
  assert(unrelated.calls.some(c=>c.method==='Runtime.runIfWaitingForDebugger'),'never leave other frames waiting');
  assert(!unrelated.calls.some(c=>c.method==='Runtime.evaluate'),'do not inspect unrelated frame content');
  const recovery=fixture();await flush();
  recovery.wc.debugger.sendCommand=async(method,args,sid)=>{
    recovery.calls.push({method,args,sid});
    if(method==='Runtime.evaluate'&&args.expression.includes('UnityInterfaceReady'))return {result:{type:'function',objectId:'callback'}};
    if(method==='Runtime.getProperties')return {internalProperties:[{name:'[[BoundThis]]',value:{objectId:'unity-host'}}]};
    if(method==='Runtime.callFunctionOn')return {result:{value:true}};
    return {};
  };
  recovery.wc.debugger.emit('message',null,'Target.attachedToTarget',{targetInfo:{targetId:'loaded-game',url:origin+'/frame',type:'iframe'},sessionId:'loaded-game-session'});await flush();
  const propertyReads=recovery.calls.filter(c=>c.method==='Runtime.getProperties');
  assert.equal(propertyReads.length,1);assert.equal(propertyReads[0].args.objectId,'callback','inspect bound function only, not host properties');
  assert(recovery.calls.some(c=>c.method==='Runtime.callFunctionOn'&&c.args.objectId==='unity-host'&&c.args.functionDeclaration.includes('const u=this.unityInstance')));
  assert(recovery.calls.some(c=>c.method==='Runtime.releaseObjectGroup'),'release temporary CDP handles');
  const beforeReload=recovery.calls.filter(c=>c.method==='Runtime.callFunctionOn').length;
  recovery.wc.debugger.emit('message',null,'Page.frameNavigated',{frame:{url:origin+'/frame'}},'loaded-game-session');await flush();
  assert(recovery.calls.filter(c=>c.method==='Runtime.callFunctionOn').length>beforeReload,'re-run recovery on same-target reload');
  console.log('PASS: bridge origin filtering, child session injection, reopen registration, install-once, debugger coexistence (mock Electron)');
})().catch(error=>{console.error(error);process.exitCode=1;});
