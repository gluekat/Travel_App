/**
 * Keeps a copy of the whole database in a file on the user's own disk, so
 * clearing browser data doesn't lose anything. IndexedDB stays the working
 * store; every change is written to the file (debounced), and the file is
 * read back when the app is reconnected to it.
 *
 * The file uses the same JSON format as Export, so it is also a backup that
 * Import can restore. Nothing leaves the machine.
 */
import Dexie from 'dexie';
import { db } from '../db/schema';
import { exportDatabase, importDatabase, validateBackup } from '../db/backup';
import { deleteMeta, getMeta, setMeta } from './meta';
import { STORAGE_SUFFIX } from '../lib/channel';
import type { DataFileAdapter, FsaFileHandle, FsaWindow, SyncState } from './types';

export const DATA_FILE_NAME = `packwise${STORAGE_SUFFIX}-data.json`;
const WRITE_DELAY_MS = 1500;
const PICKER_TYPES = [{ description: 'PackWise data', accept: { 'application/json': ['.json'] } }];

// ---------------------------------------------------------------------------
// Pure decision logic (unit tested)

export type ReconcileAction = 'write-local' | 'load-file' | 'conflict';

/**
 * Decide what to do when (re)connecting to a data file.
 * - empty/new file → write this browser's data into it
 * - this browser has no data of its own (e.g. after clearing) → load the file
 * - only the file changed since the last sync → load the file
 * - only this browser changed → write
 * - both changed, or never synced and both have data → ask the user
 */
export function decideReconcile(opts: {
  fileSavedAt?: number;
  lastSyncedAt?: number;
  lastChangeAt?: number;
  localHasData: boolean;
}): ReconcileAction {
  const { fileSavedAt, lastSyncedAt, lastChangeAt, localHasData } = opts;
  if (fileSavedAt == null) return 'write-local';
  if (!localHasData) return 'load-file';
  if (lastSyncedAt == null) return 'conflict';
  const fileChanged = fileSavedAt > lastSyncedAt;
  const localChanged = (lastChangeAt ?? 0) > lastSyncedAt;
  if (fileChanged && localChanged) return 'conflict';
  if (fileChanged) return 'load-file';
  return 'write-local';
}

/** Parse a data file; returns undefined for an empty or unreadable file. */
export function parseDataFile(text: string | null): { data: unknown; savedAt: number } | undefined {
  if (!text?.trim()) return undefined;
  try {
    const data = JSON.parse(text) as { exportedAt?: string };
    validateBackup(data);
    return { data, savedAt: Date.parse(data.exportedAt ?? '') || 0 };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// State store

let state: SyncState = { status: 'starting' };
const listeners = new Set<() => void>();
let adapter: DataFileAdapter | undefined;
let pendingFile: { data: unknown; savedAt: number } | undefined;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
let writing: Promise<void> | undefined;
let suppressUntil = 0;

function setState(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function fileAccessSupported(): boolean {
  const w = globalThis as unknown as FsaWindow;
  return typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
}

// ---------------------------------------------------------------------------
// Adapters

export function browserFileAdapter(handle: FsaFileHandle): DataFileAdapter {
  return {
    kind: 'browser-file',
    location: handle.name,
    async read() {
      const file = await handle.getFile();
      return file.size ? await file.text() : null;
    },
    async write(text) {
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Sync engine

async function localHasData(): Promise<boolean> {
  const [own, trips, saved] = await Promise.all([
    db.closetItems.filter((i) => !i.isSample).count(),
    db.trips.count(),
    db.savedOutfits.count(),
  ]);
  return own + trips + saved > 0;
}

async function writeNow(): Promise<void> {
  if (!adapter) return;
  const a = adapter;
  setState({ status: 'saving' });
  try {
    const backup = await exportDatabase();
    await a.write(JSON.stringify(backup));
    const savedAt = Date.parse(backup.exportedAt);
    await setMeta('lastSyncedAt', savedAt);
    setState({ status: 'synced', lastSavedAt: savedAt, error: undefined });
  } catch (e) {
    setState({ status: 'error', error: `Couldn't save to ${a.location}: ${(e as Error).message}` });
  }
}

function scheduleWrite(delay = WRITE_DELAY_MS) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    writing = (writing ?? Promise.resolve()).then(writeNow);
  }, delay);
}

/** Write any pending change immediately (e.g. when the page is hidden). */
export async function flushSync(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = undefined;
    writing = (writing ?? Promise.resolve()).then(writeNow);
  }
  await writing;
}

async function loadFile(file: { data: unknown; savedAt: number }) {
  suppressUntil = Date.now() + 2000;
  await importDatabase(file.data);
  await setMeta('lastSyncedAt', file.savedAt);
  await setMeta('lastChangeAt', file.savedAt);
  setState({ status: 'synced', lastSavedAt: file.savedAt, error: undefined });
}

/** Connect to an adapter and bring the file and this browser into agreement. */
export async function connect(a: DataFileAdapter): Promise<void> {
  adapter = a;
  setState({ location: a.location, adapterKind: a.kind });
  try {
    const file = parseDataFile(await a.read());
    const action = decideReconcile({
      fileSavedAt: file?.savedAt,
      lastSyncedAt: await getMeta<number>('lastSyncedAt'),
      lastChangeAt: await getMeta<number>('lastChangeAt'),
      localHasData: await localHasData(),
    });
    if (action === 'load-file') await loadFile(file!);
    else if (action === 'write-local') await writeNow();
    else {
      pendingFile = file;
      setState({ status: 'conflict' });
    }
  } catch (e) {
    setState({ status: 'error', error: `Couldn't read ${a.location}: ${(e as Error).message}` });
  }
}

/** Resolve a conflict by keeping the file's data or this browser's data. */
export async function resolveConflict(keep: 'file' | 'browser'): Promise<void> {
  if (state.status !== 'conflict') return;
  if (keep === 'file' && pendingFile) await loadFile(pendingFile);
  else await writeNow();
  pendingFile = undefined;
}

function onMutation(parts: Record<string, unknown>) {
  // Only our main database counts (not the meta db or other apps on this origin).
  if (!Object.keys(parts).some((k) => k.startsWith(`idb://${db.name}/`))) return;
  if (Date.now() < suppressUntil) return;
  void setMeta('lastChangeAt', Date.now());
  if (adapter && (state.status === 'synced' || state.status === 'saving' || state.status === 'error')) scheduleWrite();
}

let tracking = false;

/** Listen for database changes (to save them, and to know what's unsaved). */
export function startChangeTracking() {
  if (tracking) return;
  tracking = true;
  Dexie.on('storagemutated', onMutation);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSync();
    });
  }
}

let started = false;

/** Start syncing. `desktop` is the desktop app's adapter when running there. */
export async function initSync(desktop?: DataFileAdapter): Promise<void> {
  if (started) return;
  started = true;
  startChangeTracking();

  if (desktop) return connect(desktop);
  if (!fileAccessSupported()) return setState({ status: 'unsupported' });

  const handle = await getMeta<FsaFileHandle>('fileHandle');
  if (!handle) return setState({ status: 'unlinked' });
  setState({ location: handle.name, adapterKind: 'browser-file' });
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return connect(browserFileAdapter(handle));
  setState({ status: 'needs-permission' });
}

// --- User actions (must run from a click: the browser requires a gesture) ---

/** Create a new data file and save everything into it. */
export async function createDataFile(): Promise<void> {
  const w = window as unknown as FsaWindow;
  const handle = await w.showSaveFilePicker!({ suggestedName: DATA_FILE_NAME, types: PICKER_TYPES, startIn: 'documents' });
  await setMeta('fileHandle', handle);
  await deleteMeta('lastSyncedAt');
  adapter = browserFileAdapter(handle);
  setState({ location: handle.name, adapterKind: 'browser-file' });
  await writeNow();
}

/** Open an existing data file (e.g. after clearing browser data, or on another browser). */
export async function openDataFile(): Promise<void> {
  const w = window as unknown as FsaWindow;
  const [handle] = await w.showOpenFilePicker!({ types: PICKER_TYPES, startIn: 'documents' });
  await setMeta('fileHandle', handle);
  await connect(browserFileAdapter(handle));
}

/** Re-grant access to the previously linked file. */
export async function reconnectDataFile(): Promise<void> {
  const handle = await getMeta<FsaFileHandle>('fileHandle');
  if (!handle) return setState({ status: 'unlinked' });
  if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    return setState({ status: 'needs-permission', error: 'Permission was not granted.' });
  }
  await connect(browserFileAdapter(handle));
}

/** Stop saving to the file (the file itself is left untouched). */
export async function unlinkDataFile(): Promise<void> {
  if (writeTimer) clearTimeout(writeTimer);
  adapter = undefined;
  await deleteMeta('fileHandle');
  await deleteMeta('lastSyncedAt');
  setState({ status: fileAccessSupported() ? 'unlinked' : 'unsupported', location: undefined, lastSavedAt: undefined, error: undefined });
}

/** Test hook: reset module state. */
export function __resetSyncForTests() {
  state = { status: 'starting' };
  adapter = undefined;
  pendingFile = undefined;
  started = false;
  suppressUntil = 0;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = undefined;
  writing = undefined;
}
