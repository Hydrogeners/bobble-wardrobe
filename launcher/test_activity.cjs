const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const raw=fs.readFileSync(__dirname+'/activity.js','utf8');
function boot(origin,build,existing=true,payload='window.__bobbleWardrobe={installed:true};window.__bobblePowerTracker={installed:true};window.__blReplay={installed:true};'){let interval,cleared=false;const window={};if(existing)window.__blUnity={Module:{asm:{ei:{}},codeUrl:'https://assets/'+build+'/CG6.wasm'}};
 const context={window,location:{origin},setInterval(fn){interval=fn;return 1;},clearInterval(){cleared=true;},Date};vm.createContext(context);
 const code=raw.replace('__WARDROBE_PAYLOAD_STRING__',JSON.stringify(payload));
 vm.runInContext(code,context);return {window,context,code,tick:()=>interval?.(),cleared:()=>cleared};}
const good=boot('https://947957217959759964.discordsays.com','Prod-590-CL28650');assert(good.window.__bobbleWardrobe.installed);assert.equal(good.window.__wardrobePortableBoot.phase,'installed');assert(good.cleared());
const wrong=boot('https://947957217959759964.discordsays.com.evil.example','Prod-590-CL28650');assert(!wrong.window.__wardrobePortableBoot);assert(!wrong.window.__bobbleWardrobe);
const build=boot('https://947957217959759964.discordsays.com','unknown-build');assert.equal(build.window.__wardrobePortableBoot.phase,'unsupported-build');assert(!build.window.__bobbleWardrobe);
vm.runInContext(good.code,good.context);assert.equal(good.window.__wardrobePortableBoot.phase,'installed');
const late=boot('https://947957217959759964.discordsays.com','',false);assert.equal(late.window.__wardrobePortableBoot.phase,'waiting-for-unity');late.window.unityInstance={Module:{asm:{ei:{}},codeUrl:'/Prod-590-CL28650/CG6.wasm'}};late.tick();assert(late.window.__bobbleWardrobe.installed);
const partial=boot('https://947957217959759964.discordsays.com','Prod-590-CL28650',true,'window.__blReplay={installed:true};window.__bobbleWardrobeBootError="cosmetic fixture failure";');assert.equal(partial.window.__wardrobePortableBoot.phase,'partial');assert.equal(partial.window.__wardrobePortableBoot.addons.recorder,true);assert(partial.window.__wardrobePortableBoot.error.includes('cosmetic fixture failure'));
(async()=>{
 const created=boot('https://947957217959759964.discordsays.com','',false);
 const instance={Module:{asm:{ei:{}},codeUrl:'/Prod-590-CL28650/CG6.wasm'}};
 created.window.createUnityInstance=()=>Promise.resolve(instance);
 const promise=created.window.createUnityInstance();assert.equal(await promise,instance);
 created.tick();assert(created.window.__bobbleWardrobe.installed);
 assert.equal(created.window.__wardrobePortableBoot.captureCalls,1);assert.equal(created.window.__wardrobePortableBoot.captureReturns,1);
 console.log('PASS: activity allowlist, build refusal, delayed Unity capture, creator promise capture, install-once, timer cleanup (mock page)');
})().catch(error=>{console.error(error);process.exitCode=1;});
