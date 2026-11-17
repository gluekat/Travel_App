import { describe, expect, it } from 'vitest';
import type { TransportLeg } from '../../db/types';
import { directionSegments, driveEstimate, mirrorLeg, shiftTransportForTripDates, transportOverview } from './transportPlan';

const leg = (over: Partial<TransportLeg>): TransportLeg => ({ id: 1, tripId: 1, direction: 'outbound', mode: 'fly', departureDate: '2026-06-10', createdAt: 1, ...over });

describe('directionSegments', () => {
  it('lists every leg with layovers (including overnight) for flights', () => {
    const segs = directionSegments([
      leg({
        fromPoint: 'JFK', toPoint: 'FCO', departureTime: '18:00', arrivalTime: '10:30', arrivalDate: '2026-06-11',
        connections: [{ point: 'LHR', arrive: '06:00', depart: '08:30' }],
      }),
    ]);
    expect(segs.map((s) => `${s.from}>${s.to}`)).toEqual(['JFK>LHR', 'LHR>FCO']);
    expect(segs[0].arriveDate).toBe('2026-06-11'); // 18:00 → 06:00 wraps to the next day
    expect(segs[1].layoverMinutes).toBe(150);
    expect(segs[0].layoverMinutes).toBeUndefined();
    expect(segs[0].durationMinutes).toBe(12 * 60);
  });

  it('computes layovers between separate bookings and skips them for car legs', () => {
    const segs = directionSegments([
      leg({ id: 1, fromPoint: 'A', toPoint: 'B', departureTime: '08:00', arrivalTime: '10:00' }),
      leg({ id: 2, fromPoint: 'B', toPoint: 'C', departureTime: '12:30', arrivalTime: '14:00' }),
      leg({ id: 3, mode: 'drive', fromPoint: 'C', toPoint: 'D', departureTime: '15:00' }),
    ]);
    expect(segs.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(segs[1].layoverMinutes).toBe(150);
    expect(segs[2].layoverMinutes).toBeUndefined();
  });

  it('estimates distance and time for each driving leg from coordinates', () => {
    const segs = directionSegments([
      leg({ mode: 'drive', fromPoint: 'NYC', fromLat: 40.71, fromLon: -74.0, toPoint: 'DC', toLat: 38.9, toLon: -77.04, connections: [{ point: 'Philly', lat: 39.95, lon: -75.17 }] }),
    ]);
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => (s.distanceMiles ?? 0) > 50 && (s.durationMinutes ?? 0) > 50)).toBe(true);
    const direct = driveEstimate(40.71, -74.0, 39.95, -75.17);
    expect(Math.round(segs[0].distanceMiles!)).toBe(Math.round(direct.miles));
  });

  it('overview spans first departure to last arrival and flags one-way', () => {
    const o = transportOverview([leg({ fromPoint: 'Home', toPoint: 'Rome' })]);
    expect(o).toMatchObject({ from: 'Home', to: 'Rome', oneWay: true });
    const both = transportOverview([leg({ fromPoint: 'Home', toPoint: 'Rome' }), leg({ id: 2, direction: 'return', departureDate: '2026-06-14', fromPoint: 'Rome', toPoint: 'Home' })]);
    expect(both).toMatchObject({ from: 'Home', to: 'Rome', oneWay: false });
    expect(both.returnArrival?.to).toBe('Home');
  });
});

describe('trip date changes and round trips', () => {
  it('moves outbound/return legs and their stops with the trip dates', () => {
    const out = leg({ id: 1, departureDate: '2026-06-10', connections: [{ point: 'X', arriveDate: '2026-06-10', departDate: '2026-06-10' }] });
    const back = leg({ id: 2, direction: 'return', departureDate: '2026-06-14' });
    const other = leg({ id: 3, departureDate: '2026-06-12' });
    const patches = shiftTransportForTripDates([out, back, other], '2026-06-10', '2026-06-09', '2026-06-14', '2026-06-16');
    expect(patches.map((p) => p.id)).toEqual([1, 2]);
    expect(patches[0].patch.departureDate).toBe('2026-06-09');
    expect(patches[0].patch.connections![0].arriveDate).toBe('2026-06-09');
    expect(patches[1].patch.departureDate).toBe('2026-06-16');
  });

  it('mirrors a leg for the way back', () => {
    const m = mirrorLeg({ tripId: 1, direction: 'outbound', mode: 'fly', departureDate: '2026-06-10', fromPoint: 'JFK', toPoint: 'FCO', carrier: 'ITA', identifier: 'AZ611', connections: [{ point: 'LHR', arrive: '06:00' }], createdAt: 1 }, '2026-06-14');
    expect(m).toMatchObject({ direction: 'return', fromPoint: 'FCO', toPoint: 'JFK', departureDate: '2026-06-14', carrier: 'ITA' });
    expect(m.identifier).toBeUndefined();
    expect(m.connections).toEqual([{ point: 'LHR', lat: undefined, lon: undefined }]);
  });
});
