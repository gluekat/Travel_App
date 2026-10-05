import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteClosetItem } from '../../db/schema';
import { CATEGORIES, WEATHER_TAGS, ACTIVITIES, type Category, type ClosetItem } from '../../db/types';
import { clearSampleItems, seedSampleWardrobe } from '../../db/seed';
import { Button, Chip, Icon, Modal, inputClass } from '../../components/ui';
import { ItemThumb } from '../../components/ItemThumb';
import { ItemForm } from './ItemForm';

type TagFilter = (typeof WEATHER_TAGS)[number] | (typeof ACTIVITIES)[number];

export function filterItems(items: ClosetItem[], query: string, category: Category | null, tag: TagFilter | null) {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!tag || (i.weatherTags as string[]).includes(tag) || (i.activities as string[]).includes(tag)) &&
      (!q || i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q)),
  );
}

export function ClosetPage() {
  const items = useLiveQuery(() => db.closetItems.orderBy('updatedAt').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [tag, setTag] = useState<TagFilter | null>(null);
  const [editing, setEditing] = useState<ClosetItem | 'new' | null>(null);

  const visible = useMemo(() => filterItems(items ?? [], query, category, tag), [items, query, category, tag]);
  const sampleCount = items?.filter((i) => i.isSample).length ?? 0;

  async function remove(item: ClosetItem) {
    if (item.id != null && confirm(`Delete "${item.name}"? It will also be removed from trip outfits.`)) {
      await deleteClosetItem(item.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Closet <span className="text-sm font-normal text-slate-500">({items?.length ?? 0} items)</span>
        </h1>
        <div className="flex gap-2">
          {sampleCount > 0 && (
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm(`Remove all ${sampleCount} sample items?`)) await clearSampleItems();
              }}
            >
              Clear samples
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> Add item
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="search"
          className={inputClass}
          placeholder="Search by name or color…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search closet"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by category">
          <Chip active={!category} onClick={() => setCategory(null)}>
            all
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
        <select
          className={`${inputClass} sm:w-64`}
          value={tag ?? ''}
          onChange={(e) => setTag((e.target.value || null) as TagFilter | null)}
          aria-label="Filter by tag"
        >
          <option value="">Any tag</option>
          <optgroup label="Weather">
            {WEATHER_TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </optgroup>
          <optgroup label="Activity">
            {ACTIVITIES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Your closet is empty. Add your first item, or{' '}
          <button className="font-medium text-teal-700 underline" onClick={() => seedSampleWardrobe()}>
            load a sample wardrobe
          </button>
          .
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <ItemThumb item={item} size="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs capitalize text-slate-500">
                    {item.category} · {item.color || 'no color'} · warmth {item.warmth} · {item.formality}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>
                    <Icon name="edit" />
                  </button>
                  <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => remove(item)} aria-label={`Delete ${item.name}`}>
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[...item.weatherTags, ...item.activities].map((t) => (
                  <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {t}
                  </span>
                ))}
                {item.isSample && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">sample</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items && items.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No items match these filters.</p>}

      {editing && (
        <Modal title={editing === 'new' ? 'Add closet item' : 'Edit item'} onClose={() => setEditing(null)}>
          <ItemForm item={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
