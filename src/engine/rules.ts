/** Pure rule tables and scoring helpers for the outfit engine. */
import type { Activity, Category, Formality } from '../db/types';
import type { EngineItem, EngineWeather } from './types';

export type TempBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'freezing';

export interface WarmthNeeds {
  band: TempBand;
  /** Ideal warmth (1-5) for core clothing (tops, bottoms, dresses, shoes). */
  coreWarmth: number;
  /** Minimum outerwear warmth, or null if no outerwear is needed for warmth. */
  outerwearMin: number | null;
}

/** Rain-ready gear is required when precipitation chance exceeds this. */
export const RAIN_THRESHOLD = 50;

/** Map a day's temperatures (°C) to the warmth levels the outfit should have. */
export function warmthNeeds(w: EngineWeather): WarmthNeeds {
  // Weight the daytime high more: that's when you're out and about.
  const t = w.high * 0.65 + w.low * 0.35;
  if (t >= 26) return { band: 'hot', coreWarmth: 1, outerwearMin: null };
  if (t >= 20) return { band: 'warm', coreWarmth: 1.5, outerwearMin: null };
  if (t >= 14) return { band: 'mild', coreWarmth: 2, outerwearMin: w.low < 12 ? 2 : null };
  if (t >= 7) return { band: 'cool', coreWarmth: 3, outerwearMin: 3 };
  if (t >= 0) return { band: 'cold', coreWarmth: 3, outerwearMin: 4 };
  return { band: 'freezing', coreWarmth: 4, outerwearMin: 5 };
}

export function isRainy(w?: EngineWeather): boolean {
  return !!w && w.precipChance > RAIN_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Occasions: activities grouped by what they demand of an outfit.

export type Occasion = 'active' | 'beach' | 'dressy' | 'everyday';

const ACTIVITY_OCCASION: Record<Activity, Occasion> = {
  hiking: 'active',
  workout: 'active',
  beach: 'beach',
  'dinner out': 'dressy',
  business: 'dressy',
  nightlife: 'dressy',
  sightseeing: 'everyday',
  'travel day': 'everyday',
  lounging: 'everyday',
};

const OCCASION_ORDER: Occasion[] = ['active', 'beach', 'everyday', 'dressy'];

export interface OccasionGroup {
  occasion: Occasion;
  activities: Activity[];
}

/** Split a day's activities into ordered occasion groups (daytime first, dressy last). */
export function groupOccasions(activities: Activity[]): OccasionGroup[] {
  const acts = activities.length ? activities : (['sightseeing'] as Activity[]);
  const groups = new Map<Occasion, Activity[]>();
  for (const a of acts) {
    const o = ACTIVITY_OCCASION[a] ?? 'everyday';
    groups.set(o, [...(groups.get(o) ?? []), a]);
  }
  // 'everyday' merges into a more specific daytime occasion when one exists.
  if (groups.has('everyday') && (groups.has('active') || groups.has('beach'))) {
    const target = groups.has('active') ? 'active' : 'beach';
    groups.set(target, [...groups.get(target)!, ...groups.get('everyday')!]);
    groups.delete('everyday');
  }
  return OCCASION_ORDER.filter((o) => groups.has(o)).map((o) => ({ occasion: o, activities: groups.get(o)! }));
}

export const FORMALITY_RANK: Record<Formality, number> = { casual: 0, 'smart casual': 1, formal: 2 };

/** Minimum formality the activities call for. */
export function requiredFormality(activities: Activity[]): Formality {
  if (activities.includes('business')) return 'formal';
  if (activities.includes('dinner out') || activities.includes('nightlife')) return 'smart casual';
  return 'casual';
}

// ---------------------------------------------------------------------------
// Slots: which part of an outfit an item fills.

export type Slot = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'swimwear' | 'accessory';

/** Slots each category may fill. Activewear can serve as a top or a bottom. */
export const CATEGORY_SLOTS: Record<Category, Slot[]> = {
  top: ['top'],
  bottom: ['bottom'],
  dress: ['dress'],
  outerwear: ['outerwear'],
  shoes: ['shoes'],
  accessory: ['accessory'],
  swimwear: ['swimwear'],
  activewear: ['bottom', 'top'],
};

/** Slots that cannot coexist in one outfit. */
export const SLOT_CONFLICTS: Partial<Record<Slot, Slot[]>> = {
  dress: ['top', 'bottom'],
  top: ['dress'],
  bottom: ['dress'],
};

// ---------------------------------------------------------------------------
// Scoring

export interface ScoreContext {
  slot: Slot;
  needs: WarmthNeeds | null;
  rainy: boolean;
  occasion: Occasion;
  activities: Activity[];
  formality: Formality;
  /** Items already chosen on other days (reusing them keeps packing light). */
  reused: Set<number>;
  /** Items to steer away from (e.g. ones used in the sibling outfit). */
  avoid: Set<number>;
  jitter: (id: number) => number;
}

export function scoreItem(item: EngineItem, ctx: ScoreContext): number {
  let s = 0;
  const { needs, slot } = ctx;

  // Warmth fit.
  if (needs) {
    if (slot === 'outerwear') {
      if (needs.outerwearMin != null) {
        s += item.warmth >= needs.outerwearMin ? 3 - (item.warmth - needs.outerwearMin) * 0.5 : -3 * (needs.outerwearMin - item.warmth);
      } else {
        s -= Math.max(0, item.warmth - 2) * 1.5; // don't haul a parka on a warm day
      }
    } else if (slot !== 'accessory' && slot !== 'swimwear') {
      s -= Math.abs(item.warmth - needs.coreWarmth) * 1.5;
    }
    const hotish = needs.band === 'hot' || needs.band === 'warm';
    const coldish = needs.band === 'cold' || needs.band === 'freezing' || needs.band === 'cool';
    if (item.weatherTags.includes('hot')) s += hotish ? 1 : coldish ? -2 : 0;
    if (item.weatherTags.includes('cold')) s += coldish ? 1 : hotish ? -2 : 0;
    if (item.weatherTags.includes('sun') && hotish && !ctx.rainy) s += 0.5;
  }

  // Rain.
  if (ctx.rainy && item.weatherTags.includes('rain-ready')) s += slot === 'outerwear' || slot === 'shoes' ? 4 : 1;
  if (ctx.rainy && slot === 'shoes' && item.weatherTags.includes('sun') && !item.weatherTags.includes('rain-ready')) s -= 1;

  // Activities.
  const matches = item.activities.filter((a) => ctx.activities.includes(a)).length;
  s += matches > 0 ? 2 + (matches - 1) * 0.5 : 0;
  if (ctx.occasion === 'active' && item.category === 'activewear') s += 1.5;
  if (ctx.occasion !== 'active' && item.category === 'activewear') s -= 2;

  // Formality.
  const gap = FORMALITY_RANK[item.formality] - FORMALITY_RANK[ctx.formality];
  if (gap < 0) s -= 4 * -gap;
  else if (gap > 0) s -= ctx.occasion === 'active' || ctx.occasion === 'beach' ? 2 * gap : 0.5 * gap;

  // Packing economy and variety.
  if (ctx.reused.has(item.id)) s += 1.5;
  if (ctx.avoid.has(item.id)) s -= 3;

  return s + ctx.jitter(item.id);
}

/** Small deterministic pseudo-random jitter in [0, 0.4) for tie-breaking. */
export function makeJitter(seed: number): (id: number) => number {
  return (id: number) => {
    let x = (id * 2654435761 + seed * 40503) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822507) >>> 0;
    x ^= x >>> 13;
    return ((x >>> 0) % 1000) / 2500;
  };
}
