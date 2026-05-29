// ═══════════════════════════════════════════════
//  CRICKET SCORE — app.js  (bug-fixed clean build)
//  Fix 1: Toss modal — choose who bats after setup
//  Fix 2: Undo on over's last ball — proper state restore
// ═══════════════════════════════════════════════

// ── PERSIST ──────────────────────────────────
const SAVE_KEY = 'cs_v5';
const TTL = 864e5; // 24h

function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ts: Date.now(), d: JSON.stringify(G) })); } catch (e) {}
}

function loadState() {
  try {
    const r = localStorage.getItem(SAVE_KEY);
    if (!r) return null;
    const p = JSON.parse(r);
    if (Date.now() - p.ts > TTL) { localStorage.removeItem(SAVE_KEY); return null; }
    return JSON.parse(p.d);
  } catch (e) { return null; }
}

function clearState() { localStorage.removeItem(SAVE_KEY); }

// ── GLOBAL ───────────────────────────────────
let G = {
  screen: 'setup',
  // FIX 1: setup now stores "team1" and "team2" with names only — no bat/bowl distinction
  setup: { team1: '', team2: '', overs: 20, players: 11, team1Names: [], team2Names: [], tiers: [], batFirst: '' },
  match: null,
  inn1: null,
};
let tierRows = [];
let pickedDis = null;
let pickedBowler = null;

// ── HELPERS ──────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

function showScreen(s) {
  $('setup-screen').classList.toggle('active', s === 'setup');
  $('scoring-screen').classList.toggle('active', s === 'scoring');
  G.screen = s;
}

function closeModal(id) { $(id).style.display = 'none'; }

function openModal(id) { $(id).style.display = 'flex'; }

function teamCode(name) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.map(w => w[0].toUpperCase()).join('');
  } else {
    const w = words[0];
    const mid = Math.floor(w.length / 2);
    return (w[0] + w[mid]).toUpperCase();
  }
}

// ═══════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════

function initSetup() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  buildPlayerGrids(pl);
  if (tierRows.length === 0) buildDefaultTier(ov, pl);
  renderTiers();
  updateLimitInfo();
}

function onMatchChange() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  buildPlayerGrids(pl);
  buildDefaultTier(ov, pl);
  renderTiers();
  updateLimitInfo();
}

// FIX 1: Player grids now just "Team 1" and "Team 2" — no batting/bowling label
function buildPlayerGrids(count) {
  ['batGrid', 'bowlGrid'].forEach((id, side) => {
    const grid = $(id);
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `pn_${side}_${i}`;
      inp.placeholder = `Player ${i+1}`;
      inp.maxLength = 18;
      inp.value = side === 0 ? (G.setup.team1Names[i] || '') : (G.setup.team2Names[i] || '');
      grid.appendChild(inp);
    }
  });
}

function buildDefaultTier(ov, pl) {
  const defMax = Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2));
  tierRows = [{ maxOv: defMax, count: 'rest', isRest: true }];
}

function updateLimitInfo() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  const nat = Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2));
  $('limitInfo').innerHTML =
    `<strong>${ov} overs</strong> · Natural max ≈ <strong>${nat} overs</strong> per bowler<br>
    Define limits below. Highest tier first → lower for remaining bowlers.<br>
    <em>Any player can bowl. Limit only blocks when quota is full.</em>`;
}

// ── TIER RENDER ──
function renderTiers() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  const list = $('tierList');
  list.innerHTML = '';
  
  tierRows.forEach((t, i) => {
    const row = el('div', 'tier-row');
    const idx = el('div', 'tier-idx', `Tier ${i+1}`);
    row.appendChild(idx);
    
    const fields = el('div', 'tier-fields');
    
    const fMax = el('div', 'tf');
    fMax.innerHTML = `<label>Max Overs</label>`;
    const inpMax = document.createElement('input');
    inpMax.type = 'number';
    inpMax.min = 1;
    inpMax.max = ov;
    inpMax.value = t.maxOv;
    inpMax.id = `tmx_${i}`;
    inpMax.oninput = () => {
      tierRows[i].maxOv = +inpMax.value || 1;
      checkFeasibility();
    };
    fMax.appendChild(inpMax);
    fields.appendChild(fMax);
    
    const fCnt = el('div', 'tf');
    fCnt.innerHTML = `<label>Bowlers</label>`;
    const inpCnt = document.createElement('input');
    inpCnt.type = 'number';
    inpCnt.min = 1;
    inpCnt.max = pl;
    inpCnt.value = t.isRest ? '' : t.count;
    inpCnt.placeholder = t.isRest ? 'rest' : '';
    inpCnt.disabled = t.isRest;
    inpCnt.id = `tcnt_${i}`;
    inpCnt.oninput = () => {
      tierRows[i].count = +inpCnt.value || 1;
      checkFeasibility();
    };
    fCnt.appendChild(inpCnt);
    fields.appendChild(fCnt);
    
    const rw = el('div', 'rest-wrap');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `trest_${i}`;
    cb.checked = t.isRest;
    cb.onchange = () => toggleRest(i, cb.checked);
    const lbl = document.createElement('label');
    lbl.htmlFor = `trest_${i}`;
    lbl.textContent = 'Rest of bowlers';
    rw.appendChild(cb);
    rw.appendChild(lbl);
    fields.appendChild(rw);
    
    row.appendChild(fields);
    
    if (tierRows.length > 1) {
      const del = el('button', 'tier-del', '✕');
      del.onclick = () => {
        tierRows.splice(i, 1);
        renderTiers();
        checkFeasibility();
      };
      row.appendChild(del);
    }
    
    list.appendChild(row);
  });
  
  checkFeasibility();
}

function toggleRest(i, isRest) {
  tierRows[i].isRest = isRest;
  tierRows[i].count = isRest ? 'rest' : 2;
  if (isRest) tierRows = tierRows.slice(0, i + 1);
  renderTiers();
  checkFeasibility();
}

function addTier() {
  if (tierRows[tierRows.length - 1]?.isRest) {
    tierRows[tierRows.length - 1].isRest = false;
    tierRows[tierRows.length - 1].count = 2;
  }
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  const defMax = Math.max(Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2)) - 1, 1);
  tierRows.push({ maxOv: defMax, count: 'rest', isRest: true });
  renderTiers();
  checkFeasibility();
}

function checkFeasibility() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  const el = $('feasibility');
  let covered = 0,
    maxPoss = 0,
    lines = [];
  
  tierRows.forEach((t, i) => {
    const lim = +t.maxOv || 0;
    if (t.isRest) {
      const rc = Math.max(pl - covered, 0);
      maxPoss += rc * lim;
      lines.push(`Tier ${i+1}: max ${lim} ov × ${rc} bowlers (rest) = ${rc*lim} ov`);
    } else {
      const c = +t.count || 0;
      covered += c;
      maxPoss += c * lim;
      lines.push(`Tier ${i+1}: max ${lim} ov × ${c} bowlers = ${c*lim} ov`);
    }
  });
  
  if (maxPoss >= ov) {
    el.className = 'feasibility ok';
    el.textContent = lines.join('\n') + `\n✓ Max possible: ${maxPoss} ov — OK`;
  } else {
    el.className = 'feasibility err';
    el.textContent = lines.join('\n') + `\n✗ Max possible: ${maxPoss} ov < ${ov} needed! Increase limits.`;
  }
}

function maxOvForRank(rank) {
  const tiers = G.setup.tiers;
  let covered = 0;
  for (const t of tiers) {
    if (t.isRest) return t.maxOv;
    if (rank < covered + t.count) return t.maxOv;
    covered += t.count;
  }
  return tiers.length ? tiers[tiers.length - 1].maxOv : 4;
}

// ═══════════════════════════════════════════════
//  START MATCH — FIX 1: Show toss modal first
// ═══════════════════════════════════════════════

function startMatch() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  
  const team1 = $('teamA').value.trim() || 'Team A';
  const team2 = $('teamB').value.trim() || 'Team B';
  const t1code = teamCode(team1);
  const t2code = teamCode(team2);
  
  const team1Names = [],
    team2Names = [];
  for (let i = 0; i < pl; i++) {
    team1Names.push($(`pn_0_${i}`)?.value.trim() || `Player ${i+1} ${t1code}`);
    team2Names.push($(`pn_1_${i}`)?.value.trim() || `Player ${i+1} ${t2code}`);
  }
  
  // feasibility check
  let covered = 0,
    maxPoss = 0;
  tierRows.forEach(t => {
    const lim = +t.maxOv || 0;
    if (t.isRest) maxPoss += Math.max(pl - covered, 0) * lim;
    else {
      covered += +t.count || 0;
      maxPoss += (+t.count || 0) * lim;
    }
  });
  if (maxPoss < ov) { alert(`Over limits too low! Max possible: ${maxPoss} ov, need ${ov}.`); return; }
  
  G.setup = { team1, team2, overs: ov, players: pl, team1Names, team2Names, tiers: tierRows.map(t => ({ ...t })), batFirst: '' };
  G.inn1 = null;
  
  // FIX 1: Show toss modal before starting
  showTossModal();
}

// ── TOSS MODAL ──
function showTossModal() {
  const s = G.setup;
  const modal = $('tossModal');
  
  // Build toss options
  $('tossInfo').innerHTML = `
    <p style="margin-bottom:12px;color:var(--txt2)">Who won the toss and elected to <strong>bat first</strong>?</p>
    <div class="toss-btns">
      <button class="toss-pick" id="tossPick1" onclick="pickToss('${s.team1}')">${s.team1}</button>
      <button class="toss-pick" id="tossPick2" onclick="pickToss('${s.team2}')">${s.team2}</button>
    </div>
  `;
  openModal('tossModal');
}

function pickToss(teamName) {
  // Highlight selection
  document.querySelectorAll('.toss-pick').forEach(b => b.classList.remove('sel'));
  const s = G.setup;
  if (teamName === s.team1) $('tossPick1').classList.add('sel');
  else $('tossPick2').classList.add('sel');
  G.setup.batFirst = teamName;
}

function confirmToss() {
  if (!G.setup.batFirst) { alert('Please select who bats first'); return; }
  closeModal('tossModal');
  
  const s = G.setup;
  // Assign bat/bowl names based on toss result
  // batNames = players of batting team, bowlNames = players of bowling team
  if (s.batFirst === s.team1) {
    s.batNames = s.team1Names;
    s.bowlNames = s.team2Names;
    s.teamA = s.team1;
    s.teamB = s.team2;
  } else {
    s.batNames = s.team2Names;
    s.bowlNames = s.team1Names;
    s.teamA = s.team2;
    s.teamB = s.team1;
  }
  
  initMatch(1);
  showScreen('scoring');
  saveState();
  setTimeout(() => openBowlerModal(), 200);
}

// ═══════════════════════════════════════════════
//  MATCH INIT
// ═══════════════════════════════════════════════

function initMatch(innings) {
  const s = G.setup;
  const batNames = innings === 1 ? s.batNames : s.bowlNames;
  const bowlNames = innings === 1 ? s.bowlNames : s.batNames;
  const battingTeam = innings === 1 ? s.teamA : s.teamB;
  
  G.match = {
    innings,
    battingTeam,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    curOver: [],
    doneOvers: [],
    striker: 0,
    nonStriker: 1,
    nextBat: 2,
    bat: batNames.map((name, i) => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, howOut: '', notYet: i >= 2 })),
    bowlNames,
    bowlOrder: [],
    bowlMap: {},
    curBowler: null,
    prevBowler: null,
    needBowler: true,
    history: [],
    done: false,
  };
  
  G.match.bat[0].notYet = false;
  G.match.bat[1].notYet = false;
  
  renderHeader();
  renderAll();
}

// ═══════════════════════════════════════════════
//  BALL
// ═══════════════════════════════════════════════

function ball(runs, extra) {
  const m = G.match;
  if (!m || m.done || m.needBowler) return;
  
  const isLegal = extra !== 'wide' && extra !== 'noball';
  saveSnap();
  
  m.runs += runs;
  if (extra) m.extras[extra] = (m.extras[extra] || 0) + 1;
  
  if (!extra || extra === 'noball') {
    m.bat[m.striker].runs += runs;
    m.bat[m.striker].fours += runs === 4 ? 1 : 0;
    m.bat[m.striker].sixes += runs === 6 ? 1 : 0;
  }
  if (isLegal) m.bat[m.striker].balls++;
  
  addBowlerBall(runs, isLegal, extra);
  
  if (isLegal) m.balls++;
  
  if (isLegal && runs % 2 === 1) swapBat();
  
  m.curOver.push({ runs, extra, isLegal, isW: false });
  
  flash(runs >= 4 ? 'g' : (extra ? 'r' : ''));
  
  if (isLegal) checkOverDone();
  checkInningsDone();
  renderAll();
  saveState();
}

function wicketBall(outIdx, howOut, newBatIdx) {
  const m = G.match;
  saveSnap();
  
  m.bat[outIdx].out = true;
  m.bat[outIdx].howOut = howOut;
  m.bat[outIdx].balls++;
  m.wickets++;
  
  if (howOut !== 'Run Out' && m.curBowler)
    m.bowlMap[m.curBowler].wickets++;
  
  addBowlerBall(0, true, null);
  m.balls++;
  
  m.curOver.push({ runs: 0, extra: null, isLegal: true, isW: true });
  
  if (newBatIdx !== null) {
    m.bat[newBatIdx].notYet = false;
    if (m.striker === outIdx) m.striker = newBatIdx;
    else m.nonStriker = newBatIdx;
  }
  
  flash('r');
  checkOverDone();
  checkInningsDone();
  renderAll();
  saveState();
}

function addBowlerBall(runs, isLegal, extra) {
  const m = G.match;
  if (!m.curBowler) return;
  const b = m.bowlMap[m.curBowler];
  b.runs += runs;
  if (isLegal) b.balls++;
  if (extra === 'wide') b.wides = (b.wides || 0) + 1;
  if (extra === 'noball') b.noballs = (b.noballs || 0) + 1;
}

function swapBat() {
  const m = G.match,
    t = m.striker;
  m.striker = m.nonStriker;
  m.nonStriker = t;
}

function checkOverDone() {
  const m = G.match;
  if (m.balls > 0 && m.balls % 6 === 0) {
    m.doneOvers.push([...m.curOver]);
    m.curOver = [];
    m.prevBowler = m.curBowler;
    m.curBowler = null;
    m.needBowler = true;
    swapBat();
    if (!m.done) setTimeout(() => openBowlerModal(), 250);
  }
}

function checkInningsDone() {
  const m = G.match,
    s = G.setup;
  const allOut = m.wickets >= s.players - 1;
  const oversDone = m.balls >= s.overs * 6;
  if ((allOut || oversDone) && !m.done) {
    m.done = true;
    if (m.innings === 1) {
      G.inn1 = { runs: m.runs, wickets: m.wickets, balls: m.balls };
      $('inn2Btn').style.display = 'inline-block';
      setTimeout(() => showInn2Modal(), 600);
    } else {
      setTimeout(() => showResult(), 600);
    }
  }
  if (m.innings === 2 && G.inn1 && m.runs > G.inn1.runs && !m.done) {
    m.done = true;
    setTimeout(() => showResult(), 400);
  }
}

// ═══════════════════════════════════════════════
//  UNDO — FIX 2: Close bowler modal if open, restore doneOvers properly
// ═══════════════════════════════════════════════

function saveSnap() {
  const snap = JSON.stringify({
    runs: G.match.runs,
    wickets: G.match.wickets,
    balls: G.match.balls,
    extras: { ...G.match.extras },
    curOver: [...G.match.curOver.map(b => ({ ...b }))],
    // FIX 2: Save full doneOvers array (deep copy), not just length
    doneOvers: G.match.doneOvers.map(ov => ov.map(b => ({ ...b }))),
    striker: G.match.striker,
    nonStriker: G.match.nonStriker,
    nextBat: G.match.nextBat,
    bat: G.match.bat.map(b => ({ ...b })),
    bowlOrder: [...G.match.bowlOrder],
    bowlMap: JSON.parse(JSON.stringify(G.match.bowlMap)),
    curBowler: G.match.curBowler,
    prevBowler: G.match.prevBowler,
    needBowler: G.match.needBowler,
    done: G.match.done,
  });
  G.match.history.push(snap);
  if (G.match.history.length > 50) G.match.history.shift();
}

function undoLast() {
  if (!G.match || !G.match.history.length) return;
  
  // FIX 2: Close bowler modal if it's currently open (happens when undo after last ball of over)
  const bowlerModalVisible = $('bowlerModal').style.display !== 'none';
  if (bowlerModalVisible) {
    closeModal('bowlerModal');
  }
  
  const snap = JSON.parse(G.match.history.pop());
  const hist = G.match.history;
  Object.assign(G.match, snap);
  // FIX 2: Restore doneOvers as proper array (was saving length before, now saving full array)
  G.match.doneOvers = snap.doneOvers || [];
  G.match.history = hist;
  
  // FIX 2: If after undo the state no longer needs a bowler, make sure modal stays closed
  // If it still needs a bowler (e.g. undo brought us back to start of over), that's fine — 
  // user can manually proceed or we re-prompt after a short delay
  if (G.match.needBowler && !G.match.done && !bowlerModalVisible) {
    // Only re-open if we weren't already in bowler-selection mode before undo
    setTimeout(() => openBowlerModal(), 250);
  }
  
  renderAll();
  saveState();
}

function resultUndo() {
  if (!G.match || !G.match.history.length) return;
  
  G.match.resultLocked = false;
  G.match.done = false;
  
  function downloadSummary() {
    const m = G.match,
      s = G.setup,
      i1 = G.inn1FullData;
    const { winnerMsg } = G.resultData;
    const inn1Team = i1 ? (s.batFirst === s.team1 ? s.team1 : s.team2) : s.teamA;
    const inn2Team = i1 ? (s.batFirst === s.team1 ? s.team2 : s.team1) : s.teamA;
    
    const W = 800,
      PAD = 32;
    let rows = [];
    
    // ── ডেটা কালেক্ট ──
    function collectBat(batArr, label) {
      rows.push({ type: 'inn', text: label });
      rows.push({ type: 'hd', cols: ['Batter', '', 'R', 'B', '4s', '6s', 'SR'] });
      batArr.filter(b => !b.notYet || b.out).forEach(b => {
        const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '-';
        rows.push({ type: 'bat', cols: [b.name, b.out ? b.howOut : 'not out', b.runs, b.balls, b.fours, b.sixes, sr] });
      });
    }
    
    function collectBowl(bowlMap, bowlOrder) {
      rows.push({ type: 'hd2', cols: ['Bowler', 'Overs', 'R', 'W', 'Wd', 'NB', 'Eco'] });
      bowlOrder.forEach(name => {
        const b = bowlMap[name];
        if (!b) return;
        const ov = Math.floor(b.balls / 6),
          rb = b.balls % 6;
        const eco = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '-';
        rows.push({ type: 'bowl', cols: [name, `${ov}.${rb}`, b.runs, b.wickets, b.wides || 0, b.noballs || 0, eco] });
      });
    }
    
    if (i1) {
      const sc1 = `${i1.runs}/${i1.wickets} (${Math.floor(i1.balls/6)}.${i1.balls%6} ov)`;
      collectBat(i1.bat, `${inn1Team}  ${sc1}`);
      collectBowl(i1.bowlMap, i1.bowlOrder);
    }
    const sc2 = `${m.runs}/${m.wickets} (${Math.floor(m.balls/6)}.${m.balls%6} ov)`;
    collectBat(m.bat, `${inn2Team}  ${sc2}`);
    collectBowl(m.bowlMap, m.bowlOrder);
    
    // ── রো হাইট হিসাব ──
    const ROW_H = 26,
      INN_H = 36,
      HD_H = 22;
    let totalH = 120; // hero অংশ
    rows.forEach(r => {
      if (r.type === 'inn') totalH += INN_H + 8;
      else if (r.type === 'hd' || r.type === 'hd2') totalH += HD_H;
      else totalH += ROW_H;
    });
    totalH += 40; // footer
    
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = (totalH + 80) * 2; // 2x for retina
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    const H = totalH + 80;
    
    // ── Background ──
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1117');
    bg.addColorStop(1, '#161b22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    
    // subtle glow top-left
    const glow = ctx.createRadialGradient(100, 60, 0, 100, 60, 280);
    glow.addColorStop(0, 'rgba(21,101,192,0.18)');
    glow.addColorStop(1, 'rgba(21,101,192,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    
    // ── Hero ──
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0b429';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText('🏆', W / 2, 46);
    
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(winnerMsg, W / 2, 78);
    
    ctx.fillStyle = '#8b949e';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`${s.teamA} vs ${s.teamB}  ·  ${s.overs} Overs`, W / 2, 100);
    
    // divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, 114);
    ctx.lineTo(W - PAD, 114);
    ctx.stroke();
    
    // ── Table rows ──
    let y = 124;
    ctx.textAlign = 'left';
    
    const COLS_W = [220, 150, 45, 45, 35, 35, 55]; // col widths
    const COLS_X = [PAD];
    COLS_W.forEach((w, i) => { if (i < COLS_W.length - 1) COLS_X.push(COLS_X[i] + w); });
    
    rows.forEach(r => {
      if (r.type === 'inn') {
        y += 8;
        // pill background
        ctx.fillStyle = 'rgba(21,101,192,0.12)';
        roundRect(ctx, PAD - 8, y - 18, W - PAD * 2 + 16, INN_H, 8);
        ctx.fill();
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(r.text, PAD, y + 4);
        y += INN_H + 4;
      } else if (r.type === 'hd' || r.type === 'hd2') {
        ctx.fillStyle = '#4a5568';
        ctx.font = '600 11px Inter, sans-serif';
        r.cols.forEach((c, i) => {
          ctx.textAlign = i > 1 ? 'right' : 'left';
          const cx = i > 1 ? COLS_X[i] + COLS_W[i] : COLS_X[i];
          ctx.fillText(String(c).toUpperCase(), cx, y + 14);
        });
        ctx.textAlign = 'left';
        y += HD_H;
        // thin divider
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(W - PAD, y);
        ctx.stroke();
      } else {
        // bat or bowl row
        const isEven = false;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(PAD - 8, y, W - PAD * 2 + 16, ROW_H);
        
        r.cols.forEach((c, i) => {
          let color = '#e6edf3';
          if (i === 1) color = '#4a5568'; // dismissal / overs
          if (i === 2) color = '#22c55e'; // runs
          if (i === 3 && r.type === 'bowl') color = '#f87171'; // wickets
          if (i === 4 && r.type === 'bat') color = '#60a5fa'; // 4s
          if (i === 5 && r.type === 'bat') color = '#f0b429'; // 6s
          
          ctx.fillStyle = color;
          const isNum = i > 1;
          ctx.textAlign = isNum ? 'right' : 'left';
          ctx.font = i === 0 ? '500 13px Inter, sans-serif' : '13px Inter, sans-serif';
          const cx = isNum ? COLS_X[i] + COLS_W[i] : COLS_X[i];
          ctx.fillText(String(c), cx, y + 18);
        });
        ctx.textAlign = 'left';
        
        // row divider
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.moveTo(PAD, y + ROW_H);
        ctx.lineTo(W - PAD, y + ROW_H);
        ctx.stroke();
        y += ROW_H;
      }
    });
    
    // ── Footer ──
    y += 16;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = '#4a5568';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cricket Score · Match Summary', W / 2, y + 20);
    
    // ── Download ──
    const link = document.createElement('a');
    link.download = `${s.teamA}_vs_${s.teamB}_summary.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
  
  // helper: rounded rect (canvas এ নেই পুরনো browser এ)
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  const snap = JSON.parse(G.match.history.pop());
  const hist = G.match.history;
  Object.assign(G.match, snap);
  G.match.doneOvers = snap.doneOvers || [];
  G.match.history = hist;
  G.match.done = false;
  
  const rs = document.getElementById('result-screen');
  if (rs) rs.classList.remove('active');
  
  if (G.match.innings === 1) {
    $('inn2Btn').style.display = 'none';
  }
  
  showScreen('scoring');
  renderHeader();
  renderAll();
  saveState();
}

// ═══════════════════════════════════════════════
//  WICKET MODAL
// ═══════════════════════════════════════════════

function showWicketModal() {
  const m = G.match;
  if (!m || m.done || m.needBowler) return;
  pickedDis = null;
  
  const sel = $('wkBat');
  sel.innerHTML = '';
  [m.striker, m.nonStriker].forEach(i => {
    sel.appendChild(new Option(m.bat[i].name, i));
  });
  
  const nsel = $('newBat');
  nsel.innerHTML = '';
  const avail = m.bat.filter(b => b.notYet && !b.out);
  avail.forEach(b => {
    const i = m.bat.indexOf(b);
    nsel.appendChild(new Option(b.name, i));
  });
  $('newBatFld').style.display = avail.length ? 'block' : 'none';
  
  document.querySelectorAll('.db').forEach(b => b.classList.remove('sel'));
  openModal('wkModal');
}

function pickDis(btn, type) {
  pickedDis = type;
  document.querySelectorAll('.db').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

function confirmWicket() {
  if (!pickedDis) { alert('Select dismissal type'); return; }
  const outIdx = +$('wkBat').value;
  const nsel = $('newBat');
  const newBatIdx = nsel.options.length > 0 ? +nsel.value : null;
  closeModal('wkModal');
  wicketBall(outIdx, pickedDis, newBatIdx);
}

// ═══════════════════════════════════════════════
//  BOWLER MODAL
// ═══════════════════════════════════════════════

function openBowlerModal() {
  const m = G.match;
  pickedBowler = null;
  
  const overNum = Math.floor(m.balls / 6) + 1;
  $('bowlerModalTitle').textContent = `Over ${overNum} — Select Bowler`;
  $('bowlerModalInfo').innerHTML =
    `Over ${overNum} of ${G.setup.overs}<br>Previous bowler: <strong>${m.prevBowler||'—'}</strong> (cannot bowl consecutive overs)`;
  
  const list = $('bowlerList');
  list.innerHTML = '';
  
  m.bowlNames.forEach((name, idx) => {
    const b = m.bowlMap[name];
    const bowled = b ? Math.floor(b.balls / 6) : 0;
    const rank = b ? b.rank : m.bowlOrder.length;
    const maxOv = b ? b.maxOv : maxOvForRank(rank);
    const full = b && bowled >= maxOv;
    const consec = name === m.prevBowler;
    const off = full || consec;
    
    const row = el('div', 'bpl' + (off ? ' off' : ''));
    
    let tag = '';
    if (consec) tag = '<span class="bpl-tag">prev over</span>';
    else if (full) tag = '<span class="bpl-tag">quota full</span>';
    
    row.innerHTML = `
      <div class="bpl-l"><span class="bpl-nm">${name}</span>${tag}</div>
      <div class="bpl-q">${bowled}/${maxOv}ov · ${b?b.wickets:0}w ${b?b.runs:0}r</div>`;
    
    if (!off) {
      row.onclick = () => {
        document.querySelectorAll('.bpl').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        pickedBowler = name;
      };
    }
    list.appendChild(row);
  });
  
  openModal('bowlerModal');
}

function confirmBowler() {
  if (!pickedBowler) { alert('Select a bowler'); return; }
  const m = G.match;
  if (!m.bowlMap[pickedBowler]) {
    const rank = m.bowlOrder.length;
    const maxOv = maxOvForRank(rank);
    m.bowlMap[pickedBowler] = { balls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0, rank, maxOv };
    m.bowlOrder.push(pickedBowler);
  }
  m.curBowler = pickedBowler;
  m.needBowler = false;
  closeModal('bowlerModal');
  renderAll();
  saveState();
}

// ═══════════════════════════════════════════════
//  INNINGS 2
// ═══════════════════════════════════════════════

function showInn2Modal() {
  const i1 = G.inn1,
    s = G.setup;
  const ovStr = `${Math.floor(i1.balls/6)}.${i1.balls%6}`;
  $('inn2Info').innerHTML = `
    <p style="margin-bottom:10px"><strong>${s.teamA}</strong> scored <strong>${i1.runs}/${i1.wickets}</strong> in ${ovStr} overs.</p>
    <p><strong>${s.teamB}</strong> needs <strong>${i1.runs+1}</strong> to win.</p>`;
  openModal('inn2Modal');
}

function startInn2() {
  closeModal('inn2Modal');
  const s = G.setup;
  [s.teamA, s.teamB] = [s.teamB, s.teamA];
  // [s.batNames, s.bowlNames] = [s.bowlNames, s.batNames];
  // ১ম ইনিংসের সম্পূর্ণ স্ন্যাপশট সেভ
  G.inn1FullData = JSON.parse(JSON.stringify({
    runs: G.match.runs,
    wickets: G.match.wickets,
    balls: G.match.balls,
    extras: G.match.extras,
    bat: G.match.bat,
    bowlMap: G.match.bowlMap,
    bowlOrder: G.match.bowlOrder,
  }));
  
  initMatch(2);
  $('inn2Btn').style.display = 'none';
  $('tgtBlk').style.display = 'flex';
  $('rrrBlk').style.display = 'flex';
  $('sbTgt').textContent = G.inn1.runs + 1;
  $('innLbl').textContent = '2nd Innings';
  saveState();
  setTimeout(() => openBowlerModal(), 200);
}

function showResult() {
  const m = G.match,
    s = G.setup;
  
  m.resultLocked = true;
  
  let winnerMsg = '';
  let winnerTeam = '';
  if (m.innings === 2 && G.inn1) {
    if (m.runs > G.inn1.runs) {
      const wkLeft = (s.players - 1) - m.wickets;
      winnerMsg = `${s.teamA} wins by ${wkLeft} wicket${wkLeft !== 1 ? 's' : ''}!`;
      winnerTeam = s.teamA;
    } else if (m.runs === G.inn1.runs) {
      winnerMsg = `Match Tied!`;
      winnerTeam = 'Tie';
    } else {
      const margin = G.inn1.runs - m.runs;
      winnerMsg = `${s.teamB} wins by ${margin} run${margin !== 1 ? 's' : ''}!`;
      winnerTeam = s.teamB;
    }
  } else {
    winnerMsg = `1st Innings: ${s.teamA} — ${m.runs}/${m.wickets}`;
    winnerTeam = '';
  }
  
  G.resultData = { winnerMsg, winnerTeam };
  saveState();
  
  showResultScreen();
}

function showResultScreen() {
  const m = G.match,
    s = G.setup,
    i1 = G.inn1;
  const { winnerMsg, winnerTeam } = G.resultData;
  
  let rs = document.getElementById('result-screen');
  if (!rs) {
    rs = document.createElement('div');
    rs.id = 'result-screen';
    rs.className = 'screen';
    document.getElementById('app').appendChild(rs);
  }
  
  const inn1Team = m.innings === 2 ?
    (s.batFirst === s.team1 ? s.team1 : s.team2) :
    s.teamA;
  const inn2Team = m.innings === 2 ?
    (s.batFirst === s.team1 ? s.team2 : s.team1) :
    null;
  
  function buildBatRows(batArr) {
    return batArr.filter(b => !b.notYet || b.out).map(b => {
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
      return `
        <div class="rs-row">
          <span class="rs-nm">${b.name}</span>
          <span class="rs-hw">${b.out ? b.howOut : 'not out'}</span>
          <span class="rs-r">${b.runs}</span>
          <span class="rs-b">(${b.balls})</span>
          <span class="rs-46"><span style="color:#60a5fa">${b.fours}</span>/<span style="color:#f0b429">${b.sixes}</span></span>
          <span class="rs-sr">${sr}</span>
        </div>`;
    }).join('');
  }
  
  function buildBowlRows(bowlMap, bowlOrder) {
    return bowlOrder.map(name => {
      const b = bowlMap[name];
      if (!b) return '';
      const ov = Math.floor(b.balls / 6),
        rb = b.balls % 6;
      const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '0.00';
      return `
        <div class="rs-row">
          <span class="rs-nm">${name}</span>
          <span class="rs-hw">${ov}.${rb} ov</span>
          <span class="rs-r">${b.runs}</span>
          <span class="rs-b">${b.wickets}w</span>
          <span class="rs-46"><span style="color:#f87171">${b.wides||0}wd</span></span>
          <span class="rs-sr">${econ} eco</span>
        </div>`;
    }).join('');
  }
  
  const d1 = G.inn1FullData || null;
  const d2 = m;
  
  const ov1 = d1 ? `${Math.floor(d1.balls/6)}.${d1.balls%6}` : '—';
  const ov2 = `${Math.floor(d2.balls/6)}.${d2.balls%6}`;
  
  let inn1HTML = '',
    inn2HTML = '';
  
  if (d1) {
    inn1HTML = `
      <div class="rs-inn-hd">
        <span>${inn1Team}</span>
        <span class="rs-score">${d1.runs}/${d1.wickets} <small>(${ov1} ov)</small></span>
      </div>
      <div class="rs-tbl-hd">
        <span class="rs-nm">Batter</span><span class="rs-hw">Dismissal</span>
        <span class="rs-r">R</span><span class="rs-b">B</span>
        <span class="rs-46">4/6</span><span class="rs-sr">SR</span>
      </div>
      ${buildBatRows(d1.bat)}
      <div class="rs-extras">Extras: ${d1.extras.wide}wd ${d1.extras.noball}nb ${d1.extras.bye}b ${d1.extras.legbye}lb</div>
      <div class="rs-tbl-hd" style="margin-top:10px">
        <span class="rs-nm">Bowler</span><span class="rs-hw">Overs</span>
        <span class="rs-r">R</span><span class="rs-b">W</span>
        <span class="rs-46">Wd</span><span class="rs-sr">Eco</span>
      </div>
      ${buildBowlRows(d1.bowlMap, d1.bowlOrder)}`;
  }
  
  inn2HTML = `
    <div class="rs-inn-hd" style="margin-top:${d1 ? '20px':'0'}">
      <span>${inn2Team || s.teamA}</span>
      <span class="rs-score">${d2.runs}/${d2.wickets} <small>(${ov2} ov)</small></span>
    </div>
    <div class="rs-tbl-hd">
      <span class="rs-nm">Batter</span><span class="rs-hw">Dismissal</span>
      <span class="rs-r">R</span><span class="rs-b">B</span>
      <span class="rs-46">4/6</span><span class="rs-sr">SR</span>
    </div>
    ${buildBatRows(d2.bat)}
    <div class="rs-extras">Extras: ${d2.extras.wide}wd ${d2.extras.noball}nb ${d2.extras.bye}b ${d2.extras.legbye}lb</div>
    <div class="rs-tbl-hd" style="margin-top:10px">
      <span class="rs-nm">Bowler</span><span class="rs-hw">Overs</span>
      <span class="rs-r">R</span><span class="rs-b">W</span>
      <span class="rs-46">Wd</span><span class="rs-sr">Eco</span>
    </div>
    ${buildBowlRows(d2.bowlMap, d2.bowlOrder)}`;
  
  rs.innerHTML = `
    <div class="rs-wrap" id="rs-capture">
      <div class="rs-glow"></div>

      <div class="rs-hero">
        <div class="rs-trophy">${winnerTeam === 'Tie' ? '🤝' : '🏆'}</div>
        <div class="rs-winner">${winnerMsg}</div>
        <div class="rs-sub">${s.teamA} vs ${s.teamB} · ${s.overs} Overs</div>
      </div>

      ${d1 ? `<div class="rs-score-bar">
        <div class="rs-sb-item">
          <span class="rs-sb-team">${inn1Team}</span>
          <span class="rs-sb-score">${d1.runs}/${d1.wickets}</span>
        </div>
        <div class="rs-sb-vs">VS</div>
        <div class="rs-sb-item">
          <span class="rs-sb-team">${inn2Team}</span>
          <span class="rs-sb-score">${d2.runs}/${d2.wickets}</span>
        </div>
      </div>` : ''}

      <div class="rs-section">
        <div class="rs-sec-ttl">Match Summary</div>
        ${inn1HTML}
        ${inn2HTML}
      </div>
    </div>

    <div class="rs-actions">
      <button class="rs-btn rs-btn-cancel" onclick="resultUndo()">Undo</button>
      <button class="rs-btn rs-btn-dl" onclick="downloadSummary()">Download</button>
      <button class="rs-btn rs-btn-new" onclick="doReset()">Reset</button>
    </div>
  `;
  
  document.querySelectorAll('.screen').forEach(sc => sc.classList.remove('active'));
  rs.classList.add('active');
  G.screen = 'result';
  saveState();
}

// ═══════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════

function renderAll() {
  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlFigs();
}

function renderHeader() {
  const s = G.setup;
  $('hdrTeams').textContent = `${s.teamA} vs ${s.teamB}`;
  $('hdrFmt').textContent = `${s.overs} Ov`;
  $('sbTeam').textContent = G.match.battingTeam;
}

function renderScore() {
  const m = G.match,
    s = G.setup;
  const ov = Math.floor(m.balls / 6),
    bl = m.balls % 6;
  const rr = m.balls > 0 ? ((m.runs / m.balls) * 6).toFixed(2) : '0.00';
  $('sbRuns').textContent = m.runs;
  $('sbWk').textContent = `/${m.wickets}`;
  $('sbOv').textContent = `${ov}.${bl}`;
  $('sbRR').textContent = rr;
  const pct = Math.min((m.balls / (s.overs * 6)) * 100, 100);
  $('progFill').style.width = pct + '%';
  if (m.innings === 2 && G.inn1) {
    const need = G.inn1.runs + 1 - m.runs;
    const left = (s.overs * 6) - m.balls;
    $('sbNeed').textContent = need <= 0 ? '✓ Won' : left > 0 ? `${need} off ${left}b` : '—';
  }
}

function renderBalls() {
  const m = G.match,
    row = $('ballsRow');
  row.innerHTML = '';
  m.curOver.forEach(b => {
    const d = el('div', 'ball ' + ballCls(b));
    d.textContent = ballLbl(b);
    row.appendChild(d);
  });
  const legal = m.curOver.filter(b => b.isLegal).length;
  for (let i = legal; i < 6; i++) {
    const d = el('div', 'ball bgh');
    d.textContent = '·';
    row.appendChild(d);
  }
  const overNum = Math.floor(m.balls / 6) + 1;
  const ballNum = m.balls % 6;
  $('overInfo').textContent = `Over ${overNum} · Ball ${ballNum}/6 · W:${m.extras.wide} NB:${m.extras.noball} B:${m.extras.bye} LB:${m.extras.legbye}`;
  
  if (m.curBowler) {
    const b = m.bowlMap[m.curBowler];
    const bov = Math.floor((b?.balls || 0) / 6),
      bbl = (b?.balls || 0) % 6;
    $('bowlerBadge').textContent = `${m.curBowler} · ${bov}.${bbl}/${b?.maxOv||'?'} ov`;
  } else {
    $('bowlerBadge').textContent = m.needBowler ? 'Select bowler ↑' : '—';
  }
}

function ballCls(b) {
  if (b.isW) return 'bW';
  if (b.extra === 'wide') return 'bw';
  if (b.extra === 'noball') return 'bnb';
  if (b.extra === 'bye' || b.extra === 'legbye') return 'bb';
  if (b.runs === 4) return 'b4';
  if (b.runs === 6) return 'b6';
  if (b.runs === 0) return 'bd';
  return 'br';
}

function ballLbl(b) {
  if (b.isW) return 'W';
  if (b.extra === 'wide') return 'Wd';
  if (b.extra === 'noball') return 'NB';
  if (b.extra === 'bye') return 'B';
  if (b.extra === 'legbye') return 'LB';
  if (b.runs === 0) return '·';
  return b.runs;
}

function renderBatsmen() {
  const m = G.match;
  const s = m.bat[m.striker],
    ns = m.bat[m.nonStriker];
  $('strName').textContent = s?.name || '—';
  $('strR').textContent = s?.runs || 0;
  $('strB').textContent = s?.balls || 0;
  $('str4').textContent = s?.fours || 0;
  $('str6').textContent = s?.sixes || 0;
  const sr = s && s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
  $('strSR').textContent = sr;
  $('nsName').textContent = ns?.name || '—';
  $('nsR').textContent = ns?.runs || 0;
  $('nsB').textContent = ns?.balls || 0;
}

function renderBowlFigs() {
  const m = G.match,
    el2 = $('bowlFigs');
  el2.innerHTML = '';
  m.bowlOrder.forEach(name => {
    const b = m.bowlMap[name];
    if (!b) return;
    const ov = Math.floor(b.balls / 6),
      rb = b.balls % 6;
    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '—';
    const left = b.maxOv - ov;
    const row = el('div', 'bfr');
    row.innerHTML = `
      <div class="bfr-nm ${name===m.curBowler?'cur':''}">${name}</div>
      <div class="bfr-stats">
        <span>${ov}.${rb}ov</span><span>${b.runs}r</span>
        <span>${b.wickets}w</span><span>${econ}eco</span>
      </div>
      <div class="bfr-quota ${left<=0?'done':''}">${left>0?left+' left':'done'}</div>`;
    el2.appendChild(row);
  });
}

function toggleSC() {
  const p = $('scPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  if (p.style.display === 'block') renderScorecard();
}

function renderScorecard() {
  const m = G.match;
  const bp = $('batSC');
  bp.innerHTML = '';
  m.bat.forEach(b => {
    if (b.notYet && !b.out) return;
    const r = el('div', 'scr');
    r.innerHTML = `<span class="scr-nm">${b.name}</span>
      <span class="scr-hw">${b.out?b.howOut:(b.notYet?'dnb':'not out')}</span>
      <span class="scr-r">${b.runs}</span><span class="scr-b">(${b.balls})</span>
      <span class="scr-4">${b.fours}</span><span class="scr-6">${b.sixes}</span>`;
    bp.appendChild(r);
  });
  const bwp = $('bowlSC');
  bwp.innerHTML = '';
  m.bowlOrder.forEach(name => {
    const b = m.bowlMap[name];
    if (!b) return;
    const ov = Math.floor(b.balls / 6),
      rb = b.balls % 6;
    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '—';
    const r = el('div', 'scr');
    r.innerHTML = `<span class="scr-nm">${name}</span>
      <span class="scr-hw">${ov}.${rb}ov · ${b.wides||0}wd ${b.noballs||0}nb</span>
      <span class="scr-r">${b.runs}</span><span class="scr-b">${b.wickets}w</span>
      <span class="scr-4">${econ}</span>`;
    bwp.appendChild(r);
  });
}

function flash(type) {
  const sb = $('scoreboard');
  sb.classList.remove('flash-g', 'flash-r');
  void sb.offsetWidth;
  if (type) sb.classList.add('flash-' + type);
}

// ── RESET ──
function doReset() {
  if (!confirm('Reset match? All data will be cleared.')) return;
  clearState();
  tierRows = [];
  G = { screen: 'setup', setup: { team1: '', team2: '', overs: 20, players: 11, team1Names: [], team2Names: [], tiers: [], batFirst: '' }, match: null, inn1: null };
  $('inn2Btn').style.display = 'none';
  $('tgtBlk').style.display = 'none';
  $('rrrBlk').style.display = 'none';
  $('innLbl').textContent = '1st Innings';
  showScreen('setup');
  initSetup();
  location.reload();
}

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  
  $('totalOvers').addEventListener('input', onMatchChange);
  $('playerCount').addEventListener('input', onMatchChange);
  
  const saved = loadState();
  if (saved) {
    G = saved;
    tierRows = G.setup.tiers ? [...G.setup.tiers] : [];
    
    if (G.screen === 'result' && G.match && G.resultData) {
      showResultScreen();
      return;
    }
    
    if (G.screen === 'scoring' && G.match) {
      showScreen('scoring');
      renderHeader();
      renderAll();
      if (G.match.innings === 2 && G.inn1) {
        $('tgtBlk').style.display = 'flex';
        $('rrrBlk').style.display = 'flex';
        $('sbTgt').textContent = G.inn1.runs + 1;
        $('innLbl').textContent = '2nd Innings';
      }
      if (G.match.needBowler && !G.match.done) openBowlerModal();
      return;
    }
  }
  
  initSetup();
});

function downloadSummary() {
  const m = G.match,
    s = G.setup,
    i1 = G.inn1FullData;
  const { winnerMsg } = G.resultData;
  const inn1Team = i1 ? (s.batFirst === s.team1 ? s.team1 : s.team2) : s.teamA;
  const inn2Team = i1 ? (s.batFirst === s.team1 ? s.team2 : s.team1) : s.teamA;
  
  const W = 800,
    PAD = 32;
  let rows = [];
  
  // ── ডেটা কালেক্ট ──
  function collectBat(batArr, label) {
    rows.push({ type: 'inn', text: label });
    rows.push({ type: 'hd', cols: ['Batter', '', 'R', 'B', '4s', '6s', 'SR'] });
    batArr.filter(b => !b.notYet || b.out).forEach(b => {
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '-';
      rows.push({ type: 'bat', cols: [b.name, b.out ? b.howOut : 'not out', b.runs, b.balls, b.fours, b.sixes, sr] });
    });
  }
  
  function collectBowl(bowlMap, bowlOrder) {
    rows.push({ type: 'gap' });
    rows.push({ type: 'bowl-hd', cols: ['Bowler', 'Overs', 'R', 'W', 'Wd', 'NB', 'Eco'] });
    bowlOrder.forEach(name => {
      const b = bowlMap[name];
      if (!b) return;
      const ov = Math.floor(b.balls / 6),
        rb = b.balls % 6;
      const eco = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '-';
      rows.push({ type: 'bowl', cols: [name, `${ov}.${rb}`, b.runs, b.wickets, b.wides || 0, b.noballs || 0, eco] });
    });
    rows.push({ type: 'gap' });
  }
  
  if (i1) {
    const sc1 = `${i1.runs}/${i1.wickets} (${Math.floor(i1.balls/6)}.${i1.balls%6} ov)`;
    collectBat(i1.bat, `${inn1Team}  ${sc1}`);
    collectBowl(i1.bowlMap, i1.bowlOrder);
  }
  const sc2 = `${m.runs}/${m.wickets} (${Math.floor(m.balls/6)}.${m.balls%6} ov)`;
  collectBat(m.bat, `${inn2Team}  ${sc2}`);
  collectBowl(m.bowlMap, m.bowlOrder);
  
  // ── রো হাইট হিসাব ──
  const ROW_H = 26,
    INN_H = 36,
    HD_H = 22;
  let totalH = 120; // hero অংশ
  // forEach এ
  rows.forEach(r => {
    if (r.type === 'inn') totalH += INN_H + 8;
    else if (r.type === 'hd' || r.type === 'bowl-hd') totalH += HD_H + 4;
    else if (r.type === 'gap') totalH += 14;
    else totalH += ROW_H;
  });
  totalH += 40; // footer
  
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = (totalH + 80) * 2; // 2x for retina
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const H = totalH + 80;
  
  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1117');
  bg.addColorStop(1, '#161b22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  
  // subtle glow top-left
  const glow = ctx.createRadialGradient(100, 60, 0, 100, 60, 280);
  glow.addColorStop(0, 'rgba(21,101,192,0.18)');
  glow.addColorStop(1, 'rgba(21,101,192,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  
  // ── Hero ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0b429';
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillText('🏆', W / 2, 46);
  
  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(winnerMsg, W / 2, 78);
  
  ctx.fillStyle = '#8b949e';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText(`${s.teamA} vs ${s.teamB}  ·  ${s.overs} Overs`, W / 2, 100);
  
  // divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 114);
  ctx.lineTo(W - PAD, 114);
  ctx.stroke();
  
  // ── Table rows ──
  let y = 124;
  ctx.textAlign = 'left';
  
  const COLS_W = [220, 150, 45, 45, 35, 35, 55]; // col widths
  const COLS_X = [PAD];
  COLS_W.forEach((w, i) => { if (i < COLS_W.length - 1) COLS_X.push(COLS_X[i] + w); });
  
  rows.forEach(r => {
    if (r.type === 'inn') {
      y += 8;
      // pill background
      ctx.fillStyle = 'rgba(21,101,192,0.12)';
      roundRect(ctx, PAD - 8, y - 18, W - PAD * 2 + 16, INN_H, 8);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(r.text, PAD, y + 4);
      y += INN_H + 4;
    } else if (r.type === 'hd' || r.type === 'hd2') {
      ctx.fillStyle = '#4a5568';
      ctx.font = '600 11px Inter, sans-serif';
      r.cols.forEach((c, i) => {
        ctx.textAlign = i > 1 ? 'right' : 'left';
        const cx = i > 1 ? COLS_X[i] + COLS_W[i] : COLS_X[i];
        ctx.fillText(String(c).toUpperCase(), cx, y + 14);
      });
      ctx.textAlign = 'left';
      y += HD_H;
      // thin divider
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
    } else if (r.type === 'gap') {
      // optional: একটা faint divider লাইন
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 7);
      ctx.lineTo(W - PAD, y + 7);
      ctx.stroke();
      y += 14;
      
    } else if (r.type === 'bowl-hd') {
      // batting hd এর মতোই, আলাদা color দিতে পারো
      ctx.fillStyle = '#4a5568';
      ctx.font = '600 11px Inter, sans-serif';
      r.cols.forEach((c, i) => {
        ctx.textAlign = i > 1 ? 'right' : 'left';
        const cx = i > 1 ? COLS_X[i] + COLS_W[i] : COLS_X[i];
        ctx.fillText(String(c).toUpperCase(), cx, y + 14);
      });
      ctx.textAlign = 'left';
      // underline
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(PAD, y + HD_H + 2);
      ctx.lineTo(W - PAD, y + HD_H + 2);
      ctx.stroke();
      y += HD_H + 4;
    } else {
      // bat or bowl row
      const isEven = false;
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(PAD - 8, y, W - PAD * 2 + 16, ROW_H);
      
      r.cols.forEach((c, i) => {
        let color = '#e6edf3';
        if (i === 1) color = '#4a5568'; // dismissal / overs
        if (i === 2) color = '#22c55e'; // runs
        if (i === 3 && r.type === 'bowl') color = '#f87171'; // wickets
        if (i === 4 && r.type === 'bat') color = '#60a5fa'; // 4s
        if (i === 5 && r.type === 'bat') color = '#f0b429'; // 6s
        
        ctx.fillStyle = color;
        const isNum = i > 1;
        ctx.textAlign = isNum ? 'right' : 'left';
        ctx.font = i === 0 ? '500 13px Inter, sans-serif' : '13px Inter, sans-serif';
        const cx = isNum ? COLS_X[i] + COLS_W[i] : COLS_X[i];
        ctx.fillText(String(c), cx, y + 18);
      });
      ctx.textAlign = 'left';
      
      // row divider
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(PAD, y + ROW_H);
      ctx.lineTo(W - PAD, y + ROW_H);
      ctx.stroke();
      y += ROW_H;
    }
  });
  
  // ── Footer ──
  y += 16;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = '#4a5568';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Cricket Score · Match Summary', W / 2, y + 20);
  
  // ── Download ──
  const link = document.createElement('a');
  link.download = `${s.teamA}_vs_${s.teamB}_summary.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// helper: rounded rect (canvas এ নেই পুরনো browser এ)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
