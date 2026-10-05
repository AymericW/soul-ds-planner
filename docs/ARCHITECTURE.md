# Architecture

A mobile-first, offline PWA built with **React 19 + TypeScript (strict) + Vite**,
**vite-plugin-pwa** (manifest + Workbox service worker), **IndexedDB** via `idb`,
**Tesseract.js** (on-device OCR, lazy-loaded) and **SheetJS** (`.xlsx` import,
lazy-loaded). No server: all data stays on the device.

## Layers and dependency direction

```
screens ──► viewmodels ──► data (repositories) ─┐
   │             │    └──► services ────────────┤
   ▼             └───────► domain ──────────────┤
components                                       ▼
   └────────────────────────────────► models, constants, helpers
```

| Layer | Folder | Responsibility | May import |
| --- | --- | --- | --- |
| constants | `src/constants` | defaults, storage keys, routes, rule values, theme tokens, PWA manifest | model *types* |
| models | `src/models` | plain TypeScript types (Member, WeekEvent, Assignment, Attendance, Suspension, Settings…) | nothing |
| helpers | `src/helpers` | pure utilities: name normalisation, fuzzy matching, CSV, formatting, dates, image pixel processing | constants, models |
| domain | `src/domain` | **all business rules**, pure and deterministic: scoring, selection, rotation, penalties, history, roster import plan, event lifecycle | constants, models, helpers |
| services | `src/services` | side effects behind small interfaces: OCR (Tesseract), file import (CSV/XLSX), export/backup, clipboard | + domain |
| data | `src/data` | repository **interfaces** + IndexedDB and in-memory implementations, demo roster | + domain |
| viewmodels | `src/viewmodels` | React hooks that load data, call domain/services and expose ready-to-render state + actions | everything above |
| components | `src/components` | presentational UI (no data access, no rules) | constants, models, helpers |
| screens | `src/screens` | compose components with a viewmodel; **no business logic** | viewmodels, components, helpers, constants, models |
| root | `src/main.tsx`, `App.tsx`, `compositionRoot.ts` | bootstrapping and wiring | all |

The rules are enforced twice:

* `scripts/check-architecture.mjs` (runs in `npm run lint`): checks every import
  against the table above, forbids framework/IO packages in pure layers, and fails
  on any circular import.
* `eslint.config.js`: `no-restricted-imports` per folder with the same map.

## Folder map

```
src/
  constants/   defaults.ts, rules.ts, routes.ts, storageKeys.ts, theme.ts, pwa.ts
  models/      Member, Settings, Registration, Assignment, Attendance, Suspension, WeekEvent, MemberStats, Backup, RosterImport
  domain/
    scoring/     relativeScore.ts (formula), coreRanking.ts (ε close-call rule)
    selection/   eligibility, core, rotation, substitutes, runSelection (orchestrator), overrides, planText
    penalties/   penaltyRules, suspensions (countdown, lift), finaliseEvent
    history/     eventHistory (played, events since), memberStats (participation)
    events/      eventLifecycle (registrations, lock, attendance edits)
    roster/      memberRules (validation, aliases), importPlan (add/update/skip)
    settings/    settingsRules (validation)
  helpers/     normalise, fuzzy, nameMatching (OCR text → members), csv, format, dates, imagePreprocessing, id
  services/    ocrService, importService + rosterTableParser, exportService (backup, CSV), clipboardService
  data/        repositories.ts (interfaces), indexeddb/, memory/, demo/, settingsMerge.ts
  viewmodels/  AppServicesContext, ToastContext, useAppData, useNavigationViewModel,
               useRosterViewModel, useWeeklyEventViewModel, useScreenshotOcr,
               useHistoryViewModel, useSettingsViewModel, useDemoData
  components/  BottomNav, MemberChecklist, ScreenshotUploader, SlotBoard, PlayerCard, PlayerActionSheet,
               AttendanceList, UnmatchedNames, MemberForm, MemberCard, ImportPreviewPanel, Modal,
               ConfirmDialog, ToastHost, NumberStepper, Segmented, SearchInput, StepIndicator, …
  screens/     RosterScreen, WeeklyEventScreen (4-step wizard), HistoryScreen, SettingsScreen
  compositionRoot.ts   the ONLY place choosing implementations
tests/         Vitest unit tests (domain, helpers, services, data) + OCR fixtures
scripts/       generate-icons.mjs, check-architecture.mjs
```

## Data model in one paragraph

A `WeekEvent` moves through `registration → planned → locked → finalised`.
It holds `registrations` (who voted), `assignments` (slot + order + reason per
player), `attendance` (entered / notified) and the ids of suspensions it issued.
`Suspension`s live in their own store and count down when later events are
finalised. Statistics (participation, last played) are **derived** from
finalised events and never stored, so they can never get out of sync.

## Persistence and the composition root

`src/data/repositories.ts` defines `MemberRepository`, `EventRepository`,
`SuspensionRepository`, `SettingsRepository` and the `Repositories` bundle.
`src/compositionRoot.ts` creates the IndexedDB implementation (falling back to
the in-memory one when IndexedDB is blocked) together with the services, and
`main.tsx` passes the result to `<AppServicesProvider>`. Viewmodels only see the
interfaces through `useAppServices()`.

### Adding a cloud repository later

1. Create `src/data/cloud/CloudRepositories.ts` exporting
   `createCloudRepositories(config): Repositories` (Firestore, Supabase, a REST
   API…). Implement the four interfaces – the in-memory implementation is a
   good, tiny template.
2. Run the existing repository contract test against it
   (`tests/data/inMemoryRepositories.test.ts` shows the expectations).
3. In `src/compositionRoot.ts`, return the cloud repositories (for example when
   the user is signed in) instead of the IndexedDB ones.
4. Nothing in domain, viewmodels or screens changes. To migrate existing
   devices, export a JSON backup and write it with `replaceAll` into the new store.

## OCR pipeline

1. `ScreenshotUploader` hands the image to `useScreenshotOcr` (viewmodel).
2. `ocrService` lazily `import('tesseract.js')` (own chunk, ~downloaded only on
   first use), prepares a canvas with `helpers/imagePreprocessing` (upscale to
   ~1600 px, greyscale, invert dark screenshots, contrast stretch) and recognises
   English text. The service worker caches the engine files for offline reuse.
3. `helpers/nameMatching` cleans each line (alliance tags, numbers, times),
   builds word windows, and compares them with each member's normalised name and
   learned aliases (exact → OCR-confusion fold → glued tag → edit distance,
   stricter for short names). Each word is used for one member only.
4. Matches are ticked; unmatched lines are offered as chips. Assigning one saves
   the spelling as an alias on the member, so it is recognised next time.
5. Any failure (offline first use, timeout, old device) raises
   `OcrUnavailableError`; the UI shows a clear message and the manual checklist
   keeps working.

## Testing

* `npm test` – Vitest unit tests for every rule (see docs/ALGORITHM.md table),
  fuzzy matching (including real Tesseract output of the sample screenshots in
  `tests/fixtures/`), CSV/roster parsing, backups, settings and repositories.
* `npm run lint` – ESLint + architecture/cycle check. `npm run typecheck` – tsc.
