# PackWise: Project Development Documentation

| | |
|---|---|
| **Product** | PackWise, a travel outfit planner and packing checklist |
| **Repository** | https://github.com/gluekat/Travel_App |
| **Default (development) branch** | `claude/packwise-travel-app-m5rq30` |
| **Release branch** | `release` |
| **Version** | 0.1.0 (pre-release; see `SECURITY.md`) |
| **Document state** | Matches commit `b6f8bc1` (2026-10-17) |
| **Audience** | Project auditor; future developers |

This document records what PackWise is, how it is built, the decisions behind it, how data and privacy are handled, how it is tested and released, and its known limitations. Section 15 is a checklist for the auditor. File references are relative to the repository root.

---

## Contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Requirements and their status](#2-requirements-and-their-status)
3. [Architecture](#3-architecture)
4. [Technology stack](#4-technology-stack)
5. [Source layout](#5-source-layout)
6. [Data model and storage](#6-data-model-and-storage)
7. [Privacy and network behaviour](#7-privacy-and-network-behaviour)
8. [Weather subsystem](#8-weather-subsystem)
9. [Outfit engine](#9-outfit-engine)
10. [Packing checklist logic](#10-packing-checklist-logic)
11. [Data durability: data file sync and desktop app](#11-data-durability-data-file-sync-and-desktop-app)
12. [Build, release and deployment](#12-build-release-and-deployment)
13. [Testing and verification](#13-testing-and-verification)
14. [Security review notes](#14-security-review-notes)
15. [Audit checklist](#15-audit-checklist)
16. [Known limitations and open items](#16-known-limitations-and-open-items)
17. [Development history](#17-development-history)
18. [Developer guide](#18-developer-guide)
19. [Glossary](#19-glossary)

---

## 1. Purpose and scope

PackWise helps a traveller decide what to wear and pack. The user enters their wardrobe once (the **Closet**), creates a **Trip** with a destination, dates and daily activities, and gets weather-aware **outfit suggestions** drawn only from their own clothes. The app then produces a deduplicated **Packing Checklist**.

**Design principles**, fixed at the start of the project and kept since:

- **Local-first and private.** No backend, accounts, analytics, cloud database or cloud file storage. All user data stays on the user's device.
- **Minimal network use.** The only outbound requests are to the free Open-Meteo weather and geocoding APIs. They carry a place name, or coordinates plus a date range, and nothing else.
- **Works offline.** The app is installable (PWA) and loads with no network.
- **Replaceable intelligence.** Outfit logic is a pure, rules-based module behind a typed interface, so an LLM-based engine can be swapped in later.

**Out of scope** (by original specification): cloud sync, accounts, shopping recommendations, social sharing, laundry planning, image recognition, multi-traveller trips. Native mobile apps were also out of scope; see §16 for their current status.

---

## 2. Requirements and their status

### 2.1 Original MVP (2026-10-05)

| # | Requirement | Status | Where |
|---|---|---|---|
| R1 | React + TypeScript + Vite, Tailwind, responsive | ✅ | `package.json`, `src/` |
| R2 | Installable PWA; service worker precaches all assets | ✅ | `vite.config.ts` (vite-plugin-pwa) |
| R3 | All data in IndexedDB via Dexie, photos as resized Blobs (≤800 px) | ✅ | `src/db/`, `src/lib/image.ts` |
| R4 | No backend/accounts/analytics/cloud | ✅ | §7 |
| R5 | Request persistent storage | ✅ | `src/db/persist.ts` |
| R6 | Rules-based outfit logic in a separate pure module | ✅ | `src/engine/` |
| R7 | Only Open-Meteo requests; send only place/coords + dates | ✅ (tested) | `src/weather/openMeteo.ts` |
| R8 | Privacy documented in README and in-app | ✅ | `README.md`, `PrivacyNote.tsx` |
| R9 | One-click export/import of everything incl. photos | ✅ | `src/db/backup.ts` |
| R10 | No CDN dependencies at runtime; bundled assets | ✅ | system fonts, inline SVG icons |
| R11 | Forecast ≤16 days, historical beyond; cache with `fetchedAt`; manual fallback; source labels; offline message | ✅ | §8 |
| R12 | Closet CRUD with photo (upload/camera), filters, sample wardrobe + clear | ✅ | `src/features/closet/` |
| R13 | Trip with per-day activities and weather summary | ✅ | `src/features/trips/` |
| R14 | 1–2 outfits/day with "why", swap, lock, regenerate, gap flags | ✅ (reworked in v2, §2.2) | §9 |
| R15 | Packing list: deduplicated, grouped, persistent checkboxes, count, efficiency stat, extras, print | ✅ | §10 |
| R16 | Unit tests for outfit logic and weather fallback chain (mocked network) | ✅ | §13 |
| R17 | README: setup, PWA install, data leaving machine, backup | ✅ | `README.md` |

### 2.2 Change requests after the MVP

| Date | Request | Implementation |
|---|---|---|
| 10-16 | Wear count per item (default 1) | `ClosetItem.wearCount` = *wears before washing* (clarified with owner) |
| 10-16 | Count of duplicate items | `ClosetItem.quantity` |
| 10-16 | Multiple outfits per day | Any number of named outfits per day |
| 10-16 | Manual outfit selection; show the day, not suggestions; suggest only on button | Day view shows chosen outfits; **Suggest outfit** opens a panel |
| 10-16 | General trip items: underwear and socks (1/day), jacket, toiletries | General items with per-day or fixed quantity |
| 10-16 | Saved outfits in closet + favourites | `savedOutfits` table, Closet → Outfits tab |
| 10-16 | Favourite score on items, used in suggestions | `ClosetItem.favorite` 0–5, scoring bonus |
| 10-16 | Custom tags | `ClosetItem.customTags`, indexed |
| 10-16 | Rename to "Packing Checklist"; tabbed Trip Overview / Packing Checklist | `TripTabs.tsx` |
| 10-16 | Data must survive clearing browser data | Linked data file (§11.1) **and** desktop app (§11.2), as chosen by the owner |
| 10-16 | Fix the Azure deployment workflow | Owner chose GitHub Pages (§12.2) |
| 10-17 | Stable public version alongside the dev version | `release` branch → `/Travel_App/`; dev → `/Travel_App/dev/` (§12.3) |

---

## 3. Architecture

```
┌──────────────────────────── Browser / Tauri WebView ───────────────────────────┐
│                                                                                │
│  React UI (src/features, src/components)                                       │
│     │  reads via useLiveQuery (reactive)          ▲                            │
│     ▼                                             │                            │
│  Services (outfitService, tripService,            │                            │
│            savedOutfitService, tripWeather)       │                            │
│     │                 │                           │                            │
│     ▼                 ▼                           │                            │
│  Pure engine     Dexie / IndexedDB  ──storagemutated──► fileSync ──► Data file │
│  (src/engine)    (src/db)                         (debounced)   (browser-linked│
│                       ▲                                          or Documents/ │
│                       │ import / export (same JSON format)       PackWise/)    │
│  Weather client (src/weather) ── HTTPS ──► Open-Meteo (only outbound traffic)  │
│  Service worker (Workbox) precaches the app shell for offline use              │
└────────────────────────────────────────────────────────────────────────────────┘
```

Key points:

- **IndexedDB is the working store.** The UI reads it reactively with `dexie-react-hooks`, so every view updates when data changes.
- **Services** are the only code that writes to the database and calls the engine. UI components call services, not Dexie writes directly, apart from a few trivial field updates such as toggling a checkbox or setting a star rating.
- **The engine is pure.** `src/engine/*` imports no React, no Dexie and no network. It receives plain item and day data (never photos) and returns plain results. This is the seam for a future LLM engine (`OutfitEngine` in `src/engine/types.ts`).
- **Durability layer.** `src/storage/fileSync.ts` listens for database changes and mirrors the whole database to a JSON file on disk (§11).
- **Routing** is a minimal hash router (`src/lib/router.ts`), which works on static hosting with no server rewrites.

---

## 4. Technology stack

| Concern | Choice | Version | Notes |
|---|---|---|---|
| UI | React | 19.3 | function components + hooks |
| Language | TypeScript | 5.9 | `strict`, `noUnusedLocals` |
| Build | Vite | 8.3 | `base` configurable (§12) |
| Styling | Tailwind CSS | 4.3 | via `@tailwindcss/vite`; system font stack |
| Storage | Dexie (IndexedDB) | 4.4 | + `dexie-react-hooks` 4.4 |
| PWA | vite-plugin-pwa (Workbox) | 2.0 | `generateSW`, precache all assets |
| Desktop | Tauri | 2.12 | + `@tauri-apps/plugin-fs` 2.7; Rust ≥ 1.90 |
| Tests | Vitest + jsdom + fake-indexeddb | 5.0 / 29 / 6.2 | |
| CI/CD | GitHub Actions + GitHub Pages | — | §12 |

**Runtime dependencies:** six packages (`react`, `react-dom`, `dexie`, `dexie-react-hooks`, `@tauri-apps/api`, `@tauri-apps/plugin-fs`). The Tauri packages are imported only inside the desktop app (`src/main.tsx` checks `isTauri()` and dynamically imports `src/storage/desktopAdapter.ts`).

`npm audit` reports **0 vulnerabilities** as of 2026-10-19.

---

## 5. Source layout

```
.github/workflows/
  pages.yml            Build stable (release) + dev (default branch) → GitHub Pages
  promote.yml          "Promote dev to stable": fast-forward release, redeploy
  release-deploy.yml   Redeploy when release is pushed directly
  desktop-build.yml    Windows/macOS/Linux installers (manual or v* tag)
docs/                  This document and the user manual
public/                Icons (SVG + PNG) copied as-is into the build
src/
  main.tsx             Startup: seed, storage sync, service worker (web) / desktop adapter
  App.tsx              Shell, navigation, hash routes
  components/          Shared UI: ui.tsx (Button, Modal, Chip, Icon…), Tabs, Stars,
                       TagInput, ClosetPicker, ItemThumb, OfflineBanner, SyncBanner
  db/
    types.ts           Data model (all entities)
    schema.ts          Dexie schema v1→v3, cascade deletes
    migrate.ts         Data migrations, shared by schema upgrade and backup import
    backup.ts          Export / import (JSON, photos as base64)
    seed.ts            Sample wardrobe
    persist.ts         navigator.storage.persist()
  engine/              PURE outfit and packing logic
    types.ts           Engine contract (OutfitEngine, SuggestRequest, …)
    rules.ts           Warmth bands, rain rule, occasions, formality, slots, scoring
    suggest.ts         suggestOptions, planTrip, rankSavedOutfits, swapCandidates, gaps
    packing.ts         Copies to pack, stats, general item quantities
  features/
    closet/            Items + saved outfits (ClosetPage, ItemForm, PhotoInput, …)
    trips/             Trip list, trip overview, day cards, weather, place search
    outfits/           OutfitCard, SuggestPanel, outfitService (engine ↔ DB glue)
    packing/           Packing Checklist page
    settings/          Data & privacy page, data-file panel, privacy note
  lib/                 dates, units (°C/°F), hooks, router, image resize, channel
  storage/             Data-file sync (browser + desktop adapters), meta DB, reminders
  weather/             Open-Meteo client, fallback chain, WMO codes, persistence
src-tauri/             Desktop app (Rust shell, config, capabilities, icons)
```

The application code is about 6,000 lines of TypeScript/TSX, tests included.

---

## 6. Data model and storage

### 6.1 Databases

| Database (IndexedDB) | Purpose | Exported in backups |
|---|---|---|
| `packwise` | All user data (stable build) | Yes |
| `packwise-meta` | Sync bookkeeping: linked file handle, timestamps, reminder snooze | **No** (by design) |
| `packwise-dev`, `packwise-meta-dev` | Same, for the dev-preview build only (§12.3) | Yes / No |

### 6.2 Tables (`src/db/schema.ts`, schema version 3)

| Table | Primary key and indexes | Holds |
|---|---|---|
| `closetItems` | `++id, category, formality, *weatherTags, *activities, *customTags, isSample, updatedAt` | Clothing items incl. photo Blob |
| `savedOutfits` | `++id, favorite, updatedAt` | Outfits saved in the closet |
| `trips` | `++id, startDate, createdAt` | Destination, coordinates, dates |
| `tripDays` | `++id, tripId, [tripId+date]` | Activities and cached weather per day |
| `outfits` | `++id, tripId, tripDayId, [tripDayId+rank]` | Outfits chosen for a trip day |
| `packingItems` | `++id, tripId, itemId, [tripId+itemId]` | Checklist rows (closet item or general item) |
| `settings` | `key` | e.g. `tempUnit`, `lastExportAt`, `seeded` |

### 6.3 Main entities (`src/db/types.ts`)

- **ClosetItem**: `name, category` (top, bottom, dress, outerwear, shoes, accessory, swimwear, activewear), `color, warmth` (1–5), `formality` (casual, smart casual, formal), `weatherTags[]` (rain-ready, sun, cold, hot), `activities[]`, `quantity` (copies owned), `wearCount` (wears before washing), `favorite` (0–5), `customTags[]`, `photo?` (JPEG Blob ≤800 px), `isSample, createdAt, updatedAt`.
- **Trip**: `destination, placeLabel?, lat?, lon?, timezone?, startDate, endDate` (ISO `YYYY-MM-DD`). Maximum 30 days.
- **TripDay**: `tripId, date, activities[], weather?` where `weather = { high, low (°C), precipChance (0–100), code?, condition, source: 'forecast'|'historical'|'manual', fetchedAt }`.
- **Outfit**: `tripId, tripDayId, rank, label, activities?, itemIds[], lockedItemIds[], rationale`.
- **PackingItem**: `tripId, packed`, plus either `itemId` (closet item; copies computed from outfits) or `customLabel` with `qty` or `perDay` (general item).
- **SavedOutfit**: `name, itemIds[], favorite, createdAt, updatedAt`.

All temperatures are stored in °C and converted for display (`src/lib/units.ts`).

### 6.4 Schema versions and migrations

| Version | Change | Migration (`src/db/migrate.ts`) |
|---|---|---|
| 1 | MVP | — |
| 2 | `quantity`, `wearCount`; outfits are user-chosen only; general packing items | `migrateV1toV2`: defaults 1/1; drop unselected suggestions and the `selected` field; renumber ranks; give every day an empty outfit; add the default general items to each trip |
| 3 | `favorite`, `customTags`, `savedOutfits` table | `migrateV2toV3`: defaults 0 / [] |

The same migration functions run in two places:
1. Dexie `version(n).upgrade()`, when an existing browser database is opened by a newer app.
2. `importDatabase()`, when an older backup file is restored (it carries `version`).

Backups from a **newer** version are rejected with a clear message. Both migration paths are unit tested, including opening a real v1 database.

### 6.5 Integrity rules

- Deleting a closet item removes it from trip outfits, saved outfits and packing rows (`deleteClosetItem`, one transaction).
- Deleting a trip removes its days, outfits and packing rows (`deleteTrip`).
- Packing rows for closet items are reconciled with outfits after every outfit change (`syncPacking`). Existing rows, and their checkmarks, are kept.

### 6.6 Backup file format

```json
{ "app": "packwise", "version": 3, "exportedAt": "<ISO time>",
  "tables": { "closetItems": [...], "trips": [...], ... } }
```

Blobs are encoded as `{ "__blob": true, "type": "image/jpeg", "data": "<base64>" }`. The linked data file (§11) uses the identical format, so any data file can be imported as a backup.

---

## 7. Privacy and network behaviour

| Data | Where it lives | Leaves the device? |
|---|---|---|
| Closet items, photos, saved outfits | IndexedDB; optional data file on the user's disk | **Never** |
| Trips, activities, outfits, checklist | Same | **Never** |
| Destination name (as typed) | Sent to `geocoding-api.open-meteo.com` | Yes, only when the user presses **Find** |
| Coordinates + date range | Sent to `api.open-meteo.com` / `archive-api.open-meteo.com` | Yes, to fetch weather |

Controls in place:

- All `fetch` calls are in one file: `src/weather/openMeteo.ts`. A unit test asserts that weather requests carry **only** `latitude, longitude, daily, timezone, start_date, end_date`.
- The service worker has no runtime caching rules for external requests. Weather is cached by the app in IndexedDB.
- No fonts, scripts or icons are loaded from CDNs. Icons are inline SVG; fonts are the system stack.
- **Desktop app:** a Content Security Policy (`src-tauri/tauri.conf.json`) restricts `connect-src` to the three Open-Meteo hosts (plus Tauri IPC). File access is limited by capability scope to `$DOCUMENT/PackWise/**` and `$APPDATA/**` (`src-tauri/capabilities/default.json`).
- **Web hosting:** GitHub Pages serves only static files. It receives standard web-server request data (e.g. IP address) when a user loads the app, as any website does. It receives no user content.
- The privacy statement is shown in-app (*Data & privacy* page, trip screens) and in `README.md`.

---

## 8. Weather subsystem

**Files:** `src/weather/openMeteo.ts` (client), `resolveWeather.ts` (pure chain), `tripWeather.ts` (persistence), `wmo.ts` (weather codes).

**Fallback chain**, per day:

1. **Live forecast** for dates from today to today+15 (`/v1/forecast`, daily max/min temperature, max precipitation probability, weather code).
2. **Historical average** for dates outside that window: the previous 3 years from `/v1/archive`, a ±3-day window around each date. High and low are averaged. Rain chance is the share of sampled days with ≥1 mm precipitation. The condition is the most frequent weather code.
3. **Cached:** if a request fails, the last stored value for that day is kept.
4. **Missing:** no data at all. The UI shows a manual entry form (high, low, rain %), stored with `source: 'manual'`.

**Labels shown:** *Live forecast* (fetched within 3 h and online), *Cached forecast*, *Historical average* (or *(cached)*), *Manual entry*. An offline banner appears when the browser reports no network.

**Refresh policy:** when a trip opens, weather is fetched automatically if any day is missing data or the newest fetch is older than 3 hours. A **Refresh weather** button fetches on demand.

---

## 9. Outfit engine

**Files:** `src/engine/rules.ts`, `suggest.ts`, `types.ts`. Pure and deterministic (seeded jitter for variety).

### 9.1 Rules

**Temperature → warmth.** Effective temperature `t = 0.65·high + 0.35·low` (°C):

| Band | t (°C) | Core warmth target | Outerwear minimum warmth |
|---|---|---|---|
| hot | ≥ 26 | 1 | none |
| warm | 20–26 | 1.5 | none |
| mild | 14–20 | 2 | 2 if low < 12, else none |
| cool | 7–14 | 3 | 3 |
| cold | 0–7 | 3 | 4 |
| freezing | < 0 | 4 | 5 |

**Rain.** If precipitation chance is **> 50%**, rain-ready outerwear or shoes are strongly preferred (+4), and a gap is reported if the closet has neither.

**Occasions.** Activities group into occasions: *active* (hiking, workout), *beach*, *everyday* (sightseeing, travel day, lounging), *dressy* (dinner out, business, nightlife). Required formality: business → formal; dinner out or nightlife → smart casual; otherwise casual. "Fill empty days" creates one outfit per occasion, e.g. hiking by day plus dinner in the evening.

**Slots.** An outfit is a dress **or** top + bottom, plus shoes. Swimwear is added for the beach, outerwear when needed for warmth or rain, and an accessory only if it scores well. Activewear may fill the top or bottom slot. A dress conflicts with top and bottom.

### 9.2 Scoring (per item, per slot)

| Factor | Effect |
|---|---|
| Warmth vs target | −1.5 per level of difference (core); outerwear rewarded if ≥ minimum, penalised if below or if heavy on a warm day |
| Weather tags | `hot`/`cold` ±1/−2 by band; `sun` +0.5 on hot, dry days |
| Rain | rain-ready +4 (outerwear/shoes) or +1 (other) |
| Activity match | +2 for first match, +0.5 per extra |
| Formality | −4 per level too casual; −0.5 (or −2 when active/beach) per level too formal |
| Activewear | +1.5 when active, −2 otherwise |
| **Clean wears** | +1.5 if already packed and wears remain; **−8** if all `quantity × wearCount` wears are used |
| Avoid set | −3 (makes the second option differ) |
| **Favourite** | +0.5 per star (max +2.5) |
| Jitter | 0–0.4, seeded |

Further rules:
- **Locked items** are always kept, and slots they conflict with are never filled.
- **No repeats:** an outfit identical to the previous day's is never suggested. The cheapest single-item change is made instead, or a note is shown if the closet has no alternative.
- **Gap detection** reports missing shoes, missing core pieces, missing rain gear, outerwear that isn't warm enough, missing swimwear, missing formal pieces and missing hiking shoes, plus items planned for more wears than they have clean.
- **Saved outfits** are ranked for a day by average item score, +2 if marked favourite (`rankSavedOutfits`).

### 9.3 Public API (engine)

| Function | Used by | Purpose |
|---|---|---|
| `suggestOptions(req, count)` | Suggest panel | Up to `count` distinct options for one outfit, with rationale and gaps |
| `planTrip(items, days, opts)` | "Suggest outfits for empty days" | One outfit per occasion per day, respecting wear capacity |
| `rankSavedOutfits(...)` | Suggest panel | Saved outfits best-first for a day |
| `swapCandidates(...)` | Swap dialog | Same-slot alternatives, best-first |
| `capacityGaps`, `countWears`, `detectGaps`, `explainOutfit` | UI warnings | Diagnostics and "why" text |

To replace the engine, implement `OutfitEngine` (`src/engine/types.ts`) and route `src/features/outfits/outfitService.ts` to it. Inputs contain no photos.

---

## 10. Packing checklist logic

**File:** `src/engine/packing.ts`, UI in `src/features/packing/PackingPage.tsx`.

- **Copies to pack** per item = `min(quantity, ceil(planned wears ÷ wearCount))`. If planned wears exceed `quantity × wearCount`, the shortfall is shown ("pack more or plan laundry").
- **General items** (underwear, socks, jacket, toiletries by default, plus user-added items) have either a fixed quantity or a **per-day** quantity: `perDay × trip days`.
- **Stats:** total pieces (clothing copies + general quantities), "N outfits from M clothing pieces", and *mix-and-match* = average wears per packed piece.
- Checkmarks are stored per row and survive regeneration, because rows are reconciled rather than recreated.
- **Print view:** `@media print` hides navigation and controls.

---

## 11. Data durability: data file sync and desktop app

**Problem:** browser storage, IndexedDB included, is deleted when the user clears browser data.

### 11.1 Linked data file (web, Chromium browsers)

**File:** `src/storage/fileSync.ts`, using the File System Access API.

- **Create data file…** (`showSaveFilePicker`) or **Open existing data file…** (`showOpenFilePicker`). The file handle is stored in the meta database, which is never exported.
- Every change to the main database fires Dexie's `storagemutated` event. It is filtered to the main database, debounced by 1.5 s, and the whole database is written to the file in export format. Pending changes are also flushed when the page is hidden.
- On (re)connection, `decideReconcile()` chooses an action:

| Situation | Action |
|---|---|
| File empty or invalid | Write this browser's data |
| This browser has no user data (e.g. just cleared) | Load the file |
| Only the file changed since last sync | Load the file |
| Only the browser changed | Write |
| Both changed, or never synced and both have data | **Ask the user** (keep file / keep browser) |

- After a browser restart, permission may need re-granting with a click. A banner offers **Reconnect**.
- **Unsupported browsers** (Safari, Firefox, mobile): a reminder banner appears when there are changes not backed up for 7 days (snooze 3 days). Backups use the share sheet on touch devices (`navigator.share` with a file), so they can be saved to the Files app.

### 11.2 Desktop app (Tauri)

**Files:** `src-tauri/`, `src/storage/desktopAdapter.ts`.

- The same web app, packaged in Tauri 2. On start it connects automatically to `Documents/PackWise/packwise-data.json`, falling back to the app data folder if no Documents folder is registered. There is no picker or permission prompt.
- Writes are atomic: data goes to `….tmp` and is then renamed.
- Reinstalling restores from the file, since the app's own storage is empty and the file is loaded.
- No service worker inside the desktop app.

---

## 12. Build, release and deployment

### 12.1 Build variables

| Variable | Default | Effect |
|---|---|---|
| `VITE_BASE` | `/` | Public path; `/Travel_App/` or `/Travel_App/dev/` on Pages. Also sets manifest `start_url`/`scope`/`id` and the service-worker fallback |
| `VITE_CHANNEL` | (stable) | `dev` → separate storage names, "DEV" badge, "PackWise (dev)" title, separate installable app |

### 12.2 Hosting: GitHub Pages

| Site | URL | Source |
|---|---|---|
| Stable | https://gluekat.github.io/Travel_App/ | `release` branch |
| Dev preview | https://gluekat.github.io/Travel_App/dev/ | default branch |

Repository setting: *Settings → Pages → Source = GitHub Actions*. With "Deploy from a branch" selected, GitHub's own deployment overwrites the build with raw sources and the site shows a blank page (this happened once; §17).

### 12.3 Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `pages.yml` | push to default branch; manual | Checks out **both** branches; `npm ci`, `npm test`, build each with its variables; combines `stable → /`, `dev → /dev/`; deploys to Pages. Concurrency group `pages` cancels superseded runs |
| `promote.yml` | manual ("Promote dev to stable") | Fast-forwards `release` to the default branch (refuses if `release` has diverged); triggers `pages.yml` |
| `release-deploy.yml` | push to `release` | Triggers `pages.yml` on the default branch (deployments run from the default branch, which the `github-pages` environment allows) |
| `desktop-build.yml` | manual; `v*` tags | Builds Windows (`.msi`, `.exe`), macOS (Apple Silicon, Intel `.dmg`) and Linux (`.deb`, `.rpm`, `.AppImage`); uploads artifacts; drafts a release on tags |

**Stable vs dev isolation on one origin:** separate IndexedDB names, separate data-file names, separate manifest `id`s, separate service-worker scopes. Stable's service worker excludes `/dev/` navigations (`navigateFallbackDenylist`). This was verified in a local side-by-side test, online and offline.

### 12.4 Release procedure

1. Merge or push work to the default branch. The dev preview updates automatically.
2. Check the dev preview.
3. *Actions → Promote dev to stable → Run workflow.*
4. Optional, for desktop installers: push a tag `vX.Y.Z` (bump `version` in `package.json` and `src-tauri/tauri.conf.json` first), then publish the draft release.

---

## 13. Testing and verification

### 13.1 Automated tests (`npm test`, run in CI on every deploy)

| Suite | Tests | Covers |
|---|---|---|
| `src/engine/suggest.test.ts` | 37 | Warmth bands, formality, occasions; heat/cold/rain (>50% vs exactly 50%); beach; distinct options; locks and conflicts; no consecutive repeats; wear capacity and its gaps; favourites (preferred, but never over weather); saved-outfit ranking; swaps; packing copies/shortfall/stats; general quantities |
| `src/weather/resolveWeather.test.ts` | 12 | Forecast window, Feb 29 shifting, live → historical → cached → missing chain, straddling the window, HTTP errors, **request parameters limited to coords and dates**, source labels, geocoding |
| `src/storage/fileSync.test.ts` | 15 | Reconcile decision table; file parsing; **"clear browser data → reopen file → everything restored"**; conflict (keep file / keep browser); write errors; reminder rules |
| `src/db/backup.test.ts` | 11 | Export/import round trip incl. photo Blobs; rejects foreign/newer files; weather cache survives failed refresh; manual and multi-outfit editing; fill-empty-days; packing sync keeps checkmarks; saved outfits; custom tag index; **v1 backup import and real v1 database upgrade** |
| **Total** | **75** | All passing at `b6f8bc1` |

The network is always mocked; no test calls Open-Meteo.

### 13.2 Manual and browser verification performed during development

Headless-Chromium scripts were run against production builds at each milestone. These scripts are not committed (see §16).

- MVP definition of done: 10 items with photos, 5-day trip, weather-aware suggestions, swap, lock, deduplicated checklist, offline reload, export → import into a fresh profile, and only Open-Meteo hosts contacted.
- v2/v3 features: manual outfits, multiple outfits, suggestion panel, general items, favourites, tags, saved outfits, tabs.
- Data file: create, auto-save, wipe IndexedDB, reopen the file, data restored.
- Desktop (Linux build run under Xvfb): file created in `Documents/PackWise`; restored after wiping app storage.
- GitHub Pages sub-path build, offline; stable + dev side by side with separate data.

**Not verified by the developer:**
- Live Open-Meteo responses: the development sandbox blocked those hosts, so a mock with the same response schema was used. The owner has since used the live site.
- Windows and macOS desktop installers on real machines: they build in CI but have not been launched.

---

## 14. Security review notes

| Area | Assessment |
|---|---|
| Attack surface | Static site; no server, no auth, no user-to-user data. Inputs are the user's own data and Open-Meteo JSON |
| XSS | React escapes all rendered text; no `dangerouslySetInnerHTML`; no `eval` |
| Third-party code at runtime | None loaded from CDNs; all dependencies bundled at build time |
| Dependencies | `npm audit`: 0 vulnerabilities (2026-10-19). Dependabot is enabled; its Cargo update jobs for `glib` are currently failing (§16) |
| Import of backup files | Validated (`app`, `version`, table shapes) before replacing data; the user must confirm; newer versions rejected |
| Desktop | CSP limits network to Open-Meteo; fs capability scoped to the PackWise folder; installers are **not code-signed** |
| Web CSP | **No CSP header or meta tag** on the GitHub Pages site (Pages can't set headers). Recommended: add a `<meta http-equiv="Content-Security-Policy">` mirroring the desktop policy |
| Secrets | None used by the app. CI uses only the built-in `GITHUB_TOKEN`; workflow permissions are minimal per job |
| `SECURITY.md` | Contains placeholder contact details (*"email"*, *url*); needs real values |

---

## 15. Audit checklist

| # | Check | How to verify |
|---|---|---|
| A1 | Only Open-Meteo is contacted | `grep -rn "fetch(" src` (one site: `openMeteo.ts`); test "only sends coordinates and dates"; browser DevTools → Network |
| A2 | No user data in requests | Same test; inspect query strings in DevTools |
| A3 | Data stays local | No backend code; `tables` only in IndexedDB/file; Pages artifact = `dist/` static files |
| A4 | Backup/restore complete | `backup.test.ts` round trip incl. Blobs |
| A5 | Upgrades preserve data | `backup.test.ts` "upgrades an existing v1 browser database", "imports a v1 backup file" |
| A6 | Survives clearing browser data | `fileSync.test.ts` "survives clearing browser data"; manual: §13.2 |
| A7 | Stable unaffected by dev | `src/lib/channel.ts`; side-by-side test notes §12.3 |
| A8 | Rules as specified | Tables in §9.1; tests in `suggest.test.ts` |
| A9 | Build reproducible | `npm ci && npm test && npm run build`; CI logs for `pages.yml` |
| A10 | Desktop permissions | `src-tauri/capabilities/default.json`, `tauri.conf.json` → `security.csp` |

---

## 16. Known limitations and open items

| # | Item | Impact | Suggested action |
|---|---|---|---|
| L1 | Linked data file works only in Chromium desktop browsers | Safari/Firefox/mobile users rely on reminders + manual backups | Desktop app; or native mobile (L2) |
| L2 | No iOS/Android app | Phone data lives only in browser storage | `npx tauri ios init` / `android init`; needs Xcode + Apple developer account / Android SDK |
| L3 | Desktop installers unsigned and untested on Windows/macOS | OS warnings on first launch; possible platform issues | Code-signing certificates; manual test pass |
| L4 | Whole database written to the data file on each change; photos are base64 inside it | Large closets (hundreds of photos) mean multi-MB writes | Store photos as separate files in a linked folder |
| L5 | Conflict resolution is whole-dataset (no per-record merge) | User picks one side | Per-record timestamps + merge |
| L6 | No CSP on the web build | Defence-in-depth gap | Add CSP meta tag (§14) |
| L7 | Browser E2E scripts not committed; no component tests | UI regressions are caught only manually | Add Playwright tests to CI; `@testing-library/react` is installed but unused |
| L8 | Dependabot Cargo jobs for `glib` failing | Noise; possible pending advisory in the GTK stack (Linux desktop) | Investigate; may require a Tauri/wry upgrade |
| L9 | `SECURITY.md` placeholders | No working vulnerability contact | Fill in |
| L10 | Development branch name is session-generated (`claude/…`) | Cosmetic; it is the default branch | Optionally rename to `main` and update `pages.yml`, `promote.yml` |
| L11 | Historical averages use 3 years and ±3 days | Coarse for unusual seasons | Configurable window |
| L12 | No internationalisation; English only. Accessibility uses labels/roles but has not been formally audited | — | WCAG review |
| L13 | Dev and stable share browser quota and service-worker registry on one origin | Minor | Separate domain if needed |

---

## 17. Development history

| Date | Commit(s) | Milestone |
|---|---|---|
| 2026-10-05 | `4496514` → `6863795` | MVP in five slices: closet + export/import → trips + weather → outfit engine → packing list → PWA + README. Built first in `gluekat/ByrdStuff/packwise`, then moved to `Travel_App` with history preserved |
| 2026-10-05 → 10-09 | owner commits | Owner added Pages/Azure workflow experiments, CNAME changes, `SECURITY.md` |
| 2026-10-16 | `4fa426d` | v2: quantity, wears before washing, manual and multiple outfits, general items; schema v2 + migrations |
| 2026-10-16 | `6ea1d1e` | v3: saved outfits, favourite score, custom tags, Trip Overview / Packing Checklist tabs |
| 2026-10-16 | `755839b` | Linked data file sync; backup reminders; share-sheet backups |
| 2026-10-16 | `7687cc2`, `3bd3ac3` | Tauri desktop app; installer workflow (first run failed on a missing `tauri` npm script, fixed) |
| 2026-10-16 | `8bf1869` | GitHub Pages replaces the Azure workflow (which failed for lack of credentials and targeted the wrong service type) |
| 2026-10-17 | — (settings) | Blank-page incident: the legacy "Deploy from a branch" Pages build overwrote the app with raw sources. Fixed by switching Pages Source to GitHub Actions |
| 2026-10-17 | `b6f8bc1` | Stable (`release`) + dev preview channels; promote workflow |

Decisions and the reasons for them:
- **Hash routing:** static hosting with no rewrites, and simple offline support.
- **Pure engine with seeded jitter:** testable, reproducible, swappable.
- **Data file in export format:** one format to validate and migrate; any data file doubles as a backup.
- **Separate meta database:** file handles can't be serialised and must never appear in backups.
- **Promote by fast-forward only:** stable is always a known dev commit, and history is never rewritten.

---

## 18. Developer guide

### 18.1 Setup

```bash
git clone https://github.com/gluekat/Travel_App && cd Travel_App
npm install
npm run dev          # http://localhost:5173 (no service worker in dev)
npm test             # unit tests
npm run build        # typecheck + production build → dist/
npm run preview      # serve dist/ with the service worker
npm run desktop:dev  # desktop app with live reload (needs Rust + Tauri prerequisites)
```

Node 20+ is required (CI uses 22). Desktop builds need Rust ≥ 1.90; on Linux they also need `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev`.

### 18.2 Conventions

- Keep `src/engine/` pure: no imports from `db/`, `features/`, React or the network.
- Writes go through service modules (`outfitService`, `tripService`, `savedOutfitService`, `tripWeather`).
- New outbound requests are **not allowed** without a privacy review. Weather calls stay in `openMeteo.ts`.
- Small, typed components. Tailwind classes inline. Icons as inline SVG paths in `components/ui.tsx`.

### 18.3 Changing the data model

1. Update `src/db/types.ts`.
2. Add `this.version(N+1)` in `schema.ts` with an `upgrade()` that calls a new `migrateVNtoVN1()` in `migrate.ts`.
3. Bump `CURRENT_DATA_VERSION` and add the step to `migrateTables()`, so old backups import correctly.
4. Add tests for both paths (see "migration from v1 data" in `backup.test.ts`).
5. Remember that dev-channel data is separate. Promote only after migrations are tested.

### 18.4 Adding a closet attribute used by suggestions

Add it to `ClosetItem`, then `EngineItem` + `toEngineItem()` (`outfitService.ts`), then scoring in `rules.ts`, then the rationale in `explainOutfit()`, then tests.

---

## 19. Glossary

| Term | Meaning |
|---|---|
| Wears before washing (`wearCount`) | Times one copy can be worn before it needs washing |
| Capacity | `quantity × wearCount`: wears available on a trip |
| Occasion | Group of activities with similar clothing needs (active, beach, everyday, dressy) |
| Gap | Something the closet can't cover for a day (e.g. no rain gear) |
| Channel | Build flavour: `stable` or `dev` |
| Data file | JSON copy of the whole database on the user's disk, kept in sync |
| Promote | Fast-forward `release` to the dev branch and redeploy |
