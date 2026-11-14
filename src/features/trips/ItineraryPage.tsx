import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { ScheduledActivity, TransportConnection, TransportLeg, TransportMode, Trip, TripDay } from '../../db/types';
import { formatDay } from '../../lib/dates';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { TripTabs } from './TripTabs';

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
  toPoint: string;
  carrier: string;
  identifier: string;
  bookingRef: string;
  distanceMiles: string;
  travelHours: string;
  travelMins: string;
  connections: ConnDraft[];
  notes: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyConn(): ConnDraft {
  return { point: '', arrive: '', depart: '', identifier: '' };
}

function emptyTransportDraft(direction: 'outbound' | 'return', trip: Trip): TransportDraft {
  return {
    direction, mode: 'fly',
    departureDate: trip.startDate, departureTime: '',
    arrivalDate: trip.startDate, arrivalTime: '',
    fromPoint: '', toPoint: '',
    carrier: '', identifier: '', bookingRef: '',
    distanceMiles: '', travelHours: '', travelMins: '',
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
    fromPoint: leg.fromPoint ?? '', toPoint: leg.toPoint ?? '',
    carrier: leg.carrier ?? '', identifier: leg.identifier ?? '', bookingRef: leg.bookingRef ?? '',
    distanceMiles: leg.distanceMiles ? String(leg.distanceMiles) : '',
    travelHours: h ? String(h) : '', travelMins: m ? String(m) : '',
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

// ─── Transport leg card ───────────────────────────────────────────────────────

const MODE_ICON: Record<TransportMode, string> = { drive: '🚗', fly: '✈️', train: '🚂', boat: '🛳️' };
const MODE_LABEL: Record<TransportMode, string> = { drive: 'Drive', fly: 'Fly', train: 'Train', boat: 'Cruise / Boat' };

function TransportLegCard({ leg, onEdit, onDelete }: { leg: TransportLeg; onEdit: () => void; onDelete: () => void }) {
  const icon = MODE_ICON[leg.mode];
  const label = MODE_LABEL[leg.mode];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{icon} {label}</p>
          <p className="mt-0.5 text-sm text-slate-700">
            {formatDay(leg.departureDate)}
            {leg.departureTime && <span> {leg.departureTime}</span>}
            {leg.fromPoint && <span> · {leg.fromPoint}</span>}
            {(leg.arrivalDate || leg.arrivalTime || leg.toPoint) && <span> →</span>}
            {leg.arrivalDate && leg.arrivalDate !== leg.departureDate && <span> {formatDay(leg.arrivalDate)}</span>}
            {leg.arrivalTime && <span> {leg.arrivalTime}</span>}
            {leg.toPoint && <span> · {leg.toPoint}</span>}
          </p>
          {(leg.carrier || leg.identifier) && (
            <p className="mt-0.5 text-xs text-slate-500">
              {[leg.carrier, leg.identifier].filter(Boolean).join(' · ')}
              {leg.bookingRef && ` · Ref: ${leg.bookingRef}`}
            </p>
          )}
          {leg.distanceMiles != null && (
            <p className="mt-0.5 text-xs text-slate-500">
              {leg.distanceMiles} mi{leg.travelTimeMinutes ? ` · ${formatMinutes(leg.travelTimeMinutes)}` : ''}
            </p>
          )}
          {leg.connections && leg.connections.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">Via: {leg.connections.map((c) => c.point).join(', ')}</p>
          )}
          {leg.notes && <p className="mt-0.5 text-xs italic text-slate-400">{leg.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">Edit</button>
          <button type="button" onClick={onDelete} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Transport form modal ─────────────────────────────────────────────────────

function TransportFormModal({ tripId, trip, existing, defaultDirection, onClose }: {
  tripId: number;
  trip: Trip;
  existing?: TransportLeg;
  defaultDirection: 'outbound' | 'return';
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TransportDraft>(
    existing ? legToDraft(existing) : emptyTransportDraft(defaultDirection, trip),
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Departure date">
            <input type="date" className={inputClass} value={draft.departureDate} onChange={(e) => set({ departureDate: e.target.value })} required />
          </Field>
          <Field label="Departure time">
            <input type="time" className={inputClass} value={draft.departureTime} onChange={(e) => set({ departureTime: e.target.value })} />
          </Field>
          <Field label="Arrival date">
            <input type="date" className={inputClass} value={draft.arrivalDate} onChange={(e) => set({ arrivalDate: e.target.value })} />
          </Field>
          <Field label="Arrival time">
            <input type="time" className={inputClass} value={draft.arrivalTime} onChange={(e) => set({ arrivalTime: e.target.value })} />
          </Field>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={m === 'fly' ? 'From airport' : m === 'train' ? 'Departure station' : m === 'boat' ? 'Departure port' : 'From'}>
            <input type="text" className={inputClass} value={draft.fromPoint} placeholder={m === 'fly' ? 'e.g. JFK' : ''} onChange={(e) => set({ fromPoint: e.target.value })} />
          </Field>
          <Field label={m === 'fly' ? 'To airport' : m === 'train' ? 'Arrival station' : m === 'boat' ? 'Arrival port' : 'To'}>
            <input type="text" className={inputClass} value={draft.toPoint} placeholder={m === 'fly' ? 'e.g. LHR' : ''} onChange={(e) => set({ toPoint: e.target.value })} />
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
              <input type="number" min={0} className={inputClass} value={draft.distanceMiles} onChange={(e) => set({ distanceMiles: e.target.value })} />
            </Field>
            {showDuration && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Travel time</label>
                <div className="flex gap-2">
                  <input type="number" min={0} className={`${inputClass} flex-1`} placeholder="hrs" value={draft.travelHours} onChange={(e) => set({ travelHours: e.target.value })} />
                  <input type="number" min={0} max={59} className={`${inputClass} flex-1`} placeholder="min" value={draft.travelMins} onChange={(e) => set({ travelMins: e.target.value })} />
                </div>
              </div>
            )}
          </div>
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
                  <label className="text-xs text-slate-500">{connPointLabel}</label>
                  <input type="text" className={inputClass} value={conn.point} onChange={(e) => setConn(ci, { point: e.target.value })} />
                </div>
                <div className="w-20">
                  <label className="text-xs text-slate-500">Arrive</label>
                  <input type="time" className={inputClass} value={conn.arrive} onChange={(e) => setConn(ci, { arrive: e.target.value })} />
                </div>
                <div className="w-20">
                  <label className="text-xs text-slate-500">Depart</label>
                  <input type="time" className={inputClass} value={conn.depart} onChange={(e) => setConn(ci, { depart: e.target.value })} />
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

function ActivityFormModal({ tripId, days, existing, defaultDayId, onClose }: {
  tripId: number;
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
            <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End time" hint="Optional">
            <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Duration (minutes)" hint="Optional; leave blank if start/end times are set">
          <input type="number" min={0} className={inputClass} value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
        </Field>

        <Field label="Location" hint="Optional address or place name">
          <input type="text" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Colosseum, Rome" />
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function ItineraryPage({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  const days = useLiveQuery(() => db.tripDays.where('tripId').equals(tripId).sortBy('date'), [tripId]);
  const transport = useLiveQuery(() => db.tripTransport.where('tripId').equals(tripId).toArray(), [tripId]);
  const activities = useLiveQuery(() => db.tripActivities.where('tripId').equals(tripId).toArray(), [tripId]);

  type TransportFormState = { leg?: TransportLeg; direction: 'outbound' | 'return' } | null;
  type ActivityFormState = { activity?: ScheduledActivity; dayId: number } | null;

  const [transportForm, setTransportForm] = useState<TransportFormState>(null);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(null);

  if (trip === undefined || days === undefined || transport === undefined || activities === undefined) {
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

  return (
    <div className="space-y-6">
      <TripTabs tripId={tripId} current="itinerary" />

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
              <Button variant="ghost" onClick={() => setTransportForm({ leg: undefined, direction: dir })}>
                <Icon name="plus" /> Add {dir} transport
              </Button>
            </div>
          );
        })}
      </section>

      {/* ── Scheduled Activities ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Scheduled Activities</h2>
        <p className="text-xs text-slate-500">Activities added here appear on each day card in the Trip Overview, where you can link them to an outfit.</p>

        {days.map((day, i) => {
          const dayActivities = activities
            .filter((a) => a.tripDayId === day.id)
            .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

          return (
            <div key={day.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Day {i + 1} · {formatDay(day.date)}</h3>

              {dayActivities.length === 0 && (
                <p className="text-sm text-slate-400">No activities scheduled.</p>
              )}

              {dayActivities.map((act) => (
                <div key={act.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {act.startTime && <span className="mr-2 text-slate-500">{act.startTime}</span>}
                        {act.name}
                        {act.endTime && <span className="ml-1 text-slate-500">– {act.endTime}</span>}
                        {act.durationMinutes && !act.endTime && (
                          <span className="ml-1 text-xs text-slate-400">({formatMinutes(act.durationMinutes)})</span>
                        )}
                      </p>
                      {act.category && <p className="mt-0.5 text-xs capitalize text-slate-500">{act.category}</p>}
                      {act.location && <p className="mt-0.5 text-xs text-slate-400">📍 {act.location}</p>}
                      {act.notes && <p className="mt-0.5 text-xs italic text-slate-400">{act.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setActivityForm({ activity: act, dayId: day.id! })}
                        className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">Edit</button>
                      <button type="button" onClick={() => void deleteActivity(act)}
                        className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="ghost" onClick={() => setActivityForm({ activity: undefined, dayId: day.id! })}>
                <Icon name="plus" /> Add activity
              </Button>
            </div>
          );
        })}
      </section>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {transportForm && (
        <TransportFormModal
          tripId={tripId}
          trip={trip}
          existing={transportForm.leg}
          defaultDirection={transportForm.direction}
          onClose={() => setTransportForm(null)}
        />
      )}
      {activityForm && (
        <ActivityFormModal
          tripId={tripId}
          days={days}
          existing={activityForm.activity}
          defaultDayId={activityForm.dayId}
          onClose={() => setActivityForm(null)}
        />
      )}
    </div>
  );
}
