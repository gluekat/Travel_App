import { describe, expect, it } from 'vitest';
import type { TransportLeg, Trip, TripDay } from '../../db/types';
import { computeDayPlaces, placeKey, weatherNeedsPlaceRefresh } from './dayPlaces';

const trip: Trip = { id: 1, destination: 'Rome', placeLabel: 'Rome, Italy', lat: 41.9, lon: 12.5, startDate: '2026-06-10', endDate: '2026-06-14', createdAt: 1 };
const days: TripDay[] = ['10', '11', '12', '13', '14'].map((d, i) => ({ id: i + 1, tripId: 1, date: `2026-06-${d}`, activities: [] }));
const home = { fromPoint: 'New York, NY', fromLat: 40.7, fromLon: -74.0 };
const legs: TransportLeg[] = [
  { id: 1, tripId: 1, direction: 'outbound', mode: 'fly', departureDate: '2026-06-10', departureTime: '18:00', arrivalDate: '2026-06-11', arrivalTime: '09:00', ...home, toPoint: 'FCO – Leonardo da Vinci–Fiumicino, Rome', toLat: 41.8, toLon: 12.24, createdAt: 1 },
  { id: 2, tripId: 1, direction: 'return', mode: 'fly', departureDate: '2026-06-14', departureTime: '10:00', arrivalDate: '2026-06-14', arrivalTime: '14:00', fromPoint: 'FCO – Leonardo da Vinci–Fiumicino, Rome', fromLat: 41.8, fromLon: 12.24, toPoint: 'New York, NY', toLat: 40.7, toLon: -74.0, createdAt: 1 },
];

describe('computeDayPlaces', () => {
  it('follows the transport legs: home until arrival, destination between, home again after the return', () => {
    const p = computeDayPlaces(trip, days, legs);
    expect(p.get('2026-06-10')).toMatchObject({ label: 'New York, NY', lat: 40.7, fromTransport: true }); // overnight flight: still home
    expect(p.get('2026-06-11')?.label).toBe('New York, NY → Rome, Italy');
    expect(p.get('2026-06-11')).toMatchObject({ from: { label: 'New York, NY', lat: 40.7 }, toLabel: 'Rome, Italy' });
    expect(p.get('2026-06-12')?.from).toBeUndefined();
    expect(p.get('2026-06-12')).toMatchObject({ label: 'Rome, Italy', lat: 41.8 });
    expect(p.get('2026-06-14')?.label).toBe('Rome, Italy → New York, NY');
    expect(p.get('2026-06-14')?.lat).toBe(40.7);
  });

  it('falls back to the trip destination without transport or without coordinates', () => {
    expect(computeDayPlaces(trip, days, []).get('2026-06-12')).toMatchObject({ label: 'Rome, Italy', lat: 41.9, fromTransport: false });
    const noCoords = legs.map((l) => ({ ...l, toLat: undefined, toLon: undefined }));
    expect(computeDayPlaces(trip, days, [noCoords[0]]).get('2026-06-12')?.fromTransport).toBe(false);
  });

  it('flags weather fetched for another place, but not manual or matching weather', () => {
    const places = computeDayPlaces(trip, days, legs);
    const w = { high: 20, low: 10, precipChance: 0, condition: 'x', source: 'forecast' as const, fetchedAt: 1 };
    const d = days[1]; // Jun 11: now New York → Rome, weather at Rome
    expect(weatherNeedsPlaceRefresh({ ...d, weather: { ...w, placeKey: placeKey(40.7, -74.0) } }, trip, places)).toBe(true);
    expect(weatherNeedsPlaceRefresh({ ...d, weather: { ...w, source: 'manual' } }, trip, places)).toBe(false);
    // a travel day also needs the weather where it starts
    const here = { ...w, placeKey: placeKey(41.8, 12.24) };
    const there = { ...w, placeKey: placeKey(40.7, -74.0) };
    expect(weatherNeedsPlaceRefresh({ ...d, weather: here, weatherFrom: there }, trip, places)).toBe(false);
    expect(weatherNeedsPlaceRefresh({ ...d, weather: here }, trip, places)).toBe(true); // travel day still missing its starting weather
    expect(weatherNeedsPlaceRefresh({ ...d, weather: w }, trip, places)).toBe(true); // legacy: fetched for the trip's destination (41.9, 12.5)
  });
});
