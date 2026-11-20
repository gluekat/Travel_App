import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { TRASH_DAYS, type TrashEntry } from '../../db/types';
import { formatTimestamp } from '../../lib/dates';
import { Button, Icon } from '../../components/ui';
import { daysLeft, deleteForever, emptyTrash, purgeExpiredTrash, restoreFromTrash } from './trashService';

const KIND_LABEL: Record<TrashEntry['kind'], string> = { trip: '🧳 Trip', closetItem: '👕 Closet item', savedOutfit: '👗 Saved outfit', generalItem: '🎒 General item' };

function detail(e: TrashEntry): string {
  if (e.kind === 'trip') return `${e.data.days.length} days · ${e.data.outfits.filter((o) => o.itemIds.length).length} outfits`;
  if (e.kind === 'closetItem') {
    const used = e.data.outfits.length + e.data.savedOutfitIds.length;
    return used ? `Will return to ${used} outfit${used !== 1 ? 's' : ''}` : e.data.item.category;
  }
  if (e.kind === 'savedOutfit') return `${e.data.outfit.itemIds.length} item${e.data.outfit.itemIds.length !== 1 ? 's' : ''}`;
  return e.data.item.category ?? 'General';
}

/** Deleted trips and items, kept for 30 days and then removed for good. */
export function TrashPage() {
  useEffect(() => {
    void purgeExpiredTrash();
  }, []);
  const entries = useLiveQuery(async () => (await db.trash.toArray()).sort((a, b) => b.deletedAt - a.deletedAt), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Trash</h1>
          <p className="text-sm text-slate-600">Deleted trips, closet items and saved outfits stay here for {TRASH_DAYS} days, then are removed for good.</p>
        </div>
        {(entries?.length ?? 0) > 0 && (
          <Button variant="danger" onClick={async () => confirm(`Permanently delete all ${entries!.length} items in the trash? This can't be undone.`) && (await emptyTrash())}>
            <Icon name="trash" /> Empty trash
          </Button>
        )}
      </div>

      {entries && entries.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">The trash is empty.</div>}

      <ul className="space-y-2">
        {entries?.map((e) => {
          const left = daysLeft(e);
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.name}</p>
                <p className="text-xs text-slate-500">
                  {KIND_LABEL[e.kind]} · {detail(e)}
                </p>
                <p className={`text-xs ${left <= 3 ? 'text-amber-700' : 'text-slate-400'}`}>
                  Deleted {formatTimestamp(e.deletedAt)} · {left === 0 ? 'removed soon' : `${left} day${left !== 1 ? 's' : ''} left`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void restoreFromTrash(e.id!)} aria-label={`Restore ${e.name}`}>
                  Restore
                </Button>
                <Button variant="danger" onClick={() => confirm(`Permanently delete "${e.name}"? This can't be undone.`) && void deleteForever(e.id!)} aria-label={`Delete ${e.name} forever`}>
                  Delete forever
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
