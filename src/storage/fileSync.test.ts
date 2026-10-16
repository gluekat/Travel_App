// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { seedSampleWardrobe } from '../db/seed';
import { createTrip } from '../features/trips/tripService';
import { __resetSyncForTests, connect, decideReconcile, flushSync, getSyncState, parseDataFile, resolveConflict, startChangeTracking } from './fileSync';
import { metaDb } from './meta';
import { REMIND_AFTER_MS, shouldRemindBackup } from './reminder';
import type { DataFileAdapter } from './types';

/** An in-memory stand-in for a file on disk. */
function memoryFile(initial: string | null = null): DataFileAdapter & { text: string | null; writes: number } {
  return {
    kind: 'browser-file',
    location: 'packwise-data.json',
    text: initial,
    writes: 0,
    async read() {
      return this.text;
    },
    async write(t: string) {
      this.text = t;
      this.writes++;
    },
  };
}

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

async function clearAll() {
  await Promise.all([...db.tables.map((t) => t.clear()), metaDb.kv.clear()]);
}

beforeEach(async () => {
  __resetSyncForTests();
  await clearAll();
  await tick();
});

describe('decideReconcile', () => {
  const T = 1_000_000;
  it.each([
    ['new empty file', { localHasData: true }, 'write-local'],
    ['browser was cleared', { fileSavedAt: T, localHasData: false }, 'load-file'],
    ['never synced, both have data', { fileSavedAt: T, localHasData: true }, 'conflict'],
    ['only the file changed', { fileSavedAt: T + 10, lastSyncedAt: T, lastChangeAt: T, localHasData: true }, 'load-file'],
    ['only the browser changed', { fileSavedAt: T, lastSyncedAt: T, lastChangeAt: T + 10, localHasData: true }, 'write-local'],
    ['both changed', { fileSavedAt: T + 5, lastSyncedAt: T, lastChangeAt: T + 10, localHasData: true }, 'conflict'],
    ['nothing changed', { fileSavedAt: T, lastSyncedAt: T, lastChangeAt: T, localHasData: true }, 'write-local'],
  ] as const)('%s', (_name, opts, expected) => {
    expect(decideReconcile(opts)).toBe(expected);
  });
});

describe('parseDataFile', () => {
  it('rejects empty and foreign files', () => {
    expect(parseDataFile(null)).toBeUndefined();
    expect(parseDataFile('')).toBeUndefined();
    expect(parseDataFile('{"hello":1}')).toBeUndefined();
    expect(parseDataFile('not json')).toBeUndefined();
  });
  it('reads the saved time', () => {
    const f = parseDataFile(JSON.stringify({ app: 'packwise', version: 3, exportedAt: '2026-10-16T12:00:00.000Z', tables: {} }));
    expect(f?.savedAt).toBe(Date.parse('2026-10-16T12:00:00.000Z'));
  });
});

describe('data file sync', () => {
  it('survives clearing browser data', async () => {
    startChangeTracking();
    await seedSampleWardrobe();
    await createTrip('Lisbon', undefined, '2026-11-01', '2026-11-03');
    const file = memoryFile();

    await connect(file); // empty file: this browser's data is written to it
    expect(getSyncState().status).toBe('synced');
    expect(JSON.parse(file.text!).tables.trips).toHaveLength(1);

    // Later changes are saved automatically.
    await db.closetItems.add({ name: 'Rain boots', category: 'shoes', color: '', warmth: 2, formality: 'casual', weatherTags: ['rain-ready'], activities: [], quantity: 1, wearCount: 10, favorite: 3, customTags: [], isSample: false, createdAt: 1, updatedAt: 1 });
    await tick();
    await flushSync();
    expect(JSON.parse(file.text!).tables.closetItems.map((i: { name: string }) => i.name)).toContain('Rain boots');

    // "Clear browser data": both databases are wiped.
    __resetSyncForTests();
    await clearAll();
    await tick();
    expect(await db.trips.count()).toBe(0);

    await connect(file); // reopening the file restores everything
    expect(getSyncState().status).toBe('synced');
    expect(await db.trips.count()).toBe(1);
    expect((await db.closetItems.toArray()).map((i) => i.name)).toContain('Rain boots');
  });

  it('asks before overwriting when both sides changed', async () => {
    startChangeTracking();
    await createTrip('Here', undefined, '2026-11-01', '2026-11-02');
    const other = memoryFile(
      JSON.stringify({ app: 'packwise', version: 3, exportedAt: new Date().toISOString(), tables: { trips: [{ id: 1, destination: 'There', startDate: '2026-12-01', endDate: '2026-12-02', createdAt: 1 }] } }),
    );
    await connect(other);
    expect(getSyncState().status).toBe('conflict');
    expect((await db.trips.toArray())[0].destination).toBe('Here'); // nothing replaced yet

    await resolveConflict('file');
    expect(getSyncState().status).toBe('synced');
    expect((await db.trips.toArray()).map((t) => t.destination)).toEqual(['There']);
  });

  it('can keep the browser data in a conflict', async () => {
    await createTrip('Here', undefined, '2026-11-01', '2026-11-02');
    const other = memoryFile(JSON.stringify({ app: 'packwise', version: 3, exportedAt: new Date().toISOString(), tables: { trips: [] } }));
    await connect(other);
    await resolveConflict('browser');
    expect(JSON.parse(other.text!).tables.trips[0].destination).toBe('Here');
  });

  it('reports write errors without losing data', async () => {
    await createTrip('Here', undefined, '2026-11-01', '2026-11-02');
    const broken: DataFileAdapter = { kind: 'browser-file', location: 'x.json', read: async () => null, write: async () => Promise.reject(new Error('disk full')) };
    await connect(broken);
    expect(getSyncState()).toMatchObject({ status: 'error', error: expect.stringMatching(/disk full/) });
    expect(await db.trips.count()).toBe(1);
  });
});

describe('backup reminder', () => {
  const now = 100 * REMIND_AFTER_MS;
  const base = { status: 'unsupported' as const, hasData: true, lastChangeAt: now - 1000, now };
  it('reminds when there are unexported changes and no recent backup', () => {
    expect(shouldRemindBackup(base)).toBe(true);
    expect(shouldRemindBackup({ ...base, lastExportAt: now - REMIND_AFTER_MS - 1 })).toBe(true);
  });
  it('stays quiet otherwise', () => {
    expect(shouldRemindBackup({ ...base, status: 'synced' })).toBe(false);
    expect(shouldRemindBackup({ ...base, hasData: false })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastExportAt: now - 1000 })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastExportAt: now - 500, lastChangeAt: now - 1000 })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedUntil: now + 1 })).toBe(false);
  });
});
