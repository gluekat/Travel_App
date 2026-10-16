/** Glue between the pure outfit engine and IndexedDB. */
import { db } from '../../db/schema';
import { emptyOutfit } from '../../db/migrate';
import type { Activity, ClosetItem, Outfit, TripDay } from '../../db/types';
import { dedupeItemIds, diffPacking } from '../../engine/packing';
import { countWears, planTrip, suggestOptions } from '../../engine/suggest';
import type { EngineDay, EngineItem, SuggestedOutfit } from '../../engine/types';

export function toEngineItem(i: ClosetItem): EngineItem {
  return {
    id: i.id!,
    name: i.name,
    category: i.category,
    color: i.color,
    warmth: i.warmth,
    formality: i.formality,
    weatherTags: i.weatherTags,
    activities: i.activities,
    quantity: Math.max(1, i.quantity ?? 1),
    wearCount: Math.max(1, i.wearCount ?? 1),
    favorite: i.favorite ?? 0,
  };
}

export function toEngineDay(d: TripDay, index: number): EngineDay {
  return {
    id: d.id!,
    index,
    date: d.date,
    activities: d.activities,
    weather: d.weather && { high: d.weather.high, low: d.weather.low, precipChance: d.weather.precipChance },
  };
}

async function loadTrip(tripId: number) {
  const [items, days, outfits] = await Promise.all([
    db.closetItems.toArray(),
    db.tripDays.where('tripId').equals(tripId).sortBy('date'),
    db.outfits.where('tripId').equals(tripId).toArray(),
  ]);
  return { items: items.map(toEngineItem), days, outfits };
}

/** Wears planned for each item across the trip, optionally ignoring one outfit. */
export function tripUsage(outfits: Outfit[], excludeOutfitId?: number): Map<number, number> {
  return countWears(outfits.filter((o) => o.id !== excludeOutfitId));
}

/** Suggestion options for one outfit. Nothing is saved until one is applied. */
export async function suggestForOutfit(
  outfitId: number,
  activities: Activity[],
  seed: number,
  formatTemp: (c: number) => string,
): Promise<SuggestedOutfit[]> {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return [];
  const { items, days, outfits } = await loadTrip(outfit.tripId);
  const idx = days.findIndex((d) => d.id === outfit.tripDayId);
  if (idx < 0) return [];
  const prevDayId = days[idx - 1]?.id;
  return suggestOptions(
    {
      items,
      day: toEngineDay(days[idx], idx + 1),
      activities,
      locked: outfit.lockedItemIds.filter((id) => outfit.itemIds.includes(id)),
      usage: tripUsage(outfits, outfitId),
      previousOutfits: outfits.filter((o) => o.tripDayId === prevDayId).map((o) => o.itemIds),
      seed,
      formatTemp,
    },
    2,
  );
}

export async function applySuggestion(outfitId: number, s: SuggestedOutfit) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.update(outfitId, {
    itemIds: s.itemIds,
    activities: s.activities,
    rationale: s.rationale,
    lockedItemIds: outfit.lockedItemIds.filter((id) => s.itemIds.includes(id)),
  });
  await syncPacking(outfit.tripId);
}

/** Suggest outfits for every day that has no clothes picked yet (one per occasion). */
export async function fillEmptyDays(tripId: number, formatTemp: (c: number) => string, seed = 0): Promise<number> {
  const { items, days, outfits } = await loadTrip(tripId);
  const isEmpty = (d: TripDay) => outfits.filter((o) => o.tripDayId === d.id).every((o) => o.itemIds.length === 0);
  const empty = days.map((d, i) => ({ d, i })).filter(({ d }) => isEmpty(d));
  if (!empty.length) return 0;
  const plans = planTrip(
    items,
    empty.map(({ d, i }) => toEngineDay(d, i + 1)),
    { seed, formatTemp, usage: countWears(outfits) },
  );
  await db.transaction('rw', db.outfits, async () => {
    for (const plan of plans) {
      await db.outfits.where('tripDayId').equals(plan.dayId).delete();
      await db.outfits.bulkAdd(
        plan.outfits.map((o, rank) => ({
          tripId,
          tripDayId: plan.dayId,
          rank,
          label: o.label,
          activities: o.activities,
          itemIds: o.itemIds,
          lockedItemIds: [],
          rationale: o.rationale,
        })),
      );
    }
  });
  await syncPacking(tripId);
  return plans.length;
}

// --- Manual editing ---------------------------------------------------------

export async function addOutfit(tripId: number, tripDayId: number) {
  const existing = await db.outfits.where('tripDayId').equals(tripDayId).toArray();
  const rank = existing.reduce((m, o) => Math.max(m, o.rank + 1), 0);
  return db.outfits.add(emptyOutfit(tripId, tripDayId, rank));
}

export async function deleteOutfit(outfitId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.delete(outfitId);
  await syncPacking(outfit.tripId);
}

export async function renameOutfit(outfitId: number, label: string) {
  await db.outfits.update(outfitId, { label: label.trim() || 'Outfit' });
}

export async function addItemsToOutfit(outfitId: number, itemIds: number[]) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  const next = [...outfit.itemIds, ...itemIds.filter((id) => !outfit.itemIds.includes(id))];
  await db.outfits.update(outfitId, { itemIds: next, rationale: '' });
  await syncPacking(outfit.tripId);
}

export async function swapItem(outfitId: number, oldId: number, newId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.update(outfitId, {
    itemIds: outfit.itemIds.map((id) => (id === oldId ? newId : id)),
    lockedItemIds: outfit.lockedItemIds.filter((id) => id !== oldId),
    rationale: '',
  });
  await syncPacking(outfit.tripId);
}

export async function removeItemFromOutfit(outfitId: number, itemId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.update(outfitId, {
    itemIds: outfit.itemIds.filter((id) => id !== itemId),
    lockedItemIds: outfit.lockedItemIds.filter((id) => id !== itemId),
    rationale: '',
  });
  await syncPacking(outfit.tripId);
}

export async function toggleLock(outfitId: number, itemId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  const locked = outfit.lockedItemIds.includes(itemId)
    ? outfit.lockedItemIds.filter((id) => id !== itemId)
    : [...outfit.lockedItemIds, itemId];
  await db.outfits.update(outfitId, { lockedItemIds: locked });
}

/** Make the trip's closet-item packing rows match its outfits, keeping checkmarks. */
export async function syncPacking(tripId: number) {
  await db.transaction('rw', db.outfits, db.packingItems, async () => {
    const outfits = await db.outfits.where('tripId').equals(tripId).toArray();
    const rows = await db.packingItems.where('tripId').equals(tripId).filter((p) => p.itemId != null).toArray();
    const { add, remove } = diffPacking(rows.map((r) => r.itemId!), dedupeItemIds(outfits));
    if (remove.length) await db.packingItems.bulkDelete(rows.filter((r) => remove.includes(r.itemId!)).map((r) => r.id!));
    if (add.length) await db.packingItems.bulkAdd(add.map((itemId) => ({ tripId, itemId, packed: false })));
  });
}
