import type { TransportMode } from '../../db/types';
import { Field, inputClass } from '../../components/ui';

export const TRAVEL_MODE_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: 'fly', label: '✈️ Flight' },
  { value: 'drive', label: '🚗 Drive' },
  { value: 'train', label: '🚂 Train' },
  { value: 'boat', label: '🛳️ Cruise / Boat' },
];

/** How you travel to a destination (or home). Used to preload the Itinerary's placeholder transportation. */
export function TravelModeSelect({ label, value, onChange }: { label: string; value: TransportMode; onChange: (m: TransportMode) => void }) {
  return (
    <Field label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as TransportMode)}>
        {TRAVEL_MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
