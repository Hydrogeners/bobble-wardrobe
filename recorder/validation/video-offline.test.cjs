const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
class Element {
  constructor(){this.children=[];this.files=[];this.currentTime=10;this.duration=30;this.paused=true;this.hidden=true;}
  pause(){this.paused=true}replaceChildren(){this.children=[]}appendChild(e){this.children.push(e)}
}
const ids=['video','message','file','sidecar','moments','back','forward','speed'];
const els=Object.fromEntries(ids.map(id=>[id,new Element()])),listeners={};
vm.runInNewContext(fs.readFileSync(require.resolve('../replay_lab/video_offline.js'),'utf8'),{
  document:{getElementById:id=>els[id],createElement:()=>new Element()},URL,window:{addEventListener:(name,fn)=>listeners[name]=fn}
});
async function main(){
  const blob=new Blob(['calibration-placeholder'],{type:'video/webm'});Object.defineProperty(blob,'name',{value:'saved.webm'});
  els.file.files=[blob];els.file.onchange();assert(!els.video.hidden&&els.video.src.startsWith('blob:'));
  const raw={format:'bobble-video-moments/1',duration:30,marks:[{t:7,label:'<script>not executable</script>'}]};
  els.sidecar.files=[{size:100,text:async()=>JSON.stringify(raw)}];await els.sidecar.onchange();
  assert.equal(els.moments.children.length,1);assert(els.moments.children[0].textContent.includes('<script>'));
  assert.equal(els.moments.children[0].innerHTML,undefined,'untrusted labels use textContent, never HTML');
  els.moments.children[0].onclick();assert.equal(els.video.currentTime,7);
  els.back.onclick();assert.equal(els.video.currentTime,2);els.forward.onclick();assert.equal(els.video.currentTime,7);
  els.speed.value='0.5';els.speed.onchange();assert.equal(els.video.playbackRate,.5);
  for(const data of [ {...raw,format:'bobble-replay/1'}, {...raw,marks:[{t:Infinity,label:'bad'}]}, {...raw,marks:Array(1001).fill({t:1,label:'too many'})}]){
    els.sidecar.files=[{size:100,text:async()=>JSON.stringify(data)}];await els.sidecar.onchange();
    assert(/Unsupported|Invalid/.test(els.message.textContent));
  }
  els.sidecar.files=[{size:1048577,text:async()=>{throw Error('must not parse')}}];await els.sidecar.onchange();assert(els.message.textContent.includes('too large'));
  listeners.pagehide();assert(els.video.paused);
  console.log('Offline actual-video/timestamp tests passed: file URL, safe labels, jumping, seek/speed, format/numeric/size bounds, cleanup.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
