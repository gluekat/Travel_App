import { describe, expect, it } from 'vitest';
import type { Activity } from '../db/types';
import { groupOccasions, requiredFormality, warmthNeeds } from './rules';
import { assignSlots, detectGaps, outfitTargets, planDay, planTrip, swapCandidates } from './suggest';
import { dedupeItemIds, diffPacking, packingStats } from './packing';
import type { EngineDay, EngineItem, EngineWeather } from './types';

let nextId = 1;
function item(p: Partial<EngineItem> & Pick<EngineItem, 'name' | 'category'>): EngineItem {
  return { id: nextId++, color: 'black', warmth: 2, formality: 'casual', weatherTags: [], activities: [], ...p };
}

const closet = (() => {
  nextId = 1;
  return {
    tee: item({ name: 'Tee', category: 'top', warmth: 1, weatherTags: ['hot'], activities: ['sightseeing', 'hiking'] }),
    linen: item({ name: 'Linen shirt', category: 'top', warmth: 1, formality: 'smart casual', weatherTags: ['hot'], activities: ['sightseeing', 'dinner out'] }),
    sweater: item({ name: 'Sweater', category: 'top', warmth: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out'] }),
    oxford: item({ name: 'Oxford', category: 'top', warmth: 2, formality: 'formal', activities: ['business', 'dinner out'] }),
    shorts: item({ name: 'Shorts', category: 'bottom', warmth: 1, weatherTags: ['hot'], activities: ['sightseeing', 'beach'] }),
    jeans: item({ name: 'Jeans', category: 'bottom', warmth: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out'] }),
    trousers: item({ name: 'Trousers', category: 'bottom', warmth: 3, formality: 'formal', activities: ['business', 'dinner out'] }),
    rainJacket: item({ name: 'Rain jacket', category: 'outerwear', warmth: 2, weatherTags: ['rain-ready'], activities: ['sightseeing', 'hiking'] }),
    puffer: item({ name: 'Puffer', category: 'outerwear', warmth: 5, weatherTags: ['cold'], activities: ['sightseeing'] }),
    sneakers: item({ name: 'Sneakers', category: 'shoes', warmth: 2, formality: 'smart casual', weatherTags: ['sun'], activities: ['sightseeing', 'dinner out'] }),
    boots: item({ name: 'Hiking boots', category: 'shoes', warmth: 3, weatherTags: ['rain-ready', 'cold'], activities: ['hiking', 'sightseeing'] }),
    loafers: item({ name: 'Loafers', category: 'shoes', warmth: 2, formality: 'formal', activities: ['business', 'dinner out'] }),
    trunks: item({ name: 'Trunks', category: 'swimwear', warmth: 1, weatherTags: ['hot'], activities: ['beach'] }),
    sandals: item({ name: 'Sandals', category: 'shoes', warmth: 1, weatherTags: ['hot', 'sun'], activities: ['beach'] }),
  };
})();
const ALL = Object.values(closet);

const HOT: EngineWeather = { high: 32, low: 24, precipChance: 5 };
const COLD: EngineWeather = { high: 4, low: -2, precipChance: 10 };
const RAINY_MILD: EngineWeather = { high: 17, low: 11, precipChance: 80 };

function day(index: number, activities: Activity[], weather?: EngineWeather): EngineDay {
  return { id: 100 + index, index, date: `2026-07-${String(index).padStart(2, '0')}`, activities, weather };
}

const ctx = { reused: new Set<number>(), previousOutfits: [] as number[][], seed: 1 };
const names = (ids: number[]) => ids.map((id) => ALL.find((i) => i.id === id)!.name);

describe('rules', () => {
  it('maps temperatures to warmth needs', () => {
    expect(warmthNeeds(HOT)).toMatchObject({ band: 'hot', outerwearMin: null });
    expect(warmthNeeds(COLD).band).toBe('cold');
    expect(warmthNeeds(COLD).outerwearMin).toBeGreaterThanOrEqual(4);
    expect(warmthNeeds({ high: 12, low: 5, precipChance: 0 }).outerwearMin).toBe(3);
  });

  it('derives formality from activities', () => {
    expect(requiredFormality(['hiking'])).toBe('casual');
    expect(requiredFormality(['sightseeing', 'dinner out'])).toBe('smart casual');
    expect(requiredFormality(['business'])).toBe('formal');
  });

  it('groups activities into occasions, dressy last', () => {
    expect(groupOccasions(['dinner out', 'hiking', 'sightseeing']).map((g) => g.occasion)).toEqual(['active', 'dressy']);
    expect(groupOccasions([]).map((g) => g.occasion)).toEqual(['everyday']);
  });
});

describe('planDay', () => {
  it('dresses light for heat and skips outerwear', () => {
    const plan = planDay(ALL, day(1, ['sightseeing'], HOT), ctx);
    const ids = plan.outfits[0].itemIds;
    expect(ids).toContain(closet.shorts.id);
    expect(ids).toContain(closet.tee.id);
    expect(ids.some((id) => [closet.puffer.id, closet.rainJacket.id].includes(id))).toBe(false);
  });

  it('requires warm outerwear in the cold', () => {
    const plan = planDay(ALL, day(1, ['sightseeing'], COLD), ctx);
    expect(plan.outfits[0].itemIds).toContain(closet.puffer.id);
    expect(plan.outfits[0].itemIds).toContain(closet.jeans.id);
    expect(plan.outfits[0].itemIds).not.toContain(closet.shorts.id);
  });

  it('requires rain-ready gear when precipitation chance exceeds 50%', () => {
    const plan = planDay(ALL, day(1, ['sightseeing'], RAINY_MILD), ctx);
    const chosen = plan.outfits[0].itemIds.map((id) => ALL.find((i) => i.id === id)!);
    expect(chosen.some((i) => i.weatherTags.includes('rain-ready'))).toBe(true);
    expect(plan.outfits[0].itemIds).toContain(closet.rainJacket.id);
    expect(plan.outfits[0].rationale).toMatch(/80% chance of rain/);
  });

  it('does not require rain gear at exactly 50%', () => {
    const plan = planDay(ALL, day(1, ['sightseeing'], { high: 30, low: 22, precipChance: 50 }), ctx);
    expect(plan.outfits[0].itemIds).not.toContain(closet.rainJacket.id);
  });

  it('matches formality to activities', () => {
    const plan = planDay(ALL, day(1, ['business'], { high: 20, low: 14, precipChance: 0 }), ctx);
    expect(names(plan.outfits[0].itemIds)).toEqual(expect.arrayContaining(['Oxford', 'Trousers', 'Loafers']));
  });

  it('splits a day with hiking and dinner into two outfits', () => {
    const plan = planDay(ALL, day(1, ['hiking', 'dinner out'], { high: 22, low: 14, precipChance: 0 }), ctx);
    expect(plan.outfits).toHaveLength(2);
    expect(plan.outfits[0].label).toMatch(/^Active/);
    expect(plan.outfits[0].itemIds).toContain(closet.boots.id);
    expect(plan.outfits[1].label).toMatch(/^Evening/);
    expect(plan.outfits[1].itemIds).not.toContain(closet.boots.id);
    expect(plan.outfits.every((o) => o.selected)).toBe(true);
  });

  it('includes swimwear for the beach', () => {
    const plan = planDay(ALL, day(1, ['beach'], HOT), ctx);
    expect(plan.outfits[0].itemIds).toContain(closet.trunks.id);
    expect(plan.outfits[0].itemIds).toContain(closet.sandals.id);
  });

  it('offers a distinct, unselected alternative on single-occasion days', () => {
    const plan = planDay(ALL, day(1, ['sightseeing'], HOT), ctx);
    expect(plan.outfits).toHaveLength(2);
    expect(plan.outfits[1].label).toBe('Alternative');
    expect(plan.outfits[1].selected).toBe(false);
    expect(plan.outfits[1].itemIds).not.toEqual(plan.outfits[0].itemIds);
  });

  it('always includes a non-empty rationale', () => {
    const plan = planDay(ALL, day(1, ['sightseeing']), ctx);
    expect(plan.outfits[0].rationale).toMatch(/activities only/);
  });
});

describe('locks', () => {
  it('keeps a locked item and never pairs it with a conflicting item', () => {
    const dress = item({ name: 'Sundress', category: 'dress', warmth: 1, weatherTags: ['hot'], activities: ['sightseeing'] });
    const items = [...ALL, dress];
    const plan = planDay(items, day(1, ['sightseeing'], COLD), { ...ctx, locks: [[dress.id]] });
    const ids = plan.outfits[0].itemIds;
    expect(ids).toContain(dress.id);
    const cats = ids.map((id) => items.find((i) => i.id === id)!.category);
    expect(cats).not.toContain('top');
    expect(cats).not.toContain('bottom');
    expect(plan.outfits[0].lockedItemIds).toEqual([dress.id]);
  });

  it('keeps locked items on regenerate with a different seed', () => {
    const locks = [[closet.sweater.id]];
    for (const seed of [1, 2, 3, 99]) {
      const plan = planDay(ALL, day(1, ['sightseeing'], HOT), { ...ctx, seed, locks });
      expect(plan.outfits[0].itemIds).toContain(closet.sweater.id);
      expect(plan.outfits[0].itemIds).not.toContain(closet.tee.id);
      expect(plan.outfits[0].itemIds).not.toContain(closet.linen.id);
    }
  });
});

describe('planTrip', () => {
  it('never repeats the exact same outfit on consecutive days', () => {
    const days = [1, 2, 3, 4, 5].map((i) => day(i, ['sightseeing'], HOT));
    const plans = planTrip(ALL, days);
    for (let i = 1; i < plans.length; i++) {
      const prev = [...plans[i - 1].outfits[0].itemIds].sort();
      const cur = [...plans[i].outfits[0].itemIds].sort();
      expect(cur).not.toEqual(prev);
    }
  });

  it('prefers reusing items across days to keep packing small', () => {
    const days = [1, 2, 3, 4, 5].map((i) => day(i, ['sightseeing'], HOT));
    const plans = planTrip(ALL, days);
    const selected = plans.flatMap((p) => p.outfits.filter((o) => o.selected));
    const stats = packingStats(selected);
    expect(stats.outfitCount).toBe(5);
    expect(stats.itemCount).toBeLessThanOrEqual(7);
    expect(stats.wearsPerItem).toBeGreaterThan(2);
  });

  it('is deterministic for a given seed', () => {
    const days = [1, 2, 3].map((i) => day(i, ['sightseeing', 'dinner out'], RAINY_MILD));
    expect(planTrip(ALL, days, { seed: 7 })).toEqual(planTrip(ALL, days, { seed: 7 }));
  });
});

describe('gaps', () => {
  it('flags missing rain gear', () => {
    const items = ALL.filter((i) => !i.weatherTags.includes('rain-ready'));
    const d = day(3, ['sightseeing'], RAINY_MILD);
    const plan = planDay(items, d, ctx);
    expect(plan.gaps.join(' ')).toMatch(/No rain-ready outerwear or shoes for Day 3/);
  });

  it('flags missing warm outerwear and swimwear', () => {
    const items = ALL.filter((i) => i.id !== closet.puffer.id && i.category !== 'swimwear');
    expect(planDay(items, day(2, ['sightseeing'], COLD), ctx).gaps.join(' ')).toMatch(/No outerwear warm enough for Day 2/);
    expect(planDay(items, day(1, ['beach'], HOT), ctx).gaps.join(' ')).toMatch(/No swimwear/);
  });

  it('reports no gaps for a well-covered day', () => {
    const d = day(1, ['sightseeing'], HOT);
    const plan = planDay(ALL, d, ctx);
    expect(detectGaps(ALL, d, plan.outfits, outfitTargets(d.activities))).toEqual([]);
  });
});

describe('swapCandidates', () => {
  it('offers same-slot items not already in the outfit, best first', () => {
    const d = day(1, ['sightseeing'], RAINY_MILD);
    const outfit = [closet.tee.id, closet.shorts.id, closet.sneakers.id];
    const cands = swapCandidates(ALL, d, outfitTargets(d.activities)[0].group, outfit, closet.sneakers.id);
    expect(cands.every((c) => c.category === 'shoes')).toBe(true);
    expect(cands.map((c) => c.id)).not.toContain(closet.sneakers.id);
    expect(cands[0].id).toBe(closet.boots.id); // rain-ready wins on a wet day
  });

  it('assigns activewear to whichever of top/bottom is free', () => {
    const leggings = item({ name: 'Leggings', category: 'activewear' });
    const slots = assignSlots([closet.tee, leggings]);
    expect(slots.get(leggings.id)).toBe('bottom');
  });
});

describe('packing helpers', () => {
  it('dedupes items across outfits', () => {
    expect(dedupeItemIds([{ itemIds: [1, 2, 3] }, { itemIds: [2, 3, 4] }])).toEqual([1, 2, 3, 4]);
  });

  it('computes efficiency', () => {
    expect(packingStats([{ itemIds: [1, 2] }, { itemIds: [1, 3] }])).toEqual({ outfitCount: 2, itemCount: 3, wearsPerItem: 1.3 });
  });

  it('diffs packing rows without touching existing ones', () => {
    expect(diffPacking([1, 2, 3], [2, 3, 4])).toEqual({ add: [4], remove: [1] });
  });
});
