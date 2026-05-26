/**
 * Fails the build if package.json or Cargo.toml do not pin Tauri 2.x (not 1.x).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[ensure-tauri2] ${message}`);
  process.exit(1);
}

/** npm range must require major 2 and must not allow major 1. */
function assertNpmTauri2Range(range, label) {
  if (!range || typeof range !== 'string') {
    fail(`${label} is missing`);
  }
  if (/(^|[\s"'])1\.|tauri.*\b1\./i.test(range)) {
    fail(`${label} must not target Tauri 1.x (got ${range})`);
  }
  const allows2 =
    /^2(\.|$)/.test(range) ||
    /[\^~>=]+2(\.|,|$)/.test(range) ||
    />=2\.0/.test(range);
  if (!allows2) {
    fail(`${label} must require Tauri >=2.0 (got ${range})`);
  }
  if (/<\s*3|,\s*<\s*3/.test(range) || /^2/.test(range) || /[\^~]2/.test(range)) {
    return;
  }
  if (/>=2/.test(range)) {
    return;
  }
  fail(`${label} should cap below Tauri 3.x, e.g. ">=2.0.0 <3.0.0" (got ${range})`);
}

function assertCargoTauri2Version(version, crate) {
  if (!version || typeof version !== 'string') {
    fail(`${crate} version is missing in src-tauri/Cargo.toml`);
  }
  if (/^1($|\.)/.test(version)) {
    fail(`${crate} must not use Tauri 1.x (got ${version})`);
  }
  const allows2 =
    /^2($|\.)/.test(version) ||
    />=2\.0/.test(version) ||
    /,\s*<3/.test(version);
  if (!allows2) {
    fail(`${crate} must require Tauri >=2.0 (got ${version})`);
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assertNpmTauri2Range(pkg.dependencies?.['@tauri-apps/api'], '@tauri-apps/api');
assertNpmTauri2Range(pkg.devDependencies?.['@tauri-apps/cli'], '@tauri-apps/cli');

const cargo = readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
for (const crate of ['tauri', 'tauri-build']) {
  const match = cargo.match(
    new RegExp(`${crate}\\s*=\\s*\\{[^}]*version\\s*=\\s*"([^"]+)"`, 's'),
  );
  assertCargoTauri2Version(match?.[1], crate);
}

const conf = JSON.parse(
  readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
);
if (!conf.$schema?.includes('/config/2')) {
  fail('tauri.conf.json must use Tauri 2 config schema (config/2)');
}

console.log('[ensure-tauri2] OK — Tauri 2.x only');
