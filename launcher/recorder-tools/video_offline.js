(function () {
  'use strict';
  var video = document.getElementById('video'), message = document.getElementById('message'), url = null;
  var marks = [], knownDuration = null;
   function time(s) { return (s>=3600?Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0'):Math.floor(s/60))+':'+String(Math.floor(s%60)).padStart(2,'0'); }
  function drawMarks() {
    var container = document.getElementById('moments'); container.replaceChildren();
    marks.forEach(function (m) {
      var b = document.createElement('button'); b.textContent = time(m.t) + ' · ' + m.label;
      b.onclick = function () { if (url) video.currentTime = m.t; }; container.appendChild(b);
    });
  }
  document.getElementById('file').onchange = function () {
    try {
      var f = this.files[0]; if (!f) return;
      if (f.size > 8 * 1073741824 || !/\.webm$/i.test(f.name)) throw Error('Select a WebM video no larger than 8 GB.');
      video.pause(); if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(f); video.src = url; video.hidden = false;
      message.textContent = 'Playing a local video file. Load its matching timestamps file to restore bookmarks.';
    } catch (e) { message.textContent = e.message; }
  };
  document.getElementById('sidecar').onchange = async function () {
    try {
      var f = this.files[0]; if (!f) return;
      if (f.size > 1048576) throw Error('Timestamp file is too large.');
      var meta = JSON.parse(await f.text());
      if (meta.format !== 'bobble-video-moments/1' || !Array.isArray(meta.marks) || meta.marks.length > 1000 ||
          !Number.isFinite(meta.duration) || meta.duration < 0 || meta.duration > 86400) throw Error('Unsupported video timestamp file.');
      var parsed = meta.marks.map(function (m) {
        if (!Number.isFinite(m.t) || m.t < 0 || m.t > meta.duration || typeof m.label !== 'string') throw Error('Invalid marked moment.');
        return { t: m.t, label: m.label.slice(0, 80) };
      });
      knownDuration = meta.duration; marks = parsed; drawMarks(); message.textContent = 'Loaded ' + marks.length + ' video timestamps. Choose the matching WebM file.';
    } catch (e) { message.textContent = e.message; }
  };
  document.getElementById('back').onclick = function () { if (url) video.currentTime = Math.max(0, video.currentTime - 5); };
  document.getElementById('forward').onclick = function () { if (url) video.currentTime = Math.min(Number.isFinite(video.duration) ? video.duration : knownDuration || video.currentTime + 5, video.currentTime + 5); };
  document.getElementById('speed').onchange = function () { video.playbackRate = Number(this.value); };
  video.onerror = function () { message.textContent = 'This video could not be decoded. Try opening the WebM in another video player.'; };
  window.addEventListener('pagehide', function () { video.pause(); if (url) URL.revokeObjectURL(url); });
})();
