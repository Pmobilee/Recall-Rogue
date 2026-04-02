/**
 * Quiz Quality Tester v4 — BATCH-2026-04-02-004
 *
 * Key changes:
 * - Inspect full combat state to understand card structure
 * - Use getQuiz() and getQuizText() to get quiz content
 * - Use quickPlayCard() for 1-AP cards, chargePlayCard() for 2-AP
 * - Try answerQuizCorrectly() flow
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

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Navigating to game...');
  await page.goto(URL);
  await sleep(4000);

  await ev(page, () => {
    const s1 = Symbol.for('rr:sfxEnabled');
    const s2 = Symbol.for('rr:musicEnabled');
    if (globalThis[s1]?.set) globalThis[s1].set(false);
    if (globalThis[s2]?.set) globalThis[s2].set(false);
  });

  // Setup run
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
  }

  screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log('Screen before combat nav:', screen);

  // Navigate to combat
  if (screen === 'dungeonMap') {
    await ev(page, (id) => window.__rrPlay.selectMapNode(id), 'r0-n0');
    await sleep(2000);
    screen = await ev(page, () => window.__rrPlay?.getScreen?.());
    console.log('Screen after map nav:', screen);
  }

  // --- DIAGNOSTIC: Inspect combat state in detail ---
  console.log('\n=== DIAGNOSTIC: Full combat state inspection ===');

  const fullState = await ev(page, () => {
    return JSON.stringify(window.__rrPlay.getCombatState(), null, 2);
  });
  console.log('Full combat state:\n', fullState?.substring(0, 3000));

  // Try getQuiz
  const quiz0 = await ev(page, () => {
    return JSON.stringify(window.__rrPlay.getQuiz(), null, 2);
  });
  console.log('\ngetQuiz():', quiz0?.substring(0, 1000));

  // Try getQuizText
  const quizText = await ev(page, () => {
    return JSON.stringify(window.__rrPlay.getQuizText(), null, 2);
  });
  console.log('\ngetQuizText():', quizText?.substring(0, 1000));

  // Try getAllText
  const allText = await ev(page, () => {
    return JSON.stringify(window.__rrPlay.getAllText(), null, 2);
  });
  console.log('\ngetAllText():', allText?.substring(0, 2000));

  // Try previewCardQuiz on each card index
  const state = await ev(page, () => window.__rrPlay.getCombatState());
  const handLen = state?.hand?.length || 0;
  console.log(`\nHand size: ${handLen}`);
  console.log('Hand cards:', JSON.stringify(state?.hand));

  for (let i = 0; i < Math.min(handLen, 5); i++) {
    const q = await ev(page, (idx) => {
      return JSON.stringify(window.__rrPlay.previewCardQuiz(idx));
    }, i);
    console.log(`previewCardQuiz(${i}):`, q);
  }

  // Try charging a card to trigger quiz display
  console.log('\nAttempting to charge a card with 2 AP...');
  // First check if there are high-AP cards
  console.log('State hand details:');
  state?.hand?.forEach((c, i) => {
    console.log(`  Card ${i}: id=${c.id}, type=${c.type}, mechanic=${c.mechanic}, apCost=${c.apCost}, chargeCost=${c.chargeCost}`);
  });

  // Try quickPlayCard first to use 1 AP
  const qp = await ev(page, () => window.__rrPlay.quickPlayCard(0));
  console.log('\nquickPlayCard(0):', JSON.stringify(qp));
  await sleep(1000);

  const state2 = await ev(page, () => window.__rrPlay.getCombatState());
  console.log(`AP after quickPlay: ${state2?.ap}`);

  // Now try charge with 2+ AP
  if ((state2?.ap || 0) >= 2) {
    const charge = await ev(page, () => {
      return JSON.stringify(window.__rrPlay.chargePlayCard(0, true));
    });
    console.log('chargePlayCard(0, true):', charge);
    await sleep(1000);

    // Check if quiz appeared
    const quizAfterCharge = await ev(page, () => {
      return JSON.stringify(window.__rrPlay.getQuiz());
    });
    console.log('getQuiz after chargePlay:', quizAfterCharge);

    const quizTextAfterCharge = await ev(page, () => {
      return JSON.stringify(window.__rrPlay.getQuizText());
    });
    console.log('getQuizText after chargePlay:', quizTextAfterCharge);
  }

  // Look at screen state after actions
  screen = await ev(page, () => window.__rrPlay?.getScreen?.());
  console.log('\nCurrent screen:', screen);

  const look = await ev(page, () => window.__rrPlay.look());
  console.log('look():', look);

  await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
