// Bounded data decoding only. Does not access Unity or modify game objects.
function expandQualityGeometry(models){
  const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);};
  for(const data of Object.values(models)){
    if(data.paletteEncoding!==undefined){
      if(data.paletteEncoding!=='rgba-row-delta-byteplanes'||data.textureSize!==1024)throw Error('Unknown palette encoding');
      const side=data.textureSize,count=side*side,text=atob(data.palette);
      if(text.length!==count*4)throw Error('Invalid compact palette length');
      const bytes=new Uint8Array(count*4);
      for(let channel=0;channel<4;channel++)for(let y=0;y<side;y++){
        let previous=0;
        for(let x=0;x<side;x++){const i=y*side+x;previous=(previous+text.charCodeAt(channel*count+i))&255;bytes[i*4+channel]=previous;}
      }
      data.palette=encode(bytes);delete data.paletteEncoding;
    }
    if(data.geometryEncoding===undefined)continue;
    if(data.geometryEncoding!=='signed16-byteplanes-16384')throw Error('Unknown mesh encoding');
    for(const part of Object.values(data.parts)){
      if(!Number.isInteger(part.vertices)||part.vertices<3||part.vertices>65535)throw Error('Invalid compact mesh count');
      for(const [key,width] of [['position',3],['normal',3],['uv',2]]){
        const text=atob(part[key]),count=part.vertices*width;
        if(text.length!==count*2)throw Error('Invalid compact mesh length');
        const output=new Float32Array(count);
        for(let i=0;i<count;i++){const n=text.charCodeAt(i)|(text.charCodeAt(i+count)<<8);output[i]=(n>=32768?n-65536:n)/16384;}
        part[key]=encode(new Uint8Array(output.buffer));
      }
    }
    delete data.geometryEncoding;
  }
  return models;
}
