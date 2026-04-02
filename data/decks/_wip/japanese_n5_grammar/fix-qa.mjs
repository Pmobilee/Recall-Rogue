#!/usr/bin/env node
/**
 * fix-qa.mjs — Applies all QA fixes to japanese_n5_grammar.json
 *
 * Run: node data/decks/_wip/japanese_n5_grammar/fix-qa.mjs
 *
 * Fixes applied:
 *  1. Synonym group enforcement: に/へ direction, から/ので reason, けど/けれども but
 *     1a. Direction に (particle-ni-location-fill, particle-he-fill, particle-ni-he-fill)
 *         → remove other particle from distractors, add to acceptableAlternatives
 *     1b. Indirect-object に (particle-ni-indirect-fill)
 *         → remove へ from distractors ONLY (not direction synonym, so no acceptableAlternatives)
 *     1c. Reason から (reason-kara-fill) and ので (reason-node-fill)
 *         → remove cross-contamination from distractors, add to acceptableAlternatives
 *     1d. けど (conj-kedo-fill) and けれども (conj-keredomo-fill)
 *         → remove cross-contamination from distractors, add to acceptableAlternatives
 *  2. Fix "/" compound answers in correctAnswer (e.g. "に/へ" → "に")
 *  3. Clean English/label distractors
 *  4. Fix specific bad facts:
 *     - particle-ka-fill-1: fix blank position
 *     - conj-soshite-fill-3: fix unnatural Japanese sentence
 *     - particle-ni-indirect-fill-4: fix explanation text
 *     - dem-koko-soko-asoko-fill-2: fix targetLanguageWord/correctAnswer
 *  5. Fix wrong answerTypePoolIds:
 *     - conj-kedo-fill, conj-keredomo-fill → sentence_ender (was particle_case)
 *     - shikashi, sorekara, soshite → sentence_ender (already done)
 *     - honor-o-go → sentence_ender (already done)
 *     - comp-wa-yori, comp-yori-hou-ga, comp-no-naka-de-ichiban → verb_form (already done)
 *  6. Rebuild all answerTypePools factIds
 *  7. Rebuild difficultyTiers
 *  8. Ensure synonymGroups includes syn_reason (から/ので)
 *  9. Clean up: remove duplicates between distractors and acceptableAlternatives
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../..');
const deckPath = resolve(repoRoot, 'data/decks/japanese_n5_grammar.json');

const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));

const changes = [];
let changeCount = 0;

function log(msg) {
  changes.push(msg);
  changeCount++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find fact by ID
// ─────────────────────────────────────────────────────────────────────────────
function findFact(id) {
  return deck.facts.find(f => f.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Remove "/" compound answers in correctAnswer
//   e.g. "に/へ" → "に" with "へ" added to acceptableAlternatives
// ─────────────────────────────────────────────────────────────────────────────
let slashAnswerFixes = 0;
for (const fact of deck.facts) {
  if (fact.correctAnswer.includes('/')) {
    const parts = fact.correctAnswer.split('/').map(s => s.trim()).filter(Boolean);
    const primary = parts[0];
    const alts = parts.slice(1);
    fact.correctAnswer = primary;
    for (const alt of alts) {
      if (!fact.acceptableAlternatives.includes(alt)) {
        fact.acceptableAlternatives.push(alt);
      }
      // Remove the alt from distractors too
      fact.distractors = fact.distractors.filter(d => d !== alt && d !== primary);
    }
    slashAnswerFixes++;
  }
}

// Also remove literal "に/へ" compound string from all distractor arrays
let slashDistractorRemovals = 0;
for (const fact of deck.facts) {
  const before = fact.distractors.length;
  fact.distractors = fact.distractors.filter(d => !d.includes('/'));
  if (fact.distractors.length < before) {
    slashDistractorRemovals++;
  }
}
log(`Fix 2: Fixed ${slashAnswerFixes} slash compound correctAnswers; removed slash distractors from ${slashDistractorRemovals} facts`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1a: に/へ direction synonym enforcement
//   Fact ID patterns for DIRECTION usage: particle-he-fill, particle-ni-he-fill,
//   particle-ni-location-fill
//   → remove the opposite particle from distractors, add to acceptableAlternatives
// ─────────────────────────────────────────────────────────────────────────────
const directionPatterns = [
  'particle-he-fill',
  'particle-ni-he-fill',
  'particle-ni-location-fill',
];

let directionFixes = 0;
for (const fact of deck.facts) {
  const isDirection = directionPatterns.some(p => fact.id.includes(p));
  if (!isDirection) continue;

  const beforeLen = fact.distractors.length;

  if (fact.correctAnswer === 'へ') {
    fact.distractors = fact.distractors.filter(d => d !== 'に');
    if (!fact.acceptableAlternatives.includes('に')) {
      fact.acceptableAlternatives.push('に');
      directionFixes++;
    }
  } else if (fact.correctAnswer === 'に') {
    fact.distractors = fact.distractors.filter(d => d !== 'へ');
    if (!fact.acceptableAlternatives.includes('へ')) {
      fact.acceptableAlternatives.push('へ');
      directionFixes++;
    }
  }
}
log(`Fix 1a: Enforced に/へ direction synonyms on ${directionFixes} facts (removed cross-distractors, added acceptableAlternatives)`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1b: Indirect-object に cleanup
//   particle-ni-indirect-fill-* facts: に marks indirect object, recipient, or
//   passive agent. These uses are NOT interchangeable with へ (direction).
//   → remove へ from distractors WITHOUT adding to acceptableAlternatives
// ─────────────────────────────────────────────────────────────────────────────
let indirectHeFixes = 0;
for (const fact of deck.facts) {
  if (!fact.id.includes('particle-ni-indirect')) continue;

  const before = fact.distractors.length;
  fact.distractors = fact.distractors.filter(d => d !== 'へ');
  if (fact.distractors.length < before) {
    indirectHeFixes++;
  }
}
log(`Fix 1b: Removed へ from ${indirectHeFixes} indirect-object に facts (indirect object ≠ direction, へ should not be a distractor here)`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1c: から/ので reason synonym enforcement
// ─────────────────────────────────────────────────────────────────────────────
const reasonPatterns = ['reason-kara-fill', 'reason-node-fill'];

let reasonFixes = 0;
for (const fact of deck.facts) {
  const isReason = reasonPatterns.some(p => fact.id.includes(p));
  if (!isReason) continue;

  if (fact.correctAnswer === 'から') {
    fact.distractors = fact.distractors.filter(d => d !== 'ので');
    if (!fact.acceptableAlternatives.includes('ので')) {
      fact.acceptableAlternatives.push('ので');
      reasonFixes++;
    }
  } else if (fact.correctAnswer === 'ので') {
    fact.distractors = fact.distractors.filter(d => d !== 'から');
    if (!fact.acceptableAlternatives.includes('から')) {
      fact.acceptableAlternatives.push('から');
      reasonFixes++;
    }
  }
}
log(`Fix 1c: Enforced から/ので reason synonyms on ${reasonFixes} facts`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1d: けど/けれども synonym enforcement
// ─────────────────────────────────────────────────────────────────────────────
const butPatterns = ['conj-kedo-fill', 'conj-keredomo-fill'];

let butFixes = 0;
for (const fact of deck.facts) {
  const isBut = butPatterns.some(p => fact.id.includes(p));
  if (!isBut) continue;

  if (fact.correctAnswer === 'けど') {
    fact.distractors = fact.distractors.filter(d => d !== 'けれども');
    if (!fact.acceptableAlternatives.includes('けれども')) {
      fact.acceptableAlternatives.push('けれども');
      butFixes++;
    }
  } else if (fact.correctAnswer === 'けれども') {
    fact.distractors = fact.distractors.filter(d => d !== 'けど');
    if (!fact.acceptableAlternatives.includes('けど')) {
      fact.acceptableAlternatives.push('けど');
      butFixes++;
    }
  }
}
log(`Fix 1d: Enforced けど/けれども but synonyms on ${butFixes} facts`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: Replace English/label distractors with valid Japanese grammar patterns
//   Banned: "い-adjective", "な-adjective" (type labels, not grammar patterns)
// ─────────────────────────────────────────────────────────────────────────────
const labelReplacements = {
  'い-adjective': 'ない',
  'な-adjective': 'な',
};

let labelFixes = 0;
for (const fact of deck.facts) {
  let changed = false;
  fact.distractors = fact.distractors.map(d => {
    if (labelReplacements[d] !== undefined) {
      const replacement = labelReplacements[d];
      if (replacement !== fact.correctAnswer && !fact.distractors.includes(replacement)) {
        changed = true;
        return replacement;
      } else {
        // Fallback: remove the label distractor
        changed = true;
        return null;
      }
    }
    return d;
  }).filter(d => d !== null);
  if (changed) labelFixes++;
}
log(`Fix 3: Replaced/removed English label distractors in ${labelFixes} facts`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: Fix specific bad facts
// ─────────────────────────────────────────────────────────────────────────────

// 4a: particle-ka-fill-1 — verify blank is at sentence-final position
const kaFact1 = findFact('ja-gram-n5-n5-particle-ka-fill-1');
if (kaFact1) {
  const oldQ = kaFact1.quizQuestion;
  // The correct question should have blank after the sentence-final verb form
  const correctQ = '日本語が分かります{___}。\n(Do you understand Japanese?)';
  if (kaFact1.quizQuestion !== correctQ) {
    kaFact1.quizQuestion = correctQ;
    kaFact1.explanation = 'か (question particle) — 日本語が分かりますか。';
    log(`Fix 4a: particle-ka-fill-1 — fixed blank position\n  OLD: ${oldQ}\n  NEW: ${kaFact1.quizQuestion}`);
  } else {
    log(`Fix 4a: particle-ka-fill-1 — already correct, no change needed`);
  }
}

// 4b: conj-soshite-fill-3 — fix unnatural Japanese (りんごとそして pattern)
const soshiteFact3 = findFact('ja-gram-n5-n5-conj-soshite-fill-3');
if (soshiteFact3) {
  const correctQ = '朝ごはんを食べました。{___}、学校に行きました。\n(I ate breakfast. And then, I went to school.)';
  const correctEx = 'そして (and; and then; thus (additive)) — 朝ごはんを食べました。そして、学校に行きました。';
  const oldQ = soshiteFact3.quizQuestion;
  if (soshiteFact3.quizQuestion !== correctQ) {
    soshiteFact3.quizQuestion = correctQ;
    soshiteFact3.explanation = correctEx;
    log(`Fix 4b: conj-soshite-fill-3 — replaced unnatural sentence\n  OLD: ${oldQ}\n  NEW: ${soshiteFact3.quizQuestion}`);
  } else {
    log(`Fix 4b: conj-soshite-fill-3 — already correct, no change needed`);
  }
}

// 4c: particle-ni-indirect-fill-4 — fix explanation for passive agent に
const niIndirectFill4 = findFact('ja-gram-n5-n5-particle-ni-indirect-fill-4');
if (niIndirectFill4) {
  const correctEx = 'に (passive agent marker; by) — 彼は先生にしかられた。 (に marks the agent in passive constructions: "was scolded BY the teacher")';
  if (niIndirectFill4.explanation !== correctEx) {
    const oldEx = niIndirectFill4.explanation;
    niIndirectFill4.explanation = correctEx;
    log(`Fix 4c: particle-ni-indirect-fill-4 — fixed explanation for passive agent に\n  OLD: ${oldEx}\n  NEW: ${niIndirectFill4.explanation}`);
  } else {
    log(`Fix 4c: particle-ni-indirect-fill-4 — explanation already correct`);
  }
}

// 4d: dem-koko-soko-asoko-fill-2 — verify correctAnswer/targetLanguageWord match
const kosoFact2 = findFact('ja-gram-n5-n5-dem-koko-soko-asoko-fill-2');
if (kosoFact2) {
  const correctQ = '{___}に郵便局があります。\n(There is a post office over there.)';
  const correctA = 'あそこ';
  const correctT = 'あそこ';
  const correctEx = 'あそこ (over there — far from both speaker and listener) — あそこに郵便局があります。';

  let changed = false;
  if (kosoFact2.quizQuestion !== correctQ) {
    const oldQ = kosoFact2.quizQuestion;
    kosoFact2.quizQuestion = correctQ;
    log(`Fix 4d: dem-koko-soko-asoko-fill-2 — fixed quizQuestion\n  OLD: ${oldQ}\n  NEW: ${correctQ}`);
    changed = true;
  }
  if (kosoFact2.correctAnswer !== correctA) {
    kosoFact2.correctAnswer = correctA;
    changed = true;
  }
  if (kosoFact2.targetLanguageWord !== correctT) {
    kosoFact2.targetLanguageWord = correctT;
    changed = true;
  }
  if (kosoFact2.explanation !== correctEx) {
    kosoFact2.explanation = correctEx;
    changed = true;
  }
  // Ensure そこ and ここ are in distractors, あそこ is not
  kosoFact2.distractors = kosoFact2.distractors.filter(d => d !== correctA);
  if (!kosoFact2.distractors.includes('そこ')) {
    kosoFact2.distractors.unshift('そこ');
    changed = true;
  }
  if (!kosoFact2.distractors.includes('ここ')) {
    kosoFact2.distractors.splice(1, 0, 'ここ');
    changed = true;
  }
  if (!changed) {
    log(`Fix 4d: dem-koko-soko-asoko-fill-2 — already correct, no change needed`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: Fix wrong answerTypePoolIds
//   - conj-kedo-fill, conj-keredomo-fill → sentence_ender (was particle_case)
//   - shikashi, sorekara, soshite, honor-o-go → sentence_ender (verify already done)
//   - comp-* → verb_form (verify already done)
// ─────────────────────────────────────────────────────────────────────────────
const poolFixRules = [
  {
    patterns: ['conj-kedo-fill', 'conj-keredomo-fill'],
    targetPool: 'sentence_ender',
    reason: 'けど/けれども are clause-connecting conjunctions, not case particles'
  },
  {
    patterns: ['conj-shikashi-fill', 'conj-sorekara-fill', 'conj-soshite-fill'],
    targetPool: 'sentence_ender',
    reason: 'Sentence-initial conjunctions belong in sentence_ender pool'
  },
  {
    patterns: ['honor-o-go-fill'],
    targetPool: 'sentence_ender',
    reason: 'Honorific prefix お/ご is a prefix pattern, not a case particle'
  },
  {
    patterns: ['comp-wa-yori-fill', 'comp-yori-hou-ga-fill', 'comp-no-naka-de-ichiban-fill'],
    targetPool: 'verb_form',
    reason: 'Comparison patterns pair with verb/adjective forms'
  },
];

let poolFixes = 0;
for (const fact of deck.facts) {
  for (const rule of poolFixRules) {
    if (rule.patterns.some(p => fact.id.includes(p))) {
      if (fact.answerTypePoolId !== rule.targetPool) {
        fact.answerTypePoolId = rule.targetPool;
        poolFixes++;
      }
      break;
    }
  }
}
log(`Fix 5: Reassigned answerTypePoolId for ${poolFixes} facts`);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 6: Rebuild answerTypePools factIds from current fact assignments
// ─────────────────────────────────────────────────────────────────────────────

// Build map of poolId → factIds from current facts
const poolMap = new Map();
for (const fact of deck.facts) {
  const pid = fact.answerTypePoolId;
  if (!poolMap.has(pid)) poolMap.set(pid, []);
  poolMap.get(pid).push(fact.id);
}

// Rebuild each sub-pool
for (const pool of deck.answerTypePools) {
  if (pool.id === 'grammar_all') continue; // Handle separately below

  const rebuilt = poolMap.get(pool.id) || [];
  const oldCount = pool.factIds.length;
  pool.factIds = rebuilt;
  if (rebuilt.length !== oldCount) {
    log(`Fix 6: Pool "${pool.id}" rebuilt: ${oldCount} → ${rebuilt.length} facts`);
  }
}

// Rebuild grammar_all pool to contain ALL facts
const grammarAllPool = deck.answerTypePools.find(p => p.id === 'grammar_all');
if (grammarAllPool) {
  const oldCount = grammarAllPool.factIds.length;
  const allFactIds = deck.facts.map(f => f.id);
  grammarAllPool.factIds = allFactIds;
  if (allFactIds.length !== oldCount) {
    log(`Fix 6: Pool "grammar_all" rebuilt: ${oldCount} → ${allFactIds.length} facts`);
  }
}

// Warn about any pool used in facts but not defined
for (const [pid] of poolMap.entries()) {
  if (!deck.answerTypePools.find(p => p.id === pid)) {
    console.warn(`WARNING: Pool "${pid}" used in facts but not defined in answerTypePools`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 7: Rebuild difficultyTiers from fact difficulty values
// ─────────────────────────────────────────────────────────────────────────────
const tierMap = { easy: [], medium: [], hard: [] };
for (const fact of deck.facts) {
  if (fact.difficulty === 1) tierMap.easy.push(fact.id);
  else if (fact.difficulty === 2) tierMap.medium.push(fact.id);
  else if (fact.difficulty === 3) tierMap.hard.push(fact.id);
}

for (const tier of deck.difficultyTiers) {
  const oldCount = tier.factIds.length;
  tier.factIds = tierMap[tier.tier] || [];
  if (tier.factIds.length !== oldCount) {
    log(`Fix 7: difficultyTiers["${tier.tier}"] rebuilt: ${oldCount} → ${tier.factIds.length} facts`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 8: Ensure syn_reason synonym group exists (から / ので)
// ─────────────────────────────────────────────────────────────────────────────
const existingReason = deck.synonymGroups.find(g => g.id === 'syn_reason');
if (!existingReason) {
  const reasonFactIds = deck.facts
    .filter(f => f.id.includes('reason-kara-fill') || f.id.includes('reason-node-fill'))
    .map(f => f.id);

  deck.synonymGroups.push({
    id: 'syn_reason',
    factIds: reasonFactIds,
    reason: 'から and ので both mean "because/since" and are often interchangeable. から is more assertive/casual; ので is softer and more polite. At N5 level, either is accepted for reason-expressing sentences.'
  });

  log(`Fix 8: Added syn_reason synonym group with ${reasonFactIds.length} facts (から/ので)`);
} else {
  // Update factIds in case facts changed
  const reasonFactIds = deck.facts
    .filter(f => f.id.includes('reason-kara-fill') || f.id.includes('reason-node-fill'))
    .map(f => f.id);
  existingReason.factIds = reasonFactIds;
  log(`Fix 8: syn_reason already exists — updated factIds to ${reasonFactIds.length} facts`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL SWEEP: Remove any remaining overlap between distractors and
//              acceptableAlternatives / correctAnswer
// ─────────────────────────────────────────────────────────────────────────────
let duplicateCleans = 0;
for (const fact of deck.facts) {
  const before = fact.distractors.length;
  fact.distractors = fact.distractors.filter(
    d => !fact.acceptableAlternatives.includes(d) && d !== fact.correctAnswer
  );
  if (fact.distractors.length < before) duplicateCleans++;
}
if (duplicateCleans > 0) {
  log(`Final sweep: Cleaned ${duplicateCleans} facts where distractors overlapped with acceptableAlternatives or correctAnswer`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write output
// ─────────────────────────────────────────────────────────────────────────────
writeFileSync(deckPath, JSON.stringify(deck, null, 2), 'utf-8');

console.log('\n=== japanese_n5_grammar QA Fix Report ===\n');
for (const c of changes) {
  console.log('  ' + c.replace(/\n/g, '\n  ') + '\n');
}
console.log(`Total change events: ${changeCount}`);
console.log(`Total facts in deck: ${deck.facts.length}`);

// Summary stats
const poolUsage = {};
for (const f of deck.facts) {
  poolUsage[f.answerTypePoolId] = (poolUsage[f.answerTypePoolId] || 0) + 1;
}
console.log('\nPool distribution after fixes:');
for (const [pool, count] of Object.entries(poolUsage).sort()) {
  console.log(`  ${pool}: ${count} facts`);
}
console.log('\nDeck written to:', deckPath);
