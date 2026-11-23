/**
 * The two databases on iOS and Android (PLAN 5.2, 6.4):
 *  - content: `hadith.db`, first copied from the snapshot bundled in the app, later replaced
 *    whole by a newer snapshot. Read-only for the app.
 *  - user: `user.db`, bookmarks, history and settings. Never replaced.
 *
 * A newer snapshot is downloaded and verified into `hadith.next.db` (see features/content) and
 * swapped in here: integrity check first, the old file kept until the new one opens.
 */
import { CONTENT_SCHEMA_VERSION, getMeta, getState, initUserDb, setState, STATE_KEYS, type DbAdapter } from '@tehqeqat/core';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { ExpoDb } from './expoAdapter';

export const CONTENT_DB = 'hadith.db';
export const NEXT_DB = 'hadith.next.db';
const PREV_DB = 'hadith.prev.db';
const BUNDLE_DB = 'hadith.bundle.db';
const USER_DB = 'user.db';

export const supportsContentRefresh = true;

export interface Databases {
  content: DbAdapter;
  user: DbAdapter;
}

export function databaseDirectory(): Directory {
  const raw = String(SQLite.defaultDatabaseDirectory);
  const dir = new Directory(raw.startsWith('file:') ? raw : `file://${raw}`);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function dbFile(name: string): File {
  return new File(databaseDirectory(), name);
}

/** Remove a database file and its journal side files. */
function removeDb(name: string) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const f = dbFile(name + suffix);
    if (f.exists) f.delete();
  }
}

async function openContent(name = CONTENT_DB): Promise<ExpoDb> {
  return new ExpoDb(await SQLite.openDatabaseAsync(name, { useNewConnection: true }));
}

/** Checks a snapshot file before it replaces the current one. */
export async function verifySnapshot(name: string): Promise<{ builtAt: string }> {
  const db = await openContent(name);
  try {
    const check = await db.get<{ quick_check: string }>('PRAGMA quick_check');
    if (check?.quick_check !== 'ok') throw new Error(`quick_check: ${check?.quick_check ?? 'no result'}`);
    const version = Number(await getMeta(db, 'schema_version'));
    if (!version || version > CONTENT_SCHEMA_VERSION) throw new Error(`schema_version ${version}`);
    const count = await db.get<{ n: number }>('SELECT count(*) AS n FROM hadith');
    if (!count?.n) throw new Error('empty snapshot');
    const builtAt = await getMeta(db, 'built_at');
    if (!builtAt) throw new Error('no built_at');
    return { builtAt };
  } finally {
    await db.close();
  }
}

async function bundledAsset(): Promise<{ file: File; hash: string }> {
  const asset = Asset.fromModule(require('@/assets/db/hadith.db'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('bundled snapshot is missing');
  return { file: new File(asset.localUri), hash: asset.hash ?? asset.localUri };
}

async function readBuiltAt(name: string): Promise<string | null> {
  const db = await openContent(name);
  try {
    return await getMeta(db, 'built_at');
  } finally {
    await db.close();
  }
}

/**
 * Makes sure `hadith.db` holds the newest snapshot available on the device: a staged download,
 * the copy bundled in this app build (new after an app update), or what is already installed.
 */
async function prepareContent(user: DbAdapter): Promise<void> {
  const state = await getState(user);
  const current = dbFile(CONTENT_DB);

  // 1. A snapshot downloaded in the background is waiting.
  if (dbFile(NEXT_DB).exists) {
    try {
      await swapFiles();
      await recordInstalled(user, NEXT_DB);
    } catch {
      removeDb(NEXT_DB);
    }
  }

  // 2. First launch, or an app update that bundles a different snapshot.
  const bundle = await bundledAsset();
  if (!current.exists) {
    await bundle.file.copy(dbFile(CONTENT_DB));
    const builtAt = await readBuiltAt(CONTENT_DB);
    await setState(user, {
      [STATE_KEYS.bundleHash]: bundle.hash,
      [STATE_KEYS.installedBuiltAt]: builtAt,
      [STATE_KEYS.installedSha]: null,
    });
    return;
  }
  if (state[STATE_KEYS.bundleHash] !== bundle.hash) {
    removeDb(BUNDLE_DB);
    await bundle.file.copy(dbFile(BUNDLE_DB));
    const bundled = await readBuiltAt(BUNDLE_DB);
    const installed = (await getState(user))[STATE_KEYS.installedBuiltAt] ?? (await readBuiltAt(CONTENT_DB));
    if (bundled && (!installed || bundled > installed)) {
      removeDb(CONTENT_DB);
      await dbFile(BUNDLE_DB).move(dbFile(CONTENT_DB));
      await setState(user, { [STATE_KEYS.installedBuiltAt]: bundled, [STATE_KEYS.installedSha]: null });
    } else {
      removeDb(BUNDLE_DB);
    }
    await setState(user, { [STATE_KEYS.bundleHash]: bundle.hash });
  }
}

/** next → current, keeping the previous file until the new one is in place. */
async function swapFiles() {
  await verifySnapshot(NEXT_DB);
  removeDb(PREV_DB);
  const current = dbFile(CONTENT_DB);
  if (current.exists) await current.move(dbFile(PREV_DB));
  for (const s of ['-wal', '-shm']) {
    const f = dbFile(CONTENT_DB + s);
    if (f.exists) f.delete();
  }
  try {
    await dbFile(NEXT_DB).move(dbFile(CONTENT_DB));
  } catch (e) {
    const prev = dbFile(PREV_DB);
    if (prev.exists) await prev.move(dbFile(CONTENT_DB));
    throw e;
  }
  removeDb(PREV_DB);
}

async function recordInstalled(user: DbAdapter, _from: string) {
  const state = await getState(user);
  await setState(user, {
    [STATE_KEYS.installedSha]: state['staged_sha256'] ?? null,
    [STATE_KEYS.installedBuiltAt]: state['staged_built_at'] ?? (await readBuiltAt(CONTENT_DB)),
    [STATE_KEYS.justUpdated]: state['staged_built_at'] ?? null,
    staged_sha256: null,
    staged_built_at: null,
  });
}

let opening: Promise<Databases> | null = null;

export function openDatabases(): Promise<Databases> {
  opening ??= (async () => {
    const user = new ExpoDb(await SQLite.openDatabaseAsync(USER_DB));
    await initUserDb(user);
    await prepareContent(user);
    const content = await openContent();
    return { content, user };
  })();
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

/**
 * Swap in a staged snapshot while the app runs. Returns the new content connection, or null
 * when nothing was staged. On failure the current database stays open and in use.
 */
export async function applyStagedContent(dbs: Databases): Promise<DbAdapter | null> {
  if (!dbFile(NEXT_DB).exists) return null;
  await verifySnapshot(NEXT_DB);
  await (dbs.content as ExpoDb).close();
  try {
    await swapFiles();
    await recordInstalled(dbs.user, NEXT_DB);
  } catch (e) {
    removeDb(NEXT_DB);
    dbs.content = await openContent();
    throw e;
  }
  const content = await openContent();
  dbs.content = content;
  return content;
}
