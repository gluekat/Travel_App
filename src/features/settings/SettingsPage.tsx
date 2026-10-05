import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../../db/schema';
import { downloadBackup, importBackupFile } from '../../db/backup';
import { requestPersistentStorage, storageEstimate, type PersistStatus } from '../../db/persist';
import { formatTimestamp } from '../../lib/dates';
import { useTempUnit } from '../../lib/hooks';
import { Banner, Button, Card, Chip } from '../../components/ui';
import { PrivacyNote } from './PrivacyNote';

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SettingsPage() {
  const unit = useTempUnit();
  const lastExportAt = useLiveQuery(async () => (await db.settings.get('lastExportAt'))?.value as number | undefined, []);
  const [persist, setPersist] = useState<PersistStatus>();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestPersistentStorage().then(setPersist);
    storageEstimate().then(setUsage);
  }, []);

  async function doExport() {
    setBusy(true);
    try {
      await downloadBackup();
      setMessage({ tone: 'info', text: 'Backup downloaded. Keep it somewhere safe.' });
    } catch (e) {
      setMessage({ tone: 'error', text: `Export failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file?: File) {
    if (!file) return;
    if (!confirm('Importing replaces ALL current PackWise data on this device with the backup. Continue?')) return;
    setBusy(true);
    try {
      await importBackupFile(file);
      setMessage({ tone: 'info', text: 'Backup restored.' });
    } catch (e) {
      setMessage({ tone: 'error', text: `Import failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings & data</h1>

      <Card>
        <h2 className="mb-2 font-semibold">Backup & restore</h2>
        <Banner tone="warn">
          Your closet lives only in this browser. Clearing browser data or uninstalling the app <strong>deletes it</strong> unless you have
          exported a backup.
        </Banner>
        <p className="mt-3 text-sm text-slate-600">
          Last export: {lastExportAt ? formatTimestamp(lastExportAt) : <strong>never</strong>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={doExport} disabled={busy}>
            Export everything (JSON)
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            Import backup…
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} data-testid="import-file" />
        </div>
        {message && (
          <div className="mt-3">
            <Banner tone={message.tone}>{message.text}</Banner>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Persistent storage:{' '}
          {persist === 'granted' ? '✅ granted (the browser will not evict your data)' : persist === 'denied' ? '⚠️ not granted. Export regularly.' : persist === 'unsupported' ? 'not supported by this browser' : '…'}
          {usage && ` · Using ${formatBytes(usage.usage)}`}
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Temperature unit</h2>
        <div className="flex gap-1.5">
          {(['F', 'C'] as const).map((u) => (
            <Chip key={u} active={unit === u} onClick={() => setSetting('tempUnit', u)}>
              °{u}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Privacy</h2>
        <PrivacyNote />
      </Card>
    </div>
  );
}
