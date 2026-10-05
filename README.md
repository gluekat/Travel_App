# PackWise

PackWise is a local-first travel app that picks and packs outfits for a trip from **your own closet**, based on the forecast and what you plan to do each day.

- **Closet:** enter your wardrobe once, with photos, warmth, formality, weather tags and the activities each item suits.
- **Trips:** set a destination and dates, then pick activities for each day. Weather comes from Open-Meteo.
- **Outfits:** get 1–2 outfits per day, each with a short "why". You can swap, lock or remove items, regenerate a day, and see gaps flagged (e.g. *"No rain-ready outerwear for Day 3"*).
- **Packing list:** a deduplicated list grouped by category, with checkboxes that persist, a mix-and-match stat, extras, and a print view.
- **Works offline:** it installs as a PWA, and everything is stored in your browser.

## Setup

Requires Node 20+.

```bash
cd packwise
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (service worker enabled)
```

The service worker is only active in the production build (`npm run build && npm run preview`), or when you deploy `dist/` to any static host. HTTPS is required for installation everywhere except `localhost`.

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

All data is stored in **IndexedDB** in this browser profile. That covers closet items, photos (resized to 800px JPEG Blobs), trips, days, cached weather, outfits, packing lists and settings. On startup the app asks the browser for persistent storage (`navigator.storage.persist()`) so it isn't evicted when disk space runs low. *Data & privacy* shows whether the browser granted it.

> ⚠️ **Clearing your browser data, or uninstalling the PWA, deletes your closet** unless you have exported a backup.

**Back up:** *Data & privacy* → **Export everything (JSON)**. This downloads one `packwise-backup-YYYY-MM-DD.json` file containing every table, with photos embedded as base64.

**Restore:** *Data & privacy* → **Import backup…**, then choose the file. This **replaces** all PackWise data in this browser. Use it to move to another device or browser too.

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
- A day with different kinds of activities (e.g. hiking + dinner) gets a separate outfit for each. Otherwise the second outfit is an unselected *Alternative*.
- Items already chosen on other days score higher, to keep the packing list small.
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
