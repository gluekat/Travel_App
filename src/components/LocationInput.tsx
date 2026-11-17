import { useEffect, useRef, useState } from 'react';
import { geocode } from '../weather/openMeteo';
import { searchAirportsOnline, searchPOI } from '../weather/photon';
import { airportLabel, searchAirports } from '../lib/airports';
import { inputClass } from './ui';

interface SearchResult {
  /** Bold primary line in the dropdown. */
  name: string;
  /** Dim secondary line (address / region). */
  detail: string;
  /** Full string saved to the field. */
  label: string;
  lat: number;
  lon: number;
}

interface Props {
  value: string;
  onChange: (label: string, lat?: number, lon?: number) => void;
  placeholder?: string;
  /**
   * 'place' (default) — city / region search via Open-Meteo (same backend
   *   as trip creation; best for transport from/to, home location).
   * 'poi' — business name / address search via Nominatim (best for
   *   activity locations: restaurants, museums, landmarks).
   * 'airport' — airports by IATA code, name or city: a bundled list of major
   *   airports first, then Nominatim for smaller ones.
   */
  mode?: 'place' | 'poi' | 'airport';
  /** When mode='poi', bias results toward this location (trip destination). */
  near?: { lat: number; lon: number };
}

async function runSearch(
  query: string,
  mode: 'place' | 'poi' | 'airport',
  near?: { lat: number; lon: number },
): Promise<SearchResult[]> {
  if (mode === 'airport') {
    const local = searchAirports(query).map((a) => ({
      name: `${a.code} – ${a.name}`,
      detail: [a.city, a.country].filter(Boolean).join(', '),
      label: airportLabel(a),
      lat: a.lat,
      lon: a.lon,
    }));
    if (local.length >= 5) return local;
    const online = await searchAirportsOnline(query);
    const seen = new Set(local.map((l) => l.label.slice(0, 3)));
    const extra = online
      .filter((o) => !o.code || !seen.has(o.code))
      .map((o) => ({ name: o.label, detail: '', label: o.label, lat: o.lat, lon: o.lon }));
    return [...local, ...extra];
  }
  if (mode === 'poi') {
    const results = await searchPOI(query, near);
    return results.map((r) => ({ name: r.name, detail: r.address, label: r.label, lat: r.lat, lon: r.lon }));
  }
  const results = await geocode(query);
  return results.map((r) => ({
    name: r.name,
    detail: r.label.slice(r.name.length).replace(/^,\s*/, ''),
    label: r.label,
    lat: r.lat,
    lon: r.lon,
  }));
}

/**
 * Location search input.
 * Calls onChange on every keystroke (free text) and on selection (with coords).
 */
export function LocationInput({ value, onChange, placeholder, mode = 'place', near }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>();
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
      const r = await runSearch(trimmed, mode, near);
      setResults(r);
      if (!r.length) setError('No results found. Try a different spelling.');
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

  function pick(r: SearchResult) {
    setQuery(r.label);
    setResults(undefined);
    setError(undefined);
    onChange(r.label, r.lat, r.lon);
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
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onMouseDown={() => pick(r)}
              >
                <span className="font-medium">{r.name}</span>
                {r.detail && (
                  <span className="ml-1 text-xs text-slate-500">{r.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
