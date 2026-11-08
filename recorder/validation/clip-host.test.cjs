// All provider requests are mocked. NO user footage or calibration is uploaded.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { execFile } = require('node:child_process'), { promisify } = require('node:util');
const run = promisify(execFile), { createHost } = require('../tools/clip_host.cjs');
const origin = 'https://947957217959759964.discordsays.com', out = 'Z:/Temp/opencode/video-replay-qa';
let calls = 0, badLink = false;
const host = createHost({ fetch: async (url, opts) => {
  calls++; assert.equal(url,'https://litterbox.catbox.moe/resources/internals/api.php');
  assert.equal(opts.body.get('reqtype'),'fileupload'); assert.equal(opts.body.get('time'),'24h');
  assert(opts.body.get('fileToUpload').size > 16);
  return new Response(badLink ? 'https://malicious.example/video.webm' : 'https://litter.catbox.moe/calibration.webm');
} });
async function main() {
  await new Promise(r=>host.server.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:' + host.server.address().port;
  const headers = { Origin:origin }, auth = { ...headers, Authorization:'Bearer ' + host.token };
  assert.equal((await fetch(base+'/session',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const badHostStatus = await new Promise((resolve,reject)=>{const req=require('node:http').get(base+'/session',{headers:{...headers,Host:'attacker.test'}},r=>{r.resume();resolve(r.statusCode)});req.on('error',reject)});
  assert.equal(badHostStatus,403);
  assert.equal((await fetch(base+'/prepare',{method:'POST',headers,body:'no token'})).status,401);
  const session = await (await fetch(base+'/session',{headers})).json(); assert.equal(session.version,1);
  const data = await fs.readFile(path.join(out,'calibration.webm')), blob = new Blob([data],{type:'video/webm'});
  assert.equal((await fetch(base+'/share',{method:'POST',headers:auth,body:blob})).status,403); assert.equal(calls,0);
  assert.equal((await fetch(base+'/share?expiry=forever',{method:'POST',headers:{...auth,'X-Upload-Consent':'litterbox-public-clip'},body:blob})).status,400);
  assert.equal((await fetch(base+'/clip?start=0&end=200',{method:'POST',headers:auth,body:blob})).status,400);
  const prepared = await fetch(base+'/prepare',{method:'POST',headers:auth,body:blob}); assert.equal(prepared.status,200,await prepared.clone().text());
  const preparedPath = path.join(out,'prepared-calibration.webm'); await fs.writeFile(preparedPath,Buffer.from(await prepared.arrayBuffer()));
  const metadata = JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',preparedPath])).stdout);
  assert(Number(metadata.format.duration) > 2 && Number(metadata.format.duration) < 4,'FFmpeg remux adds true finite duration');
  const clipped = await fetch(base+'/clip?start=0.2&end=1.8',{method:'POST',headers:auth,body:blob}); assert.equal(clipped.status,200,await clipped.clone().text());
  const clipPath = path.join(out,'worker-calibration-clip.webm'); await fs.writeFile(clipPath,Buffer.from(await clipped.arrayBuffer()));
  const clipMeta = JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',clipPath])).stdout);
  assert(Number(clipMeta.format.duration) > 1.4 && Number(clipMeta.format.duration) < 1.9,'native media worker trims the requested range');
  function form(consent) { const f=new FormData(); f.set('clip',blob,'calibration.webm'); f.set('expiry','24h'); if(consent)f.set('consent','litterbox-public-clip'); return f; }
  const denied = await fetch(base+'/publish',{method:'POST',headers,body:form(false)}); assert.equal(denied.status,403); assert.equal(calls,0);
  const shared = await fetch(base+'/publish',{method:'POST',headers,body:form(true)}), html = await shared.text();
  assert.equal(shared.status,200); assert.equal(calls,1);
  assert(html.includes('https://litter.catbox.moe/calibration.webm') && html.includes('<video src=') && html.includes('Copy link'));
  assert(shared.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const streamed=await fetch(base+'/publish',{method:'POST',headers:{...headers,Accept:'text/html'},body:form(true)}),streamHTML=await streamed.text();
  assert(streamHTML.includes('Uploading your clip')&&streamHTML.includes('Copy link')&&streamHTML.includes('Save a local copy'));
  const nonce=/script-src 'nonce-([^']+)'/.exec(streamed.headers.get('content-security-policy'))[1];assert(streamHTML.includes('nonce="'+nonce+'"'),'streaming result copy-button script must match CSP nonce');
  const duplicate=form(true);duplicate.append('expiry','24h');assert.equal((await fetch(base+'/publish',{method:'POST',headers,body:duplicate})).status,400,'duplicate multipart fields are rejected');
  badLink = true; const bad = await fetch(base+'/publish',{method:'POST',headers,body:form(true)}); assert.equal(bad.status,502);
  assert(!(await bad.text()).includes('href="https://malicious.example'));
  console.log('Media-helper checks passed: origin/host/token restrictions, upload consent, expiry/clip bounds, real FFmpeg remux/trim, multipart handoff, safe playable link page. Provider MOCKED; no public uploads.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>host.server.close());
