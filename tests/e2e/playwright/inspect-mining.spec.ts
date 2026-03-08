import { test, expect } from '@playwright/test';

async function buildSave() {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  return {
    version: 1,
    factDbVersion: 0,
    playerId: 'playthrough-debugger',
    ageRating: 'teen',
    createdAt: now - MS_PER_DAY,
    lastPlayedAt: now - MS_PER_DAY,
    oxygen: 3,
    minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
    learnedFacts: [],
    reviewStates: [],
    soldFacts: [],
    discoveredFacts: [],
    stats: {
      totalBlocksMined: 0,
      totalDivesCompleted: 0,
      deepestLayerReached: 0,
      totalFactsLearned: 0,
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
    hasCompletedInitialStudy: false,
    selectedInterests: ['Generalist'],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
    pendingArtifacts: [],
    ownedPickaxes: ['standard_pick'],
  }
}

test('inspect mining stores', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    localStorage.clear();
    return { swsRemoved: regs.length }; // not used
  });
  const save = await buildSave();
  await page.evaluate((payload) => {
    localStorage.setItem('terra_guest_mode', 'true');
    localStorage.setItem('terra_age_bracket', 'teen');
    localStorage.setItem('terra-gacha-save', JSON.stringify(payload));
  }, save);
  await page.goto('/?skipOnboarding=true');
  await page.waitForFunction(() => {
    const store = globalThis[Symbol.for('terra:currentScreen')];
    if (!store) return false;
    let value;
    store.subscribe(v => value = v)();
    return value === 'mainMenu';
  }, null, { timeout: 15000 });
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => {
    const store = globalThis[Symbol.for('terra:currentScreen')];
    if (!store) return false;
    let value;
    store.subscribe(v => value = v)();
    return value === 'base';
  }, null, { timeout: 15000 });
  await page.click('[data-testid="btn-dive"]', { force: true });
  await page.waitForFunction(() => {
    let value;
    const store = globalThis[Symbol.for('terra:currentScreen')];
    if (!store) return false;
    store.subscribe(v => value = v)();
    return value === 'divePrepScreen';
  }, null, { timeout: 10000 });
  await page.click('[data-testid="btn-enter-mine"]', { force: true });
  await page.waitForFunction(() => {
    let value;
    const store = globalThis[Symbol.for('terra:currentScreen')];
    if (!store) return false;
    store.subscribe(v => value = v)();
    return value === 'mining';
  }, null, { timeout: 15000 });
  const debug = await page.evaluate(() => {
    const result: Record<string, unknown> = {};
    const dbg = window.__terraDebug;
    if (typeof dbg === 'function') {
      result.debug = dbg();
    }
    const stores = ['terra:playerSave', 'terra:currentScreen', 'terra:activeQuiz'];
    for (const key of stores) {
      const store = globalThis[Symbol.for(key)];
      if (store) {
        let value;
        store.subscribe(v => value = v)();
        result[key] = value;
      }
    }
    const gaia = globalThis[Symbol.for('terra:gaiaMessage')];
    if (gaia) {
      let value;
      gaia.subscribe(v => value = v)();
      result.gaiaMessage = value;
    }
    return result;
  });
  console.log('debug after mine entry', JSON.stringify(debug, null, 2));
});
