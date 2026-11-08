// Keep unrelated project code and sensitive runtime artifacts out of downloads.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const modules = ['native_reader.js','video_store.js','video.js','video_index.js','clip_share.js','video_clip.js','video_ui.js','video_runtime.js','video_offline.js','index.html'];
const tools = ['build_recorder.py','unity_hook.js','clip_host.cjs'];
const tests = ['distribution.test.cjs','native-lifecycle.test.cjs','video-recorder.test.cjs','video-offline.test.cjs','video-browser.test.cjs','clip-host.test.cjs','video-storage.test.cjs'];
const allowed = new Set([
  '.gitattributes','.gitignore','.github/workflows/ci.yml','README.md','CHANGELOG.md','package.json','Start clip sharing.cmd',
  'integration/bl-recorder-main.js',
  ...modules.map(f=>'replay_lab/'+f),...tools.map(f=>'tools/'+f),...tests.map(f=>'validation/'+f)
]);
const tracked = execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
assert(tracked.length > 0,'Distribution must have a tracked file manifest');
for(const file of tracked) assert(allowed.has(file),'Unexpected file in recorder distribution: '+file);
const payload = fs.readFileSync(path.join(root,'dist/bl-recorder-payload.js'),'utf8');
assert(payload.includes('canvas.captureStream(settings.fps)')&&payload.includes('BLVideoRecorder'),'real-video capture is present');
assert(!/__blTraj|BLDefense|BLOpponentArrows|BLNativeArrow|BLReplayCore|BLReplayUI|trajectory_overlay|defense_planner/.test(payload),'no assistance or schematic modules in delivery payload');
const integration = fs.readFileSync(path.join(root,'integration/bl-recorder-main.js'),'utf8');
assert(!/CMD_PATH|pumpCommand|bl-cmd\.json/.test(integration),'no arbitrary-JavaScript command-file interface');
const reader = fs.readFileSync(path.join(root,'replay_lab/native_reader.js'),'utf8');
assert(!/sendCommand|fetch\(|WebSocket|dispatchEvent|write\w*\(/.test(reader),'native adapter has no network, input or write API');
assert(!tracked.some(f=>/\.(webm|mp4|har|wasm|bundle|data|exe|dll)$/.test(f)),'no recordings, game binaries or traffic captures');
console.log('Recorder-only distribution boundary checks passed ('+tracked.length+' tracked files).');
