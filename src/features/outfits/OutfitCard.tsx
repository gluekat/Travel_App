import { useMemo, useState } from 'react';
import type { ClosetItem, Outfit, TripDay } from '../../db/types';
import { ItemForm } from '../closet/ItemForm';
import { capacity } from '../../engine/rules';
import { swapCandidates } from '../../engine/suggest';
import { isPajamas, sleepwearSwapCandidates } from '../../engine/sleepwear';
import { ItemThumb } from '../../components/ItemThumb';
import { ClosetPicker } from '../../components/ClosetPicker';
import { Button, Icon, Modal } from '../../components/ui';
import { saveOutfitToCloset } from '../closet/savedOutfitService';
import {
  addItemsToOutfit,
  deleteOutfit,
  removeItemFromOutfit,
  renameOutfit,
  isSleepwearOutfit,
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
  /** Cycle-based wears per item (for capacity checks in pickers). */
  usage: Map<number, number>;
  /** Trip-wide total wears per item (Y in "wear X of Y planned"). */
  tripTotals: Map<number, number>;
  /** Trip-wide cumulative wears up to this day (X in "wear X of Y planned"). */
  cumulativeUsage: Map<number, number>;
  /** Items whose wear allowance is exceeded on this day. */
  exceededItemIds?: Set<number>;
  formatTemp: (c: number) => string;
}

/**
 * Wear availability for an item. In an outfit: "wear 1 of 2 planned" (ordinal
 * trip position). In pickers: "1 of 3 clean wears left" before adding it.
 */
function WearHint({
  item, usage, cumulativeUsage, tripTotals, exceeded, inThisOutfit,
}: {
  item: ClosetItem;
  usage: Map<number, number>;
  cumulativeUsage?: Map<number, number>;
  tripTotals?: Map<number, number>;
  exceeded?: boolean;
  inThisOutfit: boolean;
}) {
  const cap = capacity({ quantity: item.quantity ?? 1, wearCount: item.wearCount ?? 1 });
  if (inThisOutfit) {
    const x = cumulativeUsage?.get(item.id!) ?? 0;
    const y = tripTotals?.get(item.id!) ?? 0;
    return (
      <span className={`text-xs ${exceeded ? 'font-medium text-amber-600' : 'text-slate-500'}`}>
        wear {x} of {y}
      </span>
    );
  }
  const usedCycle = usage.get(item.id!) ?? 0;
  const left = cap - usedCycle;
  return (
    <span className={`text-xs ${left <= 0 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
      {left <= 0 ? `no clean wears left (${cap} total)` : `${left} of ${cap} clean wear${cap > 1 ? 's' : ''} left`}
    </span>
  );
}

function SwapDialog({ outfit, day, dayIndex, closet, usage, itemId, onClose }: OutfitCardProps & { itemId: number; onClose: () => void }) {
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const candidates = useMemo(() => {
    const own = new Map(usage);
    for (const id of outfit.itemIds) own.set(id, (own.get(id) ?? 1) - 1);
    if (isSleepwearOutfit(outfit)) {
      return sleepwearSwapCandidates(closet.map((c) => ({ ...c, id: c.id! })), outfit.itemIds, itemId, own).map((c) => ({ id: c.id, name: c.name, warmth: closet.find((x) => x.id === c.id)!.warmth, formality: closet.find((x) => x.id === c.id)!.formality }));
    }
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
                        {c.warmth > 0 ? `warmth ${c.warmth}` : 'no warmth'} · {c.formality}
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
  const { outfit, closet, usage, tripTotals, cumulativeUsage, exceededItemIds } = props;
  const [swapping, setSwapping] = useState<number>();
  const [adding, setAdding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState(outfit.label);
  const [editingItem, setEditingItem] = useState<ClosetItem>();
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
                <button className="shrink-0" onClick={() => setEditingItem(item)} title={`Edit ${item.name}`}>
                  <ItemThumb item={item} size="h-10 w-10" />
                </button>
                <div className="min-w-0 flex-1">
                  <button className="w-full truncate text-left text-sm hover:text-teal-700" onClick={() => setEditingItem(item)}>
                    {item.name}
                  </button>
                  <p className="flex flex-wrap gap-x-2">
                    <span className="text-xs capitalize text-slate-500">{item.category}</span>
                    <WearHint item={item} usage={usage} cumulativeUsage={cumulativeUsage} tripTotals={tripTotals} exceeded={exceededItemIds?.has(item.id!)} inThisOutfit />
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
          closet={isSleepwearOutfit(outfit) ? closet.filter(isPajamas) : closet}
          excludeIds={outfit.itemIds}
          hint={(item) => <WearHint item={item} usage={usage} inThisOutfit={false} />}
          onPick={(ids) => addItemsToOutfit(outfit.id!, ids)}
          onClose={() => setAdding(false)}
        />
      )}
      {swapping != null && <SwapDialog {...props} itemId={swapping} onClose={() => setSwapping(undefined)} />}
      {suggesting && <SuggestPanel {...props} onClose={() => setSuggesting(false)} />}
      {editingItem && (
        <Modal title="Edit item" onClose={() => setEditingItem(undefined)}>
          <ItemForm item={editingItem} onDone={() => setEditingItem(undefined)} />
        </Modal>
      )}
    </div>
  );
}
