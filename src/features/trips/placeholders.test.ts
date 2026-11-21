import { beforeEach, describe, expect, it } from 'vitest';
import { db, setSetting } from '../../db/schema';
import type { TripStop } from '../../db/types';
import { createTrip, setTripStops } from './tripService';
import { refreshPlaceholders } from './placeholders';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setSetting('homeAirport', 'JFK');
});

const rome = { label: 'Rome, Italy', lat: 41.9, lon: 12.5, startDate: '2026-06-10', endDate: '2026-06-13' };
const florence = { label: 'Florence, Italy', lat: 43.77, lon: 11.25, startDate: '2026-06-13', endDate: '2026-06-16' };
const legs = async (tripId: number) => (await db.tripTransport.where('tripId').equals(tripId).toArray()).sort((a, b) => a.departureDate.localeCompare(b.departureDate) || a.createdAt - b.createdAt);

describe('placeholder transportation by kind of travel', () => {
  it('uses the chosen kind of travel for each hop, with airports only for flights', async () => {
    await setSetting('homeLocation', { label: 'Boston, Massachusetts, United States', lat: 42.36, lon: -71.06 });
    const stops: TripStop[] = [rome, florence];
    const tripId = await createTrip('Rome', undefined, '2026-06-10', '2026-06-16', stops, ['fly', 'train', 'drive']);
    expect((await db.trips.get(tripId))!.travelModes).toEqual(['fly', 'train', 'drive']);
    const list = await legs(tripId);
    expect(list.map((l) => l.mode)).toEqual(['fly', 'train', 'drive']);
    expect(list[0].fromPoint).toMatch(/^JFK/); // flight from the home airport
    expect(list[0].toPoint).toMatch(/^FCO/);
    expect([list[1].fromPoint, list[1].toPoint]).toEqual(['Rome, Italy', 'Florence, Italy']); // train: cities
    expect([list[2].fromPoint, list[2].toPoint]).toEqual(['Florence, Italy', 'Boston, Massachusetts']); // drive home: cities
  });

  it('rebuilds placeholders when the chosen kinds of travel change', async () => {
    const tripId = await createTrip('Rome', undefined, '2026-06-10', '2026-06-16', [rome, florence]);
    await db.trips.update(tripId, { travelModes: ['fly', 'boat', 'fly'] });
    await refreshPlaceholders(tripId);
    expect((await legs(tripId)).map((l) => l.mode)).toEqual(['fly', 'boat', 'fly']);
  });
});

describe('placeholder transportation', () => {
  it('creates home → stop → … → home hops with dates from the destinations', async () => {
    const stops: TripStop[] = [rome, florence];
    const tripId = await createTrip('Rome', undefined, '2026-06-10', '2026-06-16', stops);
    const list = await legs(tripId);
    expect(list.map((l) => [l.direction, l.fromPoint?.slice(0, 3) ?? l.fromPoint, l.departureDate])).toEqual([
      ['outbound', 'JFK', '2026-06-10'],
      ['outbound', 'FCO', '2026-06-13'],
      ['return', 'FLR', '2026-06-16'],
    ]);
    expect(list[0].toPoint).toMatch(/^FCO/);
    expect(list[1].toPoint).toMatch(/^FLR/);
    expect(list[2].toPoint).toMatch(/^JFK/);
    expect(list.every((l) => l.placeholder && l.mode === 'fly' && l.arrivalDate === l.departureDate)).toBe(true);
  });

  it('makes an outbound and a return hop for a single destination', async () => {
    const tripId = await createTrip('Rome', { name: 'Rome', label: 'Rome, Italy', lat: 41.9, lon: 12.5 } as never, '2026-06-10', '2026-06-13');
    expect((await legs(tripId)).map((l) => [l.direction, l.departureDate])).toEqual([['outbound', '2026-06-10'], ['return', '2026-06-13']]);
  });

  it('follows edited destinations and dates, but keeps legs the user has filled in', async () => {
    const tripId = await createTrip('Rome', undefined, '2026-06-10', '2026-06-16', [rome, florence]);
    const first = (await legs(tripId))[0];
    await db.tripTransport.update(first.id!, { placeholder: undefined, carrier: 'ITA', identifier: 'AZ611' }); // user filled it in
    const trip = (await db.trips.get(tripId))!;
    const venice = { label: 'Venice, Italy', lat: 45.44, lon: 12.32, startDate: '2026-06-13', endDate: '2026-06-18' };
    await setTripStops(trip, [rome, venice]);

    const after = await legs(tripId);
    expect((await db.trips.get(tripId))).toMatchObject({ endDate: '2026-06-18', placeLabel: 'Rome → Venice' });
    expect(await db.tripDays.where('tripId').equals(tripId).count()).toBe(9);
    expect(after.find((l) => l.id === first.id)).toMatchObject({ carrier: 'ITA' }); // real booking untouched
    const holders = after.filter((l) => l.placeholder);
    expect(holders.map((l) => l.toPoint?.slice(0, 3))).toEqual(['VCE', 'JFK']);
    expect(holders[1].departureDate).toBe('2026-06-18');
    await refreshPlaceholders(tripId);
    expect((await legs(tripId)).length).toBe(after.length); // idempotent
  });
});
