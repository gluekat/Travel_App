import Dexie, { type EntityTable } from 'dexie';
import { STORAGE_SUFFIX } from '../lib/channel';
import { migrateV1toV2, migrateV2toV3, type Tables } from './migrate';
import type { ClosetItem, Outfit, PackingItem, SavedOutfit, Setting, Trip, TripDay } from './types';

export class PackWiseDB extends Dexie {
  closetItems!: EntityTable<ClosetItem, 'id'>;
  trips!: EntityTable<Trip, 'id'>;
  tripDays!: EntityTable<TripDay, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  packingItems!: EntityTable<PackingItem, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  savedOutfits!: EntityTable<SavedOutfit, 'id'>;

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
    // v2: item quantity + wear count, user-chosen outfits only, general packing items.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const names = ['closetItems', 'trips', 'tripDays', 'outfits', 'packingItems'];
        const tables: Tables = {};
        for (const n of names) tables[n] = await tx.table(n).toArray();
        const migrated = migrateV1toV2(tables);
        for (const n of ['closetItems', 'outfits', 'packingItems']) {
          await tx.table(n).clear();
          await tx.table(n).bulkAdd(migrated[n]);
        }
      });
    // v3: favorite score + custom tags on items, saved outfits in the closet.
    this.version(3)
      .stores({
        closetItems: '++id, category, formality, *weatherTags, *activities, *customTags, isSample, updatedAt',
        savedOutfits: '++id, favorite, updatedAt',
      })
      .upgrade(async (tx) => {
        const migrated = migrateV2toV3({ closetItems: await tx.table('closetItems').toArray() });
        await tx.table('closetItems').clear();
        await tx.table('closetItems').bulkAdd(migrated.closetItems);
      });
  }
}

export const db = new PackWiseDB(`packwise${STORAGE_SUFFIX}`);

export const TABLE_NAMES = [
  'closetItems',
  'trips',
  'tripDays',
  'outfits',
  'packingItems',
  'settings',
  'savedOutfits',
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
  await db.transaction('rw', [db.closetItems, db.outfits, db.packingItems, db.savedOutfits], async () => {
    await db.closetItems.delete(itemId);
    await db.savedOutfits.toCollection().modify((o) => {
      o.itemIds = o.itemIds.filter((id) => id !== itemId);
    });
    await db.packingItems.where('itemId').equals(itemId).delete();
    await db.outfits.toCollection().modify((o) => {
      o.itemIds = o.itemIds.filter((id) => id !== itemId);
      o.lockedItemIds = o.lockedItemIds.filter((id) => id !== itemId);
    });
  });
}
