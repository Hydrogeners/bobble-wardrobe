// Trims an ACTUAL recorded video by decoding/re-encoding its pixels. Never renders
// a reconstructed match. Export is real-time and cancels if live play begins.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLVideoClip = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  async function exportClip(record, start, end, options) {
    if (![start, end].every(Number.isFinite) || start < 0 || end > record.duration + .1 || end - start < .2 || end - start > 90) throw Error('Choose a clip between 0.2 and 90 seconds inside the video.');
    var doc = options.document || document, video = doc.createElement('video'), canvas = doc.createElement('canvas');
    var url = URL.createObjectURL(record.blob), stream, media, timer, chunks = [], frameCallback=null, bytes=0;
    function guard() { if (options.signal && options.signal.aborted || !options.canView()) throw Error('Clip export cancelled. The original recording is unchanged.');if(doc.hidden)throw Error('Keep this tab visible while creating a clip. The original recording is unchanged.'); }
    function wait(event, action) {
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () { done(Error('Video ' + event + ' timed out.')); }, 12000);
        function done(err) { clearTimeout(timeout); video.removeEventListener(event, onEvent); video.removeEventListener('error', onError);if(options.signal)options.signal.removeEventListener('abort',onAbort); err ? reject(err) : resolve(); }
        function onEvent() { done(); } function onError() { done(Error('The recorded video could not be decoded.')); }
        function onAbort(){done(Error('Clip creation cancelled. The original recording is unchanged.'));}
        video.addEventListener(event, onEvent, { once: true }); video.addEventListener('error', onError, { once: true });
        if(options.signal)options.signal.addEventListener('abort',onAbort,{once:true});
        try{guard();if (action) action();}catch(e){done(e);}
      });
    }
    try {
      guard(); video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;pointer-events:none';
      doc.body.appendChild(video);
      await wait('loadedmetadata', function () { video.src = url; video.load(); }); guard();
      if (Math.abs(video.currentTime - start) > .005) await wait('seeked', function () { video.currentTime = start; });
      if (video.readyState < 2) await wait('loadeddata'); guard();
      var width=video.videoWidth||record.width,height=video.videoHeight||record.height,scale=Math.min(1,1280/width,720/height);
      if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid video dimensions.');
      canvas.width=Math.max(2,Math.floor(width*scale/2)*2);canvas.height=Math.max(2,Math.floor(height*scale/2)*2);
      var context = canvas.getContext('2d'); context.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream = canvas.captureStream(Math.min(record.fps || 30, 30));
      var mime = ['video/webm;codecs=vp8', 'video/webm'].find(function (m) { return MediaRecorder.isTypeSupported(m); });
      if (!mime) throw Error('WebM clip encoding is unavailable. Save the full recording instead.');
      media = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1000000 });
      var began = performance.now();
      var result = new Promise(function (resolve, reject) {
        media.ondataavailable = function (e) { if (e.data.size) {bytes+=e.data.size;if(bytes>96*1048576){reject(Error('Clip exceeds 96 MB. Choose a shorter range.'));return;}chunks.push(e.data);} };
        media.onerror = function () { reject(Error('Clip encoder failed.')); };
        media.onstop = function () { resolve(); };
        media.start(250);
        var drawn=-1;
        function draw(){if(video.readyState>=2&&drawn!==video.currentTime){context.drawImage(video,0,0,canvas.width,canvas.height);drawn=video.currentTime;}}
        if(video.requestVideoFrameCallback){var frame=function(){draw();frameCallback=video.requestVideoFrameCallback(frame);};frameCallback=video.requestVideoFrameCallback(frame);}
        timer = setInterval(function () {
          try {
            guard();
            if (performance.now() - began > (end - start) * 3000 + 15000) throw Error('Video decoding stalled. Export cancelled; try saving the full video.');
            if(!video.requestVideoFrameCallback)draw();
            if (options.progress) options.progress(Math.min(1, (video.currentTime - start) / (end - start)));
            if (video.currentTime >= end || video.ended) { video.pause(); if (media.state !== 'inactive') media.stop(); }
          } catch (e) { reject(e); }
        }, 1000 / Math.min(record.fps || 30, 30));
      });
      await video.play(); await result; guard();
      var blob = new Blob(chunks, { type: mime }); if (blob.size < 100) throw Error('Clip encoder returned an empty video.');
      return blob;
    } finally {
      clearInterval(timer);if(frameCallback!==null&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameCallback);
      if (media && media.state !== 'inactive') { media.onstop = null; media.stop(); }
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      video.pause(); video.removeAttribute('src'); video.load(); video.remove(); URL.revokeObjectURL(url); chunks = [];
    }
  }
  return { exportClip: exportClip };
});
