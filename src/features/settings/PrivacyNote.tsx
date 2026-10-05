export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-slate-500">
        🔒 Everything stays on this device. Only the destination name/coordinates and trip dates are sent to Open-Meteo for weather.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>
        <strong>Your data never leaves this device.</strong> PackWise has no accounts, no servers, no analytics and no cloud storage. Your
        closet, photos, trips and packing lists live in this browser's local database (IndexedDB).
      </p>
      <p>The only network requests the app makes are to the free Open-Meteo APIs:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>geocoding-api.open-meteo.com</code> receives the destination name you type, to find its coordinates.
        </li>
        <li>
          <code>api.open-meteo.com</code> and <code>archive-api.open-meteo.com</code> receive those coordinates and your trip's date
          range, to get the forecast or historical averages.
        </li>
      </ul>
      <p>Closet items, photos, activities and packing lists are never sent anywhere.</p>
    </div>
  );
}
