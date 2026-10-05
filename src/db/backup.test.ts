// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { exportDatabase, importDatabase } from './backup';
import { seedSampleWardrobe } from './seed';
import { createTrip } from '../features/trips/tripService';
import { generateTripOutfits } from '../features/outfits/outfitService';
import { refreshTripWeather } from '../weather/tripWeather';
import { addDays, todayISO } from '../lib/dates';

const fmt = (c: number) => `${c}°C`;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('backup', () => {
  it('round-trips the whole database, including photo blobs', async () => {
    await seedSampleWardrobe();
    const photo = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' });
    const first = (await db.closetItems.toCollection().first())!;
    await db.closetItems.update(first.id!, { photo });
    const tripId = await createTrip('Lisbon', { name: 'Lisbon', label: 'Lisbon, Portugal', lat: 38.7, lon: -9.1 }, '2026-10-08', '2026-10-12');
    await generateTripOutfits(tripId, fmt);
    await db.packingItems.add({ tripId, customLabel: 'Charger', packed: true });
    await db.settings.put({ key: 'tempUnit', value: 'C' });

    const counts = async () => Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.count()])));
    const before = await counts();
    const backup = JSON.parse(JSON.stringify(await exportDatabase()));

    await Promise.all(db.tables.map((t) => t.clear()));
    expect((await counts()).closetItems).toBe(0);

    await importDatabase(backup);
    expect(await counts()).toEqual(before);
    const restored = (await db.closetItems.get(first.id!))!;
    expect(restored.photo).toBeInstanceOf(Blob);
    expect([...new Uint8Array(await restored.photo!.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    expect((await db.packingItems.where('tripId').equals(tripId).filter((p) => p.customLabel === 'Charger').first())?.packed).toBe(true);
  });

  it('rejects files that are not PackWise backups and leaves data intact', async () => {
    await seedSampleWardrobe();
    const n = await db.closetItems.count();
    await expect(importDatabase({ hello: 'world' })).rejects.toThrow(/not a PackWise backup/);
    await expect(importDatabase({ app: 'packwise', version: 999, tables: {} })).rejects.toThrow(/newer version/);
    expect(await db.closetItems.count()).toBe(n);
  });
});

describe('trip weather persistence', () => {
  it('caches fetched weather and keeps it when a later refresh fails', async () => {
    const start = addDays(todayISO(), 2);
    const tripId = await createTrip('X', { name: 'X', label: 'X', lat: 1, lon: 2 }, start, addDays(start, 1));
    const live = (url: string) => {
      const u = new URL(url);
      const s = u.searchParams.get('start_date')!;
      const e = u.searchParams.get('end_date')!;
      const time = s === e ? [s] : [s, e];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            daily: {
              time,
              temperature_2m_max: time.map(() => 21),
              temperature_2m_min: time.map(() => 12),
              precipitation_probability_max: time.map(() => 40),
              weather_code: time.map(() => 2),
            },
          }),
      });
    };
    await refreshTripWeather(tripId, live);
    const days = await db.tripDays.where('tripId').equals(tripId).toArray();
    expect(days.every((d) => d.weather?.source === 'forecast' && d.weather.fetchedAt > 0)).toBe(true);

    const r = await refreshTripWeather(tripId, () => Promise.reject(new TypeError('offline')));
    expect(r.days.every((d) => d.status === 'cached')).toBe(true);
    const after = await db.tripDays.where('tripId').equals(tripId).toArray();
    expect(after.map((d) => d.weather?.high)).toEqual([21, 21]);
  });
});

describe('packing sync', () => {
  it('keeps the packing list deduplicated and preserves checkmarks on regenerate', async () => {
    await seedSampleWardrobe();
    const tripId = await createTrip('Y', undefined, '2026-11-01', '2026-11-05');
    await generateTripOutfits(tripId, fmt, 1);
    const rows = await db.packingItems.where('tripId').equals(tripId).toArray();
    const ids = rows.map((r) => r.itemId);
    expect(new Set(ids).size).toBe(ids.length);

    await db.packingItems.update(rows[0].id!, { packed: true });
    await generateTripOutfits(tripId, fmt, 1);
    const again = await db.packingItems.get(rows[0].id!);
    expect(again?.packed).toBe(true);
  });
});
