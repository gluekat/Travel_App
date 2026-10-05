export const CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
  'swimwear',
  'activewear',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FORMALITIES = ['casual', 'smart casual', 'formal'] as const;
export type Formality = (typeof FORMALITIES)[number];

export const WEATHER_TAGS = ['rain-ready', 'sun', 'cold', 'hot'] as const;
export type WeatherTag = (typeof WEATHER_TAGS)[number];

export const ACTIVITIES = [
  'sightseeing',
  'hiking',
  'beach',
  'dinner out',
  'business',
  'travel day',
  'nightlife',
  'workout',
  'lounging',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

export type WarmthLevel = 1 | 2 | 3 | 4 | 5;

export interface ClosetItem {
  id?: number;
  name: string;
  category: Category;
  color: string;
  warmth: WarmthLevel;
  formality: Formality;
  weatherTags: WeatherTag[];
  activities: Activity[];
  photo?: Blob;
  isSample: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Trip {
  id?: number;
  destination: string;
  /** Display name returned by geocoding, e.g. "Lisbon, Portugal". */
  placeLabel?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: number;
}

/** How a day's weather was obtained. "cached" is a display state, not stored. */
export type WeatherSource = 'forecast' | 'historical' | 'manual';

export interface DayWeather {
  high: number; // °C
  low: number; // °C
  precipChance: number; // 0-100
  code?: number; // WMO weather code
  condition: string;
  source: WeatherSource;
  fetchedAt: number;
}

export interface TripDay {
  id?: number;
  tripId: number;
  date: string; // YYYY-MM-DD
  activities: Activity[];
  weather?: DayWeather;
}

export interface Outfit {
  id?: number;
  tripId: number;
  tripDayId: number;
  rank: number; // 0 = primary suggestion, 1 = second occasion or alternate
  /** e.g. "Daytime: sightseeing", "Evening: dinner out", "Alternative". */
  label: string;
  itemIds: number[];
  lockedItemIds: number[];
  rationale: string;
  /** Selected outfits feed the packing list. */
  selected: boolean;
}

export interface PackingItem {
  id?: number;
  tripId: number;
  itemId?: number;
  customLabel?: string;
  packed: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type TempUnit = 'F' | 'C';
