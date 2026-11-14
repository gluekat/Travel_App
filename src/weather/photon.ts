/** Photon geocoder (photon.komoot.io) — supports POI and business name search. */

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

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export async function searchPOI(query: string): Promise<PhotonResult[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json()) as { features: PhotonFeature[] };

  return data.features
    .map((f) => {
      const p = f.properties;
      const name = p.name ?? '';
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const addressParts = [street || undefined, p.city, p.country].filter(Boolean) as string[];
      const address = addressParts.join(', ');
      const label = name ? (address ? `${name}, ${address}` : name) : address;
      return { name: name || address, address, label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    })
    .filter((r) => r.label);
}
