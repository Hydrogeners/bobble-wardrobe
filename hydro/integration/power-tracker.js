/* THESIS: a match-side checklist small enough to forget until needed.
 * OWN-WORLD: manager pearl/forest, Segoe UI, compact name rows and crate marks.
 * STORY: open Powers, mark observed boxes, clear for a new match; settings tuck away.
 * FIRST VIEWPORT: 216px draggable panel, four 28px rows, no dashboard chrome.
 * FORM: isolated activity Shadow DOM; manual state only, no game or network access.
 * BLPT interaction model: organpy/BLPT, MIT, copyright 2025 organ. */
(() => {
  'use strict';
  if(window.__bobblePowerTracker)return;
  const Core=window.BLPowerTrackerCore;if(!Core)throw Error('Power Tracker state unavailable');
  const storageKey='bobble-addons.power-tracker.v1';let warning='',initial=Core.defaults(),invalidRaw=null;
  try{const raw=localStorage.getItem(storageKey);if(raw){if(raw.length>16384)throw Error('Saved settings are too large');initial=Core.validate(JSON.parse(raw));}}
  catch(error){warning='Saved settings could not be read. Defaults are temporary; saving keeps a backup.';try{invalidRaw=localStorage.getItem(storageKey);}catch{}}
  // Upgrade only the untouched old default binding scheme; keep custom keys.
  if(initial.players.length<=4&&initial.players.every((p,i)=>p.key==='Alt+Shift+'+(i+1))){
    initial.players=initial.players.map((p,i)=>({...p,key:String(i+1)}));
  }
  const model=Core.create(initial),host=document.createElement('div');host.id='bobble-power-tracker';
  const root=host.attachShadow({mode:'open'}),abort=new AbortController();
  let open=false,disposed=false,editing=false,capture=null,drag=null,resizing=false,lastFocus=null;
  const paths={box:'M4 7 12 3l8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4m-8 4v10M8 5l8 4',
    settings:'M9 4h6l1 3 3 1v6l-3 1-1 3H9l-1-3-3-1V8l3-1 1-3Zm3 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    clear:'M4 8a8 8 0 1 1 0 8M4 3v5h5',close:'m6 6 12 12M18 6 6 18'};
  const svg=name=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
  root.innerHTML=`<style>
    :host{all:initial;color-scheme:light;font:12px/1.4 "Segoe UI",system-ui,sans-serif;color:#233829}
    *{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit}button{cursor:pointer}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent,#375d29);outline-offset:2px}
    svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
    ::selection{background:#d6e8c7;color:#233829}input{caret-color:var(--accent)}
    .launcher{position:fixed;left:12px;bottom:76px;z-index:2147483645;display:flex;align-items:center;gap:7px;border:1px solid #a9b89f;border-radius:6px;padding:7px 10px;min-height:36px;background:#f3f6ee;color:#2c4f2c;box-shadow:0 3px 12px #0003}.launcher:hover{background:#e1ecd6}.launcher[aria-expanded=true]{background:#d6e8c7;border-color:#6e875d}
    section{--bg:#f0f4eb;--row:#fff;--fg:#233829;--muted:#52664e;--accent:#375d29;--on:#d6e8c7;position:fixed;left:12px;top:72px;width:216px;min-width:min(190px,calc(100vw - 16px));max-width:min(360px,calc(100vw - 16px));min-height:152px;max-height:calc(100dvh - 24px);z-index:2147483645;background:var(--bg);color:var(--fg);border:1px solid #87997a;border-radius:6px;box-shadow:0 6px 22px #0004;overflow:auto;resize:both;scrollbar-width:thin;scrollbar-color:#8da17f var(--bg)}
    section[data-theme=dark]{--bg:#202b25;--row:#2e3e33;--fg:#f1f6eb;--muted:#c3d1bd;--accent:#c0dfa8;--on:#435e36;color-scheme:dark}
    section[data-theme=bobble]{--bg:#fff3d6;--row:#f4dfad;--fg:#562b23;--muted:#74462e;--accent:#7a3024;--on:#ebbd72}
    header{display:flex;align-items:center;gap:2px;padding:4px 4px 4px 10px;cursor:grab;touch-action:none;user-select:none;border-bottom:1px solid #87997a55}header:active{cursor:grabbing}
    header strong{font-size:12px;font-weight:600;flex:1}.icon{display:grid;place-items:center;width:28px;height:28px;border:0;background:transparent;color:var(--muted);border-radius:4px;padding:6px}.icon:hover,.icon[aria-expanded=true]{background:var(--on);color:var(--fg)}
    .rows{display:grid;grid-template-columns:minmax(0,1fr);gap:3px;padding:5px}.player{display:flex;align-items:center;gap:8px;width:100%;min-width:0;min-height:30px;padding:4px 7px;border:1px solid transparent;border-radius:4px;background:var(--row);color:var(--fg);text-align:left}.player[aria-checked=true]{background:var(--on);border-color:#87997a}.crate{display:grid;place-items:center;color:var(--muted)}.player[aria-checked=true] .crate{color:var(--fg)}.player[aria-checked=true] .name{font-weight:600}.name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.key{flex:none;font-size:10px;font-variant-numeric:tabular-nums;color:var(--muted);max-width:78px;min-width:19px;text-align:center;padding:1px 4px;border:1px solid #87997a70;border-radius:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.key:empty{display:none}.player:hover{border-color:#87997a}
    form{padding:7px 9px 10px;border-top:1px solid #87997a55}.hint{font-size:11px;color:var(--muted);margin:0 0 8px}.editor-row{display:flex;gap:5px;margin-bottom:5px}input{min-width:0;width:100%;padding:5px;color:var(--fg);background:var(--row);border:1px solid #87997a;border-radius:3px}.binding{width:82px;flex:none;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    form button,select{min-height:30px;border:1px solid #87997a;border-radius:3px;color:var(--fg);background:var(--row);padding:4px 7px}form button:hover{background:var(--on)}button[type=submit]{background:var(--on);font-weight:600}.tools{display:flex;gap:5px;margin:9px 0;flex-wrap:wrap}select{max-width:100%}.notice{font-size:11px;color:var(--fg);margin:7px 0;overflow-wrap:anywhere}.notice:empty{display:none}.credit{display:block;font-size:10px;color:var(--muted);margin-top:10px}a{color:inherit;text-underline-offset:3px}button:disabled{opacity:.5;cursor:default}
    @media(prefers-reduced-motion:no-preference){.player{transition:background-color 100ms ease-out}}
  </style><button class="launcher" type="button" aria-controls="power-tracker-panel" aria-expanded="false">${svg('box')}Powers</button>
  <section id="power-tracker-panel" data-theme="forest" aria-label="Manual power tracker" hidden>
    <header><strong title="Drag to move · manual power marks">Powers</strong><button class="icon" id="clear" title="Clear all marks" aria-label="Clear all power marks">${svg('clear')}</button><button class="icon" id="settings" title="Names and shortcuts" aria-label="Edit tracker settings" aria-expanded="false">${svg('settings')}</button><button class="icon" id="hide" title="Hide tracker and pause its shortcuts" aria-label="Hide power tracker">${svg('close')}</button></header>
    <div class="rows" role="group" aria-label="Player power marks"></div>
    <form hidden aria-label="Tracker settings"><p class="hint">Manual marks only. Shortcuts work here while shown, not while typing. Click a shortcut to change it; Backspace clears it.</p><div class="editors"></div><div class="tools"><button type="button" id="add">Add</button><button type="button" id="remove">Remove last</button><select aria-label="Tracker theme"><option value="forest">Forest</option><option value="dark">Dark</option><option value="bobble">Bobble</option></select><button type="button" id="reset-position">Reset position</button></div><p class="notice" role="status" aria-live="polite"></p><div class="tools"><button type="submit">Save</button><button type="button" id="cancel">Cancel</button></div><span class="credit">Based on <a href="https://github.com/organpy/BLPT" target="_blank" rel="noopener noreferrer">BLPT by organ</a> · MIT</span></form>
  </section>`;
  const $=s=>root.querySelector(s),panel=$('section'),form=$('form'),list=$('.rows'),notice=$('.notice');
  const listen=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:abort.signal});
  const clone=()=>model.state().config;
  function persist(recover=false){
    if(invalidRaw!==null&&!recover){notice.textContent=warning;return;}
    try{if(invalidRaw!==null){localStorage.setItem(storageKey+'.recovery.'+Date.now(),invalidRaw);invalidRaw=null;}localStorage.setItem(storageKey,JSON.stringify(clone()));warning='';}
    catch{warning='Settings could not be saved on this device. This session still works.';}
    notice.textContent=warning;
  }
  function render(){
    const state=model.state();panel.dataset.theme=state.config.theme;list.replaceChildren();
    state.config.players.forEach((player,i)=>{
      const row=document.createElement('button');row.type='button';row.className='player';row.setAttribute('role','checkbox');row.setAttribute('aria-checked',String(state.marked[i]));
      row.setAttribute('aria-label',player.name+(player.key?' · '+player.key:''));row.title=player.name+(player.key?' · '+player.key:' · click only');
      const crate=document.createElement('span');crate.className='crate';crate.innerHTML=svg('box');
      const name=document.createElement('span');name.className='name';name.textContent=player.name;
      const key=document.createElement('span');key.className='key';key.textContent=player.key;
      row.append(crate,name,key);row.addEventListener('click',()=>toggle(i));list.append(row);
    });
  }
  function toggle(index){
    model.toggle(index);
    // Update existing buttons so focus is not lost after each click/key press.
    model.state().marked.forEach((marked,i)=>list.children[i]?.setAttribute('aria-checked',String(marked)));
  }
  function clear(){model.clear();model.state().marked.forEach((_,i)=>list.children[i]?.setAttribute('aria-checked','false'));}
  function clamp(){
    if(!open)return;
    const r=panel.getBoundingClientRect(),w=window.innerWidth,h=window.innerHeight;
    panel.style.left=Math.max(8,Math.min(r.left,w-r.width-8))+'px';panel.style.top=Math.max(8,Math.min(r.top,h-r.height-8))+'px';
  }
  function savePlacement(){if(!open)return;const r=panel.getBoundingClientRect();const cfg=clone();cfg.position={x:r.left,y:r.top};cfg.size={width:r.width,height:r.height};model.configure(cfg);persist();}
  function show(value=true){
    if(disposed)return;
    open=!!value;panel.hidden=!open;$('.launcher').setAttribute('aria-expanded',String(open));
    if(open){lastFocus=document.activeElement;clamp();}else{edit(false);if(lastFocus?.isConnected)lastFocus.focus();}
  }
  let draft=[];
  function editorRows(){
    const editors=$('.editors');editors.replaceChildren();
    draft.forEach((player,i)=>{
      const line=document.createElement('div');line.className='editor-row';
      const name=document.createElement('input');name.value=player.name;name.maxLength=40;name.setAttribute('aria-label','Player '+(i+1)+' name');
      name.addEventListener('input',()=>{draft[i].name=name.value;});
      const key=document.createElement('button');key.type='button';key.className='binding';key.textContent=player.key||'No key';key.setAttribute('aria-label','Shortcut for player '+(i+1));
      key.addEventListener('click',()=>{capture={index:i,button:key};key.textContent='Press key…';notice.textContent='Press a shortcut. Escape cancels; Backspace removes it.';});
      line.append(name,key);editors.append(line);
    });
    $('#add').disabled=draft.length>=10;$('#remove').disabled=draft.length<=1;
  }
  function edit(value=true){
    editing=value;capture=null;form.hidden=!value;$('#settings').setAttribute('aria-expanded',String(value));
    if(value){draft=clone().players;editorRows();$('select').value=clone().theme;notice.textContent=warning;requestAnimationFrame(clamp);}
    else if(open)$('#settings').focus();
  }
  listen($('.launcher'),'click',()=>show(!open));listen($('#hide'),'click',()=>show(false));listen($('#clear'),'click',clear);
  listen($('#settings'),'click',()=>edit(!editing));listen($('#cancel'),'click',()=>{edit(false);$('#settings').focus();});
  listen($('#add'),'click',()=>{if(draft.length<10){capture=null;draft.push({name:'Player '+(draft.length+1),key:''});editorRows();clamp();}});
  listen($('#remove'),'click',()=>{if(draft.length>1){capture=null;draft.pop();editorRows();}});
  listen($('#reset-position'),'click',()=>{panel.style.left='12px';panel.style.top='72px';panel.style.width='216px';panel.style.height='auto';clamp();savePlacement();});
  listen(form,'submit',event=>{event.preventDefault();try{const cfg=clone();cfg.players=draft;cfg.theme=$('select').value;model.configure(cfg);persist(true);render();edit(false);clamp();$('#settings').focus();}catch(error){notice.textContent=String(error.message);}});
  listen(window,'keydown',event=>{
    if(!open||event.repeat||event.isComposing)return;
    if(capture){
      if(['Control','Alt','Shift','Meta'].includes(event.key))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Escape'){const index=capture.index;capture=null;editorRows();root.querySelectorAll('.binding')[index]?.focus();notice.textContent=warning;return;}
      const key=event.key==='Backspace'?'':Core.eventKey(event);
      if(event.key!=='Backspace'&&!key){notice.textContent='Unsupported or reserved shortcut. Try 1 or Num1.';return;}
      const index=capture.index;draft[index].key=key;capture=null;editorRows();root.querySelectorAll('.binding')[index]?.focus();notice.textContent=warning;return;
    }
    const target=event.composedPath()[0];
    // Closed recorder Shadow DOM hides internal typing targets from this window
    // listener; another add-on owning focus must never lose its number keys.
    if(['bl-replay-lab','bobble-wardrobe'].includes(document.activeElement?.id)||event.composedPath().some(el=>['bl-replay-lab','bobble-wardrobe'].includes(el?.id)))return;
    if(event.key==='Escape'&&root.contains(target)){event.preventDefault();event.stopPropagation();if(editing)edit(false);else show(false);return;}
    if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target?.tagName)&&!root.contains(target))return;
    if(['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return;
    if(editing||event.ctrlKey&&event.altKey&&event.shiftKey&&event.key.toLowerCase()==='h')return;
    const key=Core.eventKey(event),index=clone().players.findIndex(p=>p.key&&p.key===key);
    if(index<0)return;
    event.preventDefault();event.stopImmediatePropagation();toggle(index);
  },{capture:true});
  listen($('header'),'pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    const r=panel.getBoundingClientRect();drag={x:event.clientX-r.left,y:event.clientY-r.top,id:event.pointerId};$('header').setPointerCapture(event.pointerId);event.preventDefault();
  });
  listen($('header'),'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;panel.style.left=event.clientX-drag.x+'px';panel.style.top=event.clientY-drag.y+'px';clamp();});
  listen($('header'),'pointerup',()=>{if(drag){drag=null;savePlacement();}});
  listen($('header'),'pointercancel',()=>{drag=null;});listen(window,'resize',clamp);
  listen(panel,'pointerdown',event=>{resizing=event.target===panel;});
  listen(window,'pointerup',()=>{if(resizing){resizing=false;clamp();savePlacement();}},{passive:true});
  const cfg=clone();if(cfg.position){panel.style.left=cfg.position.x+'px';panel.style.top=cfg.position.y+'px';}
  if(cfg.size){panel.style.width=Math.max(190,cfg.size.width)+'px';panel.style.height=Math.max(152,cfg.size.height)+'px';}
  render();(document.body||document.documentElement).append(host);
  window.__bobblePowerTracker=Object.freeze({show,hide:()=>show(false),clear,state:()=>({...model.state(),open,editing}),
    dispose(){if(disposed)return;disposed=true;abort.abort();host.remove();delete window.__bobblePowerTracker;return true;}});
})();
