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
    inpMax.oninput = () => { tierRows[i].maxOv = +inpMax.value || 1;
      checkFeasibility(); };
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
    inpCnt.oninput = () => { tierRows[i].count = +inpCnt.value || 1;
      checkFeasibility(); };
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
      del.onclick = () => { tierRows.splice(i, 1);
        renderTiers();
        checkFeasibility(); };
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
    else { covered += +t.count || 0;
      maxPoss += (+t.count || 0) * lim; }
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
  [s.batNames, s.bowlNames] = [s.bowlNames, s.batNames];
  
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
  let msg = '';
  if (m.innings === 2 && G.inn1) {
    if (m.runs > G.inn1.runs) msg = `🏆 ${s.teamA} wins by ${(s.players-1)-m.wickets} wickets!`;
    else if (m.runs === G.inn1.runs) msg = `🤝 Match Tied!`;
    else msg = `🏆 ${s.teamB} wins by ${G.inn1.runs-m.runs} runs!`;
  } else {
    msg = `1st Innings complete: ${s.teamA} — ${m.runs}/${m.wickets}`;
  }
  clearState();
  setTimeout(() => alert(msg), 300);
}

// ═══════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════

function renderAll() { renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlFigs(); }

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
