import { describe, expect, it, vi } from 'vitest';
import type { DayWeather } from '../db/types';
import { ARCHIVE_URL, FORECAST_URL, GEOCODE_URL, geocode, type FetchLike } from './openMeteo';
import { averageHistory, inForecastWindow, resolveWeather, shiftYears, weatherSourceLabel } from './resolveWeather';
import { addDays, dateRange } from '../lib/dates';

const TODAY = '2026-10-05';
const NOW = Date.UTC(2026, 9, 5, 12);

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function dailyFor(url: string, values: { high: number; low: number; precip: number; code: number }) {
  const u = new URL(url);
  const dates = dateRange(u.searchParams.get('start_date')!, u.searchParams.get('end_date')!);
  return {
    daily: {
      time: dates,
      temperature_2m_max: dates.map(() => values.high),
      temperature_2m_min: dates.map(() => values.low),
      precipitation_probability_max: dates.map(() => values.precip),
      precipitation_sum: dates.map(() => values.precip),
      weather_code: dates.map(() => values.code),
    },
  };
}

/** Mock Open-Meteo: forecast = 20/10°C 70% rain, archive = 15/5°C with 2mm/day. */
function mockFetch(): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn((url: string) => {
    if (url.startsWith(FORECAST_URL)) return ok(dailyFor(url, { high: 20, low: 10, precip: 70, code: 61 }));
    if (url.startsWith(ARCHIVE_URL)) return ok(dailyFor(url, { high: 15, low: 5, precip: 2, code: 3 }));
    return Promise.reject(new Error(`unexpected ${url}`));
  }) as never;
}

const offlineFetch: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));

const cachedDay = (source: DayWeather['source']): DayWeather => ({
  high: 25,
  low: 18,
  precipChance: 10,
  condition: 'Clear',
  source,
  fetchedAt: NOW - 86_400_000,
});

describe('date helpers', () => {
  it('knows the 16-day forecast window', () => {
    expect(inForecastWindow(TODAY, TODAY)).toBe(true);
    expect(inForecastWindow(addDays(TODAY, 15), TODAY)).toBe(true);
    expect(inForecastWindow(addDays(TODAY, 16), TODAY)).toBe(false);
    expect(inForecastWindow(addDays(TODAY, -1), TODAY)).toBe(false);
  });

  it('shifts years, handling Feb 29', () => {
    expect(shiftYears('2028-02-29', -1)).toBe('2027-02-28');
    expect(shiftYears('2026-07-04', -3)).toBe('2023-07-04');
  });
});

describe('resolveWeather fallback chain', () => {
  it('1. uses the live forecast for dates within 16 days', async () => {
    const fetchImpl = mockFetch();
    const dates = dateRange('2026-10-08', '2026-10-12');
    const r = await resolveWeather({ lat: 38.7, lon: -9.1, dates, today: TODAY, cached: {}, fetchImpl, now: NOW });
    expect(r.error).toBeUndefined();
    expect(r.days).toHaveLength(5);
    for (const d of r.days) {
      expect(d.status).toBe('live');
      expect(d.weather).toMatchObject({ high: 20, low: 10, precipChance: 70, source: 'forecast', fetchedAt: NOW, condition: 'Light rain' });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('2. uses historical averages beyond the forecast window', async () => {
    const fetchImpl = mockFetch();
    const dates = dateRange('2026-12-20', '2026-12-22');
    const r = await resolveWeather({ lat: 1, lon: 2, dates, today: TODAY, cached: {}, fetchImpl, now: NOW });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // previous 3 years
    const urls = fetchImpl.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(urls.every((u: string) => u.startsWith(ARCHIVE_URL))).toBe(true);
    expect(urls.some((u: string) => u.includes('start_date=2025-12-17'))).toBe(true);
    for (const d of r.days) {
      expect(d.status).toBe('live');
      expect(d.weather).toMatchObject({ high: 15, low: 5, precipChance: 100, source: 'historical' });
    }
  });

  it('splits a trip that straddles the forecast window', async () => {
    const fetchImpl = mockFetch();
    const dates = dateRange(addDays(TODAY, 14), addDays(TODAY, 17));
    const r = await resolveWeather({ lat: 1, lon: 2, dates, today: TODAY, cached: {}, fetchImpl, now: NOW });
    expect(r.days.map((d) => d.weather?.source)).toEqual(['forecast', 'forecast', 'historical', 'historical']);
  });

  it('3. falls back to cached weather when the network fails', async () => {
    const dates = ['2026-10-08', '2026-10-09'];
    const r = await resolveWeather({
      lat: 1,
      lon: 2,
      dates,
      today: TODAY,
      cached: { '2026-10-08': cachedDay('forecast') },
      fetchImpl: offlineFetch,
      now: NOW,
    });
    expect(r.error).toMatch(/Network unavailable/);
    expect(r.days[0]).toMatchObject({ status: 'cached', weather: { high: 25, source: 'forecast' } });
    // 4. no cache, so the UI must ask for manual entry
    expect(r.days[1]).toEqual({ date: '2026-10-09', status: 'missing' });
  });

  it('keeps manual entries as cache when offline', async () => {
    const r = await resolveWeather({
      lat: 1,
      lon: 2,
      dates: ['2026-10-08'],
      today: TODAY,
      cached: { '2026-10-08': cachedDay('manual') },
      fetchImpl: offlineFetch,
      now: NOW,
    });
    expect(r.days[0]).toMatchObject({ status: 'cached', weather: { source: 'manual' } });
  });

  it('treats HTTP errors like network failures', async () => {
    const fetchImpl: FetchLike = () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
    const r = await resolveWeather({ lat: 1, lon: 2, dates: ['2026-10-08'], today: TODAY, cached: {}, fetchImpl, now: NOW });
    expect(r.error).toMatch(/HTTP 503/);
    expect(r.days[0].status).toBe('missing');
  });

  it('only sends coordinates and dates to the weather API', async () => {
    const fetchImpl = mockFetch();
    await resolveWeather({ lat: 38.72, lon: -9.14, dates: ['2026-10-08'], today: TODAY, cached: {}, fetchImpl, now: NOW });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect([...url.searchParams.keys()].sort()).toEqual(['daily', 'end_date', 'latitude', 'longitude', 'start_date', 'timezone']);
  });
});

describe('averageHistory', () => {
  it('computes rain chance as the share of rainy days', () => {
    const daily = {
      time: ['2025-07-01', '2025-07-02'],
      temperature_2m_max: [30, 20],
      temperature_2m_min: [20, 10],
      precipitation_sum: [0, 5],
      weather_code: [0, 61],
    };
    const w = averageHistory(['2026-07-01'], [[daily]], NOW).get('2026-07-01')!;
    expect(w).toMatchObject({ high: 25, low: 15, precipChance: 50, source: 'historical' });
  });
});

describe('weatherSourceLabel', () => {
  const fresh = { ...cachedDay('forecast'), fetchedAt: NOW - 60_000 };
  it('labels each source', () => {
    expect(weatherSourceLabel(fresh, true, NOW)).toBe('Live forecast');
    expect(weatherSourceLabel(fresh, false, NOW)).toBe('Cached forecast');
    expect(weatherSourceLabel(cachedDay('forecast'), true, NOW)).toBe('Cached forecast');
    expect(weatherSourceLabel({ ...fresh, source: 'historical' }, true, NOW)).toBe('Historical average');
    expect(weatherSourceLabel(cachedDay('manual'), false, NOW)).toBe('Manual entry');
  });
});

describe('geocode', () => {
  it('sends only the destination name and maps results', async () => {
    const fetchImpl = vi.fn(() =>
      ok({ results: [{ name: 'Lisbon', latitude: 38.72, longitude: -9.14, country: 'Portugal', admin1: 'Lisbon', timezone: 'Europe/Lisbon' }] }),
    );
    const r = await geocode('Lisbon', fetchImpl as never);
    expect(r[0]).toEqual({ name: 'Lisbon', label: 'Lisbon, Portugal', lat: 38.72, lon: -9.14, timezone: 'Europe/Lisbon' });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe(GEOCODE_URL);
    expect(url.searchParams.get('name')).toBe('Lisbon');
  });
});
