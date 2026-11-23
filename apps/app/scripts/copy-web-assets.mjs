// Copies the SQLite wasm build into public/sqlite/ so the web export and the desktop shell
// can load it at run time (it is not bundled by Metro). Run before `expo start --web`
// and `expo export --platform web`.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('@sqlite.org/sqlite-wasm/package.json'));
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sqlite');
mkdirSync(out, { recursive: true });
for (const f of ['index.mjs', 'sqlite3.wasm']) copyFileSync(join(pkgDir, 'dist', f), join(out, f));

// A module script that hands the initialiser to the app. Loaded with a <script src>, so the
// desktop shell's content security policy needs neither eval nor inline scripts.
const loader = [
  "import init from './index.mjs';",
  'window.__sqlite3Init = init;',
  "window.dispatchEvent(new Event('sqlite3-ready'));",
  '',
];
writeFileSync(join(out, 'loader.mjs'), loader.join('\n'));
console.log('sqlite wasm → public/sqlite/');
