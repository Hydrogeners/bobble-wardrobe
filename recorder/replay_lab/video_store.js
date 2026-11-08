// Origin-private disk spool. Writes small encoded chunks, not whole videos in RAM.
// Completion manifests are written ONLY after the recorder verifies match end.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.BLVideoStore=factory();
})(typeof window==='object'?window:this,function(){
  'use strict';
  function create(options){
    options=options||{};var nav=options.navigator||navigator,cryptoAPI=options.crypto||crypto,dir,updates=new Map(),removed=new Set();
    var state={ready:false,available:false,persistent:false,quota:0,usage:0,error:''};
    var valid=id=>/^video-[a-f0-9-]{16,80}$/.test(id);
    async function estimate(){try{var e=await nav.storage.estimate();state.quota=e.quota||0;state.usage=e.usage||0;}catch(_){}return status();}
    function status(){return Object.assign({},state);}
    async function ownerKey(owner){return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode('bobble-local-video-owner/1:'+owner)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
    var ready=(async()=>{
      try{dir=await (await nav.storage.getDirectory()).getDirectoryHandle('bobble-recorder-v1',{create:true});state.available=true;try{state.persistent=!!(nav.storage.persisted&&await nav.storage.persisted());}catch(_){}await estimate();}
      catch(e){state.error='Disk recording unavailable. '+(e.message||e.name||'Storage access denied.');}
      state.ready=true;return status();
    })();
    async function remove(id){if(!valid(id))throw Error('Invalid recording ID.');removed.add(id);await ready;if(!dir)return;await updates.get(id)?.catch(()=>{});await dir.removeEntry(id+'.webm').catch(e=>{if(e.name!=='NotFoundError')throw e;});await dir.removeEntry(id+'.json').catch(e=>{if(e.name!=='NotFoundError')throw e;});await estimate();}
    async function writeManifest(record,owner){
      var data=Object.assign({},record,{version:1,ownerKey:await ownerKey(owner)});delete data.blob;delete data.owner;delete data.context;
      var handle=await dir.getFileHandle(record.id+'.json',{create:true}),writer=await handle.createWritable();
      try{await writer.write(JSON.stringify(data));await writer.close();}catch(e){await writer.abort().catch(()=>{});throw e;}
    }
    function manifest(record,owner){
      if(!valid(record.id)||removed.has(record.id))return Promise.reject(Error('Recording was removed.'));
      var task=(updates.get(record.id)||Promise.resolve()).catch(()=>{}).then(()=>writeManifest(record,owner));
      updates.set(record.id,task);task.finally(()=>{if(updates.get(record.id)===task)updates.delete(record.id);}).catch(()=>{});return task;
    }
    async function open(){
      await ready;if(!state.available)throw Error(state.error||'Disk storage unavailable.');
      var id='video-'+cryptoAPI.randomUUID(),handle=await dir.getFileHandle(id+'.webm',{create:true}),writer=await handle.createWritable();
      var chain=Promise.resolve(),queued=0,peak=0,bytes=0,closed=false,failed=null;
      return {
        id:id,
        append(blob){
          if(closed||failed)return Promise.reject(failed||Error('Recording spool is closed.'));
          if(queued+blob.size>32*1048576)return Promise.reject(Error('Disk cannot keep up with recording (32 MB queue).'));
          queued+=blob.size;peak=Math.max(peak,queued);
          var write=chain.then(async()=>{if(failed)throw failed;await writer.write(blob);bytes+=blob.size;}).catch(e=>{failed=e;throw e;}).finally(()=>{queued-=blob.size;});
          chain=write.catch(()=>{});return write;
        },
        stats:()=>({queuedBytes:queued,peakQueuedBytes:peak,bytes:bytes}),
        async finish(record,owner){
          if(closed)throw Error('Recording spool is closed.');closed=true;await chain;if(failed){await writer.abort().catch(()=>{});throw failed;}
          await writer.close();var blob=await handle.getFile();record.id=id;record.disk=true;
          if(blob.size<100)throw Error('Disk recording is empty.');
          var warning='';try{await manifest(record,owner);}catch(e){warning='Recovery metadata could not be saved. Download this completed video before closing: '+e.message;}
          await estimate();return {blob:blob,id:id,recoveryWarning:warning};
        },
        async abort(){if(closed)return;closed=true;await chain;await writer.abort().catch(()=>{});await remove(id);}
      };
    }
    async function load(owner){
      await ready;if(!state.available)return [];
      var key=await ownerKey(owner),records=[],scanned=0;
      for await(var [name,entry] of dir.entries()){
        if(++scanned>2000||records.length>=500)break;
        if(entry.kind!=='file'||!name.endsWith('.json')||!valid(name.slice(0,-5)))continue;
        try{
          var file=await entry.getFile();if(file.size>1048576)continue;
          var r=JSON.parse(await file.text());
          if(r.version!==1||r.ownerKey!==key||r.id!==name.slice(0,-5)||r.disk!==true||!Number.isFinite(r.duration)||r.duration<=0||r.duration>86400||!Number.isFinite(r.created)||!Array.isArray(r.marks)||!Array.isArray(r.warnings)||![r.width,r.height].every(n=>Number.isInteger(n)&&n>0&&n<=16384))continue;
          var blob=await (await dir.getFileHandle(r.id+'.webm')).getFile();if(blob.size<100)continue;
          // Explicit fields only. A local manifest is data, never an object to trust.
          records.push({id:r.id,title:String(r.title||'Recovered match').slice(0,80),file:'bobble-'+r.id,blob:blob,disk:true,owner:owner,context:'recovered',created:r.created,duration:r.duration,
            marks:r.marks.filter(m=>m&&Number.isFinite(m.t)&&m.t>=0&&m.t<=r.duration).slice(0,1000).map(m=>({t:m.t,label:String(m.label||'Moment').slice(0,80)})),
            warnings:r.warnings.slice(0,20).map(w=>String(w).slice(0,200)),fps:[24,30,60].includes(r.fps)?r.fps:30,width:r.width,height:r.height,mime:'video/webm',partial:true,autoDownload:false,downloaded:r.downloaded===true});
        }catch(_){} // Corrupt/interrupted files are never promoted into completed videos.
      }
      return records.sort((a,b)=>b.created-a.created);
    }
    return Object.freeze({ready:ready,status:status,estimate:estimate,open:open,load:load,remove:remove,update:manifest,
      async persist(){await ready;try{state.persistent=!!(nav.storage.persist&&await nav.storage.persist());}catch(_){}return status();}});
  }
  return {create:create};
});
