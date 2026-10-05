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
  itemIds: number[];
  lockedItemIds: number[];
  rationale: string;
  selected: boolean;
}

export interface DayPlan {
  dayId: number;
  outfits: SuggestedOutfit[];
  gaps: string[];
}

export interface PlanOptions {
  /** Changes tie-breaking so "regenerate" gives a different but reproducible result. */
  seed?: number;
  /** Locked item ids per day id, per outfit rank. */
  locks?: Record<number, number[][]>;
  /** Format a °C value for messages; defaults to "12°C". */
  formatTemp?: (c: number) => string;
}

export interface OutfitEngine {
  planTrip(items: EngineItem[], days: EngineDay[], opts?: PlanOptions): DayPlan[];
}
