// A user-initiated top-level form handoff works with Discord Activity's CSP.
// Do NOT weaken CSP or proxy arbitrary network requests through the game.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BLClipShare = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function publish(blob, expiry, options) {
    options = options || {}; var doc = options.document || document;
    if (!options.canView || !options.canView()) throw Error('Sharing is locked during live play.');
    if (!['1h','12h','24h','72h'].includes(expiry) || blob.size < 100 || blob.size > 96 * 1048576 || blob.type.split(';')[0] !== 'video/webm') throw Error('Choose a valid WebM clip up to 96 MB.');
    var form = doc.createElement('form'); form.method = 'POST'; form.action = 'http://127.0.0.1:8789/publish'; form.target = '_blank'; form.enctype = 'multipart/form-data';
    form.style.display = 'none';
    function field(name,value) { var input = doc.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); }
    var file = doc.createElement('input'); file.type = 'file'; file.name = 'clip';
    var filename=String(options.filename||'bobble-clip').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)+'.webm';
    var transfer = new DataTransfer(); transfer.items.add(new File([blob],filename,{type:'video/webm'})); file.files = transfer.files; form.appendChild(file);
    field('expiry',expiry); field('consent','litterbox-public-clip');
    doc.body.appendChild(form);
    try { if (!options.canView()) throw Error('Sharing cancelled.'); form.submit(); }
    finally { form.remove(); }
  }
  return { publish:publish };
});
