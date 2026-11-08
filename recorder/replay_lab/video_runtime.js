(function () {
  'use strict';
  if (window.__blReplay) return;
  var reader = window.BLReplayReader.createReader(function () {
    var u = window.__blUnity || window.unityInstance, m = u && (u.Module || u);
    return m && m.HEAPU8 && m.HEAPU8.buffer || m && m.asm && m.asm.Kh && m.asm.Kh.buffer || null;
  });
  var storage=window.BLVideoStore.create();
  var recorder = window.BLVideoRecorder.create({ storage:storage, canvas: function () {
    var exact = document.querySelector('#unity-canvas, #canvas');
    if (exact && exact.tagName === 'CANVAS') return exact;
    return Array.from(document.querySelectorAll('canvas')).filter(function (c) {
      return c.id !== 'blt-arc' && c.width > 0 && c.height > 0;
    }).sort(function (a, b) { return b.width * b.height - a.width * a.height; })[0] || null;
  } });
  var ui = window.BLVideoUI.mount(recorder, window.BLVideoClip, { indexer:window.BLVideoIndex, sharer:window.BLClipShare }), errors = 0, readMs = 0;
   delete window.BLReplayReader; delete window.BLVideoRecorder; delete window.BLVideoStore; delete window.BLVideoUI; delete window.BLVideoClip; delete window.BLVideoIndex; delete window.BLClipShare;
  var timer = setInterval(function () {
    var t = performance.now();
    try { recorder.observe(reader.read()); } catch (_) { errors++; recorder.observe(null); }
    readMs = performance.now() - t;
  }, 200);
  window.__blReplay = Object.freeze({
    version: 'video-replay-3-disk', open: ui.open,
    status: function () { return Object.assign(recorder.status(), { errors: errors, readMs: +readMs.toFixed(3), ui: ui.inspect(), trust: 'local-video-release-policy-not-server-attestation' }); },
    dispose: function () { clearInterval(timer); ui.dispose(); recorder.dispose(); delete window.__blReplay; }
  });
  window.__blVer = 'video-replay-3-disk';
})();
