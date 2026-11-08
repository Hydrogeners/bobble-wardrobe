// Synthetic memory only: verifies read-only participant/match-end decisions.
const assert = require('node:assert/strict');
const { createReader } = require('../replay_lab/native_reader.js');
const buf = new ArrayBuffer(32*1024*1024), H = new Int32Array(buf), F = new Float32Array(buf), U = new Uint8Array(buf), W = new Uint16Array(buf);
const put = (p,off,v)=>H[(p+off)>>2]=v;
const ascii = (p,s)=>{for(let i=0;i<s.length;i++)U[p+i]=s.charCodeAt(i);U[p+s.length]=0;return p};
const str = (p,s)=>{put(p,8,s.length);for(let i=0;i<s.length;i++)W[(p+12)/2+i]=s.charCodeAt(i);return p};
const type = (k,name,ns,t)=>{put(k,8,ascii(t,name));put(k,12,ascii(t+100,ns))};
const q=70000, ball=71000, ctx=96000, game=97000, visual=98000;
type(28537368,'GameContext_Shared','DiscordGames.CG6',100001);
type(28000000,'NetSession','DiscordGames.ChannelGamesFramework.Session',100301);
put(2674088,0,28000000);put(28000000,92,90000);put(90000,0,91000);put(91000,0,28000000);put(91000,76,str(92000,'local-guid'));
put(q,0,28537368);put(q,8,1);put(q,60,72000);put(q,64,ball);put(q,72,-1);put(q,76,-1);put(q,52,3);
type(27900000,'NetGameRelayContext','DiscordGames.ChannelGamesFramework.Session',101001);
type(27800000,'NetGameRelay','DiscordGames.ChannelGamesFramework.Session',101301);
type(27700000,'GameContext_ClientVisuals','DiscordGames.CG6',101601);
put(q,28,ctx);put(q,204,visual);put(ctx,0,27900000);put(ctx,8,1);put(ctx,28,102000);put(ctx,36,game);
put(game,0,27800000);put(game,8,1);put(game,48,ctx);put(visual,0,27700000);put(visual,8,1);put(visual,60,q);
type(27600000,'SharedProps_GameFSM','DiscordGames.CG6',102301);
type(27500000,'SharedProps','',102601);type(27400000,'GameState_InGame','DiscordGames.CG6',102901);put(27500000,40,27400000);
put(q,40,104000);put(104000,12,105000);put(104000,16,2);put(105000,12,2);
put(105000,16,1);put(105000,32,106000);put(105000,40,2);put(105000,56,107000);
put(106000,0,27600000);put(106000,32,2);put(107000,0,27500000);put(107000,32,1);F[(ball+64)>>2]=.5;
function list(dg,p,arr,items){put(dg,8,p);put(p,8,arr);put(p,12,items.length);items.forEach((x,i)=>put(arr,16+i*4,x))}
list(72000,72100,72200,[73000,74000]);
for(const team of [0,1]){
  const tp=team?74000:73000,ap=80000+team*300,dg=75000+team*500;
  put(tp,12,dg);list(dg,dg+100,dg+200,[ap]);put(ap,8,1001+team);
  put(ap,12,str(94000+team*300,team?'other-guid':'local-guid'));F[(ap+68)>>2]=team?4:-4;F[(ap+72)>>2]=.5;
}
let now=0;const reader=createReader(()=>buf,()=>now);
const first=reader.read();assert.equal(first.role,'player');assert.equal(first.phase,'active');
assert.deepEqual(Object.keys(first).sort(),['context','identity','role','phase','winner','endReason'].sort());
assert(!/ball|athletes|score|other-guid|"x"|"y"|"z"/.test(JSON.stringify(first)),'no coordinates or other player identity returned');
put(91000,76,str(92000,'spectator-id'));now+=50;assert.equal(reader.read().role,'spectator');
put(q,72,0);put(q,76,0);now+=50;assert.equal(reader.read().phase,'active','stale outcome is not a match end');
put(107000,32,2);assert.equal(reader.read().phase,'completed');
put(91000,76,str(92000,'local-guid'));put(107000,32,1);now+=50;reader.read();
put(107000,32,2);put(72000,8,0);now+=50;const end=reader.read();
assert.equal(end.role,'former-player');assert.equal(end.phase,'completed');
put(106000,32,1);now+=50;const lobby=reader.read();assert.equal(lobby.context,end.context);assert.equal(lobby.role,'former-player');
put(106000,32,2);put(107000,32,1);put(72000,8,72100);now+=50;assert.notEqual(reader.read().context,end.context);
put(72000,12,72100);put(72000,8,0);now+=100;assert.equal(reader.read().role,'unknown','spare pool cannot establish membership');
put(72000,8,72100);put(72000,12,0);put(game,48,99000);now+=100;assert.equal(reader.read(),null);
put(game,48,ctx);put(visual,60,99000);now+=100;assert.equal(reader.read(),null);
put(visual,60,q);put(game,8,0);now+=100;assert.equal(reader.read(),null);
U[100001]=0;assert.equal(reader.read(),null);
console.log('Native lifecycle/privacy checks passed: participation, match end, lobby, stale roots, narrow output.');
