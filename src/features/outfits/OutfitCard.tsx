import { useMemo, useState } from 'react';
import type { ClosetItem, Outfit, TripDay } from '../../db/types';
import { capacity } from '../../engine/rules';
import { swapCandidates } from '../../engine/suggest';
import { ItemThumb } from '../../components/ItemThumb';
import { ClosetPicker } from '../../components/ClosetPicker';
import { Button, Icon, Modal } from '../../components/ui';
import { saveOutfitToCloset } from '../closet/savedOutfitService';
import {
  addItemsToOutfit,
  deleteOutfit,
  removeItemFromOutfit,
  renameOutfit,
  swapItem,
  toEngineDay,
  toEngineItem,
  toggleLock,
} from './outfitService';
import { SuggestPanel } from './SuggestPanel';

export interface OutfitCardProps {
  outfit: Outfit;
  day: TripDay;
  dayIndex: number;
  closet: ClosetItem[];
  /** Wears planned per item across the whole trip. */
  usage: Map<number, number>;
  formatTemp: (c: number) => string;
}

/**
 * Wear availability for an item. In an outfit: "2 of 3 wears planned" across
 * the trip. In pickers: "1 of 3 clean wears left" before adding it.
 */
function WearHint({ item, usage, inThisOutfit }: { item: ClosetItem; usage: Map<number, number>; inThisOutfit: boolean }) {
  const total = capacity({ quantity: item.quantity ?? 1, wearCount: item.wearCount ?? 1 });
  const used = usage.get(item.id!) ?? 0;
  if (inThisOutfit) {
    const over = used > total;
    return (
      <span className={`text-xs ${over ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
        {used} of {total} wear{total > 1 ? 's' : ''} planned{over ? ': needs laundry or more copies' : ''}
      </span>
    );
  }
  const left = total - used;
  return (
    <span className={`text-xs ${left <= 0 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
      {left <= 0 ? `no clean wears left (${total} total)` : `${left} of ${total} clean wear${total > 1 ? 's' : ''} left`}
    </span>
  );
}

function SwapDialog({ outfit, day, dayIndex, closet, usage, itemId, onClose }: OutfitCardProps & { itemId: number; onClose: () => void }) {
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const candidates = useMemo(() => {
    const own = new Map(usage);
    for (const id of outfit.itemIds) own.set(id, (own.get(id) ?? 1) - 1);
    return swapCandidates(closet.map(toEngineItem), toEngineDay(day, dayIndex), outfit.activities ?? day.activities, outfit.itemIds, itemId, own);
  }, [closet, day, dayIndex, outfit, itemId, usage]);
  const current = byId.get(itemId);

  return (
    <Modal title={`Swap ${current?.name ?? 'item'}`} onClose={onClose}>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-600">No other items in your closet can fill this spot.</p>
      ) : (
        <ul className="space-y-2">
          <li className="text-xs text-slate-500">Best matches for this day's weather and activities first.</li>
          {candidates.map((c) => {
            const full = byId.get(c.id)!;
            return (
              <li key={c.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-2 text-left hover:border-teal-500"
                  onClick={async () => {
                    await swapItem(outfit.id!, itemId, c.id);
                    onClose();
                  }}
                >
                  <ItemThumb item={full} size="h-10 w-10" />
                  <span>
                    <span className="block text-sm font-medium">{c.name}</span>
                    <span className="flex flex-wrap gap-x-2 text-xs capitalize text-slate-500">
                      <span>
                        warmth {c.warmth} · {c.formality}
                      </span>
                      <WearHint item={full} usage={usage} inThisOutfit={false} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export function OutfitCard(props: OutfitCardProps) {
  const { outfit, closet, usage } = props;
  const [swapping, setSwapping] = useState<number>();
  const [adding, setAdding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState(outfit.label);
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const items = outfit.itemIds.map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3" data-testid="outfit">
      <div className="mb-2 flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-slate-300 focus:border-teal-600 focus:bg-white focus:outline-none"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== outfit.label && renameOutfit(outfit.id!, label)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Outfit name"
        />
        <button
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
          onClick={() => (items.length === 0 || confirm(`Remove "${outfit.label}" from this day?`)) && deleteOutfit(outfit.id!)}
          aria-label={`Delete ${outfit.label}`}
          title="Delete outfit"
        >
          <Icon name="trash" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">No clothes picked yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const locked = outfit.lockedItemIds.includes(item.id!);
            return (
              <li key={item.id} className="flex items-center gap-2">
                <ItemThumb item={item} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="flex flex-wrap gap-x-2">
                    <span className="text-xs capitalize text-slate-500">{item.category}</span>
                    <WearHint item={item} usage={usage} inThisOutfit />
                  </p>
                </div>
                <button
                  className={`rounded p-1.5 ${locked ? 'bg-teal-700 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  onClick={() => toggleLock(outfit.id!, item.id!)}
                  aria-pressed={locked}
                  aria-label={locked ? `Unlock ${item.name}` : `Lock ${item.name}`}
                  title={locked ? 'Locked: kept when you ask for suggestions' : 'Lock: keep this item when asking for suggestions'}
                >
                  <Icon name={locked ? 'lock' : 'unlock'} />
                </button>
                <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setSwapping(item.id)} aria-label={`Swap ${item.name}`} title="Swap">
                  <Icon name="swap" />
                </button>
                <button
                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeItemFromOutfit(outfit.id!, item.id!)}
                  aria-label={`Remove ${item.name} from outfit`}
                  title="Remove"
                >
                  <Icon name="x" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {outfit.rationale && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-medium">Why: </span>
          {outfit.rationale}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add items
        </Button>
        <Button onClick={() => setSuggesting(true)}>
          <Icon name="shirt" /> Suggest outfit
        </Button>
        {items.length > 0 && (
          <Button
            variant="ghost"
            onClick={async () => {
              const name = prompt('Save this outfit to your closet as:', outfit.label);
              if (name == null) return;
              await saveOutfitToCloset(name, outfit.itemIds);
              setSaved(true);
            }}
            title="Save to your closet's outfits for future trips"
          >
            <Icon name="bag" /> {saved ? 'Saved ✓' : 'Save to closet'}
          </Button>
        )}
      </div>

      {adding && (
        <ClosetPicker
          title={`Add items to ${outfit.label}`}
          closet={closet}
          excludeIds={outfit.itemIds}
          hint={(item) => <WearHint item={item} usage={usage} inThisOutfit={false} />}
          onPick={(ids) => addItemsToOutfit(outfit.id!, ids)}
          onClose={() => setAdding(false)}
        />
      )}
      {swapping != null && <SwapDialog {...props} itemId={swapping} onClose={() => setSwapping(undefined)} />}
      {suggesting && <SuggestPanel {...props} onClose={() => setSuggesting(false)} />}
    </div>
  );
}
