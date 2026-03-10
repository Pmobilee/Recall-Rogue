const { chromium } = require('/root/terra-miner/node_modules/playwright-core');

const factIds = [
  'TUTORIAL_ARTIFACT_001',
  'cult-001', 'cult-002', 'cult-003', 'cult-004', 'cult-005', 'cult-006', 'cult-007', 'cult-008', 'cult-009', 'cult-010',
  'cult-011', 'cult-012', 'cult-013', 'cult-014', 'cult-015', 'cult-016', 'cult-017', 'cult-018', 'cult-019', 'cult-020',
  'fossil_amber_orchid_01', 'fossil_amber_orchid_02', 'fossil_amber_orchid_03', 'fossil_amber_orchid_04', 'fossil_amber_orchid_05', 'fossil_amber_orchid_06',
  'fossil_amber_orchid_07', 'fossil_amber_orchid_08', 'fossil_amber_orchid_09', 'fossil_amber_orchid_10',
  'fossil_ammonite_01', 'fossil_ammonite_02', 'fossil_ammonite_03', 'fossil_ammonite_04', 'fossil_ammonite_05', 'fossil_ammonite_06',
  'fossil_ammonite_07', 'fossil_ammonite_08', 'fossil_ammonite_09', 'fossil_ammonite_10',
  'fossil_ancient_corn_01', 'fossil_ancient_corn_02', 'fossil_ancient_corn_03', 'fossil_ancient_corn_04', 'fossil_ancient_corn_05', 'fossil_ancient_corn_06',
  'fossil_ancient_corn_07', 'fossil_ancient_corn_08', 'fossil_ancient_corn_09', 'fossil_ancient_corn_10',
  'fossil_ancient_rice_01', 'fossil_ancient_rice_02', 'fossil_ancient_rice_03', 'fossil_ancient_rice_04', 'fossil_ancient_rice_05',
  'fossil_ancient_rice_06', 'fossil_ancient_rice_07', 'fossil_ancient_rice_08', 'fossil_ancient_rice_09', 'fossil_ancient_rice_10',
];

const sessionConfigs = [
  { label: '5 Quick', buttonIndex: 0, againLimit: 2 },
  { label: '10 Standard', buttonIndex: 1, againLimit: 3 },
];

async function preflight(page) {
  const result = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    localStorage.clear();
    return { swsRemoved: regs.length, storageCleared: true };
  });
  console.log('[preflight]', result);
}

async function injectSave(page) {
  await page.evaluate((ids) => {
    const now = Date.now();
    const MS_PER_DAY = 86400000;
    const reviewStates = ids.map((factId, index) => ({
      factId,
      cardState: 'review',
      easeFactor: index < 4 ? 2.8 : 2.5,
      interval: 7,
      repetitions: index < 4 ? 6 : 3,
      nextReviewAt: now - MS_PER_DAY * 2,
      lastReviewAt: now - MS_PER_DAY * 2,
      quality: 3,
      learningStep: 0,
      lapseCount: 0,
      isLeech: false,
    }));

    const save = {
      version: 1,
      factDbVersion: 0,
      playerId: 'playthrough-q16',
      ageRating: 'teen',
      createdAt: now,
      lastPlayedAt: now,
      oxygen: 3,
      minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
      learnedFacts: ids,
      reviewStates,
      soldFacts: [],
      discoveredFacts: [],
      stats: {
        totalBlocksMined: 0,
        totalDivesCompleted: 0,
        deepestLayerReached: 0,
        totalFactsLearned: ids.length,
        totalFactsSold: 0,
        totalQuizCorrect: 0,
        totalQuizWrong: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalSessions: 0,
        zeroDiveSessions: 0,
      },
      lastDiveDate: undefined,
      unlockedDiscs: [],
      craftedItems: {},
      craftCounts: {},
      activeConsumables: [],
      insuredDive: false,
      ownedCosmetics: [],
      equippedCosmetic: null,
      purchasedDeals: [],
      lastDealDate: undefined,
      fossils: {},
      activeCompanion: null,
      lastMorningReview: undefined,
      lastEveningReview: undefined,
      knowledgePoints: 0,
      purchasedKnowledgeItems: [],
      unlockedRooms: ['command'],
      farm: { slots: [null, null, null], maxSlots: 3 },
      premiumMaterials: {},
      streakFreezes: 0,
      lastStreakMilestone: 0,
      claimedMilestones: [],
      streakProtected: false,
      titles: [],
      activeTitle: null,
      hubState: { unlockedFloorIds: ['starter'], floorTiers: { starter: 0 } },
      interestConfig: { weights: {}, lockedCategories: [] },
      behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
      archetypeData: { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null },
      engagementData: { dailySnapshots: [], currentScore: 50, mode: 'normal' },
      tutorialComplete: true,
      hasCompletedInitialStudy: true,
      selectedInterests: ['Generalist'],
      interestWeights: {},
      diveCount: 0,
      tutorialStep: 0,
      activeFossil: null,
      studySessionsCompleted: 0,
      pendingArtifacts: [],
      ownedPickaxes: ['standard_pick'],
    };

    localStorage.setItem('terra_guest_mode', 'true');
    localStorage.setItem('terra_age_bracket', 'teen');
    localStorage.setItem('recall_rogue_save', JSON.stringify(save));
    localStorage.setItem('terra_save', JSON.stringify(save));
    return ids.length;
  }, factIds);
}

async function verifySave(page) {
  const verify = await page.evaluate(() => {
    const store = globalThis[Symbol.for('terra:playerSave')];
    if (!store) return { error: 'no store' };
    let data;
    store.subscribe(x => { data = x })();
    const screenStore = globalThis[Symbol.for('terra:currentScreen')];
    let screen;
    screenStore?.subscribe(x => { screen = x })();
    return {
      loaded: !!data,
      factCount: data?.learnedFacts?.length ?? -1,
      reviewStateCount: data?.reviewStates?.length ?? -1,
      oxygen: data?.oxygen ?? -1,
      currentScreen: screen,
    };
  });
  console.log('[verify]', verify);
}

async function waitForGameManager(page) {
  await page.waitForFunction(() => {
    const store = globalThis[Symbol.for('terra:gameManagerStore')];
    let value;
    store?.subscribe(v => { value = v })();
    return !!value;
  });
}

async function startStudySession(page) {
  await waitForGameManager(page);
  await page.evaluate(() => {
    const store = globalThis[Symbol.for('terra:gameManagerStore')];
    let gm;
    store?.subscribe(v => { gm = v })();
    gm?.startStudySession?.();
  });
  await page.waitForFunction(() => {
    const screenStore = globalThis[Symbol.for('terra:currentScreen')];
    let screen;
    screenStore?.subscribe(v => { screen = v })();
    return screen === 'studySession';
  }, { timeout: 15000 });
}

async function runSession(page, config) {
  const { label, buttonIndex, againLimit } = config;
  console.log(`[session] preparing ${label}`);
  await page.waitForSelector('button.size-btn', { timeout: 6000 });
  const buttons = page.locator('button.size-btn');
  await buttons.nth(buttonIndex).click({ force: true });
  const startTime = Date.now();
  let cardsSeen = 0;
  let againUsed = 0;
  const history = [];

  while (true) {
    await page.waitForSelector('.card-face.card-front', { timeout: 10000 });
    const question = await page.locator('.card-question').innerText();
    history.push(question);
    await page.locator('.reveal-btn').click({ force: true });
    await page.waitForSelector('.card-face.card-back', { timeout: 7000 });
    const rating = againUsed < againLimit ? (() => { againUsed++; return 'again'; })() : 'good';
    await page.locator(`button.rating-btn--${rating}`).click({ force: true });
    cardsSeen++;
    await page.waitForTimeout(200);
    const done = await page.locator('.complete-screen').isVisible({ timeout: 500 }).catch(() => false);
    if (done) break;
  }

  const durationMs = Date.now() - startTime;
  const uniqueCount = new Set(history).size;
  await page.locator('button.return-btn').click({ force: true });
  await page.waitForFunction(() => {
    const screenStore = globalThis[Symbol.for('terra:currentScreen')];
    let screen;
    screenStore?.subscribe(v => { screen = v })();
    return screen === 'base';
  }, { timeout: 10000 });
  console.log(`[session] ${label} complete: cards=${cardsSeen}, unique=${uniqueCount}, againUsed=${againUsed}, durationMs=${durationMs}`);
  return { label, cardsSeen, uniqueCount, againUsed, durationMs };
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 412, height: 915 });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await preflight(page);
    await injectSave(page);
    await page.goto('http://localhost:5173?skipOnboarding=true', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await verifySave(page);
    await page.screenshot({ path: '/tmp/q16-base.png', fullPage: true });

    await page.evaluate(() => {
      const screenStore = globalThis[Symbol.for('terra:currentScreen')];
      screenStore?.set?.('studyStation');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/q16-study-station.png', fullPage: true });

    const sessionBefore = await page.evaluate(() => {
      const factsStore = globalThis[Symbol.for('terra:studyFacts')];
      let facts;
      factsStore?.subscribe(v => { facts = v })();
      return { readyFacts: facts?.length ?? null };
    });
    console.log('[studyStation] initial ready facts count', sessionBefore.readyFacts);

    await startStudySession(page);
    const results = [];
    for (const config of sessionConfigs) {
      const sessionResult = await runSession(page, config);
      results.push(sessionResult);
      if (config.label === '5 Quick') {
        await startStudySession(page);
      }
    }

    const finalScreen = await page.evaluate(() => {
      const screenStore = globalThis[Symbol.for('terra:currentScreen')];
      let screen;
      screenStore?.subscribe(v => { screen = v })();
      return screen;
    });
    console.log('[final] screen', finalScreen);
    console.log('[results]', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Playthrough error', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
