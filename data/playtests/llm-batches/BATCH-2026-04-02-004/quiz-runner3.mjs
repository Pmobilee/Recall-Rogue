/**
 * Quiz Quality Tester v3 — BATCH-2026-04-02-004
 * Fixed map navigation and full quiz capture.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT_DIR = '/Users/damion/CODE/Recall_Rogue/data/playtests/llm-batches/BATCH-2026-04-02-004';
const URL = 'http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ev(page, fn, ...args) {
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
    const screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    if (targetScreens.includes(screen)) return screen;
    await sleep(600);
  }
  return await ev(page, () => window.__rrPlay?.getScreen?.());
}

async function navigateToNextCombat(page) {
  let screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  let attempts = 0;

  while (screen !== 'combat' && attempts < 15) {
    attempts++;
    console.log(`  Navigation attempt ${attempts}, screen: ${screen}`);

    if (screen === 'dungeonMap') {
      // Inspect available map nodes
      const runState = await ev(page, () => window.__rrPlay.getRunState());
      console.log('  RunState keys:', Object.keys(runState || {}));

      const mapNodes = await ev(page, () => {
        const rs = window.__rrPlay.getRunState();
        // Try to find map nodes in run state
        const nodes = rs?.map?.nodes || rs?.nodes || rs?.currentMap?.nodes || [];
        return Array.isArray(nodes) ? nodes.map(n => ({ id: n.id, type: n.type, available: n.available })) : [];
      });
      console.log('  Map nodes:', JSON.stringify(mapNodes));

      const look = await ev(page, () => window.__rrPlay.look());
      console.log('  look() result:', JSON.stringify(look)?.substring(0, 500));

      const availableScreens = await ev(page, () => window.__rrPlay.getAvailableScreens());
      console.log('  availableScreens:', JSON.stringify(availableScreens));

      // Try navigating via selectRoom
      const selectRoomResult = await ev(page, () => window.__rrPlay.selectRoom('combat'));
      console.log('  selectRoom(combat):', JSON.stringify(selectRoomResult));
      await sleep(1500);

      screen = await ev(page, () => window.__rrPlay?.getScreen?.());
      if (screen === 'combat') break;

      // Try common node IDs
      const nodeIds = ['r0-n0', 'r1-n0', 'r0-n1', 'r1-n1', 'r2-n0', 'floor1-node0', 'node0', 'node1'];
      for (const nodeId of nodeIds) {
        const r = await ev(page, (id) => window.__rrPlay.selectMapNode(id), nodeId);
        console.log(`  selectMapNode(${nodeId}):`, JSON.stringify(r));
        if (r?.ok !== false) {
          await sleep(1500);
          screen = await ev(page, () => window.__rrPlay?.getScreen?.());
          console.log(`  Screen after ${nodeId}:`, screen);
          if (screen === 'combat') return screen;
        }
      }

      // Try navigate() directly
      const navResult = await ev(page, () => window.__rrPlay.navigate('combat'));
      console.log('  navigate(combat):', JSON.stringify(navResult));
      await sleep(1500);

    } else if (screen === 'rewardRoom') {
      const r = await ev(page, () => window.__rrPlay.acceptReward());
      console.log('  acceptReward:', JSON.stringify(r));
      await sleep(3000);
    } else if (screen === 'onboarding') {
      await ev(page, () => {
        const btn = document.querySelector('button.enter-btn');
        if (btn) btn.click();
      });
      await sleep(1500);
    } else if (screen === 'specialEvent' || screen === 'mysteryEvent') {
      await ev(page, () => window.__rrPlay.mysteryContinue?.());
      await sleep(2000);
    } else {
      console.log(`  Unknown screen: ${screen}, waiting...`);
      await sleep(2000);
    }

    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  }

  return screen;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Navigating to game...');
  await page.goto(URL);
  await sleep(4000);

  // Mute audio
  await ev(page, () => {
    const s1 = Symbol.for('rr:sfxEnabled');
    const s2 = Symbol.for('rr:musicEnabled');
    if (globalThis[s1]?.set) globalThis[s1].set(false);
    if (globalThis[s2]?.set) globalThis[s2].set(false);
  });

  let screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log('Initial screen:', screen);

  // Start a new run
  console.log('\n--- Setting up run ---');
  await ev(page, () => window.__rrPlay.startRun());
  await sleep(1000);
  await ev(page, () => window.__rrPlay.selectDomain('general_knowledge'));
  await sleep(800);
  await ev(page, () => window.__rrPlay.selectArchetype('balanced'));
  await sleep(1500);

  screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen after setup:', screen);

  // Click past onboarding if needed
  if (screen === 'onboarding') {
    console.log('Clicking past onboarding...');
    await ev(page, () => {
      const btn = document.querySelector('button.enter-btn');
      if (btn) btn.click();
    });
    await sleep(1500);
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after onboarding click:', screen);
  }

  // Inspect the map state before trying to navigate
  if (screen === 'dungeonMap') {
    console.log('\nInspecting dungeon map state...');
    const runState = await ev(page, () => {
      const rs = window.__rrPlay.getRunState();
      return JSON.stringify(rs);
    });
    console.log('Full RunState:', runState?.substring(0, 1000));

    const look = await ev(page, () => {
      const l = window.__rrPlay.look();
      return JSON.stringify(l);
    });
    console.log('look():', look?.substring(0, 1000));
  }

  const allQuizData = [];
  const encounterLog = [];
  let encounterCount = 0;

  while (encounterCount < 3) {
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log(`\n=== Encounter ${encounterCount + 1}, screen: ${screen} ===`);

    if (screen !== 'combat') {
      screen = await navigateToNextCombat(page);
      if (screen !== 'combat') {
        console.log('Could not reach combat. Stopping. Final screen:', screen);
        break;
      }
    }

    const encounterData = { encounter: encounterCount + 1, quizzes: [], turns: 0 };
    let turnCount = 0;
    let combatDone = false;

    while (!combatDone && turnCount < 30) {
      turnCount++;

      const state = await ev(page, () => window.__rrPlay.getCombatState());
      if (!state) { console.log('  No combat state, stopping'); break; }

      console.log(`  Turn ${turnCount}: AP=${state.ap}, Hand=${state.hand?.length}, EnemyHP=${state.enemy?.hp}/${state.enemy?.maxHp}`);

      if (state.enemy?.hp <= 0) {
        console.log('  Enemy defeated!');
        combatDone = true;
        break;
      }

      if (!state.hand || state.hand.length === 0 || state.ap <= 0) {
        console.log('  Ending turn');
        await ev(page, () => window.__rrPlay.endTurn());
        await sleep(1200);
        continue;
      }

      // Preview card 0
      const quiz = await ev(page, () => window.__rrPlay.previewCardQuiz(0));
      if (quiz) {
        const entry = {
          encounterId: encounterCount + 1,
          turn: turnCount,
          question: quiz.question || '',
          choices: quiz.choices || [],
          correctIndex: quiz.correctIndex ?? -1,
          correctAnswer: quiz.choices?.[quiz.correctIndex] ?? quiz.correctAnswer ?? '',
          domain: quiz.domain || state.hand?.[0]?.domain || 'unknown',
          source: quiz.source || quiz.deckId || quiz.factId || 'unknown',
          cardType: state.hand?.[0]?.type || state.hand?.[0]?.mechanic || 'unknown',
          anomalies: []
        };
        allQuizData.push(entry);
        encounterData.quizzes.push(entry);
        console.log(`  Quiz captured: "${entry.question.substring(0, 80)}"`);
        console.log(`  Choices: [${entry.choices.join(' | ')}], correct: ${entry.correctIndex}`);
      } else {
        console.log('  No quiz for card 0:', JSON.stringify(quiz));
      }

      // Play card
      const playResult = await ev(page, () => window.__rrPlay.chargePlayCard(0, true));
      console.log(`  Play: ${JSON.stringify(playResult)}`);
      await sleep(1000);

      const afterScreen = await ev(page, () => window.__rrPlay?.getScreen?.());
      if (afterScreen !== 'combat') {
        console.log(`  Screen changed to ${afterScreen}`);
        combatDone = true;
      }
    }

    encounterData.turns = turnCount;
    encounterLog.push(encounterData);
    encounterCount++;
    console.log(`Encounter ${encounterCount} done. Quizzes: ${encounterData.quizzes.length}`);

    if (encounterCount >= 3) break;

    // Post-combat routing
    await sleep(2500);
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log(`Post-combat screen: ${screen}`);

    for (let r = 0; r < 12 && screen !== 'combat'; r++) {
      if (screen === 'rewardRoom') {
        const res = await ev(page, () => window.__rrPlay.acceptReward());
        console.log('acceptReward:', JSON.stringify(res));
        await sleep(3000);
      } else if (screen === 'dungeonMap') {
        const runState = await ev(page, () => window.__rrPlay.getRunState());
        const look = await ev(page, () => window.__rrPlay.look());
        console.log('Map look:', JSON.stringify(look)?.substring(0, 400));

        // Try all plausible node IDs
        const nodeIds = ['r0-n1', 'r1-n0', 'r0-n0', 'r1-n1', 'r2-n0', 'r0-n2', 'r1-n2', 'r2-n1'];
        let navigated = false;
        for (const nid of nodeIds) {
          const res = await ev(page, (id) => window.__rrPlay.selectMapNode(id), nid);
          if (res && !JSON.stringify(res).includes('not found') && res.ok !== false) {
            console.log(`Navigated via ${nid}:`, JSON.stringify(res));
            navigated = true;
            await sleep(2000);
            break;
          }
        }
        if (!navigated) {
          // Try selectRoom
          const roomResult = await ev(page, () => window.__rrPlay.selectRoom?.('combat'));
          console.log('selectRoom(combat):', JSON.stringify(roomResult));
          await sleep(2000);
        }
      } else if (screen === 'runEnd') {
        console.log('Run ended naturally!');
        break;
      } else if (screen === 'specialEvent' || screen === 'mysteryEvent') {
        await ev(page, () => window.__rrPlay.mysteryContinue?.());
        await sleep(2000);
      } else {
        console.log(`Unknown post-combat screen: ${screen}, waiting...`);
        await sleep(2000);
      }
      screen = await ev(page, () => window.__rrPlay?.getScreen?.());
      console.log(`Screen: ${screen}`);
    }
  }

  console.log(`\n=== DONE. Encounters: ${encounterCount}, Quizzes: ${allQuizData.length} ===`);

  fs.writeFileSync(`${OUT_DIR}/quiz-data-raw.json`, JSON.stringify({
    meta: { date: new Date().toISOString(), encountersCompleted: encounterCount, totalQuizzes: allQuizData.length },
    allQuizData,
    encounterLog
  }, null, 2));

  await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
