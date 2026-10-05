import { useMemo } from 'react';
import { ACTIVITIES, type ClosetItem, type Outfit, type TempUnit, type TripDay } from '../../db/types';
import { detectGaps, outfitTargets } from '../../engine/suggest';
import { formatDay } from '../../lib/dates';
import { Banner, Button, ChipGroup, Icon } from '../../components/ui';
import { OutfitCard } from '../outfits/OutfitCard';
import { regenerateDay, toEngineDay, toEngineItem } from '../outfits/outfitService';
import { WeatherSummary } from './WeatherSummary';
import { setDayActivities } from './tripService';

interface Props {
  day: TripDay;
  index: number;
  outfits: Outfit[];
  closet: ClosetItem[];
  unit: TempUnit;
  formatTemp: (c: number) => string;
}

export function DayCard({ day, index, outfits, closet, unit, formatTemp }: Props) {
  const gaps = useMemo(() => {
    if (!outfits.length) return [];
    return detectGaps(closet.map(toEngineItem), toEngineDay(day, index), outfits, outfitTargets(day.activities), formatTemp);
  }, [closet, day, index, outfits, formatTemp]);

  const regenerate = () => regenerateDay(day.tripId, day.id!, formatTemp, Math.floor(Math.random() * 1e6));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Day ${index}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          Day {index} <span className="font-normal text-slate-500">· {formatDay(day.date)}</span>
        </h3>
        {outfits.length > 0 && (
          <Button variant="ghost" onClick={regenerate} title="Regenerate this day (locked items are kept)">
            <Icon name="refresh" /> Regenerate day
          </Button>
        )}
      </div>
      <WeatherSummary dayId={day.id!} weather={day.weather} unit={unit} />
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Activities</p>
        <ChipGroup
          label={`Day ${index} activities`}
          options={ACTIVITIES}
          value={day.activities}
          onChange={async (acts) => {
            await setDayActivities(day.id!, acts);
            if (outfits.length) await regenerateDay(day.tripId, day.id!, formatTemp, 0);
          }}
        />
      </div>
      {gaps.length > 0 && (
        <div className="mt-3 space-y-1">
          {gaps.map((g) => (
            <Banner key={g} tone="warn">
              ⚠️ {g}
            </Banner>
          ))}
        </div>
      )}
      {outfits.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {outfits.map((o) => (
            <OutfitCard key={o.id} outfit={o} day={day} dayIndex={index} closet={closet} formatTemp={formatTemp} />
          ))}
        </div>
      )}
    </section>
  );
}
