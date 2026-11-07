// Session-local cosmetic API feasibility probe. No visual/gameplay writes.
// Exact build + wasm function identity/arity guards; no guessed method calls.
(() => {
  'use strict';
  if (window.__hydroNativeProbe) return JSON.stringify(window.__hydroNativeProbe.report);
  const M = window.__blUnity?.Module;
  if (!M || !M.codeUrl.includes('/Prod-590-CL28650/')) throw Error('Unsupported Unity build');
  const T = M.asm.ei;
  const specs = {
    string: [28315,44756,2], pin:[31790,19831,2], unpin:[31796,45224,2],
    find:[18813,49937,2], component:[18763,22546,3], transform:[6086,937,2],
    gameObject:[1432,601,2], parent:[2750,877,2], childCount:[2416,1323,2], child:[2417,1815,3],
    position:[19152,18846,3], scale:[19161,18822,3], name:[2319,630,2], exists:[4321,666,2],
    mesh:[17722,7776,2], material:[17153,20415,2], texture:[17421,2295,2], vertices:[17834,2640,2]
  };
  const F = {};
  for (const [key,[slot,index,arity]] of Object.entries(specs)) {
    const f=T.get(slot);
    if (!f || f.name!==String(index) || f.length!==arity) throw Error('Native signature mismatch: '+key);
    F[key]=f;
  }
  function call(key,...args) {
    const stack=M.stackSave();
    try {return F[key](...args,0);} finally {M.stackRestore(stack);}
  }
  function withString(text,fn) {
    const p=call('string',text.length);if(!p || M.HEAP32[(p+8)>>2]!==text.length)throw Error('String allocation failed');
    const handle=call('pin',p);
    try {
      for(let i=0;i<text.length;i++)M.HEAPU16[(p+12)/2+i]=text.charCodeAt(i);
      return fn(p);
    } finally {call('unpin',handle);}
  }
  function name(o) {
    if (!o) return '';
    const p=call('name',o);if(!p)return '';
    const n=M.HEAP32[(p+8)>>2];if(n<0||n>256)throw Error('Invalid visual name');
    return String.fromCharCode(...M.HEAPU16.subarray((p+12)/2,(p+12)/2+n));
  }
  function vector(key,t) {
    const p=M._malloc(12);if(!p)throw Error('Temporary allocation failed');
    try {call(key,t,p);return Array.from(M.HEAPF32.subarray(p/4,p/4+3));}finally{M._free(p);}
  }
  function find(text) {return withString(text,p=>call('find',p));}
  function component(o,text) {return withString(text,p=>call('component',o,p));}
  const visuals=[];
  for(const label of ['BODY_GEO','HEAD_GEO','BALL_GEO']) {
    const go=find(label);if(!go){visuals.push({label,found:false});continue;}
    const t=call('transform',go),filter=component(go,'MeshFilter'),renderer=component(go,'MeshRenderer');
    const mesh=filter&&call('mesh',filter),material=renderer&&call('material',renderer),texture=material&&call('texture',material);
    const ancestry=[];let a=t;
    for(let i=0;i<9&&a;i++,a=call('parent',a))ancestry.push(name(a));
    visuals.push({label,found:true,mesh:name(mesh),vertices:mesh?call('vertices',mesh):0,material:name(material),texture:name(texture),position:vector('position',t),scale:vector('scale',t),ancestry});
  }
  const report={build:'Prod-590-CL28650',signaturesVerified:Object.keys(F).length,readOnly:true,visuals};
  window.__hydroNativeProbe={report,M,T,F,call,withString,name,vector,find,component};
  return JSON.stringify(report);
})();
