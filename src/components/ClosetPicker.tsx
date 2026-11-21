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
  alreadyIn,
  showSelected,
  initialPicked,
  nameField,
  allowEmpty,
  onPick,
  onClose,
}: {
  title: string;
  closet: ClosetItem[];
  excludeIds?: number[];
  confirmLabel?: (n: number) => string;
  /** Extra per-item info, e.g. clean wears left. */
  hint?: (item: ClosetItem) => ReactNode;
  /** Items already in the outfit being edited, shown in the selection panel (they can't be picked again). */
  alreadyIn?: number[];
  /** Show a panel of the selected items while choosing (also on whenever `alreadyIn` is given). */
  showSelected?: boolean;
  /** Items that start out selected (editing an outfit); they can be unticked and the pick then replaces the outfit's items. */
  initialPicked?: number[];
  /** A name box shown above the list (outfit editor). */
  nameField?: { label: string; value: string; onChange: (v: string) => void; placeholder?: string };
  /** Allow confirming with nothing selected. */
  allowEmpty?: boolean;
  onPick: (ids: number[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [picked, setPicked] = useState<number[]>(initialPicked ?? []);
  const q = query.trim().toLowerCase();
  const list = closet
    .filter(
      (i) =>
        !excludeIds.includes(i.id!) &&
        (!category || i.category === category) &&
        (!q || i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q) || (i.customTags ?? []).some((t) => t.includes(q))),
    )
    .sort((a, b) => (b.favorite ?? 0) - (a.favorite ?? 0));
  const byId = new Map(closet.map((i) => [i.id!, i]));
  const existing = (alreadyIn ?? []).map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i);
  const chosen = picked.map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        {nameField && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{nameField.label}</span>
            <input className={inputClass} value={nameField.value} placeholder={nameField.placeholder} onChange={(e) => nameField.onChange(e.target.value)} autoFocus />
          </label>
        )}
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
        {(showSelected || alreadyIn) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2" aria-label="Selected items">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {alreadyIn ? `In this outfit (${existing.length + chosen.length})` : `Selected (${chosen.length})`}
            </p>
            {existing.length + chosen.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing selected yet. Tick items below.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {existing.map((item) => (
                  <li key={`e${item.id}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs text-slate-600">
                    <ItemThumb item={item} size="h-8 w-8" />
                    <span className="max-w-[8rem] truncate">{item.name}</span>
                  </li>
                ))}
                {chosen.map((item) => (
                  <li key={`c${item.id}`} className="flex items-center gap-1.5 rounded-lg border border-teal-500 bg-teal-50 py-1 pl-1 pr-1 text-xs">
                    <ItemThumb item={item} size="h-8 w-8" />
                    <span className="max-w-[8rem] truncate font-medium">{item.name}</span>
                    <button type="button" className="rounded px-1 text-slate-500 hover:text-red-700" onClick={() => toggle(item.id!)} aria-label={`Unselect ${item.name}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
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
            disabled={!picked.length && !allowEmpty}
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
