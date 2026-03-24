#!/usr/bin/env node
/**
 * verify-curated-deck.mjs
 *
 * Programmatically verifies every question a curated deck would produce
 * in-game. Simulates runtime distractor selection and bracket number
 * generation to show exactly what the player would see.
 *
 * Usage:
 *   node scripts/verify-curated-deck.mjs [deck_id]
 *   node scripts/verify-curated-deck.mjs solar_system
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI arg
// ---------------------------------------------------------------------------
const deckId = process.argv[2] || 'solar_system';
const deckPath = resolve(repoRoot, `data/decks/${deckId}.json`);

// ---------------------------------------------------------------------------
// Load deck
// ---------------------------------------------------------------------------
let deck;
try {
  deck = JSON.parse(readFileSync(deckPath, 'utf8'));
} catch (e) {
  console.error(`ERROR: Could not load deck at ${deckPath}`);
  console.error(e.message);
  process.exit(1);
}

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
// Pool-based distractor selection
// Mirrors curatedDistractorSelector.ts — simplified (no confusion matrix /
// in-run tracker since those are session-state). Uses pool_fill ordering,
// which is the baseline the player always gets on first encounter.
// ---------------------------------------------------------------------------

/**
 * Returns up to `count` pool distractors for a fact.
 * Excludes facts in the same synonym group.
 * Falls back to fact.distractors[] if pool is too small.
 */
function getPoolDistractors(fact, deck, count = 3) {
  // Build factById map
  const factById = new Map(deck.facts.map(f => [f.id, f]));

  // Find the pool for this fact
  const pool = (deck.answerTypePools || []).find(p => p.id === fact.answerTypePoolId);

  // Synonym exclusion set
  const synonymExcludeIds = new Set([fact.id]);
  if (fact.synonymGroupId) {
    const group = (deck.synonymGroups || []).find(g => g.id === fact.synonymGroupId);
    if (group) {
      for (const id of group.factIds) synonymExcludeIds.add(id);
    }
  }

  const distractors = [];
  const usedAnswers = new Set([fact.correctAnswer.toLowerCase()]);

  if (pool) {
    for (const candidateId of pool.factIds) {
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

  return { distractors, pool, usedFallback: !pool || pool.factIds.length < count + 1 };
}

// ---------------------------------------------------------------------------
// Issue checkers
// ---------------------------------------------------------------------------

/**
 * Returns an array of issue strings for a fact and its simulated distractors.
 */
function checkFact(fact, displayedAnswer, distractors, isBracket, pool, usedFallback) {
  const issues = [];

  // 1. Braces in displayed answer
  if (/\{.*?\}/.test(displayedAnswer)) {
    issues.push('Answer contains literal braces after display stripping');
  }

  // 2. Braces remaining anywhere in the question
  if (/\{.*?\}/.test(fact.quizQuestion)) {
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
  const seen = new Set();
  for (const d of distractors) {
    const key = d.toLowerCase().trim();
    if (seen.has(key)) {
      issues.push(`Duplicate distractor "${d}"`);
    }
    seen.add(key);
  }

  // 5. Too few distractors (need at least 2 for a valid quiz)
  if (distractors.length < 2) {
    issues.push(`Only ${distractors.length} distractor(s) available — need at least 2`);
  }

  // 6. Pool too small (non-bracket): pool exists but has fewer than minimumSize members
  if (!isBracket && pool) {
    const poolSize = pool.factIds.length;
    if (poolSize < (pool.minimumSize || 5)) {
      issues.push(`Pool "${pool.id}" has only ${poolSize} members (minimum: ${pool.minimumSize || 5})`);
    }
  }

  // 7. Missing required fields
  if (!fact.quizQuestion || fact.quizQuestion.trim() === '') {
    issues.push('Missing quizQuestion');
  }
  if (!fact.correctAnswer || fact.correctAnswer.trim() === '') {
    issues.push('Missing correctAnswer');
  }

  // 8. Nonsensical distractors check: distractors that look like they came from
  //    a different answer type (e.g., a planet name as distractor for a number question)
  if (isBracket) {
    for (const d of distractors) {
      // Numeric distractors should parse to a number (allowing units like "8 minutes")
      // Check that there's at least one digit in each distractor
      if (!/\d/.test(d)) {
        issues.push(`Non-numeric distractor "${d}" for a bracket-number question`);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Build pool summary for header
// ---------------------------------------------------------------------------
function buildPoolSummary(deck) {
  const pools = deck.answerTypePools || [];
  if (pools.length === 0) return 'none';
  return pools.map(p => `${p.id}(${p.factIds.length})`).join(', ');
}

// ---------------------------------------------------------------------------
// Main verification loop
// ---------------------------------------------------------------------------

const facts = deck.facts || [];
const totalFacts = facts.length;

// Colours / formatting (ANSI)
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const PASS_ICON = `${GREEN}PASS${RESET}`;
const FAIL_ICON = `${RED}FAIL${RESET}`;
const WARN_ICON = `${YELLOW}WARN${RESET}`;

// Collect results
const failures = [];     // { index, factId, issues }
const warnings = [];     // { index, factId, msg } — non-critical flags

console.log('');
console.log(`${BOLD}=== DECK: ${deck.name} (${totalFacts} facts) ===${RESET}`);
console.log(`${DIM}Domain: ${deck.domain}${deck.subDomain ? ' | Sub-domain: ' + deck.subDomain : ''}`);
console.log(`Pools: ${buildPoolSummary(deck)}${RESET}`);
console.log('');

for (let i = 0; i < facts.length; i++) {
  const fact = facts[i];
  const factNum = i + 1;

  const isBracket = isNumericalAnswer(fact.correctAnswer);
  const displayedAnswer = isBracket ? displayAnswer(fact.correctAnswer) : fact.correctAnswer;

  let distractors = [];
  let poolLabel = '';
  let poolDetail = '';
  let pool = null;
  let usedFallback = false;
  let distractorSource = '';
  let poolUniqueAnswerCount = 0;  // Track for duplicate distractor warning

  if (isBracket) {
    // Bracket number — use runtime numeric generation
    distractors = getNumericalDistractors(fact, 3);
    pool = (deck.answerTypePools || []).find(p => p.id === fact.answerTypePoolId) || null;
    poolLabel = pool ? `${pool.id} (${pool.factIds.length} members — bracket, uses runtime generation)` : 'bracket_numbers (runtime generation)';
    distractorSource = 'generated';
    poolDetail = `[OK - runtime numeric generation]`;
  } else {
    // Pool-based selection
    const result = getPoolDistractors(fact, deck, 3);
    distractors = result.distractors;
    pool = result.pool;
    usedFallback = result.usedFallback;

    if (pool) {
      const poolSize = pool.factIds.length;
      poolLabel = `${pool.id} (${poolSize} members)`;

      // Check for duplicate correctAnswer values in the pool that would cause duplicate distractors
      const factById = new Map(deck.facts.map(f => [f.id, f]));
      const poolAnswers = pool.factIds
        .filter(id => id !== fact.id)
        .map(id => factById.get(id)?.correctAnswer)
        .filter(Boolean);
      const uniquePoolAnswers = new Set(poolAnswers.map(a => a.toLowerCase()));
      poolUniqueAnswerCount = uniquePoolAnswers.size;

      if (uniquePoolAnswers.size < poolAnswers.length) {
        // This is expected for curated decks — multiple facts about Jupiter all answer "Jupiter"
        // The runtime dedup handles this, but flag if unique answers < distractor count needed
        const uniqueCount = uniquePoolAnswers.size;
        if (uniqueCount < 3) {
          poolDetail += ` ${YELLOW}⚠️  Pool has only ${uniqueCount} unique answers (need 3+ for distractor variety)${RESET}`;
        }
      }

      if (usedFallback && distractors.length > 0) {
        // Mixed: some from pool, rest from fallback
        distractorSource = 'pool+fallback';
        poolDetail = `[${distractors.length} distractors — partial pool + fallback]`;
      } else if (usedFallback) {
        distractorSource = 'fallback';
        poolDetail = `[${distractors.length} from pre-generated fallback list]`;
      } else {
        distractorSource = 'pool';
        poolDetail = `[OK - ${distractors.length} from pool of ${pool.factIds.length}]`;
      }
    } else {
      poolLabel = `UNKNOWN pool "${fact.answerTypePoolId}"`;
      distractorSource = 'fallback';
      poolDetail = `[pool not found — ${distractors.length} from pre-generated fallback]`;
    }
  }

  const issues = checkFact(fact, displayedAnswer, distractors, isBracket, pool, usedFallback);
  const hasFail = issues.length > 0;

  // Print fact block
  console.log(`--- Fact ${factNum}/${totalFacts}: ${CYAN}${fact.id}${RESET} ---`);
  console.log(`  Q: ${fact.quizQuestion}`);

  if (isBracket) {
    console.log(`  A: ${displayedAnswer} ${DIM}(bracket: {${fact.correctAnswer.match(BRACE_NUMBER_RE)?.[1]}} -> stripped)${RESET}`);
  } else {
    console.log(`  A: ${displayedAnswer}`);
  }

  console.log(`  Pool: ${poolLabel}`);

  const distractorLine = distractors.length > 0
    ? distractors.join(', ')
    : `${RED}(none)${RESET}`;
  console.log(`  Distractors (${distractorSource}): ${distractorLine} ${DIM}${poolDetail}${RESET}`);

  const ageGroup = fact.ageGroup || fact.age || 'all';
  console.log(`  Age: ${ageGroup} | Difficulty: ${fact.difficulty} | Fun: ${fact.funScore}`);

  if (fact.synonymGroupId) {
    console.log(`  ${DIM}Synonym group: ${fact.synonymGroupId}${RESET}`);
  }
  if (fact.volatile) {
    console.log(`  ${YELLOW}[volatile — may become incorrect over time]${RESET}`);
  }

  if (hasFail) {
    for (const issue of issues) {
      console.log(`  ${RED}ISSUE: ${issue}${RESET}`);
    }
    console.log(`  [${FAIL_ICON}]`);
    failures.push({ index: factNum, factId: fact.id, issues });
  } else {
    if (distractors.length < 3) {
      const msg = `Only ${distractors.length} distractor(s) — ideal is 3`;
      console.log(`  ${YELLOW}NOTE: ${msg}${RESET}`);
      warnings.push({ index: factNum, factId: fact.id, msg });
    }
    console.log(`  [${PASS_ICON}]`);
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const passCount = totalFacts - failures.length;
const failCount = failures.length;
const warnCount = warnings.length;

console.log(`${BOLD}=== SUMMARY ===${RESET}`);
console.log(`${totalFacts} facts checked`);
console.log(`${GREEN}${passCount} PASS${RESET}, ${failCount > 0 ? RED : GREEN}${failCount} FAIL${RESET}${warnCount > 0 ? `, ${YELLOW}${warnCount} WARN${RESET}` : ''}`);

if (failures.length > 0) {
  console.log('');
  console.log(`${RED}${BOLD}FAILURES:${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}- [${f.index}] ${f.factId}${RESET}`);
    for (const issue of f.issues) {
      console.log(`      ${issue}`);
    }
  }
}

if (warnings.length > 0) {
  console.log('');
  console.log(`${YELLOW}${BOLD}WARNINGS:${RESET}`);
  for (const w of warnings) {
    console.log(`  ${YELLOW}- [${w.index}] ${w.factId}: ${w.msg}${RESET}`);
  }
}

console.log('');

// Exit code
process.exit(failCount > 0 ? 1 : 0);
