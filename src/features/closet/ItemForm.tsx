import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import {
  ACTIVITIES,
  CATEGORIES,
  FORMALITIES,
  SUBCATEGORIES,
  SUBCATEGORY_CATEGORIES,
  WEATHER_TAGS,
  type ClosetItem,
  type Subcategory,
  type WarmthLevel,
} from '../../db/types';
import { cleanTags } from '../../db/migrate';
import { Stars } from '../../components/Stars';
import { TagInput } from '../../components/TagInput';
import { Button, ChipGroup, Field, inputClass } from '../../components/ui';
import { PhotoInput } from './PhotoInput';

type Draft = Omit<ClosetItem, 'id' | 'createdAt' | 'updatedAt' | 'isSample'>;

const EMPTY: Draft = {
  name: '',
  category: 'top',
  color: '',
  warmth: 2,
  formality: 'casual',
  weatherTags: [],
  activities: [],
  quantity: 1,
  wearCount: 1,
  favorite: 0,
  customTags: [],
};

const WARMTH_LABELS = ['', 'Very light', 'Light', 'Medium', 'Warm', 'Very warm'];

export function ItemForm({ item, onDone }: { item?: ClosetItem; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (!item) return EMPTY;
    const { name, category, color, warmth, formality, weatherTags, activities, photo, quantity = 1, wearCount = 1, favorite = 0, customTags = [], subcategory, unlimitedWear } = item;
    return { name, category, color, warmth, formality, weatherTags, activities, photo, quantity, wearCount, favorite, customTags, subcategory, unlimitedWear };
  });
  // Track whether the user explicitly changed the photo so we never accidentally
  // overwrite the stored Blob with undefined when photo wasn't touched.
  const [photoTouched, setPhotoTouched] = useState(false);
  const knownTags = useLiveQuery(async () => (await db.closetItems.orderBy('customTags').uniqueKeys()) as string[], [], []);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const now = Date.now();
    const { photo: draftPhoto, ...rest } = draft;
    const clean = {
      ...rest,
      name: rest.name.trim(),
      color: rest.color.trim(),
      quantity: Math.max(1, Math.round(rest.quantity) || 1),
      wearCount: Math.max(1, Math.round(rest.wearCount) || 1),
      favorite: Math.max(0, Math.min(5, Math.round(rest.favorite) || 0)),
      customTags: cleanTags(rest.customTags),
      subcategory: rest.subcategory ?? undefined,
      unlimitedWear: rest.unlimitedWear ?? undefined,
    };
    if (item?.id != null) {
      // Only include photo in the update when explicitly changed; spreading
      // photo: undefined into update() removes the Blob from IndexedDB.
      const photoChanges = photoTouched ? { photo: draftPhoto } : {};
      await db.closetItems.update(item.id, { ...clean, ...photoChanges, updatedAt: now });
    } else {
      await db.closetItems.add({ ...clean, photo: draftPhoto, isSample: false, createdAt: now, updatedAt: now });
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PhotoInput value={draft.photo} onChange={(b) => { set('photo', b); setPhotoTouched(true); }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">Favorite score</span>
        <Stars value={draft.favorite} onChange={(n) => set('favorite', n)} />
      </div>
      <Field label="Name">
        <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className={inputClass} value={draft.category}
            onChange={(e) => {
              set('category', e.target.value as Draft['category']);
              if (!(SUBCATEGORY_CATEGORIES as string[]).includes(e.target.value)) {
                set('subcategory', undefined);
              }
            }}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Color">
          <input className={inputClass} value={draft.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. navy" />
        </Field>
        {(SUBCATEGORY_CATEGORIES as string[]).includes(draft.category) && (
          <Field label="Type">
            <select className={inputClass} value={draft.subcategory ?? ''}
              onChange={(e) => set('subcategory', (e.target.value as Subcategory) || undefined)}>
              <option value="">— Select type —</option>
              {SUBCATEGORIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={`Warmth: ${draft.warmth} (${WARMTH_LABELS[draft.warmth]})`}>
          <input
            type="range"
            min={1}
            max={5}
            value={draft.warmth}
            onChange={(e) => set('warmth', Number(e.target.value) as WarmthLevel)}
            className="w-full accent-teal-700"
          />
        </Field>
        <Field label="Formality">
          <select className={inputClass} value={draft.formality} onChange={(e) => set('formality', e.target.value as Draft['formality'])}>
            {FORMALITIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantity owned" hint="Identical copies, e.g. 5 pairs of white socks.">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Decrease quantity"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100"
              onClick={() => set('quantity', Math.max(1, draft.quantity - 1))}>−</button>
            <input type="number" min={1} className={`${inputClass} text-center`} value={draft.quantity}
              onChange={(e) => set('quantity', Math.max(1, Number(e.target.value) || 1))} />
            <button type="button" aria-label="Increase quantity"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100"
              onClick={() => set('quantity', draft.quantity + 1)}>+</button>
          </div>
        </Field>
        <Field label="Wears before washing" hint="Tee = 1, jeans = 3, shoes/jacket = many.">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Decrease wear count" disabled={draft.unlimitedWear}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
              onClick={() => set('wearCount', Math.max(1, draft.wearCount - 1))}>−</button>
            <input type="number" min={1} className={`${inputClass} text-center`}
              value={draft.unlimitedWear ? '' : draft.wearCount}
              placeholder={draft.unlimitedWear ? '∞' : undefined}
              disabled={draft.unlimitedWear}
              onChange={(e) => set('wearCount', Math.max(1, Number(e.target.value) || 1))} />
            <button type="button" aria-label="Increase wear count" disabled={draft.unlimitedWear}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
              onClick={() => set('wearCount', draft.wearCount + 1)}>+</button>
            <button type="button" title="Unlimited wears" aria-label="Toggle unlimited wears"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border text-lg font-semibold transition-colors ${draft.unlimitedWear ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-300 bg-white text-slate-400 hover:text-slate-600'}`}
              onClick={() => set('unlimitedWear', !draft.unlimitedWear)}>∞</button>
          </div>
        </Field>
      </div>
      <Field label="Weather tags">
        <ChipGroup label="Weather tags" options={WEATHER_TAGS} value={draft.weatherTags} onChange={(v) => set('weatherTags', v)} />
      </Field>
      <Field label="Good for">
        <ChipGroup label="Activities" options={ACTIVITIES} value={draft.activities} onChange={(v) => set('activities', v)} />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Custom tags</span>
        <TagInput value={draft.customTags} onChange={(v) => set('customTags', v)} suggestions={knownTags} />
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
