import { db } from '../db/schema';
import type { DayWeather } from '../db/types';
import { todayISO } from '../lib/dates';
import type { FetchLike } from './openMeteo';
import { resolveWeather, type ResolveResult } from './resolveWeather';

/** Fetch (or fall back) weather for every day of a trip and persist it to IndexedDB. */
export async function refreshTripWeather(tripId: number, fetchImpl?: FetchLike): Promise<ResolveResult> {
  const trip = await db.trips.get(tripId);
  if (!trip || trip.lat == null || trip.lon == null) throw new Error('Trip has no location yet.');
  const days = await db.tripDays.where('tripId').equals(tripId).sortBy('date');
  const cached: Record<string, DayWeather | undefined> = Object.fromEntries(days.map((d) => [d.date, d.weather]));

  const result = await resolveWeather({
    lat: trip.lat,
    lon: trip.lon,
    dates: days.map((d) => d.date),
    today: todayISO(),
    cached,
    fetchImpl,
  });

  await db.transaction('rw', db.tripDays, async () => {
    for (const r of result.days) {
      const day = days.find((d) => d.date === r.date);
      if (day?.id != null && r.status === 'live') await db.tripDays.update(day.id, { weather: r.weather });
    }
  });
  return result;
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
