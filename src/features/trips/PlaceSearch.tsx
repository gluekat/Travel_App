import { useEffect, useRef, useState } from 'react';
import { geocode, type Place } from '../../weather/openMeteo';
import { useOnline } from '../../lib/hooks';
import { inputClass } from '../../components/ui';

/** Destination lookup via Open-Meteo geocoding — searches automatically as you type. */
export function PlaceSearch({
  query,
  onQuery,
  selected,
  onSelect,
}: {
  query: string;
  onQuery: (q: string) => void;
  selected?: Place;
  onSelect: (p?: Place) => void;
}) {
  const online = useOnline();
  const [results, setResults] = useState<Place[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function search(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await geocode(trimmed);
      setResults(r);
      if (!r.length) setError('No places found. Try a different spelling or a nearby city.');
    } catch (e) {
      setError(`${(e as Error).message}. You can still save the trip and enter weather manually.`);
    } finally {
      setBusy(false);
    }
  }

  function handleInput(value: string) {
    onQuery(value);
    onSelect(undefined);
    setResults(undefined);
    setError(undefined);
    clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => void search(value), 500);
    }
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder="City, e.g. Lisbon"
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              clearTimeout(debounceRef.current);
              void search(query);
            }
          }}
          aria-label="Destination"
          required
        />
        {busy && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Searching…
          </span>
        )}
      </div>
      {!online && (
        <p className="text-xs text-amber-800">
          Offline: location lookup unavailable. You can enter weather manually.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {selected && <p className="text-sm text-teal-800">📍 {selected.label}</p>}
      {results && results.length > 0 && !selected && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => onSelect(p)}
              >
                {p.label}
                <span className="ml-2 text-xs text-slate-400">
                  {p.lat.toFixed(2)}, {p.lon.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
