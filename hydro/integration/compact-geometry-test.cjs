const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={Float32Array,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
vm.runInNewContext(fs.readFileSync(__dirname+'/expand-geometry.js','utf8')+';this.expand=expandQualityGeometry',ctx);
const encode=values=>{const bytes=Buffer.alloc(values.length*2);values.forEach((x,i)=>bytes.writeInt16LE(x,i*2));return Buffer.concat([Buffer.from(values.map((_,i)=>bytes[i*2])),Buffer.from(values.map((_,i)=>bytes[i*2+1]))]).toString('base64');};
const part={vertices:3,position:encode([-16384,0,16384,1,-1,32767,-32768,8192,-8192]),normal:encode([16384,0,0,0,16384,0,0,0,16384]),uv:encode([0,0,16384,0,0,16384])};
const fixture=()=>({test:{geometryEncoding:'signed16-byteplanes-16384',parts:{head:structuredClone(part)}}});
const output=ctx.expand(fixture());
const decoded=Buffer.from(output.test.parts.head.position,'base64');
assert.deepEqual(Array.from({length:9},(_,i)=>decoded.readFloatLE(i*4)),[-1,0,1,1/16384,-1/16384,32767/16384,-2,.5,-.5]);
assert.equal(output.test.geometryEncoding,undefined);
for(const vertices of [0,-1,65536,1.5]){const bad=fixture();bad.test.parts.head.vertices=vertices;assert.throws(()=>ctx.expand(bad),/count/);}
{const bad=fixture();bad.test.parts.head.uv='';assert.throws(()=>ctx.expand(bad),/length/);}
{const bad=fixture();bad.test.geometryEncoding='other';assert.throws(()=>ctx.expand(bad),/Unknown/);}
assert.equal(ctx.expand({classic:{revision:3}}).classic.revision,3);
{
 const side=1024,count=side*side,source=Buffer.alloc(count*4),packed=Buffer.alloc(count*4);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++)for(let c=0;c<4;c++){const i=y*side+x;source[i*4+c]=(x*7+y*3+c*59)&255;packed[c*count+i]=(source[i*4+c]-(x?source[(i-1)*4+c]:0))&255;}
 const data={paletteEncoding:'rgba-row-delta-byteplanes',textureSize:1024,palette:packed.toString('base64')};
 const result=ctx.expand({texture:data}).texture;assert.deepEqual(Buffer.from(result.palette,'base64'),source);assert.equal(result.paletteEncoding,undefined);
 assert.throws(()=>ctx.expand({bad:{...data,paletteEncoding:'other'}}),/Unknown palette/);
 assert.throws(()=>ctx.expand({bad:{...data,paletteEncoding:'rgba-row-delta-byteplanes',palette:''}}),/palette length/);
}
console.log('PASS: compact geometry round-trip, signed limits, malformed-data rejection and classic compatibility');
