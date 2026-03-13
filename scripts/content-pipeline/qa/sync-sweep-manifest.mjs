/**
 * sync-sweep-manifest.mjs
 *
 * Two tasks:
 *  1. Sync manifest batch statuses: mark batches as "done" if a result file exists
 *     with at least 1 line.
 *  2. Fix French vocab contamination: for all vocab-fr result files, set the `e`
 *     field to null on any line where it starts with "Fixed:".
 *
 * Usage: node scripts/content-pipeline/qa/sync-sweep-manifest.mjs
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve project root (3 dirs up: qa/ → content-pipeline/ → scripts/ → root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const SWEEP_DIR = join(PROJECT_ROOT, 'data', 'generated', 'quality-sweep');
const MANIFEST_PATH = join(SWEEP_DIR, 'manifest.json');
const RESULTS_DIR = join(SWEEP_DIR, 'results');

// ---------------------------------------------------------------------------
// Task 1: Sync manifest with result files
// ---------------------------------------------------------------------------
async function syncManifest() {
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);

  let syncedCount = 0;

  for (const batch of manifest.batches) {
    if (batch.status === 'done') continue;

    // Map batches/group/batch-NNN.jsonl → results/group/batch-NNN.jsonl
    const relativePath = batch.file.replace(/^batches\//, '');
    const resultPath = join(RESULTS_DIR, relativePath);

    let lines = 0;
    try {
      const content = await readFile(resultPath, 'utf8');
      lines = content.trim().split('\n').filter(Boolean).length;
    } catch {
      // File doesn't exist — leave status as-is
      continue;
    }

    if (lines >= 1) {
      batch.status = 'done';
      syncedCount++;
    }
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifest sync: ${syncedCount} batch(es) marked as "done".`);
}

// ---------------------------------------------------------------------------
// Task 2: Fix French vocab contamination
// ---------------------------------------------------------------------------
async function fixFrenchContamination() {
  const frDir = join(RESULTS_DIR, 'vocab-fr');

  let files;
  try {
    files = (await readdir(frDir)).filter(f => f.endsWith('.jsonl'));
  } catch {
    console.log('vocab-fr results directory not found — skipping French fix.');
    return;
  }

  let totalCleaned = 0;

  for (const file of files) {
    const filePath = join(frDir, file);
    const raw = await readFile(filePath, 'utf8');
    const lines = raw.split('\n');

    let fileCleaned = 0;
    const cleaned = lines.map(line => {
      if (!line.trim()) return line;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        return line; // Leave unparseable lines untouched
      }

      if (typeof obj.e === 'string' && obj.e.startsWith('Fixed:')) {
        obj.e = null;
        fileCleaned++;
      }

      return JSON.stringify(obj);
    });

    if (fileCleaned > 0) {
      await writeFile(filePath, cleaned.join('\n'), 'utf8');
      totalCleaned += fileCleaned;
      console.log(`  ${file}: cleared ${fileCleaned} contaminated "e" field(s).`);
    }
  }

  console.log(`French vocab fix: ${totalCleaned} row(s) cleaned across ${files.length} file(s).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== sync-sweep-manifest ===\n');

  await syncManifest();
  console.log();
  await fixFrenchContamination();

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
