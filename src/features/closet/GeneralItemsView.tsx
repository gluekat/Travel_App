import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteGeneralItem } from '../../db/schema';
import { GENERAL_CATEGORIES, TRASH_DAYS, compareGeneral, generalCategory, type GeneralItem } from '../../db/types';
import { Button, Chip, Icon, Modal, inputClass } from '../../components/ui';
import { ensureGeneralLibrary } from '../packing/generalItemsService';
import { GeneralIcon, isActivity } from './GeneralItemForm';
import { ItemEditor, type EditorTarget } from './ItemEditor';
import type { ItemFormHandle } from './ItemForm';

/** One general item as a card; shared by the General tab and the all-items tab. */
export function GeneralItemCard({ item, onEdit, onDelete, onTag }: { item: GeneralItem; onEdit: () => void; onDelete: () => void; onTag: (t: string) => void }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <GeneralIcon item={item} />
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            <p className="text-xs text-slate-500">
              General · {generalCategory(item)} · {item.perDay != null ? `${item.perDay} per day` : `×${item.qty ?? 1}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0">
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={onEdit} aria-label={`Edit ${item.name}`} title="Edit">
            <Icon name="edit" />
          </button>
          <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={onDelete} aria-label={`Delete ${item.name}`} title="Delete">
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.isDefault && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium text-teal-800">Default</span>}
        {item.tags.map((t) => (
          <button key={t} onClick={() => onTag(t)} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${isActivity(t) ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'}`}>
            {isActivity(t) ? t : `#${t}`}
          </button>
        ))}
      </div>
    </li>
  );
}

export async function confirmDeleteGeneralItem(item: GeneralItem) {
  if (confirm(`Delete "${item.name}" from your general items? You can restore it from the Trash for ${TRASH_DAYS} days.`)) await deleteGeneralItem(item.id!);
}

/** Add/edit modal for any item; closing an existing item with X saves it. */
export function ItemEditorModal({ target, defaultCategory, onClose }: { target: EditorTarget; defaultCategory?: Parameters<typeof ItemEditor>[0]['defaultCategory']; onClose: () => void }) {
  const ref = useRef<ItemFormHandle>(null);
  const isNew = !target.item;
  const title = isNew ? 'Add item' : target.kind === 'general' ? 'Edit general item' : 'Edit item';
  return (
    <Modal title={title} onClose={() => (isNew ? onClose() : void ref.current?.save())}>
      <ItemEditor ref={ref} target={target} defaultCategory={defaultCategory} onDone={onClose} />
    </Modal>
  );
}

/** Reusable general packing items (chargers, toiletries…) with Default, activity and custom tags. */
export function GeneralItemsView() {
  useEffect(() => {
    void ensureGeneralLibrary();
  }, []);
  const items = useLiveQuery(async () => (await db.generalItems.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<'name' | 'category'>('category');
  const [editing, setEditing] = useState<EditorTarget | null>(null);

  const allTags = useMemo(() => [...new Set((items ?? []).flatMap((i) => i.tags))].sort(), [items]);
  const visible = (items ?? [])
    .filter((i) => !tag || (tag === 'default' ? i.isDefault : i.tags.includes(tag)))
    .sort((a, b) => (sort === 'category' ? compareGeneral({ category: generalCategory(a), name: a.name }, { category: generalCategory(b), name: b.name }) : a.name.localeCompare(b.name)));
  const groups: [string | null, GeneralItem[]][] =
    sort === 'category'
      ? GENERAL_CATEGORIES.map((c) => [c, visible.filter((i) => generalCategory(i) === c)] as [string, GeneralItem[]]).filter(([, list]) => list.length > 0)
      : [[null, visible]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Items for the Packing List of any trip. Items tagged <strong>Default</strong> are added to every new trip automatically.
        </p>
        <Button variant="primary" onClick={() => setEditing({ kind: 'general' })}>
          <Icon name="plus" /> Add item
        </Button>
      </div>

      {(items?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by tag">
          <select className={`${inputClass} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'category')} aria-label="Sort by">
            <option value="category">Sort: Category</option>
            <option value="name">Sort: Name A→Z</option>
          </select>
          <Chip active={tag === null} onClick={() => setTag(null)}>
            all
          </Chip>
          <Chip active={tag === 'default'} onClick={() => setTag(tag === 'default' ? null : 'default')}>
            Default
          </Chip>
          {allTags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No general items yet. Add chargers, toiletries, documents…
        </div>
      )}

      {groups.map(([category, list]) => (
        <section key={category ?? 'all'} className="space-y-2" aria-label={category ?? 'General items'}>
          {category && (
            <h2 className="text-sm font-semibold text-slate-700">
              {category} <span className="font-normal text-slate-400">({list.length})</span>
            </h2>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => (
              <GeneralItemCard key={item.id} item={item} onEdit={() => setEditing({ kind: 'general', item })} onDelete={() => void confirmDeleteGeneralItem(item)} onTag={setTag} />
            ))}
          </ul>
        </section>
      ))}
      {items && items.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No items have that tag.</p>}

      {editing && <ItemEditorModal target={editing} defaultCategory="general" onClose={() => setEditing(null)} />}
    </div>
  );
}
