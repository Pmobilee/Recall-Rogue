/**
 * obfuscate-db.mjs
 *
 * XOR-obfuscates SQLite database files so they cannot be opened directly with
 * the `sqlite3` CLI or DB browsers. This is intentional obfuscation — not
 * cryptographic protection. The key is deterministic from the package.json
 * version and is also derived at runtime by dbDecoder.ts.
 *
 * The algorithm is its own inverse: running this script twice on the same file
 * restores the original (XOR is self-inverse).
 *
 * Usage:
 *   node scripts/obfuscate-db.mjs
 *
 * Processes:
 *   public/facts.db
 *   public/curated.db
 *
 * Key derivation (MUST stay in sync with src/services/dbDecoder.ts):
 *   seed = "recall-rogue-" + version   (e.g. "recall-rogue-0.1.0")
 *   key  = 32-byte buffer derived via triple-mix hash over seed chars
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Key derivation — MUST match src/services/dbDecoder.ts exactly
// ---------------------------------------------------------------------------
/**
 * Derives a 32-byte XOR key from a seed string.
 * Algorithm is intentionally simple (not cryptographic).
 *
 * @param {string} seed
 * @returns {Uint8Array} 32-byte key
 */
function deriveKey(seed) {
  const key = new Uint8Array(32);
  for (let i = 0; i < seed.length; i++) {
    key[i % 32]        ^= seed.charCodeAt(i);
    key[(i + 13) % 32] ^= seed.charCodeAt(i) >>> 3;
    key[(i + 7)  % 32]  = (key[(i + 7) % 32] + seed.charCodeAt(i)) & 0xFF;
  }
  return key;
}

// ---------------------------------------------------------------------------
// Load version from package.json
// ---------------------------------------------------------------------------
const pkgPath = path.join(ROOT, 'package.json');
const pkg     = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const seed    = `recall-rogue-${version}`;
const key     = deriveKey(seed);

console.log(`[obfuscate-db] version=${version}  seed="${seed}"  key[0..3]=${Array.from(key.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// ---------------------------------------------------------------------------
// SQLite magic bytes — first 16 bytes of a valid SQLite file
// ---------------------------------------------------------------------------
const SQLITE_MAGIC = 'SQLite format 3\0';

/**
 * Returns true when the first 16 bytes of data match the SQLite magic string.
 *
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function isSqlite(data) {
  if (data.length < SQLITE_MAGIC.length) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (data[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Process a single database file
// ---------------------------------------------------------------------------
/**
 * XOR-obfuscates (or de-obfuscates) a single .db file in-place.
 * Logs file sizes before and after. Warns if the file is already plain SQLite
 * (which would mean the file is currently deobfuscated — running once more
 * will re-obfuscate it).
 *
 * @param {string} filePath  Absolute path to the .db file
 */
function processDb(filePath) {
  if (!existsSync(filePath)) {
    console.log(`[obfuscate-db] SKIP  ${filePath}  (not found)`);
    return;
  }

  const before = readFileSync(filePath);
  const data   = new Uint8Array(before);

  if (isSqlite(data)) {
    console.warn(`[obfuscate-db] WARN  ${filePath}  starts with SQLite magic — file is currently plain SQLite (will obfuscate now)`);
  }

  // XOR each byte with the repeating key
  for (let i = 0; i < data.length; i++) {
    data[i] ^= key[i % key.length];
  }

  writeFileSync(filePath, data);

  const sizeKb = (data.length / 1024).toFixed(1);
  console.log(`[obfuscate-db] OK    ${filePath}  ${sizeKb} KB`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// Obfuscate dist/ files (production build output), not public/ (dev server source).
// Vite copies public/ → dist/ during build, so we obfuscate the copies in dist/.
// This keeps public/ readable for the dev server while dist/ is protected.
const DIST_DIR = path.join(ROOT, 'dist');
const DB_FILES = [
  path.join(DIST_DIR, 'facts.db'),
  path.join(DIST_DIR, 'curated.db'),
];

for (const dbPath of DB_FILES) {
  processDb(dbPath);
}

console.log('[obfuscate-db] Done.');
