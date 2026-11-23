/**
 * The two databases in a browser and in the desktop shell, over the official SQLite wasm build
 * (it includes FTS5, which expo-sqlite's web build does not).
 *  - content: the snapshot served next to the web export (`/db/hadith.db`), loaded into memory.
 *  - user: in memory, saved to localStorage after every change (it is a few kilobytes).
 * The wasm module is served from /sqlite/ (copied there by scripts/copy-web-assets.mjs) and
 * loaded at run time by a module script, outside Metro's bundle.
 */
import { initUserDb, type DbAdapter, type SqlValue } from '@tehqeqat/core';

export const supportsContentRefresh = false;

export interface Databases {
  content: DbAdapter;
  user: DbAdapter;
}

// Minimal shape of the parts of @sqlite.org/sqlite-wasm used here.
interface Sqlite3Db {
  pointer: number;
  exec(opts: { sql: string; bind?: SqlValue[]; rowMode?: 'object'; returnValue?: 'resultRows' }): unknown;
  changes(): number;
  close(): void;
}
interface Sqlite3 {
  oo1: { DB: new () => Sqlite3Db };
  wasm: { allocFromTypedArray(a: Uint8Array): number };
  capi: {
    sqlite3_deserialize(db: number, schema: string, p: number, n: number, max: number, flags: number): number;
    sqlite3_js_db_export(db: Sqlite3Db): Uint8Array;
    SQLITE_DESERIALIZE_FREEONCLOSE: number;
    SQLITE_DESERIALIZE_RESIZEABLE: number;
  };
}

type Init = () => Promise<Sqlite3>;
declare global {
  interface Window {
    __sqlite3Init?: Init;
  }
}

/** Loads /sqlite/loader.mjs, which puts the wasm module's initialiser on window. */
function loadSqliteInit(): Promise<Init> {
  if (window.__sqlite3Init) return Promise.resolve(window.__sqlite3Init);
  return new Promise((resolve, reject) => {
    window.addEventListener('sqlite3-ready', () => resolve(window.__sqlite3Init!), { once: true });
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/sqlite/loader.mjs';
    s.onerror = () => reject(new Error('could not load the SQLite module'));
    document.head.appendChild(s);
  });
}

class WasmDb implements DbAdapter {
  private depth = 0;
  constructor(
    private readonly sqlite3: Sqlite3,
    readonly raw: Sqlite3Db,
    private readonly onWrite?: () => void,
  ) {}

  async exec(sql: string) {
    this.raw.exec({ sql });
    this.onWrite?.();
  }

  async run(sql: string, params: readonly SqlValue[] = []) {
    this.raw.exec({ sql, bind: [...params] });
    const changes = this.raw.changes();
    if (this.depth === 0) this.onWrite?.();
    return { changes };
  }

  async all<T>(sql: string, params: readonly SqlValue[] = []) {
    return this.raw.exec({ sql, bind: params.length ? [...params] : undefined, rowMode: 'object', returnValue: 'resultRows' }) as T[];
  }

  async get<T>(sql: string, params: readonly SqlValue[] = []) {
    return (await this.all<T>(sql, params))[0];
  }

  async transaction<R>(fn: () => Promise<R>) {
    this.raw.exec({ sql: 'BEGIN' });
    this.depth++;
    try {
      const r = await fn();
      this.raw.exec({ sql: 'COMMIT' });
      return r;
    } catch (e) {
      this.raw.exec({ sql: 'ROLLBACK' });
      throw e;
    } finally {
      this.depth--;
      if (this.depth === 0) this.onWrite?.();
    }
  }

  export(): Uint8Array {
    return this.sqlite3.capi.sqlite3_js_db_export(this.raw);
  }
}

function load(sqlite3: Sqlite3, bytes: Uint8Array, onWrite?: () => void): WasmDb {
  const db = new sqlite3.oo1.DB();
  const p = sqlite3.wasm.allocFromTypedArray(bytes);
  const { capi } = sqlite3;
  const rc = capi.sqlite3_deserialize(
    db.pointer,
    'main',
    p,
    bytes.length,
    bytes.length,
    capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  if (rc !== 0) throw new Error(`sqlite3_deserialize: ${rc}`);
  return new WasmDb(sqlite3, db, onWrite);
}

const USER_KEY = 'tehqeqat.user.db';

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

let opening: Promise<Databases> | null = null;

export function openDatabases(): Promise<Databases> {
  opening ??= (async () => {
    const sqlite3 = await (await loadSqliteInit())();
    const res = await fetch('/db/hadith.db');
    if (!res.ok) throw new Error(`content database: HTTP ${res.status}`);
    const content = load(sqlite3, new Uint8Array(await res.arrayBuffer()));

    let user: WasmDb;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(USER_KEY, toBase64(user.export()));
        } catch {
          // storage full or unavailable: keep working in memory
        }
      }, 300);
    };
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    try {
      user = stored ? load(sqlite3, fromBase64(stored), save) : new WasmDb(sqlite3, new sqlite3.oo1.DB(), save);
    } catch {
      user = new WasmDb(sqlite3, new sqlite3.oo1.DB(), save);
    }
    await initUserDb(user);
    return { content, user };
  })();
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

export async function applyStagedContent(_dbs: Databases): Promise<DbAdapter | null> {
  return null;
}
