import { describe, expect, it } from 'vitest';
import type { Activity } from '../db/types';
import { capacity, copiesNeeded, groupOccasions, requiredFormality, warmthNeeds } from './rules';
import { assignSlots, capacityGaps, countWears, outfitTargets, planTrip, rankSavedOutfits, suggestOptions, swapCandidates } from './suggest';
import { dedupeItemIds, diffPacking, generalQty, packingStats, packLines } from './packing';
import type { EngineDay, EngineItem, EngineWeather, SuggestRequest } from './types';

let nextId = 1;
type ItemInit = Partial<EngineItem> & Pick<EngineItem, 'name' | 'category'>;
function item(p: ItemInit): EngineItem {
  return { id: nextId++, color: 'black', warmth: 2, formality: 'casual', weatherTags: [], activities: [], quantity: 1, wearCount: 1, favorite: 0, ...p };
}

const closet = (() => {
  nextId = 1;
  return {
    tee: item({ name: 'Tee', category: 'top', warmth: 1, quantity: 3, weatherTags: ['hot'], activities: ['sightseeing', 'hiking'] }),
    linen: item({ name: 'Linen shirt', category: 'top', warmth: 1, quantity: 2, formality: 'smart casual', weatherTags: ['hot'], activities: ['sightseeing', 'dinner out'] }),
    sweater: item({ name: 'Sweater', category: 'top', warmth: 3, wearCount: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out'] }),
    oxford: item({ name: 'Oxford', category: 'top', warmth: 2, formality: 'formal', activities: ['business', 'dinner out'] }),
    shorts: item({ name: 'Shorts', category: 'bottom', warmth: 1, wearCount: 3, weatherTags: ['hot'], activities: ['sightseeing', 'beach'] }),
    jeans: item({ name: 'Jeans', category: 'bottom', warmth: 3, wearCount: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out'] }),
    trousers: item({ name: 'Trousers', category: 'bottom', warmth: 3, wearCount: 3, formality: 'formal', activities: ['business', 'dinner out'] }),
    rainJacket: item({ name: 'Rain jacket', category: 'outerwear', warmth: 2, wearCount: 10, weatherTags: ['rain-ready'], activities: ['sightseeing', 'hiking'] }),
    puffer: item({ name: 'Puffer', category: 'outerwear', warmth: 5, wearCount: 10, weatherTags: ['cold'], activities: ['sightseeing'] }),
    sneakers: item({ name: 'Sneakers', category: 'shoes', warmth: 2, wearCount: 10, formality: 'smart casual', weatherTags: ['sun'], activities: ['sightseeing', 'dinner out'] }),
    boots: item({ name: 'Hiking boots', category: 'shoes', warmth: 3, wearCount: 10, weatherTags: ['rain-ready', 'cold'], activities: ['hiking', 'sightseeing'] }),
    loafers: item({ name: 'Loafers', category: 'shoes', warmth: 2, wearCount: 10, formality: 'formal', activities: ['business', 'dinner out'] }),
    trunks: item({ name: 'Trunks', category: 'swimwear', warmth: 1, wearCount: 3, weatherTags: ['hot'], activities: ['beach'] }),
    sandals: item({ name: 'Sandals', category: 'shoes', warmth: 1, wearCount: 10, weatherTags: ['hot', 'sun'], activities: ['beach'] }),
  };
})();
const ALL = Object.values(closet);

const HOT: EngineWeather = { high: 32, low: 24, precipChance: 5 };
const COLD: EngineWeather = { high: 4, low: -2, precipChance: 10 };
const RAINY_MILD: EngineWeather = { high: 17, low: 11, precipChance: 80 };

function day(index: number, activities: Activity[], weather?: EngineWeather): EngineDay {
  return { id: 100 + index, index, date: `2026-07-${String(index).padStart(2, '0')}`, activities, weather };
}

const names = (ids: number[]) => ids.map((id: number) => ALL.find((i) => i.id === id)!.name);
const first = (req: Omit<SuggestRequest, 'items'> & { items?: EngineItem[] }) => suggestOptions({ items: ALL, seed: 1, ...req })[0];

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

  it('computes capacity and copies from quantity and wears before washing', () => {
    const socks = { quantity: 5, wearCount: 1 };
    const jeans = { quantity: 1, wearCount: 3 };
    expect(capacity(socks)).toBe(5);
    expect(copiesNeeded(socks, 3)).toBe(3);
    expect(copiesNeeded(socks, 8)).toBe(5); // never more than you own
    expect(capacity(jeans)).toBe(3);
    expect(copiesNeeded(jeans, 3)).toBe(1);
    expect(copiesNeeded({ quantity: 2, wearCount: 2 }, 3)).toBe(2);
  });
});

describe('suggestOptions', () => {
  it('dresses light for heat and skips outerwear', () => {
    const ids = first({ day: day(1, ['sightseeing'], HOT) }).itemIds;
    expect(ids).toContain(closet.shorts.id);
    expect(ids).toContain(closet.tee.id);
    expect(ids.some((id) => [closet.puffer.id, closet.rainJacket.id].includes(id))).toBe(false);
  });

  it('requires warm outerwear in the cold', () => {
    const ids = first({ day: day(1, ['sightseeing'], COLD) }).itemIds;
    expect(ids).toContain(closet.puffer.id);
    expect(ids).toContain(closet.jeans.id);
    expect(ids).not.toContain(closet.shorts.id);
  });

  it('requires rain-ready gear when precipitation chance exceeds 50%', () => {
    const o = first({ day: day(1, ['sightseeing'], RAINY_MILD) });
    expect(o.itemIds).toContain(closet.rainJacket.id);
    expect(o.rationale).toMatch(/80% chance of rain/);
  });

  it('does not require rain gear at exactly 50%', () => {
    expect(first({ day: day(1, ['sightseeing'], { high: 30, low: 22, precipChance: 50 }) }).itemIds).not.toContain(closet.rainJacket.id);
  });

  it('matches formality to the activities the outfit is for', () => {
    const d = day(1, ['hiking', 'business'], { high: 20, low: 14, precipChance: 0 });
    expect(names(first({ day: d, activities: ['business'] }).itemIds)).toEqual(expect.arrayContaining(['Oxford', 'Trousers', 'Loafers']));
    expect(first({ day: d, activities: ['hiking'] }).itemIds).toContain(closet.boots.id);
  });

  it('includes swimwear for the beach', () => {
    const ids = first({ day: day(1, ['beach'], HOT) }).itemIds;
    expect(ids).toContain(closet.trunks.id);
    expect(ids).toContain(closet.sandals.id);
  });

  it('returns two distinct options', () => {
    const opts = suggestOptions({ items: ALL, day: day(1, ['sightseeing'], HOT) }, 2);
    expect(opts).toHaveLength(2);
    expect([...opts[0].itemIds].sort()).not.toEqual([...opts[1].itemIds].sort());
  });

  it('always includes a rationale', () => {
    expect(first({ day: day(1, ['sightseeing']) }).rationale).toMatch(/activities only/);
  });

  it('avoids items with no clean wears left, and flags it when unavoidable', () => {
    const d = day(2, ['sightseeing'], HOT);
    // Shorts (capacity 3) already worn 3 times.
    const used = new Map([[closet.shorts.id, 3]]);
    expect(first({ day: d, usage: used }).itemIds).not.toContain(closet.shorts.id);

    const onlyShorts = ALL.filter((i) => i.category !== 'bottom');
    const o = first({ day: d, items: [...onlyShorts, closet.shorts], usage: used });
    expect(o.itemIds).toContain(closet.shorts.id);
    expect(o.gaps.join(' ')).toMatch(/No clean shorts left/);
  });
});

describe('favorites', () => {
  it('prefers higher-rated items when they fit equally well', () => {
    const d = day(1, ['sightseeing'], HOT);
    const plain = first({ day: d }).itemIds;
    expect(plain).toContain(closet.tee.id);
    // Make the linen shirt a 5-star favorite: it should now win the top slot.
    const items = ALL.map((i) => (i.id === closet.linen.id ? { ...i, favorite: 5 } : i));
    const fav = first({ day: d, items });
    expect(fav.itemIds).toContain(closet.linen.id);
    expect(fav.rationale).toMatch(/Includes your favorite: linen shirt/);
  });

  it('does not let a favorite override the weather', () => {
    const items = ALL.map((i) => (i.id === closet.puffer.id ? { ...i, favorite: 5 } : i));
    expect(first({ day: day(1, ['sightseeing'], HOT), items }).itemIds).not.toContain(closet.puffer.id);
  });
});

describe('rankSavedOutfits', () => {
  const summer = { id: 1, name: 'Summer stroll', favorite: false, itemIds: [closet.tee.id, closet.shorts.id, closet.sandals.id] };
  const winter = { id: 2, name: 'Winter city', favorite: false, itemIds: [closet.sweater.id, closet.jeans.id, closet.puffer.id, closet.boots.id] };

  it('ranks saved outfits by fit for the day', () => {
    expect(rankSavedOutfits(ALL, day(1, ['sightseeing'], HOT), ['sightseeing'], [winter, summer]).map((r) => r.name)).toEqual(['Summer stroll', 'Winter city']);
    expect(rankSavedOutfits(ALL, day(1, ['sightseeing'], COLD), ['sightseeing'], [summer, winter])[0].name).toBe('Winter city');
  });

  it('boosts favorite outfits and reports gaps', () => {
    const similar = { id: 3, name: 'Also summer', favorite: true, itemIds: [closet.linen.id, closet.shorts.id, closet.sandals.id] };
    const ranked = rankSavedOutfits(ALL, day(1, ['sightseeing'], HOT), ['sightseeing'], [summer, similar]);
    expect(ranked[0].name).toBe('Also summer');
    const cold = rankSavedOutfits(ALL, day(4, ['sightseeing'], COLD), ['sightseeing'], [summer]);
    expect(cold[0].gaps.join(' ')).toMatch(/No outerwear warm enough for Day 4/);
  });

  it('skips saved outfits whose items were all deleted', () => {
    expect(rankSavedOutfits(ALL, day(1, [], HOT), [], [{ id: 9, name: 'Gone', favorite: true, itemIds: [9999] }])).toEqual([]);
  });
});

describe('locks', () => {
  it('keeps a locked item and never pairs it with a conflicting item', () => {
    const dress = item({ name: 'Sundress', category: 'dress', warmth: 1, weatherTags: ['hot'], activities: ['sightseeing'] });
    const items = [...ALL, dress];
    const ids = suggestOptions({ items, day: day(1, ['sightseeing'], COLD), locked: [dress.id] })[0].itemIds;
    expect(ids).toContain(dress.id);
    const cats = ids.map((id: number) => items.find((i) => i.id === id)!.category);
    expect(cats).not.toContain('top');
    expect(cats).not.toContain('bottom');
  });

  it('keeps locked items in every option and seed', () => {
    for (const seed of [1, 2, 3, 99]) {
      for (const o of suggestOptions({ items: ALL, day: day(1, ['sightseeing'], HOT), seed, locked: [closet.sweater.id] })) {
        expect(o.itemIds).toContain(closet.sweater.id);
        expect(o.itemIds).not.toContain(closet.tee.id);
      }
    }
  });
});

describe('planTrip', () => {
  it('makes one outfit per occasion', () => {
    const [plan] = planTrip(ALL, [day(1, ['hiking', 'dinner out'], { high: 22, low: 14, precipChance: 0 })]);
    expect(plan.outfits.map((o) => o.label)).toEqual(['Active: hiking', 'Evening: dinner out']);
    expect(plan.outfits[0].itemIds).toContain(closet.boots.id);
    expect(plan.outfits[1].itemIds).not.toContain(closet.boots.id);
  });

  it('never repeats the exact same outfit on consecutive days', () => {
    const plans = planTrip(ALL, [1, 2, 3, 4, 5].map((i) => day(i, ['sightseeing'], HOT)));
    for (let i = 1; i < plans.length; i++) {
      expect([...plans[i].outfits[0].itemIds].sort()).not.toEqual([...plans[i - 1].outfits[0].itemIds].sort());
    }
  });

  it('reuses items but stays within copies × wears before washing', () => {
    const plans = planTrip(ALL, [1, 2, 3, 4, 5].map((i) => day(i, ['sightseeing'], HOT)));
    const outfits = plans.flatMap((p) => p.outfits);
    expect(capacityGaps(ALL, outfits)).toEqual([]);
    const wears = countWears(outfits);
    for (const [id, n] of wears) expect(n).toBeLessThanOrEqual(capacity(ALL.find((i) => i.id === id)!));
    expect(packingStats(ALL, outfits).wearsPerPiece).toBeGreaterThan(1);
  });

  it('respects wears already planned elsewhere', () => {
    const usage = new Map([[closet.tee.id, 3]]);
    const [plan] = planTrip(ALL, [day(1, ['sightseeing'], HOT)], { usage });
    expect(plan.outfits[0].itemIds).not.toContain(closet.tee.id);
  });

  it('is deterministic for a given seed', () => {
    const days = [1, 2, 3].map((i) => day(i, ['sightseeing', 'dinner out'], RAINY_MILD));
    expect(planTrip(ALL, days, { seed: 7 })).toEqual(planTrip(ALL, days, { seed: 7 }));
  });

  it('has a single target for single-occasion days', () => {
    expect(outfitTargets(['sightseeing', 'travel day'])).toHaveLength(1);
  });
});

describe('gaps', () => {
  it('flags missing rain gear', () => {
    const items = ALL.filter((i) => !i.weatherTags.includes('rain-ready'));
    const o = suggestOptions({ items, day: day(3, ['sightseeing'], RAINY_MILD) })[0];
    expect(o.gaps.join(' ')).toMatch(/No rain-ready outerwear or shoes for Day 3/);
  });

  it('flags missing warm outerwear and swimwear', () => {
    const items = ALL.filter((i) => i.id !== closet.puffer.id && i.category !== 'swimwear');
    expect(suggestOptions({ items, day: day(2, ['sightseeing'], COLD) })[0].gaps.join(' ')).toMatch(/No outerwear warm enough for Day 2/);
    expect(suggestOptions({ items, day: day(1, ['beach'], HOT) })[0].gaps.join(' ')).toMatch(/No swimwear/);
  });

  it('reports no gaps for a well-covered day', () => {
    expect(first({ day: day(1, ['sightseeing'], HOT) }).gaps).toEqual([]);
  });

  it('reports items planned beyond their clean wears', () => {
    const gaps = capacityGaps(ALL, [{ itemIds: [closet.oxford.id] }, { itemIds: [closet.oxford.id] }]);
    expect(gaps[0]).toMatch(/Oxford: planned for 2 wears, but 1 owned × 1 wear before washing = 1/);
  });
});

describe('swapCandidates', () => {
  it('offers same-slot items not already in the outfit, best first', () => {
    const d = day(1, ['sightseeing'], RAINY_MILD);
    const outfit = [closet.tee.id, closet.shorts.id, closet.sneakers.id];
    const cands = swapCandidates(ALL, d, d.activities, outfit, closet.sneakers.id);
    expect(cands.every((c) => c.category === 'shoes')).toBe(true);
    expect(cands.map((c) => c.id)).not.toContain(closet.sneakers.id);
    expect(cands[0].id).toBe(closet.boots.id);
  });

  it('assigns activewear to whichever of top/bottom is free', () => {
    const leggings = item({ name: 'Leggings', category: 'activewear' });
    expect(assignSlots([closet.tee, leggings]).get(leggings.id)).toBe('bottom');
  });
});

describe('packing helpers', () => {
  it('dedupes items across outfits', () => {
    expect(dedupeItemIds([{ itemIds: [1, 2, 3] }, { itemIds: [2, 3, 4] }])).toEqual([1, 2, 3, 4]);
  });

  it('packs the right number of copies and reports shortfalls', () => {
    const socks = { id: 1, quantity: 5, wearCount: 1 };
    const jeans = { id: 2, quantity: 1, wearCount: 3 };
    const outfits = Array.from({ length: 6 }, () => ({ itemIds: [1, 2] }));
    const lines = packLines([socks, jeans], outfits);
    expect(lines.get(1)).toEqual({ itemId: 1, wears: 6, copies: 5, shortfall: 1 });
    expect(lines.get(2)).toEqual({ itemId: 2, wears: 6, copies: 1, shortfall: 3 });
  });

  it('computes stats over physical pieces and ignores empty outfits', () => {
    const stock = [
      { id: 1, quantity: 2, wearCount: 1 },
      { id: 2, quantity: 1, wearCount: 3 },
    ];
    expect(packingStats(stock, [{ itemIds: [1, 2] }, { itemIds: [1, 2] }, { itemIds: [] }])).toEqual({
      outfitCount: 2,
      itemCount: 2,
      pieceCount: 3,
      wearsPerPiece: 1.3,
    });
  });

  it('computes general item quantities per day or fixed', () => {
    expect(generalQty({ perDay: 1 }, 5)).toBe(5);
    expect(generalQty({ perDay: 2 }, 5)).toBe(10);
    expect(generalQty({ qty: 1 }, 5)).toBe(1);
  });

  it('diffs packing rows without touching existing ones', () => {
    expect(diffPacking([1, 2, 3], [2, 3, 4])).toEqual({ add: [4], remove: [1] });
  });
});
