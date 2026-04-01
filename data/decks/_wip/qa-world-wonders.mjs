/**
 * QA Validation Script: world_wonders.json
 * Checks structural integrity and reports content issues.
 * Run: node data/decks/_wip/qa-world-wonders.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckPath = join(__dirname, '../world_wonders.json');

const deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
const { facts, answerTypePools, synonymGroups, difficultyTiers, subDecks } = deck;

// ─── helpers ───────────────────────────────────────────────────────────────────
const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD  = '\x1b[1m';
const RESET = '\x1b[0m';

function pass(label) { console.log(`${GREEN}  PASS${RESET}  ${label}`); }
function fail(label, details) {
  console.log(`${RED}  FAIL${RESET}  ${label}`);
  if (details && details.length) {
    details.forEach(d => console.log(`         ${YELLOW}→ ${d}${RESET}`));
  }
}
function section(title) { console.log(`\n${BOLD}── ${title} ──${RESET}`); }

const allIssues = []; // {factId, issue}

// ─── 1. ID Uniqueness ──────────────────────────────────────────────────────────
section('1. ID Uniqueness');
{
  const seen = new Set();
  const dupes = [];
  for (const f of facts) {
    if (seen.has(f.id)) dupes.push(f.id);
    seen.add(f.id);
  }
  if (dupes.length === 0) {
    pass(`All ${facts.length} fact IDs are unique`);
  } else {
    fail(`Duplicate fact IDs found`, dupes);
    dupes.forEach(id => allIssues.push({factId: id, issue: 'Duplicate ID'}));
  }
}

// ─── 2. Required Fields ────────────────────────────────────────────────────────
section('2. Required Fields');
{
  const required = ['id','correctAnswer','acceptableAlternatives','chainThemeId',
    'answerTypePoolId','difficulty','funScore','distractors','quizQuestion',
    'explanation','visualDescription','sourceName'];
  
  const missing = [];
  for (const f of facts) {
    for (const field of required) {
      if (f[field] === undefined || f[field] === null) {
        missing.push(`${f.id}: missing "${field}"`);
        allIssues.push({factId: f.id, issue: `Missing field: ${field}`});
      }
    }
    // Type checks
    if (typeof f.difficulty !== 'number' || f.difficulty < 1 || f.difficulty > 5) {
      missing.push(`${f.id}: difficulty out of range (${f.difficulty})`);
      allIssues.push({factId: f.id, issue: `Difficulty out of range: ${f.difficulty}`});
    }
    if (typeof f.funScore !== 'number' || f.funScore < 1 || f.funScore > 10) {
      missing.push(`${f.id}: funScore out of range (${f.funScore})`);
      allIssues.push({factId: f.id, issue: `funScore out of range: ${f.funScore}`});
    }
    if (!Array.isArray(f.acceptableAlternatives)) {
      missing.push(`${f.id}: acceptableAlternatives is not an array`);
    }
  }
  
  if (missing.length === 0) {
    pass(`All ${facts.length} facts have required fields with valid values`);
  } else {
    fail(`${missing.length} required field violation(s)`, missing.slice(0, 20));
    if (missing.length > 20) console.log(`         ${YELLOW}… and ${missing.length - 20} more${RESET}`);
  }
}

// ─── 3. Pool Integrity ─────────────────────────────────────────────────────────
section('3. Pool Integrity');
{
  const poolIssues = [];
  const factIdSet = new Set(facts.map(f => f.id));
  const poolIdSet = new Set(answerTypePools.map(p => p.id));

  // Every fact's answerTypePoolId must exist
  for (const f of facts) {
    if (!poolIdSet.has(f.answerTypePoolId)) {
      poolIssues.push(`Fact ${f.id} references non-existent pool: ${f.answerTypePoolId}`);
      allIssues.push({factId: f.id, issue: `Pool not found: ${f.answerTypePoolId}`});
    }
  }

  // Every pool's factIds must exist in facts
  for (const pool of answerTypePools) {
    for (const fid of pool.factIds) {
      if (!factIdSet.has(fid)) {
        poolIssues.push(`Pool "${pool.id}" references non-existent fact: ${fid}`);
        allIssues.push({factId: fid, issue: `Pool "${pool.id}" has orphan factId`});
      }
    }
  }

  // Cross-check: facts in pools must match their answerTypePoolId
  const poolMemberMap = new Map(); // factId -> poolId (from pool.factIds)
  for (const pool of answerTypePools) {
    for (const fid of pool.factIds) {
      if (poolMemberMap.has(fid)) {
        poolIssues.push(`Fact ${fid} appears in multiple pools: ${poolMemberMap.get(fid)} AND ${pool.id}`);
      }
      poolMemberMap.set(fid, pool.id);
    }
  }

  // Every fact should appear in exactly one pool's factIds
  for (const f of facts) {
    const memberPool = poolMemberMap.get(f.id);
    if (!memberPool) {
      poolIssues.push(`Fact ${f.id} not listed in any pool's factIds (but declares answerTypePoolId: ${f.answerTypePoolId})`);
      allIssues.push({factId: f.id, issue: 'Not listed in any pool.factIds'});
    } else if (memberPool !== f.answerTypePoolId) {
      poolIssues.push(`Fact ${f.id}: pool membership mismatch — listed in "${memberPool}" but declares "${f.answerTypePoolId}"`);
      allIssues.push({factId: f.id, issue: `Pool mismatch: listed in "${memberPool}", declares "${f.answerTypePoolId}"`});
    }
  }

  if (poolIssues.length === 0) {
    pass('All pool integrity checks passed');
  } else {
    fail(`${poolIssues.length} pool integrity issue(s)`, poolIssues.slice(0, 20));
  }
}

// ─── 4. SubDeck Integrity ──────────────────────────────────────────────────────
section('4. SubDeck Integrity');
{
  const subDeckIssues = [];
  const factIdSet = new Set(facts.map(f => f.id));

  // Build map: chainThemeId -> subDeckId (from subDecks definition)
  // SubDecks don't explicitly store chainThemeId in this format —
  // the doc says facts belong to subDecks via chainThemeId matching.
  // Let's check if each subDeck's factIds exist AND each fact belongs to exactly one subDeck.

  const factToSubDeck = new Map();
  for (const sd of (subDecks || [])) {
    for (const fid of sd.factIds) {
      if (!factIdSet.has(fid)) {
        subDeckIssues.push(`SubDeck "${sd.id}" references non-existent fact: ${fid}`);
        allIssues.push({factId: fid, issue: `SubDeck "${sd.id}" orphan factId`});
      }
      if (factToSubDeck.has(fid)) {
        subDeckIssues.push(`Fact ${fid} appears in multiple subDecks: ${factToSubDeck.get(fid)} AND ${sd.id}`);
        allIssues.push({factId: fid, issue: `In multiple subDecks`});
      }
      factToSubDeck.set(fid, sd.id);
    }
  }

  // Every fact must appear in exactly one subDeck
  for (const f of facts) {
    if (!factToSubDeck.has(f.id)) {
      subDeckIssues.push(`Fact ${f.id} not in any subDeck`);
      allIssues.push({factId: f.id, issue: 'Not in any subDeck'});
    }
  }

  if (subDeckIssues.length === 0) {
    pass('All subDeck integrity checks passed');
  } else {
    fail(`${subDeckIssues.length} subDeck integrity issue(s)`, subDeckIssues.slice(0, 20));
  }
}

// ─── 5. Difficulty Tiers ──────────────────────────────────────────────────────
section('5. Difficulty Tiers');
{
  const tierIssues = [];
  const factIdSet = new Set(facts.map(f => f.id));
  const factTierCount = new Map();

  for (const tier of (difficultyTiers || [])) {
    for (const fid of tier.factIds) {
      if (!factIdSet.has(fid)) {
        tierIssues.push(`Tier "${tier.tier}" references non-existent fact: ${fid}`);
      }
      factTierCount.set(fid, (factTierCount.get(fid) || 0) + 1);
    }
  }

  for (const f of facts) {
    const count = factTierCount.get(f.id) || 0;
    if (count === 0) {
      tierIssues.push(`Fact ${f.id} not in any difficulty tier`);
      allIssues.push({factId: f.id, issue: 'Not in any difficulty tier'});
    } else if (count > 1) {
      tierIssues.push(`Fact ${f.id} appears in ${count} difficulty tiers`);
      allIssues.push({factId: f.id, issue: `In multiple difficulty tiers (${count})`});
    }
  }

  if (tierIssues.length === 0) {
    pass('All facts in exactly one difficulty tier');
  } else {
    fail(`${tierIssues.length} difficulty tier issue(s)`, tierIssues.slice(0, 20));
  }
}

// ─── 6. Distractor Count ──────────────────────────────────────────────────────
section('6. Distractor Count (minimum 7)');
{
  const distIssues = [];
  for (const f of facts) {
    const count = Array.isArray(f.distractors) ? f.distractors.length : 0;
    if (count < 7) {
      distIssues.push(`${f.id}: only ${count} distractors (needs 7+)`);
      allIssues.push({factId: f.id, issue: `Only ${count} distractors`});
    }
  }
  if (distIssues.length === 0) {
    pass(`All ${facts.length} facts have 7+ distractors`);
  } else {
    fail(`${distIssues.length} facts with insufficient distractors`, distIssues);
  }
}

// ─── 7. Distractor Safety ─────────────────────────────────────────────────────
section('7. Distractor Safety (no distractor matches a correct answer in same pool)');
{
  const safetyIssues = [];

  // Build map: poolId -> all correct answers + acceptable alternatives for facts in that pool
  const poolCorrectAnswers = new Map(); // poolId -> Set<normalized string>
  
  function normalize(s) { return (s || '').trim().toLowerCase(); }

  for (const pool of answerTypePools) {
    const answers = new Set();
    for (const fid of pool.factIds) {
      const fact = facts.find(f => f.id === fid);
      if (!fact) continue;
      answers.add(normalize(fact.correctAnswer));
      for (const alt of (fact.acceptableAlternatives || [])) {
        answers.add(normalize(alt));
      }
    }
    poolCorrectAnswers.set(pool.id, answers);
  }

  // Check each fact's distractors against correct answers in same pool
  for (const f of facts) {
    const poolAnswers = poolCorrectAnswers.get(f.answerTypePoolId);
    if (!poolAnswers) continue;
    
    for (const d of (f.distractors || [])) {
      if (poolAnswers.has(normalize(d))) {
        safetyIssues.push(`${f.id}: distractor "${d}" matches a correct answer in pool "${f.answerTypePoolId}"`);
        allIssues.push({factId: f.id, issue: `Distractor "${d}" is a correct answer in pool`});
      }
    }
  }

  if (safetyIssues.length === 0) {
    pass('No distractors match correct answers in same pool');
  } else {
    fail(`${safetyIssues.length} unsafe distractor(s)`, safetyIssues.slice(0, 30));
    if (safetyIssues.length > 30) console.log(`         ${YELLOW}… and ${safetyIssues.length - 30} more${RESET}`);
  }
}

// ─── 8. Synonym Group Integrity ───────────────────────────────────────────────
section('8. Synonym Group Integrity');
{
  const synIssues = [];
  const factIdSet = new Set(facts.map(f => f.id));

  for (const sg of (synonymGroups || [])) {
    for (const fid of sg.factIds) {
      if (!factIdSet.has(fid)) {
        synIssues.push(`SynonymGroup "${sg.id}" references non-existent fact: ${fid}`);
        allIssues.push({factId: fid, issue: `SynonymGroup "${sg.id}" orphan factId`});
      }
    }
  }

  if (synIssues.length === 0) {
    pass('All synonym group factIds exist in facts');
  } else {
    fail(`${synIssues.length} synonym group issue(s)`, synIssues);
  }
}

// ─── 9. Answer Pool Minimum Sizes ────────────────────────────────────────────
section('9. Answer Pool Minimum Sizes (>= 5 members)');
{
  const sizeIssues = [];
  for (const pool of answerTypePools) {
    if (pool.factIds.length < 5) {
      sizeIssues.push(`Pool "${pool.id}" has only ${pool.factIds.length} facts (needs 5+)`);
    }
  }
  if (sizeIssues.length === 0) {
    pass(`All ${answerTypePools.length} pools have 5+ members`);
  } else {
    fail(`${sizeIssues.length} undersized pool(s)`, sizeIssues);
  }
}

// ─── 10. Random Content Spot-Check (20 facts across all 8 subDecks) ───────────
section('10. Content Spot-Check (20 facts sampled across subDecks)');
{
  // Seed-based pseudo-random for reproducibility
  let seed = 42;
  function rng() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }

  // Sample ~2-3 facts from each subdeck
  const sampled = [];
  const subDeckMap = new Map();
  for (const sd of (subDecks || [])) subDeckMap.set(sd.id, sd.factIds);
  const factMap = new Map(facts.map(f => [f.id, f]));
  
  for (const sd of (subDecks || [])) {
    const ids = [...sd.factIds];
    // Pick 2-3 random facts
    const count = Math.min(3, ids.length);
    const picks = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * ids.length);
      picks.push(ids.splice(idx, 1)[0]);
    }
    sampled.push(...picks.map(id => ({ subDeckId: sd.id, fact: factMap.get(id) })));
  }

  // Trim to 20
  while (sampled.length > 20) sampled.pop();

  console.log(`\n  Reviewing ${sampled.length} sampled facts:\n`);

  const contentIssues = [];

  for (const { subDeckId, fact: f } of sampled) {
    if (!f) continue;
    const problems = [];

    // Check 1: quizQuestion ends with ? or is non-empty
    if (!f.quizQuestion || f.quizQuestion.trim().length < 10) {
      problems.push('quizQuestion too short or empty');
    }
    if (!f.quizQuestion?.endsWith('?') && !f.quizQuestion?.endsWith('.')) {
      problems.push(`quizQuestion doesn't end with ? or .`);
    }

    // Check 2: correctAnswer is non-empty
    if (!f.correctAnswer || f.correctAnswer.trim() === '') {
      problems.push('correctAnswer is empty');
    }

    // Check 3: explanation is substantive (> 20 chars)
    if (!f.explanation || f.explanation.length < 20) {
      problems.push('explanation too short');
    }

    // Check 4: acceptableAlternatives is array
    if (!Array.isArray(f.acceptableAlternatives)) {
      problems.push('acceptableAlternatives is not an array');
    }

    // Check 5: distractors are distinct from correctAnswer
    const normCorrect = (f.correctAnswer || '').trim().toLowerCase();
    const badDistractors = (f.distractors || []).filter(
      d => d.trim().toLowerCase() === normCorrect
    );
    if (badDistractors.length > 0) {
      problems.push(`distractor identical to correctAnswer: ${badDistractors.join(', ')}`);
    }

    // Check 6: distractors not duplicated within the fact
    const distSet = new Set(f.distractors?.map(d => d.trim().toLowerCase()) || []);
    if (distSet.size < (f.distractors?.length || 0)) {
      problems.push('duplicate distractors within fact');
    }

    // Check 7: difficulty in range
    if (f.difficulty < 1 || f.difficulty > 5) {
      problems.push(`difficulty ${f.difficulty} out of range [1-5]`);
    }

    // Check 8: funScore in range
    if (f.funScore < 1 || f.funScore > 10) {
      problems.push(`funScore ${f.funScore} out of range [1-10]`);
    }

    const status = problems.length === 0
      ? `${GREEN}OK${RESET}`
      : `${RED}ISSUES${RESET}`;
    
    console.log(`  [${subDeckId}] ${f.id}`);
    console.log(`    Q: ${f.quizQuestion}`);
    console.log(`    A: ${f.correctAnswer} | diff:${f.difficulty} fun:${f.funScore}`);
    console.log(`    Distractors (${f.distractors?.length}): ${f.distractors?.slice(0,3).join(', ')}...`);
    console.log(`    ${status}${problems.length ? ' — ' + problems.join('; ') : ''}`);
    console.log();

    if (problems.length > 0) {
      contentIssues.push(...problems.map(p => ({factId: f.id, issue: p})));
      allIssues.push(...problems.map(p => ({factId: f.id, issue: p})));
    }
  }

  if (contentIssues.length === 0) {
    pass('All 20 spot-checked facts passed content review');
  } else {
    fail(`${contentIssues.length} content issue(s) in spot check`);
  }
}

// ─── 11. Extra: chainThemeId consistency (should be 0-7) ─────────────────────
section('11. ChainThemeId Range Check (0–7 for 8 subDecks)');
{
  const chainIssues = [];
  for (const f of facts) {
    if (typeof f.chainThemeId !== 'number' || f.chainThemeId < 0 || f.chainThemeId > 7) {
      chainIssues.push(`${f.id}: chainThemeId ${f.chainThemeId} out of range [0-7]`);
      allIssues.push({factId: f.id, issue: `chainThemeId ${f.chainThemeId} out of range`});
    }
  }
  if (chainIssues.length === 0) {
    pass('All chainThemeIds in valid range [0–7]');
  } else {
    fail(`${chainIssues.length} chainThemeId issue(s)`, chainIssues.slice(0, 20));
  }
}

// ─── 12. Distractor blank/whitespace check ────────────────────────────────────
section('12. Distractor Quality (no blank/whitespace-only distractors)');
{
  const blankIssues = [];
  for (const f of facts) {
    for (const d of (f.distractors || [])) {
      if (!d || d.trim() === '') {
        blankIssues.push(`${f.id}: blank distractor found`);
        allIssues.push({factId: f.id, issue: 'Blank distractor'});
      }
    }
  }
  if (blankIssues.length === 0) {
    pass('No blank distractors found');
  } else {
    fail(`${blankIssues.length} blank distractor(s)`, blankIssues);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
section('SUMMARY');
{
  console.log(`  Total facts: ${facts.length}`);
  console.log(`  Total issues found: ${allIssues.length}`);
  
  if (allIssues.length === 0) {
    console.log(`\n${GREEN}${BOLD}  ✓ ALL CHECKS PASSED — deck is structurally sound${RESET}\n`);
  } else {
    console.log(`\n${RED}${BOLD}  ✗ ISSUES FOUND — see details above${RESET}`);
    console.log(`\n  Facts requiring fixes:`);
    const factIssueMap = new Map();
    for (const {factId, issue} of allIssues) {
      if (!factIssueMap.has(factId)) factIssueMap.set(factId, []);
      factIssueMap.get(factId).push(issue);
    }
    for (const [factId, issues] of factIssueMap) {
      console.log(`    ${YELLOW}${factId}${RESET}: ${issues.join('; ')}`);
    }
    console.log();
  }
}
