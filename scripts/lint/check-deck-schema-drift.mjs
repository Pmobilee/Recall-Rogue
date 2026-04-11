#!/usr/bin/env node
/**
 * check-deck-schema-drift.mjs
 *
 * Detects drift between TypeScript interface field names in
 * src/data/curatedDeckTypes.ts and the matching Zod schema keys in
 * src/data/curatedDeckSchema.ts.
 *
 * Problem it solves: someone adds a field to DeckFact (or AnswerTypePool,
 * SynonymGroup) in curatedDeckTypes.ts but forgets to add it to the
 * corresponding z.object({...}) in curatedDeckSchema.ts. The schema uses
 * .passthrough() so the new field silently survives at runtime — but Zod
 * will not validate it, meaning a type-mismatch in that field is invisible.
 * Conversely, a field in the schema but not the interface usually means
 * a rename happened in the interface but not the schema.
 *
 * Parsing strategy: regex-based on the literal source text. Both files
 * use plain interfaces and z.object({}) with one key per line. Generics,
 * JSDoc, and optional markers (?) are handled. Comments are stripped.
 *
 * Usage:
 *   node scripts/lint/check-deck-schema-drift.mjs
 *   npm run lint:deck-schema-drift
 *
 * Exit codes:
 *   0 — all field sets match
 *   1 — drift detected
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

const TYPES_FILE   = resolve(ROOT, 'src/data/curatedDeckTypes.ts');
const SCHEMA_FILE  = resolve(ROOT, 'src/data/curatedDeckSchema.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(msg) {
  console.error(`[check-deck-schema-drift] FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[check-deck-schema-drift] ok: ${msg}`);
}

/**
 * Strip line comments from a TypeScript/JS source string.
 * Block comments (/** and /* ... *\/) are also removed.
 * This prevents comment text from being parsed as field names.
 */
function stripComments(src) {
  // Remove block comments first (non-greedy)
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove line comments
  src = src.replace(/\/\/.*/g, '');
  return src;
}

/**
 * Extract field names from a TypeScript interface body.
 *
 * Extracts from:
 *   interface Foo {
 *     fieldA: string;
 *     fieldB?: number;
 *     methodC(): void;   <- skipped (has parens)
 *   }
 *
 * Returns Set<string> of field names.
 *
 * Note: fields with complex inline types that span multiple lines (e.g.
 * Array<{...}>) are handled correctly — we only look at the leading
 * `  identifier?:` pattern, not the full type expression.
 */
function extractInterfaceFields(src, interfaceName) {
  const clean = stripComments(src);

  // Find the interface block. Handles `export interface Foo {` and `interface Foo {`.
  // The regex captures everything between the opening brace and the matching
  // closing brace (we find the first `}` on its own line after `interface X {`).
  const ifacePattern = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}(?:\\s+extends\\s+\\w+)?\\s*\\{([^}]*)\\}`,
    'm'
  );
  // Because interfaces can contain nested braces (e.g. Array<{ t: string; r?: string }>),
  // the simple [^}]* will stop at the first nested brace. We use a brace-counter approach.
  const startPattern = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}(?:\\s+extends\\s+\\w+)?\\s*\\{`
  );

  const startMatch = startPattern.exec(clean);
  if (!startMatch) {
    return null; // interface not found
  }

  // Walk forward from the opening brace, counting depth.
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = startMatch.index; i < clean.length; i++) {
    if (clean[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (clean[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (start === -1 || end === -1) return null;

  const body = clean.slice(start, end);
  const fields = new Set();

  // Match field lines: leading whitespace, identifier (with optional ?), colon
  // Excludes method signatures (they have parens before the colon or lack one).
  // Pattern: optional whitespace, word chars + optional ?, whitespace, colon
  const fieldLine = /^\s*([\w]+)\??:\s*/gm;
  let m;
  while ((m = fieldLine.exec(body)) !== null) {
    // Skip index signatures like [key: string]
    if (m[0].trim().startsWith('[')) continue;
    fields.add(m[1]);
  }

  return fields;
}

/**
 * Extract key names from a z.object({ ... }) block in the schema file.
 *
 * Looks for:
 *   export const FooSchema = z.object({
 *     field1: z.string(),
 *     field2: z.number().optional(),
 *   }).passthrough();
 *
 * Uses brace-counting to handle nested z.object() / z.tuple() / z.array()
 * inside the outer object. Only the top-level keys are extracted.
 */
function extractSchemaFields(src, schemaName) {
  const clean = stripComments(src);

  // Find `const SchemaName = z.object({`
  const startPattern = new RegExp(
    `(?:export\\s+)?const\\s+${schemaName}\\s*=\\s*z\\.object\\s*\\(`
  );
  const startMatch = startPattern.exec(clean);
  if (!startMatch) {
    return null;
  }

  // Find the opening brace of z.object({)
  let braceStart = clean.indexOf('{', startMatch.index + startMatch[0].length - 1);
  if (braceStart === -1) return null;

  // Walk forward with brace counter
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = braceStart; i < clean.length; i++) {
    if (clean[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (clean[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (start === -1 || end === -1) return null;

  const body = clean.slice(start, end);
  const fields = new Set();

  // Extract only top-level keys.
  // Strategy: scan line by line from the body, tracking nested depth.
  // A top-level key line looks like:  `  fieldName: z.something`
  // We skip lines inside nested braces/parens.
  let nestDepth = 0;
  const lines = body.split('\n');
  for (const line of lines) {
    // Count braces and parens on this line to track nesting.
    // We evaluate nesting BEFORE deciding if this line is top-level, because
    // a line like `  nestedField: z.object({` itself is a top-level key.
    const beforeCount = nestDepth;
    for (const ch of line) {
      if (ch === '{' || ch === '(') nestDepth++;
      else if (ch === '}' || ch === ')') nestDepth--;
    }

    if (beforeCount === 0) {
      // This line started at top level — try to extract a key name.
      const m = /^\s*([\w]+)\s*:/.exec(line);
      if (m) {
        fields.add(m[1]);
      }
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------

let typesSrc, schemaSrc;
try {
  typesSrc = readFileSync(TYPES_FILE, 'utf8');
} catch (err) {
  fail(`Could not read ${TYPES_FILE}: ${err.message}`);
  process.exit(1);
}
try {
  schemaSrc = readFileSync(SCHEMA_FILE, 'utf8');
} catch (err) {
  fail(`Could not read ${SCHEMA_FILE}: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pairs to check: [interfaceName, schemaName]
// CuratedDeck does not have a Zod schema (decoded from SQLite row-by-row),
// so only the three per-row schemas are validated.
// ---------------------------------------------------------------------------

const PAIRS = [
  ['DeckFact',        'DeckFactSchema'],
  ['AnswerTypePool',  'AnswerTypePoolSchema'],
  ['SynonymGroup',    'SynonymGroupSchema'],
];

// ---------------------------------------------------------------------------
// Check each pair
// ---------------------------------------------------------------------------

for (const [ifaceName, schemaName] of PAIRS) {
  const ifaceFields  = extractInterfaceFields(typesSrc, ifaceName);
  const schemaFields = extractSchemaFields(schemaSrc, schemaName);

  if (ifaceFields === null) {
    fail(`Could not parse interface '${ifaceName}' from ${TYPES_FILE}`);
    continue;
  }
  if (schemaFields === null) {
    fail(`Could not parse schema '${schemaName}' from ${SCHEMA_FILE}`);
    continue;
  }

  // Debug output: show what was extracted (sample-read verification)
  console.log(`\n[check-deck-schema-drift] ${ifaceName}:`);
  console.log(`  Interface fields (${ifaceFields.size}): ${[...ifaceFields].sort().join(', ')}`);
  console.log(`  Schema fields    (${schemaFields.size}): ${[...schemaFields].sort().join(', ')}`);

  const missingInSchema   = [...ifaceFields].filter(f => !schemaFields.has(f));
  const extraInSchema     = [...schemaFields].filter(f => !ifaceFields.has(f));

  if (missingInSchema.length === 0 && extraInSchema.length === 0) {
    pass(`${ifaceName} ↔ ${schemaName}: all ${ifaceFields.size} fields match`);
  } else {
    if (missingInSchema.length > 0) {
      fail(
        `${ifaceName} has fields NOT in ${schemaName}: ${missingInSchema.join(', ')}\n` +
        `  → Add these to the z.object({}) block in src/data/curatedDeckSchema.ts`
      );
    }
    if (extraInSchema.length > 0) {
      fail(
        `${schemaName} has keys NOT in ${ifaceName}: ${extraInSchema.join(', ')}\n` +
        `  → These were probably renamed in the interface but not the schema. ` +
        `Remove or rename them in src/data/curatedDeckSchema.ts`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

if (process.exitCode === 1) {
  console.error('\n[check-deck-schema-drift] FAILED — fix the drift violations above before committing.');
  console.error('  Interface source: src/data/curatedDeckTypes.ts');
  console.error('  Schema source:    src/data/curatedDeckSchema.ts');
} else {
  console.log('\n[check-deck-schema-drift] All schema/interface pairs match. No drift detected.');
}
