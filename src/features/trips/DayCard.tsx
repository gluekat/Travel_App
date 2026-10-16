import { ACTIVITIES, type ClosetItem, type Outfit, type TempUnit, type TripDay } from '../../db/types';
import { formatDay } from '../../lib/dates';
import { Button, ChipGroup, Icon } from '../../components/ui';
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
}

/** A trip day: its weather, activities and the outfits you've chosen. */
export function DayCard({ day, index, outfits, closet, usage, unit, formatTemp }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Day ${index}`}>
      <h3 className="mb-2 font-semibold">
        Day {index} <span className="font-normal text-slate-500">· {formatDay(day.date)}</span>
      </h3>
      <WeatherSummary dayId={day.id!} weather={day.weather} unit={unit} />
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
