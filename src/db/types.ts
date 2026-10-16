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
  /** How many identical copies you own (e.g. 5 pairs of white socks). */
  quantity: number;
  /** How many times one copy can be worn before it needs washing. */
  wearCount: number;
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

/** One outfit the user is wearing on a trip day. A day can have several. */
export interface Outfit {
  id?: number;
  tripId: number;
  tripDayId: number;
  /** Display order within the day. */
  rank: number;
  /** e.g. "Outfit 1", "Daytime: sightseeing", "Dinner". */
  label: string;
  /** Activities this outfit is for; undefined = all of the day's activities. */
  activities?: Activity[];
  itemIds: number[];
  /** Items kept when asking for a new suggestion. */
  lockedItemIds: number[];
  /** "Why" text from the last applied suggestion; empty once edited by hand. */
  rationale: string;
}

/**
 * A packing-list row. Either a closet item (itemId; the number of copies is
 * derived from the outfits) or a general item (customLabel + quantity).
 */
export interface PackingItem {
  id?: number;
  tripId: number;
  itemId?: number;
  customLabel?: string;
  /** General items: fixed quantity (ignored when perDay is set). */
  qty?: number;
  /** General items: quantity per trip day, e.g. underwear = 1 per day. */
  perDay?: number;
  packed: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type TempUnit = 'F' | 'C';
