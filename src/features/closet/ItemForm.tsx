import { useState, type FormEvent } from 'react';
import { db } from '../../db/schema';
import {
  ACTIVITIES,
  CATEGORIES,
  FORMALITIES,
  WEATHER_TAGS,
  type ClosetItem,
  type WarmthLevel,
} from '../../db/types';
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
};

const WARMTH_LABELS = ['', 'Very light', 'Light', 'Medium', 'Warm', 'Very warm'];

export function ItemForm({ item, onDone }: { item?: ClosetItem; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (!item) return EMPTY;
    const { name, category, color, warmth, formality, weatherTags, activities, photo } = item;
    return { name, category, color, warmth, formality, weatherTags, activities, photo };
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const now = Date.now();
    const clean = { ...draft, name: draft.name.trim(), color: draft.color.trim() };
    if (item?.id != null) {
      await db.closetItems.update(item.id, { ...clean, updatedAt: now });
    } else {
      await db.closetItems.add({ ...clean, isSample: false, createdAt: now, updatedAt: now });
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PhotoInput value={draft.photo} onChange={(b) => set('photo', b)} />
      <Field label="Name">
        <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className={inputClass} value={draft.category} onChange={(e) => set('category', e.target.value as Draft['category'])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Color">
          <input className={inputClass} value={draft.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. navy" />
        </Field>
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
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Weather tags">
        <ChipGroup label="Weather tags" options={WEATHER_TAGS} value={draft.weatherTags} onChange={(v) => set('weatherTags', v)} />
      </Field>
      <Field label="Good for">
        <ChipGroup label="Activities" options={ACTIVITIES} value={draft.activities} onChange={(v) => set('activities', v)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">
          {item ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
