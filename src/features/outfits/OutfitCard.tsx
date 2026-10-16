import { useMemo, useState } from 'react';
import { CATEGORIES, type Category, type ClosetItem, type Outfit, type TripDay } from '../../db/types';
import { capacity } from '../../engine/rules';
import { swapCandidates } from '../../engine/suggest';
import { ItemThumb } from '../../components/ItemThumb';
import { Button, Chip, Icon, Modal, inputClass } from '../../components/ui';
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

function ItemPicker({ outfit, closet, usage, onClose }: { outfit: Outfit; closet: ClosetItem[]; usage: Map<number, number>; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const q = query.trim().toLowerCase();
  const list = closet.filter(
    (i) => !outfit.itemIds.includes(i.id!) && (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q)),
  );
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal title={`Add items to ${outfit.label}`} onClose={onClose}>
      <div className="space-y-3">
        <input type="search" className={inputClass} placeholder="Search your closet…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search closet" />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!category} onClick={() => setCategory(null)}>
            all
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
        <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto">
          {list.map((item) => (
            <li key={item.id}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${picked.includes(item.id!) ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                <input type="checkbox" checked={picked.includes(item.id!)} onChange={() => toggle(item.id!)} className="h-4 w-4 accent-teal-700" />
                <ItemThumb item={item} size="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.name}
                    {(item.quantity ?? 1) > 1 && <span className="ml-1 text-slate-400">×{item.quantity}</span>}
                  </span>
                  <span className="flex flex-wrap gap-x-2">
                    <span className="text-xs capitalize text-slate-500">{item.category}</span>
                    <WearHint item={item} usage={usage} inThisOutfit={false} />
                  </span>
                </span>
              </label>
            </li>
          ))}
          {list.length === 0 && <li className="text-sm text-slate-500">No matching items.</li>}
        </ul>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!picked.length}
            onClick={async () => {
              await addItemsToOutfit(outfit.id!, picked);
              onClose();
            }}
          >
            Add {picked.length || ''} item{picked.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
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
      </div>

      {adding && <ItemPicker outfit={outfit} closet={closet} usage={usage} onClose={() => setAdding(false)} />}
      {swapping != null && <SwapDialog {...props} itemId={swapping} onClose={() => setSwapping(undefined)} />}
      {suggesting && <SuggestPanel {...props} onClose={() => setSuggesting(false)} />}
    </div>
  );
}
