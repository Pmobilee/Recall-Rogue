#!/usr/bin/env node
/**
 * bake-grammar-furigana.mjs
 *
 * Offline bake script: precomputes furigana, romaji, translation, and grammar-point
 * label for every fill-in-the-blank fact in the 5 Japanese grammar decks.
 *
 * Adds 4 fields to each grammar FITB fact:
 *   - sentenceFurigana: Array<{ t: string; r?: string; g?: string }>
 *   - sentenceRomaji: string
 *   - sentenceTranslation: string | undefined
 *   - grammarPointLabel: string
 *
 * Usage: node scripts/japanese/bake-grammar-furigana.mjs
 *
 * Requirements: kuromoji and wanakana in package.json (both present).
 * Dictionary: public/assets/kuromoji/  and  public/assets/dict/jdict-compact.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as wanakana from 'wanakana';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const KUROMOJI_DICT_PATH = path.join(REPO_ROOT, 'public/assets/kuromoji');
const JMDICT_PATH = path.join(REPO_ROOT, 'public/assets/dict/jdict-compact.json');

const DECK_FILES = [
  'data/decks/japanese_n5_grammar.json',
  'data/decks/japanese_n4_grammar.json',
  'data/decks/japanese_n3_grammar.json',
  'data/decks/japanese_n2_grammar.json',
  'data/decks/japanese_n1_grammar.json',
];

/** Parts of speech to skip for gloss attachment */
const SKIP_GLOSS_POS = new Set(['助詞', '助動詞', '記号', '接続詞']);

/** Regex to detect kanji (CJK Unified Ideographs) */
const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

// ------------------------------------------------------------------
// Kuromoji initialization
// ------------------------------------------------------------------

/**
 * Build kuromoji tokenizer (async, wraps callback API).
 * Uses createRequire since kuromoji is CommonJS only.
 */
function buildTokenizer() {
  const require = createRequire(import.meta.url);
  const kuromoji = require('kuromoji');
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });
}

/**
 * Load and parse the compact JMdict lookup file.
 * Returns map: word → { r: reading, g: gloss }
 */
async function loadJmdict() {
  const raw = await fs.readFile(JMDICT_PATH, 'utf-8');
  return JSON.parse(raw);
}

// ------------------------------------------------------------------
// Grammar-point label parsing
// ------------------------------------------------------------------

/**
 * Parse fact.explanation to produce a grammarPointLabel.
 *
 * Expected format: "<answer> (<description>) — <example>"
 *   e.g. "が (subject marker particle) — バスが来るよ。"
 *
 * Result: "が — subject marker particle"
 * Fallback: "<correctAnswer> — grammar form"
 */
function parseExplanation(explanation, correctAnswer) {
  if (!explanation) return `${correctAnswer} — grammar form`;

  const match = explanation.match(/^(.+?)\s*\((.+?)\)/);
  if (match) {
    const answer = match[1].trim();
    const description = match[2].trim();
    return `${answer} — ${description}`;
  }

  return `${correctAnswer} — grammar form`;
}

// ------------------------------------------------------------------
// Core bake logic for a single fact
// ------------------------------------------------------------------

/**
 * Bake one grammar FITB fact.
 * Mutates the fact object in place by adding the 4 new fields.
 *
 * @param {object} fact - The DeckFact object
 * @param {object} tokenizer - Kuromoji tokenizer
 * @param {object} dict - JMdict compact map
 * @param {object[]} warnings - Mutable array to collect warning messages
 */
function bakeFact(fact, tokenizer, dict, warnings) {
  // Split quizQuestion on newline
  const lines = fact.quizQuestion.split('\n');
  const sentenceRaw = lines[0];
  let sentenceTranslation;
  if (lines.length > 1) {
    // Strip surrounding parens: "(The bus is coming!)" → "The bus is coming!"
    const translationLine = lines[1].trim();
    const m = translationLine.match(/^\((.+)\)$/);
    sentenceTranslation = m ? m[1] : translationLine;
  }

  // Split sentence on {___} blanks
  const segments = sentenceRaw.split('{___}');
  // segments[0] = before first blank, segments[1] = between blank 1 and blank 2 (if any), etc.

  // Tokenize each segment and build sentenceFurigana array
  const sentenceFurigana = [];
  // romajiParts holds one string per segment (built pre-collapse) plus '{___}' separators.
  // Building from raw enriched tokens preserves natural token boundaries as spaces.
  const romajiParts = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.length > 0) {
      const rawTokens = tokenizer.tokenize(seg);

      // Convert raw kuromoji tokens to our enriched token objects
      const enriched = rawTokens.map(t => {
        const surface = t.surface_form;
        const pos = t.pos;
        const basicForm = t.basic_form !== '*' ? t.basic_form : surface;

        // Attach hiragana reading only if token has kanji
        let r;
        if (KANJI_RE.test(surface) && t.reading && t.reading !== surface) {
          r = wanakana.toHiragana(t.reading);
        }

        // Attach gloss if: content word, not a particle/aux/symbol/conjunction,
        // and the token is not the correct answer (don't reveal it)
        let g;
        if (!SKIP_GLOSS_POS.has(pos)) {
          const entry = dict[basicForm] || dict[surface];
          if (entry && entry.g) {
            // Don't attach gloss to tokens matching the correct answer
            if (surface !== fact.correctAnswer && basicForm !== fact.correctAnswer) {
              g = entry.g;
            }
          }
        }

        return { surface, r, g, pos, reading: t.reading || surface };
      });

      // Build romaji from pre-collapse enriched tokens so natural token boundaries
      // become spaces. Punctuation tokens (pos === '記号') are appended directly
      // without a preceding space to avoid "basu ." style artifacts.
      let segRomaji = '';
      for (const tok of enriched) {
        const isPunct = tok.pos === '記号';
        // Use the token's reading for kana/kanji; surface for ASCII/romaji loanwords
        const reading = tok.reading || tok.surface;
        const romajiChunk = wanakana.toRomaji(reading);
        if (isPunct) {
          // Append punctuation directly — no space
          segRomaji += romajiChunk;
        } else {
          // Space-separate content tokens
          segRomaji = segRomaji.length > 0 ? segRomaji + ' ' + romajiChunk : romajiChunk;
        }
      }
      romajiParts.push(segRomaji);

      // Collapse adjacent plain tokens (no r, no g) into single segments
      // (sentenceFurigana collapse logic — unchanged)
      const collapsed = [];
      for (const tok of enriched) {
        const isPlain = !tok.r && !tok.g;
        if (isPlain && collapsed.length > 0 && collapsed[collapsed.length - 1]._plain) {
          // Merge into previous plain segment
          collapsed[collapsed.length - 1].t += tok.surface;
          collapsed[collapsed.length - 1]._plainReading += tok.reading || tok.surface;
        } else {
          const entry = {
            t: tok.surface,
            _plain: isPlain,
            _plainReading: tok.reading || tok.surface,
          };
          if (tok.r) entry.r = tok.r;
          if (tok.g) entry.g = tok.g;
          collapsed.push(entry);
        }
      }

      // Build sentenceFurigana segments from collapsed tokens
      for (const tok of collapsed) {
        const furiganaEntry = { t: tok.t };
        if (tok.r) furiganaEntry.r = tok.r;
        if (tok.g) furiganaEntry.g = tok.g;
        sentenceFurigana.push(furiganaEntry);
      }
    }

    // Insert blank marker between segments (not after the last segment)
    if (i < segments.length - 1) {
      sentenceFurigana.push({ t: '{___}' });
      romajiParts.push('{___}');
    }
  }

  // Compute sentenceRomaji: join segment strings around {___} markers.
  // Each segment string is already space-separated at token boundaries.
  // Strip trailing punctuation from each segment, then join with ' ___ '.
  const romajiConverted = [];
  let inBlank = false;
  for (const part of romajiParts) {
    if (part === '{___}') {
      inBlank = true;
      romajiConverted.push('___');
    } else {
      const cleaned = part
        .replace(/[。、！？\.]+$/, '') // strip trailing JP/ASCII punctuation
        .replace(/[。、！？]/g, '')     // strip mid-string JP punctuation
        .trim();
      if (inBlank) {
        // This segment follows a blank — prefix with space handled by join
        inBlank = false;
      }
      romajiConverted.push(cleaned);
    }
  }
  // Re-assemble: non-blank parts separated by ' ___ '
  // The romajiConverted array interleaves content strings and '___' markers.
  // Rejoin content parts with ' ___ ' in place of the '___' markers.
  const sentenceRomaji = romajiConverted
    .join(' ')
    .replace(/\s+___\s+/g, ' ___ ')
    .replace(/\s+/g, ' ')
    .trim();

  // Derive grammarPointLabel
  const grammarPointLabel = parseExplanation(fact.explanation, fact.correctAnswer);

  // Warn if label fell back
  if (grammarPointLabel.endsWith('— grammar form')) {
    warnings.push(`  WARN: grammarPointLabel fallback for fact ${fact.id} — explanation: "${fact.explanation}"`);
  }

  // Write new fields onto the fact
  fact.sentenceFurigana = sentenceFurigana;
  fact.sentenceRomaji = sentenceRomaji;
  if (sentenceTranslation !== undefined) {
    fact.sentenceTranslation = sentenceTranslation;
  }
  fact.grammarPointLabel = grammarPointLabel;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  console.log('Loading kuromoji tokenizer...');
  const tokenizer = await buildTokenizer();
  console.log('Tokenizer ready.');

  console.log('Loading JMdict...');
  const dict = await loadJmdict();
  console.log(`JMdict loaded: ${Object.keys(dict).length} entries.`);
  console.log('');

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalWarnings = 0;

  for (const relPath of DECK_FILES) {
    const deckPath = path.join(REPO_ROOT, relPath);
    const raw = await fs.readFile(deckPath, 'utf-8');
    const deck = JSON.parse(raw);

    const deckId = deck.id || path.basename(relPath, '.json');
    let processed = 0;
    let skipped = 0;
    const warnings = [];

    for (const fact of deck.facts) {
      if (!fact.quizQuestion || !fact.quizQuestion.includes('{___}')) {
        skipped++;
        continue;
      }

      try {
        bakeFact(fact, tokenizer, dict, warnings);
        processed++;
      } catch (err) {
        console.error(`  ERROR baking fact ${fact.id}: ${err.message}`);
        skipped++;
      }
    }

    // Write back with 2-space indent
    const output = JSON.stringify(deck, null, 2) + '\n';
    await fs.writeFile(deckPath, output, 'utf-8');

    console.log(`${deckId}:`);
    console.log(`  Processed: ${processed} facts`);
    console.log(`  Skipped (non-FITB): ${skipped} facts`);
    if (warnings.length > 0) {
      console.log(`  Warnings (${warnings.length}):`);
      for (const w of warnings) console.log(w);
    } else {
      console.log(`  Warnings: 0`);
    }
    console.log('');

    totalProcessed += processed;
    totalSkipped += skipped;
    totalWarnings += warnings.length;
  }

  console.log('=== Summary ===');
  console.log(`Total facts processed: ${totalProcessed}`);
  console.log(`Total facts skipped:   ${totalSkipped}`);
  console.log(`Total warnings:        ${totalWarnings}`);
  console.log('');
  console.log('Done. Run: node scripts/verify-all-decks.mjs');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
