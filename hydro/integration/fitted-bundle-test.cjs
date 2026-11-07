// Verify data compression round-trips exactly; it is never an eval/code loader.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/wardrobe-live.js','utf8');
const section=source.split('// BEGIN WARDROBE ASSETS')[1].split('// END WARDROBE ASSETS')[0];
const context={window:{},Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,TextDecoder,TextEncoder,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
vm.runInNewContext(section,context);
assert.equal(context.window.__bobbleSkinCatalog.length,9);
for(const name of 'hydro miko todo jjcho augusto flair supa duolingo spark'.split(' ')){
 const suffix=process.argv.includes('--quality')?'quality':'fitted';
 const expected=JSON.parse(fs.readFileSync(__dirname+'/visual-'+name+'-'+suffix+'.json'));
 const hash=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(hash(context.window.__bobbleSkinAssets[name]),hash(expected),name+' decoded asset digest');
}
assert(!context.window.__bobbleSkinAssets.nebula,'Retired skin must not ship');
assert.equal(context.window.__bobbleSkinCatalog.length,9);
assert.equal(context.window.fflate,undefined,'Decoder must not leak a global');
console.log('PASS: all nine compressed assets match their inspectable JSON sources; retired asset absent');
