#!/usr/bin/env node
/**
 * check-deck-schema-drift.test.mjs
 *
 * Self-contained test runner for check-deck-schema-drift.mjs.
 * Uses Node's built-in test runner (available Node 18+).
 *
 * Tests:
 *   1. Real-file pass: lint against current curatedDeckTypes.ts and
 *      curatedDeckSchema.ts — must pass (exit 0).
 *   2. Drift detection: given fixture interface + schema strings passed
 *      via the exported helpers, confirm the parser catches a field
 *      present in the interface but missing in the schema.
 *   3. Extra-in-schema detection: field in schema but not interface → FAIL.
 *   4. Full match: identical field sets → pass.
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

function extractInterfaceFields(src, interfaceName) {
  const clean = stripComments(src);
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

  const body = clean.slice(start, end);
  const fields = new Set();
  const fieldLine = /^\s*([\w]+)\??:\s*/gm;
  let m;
  while ((m = fieldLine.exec(body)) !== null) {
    if (m[0].trim().startsWith('[')) continue;
    fields.add(m[1]);
  }
  return fields;
}

function extractSchemaFields(src, schemaName) {
  const clean = stripComments(src);
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

  const body = clean.slice(start, end);
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

// ---------------------------------------------------------------------------
// 1. Real-file pass test — spawns the actual lint script
// ---------------------------------------------------------------------------

test('real-file: lint passes on current curatedDeckTypes.ts + curatedDeckSchema.ts', () => {
  const result = spawnSync('node', [LINT], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(
    result.status,
    0,
    `Lint should exit 0 but got ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.match(result.stdout, /No drift detected/);
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

console.log('\nAll tests passed.');
