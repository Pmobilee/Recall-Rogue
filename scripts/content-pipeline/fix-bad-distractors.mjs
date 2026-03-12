import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

const seedFiles = [
  'src/data/seed/facts-generated.json',
  'src/data/seed/facts-general-a.json',
  'src/data/seed/facts-general-b.json',
  'src/data/seed/facts-general-c.json',
];

const stats = {
  unknownRemoved: 0,
  plausibleRemoved: 0,
  topLevelFilled: 0,
  needsRegen: 0,
};

const needsRegen = [];

/**
 * Get the text content from a distractor (handle both string and object)
 */
function getDistractorText(distractor) {
  if (typeof distractor === 'string') {
    return distractor;
  }
  if (typeof distractor === 'object' && distractor !== null && distractor.text) {
    return distractor.text;
  }
  return '';
}

/**
 * Check if a distractor is "Unknown"
 */
function isUnknown(distractor) {
  const text = getDistractorText(distractor);
  return text.toLowerCase() === 'unknown';
}

/**
 * Check if a distractor contains "Plausible option"
 */
function isPlausibleOption(distractor) {
  const text = getDistractorText(distractor);
  return text.toLowerCase().includes('plausible option');
}

/**
 * Check if a fact is a language fact
 */
function isLanguageFact(fact) {
  if (fact.language) return true;
  if (Array.isArray(fact.category) && fact.category.some(c => typeof c === 'string' && c.toLowerCase().includes('language'))) {
    return true;
  }
  if (typeof fact.category === 'string' && fact.category.toLowerCase().includes('language')) {
    return true;
  }
  return false;
}

/**
 * Clean distractors array: remove unknown and plausible options
 */
function cleanDistracters(distractors, isLanguage) {
  if (!Array.isArray(distractors)) return distractors;

  let cleaned = distractors.filter((d) => {
    if (!isLanguage && isUnknown(d)) {
      stats.unknownRemoved++;
      return false;
    }
    if (isPlausibleOption(d)) {
      stats.plausibleRemoved++;
      return false;
    }
    return true;
  });

  return cleaned;
}

/**
 * Process a single fact
 */
function processFact(fact) {
  const isLanguage = isLanguageFact(fact);

  // Clean top-level distractors
  if (Array.isArray(fact.distractors)) {
    fact.distractors = cleanDistracters(fact.distractors, isLanguage);
  }

  // Clean variant distractors
  if (Array.isArray(fact.variants)) {
    for (const variant of fact.variants) {
      if (Array.isArray(variant.distractors)) {
        variant.distractors = cleanDistracters(variant.distractors, isLanguage);

        // For true_false type, handle the case where only True/False remain
        if (variant.type === 'true_false') {
          const trueOrFalse = variant.distractors.filter((d) => {
            const text = getDistractorText(d);
            return text.toLowerCase() === 'true' || text.toLowerCase() === 'false';
          });

          // If all remaining distractors are just True/False, replace with appropriate opposite
          if (
            trueOrFalse.length === variant.distractors.length &&
            variant.distractors.length > 0
          ) {
            const correctText = variant.correctAnswer
              ? variant.correctAnswer.toLowerCase()
              : '';
            if (correctText === 'true') {
              variant.distractors = ['False'];
            } else if (correctText === 'false') {
              variant.distractors = ['True'];
            }
          }
        }
      }
    }
  }

  // Copy variant distractors to top-level if empty
  if (
    (!fact.distractors || fact.distractors.length === 0) &&
    Array.isArray(fact.variants) &&
    fact.variants.length > 0 &&
    fact.variants[0].distractors &&
    fact.variants[0].distractors.length > 0
  ) {
    fact.distractors = [...fact.variants[0].distractors];
    stats.topLevelFilled++;
  }

  // Track facts needing regeneration (non-language with < 3 distractors)
  if (!isLanguage) {
    const distCount = Array.isArray(fact.distractors)
      ? fact.distractors.length
      : 0;
    if (distCount < 3) {
      stats.needsRegen++;
      needsRegen.push({
        id: fact.id,
        quizQuestion: fact.quizQuestion,
        correctAnswer: fact.correctAnswer,
        category: fact.category,
        existingDistractors: fact.distractors || [],
      });
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Ensure data/raw directory exists
    const dataRawDir = path.join(rootDir, 'data/raw');
    if (!fs.existsSync(dataRawDir)) {
      fs.mkdirSync(dataRawDir, { recursive: true });
      console.log(`Created directory: ${dataRawDir}`);
    }

    for (const seedFile of seedFiles) {
      const filePath = path.join(rootDir, seedFile);

      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${seedFile} (file not found)`);
        continue;
      }

      console.log(`\nProcessing ${seedFile}...`);

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');
      let facts = JSON.parse(content);

      if (!Array.isArray(facts)) {
        console.log(`  Warning: ${seedFile} is not an array, skipping`);
        continue;
      }

      const startCount = facts.length;

      // Process each fact
      for (const fact of facts) {
        processFact(fact);
      }

      // Write back
      fs.writeFileSync(filePath, JSON.stringify(facts, null, 2) + '\n');
      console.log(`  ✓ Processed ${startCount} facts`);
    }

    // Write needs-regen list
    const regenPath = path.join(rootDir, 'data/raw/needs-distractor-regen.json');
    fs.writeFileSync(regenPath, JSON.stringify(needsRegen, null, 2) + '\n');
    console.log(`\n✓ Wrote needs-regen list to ${regenPath}`);

    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Unknown distractors removed: ${stats.unknownRemoved}`);
    console.log(`Plausible option distractors removed: ${stats.plausibleRemoved}`);
    console.log(`Top-level distractors filled from variants: ${stats.topLevelFilled}`);
    console.log(`Facts needing distractor regeneration: ${stats.needsRegen}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
