/** Minimal typings for the File System Access API (Chromium only; not in lib.dom yet). */
export interface FsaFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

export interface FsaWindow {
  showSaveFilePicker?: (opts: { suggestedName?: string; types?: PickerType[]; startIn?: string }) => Promise<FsaFileHandle>;
  showOpenFilePicker?: (opts: { types?: PickerType[]; multiple?: boolean; startIn?: string }) => Promise<FsaFileHandle[]>;
}

/** Where the data file lives: a browser-linked file or the desktop app's Documents folder. */
export interface DataFileAdapter {
  kind: 'browser-file' | 'desktop';
  /** Human-readable location, e.g. "packwise-data.json" or a full path. */
  location: string;
  /** File contents, or null if the file doesn't exist yet. */
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

export type SyncStatus =
  | 'starting'
  /** No way to keep a file in this browser (Safari, Firefox, phones). */
  | 'unsupported'
  /** Supported, but no data file chosen yet. */
  | 'unlinked'
  /** A file was linked before, but the browser needs a click to allow access again. */
  | 'needs-permission'
  /** The file and this browser both changed while disconnected. */
  | 'conflict'
  | 'saving'
  | 'synced'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  location?: string;
  adapterKind?: DataFileAdapter['kind'];
  lastSavedAt?: number;
  error?: string;
}
