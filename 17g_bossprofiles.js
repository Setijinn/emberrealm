// ===================================================================================
// 17g_bossprofiles.js — PER-BOSS ANIMATION (user, 2026-07-27: "make multiple animations for each
// boss, I want them to be intricate")
//
// 17f gives every boss a shared vocabulary of beats. That is the grammar; this is the ACCENT.
// Each of the twelve identities gets its own idle, its own tell, its own way of speaking, its own
// death, and one or more signature moves nothing else in the game does — so a Grovewarden reads as
// a rooted thing swelling in place, and Magmaw reads as something that is never quite on the
// surface, even when they are running the same mechanic key.
//
// Beats are built from KEYFRAME SEGMENTS rather than a single sine, which is what "intricate"
// actually means here: anticipation, action, overshoot, follow-through, settle. A one-curve beat
// reads as a wobble; four segments read as intent.
//
// A profile beat is fn(p, age, ux, uy, P) -> mutates P {sx,sy,rot,dx,dy,glow,a}
//   p    0..1 through the beat (0 forever for loops)
//   age  seconds since it started (loops use this)
//   ux,uy unit vector toward the player
// Anything a profile does not define falls back to the shared beat in 17f_bossanim.
// ===================================================================================

// Piecewise keyframes: segs = [[endP, fn(k)], ...], k is 0..1 WITHIN that segment.
function _kf(p, segs){
  let a=0;
  for(let i=0;i<segs.length;i++){
    const end=segs[i][0];
    if(p<=end || i===segs.length-1){ const span=(end-a)||1; return segs[i][1](Math.max(0,Math.min(1,(p-a)/span))); }
    a=end;
  }
  return 0;
}
const _eo=k=>1-Math.pow(1-k,3);                       // ease out cubic
const _ei=k=>k*k*k;                                   // ease in cubic
const _ov=k=>1+2.70158*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2);   // back-out overshoot

// ---------------------------------------------------------------------------------
// Every profile: idle (plays constantly, so it carries the character), wind (the tell before a
// volley), speak (how it emotes on a line), die (how it goes), and 1-2 signature beats.
// ---------------------------------------------------------------------------------
const BOSS_PROF={
// 0 THE GROVEWARDEN — a tree that decided to move. Nothing it does is fast; everything swells.
0:{ beats:{
  idle:(p,t)=>({sy:1+Math.sin(t*0.9)*0.055, sx:1-Math.sin(t*0.9)*0.030, dy:-Math.sin(t*0.9)*2.6,
               rot:Math.sin(t*0.37)*0.022, glow:0.05+0.04*Math.sin(t*0.55)}),
  wind:(p,t,ux)=>{ const k=_kf(p,[[0.55,_eo],[1,k2=>1-k2]]);   // roots grip, whole trunk winds back
    return {sy:1-0.20*k, sx:1+0.16*k, dy:8*k, rot:-ux*0.10*k, glow:0.30*k, dx:-ux*5*k}; },
  rootheave:(p,t,ux,uy)=>{                                     // SIGNATURE: heaves upward off its roots
    const s=_kf(p,[[0.30,k=>-0.28*_ei(k)],[0.62,k=>-0.28+0.72*_ov(k)],[1,k=>0.44-0.44*_eo(k)]]);
    return {sy:1+s, sx:1-s*0.55, dy:-s*30, glow:Math.max(0,s), rot:Math.sin(t*11)*0.05*Math.max(0,s)}; },
  speak:(p,t,ux)=>({rot:ux*0.05+Math.sin(t*1.5)*0.018, dy:-3-Math.sin(t*1.2)*2.2,
                    sy:1+0.035*Math.sin(t*1.2), glow:0.16+0.09*Math.sin(t*2.0)}),
  die:(p,t,ux)=>{ const k=_kf(p,[[0.22,_eo],[1,()=>1]]);      // sags, then the whole trunk goes over
    const f=_kf(p,[[0.22,()=>0],[1,_ei]]);
    return {sy:1-0.16*k-0.30*f, sx:1+0.10*f, rot:-ux*1.25*f, dy:6*k+14*f, a:1-0.6*f, glow:0.35*(1-f)}; } } },

// 1 THE MISTANTLER — never entirely present. Drifts, fades, resolves.
1:{ beats:{
  idle:(p,t)=>({dy:Math.sin(t*1.35)*3.4, dx:Math.sin(t*0.83)*2.2, a:0.90+0.10*Math.sin(t*1.7),
               rot:Math.sin(t*0.61)*0.045, sy:1+0.02*Math.sin(t*1.35)}),
  wind:(p,t,ux)=>{ const k=Math.sin(p*Math.PI);                // thins out before it strikes
    return {a:1-0.45*k, sx:1-0.10*k, sy:1+0.12*k, dx:-ux*9*k, glow:0.40*k}; },
  fade:(p,t)=>{ const k=_kf(p,[[0.5,_ei],[1,k2=>1-_eo(k2)]]); // SIGNATURE: dissolves and reforms
    return {a:1-0.85*k, sx:1-0.35*k, sy:1+0.25*k, glow:0.55*k}; },
  speak:(p,t,ux)=>({dy:-4+Math.sin(t*1.1)*3.0, a:0.85+0.15*Math.sin(t*2.2),
                    rot:ux*0.04+Math.sin(t*0.9)*0.03, glow:0.18+0.12*Math.sin(t*1.6)}),
  die:(p,t)=>{ const k=_eo(p); return {a:1-k, sx:1-0.5*k, sy:1+0.5*k, dy:-22*k, glow:0.5*(1-k)}; } } },

// 2 THE BOG HORROR — a mass in standing water. It does not lift; it surges.
2:{ beats:{
  idle:(p,t)=>({sx:1+Math.sin(t*0.75)*0.055, sy:1-Math.sin(t*0.75)*0.045, dy:Math.abs(Math.sin(t*0.75))*2.0,
               rot:Math.sin(t*0.44)*0.018}),
  wind:(p,t,ux)=>{ const k=_kf(p,[[0.6,_eo],[1,k2=>1-k2]]);    // flattens, gathers, swells
    return {sx:1+0.22*k, sy:1-0.20*k, dy:10*k, glow:0.22*k}; },
  surge:(p,t,ux,uy)=>{                                          // SIGNATURE: a wave of itself
    const k=_kf(p,[[0.34,_ei],[0.70,k2=>1-0.35*k2],[1,k2=>0.65-0.65*_eo(k2)]]);
    return {sx:1+0.34*k, sy:1-0.24*k, dx:ux*16*k, dy:uy*16*k+6*k, glow:0.35*k}; },
  speak:(p,t)=>({sy:1+0.045*Math.sin(t*1.3), sx:1-0.03*Math.sin(t*1.3), dy:-2+Math.sin(t*1.3)*2.4,
                 glow:0.14+0.10*Math.sin(t*2.4)}),
  die:(p,t)=>{ const k=_eo(p); return {sy:1-0.55*k, sx:1+0.40*k, dy:16*k, a:1-0.5*k, glow:0.3*(1-k)}; } } },

// 3 STONEFIST — mass. Every beat is weight arriving somewhere.
3:{ beats:{
  idle:(p,t)=>({sy:1+Math.sin(t*0.62)*0.028, sx:1-Math.sin(t*0.62)*0.020, dy:-Math.sin(t*0.62)*1.4,
               rot:Math.sin(t*0.29)*0.012}),
  wind:(p,t,ux)=>{ const k=_eo(Math.min(1,p*1.6));             // hauls a fist back and HOLDS
    return {sy:1+0.20*k, sx:1-0.12*k, dy:-12*k, rot:-ux*0.16*k, dx:-ux*8*k, glow:0.20*k}; },
  slam:(p,t,ux)=>{                                              // SIGNATURE: the drop, and the bounce
    const s=_kf(p,[[0.26,k=>0.30*_eo(k)],[0.44,k=>0.30-0.62*_ei(k)],[0.62,k=>-0.32+0.22*_eo(k)],
                   [0.80,k=>-0.10-0.08*_ei(k)],[1,k=>-0.18+0.18*_eo(k)]]);
    return {sy:1+s, sx:1-s*0.70, dy:-s*44, rot:-ux*0.18*Math.max(0,s), glow:s<0?-s*1.6:0.15*s}; },
  speak:(p,t,ux)=>({rot:ux*0.035, dy:-1.5-Math.sin(t*0.9)*1.4, sy:1+0.022*Math.sin(t*0.9),
                    glow:0.12+0.07*Math.sin(t*1.8)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:-ux*1.35*f, dy:18*f, sy:1-0.34*f, sx:1+0.16*f,
                    a:1-0.5*f, dx:Math.sin(p*30)*7*(1-f)}; } } },

// 4 THE CRAG GARGOYLE — stone that flies. Snaps between poses; nothing eases.
4:{ beats:{
  idle:(p,t)=>({dy:Math.sin(t*2.6)*4.2, sx:1+Math.sin(t*2.6)*0.045, sy:1-Math.sin(t*2.6)*0.055,
               rot:Math.sin(t*1.3)*0.05}),
  wind:(p,t,ux)=>{ const k=_kf(p,[[0.75,k2=>_ei(k2)],[1,k2=>1-k2]]);   // folds tight, then snaps
    return {sx:1-0.20*k, sy:1+0.24*k, dy:-16*k, rot:ux*0.20*k, glow:0.30*k}; },
  dive:(p,t,ux,uy)=>{                                           // SIGNATURE: a stooping fall
    const k=_kf(p,[[0.18,_ei],[0.55,()=>1],[1,k2=>1-_eo(k2)]]);
    return {sx:1+0.30*k, sy:1-0.22*k, dx:ux*22*k, dy:uy*22*k, rot:ux*0.34*k, glow:0.30*k}; },
  speak:(p,t,ux)=>({dy:-5+Math.sin(t*2.2)*3.2, rot:ux*0.06+Math.sin(t*1.7)*0.04,
                    glow:0.15+0.10*Math.sin(t*3.0)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:ux*2.2*f, dy:26*f, sx:1-0.2*f, sy:1-0.2*f, a:1-0.7*f}; } } },

// 5 MAGMAW — mostly below. Sinks, travels, erupts.
5:{ beats:{
  idle:(p,t)=>({sy:1+Math.sin(t*1.05)*0.06, sx:1-Math.sin(t*1.05)*0.04, dy:Math.sin(t*1.05)*3.0,
               glow:0.10+0.08*Math.sin(t*1.9)}),
  wind:(p,t)=>{ const k=_eo(p); return {sy:1-0.30*k, sx:1+0.18*k, dy:14*k, glow:0.45*k}; },  // sinking
  burrow:(p,t)=>{ const k=_ei(p); return {sy:1-0.90*k, sx:1+0.30*k, dy:30*k, a:1-0.9*k, glow:0.5*(1-k)}; },
  erupt:(p,t)=>{                                                // SIGNATURE: bursts up out of the floor
    const k=_kf(p,[[0.20,_ei],[0.46,_ov],[1,k2=>1-0.35*_eo(k2)]]);
    return {sy:0.25+0.90*k, sx:1.30-0.30*k, dy:34-40*k, a:Math.min(1,k*1.8), glow:0.85*(1-p*0.6)}; },
  speak:(p,t)=>({sy:1+0.05*Math.sin(t*1.6), dy:-2+Math.sin(t*1.6)*2.6, glow:0.20+0.14*Math.sin(t*2.6)}),
  die:(p,t)=>{ const k=_ei(p); return {sy:1-0.85*k, sx:1+0.35*k, dy:30*k, a:1-0.8*k, glow:0.6*(1-k)}; } } },

// 6 THE ASH WRAITH — no body to speak of. Streams, scatters, gathers.
6:{ beats:{
  idle:(p,t)=>({dy:Math.sin(t*1.9)*4.6, dx:Math.sin(t*1.17)*3.2, sy:1+0.06*Math.sin(t*1.9),
               sx:1-0.05*Math.sin(t*1.9), a:0.88+0.12*Math.sin(t*2.4), rot:Math.sin(t*0.7)*0.06}),
  wind:(p,t,ux)=>{ const k=Math.sin(p*Math.PI);
    return {sx:1-0.24*k, sy:1+0.30*k, dy:-10*k, a:1-0.30*k, glow:0.45*k}; },
  scatter:(p,t,ux)=>{                                           // SIGNATURE: comes apart and re-forms
    const k=_kf(p,[[0.45,_eo],[1,k2=>1-_eo(k2)]]);
    return {sx:1+0.70*k, sy:1-0.34*k, a:1-0.62*k, glow:0.6*k, rot:Math.sin(t*17)*0.12*k}; },
  speak:(p,t,ux)=>({dy:-4+Math.sin(t*1.9)*3.4, a:0.82+0.18*Math.sin(t*2.7),
                    rot:ux*0.03+Math.sin(t*1.1)*0.05, glow:0.20+0.14*Math.sin(t*2.2)}),
  die:(p,t)=>{ const k=_eo(p); return {sx:1+1.1*k, sy:1-0.5*k, a:1-k, glow:0.5*(1-k), dy:-10*k}; } } },

// 7 THE CINDER DEMON — deliberate and theatrical. It performs.
7:{ beats:{
  idle:(p,t)=>({sy:1+Math.sin(t*1.15)*0.045, sx:1-Math.sin(t*1.15)*0.030, dy:-Math.sin(t*1.15)*2.4,
               rot:Math.sin(t*0.48)*0.030, glow:0.09+0.07*Math.sin(t*1.6)}),
  wind:(p,t,ux)=>{ const k=_kf(p,[[0.65,_eo],[1,k2=>1-k2]]);   // draws itself up to full height
    return {sy:1+0.26*k, sx:1-0.14*k, dy:-15*k, rot:-ux*0.09*k, glow:0.5*k}; },
  brand:(p,t,ux,uy)=>{                                          // SIGNATURE: points, and marks you
    const k=_kf(p,[[0.28,_eo],[0.60,()=>1],[1,k2=>1-_eo(k2)]]);
    return {rot:ux*0.22*k, dx:ux*10*k, sy:1+0.08*k, sx:1+0.05*k, glow:0.9*k}; },
  speak:(p,t,ux)=>({rot:ux*0.08+Math.sin(t*1.3)*0.025, dy:-4-Math.sin(t*1.1)*2.0,
                    sy:1+0.04*Math.sin(t*1.1), glow:0.22+0.13*Math.sin(t*1.9)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:-ux*1.05*f, dy:14*f, sy:1-0.28*f, a:1-0.55*f,
                    glow:0.7*(1-f), dx:Math.sin(p*22)*4*(1-f)}; } } },

// 8 THE MOLTEN TITAN — the capstone. Slow, enormous, seismic.
8:{ beats:{
  idle:(p,t)=>({sy:1+Math.sin(t*0.5)*0.035, sx:1-Math.sin(t*0.5)*0.024, dy:-Math.sin(t*0.5)*2.0,
               rot:Math.sin(t*0.23)*0.010, glow:0.12+0.09*Math.sin(t*0.8)}),
  wind:(p,t)=>{ const k=_eo(Math.min(1,p*1.4));
    return {sy:1+0.16*k, sx:1-0.10*k, dy:-10*k, glow:0.40*k, dx:Math.sin(t*30)*1.6*k}; },
  quake:(p,t,ux)=>{                                             // SIGNATURE: it does not move, the world does
    const k=Math.sin(p*Math.PI);
    return {dx:Math.sin(t*52)*4.2*k, dy:Math.cos(t*47)*3.2*k, sy:1+0.06*k, sx:1+0.04*k, glow:0.7*k}; },
  corebreak:(p,t)=>{                                            // SIGNATURE: its shell cracks open
    const k=_kf(p,[[0.35,_ei],[1,k2=>1-0.4*_eo(k2)]]);
    return {sx:1+0.20*k, sy:1+0.12*k, glow:k, rot:Math.sin(t*15)*0.05*k}; },
  speak:(p,t,ux)=>({rot:ux*0.03, dy:-2-Math.sin(t*0.8)*1.8, sy:1+0.028*Math.sin(t*0.8),
                    glow:0.25+0.15*Math.sin(t*1.4)}),
  die:(p,t,ux)=>{ const f=_ei(p);                               // the long fall
    return {rot:-ux*1.5*f, dy:24*f, sy:1-0.40*f, sx:1+0.22*f, a:1-0.45*f,
            glow:1.0*(1-f), dx:Math.sin(p*18)*9*(1-f)}; } } },

// 9 THE TIDEWRACK — the first boss. Big readable arcs, nothing subtle.
9:{ beats:{
  idle:(p,t)=>({sx:1+Math.sin(t*1.0)*0.05, sy:1-Math.sin(t*1.0)*0.04, dy:Math.sin(t*1.0)*2.8,
               rot:Math.sin(t*0.5)*0.025}),
  wind:(p,t,ux)=>{ const k=_kf(p,[[0.7,_eo],[1,k2=>1-k2]]);     // a very legible tell for a Lv4 fight
    return {sx:1+0.20*k, sy:1-0.16*k, dx:-ux*10*k, rot:-ux*0.14*k, glow:0.35*k}; },
  sweep:(p,t,ux)=>{ const k=Math.sin(p*Math.PI);                // SIGNATURE: a slow broad arc
    return {rot:ux*0.42*Math.sin(p*Math.PI*1.0), dx:ux*14*k, sx:1+0.14*k, glow:0.25*k}; },
  speak:(p,t,ux)=>({rot:ux*0.06+Math.sin(t*1.0)*0.03, dy:-3+Math.sin(t*1.0)*2.4,
                    glow:0.14+0.09*Math.sin(t*1.8)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:-ux*1.1*f, dy:16*f, sy:1-0.3*f, a:1-0.5*f}; } } },

// 10 THE GULLWIND HARRIER — quick, twitchy, always slightly airborne.
10:{ beats:{
  idle:(p,t)=>({dy:Math.sin(t*3.1)*5.0, rot:Math.sin(t*1.55)*0.07, sx:1+Math.sin(t*3.1)*0.05,
               sy:1-Math.sin(t*3.1)*0.06}),
  wind:(p,t,ux)=>{ const k=_ei(Math.min(1,p*1.5));
    return {sy:1+0.22*k, sx:1-0.18*k, dy:-18*k, rot:ux*0.24*k, glow:0.28*k}; },
  stoop:(p,t,ux,uy)=>{ const k=_kf(p,[[0.22,_ei],[0.6,()=>1],[1,k2=>1-_eo(k2)]]);
    return {sx:1+0.34*k, sy:1-0.26*k, dx:ux*26*k, dy:uy*26*k, rot:ux*0.40*k}; },
  speak:(p,t,ux)=>({dy:-6+Math.sin(t*2.8)*3.6, rot:ux*0.05+Math.sin(t*2.1)*0.06,
                    glow:0.13+0.10*Math.sin(t*3.4)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:ux*2.6*f, dy:30*f, sx:1-0.25*f, sy:1-0.25*f, a:1-0.7*f}; } } },

// 11 THE SAWGRASS REAPER — a long swing and a long recovery. Everything is the arc.
11:{ beats:{
  idle:(p,t)=>({rot:Math.sin(t*0.8)*0.045, dy:Math.sin(t*1.1)*2.6, sy:1+0.03*Math.sin(t*1.1),
               sx:1-0.02*Math.sin(t*1.1)}),
  wind:(p,t,ux)=>{ const k=_eo(p);                              // winds the scythe all the way back
    return {rot:-ux*0.44*k, dx:-ux*12*k, sx:1-0.08*k, sy:1+0.10*k, glow:0.30*k}; },
  reap:(p,t,ux)=>{                                              // SIGNATURE: the swing, and the drag after it
    const k=_kf(p,[[0.16,k2=>-0.44+(-0.10)*k2],[0.42,k2=>-0.54+1.10*_ei(k2)],
                   [0.68,k2=>0.56+0.14*_eo(k2)],[1,k2=>0.70-0.70*_eo(k2)]]);
    return {rot:ux*k, dx:ux*k*16, sx:1+Math.abs(k)*0.16, sy:1-Math.abs(k)*0.10, glow:0.22*Math.abs(k)}; },
  speak:(p,t,ux)=>({rot:ux*0.07+Math.sin(t*1.2)*0.035, dy:-3-Math.sin(t*1.0)*1.8,
                    glow:0.15+0.10*Math.sin(t*2.0)}),
  die:(p,t,ux)=>{ const f=_ei(p); return {rot:-ux*1.6*f, dy:18*f, sy:1-0.32*f, a:1-0.55*f}; } } },
};
// A boss's profile follows its IDENTITY, not its form: the Awakened Grovewarden moves like the
// Grovewarden because it IS one. Forms differ through the fight registry, not the skeleton.
function bossProfile(e){ return (e && e.ring!=null && e.ring>=0) ? (BOSS_PROF[e.ring]||null) : null; }
// Does this boss have its own version of this beat?
function bossProfBeat(e,name){ const P=bossProfile(e); return (P&&P.beats&&P.beats[name])||null; }
// Every signature beat a boss owns, for the fights in 17h to call by name.
function bossSigBeats(e){ const P=bossProfile(e); return P&&P.beats?Object.keys(P.beats):[]; }

// ---- REGISTER THE SIGNATURE BEATS ----
// A beat only advances if the shared table knows how long it runs; a profile-only name fell
// through to the `speak` entry, which is a LOOP, so it sat frozen at p=0 and never moved. Every
// signature move gets a real duration and a priority high enough to interrupt an ordinary volley
// tell but not a phase break.
const BOSS_SIG={
  rootheave:{t:0.90,pri:4}, fade:{t:0.80,pri:5}, surge:{t:0.70,pri:4},
  dive:{t:0.55,pri:4},      burrow:{t:0.70,pri:5}, erupt:{t:0.90,pri:5},
  scatter:{t:0.90,pri:5},   brand:{t:1.00,pri:4},  quake:{t:1.40,pri:5},
  corebreak:{t:1.20,pri:6}, sweep:{t:0.80,pri:4},  stoop:{t:0.60,pri:4},
  reap:{t:0.75,pri:4},
};
if(typeof BOSS_ANIM!=='undefined'){ for(const k in BOSS_SIG) if(!BOSS_ANIM[k]) BOSS_ANIM[k]=BOSS_SIG[k]; }
// `idle` is a real state now, not the absence of one: it must exist in the table so a profile idle
// is treated as a loop rather than a one-shot that ends after half a second.
if(typeof BOSS_ANIM!=='undefined' && !BOSS_ANIM.idle) BOSS_ANIM.idle={t:0,pri:-1};
// Give each boss a phase offset so two of the same species never breathe in lockstep.
function bossAnimSeed(e){ if(e&&e.animSeed===undefined) e.animSeed=((e.x|0)*0.013+(e.y|0)*0.029)%6.283; }
