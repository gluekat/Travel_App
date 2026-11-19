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

  const groups = new Map<string, { lat: number; lon: number; days: TripDay[] }>();
  for (const d of days) {
    const p = places.get(d.date);
    const key = placeKey(p?.lat, p?.lon);
    if (!key || p?.lat == null || p?.lon == null) continue;
    const g = groups.get(key) ?? { lat: p.lat, lon: p.lon, days: [] };
    g.days.push(d);
    groups.set(key, g);
  }
  if (!groups.size) throw new Error('Trip has no location yet.');

  const errors: string[] = [];
  const resolved = new Map<string, ResolveResult['days'][number]>();
  for (const [key, g] of groups) {
    // Weather stored for a different place is no use as an offline fallback here.
    const cached: Record<string, DayWeather | undefined> = Object.fromEntries(
      g.days.map((d) => [d.date, d.weather && (d.weather.source === 'manual' || !weatherNeedsPlaceRefresh(d, trip, places)) ? d.weather : undefined]),
    );
    const result = await resolveWeather({ lat: g.lat, lon: g.lon, dates: g.days.map((d) => d.date), today: todayISO(), cached, fetchImpl });
    if (result.error) errors.push(result.error);
    await db.transaction('rw', db.tripDays, async () => {
      for (const r of result.days) {
        const day = g.days.find((d) => d.date === r.date);
        if (day?.id != null && r.status === 'live') await db.tripDays.update(day.id, { weather: { ...r.weather!, placeKey: key } });
      }
    });
    for (const r of result.days) resolved.set(r.date, r);
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
