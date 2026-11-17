import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { HomeLocation, ScheduledActivity, Trip, TripDay, TripLodging } from '../../db/types';
import { fmt12h, formatDay } from '../../lib/dates';
import { Banner, Button, Field, Icon, Modal, inputClass } from '../../components/ui';
import { TimeInput } from '../../components/TimeInput';
import { LocationInput } from '../../components/LocationInput';
import { TripTabs } from './TripTabs';
import { getDayLocation } from './TripDetail';
import { TransportSection } from './TransportSection';
import { formatMinutes } from './transportPlan';

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
  const homeAirport = useLiveQuery(async () => ((await db.settings.get('homeAirport'))?.value as string | undefined) ?? null, []);
  const homeLocation = useLiveQuery(
    async () => {
      const row = await db.settings.get('homeLocation');
      return row ? (row.value as HomeLocation) : null;
    },
    [],
  );

  type ActivityFormState = { activity?: ScheduledActivity; dayId: number } | null;

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

      <TransportSection tripId={tripId} trip={trip} legs={transport} home={homeLocation} homeAirport={homeAirport} />

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
