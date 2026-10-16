import { db, deleteClosetItem } from './schema';
import type { ClosetItem } from './types';

type SeedItem = Omit<ClosetItem, 'id' | 'isSample' | 'createdAt' | 'updatedAt' | 'quantity' | 'wearCount' | 'favorite' | 'customTags'> &
  Partial<Pick<ClosetItem, 'quantity' | 'wearCount' | 'favorite' | 'customTags'>>;

/** Typical wears before washing, by category, for the sample wardrobe. */
const SAMPLE_WEARS: Record<ClosetItem['category'], number> = {
  top: 1,
  bottom: 3,
  dress: 1,
  outerwear: 10,
  shoes: 10,
  accessory: 10,
  swimwear: 3,
  activewear: 2,
};

export const SAMPLE_WARDROBE: SeedItem[] = [
  { name: 'White linen shirt', quantity: 2, category: 'top', color: 'white', warmth: 1, formality: 'smart casual', weatherTags: ['hot', 'sun'], activities: ['sightseeing', 'dinner out', 'beach'] },
  { name: 'Navy crew tee', quantity: 3, category: 'top', color: 'navy', warmth: 1, formality: 'casual', weatherTags: ['hot', 'sun'], activities: ['sightseeing', 'hiking', 'travel day', 'lounging'] },
  { name: 'Grey merino sweater', favorite: 4, customTags: ['wrinkle-free'], category: 'top', color: 'grey', warmth: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out', 'travel day', 'business'] },
  { name: 'Oxford button-down', category: 'top', color: 'light blue', warmth: 2, formality: 'formal', weatherTags: [], activities: ['business', 'dinner out'] },
  { name: 'Dark jeans', category: 'bottom', color: 'indigo', warmth: 3, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out', 'travel day', 'nightlife'] },
  { name: 'Khaki shorts', category: 'bottom', color: 'khaki', warmth: 1, formality: 'casual', weatherTags: ['hot', 'sun'], activities: ['sightseeing', 'beach', 'lounging'] },
  { name: 'Wool trousers', category: 'bottom', color: 'charcoal', warmth: 3, formality: 'formal', weatherTags: ['cold'], activities: ['business', 'dinner out'] },
  { name: 'Hiking pants', category: 'activewear', color: 'olive', warmth: 2, formality: 'casual', weatherTags: ['rain-ready'], activities: ['hiking', 'workout'] },
  { name: 'Summer sundress', category: 'dress', color: 'yellow', warmth: 1, formality: 'smart casual', weatherTags: ['hot', 'sun'], activities: ['sightseeing', 'dinner out', 'beach'] },
  { name: 'Packable rain jacket', favorite: 4, customTags: ['packable'], category: 'outerwear', color: 'teal', warmth: 2, formality: 'casual', weatherTags: ['rain-ready'], activities: ['sightseeing', 'hiking', 'travel day'] },
  { name: 'Puffer jacket', category: 'outerwear', color: 'black', warmth: 5, formality: 'casual', weatherTags: ['cold'], activities: ['sightseeing', 'hiking', 'travel day'] },
  { name: 'White sneakers', favorite: 5, category: 'shoes', color: 'white', warmth: 2, formality: 'smart casual', weatherTags: ['sun'], activities: ['sightseeing', 'travel day', 'dinner out', 'nightlife'] },
  { name: 'Waterproof hiking boots', category: 'shoes', color: 'brown', warmth: 3, formality: 'casual', weatherTags: ['rain-ready', 'cold'], activities: ['hiking', 'sightseeing'] },
  { name: 'Sandals', category: 'shoes', color: 'tan', warmth: 1, formality: 'casual', weatherTags: ['hot', 'sun'], activities: ['beach', 'lounging', 'sightseeing'] },
  { name: 'Leather loafers', category: 'shoes', color: 'brown', warmth: 2, formality: 'formal', weatherTags: [], activities: ['business', 'dinner out'] },
  { name: 'Swim trunks', category: 'swimwear', color: 'coral', warmth: 1, formality: 'casual', weatherTags: ['hot', 'sun'], activities: ['beach'] },
  { name: 'Sun hat', category: 'accessory', color: 'straw', warmth: 1, formality: 'casual', weatherTags: ['sun', 'hot'], activities: ['beach', 'sightseeing', 'hiking'] },
  { name: 'Wool scarf', category: 'accessory', color: 'burgundy', warmth: 4, formality: 'smart casual', weatherTags: ['cold'], activities: ['sightseeing', 'dinner out'] },
];

export async function seedSampleWardrobe(): Promise<void> {
  const now = Date.now();
  await db.closetItems.bulkAdd(
    SAMPLE_WARDROBE.map((item) => ({
      quantity: 1,
      wearCount: SAMPLE_WEARS[item.category],
      favorite: 0,
      customTags: [],
      ...item,
      isSample: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

/** Seed once, on first run, if the closet is empty. */
export async function seedIfFirstRun(): Promise<void> {
  const seeded = await db.settings.get('seeded');
  if (seeded) return;
  await db.settings.put({ key: 'seeded', value: true });
  if ((await db.closetItems.count()) === 0) await seedSampleWardrobe();
}

export async function clearSampleItems(): Promise<number> {
  const ids = (await db.closetItems.filter((i) => i.isSample).primaryKeys()) as number[];
  for (const id of ids) await deleteClosetItem(id);
  return ids.length;
}
