import type { EnemyIntent, EnemyTemplate } from '../data/enemies';

export const MAX_ASCENSION_LEVEL = 20;

export interface AscensionLevelRule {
  level: number;
  name: string;
  effect: string;
}

export const ASCENSION_LEVEL_RULES: AscensionLevelRule[] = [
  { level: 1, name: 'First Trial', effect: '+1 elite per segment.' },
  { level: 2, name: 'Aggressive Foes', effect: 'Enemies +15% damage.' },
  { level: 3, name: 'Scarce Healing', effect: 'Rest heals 25% instead of 30%.' },
  { level: 4, name: 'Quick Thinking', effect: 'Timer -1s on all questions. BUFF: Start with a random uncommon card.' },
  { level: 5, name: 'Lean Start', effect: 'Start with 12 cards. BUFF: Free card removal at rest.' },
  { level: 6, name: 'No Escape', effect: 'Cannot flee encounters. BUFF: Heal 3 HP on 4+ combo.' },
  { level: 7, name: 'Harsh Grading', effect: 'Close distractors more common.' },
  { level: 8, name: 'Elite Surge', effect: 'Mini-bosses gain boss-tier attacks. BUFF: Mini-boss victories always drop a relic. Free card removal at shops.' },
  { level: 9, name: 'Undying Foes', effect: 'Enemies regenerate 3 HP/turn. BUFF: Start encounters with 3 shield.' },
  { level: 10, name: 'Cursed Start', effect: 'Start with a Curse card in deck. BUFF: Choose 1 of 3 starter relics. +1 free relic reroll per boss.' },
  { level: 11, name: 'Slim Pickings', effect: 'Boss relics reduced to 2 choices. BUFF: Relics trigger +15% more.' },
  { level: 12, name: 'Deep Knowledge', effect: 'Tier 1 cards use 4-option MCQ. BUFF: Tier 1 charged correct +20% damage.' },
  { level: 13, name: 'Fragile', effect: 'Player max HP reduced to 75. BUFF: Start with Vitality Ring (+20 HP, takes slot).' },
  { level: 14, name: 'Combo Breaker', effect: 'Combo resets each turn.' },
  // Pass 8 (2026-04-11): Reduced boss HP from +50% to +10% to close the A15-A20 cliff.
  { level: 15, name: 'Boss Rush', effect: 'Bosses +10% HP.' },
  { level: 16, name: 'No Echo', effect: 'Echo mechanic disabled. BUFF: Discarding a card grants 1 shield.' },
  // Pass 8 (2026-04-11): Reduced wrong-answer self-damage from 5 to 3.
  // Pass 9 (Scholar's Inversion): correctAnswerHeal buffed from 1 HP to 2 HP at A17+.
  { level: 17, name: "Scholar's Burden", effect: 'Wrong answers deal 3 self-damage. BUFF: Correct answers heal 2 HP.' },
  { level: 18, name: 'Minimalist', effect: 'Start with 10 cards. BUFF: Choose starting hand each encounter.' },
  { level: 19, name: 'True Test', effect: 'All questions use hard formats. BUFF: (Reserved for future surcharge mechanic.)' },
  { level: 20, name: "Scholar's Inversion", effect: "Wrong charges damage you instead of the enemy. Boss HP bonus, self-damage, and hard formats removed. BUFF: Start with 2 relics. Correct answers heal 2 HP." },
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
  /** A20: wrong-charge damage redirects to player instead of enemy (Scholar's Inversion). */
  scholarsInversion: boolean;
  curatorSecretSecondPhase: boolean;
  // --- New challenge fields ---
  enemyRegenPerTurn: number;
  startWithCurseCard: boolean;
  restHealMultiplier: number;
  /** Whether combo counter resets at the end of each turn (A14). */
  comboResetsOnTurnEnd: boolean;
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
  /** @deprecated CHARGE_AP_SURCHARGE is already 0 — always false until surcharge is restored. */
  freeCharging: boolean;
  startingRelicCount: number;
  /** HP healed when player achieves a combo >= comboHealThreshold (A6). 0 = inactive. */
  comboHealThreshold: number;
  /** Amount healed per combo-heal trigger (A6). */
  comboHealAmount: number;
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
    // Stepped HP multiplier: A9 durability wall, A15 slightly tougher regular enemies
    enemyHpMultiplier: l >= 15 ? 1.15 : l >= 9 ? 1.10 : 1.00,
    // Stepped damage multiplier: A2 raw damage, A8 all enemies scarier, A17 pressure cooker
    // Pass 8 (2026-04-11): Reduced A17 cap 1.30→1.25 to soften the asc15-20 cliff.
    // Primary lever: wrongAnswerSelfDamage and boss HP are the real killers at A17+.
    enemyDamageMultiplier: l >= 17 ? 1.25 : l >= 8 ? 1.20 : l >= 2 ? 1.15 : 1.00,
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
    playerMaxHpOverride: l >= 13 ? 75 : null,
    // Pass 8 (2026-04-11): Reduced boss HP multiplier 1.50→1.10 to close the A15 cliff.
    // Prior 1.50× alone caused a 50pp win-rate drop (A15: 52% → A20: 2% for experienced players).
    // Pass 9 (Scholar's Inversion): A20 removes the boss HP buff entirely — Scholar's Inversion
    // replaces all stacking multipliers (boss HP, self-damage, hard formats) with one unified mechanic.
    bossHpMultiplier: l >= 20 ? 1.00 : l >= 15 ? 1.10 : 1.00,
    // Pass 8 (2026-04-11): Reduced wrong-answer self-damage 5→3.
    // Pass 9 (Scholar's Inversion): A20 removes flat self-damage — the redirect mechanic replaces it.
    wrongAnswerSelfDamage: l >= 20 ? 0 : l >= 17 ? 3 : 0,
    // Pass 9: A20 removes forced hard formats — Scholar's Inversion is the sole A20 challenge.
    forceHardQuestionFormats: l >= 20 ? false : l >= 19,
    curatorSecretSecondPhase: l >= 20,
    // Pass 9 (Scholar's Inversion): wrong-charge fizzle damage hits the player, not the enemy.
    scholarsInversion: l >= 20,
    restHealMultiplier: l >= 3 ? 0.83 : 1.00,  // 25/30 = 0.83
    enemyRegenPerTurn: l >= 9 ? 3 : 0,
    startWithCurseCard: l >= 10,
    comboResetsOnTurnEnd: l >= 14,
    // --- Buffs (cumulative) ---
    // Pass 7: Buffs delayed to higher ascensions. A1-A7 should be pure difficulty increases.
    // StS philosophy: ascension = harder. Buffs are rewards for reaching high levels, not
    // compensation that cancels out the challenge.
    starterRelicChoice: l >= 10,  // was A1 — delayed to A10 (choose-from-3 is powerful)
    firstTurnBonusAp: 0,
    freeRestCardRemoval: l >= 5,  // was A3 — delayed
    freeShopCardRemoval: l >= 8,  // was A5 — delayed
    chargeCorrectDamageBonus: l >= 12 ? 0.10 : 0,  // was A7 — delayed to A12
    miniBossGuaranteedRelic: l >= 8,
    encounterStartShield: l >= 9 ? 2 : 0,  // was 3 — reduced to 2
    freeRelicReroll: l >= 10,
    relicTriggerBonus: l >= 11 ? 0.15 : 0,
    tier1ChargedDamageBonus: l >= 12 ? 0.20 : 0,
    perfectTurnBonusAp: 0,
    bossDefeatFullHeal: false,
    discardGivesShield: l >= 16 ? 1 : 0,
    // Pass 9: buffed from 1→2 HP to compensate for Scholar's Inversion risk at A20.
    correctAnswerHeal: l >= 17 ? 2 : 0,
    chooseStartingHand: l >= 18,
    freeCharging: false,
    // Pass 7: No free relic at A1 (was the #1 cause of A1 > A0). Relics start at A10.
    startingRelicCount: l >= 20 ? 2 : l >= 10 ? 1 : 0,
    // Pass 7: Combo heal nerfed — 4+ combo for 3 HP (was 3+ combo for 5 HP).
    // High-accuracy players hit 3-combos constantly; 4+ is rarer and 3 HP is less snowbally.
    comboHealThreshold: l >= 6 ? 4 : 0,
    comboHealAmount: l >= 6 ? 3 : 0,
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
  if (template.id !== 'final_lesson') return template;
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
  if (template.id !== 'final_lesson') return template;
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

  if (adjusted.id === 'final_lesson' && floor === 24) {
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
