import { useEffect, useMemo, useState } from 'react';
import { ACTIVITIES, type Activity, type ClosetItem } from '../../db/types';
import type { SuggestedOutfit } from '../../engine/types';
import { ItemThumb } from '../../components/ItemThumb';
import { Banner, Button, ChipGroup, Icon, Modal } from '../../components/ui';
import { applySuggestion, suggestForOutfit } from './outfitService';
import type { OutfitCardProps } from './OutfitCard';

/** On-demand outfit suggestions for one outfit slot. Nothing changes until "Use this outfit". */
export function SuggestPanel({ outfit, day, closet, formatTemp, onClose }: OutfitCardProps & { onClose: () => void }) {
  const [activities, setActivities] = useState<Activity[]>(outfit.activities?.length ? outfit.activities : day.activities);
  const [seed, setSeed] = useState(0);
  const [options, setOptions] = useState<SuggestedOutfit[]>();
  const byId = useMemo(() => new Map(closet.map((i) => [i.id!, i])), [closet]);
  const locked = outfit.lockedItemIds.filter((id) => outfit.itemIds.includes(id));

  useEffect(() => {
    let live = true;
    setOptions(undefined);
    suggestForOutfit(outfit.id!, activities, seed, formatTemp).then((o) => live && setOptions(o));
    return () => {
      live = false;
    };
  }, [outfit.id, activities, seed, formatTemp]);

  return (
    <Modal title={`Suggestions for ${outfit.label}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Outfit for</p>
          <ChipGroup label="Outfit activities" options={ACTIVITIES} value={activities} onChange={setActivities} />
          {locked.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              🔒 Keeping {locked.map((id) => byId.get(id)?.name).filter(Boolean).join(', ')}.
            </p>
          )}
        </div>

        {!options && <p className="text-sm text-slate-500">Thinking…</p>}
        {options?.length === 0 && <p className="text-sm text-slate-600">Your closet doesn't have enough items to build an outfit.</p>}
        {options?.map((o, n) => (
          <div key={n} className="rounded-lg border border-slate-200 p-3" data-testid="suggestion">
            <p className="mb-2 text-sm font-semibold">Option {n + 1}</p>
            <ul className="space-y-1.5">
              {o.itemIds.map((id) => {
                const item = byId.get(id) as ClosetItem;
                return (
                  <li key={id} className="flex items-center gap-2">
                    <ItemThumb item={item} size="h-9 w-9" />
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs capitalize text-slate-400">{item.category}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              <span className="font-medium">Why: </span>
              {o.rationale}
            </p>
            {o.gaps.length > 0 && (
              <div className="mt-2 space-y-1">
                {o.gaps.map((g) => (
                  <Banner key={g} tone="warn">
                    ⚠️ {g}
                  </Banner>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="primary"
                onClick={async () => {
                  await applySuggestion(outfit.id!, o);
                  onClose();
                }}
              >
                <Icon name="check" /> Use this outfit
              </Button>
            </div>
          </div>
        ))}

        <div className="flex justify-between gap-2">
          <Button onClick={() => setSeed((s) => s + 1)} disabled={!options}>
            <Icon name="refresh" /> Show other options
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
