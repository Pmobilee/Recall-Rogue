/**
 * Quiz Quality Tester FINAL — BATCH-2026-04-02-004
 *
 * Key fix: previewCardQuiz returns { ok, state: { question, choices, correctIndex, ... } }
 * We need to read result.state, not result directly.
 *
 * Strategy:
 * - For each card to be played, call previewCardQuiz(idx) and read .state
 * - Also capture the card's factQuestion/factAnswer from getCombatState()
 * - Try all cards in hand per turn (not just card 0)
 * - Use quickPlayCard for 1-AP cards when out of 2-AP budget
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

async function setupAndNavigateToCombat(page) {
  await page.goto(URL);
  await sleep(4000);

  // Mute
  await ev(page, () => {
    const s1 = Symbol.for('rr:sfxEnabled');
    const s2 = Symbol.for('rr:musicEnabled');
    if (globalThis[s1]?.set) globalThis[s1].set(false);
    if (globalThis[s2]?.set) globalThis[s2].set(false);
  });

  // Start run
  await ev(page, () => window.__rrPlay.startRun());
  await sleep(800);
  await ev(page, () => window.__rrPlay.selectDomain('general_knowledge'));
  await sleep(800);
  await ev(page, () => window.__rrPlay.selectArchetype('balanced'));
  await sleep(1500);

  let screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  if (screen === 'onboarding') {
    await ev(page, () => document.querySelector('button.enter-btn')?.click());
    await sleep(1500);
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  }

  if (screen === 'dungeonMap') {
    const r = await ev(page, () => window.__rrPlay.selectMapNode('r0-n0'));
    console.log('selectMapNode(r0-n0):', JSON.stringify(r));
    await sleep(2000);
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  }

  return screen;
}

async function navigatePostCombat(page) {
  let screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log(`Post-combat routing from: ${screen}`);

  for (let i = 0; i < 12 && screen !== 'combat'; i++) {
    if (screen === 'rewardRoom') {
      const r = await ev(page, () => window.__rrPlay.acceptReward());
      console.log('  acceptReward:', JSON.stringify(r));
      await sleep(3000);
    } else if (screen === 'dungeonMap') {
      // Try sequential node IDs
      let navigated = false;
      for (const nid of ['r0-n0', 'r0-n1', 'r0-n2', 'r1-n0', 'r1-n1', 'r2-n0', 'r2-n1']) {
        const r = await ev(page, (id) => window.__rrPlay.selectMapNode(id), nid);
        const rStr = JSON.stringify(r);
        if (r && !rStr.includes('"ok":false') && !rStr.includes('not found')) {
          console.log(`  navigated via ${nid}:`, rStr);
          navigated = true;
          await sleep(2000);
          break;
        }
      }
      if (!navigated) {
        console.log('  Could not navigate map, look:', await ev(page, () => window.__rrPlay.look()));
        break;
      }
    } else if (screen === 'specialEvent' || screen === 'mysteryEvent' || screen === 'retreatOrDelve') {
      const r = await ev(page, () => window.__rrPlay.mysteryContinue?.() || window.__rrPlay.delve?.());
      console.log(`  handled ${screen}:`, JSON.stringify(r));
      await sleep(2000);
    } else if (screen === 'runEnd') {
      return screen;
    } else {
      await sleep(1500);
    }
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log(`  screen now: ${screen}`);
  }
  return screen;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('=== Quiz Quality Tester FINAL ===');
  const combatScreen = await setupAndNavigateToCombat(page);
  console.log('Initial combat screen:', combatScreen);

  const allQuizData = [];
  const encounterLog = [];
  const seenFactIds = new Set();

  for (let enc = 0; enc < 3; enc++) {
    let screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log(`\n====== ENCOUNTER ${enc + 1} (screen: ${screen}) ======`);

    if (screen !== 'combat') {
      // Navigate to combat
      if (screen === 'dungeonMap' || screen === 'rewardRoom') {
        screen = await navigatePostCombat(page);
      }
      if (screen !== 'combat') {
        console.log(`Cannot reach combat (${screen}), skipping`);
        continue;
      }
    }

    const encData = {
      encounter: enc + 1,
      quizzes: [],
      uniqueQuizzes: [],
      totalPlays: 0,
      turnsCompleted: 0
    };

    let combatDone = false;

    for (let turn = 0; turn < 30 && !combatDone; turn++) {
      const cs = await ev(page, () => window.__rrPlay.getCombatState());
      if (!cs) break;

      console.log(`\n  Turn ${turn + 1}: AP=${cs.ap}/${cs.apMax}, Hand=${cs.handSize}, EnemyHP=${cs.enemyHp}/${cs.enemyMaxHp}`);

      if (cs.enemyHp <= 0) {
        console.log('  Enemy defeated!');
        combatDone = true;
        break;
      }

      if (!cs.hand?.length) {
        console.log('  No hand, ending turn');
        await ev(page, () => window.__rrPlay.endTurn());
        await sleep(1200);
        encData.turnsCompleted++;
        continue;
      }

      let playedAnyCard = false;

      // Try to play each card in hand
      for (let idx = 0; idx < cs.hand.length; idx++) {
        const card = cs.hand[idx];

        // Re-check current state
        const freshCs = await ev(page, () => window.__rrPlay.getCombatState());
        if (!freshCs || freshCs.ap <= 0) break;
        if (freshCs.enemyHp <= 0) { combatDone = true; break; }
        if (idx >= freshCs.hand.length) break;

        const freshCard = freshCs.hand[idx];
        console.log(`    Card ${idx}: ${freshCard.mechanic} (${freshCard.domain}), AP=${freshCard.apCost}, factId="${freshCard.factId}"`);

        // Capture quiz data via previewCardQuiz
        const preview = await ev(page, (i) => window.__rrPlay.previewCardQuiz(i), idx);
        console.log(`    previewCardQuiz(${idx}):`, JSON.stringify(preview)?.substring(0, 300));

        let quizEntry = null;

        if (preview && preview.state && preview.state.question) {
          // Got full quiz with distractors!
          const qs = preview.state;
          quizEntry = {
            encounterId: enc + 1,
            turn: turn + 1,
            cardIndex: idx,
            factId: qs.factId || freshCard.factId || 'unknown',
            question: qs.question || '',
            choices: qs.choices || [],
            correctIndex: qs.correctIndex ?? -1,
            correctAnswer: qs.correctAnswer || qs.choices?.[qs.correctIndex] || freshCard.factAnswer || '',
            domain: qs.domain || freshCard.domain || 'unknown',
            source: qs.factId || freshCard.factId || 'unknown',
            cardType: qs.cardType || freshCard.type || 'unknown',
            mechanic: freshCard.mechanic || 'unknown',
            fromPreview: true,
            anomalies: []
          };
          console.log(`    Quiz: "${quizEntry.question.substring(0, 80)}" (${quizEntry.choices.length} choices)`);
        } else if (freshCard.factQuestion) {
          // Fallback: use card fact data (no distractors)
          quizEntry = {
            encounterId: enc + 1,
            turn: turn + 1,
            cardIndex: idx,
            factId: freshCard.factId || 'unknown',
            question: freshCard.factQuestion || '',
            choices: [freshCard.factAnswer || ''],
            correctIndex: 0,
            correctAnswer: freshCard.factAnswer || '',
            domain: freshCard.domain || 'unknown',
            source: freshCard.factId || 'unknown',
            cardType: freshCard.type || 'unknown',
            mechanic: freshCard.mechanic || 'unknown',
            fromPreview: false,
            anomalies: ['NO_DISTRACTORS: previewCardQuiz returned no choices']
          };
          console.log(`    Fallback quiz (no distractors): "${quizEntry.question.substring(0, 60)}"`);
        }

        if (quizEntry) {
          encData.quizzes.push(quizEntry);
          allQuizData.push(quizEntry);
          if (!seenFactIds.has(quizEntry.factId)) {
            seenFactIds.add(quizEntry.factId);
            encData.uniqueQuizzes.push(quizEntry);
          }
          encData.totalPlays++;
        }

        // Play the card (charge if we have AP, quick otherwise)
        const ap = freshCs.ap;
        const chargeCost = (freshCard.apCost ?? 1) + 1;
        let playResult;

        if (ap >= chargeCost) {
          playResult = await ev(page, (i) => window.__rrPlay.chargePlayCard(i, true), idx);
        } else if (ap >= (freshCard.apCost ?? 1)) {
          playResult = await ev(page, (i) => window.__rrPlay.quickPlayCard(i), idx);
        } else {
          console.log(`    Not enough AP (have ${ap}, need ${freshCard.apCost}), breaking`);
          break;
        }

        console.log(`    Play result: ${JSON.stringify(playResult)?.substring(0, 150)}`);
        playedAnyCard = true;
        await sleep(800);

        // Check state after play
        const afterScreen = await ev(page, () => window.__rrPlay?.getScreen?.());
        if (afterScreen !== 'combat') {
          console.log(`    Screen changed to: ${afterScreen}`);
          combatDone = true;
          break;
        }

        // Don't play more cards if idx has shifted (hand changed)
        // Just play one per iteration pass and re-check
        break;
      }

      if (!playedAnyCard && !combatDone) {
        const curCs = await ev(page, () => window.__rrPlay.getCombatState());
        if (!curCs || curCs.ap <= 0 || !curCs.hand?.length) {
          console.log('  Ending turn (no plays possible)');
          await ev(page, () => window.__rrPlay.endTurn());
          await sleep(1200);
          encData.turnsCompleted++;
        }
      }
    }

    encounterLog.push(encData);
    console.log(`\nEncounter ${enc + 1} complete: ${encData.quizzes.length} quizzes (${encData.uniqueQuizzes.length} unique facts)`);

    if (enc < 2) {
      await sleep(2000);
      await navigatePostCombat(page);
    }
  }

  console.log(`\n=== COLLECTION COMPLETE ===`);
  console.log(`Total encounters: 3`);
  console.log(`Total quiz entries: ${allQuizData.length}`);
  console.log(`Unique fact IDs: ${seenFactIds.size}`);
  console.log(`Entries with full distractor data: ${allQuizData.filter(q => q.fromPreview && q.choices.length > 1).length}`);

  const output = {
    meta: {
      date: new Date().toISOString(),
      encountersCompleted: 3,
      totalQuizzes: allQuizData.length,
      uniqueFacts: seenFactIds.size,
      withDistractors: allQuizData.filter(q => q.fromPreview && q.choices.length > 1).length
    },
    allQuizData,
    encounterLog
  };

  fs.writeFileSync(`${OUT_DIR}/quiz-data-raw.json`, JSON.stringify(output, null, 2));
  console.log('Data saved to quiz-data-raw.json');

  await browser.close();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
