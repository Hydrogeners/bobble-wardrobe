const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/power-tracker-core.js','utf8'),ctx);
const C=ctx.window.BLPowerTrackerCore;let count=0;
const eq=(a,b)=>{assert.equal(JSON.stringify(a),JSON.stringify(b));count++;};
eq(C.defaults().players.map(p=>p.key),['1','2','3','4']);
eq(C.shortcut('shift+CONTROL+a'),'Ctrl+Shift+A');eq(C.shortcut('NumPad1'),'Num1');eq(C.shortcut(''), '');
for(const bad of ['Ctrl+1','Ctrl+4','Ctrl+Alt+Shift+H','Win+R','F5','Alt+F4','Ctrl+Ctrl+A','Escape','Ctrl++',null]){assert.throws(()=>C.shortcut(bad));count++;}
for(const bad of [null,{}, {...C.defaults(),players:[]}, {...C.defaults(),theme:'evil'}, {...C.defaults(),players:[{name:' '}]}, {...C.defaults(),players:[{name:'<script>',key:'F8'},{name:'b',key:'f8'}]}, {...C.defaults(),players:Array.from({length:11},()=>({name:'p',key:''}))}]){assert.throws(()=>C.validate(bad));count++;}
const model=C.create();eq(model.state().marked,[false,false,false,false]);model.toggle(0);model.toggle(3);eq(model.state().marked,[true,false,false,true]);
const cfg=model.state().config;cfg.players[0].key='F8';cfg.players[3].name='Changed';model.configure(cfg);eq(model.state().marked,[true,false,false,false]);
const copy=model.state();copy.config.players[0].name='tamper';copy.marked[0]=false;eq(model.state().config.players[0].name,'Player 1');eq(model.state().marked[0],true);
model.clear();eq(model.state().marked,[false,false,false,false]);
for(const bad of [-1,10,NaN,'0']){assert.throws(()=>model.toggle(bad));count++;}
eq(C.eventKey({code:'Numpad1',key:'End'}),'Num1');eq(C.eventKey({key:'1',altKey:true,shiftKey:true}),'Alt+Shift+1');eq(C.eventKey({key:'a',metaKey:true}),'');eq(C.eventKey({key:'a',isComposing:true}),'');
eq(C.validate({...C.defaults(),position:{x:NaN,y:0}}).position,null);
const bundle=fs.readFileSync(__dirname+'/wardrobe-live.js','utf8');assert(bundle.indexOf('window.__bobblePowerTracker=')<bundle.indexOf('// Bobble wardrobe:'));count++;
assert(bundle.includes('Copyright (c) 2025 organ'));count++;
console.log(`PASS: ${count} manual Power Tracker state/validation/bundle checks`);
