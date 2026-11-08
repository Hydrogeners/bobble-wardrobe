// THESIS: real footage is the work; no schematic pitch or synthetic playback.
// OWN-WORLD: extend Replay Lab's neutral/green, system-font tools and spacing.
// STORY: capture a match, find a moment, trim it and create an expiring video link.
// FIRST VIEWPORT: capture/library left, large native video right, timeline below.
// FORM: incumbent surface extension in Operate mode; no visual-world replacement.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLVideoUI = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function time(s) { s = Math.max(0, s || 0); return (s>=3600?Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0'):Math.floor(s/60))+':'+String(Math.floor(s%60)).padStart(2,'0'); }
  function size(n) { return n>=1073741824?(n/1073741824).toFixed(2)+' GB':(n / 1048576).toFixed(1) + ' MB'; }
  function mount(service, clipper, options) {
    options = options || {}; var doc = options.document || document, host = doc.createElement('div');
    host.id = 'bl-replay-lab'; doc.body.appendChild(host); var root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
    :host{all:initial;color:#182015;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}*{box-sizing:border-box}[hidden]{display:none!important}
    button,input,select,summary{font:inherit;color:inherit}button,select{min-height:36px;padding:7px 12px;border:1px solid #cbd2c3;border-radius:6px;background:#fafbf8}button{cursor:pointer}
    button:hover:not(:disabled){background:#e5eddf;border-color:#49783e}button:disabled{opacity:.45;cursor:not-allowed}
    button:focus-visible,input:focus-visible,select:focus-visible,video:focus-visible{outline:3px solid #276836;outline-offset:3px}::selection{background:#c1ddbb}
    input{accent-color:#286838;caret-color:#286838}input[type=number]{width:82px;padding:7px;border:1px solid #aebaa4;border-radius:4px;background:#fafbf8;min-height:38px}
    input[type=text]{min-width:0;width:100%;padding:8px 10px;border:1px solid #aebaa4;border-radius:4px;background:#fafbf8}
    .hud{position:fixed;bottom:18px;left:18px;z-index:2147483646;display:flex;gap:6px;align-items:center;padding:5px;background:#fafbf8;border:1px solid #aebaa4;border-radius:6px;box-shadow:0 4px 14px #0003}
    .hud output{padding:0 7px;font-size:12px;font-variant-numeric:tabular-nums}.hud[data-recording=true] output{color:#a52d25;font-weight:700}
    .panel{position:fixed;inset:3vh 3vw;z-index:2147483647;background:#f1f3ee;border:1px solid #aebaa4;border-radius:12px;box-shadow:0 12px 48px #0005;display:flex;flex-direction:column;overflow:hidden}
    header{padding:16px 22px;border-bottom:1px solid #cbd2c3;display:flex;justify-content:space-between;gap:16px;align-items:center}h1{font-size:21px;margin:0}h2{font-size:15px;margin:0 0 10px}p{margin:6px 0;color:#46503f}.sub{font-size:12px}
    .layout{display:grid;grid-template-columns:224px minmax(0,1fr);flex:1;min-height:0}aside{padding:20px 14px;border-right:1px solid #cbd2c3;background:#fafbf8;overflow:auto}section{min-width:0;padding:20px 24px;overflow:auto}
    .primary{background:#286838;color:white;border-color:#286838}.primary:hover:not(:disabled){background:#1e512b;color:white}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.row label{display:flex;align-items:center;gap:6px;font-size:12px}
    .settings{padding:8px 16px}.settings>label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0;font-size:12px}.settings select{min-width:112px}
    .library{display:grid;gap:8px}.library button{text-align:left;width:100%}.library small{display:block;font-size:12px;color:#46503f}.library [aria-pressed=true]{border:2px solid #286838;padding:6px 11px}
    .stage{min-height:180px;display:grid;place-items:center;border-radius:8px 8px 0 0;background:#10170f;overflow:hidden;aspect-ratio:16/9}.stage video{width:100%;height:100%;object-fit:contain;background:#000}.empty{padding:30px;max-width:470px;text-align:center;color:#edf3e8}.empty h2{font-size:20px}.empty p{color:#c4d0bd}.empty svg{width:30px;height:30px;margin:0 0 10px}
    .timeline{display:flex;align-items:center;gap:12px;margin-top:12px}.timeline input{flex:1;min-width:40px;min-height:36px}.clock{font-variant-numeric:tabular-nums;font-size:12px;white-space:nowrap}.editor{border-top:1px solid #cbd2c3;margin-top:16px;padding-top:16px}
    .moments{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.moments button{font-size:12px;min-height:34px;padding:5px 9px}.title{display:flex;gap:8px;margin-top:14px}.notice{min-height:22px;font-size:12px;line-height:1.6}footer{padding:10px 22px;border-top:1px solid #cbd2c3;color:#46503f;font-size:12px}
    aside,section,.layout{scrollbar-color:#aebaa4 #f1f3ee;scrollbar-width:thin}
    .header-actions{display:flex;gap:10px;align-items:center}.capture-state{font-size:12px;color:#315b30;background:#e5eddf;border-radius:20px;padding:4px 10px;max-width:32ch}.popover{position:relative}.popover>summary{cursor:pointer;list-style:none;padding:8px 12px;border-radius:6px}.popover>summary:hover{background:#e5eddf}.popover>div{position:absolute;right:0;top:42px;z-index:5;width:300px;border:1px solid #cbd2c3;border-radius:8px;background:#fafbf8;box-shadow:0 8px 24px #0002}.more>div{width:190px;padding:6px}.more button{display:block;width:100%;border:0;text-align:left}.more .danger{color:#a52d25}.viewer:fullscreen{background:#10170f;display:flex;flex-direction:column;justify-content:center;padding:20px}.viewer:fullscreen .stage{aspect-ratio:auto;flex:1;min-height:0}.viewer:fullscreen video{max-height:calc(100vh - 110px)}.playbar{padding:4px 12px 8px;background:#fafbf8;border:1px solid #d8dfd1;border-top:0;border-radius:0 0 8px 8px}.playbar .timeline{margin:0;gap:10px}.playbar .row{margin:0}.playbar button{border-color:transparent;background:transparent;padding:6px 8px}.playbar select{font-size:12px;min-height:32px;padding:4px}.playbar .space{flex:1}.title{margin:0 0 12px;align-items:center}.title input{font-size:18px;font-weight:600;border:1px solid transparent;background:transparent;padding-left:0}.title input:focus{background:#fafbf8;border-color:#aebaa4;padding-left:8px}.editor{background:#fafbf8;border:1px solid #d8dfd1;border-radius:8px;padding:16px;margin-top:12px}.editor h2{margin-bottom:12px}.editor .row{margin:8px 0}.editor .clip-actions{justify-content:flex-end;padding-top:8px}.clip-length{margin-right:auto;font-size:12px;color:#46503f}.moments:empty{display:none}.moments{margin:10px 0}.library{margin-top:14px}.library button{background:transparent;border-color:transparent;padding:10px 12px}.library [aria-pressed=true]{border:1px solid #b8c6ae;background:#e5eddf;padding:10px 12px}.library small{margin-top:4px;font-size:11px}.search{font-size:12px!important}.aside-note{margin-top:24px;font-size:11px;line-height:1.6}.notice{margin:8px 0 0;color:#46503f;font-size:12px}.notice:empty{display:none}.secondary-link{border:0;background:transparent;padding:4px 0;font-size:12px}.statusline{font-size:12px;margin:4px 0 16px}.clip-toggle{margin-left:auto}
    :host{--ink:#233829;--muted:#52664e;--edge:#c8d1bd;--paper:#f5f7f0;--leaf:#375d29;color:var(--ink);font-family:"Segoe UI",system-ui,sans-serif;color-scheme:light}
    .panel{inset:20px;max-width:1280px;max-height:900px;margin:auto;border-color:#a8b89c;border-radius:10px;background:var(--paper)}
    header{background:linear-gradient(#fff,#eef1e8);padding:18px 24px;gap:12px}h1{font-size:24px;font-weight:600;line-height:1.2}.header-copy{min-width:0}.header-copy p{margin:5px 0 0;font-size:12px;color:var(--muted)}
    .header-actions{gap:8px;flex-wrap:wrap;justify-content:flex-end}.capture-state{border-radius:4px;max-width:none;background:transparent;padding:4px 6px;font-variant-numeric:tabular-nums}.capture-state[data-state=recording]{color:#94352a;background:#f9e8df}
    .layout{grid-template-columns:232px minmax(0,1fr)}aside{padding:20px 16px;background:#edf1e7;border-color:var(--edge)}aside h2{font-size:15px;font-weight:600;margin:20px 0 10px}.arm-control{width:100%;font-weight:600;background:var(--leaf);color:#fff;border-color:var(--leaf)}.arm-control:hover:not(:disabled){background:#294821;color:#fff}.arm-control[aria-pressed=true]{background:#fff;color:var(--leaf);border-color:#a8b89c}
    section{padding:20px 24px}.library button{overflow-wrap:anywhere;line-height:1.45;border-radius:5px}.library small{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}.library [aria-pressed=true]{background:#dce9d0;border-color:#8fa67c}.library button:hover:not(:disabled){background:#e1e9d8}
    .aside-note{border-top:1px solid var(--edge);padding-top:14px;margin-top:18px;font-size:12px;color:var(--muted)}.aside-note p{color:var(--muted);line-height:1.6}.aside-note meter{display:block;width:100%;height:6px;margin:8px 0 6px;accent-color:var(--leaf)}meter::-webkit-meter-bar{background:#dbe3d2;border:0}meter::-webkit-meter-optimum-value{background:#64834f}
    .title{gap:12px;flex-wrap:wrap}.title input{flex:1;min-width:140px;font-size:20px;font-weight:500;color:var(--ink)}.save-video{font-size:12px;white-space:nowrap}.stage{background:#172319;border-radius:6px 6px 0 0}.empty{padding:32px}.empty h2{font-size:22px;font-weight:500;color:#edf3e8}.empty p{line-height:1.7;max-width:44ch}.playbar{border-color:var(--edge);padding:8px 12px;border-radius:0 0 6px 6px}.clock{min-width:83px;text-align:right}.playbar button:hover:not(:disabled){background:#e5eddf}.editor{border-color:var(--edge);padding:18px;border-radius:6px;box-shadow:none}.editor h2{font-size:16px;font-weight:600}.editor .row{gap:10px}.clip-length{font-variant-numeric:tabular-nums}.notice{color:var(--muted);margin:12px 0 0;overflow-wrap:anywhere}.notice:empty{display:none}.popover summary{border:1px solid transparent}.popover[open]>summary{background:#e5eddf;border-color:var(--edge)}summary:focus-visible{outline:3px solid var(--leaf);outline-offset:2px}.popover>div{max-height:calc(100dvh - 140px);overflow:auto}.settings{padding:10px 16px}.settings>label{gap:12px}.settings .sub{line-height:1.6}.search::placeholder,input::placeholder{color:#596b50;opacity:1}.hud{left:12px;bottom:12px;background:#f5f7f0;border-color:#a8b89c;gap:4px}.hud button{background:transparent;border-color:transparent}.hud output{font-size:12px}.hud[data-recording=true] output{color:#94352a}.hud button:disabled{display:none}
    @media(max-width:760px){.panel{inset:8px}.layout{display:block;overflow:auto}aside{padding:14px;border-right:0;border-bottom:1px solid var(--edge);overflow:visible}.arm-control{width:auto;min-width:160px}aside h2{display:inline-block;margin:0 14px 12px 0}.search{max-width:320px}.library{display:flex;overflow:auto;gap:6px;padding-bottom:4px;scroll-snap-type:x proximity}.library button{min-width:180px;max-width:250px;flex:none;scroll-snap-align:start}.aside-note{margin-top:10px;padding-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.aside-note p{margin:0;font-size:11px}.aside-note p:last-child{flex-basis:100%}.aside-note meter{width:70px;margin:0}.aside-note p:empty{display:none}section{padding:14px;overflow:visible}.stage{min-height:150px}.empty{padding:24px 18px}.empty h2{font-size:19px}.hud{left:8px;bottom:8px}header{padding:14px 16px}.title input{min-width:120px}.editor{padding:14px}.editor .clip-actions{justify-content:flex-start}.clip-length{flex-basis:100%}.settings{display:block;margin:0}}
    @media(max-width:480px){header{align-items:flex-start;flex-wrap:wrap}h1{font-size:22px}.header-actions{width:100%;justify-content:flex-start;gap:4px}.header-actions>[data-id=close]{margin-left:auto}.capture-state{padding-left:0;flex:1;font-size:12px}.popover>div{position:fixed;top:128px;left:18px;right:18px;width:auto;max-height:calc(100dvh - 150px)}.more>div{left:auto;width:200px}.title{gap:6px}.title input{flex-basis:100%;font-size:18px}.empty p{font-size:13px}.playbar{padding:6px}.playbar .row{gap:3px}.playbar button{font-size:12px;padding:5px 7px}.playbar .space{display:none}.playbar .timeline{gap:6px}.playbar select{margin-left:auto}.editor .row label{font-size:12px}}
    .stage{width:100%}.viewer:not(:fullscreen) .stage{max-height:440px}.viewer{min-width:0}
    .retention{flex:none;margin:0;padding:9px 24px;background:#e5eddf;color:#31472c;border-bottom:1px solid var(--edge);font-size:12px;line-height:1.5}.retention[data-risk=true]{background:#fff0cf;color:#634a15}.help{padding:16px!important;width:min(420px,calc(100vw - 36px))!important}.help h2{margin:16px 0 6px}.help h2:first-child{margin-top:0}.help p,.help li{font-size:12px;line-height:1.7;color:var(--muted)}.help ul{padding-left:18px}.sharing-note{font-size:12px;line-height:1.6;color:var(--muted);margin:12px 0 0}.notice{white-space:pre-line}.queue{font-variant-numeric:tabular-nums}
    @media(max-width:760px){aside h2{display:block;margin:16px 0 10px}}
    @media(max-height:500px) and (min-width:761px){.panel{inset:8px}header{padding:10px 18px}.stage{min-height:160px}section{padding:14px 18px}}
    </style>
    <div class="hud"><button data-id="open">Recordings</button><output data-id="hud">Recorder off</output><button data-id="quickmark" aria-label="Mark current moment">Mark</button></div>
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="bl-video-title" hidden>
      <header><div class="header-copy"><h1 id="bl-video-title">Recordings</h1><p>Match videos &amp; clips</p></div><div class="header-actions"><span class="capture-state" data-id="status" role="status" aria-live="polite"></span><details class="popover"><summary>Read first</summary><div class="help"><h2>What this records</h2><p>Silent video of the game canvas, including visible player names. Only matches you participate in. No microphone, voice chat, desktop capture, simulation or automatic uploads.</p><h2>What can be lost</h2><ul><li>Memory-only videos disappear when the activity closes or reloads.</li><li>Local disk recordings use this activity’s browser storage, not your Videos folder. Completed videos can recover for the same verified account. Discord profile changes, cleared activity/site data, uninstall/profile removal or browser eviction may delete them.</li><li>Closing or crashing before verified match completion loses the unfinished video. Stopping auto-record early discards it.</li><li>Disk full, denied storage, encoder failures, leaving a match or unverified participation can stop or discard capture. Older completed videos are never automatically deleted by this recorder.</li></ul><h2>Keep important videos</h2><p>Save full video or Save clip, then check the file in Downloads. A download request is not proof it finished. Keep the activity visible to avoid frozen frames. Clips are created in real time, up to 90 seconds.</p><h2>Sharing is public</h2><p>The local clip helper must be running. Nothing uploads until you confirm. Anyone with a link can watch. Free-host links expire or may be removed earlier; deletion/revocation is not guaranteed. Keep a local copy.</p><h2>Long sessions</h2><p>Local disk mode targets hour-long capture with a bounded 32 MB write queue and an 8 GB library budget. Default Compact targets roughly 450 MB per hour; Smallest targets 270 MB. Smaller files can look softer during motion. Leave extra free space for the game. Capacity estimates are not guarantees. Use disk mode for hour-long recording.</p></div></details><details class="popover"><summary>Settings</summary><div class="settings"><label>Frame rate<select data-id="fps"><option value="24">24 FPS</option><option value="30" selected>30 FPS</option><option value="60">60 FPS</option></select></label>
          <label>Recording size<select data-id="quality"><option value="0.6">Smallest · ~270 MB/hour</option><option value="1" selected>Compact · ~450 MB/hour</option><option value="2">Clearer · ~900 MB/hour</option><option value="3">High · ~1.35 GB/hour</option><option value="6">Very high · ~2.7 GB/hour</option><option value="12">Maximum · ~5.4 GB/hour</option></select><span>Estimates, not limits. Smaller files can look softer during fast motion. Applies to future recordings.</span></label>
          <label>Memory fallback limit<select data-id="memory"><option value="128">128 MB</option><option value="256" selected>256 MB</option><option value="384">384 MB</option></select></label>
          <label><input data-id="auto" type="checkbox">Save video automatically after match</label>
          <p class="sub">Silent game video. Includes visible game names. 30 FPS is recommended for smooth capture.</p><p class="sub">Shortcuts: Space · play/pause, ←/→ · seek, I/O · trim, Ctrl+Shift+M · mark.</p>
        </div></details><button data-id="close" aria-label="Close recordings">Close</button></div></header>
      <p class="retention" data-id="retention" role="status"></p>
      <div class="layout"><aside><button class="arm-control" data-id="arm" aria-pressed="false">Turn on auto-record</button><h2>Your matches</h2><input class="search" data-id="search" type="text" placeholder="Search recordings" aria-label="Filter completed recordings"><div class="library" data-id="library"></div>
        <div class="aside-note"><p data-id="health"></p><meter data-id="memory-used" min="0" max="536870912" value="0" aria-label="Recording storage budget used"></meter><p data-id="storage"></p><p class="queue" data-id="capacity"></p><button class="secondary-link" data-id="mark" hidden>Mark moment</button><p data-id="storage-note">Save important videos to Downloads and check the files.</p></div>
      </aside><section>
        <div class="title"><input data-id="name" type="text" maxlength="80" aria-label="Recording name" placeholder="Select a recording"><button class="save-video" data-id="download">Save full video</button><details class="popover more"><summary aria-label="Recording actions">More</summary><div><button data-id="marks">Save timestamps</button><button class="danger" data-id="delete">Delete recording</button></div></details></div>
        <div class="viewer" data-id="viewer"><div class="stage"><video data-id="video" playsinline preload="auto" tabindex="0" aria-label="Recorded game video" hidden></video>
          <div class="empty" data-id="empty"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="5" y="13" width="22" height="15" rx="3" stroke="currentColor" stroke-width="2"/><path d="M10 13V9a6 6 0 0 1 12 0v4M16 19v4" stroke="currentColor" stroke-width="2"/></svg><h2 data-id="emptyTitle">Record the game you actually see.</h2><p data-id="emptyText">Arm before playing. Mark moments during the match, then watch and save the real footage after it finishes.</p></div>
        </div>
        <div class="playbar"><div class="timeline"><input data-id="scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Video position"><span class="clock" data-id="clock">0:00 / 0:00</span></div>
        <div class="row"><button data-id="play">Play</button><button data-id="back" aria-label="Back five seconds">−5s</button><button data-id="forward" aria-label="Forward five seconds">+5s</button><span class="space"></span>
          <select data-id="speed" aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><button data-id="fullscreen">Fullscreen</button>
        </div></div></div>
        <div class="row"><div class="moments" data-id="moments" aria-label="Marked moments"></div><button class="primary clip-toggle" data-id="clip" aria-expanded="false">Create clip</button></div>
        <div class="editor" data-id="editor" hidden><h2>Trim clip</h2>
          <div class="row"><label>Start<input data-id="in" type="number" min="0" step="0.1" value="0" aria-label="Clip start in seconds"></label><button data-id="setin" title="Use playhead (I)">Set here</button><label>End<input data-id="out" type="number" min="0" step="0.1" value="0" aria-label="Clip end in seconds"></label><button data-id="setout" title="Use playhead (O)">Set here</button><label><input data-id="loop" type="checkbox">Loop</label></div>
          <div class="clip-actions row"><span class="clip-length" data-id="length">Up to 90 seconds</span><label>Expires<select data-id="expiry"><option value="1h">1 hour</option><option value="12h">12 hours</option><option value="24h" selected>24 hours</option><option value="72h">3 days</option></select></label><button data-id="export">Save clip</button><button class="primary" data-id="share">Create link</button><button data-id="cancel" hidden>Cancel</button></div>
          <p class="sharing-note">Create clip → choose a range → Create link → confirm Upload clip. Sharing needs <strong>Start clip sharing.cmd</strong> running. Clips are encoded in real time, up to 720p / 30 FPS. Keep this tab visible. Public links expire; save a local copy.</p>
        </div><p class="notice" data-id="notice" role="status" aria-live="polite"></p>
      </section></div>
    </div>`;
    var $ = function (id) { return root.querySelector('[data-id="' + id + '"]'); }, panel = root.querySelector('.panel'), hud = root.querySelector('.hud');
    var video = $('video'), selected = null, url = null, signature = '', busy = false, abort = null, lastFocus = null, dead = false, selectionEpoch = 0, preparedClip = null;
    var downloadJobs=new Map(),autoAttempts=new Set();
    var acknowledged=false;
    var controls = ['scrub','back','play','forward','speed','fullscreen','name','download','marks','delete','clip','in','out','setin','setout','loop','export','share','expiry'];
    function notice(text) { if($('notice').textContent!==text)$('notice').textContent = text; }
    function revoke() { if (url) URL.revokeObjectURL(url); url = null; }
    function clear() {
      selectionEpoch++; preparedClip = null; video.pause(); video.removeAttribute('src'); video.load(); revoke(); selected = null;
      video.hidden = true; $('empty').hidden = false; $('moments').replaceChildren(); $('editor').hidden = true; $('clip').setAttribute('aria-expanded','false');
      $('scrub').value = 0; $('clock').textContent = '0:00 / 0:00'; if (abort) abort.abort();
    }
    function download(blob, name) {
      if (!service.status().canView) throw Error('Saving is locked while match status is live or unknown.');
      var u = URL.createObjectURL(blob), a = doc.createElement('a'); a.href = u; a.download = name; root.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
    }
    async function save(id) {
      if(downloadJobs.has(id))return;
      var controller=new AbortController();downloadJobs.set(id,controller);
      try{
        var r = service.recording(id);
        if(selected&&selected.id===id&&!busy)r.blob=selected.blob;
        else if(options.indexer){notice('Preparing a seekable full-video download…');try{r.blob=await options.indexer.prepare(r,{signal:controller.signal});}catch(e){if(controller.signal.aborted)throw e;notice('Seek optimization failed. Saving original WebM; try an external player if seeking is unavailable.');}}
        if(controller.signal.aborted||dead)throw Error('Download preparation cancelled.');
        download(r.blob, r.file + '.webm'); service.downloaded(id);notice('Video download requested. Check the completed file in Downloads; the recorder cannot confirm that your browser saved it.');
      }finally{downloadJobs.delete(id);}
    }
    function rangeAround(t) {
      if (!selected) return;
      $('in').value = Math.max(0, t - 5).toFixed(1);
      $('out').value = Math.min(selected.duration, t + 5).toFixed(1);
    }
    async function select(id) {
      if (busy) return;
      try {
        var r = service.recording(id); clear(); selected = r;
        if (options.indexer) {
          busy = true; abort = new AbortController(); var epoch = selectionEpoch;
          notice('Preparing smooth playback…'); refresh();
          try { r.blob = await options.indexer.prepare(r, { signal:abort.signal }); }
          catch (e) { if (!abort.signal.aborted) r.warnings.push('Seek optimization unavailable. Playing original video.'); }
          finally { busy = false; abort = null; }
          if (dead || selectionEpoch !== epoch || !service.status().canView) { refresh(); return; }
        }
        url = URL.createObjectURL(r.blob); video.src = url; video.hidden = false; $('empty').hidden = true;
        $('name').value = r.title; $('scrub').max = r.duration; $('in').value = 0; $('out').value = Math.min(r.duration, 10).toFixed(1);
        $('in').max = $('out').max = r.duration.toFixed(3); video.playbackRate = Number($('speed').value);
        r.marks.forEach(function (m) {
          var b = doc.createElement('button'); b.textContent = time(m.t) + ' · ' + m.label;
          b.onclick = function () { if (!service.status().canView || busy) return; video.currentTime = Math.min(m.t, r.duration); rangeAround(m.t); };
          $('moments').appendChild(b);
        });
        notice(r.warnings.join(' '));
        signature = ''; refresh();
      } catch (e) { notice(e.message); }
    }
    function refresh() {
      if (dead) return;
       var s = service.status();
       if(!s.canView)downloadJobs.forEach(c=>c.abort());
       var disk=!!s.storage&&s.storage.available,low=disk&&s.estimatedRemainingSeconds<3600,retention=disk?(low?'Less than one hour of estimated storage budget remains. Save/delete older cached videos or free disk before a long match. ':'')+'Local disk cache is not a backup. Clearing activity/profile data may delete videos; save important files to Downloads.':s.storage&&!s.storage.ready?'Preparing local disk storage…':'Memory only: closing or reloading the activity deletes unsaved videos. Hour-long capture requires local disk storage.';
       if($('retention').textContent!==retention)$('retention').textContent=retention;$('retention').dataset.risk=String(!disk||low);
      $('status').dataset.state=s.state; panel.setAttribute('aria-busy',String(busy));
      $('status').textContent = s.state === 'recording' ? 'Recording · ' + time(s.capturedSeconds) : s.state === 'paused'?'Partial capture · waiting for match end':s.state === 'warning'?'Capture needs attention':s.state === 'ready' ? 'Ready' : s.state === 'finalizing' ? 'Finalizing' : s.armed ? 'Auto-record on' : 'Recorder off';
      $('status').title = s.message; $('health').textContent = s.state === 'recording' ? size(s.bytes) + ' · ' + s.marks + ' marks' : s.lastError || '';
      hud.dataset.recording = String(s.state === 'recording');hud.dataset.warning=String(['paused','warning'].includes(s.state)); $('hud').textContent = s.state === 'recording' ? 'REC ' + time(s.capturedSeconds) : s.state==='paused'?'Capture stopped':s.state==='warning'?'Capture error':s.state === 'finalizing' ? 'Finalizing…' : s.armed ? 'Armed · ' + s.state : 'Recorder off';
      $('arm').textContent = s.armed ? 'Turn off auto-record' : 'Turn on auto-record'; $('arm').setAttribute('aria-pressed',String(s.armed)); $('mark').disabled = $('quickmark').disabled = s.state !== 'recording';
      ['fps','quality','memory','auto'].forEach(function (key) { $(key).disabled = ['recording','checking','finalizing','paused'].includes(s.state); });
      $('storage').textContent = size(s.totalBytes+s.bytes) + ' of '+size(s.totalLimit||536870912)+(disk?' · local disk':' · memory');
      $('memory-used').max=s.totalLimit||536870912;$('memory-used').value=s.totalBytes+s.bytes;
      $('capacity').textContent=(disk?'Disk budget':'Memory fallback')+' · approx. '+Math.floor((s.estimatedRemainingSeconds||0)/60)+' min'+(disk?' · RAM queue '+size(s.memoryBytes||0)+' · actual free disk may be lower':' remaining');
      $('storage-note').textContent=disk?(s.storage.persistent?'Persistent storage granted; still not a backup.':'Browser eviction protection not granted. Save important videos.'):(s.storage&&s.storage.error||'No disk cache. Unsaved videos disappear on close.');
      if (!s.canView && selected) { clear(); notice('Video viewing/export locked because a live match or unknown state was detected.'); }
      controls.forEach(function (key) { $(key).disabled = !s.canView || !selected || busy; });
      $('emptyTitle').textContent = s.live ? 'See you after the match.' : s.state === 'finalizing' ? 'Finishing your recording…' : s.canView ? 'Pick a match to watch.' : 'Your next match, ready to replay.';
       $('emptyText').textContent = s.live ? 'Your recording unlocks when the match ends. Closing or leaving before verification can discard it.' : s.state==='finalizing' ? 'Finishing the video. Keep the activity open.' : s.recovering ? 'Looking for completed local disk recordings for your verified account…' : s.savedCount ? 'Choose a completed match from Your matches. Save the full video or trim a clip.' : s.armed ? 'Auto-record is on. Play a match; the video will appear here when it ends.' : 'Turn on auto-record before playing. Your completed matches will appear here.';
      if (selected) { var length = Number($('out').value) - Number($('in').value); $('length').textContent = length > 0 ? length.toFixed(1) + 's selected · max 90s' : 'Choose a start and end'; }
      if (preparedClip && (!selected || preparedClip.id !== selected.id || preparedClip.start !== Number($('in').value) || preparedClip.end !== Number($('out').value))) preparedClip = null;
      $('share').textContent = preparedClip ? 'Upload clip' : 'Create link';
      var query = $('search').value.toLowerCase(), next = JSON.stringify([s.revision===undefined?s.recordings:s.revision,s.canView, selected && selected.id, query]);
      if (signature !== next) {
        signature = next; $('library').replaceChildren();
        var matches = s.recordings.filter(function (r) { return r.title.toLowerCase().includes(query); });
        if (!matches.length) { var p = doc.createElement('p'); p.className = 'sub'; p.textContent = !s.canView && s.savedCount ? 'Videos locked during play or unverified status.' : query ? 'No matching recordings.' : 'No completed videos yet.'; $('library').appendChild(p); }
        matches.forEach(function (r) {
          var b = doc.createElement('button'); b.textContent = r.title; b.setAttribute('aria-pressed', String(!!selected && selected.id === r.id));
           var small = doc.createElement('small'); small.textContent = time(r.duration) + ' · ' + size(r.bytes) + ' · ' + r.marks.length + ' marks' + (r.downloaded ? ' · download requested' : r.disk?' · disk cache':' · not downloaded'); b.appendChild(small);
          b.onclick = function () { select(r.id); }; $('library').appendChild(b);
        });
      }
      s.recordings.forEach(function (r) {
        if (r.autoDownload && !r.downloaded&&!autoAttempts.has(r.id)&&!downloadJobs.size) {autoAttempts.add(r.id);save(r.id).catch(e=>notice('Automatic download failed: '+e.message+' Your cached recording is unchanged. Use Save full video to retry.'));}
      });
    }
    function mark() { notice(service.mark() ? 'Moment marked. It will appear below the video after the match.' : 'No active participant video to mark.'); refresh(); }
    function open() { lastFocus = doc.activeElement; panel.hidden = false; hud.hidden = true; refresh(); $('close').focus(); }
    function close() { panel.hidden = true; hud.hidden = false; video.pause(); if (abort) abort.abort(); (lastFocus && lastFocus.isConnected ? lastFocus : $('open')).focus(); }
    function seek(delta) { if (selected && service.status().canView && !busy) video.currentTime = Math.max(0, Math.min(selected.duration, video.currentTime + delta)); }
    async function exportRange(share) {
      if (!selected || busy) return;
      var r;
      try {
        r = service.recording(selected.id); if (selected.blob) r.blob = selected.blob;
        if(!share&&preparedClip&&preparedClip.id===r.id&&preparedClip.start===Number($('in').value)&&preparedClip.end===Number($('out').value)){download(preparedClip.blob,r.file+'-clip-'+preparedClip.start.toFixed(1)+'.webm');notice('Clip download requested. Check Downloads before closing the activity.');return;}
        if (share && preparedClip && preparedClip.id === r.id && preparedClip.start === Number($('in').value) && preparedClip.end === Number($('out').value)) {
          if (!confirm('Upload this clip to Litterbox? Anyone with the link can watch, including visible player names. It expires after ' + $('expiry').selectedOptions[0].text + '. The link opens in a separate tab.')) return;
          if (!options.sharer) throw Error('Clip sharing is unavailable.');
          options.sharer.publish(preparedClip.blob, $('expiry').value, { document:doc, filename:r.file+'-clip-'+preparedClip.start.toFixed(1), canView:function () { return !dead && service.status().canView; } });
          notice('Sharing tab opened. Wait there for the public link. If the helper is unavailable, run Start clip sharing.cmd and retry. Your prepared clip is kept here: Upload clip retries; Save clip downloads it.'); return;
        }
        busy = true; abort = new AbortController(); $('cancel').hidden = false; video.pause(); refresh();
        var blob = await clipper.exportClip(r, Number($('in').value), Number($('out').value), {
          document: doc, signal: abort.signal, canView: function () { return !dead && service.status().canView; },
          progress: function (p) { notice('Creating clip · ' + Math.round(p * 100) + '%'); }
        });
        if(options.indexer){notice('Adding clip duration and seek points…');blob=await options.indexer.prepare({blob:blob,duration:Number($('out').value)-Number($('in').value)},{signal:abort.signal});}
        if(!service.status().canView||abort.signal.aborted)throw Error('Clip preparation cancelled. The original recording is unchanged.');
        preparedClip = { id:r.id, start:Number($('in').value), end:Number($('out').value), blob:blob };
        if (share) {
          if (!service.status().canView || abort.signal.aborted) throw Error('Sharing cancelled.');
          notice('Clip ready. Choose Upload clip to create a public link.');
        } else { download(blob, r.file + '-clip-' + Number($('in').value).toFixed(1) + '.webm'); notice('Clip download requested. Check Downloads before closing the activity.'); }
      } catch (e) { notice(e.message); }
      finally { busy = false; abort = null; $('cancel').hidden = true; refresh(); }
    }
    video.ontimeupdate = function () {
      if (!selected) return;
      if (!service.status().canView) { clear(); refresh(); return; }
      if ($('loop').checked && video.currentTime >= Number($('out').value) && Number($('out').value) > Number($('in').value)) video.currentTime = Number($('in').value);
      $('scrub').value = Math.min(selected.duration, video.currentTime); $('clock').textContent = time(video.currentTime) + ' / ' + time(selected.duration);
    };
    video.onplay = function () { if (!service.status().canView) { clear(); return; } $('play').textContent = 'Pause'; };
    video.onpause = function () { $('play').textContent = 'Play'; };
    video.onerror = function () { if (selected) notice('This video could not be decoded here. Try Save full video and open the WebM externally.'); };
    $('open').onclick = open; $('close').onclick = close; $('quickmark').onclick = $('mark').onclick = mark;
    $('arm').onclick = function () {
      var s = service.status();
      if(!s.armed&&!acknowledged){if(!confirm('Record silent game-canvas video, including visible player names?\n\n'+(s.storage&&s.storage.available?'Completed recordings use local browser disk storage, not your Videos folder. Cleared profile/activity data or eviction can delete them.':'Disk storage is not ready or unavailable. Memory-only fallback cannot capture an hour and loses unsaved videos on close/reload.')+'\n\nClosing, leaving or crashing before verified match completion may discard unfinished video. Keep the activity visible. Save important videos to Downloads and check the files. Nothing uploads without your confirmation.\n\nContinue?'))return;acknowledged=true;}
      if (s.armed && ['recording','checking','finalizing'].includes(s.state) && !confirm('Stop recording? This unfinished video will be discarded.')) return;
      service.arm(!s.armed); refresh();
    };
    $('play').onclick = function () { if (!selected || busy || !service.status().canView) return; video.paused ? video.play().catch(function (e) { notice(e.message); }) : video.pause(); };
    $('back').onclick = function () { seek(-5); }; $('forward').onclick = function () { seek(5); };
    $('scrub').oninput = function () { if (selected) $('clock').textContent = time(Number(this.value)) + ' / ' + time(selected.duration); };
    $('scrub').onchange = function () { if (selected && service.status().canView) video.currentTime = Number(this.value); };
    $('speed').onchange = function () { video.playbackRate = Number(this.value); };
    $('fullscreen').onclick = function () { if (service.status().canView) { if (doc.fullscreenElement) doc.exitFullscreen(); else $('viewer').requestFullscreen().catch(function (e) { notice(e.message); }); } };
    $('clip').onclick = function () { $('editor').hidden = !$('editor').hidden; $('clip').setAttribute('aria-expanded', String(!$('editor').hidden)); if (!$('editor').hidden) rangeAround(video.currentTime); refresh(); if (!$('editor').hidden) $('editor').scrollIntoView({block:'nearest'}); };
    $('setin').onclick = function () { $('in').value = video.currentTime.toFixed(1);refresh(); }; $('setout').onclick = function () { $('out').value = video.currentTime.toFixed(1);refresh(); };
    $('name').onchange = function () { try { service.rename(selected.id, $('name').value); selected.title = $('name').value; signature = ''; refresh(); } catch (e) { notice(e.message); } };
    $('download').onclick = async function () { try { await save(selected.id); refresh(); } catch (e) { notice(e.message); } };
    $('marks').onclick = function () { try { var r = service.recording(selected.id); download(new Blob([JSON.stringify(service.metadata(r.id), null, 2)], { type: 'application/json' }), r.file + '-moments.json'); notice('Saved bookmark timestamps. Keep this file alongside your WebM.'); } catch (e) { notice(e.message); } };
    $('delete').onclick = async function () { if (selected&&!busy && confirm('Permanently delete this cached recording? There is no undo. This does not delete a separately downloaded file or revoke a public clip link. Check your download first.')) { try{busy=true;refresh();await service.remove(selected.id);clear();notice('Cached recording deleted. Downloaded files and public links are unchanged.');}catch(e){notice('Could not delete the recording: '+e.message);}finally{busy=false;refresh();} } };
    $('export').onclick = function () { exportRange(false); }; $('share').onclick = function () { exportRange(true); }; $('cancel').onclick = function () { if (abort) abort.abort(); };
    $('search').oninput = refresh;
    function prefs() {
      try {
        var p = service.configure({ fps: Number($('fps').value), mbps: Number($('quality').value), maxMB: Number($('memory').value), autoDownload: $('auto').checked });
        try { localStorage.setItem('bl-video-prefs/v1', JSON.stringify(p)); } catch (_) {}
      } catch (e) { notice(e.message); }
    }
    ['fps','quality','memory','auto'].forEach(function (key) { $(key).onchange = prefs; });
    try {
      var stored = JSON.parse(localStorage.getItem('bl-video-prefs/v1') || 'null');
      if (stored) service.configure(stored);
    } catch (_) {}
    var config = service.status().settings; $('fps').value = config.fps; $('quality').value = config.mbps; $('memory').value = config.maxMB; $('auto').checked = config.autoDownload;
    function key(e) {
      if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();var popover=panel.querySelector('details[open]');if(popover){popover.open=false;popover.querySelector('summary').focus();}else close();return;}
      var path = e.composedPath ? e.composedPath() : [e.target], typing = path.some(function (el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); });
      // Window-level events are retargeted at a CLOSED shadow host; their path
      // omits our internal inputs. Check the actual focused element here too.
      var focused = root.activeElement;
      typing = typing || !!focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName));
      if (typing) return;
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && ['KeyR','KeyM'].includes(e.code)) {
        e.preventDefault(); e.stopPropagation(); if (!e.repeat) e.code === 'KeyR' ? open() : mark(); return;
      }
      if (panel.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey || busy || !selected || !service.status().canView) return;
      if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); seek(e.shiftKey ? -1 : -5); }
      if (e.code === 'ArrowRight') { e.preventDefault(); seek(e.shiftKey ? 1 : 5); }
      if (e.code === 'KeyI') $('setin').click(); if (e.code === 'KeyO') $('setout').click();
    }
    doc.defaultView.addEventListener('keydown', key, true);
    root.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Tab' && !panel.hidden) {
        var all = Array.from(panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,video')).filter(function (el) { return el.getClientRects().length > 0; });
        var first = all[0], last = all[all.length - 1];
        if (e.shiftKey && root.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && root.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    ['pointerdown','pointerup','mousedown','mouseup','click'].forEach(function (name) { root.addEventListener(name, function (e) { e.stopPropagation(); }); });
    root.addEventListener('toggle',function(e){if(e.target.tagName==='DETAILS'&&e.target.open)root.querySelectorAll('details[open]').forEach(function(d){if(d!==e.target)d.open=false;});},true);
    function beforeClose(e) { var s=service.status();if (s.savedCount||s.bytes||s.finalizing||busy||downloadJobs.size) { e.preventDefault(); e.returnValue = ''; } }
    doc.defaultView.addEventListener('beforeunload', beforeClose);
    var lastHidden=0,interval = setInterval(function(){var t=performance.now();if(panel.hidden&&t-lastHidden<1000)return;lastHidden=t;refresh();}, 200); refresh();
    return Object.freeze({ open: open, mark: mark,
      inspect: function () { var q = video.getVideoPlaybackQuality && video.getVideoPlaybackQuality(); return { open: !panel.hidden, text: $('status').textContent, hud: $('hud').textContent, nativeControls:video.controls, selected:!!selected, finiteDuration:!!selected && Number.isFinite(video.duration), decodedFrames:q ? q.totalVideoFrames : 0, droppedFrames:q ? q.droppedVideoFrames : 0 }; },
      dispose: function () { dead = true; clearInterval(interval); if (abort) abort.abort();downloadJobs.forEach(c=>c.abort()); clear(); doc.defaultView.removeEventListener('keydown', key, true); doc.defaultView.removeEventListener('beforeunload', beforeClose); host.remove(); }
    });
  }
  return { mount: mount, time: time };
});
