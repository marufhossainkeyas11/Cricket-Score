// ═══════════════════════════════════════════════
//  CRICKET SCORE v2.0 — script.js
//  Changes from v1:
//  - Removed dead functions: pickToss, updateNBTotal, maxOvForRank
//  - Removed duplicate ballLbl definition
//  - Fixed toast: class-based instead of dual-class toggle
//  - Modal open/close unified
//  - lastNewBatIdx reset in initMatch
//  - Consistent UX: all modals use same animation class
//  - rs-inn-hd inn1 class instead of nth-child hack
// ═══════════════════════════════════════════════

// ── PERSIST ──────────────────────────────────
const SAVE_KEY = 'cs_v5';
const TTL = 864e5; // 24h

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ts: Date.now(), d: JSON.stringify(G) }));
  } catch (e) {}
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

// ── GLOBAL STATE ─────────────────────────────
let G = {
  screen: 'setup',
  setup: {
    team1: '', team2: '', overs: 20, players: 11,
    team1Names: [], team2Names: [], tiers: [], batFirst: '', byeAllowed: true,
  },
  match: null,
  inn1: null,
};
let tierRows    = [];
let pickedDis   = null;
let pickedBowler = null;

// ── HELPERS ──────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)             e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function showScreen(s) {
  $('setup-screen').classList.toggle('active', s === 'setup');
  $('scoring-screen').classList.toggle('active', s === 'scoring');
  G.screen = s;
}

function closeModal(id) { $(id).style.display = 'none'; }
function openModal(id)  { $(id).style.display = 'flex'; }

function teamCode(name) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return words.map(w => w[0].toUpperCase()).join('');
  const w = words[0];
  return (w[0] + w[Math.floor(w.length / 2)]).toUpperCase();
}

// ═══════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════

function initSetup() {
  if (G.setup.overs)   $('totalOvers').value  = G.setup.overs;
  if (G.setup.players) $('playerCount').value = G.setup.players;
  if (G.setup.team1)   $('teamA').value = G.setup.team1;
  if (G.setup.team2)   $('teamB').value = G.setup.team2;
  if (G.setup.shortCric !== undefined) {
    $('shortCricToggle').checked = G.setup.shortCric;
  }

  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  buildPlayerGrids(pl);
  if (tierRows.length === 0) buildDefaultTier(ov, pl);
  renderTiers();
  updateLimitInfo();
  autoSetLastMan(pl);
  if (G.setup.lastMan !== undefined) {
    $('lastManToggle').checked = G.setup.lastMan;
  }
  bindSmartInput('totalOvers',  1, 499);
  bindSmartInput('playerCount', 1, 22);
}

function onMatchChange() {
  const ov = +$('totalOvers').value || 20;
  const pl = +$('playerCount').value || 11;
  buildPlayerGrids(pl);
  buildDefaultTier(ov, pl);
  renderTiers();
  updateLimitInfo();
  autoSetLastMan(pl);
}

function autoSetLastMan(pl) {
  const toggle = $('lastManToggle');
  //if (!toggle) return;
  if (pl <= 5) {
    toggle.checked = true;
  } else {
    toggle.checked = false;
  }
}

function buildPlayerGrids(count) {
  ['batGrid', 'bowlGrid'].forEach((id, side) => {
    const grid = $(id);
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'player-row';
      
      const num = document.createElement('div');
      num.className = 'player-num';
      num.textContent = String(i + 1).padStart(2, '0');
      
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `pn_${side}_${i}`;
      inp.placeholder = `Player ${i + 1}`;
      inp.maxLength = 18;
      inp.value = side === 0 ? (G.setup.team1Names[i] || '') : (G.setup.team2Names[i] || '');
      inp.className = 'player-inp';
      
      row.appendChild(num);
      row.appendChild(inp);
      grid.appendChild(row);
    }
  });
}

function buildDefaultTier(ov, pl) {
  const defMax = Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2));
  tierRows = [{ maxOv: defMax, count: 'rest', isRest: true }];
}

function updateLimitInfo() {
  const ov  = +$('totalOvers').value  || 20;
  const pl  = +$('playerCount').value || 11;
  const nat = Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2));
  $('limitInfo').innerHTML =
    `<strong>${ov} overs</strong> · Natural max ≈ <strong>${nat} overs</strong> per bowler<br>
     Define limits below. Highest tier first → lower for remaining bowlers.<br>
     <em>Any player can bowl. Limit only blocks when quota is full.</em>`;
}

// ── Tier rendering ───────────────────────────
function renderTiers() {
  const ov   = +$('totalOvers').value  || 20;
  const pl   = +$('playerCount').value || 11;
  const list = $('tierList');
  list.innerHTML = '';

  tierRows.forEach((t, i) => {
    const row  = el('div', 'tier-row');
    const idx  = el('div', 'tier-idx', `Tier ${i + 1}`);
    row.appendChild(idx);

    const fields = el('div', 'tier-fields');

    // Max Overs field
    const fMax = el('div', 'tf');
    fMax.innerHTML = '<label>Max Overs</label>';
    const inpMax = document.createElement('input');
    inpMax.type = 'number'; inpMax.min = 1; inpMax.max = ov;
    inpMax.value = t.maxOv; inpMax.id = `tmx_${i}`;
    inpMax.oninput = () => { tierRows[i].maxOv = +inpMax.value || 1; checkFeasibility(); };
    fMax.appendChild(inpMax);
    fields.appendChild(fMax);

    // Bowlers count field
    const fCnt = el('div', 'tf');
    fCnt.innerHTML = '<label>Bowlers</label>';
    const inpCnt = document.createElement('input');
    inpCnt.type = 'number'; inpCnt.min = 1; inpCnt.max = pl;
    inpCnt.value       = t.isRest ? '' : t.count;
    inpCnt.placeholder = t.isRest ? 'rest' : '';
    inpCnt.disabled    = t.isRest;
    inpCnt.id          = `tcnt_${i}`;
    inpCnt.oninput = () => { tierRows[i].count = +inpCnt.value || 1; checkFeasibility(); };
    fCnt.appendChild(inpCnt);
    fields.appendChild(fCnt);

    // Rest checkbox
    const rw  = el('div', 'rest-wrap');
    const cb  = document.createElement('input');
    cb.type = 'checkbox'; cb.id = `trest_${i}`; cb.checked = t.isRest;
    cb.onchange = () => toggleRest(i, cb.checked);
    const lbl = document.createElement('label');
    lbl.htmlFor = `trest_${i}`; lbl.textContent = 'Rest of bowlers';
    rw.appendChild(cb); rw.appendChild(lbl);
    fields.appendChild(rw);

    row.appendChild(fields);

    if (tierRows.length > 1) {
      const del = el('button', 'tier-del', '✕');
      del.onclick = () => { tierRows.splice(i, 1); renderTiers(); checkFeasibility(); };
      row.appendChild(del);
    }
    list.appendChild(row);
  });
  checkFeasibility();
}

function toggleRest(i, isRest) {
  tierRows[i].isRest = isRest;
  tierRows[i].count  = isRest ? 'rest' : 2;
  if (isRest) tierRows = tierRows.slice(0, i + 1);
  renderTiers();
  checkFeasibility();
}

function addTier() {
  if (tierRows[tierRows.length - 1]?.isRest) {
    tierRows[tierRows.length - 1].isRest = false;
    tierRows[tierRows.length - 1].count  = 2;
  }
  const ov     = +$('totalOvers').value  || 20;
  const pl     = +$('playerCount').value || 11;
  const defMax = Math.max(Math.ceil(ov / Math.max(Math.ceil(pl / 2.2), 2)) - 1, 1);
  tierRows.push({ maxOv: defMax, count: 'rest', isRest: true });
  renderTiers();
  checkFeasibility();
}

function checkFeasibility() {
  const ov  = +$('totalOvers').value  || 20;
  const pl  = +$('playerCount').value || 11;
  const box = $('feasibility');
  let covered = 0, maxPoss = 0, lines = [];

  tierRows.forEach((t, i) => {
    const lim = +t.maxOv || 0;
    if (t.isRest) {
      const rc = Math.max(pl - covered, 0);
      maxPoss += rc * lim;
      lines.push(`Tier ${i + 1}: max ${lim} ov × ${rc} bowlers (rest) = ${rc * lim} ov`);
    } else {
      const c = +t.count || 0;
      covered += c; maxPoss += c * lim;
      lines.push(`Tier ${i + 1}: max ${lim} ov × ${c} bowlers = ${c * lim} ov`);
    }
  });

  if (maxPoss >= ov) {
    box.className   = 'feasibility ok';
    box.textContent = lines.join('\n') + `\n✓ Max possible: ${maxPoss} ov — OK`;
  } else {
    box.className   = 'feasibility err';
    box.textContent = lines.join('\n') + `\n✗ Max possible: ${maxPoss} ov < ${ov} needed! Increase limits.`;
  }
}

// ═══════════════════════════════════════════════
//  EDIT PLAYERS MODAL
// ═══════════════════════════════════════════════

function showEditPlayersModal() {
  const m = G.match;
  const s = G.setup;
  if (!m || m.done) return;
  
  // ── Determine batting & bowling team names ──
  const isBatTeam1 = s.batFirst === s.team1;
  const batTeamLabel = isBatTeam1 ? s.team1 : s.team2;
  const bowlTeamLabel = isBatTeam1 ? s.team2 : s.team1;
  const batNamesList = isBatTeam1 ? s.team1Names : s.team2Names;
  const bowlNamesList = isBatTeam1 ? s.team2Names : s.team1Names;
  
  let html = `
    <div id="editPlayersModal" class="modal-bg" style="display:flex">
      <div class="modal" style="max-width:440px">
        <div class="modal-ttl">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="26" height="26"
               fill="currentColor" style="transform:translateY(4px)">
            <path d="M480-240Zm-320 80v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q37 0 73 4.5t72 14.5l-67 68q-20-3-39-5t-39-2q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32h240v80H160Zm400 40v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T903-340L683-120H560Zm300-263-37-37 37 37ZM620-180h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19ZM367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm169.5-56.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Z"/>
          </svg>
          Edit Players
        </div>`;
  
  // ── SECTION 1: Bowler Swap (existing) ──
  const curBowler = m.curBowler;
  const availBowlers = curBowler ? m.bowlNames.filter(n => n !== curBowler) : [];
  if (curBowler && availBowlers.length > 0) {
    html += `
      <div class="ep-section">
        <div class="ep-label" style="color:var(--ylw);">Current Bowler</div>
        <div class="ep-row">
          <div class="ep-name">${curBowler}</div>
          <span class="ep-arrow">⇄</span>
          <select class="ep-select" id="epBowlerSwap">
            <option value="${curBowler}">${curBowler}</option>
            ${availBowlers.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <button class="ep-apply-btn" style="background:rgba(240,180,41,.1);border-color:rgba(240,180,41,.4);color:var(--ylw);margin-top:8px" onclick="applyBowlerSwap()">Apply Bowler Change</button>
      </div>`;
  }
  
  // ── SECTION 2: Batter Swap (existing) ──
  const availBatPool = batNamesList.filter(n => {
    const b = m.bat.find(x => x.name === n);
    return b && !b.out;
  });
  const editableBatters = [];
  if (m.wickets === 0) {
    editableBatters.push({ idx: m.striker, role: 'Striker' });
    editableBatters.push({ idx: m.nonStriker, role: 'Non-Striker' });
  } else {
    editableBatters.push({ idx: m.lastNewBatIdx ?? m.striker, role: 'New Batsman' });
  }
  
  const hasSwappable = editableBatters.some(({ idx }) => {
    const bat = m.bat[idx];
    return bat && availBatPool.filter(n => n !== bat.name).length > 0;
  });
  
  if (hasSwappable) {
    html += `<div class="ep-section" style="margin-top:14px">
      <div class="ep-label" style="color:var(--ylw);">Batters</div>`;
    editableBatters.forEach(({ idx, role }) => {
      const bat = m.bat[idx];
      if (!bat) return;
      const others = availBatPool.filter(n => n !== bat.name);
      if (!others.length) return;
      html += `
        <div class="ep-row" style="margin-bottom:8px">
          <div style="display:flex;flex-direction:column;gap:2px;flex:1">
            <span style="font-size:10px;color:var(--t3)">${role}</span>
            <div class="ep-name">${bat.name}</div>
          </div>
          <span class="ep-arrow">⇄</span>
          <select class="ep-select" id="epBatSwap_${idx}">
            <option value="${bat.name}">${bat.name}</option>
            ${others.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>`;
    });
    html += `<button class="ep-apply-btn" style="background:rgba(240,180,41,.1);border-color:rgba(240,180,41,.4);color:var(--ylw);margin-top:8px" onclick="applyBatterSwap()">Apply Batter Change</button></div>`;
  }
  
  // ── SECTION 3: Player Name Edit (NEW) ──
  html += `
    <div class="ep-section" style="margin-top:14px">
      <div class="ep-label" style="color:var(--grn">Edit Player Names</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">
        Select a player, type the new name, then apply.
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--blue2);display:block;margin-bottom:6px">
           ${batTeamLabel} 
        </label>
        <div class="ep-row" style="gap:8px;flex-wrap:wrap">
          <select class="ep-select" id="epNameSelBat" style="flex:1.2;min-width:120px" onchange="epPreviewName('bat')">
            ${batNamesList.map((n, i) => `<option value="${i}">${n}</option>`).join('')}
          </select>
          <!--span class="ep-arrow">→</span-->
          <input type="text" id="epNameInpBat" maxlength="18"
            placeholder="New name"
            style="flex:1.2;min-width:100px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--text);font-family:var(--f);font-size:13px;padding:8px 10px" />
        </div>
        <button class="ep-apply-btn" onclick="applyPlayerNameEdit('bat')">Apply Player Name Change</button>
      </div>

      <div>
        <label style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red2);display:block;margin-bottom:6px">
           ${bowlTeamLabel}
        </label>
        <div class="ep-row" style="gap:8px;flex-wrap:wrap">
          <select class="ep-select" id="epNameSelBowl" style="flex:1.2;min-width:120px" onchange="epPreviewName('bowl')">
            ${bowlNamesList.map((n, i) => `<option value="${i}">${n}</option>`).join('')}
          </select>
          <!--span class="ep-arrow">→</span-->
          <input type="text" id="epNameInpBowl" maxlength="18"
            placeholder="New name"
            style="flex:1.2;min-width:100px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--rs);color:var(--text);font-family:var(--f);font-size:13px;padding:8px 10px" />
        </div>
        <button class="ep-apply-btn" style="background:rgba(229,57,53,.1);border-color:rgba(229,57,53,.4);color:#f87171;margin-top:8px" onclick="applyPlayerNameEdit('bowl')">Apply Player Name Change</button>
      </div>
    </div>`;
  
  html += `
      <div class="mact" style="margin-top:16px">
        <button class="mbtn-c" onclick="document.getElementById('editPlayersModal').remove()">Close</button>
      </div>
    </div>
  </div>`;
  
  const old = document.getElementById('editPlayersModal');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function applyBowlerSwap() {
  const m       = G.match;
  const sel     = document.getElementById('epBowlerSwap');
  const newName = sel?.value;
  if (!newName) { showToast('Select a bowler to swap with'); return; }

  const oldName = m.curBowler;
  if (m.bowlMap[oldName]) {
    m.bowlMap[newName] = { ...m.bowlMap[oldName] };
    delete m.bowlMap[oldName];
  }
  const orderIdx = m.bowlOrder.indexOf(oldName);
  if (orderIdx !== -1) m.bowlOrder[orderIdx] = newName;
  m.curBowler = newName;
  if (m.prevBowler === newName) m.prevBowler = oldName;

  document.getElementById('editPlayersModal').remove();
  showToast(`Bowler changed: ${oldName} → ${newName}`, true);
  renderAll();
  saveState();
}

function applyBatterSwap() {
  const m    = G.match;
  const sel1 = document.getElementById(`epBatSwap_${m.striker}`)?.value;
  const sel2 = document.getElementById(`epBatSwap_${m.nonStriker}`)?.value;
  if (sel1 && sel2 && sel1 === sel2) {
    showToast('Striker & Non-Striker cannot be the same player');
    return;
  }

  const changed = [];
  [m.striker, m.nonStriker].forEach(idx => {
    const sel     = document.getElementById(`epBatSwap_${idx}`);
    if (!sel?.value) return;
    const oldName = m.bat[idx].name;
    const newName = sel.value;
    if (oldName === newName) return;
    m.bat[idx].name = newName;
    const swapIdx = m.bat.findIndex(b => b.name === newName && b.notYet);
    if (swapIdx !== -1) m.bat[swapIdx].name = oldName;
    changed.push(`${oldName} → ${newName}`);
  });

  if (!changed.length) { showToast('Select a batter to swap'); return; }
  document.getElementById('editPlayersModal').remove();
  showToast(changed.join(' / '), true);
  renderAll();
  saveState();
}

// ── ড্রপডাউন থেকে select হলে input-এ current নাম দেখাও ──
function epPreviewName(side) {
  const sel = document.getElementById(side === 'bat' ? 'epNameSelBat' : 'epNameSelBowl');
  const inp = document.getElementById(side === 'bat' ? 'epNameInpBat' : 'epNameInpBowl');
  if (!sel || !inp) return;

  const s = G.setup;
  const isBatTeam1 = s.batFirst === s.team1;
  const namesList = side === 'bat'
    ? (isBatTeam1 ? s.team1Names : s.team2Names)
    : (isBatTeam1 ? s.team2Names : s.team1Names);

  inp.value = namesList[+sel.value] || '';
  inp.focus();
  inp.select();
}

// ── প্লেয়ার নাম সব জায়গায় আপডেট করো ──
function applyPlayerNameEdit(side) {
  const s = G.setup;
  const m = G.match;
  const sel = document.getElementById(side === 'bat' ? 'epNameSelBat' : 'epNameSelBowl');
  const inp = document.getElementById(side === 'bat' ? 'epNameInpBat' : 'epNameInpBowl');
  if (!sel || !inp) return;

  const newName = inp.value.trim();
  if (!newName) { showToast('Name cannot be empty'); return; }

  const isBatTeam1 = s.batFirst === s.team1;
  const playerIdx  = +sel.value;

  // কোন setup array এবং match array তে কাজ করতে হবে
  const isBatSide = side === 'bat';

  // setup names arrays
  const setupBatNames  = isBatTeam1 ? s.team1Names : s.team2Names;
  const setupBowlNames = isBatTeam1 ? s.team2Names : s.team1Names;
  const setupNames = isBatSide ? setupBatNames : setupBowlNames;

  const oldName = setupNames[playerIdx];
  if (!oldName) { showToast('Player not found'); return; }
  if (oldName === newName) { showToast('Name is the same, no change needed'); return; }

  // দুটো team1Names/team2Names এও reflect করতে হবে
  if (isBatTeam1) {
    if (isBatSide) s.team1Names[playerIdx] = newName;
    else           s.team2Names[playerIdx] = newName;
  } else {
    if (isBatSide) s.team2Names[playerIdx] = newName;
    else           s.team1Names[playerIdx] = newName;
  }
  // setup batNames/bowlNames এও আপডেট
  if (isBatSide) s.batNames = [...(isBatTeam1 ? s.team1Names : s.team2Names)];
  else           s.bowlNames = [...(isBatTeam1 ? s.team2Names : s.team1Names)];

  // match.bat (batting side) আপডেট
  if (isBatSide) {
    const batEntry = m.bat.find(b => b.name === oldName);
    if (batEntry) batEntry.name = newName;
  }

  // match.bowlNames (bowling side) আপডেট
  if (!isBatSide) {
    const bi = m.bowlNames.indexOf(oldName);
    if (bi !== -1) m.bowlNames[bi] = newName;

    // bowlMap & bowlOrder আপডেট
    if (m.bowlMap[oldName]) {
      m.bowlMap[newName] = { ...m.bowlMap[oldName] };
      delete m.bowlMap[oldName];
    }
    const oi = m.bowlOrder.indexOf(oldName);
    if (oi !== -1) m.bowlOrder[oi] = newName;
    if (m.curBowler === oldName) m.curBowler = newName;
    if (m.prevBowler === oldName) m.prevBowler = newName;
  }

  // history snaps এও নাম আপডেট (পুরনো undo এ যাতে সমস্যা না হয়)
  m.history = m.history.map(snapStr => {
    return snapStr.split(JSON.stringify(oldName)).join(JSON.stringify(newName));
  });

  // inn1FullData এ যদি থাকে (2nd innings)
  if (G.inn1FullData) {
    if (isBatSide) {
      // 1st innings batting team ছিল এই side — inn1FullData.bat এ নাম আপডেট
      // (2nd innings এ batSide উল্টো হয়, তাই 1st innings এ bowlSide ছিল এই team)
    }
    // simple string replace on inn1FullData
    try {
      const d1str = JSON.stringify(G.inn1FullData)
        .split(JSON.stringify(oldName)).join(JSON.stringify(newName));
      G.inn1FullData = JSON.parse(d1str);
    } catch(e) {}
  }
  if (G.inn1MatchState) {
    G.inn1MatchState = G.inn1MatchState
      .split(JSON.stringify(oldName)).join(JSON.stringify(newName));
  }

  // ড্রপডাউন রিফ্রেশ
  const updatedNames = isBatSide ? setupBatNames : setupBowlNames;
  sel.innerHTML = updatedNames.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  sel.value = playerIdx;
  inp.value = newName;

  document.getElementById('editPlayersModal').remove();
  showToast(`${oldName} → ${newName}`, true);
  renderAll();
  saveState();
}

// ═══════════════════════════════════════════════
//  START MATCH → TOSS MODAL
// ═══════════════════════════════════════════════

function startMatch() {
  const ov  = +$('totalOvers').value  || 20;
  const pl  = +$('playerCount').value || 11;

  const team1 = $('teamA').value.trim() || 'Team A';
  const team2 = $('teamB').value.trim() || 'Team B';
  const t1code = teamCode(team1);
  const t2code = teamCode(team2);

  const team1Names = [], team2Names = [];
  for (let i = 0; i < pl; i++) {
    team1Names.push($(`pn_0_${i}`)?.value.trim() || `Player ${i + 1} ${t1code}`);
    team2Names.push($(`pn_1_${i}`)?.value.trim() || `Player ${i + 1} ${t2code}`);
  }

  // Feasibility check
  let covered = 0, maxPoss = 0;
  tierRows.forEach(t => {
    const lim = +t.maxOv || 0;
    if (t.isRest) maxPoss += Math.max(pl - covered, 0) * lim;
    else { covered += +t.count || 0; maxPoss += (+t.count || 0) * lim; }
  });
  if (maxPoss < ov) {
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    showToast(`Over limits too low! Max: ${maxPoss} ov, need ${ov}`);
    return;
  }

  G.setup = {
    team1, team2, overs: ov, players: pl,
    team1Names, team2Names,
    tiers: tierRows.map(t => ({ ...t })),
    batFirst: '',
    byeAllowed: $('byeAllowedToggle').checked,
    lastMan: $('lastManToggle').checked,
    shortCric: !$('shortCricToggle').checked,
  };
  G.inn1 = null;
  showTossModal();
}

// ── TOSS MODAL ───────────────────────────────
function showTossModal() {
  const s = G.setup;
  $('tossInfo').innerHTML = `
    <p style="margin-bottom:12px;color:var(--t2)">Who won the toss?</p>
    <div class="toss-btns" id="tossWinnerBtns">
      <button class="toss-pick" id="tossPick1" onclick="pickTossWinner('${s.team1}', this)">${s.team1}</button>
      <button class="toss-pick" id="tossPick2" onclick="pickTossWinner('${s.team2}', this)">${s.team2}</button>
    </div>
    <div id="tossElectDiv" style="display:none;margin-top:18px">
      <p style="margin-bottom:10px;color:var(--t2)"><span id="tossWinnerLabel"></span> elected to:</p>
      <div class="toss-btns">
        <button class="toss-pick" id="tossElectBat"  onclick="pickTossElect('bat',  this)">🏏 Bat</button>
        <button class="toss-pick" id="tossElectBowl" onclick="pickTossElect('bowl', this)">⚪ Bowl</button>
      </div>
    </div>`;
  G.setup.tossWinner = '';
  G.setup.tossElect  = '';
  G.setup.batFirst   = '';
  openModal('tossModal');
}

function pickTossWinner(teamName, btn) {
  document.querySelectorAll('#tossWinnerBtns .toss-pick').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  G.setup.tossWinner = teamName;
  G.setup.tossElect  = '';
  document.querySelectorAll('#tossElectBat, #tossElectBowl').forEach(b => b.classList.remove('sel'));
  $('tossWinnerLabel').textContent = teamName;
  $('tossElectDiv').style.display = 'block';
}

function pickTossElect(elect, btn) {
  document.querySelectorAll('#tossElectBat, #tossElectBowl').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  G.setup.tossElect = elect;
  const s = G.setup;
  s.batFirst = elect === 'bat' ? s.tossWinner : (s.tossWinner === s.team1 ? s.team2 : s.team1);
}

function confirmToss() {
  if (!G.setup.tossWinner || !G.setup.tossElect) {
    shakeModal('tossModal');
    showToast(!G.setup.tossWinner ? 'Select who won the toss' : 'Select Bat or Bowl');
    return;
  }

  closeModal('tossModal');
  const s = G.setup;

  if (s.batFirst === s.team1) {
    s.batNames = s.team1Names; s.bowlNames = s.team2Names;
    s.teamA = s.team1;        s.teamB = s.team2;
  } else {
    s.batNames = s.team2Names; s.bowlNames = s.team1Names;
    s.teamA = s.team2;         s.teamB = s.team1;
  }

  initMatch(1);
  showScreen('scoring');
  saveState();
  setTimeout(() => openOpeningBatsmenModal(), 200);
}

// ═══════════════════════════════════════════════
//  MATCH INIT
// ═══════════════════════════════════════════════

function initMatch(innings) {
  const s        = G.setup;
  const batNames = innings === 1 ? s.batNames  : s.bowlNames;
  const bowlNames = innings === 1 ? s.bowlNames : s.batNames;
  const battingTeam = innings === 1 ? s.teamA : s.teamB;

  G.match = {
    innings, battingTeam,
    runs: 0, wickets: 0, balls: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    curOver: [], doneOvers: [],
    striker: 0, nonStriker: 1, nextBat: 2,
    lastNewBatIdx: null,  // properly initialised
    bat: batNames.map((name, i) => ({
      name, runs: 0, balls: 0, fours: 0, sixes: 0,
      out: false, howOut: '', notYet: i >= 2,
    })),
    bowlNames,
    bowlOrder: [], bowlMap: {},
    curBowler: null, prevBowler: null,
    needBowler: true, needBatsmen: true,
    history: [],
    done: false,
  };

  G.match.bat[0].notYet = false;
  G.match.bat[1].notYet = false;

  renderHeader();
  renderAll();
}


function bindSmartInput(id, min, max) {
  const inp = document.getElementById(id);
  if (!inp) return;

  inp.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key) || ctrl) return;
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }

    const cur  = this.value.replace(/\D/g, '');
    const next = cur + e.key;
    const num  = parseInt(next, 10);

    if (num > max) { e.preventDefault(); return; }
    if (next.length > 0 && next[0] === '0') { e.preventDefault(); return; }
  });

  inp.addEventListener('blur', function () {
    let v = parseInt(this.value, 10);
    if (isNaN(v) || v < min) v = min;
    if (v > max)             v = max;
    
    if (this.value !== String(v)) {
      this.value = v;
      this.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

// ═══════════════════════════════════════════════
//  BALL
// ═══════════════════════════════════════════════

function ball(runs, extra) {
  const m = G.match;
  if (!m || m.done || m.needBowler || m.needBatsmen) return;

  if (runs === 6 && !extra && G.setup.shortCric) {
    showWicketModal('overBoundary');
    return;
  }

  const isLastMan = isLastManAlone();

  if (isLastMan && !extra && runs !== 4 && runs !== 6) {
    saveSnap();
    m.bat[m.striker].balls++;
    addBowlerBall(0, true, null);
    m.balls++;
    m.curOver.push({ runs: 0, extra: null, isLegal: true, isW: false });
    flash('');
    checkOverDone();
    checkInningsDone();
    renderAll();
    saveState();
    return;
  }

  const isLegal = extra !== 'wide' && extra !== 'noball';
  saveSnap();

  m.runs += runs;
  if (extra) m.extras[extra] = (m.extras[extra] || 0) + 1;

  if (!extra || extra === 'noball') {
    m.bat[m.striker].runs  += runs;
    m.bat[m.striker].fours += runs === 4 ? 1 : 0;
    m.bat[m.striker].sixes += runs === 6 ? 1 : 0;
  }
  if (isLegal) m.bat[m.striker].balls++;

  addBowlerBall(runs, isLegal, extra);
  if (isLegal) m.balls++;
  if (isLegal && runs % 2 === 1 && !isLastMan) swapBat();

  m.curOver.push({ runs, extra, isLegal, isW: false });
  flash(runs >= 4 ? 'g' : (extra ? 'r' : ''));

  if (isLegal) checkOverDone();
  checkInningsDone();
  renderAll();
  saveState();
}

function wicketBall(outIdx, howOut, newBatIdx, roRuns = 0, roByeRuns = 0, nextStriker = null) {
  const m = G.match;
  saveSnap();
  
  const totalExtra = roRuns + roByeRuns;
  
  if (roRuns > 0) {
    m.runs += roRuns;
    m.bat[m.striker].runs += roRuns;
    m.bat[m.striker].fours += roRuns === 4 ? 1 : 0;
  }
  
  if (roByeRuns > 0 && G.setup.byeAllowed !== false) {
    m.runs += roByeRuns;
    m.extras.bye = (m.extras.bye || 0) + roByeRuns;
  }
  
  m.bat[outIdx].out = true;
  m.bat[outIdx].howOut = howOut;
  if (outIdx === m.striker) m.bat[outIdx].balls++;
  
  m.wickets++;
  
  if (howOut !== 'Run Out' && m.curBowler)
    m.bowlMap[m.curBowler].wickets++;
  
  addBowlerBall(totalExtra, true, null);
  m.balls++;
  m.curOver.push({ runs: totalExtra, extra: null, isLegal: true, isW: true });
  
  if (newBatIdx !== null) {
    m.bat[newBatIdx].notYet = false;
    if (m.striker === outIdx) {
      m.striker = newBatIdx;
    } else {
      m.nonStriker = newBatIdx;
    }
    m.lastNewBatIdx = newBatIdx;
  } else {
    if (m.striker === outIdx) {
      m.striker = m.nonStriker !== -1 ? m.nonStriker : outIdx;
      m.nonStriker = -1;
    } else {
      m.nonStriker = -1;
    }
    m.lastNewBatIdx = null;
  }
  
  if (howOut === 'Run Out' && nextStriker !== null && m.nonStriker !== -1) {
    if (m.striker !== nextStriker) {
      const tmp = m.striker;
      m.striker = m.nonStriker;
      m.nonStriker = tmp;
    }
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
  if (extra === 'wide')  b.wides   = (b.wides   || 0) + 1;
  if (extra === 'noball') b.noballs = (b.noballs || 0) + 1;
}

function swapBat() {
  const m = G.match, t = m.striker;
  m.striker = m.nonStriker;
  m.nonStriker = t;
}

function isLastManAlone() {
  const m = G.match;
  if (!G.setup.lastMan) return false;
  return m && m.nonStriker === -1;
}

function checkOverDone() {
  const m = G.match;
  if (m.balls > 0 && m.balls % 6 === 0) {
    m.doneOvers.push([...m.curOver]);
    m.curOver = [];
    m.prevBowler = m.curBowler;
    m.curBowler = null;
    m.needBowler = true;
    if (!isLastManAlone()) swapBat(); // লাস্ট ম্যান একা থাকলে swap না
    if (!m.done) setTimeout(() => { if (!G.match.done) openBowlerModal(); }, 250);
  }
}

function checkInningsDone() {
  const m = G.match, s = G.setup;
  const allOutLastMan = s.lastMan && m.nonStriker === -1 && m.bat[m.striker]?.out;
  const allOutNormal  = !s.lastMan && m.wickets >= s.players - 1;
  const allOut        = allOutLastMan || allOutNormal;
  const oversDone     = m.balls >= s.overs * 6;

  if ((allOut || oversDone) && !m.done) {
    m.done = true;
    if (m.innings === 1) {
      G.inn1 = { runs: m.runs, wickets: m.wickets, balls: m.balls };
      $('inn2Btn').style.display = 'inline-flex';
      setTimeout(() => showInn2Modal(), 600);
    } else {
      setTimeout(() => showResult(), 600);
    }
    return;
  }

  if (m.innings === 2 && G.inn1 && m.runs > G.inn1.runs && !m.done) {
    m.done = true;
    setTimeout(() => showResult(), 400);
  }
}

// ── TOAST ────────────────────────────────────
function showToast(msg, isSuccess = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('success', isSuccess);
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.classList.remove('show'); }, 2500);
}

function shakeModal(modalId) {
  const m = $(modalId)?.querySelector('.modal');
  if (!m) return;
  m.classList.remove('shake');
  void m.offsetWidth;
  m.classList.add('shake');
  m.addEventListener('animationend', () => m.classList.remove('shake'), { once: true });
  if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
}

// ═══════════════════════════════════════════════
//  UNDO
// ═══════════════════════════════════════════════

function saveSnap() {
  const snap = JSON.stringify({
    runs: G.match.runs, wickets: G.match.wickets, balls: G.match.balls,
    extras:    { ...G.match.extras },
    curOver:   G.match.curOver.map(b => ({ ...b })),
    doneOvers: G.match.doneOvers.map(ov => ov.map(b => ({ ...b }))),
    striker: G.match.striker, nonStriker: G.match.nonStriker, nextBat: G.match.nextBat,
    bat:     G.match.bat.map(b => ({ ...b })),
    bowlOrder: [...G.match.bowlOrder],
    bowlMap:   JSON.parse(JSON.stringify(G.match.bowlMap)),
    curBowler: G.match.curBowler, prevBowler: G.match.prevBowler,
    needBowler: G.match.needBowler, needBatsmen: G.match.needBatsmen,
    lastNewBatIdx: G.match.lastNewBatIdx,
    done: G.match.done,
  });
  G.match.history.push(snap);
  if (G.match.history.length > 50) G.match.history.shift();
}

function undoLast() {
  if (!G.match) return;
  
  const bowlerModalVisible = $('bowlerModal').style.display !== 'none';
  if (bowlerModalVisible) closeModal('bowlerModal');
  
  if (G.match.innings === 2 && G.match.history.length === 0 && G.inn1MatchState) {
    
    const inn1Match = JSON.parse(G.inn1MatchState);
    
    const s = G.setup;
    [s.teamA, s.teamB] = [s.teamB, s.teamA];
    
    G.match = inn1Match;
    G.inn1 = null;
    G.inn1FullData = null;
    G.inn1MatchState = null;
    
    $('inn2Btn').style.display = 'none';
    $('tgtBlk').style.display = 'none';
    $('rrrBlk').style.display = 'none';
    $('innLbl').textContent = '1st Innings';
    
    if (G.match.history.length > 0) {
      const snap = JSON.parse(G.match.history.pop());
      const hist = G.match.history;
      Object.assign(G.match, snap);
      G.match.doneOvers = snap.doneOvers || [];
      G.match.history = hist;
      G.match.done = false;
    }
    
    renderHeader();
    renderAll();
    saveState();
    showToast('1st innings last ball undone', true);
    return;
  }
  
  if (!G.match.history.length) return;
  
  const snap = JSON.parse(G.match.history.pop());
  const hist = G.match.history;
  Object.assign(G.match, snap);
  G.match.doneOvers = snap.doneOvers || [];
  G.match.history = hist;
  
  if (G.match.needBowler && !G.match.done && !bowlerModalVisible) {
    setTimeout(() => openBowlerModal(), 250);
  }
  
  renderAll();
  saveState();
}


function resultUndo() {
  if (!G.match || !G.match.history.length) return;
  G.match.resultLocked = false;
  G.match.done         = false;

  const snap = JSON.parse(G.match.history.pop());
  const hist = G.match.history;
  Object.assign(G.match, snap);
  G.match.doneOvers = snap.doneOvers || [];
  G.match.history   = hist;
  G.match.done      = false;

  const rs = document.getElementById('result-screen');
  if (rs) rs.classList.remove('active');
  if (G.match.innings === 1) $('inn2Btn').style.display = 'none';

  showScreen('scoring');
  renderHeader();
  renderAll();
  saveState();
}

// ═══════════════════════════════════════════════
//  EXTRA MODAL
// ═══════════════════════════════════════════════

let extraState = { type: null, batRuns: 0, totalRuns: 1 };

function showExtraModal(type) {
  const m = G.match;
  if (!m || m.done || m.needBowler || m.needBatsmen) return;

  const byeAllowed = G.setup.byeAllowed !== false;

  if ((type === 'bye' || type === 'legbye') && !byeAllowed) {
    showToast('Bye runs are disabled for this match');
    return;
  }

  extraState = { type, batRuns: 0, totalRuns: 1 };

  const titles = { noball: 'No Ball', wide: 'Wide', bye: 'Bye', legbye: 'Leg Bye' };
  const infos  = {
    noball: byeAllowed
      ? 'No Ball: +1 extra (automatic). Select bat runs scored.'
      : 'No Ball: +1 extra (automatic). Bye runs disabled.',
    wide: byeAllowed
      ? 'Wide: +1 extra (automatic). If batters ran additional bye runs, select below.'
      : 'Wide: +1 extra only. Bye runs disabled.',
    bye:    'Bye: Ball missed bat & keeper, batters ran. Select runs scored.',
    legbye: 'Leg Bye: Deflected off body, batters ran. Select runs scored.',
  };

  $('extraModalTitle').textContent = titles[type];
  $('extraModalInfo').textContent  = infos[type];

  const batFld  = $('extraBatRunFld');
  const batGrid = $('extraBatRunGrid');
  const runGrid = $('extraRunGrid');
  batGrid.innerHTML = '';
  runGrid.innerHTML = '';

    if (type === 'noball') {
    batFld.style.display = 'block';
    $('extraRunLabel').textContent = 'Total = bat runs + 1 NB';
  
    const isShort = !!G.setup.shortCric;
    const byeAllowed = G.setup.byeAllowed !== false;
  
    [0, 1, 2, 3, 4, 6].forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'db' + (r === 0 ? ' sel' : '');
      btn.textContent = String(r);
  
      if (r === 6 && isShort) {
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.title = '6 = OUT in Short Cricket';
      } else {
        btn.onclick = () => {
          batGrid.querySelectorAll('.db').forEach(b => b.classList.remove('sel'));
          btn.classList.add('sel');
          extraState.batRuns = r;
          extraState.totalRuns = r + 1;
          $('extraRunLabel').textContent = `Total = ${r} bat + 1 NB = ${r + 1} runs`;
          buildTotalDisplay(r + 1);
  
          if (r > 0) {
            extraState.byeRuns = 0;
            const bg = $('nbByeGrid');
            if (bg) {
              bg.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
              bg.querySelector('.db')?.classList.add('sel');
            }
          }
        };
      }
      batGrid.appendChild(btn);
    });
  
    if (byeAllowed) {
      const byeFld = document.createElement('div');
      byeFld.className = 'mf';
      byeFld.style.marginTop = '10px';
      byeFld.innerHTML = '<label>Bye Runs (bat missed, batters ran)</label>';
      const byeGrid = document.createElement('div');
      byeGrid.className = 'dis-grid';
      byeGrid.id = 'nbByeGrid';
  
      [0, 1, 2, 3, 4].forEach(r => {
        const b2 = document.createElement('button');
        b2.className = 'db' + (r === 0 ? ' sel' : '');
        b2.textContent = String(r);
        b2.onclick = () => {
          byeGrid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
          b2.classList.add('sel');
          extraState.byeRuns = r;
          extraState.totalRuns = r + 1;
          $('extraRunLabel').textContent = `Total = ${r} bye + 1 NB = ${r + 1} runs`;
          buildTotalDisplay(r + 1);
  
          if (r > 0) {
            extraState.batRuns = 0;
            batGrid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
            batGrid.querySelector('.db')?.classList.add('sel');
          }
        };
        byeGrid.appendChild(b2);
      });
  
      byeFld.appendChild(byeGrid);

      const modal = $('extraModal').querySelector('.modal');
      const totalFld = $('extraTotalFld');
      modal.insertBefore(byeFld, totalFld);
    }
  
    extraState.batRuns = 0; extraState.byeRuns = 0; extraState.totalRuns = 1;
    buildTotalDisplay(1);
    
  } else if (type === 'wide') {
    batFld.style.display = 'none';

    if (byeAllowed) {
      $('extraRunLabel').textContent = 'Additional bye runs off the wide (if batters ran)';
      [0, 1, 2, 3, 4].forEach(r => {
        const btn = document.createElement('button');
        btn.className   = 'db' + (r === 0 ? ' sel' : '');
        btn.textContent = r === 0 ? '0 (wide only)' : `+${r} bye`;
        btn.onclick = () => {
          runGrid.querySelectorAll('.db').forEach(b => b.classList.remove('sel'));
          btn.classList.add('sel');
          extraState.totalRuns = r + 1;
          extraState.batRuns   = 0;
        };
        runGrid.appendChild(btn);
      });
      extraState.totalRuns = 1;
    } else {
      closeModal('extraModal');
      saveSnap();
      m.runs += 1;
      m.extras.wide = (m.extras.wide || 0) + 1;
      addBowlerBall(1, false, 'wide');
      m.curOver.push({ runs: 1, extra: 'wide', isLegal: false, isW: false, batRuns: 0, byeRuns: 0 });
      flash('r');
      checkInningsDone();
      renderAll();
      saveState();
      return;
    }

  } else {
    batFld.style.display = 'none';
    $('extraRunLabel').textContent = 'Runs scored';
    [1, 2, 3, 4].forEach(r => {
      const btn = document.createElement('button');
      btn.className   = 'db' + (r === 1 ? ' sel' : '');
      btn.textContent = r === 4 ? '4 (boundary)' : String(r);
      btn.onclick = () => {
        runGrid.querySelectorAll('.db').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        extraState.totalRuns = r;
        extraState.batRuns   = 0;
      };
      runGrid.appendChild(btn);
    });
    extraState.totalRuns = 1;
  }

  openModal('extraModal');
}

function buildTotalDisplay(total) {
  const runGrid = $('extraRunGrid');
  runGrid.innerHTML = '';
  const btn = document.createElement('button');
  btn.className   = 'db sel';
  btn.textContent = `${total} run${total !== 1 ? 's' : ''} total`;
  runGrid.appendChild(btn);
}

function confirmExtra() {
  const { type, batRuns, totalRuns, byeRuns = 0 } = extraState;
  closeModal('extraModal');

  const m          = G.match;
  const byeAllowed = G.setup.byeAllowed !== false;
  const isLegal    = type === 'bye' || type === 'legbye';

  saveSnap();
  m.runs += totalRuns;

  if (type === 'noball') {
    m.extras.noball = (m.extras.noball || 0) + 1;
    if (batRuns > 0) {
      m.bat[m.striker].runs += batRuns;
      m.bat[m.striker].fours += batRuns === 4 ? 1 : 0;
      m.bat[m.striker].sixes += batRuns === 6 ? 1 : 0;
    }
    if (byeAllowed && byeRuns > 0) {
      m.extras.bye = (m.extras.bye || 0) + byeRuns;
    }
    addBowlerBall(totalRuns, false, 'noball');
    const swapRuns = batRuns > 0 ? batRuns : byeRuns;
    if (swapRuns % 2 === 1 && !isLastManAlone()) swapBat();
  
  } else if (type === 'wide') {
    m.extras.wide = (m.extras.wide || 0) + 1;
    const byeRuns = totalRuns - 1; 
    if (byeAllowed && byeRuns > 0) m.extras.bye = (m.extras.bye || 0) + byeRuns;
    addBowlerBall(totalRuns, false, 'wide');
    if (byeRuns % 2 === 1 && !isLastManAlone()) swapBat();
    
  } else if (type === 'bye') {
    m.extras.bye = (m.extras.bye || 0) + totalRuns;
    m.bat[m.striker].balls++;
    addBowlerBall(totalRuns, true, null);
    if (totalRuns % 2 === 1 && !isLastManAlone()) swapBat();
  }

  m.curOver.push({ runs: totalRuns, extra: type, isLegal, isW: false, batRuns, byeRuns });
  flash(totalRuns >= 4 ? 'g' : 'r');
  if (isLegal) checkOverDone();
  checkInningsDone();
  renderAll();
  saveState();
}

// ═══════════════════════════════════════════════
//  WICKET MODAL
// ═══════════════════════════════════════════════

function showWicketModal(forceDis) {
  const m = G.match;
  if (!m || m.done || m.needBowler) return;
  pickedDis = null;
  window._roRuns    = 0;
  window._roByeRuns = 0;
  window._roEnd     = null;
  window._wkStrikeIdx = null;

  $('wkRunOutSection').style.display = 'none';
  $('wkStrikeFld').style.display     = 'none';

  refreshNewBatDropdown();

  const lbwBtn = $('lbwOrBoundaryBtn');
  if (G.setup.shortCric) {
    lbwBtn.textContent = 'Over Boundary';
    lbwBtn.onclick = function () { pickDis(this, 'Over Boundary'); };
  } else {
    lbwBtn.textContent = 'LBW';
    lbwBtn.onclick = function () { pickDis(this, 'LBW'); };
  }

  document.querySelectorAll('#wkModal .db').forEach(b => b.classList.remove('sel'));

  if (forceDis === 'overBoundary') {
    pickedDis = 'Over Boundary';
    setTimeout(() => {
      $('lbwOrBoundaryBtn').classList.add('sel');
      updateWkStrikeField();
    }, 50);
  }

  openModal('wkModal');
}

function refreshNewBatDropdown() {
  const m     = G.match;
  const nsel  = $('newBat');
  nsel.innerHTML = '';
  const avail = m.bat.filter(b => b.notYet && !b.out);
  avail.forEach(b => nsel.appendChild(new Option(b.name, m.bat.indexOf(b))));
  $('newBatFld').style.display = avail.length ? 'block' : 'none';
}

function pickDis(btn, type) {
  pickedDis = type;
  document.querySelectorAll('#wkModal .db').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');

  const m = G.match;

  if (type === 'Run Out') {
    $('wkRunOutSection').style.display = 'block';

    const sel = $('wkBat');
    sel.innerHTML = '';
    if (m.nonStriker !== -1) {
      [m.striker, m.nonStriker].forEach(i =>
        sel.appendChild(new Option(m.bat[i].name, i))
      );
    } else {
      sel.appendChild(new Option(m.bat[m.striker].name, m.striker));
    }
    sel.onchange = () => {
      window._roEnd = null;
      buildRoEndGrid();
      updateWkStrikeField();
    };

    window._roRuns = 0;
    const roRunGrid = $('roRunGrid');
    roRunGrid.innerHTML = '';
    [0, 1, 2, 3, 4].forEach(r => {
      const b2 = document.createElement('button');
      b2.className   = 'db' + (r === 0 ? ' sel' : '');
      b2.textContent = String(r);
      b2.onclick = () => {
        roRunGrid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
        b2.classList.add('sel');
        window._roRuns = r;
        if (r > 0) {
          window._roByeRuns = 0;
          const byeGrid = document.getElementById('roByeGrid');
          if (byeGrid) {
            byeGrid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
            byeGrid.querySelector('.db')?.classList.add('sel');
          }
        }
        updateWkStrikeField();
      };
      roRunGrid.appendChild(b2);
    });

    window._roByeRuns = 0;
    buildRoByeGrid();

    window._roEnd = null;
    buildRoEndGrid();

  } else {
    $('wkRunOutSection').style.display = 'none';
  }

  refreshNewBatDropdown();
  updateWkStrikeField();
}

function buildRoEndGrid() {
  const m      = G.match;
  const outIdx = +$('wkBat').value;
  const isStriker = outIdx === m.striker;

  const grid = $('roEndGrid');
  grid.innerHTML = '';

  const endA = { label: 'Batting End', value: 'batting' };
  const endB = { label: 'Bowling End', value: 'bowling' };

  const defaultEnd = 'bowling';

  [endA, endB].forEach(({ label, value }) => {
    const b2 = document.createElement('button');
    b2.className   = 'db' + (value === defaultEnd ? ' sel' : '');
    b2.textContent = label;
    b2.onclick = () => {
      grid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
      b2.classList.add('sel');
      window._roEnd = value;
      updateWkStrikeField();
    };
    grid.appendChild(b2);
  });

  if (window._roEnd === null) window._roEnd = defaultEnd;
}

function buildRoByeGrid() {
  const byeAllowed = G.setup.byeAllowed !== false;
  const byeFld     = $('roByeFld');

  if (!byeAllowed) {
    byeFld.style.display = 'none';
    window._roByeRuns    = 0;
    return;
  }

  byeFld.style.display = 'block';
  const grid = $('roByeGrid');
  grid.innerHTML = '';
  window._roByeRuns = 0;

  [0, 1, 2, 3, 4].forEach(r => {
    const b2 = document.createElement('button');
    b2.className   = 'db' + (r === 0 ? ' sel' : '');
    b2.textContent = r === 0 ? '0' : String(r);
    b2.onclick = () => {
      grid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
      b2.classList.add('sel');
      window._roByeRuns = r;
      if (r > 0) {
        window._roRuns = 0;
        const roRunGrid = document.getElementById('roRunGrid');
        if (roRunGrid) {
          roRunGrid.querySelectorAll('.db').forEach(x => x.classList.remove('sel'));
          roRunGrid.querySelector('.db')?.classList.add('sel');
        }
      }
    };
    grid.appendChild(b2);
  });
}

function updateWkStrikeField() {
  $('wkStrikeFld').style.display = 'none';

  if (pickedDis !== 'Run Out') return;

  const m         = G.match;
  const outIdx    = +$('wkBat').value;
  const nsel      = $('newBat');
  const newBatIdx = nsel.options.length > 0 ? +nsel.value : null;
  const roEnd     = window._roEnd;

  if (roEnd === null || newBatIdx === null) {
    window._wkStrikeIdx = null;
    return;
  }

  const strikerIsOut = outIdx === m.striker;
  let nextStrikerIdx;

  if (strikerIsOut) {
    if (roEnd === 'batting') {
      nextStrikerIdx = newBatIdx;
    } else {
      nextStrikerIdx = m.nonStriker !== -1 ? m.nonStriker : newBatIdx;
    }
  } else {
    if (roEnd === 'bowling') {
      nextStrikerIdx = m.striker;
    } else {
      nextStrikerIdx = newBatIdx;
    }
  }

  window._wkStrikeIdx = nextStrikerIdx;
}

function confirmWicket() {
  if (!pickedDis) { shakeModal('wkModal'); showToast('Select dismissal type'); return; }

  const m        = G.match;
  const isRunOut = pickedDis === 'Run Out';

  if (isRunOut && window._roEnd === null) {
    shakeModal('wkModal');
    showToast('Select which end the batter was run out');
    return;
  }

  const outIdx    = isRunOut ? +$('wkBat').value : m.striker;
  const nsel      = $('newBat');
  const newBatIdx = nsel.options.length > 0 ? +nsel.value : null;
  const roRuns    = isRunOut ? (window._roRuns    || 0) : 0;
  const roByeRuns = isRunOut ? (window._roByeRuns || 0) : 0;
  const nextStriker = isRunOut ? window._wkStrikeIdx : null;

  closeModal('wkModal');
  wicketBall(outIdx, pickedDis, newBatIdx, roRuns, roByeRuns, nextStriker);
}

// ═══════════════════════════════════════════════
//  BOWLER MODAL
// ═══════════════════════════════════════════════

function openBowlerModal() {
  const m = G.match;
  pickedBowler = null;

  const overNum = Math.floor(m.balls / 6) + 1;
  const ballIcon = ` <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" style="transform:translateY(4px)" viewBox="0 0 24 24">
                         <path d="M0 0h24v24H0z" fill="none" />
                         <path fill="currentColor" d="m3.62 15.85l.53.53l-.73.73c.3.5.63.97 1.01 1.4L18.51 4.43c-.44-.38-.91-.71-1.4-1.01l-.73.73l-.53-.53l.57-.57A9.96 9.96 0 0 0 12 2C6.49 2 2 6.49 2 12c0 1.59.38 3.09 1.05 4.42zM14.8 4.67l.53.53l-1.75 1.75l-.53-.53zM12 7.47l.53.53l-1.75 1.75l-.53-.53zm-2.8 2.8l.53.53l-1.75 1.75l-.53-.53zm-2.8 2.8l.53.53l-1.75 1.75l-.53-.53zm13.98-4.92l-.53-.53l.73-.73c-.3-.5-.63-.97-1.01-1.4L5.49 19.57c.44.38.91.71 1.4 1.01l.73-.73l.53.53l-.57.57C8.92 21.61 10.41 22 12 22c5.51 0 10-4.49 10-10c0-1.59-.38-3.09-1.05-4.42zM9.2 19.33l-.53-.53l1.75-1.75l.53.53zm2.8-2.8l-.53-.53l1.75-1.75l.53.53zm2.8-2.8l-.53-.53l1.75-1.75l.53.53zm2.8-2.8l-.53-.53l1.75-1.75l.53.53z" />
                       </svg> `;
  $('bowlerModalTitle').innerHTML = ballIcon+` Over ${overNum} — Select Bowler`;
  $('bowlerModalInfo').innerHTML =
    `Over ${overNum} of ${G.setup.overs}<br>Previous: <strong>${m.prevBowler || '—'}</strong> (cannot bowl consecutive overs)`;

  const list = $('bowlerList');
  list.innerHTML = '';

  m.bowlNames.forEach(name => {
    const b      = m.bowlMap[name];
    const bowled = b ? Math.floor(b.balls / 6) : 0;
    const maxOv  = getMaxOvForBowler(name, m);
    const full   = b && bowled >= maxOv;
    const consec = name === m.prevBowler;
    const off    = full || consec;

    const row = el('div', 'bpl' + (off ? ' off' : ''));
    let tag = '';
    if (consec) tag = '<span class="bpl-tag">prev over</span>';
    else if (full) tag = '<span class="bpl-tag">quota full</span>';

    row.innerHTML = `
      <div class="bpl-l"><span class="bpl-nm">${name}</span>${tag}</div>
      <div class="bpl-q">${bowled}/${maxOv}ov · ${b ? b.wickets : 0}w ${b ? b.runs : 0}r</div>`;

    if (!off) {
      row.onclick = () => {
        list.querySelectorAll('.bpl').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        pickedBowler = name;
      };
    }
    list.appendChild(row);
  });

  openModal('bowlerModal');
}

function confirmBowler() {
  if (!pickedBowler) { shakeModal('bowlerModal'); showToast('Select a bowler'); return; }
  const m = G.match;
  if (!m.bowlMap[pickedBowler]) {
    m.bowlMap[pickedBowler] = {
      balls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0,
      rank: m.bowlOrder.length, maxOv: null,
    };
    m.bowlOrder.push(pickedBowler);
  }
  m.curBowler  = pickedBowler;
  m.needBowler = false;
  closeModal('bowlerModal');
  renderAll();
  saveState();
}

function getMaxOvForBowler(name, m) {
  const b = m.bowlMap[name];
  if (b && b.maxOv !== null) return b.maxOv;
  return getTierMaxOv(m);
}

function getTierMaxOv(m) {
  const tiers    = G.setup.tiers;
  const bowlMap  = m.bowlMap;

  for (const t of tiers) {
    if (t.isRest) return t.maxOv;
    const usedInTier = Object.values(bowlMap).filter(
      b => b.maxOv === t.maxOv && Math.floor(b.balls / 6) > 0
    ).length;
    if (usedInTier < t.count) return t.maxOv;
  }
  return tiers[tiers.length - 1]?.maxOv || 4;
}

// ═══════════════════════════════════════════════
//  OPENING BATSMEN MODAL
// ═══════════════════════════════════════════════

function openOpeningBatsmenModal() {
  const m    = G.match;
  const list = $('openingBatList');
  list.innerHTML = '';
  G._openingPicks = [];

  m.bat.forEach((b, i) => {
    const row = el('div', 'bpl bat-pick-row');
    row.innerHTML = `
      <div class="bat-pick-name">${b.name}</div>
      <div class="bat-pick-badge" id="bat-role-${i}"></div>
      <div class="bat-pick-check" id="bat-check-${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>`;
    row.onclick = () => pickOpeningBat(i, row);
    list.appendChild(row);
  });

  openModal('openingBatModal');
}

function pickOpeningBat(idx, row) {
  const picks   = G._openingPicks;
  const existing = picks.indexOf(idx);

  if (existing !== -1) {
    picks.splice(existing, 1);
    row.classList.remove('sel');
    refreshOpeningLabels();
    return;
  }
  if (picks.length >= 2) return;

  picks.push(idx);
  row.classList.add('sel');
  refreshOpeningLabels();
}

function refreshOpeningLabels() {
  const picks = G._openingPicks;

  document.querySelectorAll('.bat-pick-row').forEach(row => {
    row.classList.remove('pick-striker', 'pick-nonstriker');
  });
  document.querySelectorAll('[id^="bat-role-"]').forEach(e => {
    e.innerHTML = '';
    e.className = 'bat-pick-badge';
  });

  if (picks[0] !== undefined) {
    const row = document.querySelectorAll('.bat-pick-row')[picks[0]];
    row?.classList.add('pick-striker');
    const badge = $(`bat-role-${picks[0]}`);
    if (badge) {
      badge.innerHTML = `<span class="role-pill striker-pill">⚡ Striker</span>`;
    }
  }
  if (picks[1] !== undefined) {
    const row = document.querySelectorAll('.bat-pick-row')[picks[1]];
    row?.classList.add('pick-nonstriker');
    const badge = $(`bat-role-${picks[1]}`);
    if (badge) {
      badge.innerHTML = `<span class="role-pill nonstriker-pill">🏏 Non-Striker</span>`;
    }
  }
}

function confirmOpeningBat() {
  const picks = G._openingPicks;
  if (picks.length < 2) { shakeModal('openingBatModal'); showToast('Select Striker and Non-Striker'); return; }

  const m = G.match;
  m.striker    = picks[0];
  m.nonStriker = picks[1];
  m.bat.forEach((b, i) => { b.notYet = (i !== picks[0] && i !== picks[1]); });
  m.nextBat = m.bat.findIndex((b, i) => b.notYet && i !== picks[0] && i !== picks[1]);
  if (m.nextBat === -1) m.nextBat = 2;
  m.needBatsmen = false;

  closeModal('openingBatModal');
  renderAll();
  setTimeout(() => openBowlerModal(), 200);
}

// ═══════════════════════════════════════════════
//  INNINGS 2
// ═══════════════════════════════════════════════

function showInn2Modal() {
  const i1 = G.inn1, s = G.setup;
  const ovStr = `${Math.floor(i1.balls / 6)}.${i1.balls % 6}`;
  $('inn2Info').innerHTML = `
    <p style="margin-bottom:10px"><strong>${s.teamA}</strong> scored <strong>${i1.runs}/${i1.wickets}</strong> in ${ovStr} overs.</p>
    <p><strong>${s.teamB}</strong> needs <strong>${i1.runs + 1}</strong> to win.</p>`;
  openModal('inn2Modal');
}

function startInn2() {
  closeModal('inn2Modal');
  const s = G.setup;
  
  G.inn1MatchState = JSON.stringify(G.match);
  
  G.inn1FullData = JSON.parse(JSON.stringify({
    runs: G.match.runs,
    wickets: G.match.wickets,
    balls: G.match.balls,
    extras: G.match.extras,
    bat: G.match.bat,
    bowlMap: G.match.bowlMap,
    bowlOrder: G.match.bowlOrder,
  }));
  
  [s.teamA, s.teamB] = [s.teamB, s.teamA];
  
  initMatch(2);
  $('inn2Btn').style.display = 'none';
  $('tgtBlk').style.display = 'flex';
  $('rrrBlk').style.display = 'flex';
  $('sbTgt').textContent = G.inn1.runs + 1;
  $('innLbl').textContent = '2nd Innings';
  
  saveState();
  setTimeout(() => openOpeningBatsmenModal(), 200);
}


// ═══════════════════════════════════════════════
//  RESULT
// ═══════════════════════════════════════════════

function showResult() {
  const m = G.match, s = G.setup;
  m.resultLocked = true;
  
  const inn1Team = m.innings === 2
    ? (s.batFirst === s.team1 ? s.team1 : s.team2)
    : s.teamA;

  let winnerMsg = '', winnerTeam = '';

  if (m.innings === 2 && G.inn1) {
    if (m.runs > G.inn1.runs) {
      const wkLeft = (s.players - 1) - m.wickets;
      winnerMsg  = `${s.teamA} wins by ${wkLeft} wicket${wkLeft !== 1 ? 's' : ''}!`;
      winnerTeam = s.teamA;
    } else if (m.runs === G.inn1.runs) {
      winnerMsg  = 'Match Tied!';
      winnerTeam = 'Tie';
    } else {
      const margin = G.inn1.runs - m.runs;
      winnerMsg  = `${s.teamB} wins by ${margin} run${margin !== 1 ? 's' : ''}!`;
      winnerTeam = s.teamB;
    }
  } else {
    winnerMsg  = `1st Innings: ${s.teamA} — ${m.runs}/${m.wickets}`;
    winnerTeam = '';
  }

  G.resultData = {
    winnerMsg,
    winnerTeam,
    inn1IsTeam1: inn1Team === s.team1,
  };
  saveState();
  showResultScreen();
}

function showResultScreen() {
  const m = G.match, s = G.setup, i1 = G.inn1;
  const { winnerMsg, winnerTeam } = G.resultData;

  let rs = document.getElementById('result-screen');
  if (!rs) {
    rs = document.createElement('div');
    rs.id = 'result-screen';
    rs.className = 'screen';
    document.getElementById('app').appendChild(rs);
  }

  const inn1Team = m.innings === 2 ? (s.batFirst === s.team1 ? s.team1 : s.team2) : s.teamA;
  const inn1IsTeam1 = inn1Team === s.team1;
  const inn2Team = m.innings === 2 ? (s.batFirst === s.team1 ? s.team2 : s.team1) : null;

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
      const ov   = Math.floor(b.balls / 6), rb = b.balls % 6;
      const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '0.00';
      return `
        <div class="rs-row">
          <span class="rs-nm">${name}</span>
          <span class="rs-hw">${ov}.${rb} ov</span>
          <span class="rs-r">${b.runs}</span>
          <span class="rs-b">${b.wickets}w</span>
          <span class="rs-46"><span style="color:#f87171">${b.wides || 0}wd</span></span>
          <span class="rs-sr">${econ} eco</span>
        </div>`;
    }).join('');
  }

  const d1  = G.inn1FullData || null;
  const d2  = m;
  const ov1 = d1 ? `${Math.floor(d1.balls / 6)}.${d1.balls % 6}` : '—';
  const ov2 = `${Math.floor(d2.balls / 6)}.${d2.balls % 6}`;

  const inn1HTML = d1 ? `
    <div class="rs-inn-hd ${inn1IsTeam1 ? 'inn1' : ''}">
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
    ${buildBowlRows(d1.bowlMap, d1.bowlOrder)}` : '';

  const inn2HTML = `
    <div class="rs-inn-hd ${inn1IsTeam1 ? '' : 'inn1'}" style="margin-top:${d1 ? '20px' : '0'}">
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
      <div class="rs-brand">
        <img src="./favicon.svg" alt="Logo" class="rs-brand-logo">
        <div class="rs-brand-text">
          <div class="rs-brand-name"><span class="bc">CRICKET</span> <span class="bs">SCORE</span></div>
          <div class="rs-brand-tagline-wrapper">
            <div class="rs-brand-tagline">CRICKET SCORING TOOL</div>
          </div>
        </div>
      </div>
      <div class="rs-hero">
        <div class="rs-trophy">${winnerTeam === 'Tie' ? '🤝' : '🏆'}</div>
        <div class="rs-winner">${winnerMsg}</div>
        <div class="rs-sub">${s.teamA} vs ${s.teamB} · ${s.overs} Overs</div>
      </div>
      ${d1 ? `
      <div class="rs-score-bar">
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
      <button class="rs-btn rs-btn-dl"     onclick="downloadSummary()">Download</button>
      <button class="rs-btn rs-btn-new"    onclick="doReset()">Reset</button>
    </div>`;

  document.querySelectorAll('.screen').forEach(sc => sc.classList.remove('active'));
  rs.classList.add('active');
  G.screen = 'result';
  saveState();

  if (!G.match.resultTracked) {
    G.match.resultTracked = true;
    G.match.pendingTrack = {
      result: winnerTeam === 'Tie' ? 'tie' : (winnerTeam ? 'win' : 'innings_complete'),
      summary: winnerMsg,
      team1: s.teamA,
      team2: s.teamB,
      overs: s.overs
    };
  }
}



function trackMatchComplete(result, summary, team1, team2, overs) {
  const payload = { name: 'match-complete', data: { result, summary, team1, team2, overs } };
  const queue = JSON.parse(localStorage.getItem('umami_queue') || '[]');
  queue.push(payload);
  localStorage.setItem('umami_queue', JSON.stringify(queue));
  flushUmamiQueue();
}

function flushUmamiQueue() {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem('umami_queue') || '[]');
  if (!queue.length) return;
  queue.forEach(e => window.umami?.track(e.name, e.data));
  localStorage.removeItem('umami_queue');
}

window.addEventListener('online', flushUmamiQueue);

// ═══════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════

function renderAll() {
  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlFigs();
  applyScoringUI();
}

function applyScoringUI() {
  const isShort = !!G.setup?.shortCric;
  document.querySelectorAll('.rb.six').forEach(btn => {
    btn.disabled    = isShort;
    btn.style.opacity = isShort ? '0.35' : '';
    btn.title       = isShort ? '6 = OUT in Short Cricket' : '';
  });
}

function renderHeader() {
  const s = G.setup;
  $('hdrTeams').textContent = `${s.teamA} vs ${s.teamB}`;
  $('hdrFmt').textContent   = `${s.overs} Ov`;
  $('sbTeam').textContent   = G.match.battingTeam;
}

function renderScore() {
  const m = G.match, s = G.setup;
  const ov = Math.floor(m.balls / 6), bl = m.balls % 6;
  const rr = m.balls > 0 ? ((m.runs / m.balls) * 6).toFixed(2) : '0.00';

  $('sbRuns').textContent = m.runs;
  $('sbWk').textContent   = `/${m.wickets}`;
  $('sbOv').textContent   = `${ov}.${bl}`;

  if (m.innings === 2 && G.inn1) {
    const ballsLeft = (s.overs * 6) - m.balls;
    const runsNeeded = G.inn1.runs + 1 - m.runs;
    const rrr = ballsLeft > 0 && runsNeeded > 0 ?
      ((runsNeeded / ballsLeft) * 6).toFixed(2) :
      runsNeeded <= 0 ? '✓' : '—';
    $('sbRR').textContent = rrr;
    $('sbRRLabel').textContent = 'RRR';
  } else {
    $('sbRR').textContent = rr;
    $('sbRRLabel').textContent = 'CRR';
  }
  
  $('progFill').style.width = Math.min((m.balls / (s.overs * 6)) * 100, 100) + '%';

  if (m.innings === 2 && G.inn1) {
    const need = G.inn1.runs + 1 - m.runs;
    const left = (s.overs * 6) - m.balls;
    $('sbNeed').textContent = need <= 0 ? '✓ Won' : left > 0 ? `${need} off ${left}b` : '—';
  }
}

function ballCls(b) {
  if (b.isW)                             return 'bW';
  if (b.extra === 'wide')                return 'bw';
  if (b.extra === 'noball')              return 'bnb';
  if (b.extra === 'bye' || b.extra === 'legbye') return 'bb';
  if (b.runs === 4)                      return 'b4';
  if (b.runs === 6)                      return 'b6';
  if (b.runs === 0)                      return 'bd';
  return 'br';
}

function ballLbl(b) {
  if (b.isW)               return 'W';
  if (b.extra === 'wide')  return 'Wd';
  if (b.extra === 'noball') return 'NB';
  if (b.extra === 'bye')   return 'B';
  if (b.extra === 'legbye') return 'LB';
  if (b.runs === 0)        return '·';
  return b.runs;
}

function renderBalls() {
  const m = G.match, row = $('ballsRow');
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
  $('overInfo').textContent =
    `Over ${overNum} · Ball ${ballNum}/6 · W:${m.extras.wide} NB:${m.extras.noball} B:${m.extras.bye} LB:${m.extras.legbye}`;

  if (m.curBowler) {
    const b   = m.bowlMap[m.curBowler];
    const bov = Math.floor((b?.balls || 0) / 6), bbl = (b?.balls || 0) % 6;
    $('bowlerBadge').textContent = `${m.curBowler} · ${bov}.${bbl}/${b?.maxOv || '?'} ov`;
  } else {
    $('bowlerBadge').textContent = m.needBowler ? 'Select bowler ↑' : '—';
  }
}

function renderBatsmen() {
  const m = G.match;
  const s = m.bat[m.striker];
  const ns = m.nonStriker !== -1 ? m.bat[m.nonStriker] : null;
  
  $('strName').textContent = s?.name || '—';
  $('strR').textContent = s?.runs || 0;
  $('strB').textContent = s?.balls || 0;
  $('str4').textContent = s?.fours || 0;
  $('str6').textContent = s?.sixes || 0;
  const sr = s && s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
  $('strSR').textContent = sr;
  
  const nsRow = $('nsRow');
  if (ns) {
    nsRow.style.display = '';
    $('nsName').textContent = ns.name || '—';
    $('nsR').textContent = ns.runs || 0;
    $('nsB').textContent = ns.balls || 0;
  } else {
    nsRow.style.display = 'none';
    $('nsName').textContent = '—';
    $('nsR').textContent = 0;
    $('nsB').textContent = 0;
  }
}

function renderBowlFigs() {
  const m = G.match, box = $('bowlFigs');
  box.innerHTML = '';
  m.bowlOrder.forEach(name => {
    const b = m.bowlMap[name];
    if (!b) return;
    const ov    = Math.floor(b.balls / 6), rb = b.balls % 6;
    const econ  = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '—';
    const maxOv = b.maxOv !== null ? b.maxOv : getMaxOvForBowler(name, m);
    const left  = maxOv - ov;
    const row   = el('div', 'bfr');
    row.innerHTML = `
      <div class="bfr-nm ${name === m.curBowler ? 'cur' : ''}">${name}</div>
      <div class="bfr-stats">
        <span>${ov}.${rb}ov</span><span>${b.runs}r</span>
        <span>${b.wickets}w</span><span>${econ}eco</span>
      </div>
      <div class="bfr-quota ${left <= 0 ? 'done' : ''}">${left > 0 ? left + ' left' : 'done'}</div>`;
    box.appendChild(row);
  });
}

function toggleSC() {
  const p = $('scPanel');
  const open = p.style.display === 'none' || p.style.display === '';
  p.style.display = open ? 'block' : 'none';
  if (open) renderScorecard();
}

function renderScorecard() {
  const m = G.match;
  const s = G.setup;
  const byeAllowed = s.byeAllowed !== false;
  const isShortCric = !!s.shortCric;

  /* ── Batting ─────────────────────────────── */
  const batRows  = $('iscBatRows');
  const batMeta  = $('iscBatMeta');
  batRows.innerHTML = '';

  let totalRuns = 0, totalBalls = 0, activeBats = 0;

  m.bat.forEach((b, i) => {
    const isStriker    = i === m.striker;
    const isNonStriker = i === m.nonStriker;
    const isActive     = isStriker || isNonStriker;
    const isOut        = b.out;
    const dnb          = b.notYet && !b.out;

    if (dnb) {
      // yet to bat — show as DNB row at bottom
      const row = el('div', 'isc-dnb-row');
      row.textContent = `${b.name} — yet to bat`;
      batRows.appendChild(row);
      return;
    }

    totalRuns  += b.runs;
    totalBalls += b.balls;
    if (isActive) activeBats++;

    const sr = b.balls > 0 ? (b.runs / b.balls * 100).toFixed(1) : '—';
    const srClass = b.balls > 0
      ? (parseFloat(sr) >= 120 ? 'sr-hot' : parseFloat(sr) >= 80 ? 'sr-mid' : 'sr-cold')
      : '';

    let statusLabel = '';
    if (isStriker)    statusLabel = '⚡';
    else if (isNonStriker) statusLabel = '🏏';

    const howOut = isActive
      ? (isStriker ? 'on strike' : 'non-striker')
      : (isOut ? b.howOut : 'not out');

    const row = el('div',
      'isc-bat-row' +
      (isStriker    ? ' is-striker'    : '') +
      (isNonStriker ? ' is-nonstriker' : '') +
      (isOut        ? ' is-out'        : '')
    );

    row.innerHTML = `
      <div class="isc-nm">
        <div class="isc-nm-name">${statusLabel ? statusLabel + ' ' : ''}${b.name}</div>
        <div class="isc-nm-sub">${howOut}</div>
      </div>
      <div style="flex:1"></div>
      <div class="isc-stat isc-stat-r">${b.runs}</div>
      <div class="isc-stat isc-stat-b">(${b.balls})</div>
      <div class="isc-stat isc-stat-4">${b.fours}</div>
      <div class="isc-stat isc-stat-6">${b.sixes}</div>
      <div class="isc-stat isc-stat-sr ${srClass}">${sr}</div>`;

    batRows.appendChild(row);
  });

  // Section meta: total runs off bat
  const runsBat = m.runs - (m.extras.wide||0) - (m.extras.noball||0) - (m.extras.bye||0) - (m.extras.legbye||0);
  batMeta.innerHTML = `
  <span class="isc-meta-runs">${runsBat}</span>
  <span class="isc-meta-sep">bat ·</span>
  <span class="isc-meta-total">${m.runs} total</span>`;

  /* ── Extras ──────────────────────────────── */
  const extEl = $('iscExtras');
  extEl.innerHTML = '';

  const extDefs = [
    { key: 'wide',   label: 'Wd',  enabled: true },
    { key: 'noball', label: 'NB',  enabled: true },
    { key: 'bye',    label: 'B',   enabled: byeAllowed },
    { key: 'legbye', label: 'LB',  enabled: byeAllowed },
  ];

  const totalExtras = (m.extras.wide||0) + (m.extras.noball||0) +
    (byeAllowed ? (m.extras.bye||0) + (m.extras.legbye||0) : 0);

  // Total extras chip first
  const totChip = el('div', 'isc-ext-item' + (totalExtras > 0 ? ' has-val' : ''));
  totChip.innerHTML = `
    <div class="isc-ext-label">Ext</div>
    <div class="isc-ext-val">${totalExtras}</div>`;
  extEl.appendChild(totChip);

  extDefs.forEach(({ key, label, enabled }) => {
    const val  = m.extras[key] || 0;
    const chip = el('div',
      'isc-ext-item' +
      (val > 0 ? ' has-val' : '') +
      (!enabled ? ' disabled-ext' : '')
    );
    chip.innerHTML = `
      <div class="isc-ext-label">${label}</div>
      <div class="isc-ext-val">${enabled ? val : '—'}</div>`;
    extEl.appendChild(chip);
  });

  // Short cric 6 indicator
  if (isShortCric) {
    const chip = el('div', 'isc-ext-item disabled-ext');
    chip.innerHTML = `<div class="isc-ext-label">6s</div><div class="isc-ext-val" style="font-size:10px;color:var(--t3)">OFF</div>`;
    extEl.appendChild(chip);
  }

  /* ── Over Summary ────────────────────────── */
  const ovWrap = $('iscOversWrap');
  const ovStrip = $('iscOvStrip');
  const ovMeta  = $('iscOvMeta');
  ovStrip.innerHTML = '';

  if (m.doneOvers && m.doneOvers.length > 0) {
    ovWrap.style.display = '';
    let maxOvRuns = 0;

    const ovData = m.doneOvers.map((ov, i) => {
      const runs   = ov.reduce((s, b) => s + b.runs, 0);
      const wkts   = ov.filter(b => b.isW).length;
      const maiden = runs === 0;
      if (runs > maxOvRuns) maxOvRuns = runs;
      return { i, runs, wkts, maiden };
    });

    ovData.forEach(({ i, runs, wkts, maiden }) => {
      const isHigh = runs >= Math.max(maxOvRuns * 0.7, 10);
      const chip = el('div',
        'isc-ov-chip' +
        (isHigh  ? ' ov-high'   : '') +
        (maiden  ? ' ov-maiden' : '')
      );
      chip.innerHTML = `
        <div class="isc-ov-num">O${i + 1}</div>
        <div class="isc-ov-runs">${runs}${wkts > 0 ? '<span style="font-size:9px;color:#f87171;margin-left:1px">-' + wkts + 'W</span>' : ''}</div>`;
      ovStrip.appendChild(chip);
    });

    const totalOvRuns = ovData.reduce((s, o) => s + o.runs, 0);
    const avgPerOv    = (totalOvRuns / ovData.length).toFixed(1);
    ovMeta.textContent = `${ovData.length} ov · avg ${avgPerOv}`;
  } else {
    ovWrap.style.display = 'none';
  }

  /* ── Bowling ─────────────────────────────── */
  const bowlRows = $('iscBowlRows');
  const bowlMeta = $('iscBowlMeta');
  bowlRows.innerHTML = '';

  if (!m.bowlOrder.length) {
    const empty = el('div', 'isc-dnb-row');
    empty.textContent = 'No bowlers yet';
    bowlRows.appendChild(empty);
    bowlMeta.textContent = '';
  } else {
    let totalWkts = 0;

    m.bowlOrder.forEach(name => {
      const b = m.bowlMap[name];
      if (!b) return;
      const ov     = Math.floor(b.balls / 6);
      const rem    = b.balls % 6;
      const eco    = b.balls > 0 ? (b.runs / b.balls * 6).toFixed(2) : '—';
      const isCur  = name === m.curBowler;
      const maxOv  = getMaxOvForBowler(name, m);
      const left   = maxOv - ov;
      const ecoNum = parseFloat(eco);
      const ecoClass = b.balls > 0
        ? (ecoNum < 7 ? 'eco-good' : ecoNum < 10 ? 'eco-mid' : 'eco-bad')
        : '';

      totalWkts += b.wickets;

      const wdNb = [];
      if (b.wides)  wdNb.push(`${b.wides}wd`);
      if (b.noballs) wdNb.push(`${b.noballs}nb`);

      const row = el('div', 'isc-bowl-row' + (isCur ? ' is-cur' : ''));
      row.innerHTML = `
        <div class="isc-bowl-nm">
          <div class="isc-bowl-nm-name">${isCur ? '▶ ' : ''}${name}</div>
          <div class="isc-bowl-nm-sub">${left > 0 ? left + ' ov left' : 'quota done'}${wdNb.length ? ' · ' + wdNb.join(' ') : ''}</div>
        </div>
        <div style="flex:1"></div>
        <div class="isc-stat isc-stat-ov">${ov}.${rem}</div>
        <div class="isc-stat isc-stat-br">${b.runs}</div>
        <div class="isc-stat isc-stat-bw">${b.wickets}w</div>
        <div class="isc-stat isc-stat-eco ${ecoClass}">${eco}</div>`;

      bowlRows.appendChild(row);
    });

    bowlMeta.innerHTML = `
    <span class="isc-meta-bowlers">${m.bowlOrder.length} bowlers</span>
    <span class="isc-meta-sep">·</span>
   <span class="isc-meta-wk">${totalWkts}w</span>`;
  }
}

function flash(type) {
  const sb = $('scoreboard');
  sb.classList.remove('flash-g', 'flash-r');
  void sb.offsetWidth;
  if (type) sb.classList.add('flash-' + type);
}

// ── RESET ─────────────────────────────────────
function doReset() { openModal('resetModal'); }

function doNewMatch() {
  if (G.match?.pendingTrack) {
    const t = G.match.pendingTrack;
    trackMatchComplete(t.result, t.summary, t.team1, t.team2, t.overs);
  }
  closeModal('resetModal');
  clearState();
  tierRows = [];
  G = {
    screen: 'setup',
    setup: { team1: '', team2: '', overs: 20, players: 11, team1Names: [], team2Names: [], tiers: [], batFirst: '' },
    match: null, inn1: null,
  };
  $('inn2Btn').style.display = 'none';
  $('tgtBlk').style.display = 'none';
  $('rrrBlk').style.display = 'none';
  $('innLbl').textContent   = '1st Innings';
  showScreen('setup');
  initSetup();
  location.reload();
}

function doRematch() {
  if (G.match?.pendingTrack) {
    const t = G.match.pendingTrack;
    trackMatchComplete(t.result, t.summary, t.team1, t.team2, t.overs);
  }
  closeModal('resetModal');
  const savedSetup = {
    team1:      G.setup.team1,
    team2:      G.setup.team2,
    overs:      G.setup.overs,
    players:    G.setup.players,
    team1Names: [...(G.setup.team1Names || [])],
    team2Names: [...(G.setup.team2Names || [])],
    tiers:      G.setup.tiers ? G.setup.tiers.map(t => ({ ...t })) : [],
    batFirst:   '',
  };
  tierRows = savedSetup.tiers.length ? savedSetup.tiers : tierRows;
  G = { screen: 'setup', setup: savedSetup, match: null, inn1: null };
  $('inn2Btn').style.display = 'none';
  $('tgtBlk').style.display = 'none';
  $('rrrBlk').style.display = 'none';
  $('innLbl').textContent   = '1st Innings';
  showScreen('setup');
  initSetup();
  saveState();
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
        $('sbTgt').textContent    = G.inn1.runs + 1;
        $('innLbl').textContent   = '2nd Innings';
      }
      if (G.match.needBatsmen && !G.match.done) {
        openOpeningBatsmenModal();
      } else if (G.match.needBowler && !G.match.done) {
        openBowlerModal();
      }
      return;
    }
  }

  initSetup();
});

// ═══════════════════════════════════════════════
//  DOWNLOAD SUMMARY (canvas)
// ═══════════════════════════════════════════════

async function loadFonts() {
  try {
    await document.fonts.load('bold 12px Rajdhani');
    await document.fonts.load('600 12px Montserrat');
    await document.fonts.ready;
  } catch (e) {}
}

async function downloadSummary() {
  await loadFonts();
  const m = G.match, s = G.setup, i1 = G.inn1FullData;
  const { winnerMsg, winnerTeam } = G.resultData;
  const inn1Team = i1 ? (s.batFirst === s.team1 ? s.team1 : s.team2) : s.teamA;
  const inn2Team = i1 ? (s.batFirst === s.team1 ? s.team2 : s.team1) : s.teamA;

  const W = 800, PAD = 32;
  const COLS_W = [210, 190, 52, 52, 44, 44, 64];
  const COLS_X = [PAD];
  COLS_W.forEach((w, i) => { if (i < COLS_W.length - 1) COLS_X.push(COLS_X[i] + w); });

  let rows = [];

  function collectBat(batArr, teamName, color, score) {
    rows.push({ type: 'inn', text: teamName, score, color });
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
      const ov  = Math.floor(b.balls / 6), rb = b.balls % 6;
      const eco = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : '-';
      rows.push({ type: 'bowl', cols: [name, `${ov}.${rb}`, b.runs, b.wickets, b.wides || 0, b.noballs || 0, eco] });
    });
    rows.push({ type: 'inn-gap' });
  }

  if (i1) {
    collectBat(i1.bat, inn1Team, 'blue', `${i1.runs}/${i1.wickets} (${Math.floor(i1.balls/6)}.${i1.balls%6} ov)`);
    collectBowl(i1.bowlMap, i1.bowlOrder);
  }
  collectBat(m.bat, inn2Team, 'red', `${m.runs}/${m.wickets} (${Math.floor(m.balls/6)}.${m.balls%6} ov)`);
  collectBowl(m.bowlMap, m.bowlOrder);

  const ROW_H = 28, INN_H = 38, HD_H = 24, GAP_H = 12, INN_GAP_H = 10;
  const HDR_H = 86, HERO_H = 118, FOOTER_H = 20;
  let tableH = 0;
  rows.forEach(r => {
    if (r.type === 'inn')                  tableH += INN_H + 10;
    else if (r.type === 'hd' || r.type === 'bowl-hd') tableH += HD_H + 6;
    else if (r.type === 'gap')             tableH += GAP_H;
    else if (r.type === 'inn-gap')         tableH += INN_GAP_H;
    else                                   tableH += ROW_H;
  });
  const totalH = HDR_H + HERO_H + tableH + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width  = W * 2;
  canvas.height = totalH * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
  bgGrad.addColorStop(0, '#111827'); bgGrad.addColorStop(1, '#0d1117');
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, totalH);
  const glow = ctx.createRadialGradient(200, 0, 0, 200, 0, 300);
  glow.addColorStop(0, 'rgba(21,101,192,0.12)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, totalH);

  // Header bg
  ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(0, 0, W, HDR_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HDR_H); ctx.lineTo(W, HDR_H); ctx.stroke();

  // Logo
  const logoImg = new Image(); logoImg.src = './favicon.svg';
  await new Promise(res => { logoImg.onload = res; logoImg.onerror = res; setTimeout(res, 600); });
  const LOGO_H = 54, logoY = (HDR_H - LOGO_H) / 2;
  let logoDrawW = LOGO_H;
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    logoDrawW = LOGO_H * (logoImg.naturalWidth / logoImg.naturalHeight);
    ctx.drawImage(logoImg, PAD, logoY, logoDrawW, LOGO_H);
  }

  // Brand text
  const tx = PAD + logoDrawW + 14;
  const brandBlockY = (HDR_H - 42) / 2 + 5;
  ctx.textAlign = 'left';
  ctx.font = 'bold italic 32px Rajdhani, sans-serif';
  ctx.fillStyle = '#1565C0'; ctx.fillText('CRICKET', tx, brandBlockY + 18);
  const cW = ctx.measureText('CRICKET ').width;
  ctx.fillStyle = '#D32F2F'; ctx.fillText('SCORE', tx + cW, brandBlockY + 18);

  const tagText = 'CRICKET SCORING TOOL';
  const tagY    = brandBlockY + 34;
  ctx.font = 'bold italic 32px Rajdhani, sans-serif';
  const brandCenterX = tx + (ctx.measureText('CRICKET ').width + ctx.measureText('SCORE').width) / 2;
  ctx.font = '600 7.5px Montserrat, sans-serif';
  let actualTagW = 0;
  for (const ch of tagText) actualTagW += ctx.measureText(ch).width + 3.5;
  actualTagW -= 3.5;
  const totalTagW    = 18 + 6 + actualTagW + 6 + 18;
  const taglineStartX = brandCenterX - totalTagW / 2;
  const lineVertical  = tagY - 4;
  ctx.fillStyle = '#1565C0'; ctx.fillRect(taglineStartX, lineVertical, 18, 1.5);
  ctx.fillStyle = '#8b949e';
  let curX = taglineStartX + 18 + 6;
  for (const ch of tagText) { ctx.fillText(ch, curX, tagY); curX += ctx.measureText(ch).width + 3.5; }
  ctx.fillStyle = '#D32F2F'; ctx.fillRect(taglineStartX + 18 + 6 + actualTagW + 6, lineVertical, 18, 1.5);

  // QR
  const QR_SIZE = 54;
  const qrX = W - PAD - QR_SIZE, qrY_hdr = (HDR_H - QR_SIZE) / 2;
  const siteUrl = window.location.origin + window.location.pathname;
  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
  ctx.textAlign = 'right'; ctx.font = '700 10px Inter, sans-serif';
  ctx.fillStyle = '#60a5fa'; ctx.fillText(dateStr, qrX - 14, HDR_H / 2 + 4); ctx.textAlign = 'left';

  const qrHolder = document.createElement('div');
  qrHolder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px;';
  document.body.appendChild(qrHolder);
  await new Promise(resolve => {
    try {
      new QRCode(qrHolder, { text: siteUrl, width: 200, height: 200, colorDark: '#1e2736', colorLight: '#8b949e', correctLevel: QRCode.CorrectLevel.M });
      setTimeout(resolve, 200);
    } catch (e) { resolve(); }
  });
  const qrEl = qrHolder.querySelector('canvas') || qrHolder.querySelector('img');
  ctx.fillStyle = '#8b949e'; roundRect(ctx, qrX - 4, qrY_hdr - 4, QR_SIZE + 8, QR_SIZE + 8, 5); ctx.fill();
  if (qrEl) ctx.drawImage(qrEl, qrX, qrY_hdr, QR_SIZE, QR_SIZE);
  document.body.removeChild(qrHolder);

  // Hero
  let y = HDR_H + 16;
  ctx.textAlign = 'center';
  ctx.font = '34px serif'; ctx.fillText(winnerTeam === 'Tie' ? '🤝' : '🏆', W / 2, y + 34); y += 46;
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 28px Inter, sans-serif'; ctx.fillText(winnerMsg, W / 2, y + 26); y += 36;
  ctx.fillStyle = '#8b949e'; ctx.font = '13px Inter, sans-serif';
  ctx.fillText(`${inn1Team}  vs  ${inn2Team || s.teamB}  ·  ${s.overs} Overs`, W / 2, y + 16); y += 28;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); y += 14;

  // Table rows
  ctx.textAlign = 'left';
  rows.forEach(r => {
    if (r.type === 'inn') {
      const isBlue = r.color === 'blue';
      ctx.fillStyle = isBlue ? 'rgba(21,101,192,0.18)' : 'rgba(185,28,28,0.18)';
      roundRect(ctx, 0, y, W, INN_H, 0); ctx.fill();
      ctx.fillStyle = isBlue ? '#1565C0' : '#991b1b'; ctx.fillRect(0, y, 4, INN_H);
      ctx.fillStyle = isBlue ? '#60a5fa' : '#f87171'; ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(r.text, PAD + 6, y + INN_H / 2 + 5);
      ctx.fillStyle = '#e6edf3'; ctx.font = '600 13px Inter, sans-serif';
      ctx.textAlign = 'right'; ctx.fillText(r.score || '', W - PAD, y + INN_H / 2 + 5);
      ctx.textAlign = 'left'; y += INN_H + 10;
    } else if (r.type === 'hd' || r.type === 'bowl-hd') {
      ctx.fillStyle = '#3d4f63'; ctx.font = '600 10px Inter, sans-serif';
      r.cols.forEach((c, i) => {
        ctx.textAlign = i > 1 ? 'right' : 'left';
        const cx = i === r.cols.length - 1 ? W - PAD : (i > 1 ? COLS_X[i] + COLS_W[i] : COLS_X[i]);
        ctx.fillText(String(c).toUpperCase(), cx, y + 14);
      });
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y + HD_H + 3); ctx.lineTo(W - PAD, y + HD_H + 3); ctx.stroke();
      y += HD_H + 6;
    } else if (r.type === 'gap') {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y + GAP_H / 2); ctx.lineTo(W - PAD, y + GAP_H / 2); ctx.stroke();
      y += GAP_H;
    } else if (r.type === 'inn-gap') {
      y += INN_GAP_H;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.012)'; ctx.fillRect(0, y, W, ROW_H);
      r.cols.forEach((c, i) => {
        let color = '#c9d1d9';
        if (i === 1) color = '#4a5568';
        if (i === 2) color = '#22c55e';
        if (i === 3 && r.type === 'bowl') color = '#f87171';
        if (i === 4 && r.type === 'bat')  color = '#60a5fa';
        if (i === 5 && r.type === 'bat')  color = '#f0b429';
        ctx.fillStyle = color;
        ctx.textAlign = i > 1 ? 'right' : 'left';
        ctx.font = i === 0 ? '500 12px Inter, sans-serif' : '12px Inter, sans-serif';
        const cx = i === r.cols.length - 1 ? W - PAD : (i > 1 ? COLS_X[i] + COLS_W[i] : COLS_X[i]);
        ctx.fillText(String(c), cx, y + 19);
      });
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y + ROW_H); ctx.lineTo(W - PAD, y + ROW_H); ctx.stroke();
      y += ROW_H;
    }
  });

  // Download
  const link = document.createElement('a');
  link.download = `${s.teamA}_vs_${s.teamB}_summary.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
