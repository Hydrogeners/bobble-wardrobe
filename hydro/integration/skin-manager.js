// Native adapter and UI-independent state machine. No gameplay writes.
(() => {
  'use strict';
  if(window.__bobbleWardrobeEngine)return;
  const clubs=['Bear','Tiger','Bull','Dino','Hawk','Pig','Bug'];
  const P=window.__hydroNativeProbe;
  // Scanning runs before a visual controller exists on a fresh injection.
  // Do not rely on the controller's later signature registration.
  const active=P.T.get(18790);
  if(!active||active.name!=='1825'||active.length!==2)throw Error('Active-state signature mismatch');
  P.F.active=active;
  const skinCatalog=Array.isArray(window.__bobbleSkinCatalog)?window.__bobbleSkinCatalog:[{id:'hydro',name:'Hydro',description:'Chestnut cap, glasses & tailored coat'}];
  const registry=new Map(skinCatalog.filter(s=>s&&window.__bobbleSkinAssets?.[s.id]).map(s=>[s.id,{id:s.id,name:s.name,description:s.description,data:window.__bobbleSkinAssets[s.id]}]));
  const storageKey='bobble-wardrobe.preferences.v1';
  const listeners=new Set(),attached=new Map(),failures=new Map();
  let enabled=false,remember=false,disposed=false,error='',timer=0,busy=false;
  let started=Date.now(),everAttached=false,expired=false,storageWarning='';
  let assignments=Object.fromEntries(clubs.map(c=>[c,'original']));
  let autoSkin='',autoClub='';
  // Indexes are the verified NetGameCG6 club catalog order, not match sides.
  const clubById=['Bug','Hawk','Bear','Tiger','Pig','Bull','Dino','SnowMan'];
  function localClub(targets){
    if(typeof window.__bobbleLocalClubTest==='function')return window.__bobbleLocalClubTest(targets);
    const f=P.T.get(7471);if(!f||f.name!=='18429'||f.length!==2)return '';
    const go=P.find('ClientGameContext'),ctx=go&&P.component(go,'GameContext_Shared');if(!ctx)return '';
    const stack=P.M.stackSave();let team;try{team=f(ctx,0);}finally{P.M.stackRestore(stack);}
    if(team!==0&&team!==1)return '';
    const id=P.M.HEAP32[(ctx+(team===0?44:48))>>2];if(!Number.isInteger(id)||id<0||id>=clubById.length)return '';
    const club=clubById[id];return clubs.includes(club)&&targets.some(t=>t.club===club)?club:'';
  }
  function wanted(club){return autoSkin&&club===autoClub?autoSkin:assignments[club];}
  const normalize=s=>({Hawks:'Hawk',Pigs:'Pig'}[s]||s);
  function save(){
    try{
      if(remember)localStorage.setItem(storageKey,JSON.stringify({version:1,assignments}));
      else localStorage.removeItem(storageKey);
      storageWarning='';
    }catch(e){storageWarning='Preferences could not be saved. This session still works.';}
  }
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved?.version===1){
      remember=true;
      for(const club of clubs)if(saved.assignments?.[club]==='original'||registry.has(saved.assignments?.[club]))assignments[club]=saved.assignments[club];
    }
  }catch(e){storageWarning='Saved preferences were unavailable; using defaults.';}
  function scan(){
    const visuals=P.find('Visuals');if(!visuals)return [];
    const queue=[P.call('transform',visuals)],found=[],seen=new Set();
    while(queue.length&&seen.size<2000){
      const t=queue.shift();if(!t||seen.has(t))continue;seen.add(t);
      const go=P.call('gameObject',t);if(!P.call('active',go))continue;
      const match=/^Team \d+ (Bear|Tiger|Bull|Dino|Hawk|Hawks|Pig|Pigs|Bug)$/.exec(P.name(t));
      if(match)found.push({root:t,label:P.name(t),club:normalize(match[1])});
      const n=P.call('childCount',t);if(n>70)continue;
      for(let i=0;i<n;i++)queue.push(P.call('child',t,i));
    }
    return found;
  }
  function release(root){
    const row=attached.get(root);if(!row)return true;
    const result=row.controller.restore();
    if(result.phase!=='restored'){
      error='Could not restore '+row.label+'. Use Restore all again; native references are retained.';
      return false;
    }
    attached.delete(root);return true;
  }
  function restoreAll(){let ok=true;for(const root of [...attached.keys()])if(!release(root))ok=false;return ok;}
  function state(){
    const counts=Object.fromEntries(clubs.map(c=>[c,0]));let waiting=0;
    for(const row of attached.values()){
      const s=row.controller.status();if(s.attached)counts[row.club]++;else waiting++;
    }
    return {enabled,remember,assignments:{...assignments},autoSkin,autoClub,counts,waiting,attached:Object.values(counts).reduce((a,b)=>a+b,0),
      error,storageWarning,expired,disposed,catalog:[...registry.values()].map(({id,name,description})=>({id,name,description})),
      failures:[...failures.values()].map(x=>x.message)};
  }
  function notify(){const s=state();for(const fn of listeners)try{fn(s);}catch(e){console.warn('Wardrobe panel update failed',e);}}
  function reconcile(){
    if(disposed||busy)return;busy=true;
    try{
      if(enabled&&!everAttached&&Date.now()-started>1800000){enabled=false;expired=true;}
      if(!enabled){restoreAll();return;}
      const targets=scan(),roots=new Map(targets.map(t=>[t.root,t]));autoClub=autoSkin?localClub(targets):'';
      for(const [root,row]of [...attached]){
        const target=roots.get(root);
        if(!target||target.club!==row.club||wanted(row.club)!==row.skin||['failed-restored','restore-error','expired'].includes(row.controller.status().phase))release(root);
      }
      // A restore error blocks new native writes, rather than piling up swaps.
      if(error)return;
      for(const target of targets){
        const skin=wanted(target.club);
        if(skin==='original'||attached.has(target.root)||failures.has(target.root))continue;
        let controller;
        try{
          controller=window.__bobbleCreateVisual({root:target.root,data:registry.get(skin).data});
          const row={...target,skin,controller};attached.set(target.root,row);
          const result=controller.arm();
          if(result.phase==='active'&&result.attached)everAttached=true;
          else if(result.phase==='armed'){
            // Mascot/seasonal rigs are not supported; don't retain idle mesh allocations.
            if(release(target.root))failures.set(target.root,{club:target.club,message:target.label+': no compatible human rig.'});
          }else{
            if(release(target.root))failures.set(target.root,{club:target.club,message:target.label+': '+(result.error||result.phase)});
          }
        }catch(e){
          if(controller&&!release(target.root))break;
          failures.set(target.root,{club:target.club,message:target.label+': '+String(e)});
        }
      }
      for(const root of failures.keys())if(!roots.has(root))failures.delete(root);
    }catch(e){enabled=false;error='Skin update stopped: '+String(e);restoreAll();}
    finally{busy=false;notify();}
  }
  function setEnabled(value){
    if(disposed)return;
    if(value){error='';failures.clear();started=Date.now();expired=false;everAttached=false;}
    enabled=!!value;reconcile();return state();
  }
  function assign(club,skin){
    if(!clubs.includes(club)||skin!=='original'&&!registry.has(skin))throw Error('Unknown club or skin');
    assignments[club]=skin;for(const [root,row]of failures)if(row.club===club)failures.delete(root);
    save();reconcile();return state();
  }
  function restore(){enabled=false;expired=false;error='';const ok=restoreAll();notify();return ok;}
  function assignAll(skin){
    if(skin!=='original'&&!registry.has(skin))throw Error('Unknown skin');
    for(const club of clubs)assignments[club]=skin;
    failures.clear();save();reconcile();return state();
  }
  function reset(){if(!restore())return false;autoSkin='';autoClub='';assignments=Object.fromEntries(clubs.map(c=>[c,'original']));failures.clear();save();notify();return true;}
  function key(e){if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.code==='KeyH'){e.preventDefault();restore();}}
  function dispose(){if(!restore())return false;disposed=true;clearInterval(timer);window.removeEventListener('keydown',key,true);listeners.clear();return true;}
  // Migrate only after all signatures/preflight have succeeded; never reload the activity.
  if(window.__hydroModel){
    const old=window.__hydroModel.status(),club=normalize(/^Team \d+ (\w+)$/.exec(old.target||'')?.[1]);
    const result=window.__hydroModel.restore();if(result.phase!=='restored')throw Error('Previous cosmetic could not be restored');
    delete window.__hydroModel;
    if(!remember&&clubs.includes(club))assignments[club]='hydro';
    enabled=!!old.attached;
  }
  window.addEventListener('keydown',key,true);
  timer=setInterval(reconcile,1200);
  window.__bobbleWardrobeEngine=Object.freeze({clubs,state,setEnabled,assign,assignAll,restore,reset,auto(skin){if(skin&&!registry.has(skin))throw Error('Unknown skin');autoSkin=skin||'';autoClub='';failures.clear();reconcile();return state();},retry(){failures.clear();error='';reconcile();},
    remember(value){remember=!!value;save();notify();},subscribe(fn){listeners.add(fn);fn(state());return()=>listeners.delete(fn);},
    previewData(id){return registry.get(id)?.data||null;},
    register(skin){
      if(!skin||!/^[a-z][a-z0-9-]{0,40}$/.test(skin.id)||registry.has(skin.id)||!skin.name||!skin.data?.fullGeometry||skin.data.revision!==3)throw Error('Invalid or duplicate skin');
      registry.set(skin.id,{id:skin.id,name:String(skin.name).slice(0,64),description:String(skin.description||'').slice(0,160),data:skin.data});notify();
    },dispose,reconcile});
  reconcile();
})();
