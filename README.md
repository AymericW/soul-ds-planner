# SOUL DS Registration System

An installable web app (PWA) for the **SOUL** alliance to run the two weekly
**Desert Storm** events in Last War – **Team A** (Friday 10 PM Paris time) and **Team B**
(Friday 1 PM): collect registrations from a poll screenshot or a public join link,
pick fair lineups (a player plays at most one event per week), publish them, record
attendance and apply no-show penalties.
Up to ~100 members, English UI, navy & gold theme. Fan-made tool – no game art or assets.

## What it does

Both events of the upcoming Friday are created automatically; each runs through:

1. **Poll** – players register themselves with the **join link** (`#/join?code=…`, no
   login: pick your name, enter your power, choose Play / Sub only / Not available for
   Team A and Team B), and/or import a screenshot of the in-game poll; names are read on
   the phone (OCR) and ticked in the roster checklist. Fix or add voters by hand;
   corrections are remembered.
2. **Selection** – per event 14 core (relative power + activity score), 6 rotation (who
   waited longest, in weeks), 10 substitutes, everyone else *not selected*; each with a
   short "why". A starter of one event is never in the other event's lineup (the scarcer
   event picks first). Move or swap players manually.
3. **Share** – copy the plan text for the alliance chat. The plan stays editable until the event day.
4. **Attendance** – import the participation screenshot, mark who warned an R4;
   finalising applies suspensions (2 weeks by default) and updates history.

A **Requests** tab lets leaders handle players who are not in the roster yet and
self-reported power changes outside the accepted range.

All numbers are configurable in **Settings**. Data is shared by all R4s in a free Supabase
backend (invite-only logins, R4/R5 roles, live updates) with JSON backup/restore and CSV roster
import/export. Setup: [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md).

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` runs on local in-memory data (demo roster, always signed in as R5, nothing
is sent anywhere; set `VITE_USE_BACKEND=true` in `.env.local` to use Supabase). Open
**This week → Try the sample** to see the flow with sample screenshots, and
`#/join?code=LOCALDEV` to try the public join page.

**Upgrading an existing Supabase project:** run `supabase/migrations/0002_two_events_and_join.sql`
first – it is **destructive** (deletes all events and their history). See
[docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md#2b-upgrading-an-existing-project-team-a--team-b-and-the-join-page-0002).

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
* [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) – create the free backend, accounts and roles
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – layers, folders, backend design

## Tech

React 19 · TypeScript (strict) · Vite · vite-plugin-pwa (Workbox) · Supabase (Postgres, auth, realtime) ·
Tesseract.js (lazy-loaded OCR) · SheetJS (lazy-loaded `.xlsx` import) · Vitest.
Deployed to GitHub Pages by `.github/workflows/deploy.yml`.
