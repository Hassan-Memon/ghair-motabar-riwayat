/**
 * Downloads the published snapshot and places it where the app bundles it.
 *
 *   npm run content:pull -- [--release-base URL] [--from-dir DIR]
 *
 * Writes apps/app/assets/db/hadith.db (bundled into native builds), a copy in
 * apps/app/public/db/ for the web export and desktop shell, and apps/app/assets/db/manifest.json
 * so the app knows which snapshot it shipped with. Verifies the sha256 from the manifest.
 * Only GitHub is contacted, never the website.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { isContentManifest } from '@tehqeqat/core';

const { values: args } = parseArgs({
  options: {
    'release-base': {
      type: 'string',
      default: 'https://github.com/Hassan-Memon/ghair-motabar-riwayat/releases/download/content-latest',
    },
    // Use a locally built snapshot (e.g. packages/content/out) instead of downloading.
    'from-dir': { type: 'string' },
  },
});

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '../../../apps/app');

async function load(name: string): Promise<Buffer> {
  if (args['from-dir']) return readFileSync(join(resolve(args['from-dir']), name));
  const url = `${args['release-base']!.replace(/\/$/, '')}/${name}`;
  const res = await fetch(url, { headers: { 'user-agent': 'tehqeqat-offline-pull' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const manifestBytes = await load('manifest.json');
const manifest = JSON.parse(manifestBytes.toString('utf8')) as unknown;
if (!isContentManifest(manifest)) throw new Error('manifest.json has an unexpected shape');

const gz = await load(manifest.snapshot.file);
const sha = createHash('sha256').update(gz).digest('hex');
if (sha !== manifest.snapshot.sha256) {
  throw new Error(`sha256 mismatch: expected ${manifest.snapshot.sha256}, got ${sha}`);
}
const db = gunzipSync(gz);

const assetDir = join(appDir, 'assets/db');
const publicDir = join(appDir, 'public/db');
mkdirSync(assetDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(assetDir, 'hadith.db'), db);
copyFileSync(join(assetDir, 'hadith.db'), join(publicDir, 'hadith.db'));


console.log(
  `snapshot ${manifest.built_at}: ${manifest.counts.hadith} narrations, ` +
    `${(db.length / 1048576).toFixed(1)} MB → apps/app/assets/db/hadith.db`,
);
