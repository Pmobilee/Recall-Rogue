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

/** Maximum duration for a single run (120s — includes up to 3s for first-room retries). */
const RUN_TIMEOUT_MS = 120_000;

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
    encounters: [],
    cardTypeStats: {},
    totalChains: 0,
    avgChainLength: 0,
    domainAccuracy: {},
    cardsUpgraded: 0,
    cardsRemovedAtShop: 0,
    haggleAttempts: 0,
    haggleSuccesses: 0,
    relicDetails: [],
    questionsAnswered: 0,
    questionsCorrect: 0,
    novelQuestionsAnswered: 0,
    novelQuestionsCorrect: 0,
    bountiesCompleted: [],
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

  // Per-encounter tracking variables
  let encounterDamageDealt = 0;
  let encounterDamageTaken = 0;
  let encounterCardsPlayed = 0;
  let encounterCharges = 0;
  let encounterQuickPlays = 0;
  let encounterMaxChain = 0;
  let encounterPlayerHpStart = 0;
  let encounterFloor = 0;

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

    // Unlock ALL relics by injecting into the player save store
    await page.evaluate(() => {
      const UNLOCKABLE_RELIC_IDS = [
        'chain_reactor', 'echo_chamber', 'quicksilver_quill', 'time_warp',
        'crit_lens', 'thorn_crown', 'bastions_will', 'festering_wound',
        'capacitor', 'double_down', 'scholars_crown', 'domain_mastery_sigil',
        'phoenix_feather', 'scholars_gambit', 'prismatic_shard', 'mirror_of_knowledge',
        'toxic_bloom', 'echo_lens',
      ];

      // Read the playerSave Svelte store
      const sym = Symbol.for('terra:playerSave');
      const store = (globalThis as any)[sym];
      if (!store?.subscribe || !store?.set) return;

      let save: any = null;
      store.subscribe((v: any) => { save = v; })();
      if (!save) return;

      // Merge unlockable relics into the save's unlockedRelicIds
      const existing = new Set(save.unlockedRelicIds ?? []);
      for (const id of UNLOCKABLE_RELIC_IDS) existing.add(id);
      save.unlockedRelicIds = [...existing];

      // Also give mastery coins so the game doesn't complain
      save.masteryCoins = 99999;
      save.masteryCoinsAvailable = 99999;

      // Write back to store
      store.set({ ...save });

      // Persist to localStorage (profile key)
      // Find the active save key
      const profileSym = Symbol.for('terra:profileStore');
      const profileStore = (globalThis as any)[profileSym];
      let profileData: any = null;
      if (profileStore?.subscribe) {
        profileStore.subscribe((v: any) => { profileData = v; })();
      }
      const saveKey = profileData?.activeProfileId
        ? 'rr-profile-' + profileData.activeProfileId
        : 'terra_save';
      localStorage.setItem(saveKey, JSON.stringify(save));
    });

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

    // ── Enter first room with retry (map needs a tick to mount) ──────────
    let enteredFirstRoom = false;
    for (let attempt = 0; attempt < 6 && !enteredFirstRoom; attempt++) {
      await page.waitForTimeout(500); // Give map time to render

      // Find available map nodes
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
        const nodeId = mapNodes[0].replace('map-node-', '');
        const selectResult = await page.evaluate(
          (id) => (window as any).__terraPlay?.selectMapNode?.(id),
          nodeId,
        );
        if (selectResult?.ok) {
          // Wait and check if we actually entered combat
          await page.waitForTimeout(500);
          const afterSelect = await readGameState(page);
          if (afterSelect.currentScreen !== 'dungeonMap' && afterSelect.currentScreen !== 'map') {
            enteredFirstRoom = true;
          }
        }
      }
    }

    if (!enteredFirstRoom) {
      stats.errors.push('Could not enter first room after 6 attempts');
      stats.result = 'timeout';
      stats.durationMs = Date.now() - startTime;
      return stats;
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
          if (inCombat) {
            const encounterTurns = stats.totalTurns - currentEncounterStartTurn;
            stats.encounters.push({
              enemyName: currentEnemyName,
              floor: encounterFloor,
              result: 'lost',
              turns: encounterTurns,
              damageDealt: encounterDamageDealt,
              damageTaken: encounterDamageTaken,
              cardsPlayed: encounterCardsPlayed,
              chargesUsed: encounterCharges,
              quickPlays: encounterQuickPlays,
              maxChain: encounterMaxChain,
              playerHpStart: encounterPlayerHpStart,
              playerHpEnd: state.playerHP,
            });
            inCombat = false;
          }
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
          if (inCombat) {
            const encounterTurns = stats.totalTurns - currentEncounterStartTurn;
            stats.encounters.push({
              enemyName: currentEnemyName,
              floor: encounterFloor,
              result: 'lost',
              turns: encounterTurns,
              damageDealt: encounterDamageDealt,
              damageTaken: encounterDamageTaken,
              cardsPlayed: encounterCardsPlayed,
              chargesUsed: encounterCharges,
              quickPlays: encounterQuickPlays,
              maxChain: encounterMaxChain,
              playerHpStart: encounterPlayerHpStart,
              playerHpEnd: state.playerHP,
            });
            inCombat = false;
          }
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

          // Push per-encounter record
          stats.encounters.push({
            enemyName: currentEnemyName,
            floor: encounterFloor,
            result: 'won',
            turns: encounterTurns,
            damageDealt: encounterDamageDealt,
            damageTaken: encounterDamageTaken,
            cardsPlayed: encounterCardsPlayed,
            chargesUsed: encounterCharges,
            quickPlays: encounterQuickPlays,
            maxChain: encounterMaxChain,
            playerHpStart: encounterPlayerHpStart,
            playerHpEnd: state.playerHP,
          });

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
        encounterDamageDealt = 0;
        encounterDamageTaken = 0;
        encounterCardsPlayed = 0;
        encounterCharges = 0;
        encounterQuickPlays = 0;
        encounterMaxChain = 0;
        encounterPlayerHpStart = state.playerHP;
        encounterFloor = state.floor ?? stats.finalFloor;
        recordRoom(stats, 'combat');
      }

      // Track damage dealt (enemy HP reduction)
      if (state.currentScreen === 'combat' && prevEnemyHp > 0 && state.enemyHP < prevEnemyHp) {
        const dmg = prevEnemyHp - state.enemyHP;
        stats.totalDamageDealt += dmg;
        encounterDamageDealt += dmg;
      }
      if (state.currentScreen === 'combat') {
        prevEnemyHp = state.enemyHP;
      }

      // Track damage taken (player HP reduction)
      if (state.playerHP > 0 && prevHp > 0 && state.playerHP < prevHp) {
        const dmg = prevHp - state.playerHP;
        stats.totalDamageTaken += dmg;
        encounterDamageTaken += dmg;
      }
      prevHp = state.playerHP;

      // Track combo / chain
      if (state.comboCount > stats.maxCombo) {
        stats.maxCombo = state.comboCount;
      }
      // Chain tracking per encounter
      if (state.chainLength > encounterMaxChain) {
        encounterMaxChain = state.chainLength;
      }
      if (state.chainLength > stats.maxChainLength) {
        stats.maxChainLength = state.chainLength;
      }
      // Count chains (length >= 2 = a chain was formed)
      if (state.chainLength === 2) {
        stats.totalChains++;
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

      // Mutable counters updated by handleScreen during combat
      const encounterCounters: EncounterCounters = {
        cardsPlayed: encounterCardsPlayed,
        charges: encounterCharges,
        quickPlays: encounterQuickPlays,
      };

      // Dispatch on current screen
      try {
        await handleScreen(page, profile, state, stats, rng, {
          segmentsCompleted,
          MAX_SEGMENTS,
          onSegmentComplete: (n: number) => { segmentsCompleted = n; stats.segmentsCompleted = n; },
          onEncounterLost: () => {
            if (inCombat) {
              stats.encountersLost++;
              const encounterTurns = stats.totalTurns - currentEncounterStartTurn;
              stats.encounters.push({
                enemyName: currentEnemyName,
                floor: encounterFloor,
                result: 'lost',
                turns: encounterTurns,
                damageDealt: encounterDamageDealt,
                damageTaken: encounterDamageTaken,
                cardsPlayed: encounterCardsPlayed,
                chargesUsed: encounterCharges,
                quickPlays: encounterQuickPlays,
                maxChain: encounterMaxChain,
                playerHpStart: encounterPlayerHpStart,
                playerHpEnd: 0,
              });
              inCombat = false;
            }
          },
          encounterCounters,
          encountersAtLastDelve: 0,
        });

        // Sync counters back from handleScreen
        encounterCardsPlayed = encounterCounters.cardsPlayed;
        encounterCharges = encounterCounters.charges;
        encounterQuickPlays = encounterCounters.quickPlays;
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
      stats.finalRelicCount = final.relicDetails?.length ?? final.relics.length;

      // Gold earned = final gold + amount spent - starting gold
      stats.goldEarned = (final.gold - prevGold) + stats.goldSpent;
      if (stats.goldEarned < 0) stats.goldEarned = 0;

      // Relics — use detailed data from RunState.runRelics
      if (final.relicDetails?.length > 0) {
        stats.relicDetails = final.relicDetails;
        stats.relicsEarned = final.relicDetails.map((r: any) => r.definitionId);
      } else {
        // Fallback to simple IDs
        stats.relicsEarned = final.relics.filter((id: string) => typeof id === 'string' && id.length > 0);
      }

      // Deck growth
      if (final.deckSize > prevDeckSize) {
        stats.cardsAdded = final.deckSize - prevDeckSize;
      } else if (final.deckSize < prevDeckSize) {
        stats.cardsRemoved = prevDeckSize - final.deckSize;
      }

      // Rich RunState data
      if (final.domainAccuracy) stats.domainAccuracy = final.domainAccuracy;
      stats.cardsUpgraded = final.cardsUpgraded ?? 0;
      stats.cardsRemovedAtShop = final.cardsRemovedAtShop ?? 0;
      stats.haggleAttempts = final.haggleAttempts ?? 0;
      stats.haggleSuccesses = final.haggleSuccesses ?? 0;
      stats.questionsAnswered = final.questionsAnswered ?? 0;
      stats.questionsCorrect = final.questionsCorrect ?? 0;
      stats.novelQuestionsAnswered = final.novelQuestionsAnswered ?? 0;
      stats.novelQuestionsCorrect = final.novelQuestionsCorrect ?? 0;
      stats.bountiesCompleted = final.bountiesCompleted ?? [];

      // Compute avg chain length
      if (stats.totalChains > 0 && stats.encounters.length > 0) {
        const totalChainLen = stats.encounters.reduce((sum, e) => sum + e.maxChain, 0);
        stats.avgChainLength = totalChainLen / stats.encounters.length;
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

interface EncounterCounters {
  cardsPlayed: number;
  charges: number;
  quickPlays: number;
}

interface ScreenContext {
  segmentsCompleted: number;
  MAX_SEGMENTS: number;
  onSegmentComplete: (n: number) => void;
  onEncounterLost: () => void;
  /** Mutable per-encounter counters updated by handleScreen during combat */
  encounterCounters: EncounterCounters;
  encountersAtLastDelve: number;
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
          ctx.encounterCounters.cardsPlayed++;
          ctx.encounterCounters.charges++;
          if (result?.state?.cardType) {
            const ct = String(result.state.cardType);
            if (!stats.cardTypeStats[ct]) stats.cardTypeStats[ct] = { played: 0, charged: 0, quickPlayed: 0 };
            stats.cardTypeStats[ct].played++;
            stats.cardTypeStats[ct].charged++;
          }
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
              ctx.encounterCounters.cardsPlayed++;
              ctx.encounterCounters.charges++;
              if (r?.state?.cardType) {
                const ct = String(r.state.cardType);
                if (!stats.cardTypeStats[ct]) stats.cardTypeStats[ct] = { played: 0, charged: 0, quickPlayed: 0 };
                stats.cardTypeStats[ct].played++;
                stats.cardTypeStats[ct].charged++;
              }
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
          ctx.encounterCounters.cardsPlayed++;
          ctx.encounterCounters.quickPlays++;
          if (result?.state?.cardType) {
            const ct = String(result.state.cardType);
            if (!stats.cardTypeStats[ct]) stats.cardTypeStats[ct] = { played: 0, charged: 0, quickPlayed: 0 };
            stats.cardTypeStats[ct].played++;
            stats.cardTypeStats[ct].quickPlayed++;
          }
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
              ctx.encounterCounters.cardsPlayed++;
              ctx.encounterCounters.quickPlays++;
              if (r?.state?.cardType) {
                const ct = String(r.state.cardType);
                if (!stats.cardTypeStats[ct]) stats.cardTypeStats[ct] = { played: 0, charged: 0, quickPlayed: 0 };
                stats.cardTypeStats[ct].played++;
                stats.cardTypeStats[ct].quickPlayed++;
              }
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
          // selectMapNode fallback
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
        if (bossVisited && stats.encountersWon > ctx.encountersAtLastDelve) {
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
          ctx.encountersAtLastDelve = stats.encountersWon;
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

    // ── Rewards (Phaser RewardRoomScene — NOT DOM-based) ─────────────────────
    case 'card_reward':
    case 'cardReward':
    case 'reward':
    case 'rewardRoom': {
      // The reward room is a Phaser canvas scene.
      // Programmatically collect rewards via the scene API.
      await page.waitForTimeout(800); // Let scene spawn items

      const rewardResult = await page.evaluate(`(function() {
        var mgr = globalThis[Symbol.for('terra:cardGameManager')];
        if (!mgr) return { ok: false, reason: 'no-manager' };
        var scene = mgr.getRewardRoomScene ? mgr.getRewardRoomScene() : null;
        if (!scene) return { ok: false, reason: 'no-scene' };

        var items = scene.getItems ? scene.getItems() : (scene.items || []);
        if (!items || items.length === 0) return { ok: false, reason: 'no-items' };

        var collected = [];
        var relicId = '';

        // Step 1: Collect all gold and vials (these don't conflict)
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.collected) continue;
          if (item.reward.type === 'gold') {
            item.collected = true;
            scene.events.emit('goldCollected', item.reward.amount || 0);
            collected.push('gold:' + (item.reward.amount || 0));
          } else if (item.reward.type === 'health_vial') {
            item.collected = true;
            scene.events.emit('vialCollected', item.reward.healAmount || 0);
            collected.push('vial:' + (item.reward.healAmount || 0));
          }
        }

        // Step 2: Accept first relic (if any) — relics are highest priority
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.collected) continue;
          if (item.reward.type === 'relic' && item.reward.relic) {
            item.collected = true;
            scene.events.emit('relicAccepted', item.reward.relic);
            relicId = item.reward.relic.id || '';
            collected.push('relic:' + relicId);
            // Mark remaining cards/relics as collected (disintegrated)
            for (var j = 0; j < items.length; j++) {
              if (items[j] === item || items[j].collected) continue;
              if (items[j].reward.type === 'card' || items[j].reward.type === 'relic') {
                items[j].collected = true;
              }
            }
            break;
          }
        }

        // Step 3: If no relic, accept first card
        if (!relicId) {
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.collected) continue;
            if (item.reward.type === 'card') {
              if (typeof scene.acceptCard === 'function') {
                scene.acceptCard(item);
              } else {
                item.collected = true;
                if (item.reward.card) scene.events.emit('cardAccepted', item.reward.card);
              }
              collected.push('card');
              break;
            }
          }
        }

        // Step 4: Mark ALL remaining items as collected
        for (var i = 0; i < items.length; i++) {
          if (!items[i].collected) items[i].collected = true;
        }

        // Step 5: Emit sceneComplete to advance the game
        scene.events.emit('sceneComplete');

        return { ok: true, collected: collected, relicId: relicId };
      })()`) as { ok: boolean; collected?: string[]; relicId?: string; reason?: string } | null;

      if (rewardResult?.ok) {
        if (rewardResult.relicId) {
          stats.relicsEarned.push(String(rewardResult.relicId));
        }
        if (rewardResult.collected?.some((c: string) => c.startsWith('card'))) {
          stats.cardsAdded++;
        }
        // Track gold collected
        const goldEntries = rewardResult.collected?.filter((c: string) => c.startsWith('gold:')) ?? [];
        for (const ge of goldEntries) {
          const amount = parseInt(ge.split(':')[1] ?? '0', 10);
          stats.goldEarned += amount;
        }
      } else {
        // Fallback: try navigating away
        await page.evaluate(() => (window as any).__terraPlay?.exitRoom?.());
        await page.waitForTimeout(200);
        await handleGenericAction(page);
      }
      await page.waitForTimeout(100);
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
