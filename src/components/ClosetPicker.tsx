import { useState, type ReactNode } from 'react';
import { CATEGORIES, type Category, type ClosetItem } from '../db/types';
import { ItemThumb } from './ItemThumb';
import { Stars } from './Stars';
import { Button, Chip, Modal, inputClass } from './ui';

/** Multi-select picker over the closet, used for trip outfits and saved outfits. */
export function ClosetPicker({
  title,
  closet,
  excludeIds = [],
  confirmLabel = (n) => `Add ${n || ''} item${n === 1 ? '' : 's'}`,
  hint,
  onPick,
  onClose,
}: {
  title: string;
  closet: ClosetItem[];
  excludeIds?: number[];
  confirmLabel?: (n: number) => string;
  /** Extra per-item info, e.g. clean wears left. */
  hint?: (item: ClosetItem) => ReactNode;
  onPick: (ids: number[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const q = query.trim().toLowerCase();
  const list = closet
    .filter(
      (i) =>
        !excludeIds.includes(i.id!) &&
        (!category || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q) || (i.customTags ?? []).some((t) => t.includes(q))),
    )
    .sort((a, b) => (b.favorite ?? 0) - (a.favorite ?? 0));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <input type="search" className={inputClass} placeholder="Search name, color or tag…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search closet" />
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
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {(item.quantity ?? 1) > 1 && <span className="text-sm text-slate-400">×{item.quantity}</span>}
                    {(item.favorite ?? 0) > 0 && <Stars value={item.favorite} size="sm" />}
                  </span>
                  <span className="flex flex-wrap gap-x-2">
                    <span className="text-xs capitalize text-slate-500">{item.category}</span>
                    {hint?.(item)}
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
              await onPick(picked);
              onClose();
            }}
          >
            {confirmLabel(picked.length)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
