import { db, getSetting, setSetting } from '../../db/schema';
import type { GeneralItem, PackingItem } from '../../db/types';

const STARTER_ITEMS: Pick<GeneralItem, 'name' | 'qty' | 'perDay'>[] = [
  { name: 'Underwear', perDay: 1 },
  { name: 'Socks', perDay: 1 },
  { name: 'Jacket', qty: 1 },
  { name: 'Toiletries', qty: 1 },
];

let seeding: Promise<void> | undefined;

/** First use: fill the general-items list with the starter set, tagged Default. Runs once. */
export function ensureGeneralLibrary(): Promise<void> {
  seeding ??= db
    .transaction('rw', db.generalItems, db.settings, async () => {
      if (await getSetting('generalLibrarySeeded', false)) return;
      if ((await db.generalItems.count()) === 0) {
        const now = Date.now();
        await db.generalItems.bulkAdd(STARTER_ITEMS.map((i) => ({ ...i, isDefault: true, tags: [], createdAt: now })));
      }
      await setSetting('generalLibrarySeeded', true);
    })
    .finally(() => {
      seeding = undefined;
    });
  return seeding;
}

/** Packing-list rows for a new trip: every Default-tagged general item. */
export async function defaultPackingRows(tripId: number): Promise<PackingItem[]> {
  const items = await db.generalItems.filter((i) => i.isDefault).toArray();
  return items.map((i) => ({
    tripId,
    customLabel: i.name,
    ...(i.perDay != null ? { perDay: i.perDay } : { qty: i.qty ?? 1 }),
    packed: false,
  }));
}

/** Save a trip's general item to the reusable list with the Default tag (no duplicates by name). */
export async function saveToGeneralLibrary(name: string, qty?: number, perDay?: number): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const existing = await db.generalItems.filter((i) => i.name.toLowerCase() === clean.toLowerCase()).first();
  if (existing) {
    await db.generalItems.update(existing.id!, { isDefault: true });
    return;
  }
  await db.generalItems.add({ name: clean, ...(perDay != null ? { perDay } : { qty: qty ?? 1 }), isDefault: true, tags: [], createdAt: Date.now() });
}
