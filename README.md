# 🏏 Cricket Score

**A fast, offline-capable cricket scoring tool — built for real matches, not demos.**

[![Live App](https://img.shields.io/badge/Live%20App-Cricket%20Score-1565C0?style=flat-square&logo=github)](https://marufhossainkeyas11.github.io/Cricket-Score/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-22c55e?style=flat-square)](https://marufhossainkeyas11.github.io/Cricket-Score/)
[![License](https://img.shields.io/badge/License-MIT-f0b429?style=flat-square)](LICENSE)

---

## What It Does

Cricket Score is a mobile-first progressive web app for scoring cricket matches in real time. No backend, no login, no ads — just a clean, fast scoring interface that works even without internet.

Designed for local matches, gully cricket, box cricket, and any format where you need a proper scorecard without the overhead of a full scoring platform.

---

## Features

### Match Setup
- Configurable team names, player names, overs, and squad size
- Toss modal with winner and election tracking
- Opening batsmen selection (Striker + Non-Striker)
- **Flexible bowling tier system** — define per-bowler over limits across multiple tiers (e.g. top 2 bowlers get 4 overs, rest get 3)
- Match rules toggleable per match:
  - Bye & Leg Bye runs (disable for local rules)
  - Last Man Standing mode
  - Full Cricket / Short Cricket (6s allowed or treated as wicket)
  - Dark Mode

### Live Scoring
- Ball-by-ball scoring: dot, 1–4, 6, Wide, No Ball, Bye, Leg Bye
- Wicket modal with full dismissal types: Bowled, Caught, LBW, Run Out, Stumped, Hit Wicket
- Run Out flow: select which batter, which end, runs completed before dismissal, bye runs
- No Ball + bat runs tracked separately with bowler economy calculated correctly
- Over-by-over ball tracker with colour-coded ball indicators
- Live run rate (CRR in 1st innings, RRR in 2nd innings)
- Progress bar, target, and balls-remaining display in 2nd innings
- **Undo** — unlimited undo across all ball types including innings transitions

### Mid-Match Editing
- **Edit Players modal** — rename/swap the current bowler or active batsmen mid-match, with stats migrating to the new name
- Bowler quota enforcement — blocked when over limit or bowling consecutive overs
- Last Man Standing enforcement — dot balls only when one batter remains

### Result & Summary
- Match result screen with full scorecard for both innings
- **Downloadable PNG summary** — canvas-rendered scorecard with branding, QR code, and date, ready to share

### PWA / Offline
- Installable on Android and iOS (Add to Home Screen)
- Full offline support via Service Worker
- Auto-detects app updates and prompts refresh
- 24-hour state persistence via `localStorage` — resume a match after closing the browser

---

## Tech Stack

| Layer | Detail |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript — no framework |
| Fonts | Bebas Neue, Rajdhani, JetBrains Mono, Montserrat, Inter |
| PWA | Service Worker with cache-first strategy |
| Storage | `localStorage` with 24h TTL |
| Canvas | Native Canvas API for summary image generation |
| QR | [qrcodejs](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) for download summary |
| Hosting | GitHub Pages |

No build step. No bundler. No dependencies to install.

---

## Getting Started

### Run Locally

```bash
git clone https://github.com/marufhossainkeyas11/Cricket-Score.git
cd Cricket-Score

# Any static file server works:
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

> **Note:** Open via a server, not directly as a file (`file://`). Service workers require HTTP/HTTPS.

### Deploy

The app is static — deploy anywhere that serves files:

- **GitHub Pages** (current): push to `main`, enable Pages in repo settings
- **Netlify / Vercel**: drag-and-drop the folder
- **Any web host**: upload all files as-is

No build step required.

---

## File Structure

```
Cricket-Score/
├── index.html          # App shell, all modals, PWA install prompt
├── style.css           # All styles — variables, layout, components, dark/light themes
├── app.js              # All game logic, state management, rendering, canvas export
├── sw.js               # Service Worker — caching, offline support, update flow
├── manifest.json       # PWA manifest
├── favicon.svg         # App logo (also used in scorecard canvas)
├── favicon.ico
├── favicon-96x96.png
├── apple-touch-icon.png
└── og-image.png        # Open Graph preview image
```

---

## Bowling Tier System

The tier system lets you define over limits without hard-coding a single cap for all bowlers.

**Example — 20-over match, 11 players per side:**

| Tier | Max Overs | Bowlers |
|---|---|---|
| Tier 1 | 4 overs | 2 bowlers |
| Tier 2 | 3 overs | rest |

The app validates feasibility before the match starts — if the total possible overs across all tiers is less than the match length, it blocks start and shows the shortfall.

Slots are assigned dynamically as bowlers are selected, not pre-assigned at setup.

---

## Scoring Rules Reference

| Ball Type | Legal Ball | Bowler Runs | Bat Runs | Striker Balls |
|---|---|---|---|---|
| Normal (0–6) | ✅ | ✅ | ✅ | ✅ |
| Wide | ❌ | ✅ (+1 + bye) | ❌ | ❌ |
| No Ball | ❌ | ✅ (+1 + bat) | ✅ | ❌ |
| Bye | ✅ | ✅ | ❌ | ✅ |
| Leg Bye | ✅ | ✅ | ❌ | ✅ |

Strike rotates on odd runs (including wide byes, no ball bat runs). Batter does not face next ball after a wide or no ball.

---

## Keyboard / Touch

The app is designed for one-handed mobile use. All primary scoring actions are large touch targets. No keyboard shortcuts — optimised for phone screens during live matches.

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome / Edge (Android) | ✅ Full, including PWA install |
| Safari (iOS) | ✅ Full, PWA via Add to Home Screen |
| Firefox | ✅ Scoring works, PWA install not supported |
| Desktop browsers | ✅ Works, not optimised for wide screens |

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/marufhossainkeyas11/Cricket-Score/issues).

If you're sending a PR:
- No build step to worry about — edit files directly
- Keep JavaScript in `app.js`, styles in `style.css`
- Test on mobile viewport (375px width minimum)
- Check both dark and light themes

---

## License

MIT — use it, fork it, build on it.

---

*Built for the love of cricket. Works on the field, works offline, works on a 3-year-old Android.*
