// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db, PackWiseDB } from './schema';
import { exportDatabase, importDatabase } from './backup';
import { seedSampleWardrobe } from './seed';
import { createTrip } from '../features/trips/tripService';
import {
  addItemsToOutfit,
  addOutfit,
  applySuggestion,
  fillEmptyDays,
  removeItemFromOutfit,
  suggestForOutfit,
} from '../features/outfits/outfitService';
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
    await fillEmptyDays(tripId, fmt);
    await db.packingItems.add({ tripId, customLabel: 'Charger', qty: 1, packed: true });
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

const clothingRows = (tripId: number) => db.packingItems.where('tripId').equals(tripId).filter((p) => p.itemId != null).toArray();

describe('trips and outfits', () => {
  it('starts each day with one empty outfit and the trip with general items', async () => {
    const tripId = await createTrip('Y', undefined, '2026-11-01', '2026-11-05');
    const outfits = await db.outfits.where('tripId').equals(tripId).toArray();
    expect(outfits).toHaveLength(5);
    expect(outfits.every((o) => o.label === 'Outfit 1' && o.itemIds.length === 0)).toBe(true);
    const general = await db.packingItems.where('tripId').equals(tripId).toArray();
    expect(general.map((g) => [g.customLabel, g.perDay ?? null, g.qty ?? null])).toEqual([
      ['Underwear', 1, null],
      ['Socks', 1, null],
      ['Jacket', null, 1],
      ['Toiletries', null, 1],
    ]);
  });

  it('supports manual outfits, multiple outfits per day and on-demand suggestions', async () => {
    await seedSampleWardrobe();
    const items = await db.closetItems.toArray();
    const tripId = await createTrip('Y', undefined, '2026-11-01', '2026-11-03');
    const [day1] = await db.tripDays.where('tripId').equals(tripId).sortBy('date');
    const [outfit1] = await db.outfits.where('tripDayId').equals(day1.id!).toArray();

    await addItemsToOutfit(outfit1.id!, [items[0].id!, items[4].id!]);
    expect((await clothingRows(tripId)).map((r) => r.itemId).sort()).toEqual([items[0].id, items[4].id].sort());

    const outfit2Id = (await addOutfit(tripId, day1.id!)) as number;
    expect((await db.outfits.get(outfit2Id))?.label).toBe('Outfit 2');
    const options = await suggestForOutfit(outfit2Id, ['dinner out'], 0, fmt);
    expect(options.length).toBeGreaterThan(0);
    expect(await db.outfits.get(outfit2Id)).toMatchObject({ itemIds: [] }); // nothing saved yet
    await applySuggestion(outfit2Id, options[0]);
    expect((await db.outfits.get(outfit2Id))?.itemIds).toEqual(options[0].itemIds);

    await removeItemFromOutfit(outfit1.id!, items[4].id!);
    expect((await db.outfits.get(outfit1.id!))?.itemIds).toEqual([items[0].id]);
  });

  it('fills only empty days', async () => {
    await seedSampleWardrobe();
    const item = (await db.closetItems.toCollection().first())!;
    const tripId = await createTrip('Y', undefined, '2026-11-01', '2026-11-03');
    const [day1] = await db.tripDays.where('tripId').equals(tripId).sortBy('date');
    const [o1] = await db.outfits.where('tripDayId').equals(day1.id!).toArray();
    await addItemsToOutfit(o1.id!, [item.id!]);
    expect(await fillEmptyDays(tripId, fmt)).toBe(2);
    expect((await db.outfits.get(o1.id!))?.itemIds).toEqual([item.id]);
  });
});

describe('packing sync', () => {
  it('keeps the packing list deduplicated and preserves checkmarks', async () => {
    await seedSampleWardrobe();
    const tripId = await createTrip('Y', undefined, '2026-11-01', '2026-11-05');
    await fillEmptyDays(tripId, fmt, 1);
    const rows = await clothingRows(tripId);
    const ids = rows.map((r) => r.itemId);
    expect(new Set(ids).size).toBe(ids.length);

    await db.packingItems.update(rows[0].id!, { packed: true });
    const [day1] = await db.tripDays.where('tripId').equals(tripId).sortBy('date');
    const extra = (await db.closetItems.toArray()).find((i) => !ids.includes(i.id))!;
    const o = await addOutfit(tripId, day1.id!);
    await addItemsToOutfit(o as number, [extra.id!]);
    expect((await db.packingItems.get(rows[0].id!))?.packed).toBe(true);
    expect((await clothingRows(tripId)).length).toBe(rows.length + 1);
  });
});

describe('migration from v1 data', () => {
  const v1Tables = {
    closetItems: [{ id: 1, name: 'Tee', category: 'top', color: '', warmth: 1, formality: 'casual', weatherTags: [], activities: [], isSample: false, createdAt: 1, updatedAt: 1 }],
    trips: [{ id: 1, destination: 'X', startDate: '2026-11-01', endDate: '2026-11-02', createdAt: 1 }],
    tripDays: [
      { id: 1, tripId: 1, date: '2026-11-01', activities: ['sightseeing'] },
      { id: 2, tripId: 1, date: '2026-11-02', activities: ['sightseeing'] },
    ],
    outfits: [
      { id: 1, tripId: 1, tripDayId: 1, rank: 0, label: 'Outfit', itemIds: [1], lockedItemIds: [], rationale: 'r', selected: true },
      { id: 2, tripId: 1, tripDayId: 1, rank: 1, label: 'Alternative', itemIds: [1], lockedItemIds: [], rationale: 'r', selected: false },
    ],
    packingItems: [
      { id: 1, tripId: 1, itemId: 1, packed: true },
      { id: 2, tripId: 1, customLabel: 'Charger', packed: false },
    ],
    settings: [],
  };

  async function checkMigrated() {
    expect(await db.closetItems.get(1)).toMatchObject({ quantity: 1, wearCount: 1 });
    const outfits = await db.outfits.toArray();
    expect(outfits.find((o) => o.label === 'Alternative')).toBeUndefined();
    expect(outfits.every((o) => !('selected' in o))).toBe(true);
    expect(outfits.filter((o) => o.tripDayId === 2)).toHaveLength(1); // empty outfit added for day 2
    const labels = (await db.packingItems.toArray()).map((p) => p.customLabel).filter(Boolean);
    expect(labels).toEqual(['Charger', 'Underwear', 'Socks', 'Jacket', 'Toiletries']);
    expect((await db.packingItems.get(1))?.packed).toBe(true);
  }

  it('imports a v1 backup file', async () => {
    await importDatabase({ app: 'packwise', version: 1, exportedAt: '', tables: v1Tables });
    await checkMigrated();
  });

  it('upgrades an existing v1 browser database', async () => {
    const name = 'packwise-legacy-test';
    const old = new Dexie(name);
    old.version(1).stores({
      closetItems: '++id, category, formality, *weatherTags, *activities, isSample, updatedAt',
      trips: '++id, startDate, createdAt',
      tripDays: '++id, tripId, [tripId+date]',
      outfits: '++id, tripId, tripDayId, [tripDayId+rank]',
      packingItems: '++id, tripId, itemId, [tripId+itemId]',
      settings: 'key',
    });
    for (const [t, rows] of Object.entries(v1Tables)) if (rows.length) await old.table(t).bulkAdd(rows);
    old.close();

    const upgraded = new PackWiseDB(name);
    expect(await upgraded.closetItems.get(1)).toMatchObject({ quantity: 1, wearCount: 1 });
    expect(await upgraded.outfits.count()).toBe(2);
    expect(await upgraded.packingItems.count()).toBe(6);
    upgraded.close();
    await Dexie.delete(name);
  });
});
