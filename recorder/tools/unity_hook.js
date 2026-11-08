// Capture the Unity instance if the loader is initialized after this payload.
// The Electron integration also discovers already-running instances.
(function () {
  var instance = null, create = window.createUnityInstance;
  function adopt(value) { if (value && value.Module) { instance = value; window.__blUnity = value; } }
  try { if (window.unityInstance) adopt(window.unityInstance); } catch (_) {}
  try {
    Object.defineProperty(window, 'unityInstance', {
      configurable:true,
      get:function () { return instance; },
      set:adopt
    });
    Object.defineProperty(window, 'createUnityInstance', {
      configurable:true,
      get:function () { return create; },
      set:function (fn) {
        create = typeof fn === 'function' ? function () {
          var result = fn.apply(this,arguments);
          if (result && result.then) result.then(adopt);
          return result;
        } : fn;
      }
    });
    if (typeof create === 'function') window.createUnityInstance = create;
  } catch (_) {}
})();
