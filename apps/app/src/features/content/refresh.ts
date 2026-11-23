/**
 * Content refresh on iOS and Android (PLAN 6.4). Fetches the manifest from GitHub Releases,
 * decides with @tehqeqat/core, downloads and verifies the snapshot, and stages it as
 * `hadith.next.db`. The swap itself happens in db/databases.ts — live when the app is open,
 * or on the next launch when this ran in the background. Devices never call the website.
 */
import {
  decideUpdate,
  failureState,
  getSettings,
  getState,
  isContentManifest,
  setState,
  shouldCheck,
  STATE_KEYS,
  successState,
  type CheckTrigger,
  type DbAdapter,
} from '@tehqeqat/core';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { gunzipSync } from 'fflate';

import { dbFile, NEXT_DB, verifySnapshot } from '@/db/databases';

export const RELEASE_BASE =
  'https://github.com/Hassan-Memon/ghair-motabar-riwayat/releases/download/content-latest';

export type RefreshResult =
  | 'skipped'
  | 'current'
  | 'staged'
  | 'waiting-wifi'
  | 'app-update'
  | 'failed';

const appVersion = () => Constants.expoConfig?.version ?? '1.0.0';

let running: Promise<RefreshResult> | null = null;

/** One refresh at a time; concurrent callers share the result. */
export function refreshContent(user: DbAdapter, trigger: CheckTrigger): Promise<RefreshResult> {
  running ??= run(user, trigger).finally(() => {
    running = null;
  });
  return running;
}

async function run(user: DbAdapter, trigger: CheckTrigger): Promise<RefreshResult> {
  const now = Date.now();
  const state = await getState(user);
  if (!shouldCheck(state, trigger, now)) return 'skipped';
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (state[STATE_KEYS.etag] && state[STATE_KEYS.waitingForWifi] !== '1') {
      headers['if-none-match'] = state[STATE_KEYS.etag]!;
    }
    const res = await fetch(`${RELEASE_BASE}/manifest.json`, { headers });
    if (res.status === 304) {
      await setState(user, successState(now));
      return 'current';
    }
    if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
    const manifest: unknown = await res.json();
    if (!isContentManifest(manifest)) throw new Error('manifest: unexpected shape');
    const etag = res.headers.get('etag');

    const decision = decideUpdate(
      manifest,
      { sha256: state[STATE_KEYS.installedSha] ?? null, built_at: state[STATE_KEYS.installedBuiltAt] ?? null },
      appVersion(),
    );
    if (decision.action === 'app-update-required') {
      await setState(user, { ...successState(now), [STATE_KEYS.appUpdateNeeded]: decision.reason });
      return 'app-update';
    }
    if (decision.action === 'none') {
      await setState(user, {
        ...successState(now),
        [STATE_KEYS.etag]: etag,
        [STATE_KEYS.waitingForWifi]: null,
        [STATE_KEYS.appUpdateNeeded]: null,
      });
      return 'current';
    }

    const settings = await getSettings(user);
    const net = await Network.getNetworkStateAsync();
    if (net.type === Network.NetworkStateType.CELLULAR && !settings.allowCellular) {
      await setState(user, { ...successState(now), [STATE_KEYS.waitingForWifi]: '1' });
      return 'waiting-wifi';
    }

    const gz = new File(Paths.cache, 'hadith-next.sqlite.gz');
    if (gz.exists) gz.delete();
    const downloaded = await File.downloadFileAsync(`${RELEASE_BASE}/${manifest.snapshot.file}`, gz, {
      idempotent: true,
    });
    try {
      const sha = await downloaded.digest('SHA-256');
      if (sha.toLowerCase() !== manifest.snapshot.sha256) throw new Error('snapshot: sha256 mismatch');
      const db = gunzipSync(await downloaded.bytes());
      const next = dbFile(NEXT_DB);
      if (next.exists) next.delete();
      next.create();
      await next.write(db);
    } finally {
      if (downloaded.exists) downloaded.delete();
    }
    const { builtAt } = await verifySnapshot(NEXT_DB);
    await setState(user, {
      ...successState(now),
      [STATE_KEYS.etag]: etag,
      [STATE_KEYS.waitingForWifi]: null,
      [STATE_KEYS.appUpdateNeeded]: null,
      staged_sha256: manifest.snapshot.sha256,
      staged_built_at: builtAt,
    });
    return 'staged';
  } catch (e) {
    const next = dbFile(NEXT_DB);
    if (next.exists) next.delete();
    await setState(user, failureState(state, e instanceof Error ? e.message : String(e), now));
    return 'failed';
  }
}
