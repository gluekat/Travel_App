import { useEffect, useRef, useState } from 'react';
import { geocode, type Place } from '../weather/openMeteo';
import { inputClass } from './ui';

interface Props {
  value: string;
  onChange: (label: string, lat?: number, lon?: number) => void;
  placeholder?: string;
}

/**
 * Location search input backed by Open-Meteo geocoding.
 * Calls onChange on every keystroke (free text) and on selection (with coords).
 */
export function LocationInput({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Place[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync query when value is updated externally (e.g. pre-fill from parent state)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  async function search(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await geocode(trimmed);
      setResults(r);
      if (!r.length) setError('No places found. Try a different spelling.');
    } catch {
      setError('Search unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function handleChange(text: string) {
    setQuery(text);
    setResults(undefined);
    setError(undefined);
    onChange(text, undefined, undefined);
    clearTimeout(debounceRef.current);
    if (text.trim().length >= 2) {
      debounceRef.current = setTimeout(() => void search(text), 500);
    }
  }

  function pick(p: Place) {
    setQuery(p.label);
    setResults(undefined);
    setError(undefined);
    onChange(p.label, p.lat, p.lon);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClass}
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceRef.current);
            void search(query);
          }
        }}
        onBlur={() => setTimeout(() => setResults(undefined), 150)}
        autoComplete="off"
      />
      {busy && (
        <span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-400">
          Searching…
        </span>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {results && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={() => pick(p)}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
