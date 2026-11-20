import { describe, expect, it } from 'vitest';
import type { ClosetItem, GeneralItem } from '../../db/types';
import { groupEntries, inScope, matchesFilters, sortEntries, type Entry, type Filters } from './closetScopes';

const closet = (over: Partial<ClosetItem> & { name: string }): Entry => ({
  kind: 'closet',
  item: { id: 1, category: 'top', color: '', warmth: 2, formality: 'casual', weatherTags: [], activities: [], quantity: 1, wearCount: 1, favorite: 0, customTags: [], isSample: false, createdAt: 1, updatedAt: 1, ...over },
});
const general = (name: string, over: Partial<GeneralItem> = {}): Entry => ({ kind: 'general', item: { id: 1, name, isDefault: false, tags: [], createdAt: 1, ...over } });
const none: Filters = { query: '', category: null, tag: null, favoritesOnly: false, accessoryType: null };

const tee = closet({ name: 'Tee' });
const sneakers = closet({ name: 'Sneakers', category: 'shoes' });
const hat = closet({ name: 'Sun hat', category: 'accessory', accessoryType: 'hat', warmth: 0 });
const pjShoes = closet({ name: 'Slippers', category: 'pajamas', subcategory: 'shoes' });
const pjTop = closet({ name: 'PJ top', category: 'pajamas', subcategory: 'top' });
const charger = general('Phone charger', { category: 'Electronics' });

describe('closet scopes', () => {
  it('splits clothing, shoes, accessories and general', () => {
    const all = [tee, sneakers, hat, pjShoes, pjTop, charger];
    const names = (s: Parameters<typeof inScope>[1]) => all.filter((e) => inScope(e, s)).map((e) => e.item.name);
    expect(names('all')).toHaveLength(6);
    expect(names('clothing')).toEqual(['Tee', 'PJ top']);
    expect(names('shoes')).toEqual(['Sneakers', 'Slippers']);
    expect(names('accessories')).toEqual(['Sun hat']);
  });

  it('filters across closet and general items', () => {
    expect(matchesFilters(charger, { ...none, category: 'general' })).toBe(true);
    expect(matchesFilters(tee, { ...none, category: 'general' })).toBe(false);
    expect(matchesFilters(pjShoes, { ...none, category: 'shoes' })).toBe(true);
    expect(matchesFilters(charger, { ...none, query: 'electr' })).toBe(true);
    expect(matchesFilters(hat, { ...none, accessoryType: 'hat' })).toBe(true);
    expect(matchesFilters(hat, { ...none, accessoryType: 'scarf' })).toBe(false);
    expect(matchesFilters(charger, { ...none, favoritesOnly: true })).toBe(false);
  });

  it('sorts ascending first and reverses on request and groups by category / accessory type', () => {
    expect(sortEntries([hat, tee], 'warmth', 'desc').map((e) => e.item.name)).toEqual(['Tee', 'Sun hat']);
    expect(sortEntries([hat, tee], 'warmth', 'asc').map((e) => e.item.name)).toEqual(['Sun hat', 'Tee']);
    const names = [tee, sneakers, hat];
    expect(sortEntries(names, 'name').map((e) => e.item.name)).toEqual(['Sneakers', 'Sun hat', 'Tee']);
    expect(sortEntries(names, 'name', 'desc').map((e) => e.item.name)).toEqual(['Tee', 'Sun hat', 'Sneakers']);
    const groups = groupEntries([charger, hat, tee, sneakers], 'category');
    expect(groups.map((g) => g.label)).toEqual(['top', 'shoes', 'accessory', 'general']);
    const scarf = closet({ name: 'Scarf', category: 'accessory', accessoryType: 'scarf' });
    const plain = closet({ name: 'Mystery', category: 'accessory' });
    expect(groupEntries([plain, scarf, hat], 'type').map((g) => g.label)).toEqual(['hat', 'scarf', 'no type set']);
  });
});
