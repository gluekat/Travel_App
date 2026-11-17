import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteClosetItem } from '../../db/schema';
import { CATEGORIES, WEATHER_TAGS, ACTIVITIES, type Category, type ClosetItem } from '../../db/types';
import { clearSampleItems, seedSampleWardrobe } from '../../db/seed';
import { Stars } from '../../components/Stars';
import { Tabs } from '../../components/Tabs';
import { Button, Chip, Icon, Modal, inputClass } from '../../components/ui';
import { ItemThumb } from '../../components/ItemThumb';
import { ItemForm, type ItemFormHandle } from './ItemForm';
import { SavedOutfitsView } from './SavedOutfitsView';
import { GeneralItemsView } from './GeneralItemsView';

export type ClosetView = 'items' | 'outfits' | 'accessories' | 'general';

const isAccessory = (i: ClosetItem) => i.category === 'accessory' || i.subcategory === 'accessories';

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

export function ClosetTabs({ current }: { current: ClosetView }) {
  const items = useLiveQuery(() => db.closetItems.count(), []);
  const outfits = useLiveQuery(() => db.savedOutfits.count(), []);
  const accessories = useLiveQuery(() => db.closetItems.filter(isAccessory).count(), []);
  const general = useLiveQuery(() => db.generalItems.count(), []);
  return (
    <Tabs
      label="Closet sections"
      current={current}
      tabs={[
        { id: 'items', label: `Items${items != null ? ` (${items})` : ''}`, href: '#/closet' },
        { id: 'accessories', label: `Accessories${accessories != null ? ` (${accessories})` : ''}`, href: '#/closet/accessories' },
        { id: 'general', label: `General${general != null ? ` (${general})` : ''}`, href: '#/closet/general' },
        { id: 'outfits', label: `Outfits${outfits != null ? ` (${outfits})` : ''}`, href: '#/closet/outfits' },
      ]}
    />
  );
}

function ItemsView({ scope = 'all' }: { scope?: 'all' | 'accessories' }) {
  const allItems = useLiveQuery(() => db.closetItems.orderBy('updatedAt').reverse().toArray(), []);
  const items = useMemo(() => (scope === 'accessories' ? allItems?.filter(isAccessory) : allItems), [allItems, scope]);
  const customTags = useLiveQuery(async () => (await db.closetItems.orderBy('customTags').uniqueKeys()) as string[], [], []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<'default' | 'name' | 'category' | 'favorite' | 'warmth' | 'formality' | 'weather' | 'activity' | 'customtags'>('default');
  const [editing, setEditing] = useState<ClosetItem | 'new' | null>(null);
  const editFormRef = useRef<ItemFormHandle>(null);

  const visible = useMemo(() => {
    const filtered = filterItems(items ?? [], query, category, tag, favoritesOnly);
    if (sort === 'default') return filtered;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'category': return a.category.localeCompare(b.category);
        case 'favorite': return (b.favorite ?? 0) - (a.favorite ?? 0);
        case 'warmth': return b.warmth - a.warmth;
        case 'formality': {
          const order: Record<string, number> = { casual: 0, 'smart casual': 1, formal: 2 };
          return (order[a.formality] ?? 0) - (order[b.formality] ?? 0);
        }
        case 'weather': return b.weatherTags.length - a.weatherTags.length;
        case 'activity': return b.activities.length - a.activities.length;
        case 'customtags': return (b.customTags?.length ?? 0) - (a.customTags?.length ?? 0);
        default: return 0;
      }
    });
  }, [items, query, category, tag, favoritesOnly, sort]);
  const sampleCount = items?.filter((i) => i.isSample).length ?? 0;

  async function remove(item: ClosetItem) {
    if (item.id != null && confirm(`Delete "${item.name}"? It will also be removed from trip and saved outfits.`)) {
      await deleteClosetItem(item.id);
    }
  }

  async function duplicate(item: ClosetItem) {
    const { id: _id, ...rest } = item;
    const now = Date.now();
    await db.closetItems.add({ ...rest, name: `${item.name} (duplicate)`, isSample: false, createdAt: now, updatedAt: now });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {scope === 'all' && sampleCount > 0 && (
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
        {scope === 'all' && (
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
        )}
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
          <select className={`${inputClass} sm:w-44`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
            <option value="default">Sort: Date added</option>
            <option value="name">Sort: Name A→Z</option>
            <option value="category">Sort: Category</option>
            <option value="favorite">Sort: Favorite ↓</option>
            <option value="warmth">Sort: Warmth ↓</option>
            <option value="formality">Sort: Formality</option>
            <option value="weather">Sort: Weather tags</option>
            <option value="activity">Sort: Activity tags</option>
            <option value="customtags">Sort: Custom tags</option>
          </select>
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
            ★ favorites (4+)
          </Chip>
        </div>
      </div>

      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          {scope === 'accessories' ? (
            'No accessories yet. Add a hat, belt, scarf, sunglasses…'
          ) : (
            <>
              Your closet is empty. Add your first item, or{' '}
              <button className="font-medium text-teal-700 underline" onClick={() => seedSampleWardrobe()}>
                load a sample wardrobe
              </button>
              .
            </>
          )}
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
                    {item.category}{item.subcategory ? ` · ${item.subcategory}` : ''} · {item.color || 'no color'} · warmth {item.warmth} · {item.formality} ·{' '}
                    <span className="normal-case">
                      {item.unlimitedWear ? '∞ wears per wash' : `${item.wearCount ?? 1} wear${(item.wearCount ?? 1) > 1 ? 's' : ''} per wash`}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} title="Edit">
                    <Icon name="edit" />
                  </button>
                  <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => duplicate(item)} aria-label={`Duplicate ${item.name}`} title="Duplicate">
                    <Icon name="copy" />
                  </button>
                  <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => remove(item)} aria-label={`Delete ${item.name}`} title="Delete">
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
                {item.isSample && (
                  <button
                    onClick={() => db.closetItems.update(item.id!, { isSample: false, updatedAt: Date.now() })}
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 hover:bg-amber-200"
                    title="Remove sample tag"
                  >
                    sample ×
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items && items.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No items match these filters.</p>}

      {editing && (
        <Modal
          title={editing === 'new' ? (scope === 'accessories' ? 'Add accessory' : 'Add closet item') : 'Edit item'}
          onClose={() => {
            if (editing !== 'new') {
              void editFormRef.current?.save();
            } else {
              setEditing(null);
            }
          }}
        >
          <ItemForm
            ref={editing === 'new' ? undefined : editFormRef}
            item={editing === 'new' ? undefined : editing}
            defaultCategory={scope === 'accessories' ? 'accessory' : undefined}
            onDone={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

export function ClosetPage({ view = 'items' }: { view?: ClosetView }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Closet</h1>
      <ClosetTabs current={view} />
      {view === 'outfits' ? <SavedOutfitsView /> : view === 'general' ? <GeneralItemsView /> : <ItemsView key={view} scope={view === 'accessories' ? 'accessories' : 'all'} />}
    </div>
  );
}
