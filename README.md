# 🏏 CricLive Scorer

Real-time Cricket Score Counter — Live match scoring app for GitHub Pages.

## Features
- ✅ Live run/wicket/over tracking
- ✅ No Ball, Wide, Bye, Leg Bye extras
- ✅ Smart bowler over allocation & synchronization
- ✅ Undo last ball
- ✅ 2nd innings / run chase with RRR
- ✅ Full scorecard
- ✅ Mobile responsive
- ✅ PWA — installable on Chrome (desktop + mobile)
- ✅ Offline capable (service worker)

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `cricket-scorer`)
2. Upload all files to the root:
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png` (add your own 192×192 cricket icon)
   - `icon-512.png` (add your own 512×512 cricket icon)
3. Go to **Settings → Pages → Branch: main / root**
4. Your app will be live at `https://marufhossainkeyas11.github.io/Cricket-Score/`

## Install as Chrome App
- Open the site in Chrome
- Click the install icon (⊕) in the address bar
- Click "Install"

## How to Use

### Match Setup
1. Enter team names
2. Set total overs (e.g. 20 for T20)
3. Enter player names for both teams
4. **Allocate overs per bowler** — must total exactly the match overs
   - e.g. T20 (20 overs, 5 bowlers): 4+4+4+4+4 = 20
   - e.g. 10 overs (4 bowlers): 3+3+2+2 = 10

### Scoring
- Tap run buttons (0–6) for each delivery
- Tap **Wide / No Ball / Bye / Leg Bye** for extras
- Tap **WICKET** for dismissals
- After each over: select the next bowler
- Use **↩ Undo** to reverse the last ball

### Over Sync Logic
Each bowler's allocation is tracked separately. A bowler who has used all their allocated overs cannot bowl again. The previous over's bowler cannot bowl consecutive overs — enforced automatically in bowler selection.

## Tech Stack
- Vanilla JS (no frameworks)
- CSS custom properties + Grid/Flex
- PWA (manifest + service worker)
- Google Fonts: Bebas Neue, DM Sans, JetBrains Mono
