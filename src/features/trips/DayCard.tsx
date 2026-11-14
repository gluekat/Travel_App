import { ACTIVITIES, type ClosetItem, type Outfit, type ScheduledActivity, type TempUnit, type TripDay } from '../../db/types';
import { fmt12h, formatDay } from '../../lib/dates';
import { Button, ChipGroup, Icon } from '../../components/ui';
import { db } from '../../db/schema';
import { OutfitCard } from '../outfits/OutfitCard';
import { addOutfit } from '../outfits/outfitService';
import { WeatherSummary } from './WeatherSummary';
import { setDayActivities } from './tripService';

interface Props {
  day: TripDay;
  index: number;
  outfits: Outfit[];
  closet: ClosetItem[];
  usage: Map<number, number>;
  unit: TempUnit;
  formatTemp: (c: number) => string;
  location?: string;
  activities?: ScheduledActivity[];
}

/** A trip day: its weather, activities and the outfits you've chosen. */
export function DayCard({ day, index, outfits, closet, usage, unit, formatTemp, location, activities }: Props) {
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
      <div className="mt-3">
        <Button variant="ghost" onClick={() => addOutfit(day.tripId, day.id!)}>
          <Icon name="plus" /> Add outfit
        </Button>
      </div>
    </section>
  );
}
