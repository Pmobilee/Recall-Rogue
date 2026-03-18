/**
 * Playwright Game Bot — Main Bot Loop
 *
 * Drives a single complete game run using the real Recall Rogue browser app.
 * Reads game state from window.__terraDebug() / window.__terraPlay and
 * interacts via DOM data-testid elements and the __terraPlay API.
 */

import type { Page } from 'playwright';
import type { BotProfile, BotRunStats } from './types.js';
import { readGameState, readDetailedState, readQuizState, getVisibleTestIds } from './state-reader.js';
import { createRng, startRun, selectDomain, playCard, endTurn, answerQuiz, chooseRoom, handleCardReward, handleDelveRetreat, handleRest, handleMystery, handleGenericAction, clickTestId } from './actions.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum duration for a single run (90s — successful runs take 15-30s). */
const RUN_TIMEOUT_MS = 90_000;

/** Max loop iterations to prevent infinite loops. */
const MAX_ITERATIONS = 5_000;

/** How many same-screen iterations before declaring the bot stuck. */
const STUCK_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Domain selection
// ---------------------------------------------------------------------------

/** Available domains for bot selection. */
const DOMAINS = ['science', 'history', 'geography', 'literature', 'arts', 'nature'];

// ---------------------------------------------------------------------------
// Stat helpers
// ---------------------------------------------------------------------------

function initStats(profile: BotProfile, seed: number): BotRunStats {
  return {
    profile: profile.id,
    seed,
    result: 'error',
    finalFloor: 0,
    finalHP: 0,
    finalMaxHP: 0,
    totalTurns: 0,
    totalCardsPlayed: 0,
    totalCharges: 0,
    totalQuickPlays: 0,
    quizCorrect: 0,
    quizWrong: 0,
    durationMs: 0,
    errors: [],
    goldEarned: 0,
    goldSpent: 0,
    finalGold: 0,
    relicsEarned: [],
    finalRelicCount: 0,
    roomsVisited: [],
    totalRoomsVisited: 0,
    segmentsCompleted: 0,
    encountersWon: 0,
    encountersLost: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    avgTurnsPerEncounter: 0,
    finalDeckSize: 0,
    cardsAdded: 0,
    cardsRemoved: 0,
    maxChainLength: 0,
    maxCombo: 0,
    deathFloor: 0,
    deathEnemy: '',
    deathHP: 0,
    screenLog: [],
  };
}

function recordRoom(stats: BotRunStats, type: string): void {
  const existing = stats.roomsVisited.find(r => r.type === type);
  if (existing) {
    existing.count++;
  } else {
    stats.roomsVisited.push({ type, count: 1 });
  }
  stats.totalRoomsVisited++;
}

function logScreen(stats: BotRunStats, screen: string, startTime: number): void {
  const entry = { time: Date.now() - startTime, screen };
  stats.screenLog.push(entry);
  if (stats.screenLog.length > 50) {
    stats.screenLog.shift();
  }
}

// ---------------------------------------------------------------------------
// Main bot entry point
// ---------------------------------------------------------------------------

/**
 * Runs a single game playthrough with the given bot profile.
 *
 * Navigates to the game, starts a run, plays through combat encounters,
 * makes strategic decisions, and collects per-run stats.
 *
 * @param page - Playwright page (should be a fresh context)
 * @param profile - Bot profile controlling quiz accuracy and strategy
 * @param seed - RNG seed for deterministic decision sequences
 */
export async function runBot(page: Page, profile: BotProfile, seed: number): Promise<BotRunStats> {
  const startTime = Date.now();
  const rng = createRng(seed);
  const stats = initStats(profile, seed);

  // Track state for rich stat collection
  let prevGold = 0;
  let prevRelicCount = 0;
  let prevDeckSize = 0;
  let prevHp = 0;
  let prevEnemyHp = 0;
  let currentEncounterStartTurn = 0;
  let currentEnemyName = '';
  let inCombat = false;

  try {
    // Step 1: Quick navigate to set localStorage (marks onboarding complete)
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 10_000 });
    await page.evaluate(() => {
      localStorage.setItem('card:onboardingState', JSON.stringify({
        hasCompletedOnboarding: true, hasSeenCardTapTooltip: true,
        hasSeenCastTooltip: true, hasSeenSurgeTooltip: true, hasSeenChargeTooltip: true,
      }));
      localStorage.setItem('card:knowledgeLevelSelected', 'true');
    });

    // Step 2: Fresh navigate with turbo mode — no reload needed!
    await page.goto('http://localhost:5173?skipOnboarding=true&turbo=true', {
      waitUntil: 'networkidle',
      timeout: 15_000,
    });
    await page.waitForTimeout(2000);

    // Start the run via API
    const startResult = await page.evaluate(() => (window as any).__terraPlay?.startRun?.());
    if (!startResult?.ok) {
      // Fallback: click the button
      const clicked = await clickTestId(page, 'btn-start-run', 3000);
      if (!clicked) {
        stats.errors.push('Could not start run');
        stats.result = 'error';
        stats.durationMs = Date.now() - startTime;
        return stats;
      }
    }
    await page.waitForTimeout(30);

    // Handle archetype selection
    let afterStart = await readGameState(page);
    if (afterStart.currentScreen === 'archetypeSelection' || afterStart.currentScreen === 'archetype_select') {
      await page.evaluate(() => (window as any).__terraPlay?.selectArchetype?.('balanced'));
      await page.waitForTimeout(30);
      afterStart = await readGameState(page);
    }

    // Handle domain selection
    if (afterStart.currentScreen === 'domain_select' || afterStart.currentScreen === 'choose_domain' ||
        afterStart.currentScreen === 'topicSelection' || afterStart.currentScreen === 'domainSelect') {
      const domain = DOMAINS[Math.floor(rng() * DOMAINS.length)];
      await selectDomain(page, domain);
      await page.waitForTimeout(30);
    }

    // Read initial detailed state for baseline tracking
    try {
      const initial = await readDetailedState(page);
      prevGold = initial.gold;
      prevHp = initial.hp;
      prevDeckSize = initial.deckSize;
      prevRelicCount = initial.relics.length;
    } catch {
      // Non-critical
    }

    // Main game loop
    let lastScreen = '';
    let stuckCount = 0;
    let iterations = 0;
    let segmentsCompleted = 0;
    const MAX_SEGMENTS = 4;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Timeout guard
      if (Date.now() - startTime > RUN_TIMEOUT_MS) {
        stats.result = 'timeout';
        stats.errors.push('Run exceeded 90s timeout');
        break;
      }

      let state: Awaited<ReturnType<typeof readGameState>>;
      try {
        state = await readGameState(page);
      } catch {
        // Context destroyed (page navigation) — wait and retry
        await page.waitForTimeout(50);
        continue;
      }

      // Screen transition logging
      if (state.currentScreen !== lastScreen) {
        logScreen(stats, state.currentScreen, startTime);
      }

      // Track stats
      const floor = Number.isFinite(state.floor) ? state.floor : 0;
      stats.finalFloor = Math.max(stats.finalFloor, floor);
      stats.finalHP = state.playerHP;
      stats.finalMaxHP = state.playerMaxHP;

      // Check for run end
      if (state.isGameOver || state.runResult) {
        stats.result = state.runResult === 'victory' ? 'victory' : 'defeat';
        // Record death info on defeat
        if (stats.result === 'defeat') {
          stats.deathFloor = stats.finalFloor;
          stats.deathEnemy = currentEnemyName;
          stats.deathHP = state.playerHP;
        }
        break;
      }

      // Explicit terminal screens
      if (['runEnd', 'runSummary', 'runComplete', 'run_end', 'game_over', 'victory', 'defeat'].includes(state.currentScreen)) {
        stats.result = state.currentScreen === 'victory' ? 'victory' : 'defeat';
        if (stats.result === 'defeat') {
          stats.deathFloor = stats.finalFloor;
          stats.deathEnemy = currentEnemyName;
          stats.deathHP = state.playerHP;
        }
        break;
      }

      // Back at hub/base after playing cards = run ended (defeat or retreat)
      if (['hub', 'base'].includes(state.currentScreen) && stats.totalCardsPlayed > 0) {
        stats.result = state.playerHP > 0 ? 'victory' : 'defeat';
        break;
      }

      // Secondary run-end check via API (only every 50 iterations to avoid perf hit)
      if (iterations % 50 === 0) {
        const runEndCheck = await page.evaluate(() => {
          const play = (window as any).__terraPlay;
          const rs = play?.getRunState?.();
          return rs?.completed ?? false;
        });
        if (runEndCheck) {
          stats.result = 'defeat';
          break;
        }
      }

      // Combat-end transition: enemy is dead, wait for reward screen
      if (state.currentScreen === 'combat' && state.enemyHP <= 0 && state.enemyMaxHP > 0) {
        // Combat won — record encounter stats
        if (inCombat) {
          stats.encountersWon++;
          const encounterTurns = stats.totalTurns - currentEncounterStartTurn;
          // Running average: update avgTurnsPerEncounter
          const total = stats.encountersWon + stats.encountersLost;
          stats.avgTurnsPerEncounter = total > 1
            ? (stats.avgTurnsPerEncounter * (total - 1) + encounterTurns) / total
            : encounterTurns;
          inCombat = false;
        }
        await page.waitForTimeout(50);
        continue;
      }

      // Track combat entry
      if (state.currentScreen === 'combat' && !inCombat) {
        inCombat = true;
        currentEncounterStartTurn = stats.totalTurns;
        currentEnemyName = state.enemyName;
        prevEnemyHp = state.enemyHP;
        recordRoom(stats, 'combat');
      }

      // Track damage dealt (enemy HP reduction)
      if (state.currentScreen === 'combat' && prevEnemyHp > 0 && state.enemyHP < prevEnemyHp) {
        stats.totalDamageDealt += prevEnemyHp - state.enemyHP;
      }
      if (state.currentScreen === 'combat') {
        prevEnemyHp = state.enemyHP;
      }

      // Track damage taken (player HP reduction)
      if (state.playerHP > 0 && prevHp > 0 && state.playerHP < prevHp) {
        stats.totalDamageTaken += prevHp - state.playerHP;
      }
      prevHp = state.playerHP;

      // Track combo / chain
      if (state.comboCount > stats.maxCombo) {
        stats.maxCombo = state.comboCount;
      }

      // Stuck detection
      if (state.currentScreen === lastScreen) {
        stuckCount++;
        if (stuckCount >= STUCK_THRESHOLD) {
          const visibleIds = await getVisibleTestIds(page);
          const handled = await handleGenericAction(page);
          if (!handled) {
            await page.evaluate(() => (window as any).__terraPlay?.navigate?.('dungeonMap'));
            await page.waitForTimeout(20);
            const afterEscape = await readGameState(page);
            if (afterEscape.currentScreen !== state.currentScreen) {
              stuckCount = 0;
              lastScreen = afterEscape.currentScreen;
              continue;
            }
            stats.errors.push(
              `Stuck on screen "${state.currentScreen}" for ${STUCK_THRESHOLD} iterations. Visible IDs: [${visibleIds.slice(0, 8).join(', ')}]`
            );
            stats.result = 'error';
            break;
          }
          stuckCount = 0;
        }
      } else {
        stuckCount = 0;
        lastScreen = state.currentScreen;
      }

      // Dispatch on current screen
      try {
        await handleScreen(page, profile, state, stats, rng, {
          segmentsCompleted,
          MAX_SEGMENTS,
          onSegmentComplete: (n: number) => { segmentsCompleted = n; stats.segmentsCompleted = n; },
          onEncounterLost: () => {
            if (inCombat) {
              stats.encountersLost++;
              inCombat = false;
            }
          },
        });
      } catch {
        // Context destroyed during action — wait and retry
        await page.waitForTimeout(30);
      }

      // Small breathe to prevent hammering the browser
      await page.waitForTimeout(5);
    }

    if (iterations >= MAX_ITERATIONS) {
      stats.result = 'timeout';
      stats.errors.push(`Reached max iteration limit (${MAX_ITERATIONS})`);
    }

    // Read final detailed state for economy / deck / relic counts
    try {
      const final = await readDetailedState(page);
      stats.finalGold = final.gold;
      stats.finalDeckSize = final.deckSize;
      stats.finalRelicCount = final.relics.length;

      // Gold earned = any gold we saw above baseline
      if (final.gold > prevGold) {
        stats.goldEarned = final.gold - prevGold + stats.goldSpent;
      }

      // Relics — track IDs earned
      stats.relicsEarned = final.relics.filter(id => typeof id === 'string' && id.length > 0);

      // Deck growth
      if (final.deckSize > prevDeckSize) {
        stats.cardsAdded = final.deckSize - prevDeckSize;
      } else if (final.deckSize < prevDeckSize) {
        stats.cardsRemoved = prevDeckSize - final.deckSize;
      }
    } catch {
      // Non-critical
    }

  } catch (err: unknown) {
    stats.result = 'error';
    stats.errors.push(err instanceof Error ? err.message : String(err));
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

// ---------------------------------------------------------------------------
// Screen dispatcher
// ---------------------------------------------------------------------------

interface ScreenContext {
  segmentsCompleted: number;
  MAX_SEGMENTS: number;
  onSegmentComplete: (n: number) => void;
  onEncounterLost: () => void;
}

async function handleScreen(
  page: Page,
  profile: BotProfile,
  state: ReturnType<typeof readGameState> extends Promise<infer T> ? T : never,
  stats: BotRunStats,
  rng: () => number,
  ctx: ScreenContext,
): Promise<void> {
  switch (state.currentScreen) {

    // ── Combat ──────────────────────────────────────────────────────────────
    case 'combat': {
      // Decide: Quick Play or Charge?
      const shouldCharge = rng() < profile.chargeRate;
      const cardIdx = Math.floor(rng() * 5); // Pick random card slot

      let played = false;
      let ended = false;

      if (shouldCharge) {
        // Charge: answer correctly based on quiz accuracy
        const answerCorrectly = rng() < profile.quizAccuracy;
        const result = await page.evaluate(
          ([idx, correct]) => (window as any).__terraPlay?.chargePlayCard?.(idx, correct),
          [cardIdx, answerCorrectly] as [number, boolean],
        );
        if (result?.ok) {
          stats.totalCardsPlayed++;
          stats.totalCharges++;
          if (answerCorrectly) stats.quizCorrect++;
          else stats.quizWrong++;
          played = true;
        } else {
          // Try other card indices before giving up
          for (let i = 0; i < 5 && !played; i++) {
            if (i === cardIdx) continue;
            const r = await page.evaluate(
              ([idx, correct]) => (window as any).__terraPlay?.chargePlayCard?.(idx, correct),
              [i, answerCorrectly] as [number, boolean],
            );
            if (r?.ok) {
              stats.totalCardsPlayed++;
              stats.totalCharges++;
              if (answerCorrectly) stats.quizCorrect++;
              else stats.quizWrong++;
              played = true;
            }
          }
        }
      } else {
        // Quick Play
        const result = await page.evaluate(
          (idx) => (window as any).__terraPlay?.quickPlayCard?.(idx),
          cardIdx,
        );
        if (result?.ok) {
          stats.totalCardsPlayed++;
          stats.totalQuickPlays++;
          played = true;
        } else {
          // Try other card indices
          for (let i = 0; i < 5 && !played; i++) {
            if (i === cardIdx) continue;
            const r = await page.evaluate(
              (idx) => (window as any).__terraPlay?.quickPlayCard?.(idx),
              i,
            );
            if (r?.ok) {
              stats.totalCardsPlayed++;
              stats.totalQuickPlays++;
              played = true;
            }
          }
        }
      }

      // If no card played, end turn
      if (!played) {
        const endResult = await page.evaluate(() => (window as any).__terraPlay?.endTurn?.());
        if (endResult?.ok) {
          stats.totalTurns++;
          ended = true;
        }
      }

      // If still nothing worked, wait for state transition and retry endTurn
      if (!played && !ended) {
        await page.waitForTimeout(200);
        const retryEnd = await page.evaluate(() => (window as any).__terraPlay?.endTurn?.());
        if (retryEnd?.ok) {
          stats.totalTurns++;
        }
      }

      await page.waitForTimeout(5);
      break;
    }

    // ── Quiz ─────────────────────────────────────────────────────────────────
    case 'quiz': {
      const quiz = await readQuizState(page);
      const wasCorrect = await answerQuiz(page, profile, quiz, rng);
      if (wasCorrect) {
        stats.quizCorrect++;
      } else {
        stats.quizWrong++;
      }
      await page.waitForTimeout(10);
      break;
    }

    // ── Room / Map ───────────────────────────────────────────────────────────
    case 'room_selection':
    case 'dungeonMap':
    case 'map': {
      // Find AVAILABLE map nodes (format: map-node-rX-nY with state-available class)
      const mapNodes = await page.evaluate(`
        (function() {
          var nodes = document.querySelectorAll('[data-testid^="map-node-"]');
          var available = [];
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.classList.contains('state-available') && el.offsetParent !== null) {
              available.push(el.getAttribute('data-testid'));
            }
          }
          return available.sort();
        })()
      `) as string[];

      if (mapNodes.length > 0) {
        console.log(`    [MAP] ${mapNodes.length} available: ${mapNodes.slice(0,3).join(', ')}`);
        // Find the lowest available row
        const rows = new Map<string, string[]>();
        for (const n of mapNodes) {
          const row = n.match(/map-node-r(\d+)/)?.[1] ?? '99';
          if (!rows.has(row)) rows.set(row, []);
          rows.get(row)!.push(n);
        }
        const sortedRows = [...rows.keys()].sort((a, b) => parseInt(a) - parseInt(b));
        const firstRowNodes = rows.get(sortedRows[0]) || [];
        const pick = firstRowNodes[Math.floor(rng() * firstRowNodes.length)];

        // Use __terraPlay.selectMapNode API for reliable node selection
        const nodeId = pick.replace('map-node-', '');
        const selectResult = await page.evaluate(
          (id) => (window as any).__terraPlay?.selectMapNode?.(id),
          nodeId,
        );
        if (!selectResult?.ok) {
          console.log(`    [MAP] selectMapNode(${nodeId}) failed: ${selectResult?.message}`);
          // Fallback: direct DOM click from inside browser
          await page.evaluate(`(function() {
            var el = document.querySelector('[data-testid="${pick}"]');
            if (el) el.click();
          })()`);
        }
        await page.waitForTimeout(50);
      } else {
        // No available nodes — check for boss/current nodes or try clicking any node
        const allNodeStates = await page.evaluate(`
          (function() {
            var nodes = document.querySelectorAll('[data-testid^="map-node-"]');
            var result = [];
            for (var i = 0; i < nodes.length; i++) {
              var el = nodes[i];
              if (el.offsetParent !== null) {
                result.push(el.getAttribute('data-testid') + ':' + el.className.replace(/s-\\w+/g, '').trim());
              }
            }
            return result;
          })()
        `) as string[];

        // Check if segment is complete (boss node visited/current, no available nodes)
        const bossVisited = allNodeStates.some(n => n.includes('type-boss') && (n.includes('state-current') || n.includes('state-visited')));
        if (bossVisited) {
          const newSegCount = ctx.segmentsCompleted + 1;
          ctx.onSegmentComplete(newSegCount);
          if (newSegCount >= ctx.MAX_SEGMENTS) {
            // Run complete — retreat (cash out)
            stats.result = 'victory';
            await page.evaluate(() => (window as any).__terraPlay?.retreat?.());
            break;
          }
          // Segment complete — delve deeper
          const delveResult = await page.evaluate(() => (window as any).__terraPlay?.delve?.());
          if (!delveResult?.ok) {
            await page.evaluate(() => (window as any).__terraPlay?.navigate?.('retreatOrDelve'));
            await page.waitForTimeout(20);
            await page.evaluate(() => (window as any).__terraPlay?.delve?.());
          }
          await page.waitForTimeout(20);
          break;
        }

        // Try clicking the "current" node (might need to be entered)
        const currentNode = allNodeStates.find(n => n.includes('state-current'));
        if (currentNode) {
          const id = currentNode.split(':')[0];
          try { await page.locator(`[data-testid="${id}"]`).click({ force: true, timeout: 1000 }); } catch {}
          await page.waitForTimeout(50);
        }
        // Try enterRoom or generic fallbacks
        await page.evaluate(() => (window as any).__terraPlay?.enterRoom?.());
        await chooseRoom(page, profile, state, rng);
      }
      await page.waitForTimeout(10);
      break;
    }

    // ── Rewards ──────────────────────────────────────────────────────────────
    case 'card_reward':
    case 'cardReward':
    case 'reward':
    case 'rewardRoom': {
      // Wait for reward UI to appear (turbo mode resolves quickly)
      await page.waitForTimeout(500);

      const rewarded = await page.evaluate(() => {
        const play = (window as any).__terraPlay;
        const r = play && play.acceptReward && play.acceptReward();
        return r;
      });

      if (rewarded?.ok) {
        stats.cardsAdded++;
        // Track relic if this was a relic reward
        if (rewarded.relicId) {
          stats.relicsEarned.push(String(rewarded.relicId));
        }
      } else {
        // Check for visible reward UI and handle
        const rewardIds = await getVisibleTestIds(page);
        const hasRewardUI = rewardIds.some(id =>
          id.startsWith('card-reward-') || id.startsWith('reward-') || id.startsWith('relic-option-') ||
          id === 'btn-skip-reward' || id === 'btn-continue' || id === 'btn-collect'
        );

        if (hasRewardUI) {
          await handleCardReward(page, profile, rng);
        } else {
          // No reward UI — navigate back to map
          await page.evaluate(() => (window as any).__terraPlay?.navigate?.('dungeonMap'));
        }
      }
      await page.waitForTimeout(20);
      break;
    }

    // ── Relic reward ─────────────────────────────────────────────────────────
    case 'relicReward': {
      const relicPicked = await page.evaluate(() => (window as any).__terraPlay?.selectRelic?.(0));
      if (relicPicked?.ok) {
        if (relicPicked.relicId) stats.relicsEarned.push(String(relicPicked.relicId));
      } else {
        await clickTestId(page, 'relic-option-0', 500)
          || await clickTestId(page, 'btn-collect', 500)
          || await clickTestId(page, 'btn-continue', 500)
          || await clickTestId(page, 'btn-skip', 500);
      }
      await page.waitForTimeout(10);
      break;
    }

    // ── Treasure room ─────────────────────────────────────────────────────────
    case 'treasureRoom': {
      recordRoom(stats, 'treasure');
      await clickTestId(page, 'btn-collect', 500)
        || await clickTestId(page, 'btn-continue', 500)
        || await clickTestId(page, 'btn-ok', 500)
        || await handleGenericAction(page);
      await page.waitForTimeout(10);
      break;
    }

    // ── Delve / Retreat checkpoint ────────────────────────────────────────────
    case 'delve_retreat':
    case 'retreatOrDelve':
    case 'floor_complete':
    case 'checkpoint': {
      await handleDelveRetreat(page, profile, state);
      await page.waitForTimeout(20);
      break;
    }

    // ── Rest ──────────────────────────────────────────────────────────────────
    case 'rest':
    case 'rest_site':
    case 'restRoom': {
      recordRoom(stats, 'rest');
      const healed = await page.evaluate(() => (window as any).__terraPlay?.restHeal?.());
      if (!healed?.ok) {
        await clickTestId(page, 'rest-heal', 1000)
          || await clickTestId(page, 'rest-study', 1000)
          || await clickTestId(page, 'btn-rest-heal', 1000);
      }
      await page.waitForTimeout(20);
      break;
    }

    // ── Mystery / Event ───────────────────────────────────────────────────────
    case 'mystery':
    case 'event':
    case 'mysteryRoom': {
      recordRoom(stats, 'mystery');
      await handleMystery(page);
      await page.waitForTimeout(10);
      break;
    }

    // ── Shop ──────────────────────────────────────────────────────────────────
    case 'shop':
    case 'shopRoom': {
      recordRoom(stats, 'shop');
      const exited = await page.evaluate(() => (window as any).__terraPlay?.exitRoom?.());
      if (!exited?.ok) {
        await clickTestId(page, 'btn-leave-shop', 500)
          || await clickTestId(page, 'btn-close-shop', 500)
          || await clickTestId(page, 'shop-exit', 500)
          || await clickTestId(page, 'btn-close', 500)
          || await clickTestId(page, 'btn-continue', 500);
      }
      if (!exited?.ok) await handleGenericAction(page);
      await page.waitForTimeout(10);
      break;
    }

    // ── Domain / Topic / Archetype select (can appear mid-run) ───────────────
    case 'domain_select':
    case 'choose_domain':
    case 'topicSelection':
    case 'domainSelect': {
      const domain = DOMAINS[Math.floor(rng() * DOMAINS.length)];
      await selectDomain(page, domain);
      await page.waitForTimeout(20);
      break;
    }

    // ── Hub: try to start a run, handle popups ──────────────────────────────
    case 'hub':
    case 'main_menu':
    case 'base': {
      // Quick-try knowledge level popup (no wait if not found)
      await page.locator('[data-testid="knowledge-level-normal"]').click({ timeout: 100 }).catch(() => {});
      await page.evaluate(() => (window as any).__terraPlay?.startRun?.());
      await page.waitForTimeout(30);
      break;
    }

    // ── Archetype selection ──────────────────────────────────────────────────
    case 'archetypeSelection':
    case 'archetype_select': {
      await page.evaluate(() => (window as any).__terraPlay?.selectArchetype?.('balanced'));
      await page.waitForTimeout(20);
      break;
    }

    // ── Onboarding: force-skip via store ────────────────────────────────────
    case 'onboarding':
    case 'boot': {
      await page.evaluate(() => {
        const sym = Symbol.for('terra:currentScreen');
        const store = (globalThis as Record<symbol, unknown>)[sym] as { set?: (v: string) => void } | undefined;
        if (store?.set) store.set('hub');
      });
      await page.waitForTimeout(20);
      break;
    }

    // ── Default: try generic buttons, then exitRoom escape hatch ─────────────
    default: {
      const handled = await handleGenericAction(page);
      if (!handled) {
        await page.evaluate(() => (window as any).__terraPlay?.exitRoom?.());
      }
      await page.waitForTimeout(20);
      break;
    }
  }
}
