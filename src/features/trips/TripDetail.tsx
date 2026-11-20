import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteTrip } from '../../db/schema';
import type { Trip, TripStop } from '../../db/types';
import { addDays, dateRange, daysBetween, formatDay, formatTimestamp } from '../../lib/dates';
import { useOnline, useTempUnit } from '../../lib/hooks';
import { navigate } from '../../lib/router';
import { formatTemp } from '../../lib/units';
import type { Place } from '../../weather/openMeteo';
import { LIVE_TTL_MS } from '../../weather/resolveWeather';
import { refreshTripWeather } from '../../weather/tripWeather';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { DateRangePicker } from '../../components/DateRangePicker';
import { PrivacyNote } from '../settings/PrivacyNote';
import { fillEmptyDays } from '../outfits/outfitService';
import { DayCard } from './DayCard';
import { computeDayPlaces, getDayLocation, weatherNeedsPlaceRefresh } from './dayPlaces';
import { computeOverWorn, countWearDays, weatherMismatches } from './wearPlan';
import { ForecastWarning } from './ForecastWarning';
import { applyAdjustments, flagAdjustments, planTripDateAdjustments, type DateAdjustment } from './tripAdjustments';
import { TripTabs } from './TripTabs';
import { PlaceSearch } from './PlaceSearch';
import { MAX_TRIP_DAYS, duplicateTrip, setTripDates, setTripPlace, setTripStops } from './tripService';
import { refreshPlaceholders } from './placeholders';

function TripNotesSection({ trip }: { trip: Trip }) {
  const [note, setNote] = useState(trip.notes?.general ?? '');
  // Older trips kept separate weather and packing notes; offer them rather than filling the box.
  const earlier = note ? '' : [trip.notes?.weather, trip.notes?.packingAlerts].filter(Boolean).join('\n');

  async function save() {
    const trimmed = note.trim();
    if (trimmed === (trip.notes?.general ?? '')) return;
    await db.trips.update(trip.id!, { notes: trimmed ? { general: trimmed } : undefined });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Trip Notes <span className="font-normal text-slate-400">(optional)</span></h2>
      <textarea
        className={`${inputClass} resize-none`}
        rows={3}
        aria-label="Trip notes"
        placeholder="e.g. Hot and humid, afternoon thunderstorms likely. Bring a rain jacket; smart dress required for restaurants."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void save()}
      />
      {earlier && (
        <p className="mt-1 text-xs text-slate-500">
          Earlier notes: “{earlier.replace(/\n/g, ' · ')}”{' '}
          <button type="button" className="underline" onClick={() => setNote(earlier)}>
            Use as the note
          </button>
        </p>
      )}
    </div>
  );
}

type WeatherState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string };

export { getDayLocation };

export function tripLabel(t: Trip): string {
  if (t.name) return t.name;
  if (t.stops && t.stops.length > 1) {
    return t.stops.map(s => s.label.split(',')[0].trim()).join(' → ');
  }
  return t.placeLabel ?? t.destination;
}

/** One destination being edited: the text in the search box, plus the place picked from it (if any). */
interface StopEdit extends TripStop {
  query: string;
  place?: Place;
}

/** Edited drafts back into stops: a newly picked place brings its coordinates; unchanged text keeps the old ones. */
function stopsFromDrafts(drafts: StopEdit[]): TripStop[] {
  return drafts.map((d) => {
    const label = d.place?.label ?? d.query.trim();
    const keep = !d.place && label === d.label;
    return {
      label,
      lat: d.place ? d.place.lat : keep ? d.lat : undefined,
      lon: d.place ? d.place.lon : keep ? d.lon : undefined,
      timezone: d.place ? d.place.timezone : keep ? d.timezone : undefined,
      startDate: d.startDate,
      endDate: d.endDate,
    };
  });
}

const stopRange = (drafts: StopEdit[]): [string, string] => [drafts.map((s) => s.startDate).reduce((a, b) => (a < b ? a : b)), drafts.map((s) => s.endDate).reduce((a, b) => (a > b ? a : b))];

/** Edit, add, remove and re-date the destinations of a multi-stop trip. */
function StopsEditor({ stops, onChange }: { stops: StopEdit[]; onChange: (update: (prev: StopEdit[]) => StopEdit[]) => void }) {
  // Functional updates: the search box reports a new query and clears the picked place in the same event.
  const patch = (i: number, p: Partial<StopEdit>) => onChange((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const addStop = () => onChange((prev) => [...prev, { label: '', query: '', startDate: prev[prev.length - 1].endDate, endDate: addDays(prev[prev.length - 1].endDate, 3) }]);
  return (
    <div className="space-y-3">
      {stops.map((stop, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Stop {i + 1}</span>
            {stops.length > 1 && (
              <button type="button" onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:text-red-800">
                Remove
              </button>
            )}
          </div>
          <Field label="Destination" hint={stop.label && !stop.place && stop.query === stop.label ? undefined : 'Pick a result so weather and the map location update.'}>
            <PlaceSearch query={stop.query} onQuery={(q) => patch(i, { query: q, place: undefined })} selected={stop.place} onSelect={(p) => patch(i, { place: p })} />
          </Field>
          <Field label="Dates">
            <DateRangePicker start={stop.startDate} end={stop.endDate} onChange={(s, e) => patch(i, { startDate: s, endDate: e })} />
          </Field>
        </div>
      ))}
      <button type="button" onClick={addStop} className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-900">
        <Icon name="plus" className="h-4 w-4" /> Add another destination
      </button>
      <p className="text-xs text-slate-500">Saving updates the trip's days, weather and placeholder transportation to match. Lodging and bookings you've entered are offered new dates to confirm.</p>
    </div>
  );
}

/** After a trip's dates change: confirm which lodging and travel dates should move too. Declined ones stay flagged. */
function ConfirmDateAdjustments({ plan, onClose }: { plan: DateAdjustment[]; onClose: () => void }) {
  const [accepted, setAccepted] = useState(() => new Set(plan.map((a) => a.key)));
  const toggle = (key: string) => setAccepted((s) => { const n = new Set(s); if (!n.delete(key)) n.add(key); return n; });
  const groups = [
    { label: 'Transportation', items: plan.filter((a) => a.kind === 'transport') },
    { label: 'Lodging', items: plan.filter((a) => a.kind === 'lodging') },
  ].filter((g) => g.items.length);
  return (
    <Modal title="Update lodging & transportation?" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The trip dates changed. Move these bookings to match? Any you leave unchecked keep their current dates and are flagged <span className="font-medium text-amber-700">needs updating</span> on the Itinerary page.
        </p>
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</p>
            <ul className="space-y-1.5">
              {g.items.map((a) => (
                <li key={a.key}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-700" checked={accepted.has(a.key)} onChange={() => toggle(a.key)} />
                    <span>
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-xs text-slate-500">{a.detail}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Keep current dates</Button>
          <Button
            variant="primary"
            disabled={accepted.size === 0}
            onClick={async () => {
              await applyAdjustments(plan, accepted);
              onClose();
            }}
          >
            Update {accepted.size === plan.length ? 'all' : `${accepted.size} selected`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditTripDialog({ trip, onClose, onRefreshWeather }: { trip: Trip; onClose: () => void; onRefreshWeather: () => void }) {
  const [name, setName] = useState(trip.name ?? '');
  const [query, setQuery] = useState(trip.destination);
  const [place, setPlace] = useState<Place>();
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<DateAdjustment[]>();
  const multi = !!trip.stops && trip.stops.length > 1;
  const [stopDrafts, setStopDrafts] = useState<StopEdit[]>(() => (trip.stops ?? []).map((s) => ({ ...s, query: s.label })));

  async function save() {
    try {
      if (name.trim() !== (trip.name ?? '')) {
        await db.trips.update(trip.id!, { name: name.trim() || undefined });
      }
      const newStops = multi ? stopsFromDrafts(stopDrafts) : undefined;
      const newStart = newStops ? newStops.map((s) => s.startDate).reduce((a, b) => (a < b ? a : b)) : start;
      const newEnd = newStops ? newStops.map((s) => s.endDate).reduce((a, b) => (a > b ? a : b)) : end;
      const stopsChanged = !!newStops && JSON.stringify(newStops) !== JSON.stringify(trip.stops);
      const locationChanged = !!place || stopsChanged;
      const datesChanged = newStart !== trip.startDate || newEnd !== trip.endDate;
      if (!multi && place) await setTripPlace(trip.id!, place);
      if (!multi && query.trim() !== trip.destination && !place) await db.trips.update(trip.id!, { destination: query.trim() });
      if (datesChanged || stopsChanged) {
        // Lodging and travel dates are proposed, not silently changed: the user confirms below.
        const plan = datesChanged ? await planTripDateAdjustments(trip.id!, trip.startDate, trip.endDate, newStart, newEnd) : [];
        if (newStops) await setTripStops(trip, newStops);
        else await setTripDates(trip, start, end);
        await refreshPlaceholders(trip.id!);
        if (plan.length) {
          await flagAdjustments(plan, trip.startDate, trip.endDate);
          onRefreshWeather();
          setPending(plan);
          return;
        }
      }
      if (!datesChanged && !stopsChanged && place) await refreshPlaceholders(trip.id!);
      onClose();
      if (locationChanged || datesChanged) onRefreshWeather();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const days = multi ? dateRange(...stopRange(stopDrafts)).length : dateRange(start, end).length;
  if (pending) return <ConfirmDateAdjustments plan={pending} onClose={onClose} />;
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
        {!multi && (
          <Field label="Destination" hint={trip.placeLabel ? `Current: ${trip.placeLabel}` : 'No location set yet.'}>
            <PlaceSearch query={query} onQuery={setQuery} selected={place} onSelect={setPlace} />
          </Field>
        )}
        {multi ? (
          <StopsEditor stops={stopDrafts} onChange={setStopDrafts} />
        ) : (
          <>
            <Field label="Dates">
              <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
            </Field>
            <p className="text-sm text-slate-600">
              {days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : 'Invalid dates'}
              {days > MAX_TRIP_DAYS && ` (max ${MAX_TRIP_DAYS})`}
            </p>
          </>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={days < 1 || days > MAX_TRIP_DAYS || (multi && stopDrafts.some((s) => !s.query.trim()))}>
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
        <Field label="Dates">
          <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
        </Field>
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
  const activities = useLiveQuery(() => db.tripActivities.where('tripId').equals(tripId).toArray(), [tripId]);
  const legs = useLiveQuery(() => db.tripTransport.where('tripId').equals(tripId).toArray(), [tripId]);
  const unit = useTempUnit();
  const online = useOnline();
  const [weather, setWeather] = useState<WeatherState>({ kind: 'idle' });
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const autoFetched = useRef(false);
  const fmt = useCallback((c: number) => formatTemp(c, unit), [unit]);
  const dayDateMap = useMemo(
    () => new Map((days ?? []).map((d) => [d.id!, d.date])),
    [days],
  );
  // For each laundry-day card: items worn BEFORE that day (what actually needs washing)
  const prelaundryUsage = useMemo(() => {
    if (!outfits || !days) return new Map<number, Map<number, number>>();
    const sortedLaundryDays = [...days].filter((d) => d.laundryDay).sort((a, b) => a.date.localeCompare(b.date));
    const result = new Map<number, Map<number, number>>();
    for (let i = 0; i < sortedLaundryDays.length; i++) {
      const lday = sortedLaundryDays[i];
      const prevDate = i > 0 ? sortedLaundryDays[i - 1].date : undefined;
      const relevant = outfits.filter((o) => {
        const d = dayDateMap.get(o.tripDayId);
        return d !== undefined && d < lday.date && (!prevDate || d >= prevDate);
      });
      result.set(lday.id!, countWearDays(relevant, (id) => dayDateMap.get(id)));
    }
    return result;
  }, [outfits, days, dayDateMap]);

  // Per-day usage: wears within the day's laundry cycle (from last laundry, inclusive, to next laundry, exclusive)
  const cycleUsageByDayId = useMemo(() => {
    if (!outfits || !days) return new Map<number, Map<number, number>>();
    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const laundryDates = sortedDays.filter((d) => d.laundryDay).map((d) => d.date).sort();
    const result = new Map<number, Map<number, number>>();
    for (const day of sortedDays) {
      const cycleStart = [...laundryDates].reverse().find((ld) => ld <= day.date);
      const nextLaundry = laundryDates.find((ld) => ld > day.date);
      const cycleOutfits = outfits.filter((o) => {
        const d = dayDateMap.get(o.tripDayId);
        if (d === undefined) return false;
        if (cycleStart !== undefined && d < cycleStart) return false;
        if (nextLaundry !== undefined && d >= nextLaundry) return false;
        return true;
      });
      result.set(day.id!, countWearDays(cycleOutfits, (id) => dayDateMap.get(id)));
    }
    return result;
  }, [outfits, days, dayDateMap]);

  // Trip-wide total wears per item (Y in "wear X of Y") — counts unique days, not outfit occurrences
  const tripWears = useMemo(() => countWearDays(outfits ?? [], (id) => dayDateMap.get(id)), [outfits, dayDateMap]);

  // Trip-wide cumulative wears up to each day (X in "wear X of Y") — counts unique items per day
  const cumulativeByDayId = useMemo(() => {
    if (!outfits || !days) return new Map<number, Map<number, number>>();
    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const result = new Map<number, Map<number, number>>();
    const running = new Map<number, number>();
    for (const day of sortedDays) {
      const itemsToday = new Set<number>();
      for (const o of outfits) {
        if (dayDateMap.get(o.tripDayId) !== day.date) continue;
        for (const id of o.itemIds) itemsToday.add(id);
      }
      for (const id of itemsToday) running.set(id, (running.get(id) ?? 0) + 1);
      result.set(day.id!, new Map(running));
    }
    return result;
  }, [outfits, days, dayDateMap]);

  const overWornByDayId = useMemo(() => (outfits && days && closet ? computeOverWorn(outfits, days, closet) : new Map()), [outfits, days, closet]);
  const forecastMismatches = useMemo(() => (outfits && days && closet ? weatherMismatches(closet, outfits, days) : new Set<number>()), [outfits, days, closet]);
  const places = useMemo(() => (trip && days && legs ? computeDayPlaces(trip, days, legs) : undefined), [trip, days, legs]);
  const placeMismatch = !!(trip && days && places && days.some((d) => weatherNeedsPlaceRefresh(d, trip, places)));
  const [fillMessage, setFillMessage] = useState<string>();

  const hasLocation = (trip?.lat != null && trip?.lon != null) ||
    (trip?.stops?.some(s => s.lat != null) ?? false) ||
    [...(places?.values() ?? [])].some((p) => p.lat != null);
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
    if (!trip || !days || !legs || autoFetched.current || !online || !hasLocation) return;
    const missing = days.some((d) => !d.weather);
    if (missing || placeMismatch || Date.now() - lastFetched > LIVE_TTL_MS) {
      autoFetched.current = true;
      void refresh();
    }
  }, [trip, days, legs, online, hasLocation, placeMismatch, lastFetched, refresh]);

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
              if (confirm('Delete this trip, its outfits and packing checklist? You can restore it from the Trash for 30 days.')) {
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

      {trip.stops && trip.stops.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Destinations</h2>
          <div className="space-y-1">
            {trip.stops.map((stop, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="text-teal-600">📍</span>
                <span className="font-medium">{stop.label}</span>
                <span className="text-slate-500">{formatDay(stop.startDate)} – {formatDay(stop.endDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TripNotesSection trip={trip} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={fillEmpty} disabled={generating || closet.length === 0} title="Suggest outfits for days with no clothes picked yet">
          <Icon name="shirt" /> Suggest outfits for empty days
        </Button>
        {closet.length === 0 && <span className="text-sm text-slate-500">Add items to your closet first.</span>}
      </div>
      {fillMessage && <Banner tone="info">{fillMessage}</Banner>}
      <ForecastWarning trip={trip} mismatched={forecastMismatches} closet={closet} />

      <div className="space-y-3">
        {days.map((d, i) => (
          <DayCard
            key={d.id}
            day={d}
            index={i + 1}
            location={places?.get(d.date)?.label ?? getDayLocation(trip, d.date)}
            place={places?.get(d.date)}
            outfits={outfits.filter((o) => o.tripDayId === d.id)}
            closet={closet}
            usage={cycleUsageByDayId.get(d.id!) ?? new Map()}
            tripTotals={tripWears}
            cumulativeUsage={cumulativeByDayId.get(d.id!) ?? new Map()}
            prelaundryUsage={d.laundryDay ? prelaundryUsage.get(d.id!) : undefined}
            warnings={overWornByDayId.get(d.id!)?.messages}
            exceededItemIds={overWornByDayId.get(d.id!)?.itemIds}
            unit={unit}
            formatTemp={fmt}
            activities={activities?.filter((a) => a.tripDayId === d.id)}
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
