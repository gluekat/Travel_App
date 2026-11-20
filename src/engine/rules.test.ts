import { describe, expect, it } from 'vitest';
import { ACTIVITIES, CATEGORIES, WEATHER_TAGS } from '../db/types';
import { CATEGORY_SLOTS, requiredFormality, scoreItem, type ScoreContext } from './rules';
import type { EngineItem } from './types';

const item = (over: Partial<EngineItem>): EngineItem => ({ id: 1, name: 'x', category: 'top', color: '', warmth: 2, formality: 'casual', weatherTags: [], activities: [], quantity: 1, wearCount: 1, favorite: 0, ...over });
const ctx = (band: 'hot' | 'cold'): ScoreContext => ({
  needs: { band, coreWarmth: 2, outerwearMin: null },
  slot: 'top', rainy: false, occasion: 'everyday', activities: [], formality: 'casual', usage: new Map(), avoid: new Set(), jitter: () => 0,
});

describe('new options', () => {
  it('offers the new weather tags, Work activity and one-piece category', () => {
    expect(WEATHER_TAGS).toEqual(expect.arrayContaining(['cool', 'mild', 'warm', 'chilly', 'snow', 'windy']));
    expect(ACTIVITIES).toContain('work');
    expect(CATEGORIES).toContain('one-piece');
    expect(CATEGORY_SLOTS['one-piece']).toEqual(['dress']);
    expect(requiredFormality(['work'])).toBe('smart casual');
  });

  it('scores the temperature tags like hot/cold', () => {
    expect(scoreItem(item({ weatherTags: ['warm'] }), ctx('hot'))).toBeGreaterThan(scoreItem(item({}), ctx('hot')));
    expect(scoreItem(item({ weatherTags: ['chilly'] }), ctx('hot'))).toBeLessThan(scoreItem(item({}), ctx('hot')));
    expect(scoreItem(item({ weatherTags: ['snow'] }), ctx('cold'))).toBeGreaterThan(scoreItem(item({}), ctx('cold')));
  });
});
