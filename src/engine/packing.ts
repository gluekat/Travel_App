/** Pure packing-list helpers. */
import { CATEGORIES, type Category } from '../db/types';
import { capacity, copiesNeeded } from './rules';
import { countWears } from './suggest';
import type { EngineItem } from './types';

type Stock = Pick<EngineItem, 'id' | 'quantity' | 'wearCount'>;

export interface PackingStats {
  outfitCount: number;
  /** Distinct closet items packed. */
  itemCount: number;
  /** Physical clothing pieces packed (copies included). */
  pieceCount: number;
  /** Average number of outfits each packed piece appears in. */
  wearsPerPiece: number;
}

export interface PackLine {
  itemId: number;
  wears: number;
  copies: number;
  /** Wears not covered by clean copies (0 when fine). */
  shortfall: number;
}

/** Unique closet item ids across outfits, in first-seen order. */
export function dedupeItemIds(outfits: { itemIds: number[] }[]): number[] {
  return [...new Set(outfits.flatMap((o) => o.itemIds))];
}

/** How many copies of each item to pack for these outfits. */
export function packLines(items: Stock[], outfits: { itemIds: number[] }[]): Map<number, PackLine> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = new Map<number, PackLine>();
  for (const [itemId, wears] of countWears(outfits)) {
    const item = byId.get(itemId);
    if (!item) continue;
    lines.set(itemId, { itemId, wears, copies: copiesNeeded(item, wears), shortfall: Math.max(0, wears - capacity(item)) });
  }
  return lines;
}

export function packingStats(items: Stock[], outfits: { itemIds: number[] }[]): PackingStats {
  const nonEmpty = outfits.filter((o) => o.itemIds.length > 0);
  const lines = [...packLines(items, nonEmpty).values()];
  const pieces = lines.reduce((n, l) => n + l.copies, 0);
  const wears = lines.reduce((n, l) => n + l.wears, 0);
  return {
    outfitCount: nonEmpty.length,
    itemCount: lines.length,
    pieceCount: pieces,
    wearsPerPiece: pieces ? Math.round((wears / pieces) * 10) / 10 : 0,
  };
}

/** Quantity of a general packing item for a trip of `days` days. */
export function generalQty(row: { qty?: number; perDay?: number }, days: number): number {
  return row.perDay != null ? row.perDay * days : (row.qty ?? 1);
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
