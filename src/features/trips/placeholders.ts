/** Placeholder transportation for a trip's destinations: one hop to each stop, and home again at the end. */
import { db, getSetting } from '../../db/schema';
import type { HomeLocation, TransportLeg, Trip, TripStop } from '../../db/types';
import { airportByCode, airportLabel, nearestAirport } from '../../lib/airports';
import { shortLocation } from '../../lib/dates';
import { placeKey, placeName } from './dayPlaces';

interface Point {
  label: string;
  lat?: number;
  lon?: number;
}

export interface Hop {
  direction: 'outbound' | 'return';
  from: Point;
  to: Point;
  /** Travel date: arrival at a stop on its first day, or the departure home on the last day. */
  date: string;
}

/** A flight's end near a place: the closest listed airport, else the place itself. */
function flightEnd(label: string, lat?: number, lon?: number): Point {
  if (lat != null && lon != null) {
    const a = nearestAirport(lat, lon);
    if (a) return { label: airportLabel(a), lat: a.lat, lon: a.lon };
  }
  return { label, lat, lon };
}

/** The trip's destinations in order (a single-destination trip has one). */
export function tripStopsOf(trip: Trip): Pick<TripStop, 'label' | 'lat' | 'lon' | 'startDate' | 'endDate'>[] {
  if (trip.stops?.length) return trip.stops;
  return [{ label: shortLocation(trip.placeLabel ?? trip.destination), lat: trip.lat, lon: trip.lon, startDate: trip.startDate, endDate: trip.endDate }];
}

/** Home → stop 1 → … → last stop → home, with each hop's date taken from the destinations. */
export function tripHops(trip: Trip, home?: HomeLocation | null, homeAirport?: string | null): Hop[] {
  const stops = tripStopsOf(trip);
  const airport = homeAirport ? airportByCode(homeAirport) : undefined;
  const homePoint: Point = airport ? { label: airportLabel(airport), lat: airport.lat, lon: airport.lon } : home ? flightEnd(home.label, home.lat, home.lon) : { label: '' };
  const at = (s: (typeof stops)[number]): Point => flightEnd(shortLocation(s.label), s.lat, s.lon);

  const hops: Hop[] = [];
  stops.forEach((s, i) => hops.push({ direction: 'outbound', from: i === 0 ? homePoint : at(stops[i - 1]), to: at(s), date: s.startDate }));
  const last = stops[stops.length - 1];
  hops.push({ direction: 'return', from: at(last), to: homePoint, date: last.endDate });
  return hops;
}

const sameName = (a?: string, b?: string) => !!a && !!b && placeName(a).toLowerCase() === placeName(b).toLowerCase();

/** True when a real (user-entered) booking already gets travellers to this hop's destination. */
function covered(real: TransportLeg[], hop: Hop): boolean {
  return real.some(
    (l) =>
      l.direction === hop.direction &&
      ((placeKey(l.toLat, l.toLon) && placeKey(l.toLat, l.toLon) === placeKey(hop.to.lat, hop.to.lon)) || (hop.to.label !== '' && sameName(l.toPoint, hop.to.label))),
  );
}

/**
 * Make the trip's placeholder legs match its current destinations and dates: old placeholders are replaced, and
 * hops that a real booking already covers are skipped. Legs the user has filled in are never touched.
 */
export async function refreshPlaceholders(tripId: number): Promise<void> {
  const trip = await db.trips.get(tripId);
  if (!trip) return;
  const [home, homeAirport] = await Promise.all([getSetting<HomeLocation | null>('homeLocation', null), getSetting<string | null>('homeAirport', null)]);
  await db.transaction('rw', db.tripTransport, async () => {
    const all = await db.tripTransport.where('tripId').equals(tripId).toArray();
    await db.tripTransport.bulkDelete(all.filter((l) => l.placeholder).map((l) => l.id!));
    const real = all.filter((l) => !l.placeholder);
    const now = Date.now();
    const legs: Omit<TransportLeg, 'id'>[] = tripHops(trip, home, homeAirport)
      .filter((h) => !covered(real, h))
      .map((h, i) => ({
        tripId,
        direction: h.direction,
        mode: 'fly' as const,
        departureDate: h.date,
        arrivalDate: h.date,
        fromPoint: h.from.label || undefined,
        fromLat: h.from.lat,
        fromLon: h.from.lon,
        toPoint: h.to.label || undefined,
        toLat: h.to.lat,
        toLon: h.to.lon,
        placeholder: true,
        createdAt: now + i,
      }));
    if (legs.length) await db.tripTransport.bulkAdd(legs);
  });
}
