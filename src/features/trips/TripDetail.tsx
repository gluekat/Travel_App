import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteTrip } from '../../db/schema';
import type { Trip } from '../../db/types';
import { dateRange, formatDay, formatTimestamp } from '../../lib/dates';
import { useOnline, useTempUnit } from '../../lib/hooks';
import { navigate } from '../../lib/router';
import { formatTemp } from '../../lib/units';
import type { Place } from '../../weather/openMeteo';
import { LIVE_TTL_MS } from '../../weather/resolveWeather';
import { refreshTripWeather } from '../../weather/tripWeather';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { PrivacyNote } from '../settings/PrivacyNote';
import { generateTripOutfits } from '../outfits/outfitService';
import { DayCard } from './DayCard';
import { PlaceSearch } from './PlaceSearch';
import { MAX_TRIP_DAYS, setTripDates, setTripPlace } from './tripService';

type WeatherState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string };

function EditTripDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [query, setQuery] = useState(trip.destination);
  const [place, setPlace] = useState<Place>();
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);
  const [error, setError] = useState<string>();
  async function save() {
    try {
      if (place) await setTripPlace(trip.id!, place);
      if (query.trim() !== trip.destination) await db.trips.update(trip.id!, { destination: query.trim() });
      if (start !== trip.startDate || end !== trip.endDate) await setTripDates(trip, start, end);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const days = dateRange(start, end).length;
  return (
    <Modal title="Edit trip" onClose={onClose}>
      <div className="space-y-4">
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

export function TripDetail({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  const days = useLiveQuery(() => db.tripDays.where('tripId').equals(tripId).sortBy('date'), [tripId]);
  const outfits = useLiveQuery(() => db.outfits.where('tripId').equals(tripId).sortBy('rank'), [tripId]);
  const closet = useLiveQuery(() => db.closetItems.toArray(), []);
  const unit = useTempUnit();
  const online = useOnline();
  const [weather, setWeather] = useState<WeatherState>({ kind: 'idle' });
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const autoFetched = useRef(false);
  const fmt = useCallback((c: number) => formatTemp(c, unit), [unit]);

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

  async function suggestAll() {
    setGenerating(true);
    try {
      await generateTripOutfits(tripId, fmt, Math.floor(Math.random() * 1e6));
    } finally {
      setGenerating(false);
    }
  }

  const hasOutfits = outfits.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="#/trips" className="text-sm text-teal-700">← Trips</a>
          <h1 className="text-xl font-semibold">{trip.placeLabel ?? trip.destination}</h1>
          <p className="text-sm text-slate-600">
            {formatDay(trip.startDate)} to {formatDay(trip.endDate)} · {days.length} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>
            <Icon name="edit" /> Edit
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (confirm('Delete this trip, its outfits and packing list?')) {
                await deleteTrip(tripId);
                navigate('/trips');
              }
            }}
          >
            <Icon name="trash" />
          </Button>
        </div>
      </div>

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

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={suggestAll} disabled={generating || closet.length === 0}>
          <Icon name="shirt" /> {hasOutfits ? 'Regenerate all outfits' : 'Suggest outfits'}
        </Button>
        {hasOutfits && (
          <Button onClick={() => navigate(`/trips/${tripId}/packing`)}>
            <Icon name="bag" /> Packing list
          </Button>
        )}
        {closet.length === 0 && <span className="text-sm text-slate-500">Add items to your closet first.</span>}
      </div>

      <div className="space-y-3">
        {days.map((d, i) => (
          <DayCard
            key={d.id}
            day={d}
            index={i + 1}
            outfits={outfits.filter((o) => o.tripDayId === d.id)}
            closet={closet}
            unit={unit}
            formatTemp={fmt}
          />
        ))}
      </div>
      <PrivacyNote compact />
      {editing && <EditTripDialog trip={trip} onClose={() => setEditing(false)} />}
    </div>
  );
}
