// Session-only cosmetic accent. Never edits shared materials or planning state.
(() => {
  'use strict';
  // Quarantined after reports of intermittent in-game teal artifacts. Preview
  // color editing remains available; reinjection must not silently re-enable it.
  if(window.__bobbleIndicatorAccentsEnabled!==true)return JSON.stringify({disabled:true,reason:'Native indicator colors paused pending pooled-renderer verification'});
  if(window.__hydroAimAccent)return JSON.stringify(window.__hydroAimAccent.status());
  const P=window.__hydroNativeProbe,E=window.__bobbleWardrobeEngine;
  if(!P||!E)throw Error('Wardrobe required');
  const specs={getColor:[17624,20303,4],setColor:[17622,20305,4],id:[17268,570,2],world:[19150,18836,3]};
  const F={};for(const [k,[slot,index,arity]]of Object.entries(specs)){const f=P.T.get(slot);if(!f||f.name!==String(index)||f.length!==arity)throw Error('Accent signature mismatch: '+k);F[k]=f;}
  const call=(k,...args)=>{const s=P.M.stackSave();try{return F[k](...args,0);}finally{P.M.stackRestore(s);}};
  const changes=new Map();let error='',disposed=false,timer=0;
  const rgb=[0.10,0.64,0.72];
  function chosenColor(){const hex=window.__bobbleAccentSettings?.arrow;if(!hex)return rgb;if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Invalid aiming accent');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
  function restore(r,row){
    try{if(P.call('exists',r)&&P.call('material',r)===row.clone){P.call('setMaterial',r,row.original);if(P.call('material',r)!==row.original)throw Error('Accent restore mismatch');}
      P.call('destroy',row.clone);for(const h of row.handles)P.call('unpin',h);changes.delete(r);return true;
    }catch(e){error=String(e);return false;}
  }
  function reset(){for(const [r,row]of changes)restore(r,row);}
  function position(t){const p=P.M._malloc(12);if(!p)throw Error('Accent position allocation failed');try{call('world',t,p);return Array.from(P.M.HEAPF32.subarray(p/4,p/4+3));}finally{P.M._free(p);}}
  function scan(){
    const roots=[],arrows=[],hydros=[],v=P.find('Visuals'),g=P.find('Globals(Clone)');
    if(v)roots.push(P.call('transform',v));if(g)roots.push(P.call('transform',g));
    const seen=new Set(),queue=roots;let count=0;
    while(queue.length&&count++<5000){const t=queue.shift();if(seen.has(t))continue;seen.add(t);const go=P.call('gameObject',t);if(!P.call('active',go))continue;
      const name=P.name(t);
      if(name==='BODY_GEO'){const f=P.component(go,'MeshFilter');if(f&&P.name(P.call('mesh',f))==='HYDRO test body')hydros.push(position(t));}
      if(name==='Aim'){const parent=P.call('parent',t),pn=P.name(parent);
        // Editable and placed ally arrows; never opponent or pooled arrows.
        if(/^(?:MoveArrowWith(?:Handle|WithoutHandle)Visuals|MoveArrowQueuedAllyVisuals)\(Clone\)$/.test(pn)){
          let a=parent,inPlan=false;for(let i=0;a&&i<12;i++,a=P.call('parent',a)){const n=P.name(a);if(n==='PoolRoot')break;if(n==='C_Plan'){inPlan=true;break;}}
          const r=P.component(go,'SkinnedMeshRenderer');if(inPlan&&r)arrows.push({r,position:position(parent)});
        }
      }
      if(name==='UISetup'||name==='PrefabPoolManager')continue;
      const n=P.call('childCount',t);if(n>100)continue;for(let i=0;i<n;i++)queue.push(P.call('child',t,i));
    }
    return arrows.filter(a=>hydros.some(p=>Math.hypot(p[0]-a.position[0],p[2]-a.position[2])<.75));
  }
  function tick(){if(disposed)return;try{
    const next=chosenColor();if(next.some((v,i)=>v!==rgb[i])){reset();rgb.splice(0,3,...next);}
    const state=E.state();if(!state.enabled||state.disposed){reset();if(state.disposed&&!changes.size)window.__hydroAimAccent.dispose();return;}
    const targets=scan(),live=new Set(targets.map(x=>x.r));for(const [r,row]of changes)if(!live.has(r))restore(r,row);
    if(error)return;
    for(const {r}of targets){if(changes.has(r))continue;const original=P.call('material',r);if(!['AimMAT','AimQueuedAllyMAT'].includes(P.name(original)))continue;
      const handles=[];let clone=0;
      try{for(const p of [r,original])handles.push(P.call('pin',p));clone=P.call('clone',original);if(!clone)throw Error('Accent clone failed');handles.push(P.call('pin',clone));
        const row={original,clone,handles};changes.set(r,row);
        const scratch=P.M._malloc(16);if(!scratch)throw Error('Accent color allocation failed');
        try{for(const name of ['_BaseColor','_Color']){const id=P.withString(name,s=>call('id',s));call('getColor',original,id,scratch);const alpha=P.M.HEAPF32[scratch/4+3];P.M.HEAPF32.set([...rgb,alpha],scratch/4);call('setColor',clone,id,scratch);call('getColor',clone,id,scratch);if(rgb.some((x,i)=>Math.abs(x-P.M.HEAPF32[scratch/4+i])>.001))throw Error('Accent color readback failed');}}finally{P.M._free(scratch);}
        P.call('setMaterial',r,clone);if(P.call('material',r)!==clone)throw Error('Accent assignment failed');
      }catch(e){if(changes.has(r))restore(r,changes.get(r));else{if(clone)P.call('destroy',clone);for(const h of handles)P.call('unpin',h);}throw e;}
    }
  }catch(e){error=String(e);reset();}}
  const unsubscribe=E.subscribe(s=>{if(!s.enabled||s.disposed)reset();});
  function key(e){if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.code==='KeyH')reset();}
  window.addEventListener('keydown',key,true);timer=setInterval(tick,150);
  window.__hydroAimAccent=Object.freeze({status:()=>({attached:changes.size,error,color:rgb,disposed}),restore:reset,dispose(){reset();if(changes.size)return false;disposed=true;clearInterval(timer);unsubscribe();window.removeEventListener('keydown',key,true);delete window.__hydroAimAccent;return true;}});
  tick();return JSON.stringify(window.__hydroAimAccent.status());
})();
