"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   GOLF WAGER — iOS-native betting companion
   Aesthetic: Dark luxury clubhouse — deep greens, gold accents, editorial type
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Data ──────────────────────────────────────────────────────────────
const GAMES = [
  { id:"nassau", name:"Nassau", icon:"🏆", cat:"Classic",
    desc:"Front 9, Back 9, and Overall — three independent bets",
    rules:"Three separate match-play bets run simultaneously. The front nine, back nine, and total eighteen are each wagered independently. Press option doubles the bet on any segment where you're down.",
    stakes:[5,10,20,50], def:10 },
  { id:"skins", name:"Skins", icon:"💰", cat:"Classic",
    desc:"Win outright or the pot carries over",
    rules:"Each hole is worth a set amount. The lowest individual score wins. If two or more players tie, the value carries to the next hole, growing the pot until someone wins outright.",
    stakes:[1,2,5,10], def:2 },
  { id:"dots", name:"Dots / Trash", icon:"⚫", cat:"Side",
    desc:"Points for greenies, sandies, barkies & more",
    rules:"Earn dots for on-course achievements. Greenie (closest on par 3 in regulation), Sandy (up-and-down from bunker), Barkie (hit a tree, still make par), Polie (one-putt), and bonuses for birdies and eagles. Each dot has a set value.",
    stakes:[0.5,1,2,5], def:1 },
  { id:"wolf", name:"Wolf", icon:"🐺", cat:"Advanced",
    desc:"Pick your partner or go lone wolf",
    rules:"A rotating Wolf chooses a partner after seeing tee shots — or goes alone for double-or-nothing stakes against the other three. Strategic alliances shift every hole.",
    stakes:[2,5,10,20], def:5 },
  { id:"bingo", name:"Bingo Bango Bongo", icon:"🎯", cat:"Side",
    desc:"Three points available each hole",
    rules:"Bingo: first on the green. Bango: closest to the pin once all balls are on. Bongo: first to hole out. Levels the field for mixed-handicap groups.",
    stakes:[1,2,5], def:1 },
  { id:"vegas", name:"Vegas", icon:"🎲", cat:"Advanced",
    desc:"Team scores become two-digit numbers",
    rules:"2v2 teams. Each team's individual scores combine into a two-digit number (lower digit first, e.g. 4+5=45). The difference between team numbers × stake is the payout. A birdie flips the opposing team's number (45→54).",
    stakes:[0.1,0.25,0.5,1], def:0.25 },
];
const CATS = ["All","Classic","Side","Advanced"];
const PARS = [4,4,3,5,4,4,3,4,5, 4,3,4,5,4,4,3,5,4];
const HOLE_NAMES = [
  "","","","","","","","","",
  "","","","","","","","",""
];
const COLORS = ["#5CE0B8","#5BA4F5","#F27E8D","#F5C542","#B07AF5","#F59A45"];

const initPlayers = () => [
  { id:1, name:"You", hcp:12, color:COLORS[0], scores:Array(18).fill(null) },
  { id:2, name:"Player 2", hcp:8, color:COLORS[1], scores:Array(18).fill(null) },
];

// ─── Helpers ───────────────────────────────────────────────────────────
const sum = (arr) => arr.reduce((a,v) => a + (v||0), 0);
const played = (p) => p.scores.filter(s=>s!==null).length;
const relPar = (score, par) => {
  if(score===null) return null;
  const d = score - par;
  return d <= -3 ? "albatross" : d === -2 ? "eagle" : d === -1 ? "birdie"
       : d === 0 ? "par" : d === 1 ? "bogey" : d === 2 ? "dbl" : "trip";
};
const relColor = (score, par) => {
  const r = relPar(score,par);
  if(!r) return "rgba(255,255,255,0.2)";
  return { albatross:"#F5C542", eagle:"#F5C542", birdie:"#F27E8D", par:"#5CE0B8",
    bogey:"#5BA4F5", dbl:"#B07AF5", trip:"#F59A45" }[r];
};
const relLabel = (score, par) => {
  const r = relPar(score,par);
  if(!r) return "";
  return { albatross:"Albatross", eagle:"Eagle", birdie:"Birdie", par:"Par",
    bogey:"Bogey", dbl:"Double", trip:`+${score-par}` }[r];
};

// ─── App ───────────────────────────────────────────────────────────────
export default function GolfWagerApp() {
  const [tab, setTab] = useState("round");
  const [players, setPlayers] = useState(initPlayers);
  const [activeGames, setActiveGames] = useState([
    { ...GAMES[0], stake:GAMES[0].def },
    { ...GAMES[1], stake:GAMES[1].def },
  ]);
  const [hole, setHole] = useState(0);
  const [sheet, setSheet] = useState(null); // null | "score" | "game" | "addPlayer" | "editPlayer"
  const [sheetGame, setSheetGame] = useState(null);
  const [editPlayer, setEditPlayer] = useState(null);
  const scrollRef = useRef(null);

  const updateScore = useCallback((pid, h, val) => {
    setPlayers(prev => prev.map(p =>
      p.id === pid ? { ...p, scores: p.scores.map((s,i) => i===h ? val : s) } : p
    ));
  }, []);

  const addPlayer = useCallback((name, hcp) => {
    setPlayers(prev => [...prev, {
      id: Date.now(), name, hcp: parseInt(hcp)||0,
      color: COLORS[prev.length % COLORS.length],
      scores: Array(18).fill(null),
    }]);
  }, []);

  const removePlayer = useCallback((id) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }, []);

  const toggleGame = useCallback((game) => {
    setActiveGames(prev => {
      if (prev.find(g => g.id === game.id)) return prev.filter(g => g.id !== game.id);
      return [...prev, { ...game, stake: game.def }];
    });
  }, []);

  const setStake = useCallback((gid, stake) => {
    setActiveGames(prev => prev.map(g => g.id === gid ? {...g, stake} : g));
  }, []);

  // ─── Calculations ────────────────────────────────────────────────────
  const nassauCalc = useMemo(() => {
    const ng = activeGames.find(g => g.id === "nassau");
    if (!ng || players.length < 2) return null;
    const calc = (s,e) => {
      const scores = players.map(p => ({ p, t: sum(p.scores.slice(s,e)) }));
      scores.sort((a,b) => a.t - b.t);
      const best = scores[0].t;
      const winners = scores.filter(s => s.t === best);
      return { scores, leader: winners.length === 1 ? winners[0].p.name : "Tied", best };
    };
    return { front: calc(0,9), back: calc(9,18), overall: calc(0,18), stake: ng.stake };
  }, [players, activeGames]);

  const skinsCalc = useMemo(() => {
    const sg = activeGames.find(g => g.id === "skins");
    if (!sg || players.length < 2) return [];
    let carry = 0;
    const res = [];
    for (let h = 0; h < 18; h++) {
      const entries = players.map(p => ({ p, s: p.scores[h] })).filter(e => e.s !== null);
      if (entries.length < 2) continue;
      carry += sg.stake;
      const min = Math.min(...entries.map(e => e.s));
      const winners = entries.filter(e => e.s === min);
      if (winners.length === 1) {
        res.push({ hole: h+1, winner: winners[0].p.name, color: winners[0].p.color, val: carry });
        carry = 0;
      } else {
        res.push({ hole: h+1, winner: "Carry", color: "rgba(255,255,255,0.15)", val: carry });
      }
    }
    return res;
  }, [players, activeGames]);

  const settlements = useMemo(() => {
    const lines = [];
    if (nassauCalc) {
      const nc = nassauCalc;
      ["front","back","overall"].forEach((seg, i) => {
        const label = ["Front 9","Back 9","Overall"][i];
        const d = nc[seg];
        if (d.leader !== "Tied" && players.length >= 2) {
          players.filter(p => p.name !== d.leader).forEach(loser => {
            lines.push({ game:`Nassau ${label}`, from: loser.name, to: d.leader, amt: nc.stake });
          });
        }
      });
    }
    const skinTotals = {};
    skinsCalc.filter(s => s.winner !== "Carry").forEach(s => {
      skinTotals[s.winner] = (skinTotals[s.winner]||0) + s.val;
    });
    Object.entries(skinTotals).forEach(([w, t]) => {
      lines.push({ game:"Skins", from:"Others", to:w, amt:t });
    });
    return lines;
  }, [nassauCalc, skinsCalc, players]);

  const netBal = useMemo(() => {
    const b = {};
    players.forEach(p => { b[p.name] = 0; });
    settlements.forEach(s => {
      if (b[s.to] !== undefined) b[s.to] += s.amt;
      if (b[s.from] !== undefined) b[s.from] -= s.amt;
    });
    return b;
  }, [settlements, players]);

  // ─── Sheets ──────────────────────────────────────────────────────────
  const closeSheet = () => { setSheet(null); setSheetGame(null); setEditPlayer(null); };
  const Overlay = ({ children }) => (
    <div style={S.overlay} onClick={closeSheet}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.handle} />
        {children}
      </div>
    </div>
  );

  const ScoreSheet = () => {
    const par = PARS[hole];
    const scores = [1,2,3,4,5,6,7,8,9,10];
    return (
      <Overlay>
        <div style={S.sheetHead}>
          <div>
            <div style={S.sheetHoleNum}>Hole {hole+1}</div>
            <div style={S.sheetParLabel}>Par {par}</div>
          </div>
          <div style={S.holeNavMini}>
            <button style={S.miniNav} onClick={() => setHole(h => Math.max(0,h-1))} disabled={hole===0}>‹</button>
            <button style={S.miniNav} onClick={() => setHole(h => Math.min(17,h+1))} disabled={hole===17}>›</button>
          </div>
        </div>
        {players.map(p => (
          <div key={p.id} style={S.scoreRow}>
            <div style={S.scoreRowLeft}>
              <div style={{...S.dot, background:p.color}} />
              <span style={S.scoreRowName}>{p.name}</span>
              {p.scores[hole] !== null && (
                <span style={{...S.relBadge, color: relColor(p.scores[hole], par)}}>
                  {relLabel(p.scores[hole], par)}
                </span>
              )}
            </div>
            <div style={S.scorePills}>
              {scores.map(s => {
                const sel = p.scores[hole] === s;
                const c = relColor(s, par);
                return (
                  <button key={s} onClick={() => updateScore(p.id, hole, sel ? null : s)}
                    style={{
                      ...S.pill,
                      background: sel ? c : "rgba(255,255,255,0.04)",
                      color: sel ? "#0B1A14" : "rgba(255,255,255,0.45)",
                      fontWeight: sel ? 800 : 500,
                      border: sel ? `2px solid ${c}` : "2px solid rgba(255,255,255,0.06)",
                      transform: sel ? "scale(1.15)" : "scale(1)",
                      boxShadow: sel ? `0 0 12px ${c}40` : "none",
                    }}>{s}</button>
                );
              })}
            </div>
          </div>
        ))}
        <button style={S.doneBtn} onClick={closeSheet}>Done</button>
      </Overlay>
    );
  };

  const GameSheet = () => {
    if (!sheetGame) return null;
    const g = sheetGame;
    const active = activeGames.find(a => a.id === g.id);
    return (
      <Overlay>
        <div style={{textAlign:"center", padding:"4px 0 12px"}}>
          <span style={{fontSize:48}}>{g.icon}</span>
          <h2 style={S.gameSheetName}>{g.name}</h2>
          <span style={S.catPill}>{g.cat}</span>
        </div>
        <p style={S.gameRules}>{g.rules}</p>
        {active && (
          <div style={{marginTop:16}}>
            <div style={S.stakeLabel}>STAKE PER UNIT</div>
            <div style={{display:"flex", gap:8, marginTop:8}}>
              {g.stakes.map(s => (
                <button key={s} onClick={() => setStake(g.id, s)}
                  style={{
                    ...S.stakeChip,
                    background: active.stake === s ? "#5CE0B8" : "rgba(255,255,255,0.04)",
                    color: active.stake === s ? "#0B1A14" : "rgba(255,255,255,0.5)",
                    fontWeight: active.stake === s ? 700 : 500,
                  }}>${s}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => toggleGame(g)}
          style={{
            ...S.doneBtn,
            background: active ? "rgba(242,126,141,0.12)" : "#5CE0B8",
            color: active ? "#F27E8D" : "#0B1A14",
            marginTop: 20,
          }}>
          {active ? "Remove from Round" : "Add to Round"}
        </button>
      </Overlay>
    );
  };

  const AddPlayerSheet = () => {
    const [n, setN] = useState("");
    const [h, setH] = useState("0");
    return (
      <Overlay>
        <h2 style={S.gameSheetName}>Add Player</h2>
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Name</label>
          <input style={S.input} value={n} onChange={e=>setN(e.target.value)} placeholder="Name" autoFocus />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Handicap Index</label>
          <input style={S.input} value={h} onChange={e=>setH(e.target.value)} placeholder="0" type="number" />
        </div>
        <button style={{...S.doneBtn, opacity: n.trim()?1:0.35}}
          onClick={() => { if(n.trim()){ addPlayer(n.trim(),h); closeSheet(); } }}>
          Add Player
        </button>
      </Overlay>
    );
  };

  // ─── ROUND TAB ───────────────────────────────────────────────────────
  const RoundView = () => {
    const maxPlayed = Math.max(...players.map(played), 0);
    const thruStr = maxPlayed > 0 ? `Thru ${maxPlayed}` : "Tap a hole to begin";
    const parTotal = (s,e) => PARS.slice(s,e).reduce((a,b)=>a+b,0);

    return (
      <div style={S.content}>
        {/* Hero */}
        <div style={S.hero}>
          <div style={S.heroRow}>
            <div>
              <div style={S.heroEyebrow}>ROUND IN PROGRESS</div>
              <div style={S.heroThru}>{thruStr}</div>
            </div>
            <div style={S.holeBadge}>
              <div style={S.holeBadgeLabel}>HOLE</div>
              <div style={S.holeBadgeNum}>{hole+1}</div>
              <div style={S.holeBadgePar}>Par {PARS[hole]}</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div style={S.lb}>
            {[...players].sort((a,b) => sum(a.scores) - sum(b.scores)).map((p, i) => {
              const t = sum(p.scores);
              const ph = played(p);
              const parPlayed = PARS.slice(0, ph).reduce((a,b)=>a+b,0);
              const diff = ph === 0 ? 0 : t - parPlayed;
              const parStr = ph === 0 ? "E" : diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
              return (
                <div key={p.id} style={S.lbRow}>
                  <div style={S.lbLeft}>
                    <span style={{...S.lbRank, color: i===0 && ph > 0 ? "#F5C542" : "rgba(255,255,255,0.25)"}}>{i+1}</span>
                    <div style={{...S.dot, background:p.color}} />
                    <span style={S.lbName}>{p.name}</span>
                    <span style={S.lbHcp}>{p.hcp}</span>
                  </div>
                  <div style={S.lbRight}>
                    <span style={{...S.lbPar,
                      color: diff < 0 ? "#F27E8D" : diff === 0 ? "#5CE0B8" : "#5BA4F5"
                    }}>{parStr}</span>
                    <span style={S.lbTotal}>{t || "–"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button style={S.addPlayerBtn} onClick={() => setSheet("addPlayer")}>+ Add Player</button>
        </div>

        {/* Active Wagers */}
        {activeGames.length > 0 && (
          <div style={S.sec}>
            <div style={S.secTitle}>ACTIVE WAGERS</div>
            <div style={S.wagerRow}>
              {activeGames.map(g => (
                <button key={g.id} style={S.wagerChip}
                  onClick={() => { setSheetGame(GAMES.find(x=>x.id===g.id)); setSheet("game"); }}>
                  <span style={{fontSize:20}}>{g.icon}</span>
                  <span style={S.wagerChipName}>{g.name}</span>
                  <span style={S.wagerChipStake}>${g.stake}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scorecard */}
        <div style={S.sec}>
          <div style={S.secTitle}>SCORECARD</div>
          <div style={S.card}>
            {/* Header */}
            <div style={S.scHead}>
              <div style={S.scHole}>Hole</div>
              <div style={S.scPar}>Par</div>
              {players.map(p => (
                <div key={p.id} style={S.scPCol}>
                  <div style={{...S.dotSm, background:p.color}} />
                </div>
              ))}
            </div>

            {/* Front 9 */}
            {PARS.slice(0,9).map((par, h) => {
              const active = h === hole;
              return (
                <div key={h} onClick={() => { setHole(h); setSheet("score"); }}
                  style={{
                    ...S.scRow,
                    background: active ? "rgba(92,224,184,0.06)" : "transparent",
                    borderLeft: active ? "3px solid #5CE0B8" : "3px solid transparent",
                  }}>
                  <div style={{...S.scHole, color: active ? "#5CE0B8" : "rgba(255,255,255,0.65)", fontWeight:700}}>{h+1}</div>
                  <div style={S.scPar}>{par}</div>
                  {players.map(p => {
                    const s = p.scores[h];
                    return (
                      <div key={p.id} style={S.scPCol}>
                        {s !== null ? (
                          <span style={{...S.scBadge, background: relColor(s,par)}}>{s}</span>
                        ) : <span style={S.scDash}>–</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* OUT total */}
            <div style={S.scTotalRow}>
              <div style={{...S.scHole, fontWeight:800}}>OUT</div>
              <div style={{...S.scPar, fontWeight:600}}>{parTotal(0,9)}</div>
              {players.map(p => (
                <div key={p.id} style={S.scPCol}>
                  <span style={S.scTotalNum}>{sum(p.scores.slice(0,9)) || "–"}</span>
                </div>
              ))}
            </div>

            {/* Back 9 */}
            {PARS.slice(9,18).map((par, idx) => {
              const h = idx + 9;
              const active = h === hole;
              return (
                <div key={h} onClick={() => { setHole(h); setSheet("score"); }}
                  style={{
                    ...S.scRow,
                    background: active ? "rgba(92,224,184,0.06)" : "transparent",
                    borderLeft: active ? "3px solid #5CE0B8" : "3px solid transparent",
                  }}>
                  <div style={{...S.scHole, color: active ? "#5CE0B8" : "rgba(255,255,255,0.65)", fontWeight:700}}>{h+1}</div>
                  <div style={S.scPar}>{par}</div>
                  {players.map(p => {
                    const s = p.scores[h];
                    return (
                      <div key={p.id} style={S.scPCol}>
                        {s !== null ? (
                          <span style={{...S.scBadge, background: relColor(s,par)}}>{s}</span>
                        ) : <span style={S.scDash}>–</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* IN total */}
            <div style={S.scTotalRow}>
              <div style={{...S.scHole, fontWeight:800}}>IN</div>
              <div style={{...S.scPar, fontWeight:600}}>{parTotal(9,18)}</div>
              {players.map(p => (
                <div key={p.id} style={S.scPCol}>
                  <span style={S.scTotalNum}>{sum(p.scores.slice(9,18)) || "–"}</span>
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div style={{...S.scTotalRow, borderTop:"1.5px solid rgba(255,255,255,0.12)"}}>
              <div style={{...S.scHole, fontWeight:900, color:"#fff"}}>TOT</div>
              <div style={{...S.scPar, fontWeight:700, color:"rgba(255,255,255,0.7)"}}>{parTotal(0,18)}</div>
              {players.map(p => (
                <div key={p.id} style={S.scPCol}>
                  <span style={{...S.scTotalNum, fontWeight:800, color:"#fff"}}>{sum(p.scores) || "–"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hole Navigation */}
        <div style={S.holeNav}>
          <button style={{...S.navBtn, opacity: hole===0?0.3:1}} disabled={hole===0}
            onClick={() => setHole(h=>Math.max(0,h-1))}>‹ Prev</button>
          <button style={S.enterBtn} onClick={() => setSheet("score")}>Enter Scores</button>
          <button style={{...S.navBtn, opacity: hole===17?0.3:1}} disabled={hole===17}
            onClick={() => setHole(h=>Math.min(17,h+1))}>Next ›</button>
        </div>
      </div>
    );
  };

  // ─── GAMES TAB ───────────────────────────────────────────────────────
  const GamesView = () => {
    const [filter, setFilter] = useState("All");
    const list = filter === "All" ? GAMES : GAMES.filter(g => g.cat === filter);
    return (
      <div style={S.content}>
        <h2 style={S.pageTitle}>Games Library</h2>
        <p style={S.pageSub}>Choose wagers for your round</p>
        <div style={S.filters}>
          {CATS.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{
                ...S.filterBtn,
                background: filter===c ? "#5CE0B8" : "rgba(255,255,255,0.04)",
                color: filter===c ? "#0B1A14" : "rgba(255,255,255,0.45)",
              }}>{c}</button>
          ))}
        </div>
        <div style={S.gamesList}>
          {list.map(g => {
            const on = activeGames.some(a => a.id === g.id);
            return (
              <div key={g.id} style={{
                ...S.gameCard,
                border: on ? "1.5px solid rgba(92,224,184,0.3)" : "1.5px solid rgba(255,255,255,0.05)",
              }} onClick={() => { setSheetGame(g); setSheet("game"); }}>
                <div style={S.gameCardTop}>
                  <span style={{fontSize:30}}>{g.icon}</span>
                  {on && <div style={S.onBadge}>Active</div>}
                </div>
                <h3 style={S.gameCardName}>{g.name}</h3>
                <p style={S.gameCardDesc}>{g.desc}</p>
                <div style={S.gameCardBot}>
                  <span style={S.catPill}>{g.cat}</span>
                  {on && <span style={S.gameStakeTag}>${activeGames.find(a=>a.id===g.id)?.stake}/unit</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── SETTLE TAB ──────────────────────────────────────────────────────
  const SettleView = () => (
    <div style={S.content}>
      <h2 style={S.pageTitle}>Settlement</h2>
      <p style={S.pageSub}>Who owes what after the round</p>

      {/* Balances */}
      <div style={S.balGrid}>
        {players.map(p => {
          const b = netBal[p.name] || 0;
          return (
            <div key={p.id} style={S.balCard}>
              <div style={S.balTop}>
                <div style={{...S.dot, background:p.color}} />
                <span style={S.balName}>{p.name}</span>
              </div>
              <span style={{
                ...S.balAmt,
                color: b > 0 ? "#5CE0B8" : b < 0 ? "#F27E8D" : "rgba(255,255,255,0.35)",
              }}>
                {b > 0 ? `+$${b.toFixed(2)}` : b < 0 ? `-$${Math.abs(b).toFixed(2)}` : "$0.00"}
              </span>
              <span style={S.balLabel}>{b > 0 ? "Collecting" : b < 0 ? "Owes" : "Even"}</span>
            </div>
          );
        })}
      </div>

      {/* Breakdown */}
      <div style={S.sec}>
        <div style={S.secTitle}>BREAKDOWN</div>
        {settlements.length === 0 ? (
          <div style={S.empty}>
            <span style={{fontSize:44, marginBottom:8}}>🏌️</span>
            <p style={{color:"rgba(255,255,255,0.35)", fontSize:14}}>Enter scores to see payouts</p>
          </div>
        ) : (
          <div style={S.settleList}>
            {settlements.map((s,i) => (
              <div key={i} style={S.settleLine}>
                <div>
                  <div style={S.settleGame}>{s.game}</div>
                  <div style={S.settleFlow}>{s.from} → {s.to}</div>
                </div>
                <span style={S.settleAmt}>${s.amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skins Detail */}
      {skinsCalc.length > 0 && (
        <div style={S.sec}>
          <div style={S.secTitle}>SKINS DETAIL</div>
          <div style={S.skinsGrid}>
            {skinsCalc.map((s,i) => (
              <div key={i} style={{
                ...S.skinRow,
                borderLeft: `3px solid ${s.color}`,
              }}>
                <span style={S.skinHole}>#{s.hole}</span>
                <span style={S.skinWinner}>{s.winner}</span>
                <span style={{
                  ...S.skinVal,
                  color: s.winner === "Carry" ? "rgba(255,255,255,0.25)" : "#5CE0B8",
                }}>${s.val.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      `}</style>

      {/* Status Bar */}
      <div style={S.status}>
        <span style={S.statusTime}>9:41</span>
        <div style={S.statusIcons}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x="0" y="8" width="3" height="4" rx="0.5" fill="white"/><rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white"/><rect x="9" y="2" width="3" height="10" rx="0.5" fill="white"/><rect x="13.5" y="0" width="2.5" height="12" rx="0.5" fill="white" opacity="0.3"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x="0.5" y="1" width="13" height="10" rx="2" stroke="white" strokeWidth="1"/><rect x="14" y="4" width="2" height="4" rx="0.5" fill="white"/><rect x="2" y="3" width="8" height="6" rx="1" fill="#5CE0B8"/></svg>
        </div>
      </div>

      {/* Title */}
      <div style={S.titleBar}>
        <h1 style={S.title}>
          {tab === "round" ? "Golf Wager" : tab === "games" ? "Games" : "Settlement"}
        </h1>
      </div>

      {/* Scroll */}
      <div style={S.scroll} ref={scrollRef}>
        {tab === "round" && <RoundView />}
        {tab === "games" && <GamesView />}
        {tab === "settle" && <SettleView />}
      </div>

      {/* Tab Bar */}
      <div style={S.tabBar}>
        {[
          { id:"round", icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ), label:"Round" },
          { id:"games", icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          ), label:"Games" },
          { id:"settle", icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          ), label:"Settle" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              ...S.tabBtn,
              color: tab === t.id ? "#5CE0B8" : "rgba(255,255,255,0.28)",
            }}>
            {t.icon}
            <span style={{fontSize:10, fontWeight:600, letterSpacing:0.6, marginTop:2}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Sheets */}
      {sheet === "score" && <ScoreSheet />}
      {sheet === "game" && <GameSheet />}
      {sheet === "addPlayer" && <AddPlayerSheet />}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const S = {
  app: {
    width:"100%", maxWidth:430, margin:"0 auto", height:"100vh",
    background:"linear-gradient(175deg, #0B1A14 0%, #0D1E1A 35%, #081510 100%)",
    display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    fontFamily:"'DM Sans', -apple-system, sans-serif", color:"#fff",
  },
  status: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"10px 24px 0", flexShrink:0,
  },
  statusTime: { fontSize:15, fontWeight:700 },
  statusIcons: { display:"flex", gap:6, alignItems:"center" },
  titleBar: { padding:"6px 20px 10px", flexShrink:0 },
  title: {
    fontFamily:"'DM Serif Display', serif", fontSize:30, fontWeight:400,
    color:"#fff", letterSpacing:-0.3,
  },
  scroll: {
    flex:1, overflowY:"auto", overflowX:"hidden",
    WebkitOverflowScrolling:"touch", paddingBottom:110,
  },
  content: { padding:"0 16px" },

  // Tab Bar
  tabBar: {
    position:"absolute", bottom:0, left:0, right:0,
    display:"flex", justifyContent:"space-around", alignItems:"center",
    padding:"6px 0 30px",
    background:"linear-gradient(180deg, transparent 0%, rgba(11,26,20,0.96) 25%, #0B1A14 100%)",
    backdropFilter:"blur(24px)", zIndex:20,
  },
  tabBtn: {
    display:"flex", flexDirection:"column", alignItems:"center", gap:1,
    background:"none", border:"none", cursor:"pointer", padding:"6px 20px",
    transition:"color 0.2s",
  },

  // Hero
  hero: {
    background:"linear-gradient(145deg, rgba(92,224,184,0.04) 0%, rgba(255,255,255,0.02) 100%)",
    borderRadius:20, padding:18, marginBottom:20,
    border:"1px solid rgba(92,224,184,0.08)",
  },
  heroRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 },
  heroEyebrow: {
    fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)",
    textTransform:"uppercase", letterSpacing:1.5,
  },
  heroThru: { fontFamily:"'DM Serif Display', serif", fontSize:24, color:"#fff", marginTop:4 },
  holeBadge: {
    display:"flex", flexDirection:"column", alignItems:"center",
    background:"rgba(92,224,184,0.06)", borderRadius:14, padding:"8px 18px",
    border:"1px solid rgba(92,224,184,0.12)",
  },
  holeBadgeLabel: { fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5 },
  holeBadgeNum: { fontFamily:"'DM Mono', monospace", fontSize:28, fontWeight:500, color:"#fff" },
  holeBadgePar: { fontSize:10, color:"rgba(255,255,255,0.3)" },

  // Leaderboard
  lb: { display:"flex", flexDirection:"column", gap:6 },
  lbRow: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"10px 12px", borderRadius:12, background:"rgba(255,255,255,0.02)",
  },
  lbLeft: { display:"flex", alignItems:"center", gap:8 },
  lbRank: { fontFamily:"'DM Mono', monospace", fontSize:15, fontWeight:700, width:18, textAlign:"center" },
  dot: { width:8, height:8, borderRadius:"50%", flexShrink:0 },
  dotSm: { width:6, height:6, borderRadius:"50%" },
  lbName: { fontSize:15, fontWeight:600 },
  lbHcp: {
    fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.25)",
    background:"rgba(255,255,255,0.04)", padding:"2px 5px", borderRadius:4,
  },
  lbRight: { display:"flex", alignItems:"baseline", gap:6 },
  lbPar: { fontFamily:"'DM Mono', monospace", fontSize:15, fontWeight:700 },
  lbTotal: { fontFamily:"'DM Mono', monospace", fontSize:12, color:"rgba(255,255,255,0.3)" },

  addPlayerBtn: {
    width:"100%", padding:10, marginTop:10,
    background:"transparent", border:"1.5px dashed rgba(255,255,255,0.1)",
    borderRadius:12, color:"rgba(255,255,255,0.3)", fontSize:12, fontWeight:600,
    cursor:"pointer",
  },

  // Sections
  sec: { marginBottom:22 },
  secTitle: {
    fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.3)",
    textTransform:"uppercase", letterSpacing:1.5, marginBottom:10,
  },
  pageTitle: { fontFamily:"'DM Serif Display', serif", fontSize:28, color:"#fff", marginBottom:4 },
  pageSub: { fontSize:13, color:"rgba(255,255,255,0.35)", marginBottom:16 },

  // Wager chips
  wagerRow: { display:"flex", gap:8, overflowX:"auto", paddingBottom:4 },
  wagerChip: {
    flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"center", gap:3,
    padding:"12px 18px", borderRadius:14,
    background:"rgba(92,224,184,0.05)", border:"1px solid rgba(92,224,184,0.1)",
    cursor:"pointer", minWidth:90, color:"#fff",
  },
  wagerChipName: { fontSize:12, fontWeight:700 },
  wagerChipStake: { fontSize:10, color:"#5CE0B8", fontWeight:600 },

  // Scorecard
  card: {
    borderRadius:16, overflow:"hidden",
    background:"rgba(255,255,255,0.015)", border:"1px solid rgba(255,255,255,0.05)",
  },
  scHead: {
    display:"flex", padding:"8px 10px",
    background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.05)",
  },
  scRow: {
    display:"flex", padding:"7px 10px",
    borderBottom:"1px solid rgba(255,255,255,0.025)", cursor:"pointer",
    transition:"background 0.15s",
  },
  scTotalRow: {
    display:"flex", padding:"9px 10px", background:"rgba(255,255,255,0.025)",
  },
  scHole: { width:38, fontSize:12, color:"rgba(255,255,255,0.45)", fontWeight:600, flexShrink:0, display:"flex", alignItems:"center" },
  scPar: { width:32, fontSize:12, color:"rgba(255,255,255,0.25)", fontWeight:500, flexShrink:0, display:"flex", alignItems:"center" },
  scPCol: { flex:1, display:"flex", justifyContent:"center", alignItems:"center" },
  scBadge: {
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    width:24, height:24, borderRadius:7, fontSize:11, fontWeight:700, color:"#0B1A14",
  },
  scDash: { fontSize:12, color:"rgba(255,255,255,0.1)" },
  scTotalNum: { fontFamily:"'DM Mono', monospace", fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.6)" },

  // Hole Nav
  holeNav: {
    display:"flex", gap:10, alignItems:"center", justifyContent:"center", margin:"10px 0 20px",
  },
  navBtn: {
    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)",
    borderRadius:10, color:"rgba(255,255,255,0.4)", padding:"10px 16px",
    fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
  },
  enterBtn: {
    background:"#5CE0B8", border:"none", borderRadius:12, color:"#0B1A14",
    padding:"12px 28px", fontSize:15, fontWeight:700, cursor:"pointer",
    fontFamily:"'DM Sans', sans-serif", letterSpacing:-0.3,
    boxShadow:"0 4px 20px rgba(92,224,184,0.25)",
  },

  // Filters
  filters: { display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" },
  filterBtn: {
    padding:"7px 14px", borderRadius:20, border:"none",
    fontSize:12, fontWeight:600, cursor:"pointer",
    fontFamily:"'DM Sans', sans-serif", transition:"all 0.2s",
  },

  // Games
  gamesList: { display:"flex", flexDirection:"column", gap:10 },
  gameCard: {
    borderRadius:16, padding:16, background:"rgba(255,255,255,0.02)",
    cursor:"pointer", transition:"all 0.2s",
  },
  gameCardTop: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 },
  onBadge: {
    fontSize:9, fontWeight:700, color:"#5CE0B8",
    background:"rgba(92,224,184,0.1)", padding:"3px 7px", borderRadius:6,
    textTransform:"uppercase", letterSpacing:0.8,
  },
  gameCardName: { fontSize:17, fontWeight:700, color:"#fff", marginBottom:3 },
  gameCardDesc: { fontSize:12, color:"rgba(255,255,255,0.38)", lineHeight:1.5, marginBottom:10 },
  gameCardBot: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  catPill: {
    fontSize:9, fontWeight:600, color:"rgba(255,255,255,0.25)",
    background:"rgba(255,255,255,0.04)", padding:"3px 7px", borderRadius:5,
    textTransform:"uppercase", letterSpacing:0.8,
  },
  gameStakeTag: { fontSize:11, fontWeight:600, color:"#5CE0B8" },

  // Settlement
  balGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 },
  balCard: {
    padding:"14px 16px", borderRadius:14,
    background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.05)",
    display:"flex", flexDirection:"column", gap:4,
  },
  balTop: { display:"flex", alignItems:"center", gap:6 },
  balName: { fontSize:13, fontWeight:600 },
  balAmt: { fontFamily:"'DM Mono', monospace", fontSize:22, fontWeight:700 },
  balLabel: { fontSize:10, color:"rgba(255,255,255,0.25)", fontWeight:500 },

  settleList: { display:"flex", flexDirection:"column", gap:6 },
  settleLine: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.02)",
  },
  settleGame: { fontSize:13, fontWeight:700, color:"#fff" },
  settleFlow: { fontSize:10, color:"rgba(255,255,255,0.28)", marginTop:2 },
  settleAmt: { fontFamily:"'DM Mono', monospace", fontSize:16, fontWeight:700, color:"#5CE0B8" },
  empty: {
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"40px 0", borderRadius:16, background:"rgba(255,255,255,0.015)",
  },

  skinsGrid: { display:"flex", flexDirection:"column", gap:4 },
  skinRow: {
    display:"flex", alignItems:"center", gap:10, padding:"7px 10px",
    borderRadius:8, background:"rgba(255,255,255,0.015)",
  },
  skinHole: { fontFamily:"'DM Mono', monospace", fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", width:26 },
  skinWinner: { fontSize:12, fontWeight:600, flex:1 },
  skinVal: { fontFamily:"'DM Mono', monospace", fontSize:12, fontWeight:700 },

  // Sheets
  overlay: {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
    backdropFilter:"blur(8px)", zIndex:50,
    display:"flex", alignItems:"flex-end", justifyContent:"center",
    animation:"fadeIn 0.2s ease",
  },
  sheet: {
    width:"100%", maxWidth:430, maxHeight:"85vh", overflowY:"auto",
    background:"linear-gradient(180deg, #132A20 0%, #0E1F17 100%)",
    borderRadius:"24px 24px 0 0", padding:"12px 20px 32px",
    animation:"slideUp 0.3s cubic-bezier(0.32,0.72,0,1)",
  },
  handle: {
    width:36, height:4, borderRadius:2, background:"rgba(255,255,255,0.15)",
    margin:"0 auto 16px",
  },
  sheetHead: {
    display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20,
  },
  sheetHoleNum: { fontFamily:"'DM Serif Display', serif", fontSize:24, color:"#fff" },
  sheetParLabel: { fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:2 },
  holeNavMini: { display:"flex", gap:6 },
  miniNav: {
    width:36, height:36, borderRadius:10,
    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
    color:"rgba(255,255,255,0.5)", fontSize:18, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    fontFamily:"'DM Sans', sans-serif",
  },
  scoreRow: { marginBottom:18 },
  scoreRowLeft: { display:"flex", alignItems:"center", gap:8, marginBottom:8 },
  scoreRowName: { fontSize:14, fontWeight:600 },
  relBadge: { fontSize:10, fontWeight:700, marginLeft:4 },
  scorePills: { display:"flex", gap:6, flexWrap:"wrap" },
  pill: {
    width:36, height:36, borderRadius:10, fontSize:14,
    display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"pointer", transition:"all 0.15s",
    fontFamily:"'DM Mono', monospace",
  },
  doneBtn: {
    width:"100%", padding:14, marginTop:16,
    background:"#5CE0B8", border:"none", borderRadius:14,
    color:"#0B1A14", fontSize:16, fontWeight:700, cursor:"pointer",
    fontFamily:"'DM Sans', sans-serif",
    boxShadow:"0 4px 20px rgba(92,224,184,0.2)",
  },
  gameSheetName: { fontFamily:"'DM Serif Display', serif", fontSize:22, color:"#fff", marginBottom:8 },
  gameRules: { fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.65 },
  stakeLabel: { fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:1.5 },
  stakeChip: {
    padding:"8px 14px", borderRadius:10, border:"1.5px solid rgba(255,255,255,0.06)",
    fontSize:13, fontWeight:500, cursor:"pointer",
    fontFamily:"'DM Mono', monospace", transition:"all 0.15s",
  },
  fieldGroup: { marginBottom:14 },
  fieldLabel: { fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 },
  input: {
    width:"100%", padding:"12px 14px", borderRadius:12,
    background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.08)",
    color:"#fff", fontSize:15, fontFamily:"'DM Sans', sans-serif",
    outline:"none",
  },
};
