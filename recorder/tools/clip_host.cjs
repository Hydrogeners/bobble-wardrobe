// Local-only media worker. NEVER talks to the game/network protocol. The sole
// internet upload route requires an explicit per-clip public-sharing consent.
'use strict';
const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path');
const { spawn } = require('node:child_process'), { randomBytes } = require('node:crypto');
const { createReadStream } = require('node:fs'), { pipeline } = require('node:stream/promises');
const ORIGIN = 'https://947957217959759964.discordsays.com';
const UPLOAD = 'https://litterbox.catbox.moe/resources/internals/api.php';
function createHost(options = {}) {
  const token = options.token || randomBytes(32).toString('hex'), allowedOrigins = options.origins || [ORIGIN];
  const root = options.tempRoot || path.join(require('node:os').tmpdir(),'bobble-media'), ffmpeg = options.ffmpeg || 'ffmpeg';
  const fetcher = options.fetch || fetch;
  let working = false, publishing = false, handoffs = 0;
  function json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  function page(res, code, link, message) {
    const safe = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const nonce = res.clipNonce || randomBytes(16).toString('hex');
    if(!res.headersSent)res.writeHead(code, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; media-src https://*.catbox.moe; script-src 'nonce-" + nonce + "'; frame-ancestors 'none'; base-uri 'none'" });
    const result=`<main id="${link?'share-ready':'share-failed'}"><h1>${link?'Your clip is ready.':'Couldn’t share this clip.'}</h1><p>${safe(message)}</p>${link?`
      <label for="link">Public clip link</label><input id="link" readonly value="${safe(link)}"><button id="copy">Copy link</button> <a href="${safe(link)}" target="_blank" rel="noopener noreferrer">Open video</a>
      <p id="status" role="status">Anyone with this link can watch. The host may remove it earlier; save your own copy.</p>
      <video src="${safe(link)}" controls playsinline></video>
      <script nonce="${nonce}">document.getElementById('copy').onclick=async()=>{const x=document.getElementById('link');try{await navigator.clipboard.writeText(x.value);document.getElementById('status').textContent='Link copied.'}catch(e){x.focus();x.select();document.getElementById('status').textContent='Press Ctrl+C to copy the selected link.'}}</script>`:
      '<p>Your original recording has not been deleted. Return to the recorder and choose Upload clip to retry, or Save clip to keep it without sharing. If the helper is unavailable, run Start clip sharing.cmd.</p>'}</main>`;
    const style='<style>body{margin:0;background:#f1f3ee;color:#233829;font:15px/1.6 "Segoe UI",system-ui}main{max-width:850px;margin:5vh auto;padding:24px}h1{font-size:28px;font-weight:600}p{color:#52664e}video{display:block;width:100%;max-height:60vh;background:#10170f;border-radius:6px;margin:20px 0}input{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #aebaa4;border-radius:5px;background:#fafbf8;color:#233829;margin:8px 0 14px}button{font:inherit;background:#375d29;color:white;border:0;border-radius:5px;padding:10px 18px;cursor:pointer}a{color:#375d29;text-underline-offset:3px;margin-left:8px}button:hover{background:#294821}button:focus-visible,input:focus-visible{outline:3px solid #375d29;outline-offset:3px}body:has(#share-ready) #uploading,body:has(#share-failed) #uploading{display:none}</style>';
    if(res.clipNonce)res.end(style+result+'</body></html>');
    else res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clip sharing · Bobble</title>${style}<body>${result}</body></html>`);
  }
  async function upload(data, expiry, signal) {
    const form = new FormData(); form.set('reqtype','fileupload'); form.set('time',expiry);
    form.set('fileToUpload',new Blob([data],{type:'video/webm'}),'clip.webm');
    const upstream = await fetcher(UPLOAD,{method:'POST',body:form,signal,redirect:'error'});
    if (!upstream.ok) throw Error('Free host rejected the upload (' + upstream.status + ').');
    const reader=upstream.body.getReader();let bytes=0,parts=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2048)throw Error('Free host returned an oversized response.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
    const link = Buffer.concat(parts).toString('utf8').trim();
    if (!/^https:\/\/(?:[a-z0-9-]+\.)?(?:catbox\.moe|litterbox\.catbox\.moe)\/[a-zA-Z0-9_-]+\.webm$/.test(link)) throw Error('Free host did not return a valid video link.');
    return link;
  }
  async function publish(req,res) {
    // Fixed multipart schema from our UI, not a general file host or file path API.
    const boundary = /boundary=(?:"([^"\r\n]{1,80})"|([^;\s\r\n]{1,80}))/.exec(req.headers['content-type'] || '');
    if (!boundary) return page(res,400,null,'Invalid clip transfer.');
    const marker = Buffer.from('--' + (boundary[1] || boundary[2])), chunks = []; let total = 0;
    for await (const chunk of req) { total += chunk.length; if (total > 96 * 1048576 + 65536) throw Object.assign(Error('Clip exceeds 96 MB.'),{status:413}); chunks.push(chunk); }
    const buffer = Buffer.concat(chunks), fields = {}; let at = 0, file,closed=false;
    const separator=Buffer.concat([Buffer.from('\r\n'),marker]);
    if(!buffer.subarray(0,marker.length).equals(marker))throw Error('Invalid clip transfer.');
    while (at<buffer.length) {
      at += marker.length; if (buffer.subarray(at,at+2).toString() === '--') {closed=true;break;}
      if(buffer.subarray(at,at+2).toString()!=='\r\n')throw Error('Invalid multipart boundary.');
      const headerEnd = buffer.indexOf('\r\n\r\n',at), next = buffer.indexOf(separator,at);
      if (headerEnd < 0 || next < 0 || headerEnd - at > 4096 || next < headerEnd) throw Error('Invalid clip transfer.');
      const headers = buffer.subarray(at,headerEnd).toString(), name = /\bname="([a-z]+)"/.exec(headers);
      const value = buffer.subarray(headerEnd+4,next);
      if (name && name[1] === 'clip') { if (file) throw Error('Only one clip is allowed.'); file = value; }
      else if (name && ['expiry','consent'].includes(name[1])) { if (value.length > 64||Object.hasOwn(fields,name[1])) throw Error('Invalid or duplicate clip settings.'); fields[name[1]] = value.toString(); }
      else throw Error('Unexpected clip transfer field.');
      at = next+2;
    }
    if(!closed)throw Error('Incomplete clip transfer. Retry from the recorder.');
    if (!file || file.length < 16 || file.length > 96 * 1048576 || file.readUInt32BE(0) !== 0x1a45dfa3) return page(res,415,null,'Only WebM clips up to 96 MB are accepted.');
    if (fields.consent !== 'litterbox-public-clip' || !['1h','12h','24h','72h'].includes(fields.expiry)) return page(res,403,null,'Public sharing confirmation is required.');
    // A top-level browser form otherwise sits on a blank page during the upload.
    // Flush a real progress page before waiting on the external host. Node/API
    // callers still receive the final HTTP status and complete result document.
    if((req.headers.accept||'').includes('text/html')){
      res.clipNonce=randomBytes(16).toString('hex');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; media-src https://*.catbox.moe; script-src 'nonce-"+res.clipNonce+"'; frame-ancestors 'none'; base-uri 'none'"});
      res.write('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uploading clip · Bobble</title><style>body{background:#f1f3ee;color:#233829;font:16px/1.6 system-ui;margin:32px}#uploading{max-width:720px}</style><body><div id="uploading"><h1>Uploading your clip…</h1><p>Keep this tab open. This can take a few minutes. Closing it cancels the request, but an upload may already have reached the provider.</p><p>Your original video and prepared clip remain in the recorder. If sharing fails, return there to retry or save the clip.</p></div>');
    }
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),300000);
    const cancel = () => { if (!res.writableFinished) controller.abort(); }; res.on('close',cancel);
    try { const link = await upload(file,fields.expiry,controller.signal); page(res,200,link,'Shared publicly with Litterbox · expires after ' + fields.expiry + '. Save a local copy: expired or removed links cannot be recovered. Visible player names remain in the video.'); }
    catch (e) { page(res,502,null,controller.signal.aborted?'Upload timed out or was cancelled. Return to the recorder to retry or save the clip.':e.message || 'The free host is unavailable.'); }
    finally { clearTimeout(timer); res.removeListener('close',cancel); }
  }
  async function body(req, limit) {
    let bytes = 0, chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > limit) throw Object.assign(Error('Video exceeds size limit.'), { status: 413 }); chunks.push(chunk); }
    const data = Buffer.concat(chunks);
    if (data.length < 16 || data.readUInt32BE(0) !== 0x1a45dfa3) throw Object.assign(Error('Only WebM video is accepted.'), { status: 415 });
    return data;
  }
  async function saveInput(req, file) {
    const handle = await fs.open(file, 'w'); let bytes = 0, prefix = Buffer.alloc(0);
    try {
      for await (const chunk of req) {
        bytes += chunk.length; if (bytes > 400 * 1048576) throw Object.assign(Error('Video exceeds size limit.'), { status:413 });
        if (prefix.length < 16) prefix = Buffer.concat([prefix,chunk.subarray(0,16-prefix.length)]);
        await handle.writeFile(chunk);
      }
      if (bytes < 16 || prefix.readUInt32BE(0) !== 0x1a45dfa3) throw Object.assign(Error('Only WebM video is accepted.'), { status:415 });
    } finally { await handle.close(); }
  }
  async function media(req, res, route, query) {
    if (working) return json(res, 409, { error: 'Another media task is running. Try again shortly.' });
    const start = Number(query.get('start')), end = Number(query.get('end'));
    if (route === '/clip' && (!query.has('start') || !query.has('end') || ![start, end].every(Number.isFinite) || start < 0 || end - start < .2 || end - start > 90 || end > 14400)) return json(res, 400, { error: 'Choose a 0.2–90 second clip within the video.' });
    working = true; let dir, child, cancelled = false;
    const cancel = () => { if (!res.writableFinished) { cancelled = true; child?.kill(); } };
    req.on('aborted', cancel); res.on('close', cancel);
    try {
      await fs.mkdir(root, { recursive: true }); dir = await fs.mkdtemp(path.join(root, 'bl-media-'));
      const input = path.join(dir, 'input.webm'), output = path.join(dir, 'output.webm'); await saveInput(req,input);
      if (cancelled) return;
      const args = ['-hide_banner','-loglevel','error','-nostdin','-y'];
      if (route === '/clip') args.push('-ss', String(start));
      args.push('-i', input, '-map', '0:v:0', '-an');
      if (route === '/clip') args.push('-t', String(end - start), '-vf', 'scale=w=min(1280\\,iw):h=-2', '-r','30','-c:v','libvpx','-deadline','realtime','-cpu-used','4','-threads','2','-b:v','1M');
      else args.push('-c:v', 'copy'); // lossless remux adds duration + seek cues.
      args.push(output);
      await new Promise((resolve, reject) => {
        child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
        let error = ''; child.stderr.on('data', c => { if (error.length < 2000) error += c.toString(); });
        const timer = setTimeout(() => { child.kill(); reject(Error('Media processing timed out.')); }, 180000);
        child.on('error', e => { clearTimeout(timer); reject(Error(e.code === 'ENOENT' ? 'FFmpeg is unavailable. Install FFmpeg or use browser export.' : e.message)); });
        child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(cancelled ? 'Task cancelled.' : 'Media processing failed: ' + error.slice(-350))); });
      });
      if (cancelled) return;
      const stat = await fs.stat(output);
      if (stat.size > 400 * 1048576) throw Error('Processed video exceeds the memory limit.');
      res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      await pipeline(createReadStream(output),res);
    } finally {
      req.removeListener('aborted', cancel); res.removeListener('close', cancel);
      if (dir) await fs.rm(dir, { recursive: true, force: true });
      working = false;
    }
  }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    // Check before reading a body or creating ANY side effect. No wildcard CORS,
    // no LAN bind, no arbitrary fetch URLs, file paths or shell command inputs.
    if (!allowedOrigins.includes(origin)) return json(res, 403, { error: 'Origin not allowed.' });
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) return json(res, 403, { error: 'Host not allowed.' });
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Upload-Consent');
    res.setHeader('Access-Control-Allow-Private-Network','true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/publish') {
      if(publishing)return page(res,409,null,'Another clip is uploading. Wait for it to finish before retrying.');
      publishing=true;
      handoffs++;
      try { return await publish(req,res); } catch (e) { if (!res.destroyed) page(res,e.status||400,null,e.message); return; }finally{publishing=false;}
    }
    if (req.method === 'GET' && url.pathname === '/session') return json(res, 200, { token, version: 1, provider: 'Litterbox', maxUploadMB: 96, handoffs });
    if (req.headers.authorization !== 'Bearer ' + token) return json(res, 401, { error: 'Local media session expired.' });
    try {
      if (req.method === 'POST' && ['/prepare','/clip'].includes(url.pathname)) return await media(req, res, url.pathname, url.searchParams);
      if (req.method === 'POST' && url.pathname === '/share') {
        if(publishing)return json(res,409,{error:'Another clip is uploading.'});
        if (req.headers['x-upload-consent'] !== 'litterbox-public-clip') return json(res, 403, { error: 'Explicit clip-sharing consent is required.' });
        const expiry = url.searchParams.get('expiry') || '24h';
        if (!['1h','12h','24h','72h'].includes(expiry)) return json(res, 400, { error: 'Invalid expiration.' });
        publishing=true;
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 300000);
        const cancel = () => { if (!res.writableFinished) controller.abort(); }; res.on('close', cancel);
        try {
          const data = await body(req, 96 * 1048576),link=await upload(data,expiry,controller.signal);
          json(res, 200, { url: link, expires: expiry, provider: 'Litterbox' });
        } finally { publishing=false;clearTimeout(timer); res.removeListener('close', cancel); }
        return;
      }
      json(res, 404, { error:'Unknown media action.' });
    } catch (e) { if (!res.headersSent && !res.destroyed) json(res, e.status || 500, { error: e.message || 'Media task failed.' }); }
  });
  server.requestTimeout = 240000; server.headersTimeout = 15000;
  return { server, token };
}
if (require.main === module) {
  const { server } = createHost();server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8789 is already in use. An existing helper may already be running.':'Cannot start the local sharing helper: '+e.message);process.exitCode=1;});server.listen(8789,'127.0.0.1', () => console.log('Bobble media helper ready on 127.0.0.1:8789. No automatic uploads. Keep this window open while sharing.'));
}
module.exports = { createHost };
