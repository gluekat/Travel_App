import { useId, useState } from 'react';
import { cleanTags } from '../db/migrate';
import { inputClass } from './ui';

/** Free-text tag editor with suggestions from tags you've used before. */
export function TagInput({ value, onChange, suggestions = [] }: { value: string[]; onChange: (tags: string[]) => void; suggestions?: string[] }) {
  const [text, setText] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const next = cleanTags([...value, ...raw.split(',')]);
    if (next.length !== value.length) onChange(next);
    setText('');
  };
  const unused = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-800">
              #{t}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} className="rounded-full px-1 hover:bg-indigo-200" aria-label={`Remove tag ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className={inputClass}
        value={text}
        list={listId}
        placeholder="Type a tag and press Enter"
        aria-label="Add custom tag"
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      <datalist id={listId}>
        {unused.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unused.slice(0, 12).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-indigo-300 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-50">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
