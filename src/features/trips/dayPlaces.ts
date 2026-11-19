/** Where the traveller is on each day of a trip: from the transport legs when there are any, else the trip's destination(s). */
import type { Trip, TripDay, TransportLeg } from '../../db/types';
import { addDays, shortLocation } from '../../lib/dates';
import { airportByCode } from '../../lib/airports';
import { directionSegments, type Segment } from './transportPlan';

export interface DayPlace {
  /** What to show next to the day, e.g. "Rome, Italy" or "New York → Rome, Italy". */
  label?: string;
  /** Where the day's weather applies. */
  lat?: number;
  lon?: number;
  /** Travel days: where the day starts (when different from where it ends), for its own weather. */
  from?: { label: string; lat: number; lon: number };
  /** Travel days: just the name of where the day ends, e.g. "Rome, Italy". */
  toLabel?: string;
  /** True when this came from the transport legs rather than the trip's own destination. */
  fromTransport: boolean;
}

/** Rounded coordinates used to tell whether weather was fetched for the same place. */
export const placeKey = (lat?: number, lon?: number) => (lat != null && lon != null ? `${lat.toFixed(2)},${lon.toFixed(2)}` : undefined);

/** "Rome, Italy" for a trip date, from the trip's destination or the stop covering that date (no transport involved). */
export function getDayLocation(trip: Trip, date: string): string | undefined {
  return baseDayPlace(trip, date).label;
}

/** The destination-based place for a date, with coordinates. */
export function baseDayPlace(trip: Trip, date: string): DayPlace {
  if (!trip.stops || trip.stops.length <= 1) {
    const raw = trip.placeLabel ?? trip.destination;
    const stop = trip.stops?.[0];
    return { label: raw ? shortLocation(raw) : undefined, lat: stop?.lat ?? trip.lat, lon: stop?.lon ?? trip.lon, fromTransport: false };
  }
  const stopIdx = trip.stops.findIndex((s) => date >= s.startDate && date <= s.endDate);
  if (stopIdx >= 0) {
    const stop = trip.stops[stopIdx];
    const loc = shortLocation(stop.label);
    if (stopIdx > 0 && date === stop.startDate) {
      return { label: `${shortLocation(trip.stops[stopIdx - 1].label)} → ${loc}`, lat: stop.lat, lon: stop.lon, fromTransport: false };
    }
    return { label: loc, lat: stop.lat, lon: stop.lon, fromTransport: false };
  }
  // Gap day (e.g. a sea day between stops)
  const prevStop = [...trip.stops].filter((s) => s.endDate < date).pop();
  const nextStop = trip.stops.find((s) => s.startDate > date);
  if (prevStop && nextStop) return { label: `${shortLocation(prevStop.label)} → ${shortLocation(nextStop.label)}`, lat: prevStop.lat, lon: prevStop.lon, fromTransport: false };
  const only = prevStop ?? nextStop;
  return only ? { label: shortLocation(only.label), lat: only.lat, lon: only.lon, fromTransport: false } : { fromTransport: false };
}

/** A readable city for a travel point: "JFK – John F. Kennedy International, New York" → "New York". */
export function placeName(label: string): string {
  const code = /^([A-Z]{3}) – /.exec(label)?.[1];
  const airport = code ? airportByCode(code) : undefined;
  if (airport) return `${airport.city}, ${airport.country}`;
  return shortLocation(label);
}

const arrivalKey = (s: Segment) => `${s.arriveDate ?? s.departDate ?? ''} ${s.arriveTime ?? '00:00'}`;

/**
 * Day-by-day places. A day's place is where the traveller ends the day: the destination of the latest leg that has
 * arrived by then (the origin before the first arrival). Days that change place read "From → To".
 * Days whose transport has no coordinates fall back to the trip's own destination.
 */
export function computeDayPlaces(trip: Trip, days: TripDay[], legs: TransportLeg[]): Map<string, DayPlace> {
  const segs = directionSegments(legs.filter((l) => l.direction === 'outbound'))
    .concat(directionSegments(legs.filter((l) => l.direction === 'return')))
    .sort((a, b) => arrivalKey(a).localeCompare(arrivalKey(b)));

  type Spot = { label: string; lat?: number; lon?: number };
  const at = (date: string): Spot | undefined => {
    const arrived = segs.filter((s) => (s.arriveDate ?? s.departDate ?? '') <= date);
    const last = arrived[arrived.length - 1];
    if (last) return { label: last.to, lat: last.toLat, lon: last.toLon };
    const first = segs[0];
    return first ? { label: first.from, lat: first.fromLat, lon: first.fromLon } : undefined;
  };

  const out = new Map<string, DayPlace>();
  for (const d of days) {
    const base = baseDayPlace(trip, d.date);
    const end = segs.length ? at(d.date) : undefined;
    if (!end || end.lat == null || end.lon == null || !end.label) {
      out.set(d.date, base);
      continue;
    }
    const start = at(addDays(d.date, -1));
    const endName = placeName(end.label);
    const startName = start?.label ? placeName(start.label) : undefined;
    const travelling = !!startName && startName !== endName;
    out.set(d.date, {
      label: travelling ? `${startName} → ${endName}` : endName,
      lat: end.lat,
      lon: end.lon,
      ...(travelling && start?.lat != null && start.lon != null ? { from: { label: startName, lat: start.lat, lon: start.lon }, toLabel: endName } : {}),
      fromTransport: true,
    });
  }
  return out;
}

/** True when a day's stored (non-manual) weather was fetched for somewhere other than where the day now is. */
export function weatherNeedsPlaceRefresh(day: TripDay, trip: Trip, places: Map<string, DayPlace>): boolean {
  if (!day.weather || day.weather.source === 'manual') return false;
  const from = places.get(day.date)?.from;
  if (from && day.weatherFrom?.placeKey !== placeKey(from.lat, from.lon)) return true;
  const want = placeKey(places.get(day.date)?.lat, places.get(day.date)?.lon);
  if (!want) return false;
  const base = baseDayPlace(trip, day.date);
  const have = day.weather.placeKey ?? placeKey(base.lat, base.lon);
  return have !== want;
}
