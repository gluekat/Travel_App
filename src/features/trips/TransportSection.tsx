import { useState, type FormEvent } from 'react';
import { db } from '../../db/schema';
import type { HomeLocation, TransportConnection, TransportLeg, TransportMode, Trip } from '../../db/types';
import { fmt12h, formatDay, shortLocation } from '../../lib/dates';
import { airportByCode, airportLabel, nearestAirport } from '../../lib/airports';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { TimeInput } from '../../components/TimeInput';
import { LocationInput } from '../../components/LocationInput';
import { directionSegments, directionTotalMinutes, driveEstimate, formatMinutes, mirrorLeg, transportOverview, type Segment } from './transportPlan';

const MODE_ICON: Record<TransportMode, string> = { drive: '🚗', fly: '✈️', train: '🚂', boat: '🛳️' };
const MODE_LABEL: Record<TransportMode, string> = { drive: 'Drive', fly: 'Flight', train: 'Train', boat: 'Cruise / Boat' };
const DIRECTION_LABEL = { outbound: '→ Outbound', return: '← Return' } as const;

// ─── Itinerary display ───────────────────────────────────────────────────────

function Place({ label, time, date, refDate }: { label: string; time?: string; date?: string; refDate?: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {time && <span className="font-mono font-medium">{fmt12h(time)}</span>}
      {date && date !== refDate && <span className="text-xs text-slate-500">{formatDay(date)}</span>}
      <span className="font-medium">{label || '—'}</span>
    </span>
  );
}

function SegmentRow({ seg, onEdit, onDelete, first }: { seg: Segment; onEdit: () => void; onDelete: () => void; first: boolean }) {
  const detail = [seg.carrier, seg.identifier, seg.bookingRef ? `Ref ${seg.bookingRef}` : undefined].filter(Boolean).join(' · ');
  return (
    <li>
      {seg.layoverMinutes != null && (
        <div className="my-1 ml-4 w-fit rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
          ⏱ Layover at {shortLocation(seg.from) || seg.from}: {formatMinutes(seg.layoverMinutes)}
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Leg {seg.n} · {MODE_ICON[seg.mode]} {MODE_LABEL[seg.mode]}
              {seg.departDate && <span className="ml-2 font-normal normal-case">{formatDay(seg.departDate)}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <Place label={seg.from} time={seg.departTime} />
              <span className="text-slate-400">→</span>
              <Place label={seg.to} time={seg.arriveTime} date={seg.arriveDate} refDate={seg.departDate} />
            </div>
            <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
              {seg.mode === 'drive' && seg.distanceMiles != null && <span>{Math.round(seg.distanceMiles)} mi</span>}
              {seg.durationMinutes != null && seg.durationMinutes > 0 && <span>{seg.mode === 'drive' ? 'Drive time' : 'Duration'} {formatMinutes(seg.durationMinutes)}</span>}
              {detail && <span>{detail}</span>}
            </p>
            {seg.notes && <p className="text-xs italic text-slate-400">{seg.notes}</p>}
          </div>
          <div className="no-print flex shrink-0 gap-1">
            <button type="button" onClick={onEdit} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100" title="Edit this booking">
              Edit
            </button>
            {first && (
              <button type="button" onClick={onDelete} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50" title="Delete this booking and all its legs">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function TransportSection({ tripId, trip, legs, home, homeAirport }: { tripId: number; trip: Trip; legs: TransportLeg[]; home?: HomeLocation | null; homeAirport?: string | null }) {
  const [form, setForm] = useState<{ leg?: TransportLeg; direction: 'outbound' | 'return' | 'roundtrip' } | null>(null);
  const overview = transportOverview(legs);
  const byId = new Map(legs.map((l) => [l.id!, l]));

  async function remove(leg: TransportLeg) {
    if (confirm(`Remove this ${MODE_LABEL[leg.mode].toLowerCase()} booking and all its legs?`)) await db.tripTransport.delete(leg.id!);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">Transportation</h2>
        <Button className="no-print" variant="ghost" onClick={() => setForm({ direction: 'roundtrip' })}>
          <Icon name="plus" /> Add transport
        </Button>
      </div>

      {legs.length > 0 && (
        <div className="grid gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 sm:grid-cols-2" aria-label="Transportation overview">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Departure location</p>
            <p className="text-sm font-semibold">{overview.from || '—'}</p>
            {overview.departure?.departDate && (
              <p className="text-xs text-slate-600">
                {formatDay(overview.departure.departDate)}
                {overview.departure.departTime && ` · ${fmt12h(overview.departure.departTime)}`}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Final arrival destination</p>
            <p className="text-sm font-semibold">{overview.to || '—'}</p>
            {overview.arrival?.arriveDate && (
              <p className="text-xs text-slate-600">
                {formatDay(overview.arrival.arriveDate)}
                {overview.arrival.arriveTime && ` · ${fmt12h(overview.arrival.arriveTime)}`}
              </p>
            )}
          </div>
          {overview.returnArrival && (
            <p className="text-xs text-slate-600 sm:col-span-2">
              ← Returns to {overview.returnArrival.to}
              {overview.returnArrival.arriveDate && ` on ${formatDay(overview.returnArrival.arriveDate)}`}
              {overview.returnArrival.arriveTime && ` at ${fmt12h(overview.returnArrival.arriveTime)}`}
            </p>
          )}
          {overview.oneWay && <p className="text-xs text-slate-600 sm:col-span-2">One-way travel: only {legs[0].direction === 'outbound' ? 'an outbound' : 'a return'} trip is planned.</p>}
        </div>
      )}

      {(['outbound', 'return'] as const).map((dir) => {
        const segs = directionSegments(legs.filter((l) => l.direction === dir));
        const total = directionTotalMinutes(segs);
        const seenLegs = new Set<number>();
        return (
          <div key={dir} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-semibold text-slate-700">{DIRECTION_LABEL[dir]}</h3>
              {segs.length > 0 && (
                <p className="text-xs text-slate-500">
                  {segs[0].from} → {segs[segs.length - 1].to}
                  {segs.length > 1 && ` · ${segs.length} legs`}
                  {total != null && total > 0 && ` · ${formatMinutes(total)} total`}
                </p>
              )}
            </div>
            {segs.length === 0 && <p className="text-sm text-slate-400">No transport added yet.</p>}
            <ul className="space-y-1.5">
              {segs.map((seg, i) => {
                const leg = byId.get(seg.legId!)!;
                const first = !seenLegs.has(seg.legId!);
                seenLegs.add(seg.legId!);
                return <SegmentRow key={`${seg.legId}-${i}`} seg={seg} first={first} onEdit={() => setForm({ leg, direction: dir })} onDelete={() => void remove(leg)} />;
              })}
            </ul>
            <div className="no-print">
              <Button variant="ghost" onClick={() => setForm({ direction: dir })}>
                <Icon name="plus" /> Add {dir} transport
              </Button>
            </div>
          </div>
        );
      })}

      {form && <TransportFormModal tripId={tripId} trip={trip} home={home ?? undefined} homeAirport={homeAirport ?? undefined} existing={form.leg} defaultDirection={form.direction} onClose={() => setForm(null)} />}
    </section>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

type Point = { label: string; lat?: number; lon?: number };
type StopDraft = { point: Point; arrive: string; arriveDate: string; depart: string; departDate: string; identifier: string };
type Direction = 'outbound' | 'return' | 'roundtrip';

interface Draft {
  direction: Direction;
  mode: TransportMode;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  from: Point;
  to: Point;
  carrier: string;
  identifier: string;
  bookingRef: string;
  distanceMiles: string;
  travelHours: string;
  travelMins: string;
  distEstimated: boolean;
  stops: StopDraft[];
  notes: string;
}

const emptyStop = (): StopDraft => ({ point: { label: '' }, arrive: '', arriveDate: '', depart: '', departDate: '', identifier: '' });

function homePoint(mode: TransportMode, home?: HomeLocation, homeAirport?: string): Point {
  if (mode === 'fly') {
    const a = homeAirport ? airportByCode(homeAirport) : undefined;
    return a ? { label: airportLabel(a), lat: a.lat, lon: a.lon } : { label: '' };
  }
  return home ? { label: home.label, lat: home.lat, lon: home.lon } : { label: '' };
}

function tripPoint(mode: TransportMode, trip: Trip, which: 'first' | 'last'): Point {
  const stop = trip.stops?.length ? (which === 'first' ? trip.stops[0] : trip.stops[trip.stops.length - 1]) : undefined;
  const lat = stop ? stop.lat : trip.lat;
  const lon = stop ? stop.lon : trip.lon;
  const label = stop ? shortLocation(stop.label) : trip.placeLabel ? shortLocation(trip.placeLabel) : trip.destination;
  if (mode === 'fly' && lat != null && lon != null) {
    const a = nearestAirport(lat, lon);
    if (a) return { label: airportLabel(a), lat: a.lat, lon: a.lon };
  }
  return { label, lat, lon };
}

function defaultEnds(direction: Direction, mode: TransportMode, trip: Trip, home?: HomeLocation, homeAirport?: string): { from: Point; to: Point } {
  const h = homePoint(mode, home, homeAirport);
  return direction === 'return' ? { from: tripPoint(mode, trip, 'last'), to: h } : { from: h, to: tripPoint(mode, trip, 'first') };
}

function emptyDraft(direction: Direction, trip: Trip, home?: HomeLocation, homeAirport?: string): Draft {
  const mode: TransportMode = 'fly';
  const date = direction === 'return' ? trip.endDate : trip.startDate;
  return {
    direction, mode, departureDate: date, departureTime: '', arrivalDate: date, arrivalTime: '',
    ...defaultEnds(direction, mode, trip, home, homeAirport),
    carrier: '', identifier: '', bookingRef: '', distanceMiles: '', travelHours: '', travelMins: '', distEstimated: false, stops: [], notes: '',
  };
}

function legToDraft(leg: TransportLeg): Draft {
  const mins = leg.travelTimeMinutes ?? 0;
  return {
    direction: leg.direction, mode: leg.mode,
    departureDate: leg.departureDate, departureTime: leg.departureTime ?? '',
    arrivalDate: leg.arrivalDate ?? '', arrivalTime: leg.arrivalTime ?? '',
    from: { label: leg.fromPoint ?? '', lat: leg.fromLat, lon: leg.fromLon },
    to: { label: leg.toPoint ?? '', lat: leg.toLat, lon: leg.toLon },
    carrier: leg.carrier ?? '', identifier: leg.identifier ?? '', bookingRef: leg.bookingRef ?? '',
    distanceMiles: leg.distanceMiles ? String(leg.distanceMiles) : '',
    travelHours: mins ? String(Math.floor(mins / 60)) : '', travelMins: mins ? String(mins % 60) : '',
    distEstimated: false,
    stops: (leg.connections ?? []).map((c) => ({
      point: { label: c.point, lat: c.lat, lon: c.lon },
      arrive: c.arrive ?? '', arriveDate: c.arriveDate ?? '', depart: c.depart ?? '', departDate: c.departDate ?? '', identifier: c.identifier ?? '',
    })),
    notes: leg.notes ?? '',
  };
}

function draftToLeg(d: Draft, tripId: number, existing?: TransportLeg): Omit<TransportLeg, 'id'> {
  const stops: TransportConnection[] = d.stops
    .filter((s) => s.point.label.trim())
    .map((s) => ({
      point: s.point.label.trim(), lat: s.point.lat, lon: s.point.lon,
      arrive: s.arrive || undefined, arriveDate: s.arriveDate || undefined,
      depart: s.depart || undefined, departDate: s.departDate || undefined,
      identifier: s.identifier.trim() || undefined,
    }));
  // With stops each driving leg is estimated automatically; a single drive keeps the editable distance / time.
  const manualDrive = d.mode === 'drive' && stops.length === 0;
  const travelMins = manualDrive ? (parseInt(d.travelHours) || 0) * 60 + (parseInt(d.travelMins) || 0) : 0;
  return {
    tripId,
    direction: d.direction === 'return' ? 'return' : 'outbound',
    mode: d.mode,
    departureDate: d.departureDate, departureTime: d.departureTime || undefined,
    arrivalDate: d.arrivalDate || undefined, arrivalTime: d.arrivalTime || undefined,
    fromPoint: d.from.label.trim() || undefined, fromLat: d.from.lat, fromLon: d.from.lon,
    toPoint: d.to.label.trim() || undefined, toLat: d.to.lat, toLon: d.to.lon,
    carrier: d.carrier.trim() || undefined, identifier: d.identifier.trim() || undefined, bookingRef: d.bookingRef.trim() || undefined,
    distanceMiles: manualDrive && d.distanceMiles ? parseFloat(d.distanceMiles) : undefined,
    travelTimeMinutes: travelMins || undefined,
    connections: stops.length ? stops : undefined,
    notes: d.notes.trim() || undefined,
    createdAt: existing?.createdAt ?? Date.now(),
  };
}

function TransportFormModal({ tripId, trip, home, homeAirport, existing, defaultDirection, onClose }: {
  tripId: number;
  trip: Trip;
  home?: HomeLocation;
  homeAirport?: string;
  existing?: TransportLeg;
  defaultDirection: Direction;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(existing ? legToDraft(existing) : emptyDraft(defaultDirection, trip, home, homeAirport));
  const [touched, setTouched] = useState({ from: !!existing, to: !!existing });
  const [error, setError] = useState<string>();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setStop = (i: number, patch: Partial<StopDraft>) => setDraft((d) => ({ ...d, stops: d.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const m = draft.mode;
  const locationMode = m === 'fly' ? 'airport' : 'place';
  const pointNoun = m === 'fly' ? 'airport' : m === 'train' ? 'station' : m === 'boat' ? 'port' : 'location';

  function changeMode(mode: TransportMode) {
    const ends = defaultEnds(draft.direction, mode, trip, home, homeAirport);
    set({
      mode,
      // Untouched endpoints re-suggest for the new mode (an airport for flights, an address otherwise).
      ...(touched.from ? {} : { from: ends.from }),
      ...(touched.to ? {} : { to: ends.to }),
      stops: draft.stops.map((s) => ({ ...s, identifier: mode === 'drive' || mode === 'boat' ? '' : s.identifier })),
    });
  }

  function changeDirection(direction: Direction) {
    const date = direction === 'return' ? trip.endDate : trip.startDate;
    const ends = defaultEnds(direction, m, trip, home, homeAirport);
    set({
      direction,
      ...(touched.from ? {} : { from: ends.from }),
      ...(touched.to ? {} : { to: ends.to }),
      ...(draft.departureDate === (draft.direction === 'return' ? trip.endDate : trip.startDate) ? { departureDate: date, arrivalDate: date } : {}),
    });
  }

  // Drive estimate for a single (stop-free) drive, applied when both ends have coordinates.
  function pickEnd(which: 'from' | 'to', label: string, lat?: number, lon?: number) {
    setTouched((t) => ({ ...t, [which]: true }));
    const next = { ...draft, [which]: { label, lat, lon } } as Draft;
    const patch: Partial<Draft> = { [which]: { label, lat, lon } };
    if (m === 'drive' && next.from.lat != null && next.from.lon != null && next.to.lat != null && next.to.lon != null) {
      const est = driveEstimate(next.from.lat, next.from.lon, next.to.lat, next.to.lon);
      Object.assign(patch, { distanceMiles: String(Math.round(est.miles)), travelHours: String(Math.floor(est.minutes / 60)), travelMins: String(est.minutes % 60), distEstimated: true });
    }
    set(patch);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      const leg = draftToLeg(draft, tripId, existing);
      if (existing?.id) await db.tripTransport.update(existing.id, leg);
      else if (draft.direction === 'roundtrip') {
        await db.transaction('rw', db.tripTransport, async () => {
          await db.tripTransport.add(leg);
          await db.tripTransport.add(mirrorLeg(leg, trip.endDate));
        });
      } else await db.tripTransport.add(leg);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const stopLegs = draft.mode === 'drive' ? [draft.from, ...draft.stops.map((s) => s.point), draft.to] : [];
  const driveLegs = stopLegs.slice(0, -1).map((a, i) => {
    const b = stopLegs[i + 1];
    return a.lat != null && a.lon != null && b.lat != null && b.lon != null ? driveEstimate(a.lat, a.lon, b.lat, b.lon) : undefined;
  });

  return (
    <Modal title={existing ? 'Edit transport' : 'Add transport'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Direction">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(['outbound', 'return', 'roundtrip'] as const)
              .filter((dir) => !existing || dir !== 'roundtrip')
              .map((dir) => (
                <label key={dir} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input type="radio" value={dir} checked={draft.direction === dir} onChange={() => changeDirection(dir)} />
                  {dir === 'outbound' ? '→ Outbound' : dir === 'return' ? '← Return' : '⇄ Round trip'}
                </label>
              ))}
          </div>
          {draft.direction === 'roundtrip' && !existing && (
            <span className="mt-1 block text-xs text-slate-500">Adds this journey outbound and the same route back on the trip's last day ({formatDay(trip.endDate)}); add times and flight numbers to the return afterwards.</span>
          )}
        </Field>

        <Field label="Transport mode">
          <select className={inputClass} value={m} onChange={(e) => changeMode(e.target.value as TransportMode)}>
            <option value="fly">✈️ Flight</option>
            <option value="drive">🚗 Drive</option>
            <option value="train">🚂 Train</option>
            <option value="boat">🛳️ Cruise / Boat</option>
          </select>
        </Field>

        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <p className="text-sm font-medium text-slate-700">Departure</p>
          <LocationInput value={draft.from.label} mode={locationMode} onChange={(l, la, lo) => pickEnd('from', l, la, lo)}
            placeholder={m === 'fly' ? 'Search airport: code, name or city' : `Departure ${pointNoun}`} />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${inputClass} min-w-[9rem] flex-1`} value={draft.departureDate} onChange={(e) => set({ departureDate: e.target.value })} required aria-label="Departure date" />
            <TimeInput value={draft.departureTime} onChange={(v) => set({ departureTime: v })} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{m === 'fly' ? 'Layovers / connections' : m === 'drive' ? 'Stops along the way' : m === 'train' ? 'Connections / stops' : 'Port stops'}</span>
            <button type="button" onClick={() => set({ stops: [...draft.stops, emptyStop()] })} className="text-xs text-teal-700 hover:text-teal-900">+ Add stop</button>
          </div>
          {draft.stops.map((stop, i) => (
            <div key={i} className="mb-2 space-y-2 rounded-lg bg-slate-50 p-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocationInput value={stop.point.label} mode={locationMode} onChange={(l, la, lo) => setStop(i, { point: { label: l, lat: la, lon: lo } })} placeholder={`Stop ${i + 1}: ${pointNoun}`} />
                </div>
                <button type="button" onClick={() => set({ stops: draft.stops.filter((_, j) => j !== i) })} className="text-xs text-red-600 hover:text-red-800">Remove</button>
              </div>
              {m !== 'drive' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-slate-500">Arrive</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input type="date" className={`${inputClass} min-w-[8rem] flex-1`} value={stop.arriveDate} onChange={(e) => setStop(i, { arriveDate: e.target.value })} aria-label={`Stop ${i + 1} arrival date`} />
                      <TimeInput value={stop.arrive} onChange={(v) => setStop(i, { arrive: v })} />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Depart</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input type="date" className={`${inputClass} min-w-[8rem] flex-1`} value={stop.departDate} onChange={(e) => setStop(i, { departDate: e.target.value })} aria-label={`Stop ${i + 1} departure date`} />
                      <TimeInput value={stop.depart} onChange={(v) => setStop(i, { depart: v })} />
                    </div>
                  </div>
                  {m !== 'boat' && (
                    <div>
                      <span className="text-xs text-slate-500">{m === 'fly' ? 'Next flight #' : 'Next train #'}</span>
                      <input type="text" className={inputClass} value={stop.identifier} onChange={(e) => setStop(i, { identifier: e.target.value })} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {m !== 'drive' && draft.stops.length > 0 && <p className="text-xs text-slate-400">Layover times are calculated from the arrival and departure times. Dates default to the same day (or the next if the time wraps past midnight).</p>}
        </div>

        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <p className="text-sm font-medium text-slate-700">Final arrival</p>
          <LocationInput value={draft.to.label} mode={locationMode} onChange={(l, la, lo) => pickEnd('to', l, la, lo)}
            placeholder={m === 'fly' ? 'Search airport: code, name or city' : `Arrival ${pointNoun}`} />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${inputClass} min-w-[9rem] flex-1`} value={draft.arrivalDate} onChange={(e) => set({ arrivalDate: e.target.value })} aria-label="Arrival date" />
            <TimeInput value={draft.arrivalTime} onChange={(v) => set({ arrivalTime: v })} />
          </div>
        </div>

        {m !== 'drive' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={m === 'fly' ? 'Airline' : m === 'train' ? 'Train operator' : 'Cruise line'}>
                <input type="text" className={inputClass} value={draft.carrier} onChange={(e) => set({ carrier: e.target.value })} />
              </Field>
              <Field label={m === 'fly' ? 'Flight #' : m === 'train' ? 'Train # / name' : 'Ship name'}>
                <input type="text" className={inputClass} value={draft.identifier} onChange={(e) => set({ identifier: e.target.value })} />
              </Field>
            </div>
            <Field label={m === 'fly' ? 'Booking reference' : 'Ticket reference'}>
              <input type="text" className={inputClass} value={draft.bookingRef} onChange={(e) => set({ bookingRef: e.target.value })} />
            </Field>
          </>
        )}

        {m === 'drive' && draft.stops.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (miles)">
              <input type="number" min={0} className={inputClass} value={draft.distanceMiles} onChange={(e) => set({ distanceMiles: e.target.value, distEstimated: false })} />
            </Field>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Drive time</label>
              <div className="flex gap-2">
                <input type="number" min={0} className={`${inputClass} flex-1`} placeholder="hrs" value={draft.travelHours} onChange={(e) => set({ travelHours: e.target.value, distEstimated: false })} />
                <input type="number" min={0} max={59} className={`${inputClass} flex-1`} placeholder="min" value={draft.travelMins} onChange={(e) => set({ travelMins: e.target.value, distEstimated: false })} />
              </div>
            </div>
          </div>
        )}
        {m === 'drive' && draft.stops.length === 0 && draft.distEstimated && (
          <p className="text-xs text-slate-400">Estimated from the straight-line distance × 1.3 at 60 mph on average. Adjust as needed.</p>
        )}
        {m === 'drive' && draft.stops.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <p className="font-medium">Calculated for each leg</p>
            <ul className="mt-1 space-y-0.5">
              {driveLegs.map((est, i) => (
                <li key={i}>
                  Leg {i + 1}: {stopLegs[i].label || '?'} → {stopLegs[i + 1].label || '?'} — {est ? `${Math.round(est.miles)} mi · ${formatMinutes(est.minutes)}` : 'pick both places from the search results to calculate'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Notes" hint="Optional">
          <textarea className={`${inputClass} resize-none`} rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{existing ? 'Save changes' : draft.direction === 'roundtrip' ? 'Add round trip' : 'Add transport'}</Button>
        </div>
      </form>
    </Modal>
  );
}
