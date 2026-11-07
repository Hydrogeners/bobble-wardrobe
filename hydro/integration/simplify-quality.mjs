// Offline only. Index-only, UV/normal-aware simplification; no paid services.
import fs from 'node:fs';
import path from 'node:path';
import {MeshoptSimplifier as meshopt} from './lib/meshopt_simplifier.mjs';
await meshopt.ready;
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node simplify-quality.mjs INPUT_DIRECTORY OUTPUT_DIRECTORY');
fs.mkdirSync(output,{recursive:true});
const report={};
for(const name of 'miko hydro flair spark todo jjcho augusto supa duolingo'.split(' ')){
 const file=fs.readFileSync(path.join(input,name+'-wardrobe.glb'));
 const length=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+length));
 const binary=file.subarray(28+length),chunks=[binary];let size=binary.length;
 function read(index){
  const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[a.type];
  const type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];
  const bytes=type.BYTES_PER_ELEMENT,start=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||bytes*width;
  const out=new type(a.count*width);
  for(let v=0;v<a.count;v++)for(let c=0;c<width;c++)out[v*width+c]=a.componentType===5126?binary.readFloatLE(start+v*stride+c*bytes):bytes===4?binary.readUInt32LE(start+v*stride+c*bytes):binary.readUInt16LE(start+v*stride+c*bytes);
  return out;
 }
 function append(array,width,type){
  const padding=(4-size%4)%4;if(padding){chunks.push(Buffer.alloc(padding));size+=padding;}
  const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
  const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});chunks.push(bytes);size+=bytes.length;
  const accessor=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:type,count:array.length/width,type:{1:'SCALAR',2:'VEC2',3:'VEC3'}[width]});
  return accessor;
 }
 const parts={};
 for(const mesh of doc.meshes){
  const part=mesh.name.includes('_head')?'head':mesh.name.includes('_body')?'body':'base';
  for(const primitive of mesh.primitives){
   const p=read(primitive.attributes.POSITION),n=read(primitive.attributes.NORMAL),uv=read(primitive.attributes.TEXCOORD_0),indices=new Uint32Array(read(primitive.indices));
   const attrs=new Float32Array(p.length/3*5);
   for(let i=0;i<p.length/3;i++){attrs.set(uv.subarray(i*2,i*2+2),i*5);attrs.set(n.subarray(i*3,i*3+3),i*5+2);}
   const target=part==='head'?45000:part==='body'?35000:indices.length/3;
   const [simplified,error]=part==='base'?[indices,0]:meshopt.simplifyWithAttributes(indices,p,3,attrs,5,[1,1,.05,.05,.05],null,Math.min(indices.length,target*3),.003,['LockBorder']);
   // Compact without relocating or interpolating any surviving source vertex.
   const used=[...new Set(simplified)];if(used.length>65535)throw Error(name+' '+part+': protected topology exceeds native vertex bound: '+used.length);
   const remap=new Map(used.map((v,i)=>[v,i]));
   for(const [key,array,width] of [['POSITION',p,3],['NORMAL',n,3],['TEXCOORD_0',uv,2]]){
    const compact=new Float32Array(used.length*width);used.forEach((old,i)=>compact.set(array.subarray(old*width,old*width+width),i*width));
    primitive.attributes[key]=append(compact,width,5126);
   }
   // Drop tangents generated for the original triangle connectivity.
   delete primitive.attributes.TANGENT;
   primitive.indices=append(Uint16Array.from(simplified,i=>remap.get(i)),1,5123);
   parts[part]={sourceTriangles:indices.length/3,triangles:simplified.length/3,vertices:used.length,error};
  }
 }
 const pad=(4-size%4)%4;if(pad){chunks.push(Buffer.alloc(pad));size+=pad;}doc.buffers[0].byteLength=size;
 let json=Buffer.from(JSON.stringify(doc));const jp=(4-json.length%4)%4;if(jp)json=Buffer.concat([json,Buffer.alloc(jp,32)]);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+size,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(size);bh.writeUInt32LE(0x004e4942,4);
 fs.writeFileSync(path.join(output,name+'-wardrobe.glb'),Buffer.concat([header,json,bh,...chunks]));
 report[name]=parts;console.log(name,JSON.stringify(parts));
}
fs.writeFileSync(path.join(output,'attribute-simplification-report.json'),JSON.stringify(report,null,2));
