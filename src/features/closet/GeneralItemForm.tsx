import { forwardRef, useImperativeHandle, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { ACTIVITIES, CATEGORIES, GENERAL_CATEGORIES, generalCategory, guessGeneralCategory, type Category, type GeneralCategory, type GeneralItem } from '../../db/types';
import { cleanTags } from '../../db/migrate';
import { TagInput } from '../../components/TagInput';
import { suggestEmoji } from '../../lib/emoji';
import { useObjectUrl } from '../../lib/hooks';
import { PhotoInput } from './PhotoInput';
import { Button, ChipGroup, Field, inputClass } from '../../components/ui';
import type { ItemFormHandle } from './ItemForm';

const EXTRA_TAG_IDEAS = ['camping', 'outdoors', 'winter', 'international'];
export const isActivity = (t: string) => (ACTIVITIES as readonly string[]).includes(t);

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


type Props = {
  item?: GeneralItem;
  /** Name typed before switching to this form from another category. */
  initialName?: string;
  /** New items can switch to any other category; the parent swaps in the matching form. */
  onKindChange?: (category: Category, name: string) => void;
  onDone: () => void;
};

/** Add/edit a general packing item. The "Category" picker is shared with closet items; "General" shows this form. */
export const GeneralItemForm = forwardRef<ItemFormHandle, Props>(function GeneralItemForm({ item, initialName, onKindChange, onDone }, ref) {
  const knownTags = useLiveQuery(async () => [...new Set((await db.generalItems.toArray()).flatMap((i) => i.tags))].filter((t) => !isActivity(t)).sort(), [], [] as string[]);
  const [name, setName] = useState(item?.name ?? initialName ?? '');
  const [perDay, setPerDay] = useState(item?.perDay != null);
  const [amount, setAmount] = useState(item?.perDay ?? item?.qty ?? 1);
  const [category, setCategory] = useState<GeneralCategory | undefined>(item ? generalCategory(item) : undefined);
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [photo, setPhoto] = useState<Blob | undefined>(item?.photo);
  const [photoTouched, setPhotoTouched] = useState(false);
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [activityTags, setActivityTags] = useState<string[]>(() => (item?.tags ?? []).filter(isActivity));
  const [customTags, setCustomTags] = useState<string[]>(() => (item?.tags ?? []).filter((t) => !isActivity(t)));

  const suggestions = suggestEmoji(name);

  async function save() {
    const clean = name.trim();
    if (!clean) return;
    const n = Math.max(1, Math.round(amount) || 1);
    const row = {
      name: clean,
      qty: perDay ? undefined : n,
      perDay: perDay ? n : undefined,
      isDefault,
      category: category ?? guessGeneralCategory(clean),
      emoji: emoji.trim() || undefined,
      tags: cleanTags([...activityTags, ...customTags]),
    };
    if (item?.id != null) await db.generalItems.update(item.id, photoTouched ? { ...row, photo } : row);
    else await db.generalItems.add({ ...row, photo, createdAt: Date.now() });
    onDone();
  }

  useImperativeHandle(ref, () => ({ save }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    await save();
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
      {!item && onKindChange && (
        <Field label="Category">
          <select className={inputClass} value="general" onChange={(e) => onKindChange(e.target.value as Category, name)} aria-label="Category">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="general">general</option>
          </select>
        </Field>
      )}
      <Field label="Sub category" hint={!category && name.trim() ? `Suggested: ${guessGeneralCategory(name)}` : undefined}>
        <select className={inputClass} value={category ?? guessGeneralCategory(name)} onChange={(e) => setCategory(e.target.value as GeneralCategory)}>
          {GENERAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
});