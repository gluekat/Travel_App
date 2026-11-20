import { db } from '../../db/schema';
import type { SavedOutfit } from '../../db/types';

export async function saveOutfitToCloset(name: string, itemIds: number[], favorite = false): Promise<number> {
  const now = Date.now();
  return (await db.savedOutfits.add({
    name: name.trim() || 'My outfit',
    itemIds: [...new Set(itemIds)],
    favorite,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

/** A copy of a saved outfit, named "… (duplicate)". */
export async function duplicateSavedOutfit(id: number): Promise<number | undefined> {
  const o = await db.savedOutfits.get(id);
  return o ? saveOutfitToCloset(`${o.name} (duplicate)`, o.itemIds, o.favorite) : undefined;
}

export async function updateSavedOutfit(id: number, changes: Partial<Pick<SavedOutfit, 'name' | 'itemIds' | 'favorite'>>) {
  await db.savedOutfits.update(id, { ...changes, updatedAt: Date.now() });
}

export { deleteSavedOutfit } from '../../db/schema';
