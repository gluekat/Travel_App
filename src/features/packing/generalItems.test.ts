import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { createTrip } from '../trips/tripService';
import { addSleepwearOutfit, suggestForOutfit } from '../outfits/outfitService';
import { saveToGeneralLibrary } from './generalItemsService';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const base = { color: '', warmth: 2 as const, formality: 'casual' as const, weatherTags: [], activities: [], quantity: 1, wearCount: 1, favorite: 0, customTags: [], isSample: false, createdAt: 1, updatedAt: 1 };

describe('general items library', () => {
  it('seeds starter defaults once and adds Default-tagged items to new trips', async () => {
    const t1 = await createTrip('Rome', undefined, '2026-06-01', '2026-06-03');
    const names = (await db.packingItems.where('tripId').equals(t1).toArray()).map((r) => r.customLabel).sort();
    expect(names).toEqual(['Jacket', 'Socks', 'Toiletries', 'Underwear']);
    expect(await db.generalItems.count()).toBe(4);

    await db.generalItems.add({ name: 'Tent', qty: 1, isDefault: false, tags: ['camping'], createdAt: 1 });
    await saveToGeneralLibrary('Phone charger');
    const t2 = await createTrip('Oslo', undefined, '2026-07-01', '2026-07-02');
    const rows = await db.packingItems.where('tripId').equals(t2).toArray();
    expect(rows.map((r) => r.customLabel)).toContain('Phone charger');
    expect(rows.map((r) => r.customLabel)).not.toContain('Tent');
    expect(rows.find((r) => r.customLabel === 'Underwear')?.perDay).toBe(1);
  });
});

describe('sleepwear outfits', () => {
  it('pre-fills a pajama top + bottom and only suggests pajamas', async () => {
    const [top, bottom, tee] = (await db.closetItems.bulkAdd(
      [
        { ...base, name: 'PJ top', category: 'pajamas', subcategory: 'top' },
        { ...base, name: 'PJ bottom', category: 'pajamas', subcategory: 'bottom' },
        { ...base, name: 'Tee', category: 'top' },
      ],
      { allKeys: true },
    )) as number[];
    const tripId = await createTrip('Rome', undefined, '2026-06-01', '2026-06-01');
    const day = (await db.tripDays.where('tripId').equals(tripId).first())!;
    const id = await addSleepwearOutfit(tripId, day.id!);
    const outfit = (await db.outfits.get(id!))!;
    expect(outfit.sleepwear).toBe(true);
    expect([...outfit.itemIds].sort()).toEqual([top, bottom].sort());
    const options = await suggestForOutfit(id!, [], 0, (c) => `${c}`);
    expect(options.flatMap((o) => o.itemIds)).not.toContain(tee);
  });
});

describe('general categories', () => {
  it('guesses and sorts by category then name', async () => {
    const { guessGeneralCategory, compareGeneral } = await import('../../db/types');
    expect(guessGeneralCategory('Phone charger')).toBe('Electronics');
    expect(guessGeneralCategory('Ibuprofen')).toBe('Medications');
    expect(guessGeneralCategory('Hair brush')).toBe('Hair Supplies');
    expect(guessGeneralCategory('Mystery thing')).toBe('Other');
    const list = [
      { category: 'Other', name: 'A' },
      { category: 'Electronics', name: 'Z cable' },
      { category: 'Toiletries', name: 'B' },
      { category: 'Electronics', name: 'A cable' },
    ].sort(compareGeneral);
    expect(list.map((i) => i.name)).toEqual(['Toiletries', 'A cable', 'Z cable', 'A'].map((n) => (n === 'Toiletries' ? 'B' : n)));
  });
});

describe('lodging follows trip dates', () => {
  it('extends stays that ran to the old end date and trims ones past a shortened end', async () => {
    const { setTripDates } = await import('../trips/tripService');
    const tripId = await createTrip('Rome', undefined, '2026-06-01', '2026-06-03');
    await db.tripLodging.bulkAdd([
      { tripId, name: 'Hotel', checkInDate: '2026-06-01', checkOutDate: '2026-06-03', createdAt: 1 },
    ]);
    let trip = (await db.trips.get(tripId))!;
    await setTripDates(trip, '2026-06-01', '2026-06-05');
    expect((await db.tripLodging.toArray())[0].checkOutDate).toBe('2026-06-05');
    trip = (await db.trips.get(tripId))!;
    await setTripDates(trip, '2026-06-01', '2026-06-04');
    expect((await db.tripLodging.toArray())[0].checkOutDate).toBe('2026-06-04');
  });
});
