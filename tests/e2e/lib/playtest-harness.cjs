/**
 * Playtest harness — wraps window.__terraPlay for Node.js Playwright scripts.
 * Used by Codex workers, GPT 5.1 mini, and other AI tools for visual playtesting.
 *
 * Usage:
 *   const { createPlaytester } = require('./lib/playtest-harness.cjs');
 *   const t = await createPlaytester({ preset: 'post_tutorial' });
 *   await t.startRun();
 *   await t.selectDomain('animals_wildlife');
 *   await t.selectArchetype('balanced');
 *   const state = await t.getCombatState();
 *   await t.playCard(0);  // plays card, triggers quiz
 *   await t.answerQuizCorrectly();
 *   await t.endTurn();
 *   await t.cleanup();
 */

const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Create a playtest session with browser, page, and API wrapper.
 * @param {object} opts
 * @param {string} [opts.preset='post_tutorial'] - devpreset to load
 * @param {object} [opts.save] - custom save object to inject (overrides preset)
 * @param {number} [opts.width=412] - viewport width
 * @param {number} [opts.height=915] - viewport height
 * @param {string} [opts.baseUrl='http://localhost:5173'] - dev server URL
 * @returns {Promise<PlaytestSession>}
 */
async function createPlaytester(opts = {}) {
  const {
    preset = 'post_tutorial',
    save = null,
    width = 412,
    height = 915,
    baseUrl = 'http://localhost:5173',
  } = opts;

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });

  // Pre-flight: clear service workers and localStorage
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    localStorage.clear();
  });

  // Inject save state if provided, otherwise use preset
  if (save) {
    await page.evaluate((s) => {
      localStorage.setItem('terra_guest_mode', 'true');
      localStorage.setItem('terra_age_bracket', 'teen');
      localStorage.setItem('recall-rogue-save', JSON.stringify(s));
    }, save);
  }

  // Navigate with playtest mode enabled
  const url = save
    ? `${baseUrl}?skipOnboarding=true&playtest=true`
    : `${baseUrl}?skipOnboarding=true&devpreset=${preset}&playtest=true`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // wait for game to initialize

  // Verify API is available
  const apiReady = await page.evaluate(() => typeof window.__terraPlay?.look === 'function');
  if (!apiReady) {
    throw new Error('window.__terraPlay not available — is the dev server running?');
  }

  // Create wrapper methods that call page.evaluate for each API method
  const tester = {
    page,
    browser,

    // ── Perception ──────────────────────────
    async look() {
      return page.evaluate(() => window.__terraPlay.look());
    },
    async getAllText() {
      return page.evaluate(() => window.__terraPlay.getAllText());
    },
    async getQuizText() {
      return page.evaluate(() => window.__terraPlay.getQuizText());
    },
    async getStudyCardText() {
      return page.evaluate(() => window.__terraPlay.getStudyCardText());
    },
    async getHUDText() {
      return page.evaluate(() => window.__terraPlay.getHUDText());
    },
    async getNotifications() {
      return page.evaluate(() => window.__terraPlay.getNotifications());
    },
    async validateScreen() {
      return page.evaluate(() => window.__terraPlay.validateScreen());
    },

    // ── Navigation ──────────────────────────
    async navigate(screen) {
      return page.evaluate((s) => window.__terraPlay.navigate(s), screen);
    },
    async getScreen() {
      return page.evaluate(() => window.__terraPlay.getScreen());
    },
    async getAvailableScreens() {
      return page.evaluate(() => window.__terraPlay.getAvailableScreens());
    },

    // ── Card Roguelite — Run Management ─────
    async startRun() {
      return page.evaluate(() => window.__terraPlay.startRun());
    },
    async selectDomain(domain) {
      return page.evaluate((d) => window.__terraPlay.selectDomain(d), domain);
    },
    async selectArchetype(archetype) {
      return page.evaluate((a) => window.__terraPlay.selectArchetype(a), archetype);
    },

    // ── Card Roguelite — Combat ─────────────
    async getCombatState() {
      return page.evaluate(() => window.__terraPlay.getCombatState());
    },
    async playCard(index) {
      return page.evaluate((i) => window.__terraPlay.playCard(i), index);
    },
    async endTurn() {
      return page.evaluate(() => window.__terraPlay.endTurn());
    },

    // ── Card Roguelite — Room & Reward ──────
    async selectRoom(index) {
      return page.evaluate((i) => window.__terraPlay.selectRoom(i), index);
    },
    async acceptReward() {
      return page.evaluate(() => window.__terraPlay.acceptReward());
    },
    async selectRewardType(cardType) {
      return page.evaluate((t) => window.__terraPlay.selectRewardType(t), cardType);
    },
    async retreat() {
      return page.evaluate(() => window.__terraPlay.retreat());
    },
    async delve() {
      return page.evaluate(() => window.__terraPlay.delve());
    },
    async getRunState() {
      return page.evaluate(() => window.__terraPlay.getRunState());
    },
    async restHeal() {
      return page.evaluate(() => window.__terraPlay.restHeal());
    },
    async restUpgrade() {
      return page.evaluate(() => window.__terraPlay.restUpgrade());
    },
    async mysteryContinue() {
      return page.evaluate(() => window.__terraPlay.mysteryContinue());
    },

    // ── Quiz ────────────────────────────────
    async getQuiz() {
      return page.evaluate(() => window.__terraPlay.getQuiz());
    },
    async answerQuiz(choiceIndex) {
      return page.evaluate((i) => window.__terraPlay.answerQuiz(i), choiceIndex);
    },
    async answerQuizCorrectly() {
      return page.evaluate(() => window.__terraPlay.answerQuizCorrectly());
    },
    async answerQuizIncorrectly() {
      return page.evaluate(() => window.__terraPlay.answerQuizIncorrectly());
    },

    // ── Study ───────────────────────────────
    async startStudy(size) {
      return page.evaluate((s) => window.__terraPlay.startStudy(s), size);
    },
    async getStudyCard() {
      return page.evaluate(() => window.__terraPlay.getStudyCard());
    },
    async gradeCard(button) {
      return page.evaluate((b) => window.__terraPlay.gradeCard(b), button);
    },
    async endStudy() {
      return page.evaluate(() => window.__terraPlay.endStudy());
    },

    // ── Dome ────────────────────────────────
    async enterRoom(roomId) {
      return page.evaluate((r) => window.__terraPlay.enterRoom(r), roomId);
    },
    async exitRoom() {
      return page.evaluate(() => window.__terraPlay.exitRoom());
    },

    // ── Economy/State ───────────────────────
    async getInventory() {
      return page.evaluate(() => window.__terraPlay.getInventory());
    },
    async getSave() {
      return page.evaluate(() => window.__terraPlay.getSave());
    },
    async getStats() {
      return page.evaluate(() => window.__terraPlay.getStats());
    },
    async fastForward(hours) {
      return page.evaluate((h) => window.__terraPlay.fastForward(h), hours);
    },
    async getRecentEvents(n) {
      return page.evaluate((num) => window.__terraPlay.getRecentEvents(num), n);
    },
    async getSessionSummary() {
      return page.evaluate(() => window.__terraPlay.getSessionSummary());
    },

    // ── Utilities ───────────────────────────
    async screenshot(path) {
      const p = path || `/tmp/playtest-${Date.now()}.png`;
      await page.screenshot({ path: p, fullPage: true });
      return p;
    },
    async wait(ms) {
      await page.waitForTimeout(ms || 500);
    },
    async cleanup() {
      await browser.close();
    },

    // ── Layout Assertions ─────────────────
    /**
     * Check if critical interactive elements are visible in the viewport.
     * Returns { allPassed, failures, results } where failures lists elements
     * that exist but are off-screen, hidden, or unclickable.
     * @param {Object<string,string>} selectors - map of name → data-testid (or CSS selector)
     */
    async checkLayout(selectors) {
      return page.evaluate((sels) => {
        const results = {};
        for (const [name, sel] of Object.entries(sels)) {
          const el = document.querySelector(`[data-testid="${sel}"]`) || document.querySelector(sel);
          if (!el) { results[name] = { found: false }; continue; }
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const vh = window.innerHeight, vw = window.innerWidth;
          results[name] = {
            found: true,
            inViewport: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
            visible: s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0,
            clickable: s.pointerEvents !== 'none',
            rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) },
            clipped: r.bottom > vh ? 'below-viewport' : r.top < 0 ? 'above-viewport' : null,
            viewportHeight: vh,
          };
        }
        const fails = Object.entries(results).filter(([_, v]) => v.found && (!v.inViewport || !v.visible));
        return { allPassed: fails.length === 0, failures: fails.map(([k, v]) => ({ element: k, ...v })), results };
      }, selectors);
    },

    /**
     * Pre-defined layout checks for common screens. Returns checkLayout results.
     * @param {string} screenName - one of: hub, combat, quizOverlay, cardReward, roomSelection, retreatOrDelve, runEnd, restRoom
     */
    async checkScreenLayout(screenName) {
      const SCREEN_SELECTORS = {
        hub: { startRun: 'btn-start-run' },
        combat: { card0: 'card-hand-0', endTurn: 'btn-end-turn' },
        quizOverlay: { answer0: 'quiz-answer-0', answer1: 'quiz-answer-1', answer2: 'quiz-answer-2' },
        cardReward: { accept: 'reward-accept' },
        roomSelection: { room0: 'room-choice-0', room1: 'room-choice-1', room2: 'room-choice-2' },
        retreatOrDelve: { retreat: 'btn-retreat', delve: 'btn-delve' },
        runEnd: { playAgain: 'btn-play-again', home: 'btn-home' },
        restRoom: { heal: 'rest-heal', upgrade: 'rest-upgrade' },
      };
      const selectors = SCREEN_SELECTORS[screenName];
      if (!selectors) return { allPassed: true, failures: [], results: {}, note: `No layout checks defined for ${screenName}` };
      return this.checkLayout(selectors);
    },

    // ── Convenience — High-Level Helpers ────
    /**
     * Click any element by data-testid. Useful for one-off buttons not covered by API.
     */
    async clickTestId(testId) {
      await page.click(`[data-testid="${testId}"]`, { force: true, timeout: 5000 });
      await page.waitForTimeout(1000);
    },

    /**
     * Wait for a specific screen, polling every 500ms.
     * @returns {Promise<boolean>} true if reached, false if timeout
     */
    async waitForScreen(expected, timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const current = await this.getScreen();
        if (current === expected) return true;
        await page.waitForTimeout(500);
      }
      return false;
    },

    /**
     * Read compact game state in one call.
     * Returns { screen, playerHp, enemyHp, enemyName, handSize, combo, turnNum, floor, segment, gold }
     */
    async getState() {
      return page.evaluate(() => {
        const read = (key) => {
          const s = globalThis[Symbol.for(key)];
          if (!s) return null;
          let v;
          s.subscribe(x => { v = x; })();
          return v;
        };
        const save = read('terra:playerSave');
        const turn = read('terra:activeTurnState');
        const run = read('terra:activeRunState');
        return {
          screen: read('terra:currentScreen'),
          playerHp: turn?.playerHP,
          enemyHp: turn?.enemy?.health,
          enemyName: turn?.enemy?.name,
          handSize: turn?.deck?.hand?.length,
          combo: turn?.comboMultiplier,
          turnNum: turn?.turn,
          floor: run?.currentFloor,
          segment: run?.currentSegment,
          gold: run?.currency,
        };
      });
    },

    /**
     * Start a full run: hub → domain → archetype → combat.
     * @returns {Promise<object>} the initial combat state
     */
    async startFullRun(domain = 'animals_wildlife', archetype = 'balanced') {
      const screen = await this.getScreen();
      if (screen !== 'hub' && screen !== 'base') {
        await this.navigate('hub');
        await this.wait(1000);
      }
      await this.startRun();
      await this.wait(1500);
      await this.selectDomain(domain);
      await this.wait(1000);
      await this.selectArchetype(archetype);
      await this.wait(2000);
      return this.getCombatState();
    },

    /**
     * Play one combat turn: play up to N cards (answering correctly), then end turn.
     * @returns {Promise<object>} { cardsPlayed, quizzesAnswered, combatState }
     */
    async playTurn(maxCards = 3) {
      let cardsPlayed = 0;
      let quizzesAnswered = 0;

      for (let i = 0; i < maxCards; i++) {
        const state = await this.getCombatState();
        if (!state || state.handSize === 0) break;

        const result = await this.playCard(i);
        if (!result?.ok) break;
        cardsPlayed++;

        // Wait for quiz to appear, then answer
        await this.wait(800);
        const quiz = await this.getQuiz();
        if (quiz) {
          await this.answerQuizCorrectly();
          quizzesAnswered++;
          await this.wait(1000);
        }
      }

      await this.endTurn();
      await this.wait(2000);

      return {
        cardsPlayed,
        quizzesAnswered,
        combatState: await this.getCombatState(),
      };
    },

    /**
     * Play a full encounter (multiple turns until encounter ends or screen changes).
     * @returns {Promise<object>} { turns, totalCardsPlayed, totalQuizzes, finalScreen }
     */
    async playEncounter(maxTurns = 10, cardsPerTurn = 3) {
      let turns = 0;
      let totalCardsPlayed = 0;
      let totalQuizzes = 0;

      for (let t = 0; t < maxTurns; t++) {
        const screen = await this.getScreen();
        if (screen !== 'combat') break;

        const result = await this.playTurn(cardsPerTurn);
        turns++;
        totalCardsPlayed += result.cardsPlayed;
        totalQuizzes += result.quizzesAnswered;

        // Check if encounter ended (screen changed)
        await this.wait(1500);
        const newScreen = await this.getScreen();
        if (newScreen !== 'combat') break;
      }

      return {
        turns,
        totalCardsPlayed,
        totalQuizzes,
        finalScreen: await this.getScreen(),
      };
    },

    /**
     * Get filtered console errors (excludes WebSocket, HMR, CORS, GPU stall noise).
     * @returns {Promise<array>} last 10 real errors
     */
    async getFilteredErrors() {
      return page.evaluate(() => {
        const NOISE = [
          /WebSocket/i, /\[vite\]/i, /failed to load resource/i,
          /GPU stall/i, /net::ERR_/i, /CORS/i, /api\//i,
          /favicon/i, /service.worker/i, /hmr/i,
        ];
        const log = window.__terraLog;
        if (!Array.isArray(log)) return [];
        return log
          .filter(e => e.type === 'error' && !NOISE.some(p => p.test(e.detail)))
          .slice(-10);
      });
    },

    /**
     * Take a screenshot at a named checkpoint.
     * @returns {Promise<string>} the file path
     */
    async checkpoint(name) {
      const path = `/tmp/playtest-${name}-${Date.now()}.png`;
      await page.screenshot({ path, fullPage: true });
      return path;
    },
  };

  return tester;
}

module.exports = { createPlaytester };
