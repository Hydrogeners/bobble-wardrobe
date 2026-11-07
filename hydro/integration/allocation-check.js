// Allocate and destroy one unattached empty Mesh; never touches scene objects.
(() => {
  const P=window.__hydroNativeProbe;if(!P)throw Error('Run signature probe first');
  const more={type:[29774,43971,2],create:[30011,1681,2],clone:[18884,7603,2],destroy:[18888,2276,2],white:[18097,3438,1],resize:[18177,22688,6],rawTexture:[18116,22705,4],apply:[18108,22713,4],setTexture:[17422,7779,3],clear:[17843,10905,3],channel:[17796,20236,10],indices:[17784,46000,10],indexFormat:[17763,7774,3],submeshes:[17836,45973,3],bounds:[18013,2633,2],setMesh:[17723,3820,3],setMaterial:[17154,20414,3],setName:[18881,1391,3]};
  for(const [key,[slot,index,arity]]of Object.entries(more)) {
    const f=P.T.get(slot);if(!f||f.name!==String(index)||f.length!==arity)throw Error('Signature mismatch: '+key);P.F[key]=f;
  }
  const type=P.withString('UnityEngine.Mesh, UnityEngine.CoreModule',s=>P.call('type',s));
  if(!type)throw Error('Mesh type is not available');
  const typeHandle=P.call('pin',type);let mesh=0,meshHandle=0;
  try {
    mesh=P.call('create',type);if(!mesh)throw Error('Mesh constructor unavailable');
    meshHandle=P.call('pin',mesh);
    const vertices=P.call('vertices',mesh);if(vertices!==0)throw Error('New mesh is not empty');
    window.__hydroAllocationCheck={ok:true,unattachedMeshAllocated:true,vertices,sceneObjectsChanged:false};
    return JSON.stringify(window.__hydroAllocationCheck);
  } finally {
    if(mesh)P.call('destroy',mesh);
    if(meshHandle)P.call('unpin',meshHandle);
    P.call('unpin',typeHandle);
  }
})();
