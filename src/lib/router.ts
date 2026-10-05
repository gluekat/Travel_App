import { useSyncExternalStore } from 'react';

/** Minimal hash router: routes look like #/closet, #/trips/3, #/trips/3/packing. */
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}
