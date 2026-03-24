#!/usr/bin/env node
/**
 * migrate-vocab-to-decks.mjs
 *
 * Reads existing vocabulary JSON files from src/data/seed/vocab-*.json
 * and outputs curated deck JSON files to data/decks/.
 *
 * Usage: node scripts/migrate-vocab-to-decks.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEED_DIR = path.join(ROOT, 'src/data/seed');
const DECKS_DIR = path.join(ROOT, 'data/decks');

// Language display names
const LANG_NAMES = {
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  cs: 'Czech',
  zh: 'Chinese',
};

// Human-readable deck names by categoryL2
const DECK_NAMES = {
  japanese_n5: 'Japanese N5 Vocabulary',
  japanese_n4: 'Japanese N4 Vocabulary',
  japanese_n3: 'Japanese N3 Vocabulary',
  japanese_n2: 'Japanese N2 Vocabulary',
  japanese_n1: 'Japanese N1 Vocabulary',
  japanese_hiragana: 'Japanese Hiragana',
  japanese_katakana: 'Japanese Katakana',
  korean_topik1: 'Korean TOPIK 1 Vocabulary',
  korean_topik2: 'Korean TOPIK 2 Vocabulary',
  korean_hangul: 'Korean Hangul',
  spanish_a1: 'Spanish A1 Vocabulary',
  spanish_a2: 'Spanish A2 Vocabulary',
  spanish_b1: 'Spanish B1 Vocabulary',
  spanish_b2: 'Spanish B2 Vocabulary',
  french_a1: 'French A1 Vocabulary',
  french_a2: 'French A2 Vocabulary',
  french_b1: 'French B1 Vocabulary',
  french_b2: 'French B2 Vocabulary',
  german_a1: 'German A1 Vocabulary',
  german_a2: 'German A2 Vocabulary',
  german_b1: 'German B1 Vocabulary',
  german_b2: 'German B2 Vocabulary',
  dutch_a1: 'Dutch A1 Vocabulary',
  dutch_a2: 'Dutch A2 Vocabulary',
  dutch_b1: 'Dutch B1 Vocabulary',
  dutch_b2: 'Dutch B2 Vocabulary',
  czech_a1: 'Czech A1 Vocabulary',
  czech_a2: 'Czech A2 Vocabulary',
  czech_b1: 'Czech B1 Vocabulary',
  czech_b2: 'Czech B2 Vocabulary',
  chinese_hsk1: 'Chinese HSK 1 Vocabulary',
  chinese_hsk2: 'Chinese HSK 2 Vocabulary',
  chinese_hsk3: 'Chinese HSK 3 Vocabulary',
  chinese_hsk4: 'Chinese HSK 4 Vocabulary',
  chinese_hsk5: 'Chinese HSK 5 Vocabulary',
  chinese_hsk6: 'Chinese HSK 6 Vocabulary',
};

// Deck descriptions by categoryL2
const DECK_DESCRIPTIONS = {
  japanese_n5: 'Beginner Japanese — JLPT N5 level vocabulary',
  japanese_n4: 'Elementary Japanese — JLPT N4 level vocabulary',
  japanese_n3: 'Intermediate Japanese — JLPT N3 level vocabulary',
  japanese_n2: 'Upper-intermediate Japanese — JLPT N2 level vocabulary',
  japanese_n1: 'Advanced Japanese — JLPT N1 level vocabulary',
  japanese_hiragana: 'Japanese Hiragana alphabet — readings and meanings',
  japanese_katakana: 'Japanese Katakana alphabet — readings and meanings',
  korean_topik1: 'Beginner Korean — TOPIK 1 level vocabulary',
  korean_topik2: 'Intermediate Korean — TOPIK 2 level vocabulary',
  korean_hangul: 'Korean Hangul alphabet — readings and meanings',
  spanish_a1: 'Beginner Spanish — CEFR A1 level vocabulary',
  spanish_a2: 'Elementary Spanish — CEFR A2 level vocabulary',
  spanish_b1: 'Intermediate Spanish — CEFR B1 level vocabulary',
  spanish_b2: 'Upper-intermediate Spanish — CEFR B2 level vocabulary',
  french_a1: 'Beginner French — CEFR A1 level vocabulary',
  french_a2: 'Elementary French — CEFR A2 level vocabulary',
  french_b1: 'Intermediate French — CEFR B1 level vocabulary',
  french_b2: 'Upper-intermediate French — CEFR B2 level vocabulary',
  german_a1: 'Beginner German — CEFR A1 level vocabulary',
  german_a2: 'Elementary German — CEFR A2 level vocabulary',
  german_b1: 'Intermediate German — CEFR B1 level vocabulary',
  german_b2: 'Upper-intermediate German — CEFR B2 level vocabulary',
  dutch_a1: 'Beginner Dutch — CEFR A1 level vocabulary',
  dutch_a2: 'Elementary Dutch — CEFR A2 level vocabulary',
  dutch_b1: 'Intermediate Dutch — CEFR B1 level vocabulary',
  dutch_b2: 'Upper-intermediate Dutch — CEFR B2 level vocabulary',
  czech_a1: 'Beginner Czech — CEFR A1 level vocabulary',
  czech_a2: 'Elementary Czech — CEFR A2 level vocabulary',
  czech_b1: 'Intermediate Czech — CEFR B1 level vocabulary',
  czech_b2: 'Upper-intermediate Czech — CEFR B2 level vocabulary',
  chinese_hsk1: 'Beginner Chinese — HSK 1 level vocabulary',
  chinese_hsk2: 'Elementary Chinese — HSK 2 level vocabulary',
  chinese_hsk3: 'Intermediate Chinese — HSK 3 level vocabulary',
  chinese_hsk4: 'Upper-intermediate Chinese — HSK 4 level vocabulary',
  chinese_hsk5: 'Advanced Chinese — HSK 5 level vocabulary',
  chinese_hsk6: 'Mastery Chinese — HSK 6 level vocabulary',
};

// Standard vocabulary question templates (embedded — matches vocabularyTemplates.ts)
const VOCAB_TEMPLATES = [
  {
    id: 'forward',
    answerPoolId: 'english_meanings',
    questionFormat: "What does '{targetLanguageWord}' mean?",
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'reading',
    answerPoolId: 'reading_hiragana',
    questionFormat: "What is the reading of '{targetLanguageWord}'?",
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'reading_pinyin',
    answerPoolId: 'reading_pinyin',
    questionFormat: "What is the pinyin reading of '{targetLanguageWord}'?",
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'reverse',
    answerPoolId: 'target_language_words',
    questionFormat: "How do you say '{correctAnswer}' in {language}?",
    availableFromMastery: 2,
    difficulty: 3,
    reverseCapable: false,
  },
  {
    id: 'synonym_pick',
    answerPoolId: 'english_meanings',
    questionFormat: "Which word is closest in meaning to '{targetLanguageWord}'?",
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
  {
    id: 'definition_match',
    answerPoolId: 'english_meanings',
    questionFormat: '{explanation}',
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the target language word from a vocab fact.
 * Tries quizQuestion first (e.g., 'What does "食べる" (たべる) mean?'),
 * then falls back to pronunciation field.
 */
function extractTargetWord(fact) {
  // Match either "word" or 「word」 patterns
  const match = fact.quizQuestion?.match(/["「]([^"」]+)["」]/);
  if (match) return match[1];
  return fact.pronunciation || '';
}

/**
 * Transform an old vocab fact into the DeckFact format.
 */
/**
 * Detect part of speech from a vocabulary fact.
 * Uses three strategies in priority order:
 * 1. Explicit POS in explanation text ("Part of speech: verb")
 * 2. English answer pattern detection ("to eat" → verb, etc.)
 * 3. Falls back to undefined
 */
function detectPartOfSpeech(fact) {
  // Strategy 1: Extract from explanation (Japanese, Korean have this)
  const posMatch = fact.explanation?.match(/Part of speech: (\w+)/i);
  if (posMatch) {
    const pos = posMatch[1].toLowerCase();
    // Normalize to standard categories
    if (pos === 'word' || pos === 'expression') return undefined; // too generic
    if (pos === 'numeral' || pos === 'counter') return 'number';
    if (pos === 'auxiliary') return 'verb';
    return pos; // verb, noun, adjective, adverb, conjunction, pronoun, etc.
  }

  // Strategy 2: Infer from English correctAnswer
  const answer = (fact.correctAnswer || '').trim().toLowerCase();

  // Verbs: "to eat", "to be able to", etc.
  if (answer.startsWith('to ')) return 'verb';

  // Adjectives: common suffixes
  if (answer.endsWith('ful') || answer.endsWith('ous') || answer.endsWith('ive') ||
      answer.endsWith('ible') || answer.endsWith('able') || answer.endsWith('ical') ||
      answer.endsWith('less') || answer.endsWith('ish')) return 'adjective';

  // Adverbs: -ly suffix (but not "family", "friendly", etc.)
  if (answer.endsWith('ly') && !answer.endsWith('ally') &&
      !['family', 'friendly', 'lonely', 'lovely', 'ugly', 'early', 'daily', 'holy',
        'belly', 'bully', 'jelly', 'lily', 'rally', 'tally', 'folly', 'jolly'].includes(answer)) {
    return 'adverb';
  }

  return undefined; // Can't determine — won't filter by POS
}

function transformFact(oldFact, chainSlotIndex) {
  return {
    id: oldFact.id,
    correctAnswer: oldFact.correctAnswer,
    acceptableAlternatives: oldFact.acceptableAlternatives || [],
    synonymGroupId: undefined,
    chainThemeId: chainSlotIndex % 6,
    answerTypePoolId: 'english_meanings',
    difficulty: oldFact.difficulty || 1,
    funScore: oldFact.funScore || 5,
    quizQuestion: oldFact.quizQuestion,
    explanation: oldFact.explanation || '',
    visualDescription: '',
    sourceName: oldFact.sourceName || '',
    sourceUrl: oldFact.sourceUrl || undefined,
    volatile: false,
    distractors: oldFact.distractors || [],
    targetLanguageWord: extractTargetWord(oldFact),
    reading: oldFact.pronunciation || undefined,
    language: oldFact.language || undefined,
    partOfSpeech: detectPartOfSpeech(oldFact),
  };
}

/**
 * Build answer type pools for a deck.
 */
function buildAnswerTypePools(facts, language) {
  const pools = [
    {
      id: 'english_meanings',
      label: 'English Meanings',
      answerFormat: 'word',
      factIds: facts.map(f => f.id),
      minimumSize: 5,
    },
    {
      id: 'target_language_words',
      label: `${LANG_NAMES[language] || language} Words`,
      answerFormat: 'word',
      factIds: facts.filter(f => f.targetLanguageWord).map(f => f.id),
      minimumSize: 5,
    },
  ];

  if (language === 'ja') {
    pools.push({
      id: 'reading_hiragana',
      label: 'Hiragana Readings',
      answerFormat: 'word',
      factIds: facts.filter(f => f.reading).map(f => f.id),
      minimumSize: 5,
    });
  }

  if (language === 'zh') {
    pools.push({
      id: 'reading_pinyin',
      label: 'Pinyin Readings',
      answerFormat: 'word',
      factIds: facts.filter(f => f.reading).map(f => f.id),
      minimumSize: 5,
    });
  }

  return pools;
}

/**
 * Build synonym groups by detecting overlapping acceptableAlternatives.
 * O(n^2) — acceptable for a one-time migration script.
 */
function buildSynonymGroups(facts) {
  console.log(`    Computing synonym groups for ${facts.length} facts...`);

  const groups = []; // { id, factIds, reason }
  const factToGroup = new Map(); // factId -> groupId
  let groupCounter = 0;

  for (let i = 0; i < facts.length; i++) {
    if (i > 0 && i % 500 === 0) {
      console.log(`    ... processed ${i}/${facts.length} facts, ${groups.length} groups so far`);
    }

    const setA = new Set([
      facts[i].correctAnswer.toLowerCase(),
      ...(facts[i].acceptableAlternatives || []).map(a => a.toLowerCase()),
    ]);

    for (let j = i + 1; j < facts.length; j++) {
      const setB = new Set([
        facts[j].correctAnswer.toLowerCase(),
        ...(facts[j].acceptableAlternatives || []).map(a => a.toLowerCase()),
      ]);

      const hasOverlap = [...setA].some(a => setB.has(a));
      if (!hasOverlap) continue;

      const groupA = factToGroup.get(facts[i].id);
      const groupB = factToGroup.get(facts[j].id);

      if (groupA && groupB && groupA !== groupB) {
        // Merge groupB into groupA
        const grpA = groups.find(g => g.id === groupA);
        const grpB = groups.find(g => g.id === groupB);
        if (grpA && grpB) {
          for (const id of grpB.factIds) {
            grpA.factIds.push(id);
            factToGroup.set(id, groupA);
          }
          groups.splice(groups.indexOf(grpB), 1);
        }
      } else if (groupA) {
        groups.find(g => g.id === groupA)?.factIds.push(facts[j].id);
        factToGroup.set(facts[j].id, groupA);
      } else if (groupB) {
        groups.find(g => g.id === groupB)?.factIds.push(facts[i].id);
        factToGroup.set(facts[i].id, groupB);
      } else {
        const id = `syn_${groupCounter++}`;
        groups.push({ id, factIds: [facts[i].id, facts[j].id], reason: 'acceptableAlternatives overlap' });
        factToGroup.set(facts[i].id, id);
        factToGroup.set(facts[j].id, id);
      }
    }
  }

  // Stamp synonymGroupId back onto facts
  for (const [factId, groupId] of factToGroup.entries()) {
    const fact = facts.find(f => f.id === factId);
    if (fact) fact.synonymGroupId = groupId;
  }

  return groups;
}

/**
 * Build difficulty tiers from transformed facts.
 */
function buildDifficultyTiers(facts) {
  return [
    { tier: 'easy', factIds: facts.filter(f => f.difficulty <= 2).map(f => f.id) },
    { tier: 'medium', factIds: facts.filter(f => f.difficulty === 3).map(f => f.id) },
    { tier: 'hard', factIds: facts.filter(f => f.difficulty >= 4).map(f => f.id) },
  ];
}

/**
 * Filter VOCAB_TEMPLATES to only those with a matching pool in this deck.
 */
function filterTemplates(pools) {
  const poolIds = new Set(pools.map(p => p.id));
  return VOCAB_TEMPLATES.filter(t => poolIds.has(t.answerPoolId));
}

/**
 * Derive the language code from a categoryL2 string.
 * e.g. 'japanese_n5' -> 'ja', 'korean_hangul' -> 'ko'
 */
function langFromCategory(categoryL2) {
  if (categoryL2.startsWith('japanese')) return 'ja';
  if (categoryL2.startsWith('korean')) return 'ko';
  if (categoryL2.startsWith('spanish')) return 'es';
  if (categoryL2.startsWith('french')) return 'fr';
  if (categoryL2.startsWith('german')) return 'de';
  if (categoryL2.startsWith('dutch')) return 'nl';
  if (categoryL2.startsWith('czech')) return 'cs';
  if (categoryL2.startsWith('chinese')) return 'zh';
  return 'unknown';
}

/**
 * Derive subDomain from categoryL2.
 * e.g. 'japanese_n5' -> 'japanese', 'chinese_hsk1' -> 'chinese'
 */
function subDomainFromCategory(categoryL2) {
  return categoryL2.split('_')[0];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Ensure output directory exists
fs.mkdirSync(DECKS_DIR, { recursive: true });

const vocabFiles = fs.readdirSync(SEED_DIR)
  .filter(f => f.startsWith('vocab-') && f.endsWith('.json'))
  .map(f => path.join(SEED_DIR, f));

console.log(`Found ${vocabFiles.length} vocab files:\n  ${vocabFiles.map(f => path.basename(f)).join('\n  ')}\n`);

// Collect all facts grouped by categoryL2
const factsByCategory = new Map(); // categoryL2 -> raw facts[]

for (const filePath of vocabFiles) {
  const basename = path.basename(filePath);
  console.log(`Reading ${basename}...`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const fact of raw) {
    const cat = fact.categoryL2;
    if (!cat) {
      console.warn(`  WARNING: fact ${fact.id} has no categoryL2, skipping`);
      continue;
    }
    if (!factsByCategory.has(cat)) factsByCategory.set(cat, []);
    factsByCategory.get(cat).push(fact);
  }
}

console.log(`\nGrouped into ${factsByCategory.size} decks by categoryL2:\n`);

const writtenDeckIds = [];
const summary = [];

for (const [categoryL2, rawFacts] of [...factsByCategory.entries()].sort()) {
  const deckId = categoryL2; // deck ID = categoryL2
  const language = langFromCategory(categoryL2);
  const langName = LANG_NAMES[language] || language;
  const deckName = DECK_NAMES[deckId] || `${langName} — ${categoryL2}`;
  const description = DECK_DESCRIPTIONS[deckId] || `${langName} vocabulary — ${categoryL2}`;
  const subDomain = subDomainFromCategory(categoryL2);

  console.log(`Processing deck: ${deckId} (${rawFacts.length} facts)`);

  // Transform facts
  const facts = rawFacts.map((f, i) => transformFact(f, i));

  // Build answer type pools
  const pools = buildAnswerTypePools(facts, language);

  // Build synonym groups (stamps synonymGroupId onto facts in-place)
  const synonymGroups = buildSynonymGroups(facts);

  // Build question templates (filtered to available pools)
  const questionTemplates = filterTemplates(pools);

  // Build difficulty tiers
  const difficultyTiers = buildDifficultyTiers(facts);

  // Construct deck object
  const deck = {
    id: deckId,
    name: deckName,
    domain: 'vocabulary',
    subDomain,
    description,
    minimumFacts: Math.min(30, facts.length),
    targetFacts: facts.length,
    facts,
    answerTypePools: pools,
    synonymGroups,
    questionTemplates,
    difficultyTiers,
  };

  // Write deck file
  const outPath = path.join(DECKS_DIR, `${deckId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deck, null, 2), 'utf8');
  writtenDeckIds.push(deckId);

  const poolSummary = pools.map(p => `${p.id}(${p.factIds.length})`).join(', ');
  const tierSummary = difficultyTiers.map(t => `${t.tier}:${t.factIds.length}`).join(' ');
  console.log(`  -> ${outPath}`);
  console.log(`     Pools: ${poolSummary}`);
  console.log(`     Tiers: ${tierSummary}`);
  console.log(`     Synonym groups: ${synonymGroups.length}`);
  console.log(`     Templates: ${questionTemplates.map(t => t.id).join(', ')}`);
  console.log('');

  summary.push({
    deckId,
    name: deckName,
    factCount: facts.length,
    synonymGroupCount: synonymGroups.length,
    templateCount: questionTemplates.length,
    poolCount: pools.length,
  });
}

// ---------------------------------------------------------------------------
// Update manifest
// ---------------------------------------------------------------------------

const manifestPath = path.join(DECKS_DIR, 'manifest.json');
let existingManifest = { decks: [] };

if (fs.existsSync(manifestPath)) {
  try {
    existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse existing manifest, will overwrite.');
  }
}

// Merge: preserve any existing non-vocab deck entries, replace vocab ones
const existingNonVocab = (existingManifest.decks || []).filter(
  d => !writtenDeckIds.includes(typeof d === 'string' ? d : d.id)
);

const newEntries = writtenDeckIds.map(id => ({ id, file: `${id}.json` }));

const updatedManifest = {
  ...existingManifest,
  decks: [...existingNonVocab, ...newEntries],
};

fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf8');
console.log(`Updated manifest at ${manifestPath} (${updatedManifest.decks.length} total decks)`);

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n========== MIGRATION SUMMARY ==========');
console.log(`Total decks written: ${writtenDeckIds.length}`);
console.log('');

const colW = [32, 8, 8, 7, 6];
const header = [
  'Deck ID'.padEnd(colW[0]),
  'Facts'.padStart(colW[1]),
  'SynGrps'.padStart(colW[2]),
  'Tmpls'.padStart(colW[3]),
  'Pools'.padStart(colW[4]),
].join('  ');
console.log(header);
console.log('-'.repeat(header.length));

for (const row of summary) {
  console.log([
    row.deckId.padEnd(colW[0]),
    String(row.factCount).padStart(colW[1]),
    String(row.synonymGroupCount).padStart(colW[2]),
    String(row.templateCount).padStart(colW[3]),
    String(row.poolCount).padStart(colW[4]),
  ].join('  '));
}

console.log('\nDone.');
