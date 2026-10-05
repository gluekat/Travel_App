/** Pure packing-list helpers. */
import { CATEGORIES, type Category } from '../db/types';

export interface PackingStats {
  outfitCount: number;
  itemCount: number;
  /** Average number of outfits each packed item appears in. */
  wearsPerItem: number;
}

/** Unique closet item ids across outfits, in first-seen order. */
export function dedupeItemIds(outfits: { itemIds: number[] }[]): number[] {
  return [...new Set(outfits.flatMap((o) => o.itemIds))];
}

export function packingStats(outfits: { itemIds: number[] }[]): PackingStats {
  const unique = dedupeItemIds(outfits);
  const totalWears = outfits.reduce((n, o) => n + o.itemIds.length, 0);
  return {
    outfitCount: outfits.length,
    itemCount: unique.length,
    wearsPerItem: unique.length ? Math.round((totalWears / unique.length) * 10) / 10 : 0,
  };
}

/** What to add/remove so the packing list matches the outfits, keeping existing rows (and their checkmarks). */
export function diffPacking(existingItemIds: number[], neededItemIds: number[]): { add: number[]; remove: number[] } {
  const existing = new Set(existingItemIds);
  const needed = new Set(neededItemIds);
  return {
    add: [...needed].filter((id) => !existing.has(id)),
    remove: [...existing].filter((id) => !needed.has(id)),
  };
}

export function groupByCategory<T extends { category: Category }>(items: T[]): [Category, T[]][] {
  return CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)] as [Category, T[]]).filter(([, list]) => list.length > 0);
}
