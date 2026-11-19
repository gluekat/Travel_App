import { useEffect, useRef } from 'react';
import type { Trip, TripDay, TransportLeg } from '../../db/types';
import { useOnline } from '../../lib/hooks';
import { refreshTripWeather } from '../../weather/tripWeather';
import { computeDayPlaces, weatherNeedsPlaceRefresh } from './dayPlaces';

/** Re-fetches a trip's weather when transport changes mean some days are now somewhere else. Runs once per distinct change. */
export function useWeatherSync(trip: Trip | null | undefined, days: TripDay[] | undefined, legs: TransportLeg[] | undefined) {
  const online = useOnline();
  const lastSig = useRef('');
  useEffect(() => {
    if (!trip || !days || !legs || !online) return;
    const places = computeDayPlaces(trip, days, legs);
    const stale = days.filter((d) => weatherNeedsPlaceRefresh(d, trip, places));
    if (!stale.length) return;
    const sig = stale.map((d) => `${d.date}:${places.get(d.date)?.lat},${places.get(d.date)?.lon}`).join('|');
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    void refreshTripWeather(trip.id!).catch(() => {});
  }, [trip, days, legs, online]);
}
