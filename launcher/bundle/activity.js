// Shared main-world addon bootstrap. No Node/Electron APIs are exposed to the page.
(() => {
  'use strict';
  if(location.origin!=='https://947957217959759964.discordsays.com')return;
  if(window.__wardrobePortableBoot)return;
  const state={phase:'waiting-for-unity',error:'',timer:0,captureCalls:0,captureReturns:0};window.__wardrobePortableBoot=state;
  // BEGIN TRACKER INPUT GUARD
  // Installed BEFORE Unity starts. Shadow DOM retargets inputs to their host;
  // Unity can otherwise prevent normal text entry at window capture time.
  const trackerInputGuard=event=>{
    const target=event.composedPath?.()[0];
    if(target?.getRootNode?.()?.host?.id!=='bobble-power-tracker'||!(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable))return;
    if(event.type==='keydown'&&event.key==='Escape'){
      event.preventDefault();window.__bobblePowerTracker?.editNames?.(false);
    }
    event.stopImmediatePropagation(); // Do NOT prevent normal editing defaults.
  };
  for(const type of ['keydown','keyup','keypress','pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])window.addEventListener(type,trackerInputGuard,true);
  // END TRACKER INPUT GUARD
  const payload=__WARDROBE_PAYLOAD_STRING__;
  let instance=null,creator=null;
  function adopt(value){if(value?.Module){instance=value;window.__blUnity=value;}}
  adopt(window.__blUnity);adopt(window.unityInstance);
  const descriptor=Object.getOwnPropertyDescriptor(window,'createUnityInstance');
  if(!descriptor||descriptor.configurable){
    creator=window.createUnityInstance;
    const wrap=fn=>function(...args){state.captureCalls++;const result=fn.apply(this,args);if(result?.then)result.then(value=>{state.captureReturns++;adopt(value);},()=>{});else adopt(result);return result;};
    if(typeof creator==='function')creator=wrap(creator);
    Object.defineProperty(window,'createUnityInstance',{configurable:true,get:()=>creator,set:fn=>{creator=typeof fn==='function'?wrap(fn):fn;}});
  }
  const started=Date.now();
  function tick(){
    if(Date.now()-started>180000){state.phase='timed-out';clearInterval(state.timer);state.timer=0;return;}
    adopt(window.unityInstance);adopt(window.__blUnity);
    const module=instance?.Module;if(!module?.asm?.ei)return;
    if(typeof module.codeUrl!=='string'||!module.codeUrl.includes('/Prod-590-CL28650/')){
      state.phase='unsupported-build';clearInterval(state.timer);state.timer=0;return;
    }
    clearInterval(state.timer);state.timer=0;
    try{
      (0,eval)(payload);
      state.addons={wardrobe:!!window.__bobbleWardrobe,powerTracker:!!window.__bobblePowerTracker,recorder:!!window.__blReplay};
      const ready=Object.values(state.addons).filter(Boolean).length;
      state.phase=ready===3?'installed':ready?'partial':'failed';
      state.error=[window.__bobbleWardrobeBootError,window.__bobblePowerTrackerError,window.__blReplayBootError].filter(Boolean).join(' | ');
    }
    catch(e){state.phase='failed';state.error=String(e);}
  }
  state.timer=setInterval(tick,250);tick();
})();
