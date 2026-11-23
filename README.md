# Emberpath — LitRPG Habit Tracker

Offline-first installable PWA: fantasy LitRPG habits + one-off todos, daily vibe check, XP/levels, streaks, badges, avatar/loot, light miss-day penalties, and a Chronicle with charts + weekly summary.

Local persistence only (IndexedDB + localStorage fallback). No auth or backend in v1.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Add to Home Screen (install)

1. Run or deploy the app over **HTTPS** (or `localhost`).
2. **Android Chrome:** browser menu → **Install app** / **Add to Home screen**.
3. **iPhone Safari:** Share → **Add to Home Screen**.
4. Open the installed icon — it runs standalone and works offline after the first visit (service worker caches the shell; your progress stays on-device).

## What’s in v1

- **Today** — brand hero, vibe check (5 funny feeling-emojis, once/day), 10 recurring habits, optional todos, XP/HP/streak bars, atonement after a miss
- **Hero** — avatar stages, level/title, badges, equippable loot unlocks
- **Chronicle** — completion / mood / XP charts + weekly summary (no heatmap)
- **Settings** — demo reset, seed history, JSON export, factory reset, install notes

### Default habits

Make bed · 5k steps · 80g protein · 15 min stretch · Sign language practice · 15 minute reading · Text/call someone · Eat healthy · Plan tomorrow · Workout minimum 15 minutes

## Stack

Vite + React + TypeScript · `vite-plugin-pwa` · IndexedDB (`idb`)
