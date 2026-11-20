/** Which closet items appear on which tab, plus the shared filter / sort / group logic for the item lists. */
import { ACCESSORY_TYPES, CATEGORIES, generalCategory, type ClosetItem, type GeneralItem } from '../../db/types';

export type Scope = 'all' | 'clothing' | 'shoes' | 'accessories';
export type Entry = { kind: 'closet'; item: ClosetItem } | { kind: 'general'; item: GeneralItem };

export const isShoes = (i: ClosetItem) => i.category === 'shoes' || i.subcategory === 'shoes';
export const isAccessory = (i: ClosetItem) => i.category === 'accessory' || i.subcategory === 'accessories';
/** Clothing is everything that isn't a shoe, an accessory or a general item. */
export const isClothing = (i: ClosetItem) => !isShoes(i) && !isAccessory(i);

/** The category an entry is listed under (pajama shoes count as shoes, activewear accessories as accessories). */
export function effectiveCategory(e: Entry): string {
  if (e.kind === 'general') return 'general';
  if (isShoes(e.item)) return 'shoes';
  if (isAccessory(e.item)) return 'accessory';
  return e.item.category;
}

export function inScope(e: Entry, scope: Scope): boolean {
  if (scope === 'all') return true;
  if (e.kind === 'general') return false;
  return scope === 'clothing' ? isClothing(e.item) : scope === 'shoes' ? isShoes(e.item) : isAccessory(e.item);
}

export const entryTags = (e: Entry): string[] => (e.kind === 'closet' ? [...e.item.weatherTags, ...e.item.activities] : e.item.tags);
export const entryCustomTags = (e: Entry): string[] => (e.kind === 'closet' ? e.item.customTags ?? [] : []);

export interface Filters {
  query: string;
  category: string | null;
  /** A built-in tag, or "#custom". */
  tag: string | null;
  favoritesOnly: boolean;
  accessoryType: string | null;
}

export function matchesFilters(e: Entry, f: Filters): boolean {
  if (f.category && effectiveCategory(e) !== f.category) return false;
  if (f.favoritesOnly && (e.kind === 'general' || (e.item.favorite ?? 0) < 4)) return false;
  if (f.accessoryType && (e.kind === 'general' || (e.item.accessoryType ?? 'unspecified') !== f.accessoryType)) return false;
  if (f.tag) {
    const custom = f.tag.startsWith('#') ? f.tag.slice(1) : null;
    const has = custom != null ? (e.kind === 'closet' ? (e.item.customTags ?? []).includes(custom) : e.item.tags.includes(custom)) : entryTags(e).includes(f.tag);
    if (!has) return false;
  }
  const q = f.query.trim().toLowerCase();
  if (!q) return true;
  const hay =
    e.kind === 'closet'
      ? [e.item.name, e.item.color, e.item.size, e.item.material, e.item.notes, e.item.accessoryType, ...(e.item.customTags ?? [])]
      : [e.item.name, generalCategory(e.item), ...e.item.tags];
  return hay.some((h) => h?.toLowerCase().includes(q));
}

export type SortKey = 'default' | 'name' | 'category' | 'favorite' | 'warmth' | 'formality' | 'weather' | 'activity' | 'customtags';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Date added' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'favorite', label: 'Favorite' },
  { key: 'warmth', label: 'Warmth' },
  { key: 'formality', label: 'Formality' },
  { key: 'weather', label: 'Weather tags' },
  { key: 'activity', label: 'Activity tags' },
  { key: 'customtags', label: 'Custom tags' },
];

const FORMALITY: Record<string, number> = { casual: 0, 'smart casual': 1, formal: 2 };
const CATEGORY_ORDER = [...CATEGORIES, 'general'] as string[];
const name = (e: Entry) => e.item.name;
const updated = (e: Entry) => (e.kind === 'closet' ? e.item.updatedAt : e.item.createdAt);

/**
 * Sorted copy. "asc" is the natural ascending order (A→Z, fewest to most, casual → formal, oldest first,
 * items with no warmth first); "desc" is exactly the reverse.
 */
export function sortEntries(entries: Entry[], sort: SortKey, dir: 'asc' | 'desc' = 'asc'): Entry[] {
  const warmth = (e: Entry) => (e.kind === 'closet' && e.item.warmth > 0 ? e.item.warmth : 0);
  const cmp: Record<SortKey, (a: Entry, b: Entry) => number> = {
    default: (a, b) => updated(a) - updated(b),
    name: (a, b) => name(a).localeCompare(name(b)),
    category: (a, b) => CATEGORY_ORDER.indexOf(effectiveCategory(a)) - CATEGORY_ORDER.indexOf(effectiveCategory(b)),
    favorite: (a, b) => (a.kind === 'closet' ? a.item.favorite ?? 0 : 0) - (b.kind === 'closet' ? b.item.favorite ?? 0 : 0),
    warmth: (a, b) => warmth(a) - warmth(b),
    formality: (a, b) => (a.kind === 'closet' ? FORMALITY[a.item.formality] ?? 0 : 3) - (b.kind === 'closet' ? FORMALITY[b.item.formality] ?? 0 : 3),
    weather: (a, b) => (a.kind === 'closet' ? a.item.weatherTags.length : 0) - (b.kind === 'closet' ? b.item.weatherTags.length : 0),
    activity: (a, b) => (a.kind === 'closet' ? a.item.activities.length : 0) - (b.kind === 'closet' ? b.item.activities.length : 0),
    customtags: (a, b) => entryCustomTags(a).length - entryCustomTags(b).length,
  };
  const asc = [...entries].sort((a, b) => cmp[sort](a, b) || name(a).localeCompare(name(b)) || (a.item.id ?? 0) - (b.item.id ?? 0));
  return dir === 'asc' ? asc : asc.reverse();
}

export type GroupBy = 'none' | 'category' | 'type';

/** Entries split into labelled groups (in a stable order), or one unlabelled group. */
export function groupEntries(entries: Entry[], by: GroupBy): { label: string | null; entries: Entry[] }[] {
  if (by === 'none') return [{ label: null, entries }];
  if (by === 'category') {
    return CATEGORY_ORDER.map((c) => ({ label: c, entries: entries.filter((e) => effectiveCategory(e) === c) })).filter((g) => g.entries.length);
  }
  const typeOf = (e: Entry) => (e.kind === 'closet' ? e.item.accessoryType ?? 'unspecified' : 'unspecified');
  return [...ACCESSORY_TYPES, 'unspecified'].map((t) => ({ label: t === 'unspecified' ? 'no type set' : t, entries: entries.filter((e) => typeOf(e) === t) })).filter((g) => g.entries.length);
}
