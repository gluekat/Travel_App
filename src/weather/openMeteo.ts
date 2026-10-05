/**
 * Open-Meteo client. These are the ONLY outbound network requests PackWise makes.
 * Only a place name (geocoding) or coordinates + date range (weather) are sent.
 */

export type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/** Forecast endpoint covers today plus 15 days. */
export const FORECAST_DAYS = 16;

export interface Place {
  name: string;
  label: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export class NetworkError extends Error {}

const defaultFetch: FetchLike = (url) => fetch(url);

async function getJson<T>(url: string, fetchImpl: FetchLike): Promise<T> {
  let res;
  try {
    res = await fetchImpl(url);
  } catch (e) {
    throw new NetworkError(`Network unavailable (${(e as Error).message})`);
  }
  if (!res.ok) throw new NetworkError(`Weather service returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function geocode(query: string, fetchImpl: FetchLike = defaultFetch): Promise<Place[]> {
  const params = new URLSearchParams({ name: query.trim(), count: '5', language: 'en', format: 'json' });
  const data = await getJson<{
    results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string }[];
  }>(`${GEOCODE_URL}?${params}`, fetchImpl);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    label: [r.name, r.admin1, r.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
  }));
}

export interface DailyForecast {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  precipitation_sum?: (number | null)[];
  weather_code: (number | null)[];
}

export async function fetchForecast(lat: number, lon: number, start: string, end: string, fetchImpl: FetchLike = defaultFetch) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  return (await getJson<{ daily: DailyForecast }>(`${FORECAST_URL}?${params}`, fetchImpl)).daily;
}

export async function fetchArchive(lat: number, lon: number, start: string, end: string, fetchImpl: FetchLike = defaultFetch) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  return (await getJson<{ daily: DailyForecast }>(`${ARCHIVE_URL}?${params}`, fetchImpl)).daily;
}
