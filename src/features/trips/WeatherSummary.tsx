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

function ManualWeatherForm({ dayId, unit, initial, field, onDone }: { dayId: number; unit: TempUnit; initial?: DayWeather; field: 'weather' | 'weatherFrom'; onDone?: () => void }) {
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
    }, field);
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

/**
 * A day's weather with its source ("Live forecast", "Historical average", …) and an edit link.
 * `field`/`label` let a travel day show and edit the weather for each of its places.
 */
export function WeatherSummary({ dayId, weather, unit, field = 'weather', label }: { dayId: number; weather?: DayWeather; unit: TempUnit; field?: 'weather' | 'weatherFrom'; label?: string }) {
  const [editing, setEditing] = useState(false);
  if (!weather || editing) {
    return (
      <div className="space-y-1.5 rounded-lg bg-slate-50 p-2">
        {label && <p className="text-xs font-semibold text-teal-800">{label}</p>}
        {!weather && <p className="text-xs text-slate-600">No weather data{label ? ` for ${label}` : ' for this day'}. Enter it manually:</p>}
        <ManualWeatherForm dayId={dayId} unit={unit} initial={weather} field={field} onDone={weather ? () => setEditing(false) : undefined} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {label && <span className="font-semibold text-teal-800">{label}</span>}
      <span className="text-xl" aria-hidden="true">
        {codeEmoji(weather.code)}
      </span>
      <span className="font-medium">
        {formatTemp(weather.high, unit)} / {formatTemp(weather.low, unit)}
      </span>
      <span className="text-slate-600">💧 {Math.round(weather.precipChance)}%</span>
      <span className="text-slate-600">{weather.condition}</span>
      <SourceBadge weather={weather} />
      <button className="text-xs text-slate-500 underline" onClick={() => setEditing(true)} aria-label={label ? `Edit weather for ${label}` : 'Edit weather'}>
        edit
      </button>
    </div>
  );
}

/** One compact weather line, optionally labelled with the place it applies to. */
export function WeatherLine({ weather, unit, label }: { weather: DayWeather; unit: TempUnit; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm" aria-label={label ? `Weather in ${label}` : 'Weather'}>
      {label && <span className="min-w-[8rem] text-xs font-semibold text-teal-800">{label}</span>}
      <span aria-hidden="true">{codeEmoji(weather.code)}</span>
      <span className="font-medium">
        {formatTemp(weather.high, unit)} / {formatTemp(weather.low, unit)}
      </span>
      <span className="text-slate-600">💧 {Math.round(weather.precipChance)}%</span>
      <span className="text-slate-600">{weather.condition}</span>
      <SourceBadge weather={weather} />
    </div>
  );
}
