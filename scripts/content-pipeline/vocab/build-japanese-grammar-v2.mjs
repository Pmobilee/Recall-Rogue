#!/usr/bin/env node
/**
 * build-japanese-grammar-v2.mjs
 *
 * Generates 2–3 quiz facts per JLPT grammar point from the full-japanese-study-deck
 * reference data and writes them to src/data/seed/grammar-ja.json.
 *
 * Fact types per grammar point:
 *   meaning  — L2→L1: "What does X mean?"
 *   recall   — L1→L2: "Which pattern means Y?"
 *   fill     — Sentence completion using first example phrase (when available)
 *
 * Usage: node scripts/content-pipeline/vocab/build-japanese-grammar-v2.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..', '..', '..');
const GRAMMAR_DIR = path.join(ROOT, 'data', 'references', 'full-japanese-study-deck', 'results', 'grammar', 'json');
const OUT_FILE   = path.join(ROOT, 'src', 'data', 'seed', 'grammar-ja.json');

// ---------------------------------------------------------------------------
// Source files → JLPT level mapping
// ---------------------------------------------------------------------------
const LEVEL_FILES = [
  { file: 'grammar_n5.json',         level: 'n5' },
  { file: 'grammar_n4.json',         level: 'n4' },
  { file: 'grammar_n3.json',         level: 'n3' },
  { file: 'grammar_n2.json',         level: 'n2' },
  { file: 'grammar_n1.json',         level: 'n1' },
  { file: 'grammar_additional.json', level: 'n3' },  // map to N3 per spec
];

const LEVEL_TO_CATEGORY = {
  n5: 'japanese_n5',
  n4: 'japanese_n4',
  n3: 'japanese_n3',
  n2: 'japanese_n2',
  n1: 'japanese_n1',
};

// ---------------------------------------------------------------------------
// Ruby HTML helpers
// ---------------------------------------------------------------------------

/**
 * Strip ruby annotations, keeping only the kanji/base characters.
 * "<ruby>食<rp>(</rp><rt>た</rt><rp>)</rp></ruby>" → "食"
 */
function stripRuby(html) {
  return html
    .replace(/<ruby>([^<]+)<rp>[^<]*<\/rp><rt>[^<]*<\/rt><rp>[^<]*<\/rp><\/ruby>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extract kanji→reading pairs from ruby HTML.
 * Returns array of { kanji, reading }.
 */
function extractReadings(html) {
  const readings = [];
  const re = /<ruby>([^<]+)<rp>[^<]*<\/rp><rt>([^<]*)<\/rt>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    readings.push({ kanji: m[1], reading: m[2] });
  }
  return readings;
}

/**
 * Build a pronunciation string from ruby HTML — returns the full reading
 * with kanji substituted by their furigana, interspersed with non-kanji text.
 * Falls back to just stripping tags if no ruby found.
 */
function buildPronunciation(html) {
  const readings = extractReadings(html);
  if (readings.length === 0) return stripRuby(html);

  let result = html;
  // Replace each ruby block with its reading
  result = result.replace(
    /<ruby>([^<]+)<rp>[^<]*<\/rp><rt>([^<]*)<\/rt><rp>[^<]*<\/rp><\/ruby>/g,
    (_match, _kanji, reading) => reading
  );
  // Strip remaining tags
  result = result.replace(/<[^>]+>/g, '').trim();
  return result;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/** Romanize a Japanese grammar pattern to a URL-safe slug (≤ 20 chars). */
function toSlug(point) {
  return point
    .replace(/[〜～]/g, '')          // tilde markers
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3000-\u9fff\uac00-\ud7af-]/g, '')  // keep word chars + CJK + Korean
    .toLowerCase()
    .slice(0, 20)
    .replace(/-+$/, '');
}

// ---------------------------------------------------------------------------
// Distractor pool builders
// ---------------------------------------------------------------------------

/**
 * Build per-level pools:
 *   meanings[level] = [array of English meaning strings from all points at that level]
 *   patterns[level] = [array of grammar point strings from all points at that level]
 */
function buildPools(allGrammar) {
  const meanings  = {};
  const patterns  = {};

  for (const { level, points } of allGrammar) {
    if (!meanings[level])  meanings[level]  = [];
    if (!patterns[level]) patterns[level] = [];

    for (const g of points) {
      if (g.meaning?.meaning) meanings[level].push(g.meaning.meaning);
      patterns[level].push(g.point);
    }
  }

  return { meanings, patterns };
}

/**
 * Pick up to `n` distractors from `pool`, excluding `exclude`.
 * Shuffles deterministically based on a simple index rotation.
 */
function pickDistractors(pool, exclude, n, offset = 0) {
  const filtered = pool.filter(item => item !== exclude);
  const result = [];
  for (let i = 0; i < filtered.length && result.length < n; i++) {
    const idx = (i + offset) % filtered.length;
    if (!result.includes(filtered[idx])) {
      result.push(filtered[idx]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fact builders
// ---------------------------------------------------------------------------

function buildMeaningFact(g, level, slug, meaningPool) {
  const meaning = g.meaning?.meaning ?? '';
  const usage   = (g.usages ?? []).join('; ');
  const firstPhrase = g.phrases?.[0];
  const exampleOrig = firstPhrase?.originalPhrase ?? '';
  const exampleTrans = firstPhrase?.translation ?? '';
  const reading = g.readings?.[0]?.reading ?? g.point;

  let explanation = `${g.point} — ${meaning}.`;
  if (usage) explanation += ` Usage: ${usage}.`;
  if (exampleOrig && exampleTrans) {
    explanation += ` Example: ${exampleOrig} (${exampleTrans})`;
  }

  const distractors = pickDistractors(meaningPool, meaning, 7, slug.length);

  return {
    id:           `ja-grammar-${level}-${slug}-meaning`,
    type:         'vocabulary',
    statement:    `The grammar pattern ${g.point} means '${meaning}'`,
    quizQuestion: `What does the grammar pattern '${g.point}' mean?`,
    correctAnswer: meaning,
    distractors,
    explanation,
    wowFactor:    6,
    difficulty:   levelToDifficulty(level),
    ageRating:    'kid',
    categoryL1:   'language',
    categoryL2:   LEVEL_TO_CATEGORY[level],
    pronunciation: reading,
    exampleSentence: exampleOrig && exampleTrans ? `${exampleOrig} (${exampleTrans})` : undefined,
    domain:       'vocab_ja',
    language:     'ja',
    reading,
    subdeck:      'Grammar',
    jlptLevel:    level.toUpperCase(),
    category:     ['language', LEVEL_TO_CATEGORY[level]],
    rarity:       levelToRarity(level),
    funScore:     7,
    sourceName:   'JLPT Grammar (full-japanese-study-deck)',
    contentVolatility: 'timeless',
    _haikuProcessed:    true,
    _haikuProcessedAt:  '2026-03-16T00:00:00.000Z',
  };
}

function buildRecallFact(g, level, slug, patternPool) {
  const meaning = g.meaning?.meaning ?? '';
  const usage   = (g.usages ?? []).join('; ');
  const reading = g.readings?.[0]?.reading ?? g.point;

  let explanation = `${g.point} means '${meaning}'.`;
  if (usage) explanation += ` Usage: ${usage}.`;

  const distractors = pickDistractors(patternPool, g.point, 7, slug.length);

  return {
    id:           `ja-grammar-${level}-${slug}-recall`,
    type:         'vocabulary',
    statement:    `The Japanese grammar pattern for '${meaning}' is ${g.point}`,
    quizQuestion: `Which Japanese grammar pattern means '${meaning}'?`,
    correctAnswer: g.point,
    distractors,
    explanation,
    wowFactor:    6,
    difficulty:   levelToDifficulty(level),
    ageRating:    'kid',
    categoryL1:   'language',
    categoryL2:   LEVEL_TO_CATEGORY[level],
    pronunciation: reading,
    domain:       'vocab_ja',
    language:     'ja',
    reading,
    subdeck:      'Grammar',
    jlptLevel:    level.toUpperCase(),
    category:     ['language', LEVEL_TO_CATEGORY[level]],
    rarity:       levelToRarity(level),
    funScore:     7,
    sourceName:   'JLPT Grammar (full-japanese-study-deck)',
    contentVolatility: 'timeless',
    _haikuProcessed:    true,
    _haikuProcessedAt:  '2026-03-16T00:00:00.000Z',
  };
}

/**
 * Build a fill-in-the-blank fact from the first example phrase.
 * Replaces the grammar pattern in the original phrase with ___.
 * Returns null if the phrase doesn't contain the grammar pattern.
 */
function buildFillFact(g, level, slug, patternPool) {
  const firstPhrase = g.phrases?.[0];
  if (!firstPhrase?.translation) return null;

  const original    = firstPhrase.originalPhrase ?? stripRuby(firstPhrase.phrase);
  const translation = firstPhrase.translation;
  const reading     = g.readings?.[0]?.reading ?? g.point;

  // Try to find the pattern in the original phrase
  // Grammar points may have prefixes like 〜 or 〜て that aren't in the actual phrase
  const cleanPoint = g.point.replace(/^[〜～]/, '');

  if (!cleanPoint || !original.includes(cleanPoint)) {
    // Pattern not found literally — skip fill fact
    return null;
  }

  // Replace FIRST occurrence of the pattern with ___
  const questionPhrase = original.replace(cleanPoint, '___');

  const question = `${questionPhrase} (${translation})`;

  const fullPronunciation = buildPronunciation(firstPhrase.phrase);

  const distractors = pickDistractors(patternPool, g.point, 7, slug.length + 3);

  return {
    id:           `ja-grammar-${level}-${slug}-fill`,
    type:         'vocabulary',
    statement:    `Fill in the blank: ${questionPhrase}`,
    quizQuestion: question,
    correctAnswer: g.point,
    distractors,
    explanation:  `${g.point} means '${g.meaning?.meaning ?? ''}'. Full sentence: ${original}`,
    wowFactor:    7,
    difficulty:   levelToDifficulty(level) + 1,
    ageRating:    'kid',
    categoryL1:   'language',
    categoryL2:   LEVEL_TO_CATEGORY[level],
    pronunciation: fullPronunciation !== original ? fullPronunciation : reading,
    exampleSentence: `${original} (${translation})`,
    domain:       'vocab_ja',
    language:     'ja',
    reading,
    subdeck:      'Grammar',
    jlptLevel:    level.toUpperCase(),
    category:     ['language', LEVEL_TO_CATEGORY[level]],
    rarity:       levelToRarity(level),
    funScore:     8,
    sourceName:   'JLPT Grammar (full-japanese-study-deck)',
    contentVolatility: 'timeless',
    _haikuProcessed:    true,
    _haikuProcessedAt:  '2026-03-16T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Level helpers
// ---------------------------------------------------------------------------

function levelToDifficulty(level) {
  const map = { n5: 1, n4: 2, n3: 3, n2: 4, n1: 5 };
  return map[level] ?? 3;
}

function levelToRarity(level) {
  const map = { n5: 'common', n4: 'common', n3: 'uncommon', n2: 'rare', n1: 'epic' };
  return map[level] ?? 'uncommon';
}

// ---------------------------------------------------------------------------
// Deduplication: multiple entries may share the same slug
// ---------------------------------------------------------------------------

function deduplicateSlug(slug, seen) {
  if (!seen.has(slug)) {
    seen.set(slug, 0);
    return slug;
  }
  const count = seen.get(slug) + 1;
  seen.set(slug, count);
  return `${slug.slice(0, 17)}${count}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const allGrammar = [];
  const stats = {
    perLevel:    {},
    perType:     { meaning: 0, recall: 0, fill: 0 },
    totalPoints: 0,
  };

  // Load all grammar files
  for (const { file, level } of LEVEL_FILES) {
    const filePath = path.join(GRAMMAR_DIR, file);
    const points   = JSON.parse(readFileSync(filePath, 'utf-8'));
    allGrammar.push({ file, level, points });
    stats.totalPoints += points.length;
    console.log(`Loaded ${file}: ${points.length} grammar points → ${level.toUpperCase()}`);
  }

  // Build distractor pools per level
  const { meanings: meaningPools, patterns: patternPools } = buildPools(allGrammar);

  // Generate facts
  const facts = [];
  const seenSlugs = new Map();

  for (const { level, points } of allGrammar) {
    let levelCount = 0;

    for (const g of points) {
      if (!g.meaning?.meaning) continue;  // skip entries without a meaning

      const rawSlug = toSlug(g.point);
      const slug    = deduplicateSlug(rawSlug, seenSlugs);

      const meaningFact = buildMeaningFact(g, level, slug, meaningPools[level] ?? []);
      facts.push(meaningFact);
      stats.perType.meaning++;
      levelCount++;

      const recallFact = buildRecallFact(g, level, slug, patternPools[level] ?? []);
      facts.push(recallFact);
      stats.perType.recall++;
      levelCount++;

      const fillFact = buildFillFact(g, level, slug, patternPools[level] ?? []);
      if (fillFact) {
        facts.push(fillFact);
        stats.perType.fill++;
        levelCount++;
      }
    }

    stats.perLevel[level] = (stats.perLevel[level] ?? 0) + levelCount;
  }

  // Write output
  writeFileSync(OUT_FILE, JSON.stringify(facts, null, 2), 'utf-8');
  console.log(`\nWrote ${facts.length} facts to ${OUT_FILE}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total grammar points processed: ${stats.totalPoints}`);
  console.log('\nFacts per level:');
  for (const [level, count] of Object.entries(stats.perLevel)) {
    console.log(`  ${level.toUpperCase()}: ${count}`);
  }
  console.log('\nFacts per type:');
  for (const [type, count] of Object.entries(stats.perType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nGrand total: ${facts.length} facts`);

  // Build the facts DB
  console.log('\n--- Running build-facts-db.mjs ---');
  try {
    const output = execSync(`node ${path.join(ROOT, 'scripts', 'build-facts-db.mjs')}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(output);
  } catch (err) {
    console.error('build-facts-db.mjs failed:', err.message);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

main();
