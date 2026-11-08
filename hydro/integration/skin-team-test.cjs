// Real supported-build offsets exercised in an isolated synthetic heap.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/skin-team.js','utf8'),{window});
let checks=0;
function fixture(){
  const U=new Uint8Array(1024*1024),H=new Int32Array(U.buffer);let addr=100000,side=0;
  const put=(p,o,v)=>H[(p+o)>>2]=v,alloc=()=>{const p=addr;addr+=256;return p;};
  function klass(name,ns){const k=alloc(),n=alloc(),s=alloc();U.set(Buffer.from(name),n);U.set(Buffer.from(ns),s);put(k,8,n);put(k,12,s);return k;}
  function obj(name,ns='DiscordGames.CG6'){const p=alloc();put(p,0,klass(name,ns));put(p,8,1);return p;}
  function list(items){const pooled=alloc(),l=alloc(),arr=alloc();put(pooled,8,l);put(l,8,arr);put(l,12,items.length);put(arr,12,items.length);items.forEach((p,i)=>put(arr,16+i*4,p));return pooled;}
  const ctx=obj('GameContext_Shared'),relay=obj('NetGameRelayContext','DiscordGames.ChannelGamesFramework.Session'),game=obj('NetGameRelay','DiscordGames.ChannelGamesFramework.Session'),visuals=obj('GameContext_ClientVisuals');
  put(ctx,28,relay);put(ctx,204,visuals);put(relay,36,game);put(game,48,relay);put(visuals,60,ctx);put(ctx,44,5);put(ctx,48,2);
  const ballA=obj('BallBobble'),ballB=obj('BallBobble'),a=alloc(),b=alloc(),teamA=alloc(),teamB=alloc();put(a,8,ballA);put(b,8,ballB);put(teamA,8,list([a]));put(teamB,8,list([b]));put(visuals,92,list([teamA,teamB]));
  const f=function(c,m){assert.equal(c,ctx);return side;};Object.defineProperty(f,'name',{value:'18429'});
  const P={M:{HEAP32:H,HEAPU8:U,stackSave:()=>77,stackRestore:p=>assert.equal(p,77)},T:{get:()=>f},find:()=>1,component:()=>ctx,call(k,p){if(k==='gameObject')return p===ballA?101:102;if(k==='transform'){assert([101,102].includes(p),'GameObject transform getter must not receive a Component');return p===101?112:142;}if(k==='parent')return 0;throw Error(k);}};
  return {P,put,ctx,relay,game,visuals,setSide:v=>side=v,targets:[{root:112,club:'Bull'},{root:142,club:'Bear'}]};
}
const resolve=s=>window.__bobbleResolveSkinTeam(s.P,s.targets);
{const s=fixture();assert.equal(resolve(s).club,'Bull');assert.deepEqual([...resolve(s).roots],[112]);s.setSide(1);assert.equal(resolve(s).club,'Bear');assert.deepEqual([...resolve(s).roots],[142]);checks+=4;}
{const s=fixture();s.put(s.ctx,48,5);s.targets[1].club='Bull';assert.deepEqual([...resolve(s).roots],[112]);s.setSide(1);assert.deepEqual([...resolve(s).roots],[142]);checks+=2;}
for(const side of [-1,2,undefined]){const s=fixture();s.setSide(side);assert.equal(resolve(s),null);checks++;}
for(const [name,offset,value] of [['game',48,0],['visuals',60,0],['ctx',8,0],['ctx',44,100],['visuals',92,0]]){const s=fixture();s.put(s[name],offset,value);assert.equal(resolve(s),null);checks++;}
{const s=fixture();s.targets[0].club='Bear';assert.equal(resolve(s),null);checks++;}
{const s=fixture();s.P.T.get=()=>null;assert.equal(resolve(s),null);checks++;}
{const s=fixture();s.P.call=()=>112;assert.equal(resolve(s),null,'A root appearing on both sides must be rejected');checks++;}
console.log(`PASS: ${checks} current-context/team-root ownership checks (both sides, mirror clubs, stale context, spectator, mismatch, invalid roster)`);
