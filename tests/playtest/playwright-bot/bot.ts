/**
 * Playwright Game Bot — Main Bot Loop
 *
 * Drives a single complete game run using the real Recall Rogue browser app.
 * Reads game state from window.__terraDebug() / window.__terraPlay and
 * interacts via DOM data-testid elements and the __terraPlay API.
 */

import type { Page } from 'playwright';
import type { BotProfile, BotRunStats } from './types.js';
import { readGameState, readQuizState, getVisibleTestIds } from './state-reader.js';
import { createRng, startRun, selectDomain, playCard, endTurn, answerQuiz, chooseRoom, handleCardReward, handleDelveRetreat, handleRest, handleMystery, handleGenericAction, clickTestId } from './actions.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum duration for a single run (10 minutes). */
const RUN_TIMEOUT_MS = 600_000;

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

  const stats: BotRunStats = {
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
    relicsEarned: 0,
    goldEarned: 0,
    goldSpent: 0,
    durationMs: 0,
    errors: [],
  };

  try {
    // Navigate to game with dev flags + turbo mode
    await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial&turbo=true', {
      waitUntil: 'networkidle',
      timeout: 15_000,
    });
    await page.waitForTimeout(2000);

    // Apply preset — this triggers a page reload
    try {
      await page.evaluate(() => (window as any).__terraPlay?.resetToPreset?.('post_tutorial'));
    } catch {
      // Expected: context destroyed due to navigation
    }
    // Wait for the reload to complete
    await page.waitForTimeout(3000);

    // Dismiss knowledge level popup if visible
    await clickTestId(page, 'knowledge-level-normal', 500)
      || await clickTestId(page, 'knowledge-level-casual', 500);
    await page.waitForTimeout(20);

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
        stats.errors.push('Run exceeded 5-minute timeout');
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

      // Track stats
      const floor = Number.isFinite(state.floor) ? state.floor : 0;
      stats.finalFloor = Math.max(stats.finalFloor, floor);
      stats.finalHP = state.playerHP;
      stats.finalMaxHP = state.playerMaxHP;

      // Check for run end
      if (state.isGameOver || state.runResult) {
        stats.result = state.runResult === 'victory' ? 'victory' : 'defeat';
        break;
      }

      // Explicit terminal screens
      if (['runEnd', 'runSummary', 'runComplete', 'run_end', 'game_over', 'victory', 'defeat'].includes(state.currentScreen)) {
        stats.result = state.currentScreen === 'victory' ? 'victory' : 'defeat';
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
        await page.waitForTimeout(50);
        continue;
      }

      // Stuck detection
      if (state.currentScreen === lastScreen) {
        stuckCount++;
        if (stuckCount >= STUCK_THRESHOLD) {
          const visibleIds = await getVisibleTestIds(page);
          // Try clicking any visible data-testid button
          const handled = await handleGenericAction(page);
          if (!handled) {
            // Try navigate to dungeonMap as escape hatch
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

      // Log every 100 iterations for debugging
      if (iterations % 100 === 0) {
        console.log(`    [iter ${iterations}] screen="${state.currentScreen}" hp=${state.playerHP}/${state.playerMaxHP} enemy=${state.enemyHP}/${state.enemyMaxHP} floor=${state.floor} cards=${stats.totalCardsPlayed}`);
      }

      // Dispatch on current screen
      try {
        await handleScreen(page, profile, state, stats, rng);
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

    // Final relic count
    try {
      const finalState = await readGameState(page);
      stats.relicsEarned = finalState.relicCount;
    } catch {
      // Non-critical — ignore
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

async function handleScreen(
  page: Page,
  profile: BotProfile,
  state: ReturnType<typeof readGameState> extends Promise<infer T> ? T : never,
  stats: BotRunStats,
  rng: () => number
): Promise<void> {
  switch (state.currentScreen) {

    // ── Combat ──────────────────────────────────────────────────────────────
    case 'combat': {
      // Decide: Quick Play or Charge?
      const shouldCharge = rng() < profile.chargeRate;
      const cardIdx = Math.floor(rng() * 5); // Pick random card slot

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
        } else {
          // Charge failed (no AP, no card at index) — try end turn
          const endResult = await page.evaluate(() => (window as any).__terraPlay?.endTurn?.());
          if (endResult?.ok) stats.totalTurns++;
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
        } else {
          // Quick play failed — try end turn
          const endResult = await page.evaluate(() => (window as any).__terraPlay?.endTurn?.());
          if (endResult?.ok) stats.totalTurns++;
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
        // Map nodes found
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
          // Fallback: direct DOM click
          await page.evaluate(`(function() {
            var el = document.querySelector('[data-testid="${pick}"]');
            if (el && !el.disabled) el.click();
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
        // All visible nodes checked

        // Check if segment is complete (boss node visited/current, no available nodes)
        const bossVisited = allNodeStates.some(n => n.includes('type-boss') && (n.includes('state-current') || n.includes('state-visited')));
        if (bossVisited) {
          segmentsCompleted++;
          if (segmentsCompleted >= MAX_SEGMENTS) {
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
      // Reward rooms may take time for victory animation — wait for reward UI
      const rewardIds = await getVisibleTestIds(page);
      const hasRewardUI = rewardIds.some(id =>
        id.startsWith('card-reward-') || id.startsWith('reward-') || id.startsWith('relic-option-') ||
        id === 'btn-skip-reward' || id === 'btn-continue' || id === 'btn-collect'
      );
      if (hasRewardUI) {
        await handleCardReward(page, profile, rng);
      } else {
        // No reward UI yet — wait for animation, then skip to map
        await page.waitForTimeout(200);
        const retryIds = await getVisibleTestIds(page);
        const hasRetry = retryIds.some(id =>
          id.startsWith('card-reward-') || id.startsWith('reward-') ||
          id === 'btn-skip-reward' || id === 'btn-continue' || id === 'btn-collect'
        );
        if (hasRetry) {
          await handleCardReward(page, profile, rng);
        } else {
          // Skip reward and return to map
          await page.evaluate(() => (window as any).__terraPlay?.navigate?.('dungeonMap'));
        }
      }
      await page.waitForTimeout(20);
      break;
    }

    // ── Relic reward ─────────────────────────────────────────────────────────
    case 'relicReward': {
      // Pick first relic option or skip
      const relicPicked = await page.evaluate(() => (window as any).__terraPlay?.selectRelic?.(0));
      if (!relicPicked?.ok) {
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
      // Try the real rest API first, fallback to clicking buttons
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
      await handleMystery(page);
      await page.waitForTimeout(10);
      break;
    }

    // ── Shop ──────────────────────────────────────────────────────────────────
    case 'shop':
    case 'shopRoom': {
      // Bot does not buy anything for now — just leave
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
      // Try start run
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
        // Try exitRoom as generic escape
        await page.evaluate(() => (window as any).__terraPlay?.exitRoom?.());
      }
      await page.waitForTimeout(20);
      break;
    }
  }
}
