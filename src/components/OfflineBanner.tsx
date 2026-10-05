import { useOnline } from '../lib/hooks';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="no-print bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
      You're offline. Your saved data and cached weather are still available; live weather updates are paused.
    </div>
  );
}
