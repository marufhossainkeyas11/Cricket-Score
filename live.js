// ═══════════════════════════════════════════════
//  LIVE PUSH MODULE — Cricket Score PWA
//  index.html এ app.js এর পরে load করুন:
//  <script src="./live.js"></script>
// ═══════════════════════════════════════════════

const LivePush = (() => {

  const API_BASE    = 'https://livecs.vercel.app';
  const PUSH_MS     = 3000;
  const STORAGE_KEY = 'lp_config';

  let _enabled  = false;
  let _matchId  = '';
  let _token    = '';
  let _password = '';
  let _timer    = null;

  // ── Match ID auto-generate ───────────────────
  function generateMatchId() {
    const s = G?.setup;
    const t1 = (s?.team1 || 'Team1').replace(/\s+/g, '').slice(0, 8).toLowerCase();
    const t2 = (s?.team2 || 'Team2').replace(/\s+/g, '').slice(0, 8).toLowerCase();
    const d  = new Date();
    const dt = `${d.getDate()}${d.getMonth() + 1}${String(d.getFullYear()).slice(2)}`;
    const rnd = Math.random().toString(36).slice(2, 5);
    return `${t1}-vs-${t2}-${dt}-${rnd}`;
  }

  // ── Token generate ───────────────────────────
  function generateToken() {
    return Math.random().toString(36).slice(2, 10) +
           Math.random().toString(36).slice(2, 6);
  }

  // ── Config ────────────────────────────────────
  function loadConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
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

  // ── Init ─────────────────────────────────────
  function init() {
    loadConfig();
    injectUI();
    if (_enabled && _matchId && _token) showStatus('⟳ Ready', 'ok');
  }

  // ── UI ────────────────────────────────────────
  function injectUI() {
    if (document.getElementById('lp-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #lp-root{position:fixed;bottom:70px;right:12px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:var(--f,'Inter',sans-serif)}
      #lp-panel{background:#1a2332;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;width:290px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:none;flex-direction:column;gap:12px}
      #lp-panel.open{display:flex}
      #lp-panel .lp-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a5568;display:block;margin-bottom:4px}
      #lp-panel input{width:100%;background:#242e42;border:1px solid rgba(255,255,255,.08);border-radius:6px;color:#e6edf3;font-family:'JetBrains Mono',monospace;font-size:12px;padding:8px 10px}
      #lp-panel input:focus{outline:none;border-color:rgba(96,165,250,.4)}
      .lp-row{display:flex;align-items:center;justify-content:space-between}
      .lp-title{font-size:14px;font-weight:700;color:#e6edf3}
      #lp-toggle{width:40px;height:22px;border-radius:11px;background:#2d3a52;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
      #lp-toggle.on{background:#1565C0}
      #lp-toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
      #lp-toggle.on::after{transform:translateX(18px)}
      .lp-field{display:flex;gap:6px;align-items:center}
      .lp-field input{flex:1}
      .lp-gen{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);color:#60a5fa;border-radius:6px;font-size:11px;font-weight:700;padding:7px 9px;cursor:pointer;white-space:nowrap;flex-shrink:0}
      .lp-gen:hover{background:rgba(96,165,250,.2)}
      #lp-save{background:#1565C0;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;width:100%}
      #lp-save:hover{background:#1976D2}
      #lp-status{font-size:11px;padding:7px 10px;border-radius:6px;background:rgba(255,255,255,.04);color:#4a5568;min-height:30px;display:flex;align-items:center;gap:6px}
      #lp-status.ok{color:#22c55e;background:rgba(34,197,94,.08)}
      #lp-status.err{color:#f87171;background:rgba(248,113,113,.08)}
      .lp-link-row{display:flex;gap:6px;align-items:center}
      .lp-link{flex:1;font-size:10px;color:#60a5fa;font-family:monospace;word-break:break-all;text-decoration:none}
      .lp-copy{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.3);color:#60a5fa;border-radius:5px;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer;white-space:nowrap;flex-shrink:0}
      #lp-fab{width:46px;height:46px;border-radius:50%;background:#1565C0;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.5);font-size:20px;color:#fff;transition:transform .15s}
      #lp-fab:hover{transform:scale(1.08)}
      #lp-fab.active{background:#22c55e}
      .lp-divider{height:1px;background:rgba(255,255,255,.06);margin:0 -16px}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'lp-root';
    root.innerHTML = `
      <div id="lp-panel">
        <div class="lp-row">
          <span class="lp-title">📡 Live Telecast</span>
          <button id="lp-toggle" class="${_enabled ? 'on' : ''}" onclick="LivePush._toggleEnable()"></button>
        </div>
        <div class="lp-divider"></div>

        <div>
          <span class="lp-label">Match ID</span>
          <div class="lp-field">
            <input id="lp-match" placeholder="auto-generate করুন →" maxlength="64" value="${_matchId}" />
            <button class="lp-gen" onclick="LivePush._genId()">Generate</button>
          </div>
        </div>

        <div>
          <span class="lp-label">Scorer Token (secret)</span>
          <div class="lp-field">
            <input id="lp-token" type="password" placeholder="auto-generate করুন →" value="${_token}" />
            <button class="lp-gen" onclick="LivePush._genToken()">Generate</button>
          </div>
        </div>

        <div>
          <span class="lp-label">Password (optional — viewer দেখতে লাগবে)</span>
          <input id="lp-pass" type="text" placeholder="না চাইলে খালি রাখুন" value="${_password}" />
        </div>

        <button id="lp-save" onclick="LivePush._save()">✓ Save &amp; Activate</button>

        <div id="lp-status">Live telecast ${_enabled ? 'চালু' : 'বন্ধ'}</div>

        <div class="lp-link-row" id="lp-viewer-row" style="display:${_matchId ? 'flex' : 'none'}">
          <a class="lp-link" id="lp-viewer-link" target="_blank"
             href="${_matchId ? `${API_BASE}/match/${encodeURIComponent(_matchId)}` : '#'}">
            ${_matchId ? `${API_BASE}/match/${_matchId}` : ''}
          </a>
          <button class="lp-copy" onclick="LivePush._copyLink()">Copy</button>
        </div>
      </div>

      <button id="lp-fab" class="${_enabled ? 'active' : ''}" onclick="LivePush._togglePanel()">📡</button>
    `;
    document.body.appendChild(root);
  }

  // ── Actions ───────────────────────────────────
  function _togglePanel() {
    document.getElementById('lp-panel').classList.toggle('open');
  }

  function _genId() {
    const id = generateMatchId();
    document.getElementById('lp-match').value = id;
  }

  function _genToken() {
    document.getElementById('lp-token').value = generateToken();
  }

  function _toggleEnable() {
    _enabled = !_enabled;
    document.getElementById('lp-toggle').className = _enabled ? 'on' : '';
    document.getElementById('lp-fab').className    = _enabled ? 'active' : '';
    showStatus(_enabled ? '✓ চালু — পরের ball এ push হবে' : 'বন্ধ', _enabled ? 'ok' : '');
    saveConfig();
    if (_enabled && _matchId && _token) push();
  }

  function _save() {
    const mid  = document.getElementById('lp-match')?.value.trim();
    const tok  = document.getElementById('lp-token')?.value.trim();
    const pass = document.getElementById('lp-pass')?.value.trim();

    if (!mid)             { showStatus('Match ID দিন বা Generate করুন', 'err'); return; }
    if (!tok || tok.length < 8) { showStatus('Token Generate করুন (min 8 char)', 'err'); return; }

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

    showStatus('✓ Saved! Pushing…', 'ok');
    push();
  }

  function _copyLink() {
    const link = `${API_BASE}/match/${encodeURIComponent(_matchId)}`;
    navigator.clipboard?.writeText(link)
      .then(() => showStatus('✓ Link copied!', 'ok'))
      .catch(() => showStatus('Copy failed', 'err'));
  }

  // ── Push ──────────────────────────────────────
  async function push() {
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
    };

    try {
      const r = await fetch(`${API_BASE}/api/score`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { showStatus(`✗ ${d.error || r.status}`, 'err'); return; }
      const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
      showStatus(`✓ Live · ${t}`, 'ok');
    } catch {
      showStatus('✗ Network error', 'err');
    }
  }

  // ── Ownership release — doNewMatch() এ call করো ──
  async function releaseOwnership() {
    if (!_matchId || !_token) return;
    try {
      await fetch(`${API_BASE}/api/score`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId: _matchId, scorerToken: _token }),
      });
    } catch {}
    // local config clear
    _enabled = false; _matchId = ''; _token = ''; _password = '';
    saveConfig();
  }

  function schedulePush() {
    if (!_enabled) return;
    clearTimeout(_timer);
    _timer = setTimeout(() => push(), PUSH_MS);
  }

  function showStatus(msg, type = '') {
    const el = document.getElementById('lp-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = type;
  }

  return { init, push, schedulePush, releaseOwnership, _togglePanel, _toggleEnable, _genId, _genToken, _save, _copyLink };
})();

// ── app.js monkey-patch ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LivePush.init();

  // saveState wrap
  const _origSave = window.saveState;
  if (typeof _origSave === 'function') {
    window.saveState = function (...args) {
      _origSave(...args);
      LivePush.schedulePush();
    };
  }

  // doNewMatch / doRematch wrap — ownership release
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
