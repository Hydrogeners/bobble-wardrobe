// TEMPORARY ONE-BOBBLE COSMETIC TEST. No physics/input/network/transform writes.
// Data is original authored geometry; head, body and rolling base are all swapped.
(() => {
  'use strict';
  if(window.__hydroModel)return JSON.stringify(window.__hydroModel.status());
  const P=window.__hydroNativeProbe;
  if(!P||!window.__hydroAllocationCheck?.ok)throw Error('Native allocation preflight required');
  const D=__VISUAL_DATA__;
  if(D.revision!==3||D.fullGeometry!==true)throw Error('Unsupported visual payload');
  const extra={active:[18790,1825,2],submeshCount:[17835,2639,2],indexCount:[17977,10897,3],world:[19150,18836,3],rotation:[19157,18831,3],setTextureNamed:[17554,20333,4],propertyID:[17268,570,2],colorInjected:[17622,20305,4],scaleInjected:[17628,20287,4],offsetInjected:[17627,20288,4]};
  for(const [key,[slot,index,arity]]of Object.entries(extra)) {
    const f=P.T.get(slot);if(!f||f.name!==String(index)||f.length!==arity)throw Error('Signature mismatch: '+key);P.F[key]=f;
  }
  const required=['create','type','clone','destroy','white','resize','rawTexture','apply','setTexture','channel','indices','indexFormat','submeshes','bounds','setMesh','setMaterial','setName'];
  if(required.some(k=>!P.F[k]))throw Error('Missing preflight methods');
  const {M}=P,call=P.call;
  const permanent=[],permHandles=[],changes=[];
  const meshes={};let palette=0,material=0,materialHandle=0,timer=0,phase='preparing',error='',target='',started=0,verified=false,reattachments=0,ticks=0;
  const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  function pin(p,arr){if(!p)throw Error('Null native object');const h=call('pin',p);arr.push(h);return h;}
  function own(p,label){pin(p,permHandles);permanent.push(p);P.withString(label,s=>call('setName',p,s));return p;}
  function unpin(arr){for(const h of arr.splice(0).reverse())try{call('unpin',h);}catch(e){error+=' unpin:'+String(e);}}
  function cleanupPermanent(){
    for(const p of permanent.splice(0).reverse())try{call('destroy',p);}catch(e){error+=' cleanup:'+String(e);}
    unpin(permHandles);
  }
  function nativeBuffer(bytes,fn) {
    const p=M._malloc(bytes.length);if(!p)throw Error('Native temporary allocation failed');
    try{M.HEAPU8.set(bytes,p);return fn(p);}finally{M._free(p);}
  }
  function makeMesh(label,data,type) {
    if(!Number.isInteger(data.vertices)||data.vertices<3||data.vertices>65535||data.indices%3)throw Error('Invalid geometry counts');
    const attributes=[['position',0,3],['normal',1,3],['uv',4,2]];
    // Validate every payload before passing any pointer/length to native code.
    const arrays=attributes.map(([key,channel,dim])=>{
      const bytes=decode(data[key]);if(bytes.length!==data.vertices*dim*4)throw Error('Invalid '+key+' length');
      const floats=new Float32Array(bytes.buffer);if(!floats.every(Number.isFinite))throw Error('Non-finite vertex data');
      return {bytes,channel,dim};
    });
    const indices=decode(data.index);if(indices.length!==data.indices*2)throw Error('Invalid index length');
    if(!new Uint16Array(indices.buffer).every(i=>i<data.vertices))throw Error('Index out of range');
    const mesh=own(call('create',type),'HYDRO test '+label);
    call('indexFormat',mesh,0);call('submeshes',mesh,1);
    for(const a of arrays)nativeBuffer(a.bytes,p=>call('channel',mesh,a.channel,0,a.dim,p,data.vertices,0,data.vertices,0));
    nativeBuffer(indices,p=>call('indices',mesh,0,0,0,p,0,data.indices,1,0));call('bounds',mesh);
    if(call('vertices',mesh)!==data.vertices||call('submeshCount',mesh)!==1||call('indexCount',mesh,0)!==data.indices)throw Error('Native mesh verification failed');
    return mesh;
  }
  function changesValid() {
    try {
      if(changes.length!==3||!material)return false;
      for(const row of changes) {
        if(!call('exists',row.filter)||!call('exists',row.renderer))return false;
        if(call('mesh',row.filter)!==meshes[row.kind]||call('material',row.renderer)!==material)return false;
      }
      return true;
    } catch(e){return false;}
  }
  function detach() {
    let success=true;
    for(const row of changes.slice().reverse()) {
      try {
        if(call('exists',row.filter)&&call('exists',row.oldMesh))call('setMesh',row.filter,row.oldMesh);
        if(call('exists',row.renderer)&&call('exists',row.oldMaterial))call('setMaterial',row.renderer,row.oldMaterial);
        if(call('exists',row.filter)&&call('mesh',row.filter)!==row.oldMesh)throw Error('Mesh restore mismatch');
        if(call('exists',row.renderer)&&call('material',row.renderer)!==row.oldMaterial)throw Error('Material restore mismatch');
      }catch(e){success=false;error+=' restore:'+String(e);}
    }
    if(!success)return false;
    for(const row of changes.splice(0))unpin(row.handles);
    if(material){try{call('destroy',material);}catch(e){error+=' material cleanup:'+String(e);}material=0;}
    if(materialHandle){try{call('unpin',materialHandle);}catch(e){error+=' material unpin:'+String(e);}materialHandle=0;}
    return true;
  }
  function targetParts() {
    const bodyPattern=/^Body_(Male|Female)_Team(Bear|Tiger|Bull|Dino|Hawk|Pig|Bug)$/;
    const materialPattern=/^Team(Bear|Tiger|Bull|Dino|Hawk|Hawks|Pig|Pigs|Bug|Snowman|SnowMan)(?:MAT)?(?: \(Instance\))?$/;
    function row(go,kind) {
      try {
        const filter=P.component(go,'MeshFilter'),renderer=P.component(go,'MeshRenderer');if(!filter||!renderer)return null;
        const oldMesh=call('mesh',filter),oldMaterial=call('material',renderer);
        if(!oldMesh||!oldMaterial)return null;
        const meshName=P.name(oldMesh),materialName=P.name(oldMaterial);
        const expected=kind==='body'?bodyPattern:kind==='head'?/^Head_(Male|Female)\d+$/:/^Ball(?:_.+)?$/;
        if(!expected.test(meshName)||!materialPattern.test(materialName))return null;
        if(call('submeshCount',oldMesh)!==1)return null;
        return {go,filter,renderer,oldMesh,oldMaterial,meshName,materialName,kind,handles:[]};
      } catch(e){return null;}
    }
    function worldPos(t) {
      const p=M._malloc(12);if(!p)throw Error('Temporary allocation failed');
      try{call('world',t,p);return Array.from(M.HEAPF32.subarray(p/4,p/4+3));}finally{M._free(p);}
    }
    function forward(t) {
      // get_forward returns a struct by value and must not be called through the
      // pointer-return bridge. Use the safe injected quaternion getter instead.
      const p=M._malloc(16);if(!p)throw Error('Temporary allocation failed');
      try{
        call('rotation',t,p);
        const q=Array.from(M.HEAPF32.subarray(p/4,p/4+4));
        const x=q[0],y=q[1],z=q[2],w=q[3];
        return [2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)];
      }finally{M._free(p);}
    }
    const visuals=P.find('Visuals');if(!visuals)return null;
    const queue=[call('transform',visuals)],candidates=[];let seen=0;
    while(queue.length&&++seen<=1200) {
      const t=queue.shift(),go=call('gameObject',t);
      if(!call('active',go))continue;
      if(P.name(t)==='BODY_GEO') {
        try {
          const body=row(go,'body');
          if(body) {
            let root=call('transform',go);
            for(let i=0;i<6&&root&&!/^Team \d+ /.test(P.name(root));i++)root=call('parent',root);
            if(root&&/^Team \d+ /.test(P.name(root))) {
              const q2=[root],heads=[],balls=[];
              while(q2.length) {
                const a=q2.shift(),o=call('gameObject',a);
                if(!call('active',o))continue;
                if(P.name(a)==='HEAD_GEO')heads.push(a);
                if(P.name(a)==='BALL_GEO')balls.push(a);
                const n=call('childCount',a);
                for(let i=0;i<n&&i<40;i++)q2.push(call('child',a,i));
              }
              if(heads.length===1&&balls.length===1) {
                const head=row(call('gameObject',heads[0]),'head'),base=row(call('gameObject',balls[0]),'base');
                if(head&&base)candidates.push({body,head,base,label:P.name(root),headTransform:heads[0]});
              }
            }
          }
        } catch(e) {}
      }
      const n=call('childCount',t);if(n>70)continue;
      for(let i=0;i<n;i++)queue.push(call('child',t,i));
    }
    if(!candidates.length)return null;
    let camPos=null;
    try{const cam=P.find('Main Camera');if(cam)camPos=worldPos(call('transform',cam));}catch(e){}
    if(camPos) {
      // Prefer the bobble whose face points toward the camera, then distance.
      // Offline front/rear inspection confirms the authored face is local +Z.
      let best=candidates[0],bestScore=-Infinity;
      for(const candidate of candidates) {
        try{
          const hw=worldPos(candidate.headTransform);
          const d=Math.hypot(hw[0]-camPos[0],hw[1]-camPos[1],hw[2]-camPos[2]);
          const f=forward(call('transform',candidate.body.go));
          const dx=camPos[0]-hw[0],dy=camPos[1]-hw[1],dz=camPos[2]-hw[2];
          const len=Math.hypot(dx,dy,dz)||1;
          const facing=(f[0]*dx+f[1]*dy+f[2]*dz)/len;
          const score=facing*100-d*0.01;
          if(score>bestScore){bestScore=score;best=candidate;}
        }catch(e){}
      }
      return best;
    }
    return candidates[0];
  }
  function attach() {
    if(!['armed','active'].includes(phase))return status();
    if(changesValid())return status();
    if(!detach()){phase='restore-error';stop();return status();}
    const parts=targetParts();
    if(!parts){target='';return status();}
    target=parts.label;
    try {
      const mat=call('clone',parts.body.oldMaterial);
      materialHandle=pin(mat,[]);
      call('setTexture',mat,palette);
      // The game's bobble shader samples _BaseMap (URP), while set_mainTexture
      // writes _MainTex. Set both so the authored palette is actually sampled.
      P.withString('_BaseMap',s=>call('setTextureNamed',mat,s,palette));
      P.withString('_MainTex',s=>call('setTextureNamed',mat,s,palette));
      // Reset inherited team tint and atlas transforms on this clone only.
      const scratch=M._malloc(16);if(!scratch)throw Error('Material scratch allocation failed');
      try {
        for(const name of ['_BaseColor','_Color']) {
          M.HEAPF32.set([1,1,1,1],scratch/4);
          P.withString(name,s=>call('colorInjected',mat,call('propertyID',s),scratch));
        }
        // Team materials retain a separate team-colored emission atlas. It must
        // not add the old team texture over the custom palette on this clone.
        M.HEAPF32.set([0,0,0,1],scratch/4);
        P.withString('_EmissionColor',s=>call('colorInjected',mat,call('propertyID',s),scratch));
        for(const name of ['_BaseMap','_MainTex']) {
          const id=P.withString(name,s=>call('propertyID',s));
          M.HEAPF32.set([1,1],scratch/4);call('scaleInjected',mat,id,scratch);
          M.HEAPF32.set([0,0],scratch/4);call('offsetInjected',mat,id,scratch);
        }
      }finally{M._free(scratch);}
      if(call('texture',mat)!==palette)throw Error('Palette material verification failed');
      material=mat;
      // Save and pin all original references before changing any renderer.
      for(const row of [parts.body,parts.head,parts.base]) {
        for(const p of [row.filter,row.renderer,row.oldMesh,row.oldMaterial])pin(p,row.handles);
        changes.push(row);
      }
      for(const row of changes) {
        call('setMesh',row.filter,meshes[row.kind]);call('setMaterial',row.renderer,material);
        if(call('mesh',row.filter)!==meshes[row.kind]||call('material',row.renderer)!==material)throw Error('Visual assignment verification failed');
      }
      verified=true;phase='active';reattachments++;
    }catch(e) {
      error=String(e);
      if(!detach()){phase='restore-error';stop();}
      else {phase='failed-restored';stop();cleanupPermanent();}
    }
    return status();
  }
  function tick() {
    ticks++;
    try {
      if(phase==='armed'&&Date.now()-started>1800000){fullRestore();phase='expired';return;}
      if(phase!=='armed'&&phase!=='active')return;
      if(phase==='active'&&changesValid())return;
      attach();
    }catch(e){error=String(e);}
  }
  function stop(){if(timer){clearInterval(timer);timer=0;}}
  function fullRestore() {
    stop();
    if(!detach()){phase='restore-error';return status();}
    cleanupPermanent();
    phase='restored';window.removeEventListener('keydown',key,true);
    return status();
  }
  function arm() {
    if(phase!=='ready')return status();
    phase='armed';started=Date.now();
    if(!timer)timer=setInterval(tick,1200);
    attach();
    return status();
  }
  function key(e){if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.code==='KeyH'){e.preventDefault();fullRestore();}}
  function status(){return {phase,error,target,revision:3,verifiedNativeAssignments:verified,fullGeometry:true,attached:changes.length===3,reattachments,ticks,sourceSHA256:D.sourceSHA256,headVertices:D.parts.head.vertices,bodyVertices:D.parts.body.vertices,baseVertices:D.parts.base.vertices,scope:'one local human bobble; head, body and base mesh/material only',undo:'Ctrl+Alt+Shift+H',automaticExpiryMinutes:30,persistent:false};}
  try {
    const type=P.withString('UnityEngine.Mesh, UnityEngine.CoreModule',s=>call('type',s));
    pin(type,permHandles);
    for(const kind of ['head','body','base'])meshes[kind]=makeMesh(kind,D.parts[kind],type);
    palette=own(call('clone',call('white')),'HYDRO test palette texture');
    if(!call('resize',palette,32,32,4,0))throw Error('Palette texture allocation failed');
    const rgba=decode(D.palette);if(rgba.length!==4096)throw Error('Invalid palette length');
    nativeBuffer(rgba,p=>{if(!call('rawTexture',palette,p,rgba.length))throw Error('Palette upload failed');});call('apply',palette,0,0);
    phase='ready';window.addEventListener('keydown',key,true);
    window.__hydroModel=Object.freeze({status,arm,restore:fullRestore,tryApply:attach,inspect:()=>{const t=targetParts();return t?{root:t.label,body:t.body.meshName,head:t.head.meshName,base:t.base.meshName,material:t.body.materialName}:null;}});
    return JSON.stringify(status());
  }catch(e){error=String(e);stop();cleanupPermanent();throw e;}
})();
