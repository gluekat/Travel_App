import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { ClosetItem, SavedOutfit } from '../../db/types';
import { ClosetPicker } from '../../components/ClosetPicker';
import { ItemThumb } from '../../components/ItemThumb';
import { Button, Chip, Icon } from '../../components/ui';
import { deleteSavedOutfit, saveOutfitToCloset, updateSavedOutfit } from './savedOutfitService';

function SavedOutfitCard({ outfit, closet }: { outfit: SavedOutfit; closet: Map<number, ClosetItem> }) {
  const [name, setName] = useState(outfit.name);
  const [adding, setAdding] = useState(false);
  const items = outfit.itemIds.map((id) => closet.get(id)).filter((i): i is ClosetItem => !!i);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="saved-outfit">
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => updateSavedOutfit(outfit.id!, { favorite: !outfit.favorite })}
          aria-pressed={outfit.favorite}
          aria-label={outfit.favorite ? `Unfavorite ${outfit.name}` : `Favorite ${outfit.name}`}
          className={`text-xl leading-none ${outfit.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}`}
          title="Favorite"
        >
          ★
        </button>
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold hover:border-slate-300 focus:border-teal-600 focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== outfit.name && updateSavedOutfit(outfit.id!, { name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Outfit name"
        />
        <button
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
          onClick={() => confirm(`Delete saved outfit "${outfit.name}"?`) && deleteSavedOutfit(outfit.id!)}
          aria-label={`Delete ${outfit.name}`}
        >
          <Icon name="trash" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <ItemThumb item={item} size="h-9 w-9" />
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              <button
                className="rounded p-1 text-slate-400 hover:text-red-700"
                onClick={() => updateSavedOutfit(outfit.id!, { itemIds: outfit.itemIds.filter((id) => id !== item.id) })}
                aria-label={`Remove ${item.name} from ${outfit.name}`}
              >
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" className="mt-2" onClick={() => setAdding(true)}>
        <Icon name="plus" /> Add items
      </Button>
      {adding && (
        <ClosetPicker
          title={`Add items to ${outfit.name}`}
          closet={[...closet.values()]}
          excludeIds={outfit.itemIds}
          onPick={(ids) => updateSavedOutfit(outfit.id!, { itemIds: [...outfit.itemIds, ...ids] })}
          onClose={() => setAdding(false)}
        />
      )}
    </li>
  );
}

/** Outfits saved in the closet for reuse on any trip. */
export function SavedOutfitsView() {
  const outfits = useLiveQuery(() => db.savedOutfits.orderBy('updatedAt').reverse().toArray(), []);
  const closet = useLiveQuery(async () => new Map((await db.closetItems.toArray()).map((i) => [i.id!, i])), []);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!outfits || !closet) return <p className="text-sm text-slate-500">Loading…</p>;
  const visible = outfits.filter((o) => !favoritesOnly || o.favorite).sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
          ★ favorites only
        </Chip>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> New outfit
        </Button>
      </div>
      {outfits.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No saved outfits yet. Create one here, or use <strong>Save to closet</strong> on any outfit in a trip. Saved outfits show up when you ask
          for suggestions, with favorites first.
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((o) => (
          <SavedOutfitCard key={o.id} outfit={o} closet={closet} />
        ))}
      </ul>
      {outfits.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No favorite outfits yet. Tap ★ on an outfit.</p>}
      {creating && (
        <ClosetPicker
          title="New outfit: pick its items"
          closet={[...closet.values()]}
          confirmLabel={(n) => `Create outfit${n ? ` (${n} items)` : ''}`}
          onPick={async (ids) => {
            const name = prompt('Name this outfit:', 'My outfit');
            if (name != null) await saveOutfitToCloset(name, ids);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
