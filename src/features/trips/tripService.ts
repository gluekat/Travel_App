import { db } from '../../db/schema';
import { emptyOutfit } from '../../db/migrate';
import type { Activity, TransportMode, Trip, TripStop } from '../../db/types';
import { addDays, dateRange, daysBetween, todayISO } from '../../lib/dates';
import type { Place } from '../../weather/openMeteo';
import { syncPacking } from '../outfits/outfitService';
import { refreshPlaceholders } from './placeholders';
import { baseDayPlace, placeKey } from './dayPlaces';
import { defaultPackingRows, ensureGeneralLibrary } from '../packing/generalItemsService';

export const MAX_TRIP_DAYS = 30;

/** Activities a new day starts with: sightseeing, plus "travel day" on the first and last day of the trip. */
export function defaultDayActivities(date: string, startDate: string, endDate: string): Activity[] {
  return date === startDate || date === endDate ? ['sightseeing', 'travel day'] : ['sightseeing'];
}

export async function createTrip(
  destination: string,
  place: Place | undefined,
  startDate: string,
  endDate: string,
  stops?: TripStop[],
  travelModes?: TransportMode[],
): Promise<number> {
  const dates = dateRange(startDate, endDate);
  if (!dates.length) throw new Error('End date must be on or after the start date.');
  if (dates.length > MAX_TRIP_DAYS) throw new Error(`Trips can be at most ${MAX_TRIP_DAYS} days.`);
  await ensureGeneralLibrary();
  const created = await db.transaction('rw', [db.trips, db.tripDays, db.outfits, db.packingItems, db.generalItems], async () => {
    const hasStops = stops && stops.length > 0;
    const tripId = (await db.trips.add({
      destination: destination.trim(),
      placeLabel: hasStops && stops.length > 1
        ? stops.map(s => s.label.split(',')[0].trim()).join(' → ')
        : place?.label,
      lat: place?.lat,
      lon: place?.lon,
      timezone: place?.timezone,
      startDate,
      endDate,
      createdAt: Date.now(),
      stops: hasStops ? stops : undefined,
      travelModes,
    })) as number;
    const dayIds = (await db.tripDays.bulkAdd(
      dates.map((date) => ({ tripId, date, activities: defaultDayActivities(date, startDate, endDate) })),
      { allKeys: true },
    )) as number[];
    await db.outfits.bulkAdd(dayIds.map((dayId) => emptyOutfit(tripId, dayId)));
    await db.packingItems.bulkAdd(await defaultPackingRows(tripId));
    return tripId;
  });
  // Suggested hops to each destination and home again, for the user to fill in on the Itinerary.
  await refreshPlaceholders(created);
  return created;
}

export async function setTripPlace(tripId: number, place: Place) {
  await db.trips.update(tripId, { placeLabel: place.label, lat: place.lat, lon: place.lon, timezone: place.timezone });
  // Weather for the old location is no longer valid.
  await db.tripDays.where('tripId').equals(tripId).modify((d) => {
    if (d.weather?.source !== 'manual') delete d.weather;
  });
}

/**
 * Replace a multi-destination trip's stops. The trip's overall dates, days, day places and weather follow, and
 * placeholder transportation is regenerated for the new destinations. Weather for days whose place changed is cleared
 * (manual entries are kept) so it is fetched again.
 */
export async function setTripStops(trip: Trip, stops: TripStop[]) {
  if (!stops.length) throw new Error('A trip needs at least one destination.');
  if (stops.some((s) => !s.label.trim())) throw new Error('Every destination needs a name.');
  if (stops.some((s) => s.endDate < s.startDate)) throw new Error('Each destination must end on or after its start date.');
  const startDate = stops.map((s) => s.startDate).reduce((a, b) => (a < b ? a : b));
  const endDate = stops.map((s) => s.endDate).reduce((a, b) => (a > b ? a : b));
  await setTripDates(trip, startDate, endDate);

  const multi = stops.length > 1;
  const first = stops[0];
  const updated: Trip = {
    ...trip,
    startDate,
    endDate,
    stops: multi ? stops : undefined,
    destination: first.label.split(',')[0].trim(),
    placeLabel: multi ? stops.map((s) => s.label.split(',')[0].trim()).join(' → ') : first.label,
    lat: first.lat,
    lon: first.lon,
    timezone: first.timezone,
  };
  await db.trips.update(trip.id!, { stops: updated.stops, destination: updated.destination, placeLabel: updated.placeLabel, lat: updated.lat, lon: updated.lon, timezone: updated.timezone });

  const days = await db.tripDays.where('tripId').equals(trip.id!).toArray();
  await db.transaction('rw', db.tripDays, async () => {
    for (const d of days) {
      const before = baseDayPlace(trip, d.date);
      const after = baseDayPlace(updated, d.date);
      if (placeKey(before.lat, before.lon) === placeKey(after.lat, after.lon) && before.label === after.label) continue;
      const patch: Partial<typeof d> = {};
      if (d.weather && d.weather.source !== 'manual') patch.weather = undefined;
      if (d.weatherFrom && d.weatherFrom.source !== 'manual') patch.weatherFrom = undefined;
      if (Object.keys(patch).length) await db.tripDays.update(d.id!, patch);
    }
  });
  await refreshPlaceholders(trip.id!);
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
    const added = (await db.tripDays.bulkAdd(
      dates.filter((d) => !have.has(d)).map((date) => ({ tripId, date, activities: defaultDayActivities(date, startDate, endDate) })),
      { allKeys: true },
    )) as number[];
    await db.outfits.bulkAdd(added.map((dayId) => emptyOutfit(tripId, dayId)));
    // The (new) first and last days are travel days.
    await db.tripDays.where('tripId').equals(tripId).filter((d) => (d.date === startDate || d.date === endDate) && !d.activities.includes('travel day')).modify((d) => {
      d.activities = [...d.activities, 'travel day'];
    });
    await db.trips.update(tripId, { startDate, endDate });
  });
  await syncPacking(tripId);
}

export async function setDayActivities(dayId: number, activities: Activity[]) {
  await db.tripDays.update(dayId, { activities });
}

/** Returns today's ISO date — handy for the duplicate dialog default. */
export { todayISO };

/**
 * Duplicate a trip to new dates.
 * Days are mapped by position (day 1 → day 1, etc.).  Extra days in the new
 * range get empty outfits; source days beyond the new length are dropped.
 * Weather is cleared so it auto-fetches when the new trip opens.
 * General packing items are copied; closet-item rows are re-derived from outfits.
 */
export async function duplicateTrip(source: Trip, newStartDate: string, newEndDate: string): Promise<number> {
  const dates = dateRange(newStartDate, newEndDate);
  if (!dates.length) throw new Error('End date must be on or after the start date.');
  if (dates.length > MAX_TRIP_DAYS) throw new Error(`Trips can be at most ${MAX_TRIP_DAYS} days.`);

  const [sourceDays, sourceOutfits, sourcePackingItems] = await Promise.all([
    db.tripDays.where('tripId').equals(source.id!).sortBy('date'),
    db.outfits.where('tripId').equals(source.id!).toArray(),
    db.packingItems.where('tripId').equals(source.id!).toArray(),
  ]);

  await ensureGeneralLibrary();
  const newTripId = (await db.transaction('rw', [db.trips, db.tripDays, db.outfits, db.packingItems, db.generalItems], async () => {
    // Shift stops by the same offset as the trip's start date
    let newStops: TripStop[] | undefined;
    if (source.stops && source.stops.length > 0) {
      const offset = daysBetween(source.startDate, newStartDate);
      newStops = source.stops.map(s => ({
        ...s,
        startDate: addDays(s.startDate, offset),
        endDate: addDays(s.endDate, offset),
      }));
    }
    const id = (await db.trips.add({
      name: source.name,
      destination: source.destination,
      placeLabel: source.placeLabel,
      lat: source.lat,
      lon: source.lon,
      timezone: source.timezone,
      startDate: newStartDate,
      endDate: newEndDate,
      createdAt: Date.now(),
      stops: newStops,
    })) as number;

    // Map source day ids → new day ids (by position, not by date)
    const dayIdMap = new Map<number, number>();
    const newDayIds: number[] = [];
    for (let i = 0; i < dates.length; i++) {
      const src = sourceDays[i];
      const newDayId = (await db.tripDays.add({
        tripId: id,
        date: dates[i],
        activities: src?.activities ?? (['sightseeing'] as Activity[]),
        // No weather — let the auto-fetch populate it for the new dates.
      })) as number;
      if (src) dayIdMap.set(src.id!, newDayId);
      newDayIds.push(newDayId);
    }

    // Copy outfits for mapped days
    const outfitsByDay = new Map<number, typeof sourceOutfits>();
    for (const o of sourceOutfits) {
      const list = outfitsByDay.get(o.tripDayId) ?? [];
      list.push(o);
      outfitsByDay.set(o.tripDayId, list);
    }
    for (const [oldId, newId] of dayIdMap) {
      const dayOutfits = outfitsByDay.get(oldId) ?? [];
      if (dayOutfits.length === 0) {
        await db.outfits.add(emptyOutfit(id, newId));
      } else {
        for (const o of dayOutfits.sort((a, b) => a.rank - b.rank)) {
          await db.outfits.add({
            tripId: id, tripDayId: newId, rank: o.rank, label: o.label,
            activities: o.activities, itemIds: [...o.itemIds],
            lockedItemIds: [...o.lockedItemIds], rationale: '',
          });
        }
      }
    }
    // Empty outfits for any extra days beyond the source trip
    for (const newId of newDayIds.slice(sourceDays.length)) {
      await db.outfits.add(emptyOutfit(id, newId));
    }

    // Copy general packing items; closet-item rows re-derived below via syncPacking
    // The old built-in defaults (Underwear, Socks, Jacket, Toiletries) are only carried over if they are still Default items.
    const stillDefault = new Set((await db.generalItems.filter((i) => i.isDefault).toArray()).map((i) => i.name.toLowerCase()));
    const legacy = new Set(['underwear', 'socks', 'jacket', 'toiletries']);
    const generals = sourcePackingItems.filter((p) => p.customLabel != null && (!legacy.has(p.customLabel.toLowerCase()) || stillDefault.has(p.customLabel.toLowerCase())));
    if (generals.length) {
      await db.packingItems.bulkAdd(generals.map(({ id: _id, ...p }) => ({ ...p, tripId: id, packed: false })));
    } else {
      await db.packingItems.bulkAdd(await defaultPackingRows(id));
    }

    return id;
  })) as number;

  await syncPacking(newTripId);
  return newTripId;
}
