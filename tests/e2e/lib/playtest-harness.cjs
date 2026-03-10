/**
 * Playtest harness — wraps window.__terraPlay for Node.js Playwright scripts.
 * Usage:
 *   const { createPlaytester } = require('./lib/playtest-harness.cjs');
 *   const tester = await createPlaytester({ preset: 'mid_game_3_rooms' });
 *   const view = await tester.look();
 *   await tester.mineBlock('down');
 *   await tester.cleanup();
 */

const { chromium } = require('/root/terra-miner/node_modules/playwright-core');
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
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

    // ── Mining ──────────────────────────────
    async mineBlock(direction) {
      return page.evaluate((d) => window.__terraPlay.mineBlock(d), direction);
    },
    async mineAt(x, y) {
      return page.evaluate(({x, y}) => window.__terraPlay.mineAt(x, y), {x, y});
    },
    async startDive(tanks) {
      return page.evaluate((t) => window.__terraPlay.startDive(t), tanks);
    },
    async endDive() {
      return page.evaluate(() => window.__terraPlay.endDive());
    },
    async useBomb() {
      return page.evaluate(() => window.__terraPlay.useBomb());
    },
    async useScanner() {
      return page.evaluate(() => window.__terraPlay.useScanner());
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
  };

  return tester;
}

module.exports = { createPlaytester };
