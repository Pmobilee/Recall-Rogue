/**
 * Quiz Quality Tester v2 — BATCH-2026-04-02-004
 * Handles onboarding flow properly.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT_DIR = '/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-04-02-004';
const URL = 'http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evaluate(page, fn, ...args) {
  try {
    return await page.evaluate(fn, ...args);
  } catch (e) {
    console.error('evaluate error:', e.message);
    return null;
  }
}

async function waitForScreen(page, targetScreens, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('  current screen:', screen);
    if (targetScreens.includes(screen)) return screen;
    await sleep(800);
  }
  const screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('  waitForScreen timed out, current screen:', screen);
  return screen;
}

async function inspectOnboarding(page) {
  // Inspect what's on screen
  const info = await evaluate(page, () => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim(),
      className: b.className,
      id: b.id
    }));
    const rrPlay = window.__rrPlay;
    const methods = Object.keys(rrPlay || {}).filter(k => typeof rrPlay[k] === 'function');
    return { buttons, methods };
  });
  console.log('Available __rrPlay methods:', info?.methods);
  console.log('Buttons on screen:', JSON.stringify(info?.buttons?.slice(0, 10)));
  return info;
}

async function skipOnboarding(page) {
  console.log('Inspecting onboarding screen...');
  const info = await inspectOnboarding(page);

  // Try clicking any enter/continue/start button
  const clickResult = await evaluate(page, () => {
    const selectors = [
      'button.enter-btn',
      'button.continue-btn',
      'button.start-btn',
      'button.skip-btn',
      '.onboarding-continue',
      '.onboarding button',
      'button[data-action="continue"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return `clicked: ${sel}`; }
    }
    // Try first button
    const firstBtn = document.querySelector('button');
    if (firstBtn) { firstBtn.click(); return `clicked first button: ${firstBtn.textContent?.trim()}`; }
    return 'no button found';
  });
  console.log('Click result:', clickResult);
  await sleep(1500);

  // Try __rrPlay methods
  const skipResult = await evaluate(page, () => {
    const p = window.__rrPlay;
    if (p?.skipOnboarding) return p.skipOnboarding();
    if (p?.continueOnboarding) return p.continueOnboarding();
    if (p?.dismissOnboarding) return p.dismissOnboarding();
    if (p?.onboardingContinue) return p.onboardingContinue();
    if (p?.advanceScreen) return p.advanceScreen();
    return 'no skip method found';
  });
  console.log('Skip method result:', skipResult);
  await sleep(1500);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[browser error]', msg.text().substring(0, 100));
  });

  console.log('Navigating to game...');
  await page.goto(URL);
  await sleep(4000);

  // Mute audio
  await evaluate(page, () => {
    const s1 = Symbol.for('rr:sfxEnabled');
    const s2 = Symbol.for('rr:musicEnabled');
    if (globalThis[s1]?.set) globalThis[s1].set(false);
    if (globalThis[s2]?.set) globalThis[s2].set(false);
  });

  let screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Initial screen:', screen);

  // List all __rrPlay methods upfront
  const methods = await evaluate(page, () => {
    const p = window.__rrPlay;
    return p ? Object.keys(p).filter(k => typeof p[k] === 'function') : [];
  });
  console.log('All __rrPlay methods:', methods);

  // Start run
  console.log('\n--- Starting run ---');
  let r = await evaluate(page, () => window.__rrPlay.startRun());
  console.log('startRun:', JSON.stringify(r));
  await sleep(1500);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen:', screen);

  r = await evaluate(page, () => window.__rrPlay.selectDomain('general_knowledge'));
  console.log('selectDomain:', JSON.stringify(r));
  await sleep(1000);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after domain:', screen);

  r = await evaluate(page, () => window.__rrPlay.selectArchetype('balanced'));
  console.log('selectArchetype:', JSON.stringify(r));
  await sleep(2000);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after archetype:', screen);

  // Handle onboarding — try all possible approaches
  let onboardingAttempts = 0;
  while (screen === 'onboarding' && onboardingAttempts < 5) {
    onboardingAttempts++;
    console.log(`\nHandling onboarding (attempt ${onboardingAttempts})...`);
    await skipOnboarding(page);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after onboarding attempt:', screen);

    if (screen === 'onboarding') {
      // Try devpreset approach - navigate with skipOnboarding param
      if (onboardingAttempts === 2) {
        console.log('Trying to force-navigate...');
        await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial&skipAllTutorials=true');
        await sleep(3000);
        screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
        console.log('Screen after reload:', screen);
        if (screen !== 'onboarding') break;

        // Re-run through setup
        await evaluate(page, () => {
          const s1 = Symbol.for('rr:sfxEnabled');
          const s2 = Symbol.for('rr:musicEnabled');
          if (globalThis[s1]?.set) globalThis[s1].set(false);
          if (globalThis[s2]?.set) globalThis[s2].set(false);
        });
        r = await evaluate(page, () => window.__rrPlay.startRun());
        console.log('startRun:', JSON.stringify(r));
        await sleep(1000);
        r = await evaluate(page, () => window.__rrPlay.selectDomain('general_knowledge'));
        console.log('selectDomain:', JSON.stringify(r));
        await sleep(1000);
        r = await evaluate(page, () => window.__rrPlay.selectArchetype('balanced'));
        console.log('selectArchetype:', JSON.stringify(r));
        await sleep(1500);
        screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
        console.log('Screen after re-setup:', screen);
      }

      if (onboardingAttempts === 3) {
        // Try store manipulation or internal state access
        const stateHack = await evaluate(page, () => {
          // Try to find any svelte store or game state that controls onboarding
          const keys = Object.keys(window).filter(k =>
            k.includes('onboard') || k.includes('tutorial') || k.includes('Store')
          );
          return keys;
        });
        console.log('Onboarding-related window keys:', stateHack);

        // Try keyboard shortcuts
        await page.keyboard.press('Escape');
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(1000);
        screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
        console.log('Screen after keyboard:', screen);
      }
    }
  }

  if (screen === 'onboarding') {
    console.log('Still on onboarding, trying to find map and force-navigate...');

    // Try selectMapNode directly
    r = await evaluate(page, () => window.__rrPlay.selectMapNode('r0-n0'));
    console.log('Force selectMapNode:', JSON.stringify(r));
    await sleep(1500);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen:', screen);
  }

  // If still not in combat/map, try devpreset=combat
  if (screen !== 'combat' && screen !== 'dungeonMap') {
    console.log(`\nNot in combat/map (screen: ${screen}), trying devpreset=combat...`);
    await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=combat');
    await sleep(4000);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after combat preset:', screen);

    await evaluate(page, () => {
      const s1 = Symbol.for('rr:sfxEnabled');
      const s2 = Symbol.for('rr:musicEnabled');
      if (globalThis[s1]?.set) globalThis[s1].set(false);
      if (globalThis[s2]?.set) globalThis[s2].set(false);
    });
  }

  const allQuizData = [];
  const encounterLog = [];
  let encounterCount = 0;

  while (encounterCount < 3) {
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log(`\n=== Encounter ${encounterCount + 1} start, screen: ${screen} ===`);

    if (screen !== 'combat') {
      screen = await waitForScreen(page, ['combat'], 8000);
      if (screen !== 'combat') {
        console.log('Cannot reach combat, current screen:', screen);
        break;
      }
    }

    const encounterData = { encounter: encounterCount + 1, quizzes: [], turns: 0 };
    let turnCount = 0;
    let combatDone = false;

    while (!combatDone && turnCount < 25) {
      turnCount++;
      console.log(`\n-- Turn ${turnCount} --`);

      const combatState = await evaluate(page, () => window.__rrPlay.getCombatState());
      if (!combatState) { console.log('No combat state'); break; }

      console.log(`  AP: ${combatState.ap}, Hand: ${combatState.hand?.length || 0}, Enemy HP: ${combatState.enemy?.hp}/${combatState.enemy?.maxHp}`);

      if (combatState.enemy?.hp <= 0) {
        console.log('Enemy dead!');
        combatDone = true;
        break;
      }

      const hand = combatState.hand || [];

      if (hand.length === 0 || combatState.ap <= 0) {
        console.log('  Ending turn (no hand or no AP)');
        await evaluate(page, () => window.__rrPlay.endTurn());
        await sleep(1500);
        continue;
      }

      // Preview the first available card
      const quizPreview = await evaluate(page, () => window.__rrPlay.previewCardQuiz(0));

      if (quizPreview && quizPreview.question) {
        console.log(`  Quiz Q: "${quizPreview.question.substring(0, 100)}"`);
        console.log(`  Choices: ${quizPreview.choices?.length}, correctIndex: ${quizPreview.correctIndex}`);

        const quizEntry = {
          encounterId: encounterCount + 1,
          turn: turnCount,
          question: quizPreview.question,
          choices: quizPreview.choices || [],
          correctIndex: quizPreview.correctIndex ?? -1,
          correctAnswer: quizPreview.choices?.[quizPreview.correctIndex] ?? quizPreview.correctAnswer ?? '',
          domain: quizPreview.domain || combatState.hand?.[0]?.domain || 'unknown',
          source: quizPreview.source || quizPreview.deckId || 'unknown',
          anomalies: []
        };
        allQuizData.push(quizEntry);
        encounterData.quizzes.push(quizEntry);
      } else {
        console.log('  No quiz preview for card 0:', JSON.stringify(quizPreview));
      }

      // Play card 0 with correct answer
      const playResult = await evaluate(page, () => window.__rrPlay.chargePlayCard(0, true));
      console.log(`  chargePlayCard result: ${JSON.stringify(playResult)}`);
      await sleep(1200);

      // Check state
      const afterState = await evaluate(page, () => window.__rrPlay.getCombatState());
      const currentScreen = await evaluate(page, () => window.__rrPlay?.getScreen?.());

      if (currentScreen !== 'combat' || !afterState) {
        console.log(`Screen changed to: ${currentScreen}`);
        combatDone = true;
      } else if (afterState.enemy?.hp <= 0) {
        console.log('Enemy dead after play!');
        combatDone = true;
      }
    }

    encounterData.turns = turnCount;
    encounterLog.push(encounterData);
    encounterCount++;
    console.log(`\nEncounter ${encounterCount} complete. Quizzes captured: ${encounterData.quizzes.length}`);

    if (encounterCount >= 3) break;

    // Handle post-combat
    await sleep(2500);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Post-combat screen:', screen);

    let routingAttempts = 0;
    while (screen !== 'combat' && screen !== 'runEnd' && routingAttempts < 10) {
      routingAttempts++;

      if (screen === 'rewardRoom') {
        console.log('Accepting reward...');
        r = await evaluate(page, () => window.__rrPlay.acceptReward());
        console.log('acceptReward:', JSON.stringify(r));
        await sleep(3000);
      } else if (screen === 'dungeonMap') {
        const nodeIds = ['r0-n1', 'r1-n0', 'r0-n0', 'r1-n1', 'r2-n0'];
        let navigated = false;
        for (const nodeId of nodeIds) {
          r = await evaluate(page, (id) => window.__rrPlay.selectMapNode(id), nodeId);
          console.log(`selectMapNode(${nodeId}):`, JSON.stringify(r));
          if (r && r.ok !== false && !r?.message?.includes('not found')) {
            navigated = true;
            await sleep(2000);
            break;
          }
        }
        if (!navigated) {
          console.log('Could not navigate, checking available nodes...');
          const mapInfo = await evaluate(page, () => window.__rrPlay?.getMapState?.() || window.__rrPlay?.getRunState?.());
          console.log('Map/run state:', JSON.stringify(mapInfo)?.substring(0, 300));
          break;
        }
      } else if (screen === 'specialEvent' || screen === 'mysteryEvent') {
        await evaluate(page, () => window.__rrPlay.mysteryContinue?.());
        await sleep(2000);
      } else {
        console.log(`Screen: ${screen}, waiting...`);
        await sleep(2000);
      }

      screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
      console.log('Screen after routing:', screen);
    }
  }

  console.log('\n=== COLLECTION COMPLETE ===');
  console.log(`Total quizzes captured: ${allQuizData.length}`);
  console.log('Encounters completed:', encounterCount);

  // Save raw data
  const output = {
    meta: {
      date: new Date().toISOString(),
      encountersCompleted: encounterCount,
      totalQuizzes: allQuizData.length
    },
    allQuizData,
    encounterLog
  };
  fs.writeFileSync(`${OUT_DIR}/quiz-data-raw.json`, JSON.stringify(output, null, 2));
  console.log(`Raw data saved. Quizzes: ${allQuizData.length}`);

  await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
