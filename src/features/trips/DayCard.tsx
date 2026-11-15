import { ACTIVITIES, type ClosetItem, type Outfit, type SavedOutfit, type ScheduledActivity, type TempUnit, type TripDay } from '../../db/types';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fmt12h, formatDay } from '../../lib/dates';
import { Button, ChipGroup, Icon, Modal } from '../../components/ui';
import { db } from '../../db/schema';
import { OutfitCard } from '../outfits/OutfitCard';
import { addOutfit, addOutfitFromSaved } from '../outfits/outfitService';
import { WeatherSummary } from './WeatherSummary';
import { setDayActivities } from './tripService';

interface Props {
  day: TripDay;
  index: number;
  outfits: Outfit[];
  closet: ClosetItem[];
  usage: Map<number, number>;
  /** Pre-laundry usage: wear counts from before this laundry day — used in the laundry panel. */
  prelaundryUsage?: Map<number, number>;
  /** Items that first exceeded their wear capacity on this day. */
  warnings?: string[];
  unit: TempUnit;
  formatTemp: (c: number) => string;
  location?: string;
  activities?: ScheduledActivity[];
}

/** A trip day: its weather, activities and the outfits you've chosen. */
export function DayCard({ day, index, outfits, closet, usage, prelaundryUsage, warnings, unit, formatTemp, location, activities }: Props) {
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const savedOutfits = useLiveQuery(() => db.savedOutfits.orderBy('name').toArray(), []);
  const sorted = activities ? [...activities].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')) : [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Day ${index}`}>
      <h3 className="mb-2 font-semibold">
        Day {index}{' '}
        <span className="font-normal text-slate-500">· {formatDay(day.date)}</span>
        {location && <span className="font-normal text-teal-700"> · {location}</span>}
      </h3>
      <WeatherSummary dayId={day.id!} weather={day.weather} unit={unit} />

      {sorted.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Scheduled</p>
          <ul className="space-y-1">
            {sorted.map((act) => {
              const linkedOutfit = act.outfitId ? outfits.find((o) => o.id === act.outfitId) : undefined;
              return (
                <li key={act.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {act.startTime && (
                    <span className="shrink-0 text-slate-500">{fmt12h(act.startTime)}</span>
                  )}
                  <span className="font-medium">{act.name}</span>
                  {act.endTime && <span className="text-slate-500">– {fmt12h(act.endTime)}</span>}
                  {act.location && <span className="text-xs text-slate-400">📍 {act.location}</span>}
                  {outfits.length > 0 && (
                    <select
                      className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600"
                      value={act.outfitId ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        void db.tripActivities.update(act.id!, { outfitId: val ? Number(val) : undefined });
                      }}
                      aria-label={`Outfit for ${act.name}`}
                    >
                      <option value="">No outfit</option>
                      {outfits.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {linkedOutfit && (
                    <span className="text-xs text-teal-700">👗 {linkedOutfit.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Activities</p>
        <ChipGroup label={`Day ${index} activities`} options={ACTIVITIES} value={day.activities} onChange={(acts) => setDayActivities(day.id!, acts)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {outfits.map((o) => (
          <OutfitCard key={o.id} outfit={o} day={day} dayIndex={index} closet={closet} usage={usage} formatTemp={formatTemp} />
        ))}
      </div>
      {(warnings?.length ?? 0) > 0 && (
        <div className="mt-2 space-y-1">
          {warnings!.map((w) => (
            <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => addOutfit(day.tripId, day.id!)}>
          <Icon name="plus" /> Add outfit
        </Button>
        <Button variant="ghost" onClick={() => addOutfit(day.tripId, day.id!, 'Sleepwear 🌙')}>
          🌙 Add sleepwear
        </Button>
        {(savedOutfits?.length ?? 0) > 0 && (
          <Button variant="ghost" onClick={() => setShowSavedPicker(true)}>
            👗 From saved outfits
          </Button>
        )}
      </div>
      {showSavedPicker && savedOutfits && (
        <SavedOutfitPicker
          savedOutfits={savedOutfits}
          closet={closet}
          onSelect={async (so) => {
            await addOutfitFromSaved(day.tripId, day.id!, so.itemIds, so.name);
            setShowSavedPicker(false);
          }}
          onClose={() => setShowSavedPicker(false)}
        />
      )}

      <LaundrySection day={day} closet={closet} usage={usage} prelaundryUsage={prelaundryUsage} />
    </section>
  );
}

function SavedOutfitPicker({ savedOutfits, closet, onSelect, onClose }: {
  savedOutfits: SavedOutfit[];
  closet: ClosetItem[];
  onSelect: (so: SavedOutfit) => void;
  onClose: () => void;
}) {
  const byId = useMemo(() => new Map(closet.map((c) => [c.id!, c])), [closet]);
  return (
    <Modal title="Add from saved outfits" onClose={onClose}>
      {savedOutfits.length === 0 ? (
        <p className="text-sm text-slate-500">No saved outfits yet. Save an outfit from any day's outfit card first.</p>
      ) : (
        <ul className="space-y-2">
          {savedOutfits.map((so) => {
            const names = so.itemIds.map((id) => byId.get(id)?.name).filter(Boolean);
            return (
              <li key={so.id}>
                <button
                  className="flex w-full flex-col gap-0.5 rounded-lg border border-slate-200 p-3 text-left hover:border-teal-500"
                  onClick={() => onSelect(so)}
                >
                  <span className="text-sm font-medium">{so.name}</span>
                  {names.length > 0 && (
                    <span className="text-xs text-slate-500">{names.join(', ')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function LaundrySection({ day, closet, usage, prelaundryUsage }: {
  day: TripDay;
  closet: ClosetItem[];
  usage: Map<number, number>;
  prelaundryUsage?: Map<number, number>;
}) {
  // Show what was worn BEFORE this laundry day (what actually needs washing).
  // Fall back to current usage when no pre-laundry data is available.
  const displayUsage = prelaundryUsage ?? usage;

  const wornItems = useMemo(
    () => closet.filter((item) => (displayUsage.get(item.id!) ?? 0) > 0),
    [closet, displayUsage],
  );

  function isSuggested(item: ClosetItem) {
    if (item.unlimitedWear) return false;
    return (displayUsage.get(item.id!) ?? 0) >= Math.max(1, item.wearCount - 1);
  }

  async function toggleLaundryDay() {
    if (day.laundryDay) {
      await db.tripDays.update(day.id!, { laundryDay: false, laundryItems: [] });
    } else {
      const suggested = closet.filter(isSuggested).map((item) => item.id!);
      await db.tripDays.update(day.id!, { laundryDay: true, laundryItems: suggested });
    }
  }

  async function toggleItem(itemId: number) {
    const current = day.laundryItems ?? [];
    const next = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    await db.tripDays.update(day.id!, { laundryItems: next });
  }

  async function suggestItems() {
    const suggested = closet.filter(isSuggested).map((item) => item.id!);
    await db.tripDays.update(day.id!, { laundryItems: suggested });
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`text-sm ${day.laundryDay ? 'font-medium text-sky-700' : 'text-slate-400 hover:text-slate-600'}`}
          onClick={() => void toggleLaundryDay()}
        >
          🧺 {day.laundryDay ? 'Laundry day' : 'Plan laundry'}
        </button>
        {day.laundryDay && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-red-600"
            onClick={() => void toggleLaundryDay()}
          >
            Remove
          </button>
        )}
      </div>

      {day.laundryDay && (
        <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-sky-800">Items to wash</p>
            <button
              type="button"
              className="text-xs text-sky-600 hover:underline"
              onClick={() => void suggestItems()}
            >
              Suggest items
            </button>
          </div>
          {wornItems.length === 0 ? (
            <p className="text-xs text-slate-500">No items worn yet — add outfits to see suggestions.</p>
          ) : (
            <ul className="space-y-1.5">
              {wornItems.map((item) => {
                const wears = displayUsage.get(item.id!) ?? 0;
                const checked = day.laundryItems?.includes(item.id!) ?? false;
                const needsWash = !item.unlimitedWear && wears >= item.wearCount;
                const wearLabel = item.unlimitedWear
                  ? `${wears} worn`
                  : `${wears}/${item.wearCount} wear${item.wearCount !== 1 ? 's' : ''}`;
                return (
                  <li key={item.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => void toggleItem(item.id!)}
                      className="rounded"
                    />
                    <span className={needsWash ? 'font-medium text-amber-700' : 'text-slate-700'}>
                      {item.name}
                    </span>
                    <span className="text-slate-400">{wearLabel}</span>
                    {needsWash && <span className="text-amber-600">⚠️</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
