import { CONTENT_SCHEMA_VERSION } from './schema';

/** Published next to each snapshot (GitHub Release `content-latest`). */
export interface ContentManifest {
  schema_version: number;
  built_at: string;
  source_latest_updated_at: string | null;
  content_hash: string;
  snapshot: {
    file: string;
    bytes: number;
    sha256: string;
    uncompressed_bytes: number;
  };
  counts: { hadith: number; books: number; chapters: number; narrators: number };
  min_app_version: string;
}

export function isContentManifest(x: unknown): x is ContentManifest {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  const s = m.snapshot as Record<string, unknown> | undefined;
  return (
    typeof m.schema_version === 'number' &&
    typeof m.built_at === 'string' &&
    typeof m.content_hash === 'string' &&
    typeof m.min_app_version === 'string' &&
    !!s &&
    typeof s.file === 'string' &&
    typeof s.sha256 === 'string' &&
    typeof s.bytes === 'number'
  );
}

/** Compare dotted versions numerically: -1, 0, 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export type UpdateDecision =
  | { action: 'none'; reason: 'same' | 'older' }
  | { action: 'app-update-required'; reason: 'schema' | 'min-version' }
  | { action: 'download' };

/** What the app should do with a manifest, given what it has installed. */
export function decideUpdate(
  manifest: ContentManifest,
  installed: { sha256: string | null; built_at: string | null },
  appVersion: string,
  appSchemaVersion: number = CONTENT_SCHEMA_VERSION,
): UpdateDecision {
  if (manifest.snapshot.sha256 === installed.sha256) return { action: 'none', reason: 'same' };
  if (manifest.schema_version > appSchemaVersion) return { action: 'app-update-required', reason: 'schema' };
  if (compareVersions(appVersion, manifest.min_app_version) < 0) {
    return { action: 'app-update-required', reason: 'min-version' };
  }
  if (installed.built_at && manifest.built_at <= installed.built_at) return { action: 'none', reason: 'older' };
  return { action: 'download' };
}
