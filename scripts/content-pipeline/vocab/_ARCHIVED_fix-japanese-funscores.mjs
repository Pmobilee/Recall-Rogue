#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../../../data/raw/japanese');

// Map filename patterns to default funScore
const funScoreMap = {
  'vocab': 6,
  'kanji': 7,
  'grammar': 7,
  'kana': 5
};

/**
 * Determine funScore based on filename
 */
function getFunScoreFromFilename(filename) {
  for (const [pattern, score] of Object.entries(funScoreMap)) {
    if (filename.includes(pattern)) {
      return score;
    }
  }
  return 6; // default
}

/**
 * Process a single JSON file and add funScore to facts that don't have it
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const facts = JSON.parse(content);

    if (!Array.isArray(facts)) {
      console.warn(`Skipping ${path.basename(filePath)} - not an array`);
      return 0;
    }

    const filename = path.basename(filePath);
    const defaultScore = getFunScoreFromFilename(filename);

    let modified = 0;
    facts.forEach(fact => {
      if (fact && typeof fact === 'object' && !('funScore' in fact)) {
        fact.funScore = defaultScore;
        modified++;
      }
    });

    if (modified > 0) {
      fs.writeFileSync(filePath, JSON.stringify(facts, null, 2) + '\n');
      console.log(`✓ ${filename}: added funScore to ${modified} facts`);
    } else {
      console.log(`✓ ${filename}: all facts already have funScore`);
    }

    return modified;
  } catch (err) {
    console.error(`✗ Error processing ${path.basename(filePath)}: ${err.message}`);
    return 0;
  }
}

/**
 * Main: process all JSON files
 */
async function main() {
  console.log(`Scanning ${dataDir} for JSON files...\n`);

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  let totalModified = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    totalModified += processFile(filePath);
  }

  console.log(`\n✓ Fixed ${totalModified} facts across ${files.length} files`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
