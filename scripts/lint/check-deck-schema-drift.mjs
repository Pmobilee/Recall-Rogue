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
 * Two classes of drift detected:
 *   1. Field-name drift: a field exists in one side but not the other.
 *   2. Required/optional drift: a field is required on one side but
 *      optional on the other — a validation hole (schema passes rows
 *      missing a required field, or rejects rows the interface says are valid).
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
 *   0 — all field sets match and optionality aligns
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
 * Extract interface body text via brace-counting.
 * Returns the inner body string, or null if the interface is not found.
 */
function extractInterfaceBody(clean, interfaceName) {
  const startPattern = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}(?:\\s+extends\\s+\\w+)?\\s*\\{`
  );
  const startMatch = startPattern.exec(clean);
  if (!startMatch) return null;

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
  return clean.slice(start, end);
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
  const body = extractInterfaceBody(clean, interfaceName);
  if (body === null) return null;

  const fields = new Set();
  const fieldLine = /^\s*([\w]+)\??:\s*/gm;
  let m;
  while ((m = fieldLine.exec(body)) !== null) {
    if (m[0].trim().startsWith('[')) continue;
    fields.add(m[1]);
  }
  return fields;
}

/**
 * Extract field names WITH optionality from a TypeScript interface body.
 *
 * Returns Map<string, boolean> where true = optional (field has `?` before `:`).
 * Method signatures (have parens) and index signatures (start with `[`) are skipped.
 */
function extractInterfaceFieldOptional(src, interfaceName) {
  const clean = stripComments(src);
  const body = extractInterfaceBody(clean, interfaceName);
  if (body === null) return null;

  const result = new Map();
  // Capture group 1 = field name, group 2 = optional marker (? or empty)
  const fieldLine = /^\s*([\w]+)(\?)?\s*:\s*/gm;
  let m;
  while ((m = fieldLine.exec(body)) !== null) {
    if (m[0].trim().startsWith('[')) continue;
    const fieldName = m[1];
    const isOptional = m[2] === '?';
    result.set(fieldName, isOptional);
  }
  return result;
}

/**
 * Extract z.object body text via brace-counting.
 * Returns the inner body string, or null if the schema is not found.
 */
function extractSchemaBody(clean, schemaName) {
  const startPattern = new RegExp(
    `(?:export\\s+)?const\\s+${schemaName}\\s*=\\s*z\\.object\\s*\\(`
  );
  const startMatch = startPattern.exec(clean);
  if (!startMatch) return null;

  let braceStart = clean.indexOf('{', startMatch.index + startMatch[0].length - 1);
  if (braceStart === -1) return null;

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
  return clean.slice(start, end);
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
  const body = extractSchemaBody(clean, schemaName);
  if (body === null) return null;

  const fields = new Set();
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

/**
 * Extract key names WITH optionality from a z.object({ ... }) block.
 *
 * A schema field is considered optional when its full value expression
 * (which may span multiple lines for nested objects/arrays) contains any of:
 *   - .optional()
 *   - .nullish()
 *   - .default(   — supplies a default, so the field is not required
 *
 * Returns Map<string, boolean> where true = optional.
 *
 * Strategy: collect the full value text per top-level key by walking the body
 * character-by-character with depth tracking. Each time a top-level key ends
 * (i.e. depth returns to 0 and we hit a comma or the outer closing brace),
 * we inspect the accumulated value text for optionality markers.
 */
function extractSchemaFieldOptional(src, schemaName) {
  const clean = stripComments(src);
  const body = extractSchemaBody(clean, schemaName);
  if (body === null) return null;

  const result = new Map();

  // Walk character by character, collecting top-level key→value pairs.
  // A top-level entry looks like:  fieldName: <value expression>,
  // where <value expression> may contain nested {}, (), [].
  let i = 0;
  const n = body.length;

  while (i < n) {
    // Skip whitespace between entries
    while (i < n && /\s/.test(body[i])) i++;
    if (i >= n) break;

    // Try to read a field name (word chars)
    const nameMatch = /^([\w]+)\s*:/.exec(body.slice(i));
    if (!nameMatch) {
      // Not a key line — skip to next line
      while (i < n && body[i] !== '\n') i++;
      i++; // skip newline
      continue;
    }

    const fieldName = nameMatch[1];
    // Advance past the matched key + colon
    i += nameMatch[0].length;

    // Now collect the value expression until we return to depth 0 at a comma
    // (end of this entry) or run out of body.
    let depth = 0;
    let valueStart = i;
    while (i < n) {
      const ch = body[i];
      if (ch === '{' || ch === '(' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ')' || ch === ']') {
        if (depth === 0) {
          // We've hit the outer closing brace — end of all entries
          break;
        }
        depth--;
      } else if (ch === ',' && depth === 0) {
        // End of this field's value
        i++; // skip comma
        break;
      }
      i++;
    }

    const valueExpr = body.slice(valueStart, i).trim();

    // A field is optional in the schema if its value expression contains
    // .optional(), .nullish(), or .default( (anywhere, including after a
    // multi-line nested z.array(...).optional() call).
    const isOptional =
      /\.optional\s*\(/.test(valueExpr) ||
      /\.nullish\s*\(/.test(valueExpr) ||
      /\.default\s*\(/.test(valueExpr);

    result.set(fieldName, isOptional);
  }

  return result;
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

  // ---------------------------------------------------------------------------
  // Required/optional alignment check
  // ---------------------------------------------------------------------------
  // Only run when field names already match (avoids confusing double-errors).

  if (missingInSchema.length === 0 && extraInSchema.length === 0) {
    const ifaceOptional  = extractInterfaceFieldOptional(typesSrc, ifaceName);
    const schemaOptional = extractSchemaFieldOptional(schemaSrc, schemaName);

    if (ifaceOptional === null) {
      fail(`Could not parse interface optionality for '${ifaceName}'`);
      continue;
    }
    if (schemaOptional === null) {
      fail(`Could not parse schema optionality for '${schemaName}'`);
      continue;
    }

    // Print optionality pairs for sample-read verification
    console.log(`  Optionality (interface required / schema required):`);
    for (const [field, ifaceOpt] of [...ifaceOptional.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const schemaOpt = schemaOptional.get(field);
      const iReq = ifaceOpt ? 'optional' : 'required';
      const sReq = schemaOpt ? 'optional' : 'required';
      const marker = (ifaceOpt !== schemaOpt) ? ' ← MISMATCH' : '';
      console.log(`    ${field}: interface=${iReq}, schema=${sReq}${marker}`);
    }

    let optionalityMismatch = false;
    for (const [field, ifaceOpt] of ifaceOptional.entries()) {
      const schemaOpt = schemaOptional.get(field);
      if (schemaOpt === undefined) continue; // already caught by field-name diff

      if (!ifaceOpt && schemaOpt) {
        // Required in interface, optional in schema → validation hole
        fail(
          `${ifaceName}.${field}: required in interface but optional in schema — ` +
          `this is a validation hole (schema passes rows missing a required field)`
        );
        optionalityMismatch = true;
      } else if (ifaceOpt && !schemaOpt) {
        // Optional in interface, required in schema → schema rejects valid data
        fail(
          `${ifaceName}.${field}: optional in interface but required in schema — ` +
          `schema rejects rows the interface says are valid`
        );
        optionalityMismatch = true;
      }
    }

    if (!optionalityMismatch) {
      pass(`${ifaceName} ↔ ${schemaName}: optionality alignment ok (${ifaceOptional.size} fields)`);
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
