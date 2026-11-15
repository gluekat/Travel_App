export const CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
  'swimwear',
  'activewear',
  'underwear',
  'pajamas',
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

export const SUBCATEGORIES = ['top', 'bottom', 'one-piece'] as const;
export type Subcategory = (typeof SUBCATEGORIES)[number];

/** Categories that support a top/bottom/one-piece distinction. */
export const SUBCATEGORY_CATEGORIES: Category[] = ['activewear', 'underwear', 'pajamas'];

export interface ClosetItem {
  id?: number;
  name: string;
  category: Category;
  /** For activewear, underwear, and pajamas: 'top' | 'bottom' | 'one-piece'. */
  subcategory?: Subcategory;
  color: string;
  warmth: WarmthLevel;
  formality: Formality;
  weatherTags: WeatherTag[];
  activities: Activity[];
  /** How many identical copies you own (e.g. 5 pairs of white socks). */
  quantity: number;
  /** How many times one copy can be worn before it needs washing. */
  wearCount: number;
  /** If true, wearCount is ignored — item never triggers an over-worn warning. */
  unlimitedWear?: boolean;
  /** How much you like wearing it, 0 (neutral) to 5. Suggestions favour higher scores. */
  favorite: number;
  /** Your own labels, e.g. "packable", "wrinkle-free". */
  customTags: string[];
  photo?: Blob;
  isSample: boolean;
  createdAt: number;
  updatedAt: number;
}

/** One destination stop on a multi-city trip (e.g. a cruise port). */
export interface TripStop {
  label: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface TripNotes {
  /** Free-text general weather summary, e.g. "Hot and humid, afternoon thunderstorms". */
  weather?: string;
  /** Free-text packing reminders, e.g. "Bring a rain jacket; smart dress code for restaurants". */
  packingAlerts?: string;
}

export interface Trip {
  id?: number;
  /** Optional user-defined name, e.g. "Summer holiday". Falls back to placeLabel ?? destination when absent. */
  name?: string;
  destination: string;
  /** Display name returned by geocoding, e.g. "Lisbon, Portugal". */
  placeLabel?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: number;
  notes?: TripNotes;
  /** For multi-destination trips (e.g. cruises): ordered stops with individual date ranges. */
  stops?: TripStop[];
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
  laundryDay?: boolean;
  laundryItems?: number[]; // ClosetItem IDs to wash
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

/** An outfit saved in the closet for reuse across trips. */
export interface SavedOutfit {
  id?: number;
  name: string;
  itemIds: number[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
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

export type TransportMode = 'drive' | 'fly' | 'train' | 'boat';

/** A connecting leg, layover, or port stop within a transport leg. */
export interface TransportConnection {
  point: string;       // airport code/name, station, or port
  arrive?: string;     // HH:mm — arrival at this connection point
  depart?: string;     // HH:mm — departure from this connection point
  identifier?: string; // next flight #, next train # (not used for boat)
}

export interface TransportLeg {
  id?: number;
  tripId: number;
  direction: 'outbound' | 'return';
  mode: TransportMode;
  departureDate: string;      // YYYY-MM-DD
  departureTime?: string;     // HH:mm
  arrivalDate?: string;       // YYYY-MM-DD
  arrivalTime?: string;       // HH:mm
  fromPoint?: string;         // city, airport code, station, or port
  toPoint?: string;
  carrier?: string;           // airline, train operator, or cruise line
  identifier?: string;        // flight #, train #, or ship name
  bookingRef?: string;
  distanceMiles?: number;
  travelTimeMinutes?: number;
  connections?: TransportConnection[];
  notes?: string;
  createdAt: number;
}

/** Home address stored in settings for pre-filling transport from/to. */
export interface HomeLocation {
  label: string;
  lat: number;
  lon: number;
}

export interface TripLodging {
  id?: number;
  tripId: number;
  name: string;             // "Marriott Opera Grand"
  location?: string;        // full address string
  locationLat?: number;
  locationLon?: number;
  checkInDate: string;      // YYYY-MM-DD
  checkInTime?: string;     // HH:mm
  checkOutDate: string;     // YYYY-MM-DD
  checkOutTime?: string;    // HH:mm
  confirmationNumber?: string;
  phone?: string;
  notes?: string;
  createdAt: number;
}

export interface ScheduledActivity {
  id?: number;
  tripId: number;
  tripDayId: number;
  name: string;
  category?: string;
  startTime?: string;      // HH:mm
  endTime?: string;        // HH:mm
  durationMinutes?: number;
  location?: string;
  notes?: string;
  outfitId?: number;       // linked outfit for this activity
  createdAt: number;
}
