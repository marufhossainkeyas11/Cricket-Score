// ===== STATE =====
let state = {
  setup: {
    teamA: '', teamB: '',
    totalOvers: 20,
    playersCount: 11,
    battingPlayers: [],    // team batting first
    bowlingPlayers: [],    // team bowling first
    bowlerOvers: {},       // bowler name -> allocated overs
  },
  match: {
    innings: 1,            // 1 or 2
    runs: 0,
    wickets: 0,
    balls: 0,              // legal deliveries
    totalBalls: 0,         // all deliveries including extras
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    currentOver: [],       // array of ball objects for current over
    overs: [],             // completed overs
    // Batsmen
    striker: null,
    nonStriker: null,
    battingOrder: [],      // remaining batsmen indices
    batsmen: [],           // [{name, runs, balls, fours, sixes, dismissed, howOut, notBat}]
    // Bowling
    currentBowler: null,   // index in bowlerStats
    bowlerStats: [],       // [{name, overs(float), runs, wickets, wides, noballs, allocatedOvers}]
    pendingBowlerSelect: false,
    // History for undo
    history: [],
    // Match state
    matchOver: false,
  },
  innings1Score: null,     // saved after 1st innings
};

// ===== SETUP SCREEN =====

function initSetup() {
  const playerCount = parseInt(document.getElementById('players-count').value) || 11;
  const totalOvers = parseInt(document.getElementById('total-overs').value) || 20;
  generatePlayerInputs(playerCount);
  generateBowlerOvers(playerCount, totalOvers);
  updateOverHint(totalOvers, playerCount);
}

function generatePlayerInputs(count) {
  const bGrid = document.getElementById('batting-players');
  const bowlGrid = document.getElementById('bowling-players');
  bGrid.innerHTML = '';
  bowlGrid.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const bi = document.createElement('input');
    bi.type = 'text';
    bi.id = `bat-p${i}`;
    bi.placeholder = `Batsman ${i + 1}`;
    bi.maxLength = 18;
    bi.value = state.setup.battingPlayers[i] || '';
    bGrid.appendChild(bi);

    const bwi = document.createElement('input');
    bwi.type = 'text';
    bwi.id = `bowl-p${i}`;
    bwi.placeholder = `Bowler ${i + 1}`;
    bwi.maxLength = 18;
    bwi.value = state.setup.bowlingPlayers[i] || '';
    bowlGrid.appendChild(bwi);
  }
}

function generateBowlerOvers(count, totalOvers) {
  const grid = document.getElementById('bowler-overs-grid');
  grid.innerHTML = '';

  const maxOvers = Math.ceil(totalOvers / Math.min(count, 5));
  const bowlingCount = Math.min(count, 11);

  for (let i = 0; i < bowlingCount; i++) {
    const item = document.createElement('div');
    item.className = 'bowler-over-item';

    const label = document.createElement('label');
    label.id = `bowl-label-${i}`;
    label.textContent = `Bowler ${i + 1}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `bowl-ov${i}`;
    input.min = 0;
    input.max = maxOvers;
    input.placeholder = '0';
    input.addEventListener('input', validateOverAllocation);

    item.appendChild(label);
    item.appendChild(input);
    grid.appendChild(item);
  }

  // Update labels when bowler names change
  for (let i = 0; i < count; i++) {
    const bowlInput = document.getElementById(`bowl-p${i}`);
    if (bowlInput) {
      bowlInput.addEventListener('input', () => {
        const lbl = document.getElementById(`bowl-label-${i}`);
        if (lbl) lbl.textContent = bowlInput.value || `Bowler ${i + 1}`;
      });
    }
  }
}

function updateOverHint(totalOvers, playerCount) {
  const hint = document.getElementById('over-hint');
  const maxPerBowler = Math.ceil(totalOvers / Math.min(playerCount, 5));
  hint.textContent = `(Total: ${totalOvers}, max ${maxPerBowler} per bowler)`;
}

function validateOverAllocation() {
  const totalOvers = parseInt(document.getElementById('total-overs').value) || 20;
  const count = parseInt(document.getElementById('players-count').value) || 11;
  const bowlCount = Math.min(count, 11);
  const validation = document.getElementById('over-validation');

  let total = 0;
  const overs = [];
  for (let i = 0; i < bowlCount; i++) {
    const v = parseInt(document.getElementById(`bowl-ov${i}`)?.value) || 0;
    total += v;
    overs.push(v);
  }

  const maxPerBowler = Math.ceil(totalOvers / Math.min(count, 5));
  const overMax = overs.some(o => o > maxPerBowler);

  if (total === totalOvers && !overMax) {
    validation.className = 'over-validation valid';
    validation.textContent = `✓ ${total}/${totalOvers} overs allocated correctly`;
  } else if (total > totalOvers) {
    validation.className = 'over-validation invalid';
    validation.textContent = `✗ Over-allocated: ${total}/${totalOvers} (${total - totalOvers} extra)`;
  } else if (overMax) {
    validation.className = 'over-validation invalid';
    validation.textContent = `✗ Max ${maxPerBowler} overs per bowler allowed`;
  } else {
    validation.className = 'over-validation invalid';
    validation.textContent = `✗ Allocated: ${total}/${totalOvers} — need ${totalOvers - total} more`;
  }
}

// Event listeners for setup
document.getElementById('players-count').addEventListener('input', () => {
  const count = parseInt(document.getElementById('players-count').value) || 11;
  const overs = parseInt(document.getElementById('total-overs').value) || 20;
  generatePlayerInputs(count);
  generateBowlerOvers(count, overs);
  updateOverHint(overs, count);
});

document.getElementById('total-overs').addEventListener('input', () => {
  const count = parseInt(document.getElementById('players-count').value) || 11;
  const overs = parseInt(document.getElementById('total-overs').value) || 20;
  generateBowlerOvers(count, overs);
  updateOverHint(overs, count);
  validateOverAllocation();
});

// ===== START MATCH =====
function startMatch() {
  const teamA = document.getElementById('teamA-name').value.trim() || 'Team A';
  const teamB = document.getElementById('teamB-name').value.trim() || 'Team B';
  const totalOvers = parseInt(document.getElementById('total-overs').value) || 20;
  const count = parseInt(document.getElementById('players-count').value) || 11;

  // Collect player names
  const batting = [];
  const bowling = [];
  for (let i = 0; i < count; i++) {
    batting.push(document.getElementById(`bat-p${i}`)?.value.trim() || `Batsman ${i + 1}`);
    bowling.push(document.getElementById(`bowl-p${i}`)?.value.trim() || `Bowler ${i + 1}`);
  }

  // Collect bowler overs
  const bowlerOvers = {};
  const bowlCount = Math.min(count, 11);
  for (let i = 0; i < bowlCount; i++) {
    const name = bowling[i];
    const ov = parseInt(document.getElementById(`bowl-ov${i}`)?.value) || 0;
    bowlerOvers[name] = (bowlerOvers[name] || 0) + ov;
  }

  // Validate over allocation
  const totalAllocated = Object.values(bowlerOvers).reduce((a, b) => a + b, 0);
  if (totalAllocated !== totalOvers) {
    const v = document.getElementById('over-validation');
    v.className = 'over-validation invalid';
    v.textContent = `✗ Please allocate exactly ${totalOvers} overs before starting!`;
    v.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  state.setup = { teamA, teamB, totalOvers, playersCount: count, battingPlayers: batting, bowlingPlayers: bowling, bowlerOvers };

  // Initialize match
  initInnings(1);

  // Switch screens
  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('scoring-screen').classList.add('active');

  // Ask for opening batsmen and bowler
  setTimeout(() => {
    showOpeningSetup();
  }, 100);
}

function initInnings(innings) {
  const s = state.setup;
  const isFirst = innings === 1;

  const battingTeam = isFirst ? s.battingPlayers : s.bowlingPlayers;
  const bowlingTeam = isFirst ? s.bowlingPlayers : s.battingPlayers;
  const bowlerOversMap = s.bowlerOvers; // same allocation for both (simplification)

  state.match = {
    innings,
    runs: 0, wickets: 0, balls: 0, totalBalls: 0,
    extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
    currentOver: [],
    overs: [],
    striker: 0, nonStriker: 1,
    battingOrder: Array.from({ length: battingTeam.length - 2 }, (_, i) => i + 2),
    batsmen: battingTeam.map(name => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, dismissed: false, howOut: '', notBat: true })),
    currentBowler: null,
    bowlerStats: bowlingTeam.map(name => ({
      name, overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0,
      allocatedOvers: bowlerOversMap[name] || 0
    })),
    pendingBowlerSelect: false,
    history: [],
    matchOver: false,
  };

  // Mark opening batsmen as "in"
  state.match.batsmen[0].notBat = false;
  state.match.batsmen[1].notBat = false;

  updateHeader();
  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlerStats();
}

function showOpeningSetup() {
  // Show bowler selection modal for first over
  showBowlerSelectModal();
}

// ===== BALL LOGGING =====
function addBall(opts) {
  const m = state.match;
  if (m.matchOver || m.pendingBowlerSelect) return;
  if (m.currentBowler === null) { showBowlerSelectModal(); return; }

  const { runs = 0, extra = null } = opts;
  const isExtra = extra !== null;
  const isLegalDelivery = extra !== 'wide' && extra !== 'noball';

  // Save history snapshot
  saveHistory();

  const ball = { runs, extra, isLegal: isLegalDelivery };

  // Update runs
  m.runs += runs;

  // Update extras
  if (extra === 'wide') { m.extras.wide++; m.runs += 0; } // run already in runs
  if (extra === 'noball') m.extras.noball++;
  if (extra === 'bye') { m.extras.bye++; m.runs -= runs; m.runs += runs; } // bye runs don't count to batsman
  if (extra === 'legbye') { m.extras.legbye++; }

  // Runs to batsman (not for bye/legbye/wide)
  if (!extra || extra === 'noball') {
    m.batsmen[m.striker].runs += runs;
    m.batsmen[m.striker].fours += runs === 4 ? 1 : 0;
    m.batsmen[m.striker].sixes += runs === 6 ? 1 : 0;
  }

  // Balls faced
  if (isLegalDelivery) {
    m.batsmen[m.striker].balls++;
  }

  // Bowler stats
  const bowler = m.bowlerStats[m.currentBowler];
  bowler.runs += runs;
  if (extra === 'wide') bowler.wides++;
  if (extra === 'noball') bowler.noballs++;
  if (isLegalDelivery) bowler.balls++;

  // Legal ball count
  if (isLegalDelivery) {
    m.balls++;
  }
  m.totalBalls++;

  // Striker rotation on odd runs (only for legal deliveries, and not wide)
  if (isLegalDelivery && runs % 2 === 1) {
    swapBatsmen();
  }

  // Current over ball entry
  m.currentOver.push(ball);

  // Flash score area
  flashScore(runs, extra);

  // Over complete?
  if (isLegalDelivery && m.balls % 6 === 0 && m.balls > 0) {
    completeOver();
    return; // wait for bowler selection before rendering
  }

  // Check innings over
  checkInningsOver();

  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlerStats();
}

function completeOver() {
  const m = state.match;
  const overNum = Math.floor(m.balls / 6);

  // Save over
  m.overs.push({ balls: [...m.currentOver], bowler: m.currentBowler, num: overNum });
  m.currentOver = [];

  // Update bowler overs
  const bowler = m.bowlerStats[m.currentBowler];
  bowler.overs = Math.floor(bowler.balls / 6) + (bowler.balls % 6) / 10;

  // Swap striker/non-striker at end of over
  swapBatsmen();

  checkInningsOver();

  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlerStats();

  if (!m.matchOver && m.balls < state.setup.totalOvers * 6) {
    // Need new bowler
    m.pendingBowlerSelect = true;
    setTimeout(() => showBowlerSelectModal(), 300);
  }
}

function swapBatsmen() {
  const m = state.match;
  const tmp = m.striker;
  m.striker = m.nonStriker;
  m.nonStriker = tmp;
}

function flashScore(runs, extra) {
  const el = document.querySelector('.scoreboard');
  if (!el) return;
  el.classList.remove('flash-green', 'flash-red');
  void el.offsetWidth;
  if (extra === 'wide' || extra === 'noball') {
    el.classList.add('flash-red');
  } else if (runs >= 4) {
    el.classList.add('flash-green');
  }
}

// ===== WICKET =====
let wicketData = { batsman: null, dismissal: null };

function showWicketModal() {
  const m = state.match;
  if (m.matchOver || m.pendingBowlerSelect) return;

  wicketData = { batsman: null, dismissal: null };

  // Populate batsman select (striker/non-striker)
  const sel = document.getElementById('wicket-batsman');
  sel.innerHTML = '';
  [m.striker, m.nonStriker].forEach(idx => {
    const o = document.createElement('option');
    o.value = idx;
    o.textContent = m.batsmen[idx].name;
    sel.appendChild(o);
  });

  // Clear dismissal selection
  document.querySelectorAll('.dis-btn').forEach(b => b.classList.remove('selected'));

  // New batsman
  const newSel = document.getElementById('new-batsman-select');
  newSel.innerHTML = '';
  m.battingOrder.forEach(idx => {
    const o = document.createElement('option');
    o.value = idx;
    o.textContent = m.batsmen[idx].name;
    newSel.appendChild(o);
  });

  const noMore = m.battingOrder.length === 0;
  document.getElementById('new-batsman-group').style.display = noMore ? 'none' : 'block';

  document.getElementById('wicket-modal').style.display = 'flex';
}

function selectDismissal(type) {
  wicketData.dismissal = type;
  document.querySelectorAll('.dis-btn').forEach(b => b.classList.remove('selected'));
  event.target.classList.add('selected');
}

function confirmWicket() {
  const m = state.match;
  if (!wicketData.dismissal) { alert('Please select dismissal type.'); return; }

  saveHistory();

  const outIdx = parseInt(document.getElementById('wicket-batsman').value);
  m.batsmen[outIdx].dismissed = true;
  m.batsmen[outIdx].howOut = wicketData.dismissal;

  const newSel = document.getElementById('new-batsman-select');
  const newBatsmanIdx = newSel.value !== '' ? parseInt(newSel.value) : null;

  m.wickets++;

  // Bowler gets wicket (not for run out)
  if (wicketData.dismissal !== 'Run Out' && m.currentBowler !== null) {
    m.bowlerStats[m.currentBowler].wickets++;
  }

  // Update balls
  m.balls++;
  m.batsmen[outIdx].balls++;
  if (m.currentBowler !== null) m.bowlerStats[m.currentBowler].balls++;

  // Ball record
  m.currentOver.push({ runs: 0, extra: null, isLegal: true, isWicket: true });

  // Bring in new batsman
  if (newBatsmanIdx !== null) {
    m.battingOrder = m.battingOrder.filter(i => i !== newBatsmanIdx);
    m.batsmen[newBatsmanIdx].notBat = false;
    // Put new batsman in place of out batsman
    if (m.striker === outIdx) m.striker = newBatsmanIdx;
    else m.nonStriker = newBatsmanIdx;
  }

  closeWicketModal();

  // Check over/innings
  if (m.balls % 6 === 0) {
    completeOver();
  } else {
    checkInningsOver();
    renderScore();
    renderBalls();
    renderBatsmen();
    renderBowlerStats();
  }
}

function closeWicketModal() {
  document.getElementById('wicket-modal').style.display = 'none';
}

// ===== BOWLER SELECT MODAL =====
let selectedBowlerIdx = null;

function showBowlerSelectModal() {
  const m = state.match;
  const list = document.getElementById('bowler-select-list');
  list.innerHTML = '';
  selectedBowlerIdx = null;

  const totalOvers = state.setup.totalOvers;
  const currentOversCount = Math.floor(m.balls / 6);
  const previousBowler = m.currentBowler;

  m.bowlerStats.forEach((bowler, idx) => {
    const bowlerOvers = Math.floor(bowler.balls / 6);
    const remaining = bowler.allocatedOvers - bowlerOvers;
    const isDisabled = remaining <= 0 || idx === previousBowler;

    const item = document.createElement('div');
    item.className = 'bowler-select-item' + (isDisabled ? ' disabled' : '');
    item.innerHTML = `
      <span class="bowler-select-name">${bowler.name}</span>
      <span class="bowler-select-quota">${bowlerOvers}.${bowler.balls % 6} / ${bowler.allocatedOvers} ov${remaining > 0 ? ` (${remaining} left)` : ' — done'}</span>
    `;

    if (!isDisabled) {
      item.onclick = () => {
        document.querySelectorAll('.bowler-select-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedBowlerIdx = idx;
      };
    }

    list.appendChild(item);
  });

  document.getElementById('bowler-modal').style.display = 'flex';
}

function confirmBowlerSelection() {
  if (selectedBowlerIdx === null) { alert('Please select a bowler.'); return; }
  state.match.currentBowler = selectedBowlerIdx;
  state.match.pendingBowlerSelect = false;
  document.getElementById('bowler-modal').style.display = 'none';

  renderScore();
  renderBalls();
  renderBowlerStats();
}

// ===== INNINGS TRANSITION =====
function checkInningsOver() {
  const m = state.match;
  const s = state.setup;
  const totalBalls = s.totalOvers * 6;

  const allOut = m.wickets >= s.playersCount - 1;
  const oversComplete = m.balls >= totalBalls;

  if (allOut || oversComplete) {
    m.matchOver = true;

    if (m.innings === 1) {
      state.innings1Score = { runs: m.runs, wickets: m.wickets, balls: m.balls };
      document.getElementById('innings-switch-btn').style.display = 'inline-block';
      setTimeout(() => showInnings2Prompt(), 600);
    } else {
      // Match finished
      setTimeout(() => showMatchResult(), 600);
    }
  }

  // 2nd innings run chase
  if (m.innings === 2 && state.innings1Score) {
    if (m.runs > state.innings1Score.runs) {
      m.matchOver = true;
      setTimeout(() => showMatchResult(), 400);
    }
  }
}

function showInnings2Prompt() {
  const s1 = state.innings1Score;
  const overs = Math.floor(s1.balls / 6);
  const balls = s1.balls % 6;
  const ovStr = `${overs}.${balls}`;

  document.getElementById('innings-summary-text').innerHTML =
    `<p><strong>${state.setup.teamA}</strong> scored <strong>${s1.runs}/${s1.wickets}</strong> in ${ovStr} overs.</p>`;
  document.getElementById('team2-batting-name').textContent = state.setup.teamB;
  document.getElementById('innings2-target').textContent = s1.runs + 1;

  document.getElementById('innings2-modal').style.display = 'flex';
}

function startSecondInnings() {
  document.getElementById('innings2-modal').style.display = 'none';
  // Swap teams: Team B bats, Team A bowls
  const tmp = state.setup.battingPlayers;
  state.setup.battingPlayers = state.setup.bowlingPlayers;
  state.setup.bowlingPlayers = tmp;

  initInnings(2);

  document.getElementById('innings-switch-btn').style.display = 'none';

  // Show target
  document.getElementById('target-block').style.display = 'flex';
  document.getElementById('rrr-block').style.display = 'flex';
  document.getElementById('score-target').textContent = state.innings1Score.runs + 1;
  document.getElementById('innings-label').textContent = '2nd Innings';

  showBowlerSelectModal();
}

function showMatchResult() {
  const m = state.match;
  const s = state.setup;
  let result = '';

  if (m.innings === 2 && state.innings1Score) {
    if (m.runs > state.innings1Score.runs) {
      const wicketsLeft = (s.playersCount - 1) - m.wickets;
      result = `🏆 ${s.teamB} wins by ${wicketsLeft} wickets!`;
    } else if (m.runs === state.innings1Score.runs) {
      result = `🤝 Match Tied!`;
    } else {
      const margin = state.innings1Score.runs - m.runs;
      result = `🏆 ${s.teamA} wins by ${margin} runs!`;
    }
  } else {
    result = `1st Innings Complete: ${s.teamA} — ${m.runs}/${m.wickets}`;
  }

  setTimeout(() => alert(result), 200);
}

// ===== UNDO =====
function saveHistory() {
  const snap = JSON.stringify(state.match);
  state.match.history.push(snap);
  if (state.match.history.length > 30) state.match.history.shift();
}

function undoLastBall() {
  if (!state.match.history.length) return;
  const snap = state.match.history.pop();
  state.match = JSON.parse(snap);
  renderScore();
  renderBalls();
  renderBatsmen();
  renderBowlerStats();
}

// ===== RENDERING =====
function updateHeader() {
  const s = state.setup;
  document.getElementById('header-teams').textContent = `${s.teamA} vs ${s.teamB}`;
  document.getElementById('header-format').textContent = `${s.totalOvers} Overs`;
}

function renderScore() {
  const m = state.match;
  const s = state.setup;
  const overs = Math.floor(m.balls / 6);
  const balls = m.balls % 6;
  const oversStr = `${overs}.${balls}`;
  const rr = m.balls > 0 ? ((m.runs / m.balls) * 6).toFixed(2) : '0.00';

  document.getElementById('score-runs').textContent = m.runs;
  document.getElementById('score-wickets').textContent = `/${m.wickets}`;
  document.getElementById('score-overs').textContent = oversStr;
  document.getElementById('score-rr').textContent = rr;

  // Innings progress
  const progress = (m.balls / (s.totalOvers * 6)) * 100;
  document.getElementById('innings-fill').style.width = Math.min(progress, 100) + '%';

  // RRR for 2nd innings
  if (m.innings === 2 && state.innings1Score) {
    const target = state.innings1Score.runs + 1;
    const ballsLeft = (s.totalOvers * 6) - m.balls;
    const runsNeeded = target - m.runs;
    const rrr = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : '—';
    document.getElementById('score-rrr').textContent = runsNeeded > 0 ? rrr : '✓';
  }
}

function renderBalls() {
  const m = state.match;
  const row = document.getElementById('balls-row');
  row.innerHTML = '';

  m.currentOver.forEach(ball => {
    const el = document.createElement('div');
    el.className = 'ball ' + getBallClass(ball);
    el.textContent = getBallLabel(ball);
    row.appendChild(el);
  });

  // Placeholder dots
  const legalCount = m.currentOver.filter(b => b.isLegal).length;
  for (let i = legalCount; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'ball ball-dot';
    el.style.opacity = '0.2';
    el.textContent = '·';
    row.appendChild(el);
  }

  // Over summary
  const overs = Math.floor(m.balls / 6);
  const balls = m.balls % 6;
  document.getElementById('over-summary').textContent =
    `Over ${overs + 1} • Ball ${balls}/6 • Extras: W${m.extras.wide} NB${m.extras.noball} B${m.extras.bye} LB${m.extras.legbye}`;

  // Current bowler badge
  if (m.currentBowler !== null) {
    const b = m.bowlerStats[m.currentBowler];
    document.getElementById('current-bowler-badge').textContent =
      `${b.name} · ${Math.floor(b.balls / 6)}.${b.balls % 6} ov`;
  }
}

function getBallClass(ball) {
  if (ball.isWicket) return 'ball-wicket';
  if (ball.extra === 'wide') return 'ball-wide';
  if (ball.extra === 'noball') return 'ball-noball';
  if (ball.extra === 'bye' || ball.extra === 'legbye') return 'ball-bye';
  if (ball.runs === 4) return 'ball-four';
  if (ball.runs === 6) return 'ball-six';
  if (ball.runs === 0) return 'ball-dot';
  return 'ball-run';
}

function getBallLabel(ball) {
  if (ball.isWicket) return 'W';
  if (ball.extra === 'wide') return 'Wd';
  if (ball.extra === 'noball') return 'NB';
  if (ball.extra === 'bye') return 'B';
  if (ball.extra === 'legbye') return 'LB';
  if (ball.runs === 0) return '·';
  return ball.runs;
}

function renderBatsmen() {
  const m = state.match;
  const striker = m.batsmen[m.striker];
  const nonStriker = m.batsmen[m.nonStriker];

  document.getElementById('striker-name').textContent = striker?.name || '—';
  document.getElementById('striker-runs').textContent = striker?.runs || 0;
  document.getElementById('striker-balls').textContent = striker?.balls || 0;
  document.getElementById('striker-fours').textContent = striker?.fours || 0;
  document.getElementById('striker-sixes').textContent = striker?.sixes || 0;

  document.getElementById('nonstriker-name').textContent = nonStriker?.name || '—';
  document.getElementById('nonstriker-runs').textContent = nonStriker?.runs || 0;
  document.getElementById('nonstriker-balls').textContent = nonStriker?.balls || 0;
}

function renderBowlerStats() {
  const m = state.match;
  const list = document.getElementById('bowler-stats-list');
  list.innerHTML = '';

  m.bowlerStats.forEach((b, idx) => {
    if (b.balls === 0 && idx !== m.currentBowler) return;
    const row = document.createElement('div');
    row.className = 'bowler-stat-row';

    const overs = Math.floor(b.balls / 6);
    const remainingBalls = b.balls % 6;
    const oversStr = `${overs}.${remainingBalls}`;
    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '—';
    const allocated = b.allocatedOvers;
    const bowlerOversUsed = Math.floor(b.balls / 6);
    const remaining = allocated - bowlerOversUsed;

    row.innerHTML = `
      <div class="bowler-stat-name ${idx === m.currentBowler ? 'current' : ''}">${b.name}</div>
      <div class="bowler-stat-figures">
        <span>${oversStr} ov</span>
        <span>${b.runs} r</span>
        <span>${b.wickets} w</span>
        <span>${econ} econ</span>
      </div>
      <div class="bowler-overs-remaining">${remaining} left</div>
    `;
    list.appendChild(row);
  });
}

function toggleScorecard() {
  const panel = document.getElementById('scorecard-panel');
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) renderScorecard();
}

function renderScorecard() {
  const m = state.match;
  const bPanel = document.getElementById('batting-scorecard');
  const bowlPanel = document.getElementById('bowling-scorecard');

  bPanel.innerHTML = '';
  m.batsmen.forEach(b => {
    if (b.notBat && !b.dismissed) return;
    const row = document.createElement('div');
    row.className = 'sc-row';
    row.innerHTML = `
      <span class="sc-name">${b.name}</span>
      <span class="sc-dismissal">${b.dismissed ? b.howOut : (b.notBat ? 'dnb' : 'not out')}</span>
      <span class="sc-runs">${b.runs}</span>
      <span class="sc-balls">(${b.balls})</span>
      <span class="sc-fours">${b.fours}</span>
      <span class="sc-sixes">${b.sixes}</span>
    `;
    bPanel.appendChild(row);
  });

  bowlPanel.innerHTML = '';
  m.bowlerStats.forEach(b => {
    if (b.balls === 0) return;
    const overs = Math.floor(b.balls / 6);
    const rem = b.balls % 6;
    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '—';
    const row = document.createElement('div');
    row.className = 'sc-row';
    row.innerHTML = `
      <span class="sc-name">${b.name}</span>
      <span class="sc-dismissal">${overs}.${rem} ov · ${b.wides}wd · ${b.noballs}nb</span>
      <span class="sc-runs">${b.runs}</span>
      <span class="sc-balls">${b.wickets}w</span>
      <span class="sc-fours">${econ}</span>
    `;
    bowlPanel.appendChild(row);
  });
}

function confirmReset() {
  if (confirm('Reset the match? This cannot be undone.')) {
    document.getElementById('scoring-screen').classList.remove('active');
    document.getElementById('setup-screen').classList.add('active');
    state.innings1Score = null;
    document.getElementById('target-block').style.display = 'none';
    document.getElementById('rrr-block').style.display = 'none';
    document.getElementById('innings-switch-btn').style.display = 'none';
  }
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  initSetup();
});
