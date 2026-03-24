#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const FIXES_FILE = path.join(projectRoot, 'data', 'llm-fixes.json');
const DB_PATH = path.join(projectRoot, 'public', 'facts.db');

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const isApply = process.argv.includes('--apply');

if (isDryRun && isApply) {
  console.error('Error: cannot specify both --dry-run and --apply');
  process.exit(1);
}

console.log(`Mode: ${isDryRun ? 'DRY-RUN (no changes)' : 'APPLY (will modify database)'}`);
console.log(`Fixes file: ${FIXES_FILE}`);
console.log(`Database: ${DB_PATH}`);
console.log('');

// Validate files exist
if (!fs.existsSync(FIXES_FILE)) {
  console.error(`Error: fixes file not found: ${FIXES_FILE}`);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Error: database not found: ${DB_PATH}`);
  process.exit(1);
}

// Read fixes
let fixes;
try {
  const content = fs.readFileSync(FIXES_FILE, 'utf-8');
  fixes = JSON.parse(content);
  if (!Array.isArray(fixes)) {
    throw new Error('Expected array at root of JSON');
  }
} catch (err) {
  console.error(`Error reading fixes: ${err.message}`);
  process.exit(1);
}

console.log(`Loaded ${fixes.length} fixes from ${path.basename(FIXES_FILE)}`);
console.log('');

// Open database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

let applied = 0;
let skipped = 0;
let notFound = 0;

// Process each fix
for (const fix of fixes) {
  const { id, field, old: oldValue, new: newValue } = fix;

  // Validate fix structure
  if (!id || !field || oldValue === undefined || newValue === undefined) {
    console.warn(`⚠️  Skipped malformed fix: ${JSON.stringify(fix)}`);
    skipped++;
    continue;
  }

  // Read current value
  const row = db.prepare('SELECT * FROM facts WHERE id = ?').get(id);
  if (!row) {
    console.log(`❌ Not found: ${id}`);
    notFound++;
    continue;
  }

  const currentValue = row[field];
  if (currentValue === undefined) {
    console.warn(`⚠️  Field ${field} does not exist on fact ${id}`);
    skipped++;
    continue;
  }

  // Safety check: only apply if value matches expected old value
  if (currentValue !== oldValue) {
    console.log(`⏭️  Skipped (changed): ${id}.${field} (current ≠ expected)`);
    skipped++;
    continue;
  }

  // Apply fix
  if (isDryRun) {
    console.log(`✓ [DRY-RUN] Would update ${id}.${field}`);
    applied++;
  } else {
    try {
      const updateStmt = db.prepare(`UPDATE facts SET ${field} = ? WHERE id = ?`);
      updateStmt.run(newValue, id);
      console.log(`✓ Updated ${id}.${field}`);
      applied++;
    } catch (err) {
      console.error(`✗ Failed to update ${id}.${field}: ${err.message}`);
      skipped++;
    }
  }
}

db.close();

console.log('');
console.log('═'.repeat(50));
console.log(`Results:`);
console.log(`  Applied:  ${applied}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Not found: ${notFound}`);
console.log('═'.repeat(50));

if (isDryRun && applied > 0) {
  console.log('');
  console.log('To apply these changes, run with --apply flag:');
  console.log('  node scripts/apply-llm-fixes.mjs --apply');
}

process.exit(applied === 0 && notFound === 0 && skipped === 0 ? 1 : 0);
