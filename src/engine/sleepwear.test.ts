import { describe, expect, it } from 'vitest';
import { suggestSleepwear, sleepwearSwapCandidates, type SleepwearItem } from './sleepwear';

const item = (id: number, category: string, subcategory?: SleepwearItem['subcategory'], favorite = 0): SleepwearItem => ({ id, name: `i${id}`, category, subcategory, favorite });

describe('suggestSleepwear', () => {
  const closet = [item(1, 'pajamas', 'top', 3), item(2, 'pajamas', 'bottom'), item(3, 'pajamas', 'one-piece', 1), item(4, 'top'), item(5, 'pajamas', 'shoes'), item(6, 'shoes')];

  it('suggests a top with a bottom or a one-piece, only from pajamas, no extras', () => {
    const sets = suggestSleepwear(closet, new Map(), 0, 5);
    expect(sets).toEqual(expect.arrayContaining([[1, 2], [3]]));
    expect(sets.flat()).not.toContain(4);
    expect(sets.flat()).not.toContain(6);
    expect(suggestSleepwear(closet, new Map(), 0, 1)[0]).not.toContain(5);
  });

  it('offers shoes/accessories only as later variants of the plain set', () => {
    const more = [...closet, item(7, 'pajamas', 'accessories')];
    const sets = suggestSleepwear(more, new Map(), 0, 20);
    expect(sets[0]).toEqual([1, 2]);
    expect(sets).toEqual(expect.arrayContaining([[1, 2, 5], [1, 2, 7], [1, 2, 5, 7], [3, 5]]));
    expect(sets.every((s) => !s.includes(4) && !s.includes(6))).toBe(true);
  });

  it('returns nothing without pajamas and prefers higher favorites', () => {
    expect(suggestSleepwear([item(4, 'top')])).toEqual([]);
    expect(suggestSleepwear(closet, new Map(), 0, 1)).toEqual([[1, 2]]);
  });

  it('swaps within the same pajama type', () => {
    const more = [...closet, item(7, 'pajamas', 'shoes'), item(8, 'shoes')];
    expect(sleepwearSwapCandidates(more, [1, 2, 5], 5).map((i) => i.id)).toEqual([7]);
  });
});
