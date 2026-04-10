/**
 * Quiz Sample Dump Script
 *
 * Produces a JSONL dump of rendered quiz questions EXACTLY as players see them
 * in-game, for every curated deck under data/decks/. One file per deck at
 * data/audits/quiz-dumps/<deckId>.jsonl.
 *
 * This feeds a downstream content quality audit — it is a READ-ONLY harness
 * that does NOT modify any deck JSON or src/ files.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json scripts/audit-dump-samples.ts [options]
 *
 * Options:
 *   --deck <id>        Single deck (default: all decks)
 *   --exclude-vocab    Skip vocab-classified decks
 *   --exclude-image    Skip world_flags and IMAGE_EXACT decks
 *   --sample <N>       Sample size per deck (default: 30; auto-bumps to 60 for ≥1000 facts)
 *   --out <dir>        Output directory (default: data/audits/quiz-dumps)
 *   --seed <N>         Master seed (default: 20260410)
 */

// Browser shim must load FIRST before any src/ imports
import '../tests/playtest/headless/browser-shim.js';

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { selectQuestionTemplate } from '../src/services/questionTemplateSelector';
import { selectDistractors, getDistractorCount } from '../src/services/curatedDistractorSelector';
import { isNumericalAnswer, getNumericalDistractors, displayAnswer } from '../src/services/numericalDistractorService';
import { ConfusionMatrix } from '../src/services/confusionMatrix';
import type { CuratedDeck, DeckFact } from '../src/data/curatedDeckTypes';
import type { Fact } from '../src/data/types';

// ---------------------------------------------------------------------------
// Helpers (copied in-file to avoid modifying quiz-audit-engine.ts)
// ---------------------------------------------------------------------------

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Seeded pseudo-random number generator (LCG). Returns values in [0, 1). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Shuffle array in-place using a seeded RNG. Returns the array. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = makeRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Deck classification (same constants as quiz-audit-engine.ts)
// ---------------------------------------------------------------------------

const VOCAB_PREFIXES = ['chinese_hsk', 'japanese_', 'korean_', 'french_', 'german_', 'spanish_', 'dutch_', 'czech_'];
const IMAGE_EXACT = ['world_flags'];

function classifyDeck(id: string): 'knowledge' | 'vocab' | 'image' {
  if (IMAGE_EXACT.includes(id)) return 'image';
  if (VOCAB_PREFIXES.some(p => id.startsWith(p))) return 'vocab';
  return 'knowledge';
}

// ---------------------------------------------------------------------------
// Deck loading (same logic as quiz-audit-engine.ts)
// ---------------------------------------------------------------------------

/** Extended deck type that includes the optional subDecks array present in JSON. */
interface DeckWithSubDecks extends CuratedDeck {
  subDecks?: Array<{ id: string; name: string; factIds: string[] }>;
}

function loadDeck(deckId: string): DeckWithSubDecks {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const deckPath = resolve(__dirname, '..', 'data', 'decks', `${deckId}.json`);
  try {
    const raw = readFileSync(deckPath, 'utf-8');
    const deck = JSON.parse(raw) as DeckWithSubDecks;
    if (!deck.questionTemplates) deck.questionTemplates = [];
    if (!deck.synonymGroups) deck.synonymGroups = [];
    return deck;
  } catch (_err) {
    console.error(`ERROR: Could not load deck "${deckId}" from ${deckPath}`);
    process.exit(1);
  }
}

function getAllDeckIds(): string[] {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const decksDir = resolve(__dirname, '..', 'data', 'decks');
  return readdirSync(decksDir)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .map(f => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// SubDeck lookup (same logic as quiz-audit-engine.ts getSubDeckLabel)
// ---------------------------------------------------------------------------

function getSubDeckName(fact: DeckFact, deck: DeckWithSubDecks): string | null {
  if (!deck.subDecks || deck.subDecks.length === 0) return null;
  for (const sd of deck.subDecks) {
    if (sd.factIds && sd.factIds.includes(fact.id)) return sd.name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  deckId: string | null;
  excludeVocab: boolean;
  excludeImage: boolean;
  sample: number | null;
  outDir: string;
  seed: number;
}

function parseArgs(): CliOptions {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  let deckId: string | null = null;
  let excludeVocab = false;
  let excludeImage = false;
  let sample: number | null = null;
  let outDir = resolve(__dirname, '..', 'data', 'audits', 'quiz-dumps');
  let seed = 20260410;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--deck' && args[i + 1]) {
      deckId = args[++i];
    } else if (arg === '--exclude-vocab') {
      excludeVocab = true;
    } else if (arg === '--exclude-image') {
      excludeImage = true;
    } else if (arg === '--sample' && args[i + 1]) {
      sample = parseInt(args[++i], 10);
    } else if (arg === '--out' && args[i + 1]) {
      outDir = args[++i];
    } else if (arg === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i], 10);
    }
  }

  return { deckId, excludeVocab, excludeImage, sample, outDir, seed };
}

// ---------------------------------------------------------------------------
// Output row type
// ---------------------------------------------------------------------------

interface QuizDumpRow {
  deckId: string;
  deckName: string;
  factId: string;
  poolId: string;
  subDeckName: string | null;
  masteryLevel: 0 | 2 | 4;
  requestedDistractorCount: 2 | 3 | 4;
  templateId: string;
  renderedQuestion: string;
  correctAnswer: string;
  options: string[];
  correctIndex: number;
  distractorSources: string[];
  isNumerical: boolean;
  difficulty: number;
  funScore: number;
  explanation: string;
  sourceName: string;
  sourceUrl?: string;
  categoryL1?: string;
  categoryL2?: string;
  examTags?: string[];
  partOfSpeech?: string;
  targetLanguageWord?: string;
  reading?: string;
  language?: string;
  quizMode?: string;
  quizResponseMode?: string;
  imageAssetPath?: string;
  fenPosition?: string;
  solutionMoves?: string[];
  tacticTheme?: string;
  lichessRating?: number;
  mapCoordinates?: [number, number];
  mapRegion?: string;
  mapDifficultyTier?: number;
  sentenceFurigana?: Array<{ t: string; r?: string; g?: string }>;
  sentenceRomaji?: string;
  sentenceTranslation?: string;
  grammarPointLabel?: string;
}

// ---------------------------------------------------------------------------
// Stratified sampling: distribute quota across pools proportionally, ensuring
// every non-empty pool gets at least 1 fact.
// ---------------------------------------------------------------------------

function stratifiedSample(
  factsByPool: Map<string, DeckFact[]>,
  quota: number,
  masterSeed: number,
): DeckFact[] {
  const pools = Array.from(factsByPool.entries()).filter(([, facts]) => facts.length > 0);
  if (pools.length === 0) return [];

  // Shuffle each pool deterministically first
  const shuffledPools: Array<{ poolId: string; facts: DeckFact[] }> = pools.map(([poolId, facts]) => ({
    poolId,
    facts: seededShuffle([...facts], djb2(poolId + '_' + masterSeed)),
  }));

  // Give every pool 1 slot first
  const slotsByPool = new Map<string, number>();
  for (const { poolId } of shuffledPools) slotsByPool.set(poolId, 1);
  let remaining = Math.max(0, quota - shuffledPools.length);

  // Distribute remaining proportionally by pool size (largest pools get more)
  if (remaining > 0) {
    const totalFacts = shuffledPools.reduce((s, p) => s + p.facts.length, 0);
    for (const { poolId, facts } of shuffledPools) {
      const extra = Math.round((facts.length / totalFacts) * remaining);
      slotsByPool.set(poolId, (slotsByPool.get(poolId) ?? 1) + extra);
    }
    // Trim any overage caused by rounding
    let total = Array.from(slotsByPool.values()).reduce((a, b) => a + b, 0);
    while (total > quota && shuffledPools.length > 0) {
      // Remove one from the pool with the most slots
      let maxPool = shuffledPools[0].poolId;
      for (const { poolId } of shuffledPools) {
        if ((slotsByPool.get(poolId) ?? 0) > (slotsByPool.get(maxPool) ?? 0)) maxPool = poolId;
      }
      slotsByPool.set(maxPool, (slotsByPool.get(maxPool) ?? 1) - 1);
      total--;
    }
  }

  // Collect sampled facts in order
  const result: DeckFact[] = [];
  for (const { poolId, facts } of shuffledPools) {
    const slots = Math.min(slotsByPool.get(poolId) ?? 1, facts.length);
    result.push(...facts.slice(0, slots));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Render a single fact at a given mastery level into a QuizDumpRow.
// Returns null and logs an error if rendering fails.
// ---------------------------------------------------------------------------

const MASTERY_LEVELS: Array<0 | 2 | 4> = [0, 2, 4];

function renderFact(
  fact: DeckFact,
  deck: DeckWithSubDecks,
  masteryLevel: 0 | 2 | 4,
): QuizDumpRow | null {
  try {
    const isImageMode = fact.quizMode === 'image_question' || fact.quizMode === 'image_answers';
    const isChessMode = fact.quizMode === 'chess_tactic' || fact.quizResponseMode === 'chess_move';
    const isMapMode = fact.quizResponseMode === 'map_pin';

    // Passthrough fields always included
    const passthrough: Partial<QuizDumpRow> = {
      quizMode: fact.quizMode,
      quizResponseMode: fact.quizResponseMode,
      imageAssetPath: fact.imageAssetPath,
      fenPosition: fact.fenPosition,
      solutionMoves: fact.solutionMoves,
      tacticTheme: fact.tacticTheme,
      lichessRating: fact.lichessRating,
      mapCoordinates: fact.mapCoordinates,
      mapRegion: fact.mapRegion,
      mapDifficultyTier: fact.mapDifficultyTier,
      sentenceFurigana: fact.sentenceFurigana,
      sentenceRomaji: fact.sentenceRomaji,
      sentenceTranslation: fact.sentenceTranslation,
      grammarPointLabel: fact.grammarPointLabel,
    };

    // Remove undefined keys from passthrough
    for (const key of Object.keys(passthrough) as Array<keyof typeof passthrough>) {
      if (passthrough[key] === undefined) delete passthrough[key];
    }

    const baseRow: Omit<QuizDumpRow, 'templateId' | 'renderedQuestion' | 'correctAnswer' | 'options' | 'correctIndex' | 'distractorSources' | 'isNumerical' | 'requestedDistractorCount'> = {
      deckId: deck.id,
      deckName: deck.name,
      factId: fact.id,
      poolId: fact.answerTypePoolId,
      subDeckName: getSubDeckName(fact, deck),
      masteryLevel,
      difficulty: fact.difficulty,
      funScore: fact.funScore,
      explanation: fact.explanation,
      sourceName: fact.sourceName,
      ...passthrough,
    };

    if (fact.sourceUrl !== undefined) (baseRow as QuizDumpRow).sourceUrl = fact.sourceUrl;
    if (fact.categoryL1 !== undefined) (baseRow as QuizDumpRow).categoryL1 = fact.categoryL1;
    if (fact.categoryL2 !== undefined) (baseRow as QuizDumpRow).categoryL2 = fact.categoryL2;
    if (fact.examTags !== undefined) (baseRow as QuizDumpRow).examTags = fact.examTags;
    if (fact.partOfSpeech !== undefined) (baseRow as QuizDumpRow).partOfSpeech = fact.partOfSpeech;
    if (fact.targetLanguageWord !== undefined) (baseRow as QuizDumpRow).targetLanguageWord = fact.targetLanguageWord;
    if (fact.reading !== undefined) (baseRow as QuizDumpRow).reading = fact.reading;
    if (fact.language !== undefined) (baseRow as QuizDumpRow).language = fact.language;

    // For image / chess / map facts: emit degenerate render (engine can't drive these in CLI)
    if (isImageMode || isChessMode || isMapMode) {
      return {
        ...baseRow,
        templateId: 'passthrough',
        renderedQuestion: fact.quizQuestion ?? '',
        correctAnswer: displayAnswer(fact.correctAnswer),
        options: [displayAnswer(fact.correctAnswer)],
        correctIndex: 0,
        distractorSources: [],
        isNumerical: false,
        requestedDistractorCount: getDistractorCount(masteryLevel) as 2 | 3 | 4,
      };
    }

    // Standard rendering path
    const seed = djb2(fact.id + '_dump' + masteryLevel);
    const templateResult = selectQuestionTemplate(fact, deck, masteryLevel, [], seed);
    const { renderedQuestion, answerPoolId, correctAnswer, template } = templateResult;
    const correctDisplay = displayAnswer(correctAnswer);
    const requestedCount = getDistractorCount(masteryLevel) as 2 | 3 | 4;

    const isNumerical = isNumericalAnswer(fact.correctAnswer);
    let distractorDisplays: string[] = [];
    let distractorSources: string[] = [];

    if (isNumerical) {
      const factAdapter = { id: fact.id, correctAnswer: fact.correctAnswer } as unknown as Fact;
      const numericalDistractors = getNumericalDistractors(factAdapter, requestedCount);
      distractorDisplays = numericalDistractors.map(d => displayAnswer(d));
      distractorSources = numericalDistractors.map(() => 'numerical');
    } else {
      const pool = deck.answerTypePools.find(p => p.id === answerPoolId);
      if (pool) {
        const result = selectDistractors(
          fact,
          pool,
          deck.facts,
          deck.synonymGroups,
          new ConfusionMatrix(),
          null,
          requestedCount,
          masteryLevel,
        );
        distractorDisplays = result.distractors.map(d => displayAnswer(d.correctAnswer));
        distractorSources = result.sources;
      }
    }

    // Build options array and shuffle
    const options: string[] = [correctDisplay, ...distractorDisplays];
    const indices = options.map((_, i) => i);
    seededShuffle(indices, djb2(fact.id + '_shuffle' + masteryLevel));
    const shuffledOptions = indices.map(i => options[i]);
    const correctIndex = indices.indexOf(0); // index 0 was correct before shuffle

    return {
      ...baseRow,
      templateId: template.id,
      renderedQuestion,
      correctAnswer: correctDisplay,
      options: shuffledOptions,
      correctIndex,
      distractorSources,
      isNumerical,
      requestedDistractorCount: requestedCount,
    };
  } catch (err) {
    process.stderr.write(`  [ERROR] fact ${fact.id} at mastery=${masteryLevel}: ${String(err)}\n`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Process a single deck
// ---------------------------------------------------------------------------

function processDeck(
  deckId: string,
  opts: CliOptions,
): { rowCount: number } {
  let deck: DeckWithSubDecks;
  try {
    deck = loadDeck(deckId);
  } catch (_e) {
    process.stderr.write(`Skipping ${deckId} — load failed\n`);
    return { rowCount: 0 };
  }

  // Determine quota
  const defaultSample = deck.facts.length >= 1000 ? 60 : 30;
  const quota = opts.sample !== null ? opts.sample : defaultSample;

  // Group facts by pool
  const factsByPool = new Map<string, DeckFact[]>();
  for (const fact of deck.facts) {
    const list = factsByPool.get(fact.answerTypePoolId) ?? [];
    list.push(fact);
    factsByPool.set(fact.answerTypePoolId, list);
  }

  // Stratified sampling
  const masterSeed = djb2(deckId + String(opts.seed));
  const sampledFacts = stratifiedSample(factsByPool, quota, masterSeed);

  // Render each fact × 3 mastery levels
  const rows: QuizDumpRow[] = [];
  for (const fact of sampledFacts) {
    for (const mastery of MASTERY_LEVELS) {
      const row = renderFact(fact, deck, mastery);
      if (row !== null) rows.push(row);
    }
  }

  // Write JSONL output
  mkdirSync(opts.outDir, { recursive: true });
  const outPath = resolve(opts.outDir, `${deckId}.jsonl`);
  const jsonl = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
  writeFileSync(outPath, jsonl, 'utf-8');

  process.stderr.write(`${deckId}: ${sampledFacts.length} facts × 3 mastery = ${rows.length} rows\n`);
  return { rowCount: rows.length };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const opts = parseArgs();

  // Determine which decks to process
  let deckIds: string[];
  if (opts.deckId) {
    deckIds = [opts.deckId];
  } else {
    deckIds = getAllDeckIds().filter(id => {
      if (id.startsWith('_')) return false;
      const cls = classifyDeck(id);
      if (opts.excludeImage && cls === 'image') return false;
      if (opts.excludeVocab && cls === 'vocab') return false;
      return true;
    });
  }

  let totalRows = 0;
  for (const id of deckIds) {
    const { rowCount } = processDeck(id, opts);
    totalRows += rowCount;
  }

  process.stderr.write(`\nDone. ${totalRows} total rows across ${deckIds.length} deck(s). Output: ${opts.outDir}\n`);
}

main();
