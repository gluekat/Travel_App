import { useSyncExternalStore } from 'react';
import { getSyncState, subscribeSync } from './fileSync';
import type { SyncState } from './types';

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}
