// Real canvas pixels -> MediaRecorder -> WebM. No scene renderer or physics.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLVideoRecorder = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function create(options) {
    var now = options.now || function () { return performance.now(); };
    var Recorder = options.MediaRecorder || MediaRecorder;
    var armed = false, pending = null, library = [], sample = null, lastRead = -Infinity;
    var state = 'idle', message = 'Arm to record actual game video.', lastError = '', sequence = 0, disposed = false, blockedContext = null;
    var settings = { fps: 30, mbps: 1, maxMB: 256, autoDownload: false };
    var MAX_TOTAL = 512 * 1024 * 1024, HOLD = 2000, MISSING = 5000;
    var store=options.storage||null, recovered=new Set(), loading=0, committing=0;
    var revision=0,cachedOwner=null,cachedRevision=-1,cachedSummaries=[];
    function changed(){revision++;}
    function summaries(owner){
      if(cachedOwner!==owner||cachedRevision!==revision){cachedOwner=owner;cachedRevision=revision;cachedSummaries=Object.freeze(library.filter(r=>r.owner===owner).map(function(r){var s=summary(r);s.marks=Object.freeze(s.marks.map(Object.freeze));s.warnings=Object.freeze(s.warnings);return Object.freeze(s);}));}
      return cachedSummaries;
    }
    var DISK_TOTAL=8*1024*1024*1024;
    function disk(){return !!store&&store.status().available;}
    function totalLimit(){return disk()?DISK_TOTAL:MAX_TOTAL;}
    function recover(owner){
      if(!store||recovered.has(owner))return;recovered.add(owner);loading++;
      store.load(owner).then(function(rows){if(disposed)return;var ids=new Set(library.map(r=>r.id));rows.forEach(function(r){if(!ids.has(r.id))library.push(r);});library.sort((a,b)=>b.created-a.created);changed();}).catch(function(e){lastError='Could not recover disk recordings: '+e.message;recovered.delete(owner);}).finally(function(){loading--;});
    }
    function supportedMime() {
      return ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(function (m) { return Recorder.isTypeSupported(m); });
    }
    function member(s) { return s && typeof s.identity === 'string' && s.identity.length > 0 && typeof s.context === 'string'; }
    function active(s) { return member(s) && s.phase === 'active' && s.role === 'player'; }
    function post(s) { return member(s) && ['completed', 'idle'].includes(s.phase) && ['player', 'former-player'].includes(s.role); }
    function outcome(s) { return s.phase === 'completed' && [0, 1, 2].includes(s.winner) && [0, 1, 2].includes(s.endReason); }
    function fresh() { var dt = now() - lastRead; return dt >= 0 && dt <= 1500; }
    function allowed() {
      return fresh() && post(sample) && !pending && library.some(function (r) { return r.owner === sample.identity; });
    }
    function tracksStop(p) {
      if (p.stream) p.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} });
    }
    function discard(reason) {
      var p = pending; pending = null;
      if (p) blockedContext = p.context;
      if (p) { p.cancelled = true; p.chunks = [];clearTimeout(p.openTimer); if(p.sink)p.sink.abort().catch(function(e){lastError='Temporary disk cleanup failed: '+e.message;}); if (p.media && p.media.state !== 'inactive') p.media.stop(); tracksStop(p); }
      state = 'warning'; message = reason; lastError = reason;
    }
    function bytesUsed() { return library.reduce(function (n, r) { return n + r.blob.size; }, 0); }
    function finish() {
      var p = pending;
      if (!p || p.committing || !p.end || !p.stopped || now() - p.endAt < HOLD || !fresh() || !post(sample) ||
          sample.context !== p.context || sample.identity !== p.owner) return;
      if ((!p.sink&&!p.chunks.length) || p.bytes < 100) { discard('The encoder produced no video. Check canvas capture support.'); return; }
      var blob = p.sink?null:new Blob(p.chunks, { type: p.mime });
      if (bytesUsed() + p.bytes > totalLimit() || library.length >= (disk()?500:10)) {
        discard('Recording library is full. Download/delete an older video before the next match.'); return;
      }
      var stamp = new Date().toISOString().replace(/[:.]/g, '-');
      var row={ id: 'video-' + (++sequence), title: 'Match ' + sequence, file: 'bobble-' + stamp,
        blob: blob, owner: p.owner, context: p.context, created: Date.now(), duration: p.duration,
        marks: p.marks.filter(function (m) { return m.t <= p.duration; }), fps: p.fps,
        width: p.width, height: p.height, mime: p.mime, warnings: p.warnings.slice(), partial: p.partial,
        autoDownload: settings.autoDownload, downloaded: false, disk:!!p.sink };
      p.chunks = []; pending = null;blockedContext=p.context;
      if(p.sink){
        p.committing=true;committing++;state='finalizing';message='Saving the verified recording to local disk…';
        p.sink.finish(row,p.owner).then(function(result){row.blob=result.blob;row.id=result.id;if(result.recoveryWarning){row.warnings.push(result.recoveryWarning);lastError=result.recoveryWarning;}if(!disposed){library.unshift(row);changed();}}).catch(function(e){lastError='Disk finalization failed: '+e.message;state='warning';message=lastError;}).finally(function(){committing--;});
      }else{library.unshift(row);changed();}
      if(!p.sink){state = 'ready'; message = 'Actual game video is ready. Select it to watch or save.';}
    }
    function stopPartial(reason){
      var p=pending;if(!p||p.captureStopped)return;p.captureStopped=true;p.duration=Math.max(0,((p.lastChunkAt||p.started)-p.started)/1000);p.warnings.push(reason);p.warnings.push('Partial capture: the final fragment may be incomplete. Save and verify the video.');lastError=reason;
      state='paused';message=reason+' Capture stopped; keeping the partial video locked until verified match completion.';
      if(p.media.state!=='inactive')p.media.stop();
    }
    function stopAtEnd(s) {
      var p = pending;
      if (!p.end) {
        p.end = { winner: s.winner, reason: s.endReason };
        p.endAt = now(); if(!p.captureStopped)p.duration = Math.max(0, (now() - p.started) / 1000);
        state = 'finalizing'; message = 'Match finished. Finalizing the video…';
        if (p.media.state !== 'inactive') p.media.stop();
      } else if (s.phase === 'completed' && (p.end.winner !== s.winner || p.end.reason !== s.endReason)) {
        discard('Result changed during verification. Video stays unavailable.'); return;
      }
      finish();
    }
    function start(s) {
      if(store&&!store.status().ready){state='checking';message='Preparing local disk storage…';return;}
      if (library.length >= (disk()?500:10) || bytesUsed() > totalLimit() - 1024 * 1024) {
        state = 'warning'; message = 'Library full. Download/delete a video before recording another match.'; return;
      }
      var canvas = options.canvas(), mime = supportedMime();
      if (!canvas || typeof canvas.captureStream !== 'function' || !canvas.width || !canvas.height) throw Error('Game canvas capture is unavailable.');
      if (!mime) throw Error('This client has no supported WebM encoder.');
      var stream = canvas.captureStream(settings.fps), p = {
        context: s.context, owner: s.identity, started: now(), chunks: [], bytes: 0,
        marks: [], warnings: [], fps: settings.fps, width: canvas.width, height: canvas.height,
        mime: mime, stream: stream, stopped: false, end: null, endAt: 0, cancelled: false,
        partial: true, duration: 0, missingSince: null, lastAt: now(), sink:null, initializing:false, queuedBytes:0, peakQueuedBytes:0, captureStopped:false
      };
      try {
        if (!stream.getVideoTracks().length) throw Error('Game canvas did not provide a video track.');
        // Canvas capture is video-only. Never tap microphone or Discord audio.
        stream.getAudioTracks().forEach(function (t) { stream.removeTrack(t); t.stop(); });
        p.media = new Recorder(stream, { mimeType: mime, videoBitsPerSecond: settings.mbps * 1000000 });
        p.media.ondataavailable = function (e) {
          if (p.cancelled || p.captureStopped || disposed || pending !== p || !e.data || !e.data.size) return;
          if (p.bytes+e.data.size > (p.sink?DISK_TOTAL:settings.maxMB * 1024 * 1024) || p.bytes+e.data.size + bytesUsed() > totalLimit()) {
            stopPartial(p.sink?'Local disk budget reached.':'Memory fallback limit reached.'); return;
          }
          if(p.sink){
            if(p.queuedBytes+e.data.size>32*1048576){stopPartial('Disk writes are too slow; the 32 MB queue is full.');return;}
            p.queuedBytes+=e.data.size;p.peakQueuedBytes=Math.max(p.peakQueuedBytes,p.queuedBytes);
            p.sink.append(e.data).catch(function(err){if(pending===p)discard('Disk write failed. Unfinished video cannot be released: '+err.message);}).finally(function(){p.queuedBytes-=e.data.size;});
          }else p.chunks.push(e.data);
          p.bytes+=e.data.size;
          p.lastChunkAt=now();
        };
        p.media.onerror = function () { if (pending === p) discard('Video encoder failed. No replay released.'); };
        p.media.onstop = function () {
          p.stopped = true; tracksStop(p);
          if (p.cancelled || disposed || pending !== p) return;
          if (!p.end&&!p.captureStopped) { discard('Video capture stopped before match completion. No replay released.'); return; }
          finish();
        };
        stream.getVideoTracks().forEach(function (track) {
          track.onended = function () { if (pending === p && !p.end) discard('Game video source ended before match completion.'); };
          track.onmute = function () {
            if (pending === p && !p.warnings.includes('Source was suspended; video may contain frozen frames.')) p.warnings.push('Source was suspended; video may contain frozen frames.');
          };
        });
        pending = p;
        function begin(){if(pending!==p||disposed||p.cancelled)return;p.initializing=false;p.started=now();p.media.start(1000);state='recording';message='Recording actual game video. Playback unlocks after match end.';lastError='';}
        if(disk()){
          p.initializing=true;state='checking';message='Opening local disk recording…';
          p.openTimer=setTimeout(function(){if(pending===p&&p.initializing)discard('Disk recording did not open within 15 seconds. Free disk space or check storage permissions, then re-arm.');},15000);
          store.open().then(function(sink){if(pending!==p||disposed||p.cancelled){sink.abort().catch(()=>{});return;}p.sink=sink;begin();}).catch(function(e){if(pending===p)discard('Cannot open disk recording: '+e.message);}).finally(function(){clearTimeout(p.openTimer);});
        }else{if(store)p.warnings.push('Memory-only fallback: unsaved video is lost when the activity closes.');begin();}
      } catch (e) { tracksStop(p); throw e; }
    }
    function observe(s) {
      if (disposed) return;
      var t = now(), delta = t - lastRead;
      if (!Number.isFinite(t) || delta < 0) { sample = null; discard('Clock changed. Pending video discarded.'); return; }
      sample = s; lastRead = t;
      if(member(s))recover(s.identity);
      if (!s || !member(s) || !['active', 'completed', 'idle'].includes(s.phase)) {
        if (pending) {
          if (pending.missingSince == null) pending.missingSince = t;
          state = pending.captureStopped?'paused':'checking'; message = pending.captureStopped?lastError+' Partial video stays locked until verified match completion.':'Checking match status. Video remains locked.';
          if (t - pending.missingSince > MISSING&&!pending.end) {
            if(pending.initializing)discard('Match status was lost before disk recording opened.');
            else stopPartial('Match status unavailable for 5 seconds. Capture stopped; prior footage is retained but locked.');
          }
        } else { state = armed ? 'waiting' : 'idle'; message = armed ? 'Armed. Waiting for a participant match.' : 'Arm to record actual game video.'; }
        return;
      }
      if (pending) {
        var p = pending;
        if (s.context !== p.context || s.identity !== p.owner) { discard('Match or account changed before release. Pending video discarded.'); return; }
        if (s.phase === 'active' && !active(s) || s.phase !== 'active' && !post(s)) { discard('Participation could not be verified. Pending video discarded.'); return; }
        if (s.phase === 'active') {
          if (p.end) { discard('Game resumed before verified completion. No replay released.'); return; }
          if (delta > 1500 || p.missingSince != null) {
            if (!p.warnings.includes('Background sampling gap; video may contain frozen frames.')) p.warnings.push('Background sampling gap; video may contain frozen frames.');
          }
          p.missingSince = null; state = p.initializing?'checking':p.captureStopped?'paused':'recording'; message = p.initializing?'Opening local disk recording…':p.captureStopped?lastError+' Partial video stays locked until verified match completion.':'Recording actual game video. Playback unlocks after match end.';
          return;
        }
        p.missingSince = null;
        if(p.initializing){discard('Match ended before disk recording could start.');return;}
        if (outcome(s)) stopAtEnd(s);
        else if (s.phase === 'idle' && p.end) { state = 'finalizing'; message = 'Finalizing completed video…'; finish(); }
        else discard('Match left play without an observed GameOver. Video was not released.');
        return;
      }
      if (active(s) && armed && s.context !== blockedContext) {
        try { start(s); } catch (e) { armed = false; discard('Cannot start video capture: ' + e.message); }
      } else if (active(s) && armed && s.context === blockedContext) {
        state = 'warning'; message = lastError + ' Disarm/re-arm to start a new partial capture, or wait for the next match.';
      } else if (s.phase === 'active') {
        state = s.role === 'spectator' ? 'ineligible' : 'idle';
        message = s.role === 'spectator' ? 'Spectator recording is disabled.' : 'Recorder is off. Live playback remains locked.';
      } else if(committing){state='finalizing';message='Saving the verified recording to local disk…';}
      else if (allowed()) { state = 'ready'; message = 'Completed videos are ready. Select a recording.'; }
      else { state = armed ? 'waiting' : 'idle'; message = armed ? 'Armed. Waiting for a participant match.' : 'Arm to record actual game video.'; }
    }
    function find(id) {
      if (!allowed()) throw Error('Viewing and saving video are locked until verified match completion.');
      var r = library.find(function (item) { return item.id === id && item.owner === sample.identity; });
      if (!r) throw Error('Recording not found.');
      return r;
    }
    function summary(r) {
      return { id: r.id, title: r.title, duration: r.duration, bytes: r.blob.size, created: r.created,
        marks: r.marks.map(function (m) { return { t: m.t, label: m.label }; }),
        fps: r.fps, width: r.width, height: r.height, warnings: r.warnings.slice(),
        partial: r.partial, autoDownload: r.autoDownload, downloaded: r.downloaded, disk:r.disk===true };
    }
    return Object.freeze({
      observe: observe,
      arm: function (v) { armed = v !== false; if (!armed && pending) discard('Recording stopped early. Pending video discarded.'); if (armed) {blockedContext = null;if(store)store.persist().catch(()=>{});} return armed; },
      configure: function (prefs) {
        if (pending) throw Error('Change capture quality before the next recording.');
        if(prefs.fps!==undefined&&![24,30,60].includes(prefs.fps)||prefs.mbps!==undefined&&![0.6,1,2,3,6,12].includes(prefs.mbps)||prefs.maxMB!==undefined&&![128,256,384].includes(prefs.maxMB))throw Error('Choose supported frame rate, quality and memory presets.');
        if (prefs.fps !== undefined) { if (![24, 30, 60].includes(prefs.fps)) throw Error('Choose 24, 30 or 60 FPS.'); settings.fps = prefs.fps; }
        if (prefs.mbps !== undefined) { settings.mbps = prefs.mbps; }
        if (prefs.maxMB !== undefined) { if (![128, 256, 384].includes(prefs.maxMB)) throw Error('Choose a supported memory limit.'); settings.maxMB = prefs.maxMB; }
        if (prefs.autoDownload !== undefined) settings.autoDownload = prefs.autoDownload === true;
        return Object.assign({}, settings);
      },
      mark: function (label) {
        if (!pending || pending.end || pending.initializing || pending.captureStopped || !fresh() || !active(sample) || pending.marks.length >= 1000) return false;
        var t = Math.max(0, (now() - pending.started) / 1000);
        if (pending.marks.length && t - pending.marks[pending.marks.length - 1].t < .3) return false;
        pending.marks.push({ t: t, label: String(label || 'Marked moment').slice(0, 80) }); return true;
      },
      status: function () {
        return { kind: 'real-video', armed: armed, state: state, message: message, canView: allowed(),
          live: !!sample && sample.phase === 'active', role: sample ? sample.role : 'unknown',
          capturedSeconds: pending ? Math.max(0, Math.floor((pending.end||pending.captureStopped ? pending.duration : pending.initializing?0:(now() - pending.started) / 1000))) : 0,
          bytes: pending ? pending.bytes : 0, chunks: pending ? pending.chunks.length : 0,
          marks: pending ? pending.marks.length : 0, totalBytes: bytesUsed(), savedCount: library.length,
          lastError: lastError, warnings: pending ? pending.warnings.slice() : [],
          storage:store?store.status():{ready:true,available:false,persistent:false},recovering:loading>0,finalizing:committing>0,
          memoryBytes:pending?(pending.sink?pending.queuedBytes:pending.bytes):0,peakQueuedBytes:pending?pending.peakQueuedBytes:0,totalLimit:totalLimit(),
          estimatedRemainingSeconds:Math.max(0,Math.floor(Math.min(totalLimit()-bytesUsed()-(pending?pending.bytes:0),disk()?(store.status().quota?Math.max(0,store.status().quota-store.status().usage-(pending?pending.bytes:0)-128*1048576):Infinity):settings.maxMB*1048576-(pending?pending.bytes:0))*8/(settings.mbps*1000000))),
          revision:revision,settings: Object.assign({}, settings), recordings: allowed() ? summaries(sample.identity) : [] };
      },
      recording: function (id) { var r = find(id); return Object.assign(summary(r), { blob: r.blob, file: r.file }); },
      rename: function (id, title) { var r = find(id); r.title = String(title).trim().slice(0, 80) || r.title;changed();if(r.disk)store.update(r,r.owner).catch(e=>{lastError='Title was not saved to disk: '+e.message;}); },
      downloaded: function (id) { var r=find(id);r.downloaded = true;changed();if(r.disk)store.update(r,r.owner).catch(e=>{lastError='Download status was not saved: '+e.message;}); },
      metadata: function (id) {
        var r = find(id);
        return { format: 'bobble-video-moments/1', title: r.title, duration: r.duration, width: r.width, height: r.height,
          fps: r.fps, audio: false, partial: true, warnings: r.warnings.slice(),
          marks: r.marks.map(function (m) { return { t: m.t, label: m.label }; }) };
      },
      remove: async function (id) { var r=find(id);if(r.disk)await store.remove(id);library = library.filter(function (r) { return r.id !== id; });changed(); },
      dispose: function () { disposed = true; if (pending) discard('Recorder closed.'); library = [];changed();cachedSummaries=[]; armed = false; sample = null; }
    });
  }
  return { create: create };
});
