import Dexie, { type EntityTable } from 'dexie';
import { STORAGE_SUFFIX } from '../lib/channel';
import { migrateV1toV2, migrateV2toV3, type Tables } from './migrate';
import type { ClosetItem, GeneralItem, Outfit, TrashEntry, PackingItem, SavedOutfit, ScheduledActivity, Setting, TransportLeg, Trip, TripDay, TripLodging } from './types';

export class PackWiseDB extends Dexie {
  closetItems!: EntityTable<ClosetItem, 'id'>;
  trips!: EntityTable<Trip, 'id'>;
  tripDays!: EntityTable<TripDay, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  packingItems!: EntityTable<PackingItem, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  savedOutfits!: EntityTable<SavedOutfit, 'id'>;
  tripTransport!: EntityTable<TransportLeg, 'id'>;
  tripActivities!: EntityTable<ScheduledActivity, 'id'>;
  tripLodging!: EntityTable<TripLodging, 'id'>;
  generalItems!: EntityTable<GeneralItem, 'id'>;
  trash!: EntityTable<TrashEntry, 'id'>;

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
    // v4: itinerary — transport legs and scheduled activities per trip.
    this.version(4).stores({
      tripTransport: '++id, tripId, direction, mode',
      tripActivities: '++id, tripId, tripDayId',
    });
    // v5: lodging stays per trip.
    this.version(5).stores({
      tripLodging: '++id, tripId, checkInDate',
    });
    // v6: reusable general packing items (with Default + activity/custom tags).
    this.version(6).stores({
      generalItems: '++id, isDefault, *tags',
    });
    // v7: the first and last day of every trip are travel days.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        const days = await tx.table('tripDays').toArray();
        const trips = new Map((await tx.table('trips').toArray()).map((t) => [t.id, t]));
        for (const d of days) {
          const t = trips.get(d.tripId);
          if (t && (d.date === t.startDate || d.date === t.endDate) && !d.activities?.includes('travel day')) {
            await tx.table('tripDays').update(d.id, { activities: [...(d.activities ?? []), 'travel day'] });
          }
        }
      });
    // v8: the trash — deleted trips and items, kept for 30 days. Not part of backups.
    this.version(8).stores({
      trash: '++id, kind, deletedAt',
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
  'tripTransport',
  'tripActivities',
  'tripLodging',
  'generalItems',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Delete a trip and everything hanging off it. It goes to the trash for 30 days. */
export async function deleteTrip(tripId: number): Promise<void> {
  await db.transaction('rw', [db.trips, db.tripDays, db.outfits, db.packingItems, db.tripTransport, db.tripActivities, db.tripLodging, db.trash], async () => {
    const trip = await db.trips.get(tripId);
    if (trip) {
      await db.trash.add({
        kind: 'trip',
        name: trip.name ?? trip.placeLabel ?? trip.destination,
        deletedAt: Date.now(),
        data: {
          trip,
          days: await db.tripDays.where('tripId').equals(tripId).toArray(),
          outfits: await db.outfits.where('tripId').equals(tripId).toArray(),
          packingItems: await db.packingItems.where('tripId').equals(tripId).toArray(),
          transport: await db.tripTransport.where('tripId').equals(tripId).toArray(),
          activities: await db.tripActivities.where('tripId').equals(tripId).toArray(),
          lodging: await db.tripLodging.where('tripId').equals(tripId).toArray(),
        },
      });
    }
    await db.tripDays.where('tripId').equals(tripId).delete();
    await db.outfits.where('tripId').equals(tripId).delete();
    await db.packingItems.where('tripId').equals(tripId).delete();
    await db.tripTransport.where('tripId').equals(tripId).delete();
    await db.tripActivities.where('tripId').equals(tripId).delete();
    await db.tripLodging.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
  });
}

/**
 * Delete a closet item and remove it from any outfits / packing lists.
 * It goes to the trash (remembering where it was used) unless `toTrash` is false.
 */
export async function deleteClosetItem(itemId: number, toTrash = true): Promise<void> {
  await db.transaction('rw', [db.closetItems, db.outfits, db.packingItems, db.savedOutfits, db.trash], async () => {
    const item = await db.closetItems.get(itemId);
    if (item && toTrash) {
      await db.trash.add({
        kind: 'closetItem',
        name: item.name,
        deletedAt: Date.now(),
        data: {
          item,
          savedOutfitIds: (await db.savedOutfits.filter((o) => o.itemIds.includes(itemId)).toArray()).map((o) => o.id!),
          outfits: (await db.outfits.filter((o) => o.itemIds.includes(itemId)).toArray()).map((o) => ({ id: o.id!, locked: o.lockedItemIds.includes(itemId) })),
          packingItems: await db.packingItems.where('itemId').equals(itemId).toArray(),
        },
      });
    }
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

/** Delete a general packing item; it goes to the trash for 30 days. */
export async function deleteGeneralItem(itemId: number): Promise<void> {
  await db.transaction('rw', db.generalItems, db.trash, async () => {
    const item = await db.generalItems.get(itemId);
    if (item) await db.trash.add({ kind: 'generalItem', name: item.name, deletedAt: Date.now(), data: { item } });
    await db.generalItems.delete(itemId);
  });
}

/** Delete a saved outfit from the closet; it goes to the trash for 30 days. */
export async function deleteSavedOutfit(id: number): Promise<void> {
  await db.transaction('rw', db.savedOutfits, db.trash, async () => {
    const outfit = await db.savedOutfits.get(id);
    if (outfit) await db.trash.add({ kind: 'savedOutfit', name: outfit.name, deletedAt: Date.now(), data: { outfit } });
    await db.savedOutfits.delete(id);
  });
}
