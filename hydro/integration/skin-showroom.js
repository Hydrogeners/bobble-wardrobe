/* THESIS: an Xbox 360–inspired avatar showroom, not a settings spreadsheet.
 * OWN-WORLD: pearl/silver blades, deep leaf green, Segoe UI, generous model stage.
 * STORY: browse, turn the real model, choose a club, explicitly apply or restore.
 * FIRST VIEWPORT: broad preview left, compact assignment blade right; live status below.
 * FORM: user-pinned 360 avatar selector; no game pause, scrim, or fake catalog items.
 * FINISH: inspect model, controls, small windows, cleanup, and document verified limits. */
(() => {
  'use strict';
  const engine=window.__bobbleWardrobeEngine;if(!engine)throw Error('Wardrobe engine unavailable');
  const catalog=window.__bobbleClubCatalog||{};
  const host=document.createElement('div');host.id='bobble-wardrobe';const root=host.attachShadow({mode:'open'});
  const style=document.createElement('style');style.textContent=`
    :host{all:initial;font:14px/1.45 "Segoe UI",system-ui,sans-serif;color:#283124;color-scheme:light}
    *{box-sizing:border-box}[hidden]{display:none!important}::selection{background:#d5e9b6;color:#243a12}
    button,select,input{font:inherit}button,select{color:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:not-allowed}
    button{border:1px solid #c8cec0;background:#fff;border-radius:5px;min-height:36px;padding:7px 12px}
    button:hover:not(:disabled){background:#edf4e5;border-color:#7b9a55}button:active:not(:disabled){background:#dcebc9}
    :focus-visible{outline:3px solid #3d7515;outline-offset:3px}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
    .launcher{position:fixed;right:12px;bottom:12px;z-index:2147483646;display:flex;align-items:center;gap:8px;background:#f5f7f1;box-shadow:0 4px 18px #0004;color:#375c21}.dot{width:7px;height:7px;border-radius:50%;background:#7e8876}.dot.on{background:#47831d}
    section{position:fixed;inset:0;margin:auto;width:min(850px,calc(100vw - 32px));height:min(600px,calc(100dvh - 80px));z-index:2147483646;display:flex;flex-direction:column;background:#f6f7f2;border:1px solid #a8b19c;border-radius:10px;box-shadow:0 18px 65px #0006;overflow:hidden}
    header{display:flex;gap:18px;align-items:center;padding:20px 26px;border-bottom:1px solid #d5dbcc;background:linear-gradient(#fff,#eef1e8);flex:none}h2{margin:0;font-size:27px;line-height:1.1;font-weight:400;letter-spacing:-.025em}.title{flex:1}.title p{margin:5px 0 0;color:#5b6552;font-size:12px}.close{border:0;background:transparent;padding:6px;min-width:34px}.toggle-wrap{display:flex;gap:9px;align-items:center;font-size:12px}
    .switch{position:relative;min-height:24px;width:42px;border-radius:16px;padding:0;background:#d9dfd1;border-color:#9ca58f}.switch:before{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;background:#fff;border-radius:50%;box-shadow:0 1px 3px #0003}.switch[aria-checked=true]{background:#4f8527;border-color:#3b681b}.switch[aria-checked=true]:before{left:21px}
    .content{min-height:0;flex:1;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(245px,1fr);overflow:auto;scrollbar-width:thin;scrollbar-color:#8e9b7e #edf0e7}
    .collection{min-width:0;display:flex;flex-direction:column;padding:12px 22px 18px;background:radial-gradient(ellipse at 50% 60%,#fff 5%,#eef1e7 70%,#e2e7da);position:relative}
    .stage{position:relative;flex:1;min-height:225px;display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center}.stage:before{content:"";position:absolute;width:47%;height:24px;background:#cdd5c2;border:1px solid #bec9af;border-radius:50%;bottom:23px;left:26.5%;box-shadow:0 7px 15px #63784e33;pointer-events:none}
    canvas{width:100%;height:100%;min-width:0;max-width:100%;min-height:225px;contain:size;display:block;touch-action:none;cursor:grab;position:relative}.arrow{position:relative;width:38px;height:38px;padding:8px;border-radius:50%;color:#3d711b;background:linear-gradient(#fff,#e9eee0);border-color:#bdcaaa;box-shadow:0 2px 4px #3c54231a}.arrow svg{width:18px;height:18px}
    .preview-error{position:absolute;inset:20% 48px auto;text-align:center;background:#f6f7f2;padding:12px;border:1px solid #c8cec0;font-size:12px}
    .view-tools{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:5px}.view-tools button{min-width:32px;min-height:30px;padding:4px 6px;border-color:transparent;background:transparent}.view-tools svg{width:17px;height:17px}.view-tools span{font-size:11px;color:#5b6552}.skin-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:12px}.skin-title h3{font-size:24px;font-weight:400;line-height:1.2;margin:0}.index{font-size:12px;color:#5b6552;font-variant-numeric:tabular-nums}.description{font-size:12px;margin:5px 0 0;color:#5b6552}
    .assignment{padding:22px 24px;background:linear-gradient(100deg,#e7ecdF,#f8f9f5 18%);border-left:1px solid #d5dbcc;min-width:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#8e9b7e #edf0e7}.assignment h3{font-size:18px;font-weight:400;margin:0 0 16px}.field-label{font-size:12px;display:block;font-weight:600;margin-bottom:6px}
    select{appearance:none;width:100%;min-height:40px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10' viewBox='0 0 14 10'%3E%3Cpath d='m2 2 5 5 5-5' fill='none' stroke='%233d711b' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid #b8c4a9;border-radius:5px;padding:8px 32px 8px 10px;cursor:pointer}.assigned{font-size:12px;color:#5b6552;min-height:36px;margin:9px 0 16px;overflow-wrap:anywhere}.primary{display:block;width:100%;background:linear-gradient(#548d29,#3e751a);color:#fff;border-color:#396c17;font-weight:600;min-height:42px;box-shadow:inset 0 1px #ffffff30,0 2px 3px #37501a20}.primary:hover:not(:disabled){background:#396e17;color:#fff;border-color:#315d14}.secondary{width:100%;margin-top:8px}.link{border:0;background:transparent;color:#3e6a20;padding:5px 0;min-height:28px;font-size:12px;text-align:left}.link:hover:not(:disabled){background:transparent;text-decoration:underline;text-underline-offset:3px}
    .divider{border:0;border-top:1px solid #d5dbcc;margin:18px 0 13px}.remember{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:#526048}.remember input{accent-color:#477e22;margin:2px 0 0;width:14px;height:14px;flex:none}.fine{font-size:11px;color:#5b6552;margin:7px 0}.notice{font-size:12px;background:#fff0cf;color:#634a15;border-radius:5px;padding:9px;white-space:pre-line;overflow-wrap:anywhere}
    footer{padding:12px 24px;display:flex;align-items:center;gap:16px;border-top:1px solid #d5dbcc;background:#e9eee1;flex:none}.status{font-size:12px;flex:1;margin:0;color:#40552d}.hints{font-size:11px;color:#5b6552;margin:0}.hints kbd{font:inherit;color:#3b6220}.foot-actions{display:flex;gap:6px}.foot-actions button{font-size:11px;min-height:30px;padding:5px 8px}.restore{border-color:#a8b799}
    @media(max-width:620px){section{width:calc(100vw - 20px);height:calc(100dvh - 70px)}header{padding:14px 16px;gap:10px}h2{font-size:23px}.toggle-label{display:none}.content{display:block}.collection{padding:10px 16px 18px}.stage{height:260px;min-height:200px;flex:none}.assignment{overflow:visible;padding:20px;border-left:0;border-top:1px solid #d5dbcc}.assignment h3{margin-bottom:12px}footer{padding:10px 14px;flex-wrap:wrap;gap:7px}.hints{display:none}.status{min-width:100%}.skin-title{margin-top:8px}}
    @media(max-height:360px){section{height:calc(100dvh - 12px);width:calc(100vw - 16px);display:block;overflow:auto;scroll-padding-top:86px;scroll-padding-bottom:12px}header{padding:10px 14px;position:sticky;top:0;z-index:3}.content{overflow:visible}.stage{height:240px}footer{position:relative}.assignment{overflow:visible}}
    @media(prefers-reduced-motion:no-preference){.switch:before{transition:left 140ms cubic-bezier(.16,1,.3,1)}}
  `;root.append(style);
  const div=document.createElement('div');div.innerHTML=`
    <button class="launcher" type="button" aria-controls="wardrobe-panel" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4 3 7l3 5 2-1v9h8v-9l2 1 3-5-5-3c0 4-8 4-8 0Z"/></svg>Wardrobe<span class="dot" aria-hidden="true"></span></button>
    <section id="wardrobe-panel" aria-labelledby="wardrobe-title" hidden>
      <header><div class="title"><h2 id="wardrobe-title">Wardrobe</h2><p>Nine styles. Visible only to you.</p></div><div class="toggle-wrap"><span class="toggle-label">Custom skins</span><button class="switch" role="switch" aria-label="Enable custom skins" aria-checked="false" type="button"></button></div><button class="close" type="button" aria-label="Close wardrobe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></header>
      <div class="content">
        <div class="collection"><div class="stage"><button class="arrow" id="previous" type="button" aria-label="Previous skin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><canvas tabindex="0" aria-label="3D skin preview. Drag to rotate, scroll to zoom. J and L rotate; Home resets. Left and right arrows browse skins."></canvas><button class="arrow" id="next" type="button" aria-label="Next skin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><p class="preview-error" role="status" hidden></p></div>
          <div class="view-tools"><button id="rotate-left" type="button" aria-label="Rotate model left"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a7 7 0 1 1-1 8M6 3v5H1"/></svg></button><span>Drag to rotate</span><button id="rotate-right" type="button" aria-label="Rotate model right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a7 7 0 1 0 1 8M18 3v5h5"/></svg></button><button id="reset-view" type="button" aria-label="Reset model view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-7 8 7M7 8v12h10V8M10 20v-7h4v7"/></svg></button></div>
          <div class="skin-title"><h3 id="skin-name"></h3><span class="index" id="skin-index"></span></div><p class="description" id="skin-description"></p>
        </div>
          <div class="assignment"><h3>Your match. Your style.</h3><label class="field-label" for="skin-picker">Skin</label><select id="skin-picker"></select><button class="primary" id="apply" type="button">Use on my team</button><p class="team-safety">Only your team. Opponents keep their original look.</p><hr class="divider"><label class="remember"><input id="remember" type="checkbox">Remember my choices on this device</label><p class="fine">Remembered auto-team skins turn on next time. Manual club overrides start off.</p><details class="club-overrides"><summary>Manual club overrides</summary><p class="fine">These target a club, not your side. Auto-team mode must be off.</p><label class="field-label club-label" for="club">Club</label><select id="club"></select><p class="assigned" id="assigned"></p><button class="secondary" id="apply-club" type="button">Use for selected club</button><button class="secondary" id="original" type="button">Restore selected club</button><button class="link" id="apply-all" type="button">Use for all clubs, including opponents</button></details><div class="notice" id="notice" role="alert" hidden></div><button class="link" id="retry" type="button" hidden>Retry compatible bobbles</button></div>
      </div><footer><p class="status" role="status" aria-live="polite"></p><p class="hints"><kbd>← →</kbd> browse · <kbd>Esc</kbd> close</p><div class="foot-actions"><button class="restore" id="restore" type="button">Restore all</button><button id="reset" type="button">Reset clubs</button></div></footer>
    </section>`;root.append(div);document.documentElement.append(host);
  const $=s=>root.querySelector(s),panel=$('section'),club=$('#club');
   const autoControl=document.createElement('label');autoControl.className='remember auto-team';autoControl.innerHTML='<input id="auto-team" type="checkbox">Auto-apply to my team';$('.team-safety').after(autoControl);
  const autoNote=document.createElement('p');autoNote.className='fine';autoNote.id='auto-team-note';autoControl.after(autoNote);
  $('canvas').setAttribute('aria-label','3D skin preview. Drag to rotate; Ctrl+scroll to zoom. J and L rotate; Home resets. Left and right arrows browse skins.');
  $('.view-tools span').textContent='Drag to rotate · Ctrl+scroll zoom';
  const accentStyle=document.createElement('style');accentStyle.textContent=`
    .accent-lab{margin-top:16px;padding-top:14px;border-top:1px solid #cbd5be}.accent-heading{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}.accent-heading h4{margin:0;font-size:16px;font-weight:600}.accent-heading span{font-size:11px;color:#526048}.accent-colors{display:grid;grid-template-columns:1fr 1fr;gap:12px}.accent-color{display:grid;grid-template-columns:38px 1fr;gap:8px;align-items:center;min-width:0}.accent-color input[type=color]{width:38px;height:38px;padding:3px;border:1px solid #a3b295;border-radius:50%;background:#fff;cursor:pointer}.accent-color input::-webkit-color-swatch-wrapper{padding:0}.accent-color input::-webkit-color-swatch{border:0;border-radius:50%}.accent-color label{font-size:12px;font-weight:600}.accent-color output{display:block;font-size:11px;color:#526048;font-variant-numeric:tabular-nums}.accent-presets{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.accent-presets button{display:flex;align-items:center;gap:6px;font-size:11px;min-height:30px;padding:4px 8px}.accent-presets i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--sample);border:1px solid #28312440}.accent-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.accent-actions button{font-size:12px;min-height:34px}.accent-message{font-size:11px;color:#526048;margin:8px 0 0;line-height:1.5}.stage:before{display:none}
  `;root.append(accentStyle);
  accentStyle.textContent+='section{height:min(720px,calc(100dvh - 40px))}.accent-heading h4{font-size:18px}@media(max-width:620px){section{height:calc(100dvh - 40px)}}';
  // Never derive the stage's layout height from the canvas drawing-buffer size.
  // Pop-out/reparenting can otherwise amplify a percentage/intrinsic-size cycle.
  accentStyle.textContent+=`.collection{align-self:start;min-height:0}.stage{flex:none;height:clamp(225px,34dvh,280px);grid-template-rows:minmax(0,1fr)}.preview-viewport{position:relative;height:100%;min-width:0;min-height:0;overflow:hidden;contain:strict}.preview-viewport canvas{position:absolute;inset:0;width:100%;height:100%;min-height:0;max-height:100%}`;
  const previewCanvas=$('canvas'),viewport=document.createElement('div');viewport.className='preview-viewport';previewCanvas.before(viewport);viewport.append(previewCanvas);
    const lab=document.createElement('div');lab.className='accent-lab';lab.setAttribute('role','group');lab.setAttribute('aria-label','Halo and aiming arrow');lab.innerHTML=`
     <div class="accent-heading"><h4>Halo &amp; aiming arrow</h4><span>Preview only</span></div>
    <div class="accent-colors"><div class="accent-color"><input type="color" id="halo-color" aria-labelledby="halo-label"><div><label id="halo-label" for="halo-color">Selection halo</label><output id="halo-hex" for="halo-color"></output></div></div><div class="accent-color"><input type="color" id="aim-color" aria-labelledby="aim-label"><div><label id="aim-label" for="aim-color">Aiming arrow</label><output id="aim-hex" for="aim-color"></output></div></div></div>
    <div class="accent-presets" role="group" aria-label="Accent color presets"><button type="button" data-preset="hydro"><i style="--sample:#19b9ce" aria-hidden="true"></i>Hydro</button><button type="button" data-preset="aurora"><i style="--sample:#9865d9" aria-hidden="true"></i>Aurora</button><button type="button" data-preset="ember"><i style="--sample:#db6835" aria-hidden="true"></i>Ember</button><button type="button" data-preset="ice"><i style="--sample:#629ec7" aria-hidden="true"></i>Ice</button></div>
    <div class="accent-actions"><button type="button" id="apply-accents">Apply accents</button><button class="link" type="button" id="reset-accents">Reset colors</button></div>
     <p class="accent-message" id="accent-state" role="status" aria-live="polite"></p><p class="accent-message">Colors affect this preview only. In-game halo and arrow recoloring is unsupported.</p>`;
  $('.collection').append(lab);
  $('#halo-label').textContent='Selection halo · preview only';
   const defaults=window.__bobbleAccentDefaults||{halo:'#19b9ce',arrow:'#f0aa42'};
   accentStyle.textContent+=`
     :host{--ink:#283124;--muted:#526048;--edge:#c8d1bd;--leaf:#3e751a}input{caret-color:var(--leaf)}
     header{padding:18px 24px}h2{font-size:26px;font-weight:500}.title p{margin-top:6px}
     .assignment{padding:24px;background:#f5f7f0}.assignment h3{font-size:19px;font-weight:500;margin-bottom:22px}
     .primary{margin-top:14px;min-height:44px}.team-safety{font-size:12px;line-height:1.5;color:var(--muted);margin:10px 0 16px}
     .auto-team{padding:12px;background:#e5eddc;border:1px solid var(--edge);border-radius:5px;font-weight:600}.fine{line-height:1.6}
     #auto-team-note{min-height:36px;margin:8px 0 0}.club-label{margin-top:12px}
     .club-overrides{border-top:1px solid var(--edge);margin-top:20px;padding-top:10px}.club-overrides summary,.accent-lab summary{cursor:pointer;font-size:13px;font-weight:600;min-height:36px;padding:8px 0}
     summary:focus-visible{outline:3px solid var(--leaf);outline-offset:3px}.club-overrides .fine{margin-bottom:14px}.club-overrides .link{line-height:1.5;white-space:normal;margin-top:8px}.assigned{margin-bottom:8px;min-height:0}.secondary{min-height:36px}
      .accent-heading{display:flex;flex-wrap:wrap}.accent-heading h4{font-size:16px}.accent-heading span{font-size:11px;color:var(--muted)}
     .collection{align-self:stretch}.stage{height:clamp(260px,42dvh,360px)}.skin-title h3{font-size:26px;font-weight:500}.description{line-height:1.6;max-width:45ch}
     .remember{font-size:12px;line-height:1.5;cursor:pointer}.remember input{width:16px;height:16px}.view-tools button{min-height:36px;min-width:36px}.close{min-height:40px;min-width:40px}
     footer{gap:12px}.status{line-height:1.5}.notice{margin-top:14px;line-height:1.6}
     @media(max-width:620px){header{padding:14px 16px}.stage{height:250px}.collection{padding-bottom:14px}.assignment{padding:20px 18px}.assignment h3{margin-bottom:16px}h2{font-size:23px}.toggle-wrap{gap:0}.skin-title h3{font-size:24px}}
     @media(max-height:500px) and (min-width:621px){.stage{height:225px}.collection{align-self:start}}
   `;
  let accentDraft={...(window.__bobbleAccentSettings||defaults)};
  function syncAccents(){
    for(const [key,id]of [['halo','halo'],['arrow','aim']]){$('#'+id+'-color').value=accentDraft[key];$('#'+id+'-hex').textContent=accentDraft[key].toUpperCase();}
    viewer?.setAccents?.(accentDraft);
    const applied=window.__bobbleAccentSettings||defaults,dirty=Object.keys(defaults).some(k=>accentDraft[k]!==applied[k]);
    $('#apply-accents').disabled=!dirty;$('#accent-state').textContent=dirty?'Previewing changes · not applied':'Current session colors';
  }
  let open=false,index=0,lastFocus=null,viewer=null,previewID='',state=engine.state(),disposed=false,lastStatus='';
   for(const key of engine.clubs){const o=document.createElement('option');o.value=key;o.textContent=catalog[key]?.name||key;club.append(o);}
    for(const skin of state.catalog){const o=document.createElement('option');o.value=skin.id;o.textContent=skin.name.toUpperCase();$('#skin-picker').append(o);}
  for(const [key,c]of Object.entries(catalog))if(c.supported===false){const o=document.createElement('option');o.value=key;o.textContent=c.name+' · unsupported';o.disabled=true;club.append(o);}
  club.value=engine.clubs.find(c=>state.assignments[c]!=='original')||engine.clubs[0];
  function previewError(message){$('.preview-error').hidden=!message;$('.preview-error').textContent=message;}
  function selected(){return state.catalog[index];}
  function loadPreview(){
    if(!open||!selected()||previewID===selected().id&&viewer)return;
    try{
      if(!viewer)viewer=window.__createBobblePreview($('canvas'),previewError);
      previewError('');
      viewer.setData(null);previewID=selected().id;
      const data=engine.previewData?.(selected().id)||window.__bobbleSkinAssets?.[selected().id];
      if(!data)throw Error('This skin has no 3D preview yet. You can still apply it.');
      viewer.setData(data);viewer.setAccents?.(accentDraft);viewer.reset();viewer.visible(true);
    }catch(e){previewError(e.message);}
  }
  function update(s){
    const previous=selected()?.id;state=s;index=Math.min(index,Math.max(0,s.catalog.length-1));
    if(previous&&s.catalog.some(x=>x.id===previous))index=s.catalog.findIndex(x=>x.id===previous);
    const skin=selected(),current=s.assignments[club.value],currentSkin=s.catalog.find(x=>x.id===current);
    $('#skin-name').textContent=skin?.name?.toUpperCase()||'No skins installed';$('#skin-description').textContent=skin?.description||'Register a prepared skin to begin.';
     $('#skin-index').textContent=s.catalog.length?String(index+1).padStart(2,'0')+' / '+String(s.catalog.length).padStart(2,'0'):'00 / 00';
     $('#skin-picker').value=skin?.id||'';$('#skin-picker').disabled=!skin;
    for(const id of ['#previous','#next']){$(id).disabled=s.catalog.length<2;$(id).title=s.catalog.length<2?'One skin installed. More skins will appear here when added.':'';}
    $('.switch').setAttribute('aria-checked',String(s.enabled));$('.dot').classList.toggle('on',s.enabled);$('#remember').checked=s.remember;
     $('#auto-team').checked=!!s.autoSkin;$('#auto-team').disabled=typeof engine.auto!=='function'||!skin;$('#auto-team-note').textContent=s.autoSkin?(s.autoClub?'Your team: '+(catalog[s.autoClub]?.name||s.autoClub)+' · '+(s.catalog.find(x=>x.id===s.autoSkin)?.name||s.autoSkin):'Waiting for your team. No skin is applied until ownership is verified.'):'Choose Use on my team to equip the displayed skin. Manual overrides are separate.';
    const count=s.counts[club.value]||0,name=catalog[club.value]?.name||club.value;
    $('#assigned').textContent=count?name+' · '+count+' applied':(currentSkin?.name||'Original appearance')+(currentSkin?(s.enabled?' · waiting for a compatible bobble':' · skins off'):'');
     $('#apply').disabled=!skin;$('#apply').textContent=s.autoSkin===skin?.id&&s.enabled?(s.attached?'Equipped for my team':'Selected for my team'):'Use on my team';
     $('#apply-club').disabled=!skin||!!s.autoSkin;$('#original').disabled=current==='original'||!!s.autoSkin;$('#apply-all').disabled=!skin||!!s.autoSkin;
    const message=s.error?'Restore needs attention':s.expired?'Waiting expired. Switch skins on to retry.':!s.enabled?'Original visuals · custom skins off':s.attached?s.attached+' custom bobble'+(s.attached===1?'':'s')+' applied':'Custom skins on · waiting for a match';
    if(message!==lastStatus){$('.status').textContent=message;lastStatus=message;}
    const notices=[s.error,s.storageWarning,...s.failures].filter(Boolean);$('#notice').hidden=!notices.length;$('#notice').textContent=notices.join('\n');$('#retry').hidden=!s.failures.length&&!s.error;
    $('#restore').disabled=!s.enabled&&!s.attached&&!s.error;loadPreview();
  }
   function browse(delta){if(state.catalog.length<2)return;index=(index+delta+state.catalog.length)%state.catalog.length;previewID='';update(state);}
   $('#skin-picker').addEventListener('change',e=>{index=state.catalog.findIndex(s=>s.id===e.target.value);previewID='';update(state);});
  function show(value=true){if(disposed||open===value)return;open=value;panel.hidden=!value;$('.launcher').setAttribute('aria-expanded',String(value));if(value){lastFocus=document.activeElement;loadPreview();viewer?.visible(true);$('canvas').focus();}else{viewer?.visible(false);if(lastFocus?.isConnected)lastFocus.focus();else $('.launcher').focus();}}
  $('.launcher').addEventListener('click',()=>show(!open));$('.close').addEventListener('click',()=>show(false));$('#previous').addEventListener('click',()=>browse(-1));$('#next').addEventListener('click',()=>browse(1));
  $('#rotate-left').addEventListener('click',()=>viewer?.rotate(-.3));$('#rotate-right').addEventListener('click',()=>viewer?.rotate(.3));$('#reset-view').addEventListener('click',()=>viewer?.reset());club.addEventListener('change',()=>update(engine.state()));
  for(const [key,id]of [['halo','halo'],['arrow','aim']])$('#'+id+'-color').addEventListener('input',e=>{accentDraft[key]=e.target.value;syncAccents();});
  const presets={hydro:defaults,aurora:{halo:'#9865d9',arrow:'#45bfa6'},ember:{halo:'#db6835',arrow:'#f0bb52'},ice:{halo:'#629ec7',arrow:'#9d85d5'}};
  for(const button of lab.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{accentDraft={...presets[button.dataset.preset]};syncAccents();});
  $('#reset-accents').addEventListener('click',()=>{accentDraft={...defaults};syncAccents();});
  $('#apply-accents').addEventListener('click',()=>{window.__bobbleAccentSettings={...accentDraft};syncAccents();$('#accent-state').textContent='Saved for this session · halo is preview-only';});
  syncAccents();
   $('#apply').addEventListener('click',()=>{if(selected()){engine.auto(selected().id);if(!engine.state().enabled)engine.setEnabled(true);}});
   $('#apply-club').addEventListener('click',()=>{if(selected()&&!engine.state().autoSkin){engine.assign(club.value,selected().id);if(!engine.state().enabled)engine.setEnabled(true);}});
  $('#original').addEventListener('click',()=>engine.assign(club.value,'original'));$('#apply-all').addEventListener('click',()=>{if(selected()){engine.assignAll(selected().id);if(!engine.state().enabled)engine.setEnabled(true);}});
  $('#auto-team').addEventListener('change',e=>{engine.auto(e.target.checked?selected()?.id:'');if(e.target.checked&&!engine.state().enabled)engine.setEnabled(true);});
  $('.switch').addEventListener('click',()=>engine.setEnabled(!engine.state().enabled));$('#remember').addEventListener('change',e=>engine.remember(e.target.checked));$('#restore').addEventListener('click',()=>engine.restore());$('#reset').addEventListener('click',()=>engine.reset());$('#retry').addEventListener('click',()=>engine.retry());
  for(const event of ['pointerdown','pointerup','pointermove','click','dblclick','wheel','keyup'])root.addEventListener(event,e=>e.stopPropagation());
  root.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();show(false);}else if(!['SELECT','INPUT'].includes(e.target.tagName)&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();browse(e.code==='ArrowLeft'?-1:1);}e.stopPropagation();});
   function key(e){if(e.key==='Escape'&&open&&[host,document.body,document.documentElement].includes(document.activeElement)){e.preventDefault();show(false);return;}if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.code==='KeyW'){e.preventDefault();show(!open);}}
  window.addEventListener('keydown',key,true);const unsubscribe=engine.subscribe(update);
  function detachUI(){disposed=true;unsubscribe();window.removeEventListener('keydown',key,true);viewer?.dispose();host.remove();}
  window.__bobbleWardrobe=Object.freeze({show:()=>show(true),hide:()=>show(false),status:engine.state,preview:()=>viewer?.info(),detachUI,
    uninstall(){if(!engine.dispose())return false;detachUI();delete window.__bobbleWardrobe;delete window.__bobbleWardrobeEngine;delete window.__bobbleCreateVisual;delete window.__bobbleSkinAssets;return true;}});
})();
