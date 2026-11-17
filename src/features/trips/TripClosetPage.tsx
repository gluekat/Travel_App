import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { ClosetPage, type ClosetView } from '../closet/ClosetPage';
import { TripTabs } from './TripTabs';

/** The closet shown inside a trip, so you can browse or edit it without leaving the trip. */
export function TripClosetPage({ tripId, view }: { tripId: number; view: ClosetView }) {
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  if (trip === undefined) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!trip) return <p className="text-sm text-slate-500">Trip not found.</p>;
  return (
    <div className="space-y-4">
      <div>
        <a href="#/trips" className="no-print text-sm text-teal-700">← Trips</a>
        <h1 className="text-xl font-semibold">{trip.name ?? trip.placeLabel ?? trip.destination}</h1>
      </div>
      <TripTabs tripId={tripId} current="closet" />
      <ClosetPage view={view} basePath={`#/trips/${tripId}/closet`} embedded />
    </div>
  );
}
