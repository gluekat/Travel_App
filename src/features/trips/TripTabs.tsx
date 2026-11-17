import { Tabs } from '../../components/Tabs';

export type TripView = 'overview' | 'packing' | 'itinerary' | 'closet';

/** Switches a trip between its overview, packing checklist, itinerary, and closet. */
export function TripTabs({ tripId, current }: { tripId: number; current: TripView }) {
  return (
    <Tabs
      label="Trip views"
      current={current}
      tabs={[
        { id: 'overview', label: 'Trip Overview', href: `#/trips/${tripId}` },
        { id: 'packing', label: 'Packing Checklist', href: `#/trips/${tripId}/packing` },
        { id: 'itinerary', label: 'Itinerary', href: `#/trips/${tripId}/itinerary` },
        { id: 'closet', label: 'Closet', href: `#/trips/${tripId}/closet` },
      ]}
    />
  );
}
