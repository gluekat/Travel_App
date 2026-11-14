export interface NominatimResult {
  label: string;
  lat: number;
  lon: number;
}

/** Search for a place or address using the Nominatim geocoding API (OpenStreetMap). */
export async function searchAddress(query: string): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=0`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'PackWise-Travel-App/1.0' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((item) => ({
    label: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}
