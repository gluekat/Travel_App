/**
 * Rules-based outfit engine (v1). Pure functions only: no React, no Dexie,
 * no network. See ./types.ts for the swappable contract.
 */
import type { Activity } from '../db/types';
import {
  CATEGORY_SLOTS,
  FORMALITY_RANK,
  SLOT_CONFLICTS,
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
import type { DayPlan, EngineDay, EngineItem, OutfitEngine, PlanOptions, SuggestedOutfit } from './types';

const SLOT_ORDER: Slot[] = ['outerwear', 'top', 'dress', 'swimwear', 'bottom', 'shoes', 'accessory'];
const ACCESSORY_MIN_SCORE = 2.5;

const defaultFormat = (c: number) => `${Math.round(c)}°C`;

// ---------------------------------------------------------------------------
// Occasion per outfit rank

export interface OutfitTarget {
  label: string;
  group: OccasionGroup;
  /** True for the "alternative" second outfit on single-occasion days. */
  alternative: boolean;
}

const OCCASION_LABEL: Record<Occasion, string> = {
  active: 'Active',
  beach: 'Beach',
  everyday: 'Daytime',
  dressy: 'Evening',
};

/** Decide what each of a day's (max two) outfits is for. */
export function outfitTargets(activities: Activity[]): OutfitTarget[] {
  const groups = groupOccasions(activities);
  if (groups.length === 1) {
    const g = groups[0];
    return [
      { label: `Outfit: ${g.activities.join(', ')}`, group: g, alternative: false },
      { label: 'Alternative', group: g, alternative: true },
    ];
  }
  const [first, ...rest] = groups;
  const second: OccasionGroup = {
    occasion: rest[rest.length - 1].occasion,
    activities: rest.flatMap((g) => g.activities),
  };
  return [first, second].map((g) => ({
    label: `${OCCASION_LABEL[g.occasion]}: ${g.activities.join(', ')}`,
    group: g,
    alternative: false,
  }));
}

// ---------------------------------------------------------------------------
// Slot assignment

/** Assign each item in an outfit to a slot (needed for activewear, which can be top or bottom). */
export function assignSlots(items: EngineItem[]): Map<number, Slot> {
  const taken = new Set<Slot>();
  const out = new Map<number, Slot>();
  // Single-slot categories first so activewear takes whatever is left.
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
  reused: Set<number>;
  avoid: Set<number>;
  exclude: Set<number>;
  jitter: (id: number) => number;
}

interface Built {
  itemIds: number[];
  slots: Map<number, Slot>;
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
    reused: ctx.reused,
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

  // Outerwear: needed for warmth, or for rain when the shoes alone aren't rain-ready.
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
  return { itemIds, slots, score };
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
  reused: Set<number> = new Set(),
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
      const light = chosen.filter((i) => i.warmth <= 2 && i.category !== 'accessory');
      if (light.length) parts.push(`Light layers to stay cool.`);
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

  const reusedCount = chosen.filter((i) => reused.has(i.id)).length;
  if (reusedCount) parts.push(`Reuses ${reusedCount} item${reusedCount > 1 ? 's' : ''} from other days.`);
  return parts.join(' ');
}

/** Things the closet can't cover for this day. */
export function detectGaps(
  items: EngineItem[],
  day: EngineDay,
  outfits: { itemIds: number[] }[],
  targets: OutfitTarget[],
  formatTemp: (c: number) => string = defaultFormat,
): string[] {
  const gaps: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const label = `Day ${day.index}`;
  const primary = (outfits[0]?.itemIds ?? []).map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const has = (cat: string) => primary.some((i) => i.category === cat);
  const w = day.weather;

  if (!items.some((i) => i.category === 'shoes')) gaps.push('No shoes in your closet.');
  if (!has('dress') && !(primary.some((i) => CATEGORY_SLOTS[i.category].includes('top')) && primary.some((i) => CATEGORY_SLOTS[i.category].includes('bottom')))) {
    gaps.push(`Not enough tops/bottoms or dresses for a complete outfit on ${label}.`);
  }

  if (w) {
    if (isRainy(w)) {
      const rainOuter = items.some((i) => i.category === 'outerwear' && i.weatherTags.includes('rain-ready'));
      const rainShoes = items.some((i) => i.category === 'shoes' && i.weatherTags.includes('rain-ready'));
      if (!rainOuter && !rainShoes) gaps.push(`No rain-ready outerwear or shoes for ${label} (${Math.round(w.precipChance)}% chance of rain).`);
      else if (!rainOuter) gaps.push(`No rain-ready outerwear for ${label} (${Math.round(w.precipChance)}% chance of rain); relying on rain-ready shoes.`);
    }
    const needs = warmthNeeds(w);
    if (needs.outerwearMin != null) {
      const outer = primary.find((i) => i.category === 'outerwear');
      if (!outer || outer.warmth < needs.outerwearMin) {
        gaps.push(`No outerwear warm enough for ${label} (low ${formatTemp(w.low)}; needs warmth ${needs.outerwearMin}+).`);
      }
    }
  }

  for (const t of targets) {
    if (t.alternative) continue;
    const acts = t.group.activities;
    if (t.group.occasion === 'beach' && !items.some((i) => i.category === 'swimwear')) gaps.push(`No swimwear for the beach on ${label}.`);
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
  }
  return [...new Set(gaps)];
}

// ---------------------------------------------------------------------------
// Planning a day and a trip

export interface DayContext {
  /** Item ids worn on other days (encourages reuse). */
  reused: Set<number>;
  /** Item ids of the previous day's outfits, to avoid exact repeats. */
  previousOutfits: number[][];
  seed: number;
  /** Locked item ids per outfit rank. */
  locks?: number[][];
  formatTemp?: (c: number) => string;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

export function planDay(items: EngineItem[], day: EngineDay, ctx: DayContext): DayPlan {
  const jitter = makeJitter(ctx.seed + day.index * 7919);
  const targets = outfitTargets(day.activities);
  const outfits: SuggestedOutfit[] = [];

  targets.forEach((target, rank) => {
    const locked = ctx.locks?.[rank] ?? [];
    const avoid = new Set<number>(target.alternative && outfits[0] ? outfits[0].itemIds : []);
    const base: BuildContext = { items, day, group: target.group, locked, reused: ctx.reused, avoid, exclude: new Set(), jitter };
    let built = buildOutfit(base);
    let note = '';

    // Never repeat the exact same outfit as yesterday: swap the cheapest unlocked item.
    if (ctx.previousOutfits.some((p) => sameSet(p, built.itemIds))) {
      let best: Built | undefined;
      for (const id of built.itemIds) {
        if (locked.includes(id)) continue;
        const alt = buildOutfit({ ...base, exclude: new Set([id]) });
        if (ctx.previousOutfits.some((p) => sameSet(p, alt.itemIds))) continue;
        if (!best || alt.score > best.score) best = alt;
      }
      if (best) built = best;
      else note = ' Same as the previous day: not enough alternatives in your closet.';
    }

    // Skip an "alternative" that is identical to the primary outfit.
    if (target.alternative && outfits[0] && sameSet(outfits[0].itemIds, built.itemIds)) return;
    if (!built.itemIds.length) return;

    outfits.push({
      label: target.label,
      itemIds: built.itemIds,
      lockedItemIds: locked.filter((id) => built.itemIds.includes(id)),
      rationale: explainOutfit(items, day, target.group, built.itemIds, ctx.reused, ctx.formatTemp) + note,
      selected: !target.alternative,
    });
  });

  return { dayId: day.id, outfits, gaps: detectGaps(items, day, outfits, targets, ctx.formatTemp) };
}

/** Plan every day of a trip in date order, favouring items already chosen for earlier days. */
export function planTrip(items: EngineItem[], days: EngineDay[], opts: PlanOptions = {}): DayPlan[] {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const reused = new Set<number>();
  let previousOutfits: number[][] = [];
  const plans: DayPlan[] = [];
  for (const day of ordered) {
    const plan = planDay(items, day, {
      reused: new Set(reused),
      previousOutfits,
      seed: opts.seed ?? 0,
      locks: opts.locks?.[day.id],
      formatTemp: opts.formatTemp,
    });
    for (const o of plan.outfits) if (o.selected) o.itemIds.forEach((id) => reused.add(id));
    previousOutfits = plan.outfits.map((o) => o.itemIds);
    plans.push(plan);
  }
  return plans;
}

/**
 * Items that could replace `itemId` in an outfit: same slot, not already in
 * the outfit, and never conflicting with locked items. Best first.
 */
export function swapCandidates(items: EngineItem[], day: EngineDay, group: OccasionGroup, outfitItemIds: number[], itemId: number): EngineItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const outfitItems = outfitItemIds.map((id) => byId.get(id)).filter((i): i is EngineItem => !!i);
  const slot = assignSlots(outfitItems).get(itemId);
  if (!slot) return [];
  const ctx: BuildContext = { items, day, group, locked: [], reused: new Set(), avoid: new Set(), exclude: new Set(), jitter: () => 0 };
  const sctx = scoreContext(ctx, slot);
  return items
    .filter((i) => !outfitItemIds.includes(i.id) && CATEGORY_SLOTS[i.category].includes(slot))
    .map((i) => ({ i, s: scoreItem(i, sctx) }))
    .sort((a, b) => b.s - a.s)
    .map(({ i }) => i);
}

export const rulesEngine: OutfitEngine = { planTrip };
