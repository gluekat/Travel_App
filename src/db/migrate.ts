/**
 * Data migrations, shared by the Dexie schema upgrade and backup import so
 * an old backup file restores into the current shape.
 */
import type { Outfit, PackingItem, TripDay } from './types';

export const CURRENT_DATA_VERSION = 3;

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

/** General items every new trip starts with. */
export function defaultGeneralItems(tripId: number): PackingItem[] {
  return [
    { tripId, customLabel: 'Underwear', perDay: 1, packed: false },
    { tripId, customLabel: 'Socks', perDay: 1, packed: false },
    { tripId, customLabel: 'Jacket', qty: 1, packed: false },
    { tripId, customLabel: 'Toiletries', qty: 1, packed: false },
  ];
}

export function emptyOutfit(tripId: number, tripDayId: number, rank = 0): Outfit {
  return { tripId, tripDayId, rank, label: `Outfit ${rank + 1}`, itemIds: [], lockedItemIds: [], rationale: '' };
}

/**
 * v1 → v2: closet items gain quantity + wearCount, unselected suggestions are
 * dropped (outfits are now only what the user chose), every day gets at least
 * one outfit, and trips get the default general packing items.
 */
export function migrateV1toV2(tables: Tables): Tables {
  const closetItems = (tables.closetItems ?? []).map((i) => ({ quantity: 1, wearCount: 1, ...i }) as Row);

  const outfits = (tables.outfits ?? [])
    .filter((o) => o.selected !== false)
    .map((o) => {
      const { selected: _selected, ...rest } = o;
      return rest;
    }) as unknown as Outfit[];
  // Renumber ranks per day after dropping rows.
  const byDay = new Map<number, Outfit[]>();
  for (const o of outfits) byDay.set(o.tripDayId, [...(byDay.get(o.tripDayId) ?? []), o]);
  for (const list of byDay.values()) list.sort((a, b) => a.rank - b.rank).forEach((o, i) => (o.rank = i));
  for (const d of (tables.tripDays ?? []) as unknown as TripDay[]) {
    if (d.id != null && !byDay.has(d.id)) outfits.push(emptyOutfit(d.tripId, d.id));
  }

  const packingItems = (tables.packingItems ?? []).map((p) => (p.customLabel != null ? { qty: 1, ...p } : p)) as unknown as PackingItem[];
  for (const t of tables.trips ?? []) {
    const tripId = t.id as number;
    const labels = new Set(packingItems.filter((p) => p.tripId === tripId && p.customLabel).map((p) => p.customLabel!.toLowerCase()));
    for (const g of defaultGeneralItems(tripId)) if (!labels.has(g.customLabel!.toLowerCase())) packingItems.push(g);
  }

  return { ...tables, closetItems, outfits: outfits as unknown as Row[], packingItems: packingItems as unknown as Row[] };
}

/** v2 → v3: closet items gain a favorite score and custom tags; saved outfits table appears. */
export function migrateV2toV3(tables: Tables): Tables {
  return {
    ...tables,
    closetItems: (tables.closetItems ?? []).map((i) => ({ favorite: 0, customTags: [], ...i })),
    savedOutfits: tables.savedOutfits ?? [],
  };
}

/** Bring tables from any older data version up to the current one. */
export function migrateTables(tables: Tables, fromVersion: number): Tables {
  let t = tables;
  if (fromVersion < 2) t = migrateV1toV2(t);
  if (fromVersion < 3) t = migrateV2toV3(t);
  return t;
}

/** Normalize free-text tags: trimmed, lower-case, unique, non-empty. */
export function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
}
