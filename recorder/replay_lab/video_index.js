// Seekable WebM metadata for the MediaRecorder format. Runs in a worker: encoded
// frames are never decoded, copied to canvases, or regenerated here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BLVideoIndex = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function workerMain() {
    async function index(blob, seconds) {
      var cache = new Uint8Array(0), cacheAt = -1;
      async function bytes(at, count) {
        if (at < 0 || at + count > blob.size) throw Error('Truncated WebM.');
        if (at < cacheAt || at + count > cacheAt + cache.length) { cacheAt = at; cache = new Uint8Array(await blob.slice(at, Math.min(blob.size, at + Math.max(1048576, count))).arrayBuffer()); }
        return cache.subarray(at - cacheAt, at - cacheAt + count);
      }
      function vint(a, at, keep) {
        var n = 1, mask = 128; while (n <= 8 && !(a[at] & mask)) { n++; mask >>= 1; }
        if (n > 8 || at + n > a.length) throw Error('Invalid EBML header.');
        var value = keep ? a[at] : a[at] & (mask - 1), unknown = !keep && value === mask - 1;
        for (var i = 1; i < n; i++) { value = value * 256 + a[at + i]; unknown = unknown && a[at + i] === 255; }
        return { n:n, value:value, unknown:unknown };
      }
      async function element(at) {
        var a = await bytes(at, Math.min(16, blob.size - at)), id = vint(a, 0, true), size = vint(a, id.n, false), data = at + id.n + size.n;
        if (!size.unknown && data + size.value > blob.size) throw Error('Truncated EBML element.');
        return { id:id.value, at:at, data:data, end:size.unknown ? null : data + size.value };
      }
      function uint(n) { var a = []; do { a.unshift(n % 256); n = Math.floor(n / 256); } while (n); return new Uint8Array(a); }
      function size(n) {
        var len = 1; while (n >= Math.pow(2, 7 * len) - 1) len++;
        var a = new Uint8Array(len); for (var i = len - 1; i >= 0; i--) { a[i] = n % 256; n = Math.floor(n / 256); } a[0] |= 1 << (8 - len); return a;
      }
      function concat(parts) { var n = parts.reduce(function (v, a) { return v + a.length; }, 0), out = new Uint8Array(n), at = 0; parts.forEach(function (a) { out.set(a,at); at += a.length; }); return out; }
      function el(id, data) { return concat([uint(id),size(data.length),data]); }
      function val(id, n) { return el(id,uint(n)); }
      var ebml = await element(0); if (ebml.id !== 0x1a45dfa3 || !ebml.end) throw Error('Not a MediaRecorder WebM.');
      var segment = await element(ebml.end); if (segment.id !== 0x18538067) throw Error('Missing WebM segment.');
      var at = segment.data, prefix = [], clusters = [], scale = 1000000, videoTrack = 1, scanned = 0;
      while (at < blob.size) {
        var e = await element(at);
        if (e.id === 0x1f43b675) {
          var cursor = e.data, tick = 0, key = false,hasTick=false;
          while (cursor < (e.end || blob.size)) {
            var child = await element(cursor);
            if ([0x1f43b675,0x1c53bb6b,0x1549a966,0x1654ae6b,0x114d9b74,0x1254c367].includes(child.id)) break;
            if (!child.end) throw Error('Unsupported unknown-sized cluster child.');
            if (child.id === 0xe7) { var t = await bytes(child.data,child.end-child.data); tick = Array.from(t).reduce(function (n,v) { return n * 256 + v; },0);hasTick=true; }
            if (child.id === 0xa3) { var block = await bytes(child.data,Math.min(12,child.end-child.data)), track = vint(block,0,false); if (track.value === videoTrack && block[track.n + 2] & 128) key = true; }
            if (child.id === 0xa0) {
              var gp = child.data, referenced = false, video = false;
              while (gp < child.end) {
                var g = await element(gp); if (!g.end) throw Error('Invalid block group.');
                if (g.id === 0xfb) referenced = true;
                if (g.id === 0xa1) { var head = await bytes(g.data,Math.min(12,g.end-g.data)); video = vint(head,0,false).value === videoTrack; }
                gp = g.end;
              }
              if (video && !referenced) key = true;
            }
            cursor = child.end;
            if(e.end&&key&&hasTick){cursor=e.end;break;} // Sized cluster: no need to read every encoded frame header.
          }
          var end = e.end || cursor; clusters.push({ at:e.at, end:end, time:tick, key:key }); at = end;
        } else {
          if (!e.end) throw Error('Unsupported unknown-sized WebM metadata.');
          if (e.id === 0x1549a966) {
            var fields = [], p = e.data;
            while (p < e.end) {
              var f = await element(p); if (!f.end) throw Error('Invalid Info metadata.');
              if (f.id === 0x2ad7b1) scale = Array.from(await bytes(f.data,f.end-f.data)).reduce(function (n,v) { return n*256+v; },0);
              if (f.id !== 0x4489 && f.id !== 0xbf) fields.push(new Uint8Array(await blob.slice(f.at,f.end).arrayBuffer()));
              p = f.end;
            }
            var duration = new Uint8Array(8); new DataView(duration.buffer).setFloat64(0,seconds * 1e9 / scale);
            fields.push(el(0x4489,duration)); prefix.push(el(0x1549a966,concat(fields)));
          } else if (![0x114d9b74,0x1c53bb6b,0xec,0xbf].includes(e.id)) prefix.push(new Uint8Array(await blob.slice(e.at,e.end).arrayBuffer()));
          at = e.end;
        }
        if (++scanned % 20 === 0) self.postMessage({ progress:Math.min(.98,at/blob.size) });
      }
      if (!clusters.length || !clusters.some(function (c) { return c.key; })) throw Error('No seekable video clusters found.');
      function seekHead(position) {
        var n = new Uint8Array(8); new DataView(n.buffer).setUint32(4,position);
        return el(0x114d9b74,el(0x4dbb,concat([el(0x53ab,uint(0x1c53bb6b)),el(0x53ac,n)])));
      }
      var metadata = concat(prefix), offsets = [], offset = metadata.length + seekHead(0).length;
      clusters.forEach(function (c) { offsets.push(offset); offset += c.end-c.at; });
      var points = []; clusters.forEach(function (c,i) { if (c.key) points.push(el(0xbb,concat([val(0xb3,c.time),el(0xb7,concat([val(0xf7,videoTrack),val(0xf1,offsets[i])]))]))); });
      var parts = [blob.slice(0,ebml.end),new Uint8Array([0x18,0x53,0x80,0x67,0x01,255,255,255,255,255,255,255]),seekHead(offset),metadata];
      clusters.forEach(function (c) { parts.push(blob.slice(c.at,c.end)); }); parts.push(el(0x1c53bb6b,concat(points)));
      return new Blob(parts,{type:'video/webm'});
    }
    self.onmessage = async function (event) {
      try { var result = await index(event.data.blob,event.data.duration); self.postMessage({ blob:result }); }
      catch (e) { self.postMessage({ error:e.message }); }
    };
  }
  function prepare(record, options) {
    options = options || {};
    return new Promise(function (resolve,reject) {
      if (!Number.isFinite(record.duration) || record.duration <= 0) return reject(Error('Invalid video duration.'));
      var url = URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'],{type:'application/javascript'})), worker, timer;
      function done(err,blob) { clearTimeout(timer); if (worker) worker.terminate(); URL.revokeObjectURL(url); if (options.signal) options.signal.removeEventListener('abort',cancel); err ? reject(err) : resolve(blob); }
      function cancel() { done(Error('Video preparation cancelled.')); }
      if (options.signal && options.signal.aborted) { cancel(); return; }
      try { worker = new Worker(url); } catch (e) { done(e); return; }
      if (options.signal) options.signal.addEventListener('abort',cancel,{once:true});
      timer = setTimeout(function () { done(Error('Video preparation timed out.')); },90000);
      worker.onerror = function () { done(Error('Video indexing worker failed.')); };
      worker.onmessage = function (e) {
        if (e.data.error) done(Error(e.data.error));
        else if (e.data.blob) done(null,e.data.blob);
        else if (options.progress) options.progress(e.data.progress);
      };
      worker.postMessage({blob:record.blob,duration:record.duration});
    });
  }
  return { prepare:prepare };
});
