#!/usr/bin/env node
/**
 * fix-categories.mjs
 *
 * Fixes truly miscategorized facts in public/facts.db:
 *
 *   1. Opera facts sitting in art_architecture / architectural_styles
 *      → move to art_architecture / music_performance
 *
 *   2. Chemistry-element facts sitting in food_cuisine / food_science
 *      (sodium isolation, magnesium body/seawater rank, manganese isolation year)
 *      → move to natural_sciences / chemistry_elements
 *      NOTE: "pie element" and food-context sodium/magnesium stay in food_cuisine
 *
 * Usage:
 *   node scripts/fix-categories.mjs           # dry run (no changes)
 *   node scripts/fix-categories.mjs --apply   # actually update the DB
 */

import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const APPLY = process.argv.includes('--apply');

const dbPath = path.join(ROOT, 'public', 'facts.db');
const db = new Database(dbPath);

// ── define fixes ──────────────────────────────────────────────────────────────

/**
 * Each fix has:
 *   label      — human-readable description
 *   ids        — explicit list of fact IDs to update (most reliable)
 *   query      — optional: SQL SELECT to discover IDs dynamically (printed in dry run)
 *   newL1      — new category_l1
 *   newL2      — new category_l2
 */

// Fix 1: Opera facts in architectural_styles → music_performance
// Discovered via: SELECT id FROM facts WHERE category_l1='art_architecture'
//                  AND category_l2='architectural_styles' AND id LIKE '%opera%'
const OPERA_FIXES = {
  label: 'Opera facts: art_architecture/architectural_styles → art_architecture/music_performance',
  discoverySQL: `
    SELECT id, quiz_question, category_l1, category_l2
    FROM facts
    WHERE category_l1 = 'art_architecture'
      AND category_l2 = 'architectural_styles'
      AND id LIKE '%opera%'
  `.trim(),
  newL1: 'art_architecture',
  newL2: 'music_performance',
};

// Fix 2: Misplaced chemistry-element facts in food_cuisine
// These are genuinely about chemistry/elements, not food.
//   - food_cuisine-sodium-essential-nerve-cells  (who isolated sodium in 1807)
//   - food-magnesium-body-abundance              (rank of Mg in human body by mass)
//   - food-magnesium-seawater-rank               (rank of Mg in seawater)
//   - food-manganese-discovery-year              (year Mn was first isolated)
//
// Excluded (legitimately food-related):
//   - food_cuisine-pie-ancient-roman-coffin      (what defines a "pie" — the "element" is structural, not chemical)
const ELEMENT_IDS_TO_MOVE = [
  'food_cuisine-sodium-essential-nerve-cells',
  'food-magnesium-body-abundance',
  'food-magnesium-seawater-rank',
  'food-manganese-discovery-year',
];

const ELEMENT_FIXES = {
  label: 'Chemistry-element facts: food_cuisine/food_science → natural_sciences/chemistry_elements',
  ids: ELEMENT_IDS_TO_MOVE,
  newL1: 'natural_sciences',
  newL2: 'chemistry_elements',
};

// Fix 3: Zirconium (science-zirconium-deodorant-dental)
// Question: "Which surprisingly everyday product contains zirconium?"
// Category: natural_sciences / chemistry_elements — CORRECT as-is.
// Decision: leave it. No action needed.
const ZIRCONIUM_NOTE = `
  science-zirconium-deodorant-dental:
    Question is "Which everyday product contains zirconium?" — about a chemical element's
    consumer applications. Already in natural_sciences/chemistry_elements. No change needed.
`.trim();

// ── helpers ───────────────────────────────────────────────────────────────────

function discoverIDs(sql) {
  return db.prepare(sql).all().map(r => r.id);
}

function printFix(label, ids, newL1, newL2) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`FIX: ${label}`);
  console.log(`  Target: category_l1='${newL1}', category_l2='${newL2}'`);
  console.log(`  Facts affected (${ids.length}):`);
  ids.forEach(id => {
    const row = db.prepare('SELECT id, quiz_question, category_l1, category_l2 FROM facts WHERE id=?').get(id);
    if (row) {
      console.log(`    ${id}`);
      console.log(`      Q: ${row.quiz_question}`);
      console.log(`      From: ${row.category_l1} / ${row.category_l2}`);
      console.log(`      To  : ${newL1} / ${newL2}`);
    } else {
      console.log(`    ${id}  ← NOT FOUND IN DB (skip)`);
    }
  });
}

// ── discover IDs ──────────────────────────────────────────────────────────────

const operaIDs = discoverIDs(OPERA_FIXES.discoverySQL);

// ── report ────────────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log(APPLY ? 'MODE: APPLY (changes WILL be written to DB)' : 'MODE: DRY RUN (no changes)');
console.log('='.repeat(72));

printFix(OPERA_FIXES.label, operaIDs, OPERA_FIXES.newL1, OPERA_FIXES.newL2);
printFix(ELEMENT_FIXES.label, ELEMENT_FIXES.ids, ELEMENT_FIXES.newL1, ELEMENT_FIXES.newL2);

console.log(`\n${'─'.repeat(72)}`);
console.log('NOTE — Zirconium fact:');
console.log(' ', ZIRCONIUM_NOTE);

const totalFixes = operaIDs.length + ELEMENT_FIXES.ids.length;
console.log(`\n${'─'.repeat(72)}`);
console.log('Summary:');
console.log(`  Opera fixes           : ${operaIDs.length}`);
console.log(`  Chemistry-element fixes: ${ELEMENT_FIXES.ids.length}`);
console.log(`  Total facts to update : ${totalFixes}`);
console.log('─'.repeat(72));

// ── apply ─────────────────────────────────────────────────────────────────────

if (APPLY) {
  const updateStmt = db.prepare(
    'UPDATE facts SET category_l1 = ?, category_l2 = ? WHERE id = ?'
  );

  const applyAll = db.transaction(() => {
    let updated = 0;

    for (const id of operaIDs) {
      const info = updateStmt.run(OPERA_FIXES.newL1, OPERA_FIXES.newL2, id);
      if (info.changes === 0) console.warn(`  WARNING: no row updated for id=${id}`);
      else updated++;
    }

    for (const id of ELEMENT_FIXES.ids) {
      const info = updateStmt.run(ELEMENT_FIXES.newL1, ELEMENT_FIXES.newL2, id);
      if (info.changes === 0) console.warn(`  WARNING: no row updated for id=${id}`);
      else updated++;
    }

    return updated;
  });

  const updated = applyAll();
  console.log();
  console.log(`APPLIED: ${updated} facts updated in ${dbPath}`);
} else {
  console.log();
  console.log('DRY RUN complete. Pass --apply to write changes to the database.');
}

db.close();
