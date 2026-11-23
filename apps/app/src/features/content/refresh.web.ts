import type { CheckTrigger, DbAdapter } from '@tehqeqat/core';

/** The web export and desktop shell get new content with new app versions, not in place. */
export const RELEASE_BASE =
  'https://github.com/Hassan-Memon/ghair-motabar-riwayat/releases/download/content-latest';

export type RefreshResult = 'skipped' | 'current' | 'staged' | 'waiting-wifi' | 'app-update' | 'failed';

export async function refreshContent(_user: DbAdapter, _trigger: CheckTrigger): Promise<RefreshResult> {
  return 'skipped';
}
