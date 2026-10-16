/**
 * Rules-based outfit engine (v2). Pure functions only: no React, no Dexie,
 * no network. See ./types.ts for the swappable contract.
 */
import type { Activity } from '../db/types';
import {
  CATEGORY_SLOTS,
  FORMALITY_RANK,
  SLOT_CONFLICTS,
  capacity,
  groupOccasions,
  isRainy,
  makeJitter,
  requiredFormality,
  scoreItem,
  warmthNeeds,
  type Occasion,
  type OccasionGroup,
  type ScoreContext,
  type Slot,
} from './rules';
import type { DayPlan, EngineDay, EngineItem, OutfitEngine, PlanOptions, RankedSavedOutfit, SuggestRequest, SuggestedOutfit } from './types';

const SLOT_ORDER: Slot[] = ['outerwear', 'top', 'dress', 'swimwear', 'bottom', 'shoes', 'accessory'];
const ACCESSORY_MIN_SCORE = 2.5;

const defaultFormat = (c: number) => `${Math.round(c)}°C`;

// ---------------------------------------------------------------------------
// Occasions

const OCCASION_LABEL: Record<Occasion, string> = {
  active: 'Active',
  beach: 'Beach',
  everyday: 'Daytime',
  dressy: 'Evening',
};

export interface OutfitTarget {
  label: string;
  group: OccasionGroup;
}

/** One target per occasion in the day (daytime first, dressy last). */
export function outfitTargets(activities: Activity[]): OutfitTarget[] {
  const groups = groupOccasions(activities);
  if (groups.length === 1) return [{ label: 'Outfit 1', group: groups[0] }];
  return groups.map((g) => ({ label: `${OCCASION_LABEL[g.occasion]}: ${g.activities.join(', ')}`, group: g }));
}

/** A single occasion for one outfit covering the given activities. */
export function occasionFor(activities: Activity[]): OccasionGroup {
  const groups = groupOccasions(activities);
  if (groups.length === 1) return groups[0];
  // One outfit for several occasions: dress for the most demanding one.
  const dressy = groups.find((g) => g.occasion === 'dressy');
  return { occasion: dressy ? 'dressy' : groups[0].occasion, activities: groups.flatMap((g) => g.activities) };
}

// ---------------------------------------------------------------------------
// Slot assignment

/** Assign each item in an outfit to a slot (needed for activewear, which can be top or bottom). */
export function assignSlots(items: EngineItem[]): Map<number, Slot> {
  const taken = new Set<Slot>();
  const out = new Map<number, Slot>();
  const sorted = [...items].sort((a, b) => CATEGORY_SLOTS[a.category].length - CATEGORY_SLOTS[b.category].length);
  for (const item of sorted) {
    const slots = CATEGORY_SLOTS[item.category];
    const slot = slots.find((s) => !taken.has(s)) ?? slots[0];
    taken.add(slot);
    out.set(item.id, slot);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building one outfit

interface BuildContext {
  items: EngineItem[];
  day: EngineDay;
  group: OccasionGroup;
  locked: number[];
  usage: Map<number, number>;
  avoid: Set<number>;
  exclude: Set<number>;
  jitter: (id: number) => number;
}

interface Built {
  itemIds: number[];
  score: number;
}

function scoreContext(ctx: BuildContext, slot: Slot): ScoreContext {
  return {
    slot,
    needs: ctx.day.weather ? warmthNeeds(ctx.day.weather) : null,
    rainy: isRainy(ctx.day.weather),
    occasion: ctx.group.occasion,
    activities: ctx.group.activities,
    formality: requiredFormality(ctx.group.activities),
    usage: ctx.usage,
    avoid: ctx.avoid,
    jitter: ctx.jitter,
  };
}

function bestFor(ctx: BuildContext, slot: Slot, used: Set<number>): { item: EngineItem; score: number } | undefined {
  const sctx = scoreContext(ctx, slot);
  let best: { item: EngineItem; score: number } | undefined;
  for (const item of ctx.items) {
    if (used.has(item.id) || ctx.exclude.has(item.id)) continue;
    if (!CATEGORY_SLOTS[item.category].includes(slot)) continue;
    const score = scoreItem(item, sctx);
    if (!best || score > best.score || (score === best.score && item.id < best.item.id)) best = { item, score };
  }
  return best;
}

export function buildOutfit(ctx: BuildContext): Built {
  const byId = new Map(ctx.items.map((i) => [i.id, i]));
  const lockedItems = ctx.locked.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const slots = assignSlots(lockedItems);
  const used = new Set(lockedItems.map((i) => i.id));
  const filled = new Set(slots.values());
  const blocked = new Set<Slot>([...filled].flatMap((s) => SLOT_CONFLICTS[s] ?? []));
  let score = 0;

  const take = (slot: Slot, pick?: { item: EngineItem; score: number }) => {
    if (!pick) return;
    slots.set(pick.item.id, slot);
    used.add(pick.item.id);
    filled.add(slot);
    for (const s of SLOT_CONFLICTS[slot] ?? []) blocked.add(s);
    score += pick.score;
  };
  const open = (slot: Slot) => !filled.has(slot) && !blocked.has(slot);

  // Core: a dress, or a top + bottom. Compare the best of each when free to choose.
  if (open('dress') && open('top') && open('bottom')) {
    const dress = bestFor(ctx, 'dress', used);
    const bottom = bestFor(ctx, 'bottom', used);
    const top = bottom ? bestFor(ctx, 'top', new Set([...used, bottom.item.id])) : undefined;
    const separates = bottom && top ? (bottom.score + top.score) / 2 : -Infinity;
    if (dress && dress.score > separates) take('dress', dress);
    else {
      take('bottom', bottom);
      take('top', top);
    }
  } else {
    for (const s of ['bottom', 'top', 'dress'] as Slot[]) if (open(s)) take(s, bestFor(ctx, s, used));
  }

  if (ctx.group.occasion === 'beach' && open('swimwear')) take('swimwear', bestFor(ctx, 'swimwear', used));
  if (open('shoes')) take('shoes', bestFor(ctx, 'shoes', used));

  // Outerwear: needed for warmth, or for rain.
  const w = ctx.day.weather;
  if (w && open('outerwear')) {
    const needs = warmthNeeds(w);
    const pick = bestFor(ctx, 'outerwear', used);
    const rainy = isRainy(w);
    if (pick) {
      const warmEnough = needs.outerwearMin != null && pick.item.warmth >= needs.outerwearMin - 1;
      const rainReady = rainy && pick.item.weatherTags.includes('rain-ready');
      if (needs.outerwearMin != null || rainReady || (rainy && warmEnough)) take('outerwear', pick);
    }
  }

  // Optional accessory, only when it clearly earns its place.
  if (open('accessory')) {
    const acc = bestFor(ctx, 'accessory', used);
    if (acc && acc.score >= ACCESSORY_MIN_SCORE) take('accessory', acc);
  }

  const itemIds = [...slots.entries()]
    .sort((a, b) => SLOT_ORDER.indexOf(a[1]) - SLOT_ORDER.indexOf(b[1]))
    .map(([id]) => id);
  return { itemIds, score };
}

// ---------------------------------------------------------------------------
// Explanations and gaps

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listNames(items: EngineItem[]): string {
  const names = items.map((i) => i.name.toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Short human-readable "why" for an outfit. */
export function explainOutfit(
  items: EngineItem[],
  day: EngineDay,
  group: OccasionGroup,
  itemIds: number[],
  usage: Map<number, number> = new Map(),
  formatTemp: (c: number) => string = defaultFormat,
): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const chosen = itemIds.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const parts: string[] = [];
  const w = day.weather;

  if (w) {
    const needs = warmthNeeds(w);
    let s = `${capitalize(needs.band)} day (${formatTemp(w.high)} / ${formatTemp(w.low)})`;
    if (isRainy(w)) s += `, ${Math.round(w.precipChance)}% chance of rain`;
    parts.push(`${s}.`);
    const outer = chosen.find((i) => i.category === 'outerwear');
    if (needs.outerwearMin != null && outer) parts.push(`${capitalize(outer.name.toLowerCase())} (warmth ${outer.warmth}) for the chill.`);
    else if (needs.band === 'hot' || needs.band === 'warm') {
      if (chosen.some((i) => i.warmth <= 2 && i.category !== 'accessory')) parts.push('Light layers to stay cool.');
    }
    if (isRainy(w)) {
      const rain = chosen.filter((i) => i.weatherTags.includes('rain-ready'));
      if (rain.length) parts.push(`${capitalize(listNames(rain))} ${rain.length > 1 ? 'keep' : 'keeps'} you dry.`);
    }
  } else {
    parts.push('No weather yet, so this is based on activities only.');
  }

  const formality = requiredFormality(group.activities);
  const suited = chosen.filter((i) => i.activities.some((a) => group.activities.includes(a)));
  if (FORMALITY_RANK[formality] > 0) parts.push(`${capitalize(formality)} enough for ${group.activities.filter((a) => ['business', 'dinner out', 'nightlife'].includes(a)).join(' and ')}.`);
  else if (suited.length) parts.push(`Picked for ${group.activities.join(', ')}.`);

  const favorites = chosen.filter((i) => (i.favorite ?? 0) >= 4);
  if (favorites.length) parts.push(`Includes your favorite${favorites.length > 1 ? 's' : ''}: ${listNames(favorites)}.`);

  const reused = chosen.filter((i) => (usage.get(i.id) ?? 0) > 0).length;
  if (reused) parts.push(`Reuses ${reused} item${reused > 1 ? 's' : ''} already in your bag.`);
  return parts.join(' ');
}

/** Things the closet can't cover for one outfit on this day. */
export function detectGaps(
  items: EngineItem[],
  day: EngineDay,
  itemIds: number[],
  group: OccasionGroup,
  formatTemp: (c: number) => string = defaultFormat,
): string[] {
  const gaps: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const label = `Day ${day.index}`;
  const chosen = itemIds.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const fills = (slot: Slot) => chosen.some((i) => CATEGORY_SLOTS[i.category].includes(slot));
  const w = day.weather;

  if (!fills('shoes')) gaps.push(items.some((i) => i.category === 'shoes') ? `No shoes in this outfit for ${label}.` : 'No shoes in your closet.');
  if (!fills('dress') && !(fills('top') && fills('bottom'))) gaps.push(`Missing a top/bottom or dress for a complete outfit on ${label}.`);

  if (w) {
    if (isRainy(w)) {
      const rainOuter = items.some((i) => i.category === 'outerwear' && i.weatherTags.includes('rain-ready'));
      const rainShoes = items.some((i) => i.category === 'shoes' && i.weatherTags.includes('rain-ready'));
      if (!rainOuter && !rainShoes) gaps.push(`No rain-ready outerwear or shoes for ${label} (${Math.round(w.precipChance)}% chance of rain).`);
      else if (!rainOuter) gaps.push(`No rain-ready outerwear for ${label} (${Math.round(w.precipChance)}% chance of rain); relying on rain-ready shoes.`);
    }
    const needs = warmthNeeds(w);
    if (needs.outerwearMin != null) {
      const outer = chosen.find((i) => i.category === 'outerwear');
      if (!outer || outer.warmth < needs.outerwearMin) {
        gaps.push(`No outerwear warm enough for ${label} (low ${formatTemp(w.low)}; needs warmth ${needs.outerwearMin}+).`);
      }
    }
  }

  const acts = group.activities;
  if (acts.includes('beach') && !items.some((i) => i.category === 'swimwear')) gaps.push(`No swimwear for the beach on ${label}.`);
  const req = requiredFormality(acts);
  if (FORMALITY_RANK[req] > 0) {
    const enough = (cat: string[]) => items.some((i) => cat.includes(i.category) && FORMALITY_RANK[i.formality] >= FORMALITY_RANK[req]);
    if (!enough(['top', 'dress']) || !enough(['bottom', 'dress']) || !enough(['shoes'])) {
      gaps.push(`Not enough ${req} pieces for ${acts.filter((a) => ['business', 'dinner out', 'nightlife'].includes(a)).join(' and ')} on ${label}.`);
    }
  }
  if (acts.includes('hiking') && !items.some((i) => i.category === 'shoes' && i.activities.includes('hiking'))) {
    gaps.push(`No hiking-suitable shoes for ${label}.`);
  }
  return [...new Set(gaps)];
}

/** Count planned wears per item across outfits. */
export function countWears(outfits: { itemIds: number[] }[]): Map<number, number> {
  const usage = new Map<number, number>();
  for (const o of outfits) for (const id of o.itemIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  return usage;
}

/** Items planned for more wears than copies × wears-before-washing allow. */
export function capacityGaps(items: EngineItem[], outfits: { itemIds: number[] }[]): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const gaps: string[] = [];
  for (const [id, wears] of countWears(outfits)) {
    const item = byId.get(id);
    if (!item || wears <= capacity(item)) continue;
    gaps.push(
      `${item.name}: planned for ${wears} wears, but ${item.quantity} owned × ${item.wearCount} wear${item.wearCount > 1 ? 's' : ''} before washing = ${capacity(item)}. Pack more, swap some days, or plan laundry.`,
    );
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Suggesting outfits

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Up to `count` distinct options for a single outfit. */
export function suggestOptions(req: SuggestRequest, count = 2): SuggestedOutfit[] {
  const { items, day, locked = [], usage = new Map(), previousOutfits = [], seed = 0, formatTemp } = req;
  const activities = req.activities?.length ? req.activities : day.activities;
  const group = occasionFor(activities);
  const jitter = makeJitter(seed + day.index * 7919);
  const options: SuggestedOutfit[] = [];
  const avoid = new Set<number>();

  for (let n = 0; n < count; n++) {
    const base: BuildContext = { items, day, group, locked, usage, avoid: new Set(avoid), exclude: new Set(), jitter };
    let built = buildOutfit(base);
    let note = '';

    // Never repeat yesterday's exact outfit: swap the cheapest unlocked item.
    if (previousOutfits.some((p) => sameSet(p, built.itemIds))) {
      let best: Built | undefined;
      for (const id of built.itemIds) {
        if (locked.includes(id)) continue;
        const alt = buildOutfit({ ...base, exclude: new Set([id]) });
        if (previousOutfits.some((p) => sameSet(p, alt.itemIds))) continue;
        if (!best || alt.score > best.score) best = alt;
      }
      if (best) built = best;
      else note = ' Same as the previous day: not enough alternatives in your closet.';
    }

    if (!built.itemIds.length || options.some((o) => sameSet(o.itemIds, built.itemIds))) break;
    const byId = new Map(items.map((i) => [i.id, i]));
    const over = built.itemIds
      .map((id) => byId.get(id)!)
      .filter((i) => (usage.get(i.id) ?? 0) + 1 > capacity(i))
      .map((i) => `No clean ${i.name.toLowerCase()} left: all ${capacity(i)} wear${capacity(i) > 1 ? 's' : ''} (${i.quantity} owned × ${i.wearCount}) are already planned.`);
    options.push({
      label: activities.join(', '),
      activities,
      itemIds: built.itemIds,
      rationale: explainOutfit(items, day, group, built.itemIds, usage, formatTemp) + note,
      gaps: [...detectGaps(items, day, built.itemIds, group, formatTemp), ...over],
    });
    built.itemIds.forEach((id) => !locked.includes(id) && avoid.add(id));
  }
  return options;
}

/**
 * Plan days in date order: one outfit per occasion (e.g. hiking by day,
 * dinner in the evening), sharing items across days while clean wears remain.
 */
export function planTrip(items: EngineItem[], days: EngineDay[], opts: PlanOptions = {}): DayPlan[] {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const usage = new Map(opts.usage ?? []);
  let previousOutfits: number[][] = [];
  return ordered.map((day) => {
    const outfits = outfitTargets(day.activities).map((target) => {
      const [best] = suggestOptions(
        { items, day, activities: target.group.activities, usage, previousOutfits, seed: opts.seed, formatTemp: opts.formatTemp },
        1,
      );
      const outfit = best ?? { label: target.label, activities: target.group.activities, itemIds: [], rationale: '', gaps: [] };
      outfit.itemIds.forEach((id) => usage.set(id, (usage.get(id) ?? 0) + 1));
      return { ...outfit, label: target.label };
    });
    previousOutfits = outfits.map((o) => o.itemIds);
    return { dayId: day.id, outfits };
  });
}

/**
 * Items that could replace `itemId` in an outfit: same slot, not already in
 * the outfit, best first for this day (and with clean wears left).
 */
export function swapCandidates(
  items: EngineItem[],
  day: EngineDay,
  activities: Activity[],
  outfitItemIds: number[],
  itemId: number,
  usage: Map<number, number> = new Map(),
): EngineItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const outfitItems = outfitItemIds.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const slot = assignSlots(outfitItems).get(itemId);
  if (!slot) return [];
  const ctx: BuildContext = { items, day, group: occasionFor(activities), locked: [], usage, avoid: new Set(), exclude: new Set(), jitter: () => 0 };
  const sctx = scoreContext(ctx, slot);
  return items
    .filter((i) => !outfitItemIds.includes(i.id) && CATEGORY_SLOTS[i.category].includes(slot))
    .map((i) => ({ i, s: scoreItem(i, sctx) }))
    .sort((a, b) => b.s - a.s)
    .map(({ i }) => i);
}

/**
 * Rank outfits saved in the closet by how well they suit this day: the
 * average item score for the weather and activities, plus a bonus for
 * outfits marked favorite. Best first.
 */
export function rankSavedOutfits(
  items: EngineItem[],
  day: EngineDay,
  activities: Activity[],
  saved: { id: number; name: string; favorite: boolean; itemIds: number[] }[],
  usage: Map<number, number> = new Map(),
  formatTemp: (c: number) => string = defaultFormat,
): RankedSavedOutfit[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const group = occasionFor(activities.length ? activities : day.activities);
  const ctx: BuildContext = { items, day, group, locked: [], usage, avoid: new Set(), exclude: new Set(), jitter: () => 0 };
  return saved
    .map((o) => {
      const outfitItems = o.itemIds.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
      const slots = assignSlots(outfitItems);
      const fit = outfitItems.length
        ? outfitItems.reduce((n, i) => n + scoreItem(i, scoreContext(ctx, slots.get(i.id)!)), 0) / outfitItems.length + (o.favorite ? 2 : 0)
        : -Infinity;
      const ids = outfitItems.map((i) => i.id);
      return {
        savedOutfitId: o.id,
        name: o.name,
        favorite: o.favorite,
        itemIds: ids,
        fit: Math.round(fit * 10) / 10,
        rationale: explainOutfit(items, day, group, ids, usage, formatTemp),
        gaps: detectGaps(items, day, ids, group, formatTemp),
      };
    })
    .filter((r) => r.itemIds.length > 0)
    .sort((a, b) => b.fit - a.fit || a.gaps.length - b.gaps.length);
}

export const rulesEngine: OutfitEngine = { suggestOptions, planTrip };
