import type { ClosetItem, Trip } from '../../db/types';
import { db } from '../../db/schema';
import { Banner, Icon } from '../../components/ui';

/** Items flagged as a poor fit for the forecast, minus the ones the user cleared for this trip. */
export function visibleForecastItems(mismatched: Set<number>, trip: Trip): Set<number> {
  const dismissed = new Set(trip.dismissedForecast ?? []);
  return new Set([...mismatched].filter((id) => !dismissed.has(id)));
}

/** The "may not suit the forecast" notice, shared by the Trip Overview and the Packing checklist. */
export function ForecastWarning({ trip, mismatched, closet }: { trip: Trip; mismatched: Set<number>; closet: ClosetItem[] }) {
  const visible = visibleForecastItems(mismatched, trip);
  const dismissedCount = mismatched.size - visible.size;
  const byId = new Map(closet.map((i) => [i.id!, i]));
  const setDismissed = (ids: number[]) => db.trips.update(trip.id!, { dismissedForecast: ids.length ? ids : undefined });

  if (visible.size === 0 && dismissedCount === 0) return null;
  return (
    <div className="no-print space-y-1">
      {visible.size > 0 && (
        <Banner tone="warn">
          <div className="space-y-2">
            <p>
              ⚠️ Some packed items (marked with <Icon name="alert" className="inline h-3.5 w-3.5 text-amber-600" />) may not suit the forecast — warmth or weather tags don't match the temperature on those days. Review outfits or use <strong>Swap</strong> to find better alternatives.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {[...visible].map((id) => (
                <li key={id} className="inline-flex items-center gap-1 rounded-full bg-white/70 py-0.5 pl-2.5 pr-1 text-xs">
                  {byId.get(id)?.name ?? 'Item'}
                  <button
                    type="button"
                    className="rounded-full px-1.5 hover:bg-amber-100"
                    aria-label={`Clear warning for ${byId.get(id)?.name ?? 'item'}`}
                    title="Clear this warning"
                    onClick={() => setDismissed([...(trip.dismissedForecast ?? []), id])}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="text-xs font-medium underline" onClick={() => setDismissed([...(trip.dismissedForecast ?? []), ...visible])}>
              Clear all warnings
            </button>
          </div>
        </Banner>
      )}
      {dismissedCount > 0 && (
        <p className="text-xs text-slate-500">
          {dismissedCount} forecast warning{dismissedCount !== 1 ? 's' : ''} cleared.{' '}
          <button type="button" className="underline" onClick={() => setDismissed([])}>
            Show again
          </button>
        </p>
      )}
    </div>
  );
}
