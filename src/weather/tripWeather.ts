import { db } from '../db/schema';
import type { DayWeather, Trip, TripDay } from '../db/types';
import { todayISO } from '../lib/dates';
import type { FetchLike } from './openMeteo';
import { resolveWeather, type ResolveResult } from './resolveWeather';

/** Fetch (or fall back) weather for every day of a trip and persist it to IndexedDB. */
export async function refreshTripWeather(tripId: number, fetchImpl?: FetchLike): Promise<ResolveResult> {
  const trip = await db.trips.get(tripId);
  const days = await db.tripDays.where('tripId').equals(tripId).sortBy('date');

  // Multi-destination: fetch weather per stop
  if (trip?.stops && trip.stops.length > 0) {
    return refreshMultiStopWeather(trip, days, fetchImpl);
  }

  // Single destination
  if (!trip || trip.lat == null || trip.lon == null) throw new Error('Trip has no location yet.');
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

async function refreshMultiStopWeather(trip: Trip, days: TripDay[], fetchImpl?: FetchLike): Promise<ResolveResult> {
  const errors: string[] = [];
  const updatedDays = new Map<string, ResolveResult['days'][number]>();

  for (const stop of trip.stops!) {
    if (stop.lat == null || stop.lon == null) continue;
    const stopDays = days.filter(d => d.date >= stop.startDate && d.date <= stop.endDate);
    if (!stopDays.length) continue;

    const cached: Record<string, DayWeather | undefined> = Object.fromEntries(
      stopDays.map(d => [d.date, d.weather]),
    );
    const result = await resolveWeather({
      lat: stop.lat,
      lon: stop.lon,
      dates: stopDays.map(d => d.date),
      today: todayISO(),
      cached,
      fetchImpl,
    });

    if (result.error) errors.push(result.error);

    await db.transaction('rw', db.tripDays, async () => {
      for (const r of result.days) {
        const day = stopDays.find(d => d.date === r.date);
        if (day?.id != null && r.status === 'live') {
          await db.tripDays.update(day.id, { weather: r.weather });
        }
      }
    });

    for (const r of result.days) updatedDays.set(r.date, r);
  }

  const allDays: ResolveResult['days'] = days.map(
    d => updatedDays.get(d.date) ?? { date: d.date, status: 'missing' as const },
  );
  return {
    days: allDays,
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
