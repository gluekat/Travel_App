import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { ACTIVITIES, type Activity, type ClosetItem } from '../../db/types';
import { rankSavedOutfits } from '../../engine/suggest';
import type { SuggestedOutfit } from '../../engine/types';
import { ItemThumb } from '../../components/ItemThumb';
import { Stars } from '../../components/Stars';
import { Banner, Button, ChipGroup, Icon, Modal } from '../../components/ui';
import { applySuggestion, suggestForOutfit, toEngineDay, toEngineItem } from './outfitService';
import type { OutfitCardProps } from './OutfitCard';

function OptionCard({
  title,
  itemIds,
  rationale,
  gaps,
  byId,
  onUse,
  testId,
}: {
  title: ReactNode;
  itemIds: number[];
  rationale: string;
  gaps: string[];
  byId: Map<number, ClosetItem>;
  onUse: () => void;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3" data-testid={testId}>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-1.5">
        {itemIds.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li key={id} className="flex items-center gap-2">
              <ItemThumb item={item} size="h-9 w-9" />
              <span className="text-sm">{item.name}</span>
              <span className="text-xs capitalize text-slate-400">{item.category}</span>
              {(item.favorite ?? 0) > 0 && <Stars value={item.favorite} size="sm" />}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-600">
        <span className="font-medium">Why: </span>
        {rationale}
      </p>
      {gaps.length > 0 && (
        <div className="mt-2 space-y-1">
          {gaps.map((g) => (
            <Banner key={g} tone="warn">
              ⚠️ {g}
            </Banner>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onUse}>
          <Icon name="check" /> Use this outfit
        </Button>
      </div>
    </div>
  );
}

/**
 * On-demand outfit ideas for one outfit: fresh suggestions plus your saved
 * closet outfits ranked for this day. Nothing changes until "Use this outfit".
 */
export function SuggestPanel({ outfit, day, dayIndex, closet, usage, formatTemp, onClose }: OutfitCardProps & { onClose: () => void }) {
  const [activities, setActivities] = useState<Activity[]>(outfit.activities?.length ? outfit.activities : day.activities);
  const [seed, setSeed] = useState(0);
  const [options, setOptions] = useState<SuggestedOutfit[]>();
  const saved = useLiveQuery(() => db.savedOutfits.toArray(), []);
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

  const rankedSaved = useMemo(() => {
    if (!saved?.length) return [];
    const others = new Map(usage);
    for (const id of outfit.itemIds) others.set(id, (others.get(id) ?? 1) - 1);
    return rankSavedOutfits(
      closet.map(toEngineItem),
      toEngineDay(day, dayIndex),
      activities,
      saved.map((s) => ({ id: s.id!, name: s.name, favorite: s.favorite, itemIds: s.itemIds })),
      others,
      formatTemp,
    ).slice(0, 3);
  }, [saved, usage, outfit.itemIds, closet, day, dayIndex, activities, formatTemp]);

  const use = async (s: SuggestedOutfit) => {
    await applySuggestion(outfit.id!, s);
    onClose();
  };

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
          <p className="mt-2 text-xs text-slate-500">★ Items you've rated higher are preferred.</p>
        </div>

        {!options && <p className="text-sm text-slate-500">Thinking…</p>}
        {options?.length === 0 && <p className="text-sm text-slate-600">Your closet doesn't have enough items to build an outfit.</p>}
        {options?.map((o, n) => (
          <OptionCard key={n} testId="suggestion" title={`Option ${n + 1}`} itemIds={o.itemIds} rationale={o.rationale} gaps={o.gaps} byId={byId} onUse={() => use(o)} />
        ))}
        <Button onClick={() => setSeed((s) => s + 1)} disabled={!options}>
          <Icon name="refresh" /> Show other options
        </Button>

        {rankedSaved.length > 0 && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">From your saved outfits</p>
            {rankedSaved.map((r) => (
              <OptionCard
                key={r.savedOutfitId}
                testId="saved-suggestion"
                title={
                  <>
                    {r.favorite && <span className="text-amber-500">★ </span>}
                    {r.name}
                  </>
                }
                itemIds={r.itemIds}
                rationale={r.rationale}
                gaps={r.gaps}
                byId={byId}
                onUse={() => use({ label: r.name, activities, itemIds: r.itemIds, rationale: `From your saved outfit "${r.name}". ${r.rationale}`, gaps: r.gaps })}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
