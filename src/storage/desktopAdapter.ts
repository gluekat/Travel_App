/**
 * Data file for the PackWise desktop app (Tauri): Documents/PackWise/packwise-data.json.
 * No picker or permission prompts needed; the app may only touch that folder
 * (see src-tauri/capabilities/default.json). On mobile builds, where there is
 * no Documents folder, it falls back to the app's private data folder.
 */
import { appDataDir, documentDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { DATA_FILE_NAME } from './fileSync';
import type { DataFileAdapter } from './types';

async function dataFolder(): Promise<string> {
  try {
    return await join(await documentDir(), 'PackWise');
  } catch {
    return appDataDir();
  }
}

export async function desktopAdapter(): Promise<DataFileAdapter> {
  const folder = await dataFolder();
  if (!(await exists(folder))) await mkdir(folder, { recursive: true });
  const file = await join(folder, DATA_FILE_NAME);
  const tmp = `${file}.tmp`;
  return {
    kind: 'desktop',
    location: file,
    async read() {
      return (await exists(file)) ? readTextFile(file) : null;
    },
    async write(text) {
      // Write to a temp file and rename, so a crash mid-save never leaves a half-written file.
      await writeTextFile(tmp, text);
      await rename(tmp, file);
    },
  };
}
