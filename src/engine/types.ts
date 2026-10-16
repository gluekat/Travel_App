/**
 * Contract for the outfit engine. Everything here is plain data so the
 * rules-based implementation can later be replaced (e.g. by an LLM) without
 * touching the UI or the database layer. No photos or other heavy fields.
 */
import type { Activity, Category, Formality, WarmthLevel, WeatherTag } from '../db/types';

export interface EngineItem {
  id: number;
  name: string;
  category: Category;
  color: string;
  warmth: WarmthLevel;
  formality: Formality;
  weatherTags: WeatherTag[];
  activities: Activity[];
  /** Copies owned. */
  quantity: number;
  /** Wears per copy before washing. */
  wearCount: number;
  /** Preference 0-5; higher scores are suggested more. */
  favorite: number;
}

export interface EngineWeather {
  high: number; // °C
  low: number; // °C
  precipChance: number; // 0-100
}

export interface EngineDay {
  id: number;
  /** 1-based position in the trip, used in messages ("Day 3"). */
  index: number;
  date: string;
  activities: Activity[];
  weather?: EngineWeather;
}

export interface SuggestedOutfit {
  label: string;
  activities: Activity[];
  itemIds: number[];
  rationale: string;
  /** Problems this suggestion couldn't solve with the closet. */
  gaps: string[];
}

export interface SuggestRequest {
  items: EngineItem[];
  day: EngineDay;
  /** What the outfit is for (defaults to the day's activities). */
  activities?: Activity[];
  /** Items that must stay in the outfit. */
  locked?: number[];
  /** Wears already planned for each item in the rest of the trip. */
  usage?: Map<number, number>;
  /** Outfits worn the previous day, to avoid exact repeats. */
  previousOutfits?: number[][];
  /** Changes tie-breaking so "show other options" differs but is reproducible. */
  seed?: number;
  /** Format a °C value for messages; defaults to "12°C". */
  formatTemp?: (c: number) => string;
}

/** A closet-saved outfit, ranked for how well it fits a day. */
export interface RankedSavedOutfit {
  savedOutfitId: number;
  name: string;
  favorite: boolean;
  itemIds: number[];
  /** Average fit of its items for the day (higher is better). */
  fit: number;
  rationale: string;
  gaps: string[];
}

export interface DayPlan {
  dayId: number;
  outfits: SuggestedOutfit[];
}

export interface PlanOptions {
  seed?: number;
  formatTemp?: (c: number) => string;
  /** Wears already planned by outfits outside the days being planned. */
  usage?: Map<number, number>;
}

export interface OutfitEngine {
  /** Up to `count` distinct options for one outfit. */
  suggestOptions(req: SuggestRequest, count?: number): SuggestedOutfit[];
  /** One outfit per occasion for each day (used by "fill empty days"). */
  planTrip(items: EngineItem[], days: EngineDay[], opts?: PlanOptions): DayPlan[];
}
