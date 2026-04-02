/**
 * backfill-pos-from-english.mjs
 *
 * Infers partOfSpeech from the English correctAnswer field for language deck facts
 * that are missing a POS tag. Applies heuristic rules in priority order, never
 * overwrites existing values.
 *
 * Target decks: Chinese HSK 1-6, Spanish A1-B2, French A1-B2, German A1-B2,
 *               Dutch A1-B2, Czech A1-B2
 *
 * Usage: node scripts/backfill-pos-from-english.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.join(__dirname, '..', 'data', 'decks');

// ── Target deck files ──────────────────────────────────────────────────────────

const TARGET_DECKS = [
  'chinese_hsk1.json', 'chinese_hsk2.json', 'chinese_hsk3.json',
  'chinese_hsk4.json', 'chinese_hsk5.json', 'chinese_hsk6.json',
  'spanish_a1.json', 'spanish_a2.json', 'spanish_b1.json', 'spanish_b2.json',
  'french_a1.json', 'french_a2.json', 'french_b1.json', 'french_b2.json',
  'german_a1.json', 'german_a2.json', 'german_b1.json', 'german_b2.json',
  'dutch_a1.json', 'dutch_a2.json', 'dutch_b1.json', 'dutch_b2.json',
  'czech_a1.json', 'czech_a2.json', 'czech_b1.json', 'czech_b2.json',
];

// ── Word lists for exact-match rules ─────────────────────────────────────────

const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'we', 'they', 'it',
  'me', 'him', 'her', 'us', 'them',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves',
  'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
  'someone', 'something', 'anyone', 'anything', 'everyone', 'everything',
  'nobody', 'nothing', 'oneself', 'each other',
]);

const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'from', 'with', 'by', 'for', 'of', 'about',
  'between', 'under', 'over', 'through', 'after', 'before', 'during',
  'into', 'onto', 'upon', 'within', 'without', 'beside', 'besides',
  'against', 'along', 'among', 'around', 'behind', 'below', 'beneath',
  'beyond', 'except', 'inside', 'near', 'off', 'outside', 'past',
  'since', 'toward', 'towards', 'underneath', 'until', 'up', 'via',
  'down', 'across', 'above', 'despite', 'per', 'like',
]);

const CONJUNCTIONS = new Set([
  'and', 'but', 'or', 'nor', 'yet', 'so',
  'because', 'if', 'when', 'while', 'although', 'since', 'unless',
  'however', 'therefore', 'moreover', 'furthermore', 'nevertheless',
  'whereas', 'whether', 'than', 'though', 'even though', 'as long as',
  'as soon as', 'in order to', 'so that', 'even if', 'as if',
  'accordingly', 'consequently', 'hence', 'thus', 'otherwise',
  'meanwhile', 'nonetheless', 'instead',
  // multi-word conjunctions that commonly appear as single answers
  'but; however', 'or; maybe', 'then; after that',
]);

const ADVERBS = new Set([
  'very', 'also', 'already', 'still', 'again', 'always', 'never', 'often',
  'sometimes', 'here', 'there', 'now', 'then', 'today', 'tomorrow',
  'yesterday', 'well', 'too', 'just', 'only', 'not', 'rather', 'quite',
  'almost', 'even', 'finally', 'generally', 'immediately', 'mostly',
  'nearly', 'once', 'perhaps', 'really', 'soon', 'then', 'together',
  'usually', 'usually', 'yet', 'early', 'late', 'fast', 'hard', 'high',
  'long', 'low', 'straight', 'right', 'wrong', 'abroad', 'everywhere',
  'somewhere', 'nowhere', 'anyway', 'besides', 'briefly', 'clearly',
  'exactly', 'first', 'further', 'greatly', 'hardly', 'increasingly',
  'indeed', 'instead', 'largely', 'least', 'likely', 'mainly', 'merely',
  'mostly', 'naturally', 'nicely', 'normally', 'obviously', 'once',
  'otherwise', 'partly', 'possibly', 'previously', 'probably', 'promptly',
  'purely', 'quickly', 'rapidly', 'rarely', 'recently', 'regularly',
  'relatively', 'roughly', 'seemingly', 'severely', 'shortly', 'simply',
  'slightly', 'slowly', 'specially', 'specifically', 'strongly',
  'subsequently', 'successfully', 'suddenly', 'sufficiently', 'totally',
  'truly', 'typically', 'ultimately', 'unfortunately', 'upwards', 'downwards',
  'forwards', 'backwards', 'afterwards', 'inwards', 'outwards', 'otherwise',
  'once', 'twice', 'gladly', 'newly', 'badly', 'mainly', 'simply',
  'nicely', 'slowly', 'mostly', 'exactly', 'roughly', 'clearly',
  'moreover', 'therefore', 'accordingly', 'consequently', 'hence', 'thus',
  'why', 'how', 'when', 'where',
  // multi-value answers that are adverbs
  'also, besides', 'down, downwards', 'there, over there',
]);

const INTERJECTIONS = new Set([
  'yes', 'no', 'hello', 'goodbye', 'please', 'thanks', 'sorry', 'wow',
  'oh', 'ah', 'hey', 'hi', 'ok', 'okay', 'oops', 'ouch', 'ugh', 'uh',
  'hmm', 'bye', 'cheers', 'welcome', 'congrats', 'bravo',
]);

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your',
  'his', 'her', 'its', 'our', 'their', 'some', 'any', 'all', 'both',
  'each', 'every', 'neither', 'either', 'no', 'enough', 'few', 'little',
  'many', 'more', 'most', 'much', 'other', 'several', 'such',
]);

// Chinese/Japanese grammar-specific endings that map to particle
const GRAMMAR_WORD_SUFFIXES = [
  'marker', 'particle', 'measure word', 'suffix', 'prefix',
  'classifier', 'aspect', 'auxiliary',
];

// "-ing" words that are genuinely nouns (exceptions for the -ing verb rule)
const ING_NOUNS = new Set([
  'thing', 'morning', 'evening', 'feeling', 'meaning', 'building',
  'wedding', 'opening', 'meeting', 'hearing', 'reading', 'writing',
  'warning', 'spring', 'ring', 'king', 'wing', 'string', 'ceiling',
  'flooring', 'clothing', 'housing', 'networking', 'offering',
  'suffering', 'blessing', 'crossing', 'gathering', 'setting',
  'training', 'testing', 'feeding', 'painting', 'drawing',
  'greeting', 'shopping', 'booking', 'cooking', 'parking',
  'swimming', 'running', 'hiking', 'dancing', 'singing',
  'beginning', 'ending', 'boarding', 'accounting',
]);

// ── Helper: normalize a raw correctAnswer to the base form for analysis ───────

/**
 * Normalize raw correctAnswer for POS analysis:
 * - Lowercase
 * - Strip parenthetical hints: "(not) ... yet" → "... yet"
 * - Take only the first alternative when comma/semicolon separated
 * - Collapse extra whitespace
 */
function normalize(raw) {
  let s = raw.toLowerCase().trim();

  // Strip leading/trailing parenthetical groups: "(formal)" / "(not)"
  s = s.replace(/^\([^)]*\)\s*/, '').trim();
  s = s.replace(/\s*\([^)]*\)$/, '').trim();

  // Take first comma/semicolon alternative
  const firstAlt = s.split(/[,;]/)[0].trim();

  return firstAlt;
}

// ── Core POS inference ────────────────────────────────────────────────────────

/**
 * Infer part of speech from an English meaning string.
 * Returns lowercase POS label or null if no rule matches (caller defaults to noun).
 *
 * @param {string} rawAnswer - The raw correctAnswer field value
 * @returns {{ pos: string, rule: string }} - Inferred POS and the rule that fired
 */
function inferPOS(rawAnswer) {
  const raw = rawAnswer.trim();
  const s = normalize(raw);

  // ── Rule 1: Chinese/grammar metadata phrases ─────────────────────────────
  // e.g. "completion marker", "sentence particle", "measure word", "aspect marker"
  for (const suffix of GRAMMAR_WORD_SUFFIXES) {
    if (s.endsWith(suffix) || s === suffix) {
      return { pos: 'particle', rule: 'grammar-metadata' };
    }
  }

  // ── Rule 2: Starts with "to " ─────────────────────────────────────────────
  if (s.startsWith('to ') && s.length > 3) {
    return { pos: 'verb', rule: 'to-prefix' };
  }

  // ── Rule 3: Pronouns (exact match on first alternative) ──────────────────
  if (PRONOUNS.has(s)) {
    return { pos: 'pronoun', rule: 'pronoun-list' };
  }

  // ── Rule 4: Prepositions (exact match) ────────────────────────────────────
  if (PREPOSITIONS.has(s)) {
    return { pos: 'preposition', rule: 'preposition-list' };
  }

  // ── Rule 5: Conjunctions (exact match) ────────────────────────────────────
  if (CONJUNCTIONS.has(s)) {
    return { pos: 'conjunction', rule: 'conjunction-list' };
  }

  // ── Rule 6: Adverbs (exact match) ─────────────────────────────────────────
  if (ADVERBS.has(s)) {
    return { pos: 'adverb', rule: 'adverb-list' };
  }

  // ── Rule 7: Interjections (exact match) ───────────────────────────────────
  if (INTERJECTIONS.has(s)) {
    return { pos: 'interjection', rule: 'interjection-list' };
  }

  // ── Rule 8: Determiners (exact match) ─────────────────────────────────────
  if (DETERMINERS.has(s)) {
    return { pos: 'determiner', rule: 'determiner-list' };
  }

  // ── Rule 9: Starts with article — likely a noun phrase ───────────────────
  // "a dog", "an apple", "the house" — article + noun → noun
  if (/^(a|an|the) \w/.test(s)) {
    return { pos: 'noun', rule: 'article-prefix' };
  }

  // ── Rule 10: Ends with -ly ────────────────────────────────────────────────
  if (s.endsWith('ly') && s.length > 3 && !['early', 'daily', 'holy', 'oily', 'ugly', 'only', 'bully', 'belly', 'family'].includes(s)) {
    return { pos: 'adverb', rule: 'ly-suffix' };
  }

  // ── Rule 11: Ends with noun suffixes ─────────────────────────────────────
  const nounSuffixes = [
    'tion', 'sion', 'ness', 'ment', 'ity', 'ity',
    'ance', 'ence', 'ship', 'hood', 'dom', 'ism', 'ist',
    'ology', 'graphy', 'ery', 'age', 'ure',
  ];
  for (const suffix of nounSuffixes) {
    if (s.endsWith(suffix) && s.length > suffix.length + 1) {
      return { pos: 'noun', rule: 'noun-suffix-' + suffix };
    }
  }

  // Noun suffix: -er / -or (agent nouns) — but not "over", "under", "after", "however" etc.
  if ((s.endsWith('er') || s.endsWith('or')) && s.length > 4 && !/\s/.test(s)) {
    const exceptions = new Set(['over', 'under', 'after', 'however', 'moreover', 'whether', 'other', 'water', 'never', 'either', 'neither', 'together', 'rather', 'further']);
    if (!exceptions.has(s)) {
      return { pos: 'noun', rule: 'agent-noun-er-or' };
    }
  }

  // ── Rule 12: Ends with adjective suffixes ────────────────────────────────
  const adjSuffixes = ['ous', 'ful', 'less', 'ive', 'able', 'ible', 'al', 'ic', 'ish', 'esque', 'like', 'ward', 'wise'];
  for (const suffix of adjSuffixes) {
    if (s.endsWith(suffix) && s.length > suffix.length + 2 && !/\s/.test(s)) {
      // Avoid false positives on very short words
      return { pos: 'adjective', rule: 'adj-suffix-' + suffix };
    }
  }

  // ── Rule 13: Ends with -ing ───────────────────────────────────────────────
  if (s.endsWith('ing') && s.length > 5 && !ING_NOUNS.has(s) && !/\s/.test(s)) {
    return { pos: 'verb', rule: 'ing-suffix' };
  }

  // ── Rule 14: Ends with -ed ────────────────────────────────────────────────
  // Past tense or past participle used as adjective — treat as verb
  if (s.endsWith('ed') && s.length > 4 && !/\s/.test(s)) {
    const edAdjs = new Set(['advanced', 'aged', 'blessed', 'beloved', 'colored', 'crooked', 'marked', 'naked', 'ragged', 'sacred', 'supposed', 'winged', 'wicked', 'beloved']);
    if (!edAdjs.has(s)) {
      return { pos: 'verb', rule: 'ed-suffix' };
    }
  }

  // ── Rule 15: Numbers (all-digit or common number words) ──────────────────
  if (/^\d+$/.test(s)) {
    return { pos: 'number', rule: 'numeric' };
  }
  const numberWords = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'zero', 'hundred', 'thousand', 'million', 'first', 'second', 'third', 'fourth', 'fifth']);
  if (numberWords.has(s)) {
    return { pos: 'number', rule: 'number-word' };
  }

  // ── Rule 16: Default — noun ───────────────────────────────────────────────
  // Most vocabulary words without a clear pattern are nouns
  return { pos: 'noun', rule: 'default-noun' };
}

// ── Main processing ───────────────────────────────────────────────────────────

let globalTotal = 0;
let globalPreviouslyTagged = 0;
let globalNewlyTagged = 0;
const globalRuleCounts = {};

for (const filename of TARGET_DECKS) {
  const filepath = path.join(DECKS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    console.warn(`SKIP (not found): ${filename}`);
    continue;
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const deck = JSON.parse(raw);

  if (!Array.isArray(deck.facts)) {
    console.warn(`SKIP (no facts array): ${filename}`);
    continue;
  }

  const total = deck.facts.length;
  let previouslyTagged = 0;
  let newlyTagged = 0;
  const deckRuleCounts = {};

  for (const fact of deck.facts) {
    if (fact.partOfSpeech) {
      previouslyTagged++;
      continue;
    }

    if (!fact.correctAnswer || typeof fact.correctAnswer !== 'string') {
      // Can't infer without a correctAnswer — leave untagged
      continue;
    }

    const { pos, rule } = inferPOS(fact.correctAnswer);
    fact.partOfSpeech = pos;
    newlyTagged++;

    deckRuleCounts[rule] = (deckRuleCounts[rule] || 0) + 1;
    globalRuleCounts[rule] = (globalRuleCounts[rule] || 0) + 1;
  }

  // Write back only if we changed anything
  if (newlyTagged > 0) {
    fs.writeFileSync(filepath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
  }

  const stillUntagged = total - previouslyTagged - newlyTagged;
  const coverage = Math.round(((previouslyTagged + newlyTagged) / total) * 100);
  console.log(`${filename.padEnd(26)} ${previouslyTagged}→${previouslyTagged + newlyTagged}/${total} (${coverage}%) | +${newlyTagged} new${stillUntagged > 0 ? ` | ${stillUntagged} still untagged` : ''}`);

  if (Object.keys(deckRuleCounts).length > 0) {
    const topRules = Object.entries(deckRuleCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  Rules: ${topRules.map(([r, c]) => `${r}(${c})`).join(', ')}`);
  }

  globalTotal += total;
  globalPreviouslyTagged += previouslyTagged;
  globalNewlyTagged += newlyTagged;
}

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('OVERALL SUMMARY');
console.log('═══════════════════════════════════════════════════════');
console.log(`Total facts:        ${globalTotal}`);
console.log(`Previously tagged:  ${globalPreviouslyTagged} (${Math.round(globalPreviouslyTagged / globalTotal * 100)}%)`);
console.log(`Newly tagged:       ${globalNewlyTagged}`);
const finalCoverage = Math.round((globalPreviouslyTagged + globalNewlyTagged) / globalTotal * 100);
console.log(`Final coverage:     ${globalPreviouslyTagged + globalNewlyTagged}/${globalTotal} (${finalCoverage}%)`);
const stillUntaggedGlobal = globalTotal - globalPreviouslyTagged - globalNewlyTagged;
if (stillUntaggedGlobal > 0) {
  console.log(`Still untagged:     ${stillUntaggedGlobal}`);
}

console.log('');
console.log('Rules fired:');
const sortedRules = Object.entries(globalRuleCounts).sort((a, b) => b[1] - a[1]);
for (const [rule, count] of sortedRules) {
  console.log(`  ${rule.padEnd(32)} ${count}`);
}
