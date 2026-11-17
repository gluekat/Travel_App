import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { ACTIVITIES, type GeneralItem } from '../../db/types';
import { cleanTags } from '../../db/migrate';
import { TagInput } from '../../components/TagInput';
import { suggestEmoji } from '../../lib/emoji';
import { useObjectUrl } from '../../lib/hooks';
import { PhotoInput } from './PhotoInput';
import { Button, Chip, ChipGroup, Field, Icon, Modal, inputClass } from '../../components/ui';
import { ensureGeneralLibrary } from '../packing/generalItemsService';

const EXTRA_TAG_IDEAS = ['camping', 'outdoors', 'winter', 'international'];
/** Photo or emoji badge for a general item; renders nothing when it has neither. */
export function GeneralIcon({ item, size = 'h-10 w-10' }: { item: Pick<GeneralItem, 'photo' | 'emoji' | 'name'>; size?: string }) {
  const url = useObjectUrl(item.photo);
  if (!url && !item.emoji) return null;
  return (
    <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xl`}>
      {url ? <img src={url} alt={item.name} className="h-full w-full object-cover" /> : <span aria-hidden="true">{item.emoji}</span>}
    </div>
  );
}

const isActivity = (t: string) => (ACTIVITIES as readonly string[]).includes(t);

/** Reusable general packing items (chargers, toiletries…) with Default, activity and custom tags. */
export function GeneralItemsView() {
  useEffect(() => {
    void ensureGeneralLibrary();
  }, []);
  const items = useLiveQuery(async () => (await db.generalItems.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<GeneralItem | 'new' | null>(null);

  const allTags = useMemo(() => [...new Set((items ?? []).flatMap((i) => i.tags))].sort(), [items]);
  const visible = (items ?? []).filter((i) => !tag || (tag === 'default' ? i.isDefault : i.tags.includes(tag)));

  async function remove(item: GeneralItem) {
    if (confirm(`Delete "${item.name}" from your general items?`)) await db.generalItems.delete(item.id!);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Items for the Packing List of any trip. Items tagged <strong>Default</strong> are added to every new trip automatically.
        </p>
        <Button variant="primary" onClick={() => setEditing('new')}>
          <Icon name="plus" /> Add item
        </Button>
      </div>

      {(items?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by tag">
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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <GeneralIcon item={item} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.perDay != null ? `${item.perDay} per day` : `×${item.qty ?? 1}`}</p>
                </div>
              </div>
              <div className="flex shrink-0">
                <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} title="Edit">
                  <Icon name="edit" />
                </button>
                <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => remove(item)} aria-label={`Delete ${item.name}`} title="Delete">
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.isDefault && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-medium text-teal-800">Default</span>}
              {item.tags.map((t) => (
                <button key={t} onClick={() => setTag(t)} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${isActivity(t) ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'}`}>
                  {isActivity(t) ? t : `#${t}`}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {items && items.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">No items have that tag.</p>}

      {editing && (
        <Modal title={editing === 'new' ? 'Add general item' : 'Edit general item'} onClose={() => setEditing(null)}>
          <GeneralItemForm item={editing === 'new' ? undefined : editing} knownTags={allTags.filter((t) => !isActivity(t))} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function GeneralItemForm({ item, knownTags, onDone }: { item?: GeneralItem; knownTags: string[]; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [perDay, setPerDay] = useState(item?.perDay != null);
  const [amount, setAmount] = useState(item?.perDay ?? item?.qty ?? 1);
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [photo, setPhoto] = useState<Blob | undefined>(item?.photo);
  const [photoTouched, setPhotoTouched] = useState(false);
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [activityTags, setActivityTags] = useState<string[]>(() => (item?.tags ?? []).filter(isActivity));
  const [customTags, setCustomTags] = useState<string[]>(() => (item?.tags ?? []).filter((t) => !isActivity(t)));

  const suggestions = suggestEmoji(name);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const n = Math.max(1, Math.round(amount) || 1);
    const row = {
      name: clean,
      qty: perDay ? undefined : n,
      perDay: perDay ? n : undefined,
      isDefault,
      emoji: emoji.trim() || undefined,
      tags: cleanTags([...activityTags, ...customTags]),
    };
    if (item?.id != null) await db.generalItems.update(item.id, photoTouched ? { ...row, photo } : row);
    else await db.generalItems.add({ ...row, photo, createdAt: Date.now() });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Phone charger" />
      </Field>
      <PhotoInput value={photo} onChange={(b) => { setPhoto(b); setPhotoTouched(true); }} />
      <Field label="Emoji (optional)" hint="Shown next to the name when there is no photo.">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input className={`${inputClass} w-24 text-center text-lg`} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} placeholder="🙂" aria-label="Emoji" />
            {emoji && (
              <button type="button" className="text-xs text-slate-500 hover:text-red-700" onClick={() => setEmoji('')}>
                Clear
              </button>
            )}
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggested emoji">
              <span className="text-xs text-slate-500">Suggestions:</span>
              {suggestions.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} className={`rounded-lg border px-2 py-0.5 text-lg ${emoji === e ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <input type="number" min={1} className={inputClass} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label="Counted">
          <select className={inputClass} value={perDay ? 'perDay' : 'fixed'} onChange={(e) => setPerDay(e.target.value === 'perDay')}>
            <option value="fixed">Fixed amount per trip</option>
            <option value="perDay">Per day of the trip</option>
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-700" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        <span>
          <span className="font-medium">Default</span> — automatically add to the Packing List of every new trip
        </span>
      </label>
      <Field label="Trip types">
        <ChipGroup label="Trip type tags" options={ACTIVITIES} value={activityTags as (typeof ACTIVITIES)[number][]} onChange={setActivityTags} />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Custom tags</span>
        <TagInput value={customTags} onChange={setCustomTags} suggestions={[...new Set([...knownTags, ...EXTRA_TAG_IDEAS])]} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {item ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
