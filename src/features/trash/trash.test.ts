import { beforeEach, describe, expect, it } from 'vitest';
import { db, deleteClosetItem, deleteGeneralItem, deleteSavedOutfit, deleteTrip } from '../../db/schema';
import { createTrip } from '../trips/tripService';
import { addItemsToOutfit } from '../outfits/outfitService';
import { daysLeft, deleteForever, purgeExpiredTrash, restoreFromTrash } from './trashService';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const item = { category: 'top' as const, color: '', warmth: 2 as const, formality: 'casual' as const, weatherTags: [], activities: [], quantity: 1, wearCount: 1, favorite: 0, customTags: [], isSample: false, createdAt: 1, updatedAt: 1 };

describe('trash', () => {
  it('restores a deleted trip with all its days, outfits, bookings and lodging', async () => {
    const tripId = await createTrip('Rome', undefined, '2026-06-01', '2026-06-03');
    await db.tripLodging.add({ tripId, name: 'Hotel', checkInDate: '2026-06-01', checkOutDate: '2026-06-03', createdAt: 1 });
    await db.tripTransport.add({ tripId, direction: 'outbound', mode: 'fly', departureDate: '2026-06-01', createdAt: 1 });
    const transportBefore = await db.tripTransport.count();
    const before = { days: await db.tripDays.count(), outfits: await db.outfits.count(), packing: await db.packingItems.count() };

    await deleteTrip(tripId);
    expect(await db.trips.count()).toBe(0);
    expect(await db.tripDays.count()).toBe(0);
    const [entry] = await db.trash.toArray();
    expect(entry).toMatchObject({ kind: 'trip', name: 'Rome' });

    await restoreFromTrash(entry.id!);
    expect(await db.trash.count()).toBe(0);
    expect(await db.trips.get(tripId)).toBeTruthy();
    expect({ days: await db.tripDays.count(), outfits: await db.outfits.count(), packing: await db.packingItems.count() }).toEqual(before);
    expect(await db.tripLodging.count()).toBe(1);
    expect(await db.tripTransport.count()).toBe(transportBefore);
  });

  it('puts a closet item back into the outfits, saved outfits and packing list it was removed from', async () => {
    const tripId = await createTrip('Rome', undefined, '2026-06-01', '2026-06-01');
    const itemId = (await db.closetItems.add({ ...item, name: 'Tee' })) as number;
    const savedId = (await db.savedOutfits.add({ name: 'Look', itemIds: [itemId], favorite: false, createdAt: 1, updatedAt: 1 })) as number;
    const outfit = (await db.outfits.where('tripId').equals(tripId).first())!;
    await addItemsToOutfit(outfit.id!, [itemId]);
    expect(await db.packingItems.where('itemId').equals(itemId).count()).toBe(1);

    await deleteClosetItem(itemId);
    expect(await db.closetItems.get(itemId)).toBeUndefined();
    expect((await db.outfits.get(outfit.id!))!.itemIds).toEqual([]);

    const [entry] = await db.trash.toArray();
    await restoreFromTrash(entry.id!);
    expect(await db.closetItems.get(itemId)).toMatchObject({ name: 'Tee' });
    expect((await db.outfits.get(outfit.id!))!.itemIds).toEqual([itemId]);
    expect((await db.savedOutfits.get(savedId))!.itemIds).toEqual([itemId]);
    expect(await db.packingItems.where('itemId').equals(itemId).count()).toBe(1);
  });

  it('restores a deleted saved outfit, leaving out items deleted in the meantime', async () => {
    const a = (await db.closetItems.add({ ...item, name: 'A' })) as number;
    const b = (await db.closetItems.add({ ...item, name: 'B' })) as number;
    const id = (await db.savedOutfits.add({ name: 'Look', itemIds: [a, b], favorite: true, createdAt: 1, updatedAt: 1 })) as number;
    await deleteSavedOutfit(id);
    expect(await db.savedOutfits.count()).toBe(0);
    const [entry] = await db.trash.toArray();
    expect(entry).toMatchObject({ kind: 'savedOutfit', name: 'Look' });
    await deleteClosetItem(b, false);
    await restoreFromTrash(entry.id!);
    expect(await db.savedOutfits.get(id)).toMatchObject({ name: 'Look', itemIds: [a], favorite: true });
    expect(await db.trash.count()).toBe(0);
  });

  it('keeps general items, expires after 30 days, and clearing samples bypasses the trash', async () => {
    const gid = (await db.generalItems.add({ name: 'Charger', isDefault: false, tags: [], createdAt: 1 })) as number;
    await deleteGeneralItem(gid);
    const [entry] = await db.trash.toArray();
    expect(entry.kind).toBe('generalItem');
    expect(daysLeft(entry)).toBe(30);

    const now = entry.deletedAt + 29 * 86_400_000;
    expect(await purgeExpiredTrash(now)).toBe(0);
    expect(daysLeft(entry, now)).toBe(1);
    expect(await purgeExpiredTrash(entry.deletedAt + 31 * 86_400_000)).toBe(1);
    expect(await db.trash.count()).toBe(0);

    const sample = (await db.closetItems.add({ ...item, name: 'Sample', isSample: true })) as number;
    await deleteClosetItem(sample, false);
    expect(await db.trash.count()).toBe(0);

    const kept = (await db.closetItems.add({ ...item, name: 'Kept' })) as number;
    await deleteClosetItem(kept);
    await deleteForever((await db.trash.toArray())[0].id!);
    expect(await db.trash.count()).toBe(0);
  });
});
