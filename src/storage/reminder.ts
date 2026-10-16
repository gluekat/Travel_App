import type { SyncStatus } from './types';

export const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * When the app can't keep a data file (or none is linked), nudge the user to
 * back up if they have changes that were never exported and the last export
 * is more than a week old (or never happened).
 */
export function shouldRemindBackup(opts: {
  status: SyncStatus;
  hasData: boolean;
  lastExportAt?: number;
  lastChangeAt?: number;
  dismissedUntil?: number;
  now: number;
}): boolean {
  const { status, hasData, lastExportAt = 0, lastChangeAt = 0, dismissedUntil = 0, now } = opts;
  if (status !== 'unsupported' && status !== 'unlinked') return false;
  if (!hasData || now < dismissedUntil) return false;
  return lastChangeAt > lastExportAt && now - lastExportAt > REMIND_AFTER_MS;
}
