import { db, setSetting, TABLE_NAMES, type TableName } from './schema';

export const BACKUP_APP = 'packwise';
export const BACKUP_VERSION = 1;

interface EncodedBlob {
  __blob: true;
  type: string;
  data: string; // base64
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

function isEncodedBlob(v: unknown): v is EncodedBlob {
  return typeof v === 'object' && v !== null && (v as EncodedBlob).__blob === true;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function encodeRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Blob ? ({ __blob: true, type: v.type, data: await blobToBase64(v) } satisfies EncodedBlob) : v;
  }
  return out;
}

function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = isEncodedBlob(v) ? base64ToBlob(v.data, v.type) : v;
  }
  return out;
}

/** Serialize the whole database (including photos) to a plain object. */
export async function exportDatabase(): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLE_NAMES) {
    const rows = (await db.table(name).toArray()) as Record<string, unknown>[];
    tables[name] = await Promise.all(rows.map(encodeRow));
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(data: unknown): asserts data is BackupFile {
  const d = data as Partial<BackupFile> | null;
  if (!d || d.app !== BACKUP_APP || typeof d.tables !== 'object' || d.tables === null) {
    throw new Error('This file is not a PackWise backup.');
  }
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of PackWise.');
  }
  for (const name of TABLE_NAMES) {
    const rows = (d.tables as Record<string, unknown>)[name];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Backup table "${name}" is malformed.`);
  }
}

/** Replace all local data with the contents of a backup. */
export async function importDatabase(data: unknown): Promise<void> {
  validateBackup(data);
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name);
      await table.clear();
      const rows = (data.tables[name] ?? []) as Record<string, unknown>[];
      if (rows.length) await table.bulkAdd(rows.map(decodeRow));
    }
  });
}

/** Export and trigger a browser download of the backup JSON. */
export async function downloadBackup(): Promise<void> {
  const backup = await exportDatabase();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `packwise-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await setSetting('lastExportAt', Date.now());
}

export async function importBackupFile(file: File): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Could not read the file as JSON.');
  }
  await importDatabase(parsed);
}
