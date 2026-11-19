import { db } from '../db/schema';
import type { DayWeather, TripDay } from '../db/types';
import { computeDayPlaces, placeKey, weatherNeedsPlaceRefresh } from '../features/trips/dayPlaces';
import { todayISO } from '../lib/dates';
import type { FetchLike } from './openMeteo';
import { resolveWeather, type ResolveResult } from './resolveWeather';

/**
 * Fetch (or fall back) weather for every day of a trip and persist it to IndexedDB.
 * Each day's weather is for where the traveller is that day: the transport legs when there are any,
 * otherwise the trip's destination (or the stop covering that date).
 */
export async function refreshTripWeather(tripId: number, fetchImpl?: FetchLike): Promise<ResolveResult> {
  const trip = await db.trips.get(tripId);
  if (!trip) throw new Error('Trip not found.');
  const days = await db.tripDays.where('tripId').equals(tripId).sortBy('date');
  const legs = await db.tripTransport.where('tripId').equals(tripId).toArray();
  const places = computeDayPlaces(trip, days, legs);

  // One task per day and role: "to" is where the day ends (its main weather); "from" is where a travel day starts.
  type Task = { day: TripDay; role: 'to' | 'from' };
  const groups = new Map<string, { lat: number; lon: number; tasks: Task[] }>();
  const add = (day: TripDay, role: Task['role'], lat?: number, lon?: number) => {
    const key = placeKey(lat, lon);
    if (!key || lat == null || lon == null) return;
    const g = groups.get(key) ?? { lat, lon, tasks: [] };
    g.tasks.push({ day, role });
    groups.set(key, g);
  };
  for (const d of days) {
    const p = places.get(d.date);
    add(d, 'to', p?.lat, p?.lon);
    if (p?.from) add(d, 'from', p.from.lat, p.from.lon);
  }
  if (!groups.size) throw new Error('Trip has no location yet.');

  const errors: string[] = [];
  const resolved = new Map<string, ResolveResult['days'][number]>();
  for (const [key, g] of groups) {
    const dates = [...new Set(g.tasks.map((t) => t.day.date))].sort();
    // Weather stored for a different place is no use as an offline fallback here.
    const cached: Record<string, DayWeather | undefined> = {};
    for (const t of g.tasks) {
      const w = t.role === 'from' ? t.day.weatherFrom : t.day.weather;
      cached[t.day.date] = w && (w.source === 'manual' || w.placeKey === key || (t.role === 'to' && !weatherNeedsPlaceRefresh(t.day, trip, places))) ? w : cached[t.day.date];
    }
    const result = await resolveWeather({ lat: g.lat, lon: g.lon, dates, today: todayISO(), cached, fetchImpl });
    if (result.error) errors.push(result.error);
    const byDate = new Map(result.days.map((r) => [r.date, r]));
    await db.transaction('rw', db.tripDays, async () => {
      for (const t of g.tasks) {
        const r = byDate.get(t.day.date);
        if (t.day.id == null || r?.status !== 'live') continue;
        const weather = { ...r.weather!, placeKey: key };
        await db.tripDays.update(t.day.id, t.role === 'from' ? { weatherFrom: weather } : { weather });
      }
    });
    for (const t of g.tasks) if (t.role === 'to' && byDate.has(t.day.date)) resolved.set(t.day.date, byDate.get(t.day.date)!);
  }

  return {
    days: days.map((d) => resolved.get(d.date) ?? { date: d.date, status: 'missing' as const }),
    error: errors.length ? [...new Set(errors)].join('; ') : undefined,
  };
}

export async function setManualWeather(tripDayId: number, w: Pick<DayWeather, 'high' | 'low' | 'precipChance'>) {
  await db.tripDays.update(tripDayId, {
    weather: {
      ...w,
      condition: w.precipChance > 50 ? 'Rain likely' : 'Manual entry',
      source: 'manual',
      fetchedAt: Date.now(),
    },
  });
}
