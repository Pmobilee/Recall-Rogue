/**
 * LLM Playthrough Script
 *
 * Runs a full game playthrough inside a Docker warm container,
 * logging all game state and decisions to a JSON report.
 * Uses __rrPlay API for all interactions.
 */

import { chromium } from 'playwright';
import * as fs from 'fs';

const DEV_SERVER = process.env.DEV_SERVER || 'http://localhost:5173';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/rr-playthrough';
const PRESET = process.env.PRESET || 'mid_game_3_rooms';
const GAME_URL = `${DEV_SERVER}?skipOnboarding=true&devpreset=${PRESET}&turbo`;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const log = [];
function logStep(step, data) {
  const entry = { step, timestamp: new Date().toISOString(), ...data };
  log.push(entry);
  console.log(`[${step}]`, JSON.stringify(data).substring(0, 200));
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Reduce motion for faster gameplay
  await page.addInitScript(() => {
    localStorage.setItem('card:reduceMotionMode', 'true');
  });

  console.log('Loading game...');
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__rrPlay !== 'undefined', { timeout: 30000 });
  await page.waitForTimeout(2000);

  const screen = await page.evaluate(() => window.__rrPlay.getScreen());
  logStep('init', { screen });

  // Start run
  console.log('Starting run...');
  await page.evaluate(() => window.__rrPlay.startRun());
  await page.waitForTimeout(2000);

  let currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());
  logStep('after_start_run', { screen: currentScreen });

  // Handle mode selection if we're on it
  if (currentScreen === 'deckSelectionHub' || currentScreen === 'modeSelect') {
    const clicked = await page.evaluate(() => {
      const panel = document.querySelector('.panel--trivia');
      if (panel) { panel.click(); return true; }
      return false;
    });
    await page.waitForTimeout(2000);
    currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());
    logStep('mode_select', { clicked, screen: currentScreen });
  }

  // Handle trivia dungeon deck selection
  if (currentScreen === 'triviaDungeon' || currentScreen === 'deckSelection') {
    await page.evaluate(() => {
      const btn = document.querySelector('.footer-start-btn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);
    currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());
    logStep('after_deck_select', { screen: currentScreen });
  }

  // Handle run preview / archetype / narrative screens (click through up to 15 times)
  for (let i = 0; i < 15; i++) {
    currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());
    if (currentScreen === 'dungeonMap' || currentScreen === 'combat' || currentScreen === 'rewardRoom' || currentScreen === 'runPreview') break;

    const advanceResult = await page.evaluate(() => {
      // Try specific buttons first
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const txt = b.textContent?.toLowerCase() || '';
        if (txt.includes('embark') || txt.includes('skip') || txt.includes('next') ||
            txt.includes('continue') || txt.includes('start') || txt.includes('begin') ||
            txt.includes('confirm') || txt.includes('go') || txt.includes('enter') ||
            txt.includes('depths') || txt.includes('proceed')) {
          b.click();
          return 'clicked: ' + txt;
        }
      }
      // Click body as fallback
      document.body.click();
      return 'body click';
    });
    logStep('advance_screen', { screen: currentScreen, action: advanceResult });
    await page.waitForTimeout(2000);
  }

  currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());
  logStep('run_started', { screen: currentScreen });

  // Get initial run state
  const runState = await page.evaluate(() => window.__rrPlay.getRunState());
  logStep('run_state', runState);

  // ─── MAIN GAME LOOP ──────────────────────────
  let turnCount = 0;
  const maxTurns = 200; // Safety limit — allow deep runs
  let combatCount = 0;
  let stuckCount = 0;
  let lastScreen = '';

  while (turnCount < maxTurns) {
    turnCount++;
    currentScreen = await page.evaluate(() => window.__rrPlay.getScreen());

    if (currentScreen === 'hub' || currentScreen === 'runEnd') {
      logStep('run_end', { screen: currentScreen, turnCount });
      break;
    }

    // Stuck detection — if same screen for 8 iterations, try to force advance
    if (currentScreen === lastScreen && currentScreen !== 'combat' && currentScreen !== 'dungeonMap') {
      stuckCount++;
      if (stuckCount >= 8) {
        logStep('stuck_escape', { screen: currentScreen, attempts: stuckCount });
        // Force navigate to map
        await page.evaluate(() => {
          try { window.__rrPlay.navigate?.('dungeonMap'); } catch(e) {}
        });
        await page.waitForTimeout(2000);
        stuckCount = 0;
      }
    } else {
      stuckCount = 0;
    }
    lastScreen = currentScreen;

    if (currentScreen === 'dungeonMap') {
      await handleMap(page);
    } else if (currentScreen === 'combat' || currentScreen === 'masteryChallenge') {
      combatCount++;
      await handleCombat(page, combatCount);
    } else if (currentScreen === 'rewardRoom') {
      await handleReward(page);
    } else if (currentScreen === 'shopRoom') {
      await handleShop(page);
    } else if (currentScreen === 'restRoom' || currentScreen === 'campfire' || currentScreen === 'postMiniBossRest') {
      await handleRest(page);
    } else if (currentScreen === 'specialEvent' || currentScreen === 'mysteryEvent') {
      await handleMystery(page);
    } else if (currentScreen === 'retreatOrDelve') {
      await handleCheckpoint(page);
    } else if (currentScreen === 'cardReward') {
      await handleCardReward(page);
    } else if (currentScreen === 'upgradeSelection') {
      await handleUpgradeSelection(page);
    } else if (currentScreen === 'restStudy' || currentScreen === 'restMeditate') {
      // Sub-screens of rest — wait for them to finish
      logStep('rest_sub', { screen: currentScreen });
      await page.waitForTimeout(3000);
    } else if (currentScreen === 'runPreview') {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const txt = b.textContent?.toLowerCase() || '';
          if (txt.includes('embark') || txt.includes('start') || txt.includes('begin')) { b.click(); return; }
        }
      });
      await page.waitForTimeout(3000);
    } else if (currentScreen === 'relicSwapOverlay' || currentScreen === 'relicSanctum') {
      // Accept or skip relic
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const txt = b.textContent?.toLowerCase() || '';
          if (txt.includes('take') || txt.includes('accept') || txt.includes('skip') || txt.includes('close')) { b.click(); return; }
        }
      });
      await page.waitForTimeout(2000);
    } else if (currentScreen === 'onboarding' || currentScreen === 'narrative' || currentScreen === 'intro') {
      logStep('onboarding_skip', { screen: currentScreen });
      // Try the specific .enter-btn first, then generic buttons
      await page.evaluate(() => {
        // Direct selector for DungeonEntrance enter button
        const enterBtn = document.querySelector('.enter-btn');
        if (enterBtn) { enterBtn.click(); return 'clicked .enter-btn'; }

        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const txt = b.textContent?.toLowerCase() || '';
          if (txt.includes('skip') || txt.includes('next') || txt.includes('continue') || txt.includes('start') || txt.includes('go') || txt.includes('begin') || txt.includes('enter') || txt.includes('depths') || txt.includes('proceed')) {
            b.click(); return 'clicked: ' + txt;
          }
        }
        document.body.click();
        return 'body click';
      });
      await page.waitForTimeout(3000);
    } else if (currentScreen === 'archetypeSelection' || currentScreen === 'archetype') {
      logStep('archetype', { screen: currentScreen });
      // Auto-select balanced archetype
      try {
        await page.evaluate(() => window.__rrPlay.selectArchetype('balanced'));
      } catch (e) {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent?.toLowerCase().includes('balanced') || b.textContent?.toLowerCase().includes('confirm') || b.textContent?.toLowerCase().includes('start')) {
              b.click(); return;
            }
          }
          btns[0]?.click();
        });
      }
      await page.waitForTimeout(2000);
    } else if (currentScreen === 'deckSelection' || currentScreen === 'triviaDungeon') {
      logStep('deck_selection', { screen: currentScreen });
      // Click Start Run in the trivia dungeon screen
      await page.evaluate(() => {
        const btn = document.querySelector('.footer-start-btn');
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
    } else if (currentScreen === 'runPreview' || currentScreen === 'run_preview') {
      logStep('run_preview', { screen: currentScreen });
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const txt = b.textContent?.toLowerCase() || '';
          if (txt.includes('embark') || txt.includes('start') || txt.includes('begin') || txt.includes('go')) {
            b.click(); return;
          }
        }
      });
      await page.waitForTimeout(3000);
    } else {
      logStep('unknown_screen', { screen: currentScreen });
      // Try clicking common advance buttons
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const txt = b.textContent?.toLowerCase() || '';
          if (txt.includes('continue') || txt.includes('next') || txt.includes('ok') || txt.includes('confirm')) {
            b.click(); return;
          }
        }
        document.body.click();
      });
      await page.waitForTimeout(2000);
    }
  }

  // Final state
  const finalState = await page.evaluate(() => ({
    screen: window.__rrPlay.getScreen(),
    runState: window.__rrPlay.getRunState?.(),
    stats: window.__rrPlay.getStats?.(),
  }));
  logStep('final', finalState);

  // Write report
  const report = {
    totalSteps: turnCount,
    totalCombats: combatCount,
    log,
    summary: generateSummary(log),
  };

  const reportPath = `${OUTPUT_DIR}/playthrough-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${reportPath}`);
  console.log('\n=== DIFFICULTY ANALYSIS ===');
  console.log(JSON.stringify(report.summary, null, 2));

  await browser.close();
}

// ─── HANDLERS ──────────────────────────────────

async function handleMap(page) {
  // Get available map nodes — filter for ones labeled "available"
  const mapInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll('[data-testid^="map-node"]');
    const nodes = Array.from(btns).map(b => ({
      id: b.getAttribute('data-testid'),
      label: b.getAttribute('aria-label') || b.textContent?.trim() || '',
      classes: b.closest('.node-position')?.className || '',
    }));
    const available = nodes.filter(n => n.label.includes('available'));
    const runState = window.__rrPlay?.getRunState?.();
    return { total: nodes.length, available, runState };
  });

  logStep('map', { nodeCount: mapInfo.total, availableCount: mapInfo.available.length, floor: mapInfo.runState?.floor });

  if (mapInfo.available.length > 0) {
    // Pick first available node
    const target = mapInfo.available[0];
    await page.evaluate((nodeId) => {
      const btn = document.querySelector(`[data-testid="${nodeId}"]`);
      if (btn) btn.click();
    }, target.id);
    await page.waitForTimeout(3000);
    logStep('map_select', { selected: target.id, label: target.label });
  } else {
    // No available nodes — try using __rrPlay.selectMapNode or check if we need to advance
    logStep('map_stuck', { nodes: mapInfo.available });
    // Wait and retry once
    await page.waitForTimeout(3000);
  }
}

async function handleCombat(page, combatNum) {
  const startState = await page.evaluate(() => window.__rrPlay.getCombatState());
  logStep(`combat_${combatNum}_start`, {
    playerHp: startState?.playerHp,
    playerMaxHp: startState?.playerMaxHp,
    enemyHp: startState?.enemyHp,
    enemyMaxHp: startState?.enemyMaxHp,
    enemyName: startState?.enemyName,
    enemyIntent: startState?.enemyIntent,
    handSize: startState?.hand?.length,
    hand: startState?.hand?.map(c => c.mechanicId || c.name || 'unknown'),
    ap: startState?.ap,
    apMax: startState?.apMax,
  });

  let turn = 0;
  const maxCombatTurns = 30;
  let hpHistory = [startState?.playerHp];
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;

  while (turn < maxCombatTurns) {
    turn++;
    const state = await page.evaluate(() => window.__rrPlay.getCombatState());

    if (!state || state.combatOver || state.playerHp <= 0 || state.enemyHp <= 0) {
      logStep(`combat_${combatNum}_end`, {
        turn,
        result: state?.playerHp <= 0 ? 'defeat' : 'victory',
        playerHp: state?.playerHp,
        enemyHp: state?.enemyHp,
      });
      break;
    }

    hpHistory.push(state.playerHp);

    // STRATEGY: Play cards intelligently
    const hand = state.hand || [];
    const ap = state.ap || 0;
    const enemyIntent = state.enemyIntent;

    let cardsPlayed = 0;

    logStep(`combat_${combatNum}_hand_t${turn}`, {
      handSize: hand.length,
      ap,
      cards: hand.map(c => ({ id: c.mechanicId || c.id, type: c.type, apCost: c.apCost })),
      enemyIntent: enemyIntent?.type,
    });

    // STRATEGY: Use chargePlayCard for attacks (1.75x damage with correct answer, costs 2 AP)
    // and quickPlayCard for shields (1 AP). Charge costs 2 AP (base + surcharge).
    // With 3 AP: charge 1 attack (2 AP) + quick 1 shield (1 AP), or quick 3 cards.
    let apLeft = ap;

    for (let attempts = 0; attempts < 10 && apLeft > 0; attempts++) {
      // Get current hand state (indices shift after each play)
      const currentHand = await page.evaluate(() => {
        const s = window.__rrPlay.getCombatState();
        return s?.hand?.map((c, i) => ({ idx: i, type: c.type || c.cardType, mechanicId: c.mechanicId, apCost: c.apCost ?? 1 })) || [];
      });

      if (currentHand.length === 0) break;

      // Find best card to play
      const attacks = currentHand.filter(c => c.type === 'attack');
      const shields = currentHand.filter(c => c.type === 'shield');

      let playResult;

      // Try charge-playing an attack if we have 2+ AP (1 base + 1 surcharge)
      if (attacks.length > 0 && apLeft >= 2) {
        playResult = await page.evaluate(async (idx) => {
          try {
            const r = await window.__rrPlay.chargePlayCard(idx, true);
            return r;
          } catch (e) {
            return { ok: false, message: e.message };
          }
        }, attacks[0].idx);

        if (playResult?.ok) {
          apLeft -= 2;
          cardsPlayed++;
          correctAnswers++;
          logStep(`combat_${combatNum}_charge`, { card: attacks[0].mechanicId, result: playResult.message?.substring(0, 80) });
          await page.waitForTimeout(800);
        } else {
          logStep(`combat_${combatNum}_charge_fail`, { error: playResult?.message, card: attacks[0].mechanicId, apLeft });
          // Fallback to quick play
          playResult = await page.evaluate(async (idx) => {
            try { return await window.__rrPlay.quickPlayCard(idx); }
            catch (e) { return { ok: false, message: e.message }; }
          }, attacks[0].idx);
          if (playResult?.ok) { apLeft -= 1; cardsPlayed++; }
          else { logStep(`combat_${combatNum}_qp_fail`, { error: playResult?.message }); break; }
          await page.waitForTimeout(500);
        }
      }
      // Quick play a shield if enemy is attacking
      else if (shields.length > 0 && apLeft >= 1 && (enemyIntent?.type === 'attack' || enemyIntent?.type === 'multi_attack')) {
        playResult = await page.evaluate(async (idx) => {
          try { return await window.__rrPlay.quickPlayCard(idx); }
          catch (e) { return { ok: false, message: e.message }; }
        }, shields[0].idx);
        if (playResult?.ok) { apLeft -= 1; cardsPlayed++; }
        else break;
        await page.waitForTimeout(500);
      }
      // Quick play any available card
      else if (currentHand.length > 0 && apLeft >= 1) {
        playResult = await page.evaluate(async (idx) => {
          try { return await window.__rrPlay.quickPlayCard(idx); }
          catch (e) { return { ok: false, message: e.message }; }
        }, currentHand[0].idx);
        if (playResult?.ok) { apLeft -= currentHand[0].apCost; cardsPlayed++; }
        else { logStep(`combat_${combatNum}_play_fail`, { error: playResult?.message }); break; }
        await page.waitForTimeout(500);
      }
      else break;

      // Check if combat ended mid-turn
      const midState = await page.evaluate(() => window.__rrPlay.getCombatState());
      if (!midState || midState.combatOver || midState.enemyHp <= 0) break;
    }

    // End turn
    const preEndState = await page.evaluate(() => window.__rrPlay.getCombatState());
    if (preEndState && !preEndState.combatOver && preEndState.enemyHp > 0) {
      await page.evaluate(() => window.__rrPlay.endTurn());
      await page.waitForTimeout(1500);
    }

    const postState = await page.evaluate(() => window.__rrPlay.getCombatState());
    if (postState) {
      const dmgTaken = (preEndState?.playerHp || 0) - (postState.playerHp || 0);
      if (dmgTaken > 0) totalDamageTaken += dmgTaken;

      logStep(`combat_${combatNum}_turn_${turn}`, {
        playerHp: postState.playerHp,
        enemyHp: postState.enemyHp,
        cardsPlayed,
        dmgTaken,
        enemyIntent: postState.enemyIntent,
      });
    }
  }

  logStep(`combat_${combatNum}_summary`, {
    turns: turn,
    hpHistory,
    totalDamageTaken,
    correctAnswers,
    wrongAnswers,
    startHp: startState?.playerHp,
    endHp: hpHistory[hpHistory.length - 1],
  });

  // Wait for post-combat transition to reward room
  await page.waitForTimeout(3000);
}

async function handleReward(page) {
  await page.waitForTimeout(1000);

  // Use __rrPlay.acceptReward() — handles Phaser scene interactions
  for (let i = 0; i < 5; i++) {
    const screen = await page.evaluate(() => window.__rrPlay.getScreen());
    if (screen !== 'rewardRoom') break;

    const result = await page.evaluate(async () => {
      try {
        return await window.__rrPlay.acceptReward();
      } catch (e) {
        return { ok: false, message: e.message };
      }
    });
    logStep('reward', { attempt: i, result: result?.message?.substring(0, 150) || 'no result' });
    await page.waitForTimeout(2000);
  }

  // If still on reward screen, wait longer for auto-advance
  const postScreen = await page.evaluate(() => window.__rrPlay.getScreen());
  if (postScreen === 'rewardRoom') {
    await page.waitForTimeout(5000);
  }
}

async function handleCardReward(page) {
  await page.waitForTimeout(1000);
  logStep('card_reward', { screen: 'cardReward' });

  // Skip card reward (don't bloat deck for testing)
  try {
    await page.evaluate(() => {
      const skipBtn = document.querySelector('[data-testid="skip-card-reward"], .skip-btn, button');
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const txt = b.textContent?.toLowerCase() || '';
        if (txt.includes('skip') || txt.includes('pass')) { b.click(); return; }
      }
      // If no skip, pick first card
      btns[0]?.click();
    });
  } catch (e) {}
  await page.waitForTimeout(2000);
}

async function handleShop(page) {
  const inventory = await page.evaluate(() => {
    try { return window.__rrPlay.getShopInventory?.(); }
    catch (e) { return { error: e.message }; }
  });
  const runState = await page.evaluate(() => window.__rrPlay.getRunState?.());
  logStep('shop', { gold: runState?.currency, inventory: JSON.stringify(inventory)?.substring(0, 200) });

  // Leave shop — we want to test base difficulty without purchases
  const leaveResult = await page.evaluate(async () => window.__rrPlay.shopLeave?.());
  logStep('shop_leave', { result: leaveResult });
  await page.waitForTimeout(3000);
}

async function handleUpgradeSelection(page) {
  logStep('upgrade_selection', { screen: 'upgradeSelection' });
  // Skip upgrade — pick first or skip
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const txt = b.textContent?.toLowerCase() || '';
      if (txt.includes('skip') || txt.includes('done') || txt.includes('confirm') || txt.includes('back')) {
        b.click(); return;
      }
    }
    // Click first card if presented
    const cards = document.querySelectorAll('[data-testid*="card"], .card-option');
    if (cards.length > 0) cards[0].click();
  });
  await page.waitForTimeout(2000);
}

async function handleRest(page) {
  const state = await page.evaluate(() => {
    const rs = window.__rrPlay.getRunState?.();
    return { hp: rs?.playerHp, maxHp: rs?.playerMaxHp, gold: rs?.currency };
  });
  logStep('rest', state);

  // Heal if below 80% HP, otherwise heal anyway (test attrition)
  const result = await page.evaluate(async () => {
    try {
      // Always try heal first — we want to test how much HP recovery matters
      let r = await window.__rrPlay.restHeal();
      if (r?.ok) return r;
      // Fallback: try upgrade
      r = await window.__rrPlay.restUpgrade?.();
      if (r?.ok) return r;
      // Fallback: try meditate
      r = await window.__rrPlay.restMeditate?.();
      if (r?.ok) return r;
      // Fallback: click any button
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const txt = b.textContent?.toLowerCase() || '';
        if (txt.includes('heal') || txt.includes('rest') || txt.includes('upgrade') ||
            txt.includes('meditate') || txt.includes('leave')) {
          b.click();
          return { ok: true, message: 'clicked: ' + txt };
        }
      }
      return { ok: false, message: 'no rest options found' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });
  logStep('rest_result', { result: result?.message?.substring(0, 100) });
  await page.waitForTimeout(3000);

  let screen = await page.evaluate(() => window.__rrPlay.getScreen());
  if (screen === 'restRoom' || screen === 'rest') {
    const continueResult = await page.evaluate(async () => window.__rrPlay.restContinue?.());
    logStep('rest_continue', { result: continueResult });
    await page.waitForTimeout(1500);
  }

  // Wait for screen to change back to map
  for (let i = 0; i < 5; i++) {
    screen = await page.evaluate(() => window.__rrPlay.getScreen());
    if (screen === 'dungeonMap') break;
    await page.waitForTimeout(2000);
  }
}

async function handleMystery(page) {
  const before = await page.evaluate(() => window.__rrPlay.getScreen());
  const choices = await page.evaluate(() => window.__rrPlay.getMysteryEventChoices?.() ?? []);
  logStep('mystery', { screen: before, choices });

  const result = await page.evaluate(async () => {
    const api = window.__rrPlay;
    const choices = api.getMysteryEventChoices?.() ?? [];
    if (choices.length > 0) {
      return await api.selectMysteryChoice(0);
    }
    return await api.mysteryContinue();
  });
  logStep('mystery_result', { result });

  await page.waitForTimeout(1500);
  const afterChoice = await page.evaluate(() => window.__rrPlay.getScreen());
  if (afterChoice === 'mysteryEvent' || afterChoice === 'cardUpgradeReveal') {
    const continueResult = await page.evaluate(() => window.__rrPlay.mysteryContinue());
    logStep('mystery_continue', { result: continueResult });
  }

  await page.waitForTimeout(3000);
}

async function handleCheckpoint(page) {
  const runState = await page.evaluate(() => window.__rrPlay.getRunState());
  logStep('checkpoint', { floor: runState?.floor, hp: runState?.playerHp });

  // Always delve deeper for difficulty testing
  try {
    await page.evaluate(() => window.__rrPlay.delve());
  } catch (e) {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.toLowerCase().includes('delve') || b.textContent?.toLowerCase().includes('deeper')) {
          b.click(); return;
        }
      }
    });
  }
  await page.waitForTimeout(3000);
}

// ─── ANALYSIS ──────────────────────────────────

function generateSummary(log) {
  const combatStarts = log.filter(e => e.step.match(/^combat_\d+_start$/));
  const combatSummaries = log.filter(e => e.step.match(/^combat_\d+_summary$/));
  const combatEnds = log.filter(e => e.step.match(/^combat_\d+_end$/));

  const totalCombats = combatStarts.length;
  const victories = combatEnds.filter(e => e.result === 'victory').length;
  const defeats = combatEnds.filter(e => e.result === 'defeat').length;

  const avgTurns = combatSummaries.length > 0
    ? combatSummaries.reduce((s, c) => s + c.turns, 0) / combatSummaries.length
    : 0;

  const avgDmgTaken = combatSummaries.length > 0
    ? combatSummaries.reduce((s, c) => s + c.totalDamageTaken, 0) / combatSummaries.length
    : 0;

  const hpAfterCombats = combatSummaries.map(c => ({
    combat: c.step,
    startHp: c.startHp,
    endHp: c.endHp,
    hpLost: (c.startHp || 0) - (c.endHp || 0),
  }));

  const enemies = combatStarts.map(c => ({
    name: c.enemyName,
    hp: c.enemyHp,
    maxHp: c.enemyMaxHp,
  }));

  return {
    totalCombats,
    victories,
    defeats,
    avgTurnsPerCombat: Math.round(avgTurns * 10) / 10,
    avgDamageTakenPerCombat: Math.round(avgDmgTaken),
    hpAfterCombats,
    enemies,
    difficultyAssessment: avgDmgTaken < 5 ? 'TOO EASY'
      : avgDmgTaken < 15 ? 'EASY'
      : avgDmgTaken < 30 ? 'MODERATE'
      : avgDmgTaken < 50 ? 'HARD'
      : 'VERY HARD',
    correctAnswerRate: '100% (always answered correctly for max damage test)',
  };
}

main().catch(err => {
  console.error('Playthrough failed:', err);
  // Save partial report
  const reportPath = `${OUTPUT_DIR}/playthrough-partial-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ error: err.message, log }, null, 2));
  console.log(`Partial report: ${reportPath}`);
  process.exit(1);
});
