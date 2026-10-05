# SOUL DS Registration System

An installable, offline-first web app (PWA) for the **SOUL** alliance to run the weekly
**Desert Storm Team A** in Last War: collect registrations from a poll screenshot,
pick a fair lineup, publish it, record attendance and apply no-show penalties.
Up to ~100 members, English UI, navy & gold theme. Fan-made tool – no game art or assets.

## What it does

1. **Poll** – import a screenshot of the in-game poll; names are read on the phone
   (OCR) and ticked in the roster checklist. Fix or add voters by hand; corrections are
   remembered.
2. **Selection** – 14 core (relative power + activity score), 6 rotation (who waited
   longest), 10 substitutes, everyone else *not selected*; each with a short "why".
   Move or swap players manually.
3. **Lock** – copy the plan text for the alliance chat and lock it.
4. **Attendance** – import the participation screenshot, mark who warned an R4;
   finalising applies suspensions (2 Team A events by default) and updates history.

All numbers are configurable in **Settings**. Data stays on the device
(IndexedDB) with JSON backup/restore and CSV roster import/export.

## Quick start

```bash
npm install
npm run dev
```

Open the app, go to **Roster → Load demo roster**, then **This week → Start week →
Try the sample** to see the whole flow with sample screenshots.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type-check + production build (PWA) into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint + layer/cycle architecture check |
| `npm run typecheck` | TypeScript only |
| `npm run icons` | Regenerate the app icons |

## Documentation

* [docs/INSTALL.md](docs/INSTALL.md) – install on iPhone/Android, host on GitHub Pages
* [docs/USER_GUIDE.md](docs/USER_GUIDE.md) – weekly workflow, roster import, OCR tips, backups
* [docs/ALGORITHM.md](docs/ALGORITHM.md) – every selection and penalty rule with examples
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – layers, folders, adding a cloud backend

## Tech

React 19 · TypeScript (strict) · Vite · vite-plugin-pwa (Workbox) · idb (IndexedDB) ·
Tesseract.js (lazy-loaded OCR) · SheetJS (lazy-loaded `.xlsx` import) · Vitest.
Deployed to GitHub Pages by `.github/workflows/deploy.yml`.
