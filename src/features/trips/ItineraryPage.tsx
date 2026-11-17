import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { HomeLocation, ScheduledActivity, TransportConnection, TransportLeg, TransportMode, Trip, TripDay, TripLodging } from '../../db/types';
import { fmt12h, formatDay, shortLocation } from '../../lib/dates';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { TimeInput } from '../../components/TimeInput';
import { LocationInput } from '../../components/LocationInput';
import { TripTabs } from './TripTabs';
import { getDayLocation } from './TripDetail';

// ─── Form draft types ────────────────────────────────────────────────────────

type ConnDraft = { point: string; arrive: string; depart: string; identifier: string };

type TransportDraft = {
  direction: 'outbound' | 'return';
  mode: TransportMode;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  fromPoint: string;
  fromLat: number | undefined;
  fromLon: number | undefined;
  toPoint: string;
  toLat: number | undefined;
  toLon: number | undefined;
  carrier: string;
  identifier: string;
  bookingRef: string;
  distanceMiles: string;
  travelHours: string;
  travelMins: string;
  distEstimated: boolean;
  connections: ConnDraft[];
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyConn(): ConnDraft {
  return { point: '', arrive: '', depart: '', identifier: '' };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDriveEstimate(
  lat1: number, lon1: number, lat2: number, lon2: number,
): { distMi: number; h: number; m: number } {
  const km = haversineKm(lat1, lon1, lat2, lon2) * 1.3; // ~1.3× road factor
  const distMi = km * 0.621371;
  const totalMins = Math.round(distMi); // assume avg 60 mph → 1 min per mile
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return { distMi, h, m };
}

function tripDestPoint(trip: Trip, direction: 'outbound' | 'return'): { label: string; lat?: number; lon?: number } {
  if (trip.stops && trip.stops.length > 0) {
    const stop = direction === 'outbound' ? trip.stops[0] : trip.stops[trip.stops.length - 1];
    return { label: shortLocation(stop.label), lat: stop.lat, lon: stop.lon };
  }
  const label = trip.placeLabel ? shortLocation(trip.placeLabel) : trip.destination;
  return { label, lat: trip.lat, lon: trip.lon };
}

function emptyTransportDraft(
  direction: 'outbound' | 'return',
  trip: Trip,
  home?: HomeLocation,
): TransportDraft {
  const dest = tripDestPoint(trip, direction);
  const fromPoint = direction === 'outbound' ? (home?.label ?? '') : dest.label;
  const fromLat = direction === 'outbound' ? home?.lat : dest.lat;
  const fromLon = direction === 'outbound' ? home?.lon : dest.lon;
  const toPoint = direction === 'outbound' ? dest.label : (home?.label ?? '');
  const toLat = direction === 'outbound' ? dest.lat : home?.lat;
  const toLon = direction === 'outbound' ? dest.lon : home?.lon;
  return {
    direction, mode: 'fly',
    departureDate: direction === 'outbound' ? trip.startDate : trip.endDate,
    departureTime: '',
    arrivalDate: direction === 'outbound' ? trip.startDate : trip.endDate,
    arrivalTime: '',
    fromPoint, fromLat, fromLon,
    toPoint, toLat, toLon,
    carrier: '', identifier: '', bookingRef: '',
    distanceMiles: '', travelHours: '', travelMins: '',
    distEstimated: false,
    connections: [], notes: '',
  };
}

function legToDraft(leg: TransportLeg): TransportDraft {
  const h = leg.travelTimeMinutes ? Math.floor(leg.travelTimeMinutes / 60) : 0;
  const m = leg.travelTimeMinutes ? leg.travelTimeMinutes % 60 : 0;
  return {
    direction: leg.direction, mode: leg.mode,
    departureDate: leg.departureDate, departureTime: leg.departureTime ?? '',
    arrivalDate: leg.arrivalDate ?? '', arrivalTime: leg.arrivalTime ?? '',
    fromPoint: leg.fromPoint ?? '', fromLat: undefined, fromLon: undefined,
    toPoint: leg.toPoint ?? '', toLat: undefined, toLon: undefined,
    carrier: leg.carrier ?? '', identifier: leg.identifier ?? '', bookingRef: leg.bookingRef ?? '',
    distanceMiles: leg.distanceMiles ? String(leg.distanceMiles) : '',
    travelHours: h ? String(h) : '', travelMins: m ? String(m) : '',
    distEstimated: false,
    connections: (leg.connections ?? []).map((c) => ({
      point: c.point, arrive: c.arrive ?? '', depart: c.depart ?? '', identifier: c.identifier ?? '',
    })),
    notes: leg.notes ?? '',
  };
}

function draftToLeg(d: TransportDraft, tripId: number): Omit<TransportLeg, 'id'> {
  const travelMins = d.mode === 'drive'
    ? (parseInt(d.travelHours) || 0) * 60 + (parseInt(d.travelMins) || 0)
    : 0;
  const conns: TransportConnection[] = d.connections
    .filter((c) => c.point.trim())
    .map((c) => ({
      point: c.point.trim(),
      arrive: c.arrive || undefined,
      depart: c.depart || undefined,
      identifier: c.identifier.trim() || undefined,
    }));
  return {
    tripId, direction: d.direction, mode: d.mode,
    departureDate: d.departureDate, departureTime: d.departureTime || undefined,
    arrivalDate: d.arrivalDate || undefined, arrivalTime: d.arrivalTime || undefined,
    fromPoint: d.fromPoint.trim() || undefined, toPoint: d.toPoint.trim() || undefined,
    carrier: d.carrier.trim() || undefined, identifier: d.identifier.trim() || undefined,
    bookingRef: d.bookingRef.trim() || undefined,
    distanceMiles: d.distanceMiles ? parseFloat(d.distanceMiles) : undefined,
    travelTimeMinutes: travelMins || undefined,
    connections: conns.length ? conns : undefined,
    notes: d.notes.trim() || undefined,
    createdAt: Date.now(),
  };
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeToMins(t: string): number | null {
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '');
  const m = parseInt(parts[1] ?? '');
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function timeDiffStr(dep: string, arr: string): string | null {
  const d = timeToMins(dep);
  const a = timeToMins(arr);
  if (d === null || a === null) return null;
  let diff = a - d;
  if (diff < 0) diff += 1440; // overnight
  return diff > 0 ? formatMinutes(diff) : null;
}

// ─── Transport leg card ───────────────────────────────────────────────────────

const MODE_ICON: Record<TransportMode, string> = { drive: '🚗', fly: '✈️', train: '🚂', boat: '🛳️' };
const MODE_LABEL: Record<TransportMode, string> = { drive: 'Drive', fly: 'Fly', train: 'Train', boat: 'Cruise / Boat' };

function TransportLegCard({ leg, onEdit, onDelete }: { leg: TransportLeg; onEdit: () => void; onDelete: () => void }) {
  const icon = MODE_ICON[leg.mode];
  const modeLabel = MODE_LABEL[leg.mode];
  const conns = leg.connections ?? [];
  const nSegs = conns.length + 1;

  const cardActions = (
    <div className="no-print flex shrink-0 gap-1">
      <button type="button" onClick={onEdit} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">Edit</button>
      <button type="button" onClick={onDelete} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
    </div>
  );

  if (conns.length > 0) {
    // Build segment list: each segment is one flight leg between two airports
    const segments = Array.from({ length: nSegs }, (_, k) => {
      const from = k === 0 ? (leg.fromPoint ?? '') : (conns[k - 1]?.point ?? '');
      const depTime = k === 0 ? (leg.departureTime ?? '') : (conns[k - 1]?.depart ?? '');
      const to = k === nSegs - 1 ? (leg.toPoint ?? '') : (conns[k]?.point ?? '');
      const arrTime = k === nSegs - 1 ? (leg.arrivalTime ?? '') : (conns[k]?.arrive ?? '');
      const flightNum = k === 0 ? (leg.identifier ?? '') : (conns[k - 1]?.identifier ?? '');
      // Layover after this segment's arrival (before the next departure)
      const layoverAfter =
        k < nSegs - 1 && conns[k]
          ? timeDiffStr(conns[k]!.arrive ?? '', conns[k]!.depart ?? '')
          : null;
      return { from, depTime, to, arrTime, flightNum, layoverAfter };
    });

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-sm font-semibold">{icon} {modeLabel} · {conns.length} stop{conns.length > 1 ? 's' : ''}</p>
              <span className="text-xs text-slate-500">{formatDay(leg.departureDate)}</span>
              {leg.carrier && <span className="text-xs text-slate-500">{leg.carrier}</span>}
              {leg.bookingRef && <span className="text-xs text-slate-500">Ref: {leg.bookingRef}</span>}
            </div>
            <div className="mt-2 space-y-1">
              {segments.map((seg, k) => {
                const dur = seg.depTime && seg.arrTime ? timeDiffStr(seg.depTime, seg.arrTime) : null;
                return (
                  <div key={k}>
                    {/* Segment row: DepTime  From  →  flightNum · duration  →  ArrTime  To */}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                      {seg.depTime && <span className="font-mono font-medium">{fmt12h(seg.depTime)}</span>}
                      {seg.from && <span className="font-medium">{seg.from}</span>}
                      <span className="text-slate-400">→</span>
                      {seg.flightNum && <span className="text-xs text-slate-500">{seg.flightNum}</span>}
                      {dur && <span className="text-xs text-slate-400">({dur})</span>}
                      <span className="text-slate-400">→</span>
                      {seg.arrTime && <span className="font-mono text-slate-600">{fmt12h(seg.arrTime)}</span>}
                      {seg.to && <span className="text-slate-700">{seg.to}</span>}
                    </div>
                    {/* Layover badge between segments */}
                    {seg.layoverAfter && (
                      <div className="ml-2 mt-0.5 w-fit rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        ⏱ Layover: {seg.layoverAfter}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {leg.notes && <p className="mt-1 text-xs italic text-slate-400">{leg.notes}</p>}
          </div>
          {cardActions}
        </div>
      </div>
    );
  }

  // Direct leg (no connections)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold">{icon} {modeLabel}</p>
            <span className="text-xs text-slate-500">{formatDay(leg.departureDate)}</span>
            {leg.carrier && <span className="text-xs text-slate-500">{leg.carrier}</span>}
            {leg.identifier && <span className="text-xs text-slate-500">{leg.identifier}</span>}
            {leg.bookingRef && <span className="text-xs text-slate-500">Ref: {leg.bookingRef}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700">
            {leg.departureTime && <span className="font-mono font-medium">{fmt12h(leg.departureTime)}</span>}
            {leg.fromPoint && <span className="font-medium">{leg.fromPoint}</span>}
            {(leg.toPoint || leg.arrivalTime) && <span className="text-slate-400">→</span>}
            {leg.arrivalDate && leg.arrivalDate !== leg.departureDate && (
              <span className="text-xs text-slate-500">{formatDay(leg.arrivalDate)}</span>
            )}
            {leg.arrivalTime && <span className="font-mono">{fmt12h(leg.arrivalTime)}</span>}
            {leg.toPoint && <span>{leg.toPoint}</span>}
          </div>
          {leg.distanceMiles != null && (
            <p className="mt-0.5 text-xs text-slate-500">
              {leg.distanceMiles.toFixed(0)} mi{leg.travelTimeMinutes ? ` · ${formatMinutes(leg.travelTimeMinutes)}` : ''}
            </p>
          )}
          {leg.notes && <p className="mt-0.5 text-xs italic text-slate-400">{leg.notes}</p>}
        </div>
        {cardActions}
      </div>
    </div>
  );
}

// ─── Transport form modal ─────────────────────────────────────────────────────

function TransportFormModal({ tripId, trip, home, existing, defaultDirection, onClose }: {
  tripId: number;
  trip: Trip;
  home?: HomeLocation;
  existing?: TransportLeg;
  defaultDirection: 'outbound' | 'return';
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TransportDraft>(
    existing ? legToDraft(existing) : emptyTransportDraft(defaultDirection, trip, home),
  );
  const [error, setError] = useState<string>();

  function set(patch: Partial<TransportDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function setConn(i: number, patch: Partial<ConnDraft>) {
    setDraft((d) => ({
      ...d,
      connections: d.connections.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));
  }

  function updateFrom(label: string, lat?: number, lon?: number) {
    const patch: Partial<TransportDraft> = { fromPoint: label, fromLat: lat, fromLon: lon };
    if (draft.mode === 'drive' && lat !== undefined && lon !== undefined &&
        draft.toLat !== undefined && draft.toLon !== undefined) {
      const est = calcDriveEstimate(lat, lon, draft.toLat, draft.toLon);
      patch.distanceMiles = String(Math.round(est.distMi));
      patch.travelHours = String(est.h);
      patch.travelMins = String(est.m);
      patch.distEstimated = true;
    }
    set(patch);
  }

  function updateTo(label: string, lat?: number, lon?: number) {
    const patch: Partial<TransportDraft> = { toPoint: label, toLat: lat, toLon: lon };
    if (draft.mode === 'drive' && lat !== undefined && lon !== undefined &&
        draft.fromLat !== undefined && draft.fromLon !== undefined) {
      const est = calcDriveEstimate(draft.fromLat, draft.fromLon, lat, lon);
      patch.distanceMiles = String(Math.round(est.distMi));
      patch.travelHours = String(est.h);
      patch.travelMins = String(est.m);
      patch.distEstimated = true;
    }
    set(patch);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      const leg = draftToLeg(draft, tripId);
      if (existing?.id) {
        await db.tripTransport.update(existing.id, leg);
      } else {
        await db.tripTransport.add(leg);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const m = draft.mode;
  const showCarrier = m !== 'drive';
  const showDistance = m === 'drive' || m === 'train';
  const showDuration = m === 'drive';
  const showConnections = m !== 'drive';
  const connLabel = m === 'fly' ? 'Connecting flights' : m === 'train' ? 'Connections / stops' : 'Port stops';
  const connPointLabel = m === 'fly' ? 'Airport' : m === 'train' ? 'Station' : 'Port';
  const connIdLabel = m === 'fly' ? 'Next flight #' : 'Next train #';

  return (
    <Modal title={existing ? 'Edit transport' : 'Add transport'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {/* Direction */}
        <Field label="Direction">
          <div className="flex gap-4">
            {(['outbound', 'return'] as const).map((dir) => (
              <label key={dir} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input type="radio" value={dir} checked={draft.direction === dir} onChange={() => set({ direction: dir })} />
                {dir === 'outbound' ? '→ Outbound' : '← Return'}
              </label>
            ))}
          </div>
        </Field>

        {/* Mode */}
        <Field label="Transport mode">
          <select className={inputClass} value={draft.mode} onChange={(e) => set({ mode: e.target.value as TransportMode, connections: [] })}>
            <option value="fly">✈️ Fly</option>
            <option value="drive">🚗 Drive</option>
            <option value="train">🚂 Train</option>
            <option value="boat">🛳️ Cruise / Boat</option>
          </select>
        </Field>

        {/* Dates & times */}
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Departure</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className={`${inputClass} min-w-[9rem] flex-1`} value={draft.departureDate}
                onChange={(e) => set({ departureDate: e.target.value })} required />
              <TimeInput value={draft.departureTime} onChange={(v) => set({ departureTime: v })} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Arrival</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className={`${inputClass} min-w-[9rem] flex-1`} value={draft.arrivalDate}
                onChange={(e) => set({ arrivalDate: e.target.value })} />
              <TimeInput value={draft.arrivalTime} onChange={(v) => set({ arrivalTime: v })} />
            </div>
          </div>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={m === 'fly' ? 'From airport' : m === 'train' ? 'Departure station' : m === 'boat' ? 'Departure port' : 'From'}>
            <LocationInput
              value={draft.fromPoint}
              onChange={updateFrom}
              placeholder={m === 'fly' ? 'e.g. JFK, New York' : m === 'drive' ? 'Starting location' : ''}
            />
          </Field>
          <Field label={m === 'fly' ? 'To airport' : m === 'train' ? 'Arrival station' : m === 'boat' ? 'Arrival port' : 'To'}>
            <LocationInput
              value={draft.toPoint}
              onChange={updateTo}
              placeholder={m === 'fly' ? 'e.g. LHR, London' : m === 'drive' ? 'Destination' : ''}
            />
          </Field>
        </div>

        {/* Carrier / identifier / booking */}
        {showCarrier && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={m === 'fly' ? 'Airline' : m === 'train' ? 'Train operator' : 'Cruise line'}>
              <input type="text" className={inputClass} value={draft.carrier} onChange={(e) => set({ carrier: e.target.value })} />
            </Field>
            <Field label={m === 'fly' ? 'Flight #' : m === 'train' ? 'Train # / name' : 'Ship name'}>
              <input type="text" className={inputClass} value={draft.identifier} onChange={(e) => set({ identifier: e.target.value })} />
            </Field>
          </div>
        )}
        {showCarrier && (
          <Field label={m === 'fly' ? 'Booking reference' : 'Ticket reference'}>
            <input type="text" className={inputClass} value={draft.bookingRef} onChange={(e) => set({ bookingRef: e.target.value })} />
          </Field>
        )}

        {/* Distance + duration (drive/train) */}
        {showDistance && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (miles)">
              <input type="number" min={0} className={inputClass} value={draft.distanceMiles}
                onChange={(e) => set({ distanceMiles: e.target.value, distEstimated: false })} />
            </Field>
            {showDuration && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Travel time</label>
                <div className="flex gap-2">
                  <input type="number" min={0} className={`${inputClass} flex-1`} placeholder="hrs"
                    value={draft.travelHours} onChange={(e) => set({ travelHours: e.target.value, distEstimated: false })} />
                  <input type="number" min={0} max={59} className={`${inputClass} flex-1`} placeholder="min"
                    value={draft.travelMins} onChange={(e) => set({ travelMins: e.target.value, distEstimated: false })} />
                </div>
              </div>
            )}
          </div>
        )}
        {showDistance && draft.distEstimated && (
          <p className="text-xs text-slate-400">
            Estimated from straight-line distance × 1.3 at 60 mph avg. Adjust as needed.
          </p>
        )}

        {/* Connections */}
        {showConnections && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{connLabel}</span>
              <button type="button" onClick={() => set({ connections: [...draft.connections, emptyConn()] })}
                className="text-xs text-teal-700 hover:text-teal-900">+ Add</button>
            </div>
            {draft.connections.map((conn, ci) => (
              <div key={ci} className="mb-2 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
                <div className="flex-1" style={{ minWidth: '8rem' }}>
                  <label className="mb-1 block text-xs text-slate-500">{connPointLabel}</label>
                  <LocationInput
                    value={conn.point}
                    onChange={(label) => setConn(ci, { point: label })}
                    placeholder={connPointLabel}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Arrive</label>
                  <TimeInput value={conn.arrive} onChange={(v) => setConn(ci, { arrive: v })} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Depart</label>
                  <TimeInput value={conn.depart} onChange={(v) => setConn(ci, { depart: v })} />
                </div>
                {m !== 'boat' && (
                  <div className="w-28">
                    <label className="text-xs text-slate-500">{connIdLabel}</label>
                    <input type="text" className={inputClass} value={conn.identifier} onChange={(e) => setConn(ci, { identifier: e.target.value })} />
                  </div>
                )}
                <button type="button" onClick={() => set({ connections: draft.connections.filter((_, j) => j !== ci) })}
                  className="self-end pb-1 text-xs text-red-600 hover:text-red-800">Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <Field label="Notes" hint="Optional">
          <textarea className={`${inputClass} resize-none`} rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{existing ? 'Save changes' : 'Add transport'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Activity form modal ──────────────────────────────────────────────────────

const ACTIVITY_CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner',
  'Museum', 'Tour', 'Show / Performance',
  'Sports', 'Shopping', 'Spa',
  'Beach', 'Excursion', 'Other',
];

function ActivityFormModal({ tripId, trip, days, existing, defaultDayId, onClose }: {
  tripId: number;
  trip: Trip;
  days: TripDay[];
  existing?: ScheduledActivity;
  defaultDayId: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [dayId, setDayId] = useState(existing?.tripDayId ?? defaultDayId);
  const [category, setCategory] = useState(existing?.category ?? '');
  const [startTime, setStartTime] = useState(existing?.startTime ?? '');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [durationMins, setDurationMins] = useState(existing?.durationMinutes ? String(existing.durationMinutes) : '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Coordinates to bias POI search toward the active day's location
  const nearCoords = (() => {
    const day = days.find((d) => d.id === dayId);
    if (trip.stops && trip.stops.length > 1 && day) {
      const stop = [...trip.stops].reverse().find((s) => s.startDate <= day.date);
      if (stop?.lat && stop?.lon) return { lat: stop.lat, lon: stop.lon };
    }
    if (trip.lat && trip.lon) return { lat: trip.lat, lon: trip.lon };
    return undefined;
  })();
  const [error, setError] = useState<string>();

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      const activity: Omit<ScheduledActivity, 'id'> = {
        tripId, tripDayId: dayId,
        name: name.trim(),
        category: category || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        durationMinutes: durationMins ? parseInt(durationMins) : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        outfitId: existing?.outfitId,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      if (existing?.id) {
        await db.tripActivities.update(existing.id, activity);
      } else {
        await db.tripActivities.add(activity);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={existing ? 'Edit activity' : 'Add activity'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Activity name">
          <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dinner at La Trattoria" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <select className={inputClass} value={dayId} onChange={(e) => setDayId(Number(e.target.value))}>
              {days.map((d, i) => (
                <option key={d.id} value={d.id}>{`Day ${i + 1} · ${formatDay(d.date)}`}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" hint="Optional">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— None —</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c.toLowerCase()}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" hint="Optional">
            <TimeInput value={startTime} onChange={setStartTime} />
          </Field>
          <Field label="End time" hint="Optional">
            <TimeInput value={endTime} onChange={setEndTime} />
          </Field>
        </div>

        <Field label="Duration (minutes)" hint="Optional; leave blank if start/end times are set">
          <input type="number" min={0} className={inputClass} value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
        </Field>

        <Field label="Location" hint="Search by business name, landmark, or address">
          <LocationInput
            value={location}
            onChange={(label) => setLocation(label)}
            placeholder="e.g. Eiffel Tower, Le Meurice Paris…"
            mode="poi"
            near={nearCoords}
          />
        </Field>

        <Field label="Notes" hint="Optional">
          <textarea className={`${inputClass} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{existing ? 'Save changes' : 'Add activity'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Lodging card ─────────────────────────────────────────────────────────────

function LodgingCard({ stay, tripCity, onEdit, onDelete }: { stay: TripLodging; tripCity?: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-semibold">🏨 {stay.name}</p>
            {tripCity && <span className="text-xs font-normal text-teal-700">{tripCity}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700">
            <span>{formatDay(stay.checkInDate)}{stay.checkInTime ? ` · ${fmt12h(stay.checkInTime)}` : ''}</span>
            <span className="text-slate-400">→</span>
            <span>{formatDay(stay.checkOutDate)}{stay.checkOutTime ? ` · ${fmt12h(stay.checkOutTime)}` : ''}</span>
          </div>
          {stay.location && <p className="mt-0.5 text-xs text-slate-500">📍 {stay.location}</p>}
          {stay.confirmationNumber && (
            <p className="mt-0.5 text-xs text-slate-500">Conf: {stay.confirmationNumber}</p>
          )}
          {stay.phone && <p className="mt-0.5 text-xs text-slate-500">📞 {stay.phone}</p>}
          {stay.notes && <p className="mt-0.5 text-xs italic text-slate-400">{stay.notes}</p>}
        </div>
        <div className="no-print flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">Edit</button>
          <button type="button" onClick={onDelete} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Lodging form modal ────────────────────────────────────────────────────────

function LodgingFormModal({ tripId, trip, existing, onClose }: {
  tripId: number;
  trip: Trip;
  existing?: TripLodging;
  onClose: () => void;
}) {
  const nearCoords = trip.lat && trip.lon ? { lat: trip.lat, lon: trip.lon } : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [checkInDate, setCheckInDate] = useState(existing?.checkInDate ?? trip.startDate);
  const [checkInTime, setCheckInTime] = useState(existing?.checkInTime ?? '');
  const [checkOutDate, setCheckOutDate] = useState(existing?.checkOutDate ?? trip.endDate);
  const [checkOutTime, setCheckOutTime] = useState(existing?.checkOutTime ?? '');
  const [confirmationNumber, setConfirmationNumber] = useState(existing?.confirmationNumber ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [locationLat, setLocationLat] = useState<number | undefined>(existing?.locationLat);
  const [locationLon, setLocationLon] = useState<number | undefined>(existing?.locationLon);
  const [error, setError] = useState<string>();

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!name.trim()) { setError('Lodging name is required.'); return; }
    if (!checkInDate || !checkOutDate) { setError('Check-in and check-out dates are required.'); return; }
    if (checkOutDate < checkInDate) { setError('Check-out must be on or after check-in.'); return; }
    try {
      const stay: Omit<TripLodging, 'id'> = {
        tripId,
        name: name.trim(),
        location: location.trim() || undefined,
        locationLat,
        locationLon,
        checkInDate,
        checkInTime: checkInTime || undefined,
        checkOutDate,
        checkOutTime: checkOutTime || undefined,
        confirmationNumber: confirmationNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      if (existing?.id) {
        await db.tripLodging.update(existing.id, stay);
      } else {
        await db.tripLodging.add(stay);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={existing ? 'Edit lodging' : 'Add lodging'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Address" hint="Search by name or address — name auto-fills below">
          <LocationInput
            value={location}
            onChange={(label, lat, lon) => {
              setLocation(label);
              setLocationLat(lat);
              setLocationLon(lon);
              // Auto-fill name from the first segment of the selected result
              if (lat !== undefined && !name.trim()) {
                const suggested = label.split(',')[0]?.trim() ?? '';
                if (suggested) setName(suggested);
              }
            }}
            placeholder="e.g. Marriott Opera Grand, 228 Rue de Rivoli…"
            mode="poi"
            near={nearCoords}
          />
        </Field>

        <Field label="Hotel / lodging name">
          <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marriott Opera Grand" required />
        </Field>

        <Field label="Check-in">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${inputClass} flex-1 min-w-[8rem]`} value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)} required />
            <TimeInput value={checkInTime} onChange={setCheckInTime} />
          </div>
        </Field>

        <Field label="Check-out">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={`${inputClass} flex-1 min-w-[8rem]`} value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)} required />
            <TimeInput value={checkOutTime} onChange={setCheckOutTime} />
          </div>
          {checkOutDate !== trip.endDate && (
            <button type="button" className="mt-1 text-xs text-teal-700 hover:underline" onClick={() => setCheckOutDate(trip.endDate)}>
              Use the trip's last day ({formatDay(trip.endDate)})
            </button>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Confirmation #" hint="Optional">
            <input type="text" className={inputClass} value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="e.g. ABC123" />
          </Field>
          <Field label="Phone" hint="Optional">
            <input type="tel" className={inputClass} value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 000 1234" />
          </Field>
        </div>

        <Field label="Notes" hint="Optional">
          <textarea className={`${inputClass} resize-none`} rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{existing ? 'Save changes' : 'Add lodging'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ItineraryPage({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  const days = useLiveQuery(() => db.tripDays.where('tripId').equals(tripId).sortBy('date'), [tripId]);
  const transport = useLiveQuery(() => db.tripTransport.where('tripId').equals(tripId).toArray(), [tripId]);
  const activities = useLiveQuery(() => db.tripActivities.where('tripId').equals(tripId).toArray(), [tripId]);
  const lodging = useLiveQuery(
    () => db.tripLodging.where('tripId').equals(tripId).sortBy('checkInDate'),
    [tripId],
  );
  const homeLocation = useLiveQuery(
    async () => {
      const row = await db.settings.get('homeLocation');
      return row ? (row.value as HomeLocation) : null;
    },
    [],
  );

  type TransportFormState = { leg?: TransportLeg; direction: 'outbound' | 'return' } | null;
  type ActivityFormState = { activity?: ScheduledActivity; dayId: number } | null;

  const [transportForm, setTransportForm] = useState<TransportFormState>(null);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(null);
  const [lodgingForm, setLodgingForm] = useState<TripLodging | null | false>(false); // false=closed, null=new, TripLodging=edit

  if (trip === undefined || days === undefined || transport === undefined || activities === undefined || lodging === undefined) {
    return (
      <div className="space-y-4">
        <TripTabs tripId={tripId} current="itinerary" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }
  if (!trip) return <p className="text-sm text-slate-500">Trip not found.</p>;

  async function deleteTransportLeg(leg: TransportLeg) {
    if (!confirm(`Remove this ${MODE_LABEL[leg.mode]} leg?`)) return;
    await db.tripTransport.delete(leg.id!);
  }

  async function deleteActivity(act: ScheduledActivity) {
    if (!confirm(`Remove "${act.name}"?`)) return;
    await db.tripActivities.delete(act.id!);
  }

  async function deleteLodging(stay: TripLodging) {
    if (!confirm(`Remove "${stay.name}"?`)) return;
    await db.tripLodging.delete(stay.id!);
  }

  const lastDayDate = days[days.length - 1]?.date;

  const lodgingItems = lodging ?? [];
  // The stay that ends latest: offer to extend it when nights at the end of the trip have no lodging.
  const lastStay = lodgingItems.reduce<TripLodging | undefined>((m, s) => (!m || s.checkOutDate > m.checkOutDate ? s : m), undefined);
  const uncoveredNights = days.filter((d) => d.date !== lastDayDate && !lodgingItems.some((s) => s.checkInDate <= d.date && d.date < s.checkOutDate));
  const canExtendLastStay = !!lastStay && !!lastDayDate && lastStay.checkOutDate < lastDayDate && uncoveredNights.some((d) => d.date >= lastStay.checkOutDate);

  function lodgingForNight(date: string): TripLodging | undefined {
    return lodgingItems.find((s) => s.checkInDate <= date && date < s.checkOutDate);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 no-print">
        <TripTabs tripId={tripId} current="itinerary" />
        <Button onClick={() => window.print()} title="Print itinerary">
          <Icon name="printer" /> Print
        </Button>
      </div>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{trip.name ?? trip.placeLabel ?? trip.destination} — Itinerary</h1>
      </div>

      {/* ── Transportation ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Transportation</h2>

        {(['outbound', 'return'] as const).map((dir) => {
          const legs = transport.filter((l) => l.direction === dir).sort((a, b) => a.departureDate.localeCompare(b.departureDate));
          return (
            <div key={dir} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                {dir === 'outbound' ? '→ Outbound' : '← Return'}
              </h3>
              {legs.length === 0 && (
                <p className="text-sm text-slate-400">No transport added yet.</p>
              )}
              {legs.map((leg) => (
                <TransportLegCard
                  key={leg.id}
                  leg={leg}
                  onEdit={() => setTransportForm({ leg, direction: dir })}
                  onDelete={() => void deleteTransportLeg(leg)}
                />
              ))}
              <div className="no-print">
                <Button variant="ghost" onClick={() => setTransportForm({ leg: undefined, direction: dir })}>
                  <Icon name="plus" /> Add {dir} transport
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Lodging ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Lodging</h2>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          {lodgingItems.length === 0 && (
            <p className="text-sm text-slate-400">No lodging added yet.</p>
          )}
          {lodgingItems.map((stay) => (
            <LodgingCard
              key={stay.id}
              stay={stay}
              tripCity={getDayLocation(trip, stay.checkInDate)}
              onEdit={() => setLodgingForm(stay)}
              onDelete={() => void deleteLodging(stay)}
            />
          ))}
          {canExtendLastStay && lastStay && (
            <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>
                {lastStay.name} ends {formatDay(lastStay.checkOutDate)}, but the trip runs to {formatDay(lastDayDate!)}.
              </span>
              <Button variant="secondary" onClick={() => void db.tripLodging.update(lastStay.id!, { checkOutDate: lastDayDate! })}>
                Extend to {formatDay(lastDayDate!)}
              </Button>
            </div>
          )}
          <div className="no-print">
            <Button variant="ghost" onClick={() => setLodgingForm(null)}>
              <Icon name="plus" /> Add lodging
            </Button>
          </div>
        </div>
      </section>

      {/* ── Scheduled Activities ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Scheduled Activities</h2>
        <p className="text-xs text-slate-500">Activities added here appear on each day card in the Trip Overview, where you can link them to an outfit.</p>

        {days.map((day, i) => {
          const dayActivities = activities
            .filter((a) => a.tripDayId === day.id)
            .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
          const isLastDay = day.date === lastDayDate;
          const nightStay = isLastDay ? undefined : lodgingForNight(day.date);

          return (
            <div key={day.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-sm font-semibold text-slate-700">
                  Day {i + 1} · {formatDay(day.date)}
                  {(() => { const loc = getDayLocation(trip, day.date); return loc ? <span className="font-normal text-teal-700"> · {loc}</span> : null; })()}
                </h3>
                {!isLastDay && (
                  nightStay
                    ? <span className="text-xs text-slate-500">🏨 {nightStay.name}</span>
                    : <span className="text-xs text-amber-600">🏨 No lodging</span>
                )}
              </div>

              {dayActivities.length === 0 && (
                <p className="text-sm text-slate-400">No activities scheduled.</p>
              )}

              {dayActivities.map((act) => (
                <div key={act.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {act.startTime && <span className="mr-2 text-slate-500">{fmt12h(act.startTime)}</span>}
                        {act.name}
                        {act.endTime && <span className="ml-1 text-slate-500">– {fmt12h(act.endTime)}</span>}
                        {act.durationMinutes && !act.endTime && (
                          <span className="ml-1 text-xs text-slate-400">({formatMinutes(act.durationMinutes)})</span>
                        )}
                      </p>
                      {act.category && <p className="mt-0.5 text-xs capitalize text-slate-500">{act.category}</p>}
                      {act.location && <p className="mt-0.5 text-xs text-slate-400">📍 {act.location}</p>}
                      {act.notes && <p className="mt-0.5 text-xs italic text-slate-400">{act.notes}</p>}
                    </div>
                    <div className="no-print flex shrink-0 gap-1">
                      <button type="button" onClick={() => setActivityForm({ activity: act, dayId: day.id! })}
                        className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">Edit</button>
                      <button type="button" onClick={() => void deleteActivity(act)}
                        className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="no-print">
                <Button variant="ghost" onClick={() => setActivityForm({ activity: undefined, dayId: day.id! })}>
                  <Icon name="plus" /> Add activity
                </Button>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {transportForm && (
        <TransportFormModal
          tripId={tripId}
          trip={trip}
          home={homeLocation ?? undefined}
          existing={transportForm.leg}
          defaultDirection={transportForm.direction}
          onClose={() => setTransportForm(null)}
        />
      )}
      {activityForm && trip && (
        <ActivityFormModal
          tripId={tripId}
          trip={trip}
          days={days}
          existing={activityForm.activity}
          defaultDayId={activityForm.dayId}
          onClose={() => setActivityForm(null)}
        />
      )}
      {lodgingForm !== false && (
        <LodgingFormModal
          tripId={tripId}
          trip={trip}
          existing={lodgingForm ?? undefined}
          onClose={() => setLodgingForm(false)}
        />
      )}
    </div>
  );
}
