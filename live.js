// ═══════════════════════════════════════════════════════════════
//  LIVE PUSH MODULE — Cricket Score PWA
//  Load after app.js in index.html:
//  <script src="./live.js"></script>
// ═══════════════════════════════════════════════════════════════

const LivePush = (() => {

  const API_BASE    = 'https://livecs.vercel.app';
  const PUSH_MS     = 3000;
  const STORAGE_KEY = 'lp_config';
  const PROBE_URL   = `${API_BASE}/api/health`;   // lightweight GET endpoint
  const PROBE_MS    = 8000;                        // re-check connectivity every 8 s
  const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
  </svg>`;
  const EYE_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7 7 0 0 0 2.79-.588M5.21 3.088A7 7 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474z"/>
    <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12z"/>
  </svg>`;
  
  let _enabled  = false;
  let _matchId  = '';
  let _token    = '';
  let _password = '';
  let _pushTimer   = null;
  let _probeTimer  = null;
  let _online      = navigator.onLine;  

  window.togglePassword = function(input, btn) {
    input = typeof input === 'string' ?
      document.querySelector(input) :
      input;
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword ? EYE_OPEN : EYE_CLOSE;
  };

  
  // ─────────────────────────────────────────────
  //  Connectivity
  // ─────────────────────────────────────────────
  async function probeConnectivity() {
    if (!navigator.onLine) {
      _setOnline(false);
      return false;
    }
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 4000);
      const r    = await fetch(`${PROBE_URL}?_=${Date.now()}`, {
        method: 'GET',
        cache:  'no-store',
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      _setOnline(r.ok || r.status < 500);
    } catch {
      _setOnline(false);
    }
    return _online;
  }

  function _setOnline(value) {
    if (_online === value) return;
    _online = value;
    _applyOnlineState();
  }

  function _applyOnlineState() {
    const root = document.getElementById('lp-root');
    if (!root) return;

    if (_online) {
      root.classList.remove('lp-hidden');
      root.classList.add('lp-visible');
      showStatus(_enabled ? '✓ Live broadcast active' : 'Ready to broadcast', _enabled ? 'ok' : '');
    } else {
      // Close panel if open, then hide everything
      document.getElementById('lp-panel')?.classList.remove('open');
      root.classList.remove('lp-visible');
      root.classList.add('lp-hidden');
    }
  }

  function _startProbeLoop() {
    clearInterval(_probeTimer);
    _probeTimer = setInterval(probeConnectivity, PROBE_MS);
  }

  // ─────────────────────────────────────────────
  //  Match ID & Token generators
  // ─────────────────────────────────────────────
  function generateMatchId() {
    const s  = G?.setup;
    const t1 = (s?.team1 || 'Team1').replace(/\s+/g, '').slice(0, 8).toLowerCase();
    const t2 = (s?.team2 || 'Team2').replace(/\s+/g, '').slice(0, 8).toLowerCase();
    const d  = new Date();
    const dt = `${d.getDate()}${d.getMonth() + 1}${String(d.getFullYear()).slice(2)}`;
    const rnd = Math.random().toString(36).slice(2, 5);
    return `${t1}-vs-${t2}-${dt}-${rnd}`;
  }

  function generateToken() {
    return Math.random().toString(36).slice(2, 10) +
           Math.random().toString(36).slice(2, 6);
  }

  // ─────────────────────────────────────────────
  //  Config persistence
  // ─────────────────────────────────────────────
  function loadConfig() {
    try {
      const c  = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      _enabled  = !!c.enabled;
      _matchId  = c.matchId  || '';
      _token    = c.token    || '';
      _password = c.password || '';
    } catch {}
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: _enabled, matchId: _matchId,
        token: _token, password: _password,
      }));
    } catch {}
  }

  // ─────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────
  function init() {
    loadConfig();
    injectUI();

    // Browser-level online/offline events for instant response
    window.addEventListener('online',  () => probeConnectivity());
    window.addEventListener('offline', () => _setOnline(false));

    // Initial probe then start loop
    probeConnectivity().then(() => _startProbeLoop());
  }

  // ─────────────────────────────────────────────
  //  Styles
  // ─────────────────────────────────────────────
  const CSS = `
    /* ── Root container ── */
    #lp-root {
      position: fixed;
      bottom: 76px;
      right: 14px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      font-family: var(--f);
    }
    
    /* ── Visibility transitions ── */
    #lp-root {
      opacity: 1;
      transform: translateY(0);
      transition: opacity .3s ease, transform .3s ease;
      pointer-events: auto;
    }
    #lp-root.lp-hidden  { opacity: 0; transform: translateY(16px); pointer-events: none; }
    #lp-root.lp-visible { opacity: 1; transform: translateY(0);    pointer-events: auto; }
    
    /* ── Panel ── */
    #lp-panel {
      background: var(--bg2);
      border: 1px solid var(--bdr);
      border-radius: var(--r);
      padding: 18px;
      width: 300px;
      box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 0 0 1px var(--o-sm);
      display: none;
      flex-direction: column;
      gap: 14px;
      transform-origin: bottom right;
    }
    #lp-panel.open {
      display: flex;
      animation: lp-panel-in .2s cubic-bezier(.16,1,.3,1) both;
    }
    @keyframes lp-panel-in {
      from { opacity: 0; transform: scale(.92) translateY(10px); }
      to   { opacity: 1; transform: scale(1)   translateY(0);    }
    }
    
    /* ── Typography ── */
    .lp-section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      color: var(--t3);
      display: block;
      margin-bottom: 6px;
    }
    .lp-panel-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -.2px;
    }
    
    /* ── Inputs ── */
    #lp-panel input {
      width: 100%;
      background: var(--sf2);
      border: 1px solid var(--bdr);
      border-radius: var(--rs);
      color: var(--text);
      font-family: var(--m);
      font-size: 12px;
      padding: 9px 12px;
      box-sizing: border-box;
      transition: border-color var(--trans), box-shadow var(--trans);
    }
    #lp-panel input:focus {
      outline: none;
      border-color: var(--blue);
      box-shadow: 0 0 0 3px rgba(21,101,192,.15);
    }
    #lp-panel input::placeholder { color: var(--t3); }
    
    /* ── Row & field layouts ── */
    .lp-row   { display: flex; align-items: center; justify-content: space-between; }
    .lp-field { display: flex; gap: 6px; align-items: center; }
    .lp-field input { flex: 1; min-width: 0; }
    
    /* ── Toggle switch ── */
    #lp-toggle {
      width: 42px;
      height: 24px;
      border-radius: 12px;
      background: var(--sf2);
      border: 1px solid var(--bdr);
      cursor: pointer;
      position: relative;
      transition: background var(--trans), border-color var(--trans);
      flex-shrink: 0;
    }
    #lp-toggle.on { background: var(--blue); border-color: rgba(21,101,192,.4); }
    #lp-toggle::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--t2);
      transition: transform .2s cubic-bezier(.34,1.56,.64,1), background var(--trans);
      box-shadow: 0 1px 3px rgba(0,0,0,.4);
    }
    #lp-toggle.on::after { transform: translateX(18px); background: #fff; }
    
    /* ── Generate buttons ── */
    .lp-gen {
      background: var(--o-sm);
      border: 1px solid var(--bdr);
      color: var(--t2);
      border-radius: var(--rs);
      font-size: 11px;
      font-weight: 700;
      padding: 8px 10px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: background var(--trans), color var(--trans), transform .1s;
      letter-spacing: .3px;
    }
    .lp-gen:hover  { background: var(--o-md); color: var(--text); }
    .lp-gen:active { transform: scale(.95); }
    
    /* ── Save button ── */
    #lp-save {
      background: var(--blue);
      color: #fff;
      border: none;
      border-radius: var(--rs);
      padding: 11px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      letter-spacing: .2px;
      transition: background var(--trans), transform .1s, box-shadow var(--trans);
      box-shadow: 0 4px 14px rgba(21,101,192,.3);
    }
    #lp-save:hover  { background: var(--blue2); box-shadow: 0 6px 18px rgba(21,101,192,.4); }
    #lp-save:active { transform: scale(.98); }
    
    /* ── Status bar ── */
    #lp-status {
      font-size: 11px;
      padding: 8px 10px;
      border-radius: var(--rs);
      background: var(--o-sm);
      color: var(--t3);
      min-height: 32px;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: background var(--trans), color var(--trans);
      font-weight: 500;
      letter-spacing: .1px;
    }
    #lp-status.ok  { color: var(--grn); background: rgba(34,197,94,.07); }
    #lp-status.err { color: var(--red2); background: rgba(211,47,47,.07); }
    
    /* ── Viewer link row ── */
    .lp-link-row { display: flex; gap: 7px; align-items: center; }
    .lp-link {
      flex: 1;
      font-size: 10px;
      color: var(--blue2);
      font-family: var(--m);
      word-break: break-all;
      text-decoration: none;
      line-height: 1.5;
    }
    .lp-link:hover { color: var(--text); text-decoration: underline; }
    .lp-copy {
      background: var(--o-sm);
      border: 1px solid var(--bdr);
      color: var(--t2);
      border-radius: var(--rs);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: background var(--trans), transform .1s;
    }
    .lp-copy:hover  { background: var(--o-md); color: var(--text); }
    .lp-copy:active { transform: scale(.95); }
    
    /* ── FAB ── */
    #lp-fab {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--sf2);
      border: 1px solid var(--bdr);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.5);
      font-size: 20px;
      color: var(--text);
      transition: transform .2s cubic-bezier(.34,1.56,.64,1), background var(--trans), box-shadow var(--trans);
    }
    #lp-fab:hover  { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,.6); }
    #lp-fab:active { transform: scale(.95); }
    #lp-fab.active {
      background: var(--blue);
      border-color: rgba(21,101,192,.4);
      box-shadow: 0 4px 20px rgba(21,101,192,.4);
      animation: lp-pulse 2.5s ease-in-out infinite;
    }
    @keyframes lp-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(21,101,192,.4); }
      50%       { box-shadow: 0 4px 28px rgba(21,101,192,.65), 0 0 0 6px rgba(21,101,192,.1); }
    }
    
    /* ── Divider ── */
    .lp-divider { height: 1px; background: var(--bdr); margin: 0 -18px; }
  `;

  // ─────────────────────────────────────────────
  //  Inject UI
  // ─────────────────────────────────────────────
  function injectUI() {
    if (document.getElementById('lp-root')) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    const root = document.createElement('div');
    root.id = 'lp-root';

    // Apply initial hidden state immediately (before probe resolves)
    if (!navigator.onLine) root.classList.add('lp-hidden');

    root.innerHTML = `
      <div id="lp-panel">
        <div class="lp-row">
          <span class="lp-panel-title">📡 Live Broadcast</span>
          <button id="lp-toggle" class="${_enabled ? 'on' : ''}"
                  aria-label="Toggle live broadcast"
                  onclick="LivePush._toggleEnable()"></button>
        </div>
        <div class="lp-divider"></div>

        <div>
          <span class="lp-section-label">Match ID</span>
          <div class="lp-field">
            <input id="lp-match"
                   placeholder="Generate or enter a match ID"
                   maxlength="64"
                   value="${_matchId}" />
            <button class="lp-gen" onclick="LivePush._genId()">Generate</button>
          </div>
        </div>

        <div>
          <span class="lp-section-label">Scorer Token — keep this secret</span>
          <div class="lp-field" style="position:relative;">
            <input id="lp-token"
                   type="password"
                   placeholder="Generate or enter a secure token"
                   value="${_token}"
                   style="padding-right:40px;" />
            <button
              type="button"
              onclick="togglePassword('#lp-token', this)"
              style="
                all:unset;
                position:absolute;
                right:82px;
                top:50%;
                padding:5px;
                transform:translateY(-50%);
                z-index:2;
                cursor:pointer;
                display:flex;
                align-items:center;
              ">
              ${EYE_CLOSE}
            </button>
            <button class="lp-gen" onclick="LivePush._genToken()">Generate</button>
          </div>
        </div>

        <div>
          <span class="lp-section-label"> Secure Public Access<span style="font-weight:400;text-transform:none;letter-spacing:0;color:#374151">(<span style="font-style: italic;">At Least 4 Character</span>)</span></span>
          <div style="position:relative;">
            <input id="lp-pass"
                   type="password"
                   placeholder="(Optional) Enter a secure password"
                   value="${_password}"
                   style="padding-right:40px;"/>
            <button
              type="button"
              onclick="togglePassword('#lp-pass', this)"
              style="
                all:unset;
                position:absolute;
                right:7px;
                top:50%;
                padding:5px;
                transform:translateY(-50%);
                z-index:2;
                cursor:pointer;
                display:flex;
                align-items:center;
              ">
              ${EYE_CLOSE}
            </button>
          </div>
        </div>

        <button id="lp-save" onclick="LivePush._save()">Activate Broadcast</button>

        <div id="lp-status">
          ${_enabled ? '✓ Live broadcast active' : 'Broadcast is off'}
        </div>

        <div class="lp-link-row" id="lp-viewer-row"
             style="display:${_matchId ? 'flex' : 'none'}">
          <a class="lp-link" id="lp-viewer-link" target="_blank" rel="noopener"
             href="${_matchId ? `${API_BASE}/match/${encodeURIComponent(_matchId)}` : '#'}">
            ${_matchId ? `${API_BASE}/match/${_matchId}` : ''}
          </a>
          <button class="lp-copy" onclick="LivePush._copyLink()">Copy</button>
        </div>
      </div>

      <button id="lp-fab"
              class="${_enabled ? 'active' : ''}"
              aria-label="Open live broadcast settings"
              onclick="LivePush._togglePanel()">📡</button>
    `;

    document.body.appendChild(root);
  }

  // ─────────────────────────────────────────────
  //  Panel actions
  // ─────────────────────────────────────────────
  function _togglePanel() {
    document.getElementById('lp-panel').classList.toggle('open');
  }

  function _genId() {
    document.getElementById('lp-match').value = generateMatchId();
  }

  function _genToken() {
    document.getElementById('lp-token').value = generateToken();
  }

  function _toggleEnable() {
    _enabled = !_enabled;
    document.getElementById('lp-toggle').className = _enabled ? 'on' : '';
    document.getElementById('lp-fab').className    = _enabled ? 'active' : '';
    showStatus(
      _enabled ? '✓ Broadcast on — syncing next delivery' : 'Broadcast off',
      _enabled ? 'ok' : ''
    );
    saveConfig();
    if (_enabled && _matchId && _token) push();
  }

  function _save() {
    const mid  = document.getElementById('lp-match')?.value.trim();
    const tok  = document.getElementById('lp-token')?.value.trim();
    const pass = document.getElementById('lp-pass')?.value.trim();

    if (!mid)                    { showStatus('Enter or generate a Match ID first.', 'err'); return; }
    if (!tok || tok.length < 8)  { showStatus('Generate a token (minimum 8 characters).', 'err'); return; }

    _matchId  = mid;
    _token    = tok;
    _password = pass;
    _enabled  = true;

    document.getElementById('lp-toggle').className = 'on';
    document.getElementById('lp-fab').className    = 'active';
    saveConfig();

    const link    = `${API_BASE}/match/${encodeURIComponent(_matchId)}`;
    const linkEl  = document.getElementById('lp-viewer-link');
    const viewRow = document.getElementById('lp-viewer-row');
    if (linkEl)  { linkEl.href = link; linkEl.textContent = `${API_BASE}/match/${_matchId}`; }
    if (viewRow) viewRow.style.display = 'flex';

    showStatus('Saved — broadcasting now…', 'ok');
    _forcePush();
  }

  function _copyLink() {
    const link = `${API_BASE}/match/${encodeURIComponent(_matchId)}`;
    navigator.clipboard?.writeText(link)
      .then(() => showStatus('✓ Link copied to clipboard', 'ok'))
      .catch(() => showStatus('Copy failed — try manually.', 'err'));
  }

  // ─────────────────────────────────────────────
  //  Push
  // ─────────────────────────────────────────────
  async function _forcePush() {
    clearTimeout(_timer);
    const old = _enabled;
    _enabled = true;
    await push(true);
    _enabled = old;
  }
  
  async function push(force = false) {
    if (!_enabled || !_matchId || !_token) return;
    if (typeof G === 'undefined' || !G.match) return;

    const payload = {
      matchId:      _matchId,
      scorerToken:  _token,
      password:     _password || '',
      setup:        G.setup,
      match:        G.match,
      inn1:         G.inn1,
      inn1FullData: G.inn1FullData || null,
      screen:       G.screen || 'scoring',
      resultData:   G.resultData  || null,
      force:        force,
    };

    try {
      const r = await fetch(`${API_BASE}/api/score`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { showStatus(`Error: ${d.error || r.status}`, 'err'); return; }
      const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
      showStatus(`✓ Live · updated ${t}`, 'ok');
      // Confirm we're online after a successful push
      _setOnline(true);
    } catch {
      showStatus('Network error — will retry', 'err');
      // Could be intermittent; probe will re-evaluate
      probeConnectivity();
    }
  }

  // ─────────────────────────────────────────────
  //  Ownership release — call in doNewMatch()
  // ─────────────────────────────────────────────
  async function releaseOwnership() {
    if (!_matchId || !_token) return;
    try {
      await fetch(`${API_BASE}/api/score`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId: _matchId, scorerToken: _token }),
      });
    } catch {}
    _enabled = false; _matchId = ''; _token = ''; _password = '';
    saveConfig();
  }

  function schedulePush() {
    if (!_enabled) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => push(), PUSH_MS);
  }

  function showStatus(msg, type = '') {
    const el = document.getElementById('lp-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = type;
  }

  // ─────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────
  return {
    init, push, schedulePush, releaseOwnership,
    _togglePanel, _toggleEnable, _genId, _genToken, _save, _copyLink,
  };
})();

// ─────────────────────────────────────────────
//  app.js integration — monkey-patch on load
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LivePush.init();

  // Wrap saveState so every score update triggers a push
  const _origSave = window.saveState;
  if (typeof _origSave === 'function') {
    window.saveState = function (...args) {
      _origSave(...args);
      LivePush.schedulePush();
    };
  }

  // Release ownership on new match or rematch
  const _origNew = window.doNewMatch;
  if (typeof _origNew === 'function') {
    window.doNewMatch = function (...args) {
      LivePush.releaseOwnership();
      _origNew(...args);
    };
  }
  const _origRematch = window.doRematch;
  if (typeof _origRematch === 'function') {
    window.doRematch = function (...args) {
      LivePush.releaseOwnership();
      _origRematch(...args);
    };
  }
});
