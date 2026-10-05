import { useState } from 'react';
import { geocode, type Place } from '../../weather/openMeteo';
import { useOnline } from '../../lib/hooks';
import { Button, inputClass } from '../../components/ui';

/** Destination lookup via Open-Meteo geocoding (sends only the typed name). */
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

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await geocode(query);
      setResults(r);
      if (!r.length) setError('No places found. Try a different spelling or a nearby city.');
    } catch (e) {
      setError(`${(e as Error).message}. You can still save the trip and enter weather manually.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={query}
          placeholder="City, e.g. Lisbon"
          onChange={(e) => {
            onQuery(e.target.value);
            onSelect(undefined);
            setResults(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          aria-label="Destination"
          required
        />
        <Button onClick={search} disabled={busy || !online || !query.trim()}>
          {busy ? 'Searching…' : 'Find'}
        </Button>
      </div>
      {!online && <p className="text-xs text-amber-800">Offline: location lookup unavailable. You can enter weather manually.</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {selected && <p className="text-sm text-teal-800">📍 {selected.label}</p>}
      {results && results.length > 0 && !selected && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onSelect(p)}>
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
