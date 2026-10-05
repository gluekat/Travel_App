import { db } from '../../db/schema';
import type { Activity, Trip } from '../../db/types';
import { dateRange } from '../../lib/dates';
import type { Place } from '../../weather/openMeteo';
import { syncPacking } from '../outfits/outfitService';

export const MAX_TRIP_DAYS = 30;

export async function createTrip(destination: string, place: Place | undefined, startDate: string, endDate: string): Promise<number> {
  const dates = dateRange(startDate, endDate);
  if (!dates.length) throw new Error('End date must be on or after the start date.');
  if (dates.length > MAX_TRIP_DAYS) throw new Error(`Trips can be at most ${MAX_TRIP_DAYS} days.`);
  return db.transaction('rw', db.trips, db.tripDays, async () => {
    const tripId = (await db.trips.add({
      destination: destination.trim(),
      placeLabel: place?.label,
      lat: place?.lat,
      lon: place?.lon,
      timezone: place?.timezone,
      startDate,
      endDate,
      createdAt: Date.now(),
    })) as number;
    await db.tripDays.bulkAdd(dates.map((date) => ({ tripId, date, activities: ['sightseeing'] as Activity[] })));
    return tripId;
  });
}

export async function setTripPlace(tripId: number, place: Place) {
  await db.trips.update(tripId, { placeLabel: place.label, lat: place.lat, lon: place.lon, timezone: place.timezone });
  // Weather for the old location is no longer valid.
  await db.tripDays.where('tripId').equals(tripId).modify((d) => {
    if (d.weather?.source !== 'manual') delete d.weather;
  });
}

/** Change a trip's date range, adding/removing days (and their outfits) as needed. */
export async function setTripDates(trip: Trip, startDate: string, endDate: string) {
  const dates = dateRange(startDate, endDate);
  if (!dates.length) throw new Error('End date must be on or after the start date.');
  if (dates.length > MAX_TRIP_DAYS) throw new Error(`Trips can be at most ${MAX_TRIP_DAYS} days.`);
  const tripId = trip.id!;
  await db.transaction('rw', db.trips, db.tripDays, db.outfits, async () => {
    const existing = await db.tripDays.where('tripId').equals(tripId).toArray();
    const drop = existing.filter((d) => !dates.includes(d.date));
    for (const d of drop) await db.outfits.where('tripDayId').equals(d.id!).delete();
    await db.tripDays.bulkDelete(drop.map((d) => d.id!));
    const have = new Set(existing.map((d) => d.date));
    await db.tripDays.bulkAdd(dates.filter((d) => !have.has(d)).map((date) => ({ tripId, date, activities: ['sightseeing'] as Activity[] })));
    await db.trips.update(tripId, { startDate, endDate });
  });
  await syncPacking(tripId);
}

export async function setDayActivities(dayId: number, activities: Activity[]) {
  await db.tripDays.update(dayId, { activities });
}
