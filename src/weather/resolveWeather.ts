/**
 * Weather fallback chain (pure apart from the injected fetch):
 *   1. live forecast   (dates within the 16-day forecast window)
 *   2. historical avg  (dates outside it, averaged over previous years)
 *   3. cached          (whatever was stored last time, if the network fails)
 *   4. missing         (no data at all: the UI asks for manual entry)
 */
import type { DayWeather } from '../db/types';
import { addDays, daysBetween } from '../lib/dates';
import { describeCode } from './wmo';
import { fetchArchive, fetchForecast, FORECAST_DAYS, type DailyForecast, type FetchLike } from './openMeteo';

export type ResolvedStatus = 'live' | 'cached' | 'missing';

export interface ResolvedDay {
  date: string;
  weather?: DayWeather;
  status: ResolvedStatus;
}

export interface ResolveInput {
  lat: number;
  lon: number;
  dates: string[];
  today: string;
  cached: Record<string, DayWeather | undefined>;
  fetchImpl?: FetchLike;
  now?: number;
  historyYears?: number;
}

export interface ResolveResult {
  days: ResolvedDay[];
  /** Set when any network request failed. */
  error?: string;
}

/** Days of slack either side of each date when averaging history. */
const HISTORY_WINDOW = 3;
/** Precipitation (mm/day) that counts as a "rainy day" in historical data. */
const RAINY_DAY_MM = 1;

export function shiftYears(date: string, years: number): string {
  const [y, m, d] = date.split('-');
  const year = Number(y) + years;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === '02' && d === '29' && !isLeap ? '28' : d;
  return `${year}-${m}-${day}`;
}

export function inForecastWindow(date: string, today: string): boolean {
  const offset = daysBetween(today, date);
  return offset >= 0 && offset < FORECAST_DAYS;
}

function mode(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  let best: number | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount || (c === bestCount && best != null && v > best)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function forecastToWeather(daily: DailyForecast, now: number): Map<string, DayWeather> {
  const out = new Map<string, DayWeather>();
  daily.time.forEach((date, i) => {
    const high = daily.temperature_2m_max[i];
    const low = daily.temperature_2m_min[i];
    if (high == null || low == null) return;
    const code = daily.weather_code[i] ?? undefined;
    out.set(date, {
      high,
      low,
      precipChance: daily.precipitation_probability_max?.[i] ?? 0,
      code,
      condition: describeCode(code),
      source: 'forecast',
      fetchedAt: now,
    });
  });
  return out;
}

/** Average same-calendar-window observations from previous years into "typical" weather. */
export function averageHistory(dates: string[], years: DailyForecast[][], now: number): Map<string, DayWeather> {
  // Index every observation by its date string.
  type Obs = { high: number; low: number; precip: number; code?: number };
  const obs = new Map<string, Obs>();
  for (const yearSet of years) {
    for (const daily of yearSet) {
      daily.time.forEach((t, i) => {
        const high = daily.temperature_2m_max[i];
        const low = daily.temperature_2m_min[i];
        if (high == null || low == null) return;
        obs.set(t, { high, low, precip: daily.precipitation_sum?.[i] ?? 0, code: daily.weather_code[i] ?? undefined });
      });
    }
  }
  const out = new Map<string, DayWeather>();
  for (const date of dates) {
    const samples: Obs[] = [];
    for (let k = 1; k <= years.length; k++) {
      for (let off = -HISTORY_WINDOW; off <= HISTORY_WINDOW; off++) {
        const o = obs.get(shiftYears(addDays(date, off), -k));
        if (o) samples.push(o);
      }
    }
    if (!samples.length) continue;
    const avg = (f: (s: Obs) => number) => samples.reduce((a, s) => a + f(s), 0) / samples.length;
    const code = mode(samples.map((s) => s.code).filter((c): c is number => c != null));
    out.set(date, {
      high: Math.round(avg((s) => s.high) * 10) / 10,
      low: Math.round(avg((s) => s.low) * 10) / 10,
      precipChance: Math.round((samples.filter((s) => s.precip >= RAINY_DAY_MM).length / samples.length) * 100),
      code,
      condition: `Typically ${describeCode(code).toLowerCase()}`,
      source: 'historical',
      fetchedAt: now,
    });
  }
  return out;
}

export async function resolveWeather(input: ResolveInput): Promise<ResolveResult> {
  const { lat, lon, dates, today, cached, fetchImpl, now = Date.now(), historyYears = 3 } = input;
  const fresh = new Map<string, DayWeather>();
  const errors: string[] = [];

  const forecastDates = dates.filter((d) => inForecastWindow(d, today));
  const historicalDates = dates.filter((d) => !inForecastWindow(d, today));

  if (forecastDates.length) {
    try {
      const daily = await fetchForecast(lat, lon, forecastDates[0], forecastDates[forecastDates.length - 1], fetchImpl);
      for (const [d, w] of forecastToWeather(daily, now)) if (forecastDates.includes(d)) fresh.set(d, w);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  if (historicalDates.length) {
    const start = addDays(historicalDates[0], -HISTORY_WINDOW);
    const end = addDays(historicalDates[historicalDates.length - 1], HISTORY_WINDOW);
    const results = await Promise.allSettled(
      Array.from({ length: historyYears }, (_, i) =>
        fetchArchive(lat, lon, shiftYears(start, -(i + 1)), shiftYears(end, -(i + 1)), fetchImpl),
      ),
    );
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) errors.push((failed.reason as Error).message);
    // Keep one slot per year (empty if that year failed) so year k lines up with shiftYears(-k).
    const perYear = results.map((r) => (r.status === 'fulfilled' ? [r.value] : []));
    for (const [d, w] of averageHistory(historicalDates, perYear, now)) fresh.set(d, w);
  }

  const days: ResolvedDay[] = dates.map((date) => {
    const live = fresh.get(date);
    if (live) return { date, weather: live, status: 'live' };
    const prev = cached[date];
    if (prev) return { date, weather: prev, status: 'cached' };
    return { date, status: 'missing' };
  });

  return { days, error: errors.length ? [...new Set(errors)].join('; ') : undefined };
}

/** How long a forecast is considered "live" before being labelled as cached. */
export const LIVE_TTL_MS = 3 * 60 * 60 * 1000;

export function weatherSourceLabel(w: DayWeather, online: boolean, now = Date.now()): string {
  if (w.source === 'manual') return 'Manual entry';
  const stale = !online || now - w.fetchedAt > LIVE_TTL_MS;
  if (w.source === 'historical') return stale ? 'Historical average (cached)' : 'Historical average';
  return stale ? 'Cached forecast' : 'Live forecast';
}
