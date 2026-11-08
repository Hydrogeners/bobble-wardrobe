// Manual BLPT-style tracking, reimplemented from organpy/BLPT (MIT, 2025 organ).
// Pure state; no game, network, storage or DOM access.
(() => {
  'use strict';
  const defaults=()=>({schema:1,players:Array.from({length:4},(_,i)=>({name:'Player '+(i+1),key:String(i+1)})),theme:'forest',position:null,size:null});
  function shortcut(value){
    if(typeof value!=='string'||value.length>50)throw Error('Use a short keyboard shortcut.');
    if(!value.trim())return '';
    const parts=value.split('+').map(p=>p.trim()),key=parts.pop();
    const aliases={ctrl:'Ctrl',control:'Ctrl',alt:'Alt',shift:'Shift'};
    const mods=parts.map(p=>aliases[p.toLowerCase()]);
    if(mods.some(p=>!p)||new Set(mods).size!==mods.length)throw Error('Use Ctrl, Alt or Shift once per shortcut.');
    let main=key.toUpperCase();
    if(/^num(?:pad)?[0-9]$/i.test(key))main='Num'+key.slice(-1);
    if(!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Num[0-9])$/.test(main))throw Error('Choose a letter, number, F-key or Num0–9.');
    const label=[...['Ctrl','Alt','Shift'].filter(p=>mods.includes(p)),main].join('+');
    if(/^Ctrl\+[1-4]$/.test(label)||label==='Ctrl+Alt+Shift+H')throw Error('That shortcut is reserved for your other mods.');
    if(['Alt+F4','Ctrl+F4','F1','F5'].includes(label))throw Error('Choose a shortcut that is not used by the app.');
    return label;
  }
  function eventKey(event){
    if(event.metaKey||event.isComposing)return '';
    const key=/^Numpad[0-9]$/.test(event.code)?'Num'+event.code.slice(-1):event.key;
    try{return shortcut([event.ctrlKey?'Ctrl':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',key].filter(Boolean).join('+'));}catch{return '';}
  }
  function validate(data){
    if(!data||data.schema!==1||!Array.isArray(data.players)||data.players.length<1||data.players.length>10)throw Error('Use 1–10 players.');
    const used=new Set();
    const players=data.players.map(p=>{
      if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>40||/[\x00-\x1f]/.test(p.name))throw Error('Give each player a name of 1–40 characters.');
      const key=shortcut(p.key||'');
      if(key&&used.has(key))throw Error('Each shortcut must be unique.');
      if(key)used.add(key);
      return {name:p.name.trim(),key};
    });
    if(!['forest','dark','bobble'].includes(data.theme))throw Error('Choose a supported theme.');
    const pair=(value,keys)=>value===null||value===undefined?null:keys.every(k=>Number.isFinite(value[k])&&Math.abs(value[k])<=100000)?Object.fromEntries(keys.map(k=>[k,value[k]])):null;
    return {schema:1,players,theme:data.theme,position:pair(data.position,['x','y']),size:pair(data.size,['width','height'])};
  }
  function create(data=defaults()){
    let config=validate(data),marked=config.players.map(()=>false);
    return Object.freeze({
      state:()=>({config:JSON.parse(JSON.stringify(config)),marked:marked.slice()}),
      toggle(index){if(!Number.isInteger(index)||index<0||index>=marked.length)throw Error('Unknown player.');marked[index]=!marked[index];},
      clear(){marked.fill(false);},
      configure(data){const next=validate(data);marked=next.players.map((p,i)=>config.players[i]?.name===p.name?marked[i]:false);config=next;},
    });
  }
  window.BLPowerTrackerCore=Object.freeze({defaults,shortcut,eventKey,validate,create});
})();
