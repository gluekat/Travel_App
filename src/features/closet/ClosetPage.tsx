import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteClosetItem } from '../../db/schema';
import { TRASH_DAYS, ACCESSORY_TYPES, ACTIVITIES, CATEGORIES, WEATHER_TAGS, type ClosetItem } from '../../db/types';
import { clearSampleItems, seedSampleWardrobe } from '../../db/seed';
import { Stars } from '../../components/Stars';
import { Tabs } from '../../components/Tabs';
import { Button, Chip, Icon, inputClass } from '../../components/ui';
import { ItemThumb } from '../../components/ItemThumb';
import { SavedOutfitsView } from './SavedOutfitsView';
import { GeneralItemCard, GeneralItemsView, ItemEditorModal, confirmDeleteGeneralItem } from './GeneralItemsView';
import type { EditorTarget } from './ItemEditor';
import { ensureGeneralLibrary } from '../packing/generalItemsService';
import { groupEntries, inScope, isAccessory, isClothing, isShoes, matchesFilters, sortEntries, type Entry, type GroupBy, type Scope, type SortKey } from './closetScopes';

export type ClosetView = 'items' | 'clothing' | 'shoes' | 'accessories' | 'general' | 'outfits';

export const isClosetView = (v?: string): v is ClosetView => ['outfits', 'clothing', 'shoes', 'accessories', 'general'].includes(v ?? '');

const SCOPE_OF: Partial<Record<ClosetView, Scope>> = { items: 'all', clothing: 'clothing', shoes: 'shoes', accessories: 'accessories' };
const CLOTHING_CATEGORIES = CATEGORIES.filter((c) => c !== 'shoes' && c !== 'accessory');

export function ClosetTabs({ current, basePath = '#/closet' }: { current: ClosetView; basePath?: string }) {
  const counts = useLiveQuery(async () => {
    const [closet, general, outfits] = await Promise.all([db.closetItems.toArray(), db.generalItems.count(), db.savedOutfits.count()]);
    return { all: closet.length + general, clothing: closet.filter(isClothing).length, shoes: closet.filter(isShoes).length, accessories: closet.filter(isAccessory).length, general, outfits };
  }, []);
  const n = (v?: number) => (v != null ? ` (${v})` : '');
  return (
    <Tabs
      label="Closet sections"
      current={current}
      tabs={[
        { id: 'items', label: `Items${n(counts?.all)}`, href: basePath },
        { id: 'clothing', label: `Clothing${n(counts?.clothing)}`, href: `${basePath}/clothing` },
        { id: 'shoes', label: `Shoes${n(counts?.shoes)}`, href: `${basePath}/shoes` },
        { id: 'accessories', label: `Accessories${n(counts?.accessories)}`, href: `${basePath}/accessories` },
        { id: 'general', label: `General${n(counts?.general)}`, href: `${basePath}/general` },
        { id: 'outfits', label: `Outfits${n(counts?.outfits)}`, href: `${basePath}/outfits` },
      ]}
    />
  );
}

const SCOPE_TEXT: Record<Scope, { empty: string; addCategory?: ClosetItem['category'] }> = {
  all: { empty: 'Your closet is empty.' },
  clothing: { empty: 'No clothing yet. Tops, bottoms, dresses, outerwear and more appear here.' },
  shoes: { empty: 'No shoes yet.', addCategory: 'shoes' },
  accessories: { empty: 'No accessories yet. Add a hat, scarf, gloves, belt, purse, bag or jewelry.', addCategory: 'accessory' },
};

function ClosetItemCard({ item, onEdit, onTag }: { item: ClosetItem; onEdit: () => void; onTag: (t: string) => void }) {
  async function remove() {
    if (item.id != null && confirm(`Delete "${item.name}"? It is removed from trip and saved outfits too, and can be restored from the Trash for ${TRASH_DAYS} days.`)) await deleteClosetItem(item.id);
  }
  async function duplicate() {
    const { id: _id, ...rest } = item;
    const now = Date.now();
    await db.closetItems.add({ ...rest, name: `${item.name} (duplicate)`, isSample: false, createdAt: now, updatedAt: now });
  }
  const details = [item.size && `size ${item.size}`, item.material].filter(Boolean).join(' · ');
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <ItemThumb item={item} size="h-16 w-16" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {item.name}
              {(item.quantity ?? 1) > 1 && <span className="ml-1 text-sm font-normal text-slate-500">×{item.quantity}</span>}
            </p>
            <p className="text-xs capitalize text-slate-500">
              {item.category}
              {item.accessoryType ? ` · ${item.accessoryType}` : ''}
              {item.subcategory ? ` · ${item.subcategory}` : ''} · {item.color || 'no color'} · {item.warmth > 0 ? `warmth ${item.warmth}` : 'no warmth'} · {item.formality} ·{' '}
              <span className="normal-case">{item.unlimitedWear ? '∞ wears per wash' : `${item.wearCount ?? 1} wear${(item.wearCount ?? 1) > 1 ? 's' : ''} per wash`}</span>
            </p>
            {details && <p className="text-xs text-slate-500">{details}</p>}
            {item.notes && <p className="line-clamp-2 text-xs italic text-slate-400">{item.notes}</p>}
          </div>
          <div className="flex shrink-0">
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={onEdit} aria-label={`Edit ${item.name}`} title="Edit">
              <Icon name="edit" />
            </button>
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => void duplicate()} aria-label={`Duplicate ${item.name}`} title="Duplicate">
              <Icon name="copy" />
            </button>
            <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => void remove()} aria-label={`Delete ${item.name}`} title="Delete">
              <Icon name="trash" />
            </button>
          </div>
        </div>
        <Stars size="sm" label={`Favorite score for ${item.name}`} value={item.favorite ?? 0} onChange={(v) => db.closetItems.update(item.id!, { favorite: v, updatedAt: Date.now() })} />
        <div className="mt-1 flex flex-wrap gap-1">
          {(item.customTags ?? []).map((t) => (
            <button key={t} onClick={() => onTag(`#${t}`)} className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-800 hover:bg-indigo-200">
              #{t}
            </button>
          ))}
          {[...item.weatherTags, ...item.activities].map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {t}
            </span>
          ))}
          {item.isSample && (
            <button onClick={() => db.closetItems.update(item.id!, { isSample: false, updatedAt: Date.now() })} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 hover:bg-amber-200" title="Remove sample tag">
              sample ×
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function ItemsView({ scope }: { scope: Scope }) {
  useEffect(() => {
    if (scope === 'all') void ensureGeneralLibrary();
  }, [scope]);
  const closetItems = useLiveQuery(() => db.closetItems.toArray(), []);
  const generalItems = useLiveQuery(() => db.generalItems.toArray(), []);
  const customTags = useMemo(
    () => [...new Set([...(closetItems ?? []).flatMap((i) => i.customTags ?? []), ...(scope === 'all' ? (generalItems ?? []).flatMap((g) => g.tags).filter((t) => !(ACTIVITIES as readonly string[]).includes(t)) : [])])].sort(),
    [closetItems, generalItems, scope],
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [accessoryType, setAccessoryType] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('default');
  const [group, setGroup] = useState<GroupBy>(scope === 'accessories' ? 'type' : 'none');
  const [editing, setEditing] = useState<EditorTarget | null>(null);

  const entries = useMemo<Entry[]>(
    () => [...(closetItems ?? []).map((item) => ({ kind: 'closet' as const, item })), ...(scope === 'all' ? (generalItems ?? []).map((item) => ({ kind: 'general' as const, item })) : [])].filter((e) => inScope(e, scope)),
    [closetItems, generalItems, scope],
  );
  const visible = useMemo(() => sortEntries(entries.filter((e) => matchesFilters(e, { query, category, tag, favoritesOnly, accessoryType })), sort), [entries, query, category, tag, favoritesOnly, accessoryType, sort]);
  const groups = useMemo(() => groupEntries(visible, group), [visible, group]);
  const sampleCount = closetItems?.filter((i) => i.isSample).length ?? 0;
  const text = SCOPE_TEXT[scope];
  const categoryChips = scope === 'all' ? [...CATEGORIES, 'general'] : scope === 'clothing' ? CLOTHING_CATEGORIES : [];
  const groupOptions: { value: GroupBy; label: string }[] =
    scope === 'accessories' ? [{ value: 'none', label: 'Group: None' }, { value: 'type', label: 'Group: Type' }] : scope === 'shoes' ? [] : [{ value: 'none', label: 'Group: None' }, { value: 'category', label: 'Group: Category' }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {scope === 'all' && sampleCount > 0 && (
          <Button variant="danger" onClick={async () => confirm(`Remove all ${sampleCount} sample items?`) && (await clearSampleItems())}>
            Clear samples
          </Button>
        )}
        <Button variant="primary" onClick={() => setEditing({ kind: 'closet' })}>
          <Icon name="plus" /> Add item
        </Button>
      </div>

      <div className="space-y-2">
        <input type="search" className={inputClass} placeholder="Search by name, color, size, material or tag…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search closet" />
        {categoryChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Filter by category">
            <Chip active={!category} onClick={() => setCategory(null)}>
              all
            </Chip>
            {categoryChips.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
        {scope === 'accessories' && (
          <div className="flex flex-wrap gap-1.5" aria-label="Filter by accessory type">
            <Chip active={!accessoryType} onClick={() => setAccessoryType(null)}>
              all
            </Chip>
            {ACCESSORY_TYPES.map((t) => (
              <Chip key={t} active={accessoryType === t} onClick={() => setAccessoryType(accessoryType === t ? null : t)}>
                {t}
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
          <select className={`${inputClass} sm:w-44`} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
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
          {groupOptions.length > 0 && (
            <select className={`${inputClass} sm:w-44`} value={group} onChange={(e) => setGroup(e.target.value as GroupBy)} aria-label="Group by">
              {groupOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
            ★ favorites (4+)
          </Chip>
        </div>
      </div>

      {closetItems && (scope === 'all' ? closetItems.length === 0 : entries.length === 0) && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          {text.empty}
          {scope === 'all' && (
            <>
              {' '}
              Add your first item, or{' '}
              <button className="font-medium text-teal-700 underline" onClick={() => seedSampleWardrobe()}>
                load a sample wardrobe
              </button>
              .
            </>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label ?? 'all'} className="space-y-2" aria-label={g.label ?? 'Items'}>
          {g.label && (
            <h2 className="text-sm font-semibold capitalize text-slate-700">
              {g.label} <span className="font-normal text-slate-400">({g.entries.length})</span>
            </h2>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.entries.map((e) =>
              e.kind === 'closet' ? (
                <ClosetItemCard key={`c${e.item.id}`} item={e.item} onEdit={() => setEditing({ kind: 'closet', item: e.item })} onTag={setTag} />
              ) : (
                <GeneralItemCard key={`g${e.item.id}`} item={e.item} onEdit={() => setEditing({ kind: 'general', item: e.item })} onDelete={() => void confirmDeleteGeneralItem(e.item)} onTag={setTag} />
              ),
            )}
          </ul>
        </section>
      ))}
      {entries.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No items match these filters.</p>}

      {editing && <ItemEditorModal target={editing} defaultCategory={text.addCategory} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** The closet. `basePath` lets it be embedded under a trip (e.g. #/trips/3/closet) with its own tab links. */
export function ClosetPage({ view = 'items', basePath = '#/closet', embedded = false }: { view?: ClosetView; basePath?: string; embedded?: boolean }) {
  const scope = SCOPE_OF[view];
  return (
    <div className="space-y-4">
      {!embedded && <h1 className="text-xl font-semibold">Closet</h1>}
      <ClosetTabs current={view} basePath={basePath} />
      {view === 'outfits' ? <SavedOutfitsView /> : view === 'general' ? <GeneralItemsView /> : <ItemsView key={view} scope={scope ?? 'all'} />}
    </div>
  );
}
