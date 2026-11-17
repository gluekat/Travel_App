/**
 * Sleepwear outfits draw only from items in the "pajamas" category. The default
 * suggestion is a top with a bottom, or a one-piece; further suggestions add pajama
 * shoes and/or accessories to those sets.
 */
import type { Subcategory } from '../db/types';

export interface SleepwearItem {
  id: number;
  name: string;
  category: string;
  subcategory?: Subcategory;
  favorite?: number;
  quantity?: number;
  wearCount?: number;
  unlimitedWear?: boolean;
}

export const isPajamas = (i: Pick<SleepwearItem, 'category'>) => i.category === 'pajamas';

function remaining(item: SleepwearItem, usage: Map<number, number>): number {
  if (item.unlimitedWear) return Infinity;
  return Math.max(1, item.quantity ?? 1) * Math.max(1, item.wearCount ?? 1) - (usage.get(item.id) ?? 0);
}

function byPreference(usage: Map<number, number>) {
  return (a: SleepwearItem, b: SleepwearItem) =>
    Number(remaining(b, usage) > 0) - Number(remaining(a, usage) > 0) || (b.favorite ?? 0) - (a.favorite ?? 0) || a.name.localeCompare(b.name);
}

/** Up to `count` distinct sleepwear sets (item id lists); `seed` rotates through the alternatives. */
export function suggestSleepwear(items: SleepwearItem[], usage: Map<number, number> = new Map(), seed = 0, count = 2): number[][] {
  const pool = items.filter(isPajamas).sort(byPreference(usage));
  const tops = pool.filter((i) => i.subcategory === 'top');
  const bottoms = pool.filter((i) => i.subcategory === 'bottom');
  // Untyped pajamas are treated as complete sets rather than guessed at.
  const wholes = pool.filter((i) => i.subcategory === 'one-piece' || i.subcategory === undefined);
  const shoes = pool.find((i) => i.subcategory === 'shoes');
  const accessory = pool.find((i) => i.subcategory === 'accessories');

  const score = (list: SleepwearItem[]) =>
    list.reduce((n, i) => n + (i.favorite ?? 0) + (remaining(i, usage) > 0 ? 10 : 0), 0) / list.length;
  const bases: { items: SleepwearItem[]; score: number }[] = [];
  for (const w of wholes) bases.push({ items: [w], score: score([w]) });
  for (const t of tops) for (const b of bottoms) bases.push({ items: [t, b], score: score([t, b]) });
  bases.sort((a, b) => b.score - a.score);

  // Plain sets first (the default is always a plain set), then the same sets with shoes and/or accessories.
  const extras = [shoes && [shoes], accessory && [accessory], shoes && accessory && [shoes, accessory]].filter((e): e is SleepwearItem[] => !!e);
  const sets = [...bases.map((b) => b.items.map((i) => i.id)), ...bases.flatMap((b) => extras.map((e) => [...b.items, ...e].map((i) => i.id)))];
  if (sets.length === 0) return [];
  const start = (seed * count) % sets.length;
  return Array.from({ length: Math.min(count, sets.length) }, (_, k) => sets[(start + k) % sets.length]);
}

/** Replacement candidates for one sleepwear piece: other pajamas of the same type, best first. */
export function sleepwearSwapCandidates(items: SleepwearItem[], outfitItemIds: number[], swapId: number, usage: Map<number, number> = new Map()): SleepwearItem[] {
  const current = items.find((i) => i.id === swapId);
  return items
    .filter((i) => isPajamas(i) && !outfitItemIds.includes(i.id) && i.subcategory === current?.subcategory)
    .sort(byPreference(usage));
}
