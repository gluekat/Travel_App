import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { addDays, dateRange, formatDay, todayISO } from '../../lib/dates';
import { navigate } from '../../lib/router';
import type { Place } from '../../weather/openMeteo';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { PrivacyNote } from '../settings/PrivacyNote';
import { PlaceSearch } from './PlaceSearch';
import { createTrip, MAX_TRIP_DAYS } from './tripService';

function NewTripForm({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place>();
  const [start, setStart] = useState(() => addDays(todayISO(), 3));
  const [end, setEnd] = useState(() => addDays(todayISO(), 7));
  const [error, setError] = useState<string>();
  const days = dateRange(start, end).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (!place && !confirm('No location selected, so weather will need to be entered manually. Save anyway?')) return;
    try {
      const id = await createTrip(place?.name ?? query, place, start, end);
      onDone();
      navigate(`/trips/${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Destination">
        <PlaceSearch query={query} onQuery={setQuery} selected={place} onSelect={setPlace} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input
            type="date"
            className={inputClass}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value > end) setEnd(e.target.value);
            }}
            required
          />
        </Field>
        <Field label="End date">
          <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <p className="text-sm text-slate-600">
        {days > 0 ? `${days} day${days > 1 ? 's' : ''}` : 'Invalid dates'}
        {days > MAX_TRIP_DAYS && ` (max ${MAX_TRIP_DAYS})`}
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <PrivacyNote compact />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={days < 1 || days > MAX_TRIP_DAYS || !query.trim()}>
          Create trip
        </Button>
      </div>
    </form>
  );
}

export function TripsPage() {
  const trips = useLiveQuery(() => db.trips.orderBy('startDate').toArray(), []);
  const itemCount = useLiveQuery(() => db.closetItems.count(), []);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trips</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> New trip
        </Button>
      </div>
      {itemCount === 0 && (
        <Banner tone="info">
          Your closet is empty. <a className="font-medium underline" href="#/closet">Add some clothes</a> so PackWise can suggest outfits.
        </Banner>
      )}
      {trips && trips.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No trips yet. Create one to get weather-aware outfit suggestions.
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips?.map((t) => (
          <li key={t.id}>
            <a href={`#/trips/${t.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-400">
              <p className="font-semibold">{t.placeLabel ?? t.destination}</p>
              <p className="text-sm text-slate-600">
                {formatDay(t.startDate)} to {formatDay(t.endDate)} · {dateRange(t.startDate, t.endDate).length} days
              </p>
            </a>
          </li>
        ))}
      </ul>
      {creating && (
        <Modal title="New trip" onClose={() => setCreating(false)}>
          <NewTripForm onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
