/**
 * The one database interface the core needs. Implemented over expo-sqlite (iOS/Android),
 * tauri-plugin-sql (desktop) and node:sqlite (tests and the snapshot builder).
 * Parameters are positional (`?`).
 */
export type SqlValue = string | number | null;

export interface DbAdapter {
  /** Run one or more statements with no parameters and no result. */
  exec(sql: string): Promise<void>;
  /** Run one statement with parameters. */
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined>;
  /** Run `fn` inside one transaction; roll back if it throws. */
  transaction<R>(fn: () => Promise<R>): Promise<R>;
}
