/** Glue between the pure outfit engine and IndexedDB. */
import { db } from '../../db/schema';
import type { ClosetItem, Outfit, TripDay } from '../../db/types';
import { dedupeItemIds, diffPacking } from '../../engine/packing';
import { explainOutfit, outfitTargets, planDay, planTrip } from '../../engine/suggest';
import type { DayPlan, EngineDay, EngineItem } from '../../engine/types';

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

function locksFor(outfits: Outfit[], dayId: number): number[][] {
  const locks: number[][] = [];
  for (const o of outfits) if (o.tripDayId === dayId) locks[o.rank] = o.lockedItemIds;
  return locks;
}

function planToRows(tripId: number, plan: DayPlan): Outfit[] {
  return plan.outfits.map((o, rank) => ({ tripId, tripDayId: plan.dayId, rank, ...o }));
}

/** Generate outfits for every day, keeping locked items. */
export async function generateTripOutfits(tripId: number, formatTemp: (c: number) => string, seed = 0) {
  const { items, days, outfits } = await loadTrip(tripId);
  const locks = Object.fromEntries(days.map((d) => [d.id!, locksFor(outfits, d.id!)]));
  const plans = planTrip(items, days.map(toEngineDay), { seed, locks, formatTemp });
  await db.transaction('rw', db.outfits, db.packingItems, async () => {
    await db.outfits.where('tripId').equals(tripId).delete();
    await db.outfits.bulkAdd(plans.flatMap((p) => planToRows(tripId, p)));
  });
  await syncPacking(tripId);
}

/** Re-plan a single day, respecting its locks and the rest of the trip. */
export async function regenerateDay(tripId: number, dayId: number, formatTemp: (c: number) => string, seed: number) {
  const { items, days, outfits } = await loadTrip(tripId);
  const idx = days.findIndex((d) => d.id === dayId);
  if (idx < 0) return;
  const others = outfits.filter((o) => o.tripDayId !== dayId && o.selected);
  const prevDayId = days[idx - 1]?.id;
  const plan = planDay(items, toEngineDay(days[idx], idx + 1), {
    reused: new Set(others.flatMap((o) => o.itemIds)),
    previousOutfits: outfits.filter((o) => o.tripDayId === prevDayId).map((o) => o.itemIds),
    seed,
    locks: locksFor(outfits, dayId),
    formatTemp,
  });
  await db.transaction('rw', db.outfits, async () => {
    await db.outfits.where('tripDayId').equals(dayId).delete();
    await db.outfits.bulkAdd(planToRows(tripId, plan));
  });
  await syncPacking(tripId);
}

async function reexplain(outfit: Outfit, itemIds: number[], formatTemp: (c: number) => string): Promise<string> {
  const { items, days, outfits } = await loadTrip(outfit.tripId);
  const idx = days.findIndex((d) => d.id === outfit.tripDayId);
  const day = days[idx];
  const target = outfitTargets(day.activities)[outfit.rank] ?? outfitTargets(day.activities)[0];
  const reused = new Set(outfits.filter((o) => o.tripDayId !== day.id && o.selected).flatMap((o) => o.itemIds));
  return explainOutfit(items, toEngineDay(day, idx + 1), target.group, itemIds, reused, formatTemp);
}

export async function swapItem(outfitId: number, oldId: number, newId: number, formatTemp: (c: number) => string) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  const itemIds = outfit.itemIds.map((id) => (id === oldId ? newId : id));
  const rationale = await reexplain(outfit, itemIds, formatTemp);
  await db.outfits.update(outfitId, {
    itemIds,
    lockedItemIds: outfit.lockedItemIds.filter((id) => id !== oldId),
    rationale: `${rationale} (You swapped in an item.)`,
  });
  await syncPacking(outfit.tripId);
}

export async function removeItemFromOutfit(outfitId: number, itemId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.update(outfitId, {
    itemIds: outfit.itemIds.filter((id) => id !== itemId),
    lockedItemIds: outfit.lockedItemIds.filter((id) => id !== itemId),
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

export async function toggleSelected(outfitId: number) {
  const outfit = await db.outfits.get(outfitId);
  if (!outfit) return;
  await db.outfits.update(outfitId, { selected: !outfit.selected });
  await syncPacking(outfit.tripId);
}

/** Make the trip's closet-item packing rows match its selected outfits, keeping checkmarks. */
export async function syncPacking(tripId: number) {
  await db.transaction('rw', db.outfits, db.packingItems, async () => {
    const selected = await db.outfits.where('tripId').equals(tripId).filter((o) => o.selected).toArray();
    const rows = await db.packingItems.where('tripId').equals(tripId).filter((p) => p.itemId != null).toArray();
    const { add, remove } = diffPacking(rows.map((r) => r.itemId!), dedupeItemIds(selected));
    if (remove.length) await db.packingItems.bulkDelete(rows.filter((r) => remove.includes(r.itemId!)).map((r) => r.id!));
    if (add.length) await db.packingItems.bulkAdd(add.map((itemId) => ({ tripId, itemId, packed: false })));
  });
}
