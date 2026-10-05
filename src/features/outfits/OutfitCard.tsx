import { useMemo, useState } from 'react';
import type { ClosetItem, Outfit, TripDay } from '../../db/types';
import { outfitTargets, swapCandidates } from '../../engine/suggest';
import { ItemThumb } from '../../components/ItemThumb';
import { Icon, Modal } from '../../components/ui';
import { removeItemFromOutfit, swapItem, toEngineDay, toEngineItem, toggleLock, toggleSelected } from './outfitService';

interface Props {
  outfit: Outfit;
  day: TripDay;
  dayIndex: number;
  closet: ClosetItem[];
  formatTemp: (c: number) => string;
}

function SwapDialog({ outfit, day, dayIndex, closet, itemId, formatTemp, onClose }: Props & { itemId: number; onClose: () => void }) {
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const candidates = useMemo(() => {
    const target = outfitTargets(day.activities)[outfit.rank] ?? outfitTargets(day.activities)[0];
    return swapCandidates(closet.map(toEngineItem), toEngineDay(day, dayIndex), target.group, outfit.itemIds, itemId);
  }, [closet, day, dayIndex, outfit, itemId]);
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
                    await swapItem(outfit.id!, itemId, c.id, formatTemp);
                    onClose();
                  }}
                >
                  <ItemThumb item={full} size="h-10 w-10" />
                  <span>
                    <span className="block text-sm font-medium">{c.name}</span>
                    <span className="block text-xs capitalize text-slate-500">
                      warmth {c.warmth} · {c.formality} · {[...c.weatherTags, ...c.activities].slice(0, 4).join(', ')}
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

export function OutfitCard(props: Props) {
  const { outfit, closet } = props;
  const [swapping, setSwapping] = useState<number>();
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const items = outfit.itemIds.map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i);

  return (
    <div className={`rounded-lg border p-3 ${outfit.selected ? 'border-teal-200 bg-teal-50/40' : 'border-dashed border-slate-300 bg-white'}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold capitalize">{outfit.label}</p>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={outfit.selected} onChange={() => toggleSelected(outfit.id!)} className="accent-teal-700" />
          Pack this outfit
        </label>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const locked = outfit.lockedItemIds.includes(item.id!);
          return (
            <li key={item.id} className="flex items-center gap-2">
              <ItemThumb item={item} size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-xs capitalize text-slate-500">{item.category}</p>
              </div>
              <button
                className={`rounded p-1.5 ${locked ? 'bg-teal-700 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                onClick={() => toggleLock(outfit.id!, item.id!)}
                aria-pressed={locked}
                aria-label={locked ? `Unlock ${item.name}` : `Lock ${item.name}`}
                title={locked ? 'Locked: kept when regenerating' : 'Lock: keep when regenerating'}
              >
                <Icon name={locked ? 'lock' : 'unlock'} />
              </button>
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setSwapping(item.id)} aria-label={`Swap ${item.name}`} title="Swap">
                <Icon name="swap" />
              </button>
              <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeItemFromOutfit(outfit.id!, item.id!)} aria-label={`Remove ${item.name} from outfit`} title="Remove">
                <Icon name="x" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-600">
        <span className="font-medium">Why: </span>
        {outfit.rationale}
      </p>
      {swapping != null && <SwapDialog {...props} itemId={swapping} onClose={() => setSwapping(undefined)} />}
    </div>
  );
}
