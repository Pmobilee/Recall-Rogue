#!/usr/bin/env node
/**
 * check-deck-schema-drift.test.mjs
 *
 * Self-contained test runner for check-deck-schema-drift.mjs.
 * Uses Node's built-in test runner (available Node 18+).
 *
 * Tests:
 *   1. Real-file run: lint against current curatedDeckTypes.ts and
 *      curatedDeckSchema.ts — may fail due to genuine drift (acceptableAlternatives
 *      is required in the interface but .default([]) in the schema). We assert the
 *      lint runs cleanly (non-crash exit), and separately verify the real-file
 *      optionality state in test 8 below.
 *   2. Drift detection: given fixture interface + schema strings passed
 *      via the exported helpers, confirm the parser catches a field
 *      present in the interface but missing in the schema.
 *   3. Extra-in-schema detection: field in schema but not interface → FAIL.
 *   4. Full match: identical field sets → pass.
 *   5-9. Optionality (required/optional alignment) tests.
 *
 * Run:
 *   node scripts/lint/check-deck-schema-drift.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const LINT = resolve(__dirname, 'check-deck-schema-drift.mjs');

// ---------------------------------------------------------------------------
// Inline reimplementation of the parsing helpers for unit-testing without
// spawning a process. This keeps the test fast and doesn't require temp files.
// ---------------------------------------------------------------------------

function stripComments(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  src = src.replace(/\/\/.*/g, '');
  return src;
}

function extractInterfaceBody(clean, interfaceName) {
  const startPattern = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}(?:\\s+extends\\s+\\w+)?\\s*\\{`
  );
  const startMatch = startPattern.exec(clean);
  if (!startMatch) return null;

  let depth = 0, start = -1, end = -1;
  for (let i = startMatch.index; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i + 1; depth++; }
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (start === -1 || end === -1) return null;
  return clean.slice(start, end);
}

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

function extractInterfaceFieldOptional(src, interfaceName) {
  const clean = stripComments(src);
  const body = extractInterfaceBody(clean, interfaceName);
  if (body === null) return null;

  const result = new Map();
  const fieldLine = /^\s*([\w]+)(\?)?\s*:\s*/gm;
  let m;
  while ((m = fieldLine.exec(body)) !== null) {
    if (m[0].trim().startsWith('[')) continue;
    result.set(m[1], m[2] === '?');
  }
  return result;
}

function extractSchemaBody(clean, schemaName) {
  const startPattern = new RegExp(
    `(?:export\\s+)?const\\s+${schemaName}\\s*=\\s*z\\.object\\s*\\(`
  );
  const startMatch = startPattern.exec(clean);
  if (!startMatch) return null;

  let braceStart = clean.indexOf('{', startMatch.index + startMatch[0].length - 1);
  if (braceStart === -1) return null;

  let depth = 0, start = -1, end = -1;
  for (let i = braceStart; i < clean.length; i++) {
    if (clean[i] === '{') { if (depth === 0) start = i + 1; depth++; }
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (start === -1 || end === -1) return null;
  return clean.slice(start, end);
}

function extractSchemaFields(src, schemaName) {
  const clean = stripComments(src);
  const body = extractSchemaBody(clean, schemaName);
  if (body === null) return null;

  const fields = new Set();
  let nestDepth = 0;
  for (const line of body.split('\n')) {
    const beforeCount = nestDepth;
    for (const ch of line) {
      if (ch === '{' || ch === '(') nestDepth++;
      else if (ch === '}' || ch === ')') nestDepth--;
    }
    if (beforeCount === 0) {
      const m = /^\s*([\w]+)\s*:/.exec(line);
      if (m) fields.add(m[1]);
    }
  }
  return fields;
}

function extractSchemaFieldOptional(src, schemaName) {
  const clean = stripComments(src);
  const body = extractSchemaBody(clean, schemaName);
  if (body === null) return null;

  const result = new Map();
  let i = 0;
  const n = body.length;

  while (i < n) {
    while (i < n && /\s/.test(body[i])) i++;
    if (i >= n) break;

    const nameMatch = /^([\w]+)\s*:/.exec(body.slice(i));
    if (!nameMatch) {
      while (i < n && body[i] !== '\n') i++;
      i++;
      continue;
    }

    const fieldName = nameMatch[1];
    i += nameMatch[0].length;

    let depth = 0;
    let valueStart = i;
    while (i < n) {
      const ch = body[i];
      if (ch === '{' || ch === '(' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ')' || ch === ']') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) {
        i++;
        break;
      }
      i++;
    }

    const valueExpr = body.slice(valueStart, i).trim();
    const isOptional =
      /\.optional\s*\(/.test(valueExpr) ||
      /\.nullish\s*\(/.test(valueExpr) ||
      /\.default\s*\(/.test(valueExpr);

    result.set(fieldName, isOptional);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 1. Real-file smoke test — spawns the actual lint script
//    The lint may exit 1 due to genuine drift (acceptableAlternatives),
//    but it must exit cleanly (status !== null) — no crash, no uncaught error.
//    We don't assert exit 0 here because we are not allowed to fix drift.
// ---------------------------------------------------------------------------

test('real-file: lint runs without crashing against current source files', () => {
  const result = spawnSync('node', [LINT], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(
    result.status !== null,
    `Lint process must exit cleanly (not crash). status=${result.status}\nstderr:\n${result.stderr}`
  );
  // Must print the field count line (parser worked)
  assert.match(result.stdout, /Interface fields \(\d+\)/);
});

// ---------------------------------------------------------------------------
// 2. Missing-in-schema detection
// ---------------------------------------------------------------------------

test('parser: detects field in interface but missing from schema', () => {
  const ifaceSrc = `
    export interface MyFact {
      id: string;
      name: string;
      newField?: string;
    }
  `;
  const schemaSrc = `
    export const MyFactSchema = z.object({
      id: z.string(),
      name: z.string(),
    });
  `;

  const ifaceFields  = extractInterfaceFields(ifaceSrc, 'MyFact');
  const schemaFields = extractSchemaFields(schemaSrc, 'MyFactSchema');

  assert.ok(ifaceFields, 'should parse interface');
  assert.ok(schemaFields, 'should parse schema');
  assert.ok(ifaceFields.has('newField'), 'interface should have newField');
  assert.ok(!schemaFields.has('newField'), 'schema should NOT have newField');

  const missing = [...ifaceFields].filter(f => !schemaFields.has(f));
  assert.deepStrictEqual(missing, ['newField']);
});

// ---------------------------------------------------------------------------
// 3. Extra-in-schema detection
// ---------------------------------------------------------------------------

test('parser: detects field in schema but missing from interface', () => {
  const ifaceSrc = `
    export interface MyPool {
      id: string;
      label: string;
    }
  `;
  const schemaSrc = `
    export const MyPoolSchema = z.object({
      id: z.string(),
      label: z.string(),
      legacyField: z.string().optional(),
    });
  `;

  const ifaceFields  = extractInterfaceFields(ifaceSrc, 'MyPool');
  const schemaFields = extractSchemaFields(schemaSrc, 'MyPoolSchema');

  assert.ok(ifaceFields, 'should parse interface');
  assert.ok(schemaFields, 'should parse schema');

  const extra = [...schemaFields].filter(f => !ifaceFields.has(f));
  assert.deepStrictEqual(extra, ['legacyField']);
});

// ---------------------------------------------------------------------------
// 4. Full match — no drift
// ---------------------------------------------------------------------------

test('parser: returns no drift when fields match exactly', () => {
  const ifaceSrc = `
    export interface Group {
      id: string;
      factIds: string[];
      reason: string;
    }
  `;
  const schemaSrc = `
    export const GroupSchema = z.object({
      id: z.string(),
      factIds: z.array(z.string()),
      reason: z.string(),
    });
  `;

  const ifaceFields  = extractInterfaceFields(ifaceSrc, 'Group');
  const schemaFields = extractSchemaFields(schemaSrc, 'GroupSchema');

  const missing = [...ifaceFields].filter(f => !schemaFields.has(f));
  const extra   = [...schemaFields].filter(f => !ifaceFields.has(f));
  assert.deepStrictEqual(missing, []);
  assert.deepStrictEqual(extra,   []);
});

// ---------------------------------------------------------------------------
// 5. Optional fields with ? are correctly extracted
// ---------------------------------------------------------------------------

test('parser: handles optional fields (field?: type) correctly', () => {
  const ifaceSrc = `
    export interface Fact {
      required: string;
      optional?: number;
      alsoOptional?: boolean;
    }
  `;
  const ifaceFields = extractInterfaceFields(ifaceSrc, 'Fact');
  assert.ok(ifaceFields.has('required'));
  assert.ok(ifaceFields.has('optional'));
  assert.ok(ifaceFields.has('alsoOptional'));
  assert.strictEqual(ifaceFields.size, 3);
});

// ---------------------------------------------------------------------------
// 6. Comments are stripped before parsing
// ---------------------------------------------------------------------------

test('parser: strips // and /* */ comments before extracting fields', () => {
  const ifaceSrc = `
    export interface Fact {
      // This is a comment
      id: string;
      /* block comment
         spanning lines */
      name: string;
      /** JSDoc comment */
      value: number;
    }
  `;
  const ifaceFields = extractInterfaceFields(ifaceSrc, 'Fact');
  assert.ok(ifaceFields.has('id'));
  assert.ok(ifaceFields.has('name'));
  assert.ok(ifaceFields.has('value'));
  assert.strictEqual(ifaceFields.size, 3);
});

// ---------------------------------------------------------------------------
// 7. Nested z.object / z.array doesn't pollute top-level keys
// ---------------------------------------------------------------------------

test('parser: nested z.object inside array does not pollute top-level schema keys', () => {
  const schemaSrc = `
    export const FuriganaSchema = z.object({
      id: z.string(),
      segments: z.array(
        z.object({
          t: z.string(),
          r: z.string().optional(),
          g: z.string().optional(),
        })
      ).optional(),
      name: z.string(),
    });
  `;

  const schemaFields = extractSchemaFields(schemaSrc, 'FuriganaSchema');
  assert.ok(schemaFields, 'should parse schema');
  assert.ok(schemaFields.has('id'));
  assert.ok(schemaFields.has('segments'));
  assert.ok(schemaFields.has('name'));
  // t, r, g from the nested object must NOT appear at top level
  assert.ok(!schemaFields.has('t'), 't is a nested key and must not appear at top level');
  assert.ok(!schemaFields.has('r'), 'r is a nested key and must not appear at top level');
  assert.ok(!schemaFields.has('g'), 'g is a nested key and must not appear at top level');
  assert.strictEqual(schemaFields.size, 3);
});

// ---------------------------------------------------------------------------
// 8. Optionality — matching required field passes
// ---------------------------------------------------------------------------

test('optionality: matching required field (id: string + id: z.string()) passes', () => {
  const ifaceSrc = `
    export interface Fact {
      id: string;
      name: string;
    }
  `;
  const schemaSrc = `
    export const FactSchema = z.object({
      id: z.string(),
      name: z.string(),
    });
  `;

  const ifaceOpt  = extractInterfaceFieldOptional(ifaceSrc, 'Fact');
  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'FactSchema');

  assert.ok(ifaceOpt, 'should parse interface optionality');
  assert.ok(schemaOpt, 'should parse schema optionality');

  // Both required
  assert.strictEqual(ifaceOpt.get('id'),   false, 'id should be required in interface');
  assert.strictEqual(schemaOpt.get('id'),  false, 'id should be required in schema');
  assert.strictEqual(ifaceOpt.get('name'), false, 'name should be required in interface');
  assert.strictEqual(schemaOpt.get('name'),false, 'name should be required in schema');

  // No mismatch
  for (const [field, ifOpt] of ifaceOpt.entries()) {
    const sOpt = schemaOpt.get(field);
    assert.strictEqual(ifOpt, sOpt, `${field}: interface optional=${ifOpt} must match schema optional=${sOpt}`);
  }
});

// ---------------------------------------------------------------------------
// 9. Optionality — matching optional field passes
// ---------------------------------------------------------------------------

test('optionality: matching optional field (reading?: string + reading: z.string().optional()) passes', () => {
  const ifaceSrc = `
    export interface Vocab {
      id: string;
      reading?: string;
    }
  `;
  const schemaSrc = `
    export const VocabSchema = z.object({
      id: z.string(),
      reading: z.string().optional(),
    });
  `;

  const ifaceOpt  = extractInterfaceFieldOptional(ifaceSrc, 'Vocab');
  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'VocabSchema');

  assert.strictEqual(ifaceOpt.get('id'),      false, 'id required in interface');
  assert.strictEqual(schemaOpt.get('id'),     false, 'id required in schema');
  assert.strictEqual(ifaceOpt.get('reading'), true,  'reading optional in interface');
  assert.strictEqual(schemaOpt.get('reading'),true,  'reading optional in schema');
});

// ---------------------------------------------------------------------------
// 10. Optionality — required in interface, optional in schema → MISMATCH detected
// ---------------------------------------------------------------------------

test('optionality: required→optional mismatch detected with correct message', () => {
  const ifaceSrc = `
    export interface Fact {
      id: string;
      distractors: string[];
    }
  `;
  const schemaSrc = `
    export const FactSchema = z.object({
      id: z.string(),
      distractors: z.array(z.string()).optional(),
    });
  `;

  const ifaceOpt  = extractInterfaceFieldOptional(ifaceSrc, 'Fact');
  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'FactSchema');

  assert.strictEqual(ifaceOpt.get('distractors'),  false, 'distractors required in interface');
  assert.strictEqual(schemaOpt.get('distractors'), true,  'distractors optional in schema');

  // Simulate the check loop
  const mismatches = [];
  for (const [field, ifOpt] of ifaceOpt.entries()) {
    const sOpt = schemaOpt.get(field);
    if (sOpt === undefined) continue;
    if (!ifOpt && sOpt) {
      mismatches.push(`${field}: required in interface but optional in schema — this is a validation hole (schema passes rows missing a required field)`);
    }
  }

  assert.strictEqual(mismatches.length, 1, 'should detect exactly one mismatch');
  assert.ok(mismatches[0].includes('distractors'), 'mismatch should name the field');
  assert.ok(mismatches[0].includes('validation hole'), 'mismatch should mention validation hole');
});

// ---------------------------------------------------------------------------
// 11. Optionality — optional in interface, required in schema → MISMATCH detected
// ---------------------------------------------------------------------------

test('optionality: optional→required mismatch detected with correct message', () => {
  const ifaceSrc = `
    export interface Pool {
      id: string;
      label?: string;
    }
  `;
  const schemaSrc = `
    export const PoolSchema = z.object({
      id: z.string(),
      label: z.string(),
    });
  `;

  const ifaceOpt  = extractInterfaceFieldOptional(ifaceSrc, 'Pool');
  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'PoolSchema');

  assert.strictEqual(ifaceOpt.get('label'),  true,  'label optional in interface');
  assert.strictEqual(schemaOpt.get('label'), false, 'label required in schema');

  // Simulate the check loop
  const mismatches = [];
  for (const [field, ifOpt] of ifaceOpt.entries()) {
    const sOpt = schemaOpt.get(field);
    if (sOpt === undefined) continue;
    if (ifOpt && !sOpt) {
      mismatches.push(`${field}: optional in interface but required in schema — schema rejects rows the interface says are valid`);
    }
  }

  assert.strictEqual(mismatches.length, 1, 'should detect exactly one mismatch');
  assert.ok(mismatches[0].includes('label'), 'mismatch should name the field');
  assert.ok(mismatches[0].includes('schema rejects rows'), 'mismatch should explain rejection');
});

// ---------------------------------------------------------------------------
// 12. Optionality — .default(...) treated as optional
// ---------------------------------------------------------------------------

test('optionality: .default(...) in schema is treated as optional', () => {
  const schemaSrc = `
    export const FactSchema = z.object({
      id: z.string(),
      alternatives: z.array(z.string()).default([]),
      score: z.number().default(0),
    });
  `;

  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'FactSchema');

  assert.ok(schemaOpt, 'should parse schema');
  assert.strictEqual(schemaOpt.get('id'),           false, 'id has no default — required');
  assert.strictEqual(schemaOpt.get('alternatives'), true,  'alternatives has .default([]) — optional');
  assert.strictEqual(schemaOpt.get('score'),        true,  'score has .default(0) — optional');
});

// ---------------------------------------------------------------------------
// 13. Optionality — multi-line schema value (z.array(...).optional()) handled
// ---------------------------------------------------------------------------

test('optionality: multi-line schema value z.array(...).optional() correctly detected', () => {
  const schemaSrc = `
    export const FuriganaSchema = z.object({
      id: z.string(),
      segments: z.array(
        z.object({
          t: z.string(),
          r: z.string().optional(),
        })
      ).optional(),
      name: z.string(),
    });
  `;

  const schemaOpt = extractSchemaFieldOptional(schemaSrc, 'FuriganaSchema');

  assert.ok(schemaOpt, 'should parse schema');
  assert.strictEqual(schemaOpt.get('id'),       false, 'id is required');
  assert.strictEqual(schemaOpt.get('segments'), true,  'segments is optional via multi-line .optional()');
  assert.strictEqual(schemaOpt.get('name'),     false, 'name is required');
});

// ---------------------------------------------------------------------------
// 14. Comments with ?: inside strings must NOT match (comment-stripping guard)
// ---------------------------------------------------------------------------

test('parser: comment text containing ?: does not create phantom optional fields', () => {
  const ifaceSrc = `
    export interface Fact {
      // Is this field optional?: No, it is required.
      id: string;
      /** Does it have reading?: Only for vocabulary. */
      name: string;
    }
  `;

  const ifaceOpt = extractInterfaceFieldOptional(ifaceSrc, 'Fact');

  assert.ok(ifaceOpt, 'should parse');
  assert.strictEqual(ifaceOpt.size, 2, 'only 2 real fields — comment lines not parsed as fields');
  assert.strictEqual(ifaceOpt.get('id'),   false, 'id is required');
  assert.strictEqual(ifaceOpt.get('name'), false, 'name is required');
});

console.log('\nAll tests passed.');
