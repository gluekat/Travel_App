export const CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'one-piece',
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

export const WEATHER_TAGS = ['rain-ready', 'sun', 'hot', 'warm', 'mild', 'cool', 'chilly', 'cold', 'snow', 'windy'] as const;
export type WeatherTag = (typeof WEATHER_TAGS)[number];

export const ACTIVITIES = [
  'sightseeing',
  'hiking',
  'beach',
  'dinner out',
  'business',
  'work',
  'travel day',
  'nightlife',
  'workout',
  'lounging',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** 1 (very light) to 5 (very warm); 0 means not applicable (e.g. jewelry, a belt). */
export type WarmthLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const ACCESSORY_TYPES = ['hat', 'scarf', 'gloves', 'belt', 'purse', 'bag', 'jewelry', 'other'] as const;
export type AccessoryType = (typeof ACCESSORY_TYPES)[number];

export const SUBCATEGORIES = ['top', 'bottom', 'one-piece', 'shoes', 'accessories'] as const;
export type Subcategory = (typeof SUBCATEGORIES)[number];

/** Categories that support a type distinction (top/bottom/one-piece, and for some also shoes/accessories). */
export const SUBCATEGORY_CATEGORIES: Category[] = ['activewear', 'underwear', 'pajamas'];

/** Type options offered for a category; pajamas and activewear can also be shoes or accessories. */
export function subcategoriesFor(category: Category): Subcategory[] {
  if (category === 'pajamas' || category === 'activewear') return [...SUBCATEGORIES];
  if (category === 'underwear') return ['top', 'bottom', 'one-piece'];
  return [];
}

export interface ClosetItem {
  id?: number;
  name: string;
  category: Category;
  /** For activewear, underwear, and pajamas: 'top' | 'bottom' | 'one-piece'. */
  subcategory?: Subcategory;
  /** For accessories: hat, scarf, gloves, belt, purse, bag, jewelry… */
  accessoryType?: AccessoryType;
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
  /** Optional details. */
  size?: string;
  material?: string;
  notes?: string;
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
  /** The single free-text note (replaces the separate weather and packing notes below). */
  general?: string;
  /** @deprecated Older notes: shown together in `general` and cleared when it is saved. */
  weather?: string;
  /** @deprecated See `weather`. */
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
  /** Closet items whose "may not suit the forecast" warning the user cleared for this trip. */
  dismissedForecast?: number[];
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
  /** Rounded "lat,lon" the weather was fetched for, so it can be refreshed when the day's location changes. */
  placeKey?: string;
}

export interface TripDay {
  id?: number;
  tripId: number;
  date: string; // YYYY-MM-DD
  activities: Activity[];
  weather?: DayWeather;
  /** On days travelling between places: the weather where the day starts (`weather` is where it ends). */
  weatherFrom?: DayWeather;
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
  /** True for outfits created with "Sleepwear": only pajamas items are suggested for them. */
  sleepwear?: boolean;
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

export const GENERAL_CATEGORIES = [
  'Toiletries',
  'Electronics',
  'Medications',
  'Make-Up',
  'Hair Supplies',
  'Documents & Money',
  'Clothing Basics',
  'Health & Safety',
  'Entertainment',
  'Outdoor & Gear',
  'Other',
] as const;
export type GeneralCategory = (typeof GENERAL_CATEGORIES)[number];

/** Best-guess category from an item's name, e.g. "Phone charger" → Electronics. */
export function guessGeneralCategory(name: string): GeneralCategory {
  const n = name.toLowerCase();
  const rules: [GeneralCategory, RegExp][] = [
    ['Electronics', /charger|cable|adapter|battery|power bank|phone|laptop|tablet|camera|headphone|earbud|kindle|e-?reader|watch/],
    ['Medications', /medic|pill|vitamin|prescription|allerg|ibuprofen|aspirin|inhaler|meds?/],
    ['Make-Up', /make-?up|mascara|lipstick|foundation|concealer|eyeliner|cosmetic|blush|nail/],
    ['Hair Supplies', /hair|shampoo|conditioner|brush|comb|curling|straighten|flat iron|dryer|bobby|scrunchie/],
    ['Toiletries', /toiletr|toothbrush|toothpaste|floss|deodorant|soap|razor|shav|sunscreen|lotion|moisturi|cleanser|perfume|cologne|tissue|contacts|lip balm|body wash/],
    ['Documents & Money', /passport|id|license|visa|ticket|boarding|wallet|cash|credit|insurance|itinerary|document/],
    ['Health & Safety', /first aid|bandage|sanitizer|mask|thermometer|repellent|bug spray/],
    ['Clothing Basics', /underwear|socks|jacket|coat|pajama|bra|undershirt|belt|hat|scarf|gloves|swim/],
    ['Entertainment', /book|game|cards|journal|notebook|pen|puzzle|magazine/],
    ['Outdoor & Gear', /tent|sleeping|flashlight|headlamp|water bottle|backpack|umbrella|towel|snorkel|cooler|lock|luggage/],
  ];
  return rules.find(([, re]) => re.test(n))?.[0] ?? 'Other';
}

/** The item's category, guessed from its name when none was chosen. */
export function generalCategory(item: { name: string; category?: string }): GeneralCategory {
  return (GENERAL_CATEGORIES as readonly string[]).includes(item.category ?? '') ? (item.category as GeneralCategory) : guessGeneralCategory(item.name);
}

/** Sort key: category order (Other last), then name. */
export function compareGeneral(a: { category: string; name: string }, b: { category: string; name: string }): number {
  const ia = GENERAL_CATEGORIES.indexOf(a.category as GeneralCategory);
  const ib = GENERAL_CATEGORIES.indexOf(b.category as GeneralCategory);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name);
}

/**
 * A reusable general packing item (chargers, toiletries…) kept in the closet.
 * Items with isDefault are added to the packing list of every new trip.
 */
export interface GeneralItem {
  id?: number;
  name: string;
  /** Fixed quantity (ignored when perDay is set). */
  qty?: number;
  /** Quantity per trip day, e.g. underwear = 1 per day. */
  perDay?: number;
  /** The "Default" tag: automatically added to every new trip's packing list. */
  isDefault: boolean;
  /** Activity-type and custom tags, e.g. "beach", "camping". */
  tags: string[];
  /** Category (Toiletries, Electronics…); items without one are treated as guessed from the name. */
  category?: GeneralCategory;
  /** Optional emoji shown next to the name. */
  emoji?: string;
  /** Optional photo shown next to the name (takes precedence over the emoji). */
  photo?: Blob;
  createdAt: number;
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
  arriveDate?: string; // YYYY-MM-DD — defaults to the previous departure day (next day if the time wraps)
  depart?: string;     // HH:mm — departure from this connection point
  departDate?: string; // YYYY-MM-DD — defaults to the arrival day (next day if the time wraps)
  carrier?: string;    // airline / operator of the next leg (defaults to the booking's carrier)
  identifier?: string; // next flight #, next train # (not used for boat)
  lat?: number;
  lon?: number;
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
  fromLat?: number;
  fromLon?: number;
  toPoint?: string;
  toLat?: number;
  toLon?: number;
  carrier?: string;           // airline, train operator, or cruise line
  identifier?: string;        // flight #, train #, or ship name
  bookingRef?: string;
  distanceMiles?: number;
  travelTimeMinutes?: number;
  connections?: TransportConnection[];
  notes?: string;
  /** Set when the trip's dates changed and this entry was not updated to match; cleared when edited or dismissed. */
  needsAttention?: string;
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
  /** Set when the trip's dates changed and this stay was not updated to match; cleared when edited or dismissed. */
  needsAttention?: string;
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

/** How long deleted trips and items stay in the trash before being removed for good. */
export const TRASH_DAYS = 30;

export interface TripSnapshot {
  trip: Trip;
  days: TripDay[];
  outfits: Outfit[];
  packingItems: PackingItem[];
  transport: TransportLeg[];
  activities: ScheduledActivity[];
  lodging: TripLodging[];
}

/** A closet item plus where it was used, so restoring puts it back into those outfits and lists. */
export interface ClosetItemSnapshot {
  item: ClosetItem;
  savedOutfitIds: number[];
  outfits: { id: number; locked: boolean }[];
  packingItems: PackingItem[];
}

export type TrashEntry =
  | { id?: number; kind: 'trip'; name: string; deletedAt: number; data: TripSnapshot }
  | { id?: number; kind: 'closetItem'; name: string; deletedAt: number; data: ClosetItemSnapshot }
  | { id?: number; kind: 'generalItem'; name: string; deletedAt: number; data: { item: GeneralItem } };
