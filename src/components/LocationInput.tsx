import { useRef, useState } from 'react';
import { searchAddress, type NominatimResult } from '../weather/nominatim';
import { inputClass } from './ui';

interface Props {
  value: string;
  onChange: (label: string, lat?: number, lon?: number) => void;
  placeholder?: string;
}

export function LocationInput({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleChange(text: string) {
    setQuery(text);
    onChange(text, undefined, undefined);
    clearTimeout(timer.current);
    if (text.length < 2) { setResults([]); return; }
    timer.current = setTimeout(() => {
      setBusy(true);
      searchAddress(text)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 500);
  }

  function pick(r: NominatimResult) {
    setQuery(r.label);
    setResults([]);
    onChange(r.label, r.lat, r.lon);
  }

  const city = (label: string) => label.split(',')[0]?.trim() ?? label;
  const rest = (label: string) => label.split(',').slice(1).join(',').trim();

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClass}
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setResults([]), 150)}
        autoComplete="off"
      />
      {busy && <span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-400">…</span>}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={() => pick(r)}
              >
                <span className="font-medium">{city(r.label)}</span>
                {rest(r.label) && (
                  <span className="ml-1 text-xs text-slate-500">{rest(r.label)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
