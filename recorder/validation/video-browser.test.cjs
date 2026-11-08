// Genuine capture/encode/decode/trim test of a labeled calibration canvas.
// NEVER drives the official game; calibration pixels are not game recordings.
const { spawn } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'),http=require('node:http');
const root = path.resolve(__dirname, '..'), out = 'Z:/Temp/opencode/video-replay-qa';
fs.mkdirSync(out, { recursive: true });
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let mediaHost,providerFailed=false,providerCalls=0,calibrationBody='';
fs.writeFileSync(path.join(out, 'fixture.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Actual video capture QA</title>
<body style="margin:0;background:#223521"><p style="font:14px system-ui;color:white;margin:4px">CALIBRATION CAPTURE — TEST ONLY, NOT OFFICIAL GAME FOOTAGE</p><canvas id="source" width="640" height="360" style="max-width:100%;height:auto"></canvas>
<script>const origAttach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const s=origAttach.call(this,o);window.qaRoot=s;return s};</script>
<script>${read('replay_lab/video_store.js')}</script><script>${read('replay_lab/video.js')}</script><script>${read('replay_lab/video_index.js')}</script><script>${read('replay_lab/clip_share.js')}</script><script>${read('replay_lab/video_clip.js')}</script><script>${read('replay_lab/video_ui.js')}</script>
<script>
localStorage.removeItem('bl-video-prefs/v1');
const source=document.getElementById('source'),c=source.getContext('2d'),began=performance.now();let frame=0;
function draw(){const t=(performance.now()-began)/1000;c.fillStyle=t<1?'#bb3322':'#2255bb';c.fillRect(0,0,640,360);c.fillStyle='white';c.font='bold 22px system-ui';c.fillText('CALIBRATION VIDEO — TEST ONLY',22,45);c.font='20px system-ui';c.fillText('Real encoded pixels · frame '+(++frame),22,80);c.fillRect(20+Math.sin(t*3)*12,150,70,70);requestAnimationFrame(draw)}draw();
const store=BLVideoStore.create(),recorder=BLVideoRecorder.create({storage:store,canvas:()=>source}),s={phase:'active',role:'player',identity:'qa-private',context:'qa-root'};
let current=s;recorder.arm(true);recorder.observe(current);
const ui=BLVideoUI.mount(recorder,BLVideoClip,{indexer:BLVideoIndex,sharer:BLClipShare});ui.open();
const timer=setInterval(()=>recorder.observe(current),50);
setTimeout(()=>recorder.mark('Calibration mark'),700);
setTimeout(()=>{current={...s,phase:'completed',role:'former-player',winner:0,endReason:0};recorder.observe(current);setTimeout(()=>{current={...s,phase:'idle',role:'former-player'}},200)},2800);
window.qa={store,recorder,ui,active(){current={...s,context:'next-match'};recorder.observe(current)},dispose(){clearInterval(timer);ui.dispose();recorder.dispose()}};
window.qaReady=new Promise((resolve,reject)=>{const t=performance.now();const iv=setInterval(()=>{if(recorder.status().canView){clearInterval(iv);resolve(true)}else if(performance.now()-t>9000){clearInterval(iv);reject(Error(JSON.stringify(recorder.status())))}},50)});
</script></body></html>`);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new','--no-sandbox','--no-first-run','--disable-gpu','--autoplay-policy=no-user-gesture-required','--remote-debugging-pipe',
  '--user-data-dir='+path.join(out,'profile'),'about:blank'
], { stdio: ['ignore','ignore','pipe','pipe','pipe'] });
let seq=0,pending=new Map(),buffer='';
chrome.stdio[4].on('data',chunk=>{buffer+=chunk.toString();let at;while((at=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!raw)continue;const m=JSON.parse(raw),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Fetch.requestPaused')send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'video/webm'}],body:calibrationBody},m.sessionId).catch(()=>{});}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);pending.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0')})}
const server=http.createServer((req,res)=>{
  if(req.url==='/share-fixture.html'){
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Sharing calibration fixture</title><form method="POST" action="http://127.0.0.1:${mediaHost.server.address().port}/publish" enctype="multipart/form-data"><input type="file" name="clip"><input name="expiry" value="24h"><input name="consent" value="litterbox-public-clip"><button>Share calibration clip</button></form><script>const t=new DataTransfer();t.items.add(new File([Uint8Array.from(atob('${calibrationBody}'),c=>c.charCodeAt(0))],'calibration.webm',{type:'video/webm'}));document.querySelector('input[type=file]').files=t.files;</script>`);return;
  }
  if(req.url!=='/fixture.html'){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(out,'fixture.html')));
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  mediaHost=require('../tools/clip_host.cjs').createHost({origins:['http://127.0.0.1:'+server.address().port],fetch:async()=>{providerCalls++;await new Promise(r=>setTimeout(r,500));return providerFailed?new Response('unavailable',{status:503}):new Response('https://litter.catbox.moe/calibration.webm');}});await new Promise(r=>mediaHost.server.listen(0,'127.0.0.1',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(m,p)=>send(m,p,sessionId),ev=async expression=>{let r;try{r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})}catch(e){throw Error(e.message+' in '+expression.slice(0,180))}if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
  async function waitDOM(expression){const until=Date.now()+8000;while(Date.now()<until){try{if(await ev(expression))return;}catch(_){}await new Promise(r=>setTimeout(r,50));}throw Error('Navigation result timed out: '+expression);}
  await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/fixture.html'});
  await ev(`new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r,{once:true})})`);
  assert(await ev('qaReady'),'capture must finish into a real postmatch video');
  assert(await ev('qa.recorder.status().storage.available&&qa.recorder.status().recordings[0].disk'),'actual browser OPFS stores completed video on disk');
  assert.equal(await ev('BLVideoStore.create().load("qa-private").then(r=>r.length)'),1,'a new disk-store instance recovers the completed video');
  assert.equal(await ev('BLVideoStore.create().load("other-account").then(r=>r.length)'),0,'disk recovery is scoped to the verified account');
  const rawVideo = await ev(`new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(qa.recorder.recording(qa.recorder.status().recordings[0].id).blob)})`);
  fs.writeFileSync(path.join(out,'calibration.webm'),Buffer.from(rawVideo,'base64'));
  calibrationBody=rawVideo;
  assert.equal(await ev(`BLVideoIndex.prepare(qa.recorder.recording(qa.recorder.status().recordings[0].id)).then(()=>true,e=>e.message)`),true,'WebM worker must successfully add duration and cues');
  await ev(`new Promise((resolve,reject)=>{const t=performance.now(),iv=setInterval(()=>{if(qaRoot.querySelector('[data-id=library] button')){clearInterval(iv);resolve(true)}else if(performance.now()-t>1500){clearInterval(iv);reject(Error('library UI did not refresh'))}},25)})`);
  await ev(`qaRoot.querySelector('[data-id=library] button').click()`);
  assert(await ev(`new Promise((resolve,reject)=>{const v=qaRoot.querySelector('video');if(v.readyState>=2)resolve(true);else{v.addEventListener('loadeddata',()=>resolve(true),{once:true});setTimeout(()=>reject(Error('decode timeout')),4000)}})`));
  assert(await ev(`Number.isFinite(qaRoot.querySelector('video').duration)`),'indexed WebM has a finite duration, not Infinity');
  assert(await ev(`!qaRoot.querySelector('video').controls&&!qaRoot.querySelector('video').hasAttribute('controls')`),'only the custom playback bar exists');
  // Decode distinct recorded frames: a non-empty WebM alone is NOT sufficient.
  const colors=await ev(`(async()=>{const v=qaRoot.querySelector('video'),c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');async function pixel(t){await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t});x.drawImage(v,500,250,1,1,0,0,1,1);return Array.from(x.getImageData(0,0,1,1).data)}return [await pixel(.2),await pixel(1.6)]})()`);
  assert(colors[0][0]>colors[0][2]+50,'early frame must decode the actual red source pixels');
  assert(colors[1][2]>colors[1][0]+50,'later frame must decode the actual blue source pixels');
  assert(await ev(`qaRoot.querySelector('[data-id=moments] button').textContent.includes('Calibration mark')`));
  async function press(key,code,vk,text){await cmd('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk});if(text)await cmd('Input.dispatchKeyEvent',{type:'char',key,code,text,unmodifiedText:text,windowsVirtualKeyCode:vk});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk})}
  for(const id of ['name','search']){
    await ev(`(()=>{const x=qaRoot.querySelector('[data-id=${id}]');x.value='Game video';x.focus();x.setSelectionRange(4,4);qaRoot.querySelector('video').pause()})()`);
    const before=await ev(`qaRoot.querySelector('video').currentTime`);
    await press(' ','Space',32,' ');
    assert(await ev(`qaRoot.querySelector('video').paused`),'space in '+id+' must not toggle playback');
    const caret=await ev(`qaRoot.querySelector('[data-id=${id}]').selectionStart`);
    await press('ArrowLeft','ArrowLeft',37);
    assert.equal(await ev(`qaRoot.querySelector('[data-id=${id}]').selectionStart`),caret-1,'arrow must move text caret');
    assert.equal(await ev(`qaRoot.querySelector('video').currentTime`),before,'arrow in editable field must not seek video');
    const bounds=await ev(`qaRoot.querySelector('[data-id=in]').value+':'+qaRoot.querySelector('[data-id=out]').value`);
    await press('i','KeyI',73,'i');await press('o','KeyO',79,'o');
    assert.equal(await ev(`qaRoot.querySelector('[data-id=in]').value+':'+qaRoot.querySelector('[data-id=out]').value`),bounds,'typing i/o must not change clip bounds');
  }
  await ev(`qaRoot.querySelector('[data-id=search]').value='';qaRoot.querySelector('[data-id=search]').dispatchEvent(new Event('input'));qaRoot.querySelector('[data-id=in]').focus();qaRoot.querySelector('[data-id=in]').value=.2`);
  const boundsTime=await ev(`qaRoot.querySelector('video').currentTime`);
  await press('ArrowUp','ArrowUp',38);
  assert.equal(await ev(`qaRoot.querySelector('video').currentTime`),boundsTime,'number-input arrows do not seek');
  await ev(`qaRoot.querySelector('video').focus()`);await press(' ','Space',32);
  assert(await ev(`!qaRoot.querySelector('video').paused`),'space still toggles playback outside editable controls');
  await ev(`qaRoot.querySelector('video').pause();qaRoot.querySelector('[data-id=name]').value='Match 1'`);
  await ev(`qaRoot.querySelector('[data-id=clip]').click()`);
  assert(await ev(`!qaRoot.querySelector('[data-id=editor]').hidden`),'clip tools use progressive disclosure');
  assert(await ev(`(()=>{const a=qaRoot.querySelector('.stage').getBoundingClientRect(),b=qaRoot.querySelector('.playbar').getBoundingClientRect();return Math.abs(a.width-b.width)<2})()`),'video stage stays aligned with playback controls');
  const desktop=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'desktop.png'),Buffer.from(desktop.data,'base64'));
  await ev(`window.downloads=[];HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,url:this.href})};qaRoot.querySelector('[data-id=download]').click();qaRoot.querySelector('[data-id=marks]').click()`);
  assert.equal(await ev('downloads.length'),2,'full WebM and timestamp sidecar downloads');
  await ev(`qaRoot.querySelector('[data-id=in]').value=.2;qaRoot.querySelector('[data-id=out]').value=1.8;qaRoot.querySelector('[data-id=export]').click()`);
  await ev(`new Promise((resolve,reject)=>{const t=performance.now(),iv=setInterval(()=>{if(downloads.length===3){clearInterval(iv);resolve(true)}else if(performance.now()-t>10000){clearInterval(iv);reject(Error(qaRoot.querySelector('[data-id=notice]').textContent))}},50)})`);
  assert(await ev(`downloads[2].name.endsWith('.webm')&&downloads[2].name.includes('-clip-')`),'trim export is actual video, not JSON');
  assert(await ev(`new Promise((resolve,reject)=>{const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>resolve(Number.isFinite(v.duration)&&v.duration>1.4&&v.duration<1.9&&v.videoWidth<=1280&&v.videoHeight<=720);v.onerror=()=>reject(Error('clip decode failed'));v.src=downloads[2].url})`),'exported/shared clip has finite duration, seek metadata and bounded resolution');
  calibrationBody=await ev(`fetch(downloads[2].url).then(r=>r.blob()).then(b=>new Promise(resolve=>{const f=new FileReader();f.onload=()=>resolve(f.result.split(',')[1]);f.readAsDataURL(b)}))`);
  await ev(`window.confirm=()=>true;window.handoffs=[];HTMLFormElement.prototype.submit=function(){const f=this.querySelector('input[type=file]');handoffs.push({action:this.action,target:this.target,enctype:this.enctype,file:f.files[0].name,bytes:f.files[0].size,expiry:this.querySelector('input[name=expiry]').value,consent:this.querySelector('input[name=consent]').value})}`);
  await ev(`new Promise((resolve,reject)=>{const t=performance.now(),iv=setInterval(()=>{if(qaRoot.querySelector('[data-id=share]').textContent==='Upload clip'){clearInterval(iv);resolve(true)}else if(performance.now()-t>10000){clearInterval(iv);reject(Error(qaRoot.querySelector('[data-id=notice]').textContent))}},50)})`);
  assert.equal(await ev('handoffs.length'),0,'clip preparation alone must not upload');
  await ev(`qaRoot.querySelector('[data-id=share]').click()`);
  assert(await ev(`handoffs[0].action==='http://127.0.0.1:8789/publish'&&handoffs[0].target==='_blank'&&handoffs[0].bytes>100&&handoffs[0].consent==='litterbox-public-clip'`),'confirmed sharing hands off only an encoded clip, not a full match');
  assert.equal(await ev('downloads.length'),3,'sharing does not download a file');
  await ev(`qaRoot.querySelector('[data-id=share]').click()`);assert.equal(await ev('handoffs.length'),2,'prepared clips remain available to retry failed sharing without re-encoding');
  await ev(`qaRoot.querySelector('[data-id=export]').click()`);assert.equal(await ev('downloads.length'),4,'prepared clip can be saved immediately after sharing');
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert(await ev(`(()=>{const p=qaRoot.querySelector('.panel');return p.scrollWidth<=p.clientWidth+1})()`),'mobile panel has no horizontal overflow');
  const mobile=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await ev(`qaRoot.querySelector('.help').closest('details').querySelector('summary').click()`);
  assert(await ev(`qaRoot.querySelector('.help').getBoundingClientRect().right<=innerWidth`),'safety/help popover fits on mobile');
  const helpShot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'mobile-help.png'),Buffer.from(helpShot.data,'base64'));await press('Escape','Escape',27);
  await ev(`qaRoot.querySelector('[data-id=fps]').closest('details').querySelector('summary').click();qaRoot.querySelector('[data-id=fps]').focus()`);await press('Escape','Escape',27);
  assert(await ev(`!qaRoot.querySelector('[data-id=fps]').closest('details').open&&!qaRoot.querySelector('.panel').hidden`),'Escape closes settings first, including from a select');
  await ev(`qaRoot.querySelector('[data-id=search]').focus()`);await press('Escape','Escape',27);
  assert(await ev(`qaRoot.querySelector('.panel').hidden`),'Escape closes recordings while editing search');await ev('qa.ui.open()');
  await ev(`qaRoot.querySelector('[data-id=in]').value=.3;qaRoot.querySelector('[data-id=out]').value=1.7;qaRoot.querySelector('[data-id=export]').click();qa.active()`);
  await ev('new Promise(r=>setTimeout(r,400))');
  assert(await ev(`qaRoot.querySelector('video').hidden&&!qaRoot.querySelector('video').hasAttribute('src')&&qaRoot.querySelector('[data-id=download]').disabled`),'new live match unloads old video and disables exports');
  assert.equal(await ev('downloads.length'),4,'new live match cancels trim without another file');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const locked=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'locked.png'),Buffer.from(locked.data,'base64'));
  await ev('qa.dispose()');assert(await ev(`!document.querySelector('#bl-replay-lab')`));
  await cmd('Fetch.enable',{patterns:[{urlPattern:'*catbox.moe*'}]});
  await cmd('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/share-fixture.html'});
  await ev(`new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))`);
  await ev(read('replay_lab/video_store.js'));assert.equal(await ev(`BLVideoStore.create().load('qa-private').then(r=>r.length)`),1,'completed disk recordings survive a document navigation and recorder disposal');
  await ev(`document.querySelector('form').submit()`);
  await waitDOM(`!!document.getElementById('copy')`);
  await cmd('Runtime.evaluate',{expression:`document.getElementById('copy').click()`,userGesture:true});await ev('new Promise(r=>setTimeout(r,100))');
  assert(await ev(`/Link copied|Ctrl\\+C/.test(document.getElementById('status').textContent)`),'real handoff page executes its CSP-approved copy-button handler');
  assert(await ev(`getComputedStyle(document.getElementById('uploading')).display==='none'`),'upload progress is replaced by the result');
  const shareShot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'sharing-ready.png'),Buffer.from(shareShot.data,'base64'));
  providerFailed=true;await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/share-fixture.html'});await ev(`new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))`);await ev(`document.querySelector('form').submit()`);
  await waitDOM(`!!document.getElementById('share-failed')`);
  assert(await ev(`document.body.textContent.includes('not been deleted')&&getComputedStyle(document.getElementById('uploading')).display==='none'`),'failed handoff keeps clear retry/save recovery guidance');assert.equal(providerCalls,2);
  console.log('Actual video browser checks passed: capture, encode, decode distinct pixels, bookmarks, lobby playback, seek, full WebM, timestamps, real clip, mobile layout, live relock/cancel, disposal.');
  console.log('Calibration-only screenshots:',out);
}
main().then(()=>send('Browser.close').catch(()=>{})).catch(e=>{console.error(e);process.exitCode=1;chrome.kill()}).finally(()=>{server.close();mediaHost?.server.close();});
