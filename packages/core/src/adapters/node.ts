/** node:sqlite adapter, for tests and the snapshot builder. Not for the app bundle. */
import { DatabaseSync } from 'node:sqlite';

import type { DbAdapter, SqlValue } from '../db';

export class NodeDb implements DbAdapter {
  readonly raw: DatabaseSync;

  constructor(path: string) {
    this.raw = new DatabaseSync(path);
  }

  async exec(sql: string) {
    this.raw.exec(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []) {
    const r = this.raw.prepare(sql).run(...params);
    return { changes: Number(r.changes) };
  }

  async all<T>(sql: string, params: readonly SqlValue[] = []) {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  async get<T>(sql: string, params: readonly SqlValue[] = []) {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  async transaction<R>(fn: () => Promise<R>) {
    this.raw.exec('BEGIN');
    try {
      const r = await fn();
      this.raw.exec('COMMIT');
      return r;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }

  close() {
    this.raw.close();
  }
}
