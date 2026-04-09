#!/usr/bin/env node
/**
 * Assembles the Spanish C2 vocabulary deck from the source TSV.
 * Outputs to data/decks/spanish_c2.json
 *
 * Usage: node scripts/assemble-c2-deck.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TSV_PATH = join(ROOT, 'data/deck-architectures/_research/spanish/c2_vocab_source.tsv');
const OUT_PATH = join(ROOT, 'data/decks/spanish_c2.json');

// Parse TSV
const tsvContent = readFileSync(TSV_PATH, 'utf8');
const lines = tsvContent.split('\n').filter(l => l.trim() && !l.startsWith('word\t'));

const CHAIN_THEMES = [
  { id: 0, name: 'Literary & Poetic Register', description: 'Vocabulary from Spanish literary and poetic tradition' },
  { id: 1, name: 'Formal & Administrative', description: 'Formal, bureaucratic, and administrative language' },
  { id: 2, name: 'Philosophy & Rhetoric', description: 'Philosophical concepts and rhetorical devices' },
  { id: 3, name: 'Law & Justice', description: 'Legal and juridical vocabulary' },
  { id: 4, name: 'Science & Academia', description: 'Specialized scientific and academic terms' },
  { id: 5, name: 'Archaic & Rare', description: 'Archaic, rare, and literary-register words' },
  { id: 6, name: 'Mind & Abstract', description: 'Psychological and abstract concepts' },
  { id: 7, name: 'Politics & Economics', description: 'Advanced political economy and governance' },
  { id: 8, name: 'Arts & Culture', description: 'Advanced vocabulary in arts, culture, and aesthetics' },
];

const REGISTER_TO_THEME = {
  literary_poetic: 0,
  formal_administrative: 1,
  philosophical_rhetorical: 2,
  legal_juridical: 3,
  specialized_scientific: 4,
  archaic_rare: 5,
  psychological_abstract: 6,
  economic_political_advanced: 7,
  cultural_arts: 8,
  idiomatic_nuanced: 0,
};

const facts = [];
const factIds = [];
const spanishWordFactIds = [];

let idCounter = 1;

for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 9) {
    console.warn(`Skipping malformed line: ${line.substring(0, 60)}`);
    continue;
  }

  const [word, pos, english, register, chainThemeStr, diffStr, funStr, explanation, source] = parts;

  const id = `es-cefr-c2-${String(idCounter).padStart(4, '0')}`;
  const chainThemeId = parseInt(chainThemeStr, 10);
  const difficulty = parseInt(diffStr, 10);
  const funScore = parseInt(funStr, 10);

  const fact = {
    id,
    correctAnswer: english.trim(),
    acceptableAlternatives: [],
    chainThemeId,
    answerTypePoolId: 'english_meanings',
    difficulty,
    funScore,
    quizQuestion: `What does "${word.trim()}" mean?`,
    explanation: explanation.trim(),
    visualDescription: '',
    sourceName: 'PCIC C2 Nivel de Maestría / RAE DLE',
    sourceUrl: 'https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/',
    volatile: false,
    distractors: [],
    targetLanguageWord: word.trim(),
    language: 'es',
    partOfSpeech: pos.trim(),
  };

  facts.push(fact);
  factIds.push(id);
  spanishWordFactIds.push(id);
  idCounter++;
}

console.log(`Parsed ${facts.length} facts`);

// Build synonym groups for near-identical meanings
// (automated pass: words whose correctAnswer is identical)
const byAnswer = {};
for (const fact of facts) {
  const key = fact.correctAnswer.toLowerCase();
  if (!byAnswer[key]) byAnswer[key] = [];
  byAnswer[key].push(fact.id);
}

const synonymGroups = [];
let synIdx = 0;
for (const [answer, ids] of Object.entries(byAnswer)) {
  if (ids.length > 1) {
    synonymGroups.push({
      id: `syn_c2_${synIdx}`,
      factIds: ids,
      reason: `acceptableAlternatives overlap — all mean "${answer}"`,
    });
    // Also cross-assign answerTypePoolId to avoid distractors between them
    for (const id of ids) {
      const fact = facts.find(f => f.id === id);
      if (fact) fact.synonymGroupId = `syn_c2_${synIdx}`;
    }
    synIdx++;
  }
}

console.log(`Built ${synonymGroups.length} synonym groups`);

// Build difficulty tiers
const easyIds = facts.filter(f => f.difficulty <= 3).map(f => f.id);
const mediumIds = facts.filter(f => f.difficulty === 4).map(f => f.id);
const hardIds = facts.filter(f => f.difficulty === 5).map(f => f.id);

console.log(`Tiers - easy: ${easyIds.length}, medium: ${mediumIds.length}, hard: ${hardIds.length}`);

// Synthetic distractors for the english_meanings pool — these are plausible English words
// that are NOT correct answers for any C2 fact, designed to round out the pool
// (Pool already has 838 facts, well above 15 minimum — no synthetics strictly needed,
//  but we add 10 as insurance for very rare edge cases)
const syntheticDistractors = [
  'to embellish', 'to enervate', 'to expostulate', 'to fulminate',
  'to inveigh', 'to obfuscate', 'to promulgate', 'to surmise',
  'to temporize', 'to vituperate',
];

const deck = {
  id: 'spanish_c2',
  name: 'Spanish C2 Vocabulary',
  domain: 'vocabulary',
  subDomain: 'spanish',
  description: 'Mastery-level Spanish — CEFR C2 vocabulary (Nivel de Maestría). Literary, formal, philosophical, legal, and rare register vocabulary.',
  minimumFacts: 30,
  targetFacts: facts.length,
  facts,
  answerTypePools: [
    {
      id: 'english_meanings',
      label: 'English Meanings',
      answerFormat: 'word',
      factIds: factIds,
      syntheticDistractors,
    },
    {
      id: 'spanish_words',
      label: 'Spanish Words',
      answerFormat: 'word',
      factIds: spanishWordFactIds,
    },
  ],
  synonymGroups,
  chainThemes: CHAIN_THEMES,
  questionTemplates: [
    {
      id: 'forward',
      answerPoolId: 'english_meanings',
      questionFormat: "What does '{targetLanguageWord}' mean?",
      availableFromMastery: 0,
      difficulty: 1,
      reverseCapable: false,
    },
    {
      id: 'reverse',
      answerPoolId: 'spanish_words',
      questionFormat: "How do you say '{correctAnswer}' in Spanish?",
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
  ],
  difficultyTiers: [
    { tier: 'easy', factIds: easyIds },
    { tier: 'medium', factIds: mediumIds },
    { tier: 'hard', factIds: hardIds },
  ],
};

writeFileSync(OUT_PATH, JSON.stringify(deck, null, 2), 'utf8');
console.log(`Written to ${OUT_PATH}`);
console.log(`Total facts: ${facts.length}`);

// POS breakdown
const posCounts = {};
for (const fact of facts) {
  posCounts[fact.partOfSpeech] = (posCounts[fact.partOfSpeech] || 0) + 1;
}
console.log('POS breakdown:', JSON.stringify(posCounts, null, 2));

// Theme breakdown
const themeCounts = {};
for (const fact of facts) {
  themeCounts[fact.chainThemeId] = (themeCounts[fact.chainThemeId] || 0) + 1;
}
console.log('Theme breakdown:', JSON.stringify(themeCounts, null, 2));
