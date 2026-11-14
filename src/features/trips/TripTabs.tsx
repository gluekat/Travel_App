import { Tabs } from '../../components/Tabs';

export type TripView = 'overview' | 'packing' | 'itinerary';

/** Switches a trip between its overview, packing checklist, and itinerary. */
export function TripTabs({ tripId, current }: { tripId: number; current: TripView }) {
  return (
    <Tabs
      label="Trip views"
      current={current}
      tabs={[
        { id: 'overview', label: 'Trip Overview', href: `#/trips/${tripId}` },
        { id: 'packing', label: 'Packing Checklist', href: `#/trips/${tripId}/packing` },
        { id: 'itinerary', label: 'Itinerary', href: `#/trips/${tripId}/itinerary` },
      ]}
    />
  );
}
