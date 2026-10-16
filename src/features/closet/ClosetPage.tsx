import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteClosetItem } from '../../db/schema';
import { CATEGORIES, WEATHER_TAGS, ACTIVITIES, type Category, type ClosetItem } from '../../db/types';
import { clearSampleItems, seedSampleWardrobe } from '../../db/seed';
import { Stars } from '../../components/Stars';
import { Tabs } from '../../components/Tabs';
import { Button, Chip, Icon, Modal, inputClass } from '../../components/ui';
import { ItemThumb } from '../../components/ItemThumb';
import { ItemForm } from './ItemForm';
import { SavedOutfitsView } from './SavedOutfitsView';

/** Matches built-in weather/activity tags and custom tags (prefixed "#"). */
export function filterItems(items: ClosetItem[], query: string, category: Category | null, tag: string | null, favoritesOnly = false) {
  const q = query.trim().toLowerCase();
  const custom = tag?.startsWith('#') ? tag.slice(1) : null;
  return items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!favoritesOnly || (i.favorite ?? 0) >= 4) &&
      (!tag ||
        (custom != null ? (i.customTags ?? []).includes(custom) : (i.weatherTags as string[]).includes(tag) || (i.activities as string[]).includes(tag))) &&
      (!q || i.name.toLowerCase().includes(q) || i.color.toLowerCase().includes(q) || (i.customTags ?? []).some((t) => t.includes(q))),
  );
}

export function ClosetTabs({ current }: { current: 'items' | 'outfits' }) {
  const items = useLiveQuery(() => db.closetItems.count(), []);
  const outfits = useLiveQuery(() => db.savedOutfits.count(), []);
  return (
    <Tabs
      label="Closet sections"
      current={current}
      tabs={[
        { id: 'items', label: `Items${items != null ? ` (${items})` : ''}`, href: '#/closet' },
        { id: 'outfits', label: `Outfits${outfits != null ? ` (${outfits})` : ''}`, href: '#/closet/outfits' },
      ]}
    />
  );
}

function ItemsView() {
  const items = useLiveQuery(() => db.closetItems.orderBy('updatedAt').reverse().toArray(), []);
  const customTags = useLiveQuery(async () => (await db.closetItems.orderBy('customTags').uniqueKeys()) as string[], [], []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<ClosetItem | 'new' | null>(null);

  const visible = useMemo(() => filterItems(items ?? [], query, category, tag, favoritesOnly), [items, query, category, tag, favoritesOnly]);
  const sampleCount = items?.filter((i) => i.isSample).length ?? 0;

  async function remove(item: ClosetItem) {
    if (item.id != null && confirm(`Delete "${item.name}"? It will also be removed from trip and saved outfits.`)) {
      await deleteClosetItem(item.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="space-y-2">
        <input
          type="search"
          className={inputClass}
          placeholder="Search by name, color or tag…"
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
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${inputClass} sm:w-64`} value={tag ?? ''} onChange={(e) => setTag(e.target.value || null)} aria-label="Filter by tag">
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
            {customTags.length > 0 && (
              <optgroup label="Your tags">
                {customTags.map((t) => (
                  <option key={t} value={`#${t}`}>
                    #{t}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
            ★ favorites (4+)
          </Chip>
        </div>
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
                  <p className="truncate font-medium">
                    {item.name}
                    {(item.quantity ?? 1) > 1 && <span className="ml-1 text-sm font-normal text-slate-500">×{item.quantity}</span>}
                  </p>
                  <p className="text-xs capitalize text-slate-500">
                    {item.category} · {item.color || 'no color'} · warmth {item.warmth} · {item.formality} ·{' '}
                    <span className="normal-case">
                      {item.wearCount ?? 1} wear{(item.wearCount ?? 1) > 1 ? 's' : ''} per wash
                    </span>
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
              <Stars
                size="sm"
                label={`Favorite score for ${item.name}`}
                value={item.favorite ?? 0}
                onChange={(n) => db.closetItems.update(item.id!, { favorite: n, updatedAt: Date.now() })}
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {(item.customTags ?? []).map((t) => (
                  <button key={t} onClick={() => setTag(`#${t}`)} className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-800 hover:bg-indigo-200">
                    #{t}
                  </button>
                ))}
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

export function ClosetPage({ view = 'items' }: { view?: 'items' | 'outfits' }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Closet</h1>
      <ClosetTabs current={view} />
      {view === 'outfits' ? <SavedOutfitsView /> : <ItemsView />}
    </div>
  );
}
