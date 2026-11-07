// Authored preview geometry; no Unity meshes or game contexts are used.
window.__bobbleAccentDefaults=Object.freeze({halo:'#19b9ce',arrow:'#f0aa42'});
window.__bobbleAccentSettings=window.__bobbleAccentSettings||{...window.__bobbleAccentDefaults};
window.__makeBobbleAccentParts=function(settings){
  const rgb=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Use a six-digit hex color');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);};
  const parts=[];
  function mesh(color){const p=[],index=[];return {p,index,finish(){const n=new Float32Array(p.length),colors=new Float32Array(p.length);for(let i=0;i<p.length;i+=3){n[i+1]=1;colors.set(color,i);}parts.push({p:new Float32Array(p),n,colors,indices:new Uint16Array(index)});}};}
  function band(radius,width,y,color,start=0,end=Math.PI*2){const m=mesh(color),segments=128;for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments;for(const r of [radius-width/2,radius+width/2])m.p.push(Math.sin(a)*r,y,Math.cos(a)*r);if(i){const j=(i-1)*2;m.index.push(j,j+1,j+2,j+1,j+3,j+2);}}m.finish();}
  const halo=rgb(settings.halo),arrow=rgb(settings.arrow);
  band(.69,.065,.035,halo);band(.765,.012,.036,halo.map(x=>x*.6));
  // Four short index marks give the halo the feel of a selection reticle.
  for(let i=0;i<4;i++)band(.815,.027,.038,halo,i*Math.PI/2-.07,i*Math.PI/2+.07);
  const m=mesh(arrow);m.p.push(-.075,.04,.77,.075,.04,.77,-.075,.04,1.17,.075,.04,1.17,-.22,.04,1.17,.22,.04,1.17,0,.04,1.55);m.index.push(0,2,1,1,2,3,4,6,5);m.finish();
  return parts;
};
