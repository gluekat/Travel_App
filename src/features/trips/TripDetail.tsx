import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteTrip } from '../../db/schema';
import type { Trip } from '../../db/types';
import { addDays, dateRange, daysBetween, formatDay, formatTimestamp } from '../../lib/dates';
import { useOnline, useTempUnit } from '../../lib/hooks';
import { navigate } from '../../lib/router';
import { formatTemp } from '../../lib/units';
import type { Place } from '../../weather/openMeteo';
import { LIVE_TTL_MS } from '../../weather/resolveWeather';
import { refreshTripWeather } from '../../weather/tripWeather';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { PrivacyNote } from '../settings/PrivacyNote';
import { capacityGaps, countWears } from '../../engine/suggest';
import { fillEmptyDays, toEngineItem } from '../outfits/outfitService';
import { DayCard } from './DayCard';
import { TripTabs } from './TripTabs';
import { PlaceSearch } from './PlaceSearch';
import { MAX_TRIP_DAYS, duplicateTrip, setTripDates, setTripPlace } from './tripService';

function TripNotesSection({ trip }: { trip: Trip }) {
  const [weatherNote, setWeatherNote] = useState(trip.notes?.weather ?? '');
  const [packingNote, setPackingNote] = useState(trip.notes?.packingAlerts ?? '');

  async function saveNote(key: 'weather' | 'packingAlerts', value: string) {
    const current = await db.trips.get(trip.id!);
    const existing = current?.notes ?? {};
    const trimmed = value.trim();
    await db.trips.update(trip.id!, { notes: { ...existing, [key]: trimmed || undefined } });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Trip Notes <span className="font-normal text-slate-400">(optional)</span></h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="General Weather" hint="Broad conditions to keep in mind when packing.">
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="e.g. Hot and humid, afternoon thunderstorms likely"
            value={weatherNote}
            onChange={(e) => setWeatherNote(e.target.value)}
            onBlur={() => saveNote('weather', weatherNote)}
          />
        </Field>
        <Field label="Packing Alerts" hint="Reminders, dress codes, special requirements.">
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="e.g. Bring a rain jacket; smart dress required for restaurants"
            value={packingNote}
            onChange={(e) => setPackingNote(e.target.value)}
            onBlur={() => saveNote('packingAlerts', packingNote)}
          />
        </Field>
      </div>
    </div>
  );
}

type WeatherState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string };

function tripLabel(t: Trip): string {
  return t.name ?? t.placeLabel ?? t.destination;
}

function EditTripDialog({ trip, onClose, onRefreshWeather }: { trip: Trip; onClose: () => void; onRefreshWeather: () => void }) {
  const [name, setName] = useState(trip.name ?? '');
  const [query, setQuery] = useState(trip.destination);
  const [place, setPlace] = useState<Place>();
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);
  const [error, setError] = useState<string>();

  async function save() {
    try {
      if (name.trim() !== (trip.name ?? '')) {
        await db.trips.update(trip.id!, { name: name.trim() || undefined });
      }
      const locationChanged = !!place;
      const datesChanged = start !== trip.startDate || end !== trip.endDate;
      if (place) await setTripPlace(trip.id!, place);
      if (query.trim() !== trip.destination && !place) await db.trips.update(trip.id!, { destination: query.trim() });
      if (datesChanged) await setTripDates(trip, start, end);
      onClose();
      if (locationChanged || datesChanged) onRefreshWeather();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const days = dateRange(start, end).length;
  return (
    <Modal title="Edit trip" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Trip name (optional)" hint={'A personal label, e.g. “Summer holiday”. Leave blank to use the destination.'}>
          <input
            type="text"
            className={inputClass}
            value={name}
            placeholder={trip.placeLabel ?? trip.destination}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Destination" hint={trip.placeLabel ? `Current: ${trip.placeLabel}` : 'No location set yet.'}>
          <PlaceSearch query={query} onQuery={setQuery} selected={place} onSelect={setPlace} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-sm text-slate-600">
          {days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : 'Invalid dates'}
          {days > MAX_TRIP_DAYS && ` (max ${MAX_TRIP_DAYS})`}
        </p>
        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={days < 1 || days > MAX_TRIP_DAYS}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DuplicateTripDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const length = daysBetween(trip.startDate, trip.endDate);
  const defaultStart = addDays(trip.startDate, 7);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(addDays(defaultStart, length));
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  function handleStartChange(val: string) {
    setStart(val);
    setEnd(addDays(val, length));
  }

  const days = dateRange(start, end).length;

  async function create() {
    setWorking(true);
    try {
      const id = await duplicateTrip(trip, start, end);
      onClose();
      navigate(`/trips/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal title="Duplicate trip" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Creates a copy of <strong>{tripLabel(trip)}</strong> with the same outfits and activities. Weather will be refreshed for the new dates.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputClass} value={start} onChange={(e) => handleStartChange(e.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <p className="text-sm text-slate-600">
          {days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : 'Invalid dates'}
          {days > MAX_TRIP_DAYS && ` (max ${MAX_TRIP_DAYS})`}
        </p>
        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} disabled={days < 1 || days > MAX_TRIP_DAYS || working}>
            {working ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TripDetail({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  const days = useLiveQuery(() => db.tripDays.where('tripId').equals(tripId).sortBy('date'), [tripId]);
  const outfits = useLiveQuery(() => db.outfits.where('tripId').equals(tripId).sortBy('rank'), [tripId]);
  const closet = useLiveQuery(() => db.closetItems.toArray(), []);
  const unit = useTempUnit();
  const online = useOnline();
  const [weather, setWeather] = useState<WeatherState>({ kind: 'idle' });
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const autoFetched = useRef(false);
  const fmt = useCallback((c: number) => formatTemp(c, unit), [unit]);
  const usage = useMemo(() => countWears(outfits ?? []), [outfits]);
  const overWorn = useMemo(() => (closet && outfits ? capacityGaps(closet.map(toEngineItem), outfits) : []), [closet, outfits]);
  const [fillMessage, setFillMessage] = useState<string>();

  const hasLocation = trip?.lat != null && trip?.lon != null;
  const lastFetched = days?.reduce((m, d) => (d.weather && d.weather.source !== 'manual' ? Math.max(m, d.weather.fetchedAt) : m), 0) ?? 0;

  const refresh = useCallback(async () => {
    setWeather({ kind: 'loading' });
    try {
      const r = await refreshTripWeather(tripId);
      setWeather(r.error ? { kind: 'error', message: r.error } : { kind: 'ok' });
    } catch (e) {
      setWeather({ kind: 'error', message: (e as Error).message });
    }
  }, [tripId]);

  // Fetch automatically once when the trip opens, if online and the cache is missing or stale.
  useEffect(() => {
    if (!trip || !days || autoFetched.current || !online || !hasLocation) return;
    const missing = days.some((d) => !d.weather);
    if (missing || Date.now() - lastFetched > LIVE_TTL_MS) {
      autoFetched.current = true;
      void refresh();
    }
  }, [trip, days, online, hasLocation, lastFetched, refresh]);

  if (trip === undefined || !days || !outfits || !closet) return <p className="text-sm text-slate-500">Loading…</p>;
  if (trip === null) return <p>Trip not found. <a href="#/trips" className="underline">Back to trips</a></p>;

  async function fillEmpty() {
    setGenerating(true);
    try {
      const n = await fillEmptyDays(tripId, fmt, Math.floor(Math.random() * 1e6));
      setFillMessage(n ? `Suggested outfits for ${n} day${n > 1 ? 's' : ''}. Review and edit them below.` : 'Every day already has clothes picked.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="#/trips" className="text-sm text-teal-700">← Trips</a>
          <h1 className="text-xl font-semibold">{tripLabel(trip)}</h1>
          <p className="text-sm text-slate-600">
            {formatDay(trip.startDate)} to {formatDay(trip.endDate)} · {days.length} day{days.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDuplicating(true)} title="Duplicate this trip">
            <Icon name="copy" /> Duplicate
          </Button>
          <Button onClick={() => setEditing(true)}>
            <Icon name="edit" /> Edit
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (confirm('Delete this trip, its outfits and packing checklist?')) {
                await deleteTrip(tripId);
                navigate('/trips');
              }
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      </div>

      <TripTabs tripId={tripId} current="overview" />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <span className="font-medium">Weather</span>
        {hasLocation ? (
          <>
            <span className="text-slate-500">{lastFetched ? `updated ${formatTimestamp(lastFetched)}` : 'not fetched yet'}</span>
            <Button onClick={refresh} disabled={!online || weather.kind === 'loading'} className="ml-auto">
              <Icon name="refresh" /> {weather.kind === 'loading' ? 'Fetching…' : 'Refresh weather'}
            </Button>
          </>
        ) : (
          <span className="text-slate-500">
            No location set. <button className="underline" onClick={() => setEditing(true)}>Set a location</button> or enter weather per day.
          </span>
        )}
      </div>
      {!online && hasLocation && (
        <Banner tone="warn">Offline: showing cached weather{lastFetched ? ` from ${formatTimestamp(lastFetched)}` : ''}. Refresh when you're back online.</Banner>
      )}
      {weather.kind === 'error' && (
        <Banner tone="error">
          Couldn't fetch weather ({weather.message}). {days.some((d) => !d.weather) ? 'Enter missing days manually below.' : 'Showing cached weather.'}
        </Banner>
      )}

      <TripNotesSection trip={trip} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={fillEmpty} disabled={generating || closet.length === 0} title="Suggest outfits for days with no clothes picked yet">
          <Icon name="shirt" /> Suggest outfits for empty days
        </Button>
        {closet.length === 0 && <span className="text-sm text-slate-500">Add items to your closet first.</span>}
      </div>
      {fillMessage && <Banner tone="info">{fillMessage}</Banner>}
      {overWorn.length > 0 && (
        <div className="space-y-1">
          {overWorn.map((g) => (
            <Banner key={g} tone="warn">
              ⚠️ {g}
            </Banner>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {days.map((d, i) => (
          <DayCard
            key={d.id}
            day={d}
            index={i + 1}
            outfits={outfits.filter((o) => o.tripDayId === d.id)}
            closet={closet}
            usage={usage}
            unit={unit}
            formatTemp={fmt}
          />
        ))}
      </div>
      <PrivacyNote compact />
      {editing && (
        <EditTripDialog
          trip={trip}
          onClose={() => setEditing(false)}
          onRefreshWeather={() => {
            autoFetched.current = false;
          }}
        />
      )}
      {duplicating && <DuplicateTripDialog trip={trip} onClose={() => setDuplicating(false)} />}
    </div>
  );
}
