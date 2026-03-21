import type { EnemyIntent, EnemyTemplate } from '../data/enemies';

export const MAX_ASCENSION_LEVEL = 20;

export interface AscensionLevelRule {
  level: number;
  name: string;
  effect: string;
}

export const ASCENSION_LEVEL_RULES: AscensionLevelRule[] = [
  { level: 1, name: 'First Trial', effect: '+1 elite per segment. BUFF: Choose 1 of 3 starter relics.' },
  { level: 2, name: 'Aggressive Foes', effect: 'Enemies +10% damage. BUFF: +1 AP on first turn of each encounter.' },
  { level: 3, name: 'Scarce Healing', effect: 'Rest heals 25% instead of 30%. BUFF: Free card removal at rest.' },
  { level: 4, name: 'Quick Thinking', effect: 'Timer -1s on all questions. BUFF: Start with a random uncommon card.' },
  { level: 5, name: 'Lean Start', effect: 'Start with 12 cards. BUFF: One free card removal per shop visit.' },
  { level: 6, name: 'No Escape', effect: 'Cannot flee encounters. BUFF: Heal 5 HP on 3+ combo.' },
  { level: 7, name: 'Harsh Grading', effect: 'Close distractors more common. BUFF: Charged correct +15% damage.' },
  { level: 8, name: 'Elite Surge', effect: 'Mini-bosses gain boss-tier attacks. BUFF: Mini-boss victories always drop a relic.' },
  { level: 9, name: 'Undying Foes', effect: 'Enemies regenerate 2 HP/turn. BUFF: Start encounters with 3 shield.' },
  { level: 10, name: 'Cursed Start', effect: 'Start with a Curse card in deck. BUFF: Choose a 2nd starter relic + 1 free relic reroll per boss.' },
  { level: 11, name: 'Slim Pickings', effect: 'Boss relics reduced to 2 choices. BUFF: Relics trigger +50% more.' },
  { level: 12, name: 'Deep Knowledge', effect: 'Tier 1 cards use 4-option MCQ. BUFF: Tier 1 charged correct +20% damage.' },
  { level: 13, name: 'Fragile', effect: 'Player max HP reduced to 80. BUFF: Start with Vitality Ring (+20 HP, takes slot).' },
  { level: 14, name: 'Combo Breaker', effect: 'Combo resets each turn. BUFF: Perfect turns grant +1 AP next turn.' },
  { level: 15, name: 'Boss Rush', effect: 'Bosses +25% HP. BUFF: Boss defeat fully heals player.' },
  { level: 16, name: 'No Echo', effect: 'Echo mechanic disabled. BUFF: Discarding a card grants 1 shield.' },
  { level: 17, name: "Scholar's Burden", effect: 'Wrong answers deal 3 self-damage. BUFF: Correct answers heal 1 HP.' },
  { level: 18, name: 'Minimalist', effect: 'Start with 10 cards. BUFF: Choose starting hand each encounter.' },
  { level: 19, name: 'True Test', effect: 'All questions use hard formats. BUFF: Charge plays cost 0 extra AP.' },
  { level: 20, name: 'Heart of the Archive', effect: 'Final boss gains second phase. BUFF: Start with 3 relics (choose from 7).' },
];

export interface AscensionModifiers {
  level: number;
  // --- Existing challenge fields ---
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  shieldCardMultiplier: number;
  timerBasePenaltySeconds: number;
  encounterTwoTimerPenaltySeconds: number;
  starterDeckSizeOverride: number | null;
  preventFlee: boolean;
  preferCloseDistractors: boolean;
  miniBossBossTierAttacks: boolean;
  minRetreatFloorForRewards: number | null;
  relicCap: number;
  tier1OptionCount: number;
  playerMaxHpOverride: number | null;
  bossHpMultiplier: number;
  wrongAnswerSelfDamage: number;
  forceHardQuestionFormats: boolean;
  curatorSecretSecondPhase: boolean;
  // --- New challenge fields ---
  enemyRegenPerTurn: number;
  startWithCurseCard: boolean;
  restHealMultiplier: number;
  // --- New buff fields ---
  starterRelicChoice: boolean;
  firstTurnBonusAp: number;
  freeRestCardRemoval: boolean;
  freeShopCardRemoval: boolean;
  chargeCorrectDamageBonus: number;
  miniBossGuaranteedRelic: boolean;
  encounterStartShield: number;
  freeRelicReroll: boolean;
  relicTriggerBonus: number;
  tier1ChargedDamageBonus: number;
  perfectTurnBonusAp: number;
  bossDefeatFullHeal: boolean;
  discardGivesShield: number;
  correctAnswerHeal: number;
  chooseStartingHand: boolean;
  freeCharging: boolean;
  startingRelicCount: number;
}

function clampAscensionLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_ASCENSION_LEVEL, Math.floor(level)));
}

export function getAscensionModifiers(level: number): AscensionModifiers {
  const l = clampAscensionLevel(level);
  return {
    level: l,
    // --- Challenges (cumulative) ---
    enemyHpMultiplier: 1.00,  // No global HP mult anymore — elites handle difficulty
    enemyDamageMultiplier: l >= 2 ? 1.10 : 1.00,
    shieldCardMultiplier: 1.00,  // Removed — wasn't fun
    timerBasePenaltySeconds: l >= 4 ? 1 : 0,
    encounterTwoTimerPenaltySeconds: 0,  // Removed — not relevant to sim
    starterDeckSizeOverride: l >= 18 ? 10 : l >= 5 ? 12 : null,
    preventFlee: l >= 6,
    preferCloseDistractors: l >= 7,
    miniBossBossTierAttacks: l >= 8,
    minRetreatFloorForRewards: null,  // Removed — boring
    relicCap: l >= 11 ? 2 : 3,
    tier1OptionCount: l >= 12 ? 4 : 3,
    playerMaxHpOverride: l >= 13 ? 80 : null,
    bossHpMultiplier: l >= 15 ? 1.25 : 1.00,
    wrongAnswerSelfDamage: l >= 17 ? 3 : 0,
    forceHardQuestionFormats: l >= 19,
    curatorSecretSecondPhase: l >= 20,
    restHealMultiplier: l >= 3 ? 0.83 : 1.00,  // 25/30 = 0.83
    enemyRegenPerTurn: l >= 9 ? 2 : 0,
    startWithCurseCard: l >= 10,
    // --- Buffs (cumulative) ---
    starterRelicChoice: l >= 1,
    firstTurnBonusAp: l >= 2 ? 1 : 0,
    freeRestCardRemoval: l >= 3,
    freeShopCardRemoval: l >= 5,
    chargeCorrectDamageBonus: l >= 7 ? 0.15 : 0,
    miniBossGuaranteedRelic: l >= 8,
    encounterStartShield: l >= 9 ? 3 : 0,
    freeRelicReroll: l >= 10,
    relicTriggerBonus: l >= 11 ? 0.50 : 0,
    tier1ChargedDamageBonus: l >= 12 ? 0.20 : 0,
    perfectTurnBonusAp: l >= 14 ? 1 : 0,
    bossDefeatFullHeal: l >= 15,
    discardGivesShield: l >= 16 ? 1 : 0,
    correctAnswerHeal: l >= 17 ? 1 : 0,
    chooseStartingHand: l >= 18,
    freeCharging: l >= 19,
    startingRelicCount: l >= 20 ? 3 : l >= 10 ? 2 : l >= 1 ? 1 : 0,
  };
}

function scaleIntentForBossTier(intent: EnemyIntent): EnemyIntent {
  if (intent.type !== 'attack' && intent.type !== 'multi_attack') return intent;
  const boosted = Math.max(10, Math.round(intent.value * 1.35));
  return { ...intent, value: boosted };
}

function withMiniBossBossTierAttacks(template: EnemyTemplate): EnemyTemplate {
  if (template.category !== 'mini_boss') return template;
  return {
    ...template,
    intentPool: template.intentPool.map(scaleIntentForBossTier),
    phase2IntentPool: template.phase2IntentPool?.map(scaleIntentForBossTier),
  };
}

function withCuratorSecretSecondPhase(template: EnemyTemplate): EnemyTemplate {
  if (template.id !== 'the_curator') return template;
  const basePhase2 = template.phase2IntentPool ?? [];
  const upgradedPhase2 = basePhase2.length > 0
    ? basePhase2.map((intent) => {
      if (intent.type === 'attack' || intent.type === 'multi_attack') {
        return { ...intent, value: Math.max(12, Math.round(intent.value * 1.2)) };
      }
      if (intent.type === 'debuff' && intent.statusEffect) {
        return {
          ...intent,
          statusEffect: { ...intent.statusEffect, value: intent.statusEffect.value + 1 },
        };
      }
      return intent;
    })
    : [
      { type: 'attack' as const, value: 26, weight: 3, telegraph: 'Archive Cataclysm' },
      { type: 'multi_attack' as const, value: 8, weight: 2, telegraph: 'Forbidden Barrage', hitCount: 4 },
      {
        type: 'debuff' as const,
        value: 4,
        weight: 2,
        telegraph: 'Entropy Script',
        statusEffect: { type: 'vulnerable' as const, value: 3, turns: 3 },
      },
    ];

  return {
    ...template,
    phaseTransitionAt: template.phaseTransitionAt ?? 0.6,
    phase2IntentPool: upgradedPhase2,
  };
}

function withoutCuratorSecondPhase(template: EnemyTemplate): EnemyTemplate {
  if (template.id !== 'the_curator') return template;
  return {
    ...template,
    phaseTransitionAt: undefined,
    phase2IntentPool: undefined,
  };
}

/**
 * Applies ascension-only enemy template changes without mutating the source template.
 */
export function applyAscensionEnemyTemplateAdjustments(
  template: EnemyTemplate,
  floor: number,
  modifiers: AscensionModifiers,
): EnemyTemplate {
  let adjusted: EnemyTemplate = { ...template };

  if (modifiers.miniBossBossTierAttacks) {
    adjusted = withMiniBossBossTierAttacks(adjusted);
  }

  if (adjusted.id === 'the_curator' && floor === 24) {
    adjusted = modifiers.curatorSecretSecondPhase
      ? withCuratorSecretSecondPhase(adjusted)
      : withoutCuratorSecondPhase(adjusted);
  }

  return adjusted;
}

export function getAscensionRule(level: number): AscensionLevelRule | null {
  const clamped = clampAscensionLevel(level);
  if (clamped <= 0) return null;
  return ASCENSION_LEVEL_RULES.find((rule) => rule.level === clamped) ?? null;
}
