import { db } from '../../db/schema';
import { TRASH_DAYS, type TrashEntry } from '../../db/types';
import { syncPacking } from '../outfits/outfitService';

const DAY_MS = 86_400_000;

export const expiresAt = (e: Pick<TrashEntry, 'deletedAt'>) => e.deletedAt + TRASH_DAYS * DAY_MS;
export const daysLeft = (e: Pick<TrashEntry, 'deletedAt'>, now = Date.now()) => Math.max(0, Math.ceil((expiresAt(e) - now) / DAY_MS));

/** Remove everything that has been in the trash for more than 30 days. */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const old = await db.trash.where('deletedAt').below(now - TRASH_DAYS * DAY_MS).primaryKeys();
  await db.trash.bulkDelete(old);
  return old.length;
}

export async function deleteForever(id: number) {
  await db.trash.delete(id);
}

export async function emptyTrash() {
  await db.trash.clear();
}

/** Put a trashed trip, closet item or general item back exactly where it was. */
export async function restoreFromTrash(id: number): Promise<void> {
  const entry = await db.trash.get(id);
  if (!entry) return;
  const touchedTrips = new Set<number>();

  await db.transaction('rw', [db.trash, db.trips, db.tripDays, db.outfits, db.packingItems, db.tripTransport, db.tripActivities, db.tripLodging, db.closetItems, db.savedOutfits, db.generalItems], async () => {
    if (entry.kind === 'trip') {
      const d = entry.data;
      await db.trips.put(d.trip);
      await db.tripDays.bulkPut(d.days);
      await db.outfits.bulkPut(d.outfits);
      await db.packingItems.bulkPut(d.packingItems);
      await db.tripTransport.bulkPut(d.transport);
      await db.tripActivities.bulkPut(d.activities);
      await db.tripLodging.bulkPut(d.lodging);
      touchedTrips.add(d.trip.id!);
    } else if (entry.kind === 'closetItem') {
      const { item, savedOutfitIds, outfits, packingItems } = entry.data;
      await db.closetItems.put(item);
      for (const sid of savedOutfitIds) {
        await db.savedOutfits.where('id').equals(sid).modify((o) => {
          if (!o.itemIds.includes(item.id!)) o.itemIds.push(item.id!);
        });
      }
      for (const { id: oid, locked } of outfits) {
        await db.outfits.where('id').equals(oid).modify((o) => {
          if (!o.itemIds.includes(item.id!)) o.itemIds.push(item.id!);
          if (locked && !o.lockedItemIds.includes(item.id!)) o.lockedItemIds.push(item.id!);
          touchedTrips.add(o.tripId);
        });
      }
      for (const row of packingItems) if (await db.trips.get(row.tripId)) await db.packingItems.put(row);
    } else {
      await db.generalItems.put(entry.data.item);
    }
    await db.trash.delete(id);
  });
  for (const tripId of touchedTrips) await syncPacking(tripId);
}
