/**
 * Quiz Quality Tester v5 — BATCH-2026-04-02-004
 *
 * Strategy: Card hand data contains factQuestion/factAnswer.
 * We need distractors. Try getQuiz() after chargePlayCard triggers quiz screen.
 * Also try forceQuizForFact() to get full quiz with distractors.
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

async function waitForScreen(page, targetScreens, maxWait = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    if (targetScreens.includes(screen)) return screen;
    await sleep(400);
  }
  return await ev(page, () => window.__rrPlay?.getScreen?.());
}

async function setupCombat(page) {
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
    await ev(page, (id) => window.__rrPlay.selectMapNode(id), 'r0-n0');
    await sleep(2000);
  }

  return await ev(page, () => window.__rrPlay?.getScreen?.());
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Navigating...');
  await page.goto(URL);
  await sleep(4000);

  await ev(page, () => {
    const s1 = Symbol.for('rr:sfxEnabled');
    const s2 = Symbol.for('rr:musicEnabled');
    if (globalThis[s1]?.set) globalThis[s1].set(false);
    if (globalThis[s2]?.set) globalThis[s2].set(false);
  });

  const screen = await setupCombat(page);
  console.log('Screen after setup:', screen);

  // --- Diagnostic: Test forceQuizForFact ---
  const state = await ev(page, () => window.__rrPlay.getCombatState());
  const firstCard = state?.hand?.[0];
  console.log('\nFirst card:', JSON.stringify(firstCard));

  if (firstCard?.factId) {
    console.log(`\nTesting forceQuizForFact("${firstCard.factId}")...`);
    const forced = await ev(page, (factId) => {
      return JSON.stringify(window.__rrPlay.forceQuizForFact(factId));
    }, firstCard.factId);
    console.log('forceQuizForFact result:', forced);
    await sleep(2000);

    // Check getQuiz now
    const quiz = await ev(page, () => JSON.stringify(window.__rrPlay.getQuiz(), null, 2));
    console.log('getQuiz after force:', quiz?.substring(0, 1000));

    const quizText = await ev(page, () => JSON.stringify(window.__rrPlay.getQuizText(), null, 2));
    console.log('getQuizText after force:', quizText?.substring(0, 1000));

    // Answer it correctly
    await ev(page, () => window.__rrPlay.answerQuizCorrectly?.());
    await sleep(1000);
  }

  // --- Test: charge a card, then immediately getQuiz ---
  console.log('\n--- Testing chargePlayCard flow ---');
  const state2 = await ev(page, () => window.__rrPlay.getCombatState());
  console.log(`AP: ${state2?.ap}, Hand: ${state2?.hand?.length}`);

  if ((state2?.ap || 0) >= 2 && (state2?.hand?.length || 0) > 0) {
    // Don't answer yet - just trigger the quiz
    // The quiz might appear as a modal
    console.log('Triggering charge...');

    // Try initiating charge without auto-answer
    // chargePlayCard(idx, true) = answer correctly immediately
    // but we need to see the quiz BEFORE answering
    // Let's try answerQuiz flow:
    // 1. initiate charge (opens quiz modal)
    // 2. getQuiz() to capture it
    // 3. answerQuizCorrectly() to resolve

    // Check what happens with playCard (generic)
    const playResult = await ev(page, () => JSON.stringify(window.__rrPlay.playCard?.(0, 'charge')));
    console.log('playCard(0, charge):', playResult);
    await sleep(1500);

    const screenAfter = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after playCard:', screenAfter);

    const quizNow = await ev(page, () => JSON.stringify(window.__rrPlay.getQuiz(), null, 2));
    console.log('getQuiz:', quizNow?.substring(0, 1500));

    if (quizNow && quizNow !== 'null') {
      const quizTextNow = await ev(page, () => JSON.stringify(window.__rrPlay.getQuizText(), null, 2));
      console.log('getQuizText:', quizTextNow?.substring(0, 1000));

      // Answer correctly
      await ev(page, () => window.__rrPlay.answerQuizCorrectly?.());
      await sleep(1000);
    }
  }

  // --- Now try the actual combat loop with forceQuizForFact ---
  // We know hand cards have factId, so:
  // For each card we want to charge:
  // 1. Inspect card from hand
  // 2. forceQuizForFact(card.factId) to get distractors
  // 3. getQuiz() to capture full quiz data
  // 4. chargePlayCard(idx, true) to play it

  const allQuizData = [];
  const encounterLog = [];
  let encounterCount = 0;

  // Navigate to fresh combat
  const freshScreen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log('\nCurrent screen:', freshScreen);

  if (freshScreen !== 'combat') {
    console.log('Need to navigate to combat...');
    // Handle post-combat screen routing...
    let s = freshScreen;
    for (let i = 0; i < 8 && s !== 'combat'; i++) {
      if (s === 'rewardRoom') {
        await ev(page, () => window.__rrPlay.acceptReward());
        await sleep(3000);
      } else if (s === 'dungeonMap') {
        for (const nid of ['r0-n0', 'r0-n1', 'r1-n0']) {
          const r = await ev(page, (id) => window.__rrPlay.selectMapNode(id), nid);
          if (r && !JSON.stringify(r).includes('not found')) { await sleep(2000); break; }
        }
      }
      s = await ev(page, () => window.__rrPlay?.getScreen?.());
      console.log('Screen:', s);
    }
  }

  // Main encounter loop
  for (encounterCount = 0; encounterCount < 3; encounterCount++) {
    let s = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log(`\n=== ENCOUNTER ${encounterCount + 1}, screen: ${s} ===`);

    // Navigate to combat if needed
    for (let nav = 0; nav < 10 && s !== 'combat'; nav++) {
      if (s === 'rewardRoom') {
        await ev(page, () => window.__rrPlay.acceptReward());
        await sleep(3000);
      } else if (s === 'dungeonMap') {
        for (const nid of ['r0-n0', 'r0-n1', 'r1-n0', 'r1-n1', 'r2-n0']) {
          const r = await ev(page, (id) => window.__rrPlay.selectMapNode(id), nid);
          const rStr = JSON.stringify(r);
          if (r && !rStr.includes('not found')) { await sleep(2000); break; }
        }
      } else if (s === 'onboarding') {
        await ev(page, () => document.querySelector('button.enter-btn')?.click());
        await sleep(1500);
      } else {
        await sleep(2000);
      }
      s = await ev(page, () => window.__rrPlay?.getScreen?.());
    }

    if (s !== 'combat') {
      console.log('Failed to reach combat:', s);
      break;
    }

    const encData = { encounter: encounterCount + 1, quizzes: [] };
    let combatDone = false;

    for (let turn = 0; turn < 25 && !combatDone; turn++) {
      const cs = await ev(page, () => window.__rrPlay.getCombatState());
      if (!cs) break;
      console.log(`Turn ${turn + 1}: AP=${cs.ap}, Hand=${cs.hand?.length}, EnemyHP=${cs.enemyHp}/${cs.enemyMaxHp}`);

      if (cs.enemyHp <= 0) { combatDone = true; break; }

      if (!cs.hand?.length || cs.ap <= 0) {
        await ev(page, () => window.__rrPlay.endTurn());
        await sleep(1200);
        continue;
      }

      // Get card info
      const card = cs.hand[0];
      console.log(`  Card 0: ${card.mechanic} (${card.domain}) factId="${card.factId}"`);
      console.log(`  Question: "${card.factQuestion?.substring(0, 80)}"`);
      console.log(`  Answer: "${card.factAnswer}"`);

      // Try forceQuizForFact to get distractors
      let quizEntry = null;

      if (card.factId) {
        const forcedResult = await ev(page, (factId) => {
          try {
            const r = window.__rrPlay.forceQuizForFact(factId);
            return JSON.stringify(r);
          } catch(e) { return JSON.stringify({error: e.message}); }
        }, card.factId);
        console.log(`  forceQuizForFact: ${forcedResult?.substring(0, 200)}`);
        await sleep(500);

        // Get quiz data
        const quizData = await ev(page, () => {
          const q = window.__rrPlay.getQuiz();
          const qt = window.__rrPlay.getQuizText();
          return JSON.stringify({ quiz: q, quizText: qt });
        });
        console.log(`  Quiz data: ${quizData?.substring(0, 500)}`);

        const parsed = JSON.parse(quizData || '{}');
        const quiz = parsed.quiz || parsed.quizText;

        if (quiz) {
          quizEntry = {
            encounterId: encounterCount + 1,
            turn: turn + 1,
            factId: card.factId,
            question: quiz.question || card.factQuestion || '',
            choices: quiz.choices || quiz.options || [],
            correctIndex: quiz.correctIndex ?? quiz.answerIndex ?? -1,
            correctAnswer: quiz.correctAnswer || card.factAnswer || '',
            domain: card.domain || quiz.domain || 'unknown',
            source: quiz.source || quiz.deckId || card.factId || 'unknown',
            cardType: card.type,
            mechanic: card.mechanic,
            anomalies: []
          };
        }

        // Answer quiz if it's active
        const quizScreen = await ev(page, () => window.__rrPlay?.getScreen?.());
        if (quizScreen === 'quiz' || quizScreen === 'quizModal') {
          await ev(page, () => window.__rrPlay.answerQuizCorrectly?.());
          await sleep(500);
        }
      }

      // If no quiz entry from force, build from card data
      if (!quizEntry && card.factQuestion) {
        quizEntry = {
          encounterId: encounterCount + 1,
          turn: turn + 1,
          factId: card.factId,
          question: card.factQuestion,
          choices: [card.factAnswer],  // Only correct answer available
          correctIndex: 0,
          correctAnswer: card.factAnswer || '',
          domain: card.domain || 'unknown',
          source: card.factId || 'unknown',
          cardType: card.type,
          mechanic: card.mechanic,
          anomalies: ['NO_DISTRACTORS_FROM_API'],
          noDistractors: true
        };
      }

      if (quizEntry) {
        allQuizData.push(quizEntry);
        encData.quizzes.push(quizEntry);
        console.log(`  Captured quiz: "${quizEntry.question.substring(0, 60)}" (${quizEntry.choices.length} choices)`);
      }

      // Play the card
      if (cs.ap >= 2) {
        const pr = await ev(page, () => window.__rrPlay.chargePlayCard(0, true));
        console.log(`  chargePlayCard: ${JSON.stringify(pr)}`);
      } else {
        const pr = await ev(page, () => window.__rrPlay.quickPlayCard(0));
        console.log(`  quickPlayCard: ${JSON.stringify(pr)}`);
      }
      await sleep(1000);

      const afterScreen = await ev(page, () => window.__rrPlay?.getScreen?.());
      const afterCs = await ev(page, () => window.__rrPlay.getCombatState());
      if (afterScreen !== 'combat' || !afterCs || afterCs.enemyHp <= 0) {
        console.log(`Combat ended. Screen: ${afterScreen}, EnemyHP: ${afterCs?.enemyHp}`);
        combatDone = true;
      }
    }

    encounterLog.push(encData);
    console.log(`Encounter ${encounterCount + 1}: ${encData.quizzes.length} quizzes`);
  }

  console.log(`\n=== DONE: ${encounterCount} encounters, ${allQuizData.length} quizzes ===`);

  fs.writeFileSync(`${OUT_DIR}/quiz-data-raw.json`, JSON.stringify({
    meta: {
      date: new Date().toISOString(),
      encountersCompleted: encounterCount,
      totalQuizzes: allQuizData.length,
      note: 'Card fact data from hand; distractors via forceQuizForFact when available'
    },
    allQuizData,
    encounterLog
  }, null, 2));

  console.log('Data saved.');
  await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
