// Wardrobe-only in-process bridge. No TCP ports, tokens, messages, or network hooks.
'use strict';
const {app,webContents}=require('electron');
const fs=require('node:fs'),path=require('node:path');
function report(phase,extra={}){try{fs.writeFileSync(path.join(__dirname,'bridge-status.json'),JSON.stringify({phase,electron:process.versions.electron,...extra}));}catch{}}
report('bridge-loaded');
const origin='https://947957217959759964.discordsays.com';
const allowed=url=>{try{return new URL(url).origin===origin;}catch{return false;}};
const payload=fs.readFileSync(path.join(__dirname,'wardrobe-live.js'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'activity.js'),'utf8').replace('__WARDROBE_PAYLOAD_STRING__',()=>JSON.stringify(payload));
// Fixed, read-only health probe. No commands, account fields, URLs, or game state.
const health=`(()=>{if(location.origin!==${JSON.stringify(origin)})return null;
 const b=window.__wardrobePortableBoot,m=window.__blUnity?.Module;
 return {phase:b?.phase||'bootstrap-missing',unity:!!window.__blUnity,module:!!m,
 table:!!m?.asm?.ei,creator:typeof window.createUnityInstance,
 captureCalls:b?.captureCalls||0,captureReturns:b?.captureReturns||0,
 supported:typeof m?.codeUrl==='string'&&m.codeUrl.includes('/Prod-590-CL28650/'),
 wardrobe:!!window.__bobbleWardrobe,engine:!!window.__bobbleWardrobeEngine,
 error:b?.error?String(b.error).slice(0,240):''};})()`;
const watched=new WeakSet();
function attach(wc){
  if(watched.has(wc)||wc.isDestroyed())return;watched.add(wc);
  const registered=new Set(),targets=new Map();let ownedDebugger=false;
  const probes=new Map();
  const send=(method,args={},sid)=>wc.debugger.sendCommand(method,args,sid);
  const autoAttach={autoAttach:true,waitForDebuggerOnStart:false,flatten:true,
    filter:[{type:'iframe',exclude:false},{exclude:true}]};
  async function register(sid){
    const key=sid||'root';
    if(!registered.has(key)){
      await send('Page.enable',{},sid);
      // This hook returns before doing anything on every non-Bobble origin.
      await send('Page.addScriptToEvaluateOnNewDocument',{source,runImmediately:true},sid);registered.add(key);
    }
  }
  async function recoverUnity(sid){
    // The shipped main.b8047c508edb52474ddf.js exposes this bound callback.
    // Inspect ONLY the function's bound receiver, then select unityInstance.
    // Never enumerate the receiver (it also contains unrelated account fields).
    const objectGroup='bobble-wardrobe-capture-'+(sid||wc.id||'root');
    try{
      const callback=await send('Runtime.evaluate',{expression:`location.origin===${JSON.stringify(origin)}?window.UnityInterfaceReady:undefined`,objectGroup,returnByValue:false},sid);
      const objectId=callback.result?.objectId;
      if(callback.result?.type!=='function'||!objectId)return false;
      const properties=await send('Runtime.getProperties',{objectId,ownProperties:true},sid);
      const receiver=properties.internalProperties?.find(p=>p.name==='[[BoundThis]]')?.value?.objectId;
      if(!receiver)return false;
      const adopted=await send('Runtime.callFunctionOn',{objectId:receiver,returnByValue:true,
        functionDeclaration:`function(){if(location.origin!==${JSON.stringify(origin)})return false;
          const u=this.unityInstance,m=u?.Module;
          if(!m||typeof m.codeUrl!=='string'||!m.codeUrl.includes('/Prod-590-CL28650/')||!m.asm?.ei)return false;
          window.__blUnity=u;return true;}`},sid);
      return adopted.result?.value===true;
    }finally{await send('Runtime.releaseObjectGroup',{objectGroup},sid).catch(()=>{});}
  }
  function probe(sid){
    const key=sid||'root';if(probes.has(key))return;
    let remaining=30;
    const timer=setInterval(async()=>{
      if(wc.isDestroyed()||--remaining<0){clearInterval(timer);probes.delete(key);return;}
      try{
        const result=await send('Runtime.evaluate',{expression:health,returnByValue:true},sid);
        const value=result.result?.value;
        if(value?.phase==='waiting-for-unity'&&!value.unity)await recoverUnity(sid).catch(()=>{});
        if(value)report('activity-health',{health:value});
        if(value&&['installed','failed','unsupported-build','timed-out'].includes(value.phase)){
          clearInterval(timer);probes.delete(key);
        }
      }catch{clearInterval(timer);probes.delete(key);}
    },2000);timer.unref?.();probes.set(key,timer);
  }
  async function inject(sid,url){
    if(!allowed(url))return;
    await register(sid);
    const response=await send('Runtime.evaluate',{expression:source,returnByValue:true},sid);
    if(response.exceptionDetails)throw Error('Wardrobe bootstrap evaluation failed');
    report('activity-bootstrap-delivered');
    await recoverUnity(sid).catch(()=>{});
    probe(sid);
  }
  // Do not take ownership of or detach a debugger installed by another tool.
  if(wc.debugger.isAttached()){
    const visit=frame=>{try{if(allowed(frame.url))frame.executeJavaScript(source).catch(()=>{});for(const child of frame.frames)visit(child);}catch{}};
    wc.on('did-frame-finish-load',()=>visit(wc.mainFrame));visit(wc.mainFrame);return;
  }
  try{wc.debugger.attach('1.3');ownedDebugger=true;}catch{return;}
  wc.debugger.on('message',(_event,method,params,sid)=>{
    if(method==='Target.attachedToTarget'){
      targets.set(params.targetInfo.targetId,params.sessionId);
      (async()=>{
        const resume=()=>send('Runtime.runIfWaitingForDebugger',{},params.sessionId).catch(()=>{});
        // Fail open if Chromium does not answer a registration command.
        const watchdog=params.waitingForDebugger?setTimeout(resume,1500):null;
        try{
          if(params.targetInfo.type==='iframe')await register(params.sessionId);
          await send('Target.setAutoAttach',autoAttach,params.sessionId);
        }catch{report('activity-registration-failed');}
        finally{
          // Resume every target, including unrelated origins and failed registration.
          // No gameplay ticks, inputs, game memory, or physics are paused/modified.
          if(watchdog!==null)clearTimeout(watchdog);
          if(params.waitingForDebugger)await resume();
        }
        await inject(params.sessionId,params.targetInfo.url).catch(()=>{});
      })();
    }else if(method==='Target.targetInfoChanged'){
      const info=params.targetInfo;const child=targets.get(info.targetId);if(child)inject(child,info.url).catch(()=>{});
    }else if(method==='Page.frameNavigated'){
      // Reloads can retain the same target/session and URL. Re-arm recovery for
      // the new document instead of relying only on target-creation events.
      if(allowed(params.frame?.url))inject(sid,params.frame.url).catch(()=>{});
    }else if(method==='Target.detachedFromTarget'){
      if(probes.has(params.sessionId)){clearInterval(probes.get(params.sessionId));probes.delete(params.sessionId);}
      registered.delete(params.sessionId);for(const [id,session]of targets)if(session===params.sessionId)targets.delete(id);
    }
  });
  send('Target.setDiscoverTargets',{discover:true}).catch(()=>{});
  send('Target.setAutoAttach',autoAttach).catch(()=>{report('early-capture-unavailable');});
  send('Target.getTargets').then(async ({targetInfos=[]})=>{
    for(const target of targetInfos.filter(t=>allowed(t.url)))try{
      const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
      targets.set(target.targetId,sessionId);await inject(sessionId,target.url);
    }catch{}
  }).catch(()=>{});
  if(allowed(wc.getURL()))inject(undefined,wc.getURL()).catch(()=>{});
  wc.on('did-navigate',(_e,url)=>{if(ownedDebugger)inject(undefined,url).catch(()=>{});});
  wc.on('destroyed',()=>{for(const timer of probes.values())clearInterval(timer);probes.clear();});
}
app.on('web-contents-created',(_event,wc)=>attach(wc));
app.whenReady().then(()=>{report('electron-ready');webContents.getAllWebContents().forEach(attach);});
