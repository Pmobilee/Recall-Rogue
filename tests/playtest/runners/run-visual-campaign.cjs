#!/usr/bin/env node
/**
 * Lightweight visual playtest worker for campaign runs.
 * Writes one JSON artifact to data/playtests/qa-reports and prints its path.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SEED = Number(process.env.PLAYTEST_SEED || Date.now());
const MAX_TURNS = Number(process.env.PLAYTEST_MAX_TURNS || 120);
const DEV_URL = process.env.PLAYTEST_DEV_URL || 'http://127.0.0.1:5173';
const CAMPAIGN_ID = process.env.PLAYTEST_CAMPAIGN_ID || null;
const OUT_DIR = path.resolve(process.cwd(), 'data/playtests/qa-reports');

function nowIso() {
  return new Date().toISOString();
}

(async () => {
  const ts = Date.now();
  const playthroughId = `visual-playthrough-${SEED}-${ts}`;
  const report = {
    type: 'visual_campaign_run',
    playthroughId,
    seed: SEED,
    campaignId: CAMPAIGN_ID,
    startedAt: nowIso(),
    completedAt: null,
    devUrl: DEV_URL,
    result: 'unknown',
    steps: [],
    errors: [],
    screenshots: [],
    consoleErrors: [],
  };

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text().slice(0, 500));
    }
  });

  const step = async (turn, action, meta = {}) => {
    const snap = await page.evaluate(() => {
      const api = window.__terraPlay;
      return {
        screen: api?.getScreen?.() ?? 'unknown',
        look: api?.look?.() ?? '',
      };
    });
    report.steps.push({ turn, action, ...snap, ...meta });
  };

  try {
    await page.goto(`${DEV_URL}?skipOnboarding=true&devpreset=post_tutorial&playtest=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1800);

    const apiReady = await page.evaluate(() => !!window.__terraPlay);
    if (!apiReady) {
      report.errors.push({
        type: 'setup_error',
        message: 'window.__terraPlay unavailable',
      });
      report.result = 'error';
    } else {
      await step(0, 'boot');

      for (let turn = 1; turn <= MAX_TURNS; turn++) {
        const state = await page.evaluate(() => ({
          screen: window.__terraPlay?.getScreen?.() ?? 'unknown',
        }));

        let action = 'noop';
        let actionResult = null;

        if (state.screen === 'hub' || state.screen === 'base') {
          action = 'startRun';
          actionResult = await page.evaluate(() => window.__terraPlay.startRun());
        } else if (state.screen === 'domainSelection') {
          action = 'selectDomain';
          actionResult = await page.evaluate(() => window.__terraPlay.selectDomain('general_knowledge'));
        } else if (state.screen === 'archetypeSelection') {
          action = 'selectArchetype';
          actionResult = await page.evaluate(() => window.__terraPlay.selectArchetype('balanced'));
        } else if (state.screen === 'combat') {
          const quiz = await page.evaluate(() => window.__terraPlay.getQuiz());
          if (quiz && quiz.question) {
            action = 'answerQuizCorrectly';
            actionResult = await page.evaluate(() => window.__terraPlay.answerQuizCorrectly());
          } else {
            action = 'playCard';
            actionResult = await page.evaluate(() => window.__terraPlay.playCard(0));
            if (!actionResult || !actionResult.ok) {
              action = 'endTurn';
              actionResult = await page.evaluate(() => window.__terraPlay.endTurn());
            }
          }
        } else if (state.screen === 'roomSelection') {
          action = 'selectRoom';
          actionResult = await page.evaluate(() => window.__terraPlay.selectRoom(0));
        } else if (state.screen === 'cardReward') {
          action = 'acceptReward';
          actionResult = await page.evaluate(() => {
            window.__terraPlay.selectRewardType('attack');
            return window.__terraPlay.acceptReward();
          });
        } else if (state.screen === 'restRoom') {
          action = 'restHeal';
          actionResult = await page.evaluate(() => window.__terraPlay.restHeal());
        } else if (state.screen === 'mysteryEvent') {
          action = 'mysteryContinue';
          actionResult = await page.evaluate(() => window.__terraPlay.mysteryContinue());
        } else if (state.screen === 'retreatOrDelve') {
          action = 'delve';
          actionResult = await page.evaluate(() => window.__terraPlay.delve());
        } else if (state.screen === 'runEnd') {
          report.result = 'completed';
          await step(turn, 'runEnd');
          break;
        }

        if (actionResult && actionResult.ok === false) {
          report.errors.push({
            type: 'action_error',
            turn,
            action,
            screen: state.screen,
            message: actionResult.message || 'Action failed',
          });
        }

        await step(turn, action, { actionResult });
        await page.waitForTimeout(280);
      }

      if (report.result === 'unknown') {
        report.result = report.errors.length > 0 ? 'completed_with_issues' : 'completed';
      }
    }
  } catch (err) {
    report.result = 'error';
    report.errors.push({
      type: 'exception',
      message: String(err && err.stack ? err.stack : err),
    });
  } finally {
    report.completedAt = nowIso();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, `${playthroughId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    await browser.close();
    console.log(outPath);
  }
})();
