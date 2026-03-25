#!/usr/bin/env node
/**
 * Recall Rogue Visual QA Playtest Runner
 *
 * Launches a headless Chrome browser and plays through a full card combat run,
 * capturing detailed data about every quiz question, answer, room transition, and visual state.
 * Writes a structured JSON report with QA checks for data integrity and UI correctness.
 *
 * Environment Variables:
 *   PLAYTEST_SEED - RNG seed (default: random 1-10000)
 *   PLAYTEST_MAX_TURNS - max turns before aborting (default: 200)
 *   PLAYTEST_DEV_URL - dev server URL (default: http://localhost:5173)
 *
 * Usage:
 *   node tests/playtest/runners/run-visual-qa.cjs
 *   PLAYTEST_SEED=1337 PLAYTEST_MAX_TURNS=300 node tests/playtest/runners/run-visual-qa.cjs
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SEED = parseInt(process.env.PLAYTEST_SEED || String(Math.floor(Math.random() * 10000)), 10);
const MAX_TURNS = parseInt(process.env.PLAYTEST_MAX_TURNS || '200', 10);
const DEV_URL = process.env.PLAYTEST_DEV_URL || 'http://localhost:5173';

/**
 * Main playtest runner
 */
(async () => {
  const report = {
    seed: SEED,
    startedAt: new Date().toISOString(),
    devUrl: DEV_URL,
    viewport: { width: 412, height: 915 },
    quizzes: [],        // every quiz encountered with full question/answer data
    roomTransitions: [], // every room selection with available options
    errors: [],         // all issues found (data corruption, rendering, state bugs)
    screenshots: [],    // paths to diagnostic screenshots
    consoleErrors: [],  // JS console errors (filtered)
    pageErrors: [],     // uncaught exceptions
    turnCount: 0,
    result: 'unknown',  // victory, defeat, timeout, error, crash
    floorsReached: 0,
    endScreenText: null,
    completedAt: null,
  };

  let browser;
  let page;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    page = await browser.newPage();
    await page.setViewportSize({ width: 412, height: 915 });

    // Collect console and page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        // Filter out known non-fatal network errors
        if (
          !text.includes('ERR_CONNECTION_REFUSED') &&
          !text.includes('Failed to load resource') &&
          !text.includes('Cross-Origin')
        ) {
          consoleErrors.push({
            level: 'error',
            text: text.substring(0, 500),
            location: msg.location()?.url || 'unknown',
          });
        }
      } else if (msg.type() === 'warning') {
        // Capture warnings too for visibility
        consoleErrors.push({
          level: 'warning',
          text: text.substring(0, 500),
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack?.substring(0, 500) || '',
      });
    });

    // Navigate to game
    console.log(`[Setup] Navigating to ${DEV_URL}?skipOnboarding=true&devpreset=post_tutorial`);
    await page.goto(`${DEV_URL}?skipOnboarding=true&devpreset=post_tutorial`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for game to fully initialize
    await page.waitForTimeout(3000);

    // Verify facts database is loaded
    const dbReady = await page.evaluate(() => {
      const db = globalThis[Symbol.for('terra:factsDB')];
      if (!db) return { ready: false, error: 'Symbol not found' };
      try {
        const all = db.getAll?.();
        return {
          ready: !!all,
          count: all?.length || 0,
          hasGetAll: typeof db.getAll === 'function',
        };
      } catch (e) {
        return { ready: false, error: e.message };
      }
    });

    console.log(`[Setup] FactsDB: ${JSON.stringify(dbReady)}`);
    if (!dbReady.ready) {
      report.result = 'error';
      report.errors.push({
        type: 'setup',
        message: `FactsDB not initialized: ${dbReady.error}`,
        critical: true,
      });
      throw new Error('FactsDB not ready');
    }

    // Screenshot: Hub screen
    console.log(`[Setup] Taking hub screenshot`);
    await page.screenshot({ path: `/tmp/qa-${SEED}-01-hub.png` });
    report.screenshots.push(`/tmp/qa-${SEED}-01-hub.png`);

    // Step 1: Click "Enter Dungeon" (btn-start-run)
    console.log(`[Setup] Clicking Enter Dungeon button`);
    const startBtn = page.locator('[data-testid="btn-start-run"]');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await page.waitForTimeout(1500);

    // Step 2: Click "ENTER THE DEPTHS" button
    console.log(`[Setup] Clicking ENTER THE DEPTHS button`);
    const enterDepths = page.locator('button:has-text("ENTER THE DEPTHS")');
    await enterDepths.waitFor({ state: 'visible', timeout: 5000 });
    await enterDepths.click();
    await page.waitForTimeout(2500);

    // Screenshot: Combat start
    console.log(`[Setup] Taking combat start screenshot`);
    await page.screenshot({ path: `/tmp/qa-${SEED}-02-combat-start.png` });
    report.screenshots.push(`/tmp/qa-${SEED}-02-combat-start.png`);

    // === MAIN PLAY LOOP ===
    let turnCount = 0;
    let runEnded = false;
    let consecutiveUnknownTurns = 0;
    const MAX_CONSECUTIVE_UNKNOWN = 10;

    while (turnCount < MAX_TURNS && !runEnded) {
      turnCount++;
      await page.waitForTimeout(400);

      // Get current state: all visible elements and their test IDs
      const state = await page.evaluate(() => {
        const elements = [];
        const els = document.querySelectorAll('[data-testid]');
        for (const el of els) {
          const testId = el.getAttribute('data-testid');
          const isVisible = el.offsetParent !== null || (el.offsetWidth > 0 && el.offsetHeight > 0);
          if (isVisible) {
            elements.push({
              testId,
              text: (el.textContent || '').trim().substring(0, 100),
              disabled: el.hasAttribute('disabled'),
              ariaLabel: el.getAttribute('aria-label'),
            });
          }
        }
        return { elements };
      });

      const visibleIds = state.elements.map(e => e.testId);

      // --- RUN END DETECTION (hub after run completion) ---
      if (visibleIds.includes('btn-start-run')) {
        console.log(`[Turn ${turnCount}] Back at hub — run completed`);
        if (report.result === 'unknown') report.result = 'completed';
        runEnded = true;
        break;
      }

      // --- RUN END SCREEN DETECTION (defeat/victory modal) ---
      if (visibleIds.includes('btn-play-again') || visibleIds.includes('btn-home')) {
        console.log(`[Turn ${turnCount}] Run ended - detected end screen`);
        report.result = 'run_ended';
        const endText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
        report.endScreenText = endText;
        await page.screenshot({ path: `/tmp/qa-${SEED}-end.png` });
        report.screenshots.push(`/tmp/qa-${SEED}-end.png`);
        runEnded = true;
        break;
      }

      // --- ROOM SELECTION ---
      if (visibleIds.includes('room-choice-0')) {
        const roomOptions = state.elements.filter(e => e.testId?.startsWith('room-choice'));
        console.log(`[Turn ${turnCount}] Room selection: ${roomOptions.length} options`);

        report.roomTransitions.push({
          turn: turnCount,
          roomCount: roomOptions.length,
          rooms: roomOptions.map(r => ({ id: r.testId, text: r.text })),
        });

        if (roomOptions.length < 2) {
          report.errors.push({
            type: 'room_selection',
            turn: turnCount,
            message: `Only ${roomOptions.length} room choices visible (expected 2-3)`,
          });
        }

        // Pick first room (usually combat)
        const roomBtn = page.locator('[data-testid="room-choice-0"]');
        await roomBtn.click({ force: true });
        await page.waitForTimeout(1500);
        continue;
      }

      // --- REST ROOM ---
      if (visibleIds.includes('rest-heal')) {
        console.log(`[Turn ${turnCount}] Rest room: choosing heal`);
        await page.locator('[data-testid="rest-heal"]').click({ force: true });
        await page.waitForTimeout(1200);
        continue;
      }

      // --- SHOP ROOM ---
      if (visibleIds.some(id => id?.startsWith('shop-buy-'))) {
        console.log(`[Turn ${turnCount}] Shop room: leaving without purchase`);
        // Try to find and click a leave button
        const leaveBtn = await page.locator(
          'button:has-text("Leave"), button:has-text("Continue"), button:has-text("Skip"), button:has-text("Exit")'
        ).first();
        if (await leaveBtn.isVisible().catch(() => false)) {
          await leaveBtn.click({ force: true });
        } else {
          // No explicit leave button — wait and continue
          await page.waitForTimeout(1000);
        }
        await page.waitForTimeout(800);
        continue;
      }

      // --- MYSTERY EVENT ---
      if (visibleIds.includes('mystery-continue')) {
        console.log(`[Turn ${turnCount}] Mystery event: continuing`);
        await page.locator('[data-testid="mystery-continue"]').click({ force: true });
        await page.waitForTimeout(1200);
        continue;
      }

      // --- POST MINI-BOSS ---
      if (visibleIds.includes('post-miniboss-continue')) {
        console.log(`[Turn ${turnCount}] Post mini-boss: continuing`);
        await page.locator('[data-testid="post-miniboss-continue"]').click({ force: true });
        await page.waitForTimeout(1200);
        continue;
      }

      // --- CARD REWARD SELECTION ---
      if (visibleIds.includes('reward-accept')) {
        console.log(`[Turn ${turnCount}] Card reward: selecting type and accepting`);

        // Pick first available reward type
        const rewardTypes = visibleIds.filter(id => id?.startsWith('reward-type-'));
        if (rewardTypes.length > 0) {
          const typeBtn = page.locator(`[data-testid="${rewardTypes[0]}"]`);
          if (await typeBtn.isVisible().catch(() => false)) {
            await typeBtn.click({ force: true });
            await page.waitForTimeout(600);
          }
        }

        const acceptBtn = page.locator('[data-testid="reward-accept"]');
        if (await acceptBtn.isVisible().catch(() => false)) {
          await acceptBtn.click({ force: true });
          await page.waitForTimeout(1200);
        }
        continue;
      }

      // --- UPGRADE SELECTION ---
      if (visibleIds.some(id => id?.startsWith('upgrade-candidate-'))) {
        console.log(`[Turn ${turnCount}] Upgrade selection: skipping`);
        const skipBtn = page.locator('[data-testid="upgrade-skip"]');
        if (await skipBtn.isVisible().catch(() => false)) {
          await skipBtn.click({ force: true });
          await page.waitForTimeout(1200);
        }
        continue;
      }

      // --- CAMPFIRE PAUSE ---
      if (visibleIds.includes('btn-campfire-resume')) {
        console.log(`[Turn ${turnCount}] Campfire pause: resuming`);
        await page.locator('[data-testid="btn-campfire-resume"]').click({ force: true });
        await page.waitForTimeout(1200);
        continue;
      }

      // --- COMBAT: PLAY A CARD ---
      const playableCards = state.elements.filter(
        e => e.testId?.startsWith('card-hand-') && !e.disabled
      );

      if (playableCards.length > 0) {
        const cardId = playableCards[0].testId;
        console.log(`[Turn ${turnCount}] Playing card: ${cardId}`);
        consecutiveUnknownTurns = 0;

        // First: deselect any previously selected card
        const cancelBtn = await page.evaluate(() => {
          const el = document.querySelector('button[class*="cancel"]') ||
                     Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel'));
          if (el && el.offsetParent !== null) {
            const rect = el.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }
          return null;
        });
        if (cancelBtn) {
          await page.mouse.click(cancelBtn.x, cancelBtn.y);
          await page.waitForTimeout(500);
        }

        // Get card position for first click (SELECT)
        const cardRect1 = await page.evaluate((testId) => {
          const el = document.querySelector(`[data-testid="${testId}"]`);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }, cardId);

        if (!cardRect1) {
          console.log(`[Turn ${turnCount}] Card element not found in DOM`);
          await page.waitForTimeout(500);
          continue;
        }

        // First click: SELECT the card
        await page.mouse.click(cardRect1.x, cardRect1.y);
        await page.waitForTimeout(800);

        // Re-fetch position (card lifts up when selected)
        const cardRect2 = await page.evaluate((testId) => {
          const el = document.querySelector(`[data-testid="${testId}"]`);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }, cardId);

        if (!cardRect2) {
          console.log(`[Turn ${turnCount}] Card disappeared after select`);
          await page.waitForTimeout(500);
          continue;
        }

        // Second click: CAST the card (triggers quiz)
        await page.mouse.click(cardRect2.x, cardRect2.y);
        await page.waitForTimeout(1500);

        // Capture quiz state
        const quizState = await page.evaluate(() => {
          // Question text — look inside the dialog
          const questionEl = document.querySelector('dialog .card-question') || document.querySelector('.card-question');

          // Answer buttons — look for quiz-answer-0, 1, 2
          const answers = [];
          for (let i = 0; i < 5; i++) {
            const btn = document.querySelector(`[data-testid="quiz-answer-${i}"]`);
            if (btn && btn.offsetParent !== null) {
              answers.push({
                index: i,
                text: btn.textContent?.trim() || '',
                innerHTML: btn.innerHTML?.substring(0, 300) || '',
                disabled: btn.hasAttribute('disabled'),
              });
            }
          }

          // Flag image in quiz
          const imageEl = document.querySelector('[class*="question-image"], [class*="quiz-image"], .question-image');
          const imageData = imageEl ? {
            src: imageEl.getAttribute('src'),
            alt: imageEl.getAttribute('alt'),
            displayed: imageEl.offsetWidth > 0 && imageEl.offsetHeight > 0,
            naturalWidth: imageEl.naturalWidth,
            naturalHeight: imageEl.naturalHeight,
          } : null;

          // Card effect description
          const effectEl = document.querySelector('[class*="card-effect"], [class*="effect-desc"]');

          return {
            hasQuiz: !!questionEl || answers.length > 0,
            question: questionEl?.textContent?.trim() || null,
            answers,
            image: imageData,
            effect: effectEl?.textContent?.trim() || null,
          };
        });

        if (quizState.hasQuiz && quizState.answers.length > 0) {
          const quizEntry = {
            turn: turnCount,
            question: quizState.question,
            answers: quizState.answers.map(a => a.text),
            answersRaw: quizState.answers.map(a => ({
              index: a.index,
              text: a.text,
              htmlSnippet: a.innerHTML.substring(0, 100),
            })),
            image: quizState.image,
            effect: quizState.effect,
            issues: [],
          };

          // === QA CHECKS ===

          // Check 1: Undefined/null/NaN in text fields
          const allText = [
            quizState.question,
            ...quizState.answers.map(a => a.text),
          ].join(' ');

          if (/\bundefined\b/i.test(allText)) {
            quizEntry.issues.push({
              type: 'undefined_in_text',
              detail: 'Found "undefined" in quiz text',
            });
          }
          if (/\bnull\b/i.test(allText)) {
            quizEntry.issues.push({
              type: 'null_in_text',
              detail: 'Found "null" in quiz text',
            });
          }
          if (/\bNaN\b/.test(allText)) {
            quizEntry.issues.push({
              type: 'nan_in_text',
              detail: 'Found "NaN" in quiz text',
            });
          }
          if (/\[object Object\]/.test(allText)) {
            quizEntry.issues.push({
              type: 'object_string_in_text',
              detail: 'Found "[object Object]" in quiz text',
            });
          }

          // Check 2: Empty or very short question
          if (!quizState.question || quizState.question.length < 5) {
            quizEntry.issues.push({
              type: 'empty_or_short_question',
              detail: `Question too short: "${quizState.question || '(empty)'}"`,
            });
          }

          // Check 3: Empty or very short answers
          for (const ans of quizState.answers) {
            if (!ans.text || ans.text.length < 1) {
              quizEntry.issues.push({
                type: 'empty_answer',
                detail: `Answer ${ans.index} is empty or whitespace-only`,
              });
            }
            if (ans.text.length > 500) {
              quizEntry.issues.push({
                type: 'answer_too_long',
                detail: `Answer ${ans.index} is suspiciously long (${ans.text.length} chars)`,
              });
            }
          }

          // Check 4: Duplicate answers
          const ansTextsLower = quizState.answers.map(a => a.text.toLowerCase());
          const uniqueAnsSet = new Set(ansTextsLower);
          if (uniqueAnsSet.size < ansTextsLower.length) {
            const dups = ansTextsLower.filter(
              (t, i, arr) => arr.indexOf(t) !== i
            );
            quizEntry.issues.push({
              type: 'duplicate_answers',
              detail: `Duplicate answer choices: ${dups.join(', ')}`,
            });
          }

          // Check 5: Raw JSON in answer text (known tiered distractor bug)
          for (const ans of quizState.answers) {
            if (ans.text.includes('"text"') || ans.text.includes('"difficultyTier"') || ans.text.startsWith('{')) {
              quizEntry.issues.push({
                type: 'raw_json_in_answer',
                detail: `Raw JSON serialization in answer ${ans.index}: "${ans.text.substring(0, 80)}"`,
              });
            }
            // Check for escaped HTML or other serialization issues
            if (ans.text.includes('&quot;') || ans.text.includes('&#') || ans.text.includes('&amp;')) {
              quizEntry.issues.push({
                type: 'html_entity_in_answer',
                detail: `HTML entity in answer ${ans.index}: "${ans.text.substring(0, 80)}"`,
              });
            }
          }

          // Check 6: Answer text appears in question (tautological)
          if (quizState.question) {
            for (const ans of quizState.answers) {
              if (ans.text.length > 10 && quizState.question.toLowerCase().includes(ans.text.toLowerCase())) {
                quizEntry.issues.push({
                  type: 'tautological_answer',
                  detail: `Answer "${ans.text}" appears within the question text`,
                });
              }
            }
          }

          // Check 7: Image validation
          if (quizState.image) {
            if (!quizState.image.displayed) {
              quizEntry.issues.push({
                type: 'image_not_displayed',
                detail: `Image src="${quizState.image.src}" not displayed (0 dimensions)`,
              });
            }
            if (!quizState.image.naturalWidth || !quizState.image.naturalHeight) {
              quizEntry.issues.push({
                type: 'image_failed_to_load',
                detail: `Image failed to load: ${quizState.image.src}`,
              });
            }
          }

          // Check 8: Wrong answer count (should be exactly 3)
          if (quizState.answers.length !== 3) {
            quizEntry.issues.push({
              type: 'wrong_answer_count',
              detail: `Expected 3 answer choices, got ${quizState.answers.length}`,
            });
          }

          // Check 9: Very similar answers (potential generation issue)
          if (quizState.answers.length >= 2) {
            for (let i = 0; i < quizState.answers.length - 1; i++) {
              for (let j = i + 1; j < quizState.answers.length; j++) {
                const text1 = quizState.answers[i].text;
                const text2 = quizState.answers[j].text;
                // Levenshtein-like: if >80% of the same, flag
                const similarity = Math.max(
                  text1.length,
                  text2.length
                ) === 0 ? 0 : (1 - editDistance(text1, text2) / Math.max(text1.length, text2.length));
                if (similarity > 0.8) {
                  quizEntry.issues.push({
                    type: 'very_similar_answers',
                    detail: `Answers ${i} and ${j} are too similar (${Math.round(similarity * 100)}% match)`,
                  });
                }
              }
            }
          }

          // Log any issues
          if (quizEntry.issues.length > 0) {
            for (const issue of quizEntry.issues) {
              report.errors.push({
                type: issue.type,
                turn: turnCount,
                message: issue.detail,
                question: quizState.question?.substring(0, 100) || '(no question)',
              });
            }
            // Screenshot for problematic quizzes
            const screenshotPath = `/tmp/qa-${SEED}-issue-turn${turnCount}.png`;
            await page.screenshot({ path: screenshotPath });
            report.screenshots.push(screenshotPath);
          }

          report.quizzes.push(quizEntry);

          // Answer the quiz (first non-disabled choice)
          const answerRect = await page.evaluate(() => {
            for (let i = 0; i < 3; i++) {
              const btn = document.querySelector(`[data-testid="quiz-answer-${i}"]`);
              if (btn && !btn.hasAttribute('disabled') && btn.offsetParent !== null) {
                const rect = btn.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              }
            }
            return null;
          });
          if (answerRect) {
            await page.mouse.click(answerRect.x, answerRect.y);
          }
          // Wait for card animation + dialog close
          await page.waitForTimeout(1500);
        } else {
          // Card was clicked but quiz didn't appear
          console.log(`[Turn ${turnCount}] Card played but no quiz appeared`);
          await page.waitForTimeout(500);
        }
        continue;
      }

      // --- NO PLAYABLE CARDS: END TURN ---
      if (visibleIds.includes('btn-end-turn')) {
        const endBtn = state.elements.find(e => e.testId === 'btn-end-turn');
        // Check if ALL visible cards are disabled
        const allCardsDisabled = state.elements
          .filter(e => e.testId?.startsWith('card-hand-'))
          .every(e => e.disabled);

        if ((!endBtn?.disabled || allCardsDisabled) && playableCards.length === 0) {
          console.log(`[Turn ${turnCount}] Ending turn (no playable cards)`);
          await page.locator('[data-testid="btn-end-turn"]').click({ force: true });
          await page.waitForTimeout(1600);
        } else {
          // Button disabled or cards still available — wait for animation
          await page.waitForTimeout(1000);
        }
        continue;
      }

      // --- UNKNOWN STATE ---
      consecutiveUnknownTurns++;
      console.log(`[Turn ${turnCount}] Unknown state (${consecutiveUnknownTurns}/${MAX_CONSECUTIVE_UNKNOWN}). Visible testids: ${visibleIds.slice(0, 15).join(', ')}`);

      // Abort if stuck in unknown state too long
      if (consecutiveUnknownTurns > MAX_CONSECUTIVE_UNKNOWN) {
        console.log(`[Turn ${turnCount}] Aborting: ${MAX_CONSECUTIVE_UNKNOWN}+ consecutive unknown turns`);
        report.result = 'stuck';
        report.errors.push({
          type: 'stuck_in_unknown_state',
          turn: turnCount,
          message: `Stuck in unknown state for ${consecutiveUnknownTurns} turns. Aborting playtest.`,
        });
        break;
      }

      const unknownPath = `/tmp/qa-${SEED}-unknown-turn${turnCount}.png`;
      await page.screenshot({ path: unknownPath });
      report.screenshots.push(unknownPath);

      report.errors.push({
        type: 'unknown_state',
        turn: turnCount,
        message: `No recognized action available. Visible: ${visibleIds.slice(0, 10).join(', ')}`,
      });

      // Try to recover with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // Determine final result
    if (turnCount >= MAX_TURNS) {
      report.result = 'timeout';
    }
    if (report.result === 'unknown') {
      report.result = 'incomplete';
    }

    report.turnCount = turnCount;
    report.consoleErrors = consoleErrors;
    report.pageErrors = pageErrors;
    report.completedAt = new Date().toISOString();

    // Final screenshot
    console.log(`[Cleanup] Taking final screenshot`);
    await page.screenshot({ path: `/tmp/qa-${SEED}-final.png` });
    report.screenshots.push(`/tmp/qa-${SEED}-final.png`);

  } catch (err) {
    report.result = report.result === 'unknown' ? 'crash' : report.result;
    report.errors.push({
      type: 'crash',
      message: err.message,
      stack: err.stack?.substring(0, 500) || '',
    });
    console.error(`[Error] Playtest crashed: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Write report
  const reportDir = path.resolve(__dirname, '../../../data/playtests/qa-reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const timestamp = Date.now();
  const reportPath = path.join(reportDir, `qa-run-seed${SEED}-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  const issueCount = report.errors.length;
  const quizCount = report.quizzes.length;
  const quizzesWithIssues = report.quizzes.filter(q => q.issues.length > 0).length;

  console.log('\n='.repeat(60));
  console.log('QA PLAYTEST REPORT');
  console.log('='.repeat(60));
  console.log(`Seed:                    ${SEED}`);
  console.log(`Result:                  ${report.result.toUpperCase()}`);
  console.log(`Turns played:            ${report.turnCount}/${MAX_TURNS}`);
  console.log(`Quizzes encountered:     ${quizCount}`);
  console.log(`Quizzes with issues:     ${quizzesWithIssues}/${quizCount}`);
  console.log(`Room transitions:        ${report.roomTransitions.length}`);
  console.log(`Total errors:            ${issueCount}`);
  console.log(`Console errors:          ${report.consoleErrors.length}`);
  console.log(`Page errors:             ${report.pageErrors.length}`);
  console.log(`Screenshots captured:    ${report.screenshots.length}`);
  console.log(`Report file:             ${reportPath}`);
  console.log('='.repeat(60));

  if (issueCount > 0) {
    console.log('\nTop Issues Found:');
    const errorsByType = {};
    for (const err of report.errors) {
      if (!errorsByType[err.type]) {
        errorsByType[err.type] = [];
      }
      errorsByType[err.type].push(err);
    }

    for (const [type, errors] of Object.entries(errorsByType)) {
      console.log(`\n  [${type}] x${errors.length}`);
      for (const err of errors.slice(0, 3)) {
        console.log(`    Turn ${err.turn}: ${err.message.substring(0, 70)}`);
      }
      if (errors.length > 3) {
        console.log(`    ... and ${errors.length - 3} more`);
      }
    }
  }

  console.log('\nPlaytest complete.\n');
})();

/**
 * Simple edit distance for answer similarity check
 */
function editDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
