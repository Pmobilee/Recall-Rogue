/**
 * Quiz Quality Tester — BATCH-2026-04-02-004
 * Drives 3 combat encounters via window.__rrPlay API and captures all quiz content.
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

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[browser error]', msg.text());
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
  console.log('Audio muted');

  // Check initial screen
  let screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Initial screen:', screen);

  // Check if __rrPlay is available
  const apiAvailable = await evaluate(page, () => typeof window.__rrPlay !== 'undefined');
  console.log('__rrPlay available:', apiAvailable);

  if (!apiAvailable) {
    console.error('__rrPlay API not available! Checking window keys...');
    const keys = await evaluate(page, () => Object.keys(window).filter(k => k.startsWith('__rr')));
    console.log('__rr keys:', keys);
    await browser.close();
    return;
  }

  // Handle onboarding if present
  if (screen === 'onboarding' || screen === 'tutorial') {
    console.log('Handling onboarding...');
    await evaluate(page, () => {
      const btn = document.querySelector('button.enter-btn');
      if (btn) btn.click();
    });
    await sleep(2000);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after onboarding skip:', screen);
  }

  // Start run
  console.log('Starting run...');
  const startResult = await evaluate(page, () => window.__rrPlay.startRun());
  console.log('startRun result:', JSON.stringify(startResult));
  await sleep(1500);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after startRun:', screen);

  // Select domain
  console.log('Selecting domain...');
  const domainResult = await evaluate(page, () => window.__rrPlay.selectDomain('general_knowledge'));
  console.log('selectDomain result:', JSON.stringify(domainResult));
  await sleep(1000);

  // Select archetype
  console.log('Selecting archetype...');
  const archResult = await evaluate(page, () => window.__rrPlay.selectArchetype('balanced'));
  console.log('selectArchetype result:', JSON.stringify(archResult));
  await sleep(1500);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after archetype:', screen);

  // Navigate to first combat
  console.log('Selecting map node...');
  const mapResult = await evaluate(page, () => window.__rrPlay.selectMapNode('r0-n0'));
  console.log('selectMapNode result:', JSON.stringify(mapResult));
  await sleep(2000);

  screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after map select:', screen);

  const allQuizData = [];
  const encounterLog = [];
  let encounterCount = 0;

  // Run 3 combat encounters
  while (encounterCount < 3) {
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log(`\n=== Encounter ${encounterCount + 1} start, screen: ${screen} ===`);

    if (screen !== 'combat') {
      console.log('Not in combat, waiting...');
      screen = await waitForScreen(page, ['combat'], 10000);
      if (screen !== 'combat') {
        console.log('Failed to reach combat, screen is:', screen);
        break;
      }
    }

    const encounterData = { encounter: encounterCount + 1, quizzes: [], turns: 0 };

    // Combat loop
    let turnCount = 0;
    let combatDone = false;

    while (!combatDone && turnCount < 20) {
      turnCount++;
      console.log(`\n-- Turn ${turnCount} --`);

      const combatState = await evaluate(page, () => window.__rrPlay.getCombatState());
      if (!combatState) {
        console.log('No combat state, breaking');
        break;
      }

      console.log(`  AP: ${combatState.ap}, Cards in hand: ${combatState.hand?.length || 0}`);
      console.log(`  Enemy HP: ${combatState.enemy?.hp}/${combatState.enemy?.maxHp}`);

      if (combatState.enemy?.hp <= 0) {
        console.log('Enemy dead!');
        combatDone = true;
        break;
      }

      const hand = combatState.hand || [];
      if (hand.length === 0) {
        console.log('No cards in hand, ending turn');
        await evaluate(page, () => window.__rrPlay.endTurn());
        await sleep(1500);
        continue;
      }

      let playedThisTurn = false;

      // Try to play cards
      for (let i = 0; i < hand.length && combatState.ap > 0; i++) {
        // Get fresh state
        const freshState = await evaluate(page, () => window.__rrPlay.getCombatState());
        if (!freshState || freshState.ap <= 0) break;
        if (freshState.enemy?.hp <= 0) { combatDone = true; break; }

        const handSize = freshState.hand?.length || 0;
        if (i >= handSize) break;

        // Preview the quiz for this card
        console.log(`  Previewing card ${i}...`);
        const quizPreview = await evaluate(page, (idx) => window.__rrPlay.previewCardQuiz(idx), i);

        if (quizPreview && quizPreview.question) {
          console.log(`  Quiz: "${quizPreview.question.substring(0, 80)}..."`);
          console.log(`  Choices: ${quizPreview.choices?.length || 0}, correctIndex: ${quizPreview.correctIndex}`);

          const quizEntry = {
            encounterId: encounterCount + 1,
            turn: turnCount,
            cardIndex: i,
            question: quizPreview.question,
            choices: quizPreview.choices || [],
            correctIndex: quizPreview.correctIndex,
            correctAnswer: quizPreview.choices?.[quizPreview.correctIndex] || quizPreview.correctAnswer,
            domain: quizPreview.domain || 'unknown',
            source: quizPreview.source || 'unknown',
            anomalies: []
          };

          allQuizData.push(quizEntry);
          encounterData.quizzes.push(quizEntry);
        }

        // Play the card (charge correctly)
        console.log(`  Playing card ${i} with charge...`);
        const playResult = await evaluate(page, (idx) => window.__rrPlay.chargePlayCard(idx, true), i);
        console.log(`  Play result: ${JSON.stringify(playResult)}`);
        playedThisTurn = true;
        await sleep(1200);

        // Check if enemy died
        const stateAfterPlay = await evaluate(page, () => window.__rrPlay.getCombatState());
        if (!stateAfterPlay || stateAfterPlay.enemy?.hp <= 0) {
          console.log('Enemy dead after card play!');
          combatDone = true;
          break;
        }

        // Update i to account for hand changes (cards were played)
        break; // Play one card per iteration to refresh state
      }

      if (!playedThisTurn && !combatDone) {
        // End turn if we couldn't play anything
        console.log('  Ending turn (no AP or no valid plays)');
        await evaluate(page, () => window.__rrPlay.endTurn());
        await sleep(1500);
      }

      // Check screen
      const currentScreen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
      if (currentScreen !== 'combat') {
        console.log(`Screen changed to: ${currentScreen}`);
        combatDone = true;
      }
    }

    encounterData.turns = turnCount;
    encounterLog.push(encounterData);
    encounterCount++;
    console.log(`\nEncounter ${encounterCount} complete. Quizzes captured: ${encounterData.quizzes.length}`);

    if (encounterCount >= 3) break;

    // Handle post-combat
    await sleep(2000);
    screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
    console.log('Post-combat screen:', screen);

    // Route post-combat screen
    let attempts = 0;
    while (screen !== 'combat' && screen !== 'runEnd' && attempts < 10) {
      attempts++;
      if (screen === 'rewardRoom') {
        console.log('Accepting reward...');
        await evaluate(page, () => window.__rrPlay.acceptReward());
        await sleep(3000);
      } else if (screen === 'dungeonMap') {
        console.log('Selecting next map node...');
        // Try sequential node IDs
        const nodeAttempts = ['r0-n1', 'r0-n0', 'r1-n0', 'r1-n1'];
        let navigated = false;
        for (const nodeId of nodeAttempts) {
          const navResult = await evaluate(page, (id) => window.__rrPlay.selectMapNode(id), nodeId);
          console.log(`  selectMapNode(${nodeId}):`, JSON.stringify(navResult));
          if (navResult && !navResult.error) {
            navigated = true;
            await sleep(2000);
            break;
          }
        }
        if (!navigated) {
          console.log('Could not navigate to next node');
          break;
        }
      } else if (screen === 'specialEvent' || screen === 'mysteryEvent') {
        console.log('Continuing mystery event...');
        await evaluate(page, () => window.__rrPlay.mysteryContinue());
        await sleep(2000);
      } else if (screen === 'runEnd') {
        console.log('Run ended!');
        break;
      } else {
        console.log(`Unknown screen: ${screen}, waiting...`);
        await sleep(2000);
      }
      screen = await evaluate(page, () => window.__rrPlay?.getScreen?.());
      console.log('Screen after routing:', screen);
    }
  }

  // Take a screenshot for reference
  const screenshot = await evaluate(page, async () => {
    if (window.__rrScreenshotFile) return await window.__rrScreenshotFile();
    return null;
  });

  console.log('\n=== COLLECTION COMPLETE ===');
  console.log(`Total quizzes captured: ${allQuizData.length}`);

  // Save raw data
  fs.writeFileSync(`${OUT_DIR}/quiz-data-raw.json`, JSON.stringify({ allQuizData, encounterLog }, null, 2));
  console.log('Raw data saved to quiz-data-raw.json');

  await browser.close();
  // Chrome lock released via shell after script exits
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
