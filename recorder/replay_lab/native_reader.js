// Read-only lifecycle and participant-eligibility adapter for the supported game
// build. Internal roster/position validity checks reject stale pooled objects.
// Only match phase and local participation are returned, never game positions,
// opponent identity, aiming state, chat, voice, powers or network payloads.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLReplayReader = factory();
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  function createReader(getBuffer, clock) {
    var shared = 0, scan = 65536, nextScan = 0, epoch = 0, priorKey = '', priorPhase = '', classHint = 28537368;
    var participation = null;
    clock = clock || function () { return performance.now(); };
    function read() {
      var buffer = getBuffer();
      if (!buffer || !buffer.byteLength) return null;
      var H = new Int32Array(buffer), F = new Float32Array(buffer), U = new Uint8Array(buffer), W = new Uint16Array(buffer);
      function ptr(p, size) { return Number.isInteger(p) && p > 65536 && !(p & 3) && p + (size || 16) < buffer.byteLength; }
      function text(p, s) {
        if (!Number.isInteger(p) || p <= 0 || p + s.length + 1 >= buffer.byteLength) return false;
        for (var i = 0; i < s.length; i++) if (U[p + i] !== s.charCodeAt(i)) return false;
        return U[p + s.length] === 0;
      }
      function named(k, name, ns) { return ptr(k, 100) && text(H[(k + 8) >> 2], name) && text(H[(k + 12) >> 2], ns); }
      function str(p) {
        if (!ptr(p)) return null;
        var n = H[(p + 8) >> 2];
        if (n < 1 || n > 128 || p + 12 + n * 2 > buffer.byteLength) return null;
        var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(W[(p + 12) / 2 + i]);
        return s;
      }
      function position(p, off) {
        if (!ptr(p, off + 12)) return null;
        var a = { x: F[(p + off) >> 2], y: F[(p + off + 4) >> 2], z: F[(p + off + 8) >> 2] };
        return [a.x, a.y, a.z].every(Number.isFinite) && Math.abs(a.x) <= 60 && Math.abs(a.z) <= 60 && a.y >= -5 && a.y <= 30 ? a : null;
      }
      function lists(dg) {
        if (!ptr(dg)) return [];
        var all = [];
        // +8 is the live list; +12 is the reusable pool, NEVER match evidence.
        [8].forEach(function (off) {
          var l = H[(dg + off) >> 2]; if (!ptr(l)) return;
          var n = H[(l + 12) >> 2], arr = H[(l + 8) >> 2];
          if (n < 1 || n > 16 || !ptr(arr, 16 + n * 4)) return;
          var list = [];
          for (var i = 0; i < n; i++) { var q = H[(arr + 16 + i * 4) >> 2]; if (ptr(q)) list.push(q); }
          all.push(list);
        });
        return all;
      }
      function roster(q) {
        var variants = lists(H[(q + 60) >> 2]);
        for (var i = 0; i < variants.length; i++) {
          if (variants[i].length !== 2) continue;
          var athletes = [], scores = [], owners = [];
          for (var team = 0; team < 2; team++) {
            var tp = variants[i][team], choices = lists(H[(tp + 12) >> 2]), chosen = [];
            scores.push(H[(tp + 8) >> 2]);
            for (var j = 0; j < choices.length; j++) {
              var bodies = [];
              for (var k = 0; k < choices[j].length; k++) {
                var ap = choices[j][k], id = H[(ap + 8) >> 2], pos = position(ap, 68), pid = str(H[(ap + 12) >> 2]);
                if (id > 0 && pos && pid) bodies.push({ id: id, team: team, x: pos.x, y: pos.y, z: pos.z, owner: pid });
              }
              if (bodies.length) { chosen = bodies; break; }
            }
            chosen.forEach(function (a) { owners.push(a.owner); delete a.owner; athletes.push(a); });
          }
          if (athletes.some(function (a) { return a.team === 0; }) && athletes.some(function (a) { return a.team === 1; }) &&
            scores.every(function (n) { return n >= 0 && n <= 100; })) return { athletes: athletes, score: scores, owners: owners };
        }
        return null;
      }
      function valid(q) {
        // Plausible pooled/stale objects are NOT current-context evidence.
        // Require live Unity components and the relay's CURRENT client-context
        // slot, plus the client-visuals backlink. DestroyClientContext clears
        // relay+48, so cached historical contexts fail this check on every read.
        if (!ptr(q, 212)) return null;
        var ctx = H[(q + 28) >> 2], visuals = H[(q + 204) >> 2];
        if (!ptr(ctx, 40) || !H[(ctx + 8) >> 2] || !named(H[ctx >> 2], 'NetGameRelayContext', 'DiscordGames.ChannelGamesFramework.Session')) return null;
        // NetGameRelayContext.Init stores netGameRelay at +36; +28 is FSMBehavior.
        var game = H[(ctx + 36) >> 2];
        if (!ptr(game, 52) || !H[(game + 8) >> 2] || !named(H[game >> 2], 'NetGameRelay', 'DiscordGames.ChannelGamesFramework.Session') || H[(game + 48) >> 2] !== ctx) return null;
        if (!ptr(visuals, 64) || !H[(visuals + 8) >> 2] || !named(H[visuals >> 2], 'GameContext_ClientVisuals', 'DiscordGames.CG6') || H[(visuals + 60) >> 2] !== q) return null;
        // Keep tracking the LIVE root after roster/ball teardown. Missing
        // athletes cannot establish active participation, but must not conceal
        // an actual GameOver property transition from an existing recording.
        return H[q >> 2] === classHint && H[(q + 8) >> 2] !== 0;
      }
      if (!named(classHint, 'GameContext_Shared', 'DiscordGames.CG6')) return null;
      var field = shared ? valid(shared) : null;
      if (!field) {
        shared = 0;
        if (clock() < nextScan) return null;
        nextScan = clock() + 100;
        var end = Math.min(buffer.byteLength - 256, scan + (2 << 20));
        for (var p = scan; p < end; p += 4) {
          if (H[p >> 2] !== classHint) continue;
          field = valid(p);
          if (field) { shared = p; break; }
        }
        scan = end >= buffer.byteLength - 256 ? 65536 : end;
        if (!shared) return null;
      }
      var identity = null;
      // Exact chain recovered from GetLocalPlayersTeam; metadata verified every
      // read, and local ID is used for eligibility only, never stored in footage.
      var sessionKlass = H[2674088 >> 2];
      if (named(sessionKlass, 'NetSession', 'DiscordGames.ChannelGamesFramework.Session')) {
        var sf = H[(sessionKlass + 92) >> 2], session = ptr(sf) ? H[sf >> 2] : 0;
        if (ptr(session, 80) && H[session >> 2] === sessionKlass) identity = str(H[(session + 76) >> 2]);
      }
      var winner = H[(shared + 72) >> 2], reason = H[(shared + 76) >> 2];
      // Winner/reason can survive into the next match. Resolve the CURRENT
      // property collection's actual game/phase state instead of guessing from
      // those outcome fields. Dictionary<Type,PropertyCollectionBase> entries
      // have 24-byte stride (8-byte type key), value at +16 in this build.
      var phase = 'unknown', props = H[(shared + 40) >> 2], gameState = -1, gamePhase = -1;
      if (ptr(props, 32)) {
        var entries = H[(props + 12) >> 2], count = H[(props + 16) >> 2];
        if (count >= 1 && count <= 32 && ptr(entries, 16 + count * 24) && H[(entries + 12) >> 2] >= count) {
          for (var e = 0; e < count; e++) {
            var entry = entries + 16 + e * 24;
            if (H[entry >> 2] < 0) continue;
            var value = H[(entry + 16) >> 2];
            if (!ptr(value, 40)) continue;
            var type = H[value >> 2];
            if (named(type, 'SharedProps_GameFSM', 'DiscordGames.CG6')) gameState = H[(value + 32) >> 2];
            // Nested IL2CPP types have an empty namespace; declaring type owns it.
            if (named(type, 'SharedProps', '') && named(H[(type + 40) >> 2], 'GameState_InGame', 'DiscordGames.CG6')) gamePhase = H[(value + 32) >> 2];
          }
        }
      }
      if (gameState === 2 && [0, 1].includes(gamePhase)) phase = 'active';
      if (gameState === 2 && gamePhase === 2 && [0, 1, 2].includes(winner) && [0, 1, 2].includes(reason)) phase = 'completed';
      if ([0, 1].includes(gameState)) phase = 'idle';
      // Ball and athlete objects are pooled/reset at completion. They are not
      // session identity. The validated root/native handle/context anchor it.
      var key = shared + ':' + H[(shared + 8) >> 2] + ':' + H[(shared + 28) >> 2];
      if (key !== priorKey || ['completed', 'idle'].includes(priorPhase) && phase === 'active') epoch++;
      priorKey = key; priorPhase = phase;
      var context = key + ':' + epoch, liveField = roster(shared);
      var ball = position(H[(shared + 64) >> 2], 60), role = 'unknown';
      if (identity && liveField) role = liveField.owners.includes(identity) ? 'player' : 'spectator';
      if (phase === 'active' && role === 'player' && ball) participation = { context: context, identity: identity, score: liveField.score.slice() };
      // This is explicitly historical membership, NOT an unknown/spectator
      // override during play. It applies only after the same root leaves play.
      if (['completed', 'idle'].includes(phase) && identity && participation &&
          participation.context === context && participation.identity === identity) role = 'former-player';
       return { context: context, identity: identity || '', role: role,
         phase: phase, winner: winner, endReason: reason };
    }
    return Object.freeze({ read: read });
  }
  return { createReader: createReader };
});
