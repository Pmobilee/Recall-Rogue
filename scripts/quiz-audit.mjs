#!/usr/bin/env node
/**
 * quiz-audit.mjs
 *
 * In-game quiz audit: loads each non-exempt curated deck, samples facts from
 * every answer type pool, simulates quiz presentation (Q + correct + 3 distractors
 * from the same pool), and flags quality issues.
 *
 * Usage:
 *   node scripts/quiz-audit.mjs                  # All non-exempt decks
 *   node scripts/quiz-audit.mjs --deck dinosaurs # Single deck
 *   node scripts/quiz-audit.mjs --verbose        # Show every sampled fact
 *   node scripts/quiz-audit.mjs --full           # Check every fact in every pool (not just 5/pool sample)
 *   node scripts/quiz-audit.mjs --json           # Output JSON to stdout instead of ANSI table
 *   node scripts/quiz-audit.mjs --deck dinosaurs --full  # Full audit of one deck
 */

import { readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const decksDir = resolve(repoRoot, 'data/decks');

const VERBOSE = process.argv.includes('--verbose');
const deckArg = process.argv.indexOf('--deck');
const SINGLE_DECK = deckArg !== -1 ? process.argv[deckArg + 1] : null;
const FULL_MODE = process.argv.includes('--full');
const JSON_MODE = process.argv.includes('--json');

// ANSI
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// Exempt deck prefixes (language/vocab decks)
const EXEMPT_PREFIXES = [
  'chinese_hsk', 'japanese_', 'korean_', 'french_', 'german_',
  'spanish_', 'dutch_', 'czech_', 'test_',
];
// Also exempt image-only decks
const EXEMPT_EXACT = ['world_flags'];

function isExempt(deckId) {
  if (EXEMPT_EXACT.includes(deckId)) return true;
  return EXEMPT_PREFIXES.some(p => deckId.startsWith(p));
}

const BRACE_NUMBER_RE = /^\{(\d[\d,]*\.?\d*)\}$/;

function displayAnswer(answer) {
  const m = answer.match(BRACE_NUMBER_RE);
  return m ? m[1] : answer;
}

function isNumerical(answer) {
  return BRACE_NUMBER_RE.test(answer);
}

// Simple seeded PRNG
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Issue Definitions ----

function checkFact(fact, poolFacts, allPools, deck) {
  const issues = [];
  const correct = displayAnswer(fact.correctAnswer);
  const correctLen = correct.length;

  // 1. Em-dash in answer (baked-in explanation)
  if (correct.includes('—') || correct.includes(' — ')) {
    issues.push({ severity: 'FAIL', type: 'em_dash_answer', detail: `Answer contains em-dash: "${correct.slice(0, 80)}"` });
  }

  // 2. Answer too long
  if (correctLen > 100) {
    issues.push({ severity: 'FAIL', type: 'answer_too_long', detail: `Answer ${correctLen} chars: "${correct.slice(0, 60)}..."` });
  } else if (correctLen > 60) {
    issues.push({ severity: 'WARN', type: 'answer_long', detail: `Answer ${correctLen} chars: "${correct.slice(0, 60)}..."` });
  }

  // Build distractor pool: other facts in same pool, deduplicated by answer text.
  // This mirrors game runtime behavior (getPoolDistractors uses a usedAnswers Set to
  // prevent duplicate distractors from pool members sharing the same answer).
  const seenPoolAnswers = new Set([correct.toLowerCase().trim()]);
  const poolDistractors = [];
  for (const f of poolFacts) {
    if (f.id === fact.id) continue;
    const ans = displayAnswer(f.correctAnswer);
    const ansNorm = ans.toLowerCase().trim();
    if (seenPoolAnswers.has(ansNorm)) continue;
    seenPoolAnswers.add(ansNorm);
    poolDistractors.push(ans);
  }

  // Also include synthetic distractors from the pool
  const pool = allPools.find(p => p.id === fact.answerTypePoolId);
  const syntheticDistractors = pool?.syntheticDistractors || [];

  // Also include fact-level distractors
  const factDistractors = (fact.distractors || []).map(d => displayAnswer(d));

  // Combined available distractors (pool members + synthetics + fact-level)
  const allDistractors = [...new Set([...poolDistractors, ...syntheticDistractors, ...factDistractors])];

  // 3. Too few total distractors
  if (allDistractors.length < 3) {
    issues.push({ severity: 'FAIL', type: 'too_few_distractors', detail: `Only ${allDistractors.length} total distractors available (need ≥3)` });
  }

  // Pick 3 distractors (simulate game: prefer pool, then fact-level, then synthetic)
  const rand = makePrng(fact.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  let picked = [];

  // First from pool (other facts' answers, already deduplicated by answer text)
  const shuffledPool = shuffle([...poolDistractors], rand);
  picked.push(...shuffledPool.slice(0, 3));

  // Fill remaining from fact-level distractors
  if (picked.length < 3) {
    const remaining = factDistractors.filter(d => !picked.includes(d));
    picked.push(...shuffle(remaining, rand).slice(0, 3 - picked.length));
  }

  // Fill remaining from synthetics
  if (picked.length < 3) {
    const remaining = syntheticDistractors.filter(d => !picked.includes(d));
    picked.push(...shuffle(remaining, rand).slice(0, 3 - picked.length));
  }

  picked = picked.slice(0, 3);

  // 4. Length mismatch — correct answer dramatically different from distractors
  if (picked.length >= 3 && !isNumerical(fact.correctAnswer) && !pool?.homogeneityExempt) {
    const distractorLens = picked.map(d => d.length);
    const avgDistractorLen = distractorLens.reduce((a, b) => a + b, 0) / distractorLens.length;
    const ratio = correctLen / avgDistractorLen;

    if (ratio > 3 || ratio < 0.33) {
      issues.push({
        severity: 'FAIL',
        type: 'length_mismatch',
        detail: `Correct "${correct.slice(0, 40)}" (${correctLen}ch) vs distractors avg ${Math.round(avgDistractorLen)}ch (ratio ${ratio.toFixed(1)}x)`
      });
    } else if (ratio > 2 || ratio < 0.5) {
      issues.push({
        severity: 'WARN',
        type: 'length_mismatch',
        detail: `Correct "${correct.slice(0, 40)}" (${correctLen}ch) vs distractors avg ${Math.round(avgDistractorLen)}ch (ratio ${ratio.toFixed(1)}x)`
      });
    }
  }

  // 5. Correct answer appears in distractors
  const correctNorm = correct.toLowerCase().trim();
  for (const d of picked) {
    if (d.toLowerCase().trim() === correctNorm) {
      issues.push({ severity: 'FAIL', type: 'answer_in_distractors', detail: `Distractor matches correct answer: "${d}"` });
    }
  }

  // 6. Duplicate distractors
  const normPicked = picked.map(d => d.toLowerCase().trim());
  const uniquePicked = new Set(normPicked);
  if (uniquePicked.size < normPicked.length) {
    issues.push({ severity: 'FAIL', type: 'duplicate_distractors', detail: `Duplicate distractors in selection` });
  }

  // 7. Question too long
  if (fact.quizQuestion && fact.quizQuestion.length > 400) {
    issues.push({ severity: 'FAIL', type: 'question_too_long', detail: `Question ${fact.quizQuestion.length} chars` });
  } else if (fact.quizQuestion && fact.quizQuestion.length > 300) {
    issues.push({ severity: 'WARN', type: 'question_long', detail: `Question ${fact.quizQuestion.length} chars` });
  }

  // 8. Missing explanation
  if (!fact.explanation || fact.explanation.trim().length === 0) {
    issues.push({ severity: 'FAIL', type: 'missing_explanation', detail: 'No explanation' });
  }

  // 9. Trivially eliminatable — one option dramatically longer/shorter
  if (picked.length >= 3 && !isNumerical(fact.correctAnswer) && !pool?.homogeneityExempt) {
    const allOptions = [correct, ...picked];
    const lens = allOptions.map(o => o.length);
    const avgLen = lens.reduce((a, b) => a + b, 0) / lens.length;

    for (const opt of allOptions) {
      const optRatio = opt.length / avgLen;
      if ((optRatio > 4 || optRatio < 0.2) && avgLen > 5) {
        issues.push({
          severity: 'WARN',
          type: 'trivially_eliminatable',
          detail: `Option "${opt.slice(0, 30)}" (${opt.length}ch) stands out from avg ${Math.round(avgLen)}ch`
        });
        break;
      }
    }
  }

  // 10. Check for questionTemplate issues — empty placeholders
  if (fact.quizQuestion && fact.quizQuestion.includes('{___}') === false) {
    // Check for double spaces or empty template slots
    if (fact.quizQuestion.includes('  ') && fact.quizQuestion.includes('the  ')) {
      issues.push({ severity: 'WARN', type: 'empty_placeholder', detail: `Question may have empty template placeholder: "${fact.quizQuestion.slice(0, 80)}"` });
    }
  }

  return { fact, correct, picked, issues };
}

function auditDeck(deckPath) {
  const raw = readFileSync(deckPath, 'utf-8');
  const deck = JSON.parse(raw);

  if (!deck.facts || !deck.answerTypePools) {
    return { deckId: deck.id, skipped: true, reason: 'No facts or pools' };
  }

  const pools = deck.answerTypePools;
  const factMap = new Map(deck.facts.map(f => [f.id, f]));
  const results = [];

  // Sample from each pool: up to 5 facts per pool, ensuring coverage
  for (const pool of pools) {
    const poolFactIds = pool.factIds || [];
    const poolFacts = poolFactIds.map(id => factMap.get(id)).filter(Boolean);

    if (poolFacts.length === 0) continue;

    // Smart sampling: pick up to 5 (or all in --full mode), biased toward variety
    const rand = makePrng(pool.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
    const sampleSize = FULL_MODE ? poolFacts.length : Math.min(5, poolFacts.length);
    const sampled = FULL_MODE ? [...poolFacts] : shuffle([...poolFacts], rand).slice(0, sampleSize);

    for (const fact of sampled) {
      const result = checkFact(fact, poolFacts, pools, deck);
      results.push({ ...result, poolId: pool.id, poolLabel: pool.label, poolSize: poolFacts.length });
    }
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    totalFacts: deck.facts.length,
    poolCount: pools.length,
    sampled: results.length,
    results,
    failCount: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'FAIL').length, 0),
    warnCount: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'WARN').length, 0),
  };
}

// ---- Main ----

const deckFiles = readdirSync(decksDir)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .map(f => f.replace('.json', ''))
  .filter(id => !isExempt(id))
  .filter(id => !SINGLE_DECK || id === SINGLE_DECK)
  .sort();

if (!JSON_MODE) {
  console.log(`\n${BOLD}In-Game Quiz Audit${RESET}`);
  console.log(`${DIM}Auditing ${deckFiles.length} non-exempt knowledge decks (mode: ${FULL_MODE ? 'full' : 'sample'})${RESET}\n`);
}

const allResults = [];
let totalFails = 0;
let totalWarns = 0;

for (const deckId of deckFiles) {
  const deckPath = resolve(decksDir, `${deckId}.json`);
  const result = auditDeck(deckPath);
  allResults.push(result);

  if (!JSON_MODE) {
    if (result.skipped) {
      console.log(`${DIM}⊘ ${deckId}: ${result.reason}${RESET}`);
      continue;
    }

    totalFails += result.failCount;
    totalWarns += result.warnCount;

    const status = result.failCount > 0 ? `${RED}✗${RESET}` : result.warnCount > 0 ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
    console.log(`${status} ${BOLD}${result.deckName}${RESET} ${DIM}(${result.deckId})${RESET} — ${result.totalFacts} facts, ${result.poolCount} pools, ${result.sampled} sampled | ${RED}${result.failCount} fails${RESET} ${YELLOW}${result.warnCount} warns${RESET}`);

    // Show issues
    const issueResults = result.results.filter(r => r.issues.length > 0);
    for (const r of issueResults) {
      if (VERBOSE || r.issues.some(i => i.severity === 'FAIL')) {
        console.log(`  ${DIM}[${r.poolId}]${RESET} Q: "${r.fact.quizQuestion.slice(0, 70)}..."`);
        console.log(`    ${CYAN}✓${RESET} ${r.correct}`);
        for (const d of r.picked) {
          console.log(`    ${DIM}✗${RESET} ${d}`);
        }
        for (const issue of r.issues) {
          const color = issue.severity === 'FAIL' ? RED : YELLOW;
          console.log(`    ${color}${issue.severity}:${RESET} ${issue.detail}`);
        }
      }
    }
  } else {
    if (!result.skipped) {
      totalFails += result.failCount;
      totalWarns += result.warnCount;
    }
  }
}

if (JSON_MODE) {
  // JSON output mode: emit structured data to stdout
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    mode: FULL_MODE ? 'full' : 'sample',
    decks: allResults
      .filter(r => !r.skipped)
      .map(r => ({
        deckId: r.deckId,
        deckName: r.deckName,
        totalFacts: r.totalFacts,
        poolCount: r.poolCount,
        sampled: r.sampled,
        fails: r.failCount,
        warns: r.warnCount,
        issues: r.results
          .filter(res => res.issues.length > 0)
          .map(res => ({
            factId: res.fact.id,
            poolId: res.poolId,
            question: res.fact.quizQuestion,
            correct: res.correct,
            distractors: res.picked,
            issues: res.issues,
          })),
      })),
    totalFails,
    totalWarns,
  };
  process.stdout.write(JSON.stringify(jsonOutput, null, 2) + '\n');
} else {
  // ANSI summary table
  console.log(`\n${BOLD}═══ Summary ═══${RESET}\n`);
  console.log(`${'Deck'.padEnd(30)} ${'Facts'.padStart(6)} ${'Pools'.padStart(6)} ${'Sampled'.padStart(8)} ${'Fails'.padStart(6)} ${'Warns'.padStart(6)}`);
  console.log('─'.repeat(70));

  for (const r of allResults) {
    if (r.skipped) continue;
    const color = r.failCount > 0 ? RED : r.warnCount > 0 ? YELLOW : GREEN;
    console.log(`${color}${(r.deckName || r.deckId).padEnd(30)}${RESET} ${String(r.totalFacts).padStart(6)} ${String(r.poolCount).padStart(6)} ${String(r.sampled).padStart(8)} ${String(r.failCount).padStart(6)} ${String(r.warnCount).padStart(6)}`);
  }

  console.log('─'.repeat(70));
  console.log(`${'TOTAL'.padEnd(30)} ${' '.repeat(22)} ${RED}${String(totalFails).padStart(6)}${RESET} ${YELLOW}${String(totalWarns).padStart(6)}${RESET}`);
  console.log();

  if (totalFails > 0) {
    console.log(`${RED}${BOLD}${totalFails} failures require fixing before these decks are audit-clean.${RESET}`);
  } else if (totalWarns > 0) {
    console.log(`${YELLOW}All decks pass structurally. ${totalWarns} warnings to review.${RESET}`);
  } else {
    console.log(`${GREEN}${BOLD}All decks pass in-game quiz audit!${RESET}`);
  }
}

// Opt-in: only stamp when --stamp-registry flag is present
const shouldStampRegistry = process.argv.includes('--stamp-registry');
if (shouldStampRegistry) {
  // Stamp lastQuizAudit in inspection registry for decks that passed (best-effort, never blocks)
  try {
    const passedIds = allResults.filter(r => !r.skipped && r.failCount === 0).map(r => r.deckId).join(',');
    if (passedIds) {
      execSync(
        `npx tsx scripts/registry/updater.ts --ids "${passedIds}" --type lastQuizAudit`,
        { stdio: 'pipe' }
      );
      const count = passedIds.split(',').length;
      console.log(`Registry stamped: ${count} decks marked with lastQuizAudit=${new Date().toISOString().slice(0,10)}`);
    }
  } catch (_) {
    // Registry stamp failure never blocks audit output
  }
} else {
  console.log('(Registry stamping skipped — pass --stamp-registry to enable.)');
}
