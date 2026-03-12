#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

/**
 * Fisher-Yates shuffle
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Load JSON file safely
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Save JSON file with 2-space indent
 */
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Extract string value from distractor (handles both string and {text} object)
 */
function getDistractorText(distractor) {
  if (typeof distractor === 'string') return distractor;
  if (typeof distractor === 'object' && distractor.text) return distractor.text;
  return '';
}

/**
 * Build distractor pools from all seed facts
 */
function buildDistractorPools(seedFiles) {
  const pools = { global: [] };

  for (const filePath of seedFiles) {
    const data = loadJSON(filePath);
    if (!Array.isArray(data)) continue;

    for (const fact of data) {
      if (!fact.correctAnswer || fact.correctAnswer.trim() === '') continue;
      if (fact.correctAnswer.toLowerCase() === 'unknown') continue;

      const answer = fact.correctAnswer.trim();

      // Add to global pool
      pools.global.push(answer);

      // Add to category pool if category exists
      if (fact.categoryL1) {
        const category = fact.categoryL1;
        if (!pools[category]) {
          pools[category] = [];
        }
        pools[category].push(answer);
      }
    }
  }

  // Deduplicate each pool
  for (const key in pools) {
    pools[key] = [...new Set(pools[key])];
  }

  return pools;
}

/**
 * Detect question type and generate appropriate distractors
 */
function generateDistracters(question, correctAnswer, categoryL1, pools) {
  const lowerQuestion = question.toLowerCase();
  const correctAnswerStr = String(correctAnswer).trim();
  const categoryPool = pools[categoryL1] || [];
  const globalPool = pools.global || [];

  // Year questions
  if (/what year|in what year|when did|when was/.test(lowerQuestion)) {
    const year = parseInt(correctAnswerStr, 10);
    if (!isNaN(year)) {
      const offsets = [3, 7, 12, 20, 35];
      const candidates = new Set();
      for (const offset of offsets) {
        const variation = Math.random() > 0.5 ? year + offset : year - offset;
        candidates.add(String(variation));
      }
      const result = [...candidates].filter(d => d !== correctAnswerStr).slice(0, 5);
      if (result.length === 5) return result;
    }
  }

  // Country/location questions
  if (/where|originate|origin|located|country/.test(lowerQuestion)) {
    const countries = [
      'China',
      'Japan',
      'India',
      'France',
      'Italy',
      'Germany',
      'Spain',
      'Mexico',
      'Brazil',
      'Greece',
      'Egypt',
      'Turkey',
      'Thailand',
      'Korea',
      'Morocco',
      'Peru',
      'Ethiopia',
      'Russia',
      'Iran',
      'United Kingdom',
      'United States',
      'Indonesia',
      'Vietnam',
      'Nigeria',
      'South Africa',
      'Argentina',
      'Colombia',
      'Portugal',
      'Netherlands',
      'Sweden',
      'Norway',
      'Poland',
      'Hungary',
      'Austria',
      'Switzerland',
      'Belgium',
      'Ireland',
      'Australia',
      'New Zealand',
      'Canada',
      'Philippines',
      'Malaysia',
      'Pakistan',
      'Bangladesh',
      'Sri Lanka',
      'Nepal',
      'Myanmar',
      'Cambodia',
      'Laos',
      'Middle East',
      'Southeast Asia',
      'Central Asia',
      'West Africa',
      'East Africa',
      'North Africa',
      'South America',
      'Central America',
      'Caribbean',
      'Eastern Europe',
      'Western Europe',
      'Mediterranean',
      'Scandinavia',
      'Polynesia',
      'Mesopotamia',
      'Levant',
      'Balkans',
      'Caucasus',
      'Iberian Peninsula',
      'ancient Near East',
      'North America',
      'Hesse',
      'Bavaria',
      'Tuscany',
      'Provence',
      'Sichuan',
      'Bengal'
    ];
    const filtered = countries.filter(c => c.toLowerCase() !== correctAnswerStr.toLowerCase());
    const shuffled = shuffle(filtered);
    return shuffled.slice(0, 5);
  }

  // "What does" / meaning questions
  if (/what does|what is|meaning/.test(lowerQuestion)) {
    const pool = categoryPool.length > 0 ? categoryPool : globalPool;
    const filtered = pool.filter(d => d.toLowerCase() !== correctAnswerStr.toLowerCase());
    const shuffled = shuffle(filtered);
    return shuffled.slice(0, 5);
  }

  // "Who" questions
  if (/who/.test(lowerQuestion)) {
    const pool = categoryPool.length > 0 ? categoryPool : globalPool;
    const filtered = pool.filter(d => d.toLowerCase() !== correctAnswerStr.toLowerCase());
    const shuffled = shuffle(filtered);
    return shuffled.slice(0, 5);
  }

  // Default fallback
  let pool = categoryPool.length > 5 ? categoryPool : categoryPool.concat(globalPool);
  pool = [...new Set(pool)]; // deduplicate
  const filtered = pool.filter(d => d.toLowerCase() !== correctAnswerStr.toLowerCase());
  const shuffled = shuffle(filtered);
  return shuffled.slice(0, 5);
}

/**
 * Main regeneration function
 */
async function main() {
  const needsRegenPath = path.join(ROOT, 'data/raw/needs-distractor-regen.json');
  const seedFiles = [
    path.join(ROOT, 'src/data/seed/facts-generated.json'),
    path.join(ROOT, 'src/data/seed/facts-general-a.json'),
    path.join(ROOT, 'src/data/seed/facts-general-b.json'),
    path.join(ROOT, 'src/data/seed/facts-general-c.json')
  ];

  // Load facts needing regen
  const needsRegen = loadJSON(needsRegenPath);
  if (!needsRegen || !Array.isArray(needsRegen)) {
    console.error('Could not load needs-distractor-regen.json or it is not an array');
    process.exit(1);
  }

  console.log(`Loaded ${needsRegen.length} facts needing distractor regen`);

  // Build distractor pools
  console.log('Building distractor pools from seed files...');
  const pools = buildDistractorPools(seedFiles);
  console.log(`Global pool: ${pools.global.length} entries`);
  for (const [category, entries] of Object.entries(pools)) {
    if (category !== 'global') {
      console.log(`  ${category}: ${entries.length} entries`);
    }
  }

  // Create a map of facts to regenerate by ID
  const regenMap = new Map(needsRegen.map(f => [f.id, f]));

  // Process each seed file
  let totalFixed = 0;
  let totalFailed = 0;

  for (const filePath of seedFiles) {
    const data = loadJSON(filePath);
    if (!Array.isArray(data)) continue;

    let fileModified = false;

    for (let i = 0; i < data.length; i++) {
      const fact = data[i];
      if (!regenMap.has(fact.id)) continue;

      const regenEntry = regenMap.get(fact.id);
      console.log(`\nRegenerating distractors for fact ID: ${fact.id}`);
      console.log(`  Question: ${regenEntry.quizQuestion}`);
      console.log(`  Correct answer: ${regenEntry.correctAnswer}`);

      // Generate new distractors
      const newDistracters = generateDistracters(
        regenEntry.quizQuestion,
        regenEntry.correctAnswer,
        regenEntry.category,
        pools
      );

      if (newDistracters.length < 5) {
        console.log(`  ✗ FAILED: only ${newDistracters.length} distractors generated (need 5)`);
        totalFailed++;
        continue;
      }

      // Deduplicate the distractors
      const unique = [...new Set(newDistracters)];
      if (unique.length < 5) {
        console.log(`  ✗ FAILED: ${unique.length} unique distractors (duplicates exist)`);
        totalFailed++;
        continue;
      }

      // Replace the distractors in the fact
      fact.distractors = unique;
      fileModified = true;
      totalFixed++;

      console.log(`  ✓ Generated distractors: ${unique.slice(0, 3).join(', ')}...`);
    }

    // Write file back if modified
    if (fileModified) {
      saveJSON(filePath, data);
      console.log(`\n✓ Saved ${filePath}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY`);
  console.log('='.repeat(60));
  console.log(`Facts fixed: ${totalFixed}`);
  console.log(`Facts failed: ${totalFailed}`);
  console.log(`Total processed: ${totalFixed + totalFailed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
