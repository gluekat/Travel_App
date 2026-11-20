/** Moving lodging and travel along with a trip's dates — proposed first, applied only if the user confirms. */
import { db } from '../../db/schema';
import type { TransportLeg, TripLodging } from '../../db/types';
import { formatDay } from '../../lib/dates';
import { shiftTransportForTripDates } from './transportPlan';

export interface DateAdjustment {
  /** Unique within a plan, e.g. "lodging:3". */
  key: string;
  kind: 'lodging' | 'transport';
  id: number;
  title: string;
  /** What would change, e.g. "Check-out Jun 14 → Jun 16". */
  detail: string;
  patch: Partial<TripLodging> & Partial<TransportLeg>;
}

const MODE_NAME = { fly: 'Flight', drive: 'Drive', train: 'Train', boat: 'Cruise' } as const;

/** Lodging that ran to the old first/last day follows the new dates; later check-outs are trimmed to the new end. */
export function planLodging(stays: TripLodging[], oldStart: string, newStart: string, newEnd: string, oldEnd: string): DateAdjustment[] {
  const out: DateAdjustment[] = [];
  for (const stay of stays) {
    const patch: Partial<TripLodging> = {};
    const parts: string[] = [];
    let checkIn = stay.checkInDate;
    let checkOut = stay.checkOutDate;
    if (checkIn === oldStart && newStart !== oldStart) checkIn = newStart;
    if ((checkOut === oldEnd && newEnd !== oldEnd) || checkOut > newEnd) checkOut = newEnd;
    if (checkIn > checkOut) checkIn = checkOut;
    if (checkIn !== stay.checkInDate) {
      patch.checkInDate = checkIn;
      parts.push(`Check-in ${formatDay(stay.checkInDate)} → ${formatDay(checkIn)}`);
    }
    if (checkOut !== stay.checkOutDate) {
      patch.checkOutDate = checkOut;
      parts.push(`Check-out ${formatDay(stay.checkOutDate)} → ${formatDay(checkOut)}`);
    }
    if (parts.length) out.push({ key: `lodging:${stay.id}`, kind: 'lodging', id: stay.id!, title: `🏨 ${stay.name}`, detail: parts.join(', '), patch });
  }
  return out;
}

export function planTransport(legs: TransportLeg[], oldStart: string, newStart: string, oldEnd: string, newEnd: string): DateAdjustment[] {
  // Placeholders are simply regenerated from the new dates, so they are not proposed.
  legs = legs.filter((l) => !l.placeholder);
  const byId = new Map(legs.map((l) => [l.id!, l]));
  return shiftTransportForTripDates(legs, oldStart, newStart, oldEnd, newEnd).map(({ id, patch }) => {
    const leg = byId.get(id)!;
    const route = [leg.fromPoint, leg.toPoint].filter(Boolean).join(' → ');
    return {
      key: `transport:${id}`,
      kind: 'transport' as const,
      id,
      title: `${leg.direction === 'outbound' ? '→' : '←'} ${MODE_NAME[leg.mode]}${route ? ` · ${route}` : ''}`,
      detail: `Departs ${formatDay(leg.departureDate)} → ${formatDay(patch.departureDate ?? leg.departureDate)}`,
      patch,
    };
  });
}

/** Everything that would move with a change of trip dates, read before the dates are changed. */
export async function planTripDateAdjustments(tripId: number, oldStart: string, oldEnd: string, newStart: string, newEnd: string): Promise<DateAdjustment[]> {
  const [stays, legs] = await Promise.all([db.tripLodging.where('tripId').equals(tripId).toArray(), db.tripTransport.where('tripId').equals(tripId).toArray()]);
  return [...planTransport(legs, oldStart, newStart, oldEnd, newEnd), ...planLodging(stays, oldStart, newStart, newEnd, oldEnd)];
}

const table = (kind: DateAdjustment['kind']) => (kind === 'lodging' ? db.tripLodging : db.tripTransport);

/** Mark entries whose dates did not follow the trip, so the Itinerary shows they need attention. */
export async function flagAdjustments(plan: DateAdjustment[], oldStart: string, oldEnd: string): Promise<void> {
  const note = `Trip dates changed (was ${formatDay(oldStart)} – ${formatDay(oldEnd)}).`;
  await db.transaction('rw', db.tripLodging, db.tripTransport, async () => {
    for (const a of plan) await table(a.kind).update(a.id, { needsAttention: `${note} ${a.detail}.` });
  });
}

/** Apply the accepted adjustments (clearing their flags); the rest stay flagged. */
export async function applyAdjustments(plan: DateAdjustment[], accepted: Set<string>): Promise<void> {
  await db.transaction('rw', db.tripLodging, db.tripTransport, async () => {
    for (const a of plan) if (accepted.has(a.key)) await table(a.kind).update(a.id, { ...a.patch, needsAttention: undefined });
  });
}
