import Dexie, { type EntityTable } from 'dexie';
import type { ClosetItem, Outfit, PackingItem, Setting, Trip, TripDay } from './types';

export class PackWiseDB extends Dexie {
  closetItems!: EntityTable<ClosetItem, 'id'>;
  trips!: EntityTable<Trip, 'id'>;
  tripDays!: EntityTable<TripDay, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  packingItems!: EntityTable<PackingItem, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'packwise') {
    super(name);
    this.version(1).stores({
      closetItems: '++id, category, formality, *weatherTags, *activities, isSample, updatedAt',
      trips: '++id, startDate, createdAt',
      tripDays: '++id, tripId, [tripId+date]',
      outfits: '++id, tripId, tripDayId, [tripDayId+rank]',
      packingItems: '++id, tripId, itemId, [tripId+itemId]',
      settings: 'key',
    });
  }
}

export const db = new PackWiseDB();

export const TABLE_NAMES = [
  'closetItems',
  'trips',
  'tripDays',
  'outfits',
  'packingItems',
  'settings',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Delete a trip and everything hanging off it. */
export async function deleteTrip(tripId: number): Promise<void> {
  await db.transaction('rw', [db.trips, db.tripDays, db.outfits, db.packingItems], async () => {
    await db.tripDays.where('tripId').equals(tripId).delete();
    await db.outfits.where('tripId').equals(tripId).delete();
    await db.packingItems.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
  });
}

/** Delete a closet item and remove it from any outfits / packing lists. */
export async function deleteClosetItem(itemId: number): Promise<void> {
  await db.transaction('rw', [db.closetItems, db.outfits, db.packingItems], async () => {
    await db.closetItems.delete(itemId);
    await db.packingItems.where('itemId').equals(itemId).delete();
    await db.outfits.toCollection().modify((o) => {
      o.itemIds = o.itemIds.filter((id) => id !== itemId);
      o.lockedItemIds = o.lockedItemIds.filter((id) => id !== itemId);
    });
  });
}
