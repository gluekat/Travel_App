import { describe, expect, it } from 'vitest';
import { suggestEmoji } from './emoji';

describe('suggestEmoji', () => {
  it('matches names to emoji', () => {
    expect(suggestEmoji('Phone charger')).toContain('🔌');
    expect(suggestEmoji('Sunscreen')[0]).toBe('🧴');
    expect(suggestEmoji('Passport / ID')).toEqual(expect.arrayContaining(['🛂', '🪪']));
    expect(suggestEmoji('zzzz')).toEqual([]);
    expect(suggestEmoji('')).toEqual([]);
  });
});
