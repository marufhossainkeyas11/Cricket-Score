// ═══════════════════════════════════════════════
//  LIVE PUSH MODULE — Cricket Score PWA
//  এই কোডটা app.js এর শেষে যোগ করুন
//  (অথবা আলাদা live.js হিসেবে রেখে HTML এ load করুন)
// ═══════════════════════════════════════════════

const LivePush = (() => {

  // ── Config ──────────────────────────────────
  // আপনার Vercel deploy URL দিন:
  const API_BASE    = 'https://livecs.vercel.app';
  const PUSH_MS     = 4000;   // ball এর পর auto-push delay (ms)
  const STORAGE_KEY = 'lp_config';

  // ── State ────────────────────────────────────
  let _enabled  = false;
  let _matchId  = '';
  let _token    = '';
  let _timer    = null;
  let _ui       = null;

  // ── Init: DOMContentLoaded এর পর call হবে ───
  function init() {
    loadConfig();
    injectUI();
    if (_enabled && _matchId && _token) {
      showStatus('⟳ Live push ready', 'ok');
    }
  }

  // ── Config persist ───────────────────────────
  function loadConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      _enabled = !!c.enabled;
      _matchId = c.matchId || '';
      _token   = c.token   || '';
    } catch {}
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: _enabled,
        matchId: _matchId,
        token:   _token,
      }));
    } catch {}
  }

  // ── Inject floating UI ───────────────────────
  function injectUI() {
    if (document.getElementById('lp-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #lp-root {
        position: fixed; bottom: 70px; right: 12px; z-index: 9999;
        display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        font-family: var(--f, 'Inter', sans-serif);
      }
      #lp-panel {
        background: #1a2332; border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px; padding: 14px 16px; width: 280px;
        box-shadow: 0 8px 32px rgba(0,0,0,.5);
        display: none; flex-direction: column; gap: 10px;
      }
      #lp-panel.open { display: flex; }
      #lp-panel label {
        font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
        text-transform: uppercase; color: #4a5568; display: block; margin-bottom: 4px;
      }
      #lp-panel input {
        width: 100%; background: #242e42; border: 1px solid rgba(255,255,255,.08);
        border-radius: 6px; color: #e6edf3; font-family: 'JetBrains Mono', monospace;
        font-size: 12px; padding: 8px 10px;
      }
      #lp-enable-row {
        display: flex; align-items: center; justify-content: space-between;
      }
      #lp-enable-label { font-size: 13px; font-weight: 600; color: #e6edf3; }
      #lp-toggle {
        width: 40px; height: 22px; border-radius: 11px;
        background: #2d3a52; border: none; cursor: pointer; position: relative;
        transition: background .2s;
      }
      #lp-toggle.on { background: #1565C0; }
      #lp-toggle::after {
        content: ''; position: absolute; top: 3px; left: 3px;
        width: 16px; height: 16px; border-radius: 50%; background: #fff;
        transition: transform .2s;
      }
      #lp-toggle.on::after { transform: translateX(18px); }
      #lp-save {
        background: #1565C0; color: #fff; border: none; border-radius: 6px;
        padding: 8px; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%;
      }
      #lp-save:hover { background: #1976D2; }
      #lp-status {
        font-size: 11px; padding: 6px 10px; border-radius: 6px;
        background: rgba(255,255,255,.04); color: #4a5568; min-height: 28px;
        display: flex; align-items: center; gap: 6px;
      }
      #lp-status.ok  { color: #22c55e; background: rgba(34,197,94,.08); }
      #lp-status.err { color: #f87171; background: rgba(248,113,113,.08); }
      #lp-viewer-row { display: flex; gap: 6px; align-items: center; }
      #lp-viewer-link {
        flex: 1; font-size: 10px; color: #60a5fa; font-family: monospace;
        word-break: break-all; text-decoration: none;
      }
      #lp-copy {
        background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.3);
        color: #60a5fa; border-radius: 5px; font-size: 11px; font-weight: 600;
        padding: 4px 8px; cursor: pointer; white-space: nowrap; flex-shrink: 0;
      }
      #lp-fab {
        width: 44px; height: 44px; border-radius: 50%;
        background: #1565C0; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,.4);
        font-size: 18px; color: #fff;
        transition: transform .15s;
      }
      #lp-fab:hover { transform: scale(1.08); }
      #lp-fab.active { background: #22c55e; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'lp-root';
    root.innerHTML = `
      <div id="lp-panel">
        <div id="lp-enable-row">
          <span id="lp-enable-label">Live Push</span>
          <button id="lp-toggle" class="${_enabled ? 'on' : ''}" onclick="LivePush._toggleEnable()"></button>
        </div>

        <div>
          <label>Match ID</label>
          <input id="lp-match" placeholder="my-match-001" maxlength="64" value="${_matchId}" />
        </div>

        <div>
          <label>Scorer Token (secret)</label>
          <input id="lp-token" type="password" placeholder="min 8 chars" value="${_token}" />
        </div>

        <button id="lp-save" onclick="LivePush._save()">Save & Activate</button>

        <div id="lp-status">Live push ${_enabled ? 'enabled' : 'disabled'}</div>

        <div id="lp-viewer-row" style="display:${_matchId ? 'flex' : 'none'}">
          <a id="lp-viewer-link" target="_blank" href="${_matchId ? API_BASE + '/viewer.html?match=' + encodeURIComponent(_matchId) : '#'}">
            ${_matchId ? API_BASE + '/viewer.html?match=' + _matchId : ''}
          </a>
          <button id="lp-copy" onclick="LivePush._copyLink()">Copy</button>
        </div>
      </div>

      <button id="lp-fab" class="${_enabled ? 'active' : ''}" onclick="LivePush._togglePanel()">📡</button>
    `;
    document.body.appendChild(root);
    _ui = root;
  }

  // ── Panel toggle ─────────────────────────────
  function _togglePanel() {
    const panel = document.getElementById('lp-panel');
    panel.classList.toggle('open');
  }

  // ── Enable/disable toggle ────────────────────
  function _toggleEnable() {
    _enabled = !_enabled;
    document.getElementById('lp-toggle').className = _enabled ? 'on' : '';
    document.getElementById('lp-fab').className    = `${_enabled ? 'active' : ''}`;
    showStatus(_enabled ? '✓ Enabled — push on next ball' : 'Disabled', _enabled ? 'ok' : '');
    saveConfig();
    if (_enabled && _matchId && _token) push(); // তাৎক্ষণিক একটা push
  }

  // ── Save settings ────────────────────────────
  function _save() {
    const mid = document.getElementById('lp-match')?.value.trim();
    const tok = document.getElementById('lp-token')?.value.trim();

    if (!mid) { showStatus('Match ID দিন', 'err'); return; }
    if (!tok || tok.length < 8) { showStatus('Token কমপক্ষে 8 অক্ষর', 'err'); return; }

    _matchId = mid;
    _token   = tok;
    _enabled = true;
    document.getElementById('lp-toggle').className = 'on';
    document.getElementById('lp-fab').className    = 'active';
    saveConfig();

    // viewer link দেখাও
    const link = `${API_BASE}/viewer.html?match=${encodeURIComponent(_matchId)}`;
    const linkEl = document.getElementById('lp-viewer-link');
    const viewRow = document.getElementById('lp-viewer-row');
    if (linkEl) { linkEl.href = link; linkEl.textContent = link; }
    if (viewRow) viewRow.style.display = 'flex';

    showStatus('✓ Saved! Pushing now…', 'ok');
    push();
  }

  // ── Copy viewer link ─────────────────────────
  function _copyLink() {
    const link = `${API_BASE}/viewer.html?match=${encodeURIComponent(_matchId)}`;
    navigator.clipboard?.writeText(link)
      .then(() => showStatus('✓ Link copied!', 'ok'))
      .catch(() => showStatus('Copy failed — copy manually', 'err'));
  }

  // ── Push current G state to API ──────────────
  async function push() {
    if (!_enabled || !_matchId || !_token) return;
    if (typeof G === 'undefined') return; // G is Cricket Score global state

    const payload = {
      matchId:     _matchId,
      scorerToken: _token,
      setup:       G.setup,
      match:       G.match,
      inn1:        G.inn1,
      inn1FullData: G.inn1FullData || null,
      screen:      G.screen || 'scoring',
      resultData:  G.resultData || null,
    };

    try {
      const r = await fetch(`${API_BASE}/api/score`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const d = await r.json();

      if (!r.ok) {
        showStatus(`✗ ${d.error || r.status}`, 'err');
        return;
      }

      const now = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      showStatus(`✓ Pushed · ${now}`, 'ok');

    } catch (err) {
      showStatus('✗ Network error', 'err');
    }
  }

  // ── Auto-push: ball() এর পর call করো ────────
  function schedulePush() {
    if (!_enabled) return;
    clearTimeout(_timer);
    _timer = setTimeout(() => push(), PUSH_MS);
  }

  // ── Status display ────────────────────────────
  function showStatus(msg, type = '') {
    const el = document.getElementById('lp-status');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `${type}`;
    el.style.cssText = ''; // reset inline style
  }

  // ── Public API ────────────────────────────────
  return { init, push, schedulePush, _togglePanel, _toggleEnable, _save, _copyLink };
})();

// ── Hook into app.js ─────────────────────────────────────────────────────────
//
// app.js এর DOMContentLoaded এ যোগ করুন:
//   LivePush.init();
//
// app.js এর saveState() এর শেষে যোগ করুন:
//   LivePush.schedulePush();
//
// ─────────────────────────────────────────────────────────────────────────────
// অথবা নিচের মতো monkey-patch করলে app.js টাচ করতে হবে না:

document.addEventListener('DOMContentLoaded', () => {
  LivePush.init();

  // saveState() কে wrap করো
  const _origSave = window.saveState;
  if (typeof _origSave === 'function') {
    window.saveState = function (...args) {
      _origSave(...args);
      LivePush.schedulePush();
    };
  }
});
