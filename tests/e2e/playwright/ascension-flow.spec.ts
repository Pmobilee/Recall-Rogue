import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const ONBOARDING_COMPLETE = {
  hasCompletedOnboarding: true,
  hasSeenCardTapTooltip: true,
  hasSeenCastTooltip: true,
  hasSeenAnswerTooltip: true,
  hasSeenEndTurnTooltip: true,
  hasSeenAPTooltip: true,
  runsCompleted: 5,
}

async function seedAscensionProfile(
  page: Page,
  highestUnlockedLevel: number,
  selectedLevel: number,
): Promise<void> {
  await page.addInitScript(({ onboarding, highest, selected }) => {
    window.localStorage.setItem('card:onboardingState', JSON.stringify(onboarding))
    window.localStorage.setItem('card:ascensionProfile', JSON.stringify({
      highestUnlockedLevel: highest,
      selectedLevel: selected,
    }))
  }, {
    onboarding: ONBOARDING_COMPLETE,
    highest: highestUnlockedLevel,
    selected: selectedLevel,
  })
}

async function seedSavedRetreatState(
  page: Page,
  options: {
    ascensionLevel: number
    floor?: number
    screen?: 'retreatOrDelve' | 'roomSelection'
    roomOptions?: Array<{ type: 'combat' | 'mystery' | 'rest' | 'treasure' | 'shop'; icon: string; label: string; detail: string; hidden: boolean }>
  },
): Promise<void> {
  await page.addInitScript(({ onboarding, config }) => {
    window.localStorage.setItem('card:onboardingState', JSON.stringify(onboarding))
    window.localStorage.setItem('card:ascensionProfile', JSON.stringify({
      highestUnlockedLevel: 0,
      selectedLevel: 0,
    }))

    const runFloor = config.floor ?? 9
    const level = config.ascensionLevel

    const runState = {
      isActive: true,
      primaryDomain: 'history',
      secondaryDomain: 'geography',
      selectedArchetype: 'balanced',
      starterDeckSize: 15,
      startingAp: 3,
      primaryDomainRunNumber: 1,
      earlyBoostActive: true,
      floor: {
        currentFloor: runFloor,
        currentEncounter: 3,
        encountersPerFloor: 3,
        eventsPerFloor: 2,
        isBossFloor: true,
        bossDefeated: true,
        segment: runFloor <= 6 ? 1 : runFloor <= 12 ? 2 : runFloor <= 18 ? 3 : 4,
      },
      playerHp: 76,
      playerMaxHp: 90,
      currency: 120,
      cardsEarned: 3,
      factsAnswered: 12,
      factsCorrect: 10,
      bestCombo: 4,
      correctAnswers: 10,
      newFactsLearned: 0,
      factsMastered: 0,
      encountersWon: 7,
      encountersTotal: 8,
      currentEncounterWrongAnswers: 0,
      bounties: [],
      canary: {
        mode: 'normal',
        enemyDamageMultiplier: 1,
        questionBias: 0,
      },
      startedAt: Date.now() - 5 * 60 * 1000,
      echoFactIds: [],
      echoCount: 0,
      consumedRewardFactIds: [],
      factsAnsweredCorrectly: [],
      factsAnsweredIncorrectly: [],
      runAccuracyBonusApplied: false,
      endlessEnemyDamageMultiplier: 1,
      ascensionLevel: level,
      retreatRewardLocked: false,
    }

    window.localStorage.setItem('recall-rogue-active-run', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      runState,
      currentScreen: config.screen ?? 'retreatOrDelve',
      runMode: 'standard',
      dailySeed: null,
      roomOptions: config.roomOptions ?? [],
    }))
  }, {
    onboarding: ONBOARDING_COMPLETE,
    config: options,
  })
}

test('ascension selector persists across domain setup reopen', async ({ page }) => {
  await seedAscensionProfile(page, 6, 3)

  await page.goto('/')
  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(800)

  await page.getByTestId('btn-start-run').click()
  await expect(page.getByText('Level 3')).toBeVisible()

  await page.getByTestId('ascension-increase').click()
  await expect(page.getByText('Level 4')).toBeVisible()

  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByTestId('btn-start-run')).toBeVisible()
  await page.getByTestId('btn-start-run').click()
  await expect(page.getByText('Level 4')).toBeVisible()
})

test('ascension level 6 disables flee from campfire', async ({ page }) => {
  await seedSavedRetreatState(page, {
    ascensionLevel: 6,
    floor: 4,
    screen: 'roomSelection',
    roomOptions: [
      { type: 'rest', icon: '🔥', label: 'Rest', detail: 'Recover HP', hidden: false },
    ],
  })

  await page.goto('/')
  await expect(page.getByTestId('active-run-banner')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('btn-resume-run').click()

  await expect(page.getByTestId('btn-pause-room')).toBeVisible({ timeout: 20_000 })
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="btn-pause-room"]') as HTMLButtonElement | null
    btn?.click()
  })
  await expect(page.getByTestId('btn-campfire-resume')).toBeVisible()
  await expect(page.getByText(/cannot be fled/i)).toBeVisible()
  await expect(page.getByTestId('btn-campfire-hub')).toHaveCount(0)
})

test('ascension level 10 shows retreat reward lock messaging', async ({ page }) => {
  await seedSavedRetreatState(page, { ascensionLevel: 10, floor: 9 })

  await page.goto('/')
  await expect(page.getByTestId('active-run-banner')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('btn-resume-run').click()

  await expect(page.getByText('SEGMENT CLEARED')).toBeVisible()
  await expect(page.getByText(/No rewards before Floor 12/)).toBeVisible()
})

test('successful floor 9 retreat unlocks ascension level 1', async ({ page }) => {
  await seedSavedRetreatState(page, { ascensionLevel: 0, floor: 9 })

  await page.goto('/')
  await expect(page.getByTestId('active-run-banner')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('btn-resume-run').click()

  await expect(page.getByRole('button', { name: /Retreat/i })).toBeVisible()
  await page.getByRole('button', { name: /Retreat/i }).click()

  await expect(page.getByTestId('btn-start-run')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('btn-start-run').click()
  await expect(page.getByText('Unlocked: 1')).toBeVisible()
})
