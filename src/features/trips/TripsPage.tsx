import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteTrip } from '../../db/schema';
import type { Trip } from '../../db/types';
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

function tripLabel(t: Trip): string {
  return t.name ?? t.placeLabel ?? t.destination;
}

function classify(t: Trip, today: string): 'current' | 'upcoming' | 'past' {
  if (t.endDate < today) return 'past';
  if (t.startDate > today) return 'upcoming';
  return 'current';
}

function TripCard({ trip, onDelete }: { trip: Trip; onDelete: () => void }) {
  const days = dateRange(trip.startDate, trip.endDate).length;
  return (
    <li className="flex items-stretch gap-0 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-teal-400">
      <a href={`#/trips/${trip.id}`} className="block min-w-0 flex-1 p-4">
        <p className="truncate font-semibold">{tripLabel(trip)}</p>
        <p className="text-sm text-slate-600">
          {formatDay(trip.startDate)} to {formatDay(trip.endDate)} · {days} day{days !== 1 ? 's' : ''}
        </p>
      </a>
      <button
        type="button"
        aria-label="Delete trip"
        className="rounded-r-xl border-l border-slate-200 px-3 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
      >
        <Icon name="trash" />
      </button>
    </li>
  );
}

function TripSection({ title, trips, today }: { title: string; trips: Trip[]; today: string }) {
  if (trips.length === 0) return null;
  void today;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips.map((t) => (
          <TripCard
            key={t.id}
            trip={t}
            onDelete={() => {
              if (confirm(`Delete "${tripLabel(t)}" and its outfits and packing checklist?`)) {
                void deleteTrip(t.id!);
              }
            }}
          />
        ))}
      </ul>
    </section>
  );
}

export function TripsPage() {
  const trips = useLiveQuery(() => db.trips.orderBy('startDate').toArray(), []);
  const itemCount = useLiveQuery(() => db.closetItems.count(), []);
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const today = todayISO();

  const current: Trip[] = [];
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const t of trips ?? []) {
    const bucket = classify(t, today);
    if (bucket === 'current') current.push(t);
    else if (bucket === 'upcoming') upcoming.push(t);
    else past.push(t);
  }
  // Current + upcoming: soonest start date first
  current.sort((a, b) => a.startDate.localeCompare(b.startDate));
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  // Past: most recent first
  past.sort((a, b) => b.startDate.localeCompare(a.startDate));

  const hasActive = current.length + upcoming.length > 0;

  return (
    <div className="space-y-5">
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

      {trips !== undefined && !hasActive && past.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          <p className="mb-4 text-center font-medium text-slate-700">No trips yet — create one to get started!</p>
          <ol className="space-y-2.5 pl-1">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">1</span>
              <span><strong>Add your clothes</strong> in the <a className="font-medium text-teal-700 underline" href="#/closet">Closet</a> — set warmth, formality and activity tags so PackWise can match them to weather.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">2</span>
              <span><strong>Create a trip</strong> with a destination and dates. PackWise fetches the forecast automatically.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">3</span>
              <span><strong>Get outfit suggestions</strong> per day — weather-aware and tailored to your activities. Lock favourites and swap individual items.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">4</span>
              <span><strong>Pack with the checklist</strong> — see exactly how many copies of each item you need across all your outfits.</span>
            </li>
          </ol>
        </div>
      )}

      {trips !== undefined && !hasActive && past.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No current or upcoming trips.
        </div>
      )}

      <TripSection title="Current" trips={current} today={today} />
      <TripSection title="Upcoming" trips={upcoming} today={today} />

      {past.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-900"
            onClick={() => setShowArchive((v) => !v)}
          >
            <Icon name={showArchive ? 'chevronDown' : 'chevronRight'} />
            {showArchive ? 'Hide' : 'View'} archive ({past.length} past trip{past.length !== 1 ? 's' : ''})
          </button>
          {showArchive && <TripSection title="Past trips" trips={past} today={today} />}
        </div>
      )}

      {creating && (
        <Modal title="New trip" onClose={() => setCreating(false)}>
          <NewTripForm onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
