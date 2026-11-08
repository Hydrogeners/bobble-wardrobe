const assert = require('node:assert/strict');
const { create } = require('../replay_lab/video.js');
let checks = 0;
const ok = (value, label) => { assert(value, label); checks++; };
const denied = fn => { assert.throws(fn); checks++; };
const base = { phase: 'active', role: 'player', identity: 'private-owner-id', context: 'live-root-1' };
function setup() {
  let time = 0, captures = 0, stops = 0, lastEncoder;
  const track = { stop() { stops++; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
  class Encoder {
    static isTypeSupported(m) { return m.includes('vp8'); }
    constructor(s, opts) { assert.equal(s, stream); this.state = 'inactive'; this.opts = opts; lastEncoder = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['encoded-video-data'.repeat(30)]) }); this.onstop?.(); }
  }
  const r = create({ now: () => time, MediaRecorder: Encoder,
    canvas: () => ({ width: 1280, height: 720, captureStream(fps) { captures++; assert([24,30,60].includes(fps)); return stream; } }) });
  return { r, feed(sample, dt = 50) { time += dt; r.observe(sample); }, advance(dt) { time += dt; },
    stats() { return { captures, stops, encoder: lastEncoder }; } };
}
function end(h, overrides = {}) {
  h.feed({ ...base, phase: 'completed', role: 'former-player', winner: 0, endReason: 0, ...overrides });
  for (let i = 0; i < 42; i++) h.feed({ ...base, phase: 'idle', role: 'former-player', ...overrides });
  return h.r.status().recordings[0]?.id;
}
{
  const h = setup(); h.r.arm(true); h.feed(base);
  ok(h.r.status().state === 'recording' && h.stats().captures === 1, 'participant starts real canvas MediaRecorder stream');
  for (let i = 0; i < 20; i++) {
    h.feed(base, 250);
    ok(!h.r.status().canView && h.r.status().recordings.length === 0, 'no live video preview or library');
    denied(() => h.r.recording('video-1')); denied(() => h.r.metadata('video-1'));
  }
  ok(h.r.mark('My moment'), 'mark stores a video timestamp');
  ok(!h.r.mark('Too soon'), 'mark hotkey repeat is bounded');
  h.feed({ ...base, phase: 'completed', role: 'former-player', winner: 0, endReason: 0 });
  ok(!h.r.status().canView, 'encoder completion does not bypass match verification');
  const id = end(h), r = h.r.recording(id);
  const snapshot=h.r.status().recordings;ok(snapshot===h.r.status().recordings&&Object.isFrozen(snapshot)&&Object.isFrozen(snapshot[0].marks),'unchanged library snapshots are cached and immutable instead of copied on every UI tick');
  ok(r.blob instanceof Blob && r.blob.type.startsWith('video/webm') && r.blob.size > 100, 'library stores actual immutable encoded bytes, not body coordinates');
  ok(r.marks.length === 1 && r.marks[0].label === 'My moment', 'marks survive GameOver and verified lobby');
  const meta = JSON.stringify(h.r.metadata(id));
  ok(!/private-owner-id|live-root|athletes|ball|mvx|mvz|token/.test(meta), 'exported timestamps omit native identities and match state');
  h.r.rename(id, '<img src=x>'); ok(h.r.recording(id).title === '<img src=x>', 'title is stored as text for textContent rendering');
  r.marks[0].label = 'mutated'; ok(h.r.recording(id).marks[0].label !== 'mutated', 'returned bookmark metadata cannot mutate library');
  h.r.downloaded(id); ok(h.r.recording(id).downloaded, 'downloaded state is tracked');
  h.feed({ ...base, phase: 'active', context: 'new-live-root' });
  denied(() => h.r.recording(id)); ok(!h.r.status().recordings.length, 'starting another match relocks all videos');
  h.r.dispose(); ok(h.r.status().savedCount === 0 && h.stats().stops > 0, 'dispose clears video bytes and stops tracks');
}
for (const role of ['spectator', 'unknown', 'former-player']) {
  const h = setup(); h.r.arm(true); h.feed({ ...base, role }); end(h, { role });
  ok(h.stats().captures === 0 && !h.r.status().canView, role + ' cannot start a live canvas recorder');
}
for (const change of [{ identity: 'different-owner' }, { context: 'another-root' }, { role: 'spectator' }]) {
  const h = setup(); h.r.arm(true); h.feed(base); h.feed({ ...base, ...change }); end(h);
  ok(!h.r.status().canView && h.r.status().savedCount === 0, 'identity/context/role loss cannot release pending video');
}
{
  const h=setup();h.r.arm(true);h.feed(base);h.feed(base,250);h.stats().encoder.ondataavailable({data:new Blob(['verified-pixels'.repeat(100)])});h.feed(null);h.feed(null,5100);
  ok(h.r.status().state==='paused'&&!h.r.status().canView,'a prolonged unknown state stops capture and retains prior footage without releasing it');
  h.feed(base);ok(h.r.status().state==='paused'&&h.stats().captures===1,'recovery does not silently restart capture after an unknown gap');
  const id=end(h);ok(!!id&&h.r.recording(id).warnings.some(w=>w.includes('status unavailable')),'retained partial requires a later actual verified end in the same account/context');h.r.dispose();
}
{
  const h = setup(); h.r.arm(true); h.feed(base); h.feed(null); h.feed(null, 5100); end(h);
  ok(!h.r.status().canView && h.r.status().savedCount === 0, 'prolonged unknown lifecycle cannot auto-complete');
}
{
  const h = setup(); h.r.arm(true); h.feed(base); h.feed(null); h.feed(base, 1000); h.feed(base);
  ok(h.r.status().state === 'recording' && h.stats().captures === 1, 'brief native read gap resumes the SAME video encoder');
  ok(h.r.status().warnings.length === 1, 'background recording gap is reported honestly');
  const id = end(h); ok(!!id, 'resumed verified capture still needs an actual end before release');
}
{
  const h = setup(); h.r.arm(true); h.feed(base); h.feed({ ...base, phase: 'idle', role: 'former-player' });
  ok(!h.r.status().canView && h.r.status().savedCount === 0, 'lobby alone is not an unlock or fabricated match ending');
}
{
  const h = setup(); h.r.arm(true); h.feed(base); h.r.arm(false); end(h);
  ok(!h.r.status().canView, 'manual stop never publishes unfinished footage');
}
{
  const h = setup(); h.r.arm(true); h.feed(base);
  h.feed(base,250);h.stats().encoder.ondataavailable({data:new Blob(['retained-video'.repeat(100)])});
  h.stats().encoder.ondataavailable({ data: { size: 300 * 1048576 } });
  h.feed(base); ok(h.r.status().state === 'paused' && h.stats().captures === 1, 'memory limit stops the source without automatic restart loops');
  ok(!h.r.status().canView,'partial video remains locked during play');const partial=end(h);ok(!!partial&&h.r.recording(partial).warnings.some(w=>w.includes('limit')),'retained partial video releases only after actual completion');
}
{
  const h = setup(); h.r.arm(true); h.feed(base); h.stats().encoder.onerror(); end(h);
  ok(!h.r.status().canView, 'encoder errors cannot publish unverified/empty video');
}
{
  const h = setup(); h.r.arm(true); h.feed(base); end(h);
  const id = h.r.status().recordings[0].id;
  h.feed({ ...base, phase: 'idle', role: 'unknown', identity: '' }); denied(() => h.r.recording(id));
  h.feed({ ...base, phase: 'idle', role: 'former-player' }); ok(h.r.status().canView, 'same verified former participant retains postmatch video access');
  h.advance(1501); denied(() => h.r.recording(id));
}
{
  const h = setup(); denied(() => h.r.configure({ fps: 1000 })); denied(() => h.r.configure({ mbps: NaN }));
  ok(h.r.status().settings.mbps===1,'new recordings default to compact 1-Mbps encoding');
  h.r.configure({ fps: 60, mbps: 12, maxMB: 128, autoDownload: true });
  h.r.arm(true); h.feed(base); denied(() => h.r.configure({ fps: 30 }));
  ok(h.stats().encoder.opts.videoBitsPerSecond === 12000000, 'quality settings reach the actual encoder');
}
for(const bitrate of [0.6,1,2]){
  const h=setup();h.r.configure({mbps:bitrate});h.r.arm(true);h.feed(base);
  ok(h.stats().encoder.opts.videoBitsPerSecond===bitrate*1000000,'small-file bitrate reaches actual encoder: '+bitrate);
  ok(h.r.status().estimatedRemainingSeconds>0,'capacity estimate supports fractional bitrate');h.r.dispose();
}
console.log(checks + ' actual-video recording, lifecycle, privacy and storage checks passed');
