/**
 * dbDecoder.ts
 *
 * Decodes XOR-obfuscated database binaries at runtime before they are passed
 * to sql.js.  The obfuscation step is performed at build time by
 * `scripts/obfuscate-db.mjs` using the same key derivation algorithm.
 *
 * In development the dev server serves raw (non-obfuscated) SQLite files, so
 * decoding is skipped entirely to keep the DX smooth.
 *
 * Key derivation (MUST stay in sync with scripts/obfuscate-db.mjs):
 *   seed = "recall-rogue-" + __RR_VERSION__
 *   key  = 32-byte buffer derived via triple-mix hash over seed chars
 *
 * __RR_VERSION__ is injected by Vite's `define` config.
 */

// Vite injects this at build time via the `define` option in vite.config.ts.
// In dev mode the value resolves to the version string but the decode path is
// skipped, so an incorrect value in dev has no practical effect.
declare const __RR_VERSION__: string;

// ---------------------------------------------------------------------------
// Key derivation — MUST match scripts/obfuscate-db.mjs exactly
// ---------------------------------------------------------------------------

/**
 * Derives a 32-byte XOR key from a seed string.
 * Algorithm is intentionally simple (not cryptographic).
 */
function deriveKey(seed: string): Uint8Array {
  const key = new Uint8Array(32);
  for (let i = 0; i < seed.length; i++) {
    key[i % 32]        ^= seed.charCodeAt(i);
    key[(i + 13) % 32] ^= seed.charCodeAt(i) >>> 3;
    key[(i + 7)  % 32]  = (key[(i + 7) % 32] + seed.charCodeAt(i)) & 0xFF;
  }
  return key;
}

/** Cached key — derived once per session. */
let _cachedKey: Uint8Array | null = null;

/**
 * Returns (and caches) the 32-byte XOR key for the current build version.
 */
function getKey(): Uint8Array {
  if (_cachedKey) return _cachedKey;
  const seed = `recall-rogue-${__RR_VERSION__}`;
  _cachedKey = deriveKey(seed);
  return _cachedKey;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decodes an XOR-obfuscated database binary and returns a Uint8Array suitable
 * for passing directly to `new SQL.Database(data)`.
 *
 * In dev mode (`import.meta.env.DEV`) the buffer is returned unchanged because
 * the dev server serves raw SQLite files — obfuscate-db.mjs is only run as
 * part of the production build pipeline.
 *
 * The XOR operation is its own inverse, so this function both encodes and
 * decodes (calling it twice on the same data restores the original).
 *
 * @example
 * ```ts
 * const buffer = await fetch('/facts.db').then(r => r.arrayBuffer());
 * const data   = decodeDbBuffer(buffer);
 * const db     = new SQL.Database(data);
 * ```
 */
export function decodeDbBuffer(buffer: ArrayBuffer): Uint8Array {
  // Dev server serves raw (non-obfuscated) SQLite — skip decode entirely.
  if (import.meta.env.DEV) {
    return new Uint8Array(buffer);
  }

  const data = new Uint8Array(buffer);
  const key  = getKey();

  for (let i = 0; i < data.length; i++) {
    data[i] ^= key[i % key.length];
  }

  return data;
}
