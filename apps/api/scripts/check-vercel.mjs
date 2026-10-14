// Type-checks the API exactly as Vercel's build does, so a deploy never fails
// on a type error that a local check missed. Run before every push:
//
//   npm run check:vercel
//
// What Vercel does (@vercel/node, read from its source):
//   - installs apps/api fresh (there is no lock file) and uses that TypeScript
//     ("Using TypeScript x.y.z (local user-provided)");
//   - with no tsconfig.json it compiles with target ES2021, esModuleInterop,
//     module/moduleResolution NodeNext and strict: false. Non-strict matters:
//     some narrowing that passes a --strict check fails here;
//   - it reports errors in our own files only, not in node_modules types.
//
// This script copies the API's files (tracked and new, as in the working tree)
// to a temp folder, installs them fresh and runs tsc with those options.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(os.tmpdir(), 'freightwizard-api-vercel-check');
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

if (fs.existsSync(path.join(api, 'tsconfig.json'))) {
  console.error('apps/api now has a tsconfig.json: Vercel uses it instead of its defaults. Update this script to match.');
  process.exit(1);
}

fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const files = run('git ls-files --cached --others --exclude-standard', api).split('\n').filter(Boolean);
for (const f of files) {
  if (!fs.existsSync(path.join(api, f))) continue; // deleted in the working tree
  fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
  fs.copyFileSync(path.join(api, f), path.join(tmp, f));
}

console.log('Fresh install of apps/api (as on Vercel)...');
run('npm install --no-audit --no-fund --loglevel=error', tmp);
const tsVersion = JSON.parse(fs.readFileSync(path.join(tmp, 'node_modules/typescript/package.json'), 'utf8')).version;
console.log(`Using TypeScript ${tsVersion}, Vercel defaults (target ES2021, NodeNext, strict: false)`);

const tsc = `node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target ES2021 --module NodeNext --moduleResolution NodeNext --esModuleInterop server.ts`;
try {
  run(tsc, tmp);
  console.log('✓ No type errors: the Vercel build will pass this step.');
} catch (e) {
  console.error((e.stdout?.toString() || '') + (e.stderr?.toString() || ''));
  console.error('✗ Type errors above would fail the Vercel deploy.');
  process.exit(1);
}
