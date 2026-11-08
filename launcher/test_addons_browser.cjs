// Actual combined JS in a browser with SYNTHETIC native bindings. Not game proof.
// No Discord installation, public upload or real native heap is used.
'use strict';
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=path.join(fs.existsSync('Z:/Temp/opencode')?'Z:/Temp/opencode':os.tmpdir(),'three-addon-browser-qa');fs.mkdirSync(out,{recursive:true});
const specs=Array.from(fs.readFileSync(path.join(root,'hydro/integration/allocation-check.js'),'utf8').matchAll(/\w+:\[(\d+),(\d+),(\d+)\]/g),m=>m.slice(1).map(Number));specs.push([18790,1825,2]);
const inputGuard=fs.readFileSync(path.join(__dirname,'activity.js'),'utf8').match(/\/\/ BEGIN TRACKER INPUT GUARD([\s\S]*?)\/\/ END TRACKER INPUT GUARD/)[1];
const fixture=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Combined add-on calibration</title><style>body{margin:0;background:#213326;color:#e4eedb;font:16px system-ui}p{padding:18px;max-width:42ch}</style><p>THREE-ADDON UI FIXTURE · simulated native bindings, not game footage.</p><canvas id="unity-canvas" width="640" height="360"></canvas><script>
window.roots=new Map();const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);roots.set(this.id,r);return r;};
${inputGuard}
window.gameKeyCaptures=0;window.addEventListener('keydown',event=>{window.gameKeyCaptures++;event.preventDefault();},true);
localStorage.clear();const memory=new ArrayBuffer(8*1024*1024),M={HEAPU8:new Uint8Array(memory),HEAP32:new Int32Array(memory),codeUrl:'/Prod-590-CL28650/CG6.wasm',asm:{ei:{}}};window.__blUnity={Module:M};
const entries=new Map(${JSON.stringify(specs)}.map(([slot,index,arity])=>{const f=(...a)=>0;Object.defineProperty(f,'name',{value:String(index)});Object.defineProperty(f,'length',{value:arity});return [slot,f];}));
window.__hydroNativeProbe={report:{synthetic:true},M,F:{},T:{get:slot=>location.search?'invalid-fixture':entries.get(slot)},find:()=>0,component:()=>0,withString:(s,f)=>f(1),call:key=>['type','create','pin'].includes(key)?1:0};
</script><script src="/bundle.js"></script></html>`;
const server=http.createServer((req,res)=>{if(req.url.startsWith('/fixture')){res.setHeader('Content-Type','text/html');return res.end(fixture);}if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(__dirname,'bundle/wardrobe-live.js')));}res.writeHead(404).end();});
const chrome=spawn(process.env.BOBBLE_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--no-first-run','--disable-gpu','--remote-debugging-pipe','--user-data-dir='+path.join(out,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let id=0,buffer='',pending=new Map();chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!raw)continue;const m=JSON.parse(raw),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>{pending.delete(current);reject(Error('CDP timeout: '+method));},20000);pending.set(current,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:current,method,params,sessionId})+'\0');});}
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const cmd=(m,p)=>send(m,p,sessionId);
 const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:base+'/fixture'});
 await ev(`new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))`);
 assert(await ev(`!!window.__bobbleWardrobe&&!!window.__bobblePowerTracker&&!!window.__blReplay`),'all three actual addon UIs boot with synthetic native bindings');
 assert(await ev(`!__blReplay.status().armed&&!__blReplay.status().canView`),'recorder starts off and unknown participation cannot unlock video');
 assert.equal(await ev(`__blReplay.status().settings.mbps`),1,'compact default in the shipped combined runtime');
 assert.equal(await ev(`roots.get('bobble-power-tracker').querySelector('.launcher').textContent.trim()`),'Power Tracker','launcher uses the full addon name');
 await ev(`__bobblePowerTracker.show();roots.get('bobble-power-tracker').querySelector('#edit-names').click()`);
 await ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 assert(await ev(`roots.get('bobble-power-tracker').activeElement===roots.get('bobble-power-tracker').querySelector('.editor-row input')`),'Edit names focuses/selects an actual editable name field');
 const captured=await ev('gameKeyCaptures');
 for(const letter of 'Hydro2'){
   await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:letter,text:letter});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:letter});
 }
 assert.equal(await ev(`roots.get('bobble-power-tracker').querySelector('.editor-row input').value`),'Hydro2','real keyboard input survives a Unity-style early window capture preventDefault handler');
 assert.equal(await ev('gameKeyCaptures'),captured,'game capture never receives tracker-name keystrokes');
 await ev(`roots.get('bobble-power-tracker').querySelector('button[type=submit]').click()`);
 assert.equal(await ev(`__bobblePowerTracker.state().config.players[0].name`),'Hydro2','Save commits the renamed player');
 assert.equal(await ev(`JSON.parse(localStorage.getItem('bobble-addons.power-tracker.v1')).players[0].name`),'Hydro2','renamed player persists to preferences');
 await ev(`roots.get('bobble-power-tracker').querySelector('#edit-names').click()`);await ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert(await ev(`!__bobblePowerTracker.state().editing`),'Escape still cancels name editing through the early guard');
 await ev(`__bobblePowerTracker.show();__blReplay.open();roots.get('bl-replay-lab').querySelector('[data-id=search]').focus()`);
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',windowsVirtualKeyCode:49});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',windowsVirtualKeyCode:49});
 assert(await ev(`__bobblePowerTracker.state().marked.every(v=>!v)`),'typing in the recorder never toggles tracker shortcuts');
 await ev(`roots.get('bl-replay-lab').querySelector('[data-id=close]').click();document.body.tabIndex=-1;document.body.focus()`);
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',windowsVirtualKeyCode:49});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',windowsVirtualKeyCode:49});assert(await ev(`__bobblePowerTracker.state().marked[0]`),'plain 1 works when the activity owns focus');
 await ev(`__bobbleWardrobe.show();__bobblePowerTracker.hide()`);
 const desktop=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'wardrobe-three-addons-fixture.png'),Buffer.from(desktop.data,'base64'));
 await ev(`__blReplay.open()`);const recorder=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'recorder-three-addons-fixture.png'),Buffer.from(recorder.data,'base64'));
 for(const [label,width,height] of [['desktop',1280,900],['compact',800,600],['mobile',390,844]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
   const layout=await ev(`(()=>{const r=roots.get('bl-replay-lab'),a=r.querySelector('[data-id=arm]'),b=a.getBoundingClientRect(),p=r.querySelector('.panel').getBoundingClientRect(),s=r.querySelector('section');return {arm:b.toJSON(),panel:p.toJSON(),fixed:!a.closest('.layout'),overflow:s.scrollHeight-s.clientHeight};})()`);
   assert(layout.fixed&&layout.arm.top>=layout.panel.top&&layout.arm.bottom<=layout.panel.bottom,'auto-record always visible outside scrolling content: '+label);
   assert(layout.overflow<=1,'empty recorder primary controls fit without scrolling: '+label+' '+layout.overflow);
   const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'recorder-layout-'+label+'.png'),Buffer.from(shot.data,'base64'));
 }
 await ev(`window.confirm=()=>true;roots.get('bl-replay-lab').querySelector('[data-id=arm]').click()`);
 assert(await ev(`__blReplay.status().armed&&roots.get('bl-replay-lab').querySelector('[data-id=arm]').getAttribute('aria-pressed')==='true'`),'visible auto-record control enables recording readiness');
 await ev(`roots.get('bl-replay-lab').querySelector('[data-id=arm]').click()`);assert(await ev(`!__blReplay.status().armed`),'same visible control turns auto-record off');
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert(await ev(`roots.get('bl-replay-lab').querySelector('.panel').getBoundingClientRect().right<=innerWidth+1`),'combined recorder fits mobile');
 await ev(`__blReplay.dispose()`);assert(await ev(`!!__bobblePowerTracker&&!!__bobbleWardrobe&&!document.getElementById('bl-replay-lab')`),'recorder disposal does not remove the other addons');
 await cmd('Page.navigate',{url:base+'/fixture?native-failure'});await ev(`new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))`);
 assert(await ev(`!!__bobblePowerTracker&&!!__blReplay&&!!window.__bobbleWardrobeBootError`),'a cosmetic native-guard failure does not block tracker or recorder');
 await cmd('Runtime.evaluate',{expression:`__blReplay.dispose();__bobblePowerTracker.dispose()`});
 console.log('PASS: full Power Tracker label; real name typing despite Unity-style window capture, Save/persistence/Escape; all-three boot, recorder off/compact/locked, focus isolation/plain keys, mobile fit, independent disposal and cosmetic-failure isolation. Synthetic native bindings only. Fixtures: '+out);
}
main().then(()=>send('Browser.close').catch(()=>{})).catch(e=>{console.error(e);process.exitCode=1;chrome.kill();}).finally(()=>server.close());
