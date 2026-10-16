import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { downloadBackup } from '../db/backup';
import { createDataFile, fileAccessSupported, reconnectDataFile, resolveConflict } from '../storage/fileSync';
import { getMeta, setMeta } from '../storage/meta';
import { shouldRemindBackup } from '../storage/reminder';
import { useSyncState } from '../storage/useSync';
import { runFileAction } from '../features/settings/DataFilePanel';
import { Button } from './ui';

const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/** App-wide notices about where data is saved: reconnect, conflicts, and backup reminders. */
export function SyncBanner() {
  const sync = useSyncState();
  const [error, setError] = useState<string>();
  const act = (fn: () => Promise<void>) => runFileAction(fn, setError);
  const info = useLiveQuery(async () => {
    const [own, trips, saved, lastExport] = await Promise.all([
      db.closetItems.filter((i) => !i.isSample).count(),
      db.trips.count(),
      db.savedOutfits.count(),
      db.settings.get('lastExportAt'),
    ]);
    return { hasData: own + trips + saved > 0, lastExportAt: lastExport?.value as number | undefined };
  }, []);
  const meta = useLiveQuery(async () => ({
    lastChangeAt: await getMeta<number>('lastChangeAt'),
    dismissedUntil: await getMeta<number>('reminderDismissedUntil'),
  }));

  const wrap = (children: ReactNode, tone = 'bg-amber-50 text-amber-900 border-amber-200') => (
    <div role="status" className={`no-print border-b px-4 py-2 text-sm ${tone}`}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">{children}</div>
      {error && <p className="mx-auto max-w-5xl text-xs text-red-700">{error}</p>}
    </div>
  );

  if (sync.status === 'needs-permission') {
    return wrap(
      <>
        <span className="flex-1">💾 Reconnect to your data file <code>{sync.location}</code> to keep saving changes to it.</span>
        <Button variant="primary" onClick={() => act(reconnectDataFile)}>
          Reconnect
        </Button>
      </>,
    );
  }
  if (sync.status === 'conflict') {
    return wrap(
      <>
        <span className="flex-1">⚠️ Your data file and this browser both have changes. Which should PackWise keep?</span>
        <Button onClick={() => act(() => resolveConflict('file'))}>Use the file</Button>
        <Button onClick={() => act(() => resolveConflict('browser'))}>Keep this browser's data</Button>
      </>,
    );
  }
  if (sync.status === 'error') {
    return wrap(
      <>
        <span className="flex-1">⚠️ {sync.error}</span>
        <a className="font-medium underline" href="#/settings">
          Fix in Data & privacy
        </a>
      </>,
      'bg-red-50 text-red-900 border-red-200',
    );
  }

  if (
    info &&
    meta &&
    shouldRemindBackup({ status: sync.status, hasData: info.hasData, lastExportAt: info.lastExportAt, lastChangeAt: meta.lastChangeAt, dismissedUntil: meta.dismissedUntil, now: Date.now() })
  ) {
    return wrap(
      <>
        <span className="flex-1">
          💾 Your PackWise data is only stored in this browser. {fileAccessSupported() ? 'Link a data file or back up' : 'Back up'} so clearing browser
          data can't erase it.
        </span>
        {fileAccessSupported() && (
          <Button variant="primary" onClick={() => act(createDataFile)}>
            Link a data file
          </Button>
        )}
        <Button variant={fileAccessSupported() ? 'secondary' : 'primary'} onClick={() => act(async () => void (await downloadBackup()))}>
          Save a backup
        </Button>
        <Button variant="ghost" onClick={() => setMeta('reminderDismissedUntil', Date.now() + SNOOZE_MS)}>
          Later
        </Button>
      </>,
      'bg-sky-50 text-sky-900 border-sky-200',
    );
  }
  return null;
}
