/** POI / address search via Nominatim (nominatim.openstreetmap.org). */

export interface PhotonResult {
  /** Short display name, e.g. "Le Meurice". */
  name: string;
  /** Address without the name, e.g. "228 Rue de Rivoli, Paris, France". */
  address: string;
  /** Full label to save: "Le Meurice, 228 Rue de Rivoli, Paris, France". */
  label: string;
  lat: number;
  lon: number;
}

interface NominatimRow {
  lat: string;
  lon: string;
  display_name: string;
  name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

export async function searchPOI(
  query: string,
  near?: { lat: number; lon: number },
): Promise<PhotonResult[]> {
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: '6',
    addressdetails: '1',
    'accept-language': 'en',
    email: 'packwise@app.local',
  });
  // Bias results toward the trip destination without strictly bounding them
  if (near) {
    const d = 0.5; // ~55 km half-width
    params.set('viewbox', `${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`);
  }
  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const rows = (await res.json()) as NominatimRow[];

  return rows
    .map((row): PhotonResult | null => {
      const name = row.name || row.display_name.split(',')[0]?.trim() || '';
      if (!name) return null;
      const houseNum = row.address?.house_number;
      const road = row.address?.road;
      const street = [houseNum, road].filter(Boolean).join(' ');
      const city = row.address?.city ?? row.address?.town ?? row.address?.village ?? row.address?.municipality ?? '';
      const country = row.address?.country ?? '';
      const addressParts = [street || undefined, city || undefined, country || undefined].filter(Boolean) as string[];
      const address = addressParts.join(', ');
      const label = address ? `${name}, ${address}` : name;
      return { name, address, label, lat: parseFloat(row.lat), lon: parseFloat(row.lon) };
    })
    .filter((r): r is PhotonResult => r !== null && r.label !== '');
}

export interface AirportHit {
  code?: string;
  name: string;
  city: string;
  label: string;
  lat: number;
  lon: number;
}

interface AirportRow extends NominatimRow {
  class?: string;
  type?: string;
  extratags?: { iata?: string };
}

/** Airports (aerodromes with an IATA code or "airport" in the name) matching a query, via Nominatim. */
export async function searchAirportsOnline(query: string): Promise<AirportHit[]> {
  const params = new URLSearchParams({
    format: 'json',
    q: `${query} airport`,
    limit: '10',
    addressdetails: '1',
    extratags: '1',
    'accept-language': 'en',
    email: 'packwise@app.local',
  });
  let res: Response;
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const rows = (await res.json()) as AirportRow[];
  return rows
    .filter((r) => r.class === 'aeroway' && r.type === 'aerodrome')
    .map((r): AirportHit | null => {
      const name = r.name || r.display_name.split(',')[0]?.trim() || '';
      if (!name) return null;
      const code = r.extratags?.iata?.toUpperCase();
      const city = r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality ?? '';
      const label = `${code ? `${code} – ` : ''}${name}${city && !name.includes(city) ? `, ${city}` : ''}`;
      return { code, name, city, label, lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
    })
    .filter((r): r is AirportHit => r !== null);
}
