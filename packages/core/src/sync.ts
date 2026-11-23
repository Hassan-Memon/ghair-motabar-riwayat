/**
 * Pure rules for refreshing the content snapshot on a device (PLAN 6.4). The app supplies the
 * I/O (fetch, files, SQLite); these functions decide what to do and are tested in Node.
 */

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BACKOFF_MS = [60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];

/** Keys in the user DB's `content_state` table. */
export const STATE_KEYS = {
  lastCheck: 'last_check',
  etag: 'manifest_etag',
  failures: 'failures',
  nextRetry: 'next_retry',
  lastError: 'last_error',
  installedSha: 'installed_sha256',
  installedBuiltAt: 'installed_built_at',
  bundleHash: 'bundle_hash',
  waitingForWifi: 'waiting_for_wifi',
  appUpdateNeeded: 'app_update_needed',
  justUpdated: 'just_updated',
} as const;

export type CheckTrigger = 'launch' | 'background' | 'manual';

/**
 * Whether to fetch the manifest now. Manual checks (pull-to-refresh, "check now") always run;
 * launch and background checks wait 24 h since the last success and respect the back-off.
 */
export function shouldCheck(state: Record<string, string>, trigger: CheckTrigger, now: number): boolean {
  if (trigger === 'manual') return true;
  const nextRetry = Date.parse(state[STATE_KEYS.nextRetry] ?? '');
  if (Number.isFinite(nextRetry) && now < nextRetry) return false;
  // A download that waited for Wi-Fi is retried at the next chance.
  if (state[STATE_KEYS.waitingForWifi] === '1') return true;
  const last = Date.parse(state[STATE_KEYS.lastCheck] ?? '');
  return !Number.isFinite(last) || now - last >= CHECK_INTERVAL_MS;
}

/** State to record after a failed check: 1 h, then 6 h, then 24 h until the next attempt. */
export function failureState(state: Record<string, string>, error: string, now: number): Record<string, string> {
  const failures = (parseInt(state[STATE_KEYS.failures] ?? '0', 10) || 0) + 1;
  const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]!;
  return {
    [STATE_KEYS.failures]: String(failures),
    [STATE_KEYS.nextRetry]: new Date(now + wait).toISOString(),
    [STATE_KEYS.lastError]: error.slice(0, 300),
  };
}

/** State to record after a successful check (whatever its outcome). */
export function successState(now: number): Record<string, string | null> {
  return {
    [STATE_KEYS.lastCheck]: new Date(now).toISOString(),
    [STATE_KEYS.failures]: null,
    [STATE_KEYS.nextRetry]: null,
    [STATE_KEYS.lastError]: null,
  };
}

/** Lowercase hex of a digest. */
export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (const b of u8) out += b.toString(16).padStart(2, '0');
  return out;
}
