import { useMemo, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { TempUnit } from '../db/types';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

// One object URL per Blob, created synchronously and revoked only when the Blob is garbage
// collected. Revoking on every re-render (live queries hand back a fresh Blob each time)
// left <img> elements pointing at revoked URLs, so photos blinked out after edits.
const objectUrls = new WeakMap<Blob, string>();
const urlReaper = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry<string>((u) => URL.revokeObjectURL(u)) : undefined;

/** Object URL for a Blob, stable across renders. */
export function useObjectUrl(blob?: Blob): string | undefined {
  return useMemo(() => {
    if (!blob) return undefined;
    let url = objectUrls.get(blob);
    if (!url) {
      url = URL.createObjectURL(blob);
      objectUrls.set(blob, url);
      urlReaper?.register(blob, url);
    }
    return url;
  }, [blob]);
}

export function useTempUnit(): TempUnit {
  return useLiveQuery(async () => ((await db.settings.get('tempUnit'))?.value as TempUnit) ?? 'F', [], 'F');
}
