# PackWise

PackWise is a local-first travel app that picks and packs outfits for a trip from **your own closet**, based on the forecast and what you plan to do each day.

- **Closet:** enter your wardrobe once, with photos, warmth, formality, weather tags, the activities each item suits, **how many identical copies you own** (e.g. white socks ×5), **how many wears each copy lasts before washing** (default 1), a **favorite score** (0–5 ★) and your own **custom tags** (e.g. #packable). Filter by category, tag, custom tag or favorites.
- **Saved outfits:** the Closet's **Outfits** tab stores outfits you like for future trips. Create them there or use **Save to closet** on any trip outfit, and star your favorites.
- **Trips:** set a destination and dates, then pick activities for each day. Weather comes from Open-Meteo.
- **Outfits:** each day shows its weather and the outfit(s) you chose. Build them by hand (add, swap, lock or remove items), add as many outfits per day as you like (e.g. "Hiking", "Dinner"), and press **Suggest outfit** when you want ideas: you get two fresh options plus your best-fitting saved outfits (favorites first), each with a short "why" and any gaps (e.g. *"No rain-ready outerwear for Day 3"*). **Suggest outfits for empty days** fills every day you haven't planned yet.
- **Trip tabs:** each trip has a **Trip Overview** (days, weather, outfits; the default) and a **Packing Checklist** tab.
- **Packing Checklist:** general items for the whole trip (Underwear and Socks at 1 per day, Jacket, Toiletries, plus your own), then clothes grouped by category with the number of copies to pack. Checkboxes persist, and there's a mix-and-match stat and a print view.
- **Works offline:** it installs as a PWA, and everything is stored in your browser.

## Setup

Requires Node 20+.

```bash
cd Travel_App
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (service worker enabled)
```

The service worker is only active in the production build (`npm run build && npm run preview`), or when you deploy `dist/` to any static host. HTTPS is required for installation everywhere except `localhost`.

## Live version (GitHub Pages)

The latest build is published to **https://gluekat.github.io/Travel_App/** on every push to the default branch, by `.github/workflows/pages.yml` (tests → build → deploy). It's handy for sharing the work in progress. Anyone with the link can use the app, and each visitor's closet and trips stay in their own browser. Only the app's files are hosted.

One-time setup: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.

The Pages build sets `VITE_BASE=/Travel_App/` because Pages serves the site from that sub-path. Local, preview and desktop builds use `/`.

## Installing the app (PWA)

1. Open the production build in Chrome, Edge or Safari.
2. Install it:
   - **Desktop Chrome/Edge:** click the install icon in the address bar (or ⋮ → *Install PackWise*).
   - **Android Chrome:** ⋮ → *Add to Home screen / Install app*.
   - **iOS Safari:** Share → *Add to Home Screen*.
3. Once loaded, the whole app is precached. It opens with no network and shows your saved data and the last cached weather.

## Privacy: what leaves your machine

**Only weather lookups.** PackWise has no backend, accounts, analytics, cloud database or cloud file storage, and loads no fonts, icons or scripts from a CDN.

| Request | Sent to | Contains |
| --- | --- | --- |
| Find destination | `geocoding-api.open-meteo.com` | the destination name you typed |
| Forecast (dates within 16 days) | `api.open-meteo.com` | latitude/longitude, date range |
| Typical weather (dates beyond 16 days) | `archive-api.open-meteo.com` | latitude/longitude, the same dates in the 3 previous years |

Your closet, photos, activities, outfits and packing lists are **never** sent anywhere. All `fetch` calls live in [`src/weather/openMeteo.ts`](src/weather/openMeteo.ts). A unit test checks that weather requests carry only coordinates, dates and the requested fields.

## Your data and backups

PackWise works on a local database in the browser (**IndexedDB**). It holds closet items, photos (resized to 800px JPEG Blobs), saved outfits, trips, days, cached weather, outfits, packing lists and settings. On startup the app asks for persistent storage (`navigator.storage.persist()`) so the browser doesn't evict it when disk space runs low.

Browser storage is still deleted when you **clear browser data**. To survive that, keep a copy on your own disk:

### Linked data file (Chrome / Edge on a computer)

*Data & privacy* → **Create data file…** and pick a location, e.g. `Documents/PackWise/packwise-data.json`. From then on, every change is saved to that file automatically, about 1.5 seconds after you make it and when you switch away from the app.

- **After clearing browser data** (or on another browser or computer): *Data & privacy* → **Open existing data file…** and choose the same file. Everything comes back.
- After a browser restart, Chrome may ask you to allow access to the file again. A banner offers **Reconnect**.
- If the file and the browser both changed while disconnected, PackWise asks which one to keep instead of overwriting either.
- The file uses the same format as Export, so it is also a full backup. It never leaves your machine unless you put it in a synced folder yourself.

This uses the browser's File System Access API (`src/storage/fileSync.ts`), which Safari, Firefox and mobile browsers don't offer.

### Desktop app (Windows, macOS, Linux)

The PackWise desktop app is the same app wrapped with [Tauri](https://tauri.app). It saves every change automatically to **`Documents/PackWise/packwise-data.json`**, with no picker and no permission prompts. That folder belongs to you, not a browser, so clearing browser data doesn't touch it, and reinstalling the app reloads your data from it. The app is only allowed to read and write that folder (`src-tauri/capabilities/default.json`), and its content security policy only allows network requests to Open-Meteo.

- **Get installers:** on GitHub, *Actions → Desktop app → Run workflow*. Each run attaches Windows (`.msi` / `.exe`), macOS (`.dmg`, Apple Silicon and Intel) and Linux (`.deb`, `.rpm`, `.AppImage`) builds as artifacts. Pushing a tag like `v0.2.0` also creates a draft release with them.
- The installers are not code-signed, so Windows SmartScreen and macOS Gatekeeper will warn on first launch. On a Mac, right-click → *Open*.
- **Build locally:** install [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/), then run `npm run desktop:dev` (live reload) or `npm run desktop:build`.
- **Move data from the browser:** in the browser, *Export / save a backup*. In the desktop app, *Import backup…*. Or open the browser's linked data file in the desktop app via Import.

Phones: Tauri can also build iOS and Android apps from this project (`npx tauri ios init` / `npx tauri android init`). This needs Xcode with an Apple developer account, or the Android SDK. It hasn't been set up or tested yet. On mobile the data file goes in the app's private storage, which also survives clearing the browser.

### Everywhere else: backups and reminders

In Safari, Firefox, and on phones and tablets, data lives only in the browser. When you have changes that haven't been backed up for a week, a banner reminds you. **Save a backup** opens the share sheet on phones and tablets (choose *Save to Files*) and downloads the file on computers.

- **Back up:** *Data & privacy* → **Export / save a backup (JSON)**. This saves `packwise-backup-YYYY-MM-DD.json` with every table, photos embedded as base64.
- **Restore:** *Data & privacy* → **Import backup…**, then choose the file. This **replaces** all PackWise data in this browser. Backups from older versions are upgraded automatically.

## Weather

For each trip day, PackWise tries these sources in order:

1. **Live forecast:** dates from today to 15 days ahead.
2. **Historical average:** dates beyond that (or in the past). It averages the same ±3-day window over the previous 3 years. Rain chance is the share of those days with ≥1 mm of rain.
3. **Cached:** if the network fails, the last stored result is used (each day stores `fetchedAt`).
4. **Manual:** if there's no cache either, you enter the high, low and rain % yourself.

Each day shows a badge: *Live forecast*, *Historical average*, *Cached forecast* or *Manual entry*. An offline banner appears whenever the network is unavailable. Weather is fetched automatically when a trip opens (if it's missing or more than 3 hours old), and **Refresh weather** fetches it again on demand.

## Outfit logic (rules-based v1)

The engine lives in [`src/engine/`](src/engine) and is pure TypeScript: no React, no Dexie, no network. It works only on item IDs and attributes, never photos. [`types.ts`](src/engine/types.ts) defines the contract (`OutfitEngine.planTrip`), so an LLM-backed engine can replace it later.

- Temperature maps to a core warmth target and a minimum outerwear warmth (`rules.ts › warmthNeeds`).
- Precipitation chance **> 50%** requires rain-ready outerwear or footwear.
- Activities set the required formality (business → formal; dinner out or nightlife → smart casual) and boost items tagged for those activities.
- **Suggest outfit** dresses for the activities you pick for that outfit, keeping any locked items. **Suggest outfits for empty days** gives a day with different kinds of activities (e.g. hiking + dinner) one outfit for each.
- Items already chosen on other days score higher, to keep the packing list small, but only while they have clean wears left. An item can be worn **copies owned × wears before washing** times per trip. Beyond that it's avoided, and if it's still used you get a warning to pack more or plan laundry.
- Each item's favorite score adds up to +2.5 to its score (5 ★), so preferred items win when they fit, but they never override weather, rain or formality rules. Saved outfits are ranked by how well their items fit the day, with +2 for favorite outfits.
- The packing list packs `min(copies owned, ceil(planned wears ÷ wears before washing))` of each item.
- The exact same outfit is never suggested on two consecutive days.
- Locked items are always kept, and conflicting slots are never filled (e.g. a locked dress blocks tops and bottoms).

## Project layout

```
src/
  db/          Dexie schema, types, seed data, backup (export/import), persistence
  weather/     Open-Meteo client, fallback chain, trip weather persistence
  engine/      pure outfit + packing logic (unit tested)
  features/    closet, trips, outfits, packing, settings UI
  components/  small shared UI pieces and inline SVG icons
  lib/         dates, units, hooks, hash router, image resizing
```

## Tests

`npm test` runs Vitest with `fake-indexeddb`. The network is always mocked.

- `src/engine/suggest.test.ts`: warmth/rain/formality rules, occasions, locks and conflicts, no consecutive repeats, reuse, gaps, swaps, packing helpers.
- `src/weather/resolveWeather.test.ts`: the live → historical → cached → manual chain, HTTP and offline failures, and what gets sent.
- `src/db/backup.test.ts`: export/import round trip including photo Blobs, weather cache persistence, packing sync that keeps checkmarks.
