import Dexie, { type EntityTable } from 'dexie';
import { STORAGE_SUFFIX } from '../lib/channel';

/**
 * Small separate database for sync bookkeeping (the linked file handle,
 * timestamps). It is never exported, so a file handle never ends up in a backup.
 */
interface KV {
  key: string;
  value: unknown;
}

class MetaDB extends Dexie {
  kv!: EntityTable<KV, 'key'>;
  constructor() {
    super(`packwise-meta${STORAGE_SUFFIX}`);
    this.version(1).stores({ kv: 'key' });
  }
}

export const metaDb = new MetaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await metaDb.kv.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await metaDb.kv.put({ key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  await metaDb.kv.delete(key);
}
