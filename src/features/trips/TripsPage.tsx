import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteTrip } from '../../db/schema';
import type { Trip, TripStop } from '../../db/types';
import { addDays, dateRange, formatDay, todayISO } from '../../lib/dates';
import { navigate } from '../../lib/router';
import type { Place } from '../../weather/openMeteo';
import { Banner, Button, Field, Icon, Modal } from '../../components/ui';
import { DateRangePicker } from '../../components/DateRangePicker';
import { PrivacyNote } from '../settings/PrivacyNote';
import { PlaceSearch } from './PlaceSearch';
import { createTrip, MAX_TRIP_DAYS } from './tripService';

interface StopDraft {
  query: string;
  place?: Place;
  start: string;
  end: string;
}

function NewTripForm({ onDone }: { onDone: () => void }) {
  const initStart = addDays(todayISO(), 3);
  const initEnd = addDays(todayISO(), 7);
  const [stops, setStops] = useState<StopDraft[]>([
    { query: '', place: undefined, start: initStart, end: initEnd },
  ]);
  const [error, setError] = useState<string>();

  function updateStop(i: number, patch: Partial<StopDraft>) {
    setStops(s => s.map((stop, idx) => idx === i ? { ...stop, ...patch } : stop));
  }

  function addStop() {
    const last = stops[stops.length - 1];
    const newStart = addDays(last.end, 1);
    setStops(s => [...s, { query: '', place: undefined, start: newStart, end: addDays(newStart, 3) }]);
  }

  function removeStop(i: number) {
    setStops(s => s.filter((_, idx) => idx !== i));
  }

  const tripStart = stops.map(s => s.start).reduce((a, b) => a < b ? a : b);
  const tripEnd = stops.map(s => s.end).reduce((a, b) => a > b ? a : b);
  const totalDays = dateRange(tripStart, tripEnd).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stops[0].query.trim()) return;
    const anyMissingPlace = stops.some(s => !s.place);
    if (anyMissingPlace && !confirm('Some stops have no location selected, so weather will need to be entered manually. Save anyway?')) return;
    try {
      let id: number;
      if (stops.length === 1) {
        id = await createTrip(stops[0].place?.name ?? stops[0].query, stops[0].place, stops[0].start, stops[0].end);
      } else {
        const tripStops: TripStop[] = stops.map(s => ({
          label: s.place?.label ?? s.query,
          lat: s.place?.lat,
          lon: s.place?.lon,
          timezone: s.place?.timezone,
          startDate: s.start,
          endDate: s.end,
        }));
        id = await createTrip(stops[0].place?.name ?? stops[0].query, stops[0].place, tripStart, tripEnd, tripStops);
      }
      onDone();
      navigate(`/trips/${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {stops.map((stop, i) => (
        <div key={i} className={stops.length > 1 ? 'rounded-lg border border-slate-200 p-3 space-y-3' : 'space-y-3'}>
          {stops.length > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Stop {i + 1}</span>
              <button type="button" onClick={() => removeStop(i)}
                className="text-xs text-red-600 hover:text-red-800">
                Remove
              </button>
            </div>
          )}
          <Field label="Destination">
            <PlaceSearch
              query={stop.query}
              onQuery={q => updateStop(i, { query: q, place: undefined })}
              selected={stop.place}
              onSelect={p => updateStop(i, { place: p })}
            />
          </Field>
          <Field label="Dates">
            <DateRangePicker
              start={stop.start}
              end={stop.end}
              onChange={(s, e) => updateStop(i, { start: s, end: e })}
            />
          </Field>
          <p className="text-xs text-slate-500">
            {dateRange(stop.start, stop.end).length} day{dateRange(stop.start, stop.end).length !== 1 ? 's' : ''}
          </p>
        </div>
      ))}

      <button type="button" onClick={addStop}
        className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-900">
        <Icon name="plus" className="h-4 w-4" /> Add another destination
      </button>

      <p className="text-sm text-slate-600">
        {stops.length > 1 && `Total: `}
        {totalDays > 0 ? `${totalDays} day${totalDays > 1 ? 's' : ''}` : 'Invalid dates'}
        {totalDays > MAX_TRIP_DAYS && ` (max ${MAX_TRIP_DAYS})`}
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <PrivacyNote compact />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary"
          disabled={totalDays < 1 || totalDays > MAX_TRIP_DAYS || !stops[0].query.trim()}>
          Create trip
        </Button>
      </div>
    </form>
  );
}

function tripLabel(t: Trip): string {
  if (t.name) return t.name;
  if (t.stops && t.stops.length > 1) {
    return t.stops.map(s => s.label.split(',')[0].trim()).join(' → ');
  }
  return t.placeLabel ?? t.destination;
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
  current.sort((a, b) => a.startDate.localeCompare(b.startDate));
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
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
