// Supported-build, read-only ownership resolver. Club identity is not a side:
// mirror matches and pooled visuals must be resolved through current team lists.
(() => {
  'use strict';
  window.__bobbleResolveSkinTeam=function(P,targets){
    const H=P.M.HEAP32,U=P.M.HEAPU8;
    if(!H||!U)return null;
    const ptr=(p,n=16)=>Number.isInteger(p)&&p>65536&&!(p&3)&&p+n<U.length;
    const at=(p,off)=>H[(p+off)>>2];
    const text=(p,s)=>p>0&&p+s.length<U.length&&[...s].every((c,i)=>U[p+i]===c.charCodeAt(0))&&U[p+s.length]===0;
    const named=(p,s,ns)=>ptr(p,100)&&text(at(p,8),s)&&text(at(p,12),ns);
    const list=p=>{
      if(!ptr(p))return null;
      const live=at(p,8);if(!ptr(live))return null;
      const n=at(live,12),arr=at(live,8);
      if(n<1||n>16||!ptr(arr,16+n*4)||at(arr,12)<n)return null;
      const items=Array.from({length:n},(_,i)=>at(arr,16+i*4));return items.every(p=>ptr(p))?items:null;
    };
    const f=P.T.get(7471);if(!f||f.name!=='18429'||f.length!==2)return null;
    const go=P.find('ClientGameContext'),ctx=go&&P.component(go,'GameContext_Shared');
    if(!ptr(ctx,212)||!at(ctx,8)||!named(at(ctx,0),'GameContext_Shared','DiscordGames.CG6'))return null;
    const relay=at(ctx,28),visuals=at(ctx,204);
    if(!ptr(relay,40)||!at(relay,8)||!named(at(relay,0),'NetGameRelayContext','DiscordGames.ChannelGamesFramework.Session'))return null;
    const game=at(relay,36);
    if(!ptr(game,52)||!at(game,8)||!named(at(game,0),'NetGameRelay','DiscordGames.ChannelGamesFramework.Session')||at(game,48)!==relay)return null;
    if(!ptr(visuals,96)||!at(visuals,8)||!named(at(visuals,0),'GameContext_ClientVisuals','DiscordGames.CG6')||at(visuals,60)!==ctx)return null;
    const stack=P.M.stackSave();let side;
    try{side=f(ctx,0);}finally{P.M.stackRestore(stack);}
    if(side!==0&&side!==1)return null;
    const clubById=['Bug','Hawk','Bear','Tiger','Pig','Bull','Dino','SnowMan'];
    const club=clubById[at(ctx,side===0?44:48)];if(!club||club==='SnowMan')return null;
    const teams=list(at(visuals,92));if(!teams||teams.length!==2)return null;
    const roots=new Set(),opponents=new Set(),rootMap=new Map(targets.map(t=>[t.root,t]));
    for(let team=0;team<2;team++){
      const athletes=list(at(teams[team],8));if(!athletes)return null;
      for(const athlete of athletes){
        const bobble=at(athlete,8);if(!ptr(bobble,12)||!at(bobble,8))return null;
        const bobbleObject=P.call('gameObject',bobble);if(!bobbleObject)return null;
        let t=P.call('transform',bobbleObject);
        // BallBobble may be below the named team root. Never infer side from
        // world coordinates, club name, turn order or the root's numeric label.
        for(let depth=0;t&&depth<12;depth++,t=P.call('parent',t)){
          const target=rootMap.get(t);if(!target)continue;
          if(team===side&&target.club!==club)return null;
          (team===side?roots:opponents).add(t);break;
        }
      }
    }
    if(!roots.size||[...roots].some(root=>opponents.has(root)))return null;
    return {club,roots};
  };
})();
