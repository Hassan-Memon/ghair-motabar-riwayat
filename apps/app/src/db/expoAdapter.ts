import type { DbAdapter, SqlValue } from '@tehqeqat/core';
import type { SQLiteDatabase } from 'expo-sqlite';

/** `DbAdapter` over an expo-sqlite connection (iOS and Android). */
export class ExpoDb implements DbAdapter {
  constructor(readonly raw: SQLiteDatabase) {}

  async exec(sql: string) {
    await this.raw.execAsync(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []) {
    const r = await this.raw.runAsync(sql, params as SqlValue[]);
    return { changes: r.changes };
  }

  async all<T>(sql: string, params: readonly SqlValue[] = []) {
    return this.raw.getAllAsync<T>(sql, params as SqlValue[]);
  }

  async get<T>(sql: string, params: readonly SqlValue[] = []) {
    return (await this.raw.getFirstAsync<T>(sql, params as SqlValue[])) ?? undefined;
  }

  async transaction<R>(fn: () => Promise<R>) {
    let result!: R;
    await this.raw.withTransactionAsync(async () => {
      result = await fn();
    });
    return result;
  }

  close() {
    return this.raw.closeAsync();
  }
}
