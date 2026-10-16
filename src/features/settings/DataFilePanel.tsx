import { useState } from 'react';
import { formatTimestamp } from '../../lib/dates';
import { createDataFile, openDataFile, reconnectDataFile, resolveConflict, unlinkDataFile } from '../../storage/fileSync';
import { useSyncState } from '../../storage/useSync';
import { Banner, Button, Card } from '../../components/ui';

/** Run a picker action, ignoring the user cancelling the dialog. */
export async function runFileAction(fn: () => Promise<void>, onError: (msg: string) => void) {
  try {
    await fn();
  } catch (e) {
    if ((e as Error).name !== 'AbortError') onError((e as Error).message);
  }
}

export function DataFilePanel() {
  const sync = useSyncState();
  const [error, setError] = useState<string>();
  const act = (fn: () => Promise<void>) => runFileAction(fn, setError);

  return (
    <Card>
      <h2 className="mb-2 font-semibold">Where your data is saved</h2>
      {sync.adapterKind === 'desktop' ? (
        <p className="text-sm text-slate-700">
          ✅ The PackWise desktop app saves everything automatically to <code className="break-all">{sync.location}</code>. Clearing browser data
          doesn't affect it.
        </p>
      ) : sync.status === 'unsupported' ? (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            This browser can't keep a linked data file, so your data lives only in this browser. <strong>Export a backup regularly</strong> (below).
            On a phone or tablet, the share sheet lets you save it to your Files app.
          </p>
          <p className="text-xs text-slate-500">
            For automatic saving to a file, use Chrome or Edge on a computer, or the PackWise desktop app.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-700">
            Link a <strong>data file</strong> on your computer (e.g. in Documents). PackWise saves every change to it automatically, so clearing
            browser data won't lose anything: just open the file again. The file stays on your disk and is also a full backup.
          </p>
          {sync.location && (
            <p className="text-slate-700">
              File: <code>{sync.location}</code>
              {sync.lastSavedAt ? ` · last saved ${formatTimestamp(sync.lastSavedAt)}` : ''}
              {sync.status === 'saving' && ' · saving…'}
            </p>
          )}
          {sync.status === 'synced' && <Banner tone="info">✅ Saving automatically to your data file.</Banner>}
          {sync.status === 'needs-permission' && (
            <Banner tone="warn">The browser needs your OK to use {sync.location} again. Click “Reconnect”.</Banner>
          )}
          {sync.status === 'conflict' && (
            <Banner tone="warn">
              The data file and this browser both have changes. Choose which to keep; the other is replaced.
              <span className="mt-2 flex flex-wrap gap-2">
                <Button onClick={() => act(() => resolveConflict('file'))}>Use the file's data</Button>
                <Button onClick={() => act(() => resolveConflict('browser'))}>Keep this browser's data</Button>
              </span>
            </Banner>
          )}
          {sync.status === 'error' && sync.error && <Banner tone="error">{sync.error}</Banner>}
          <div className="flex flex-wrap gap-2">
            {sync.status === 'needs-permission' && (
              <Button variant="primary" onClick={() => act(reconnectDataFile)}>
                Reconnect
              </Button>
            )}
            {(sync.status === 'unlinked' || sync.status === 'error') && (
              <Button variant="primary" onClick={() => act(createDataFile)}>
                Create data file…
              </Button>
            )}
            <Button onClick={() => act(openDataFile)}>Open existing data file…</Button>
            {sync.location && sync.status !== 'unlinked' && (
              <Button variant="ghost" onClick={() => confirm('Stop saving to this file? The file itself is kept.') && act(unlinkDataFile)}>
                Stop using file
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </Card>
  );
}
