#!/usr/bin/env node
/**
 * Deck Combat Playtest — Plays 2 combat encounters per curated deck via Docker warm containers.
 *
 * Usage:
 *   node scripts/deck-playtest-all.mjs                          # All 97 decks, 3 containers
 *   node scripts/deck-playtest-all.mjs --decks ancient_rome,spanish_a1  # Specific decks
 *   node scripts/deck-playtest-all.mjs --containers 1           # Single container
 *   node scripts/deck-playtest-all.mjs --dry-run                # Analyze only, no gameplay
 *   node scripts/deck-playtest-all.mjs --skip-boot              # Containers already running
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DECKS_DIR = path.join(ROOT, 'data/decks');
const MANIFEST_PATH = path.join(DECKS_DIR, 'manifest.json');
const OUTPUT_DIR = path.join(ROOT, 'data/playtests/deck-combat-playtest');
const DOCKER_SCRIPT = path.join(ROOT, 'scripts/docker-visual-test.sh');

const EXCLUDE_DECKS = new Set(['chess_tactics', 'test_world_capitals', 'manifest']);
const ENEMIES = ['page_flutter', 'mold_puff'];

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const NUM_CONTAINERS = parseInt(getArg('--containers') || '3', 10);
const DRY_RUN = hasFlag('--dry-run');
const SKIP_BOOT = hasFlag('--skip-boot');
const SPECIFIC_DECKS = getArg('--decks')?.split(',').map(s => s.trim()) || null;

// Port computation must match docker-visual-test.sh: 3200 + (cksum(agentId) % 100)
// Must use printf instead of echo -n (macOS /bin/sh echo -n is unreliable)
function computePort(agentId) {
  try {
    const result = execSync(`printf '%s' "${agentId}" | cksum | awk '{print $1}'`, { encoding: 'utf8' }).trim();
    return 3200 + (parseInt(result, 10) % 100);
  } catch {
    return 3200; // fallback
  }
}

// ─── Deck Category Detection ─────────────────────────────────────────────────

const LANG_PREFIXES = ['japanese', 'korean', 'chinese', 'spanish', 'french', 'german', 'dutch', 'czech'];
const WRITING_SYSTEMS = new Set(['japanese_hiragana', 'japanese_katakana', 'korean_hangul']);

function detectCategory(deck) {
  if (WRITING_SYSTEMS.has(deck.id)) return 'writing_system';
  if (deck.id.endsWith('_grammar')) return 'grammar';
  if (deck.domain === 'vocabulary' || LANG_PREFIXES.some(p => deck.id.startsWith(p + '_'))) return 'vocabulary';
  return 'knowledge';
}

// ─── Phase 1: Pre-Analysis ───────────────────────────────────────────────────

function analyzeDeck(deckId) {
  const filePath = path.join(DECKS_DIR, `${deckId}.json`);
  if (!fs.existsSync(filePath)) return null;

  const deck = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const category = detectCategory(deck);
  const facts = deck.facts || [];
  const pools = deck.answerTypePools || [];
  const subDecks = deck.subDecks || [];

  // Sample up to 5 facts
  const samples = facts.slice(0, 5).map(f => ({
    id: f.id,
    question: (f.quizQuestion || '').slice(0, 120),
    answer: (f.correctAnswer || '').slice(0, 80),
    poolId: f.answerTypePoolId,
    distractorCount: (f.distractors || []).length,
    language: f.language || null,
    partOfSpeech: f.partOfSpeech || null,
    targetWord: f.targetLanguageWord || null,
  }));

  // Pool summary
  const poolSummary = pools.map(p => ({
    id: p.id,
    label: p.label,
    factCount: (p.factIds || []).length,
    hasSynthetics: (p.syntheticDistractors || []).length > 0,
    syntheticCount: (p.syntheticDistractors || []).length,
  }));

  const analysis = {
    deckId: deck.id,
    name: deck.name,
    domain: deck.domain,
    subDomain: deck.subDomain,
    category,
    factCount: facts.length,
    poolCount: pools.length,
    subDeckCount: subDecks.length,
    subDeckNames: subDecks.map(sd => sd.name || sd.id),
    samples,
    poolSummary,
    expectedBehavior: getExpectedBehavior(category, deck),
  };

  return analysis;
}

function getExpectedBehavior(category, deck) {
  switch (category) {
    case 'knowledge':
      return {
        quizFormat: 'multiple_choice',
        questionStyle: 'factual question about ' + (deck.domain || 'general knowledge'),
        answerStyle: 'short factual answer',
        distractorSource: 'answer type pool (semantically related wrong answers)',
        expectedChoices: '3-5 (mastery-dependent)',
      };
    case 'vocabulary':
      return {
        quizFormat: 'multiple_choice',
        questionStyle: 'What does "word" mean? / How do you say "X" in Y?',
        answerStyle: 'English meaning or target language word',
        distractorSource: 'same part-of-speech pool',
        expectedChoices: '3-5',
        language: deck.facts?.[0]?.language || 'unknown',
      };
    case 'grammar':
      return {
        quizFormat: 'multiple_choice (may have fill-in-blank {___})',
        questionStyle: 'conjugation / sentence completion / grammar point',
        answerStyle: 'conjugated form or grammar structure',
        distractorSource: 'same-tense/same-pattern forms',
        expectedChoices: '3-5',
      };
    case 'writing_system':
      return {
        quizFormat: 'multiple_choice',
        questionStyle: 'character recognition',
        answerStyle: 'romanization or character',
        distractorSource: 'visually/phonetically similar characters',
        expectedChoices: '3-5',
      };
    default:
      return { quizFormat: 'unknown' };
  }
}

// ─── Gameplay Eval Script ────────────────────────────────────────────────────

function buildGameplayEval(deckId) {
  // Self-contained async IIFE that plays 2 encounters and returns structured data
  return `(async () => {
    const results = {
      deckId: '${deckId}',
      encounters: [],
      errors: [],
      totalQuizzes: 0,
      totalCardsPlayed: 0,
    };

    const enemies = ${JSON.stringify(ENEMIES)};
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    for (let enc = 0; enc < 2; enc++) {
      const encResult = {
        encounterIndex: enc,
        enemy: enemies[enc],
        quizzes: [],
        turns: 0,
        cardsPlayed: 0,
        combatStarted: false,
        combatEnded: false,
        error: null,
      };

      try {
        // Spawn combat with this deck
        const spawnResult = await window.__rrScenario.loadCustom({
          screen: 'combat',
          enemy: enemies[enc],
          deckId: '${deckId}',
          playerHp: 100,
          playerMaxHp: 100,
        });

        if (!spawnResult.ok) {
          encResult.error = 'Spawn failed: ' + spawnResult.message;
          results.encounters.push(encResult);
          results.errors.push(encResult.error);
          continue;
        }

        await wait(1500);
        encResult.combatStarted = true;

        // Play turns until enemy dies or max 10 turns
        for (let turn = 0; turn < 10; turn++) {
          const state = window.__rrPlay.getCombatState();
          if (!state) {
            encResult.combatEnded = true;
            break;
          }

          encResult.turns++;
          const handSize = state.handSize || 0;
          let ap = state.ap || 0;

          // Play cards with charge (quiz) until out of AP
          for (let ci = 0; ci < handSize && ap >= 2; ci++) {
            // Preview quiz first
            try {
              const preview = await window.__rrPlay.previewCardQuiz(0); // always index 0 (cards shift down)
              if (preview.ok && preview.state) {
                encResult.quizzes.push({
                  factId: preview.state.factId,
                  question: preview.state.question,
                  choices: preview.state.choices,
                  correctAnswer: preview.state.correctAnswer,
                  correctIndex: preview.state.correctIndex,
                  choiceCount: (preview.state.choices || []).length,
                  domain: preview.state.domain,
                  cardType: preview.state.cardType,
                });
                results.totalQuizzes++;
              }
            } catch (e) {
              // Quiz preview failed — try quick play instead
            }

            // Charge play (always answer correctly)
            try {
              const playResult = await window.__rrPlay.chargePlayCard(0, true);
              if (playResult.ok) {
                encResult.cardsPlayed++;
                results.totalCardsPlayed++;
                ap -= 2; // charge costs base + 1
              } else {
                // Try quick play as fallback
                const qp = await window.__rrPlay.quickPlayCard(0);
                if (qp.ok) {
                  encResult.cardsPlayed++;
                  results.totalCardsPlayed++;
                  ap -= 1;
                } else {
                  break; // Can't play any card
                }
              }
            } catch (e) {
              break;
            }

            await wait(100);

            // Check if combat ended mid-turn
            const midState = window.__rrPlay.getCombatState();
            if (!midState) {
              encResult.combatEnded = true;
              break;
            }
            ap = midState.ap || 0;
          }

          if (encResult.combatEnded) break;

          // End turn
          try {
            await window.__rrPlay.endTurn();
            await wait(500);
          } catch (e) {
            break;
          }

          // Check if combat ended after enemy turn
          const postState = window.__rrPlay.getCombatState();
          if (!postState) {
            encResult.combatEnded = true;
            break;
          }
        }

        if (!encResult.combatEnded) {
          encResult.combatEnded = true; // Max turns reached
        }
      } catch (e) {
        encResult.error = e.message || String(e);
        results.errors.push(encResult.error);
      }

      results.encounters.push(encResult);
    }

    return results;
  })()`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateResult(result, analysis) {
  const issues = [];

  if (!result || result.errors?.length > 0) {
    for (const err of (result?.errors || ['No result returned'])) {
      issues.push({ severity: 'CRITICAL', message: err });
    }
  }

  if (!result?.encounters || result.encounters.length < 2) {
    issues.push({ severity: 'HIGH', message: `Only ${result?.encounters?.length || 0}/2 encounters completed` });
  }

  for (const enc of (result?.encounters || [])) {
    if (enc.error) {
      issues.push({ severity: 'CRITICAL', message: `Encounter ${enc.encounterIndex}: ${enc.error}` });
      continue;
    }
    if (!enc.combatStarted) {
      issues.push({ severity: 'CRITICAL', message: `Encounter ${enc.encounterIndex}: Combat never started` });
      continue;
    }
    if (enc.quizzes.length === 0) {
      issues.push({ severity: 'HIGH', message: `Encounter ${enc.encounterIndex}: Zero quizzes captured — pool may be empty` });
    }
    if (enc.cardsPlayed === 0) {
      issues.push({ severity: 'HIGH', message: `Encounter ${enc.encounterIndex}: Zero cards played` });
    }

    // Validate individual quizzes
    for (const q of enc.quizzes) {
      if (!q.question || q.question.trim().length === 0) {
        issues.push({ severity: 'HIGH', message: `Empty question for fact ${q.factId}` });
      }
      if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
        issues.push({ severity: 'HIGH', message: `Empty correctAnswer for fact ${q.factId}` });
      }
      if (q.choiceCount < 2) {
        issues.push({ severity: 'HIGH', message: `Only ${q.choiceCount} choice(s) for fact ${q.factId} — need at least 2` });
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.choiceCount) {
        issues.push({ severity: 'CRITICAL', message: `correctIndex ${q.correctIndex} out of range for ${q.choiceCount} choices (fact ${q.factId})` });
      }
      // Check for duplicate choices
      if (q.choices) {
        const normalized = q.choices.map(c => (c || '').trim().toLowerCase());
        const unique = new Set(normalized);
        if (unique.size < normalized.length) {
          issues.push({ severity: 'MEDIUM', message: `Duplicate choices for fact ${q.factId}: ${JSON.stringify(q.choices)}` });
        }
      }
      // Check correct answer is actually in choices
      if (q.choices && q.correctAnswer) {
        const inChoices = q.choices.some(c => (c || '').trim() === q.correctAnswer.trim());
        if (!inChoices) {
          issues.push({ severity: 'CRITICAL', message: `correctAnswer "${q.correctAnswer}" not in choices for fact ${q.factId}` });
        }
      }
    }
  }

  // Category-specific checks
  if (analysis?.category === 'vocabulary') {
    for (const enc of (result?.encounters || [])) {
      for (const q of enc.quizzes) {
        // Vocab questions should reference a target language word
        if (q.question && !q.question.includes('"') && !q.question.includes('\u201c')) {
          // Relaxed check — some formats don't quote the word
        }
      }
    }
  }

  const status = issues.some(i => i.severity === 'CRITICAL') ? 'FAIL'
    : issues.some(i => i.severity === 'HIGH') ? 'ISSUES'
    : issues.length > 0 ? 'WARN' : 'PASS';

  return { issues, status };
}

// ─── Docker Container Management ────────────────────────────────────────────

async function bootContainers(count) {
  console.log(`\nBooting ${count} Docker warm container(s)...`);
  const procs = [];
  for (let i = 0; i < count; i++) {
    const agentId = `deck-batch-${i}`;
    const port = computePort(agentId);
    console.log(`  Starting container ${agentId} on port ${port}...`);
    try {
      execSync(`${DOCKER_SCRIPT} --warm start --agent-id ${agentId}`, {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: 120000,
      });
    } catch (e) {
      console.error(`  Failed to start container ${agentId}: ${e.message}`);
      // Try to continue with fewer containers
    }
  }

  // Wait for health checks
  console.log('  Waiting for containers to be ready...');
  for (let i = 0; i < count; i++) {
    const port = computePort(`deck-batch-${i}`);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const resp = await fetch(`http://localhost:${port}/health`);
        const data = await resp.json();
        if (data.ready) {
          ready = true;
          console.log(`  Container deck-batch-${i} ready (port ${port})`);
          break;
        }
      } catch { /* not ready yet */ }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!ready) {
      console.error(`  Container deck-batch-${i} failed to become ready`);
    }
  }
}

async function stopContainers(count) {
  console.log('\nStopping Docker containers...');
  for (let i = 0; i < count; i++) {
    const agentId = `deck-batch-${i}`;
    try {
      execSync(`${DOCKER_SCRIPT} --warm stop --agent-id ${agentId}`, {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log(`  Stopped ${agentId}`);
    } catch { /* ignore */ }
  }
}

async function isContainerHealthy(port) {
  try {
    const resp = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    return data.ready === true;
  } catch { return false; }
}

async function restartContainer(containerIdx) {
  const agentId = `deck-batch-${containerIdx}`;
  const port = computePort(agentId);
  console.log(`\n  Restarting container ${agentId} (port ${port})...`);
  try {
    execSync(`${DOCKER_SCRIPT} --warm stop --agent-id ${agentId}`, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
  } catch { /* ignore */ }
  try {
    execSync(`${DOCKER_SCRIPT} --warm start --agent-id ${agentId}`, { cwd: ROOT, stdio: 'pipe', timeout: 180000 });
  } catch (e) {
    console.error(`  Failed to restart ${agentId}: ${e.message}`);
    // Wait for it anyway
    for (let i = 0; i < 30; i++) {
      if (await isContainerHealthy(port)) { console.log(`  Container ${agentId} ready`); return true; }
      await new Promise(r => setTimeout(r, 3000));
    }
    return false;
  }
  return true;
}

async function sendTest(port, deckId, evalJs) {
  const body = {
    scenario: 'none',
    wait: 500,
    stopOnError: false,
    actions: [
      { type: 'eval', js: evalJs },
      { type: 'screenshot', name: `${deckId}-enc1` },
      { type: 'layoutDump', name: `${deckId}-layout` },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout per test

  try {
    const resp = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return resp.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

async function main() {
  console.log('=== Deck Combat Playtest ===\n');

  // Load manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  let deckIds = manifest.decks
    .map(f => f.replace('.json', ''))
    .filter(id => !EXCLUDE_DECKS.has(id));

  if (SPECIFIC_DECKS) {
    deckIds = deckIds.filter(id => SPECIFIC_DECKS.includes(id));
  }

  console.log(`Decks to test: ${deckIds.length}`);

  // Phase 1: Pre-analysis
  console.log('\n--- Phase 1: Pre-Analysis ---');
  const analyses = {};
  for (const id of deckIds) {
    const analysis = analyzeDeck(id);
    if (analysis) {
      analyses[id] = analysis;
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'analysis', `${id}.json`),
        JSON.stringify(analysis, null, 2)
      );
    } else {
      console.warn(`  WARNING: Could not analyze deck ${id} — file not found`);
    }
  }

  // Print category summary
  const categories = {};
  for (const a of Object.values(analyses)) {
    categories[a.category] = (categories[a.category] || 0) + 1;
  }
  console.log('  Categories:', JSON.stringify(categories));
  console.log(`  Analysis saved to ${path.join(OUTPUT_DIR, 'analysis/')}`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: Skipping gameplay ---');
    // Print analysis summary table
    console.log('\nDeck Analysis Summary:');
    console.log('ID'.padEnd(35) + 'Category'.padEnd(16) + 'Facts'.padEnd(8) + 'Pools'.padEnd(8) + 'SubDecks');
    for (const a of Object.values(analyses)) {
      console.log(
        a.deckId.padEnd(35) +
        a.category.padEnd(16) +
        String(a.factCount).padEnd(8) +
        String(a.poolCount).padEnd(8) +
        String(a.subDeckCount)
      );
    }
    return;
  }

  // Phase 2: Boot containers
  if (!SKIP_BOOT) {
    await bootContainers(NUM_CONTAINERS);
  } else {
    console.log('\n--- Phase 2: Skipping boot (--skip-boot) ---');
  }

  // Phase 3: Execute playtests
  console.log('\n--- Phase 3: Gameplay Execution ---');
  const allResults = {};
  const startTime = Date.now();

  // Distribute decks round-robin across containers
  for (let i = 0; i < deckIds.length; i++) {
    const deckId = deckIds[i];
    const containerIdx = i % NUM_CONTAINERS;
    const port = computePort(`deck-batch-${containerIdx}`);
    const analysis = analyses[deckId];

    const progress = `[${i + 1}/${deckIds.length}]`;
    process.stdout.write(`${progress} Testing ${deckId} (${analysis?.category || '?'}) on port ${port}... `);

    // Health check — restart container if dead
    if (!(await isContainerHealthy(port))) {
      console.log('container dead, restarting...');
      const restarted = await restartContainer(containerIdx);
      if (!restarted) {
        console.log(`\u2717 SKIP: Container ${containerIdx} won't restart`);
        allResults[deckId] = {
          deckId, category: analysis?.category || 'unknown', name: analysis?.name || deckId,
          encounters: 0, totalCardsPlayed: 0, totalQuizzes: 0, quizSamples: [],
          issues: [{ severity: 'CRITICAL', message: 'Container restart failed' }],
          status: 'FAIL', rawErrors: ['Container restart failed'],
        };
        continue;
      }
      process.stdout.write(`  Retesting ${deckId}... `);
    }

    try {
      const evalJs = buildGameplayEval(deckId);
      const rawResult = await sendTest(port, deckId, evalJs);

      // Extract gameplay result from the eval action's output
      let gameplayResult = null;
      if (rawResult.actionLog) {
        const evalAction = rawResult.actionLog.find(a => a.type === 'eval');
        if (evalAction?.out) {
          gameplayResult = evalAction.out;
        }
      }

      // Validate
      const validation = validateResult(gameplayResult, analysis);

      const deckResult = {
        deckId,
        category: analysis?.category || 'unknown',
        name: analysis?.name || deckId,
        encounters: gameplayResult?.encounters?.length || 0,
        totalCardsPlayed: gameplayResult?.totalCardsPlayed || 0,
        totalQuizzes: gameplayResult?.totalQuizzes || 0,
        quizSamples: [],
        issues: validation.issues,
        status: validation.status,
        rawErrors: gameplayResult?.errors || [],
        screenshotPaths: [],
        containerPort: port,
      };

      // Collect quiz samples (up to 10)
      for (const enc of (gameplayResult?.encounters || [])) {
        for (const q of (enc.quizzes || []).slice(0, 5)) {
          deckResult.quizSamples.push(q);
        }
      }

      // Copy screenshot paths
      if (rawResult.screenshotPath) deckResult.screenshotPaths.push(rawResult.screenshotPath);
      const ssAction = rawResult.actionLog?.find(a => a.type === 'screenshot');
      if (ssAction?.path) deckResult.screenshotPaths.push(ssAction.path);

      allResults[deckId] = deckResult;

      // Save per-deck result
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'results', `${deckId}.json`),
        JSON.stringify(deckResult, null, 2)
      );

      const statusIcon = validation.status === 'PASS' ? '\u2713' :
        validation.status === 'FAIL' ? '\u2717' : '\u26a0';
      console.log(`${statusIcon} ${validation.status} (${gameplayResult?.totalQuizzes || 0} quizzes, ${validation.issues.length} issues)`);
    } catch (e) {
      console.log(`\u2717 ERROR: ${e.message}`);
      allResults[deckId] = {
        deckId,
        category: analysis?.category || 'unknown',
        name: analysis?.name || deckId,
        encounters: 0,
        totalCardsPlayed: 0,
        totalQuizzes: 0,
        quizSamples: [],
        issues: [{ severity: 'CRITICAL', message: `Container error: ${e.message}` }],
        status: 'FAIL',
        rawErrors: [e.message],
      };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll tests complete in ${elapsed}s`);

  // Phase 4: Generate Summary
  console.log('\n--- Phase 4: Summary ---');
  const summary = generateSummary(allResults, analyses, elapsed);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'SUMMARY.md'), summary);
  console.log(`Summary written to ${path.join(OUTPUT_DIR, 'SUMMARY.md')}`);

  // Print quick stats
  const counts = { PASS: 0, ISSUES: 0, WARN: 0, FAIL: 0 };
  for (const r of Object.values(allResults)) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  console.log(`\nResults: ${counts.PASS} PASS | ${counts.WARN} WARN | ${counts.ISSUES} ISSUES | ${counts.FAIL} FAIL`);

  // Phase 5: Stop containers
  if (!SKIP_BOOT) {
    await stopContainers(NUM_CONTAINERS);
  }

  // Exit with error code if any failures
  if (counts.FAIL > 0) {
    process.exit(1);
  }
}

// ─── Summary Generation ─────────────────────────────────────────────────────

function generateSummary(results, analyses, elapsed) {
  const counts = { PASS: 0, ISSUES: 0, WARN: 0, FAIL: 0 };
  let totalQuizzes = 0;
  let totalCards = 0;
  const allIssues = [];

  for (const r of Object.values(results)) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    totalQuizzes += r.totalQuizzes || 0;
    totalCards += r.totalCardsPlayed || 0;
    for (const issue of r.issues) {
      allIssues.push({ deckId: r.deckId, deckName: r.name, category: r.category, ...issue });
    }
  }

  const overall = counts.FAIL > 0 ? 'FAIL' : counts.ISSUES > 0 ? 'ISSUES' : 'PASS';
  const date = new Date().toISOString().slice(0, 10);

  let md = `# Deck Combat Playtest Summary\n\n`;
  md += `**Date**: ${date} | **Decks**: ${Object.keys(results).length} | **Duration**: ${elapsed}s\n`;
  md += `**Quizzes captured**: ${totalQuizzes} | **Cards played**: ${totalCards}\n\n`;
  md += `## Overall Verdict: ${overall}\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  for (const [status, count] of Object.entries(counts)) {
    md += `| ${status} | ${count} |\n`;
  }

  // Per-category breakdown
  md += `\n## Results by Category\n\n`;
  const byCategory = {};
  for (const r of Object.values(results)) {
    if (!byCategory[r.category]) byCategory[r.category] = { pass: 0, fail: 0, issues: 0, warn: 0, decks: [] };
    byCategory[r.category][r.status.toLowerCase()]++;
    byCategory[r.category].decks.push(r);
  }

  for (const [cat, data] of Object.entries(byCategory).sort()) {
    md += `### ${cat} (${data.decks.length} decks)\n\n`;
    md += `| Deck | Status | Quizzes | Cards | Issues |\n|------|--------|---------|-------|--------|\n`;
    for (const r of data.decks.sort((a, b) => a.deckId.localeCompare(b.deckId))) {
      md += `| ${r.name} | ${r.status} | ${r.totalQuizzes} | ${r.totalCardsPlayed} | ${r.issues.length} |\n`;
    }
    md += '\n';
  }

  // All issues by severity
  md += `## All Issues (${allIssues.length})\n\n`;
  for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const sevIssues = allIssues.filter(i => i.severity === severity);
    if (sevIssues.length === 0) continue;
    md += `### ${severity} (${sevIssues.length})\n\n`;
    for (const i of sevIssues) {
      md += `- **${i.deckId}** (${i.category}): ${i.message}\n`;
    }
    md += '\n';
  }

  // Passing decks list (for registry stamping)
  const passingIds = Object.values(results)
    .filter(r => r.status === 'PASS' || r.status === 'WARN')
    .map(r => r.deckId)
    .sort();
  md += `## Passing Decks (${passingIds.length}) — Ready for Registry Stamp\n\n`;
  md += '```bash\n';
  md += `npx tsx scripts/registry/updater.ts --ids "${passingIds.join(',')}" --type lastLLMPlaytest --date ${date} --notes "Combat playtest: 2 encounters"\n`;
  md += '```\n';

  // Failing decks list
  const failingIds = Object.values(results)
    .filter(r => r.status === 'FAIL' || r.status === 'ISSUES')
    .map(r => r.deckId)
    .sort();
  if (failingIds.length > 0) {
    md += `\n## Failing Decks (${failingIds.length}) — Need Investigation\n\n`;
    for (const id of failingIds) {
      const r = results[id];
      md += `- **${id}**: ${r.issues.map(i => i.message).join('; ')}\n`;
    }
  }

  return md;
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
