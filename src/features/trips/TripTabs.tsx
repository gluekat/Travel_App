import { Tabs } from '../../components/Tabs';

export type TripView = 'overview' | 'packing';

/** Switches a trip between its overview (days and outfits) and its packing checklist. */
export function TripTabs({ tripId, current }: { tripId: number; current: TripView }) {
  return (
    <Tabs
      label="Trip views"
      current={current}
      tabs={[
        { id: 'overview', label: 'Trip Overview', href: `#/trips/${tripId}` },
        { id: 'packing', label: 'Packing Checklist', href: `#/trips/${tripId}/packing` },
      ]}
    />
  );
}
