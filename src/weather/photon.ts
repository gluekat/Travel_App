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

export async function searchPOI(query: string): Promise<PhotonResult[]> {
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: '6',
    addressdetails: '1',
    'accept-language': 'en',
    email: 'packwise@app.local',
  });
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
