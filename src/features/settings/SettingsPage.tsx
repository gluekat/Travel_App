import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../../db/schema';
import { downloadBackup, importBackupFile, saveBackupAs } from '../../db/backup';
import { requestPersistentStorage, storageEstimate, type PersistStatus } from '../../db/persist';
import { formatTimestamp } from '../../lib/dates';
import { useTempUnit } from '../../lib/hooks';
import { Banner, Button, Card, Chip, inputClass, selectAllOnFocus } from '../../components/ui';
import { LocationInput } from '../../components/LocationInput';
import { PrivacyNote } from './PrivacyNote';
import { DataFilePanel } from './DataFilePanel';
import type { HomeLocation } from '../../db/types';

function HomeLocationCard() {
  const homeLocation = useLiveQuery(
    async () => {
      const row = await db.settings.get('homeLocation');
      return row ? (row.value as HomeLocation) : null;
    },
    [],
  );

  async function saveHome(label: string, lat?: number, lon?: number) {
    if (!label.trim() || lat === undefined || lon === undefined) return;
    await setSetting('homeLocation', { label: label.trim(), lat, lon });
  }

  async function clearHome() {
    await db.settings.delete('homeLocation');
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">Home location</h2>
      <p className="mb-3 text-sm text-slate-600">Pre-fills outbound and return transport from/to your home address.</p>
      {homeLocation === undefined && <p className="text-sm text-slate-400">Loading…</p>}
      {homeLocation !== undefined && (
        <>
          {homeLocation && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-slate-700">📍 {homeLocation.label}</span>
              <button
                type="button"
                onClick={() => void clearHome()}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            </div>
          )}
          <LocationInput
            value={homeLocation?.label ?? ''}
            onChange={(label, lat, lon) => void saveHome(label, lat, lon)}
            placeholder="Search for your home address or city…"
          />
          <p className="mt-1.5 text-xs text-slate-400">Pick a result from the dropdown to save.</p>
        </>
      )}
    </Card>
  );
}

function HomeAirportCard() {
  // null = loaded with no value; undefined = still loading
  const stored = useLiveQuery(async () => {
    const row = await db.settings.get('homeAirport');
    return row ? (row.value as string) : null;
  }, []);

  async function save(val: string) {
    const trimmed = val.trim().toUpperCase();
    if (trimmed) await setSetting('homeAirport', trimmed);
    else await db.settings.delete('homeAirport');
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">Home airport</h2>
      <p className="mb-3 text-sm text-slate-600">Pre-fills outbound and return flight departures.</p>
      {stored === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {stored && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-slate-700">✈️ {stored}</span>
              <button
                type="button"
                onClick={() => void save('')}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            </div>
          )}
          <input
            key={stored ?? 'empty'}
            type="text"
            className={`${inputClass} w-32 uppercase`}
            defaultValue={stored ?? ''}
            placeholder="e.g. LAX"
            maxLength={5}
            {...selectAllOnFocus}
            onBlur={(e) => void save(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <p className="mt-1.5 text-xs text-slate-400">3-letter IATA code. Press Enter or click away to save.</p>
        </>
      )}
    </Card>
  );
}

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
  const [hasSaveAs] = useState(() => typeof window !== 'undefined' && 'showSaveFilePicker' in window);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestPersistentStorage().then(setPersist);
    storageEstimate().then(setUsage);
  }, []);

  async function doExport() {
    setBusy(true);
    try {
      const how = await downloadBackup();
      setMessage({ tone: 'info', text: how === 'shared' ? 'Backup shared. Save it somewhere safe, e.g. your Files app.' : 'Backup downloaded. Keep it somewhere safe.' });
    } catch (e) {
      setMessage({ tone: 'error', text: `Export failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function doSaveAs() {
    setBusy(true);
    try {
      const saved = await saveBackupAs();
      if (saved) setMessage({ tone: 'info', text: 'Backup saved. You can overwrite the same file next time.' });
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

      <DataFilePanel />

      <Card>
        <h2 className="mb-2 font-semibold">Backup & restore</h2>
        <Banner tone="warn">
          Without a linked data file, your closet lives only in this browser: clearing browser data or uninstalling the app <strong>deletes it</strong>{' '}
          unless you have a backup.
        </Banner>
        <p className="mt-3 text-sm text-slate-600">
          Last export: {lastExportAt ? formatTimestamp(lastExportAt) : <strong>never</strong>}
        </p>
        <p className="mt-3 text-sm text-slate-600">
          <strong>Tip:</strong> For automatic backup, link a data file above — it updates within seconds of every change.
          The manual export below creates a one-time snapshot you can keep anywhere.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {hasSaveAs ? (
            <Button variant="primary" onClick={doSaveAs} disabled={busy}>
              Save backup as… (JSON)
            </Button>
          ) : (
            <Button variant="primary" onClick={doExport} disabled={busy}>
              Export backup (JSON)
            </Button>
          )}
          {hasSaveAs && (
            <Button onClick={doExport} disabled={busy}>
              Download (auto-named)
            </Button>
          )}
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

      <HomeLocationCard />

      <HomeAirportCard />

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
