/** Pure planning logic for the Itinerary's transportation: legs, layovers, drive estimates, date shifts. */
import type { TransportConnection, TransportLeg, TransportMode } from '../../db/types';
import { addDays, daysBetween, fmt12h, formatDay } from '../../lib/dates';

export const LAYOVER_MODES: TransportMode[] = ['fly', 'train', 'boat'];

export interface Segment {
  legId?: number;
  /** 1-based position within the direction (Leg 1, Leg 2…). */
  n: number;
  mode: TransportMode;
  from: string;
  to: string;
  departDate?: string;
  departTime?: string;
  arriveDate?: string;
  arriveTime?: string;
  carrier?: string;
  identifier?: string;
  bookingRef?: string;
  notes?: string;
  /** The booking's "dates need updating" flag (on its first leg only). */
  needsAttention?: string;
  /** Driving distance, estimated from coordinates unless entered by hand. */
  distanceMiles?: number;
  /** Door-to-door time: driving estimate, or arrival minus departure when both are known. */
  durationMinutes?: number;
  /** Wait between the previous leg's arrival and this leg's departure (air, train and cruise only). */
  layoverMinutes?: number;
}

// ─── Time helpers ────────────────────────────────────────────────────────────

export function timeToMins(t?: string): number | undefined {
  if (!t) return undefined;
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return Number.isNaN(h) || Number.isNaN(m) ? undefined : h * 60 + m;
}

/** Minutes from one date+time to another; falls back to a same-day/overnight guess when dates are missing. */
export function minutesBetween(aDate: string | undefined, aTime: string | undefined, bDate: string | undefined, bTime: string | undefined): number | undefined {
  const a = timeToMins(aTime);
  const b = timeToMins(bTime);
  if (a === undefined || b === undefined) return undefined;
  if (aDate && bDate) return daysBetween(aDate, bDate) * 1440 + (b - a);
  const diff = b - a;
  return diff < 0 ? diff + 1440 : diff;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Driving ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Road estimate: straight-line × 1.3, at 60 mph on average. */
export function driveEstimate(lat1: number, lon1: number, lat2: number, lon2: number): { miles: number; minutes: number } {
  const miles = haversineKm(lat1, lon1, lat2, lon2) * 1.3 * 0.621371;
  return { miles, minutes: Math.round(miles) };
}

// ─── Legs → segments ─────────────────────────────────────────────────────────

type Point = { label: string; lat?: number; lon?: number };

/** Break one booking (with its connections / stops) into individual legs, filling in dates and drive estimates. */
export function legSegments(leg: TransportLeg): Omit<Segment, 'n' | 'layoverMinutes'>[] {
  const conns: TransportConnection[] = leg.connections ?? [];
  const points: Point[] = [
    { label: leg.fromPoint ?? '', lat: leg.fromLat, lon: leg.fromLon },
    ...conns.map((c) => ({ label: c.point, lat: c.lat, lon: c.lon })),
    { label: leg.toPoint ?? '', lat: leg.toLat, lon: leg.toLon },
  ];
  const segs: Omit<Segment, 'n' | 'layoverMinutes'>[] = [];
  let date = leg.departureDate;
  let departTime = leg.departureTime;
  let departDate: string | undefined = leg.departureDate;

  for (let k = 0; k < points.length - 1; k++) {
    const last = k === points.length - 2;
    const conn = last ? undefined : conns[k];
    const arriveTime = last ? leg.arrivalTime : conn?.arrive;
    let arriveDate = last ? leg.arrivalDate : conn?.arriveDate;
    if (!arriveDate) {
      const wraps = departTime !== undefined && arriveTime !== undefined && (timeToMins(arriveTime) ?? 0) < (timeToMins(departTime) ?? 0);
      arriveDate = wraps ? addDays(date, 1) : date;
    }
    const seg: Omit<Segment, 'n' | 'layoverMinutes'> = {
      legId: leg.id,
      mode: leg.mode,
      from: points[k].label,
      to: points[k + 1].label,
      departDate,
      departTime,
      arriveDate,
      arriveTime,
      carrier: k === 0 ? leg.carrier : conns[k - 1]?.carrier || leg.carrier,
      identifier: k === 0 ? leg.identifier : conns[k - 1]?.identifier,
      bookingRef: leg.bookingRef,
      notes: k === 0 ? leg.notes : undefined,
      needsAttention: k === 0 ? leg.needsAttention : undefined,
    };
    const single = points.length === 2;
    if (leg.mode === 'drive') {
      const a = points[k];
      const b = points[k + 1];
      if (single && leg.distanceMiles != null) seg.distanceMiles = leg.distanceMiles;
      else if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) seg.distanceMiles = driveEstimate(a.lat, a.lon, b.lat, b.lon).miles;
      if (single && leg.travelTimeMinutes) seg.durationMinutes = leg.travelTimeMinutes;
      else if (seg.distanceMiles != null) seg.durationMinutes = Math.round(seg.distanceMiles);
    }
    if (seg.durationMinutes == null) seg.durationMinutes = minutesBetween(seg.departDate, seg.departTime, seg.arriveDate, seg.arriveTime);
    segs.push(seg);

    // The next leg leaves from this connection point.
    date = arriveDate;
    if (conn) {
      departTime = conn.depart;
      departDate = conn.departDate;
      if (!departDate) {
        const wraps = conn.arrive !== undefined && conn.depart !== undefined && (timeToMins(conn.depart) ?? 0) < (timeToMins(conn.arrive) ?? 0);
        departDate = wraps ? addDays(arriveDate, 1) : arriveDate;
      }
      date = departDate;
    }
  }
  return segs;
}

const legSortKey = (l: TransportLeg) => `${l.departureDate} ${l.departureTime ?? '00:00'}`;

/** Every leg of one direction in order, numbered, with layovers between air / train / cruise legs. */
export function directionSegments(legs: TransportLeg[]): Segment[] {
  const sorted = [...legs].sort((a, b) => legSortKey(a).localeCompare(legSortKey(b)));
  const out: Segment[] = [];
  for (const leg of sorted) {
    for (const seg of legSegments(leg)) {
      const prev = out[out.length - 1];
      const layoverMinutes =
        prev && LAYOVER_MODES.includes(prev.mode) && LAYOVER_MODES.includes(seg.mode)
          ? minutesBetween(prev.arriveDate, prev.arriveTime, seg.departDate, seg.departTime)
          : undefined;
      out.push({ ...seg, n: out.length + 1, layoverMinutes: layoverMinutes != null && layoverMinutes >= 0 ? layoverMinutes : undefined });
    }
  }
  return out;
}

export interface TransportOverview {
  departure?: Segment;
  arrival?: Segment;
  from: string;
  to: string;
  /** The final leg of the way back, when a return is planned too. */
  returnArrival?: Segment;
  oneWay: boolean;
}

/** Where the journey starts and ends up: the outbound trip (or the return if that is all there is). */
export function transportOverview(legs: TransportLeg[]): TransportOverview {
  const outbound = directionSegments(legs.filter((l) => l.direction === 'outbound'));
  const back = directionSegments(legs.filter((l) => l.direction === 'return'));
  const main = outbound.length ? outbound : back;
  const first = main[0];
  const last = main[main.length - 1];
  return {
    departure: first,
    arrival: last,
    from: first?.from ?? '',
    to: last?.to ?? '',
    returnArrival: outbound.length && back.length ? back[back.length - 1] : undefined,
    oneWay: new Set(legs.map((l) => l.direction)).size < 2,
  };
}

/** Total elapsed time across a direction's legs, when first departure and last arrival are both timed. */
export function directionTotalMinutes(segs: Segment[]): number | undefined {
  const first = segs[0];
  const last = segs[segs.length - 1];
  return first && last ? minutesBetween(first.departDate, first.departTime, last.arriveDate, last.arriveTime) : undefined;
}

// ─── Trip date changes ───────────────────────────────────────────────────────

function shiftLeg(leg: TransportLeg, delta: number): Partial<TransportLeg> {
  const sh = (d?: string) => (d ? addDays(d, delta) : d);
  return {
    departureDate: sh(leg.departureDate),
    arrivalDate: sh(leg.arrivalDate),
    connections: leg.connections?.map((c) => ({ ...c, arriveDate: sh(c.arriveDate), departDate: sh(c.departDate) })),
  };
}

/**
 * When a trip's dates change, outbound legs that reached the old first day move to the new first day and
 * return legs that left on the old last day move to the new last day (connection dates move with them).
 */
export function shiftTransportForTripDates(legs: TransportLeg[], oldStart: string, newStart: string, oldEnd: string, newEnd: string): { id: number; patch: Partial<TransportLeg> }[] {
  const patches: { id: number; patch: Partial<TransportLeg> }[] = [];
  for (const leg of legs) {
    let delta = 0;
    if (leg.direction === 'outbound' && (leg.arrivalDate ?? leg.departureDate) === oldStart) delta = daysBetween(oldStart, newStart);
    if (leg.direction === 'return' && leg.departureDate === oldEnd) delta = daysBetween(oldEnd, newEnd);
    if (delta !== 0) patches.push({ id: leg.id!, patch: shiftLeg(leg, delta) });
  }
  return patches;
}

// ─── Round trips ─────────────────────────────────────────────────────────────

/** The way back for a round trip: endpoints swapped, stops reversed, leaving on `returnDate`. */
export function mirrorLeg(leg: Omit<TransportLeg, 'id'>, returnDate: string): Omit<TransportLeg, 'id'> {
  const conns = [...(leg.connections ?? [])].reverse().map((c) => ({ point: c.point, lat: c.lat, lon: c.lon }));
  return {
    tripId: leg.tripId,
    direction: 'return',
    mode: leg.mode,
    departureDate: returnDate,
    fromPoint: leg.toPoint,
    fromLat: leg.toLat,
    fromLon: leg.toLon,
    toPoint: leg.fromPoint,
    toLat: leg.fromLat,
    toLon: leg.fromLon,
    carrier: leg.carrier,
    connections: conns.length ? conns : undefined,
    createdAt: Date.now(),
  };
}

// ─── Cruises ─────────────────────────────────────────────────────────────────

/** Dates a boat booking covers, from embarkation to disembarkation. */
export function cruiseRanges(legs: TransportLeg[]): { start: string; end: string }[] {
  return legs
    .filter((l) => l.mode === 'boat')
    .map((l) => {
      const dates = [l.departureDate, l.arrivalDate, ...(l.connections ?? []).flatMap((c) => [c.arriveDate, c.departDate])].filter((d): d is string => !!d).sort();
      return { start: dates[0], end: dates[dates.length - 1] };
    });
}

/** A day on board a cruise, including embarkation and disembarkation days. */
export const isCruiseDay = (ranges: { start: string; end: string }[], date: string) => ranges.some((r) => r.start <= date && date <= r.end);

/** A night spent on board: no lodging is needed. */
export const isCruiseNight = (ranges: { start: string; end: string }[], date: string) => ranges.some((r) => r.start <= date && date < r.end);

// ─── Daily travel summary ────────────────────────────────────────────────────

const MODE_EMOJI: Record<TransportMode, string> = { drive: '🚗', fly: '✈️', train: '🚂', boat: '🛳️' };

/** One short line per leg that departs or arrives on `date` (empty when it isn't a travel day). */
export function travelDaySummary(legs: TransportLeg[], date: string): string[] {
  const segs = [...directionSegments(legs.filter((l) => l.direction === 'outbound')), ...directionSegments(legs.filter((l) => l.direction === 'return'))];
  const at = (label: string, time?: string) => `${label || '?'}${time ? ` ${fmt12h(time)}` : ''}`;
  return segs
    .filter((s) => s.departDate === date || s.arriveDate === date)
    .sort((a, b) => (a.departTime ?? '').localeCompare(b.departTime ?? ''))
    .map((s) => {
      const via = [s.carrier, s.identifier].filter(Boolean).join(' ');
      const extra = via ? ` · ${via}` : '';
      const icon = MODE_EMOJI[s.mode];
      if (s.departDate === date && (s.arriveDate === date || !s.arriveDate)) return `${icon} ${at(s.from, s.departTime)} → ${at(s.to, s.arriveTime)}${extra}`;
      if (s.departDate === date) return `${icon} Departs ${at(s.from, s.departTime)} → arrives ${formatDay(s.arriveDate!)}, ${at(s.to, s.arriveTime)}${extra}`;
      return `${icon} Arrives ${at(s.to, s.arriveTime)} (from ${s.from || '?'})${extra}`;
    });
}
