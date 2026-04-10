#!/usr/bin/env node
/**
 * verify-all-decks.mjs
 *
 * Batch wrapper that runs verification across ALL curated decks and outputs
 * a summary table showing which decks need fixing.
 *
 * Usage:
 *   node scripts/verify-all-decks.mjs
 *   node scripts/verify-all-decks.mjs --verbose   (show per-fact details)
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Grammar scar patterns — loaded from catalog file
// ---------------------------------------------------------------------------
let GRAMMAR_SCAR_PATTERNS = [];
try {
  const scarCatalog = JSON.parse(readFileSync(resolve(repoRoot, 'scripts/content-pipeline/grammar-scar-patterns.json'), 'utf8'));
  GRAMMAR_SCAR_PATTERNS = (scarCatalog.patterns || []).map(p => ({
    id: p.id,
    pattern: p.pattern,
    description: p.description,
  }));
} catch (e) {
  // Catalog not found — grammar scar check will be skipped
  console.warn('[verify-all-decks] Warning: grammar-scar-patterns.json not found — Check #25 disabled');
}


const VERBOSE = process.argv.includes('--verbose');

// ---------------------------------------------------------------------------
// ANSI colours
// ---------------------------------------------------------------------------
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ---------------------------------------------------------------------------
// Replicated from numericalDistractorService.ts
// ---------------------------------------------------------------------------

const BRACE_NUMBER_RE = /\{(\d[\d,]*\.?\d*)\}/;

function isNumericalAnswer(answer) {
  return BRACE_NUMBER_RE.test(answer);
}

function displayAnswer(answer) {
  return answer.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1');
}

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromId(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i);
  }
  return h >>> 0;
}

function parseNum(s) {
  return parseFloat(s.replace(/,/g, ''));
}

function hadCommas(s) {
  return s.includes(',');
}

function decimalPlaces(s) {
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

function formatLike(n, origStr) {
  const places = decimalPlaces(origStr);
  if (places > 0) return n.toFixed(places);
  const rounded = Math.round(n);
  if (hadCommas(origStr) || rounded >= 10000) return rounded.toLocaleString('en-US');
  return String(rounded);
}

function generateVariations(base, origStr, rand, count) {
  const places = decimalPlaces(origStr);
  const isDecimal = places > 0;

  if (isDecimal) {
    const results = [];
    for (let i = 0; i < count * 4; i++) {
      const pct = 0.2 + rand() * 0.3;
      const sign = i % 2 === 0 ? 1 : -1;
      const candidate = base + sign * base * pct;
      if (candidate <= 0) continue;
      const formatted = candidate.toFixed(places);
      if (parseFloat(formatted) !== base) results.push(formatted);
    }
    return results;
  }

  if (base >= 1 && base <= 12) {
    const pool = [];
    for (let delta = 1; delta <= Math.max(10, Math.ceil(base * 2)); delta++) {
      pool.push(base + delta);
      if (base - delta > 0) pool.push(base - delta);
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).map(v => String(v));
  }

  const currentYear = 2026;
  if (base >= 1000 && base <= currentYear && origStr.length === 4 && !origStr.includes(',')) {
    const age = currentYear - base;
    const maxDelta = age < 100 ? 30 : 60;
    const minDelta = age < 100 ? 5 : 10;
    const results = [];
    for (let i = 0; i < count * 4; i++) {
      const delta = Math.round(minDelta + rand() * (maxDelta - minDelta));
      const sign = i % 2 === 0 ? 1 : -1;
      const year = base + sign * delta;
      if (year > 0 && year <= currentYear && year !== base) {
        results.push(String(Math.round(year)));
      }
    }
    return results;
  }

  let minPct, maxPct, roundTo;
  if (base <= 100)       { minPct = 0.1;  maxPct = 0.4; roundTo = 1;    }
  else if (base <= 999)  { minPct = 0.15; maxPct = 0.5; roundTo = 10;   }
  else if (base <= 9999) { minPct = 0.15; maxPct = 0.5; roundTo = 100;  }
  else                   { minPct = 0.15; maxPct = 0.5; roundTo = 1000; }

  const results = [];
  for (let i = 0; i < count * 4; i++) {
    const pct = minPct + rand() * (maxPct - minPct);
    const sign = i % 2 === 0 ? 1 : -1;
    const raw = base + sign * base * pct;
    const candidate = Math.round(raw / roundTo) * roundTo;
    if (candidate > 0 && candidate !== base) {
      results.push(formatLike(candidate, origStr));
    }
  }
  return results;
}

/**
 * Returns up to `count` numeric distractors for a brace-marked answer.
 * Mirrors getNumericalDistractors() from numericalDistractorService.ts.
 */
function getNumericalDistractors(fact, count = 3) {
  const answer = fact.correctAnswer;
  const match = answer.match(BRACE_NUMBER_RE);
  if (!match) return [];

  const numStr = match[1];
  const base = parseNum(numStr);
  if (base === 0) return [];

  const rand = makePrng(seedFromId(fact.id));
  const template = answer.replace(BRACE_NUMBER_RE, '{{PLACEHOLDER}}');
  const candidates = generateVariations(base, numStr, rand, count * 3);

  const correctDisplay = displayAnswer(answer);
  const seen = new Set([correctDisplay]);
  const results = [];

  for (const c of candidates) {
    if (results.length >= count) break;
    const distractor = template.replace('{{PLACEHOLDER}}', c);
    if (!seen.has(distractor)) {
      seen.add(distractor);
      results.push(distractor);
    }
  }
  return results;
}


// ---------------------------------------------------------------------------
// Word-level leak detection (Check #22 extension)
// Common function words that appear in question stems and may also appear in
// answers without constituting a semantic leak (e.g. "were" in "...which were
// built" + "were" in an answer phrase). Domain-specific content words like
// "war", "battle", "empire" are intentionally NOT in this list — their presence
// in both Q and A is genuinely suspicious and should be flagged.
// Minimum answer-word length: 3 chars (captures "war", "age", "act" etc.).
// ---------------------------------------------------------------------------
const ANSWER_WORD_STOPWORDS = new Set([
  // Articles
  'the', 'a', 'an',
  // Interrogative / relative pronouns and adverbs (common in question phrasing)
  'what', 'who', 'how', 'why', 'did', 'does', 'was', 'are', 'is',
  'which', 'when', 'where', 'whom', 'whose', 'that', 'this', 'these', 'those',
  // Prepositions
  'in', 'on', 'at', 'to', 'of', 'by', 'as', 'or', 'for',
  'with', 'from', 'into', 'over', 'under', 'about', 'after', 'before', 'upon',
  'between', 'during', 'through', 'among', 'within', 'against', 'without', 'above',
  // Conjunctions / discourse markers
  'and', 'but', 'nor', 'yet', 'so', 'not', 'its',
  'also', 'both', 'each', 'many', 'most', 'more', 'some', 'such', 'then', 'than',
  // Auxiliary / modal verbs
  'has', 'had', 'have', 'were', 'been', 'will', 'can', 'may', 'his', 'her',
  // Possessives / pronouns
  'his', 'her', 'its', 'our', 'they', 'their', 'them',
  // Filler words that appear in both question stems and generic answers
  'name', 'term', 'type', 'kind', 'form', 'word', 'used', 'known', 'called',
]);

// ---------------------------------------------------------------------------
// Answer type classification (for variant mismatch detection)
// ---------------------------------------------------------------------------

function classifyAnswerType(answer) {
  if (!answer) return 'unknown';
  const s = answer.trim();
  // Brace-wrapped numbers: {16}, {1440}
  if (/^\{\d[\d,]*\.?\d*\}$/.test(s)) return 'numeric';
  // Pure numbers
  if (/^\d[\d,]*\.?\d*$/.test(s)) return 'numeric';
  // Date patterns: "1500 BC", "3500–3350 BCE", "Around 1600 BC", "By end of 1990"
  if (/\b\d{3,4}\s*(BC|AD|BCE|CE)\b/i.test(s)) return 'date';
  if (/^(around|by|circa|c\.)\s/i.test(s) && /\d{3,4}/.test(s)) return 'date';
  if (/^\d{4}$/.test(s)) return 'date'; // standalone 4-digit year
  // Everything else
  return 'other';
}

// ---------------------------------------------------------------------------
// Pool-based distractor selection
// Mirrors curatedDistractorSelector.ts — simplified (no confusion matrix /
// in-run tracker since those are session-state).
// ---------------------------------------------------------------------------

/**
 * Normalised pool member ID list.
 * Some legacy decks use `members` instead of `factIds` — this handles both.
 */
function poolFactIds(pool) {
  if (!pool) return [];
  return Array.isArray(pool.factIds) ? pool.factIds
    : Array.isArray(pool.members)   ? pool.members
    : [];
}

/**
 * Returns up to `count` pool distractors for a fact.
 * Excludes facts in the same synonym group.
 * Falls back to fact.distractors[] if pool is too small.
 */
function getPoolDistractors(fact, deck, count = 3) {
  const factById = new Map(deck.facts.map(f => [f.id, f]));
  const pool = (deck.answerTypePools || []).find(p => p.id === fact.answerTypePoolId);

  const synonymExcludeIds = new Set([fact.id]);
  if (fact.synonymGroupId) {
    const group = (deck.synonymGroups || []).find(g => g.id === fact.synonymGroupId);
    if (group) {
      for (const id of (group.factIds || [])) synonymExcludeIds.add(id);
    }
  }

  const distractors = [];
  const usedAnswers = new Set([fact.correctAnswer.toLowerCase()]);

  if (pool) {
    for (const candidateId of poolFactIds(pool)) {
      if (distractors.length >= count) break;
      if (synonymExcludeIds.has(candidateId)) continue;

      const candidateFact = factById.get(candidateId);
      if (!candidateFact) continue;

      const answerLower = candidateFact.correctAnswer.toLowerCase();
      if (usedAnswers.has(answerLower)) continue;

      distractors.push(candidateFact.correctAnswer);
      usedAnswers.add(answerLower);
    }
  }

  // Fallback to pre-generated distractors[]
  if (distractors.length < count && fact.distractors && fact.distractors.length > 0) {
    for (const fb of fact.distractors) {
      if (distractors.length >= count) break;
      if (!usedAnswers.has(fb.toLowerCase())) {
        distractors.push(fb);
        usedAnswers.add(fb.toLowerCase());
      }
    }
  }

  const ids = poolFactIds(pool);
  return { distractors, pool, usedFallback: !pool || ids.length < count + 1 };
}

// ---------------------------------------------------------------------------
// Issue checking — 25 checks total (8 original + 4 new + 1 template-pool compatibility + 6 new quality checks + 1 pool-homogeneity + 2 new answer-quality checks + 1 brace-leak check + 1 grammar-scar check + 1 semantic-category heuristic check)
// ---------------------------------------------------------------------------

/**
 * Returns an array of issue strings for a fact and its simulated distractors.
 * isVocab: vocabulary decks skip check #5 (too few distractors) and run
 *          vocab-specific pool membership checks instead.
 */
function checkFact(fact, displayedAnswer, distractors, isBracket, pool, usedFallback, deck, isVocab) {
  const issues = [];

  // 1. Braces in displayed answer
  if (/\{.*?\}/.test(displayedAnswer)) {
    issues.push('Answer contains literal braces after display stripping');
  }

  // 2. Braces remaining anywhere in the question.
  // Skip {___} — that is the intentional fill-in-the-blank template used by grammar decks.
  // Only flag braces that contain other content (numbers, text, etc.).
  const questionBraceRe = /\{(?!___\})[^}]*\}/;
  if (questionBraceRe.test(fact.quizQuestion || '')) {
    issues.push('Question contains literal braces');
  }

  // 3. Correct answer appears in distractors (case-insensitive)
  const answerLower = displayedAnswer.toLowerCase().trim();
  for (const d of distractors) {
    if (d.toLowerCase().trim() === answerLower) {
      issues.push(`Correct answer "${displayedAnswer}" appears in distractors`);
      break;
    }
  }

  // 4. Duplicate distractors
  const seenD = new Set();
  for (const d of distractors) {
    const key = d.toLowerCase().trim();
    if (seenD.has(key)) {
      issues.push(`Duplicate distractor "${d}"`);
    }
    seenD.add(key);
  }

  // 5. Too few distractors (skip for vocab — runtime pool handles it)
  if (!isVocab) {
    if (distractors.length < 2) {
      issues.push(`Only ${distractors.length} distractor(s) available — need at least 2`);
    }
  } else {
    // Vocab-specific: pool must exist and have enough members
    if (!pool) {
      issues.push(`Vocab fact has no answerTypePoolId or pool not found`);
    } else {
      const ids = poolFactIds(pool);
      if (ids.length < 5) {
        issues.push(`Vocab pool "${pool.id}" has only ${ids.length} members (minimum: 5)`);
      }
    }
    // Vocab-specific: required fields
    if (!fact.targetLanguageWord || fact.targetLanguageWord.trim() === '') {
      issues.push('Vocab fact missing targetLanguageWord');
    }
    if (!fact.quizQuestion || fact.quizQuestion.trim() === '') {
      issues.push('Vocab fact missing quizQuestion');
    }
  }

  // 6. Pool too small (non-bracket, non-vocab): pool exists but has fewer than minimumSize members
  if (!isBracket && !isVocab && pool) {
    const ids = poolFactIds(pool);
    if (ids.length < (pool.minimumSize || 5)) {
      issues.push(`Pool "${pool.id}" has only ${ids.length} members (minimum: ${pool.minimumSize || 5})`);
    }
  }

  // 7. Missing required fields
  if (!fact.quizQuestion || fact.quizQuestion.trim() === '') {
    issues.push('Missing quizQuestion');
  }
  if (!fact.correctAnswer || fact.correctAnswer.trim() === '') {
    issues.push('Missing correctAnswer');
  }

  // 8. Non-numeric distractors for bracket-number questions
  if (isBracket) {
    for (const d of distractors) {
      if (!/\d/.test(d)) {
        issues.push(`Non-numeric distractor "${d}" for a bracket-number question`);
      }
    }
  }

  // 9. Missing explanation
  if (!fact.explanation || fact.explanation.trim() === '') {
    issues.push('Missing explanation');
  }

  // 11. answerTypePoolId references a pool that doesn't exist in the deck
  if (fact.answerTypePoolId) {
    const poolIds = new Set((deck.answerTypePools || []).map(p => p.id));
    if (!poolIds.has(fact.answerTypePoolId)) {
      issues.push(`answerTypePoolId "${fact.answerTypePoolId}" not found in deck pools`);
    }
  }

  // 14. Answer too long (fail threshold: >100 chars; skip vocab)
  if (!isVocab) {
    const len = displayedAnswer.length;
    if (len > 100) {
      issues.push(`Answer too long (${len} chars, max 100)`);
    }
  }

  // 15. Question too long (fail threshold: >400 chars; skip vocab)
  if (!isVocab) {
    const qlen = (fact.quizQuestion || '').length;
    if (qlen > 400) {
      issues.push(`Question too long (${qlen} chars, max 400)`);
    }
  }

  // 16. Difficulty out of range or missing
  {
    const d = fact.difficulty;
    if (d === undefined || d === null || d < 1 || d > 5) {
      issues.push(`difficulty out of range (${d}, must be 1-5)`);
    }
  }

  // 17. funScore out of range or missing
  {
    const s = fact.funScore;
    if (s === undefined || s === null || s < 1 || s > 10) {
      issues.push(`funScore out of range (${s}, must be 1-10)`);
    }
  }

  // 21. Em-dash in correctAnswer (baked-in explanation — creates unfair length tell)
  if (fact.correctAnswer && fact.correctAnswer.includes('—')) {
    issues.push(`correctAnswer contains em-dash: "${fact.correctAnswer.slice(0, 60)}". Move explanation to explanation field.`);
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Duplicate question detection (check #10) — deck-level, not per-fact
// ---------------------------------------------------------------------------

/**
 * Normalises a question string for duplicate detection.
 * Lowercase, strip punctuation, collapse whitespace.
 */
function normaliseQuestion(q) {
  // Preserve non-ASCII characters (CJK, kana, Hangul, etc.) so vocab deck
  // questions like "What does \u751f\u3051\u308b mean?" don't all collapse to "what does mean".
  // Strip only ASCII punctuation, collapse whitespace, lowercase.
  return (q || '')
    .toLowerCase()
    .replace(/[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a Map<normalisedQuestion, factId[]> for duplicates only.
 * Skips image_question facts — they intentionally share question text
 * because the image itself differentiates them (e.g. "Which country does
 * this flag belong to?").
 */
function findDuplicateQuestions(facts) {
  const seen = new Map(); // normalised -> [factId, ...]
  for (const fact of facts) {
    if (fact.quizMode === 'image_question') continue;
    const norm = normaliseQuestion(fact.quizQuestion);
    if (!norm) continue;
    if (!seen.has(norm)) seen.set(norm, []);
    seen.get(norm).push(fact.id);
  }
  const dupes = new Map();
  for (const [norm, ids] of seen) {
    if (ids.length > 1) dupes.set(norm, ids);
  }
  return dupes;
}

// ---------------------------------------------------------------------------
// Check #12 — answer pools with 0 members
// ---------------------------------------------------------------------------

function findEmptyPools(deck) {
  return (deck.answerTypePools || []).filter(p => poolFactIds(p).length === 0);
}

// ---------------------------------------------------------------------------
// Per-deck verification
// ---------------------------------------------------------------------------

/**
 * Runs all checks for a single deck.
 * Returns { deckId, deckName, type, totalFacts, failCount, warnCount, issueCounts, factFailures }
 */
function verifyDeck(deckId, deck) {
  const isVocab = deck.domain === 'vocabulary';
  const type = isVocab ? 'vocab' : 'know';
  const facts = deck.facts || [];
  const totalFacts = facts.length;

  // Deck-level issue accumulator: issueName -> count
  const issueCounts = {};
  let deckLevelFailCount = 0; // incremented by deck-level checks (#12, #13)
  let homogeneityFailCount = 0; // pool-homogeneity failures — informational only, do not block commit
  const addIssue = (name) => { issueCounts[name] = (issueCounts[name] || 0) + 1; };
  const addDeckIssue = (name) => { addIssue(name); deckLevelFailCount++; };
  const addHomogeneityIssue = (name) => { addIssue(name); deckLevelFailCount++; homogeneityFailCount++; };

  // Per-fact failure detail (for --verbose)
  const factFailures = []; // { index, factId, issues }
  const factWarnings = []; // { index, factId, msg }

  // Check #10: duplicate questions (deck-level pre-pass to build duplicate set)
  const dupeQuestions = findDuplicateQuestions(facts);

  // Check #12: empty answer pools (deck-level)
  const emptyPools = findEmptyPools(deck);
  for (const p of emptyPools) {
    addDeckIssue(`empty pool "${p.id}"`);
  }

  // Check #13: template-pool placeholder compatibility (deck-level)
  // Each questionTemplate references an answerPoolId and uses {placeholder} names
  // in its questionFormat. Every fact in that pool must have a non-empty value for
  // each placeholder, otherwise the runtime would render a blank question slot.
  if (deck.questionTemplates && deck.questionTemplates.length > 0) {
    const factById = new Map((deck.facts || []).map(f => [f.id, f]));
    const poolById = new Map((deck.answerTypePools || []).map(p => [p.id, p]));
    const PLACEHOLDER_RE = /\{(\w+)\}/g;

    for (const template of deck.questionTemplates) {
      const pool13 = poolById.get(template.answerPoolId);
      if (!pool13) continue; // missing pool already caught by check #11

      const placeholders = [];
      let m;
      PLACEHOLDER_RE.lastIndex = 0;
      while ((m = PLACEHOLDER_RE.exec(template.questionFormat)) !== null) {
        placeholders.push(m[1]);
      }
      if (placeholders.length === 0) continue;

      for (const factId of poolFactIds(pool13)) {
        const fact13 = factById.get(factId);
        if (!fact13) continue;

        for (const ph of placeholders) {
          const val = fact13[ph];
          const isEmpty = val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
          if (isEmpty) {
            addDeckIssue(`template-pool mismatch: template "${template.id}" has {${ph}} but fact "${factId}" has no value for it`);
          }
        }
      }
    }
  }

  // Check #20: pool answer-length homogeneity (deck-level, non-vocab only)
  // Collects display lengths of non-bracket answers per pool.
  // max/min ratio > 3x → FAIL; > 2x → WARN. Skips pools with < 2 non-bracket members.
  if (!isVocab) {
    const factById20 = new Map((deck.facts || []).map(f => [f.id, f]));
    const FULL_BRACKET_RE20 = /^\{(\d[\d,]*\.?\d*)\}$/;
    for (const pool20 of (deck.answerTypePools || [])) {
      if (pool20.homogeneityExempt === true) continue; // pool explicitly marked exempt
      const lengths = [];
      for (const fid of poolFactIds(pool20)) {
        const f = factById20.get(fid);
        if (!f || !f.correctAnswer) continue;
        if (FULL_BRACKET_RE20.test(f.correctAnswer)) continue; // skip bracket-numbers
        const disp = displayAnswer(f.correctAnswer);
        lengths.push(disp.length);
      }
      if (lengths.length < 2) continue;
      const minLen = Math.min(...lengths);
      const maxLen = Math.max(...lengths);
      if (minLen === 0) continue; // avoid divide-by-zero
      const ratio = maxLen / minLen;
      if (ratio > 3) {
        addHomogeneityIssue('pool-homogeneity FAIL: pool "' + pool20.id + '" answer lengths ' + minLen + '–' + maxLen + ' chars (ratio ' + ratio.toFixed(1) + 'x, threshold 3x)');
      } else if (ratio > 2) {
        factWarnings.push({ index: 0, factId: pool20.id, msg: 'pool-homogeneity WARN: pool "' + pool20.id + '" answer lengths ' + minLen + '–' + maxLen + ' chars (ratio ' + ratio.toFixed(1) + 'x)' });
      }
    }
  }

  // Check #24: raw brace characters in syntheticDistractors (HARD FAIL — bracket-notation leak)
  // Detects distractors formatted as {N} bracket-notation tokens (e.g. '{7}', '{1990}') that
  // would display literally in the quiz UI instead of rendering as a number.
  // Fill-in-blank {___} tokens are excluded (legitimate quiz syntax in quizQuestion stems only).
  // This check fires even if the pool has homogeneityExempt: true.
  // 2026-04-10: Added after 89 {N} distractors leaked into 7 decks.
  for (const pool24 of (deck.answerTypePools || [])) {
    for (const synth of (pool24.syntheticDistractors || [])) {
      if (typeof synth !== 'string') continue;
      if (synth === '{___}') continue; // fill-in-blank token — not a real distractor
      if (/[{}]/.test(synth)) {
        addDeckIssue('Check #24 FAIL: pool "' + pool24.id + '" syntheticDistractor contains raw brace — bracket-notation leak: ' + JSON.stringify(synth) + ' — strip this distractor and fix the generator');
      }
    }
  }

  // Check #25: grammar scar patterns in quizQuestion fields (HARD FAIL)
  // Detects broken English patterns produced by naive batch word-replacement.
  // Patterns are maintained in scripts/content-pipeline/grammar-scar-patterns.json.
  // 2026-04-10: Added after "a the concept", "a the reactant" scars found in 6 facts across 3 decks.
  // This is the SECOND occurrence — first was 2026-04-09. The catalog ensures future patterns
  // are machine-checkable rather than relying on manual grep.
  if (GRAMMAR_SCAR_PATTERNS.length > 0) {
    for (const fact25 of facts) {
      const q = fact25.quizQuestion || '';
      if (!q) continue;
      for (const scar of GRAMMAR_SCAR_PATTERNS) {
        if (q.includes(scar.pattern)) {
          addDeckIssue('Check #25 FAIL: grammar scar "' + scar.id + '" in fact "' + fact25.id + '" quizQuestion — pattern "' + scar.pattern + '" — ' + scar.description + ' — rewrite the question stem instead of using naive replacement');
          break; // one error per fact is sufficient
        }
      }
    }
  }

  // Build a set of factIds that have duplicate questions (for per-fact flagging)
  const dupeFactIdSet = new Set();
  for (const [, ids] of dupeQuestions) {
    for (const id of ids) dupeFactIdSet.add(id);
  }

  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];

    const isBracket = isNumericalAnswer(fact.correctAnswer || '');
    const displayedAnswer = isBracket ? displayAnswer(fact.correctAnswer) : (fact.correctAnswer || '');

    let distractors = [];
    let pool = null;
    let usedFallback = false;

    if (isVocab) {
      // Vocab: distractors are runtime-generated from the POS pool — don't simulate them.
      // Just find the pool reference for checks.
      pool = (deck.answerTypePools || []).find(p => p.id === fact.answerTypePoolId) || null;
      distractors = []; // intentionally empty — skip distractor-count checks
    } else if (isBracket) {
      distractors = getNumericalDistractors(fact, 3);
      pool = (deck.answerTypePools || []).find(p => p.id === fact.answerTypePoolId) || null;
    } else {
      const result = getPoolDistractors(fact, deck, 3);
      distractors = result.distractors;
      pool = result.pool;
      usedFallback = result.usedFallback;
    }

    const issues = checkFact(fact, displayedAnswer, distractors, isBracket, pool, usedFallback, deck, isVocab);

    // Check #10 per-fact: flag duplicate question (image_question facts already excluded
    // from dupeFactIdSet by findDuplicateQuestions, so no extra guard needed here)
    if (dupeFactIdSet.has(fact.id)) {
      issues.push('duplicate question');
    }

    if (issues.length > 0) {
      for (const issue of issues) addIssue(issue);
      factFailures.push({ index: i + 1, factId: fact.id, issues });
    } else {
      // Warning: fewer than 3 distractors (non-vocab only)
      if (!isVocab && distractors.length < 3) {
        const msg = `Only ${distractors.length} distractor(s) — ideal is 3`;
        factWarnings.push({ index: i + 1, factId: fact.id, msg });
      }
    }

    // Warnings fire regardless of failure status
    // Check #14 WARNING: answer between 61-80 chars (skip vocab)
    if (!isVocab) {
      const alen = displayedAnswer.length;
      if (alen > 60 && alen <= 80) {
        factWarnings.push({ index: i + 1, factId: fact.id, msg: `Answer is long (${alen} chars, consider shortening below 60)` });
      }
    }

    // Check #15 WARNING: question between 301-400 chars (skip vocab)
    if (!isVocab) {
      const qlen = (fact.quizQuestion || '').length;
      if (qlen > 300 && qlen <= 400) {
        factWarnings.push({ index: i + 1, factId: fact.id, msg: `Question is long (${qlen} chars, consider shortening below 300)` });
      }
    }

    // Check #18 WARNING: explanation exists but is very short (< 20 chars; skip vocab)
    if (!isVocab) {
      const expl = fact.explanation || '';
      if (expl.trim() !== '' && expl.length < 20) {
        factWarnings.push({ index: i + 1, factId: fact.id, msg: `Explanation too short (${expl.length} chars, minimum 20)` });
      }
    }

    // Check #19 WARNING: explanation duplicates the question (skip vocab)
    if (!isVocab && fact.explanation && fact.quizQuestion) {
      if (normaliseQuestion(fact.explanation) === normaliseQuestion(fact.quizQuestion)) {
        factWarnings.push({ index: i + 1, factId: fact.id, msg: 'Explanation duplicates quizQuestion' });
      }
    }

    // Check #22 WARNING: answer text appears verbatim in question (self-answering; skip vocab)
    // Two sub-checks:
    //   (a) Full answer is a substring of question — strict verbatim match (genuine leak)
    //   (b) A *distinguishing* word from the answer appears in the question — word-level leak.
    //       Uses corpus-frequency filtering: words that appear as leaks in 5+ facts across the
    //       corpus are domain/category terms (nerve, system, cells, bone, empire, conference)
    //       and are excluded. Only rare, distinguishing words trigger warnings.
    //       Example: "Crimean War" → "war" is common (excluded), but "Crimean" is rare (flagged).
    //       Example: "Wilbur Scoville" → "scoville" is rare and specific (flagged).
    if (!isVocab) {
      const ansLower22 = (fact.correctAnswer || '').toLowerCase().replace(/[{}]/g, '');
      const qLower22 = (fact.quizQuestion || '').toLowerCase();

      // (a) Verbatim substring match (keep existing check)
      if (ansLower22.length > 5 && qLower22.includes(ansLower22)) {
        factWarnings.push({ index: i + 1, factId: fact.id, msg: `correctAnswer "${(fact.correctAnswer || '').slice(0, 40)}" appears verbatim in quizQuestion — self-answering` });
      } else {
        // (b) Word-level leak with corpus-frequency filter.
        // Words appearing in 5+ facts as leaks are domain terms — skip them.
        const answerWords = ansLower22.split(/[\s\-/]+/).filter(w => w.length >= 4 && !ANSWER_WORD_STOPWORDS.has(w));
        if (answerWords.length > 0) {
          const qWordSet = new Set(qLower22.split(/[\s\-/,.:;!?'"()\[\]{}]+/));
          for (const ansWord of answerWords) {
            if (qWordSet.has(ansWord) && !_corpusFrequentLeaks.has(ansWord)) {
              factWarnings.push({ index: i + 1, factId: fact.id, msg: `answer word "${ansWord}" (from "${(fact.correctAnswer || '').slice(0, 40)}") appears in quizQuestion — eliminable distractor risk` });
              break; // One warning per fact is sufficient
            }
          }
        }
      }
    }

    // Check #23 WARNING: variant answer type mismatch (skip vocab)
    // When a variant has a different answer type than the parent and no own distractors,
    // the quiz will show wrong distractors (e.g., numbers mixed with person names).
    if (!isVocab && Array.isArray(fact.variants)) {
      for (let vi = 0; vi < fact.variants.length; vi++) {
        const v = fact.variants[vi];
        if (typeof v === 'string') continue;
        const variantAnswer = v.correct_answer || v.correctAnswer || v.answer;
        if (!variantAnswer) continue;
        if (Array.isArray(v.distractors) && v.distractors.length >= 3) continue;
        const parentType = classifyAnswerType(fact.correctAnswer);
        const variantType = classifyAnswerType(variantAnswer);
        if (parentType !== 'other' && parentType !== 'unknown' && variantType !== 'other' && variantType !== 'unknown' && parentType !== variantType) {
          factWarnings.push({ index: i + 1, factId: fact.id, msg: `variant #${vi} answer type mismatch: parent="${(fact.correctAnswer || '').slice(0, 30)}" (${parentType}) vs variant="${variantAnswer.slice(0, 30)}" (${variantType}) — needs own distractors` });
        }
      }
    }
  }

  const failCount = factFailures.reduce((acc, f) => acc + f.issues.length, 0) + deckLevelFailCount;
  const warnCount = factWarnings.length;

  return {
    deckId,
    deckName: deck.name || deckId,
    type,
    totalFacts,
    failCount,
    homogeneityFailCount,
    warnCount,
    issueCounts,
    factFailures,
    factWarnings,
  };
}

// ---------------------------------------------------------------------------
// Table rendering helpers
// ---------------------------------------------------------------------------

function pad(str, width, right = false) {
  const s = String(str);
  if (s.length >= width) return s.slice(0, width);
  const padding = ' '.repeat(width - s.length);
  return right ? padding + s : s + padding;
}

function topIssues(issueCounts, n = 3) {
  const sorted = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
  if (sorted.length === 0) return '—';
  return sorted.map(([name, count]) => `${name} (${count})`).join(', ');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Load manifest
const manifestPath = resolve(repoRoot, 'data/decks/manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`ERROR: Could not load manifest at ${manifestPath}`);
  console.error(e.message);
  process.exit(1);
}

const deckFiles = manifest.decks || [];
const totalDecks = deckFiles.length;

console.log('');
console.log(`${BOLD}=== CURATED DECK VERIFICATION (${totalDecks} decks) ===${RESET}`);
console.log('');

// Pre-compute corpus-frequency leak map: words that appear as answer-in-question
// leaks across 5+ facts are domain/category terms (nerve, system, cells, bone, etc.)
// and should NOT be flagged as eliminable distractors.
const _corpusFrequentLeaks = (() => {
  const wordCounts = new Map();
  for (const fn of deckFiles) {
    try {
      const d = JSON.parse(readFileSync(resolve(repoRoot, 'data/decks', fn), 'utf8'));
      if (!d.facts) continue;
      const isV = d.domain === 'language' || (d.facts[0] && (d.facts[0].language || d.facts[0].targetLanguageWord));
      if (isV) continue;
      for (const f of d.facts) {
        if (!f.quizQuestion || !f.correctAnswer) continue;
        const qWords = new Set(f.quizQuestion.toLowerCase().split(/[\s\-/,.:;!?'"()\[\]{}]+/));
        const ansWords = f.correctAnswer.toLowerCase().split(/[\s\-/]+/).filter(w => w.length >= 4 && !ANSWER_WORD_STOPWORDS.has(w));
        for (const w of ansWords) {
          if (qWords.has(w)) { wordCounts.set(w, (wordCounts.get(w) || 0) + 1); break; }
        }
      }
    } catch (_) { /* skip unloadable */ }
  }
  const frequent = new Set();
  for (const [w, c] of wordCounts) { if (c >= 3) frequent.add(w); }
  return frequent;
})();

// Load and verify each deck
const results = [];
const loadErrors = [];

for (const filename of deckFiles) {
  const deckPath = resolve(repoRoot, 'data/decks', filename);
  const deckId = filename.replace('.json', '');

  let deck;
  try {
    deck = JSON.parse(readFileSync(deckPath, 'utf8'));
  } catch (e) {
    loadErrors.push({ deckId, error: e.message });
    continue;
  }

  const result = verifyDeck(deckId, deck);
  results.push(result);
}

// Report load errors immediately
if (loadErrors.length > 0) {
  console.log(`${RED}${BOLD}LOAD ERRORS:${RESET}`);
  for (const { deckId, error } of loadErrors) {
    console.log(`  ${RED}- ${deckId}: ${error}${RESET}`);
  }
  console.log('');
}

// Sort: failures first (most on top), then warnings, then clean
results.sort((a, b) => {
  if (b.failCount !== a.failCount) return b.failCount - a.failCount;
  if (b.warnCount !== a.warnCount) return b.warnCount - a.warnCount;
  return a.deckId.localeCompare(b.deckId);
});

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------
const COL_DECK  = 32;
const COL_TYPE  = 6;
const COL_FACTS = 6;
const COL_PASS  = 6;
const COL_FAIL  = 6;
const COL_WARN  = 6;
// TOP ISSUES fills the remainder

const header =
  pad('DECK', COL_DECK) +
  pad('TYPE', COL_TYPE) +
  pad('FACTS', COL_FACTS, true) +
  pad('PASS', COL_PASS, true) +
  pad('FAIL', COL_FAIL, true) +
  pad('WARN', COL_WARN, true) +
  '  ' +
  'TOP ISSUES';

const divider = '─'.repeat(header.length + 20);

console.log(header);
console.log(divider);

for (const r of results) {
  const passCount = r.totalFacts - r.factFailures.length;
  const failColor = r.failCount > 0 ? RED : GREEN;
  const warnColor = r.warnCount > 0 ? YELLOW : DIM;

  const row =
    pad(r.deckId, COL_DECK) +
    pad(r.type, COL_TYPE) +
    pad(r.totalFacts, COL_FACTS, true) +
    pad(passCount, COL_PASS, true) +
    `${failColor}` + pad(r.failCount > 0 ? r.failCount : '0', COL_FAIL, true) + RESET +
    `${warnColor}` + pad(r.warnCount > 0 ? r.warnCount : '0', COL_WARN, true) + RESET +
    '  ' +
    (r.failCount > 0 || r.warnCount > 0 ? topIssues(r.issueCounts) : `${DIM}—${RESET}`);

  console.log(row);
}

console.log(divider);

// Totals
const totalFacts = results.reduce((s, r) => s + r.totalFacts, 0);
const totalFailures = results.reduce((s, r) => s + r.failCount, 0);
const totalWarnings = results.reduce((s, r) => s + r.warnCount, 0);
const decksWithFailures = results.filter(r => r.failCount > 0).length;
const decksWithWarnings = results.filter(r => r.warnCount > 0).length;

console.log('');
console.log(
  `${BOLD}SUMMARY:${RESET} ${totalDecks} decks | ${totalFacts.toLocaleString()} total facts` +
  ` | ${totalFailures > 0 ? RED : GREEN}${totalFailures} failure${totalFailures !== 1 ? 's' : ''} across ${decksWithFailures} deck${decksWithFailures !== 1 ? 's' : ''}${RESET}` +
  ` | ${totalWarnings > 0 ? YELLOW : DIM}${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''} across ${decksWithWarnings} deck${decksWithWarnings !== 1 ? 's' : ''}${RESET}`
);

// ---------------------------------------------------------------------------
// Decks needing fixes
// ---------------------------------------------------------------------------
const problematic = results.filter(r => r.failCount > 0 || r.warnCount > 0);

if (problematic.length === 0) {
  console.log('');
  console.log(`${GREEN}${BOLD}All decks pass — no fixes needed.${RESET}`);
} else {
  const withFailures = problematic.filter(r => r.failCount > 0);
  const withWarnings = problematic.filter(r => r.failCount === 0 && r.warnCount > 0);

  if (withFailures.length > 0) {
    console.log('');
    console.log(`${RED}${BOLD}DECKS NEEDING FIXES:${RESET}`);
    let num = 1;
    for (const r of withFailures) {
      const issueStr = topIssues(r.issueCounts);
      console.log(`  ${num}. ${CYAN}${r.deckId}${RESET} — ${RED}${r.failCount} failure${r.failCount !== 1 ? 's' : ''}${RESET}: ${issueStr}`);
      num++;
    }
  }

  if (withWarnings.length > 0) {
    console.log('');
    console.log(`${YELLOW}${BOLD}DECKS WITH WARNINGS ONLY:${RESET}`);
    let num = 1;
    for (const r of withWarnings) {
      const issueStr = topIssues(r.issueCounts);
      console.log(`  ${num}. ${CYAN}${r.deckId}${RESET} — ${YELLOW}${r.warnCount} warning${r.warnCount !== 1 ? 's' : ''}${RESET}: ${issueStr}`);
      num++;
    }
  }
}

// ---------------------------------------------------------------------------
// Verbose output — per-fact details for all failing decks
// ---------------------------------------------------------------------------
if (VERBOSE) {
  const failingDecks = results.filter(r => r.failCount > 0);
  if (failingDecks.length > 0) {
    console.log('');
    console.log(`${BOLD}=== VERBOSE: PER-FACT DETAILS ===${RESET}`);
    for (const r of failingDecks) {
      console.log('');
      console.log(`${CYAN}${BOLD}${r.deckId}${RESET} (${r.totalFacts} facts, ${r.failCount} failure${r.failCount !== 1 ? 's' : ''})`);
      for (const f of r.factFailures) {
        console.log(`  ${DIM}[${f.index}]${RESET} ${f.factId}`);
        for (const issue of f.issues) {
          console.log(`    ${RED}x${RESET} ${issue}`);
        }
      }
      if (r.factWarnings.length > 0) {
        console.log(`  ${YELLOW}Warnings:${RESET}`);
        for (const w of r.factWarnings) {
          console.log(`  ${DIM}[${w.index}]${RESET} ${w.factId}: ${YELLOW}${w.msg}${RESET}`);
        }
      }
    }
  }
}

console.log('');

// Exit with error code if any NON-homogeneity failures found
// Pool-homogeneity failures are informational (shown as FAIL in display but don't block commits)
// because educational content inherently varies: 'Pons' vs 'Visceral and parietal pleura' in same pool
const totalBlockingFailures = totalFailures - results.reduce((s, r) => s + (r.homogeneityFailCount || 0), 0);

// Auto-stamp lastStructuralVerify in inspection registry for decks that passed (best-effort, never blocks)
try {
  const passedIds = results.filter(r => r.failCount === 0).map(r => r.deckId).join(',');
  if (passedIds) {
    execSync(
      `npx tsx scripts/registry/updater.ts --ids "${passedIds}" --type lastStructuralVerify`,
      { stdio: 'pipe' }
    );
  }
} catch (_) {
  // Registry stamp failure never blocks verification output
}

process.exit(totalBlockingFailures > 0 ? 1 : 0);
