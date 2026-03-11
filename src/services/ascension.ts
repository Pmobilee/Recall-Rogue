import type { EnemyIntent, EnemyTemplate } from '../data/enemies';

export const MAX_ASCENSION_LEVEL = 20;

export interface AscensionLevelRule {
  level: number;
  name: string;
  effect: string;
}

export const ASCENSION_LEVEL_RULES: AscensionLevelRule[] = [
  { level: 1, name: 'Tougher Enemies', effect: 'All enemies +10% HP' },
  { level: 2, name: 'Aggressive Foes', effect: 'All enemies +10% damage' },
  { level: 3, name: 'Fewer Heals', effect: 'Heal cards 25% less effective' },
  { level: 4, name: 'Shorter Fuse', effect: 'Timer -1s base on all questions' },
  { level: 5, name: 'Thin Deck', effect: 'Start with 12 cards instead of 15' },
  { level: 6, name: 'Iron Will', effect: 'No flee from encounters' },
  { level: 7, name: 'Harsh Grading', effect: 'Close-distractor answers more common' },
  { level: 8, name: 'Elite Surge', effect: 'Mini-bosses gain boss-tier attacks' },
  { level: 9, name: 'Endurance', effect: 'Retreat rewards require floor 12+' },
  { level: 10, name: 'Fading Light', effect: 'Encounter 2 per floor has -2s timer' },
  { level: 11, name: 'Relic Tax', effect: 'Boss relic choices reduced to 2' },
  { level: 12, name: 'Deep Knowledge', effect: 'Tier 1 cards use 4-option MCQ' },
  { level: 13, name: 'Glass Cannon', effect: 'Player max HP reduced to 70' },
  { level: 14, name: 'Combo Breaker', effect: 'Combo resets on turn end (not just on wrong answer)' },
  { level: 15, name: 'Boss Rush', effect: 'Bosses gain +25% HP' },
  { level: 16, name: 'No Echo', effect: 'Echo mechanic disabled' },
  { level: 17, name: "Scholar's Burden", effect: 'Wrong answers deal 5 self-damage' },
  { level: 18, name: 'Minimalist', effect: 'Start with 10 cards' },
  { level: 19, name: 'True Test', effect: 'Questions force fill-blank/production-style formats' },
  { level: 20, name: 'Heart of the Archive', effect: 'Floor 24 boss gains a secret second phase' },
];

export interface AscensionModifiers {
  level: number;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  healCardMultiplier: number;
  timerBasePenaltySeconds: number;
  encounterTwoTimerPenaltySeconds: number;
  starterDeckSizeOverride: number | null;
  preventFlee: boolean;
  preferCloseDistractors: boolean;
  miniBossBossTierAttacks: boolean;
  comboResetsOnTurnEnd: boolean;
  minRetreatFloorForRewards: number | null;
  relicCap: number;
  tier1OptionCount: number;
  playerMaxHpOverride: number | null;
  bossHpMultiplier: number;
  disableEcho: boolean;
  wrongAnswerSelfDamage: number;
  forceHardQuestionFormats: boolean;
  curatorSecretSecondPhase: boolean;
}

function clampAscensionLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_ASCENSION_LEVEL, Math.floor(level)));
}

export function getAscensionModifiers(level: number): AscensionModifiers {
  const l = clampAscensionLevel(level);
  return {
    level: l,
    enemyHpMultiplier: l >= 1 ? 1.10 : 1.00,
    enemyDamageMultiplier: l >= 2 ? 1.10 : 1.00,
    healCardMultiplier: l >= 3 ? 0.75 : 1.00,
    timerBasePenaltySeconds: l >= 4 ? 1 : 0,
    encounterTwoTimerPenaltySeconds: l >= 10 ? 2 : 0,
    starterDeckSizeOverride: l >= 18 ? 10 : l >= 5 ? 12 : null,
    preventFlee: l >= 6,
    preferCloseDistractors: l >= 7,
    miniBossBossTierAttacks: l >= 8,
    comboResetsOnTurnEnd: l >= 14,
    minRetreatFloorForRewards: l >= 9 ? 12 : null,
    relicCap: l >= 11 ? 2 : 3,
    tier1OptionCount: l >= 12 ? 4 : 3,
    playerMaxHpOverride: l >= 13 ? 70 : null,
    bossHpMultiplier: l >= 15 ? 1.25 : 1.00,
    disableEcho: l >= 16,
    wrongAnswerSelfDamage: l >= 17 ? 5 : 0,
    forceHardQuestionFormats: l >= 19,
    curatorSecretSecondPhase: l >= 20,
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
