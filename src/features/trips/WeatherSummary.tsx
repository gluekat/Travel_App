import { useState, type FormEvent } from 'react';
import type { DayWeather, TempUnit } from '../../db/types';
import { formatTimestamp } from '../../lib/dates';
import { useOnline } from '../../lib/hooks';
import { cToF, fToC, formatTemp } from '../../lib/units';
import { codeEmoji } from '../../weather/wmo';
import { weatherSourceLabel } from '../../weather/resolveWeather';
import { setManualWeather } from '../../weather/tripWeather';
import { Button, inputClass } from '../../components/ui';

const SOURCE_STYLE: Record<string, string> = {
  'Live forecast': 'bg-emerald-100 text-emerald-800',
  'Historical average': 'bg-violet-100 text-violet-800',
  'Manual entry': 'bg-slate-200 text-slate-700',
};

export function SourceBadge({ weather }: { weather: DayWeather }) {
  const online = useOnline();
  const label = weatherSourceLabel(weather, online);
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SOURCE_STYLE[label] ?? 'bg-amber-100 text-amber-800'}`}
      title={`Fetched ${formatTimestamp(weather.fetchedAt)}`}
    >
      {label}
    </span>
  );
}

function ManualWeatherForm({ dayId, unit, initial, onDone }: { dayId: number; unit: TempUnit; initial?: DayWeather; onDone?: () => void }) {
  const toUnit = (c: number) => Math.round(unit === 'F' ? cToF(c) : c);
  const [high, setHigh] = useState(initial ? String(toUnit(initial.high)) : '');
  const [low, setLow] = useState(initial ? String(toUnit(initial.low)) : '');
  const [rain, setRain] = useState(initial ? String(initial.precipChance) : '0');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const h = Number(high);
    const l = Number(low);
    const toC = (v: number) => (unit === 'F' ? fToC(v) : v);
    await setManualWeather(dayId, {
      high: toC(Math.max(h, l)),
      low: toC(Math.min(h, l)),
      precipChance: Math.min(100, Math.max(0, Number(rain) || 0)),
    });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="w-20">
        <span className="text-xs text-slate-600">High °{unit}</span>
        <input type="number" className={inputClass} value={high} onChange={(e) => setHigh(e.target.value)} required />
      </label>
      <label className="w-20">
        <span className="text-xs text-slate-600">Low °{unit}</span>
        <input type="number" className={inputClass} value={low} onChange={(e) => setLow(e.target.value)} required />
      </label>
      <label className="w-24">
        <span className="text-xs text-slate-600">Rain %</span>
        <input type="number" min={0} max={100} className={inputClass} value={rain} onChange={(e) => setRain(e.target.value)} />
      </label>
      <Button type="submit" variant="primary">
        Save
      </Button>
      {onDone && <Button onClick={onDone}>Cancel</Button>}
    </form>
  );
}

export function WeatherSummary({ dayId, weather, unit }: { dayId: number; weather?: DayWeather; unit: TempUnit }) {
  const [editing, setEditing] = useState(false);
  if (!weather || editing) {
    return (
      <div className="space-y-1.5 rounded-lg bg-slate-50 p-2">
        {!weather && <p className="text-xs text-slate-600">No weather data for this day. Enter it manually:</p>}
        <ManualWeatherForm dayId={dayId} unit={unit} initial={weather} onDone={weather ? () => setEditing(false) : undefined} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-xl" aria-hidden="true">
        {codeEmoji(weather.code)}
      </span>
      <span className="font-medium">
        {formatTemp(weather.high, unit)} / {formatTemp(weather.low, unit)}
      </span>
      <span className="text-slate-600">💧 {Math.round(weather.precipChance)}%</span>
      <span className="text-slate-600">{weather.condition}</span>
      <SourceBadge weather={weather} />
      <button className="text-xs text-slate-500 underline" onClick={() => setEditing(true)}>
        edit
      </button>
    </div>
  );
}
