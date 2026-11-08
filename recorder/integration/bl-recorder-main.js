// Bobble League recorder - Electron main-process integration.
// Watches activity frames and installs the recording payload. Unity's instance
// is held in an activity closure; the in-process debugger finds the instance via
// the loader helper's bound owner. Native reads verify participation and match
// completion only. No external debug port or arbitrary-code command-file API.
"use strict";

const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const PAYLOAD_PATH = path.join(__dirname, "bl-recorder-payload.js");
const LOG_PATH = path.join(__dirname, "..", "bl-recorder.log");
const FRAME_RE = /^https:\/\/947957217959759964\.discordsays\.com\//i;

function log(msg) {
  try {
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 1024 * 1024) {
      fs.writeFileSync(LOG_PATH, "");
    }
    fs.appendFileSync(LOG_PATH, new Date().toISOString() + " " + msg + "\n");
  } catch (e) {}
  try { console.log("[BL recorder] " + msg); } catch (e) {}
}

function readPayload() {
  try { return fs.readFileSync(PAYLOAD_PATH, "utf8"); } catch (e) {
    log("payload missing: " + (e && e.message));
    return "";
  }
}

function frameUrl(frame) {
  try { return frame.url || ""; } catch (e) { return ""; }
}

const FRAMES = new Set();
const WATCHED = new WeakSet();
const WINDOW_WATCHED = new WeakSet();
const SESSIONS = new Map(); // sessionId -> url

// ---------------------------------------------------------------------------
// The bridge. `this` is the activity object the Unity helpers are bound to.
// ---------------------------------------------------------------------------
const BRIDGE_FN = "(function () {" +
  "try {" +
  "  function good(v) { try { return !!(v && typeof v === 'object' && v.Module && v.Module.asm); } catch (e) { return false; } }" +
  "  var cands = [];" +
  "  try { if (this.unityInstance) cands.push(['unityInstance', this.unityInstance]); } catch (e) {}" +
  "  var ks = [];" +
  "  try { for (var k in this) ks.push(k); } catch (e) {}" +
  "  for (var i = 0; i < ks.length && i < 300; i++) {" +
  "    try { var v = this[ks[i]]; if (v && typeof v === 'object') cands.push([ks[i], v]); } catch (e) {}" +
  "  }" +
  "  for (var j = 0; j < cands.length; j++) {" +
  "    if (good(cands[j][1])) { window.__blUnity = cands[j][1]; return 'ok:' + cands[j][0]; }" +
  "  }" +
  "  for (var m = 0; m < cands.length; m++) {" +
  "    var o = cands[m][1];" +
  "    try { if (o.unityInstance && good(o.unityInstance)) { window.__blUnity = o.unityInstance; return 'okdeep:' + cands[m][0]; } } catch (e) {}" +
  "  }" +
  "  var keys = []; for (var n = 0; n < ks.length && n < 40; n++) keys.push(ks[n]);" +
  "  return 'none:' + cands.length + ':' + keys.join(',');" +
  "} catch (e) { return 'err:' + e.message; }" +
  "})";

async function bridge(wc, sid, url) {
  const send = function (m, p) { return wc.debugger.sendCommand(m, p, sid); };
  try {
    const ev = await send("Runtime.evaluate", { expression: "window.UnityReadyToPlay", returnByValue: false });
    const objId = ev && ev.result && ev.result.objectId;
    if (!objId) { log("bridge: no UnityReadyToPlay in " + url.slice(0, 56)); return false; }
    const gp = await send("Runtime.getProperties", { objectId: objId, ownProperties: false });
    const ints = (gp && gp.internalProperties) || [];
    let bt = null;
    for (let i = 0; i < ints.length; i++) {
      if (ints[i] && ints[i].name === "[[BoundThis]]" && ints[i].value) bt = ints[i].value.objectId;
    }
    if (!bt) { log("bridge: helper has no [[BoundThis]]"); return false; }
    const res = await send("Runtime.callFunctionOn", {
      objectId: bt,
      functionDeclaration: BRIDGE_FN,
      returnByValue: true
    });
    const val = res && res.result && res.result.value;
    log("bridge " + url.slice(0, 48) + " -> " + String(val).slice(0, 300));
    return typeof val === "string" && val.indexOf("ok") === 0;
  } catch (e) {
    log("bridge failed: " + ((e && e.message) || e));
    return false;
  }
}

// Runs before any page script on future loads: catches createUnityInstance as
// soon as the loader defines it, so the instance is captured by assignment.
const DOCSTART =
  "(function(){" +
  "if (window.__blDocStart) return; window.__blDocStart = 1;" +
  "var tries = 0;" +
  "var iv = setInterval(function(){" +
  "  tries++;" +
  "  try {" +
  "    var f = window.createUnityInstance;" +
  "    if (typeof f === 'function' && !f.__blWrapped) {" +
  "      var w = function(){ var p = f.apply(this, arguments); try { if (p && p.then) p.then(function(u){ try { window.__blUnity = u; } catch(e){} }); } catch(e){} return p; };" +
  "      w.__blWrapped = 1;" +
  "      window.createUnityInstance = w;" +
  "      clearInterval(iv); return;" +
  "    }" +
  "  } catch(e){}" +
  "  if (tries > 4000) clearInterval(iv);" +
  "}, 2);" +
  "})();";

function attachDebugger(wc) {
  try {
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach("1.3");
      log("debugger attached to webContents " + wc.id);
    }
  } catch (e) {
    log("debugger attach failed: " + ((e && e.message) || e));
    return false;
  }

  if (WATCHED.has(wc)) return true;
  WATCHED.add(wc);

  wc.debugger.on("message", function (_event, method, params, sessionId) {
    try {
      if (method === "Target.attachedToTarget") {
        const ti = params && params.targetInfo;
        const url = (ti && ti.url) || "";
        if (ti && ti.targetId) {
          if (FRAME_RE.test(url)) {
            SESSIONS.set(params.sessionId, url);
            log("attached to activity target " + url.slice(0, 72));
            try { wc.debugger.sendCommand("Page.enable", {}, params.sessionId); } catch (e) {}
            try {
              wc.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", { source: DOCSTART }, params.sessionId);
            } catch (e) {}
            bridge(wc, params.sessionId, url).then(function (ok) {
              if (!ok) setTimeout(function () { bridge(wc, params.sessionId, url); }, 1500);
            });
          } else if (url) {
            log("target " + String(url).slice(0, 60) + " (ignored)");
          }
        }
      } else if (method === "Target.detachedFromTarget") {
        if (params && params.sessionId) SESSIONS.delete(params.sessionId);
      } else if (method === "Target.targetCreated") {
        const ti = params && params.targetInfo;
        if (ti && FRAME_RE.test(ti.url || "")) log("targetCreated " + ti.url.slice(0, 60));
      }
    } catch (e) { log("dbg message error: " + ((e && e.message) || e)); }
  });

  wc.debugger.on("detach", function (_e, reason) { log("debugger detached: " + reason); });

  try {
    wc.debugger.sendCommand("Target.setDiscoverTargets", { discover: true });
  } catch (e) { log("discover failed: " + ((e && e.message) || e)); }
  try {
    wc.debugger.sendCommand("Target.setAutoAttach", {
      autoAttach: true, waitForDebuggerOnStart: false, flatten: true
    });
  } catch (e) { log("autoattach failed: " + ((e && e.message) || e)); }

  return true;
}

// Fallback for the case where auto-attach never reports the iframe.
async function tryAttachTargets(wc) {
  if (!wc.debugger.isAttached() || SESSIONS.size) return;
  let r = null;
  try { r = await wc.debugger.sendCommand("Target.getTargets"); } catch (e) {
    log("getTargets failed: " + ((e && e.message) || e));
    return;
  }
  const list = (r && r.targetInfos) || [];
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const ti = list[i];
    if (!ti || !FRAME_RE.test(ti.url || "")) continue;
    n++;
    try {
      const a = await wc.debugger.sendCommand("Target.attachToTarget", { targetId: ti.targetId, flatten: true });
      if (a && a.sessionId) {
        SESSIONS.set(a.sessionId, ti.url);
        log("attached explicitly to " + ti.url.slice(0, 64));
        const ok = await bridge(wc, a.sessionId, ti.url);
        if (!ok) setTimeout(function () { bridge(wc, a.sessionId, ti.url); }, 1500);
      }
    } catch (e) { log("attachToTarget failed: " + ((e && e.message) || e)); }
  }
  if (!n) log("getTargets: no activity target among " + list.length);
}

function collect(wc) {
  try {
    if (wc.isDestroyed()) return false;
    const main = wc.mainFrame;
    if (!main) return false;
    const frames = main.framesInSubtree || [];
    let sawActivity = false;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!FRAME_RE.test(frameUrl(f))) continue;
      FRAMES.add(f);
      sawActivity = true;
    }
    return sawActivity;
  } catch (e) { return false; }
}

async function evaluate(frame, code) {
  try { return await frame.executeJavaScript(code, false); } catch (e) { return "__ERR__ " + ((e && e.message) || e); }
}

async function diag(frame) {
  const r = await evaluate(frame, "JSON.stringify(window.__blReplay ? {version:window.__blReplay.version,state:window.__blReplay.status().state} : {recorder:false})");
  log("diag " + String(r).slice(0, 1400));
}

async function ensureFrame(frame) {
  const url = frameUrl(frame);
  if (!FRAME_RE.test(url)) return;
  const alive = await evaluate(frame, "!!window.__blReplay");
  if (alive === true) return;

  const payload = readPayload();
  if (!payload) return;
  const res = await evaluate(frame, payload);
  if (typeof res === "string" && res.indexOf("__ERR__") === 0) {
    log("inject failed: " + res.slice(0, 200));
    return;
  }
  log("injected " + payload.length + "B into " + url.slice(0, 80));
  setTimeout(function () { diag(frame); }, 2500);
}

function sweep(wc) {
  try {
    if (wc.isDestroyed()) return;
    const main = wc.mainFrame;
    if (!main) return;
    const frames = main.framesInSubtree || [];
    for (let i = 0; i < frames.length; i++) ensureFrame(frames[i]);
    if (collect(wc)) {
      attachDebugger(wc);
      tryAttachTargets(wc);
    }
  } catch (e) {}
}

function watch(wc) {
  if (WINDOW_WATCHED.has(wc) || wc.isDestroyed()) return;
  WINDOW_WATCHED.add(wc);
  wc.on("did-frame-navigate", function () { sweep(wc); });
  wc.on("did-frame-finish-load", function () { sweep(wc); });
  wc.on("frame-created", function (_e, details) {
    const f = details && details.frame;
    if (!f) return;
    try {
      f.once("dom-ready", function () {
        if (FRAME_RE.test(frameUrl(f))) {
          FRAMES.add(f);
          ensureFrame(f);
          try { attachDebugger(wc); } catch (e) {}
        }
      });
    } catch (e) {}
  });

  const iv = setInterval(function () {
    if (wc.isDestroyed()) { clearInterval(iv); return; }
    sweep(wc);
  }, 5000);
  wc.once("destroyed", function () { clearInterval(iv); });
}

try {
  app.on("web-contents-created", function (_e, wc) { watch(wc); });
  app.whenReady().then(function () {
    try {
      const { webContents } = require("electron");
      webContents.getAllWebContents().forEach(function (wc) { watch(wc); sweep(wc); });
    } catch (e) {}
  });
  setInterval(function () {
    // Keep trying the bridge in case the activity object was not ready yet.
    SESSIONS.forEach(function (url, sid) {
      try {
        const all = require("electron").webContents.getAllWebContents();
        for (let i = 0; i < all.length; i++) {
          const wc = all[i];
          if (wc.isDestroyed() || !wc.debugger.isAttached()) continue;
          bridge(wc, sid, url);
          return;
        }
      } catch (e) {}
    });
  }, 20000);
  log("main-process hook armed (" + readPayload().length + " byte payload)");
} catch (e) {
  log("hook failed: " + ((e && e.message) || e));
}
