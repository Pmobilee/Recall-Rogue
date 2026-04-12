import type { EnemyInstance } from './enemies';

/** Definition of an enemy power badge shown in combat. */
export interface EnemyPowerDef {
  /** Unique id for the power. */
  id: string;
  /** Short label shown next to the icon. */
  label: string;
  /** Badge background color (hex). */
  color: string;
  /** Tooltip text. Use {value} for dynamic values. */
  tooltip: string;
}

/** All possible enemy power badges. */
export const ENEMY_POWERS: Record<string, EnemyPowerDef> = {
  chargeResistant: {
    id: 'charge_resistant',
    label: 'QP Resist',
    color: '#9b59b6',
    tooltip: 'Quick Play deals half damage — use Charge instead',
  },
  chainVulnerable: {
    id: 'chain_vulnerable',
    label: 'Chain Weak',
    color: '#27ae60',
    tooltip: 'Chain attacks deal +50% bonus damage',
  },
  quickPlayDamageMultiplier: {
    id: 'qp_reduced',
    label: 'QP Reduced',
    color: '#f1c40f',
    tooltip: 'Quick Play deals {value}% damage',
  },
  quickPlayImmune: {
    id: 'qp_immune',
    label: 'QP Immune',
    color: '#e74c3c',
    tooltip: 'Quick Play deals zero damage — must use Charge',
  },
  chainMultiplierOverride: {
    id: 'chain_null',
    label: 'Chain Null',
    color: '#e74c3c',
    tooltip: 'Knowledge Chain multipliers are nullified',
  },
  hardcoverArmor: {
    id: 'hardcover',
    label: 'Hardcover',
    color: '#3498db',
    tooltip: 'Has {value} armor — correct Charges strip 4, wrong adds 2',
  },
  onPlayerChargeWrong: {
    id: 'punish_wrong',
    label: 'Punish Wrong',
    color: '#e74c3c',
    tooltip: 'Wrong answers on Charged cards trigger a penalty',
  },
  onPlayerChargeCorrect: {
    id: 'punish_correct',
    label: 'Punish Correct',
    color: '#e67e22',
    tooltip: 'Correct Charges trigger a reaction',
  },
  onPlayerNoCharge: {
    id: 'punish_skip',
    label: 'Punish Skip',
    color: '#e67e22',
    tooltip: 'Gains Strength if you skip Charge for a turn',
  },
  onEnemyTurnStart: {
    id: 'escalates',
    label: 'Escalates',
    color: '#e74c3c',
    tooltip: 'Gains Strength each turn',
  },
  phaseTransitionAt: {
    id: 'phase_transition',
    label: 'Phase 2',
    color: '#9b59b6',
    tooltip: 'Transforms at {value}% HP with new abilities',
  },
  quizPhases: {
    id: 'quiz_boss',
    label: 'Quiz Boss',
    color: '#3498db',
    tooltip: 'Pauses combat for quiz challenges at HP thresholds',
  },
};

/** Resolved power with dynamic value substituted. */
export interface ActivePower extends EnemyPowerDef {
  resolvedTooltip: string;
}

/**
 * Get the active power badges for an enemy instance.
 * Reads template properties and returns which badges should display.
 */
export function getEnemyPowers(enemy: EnemyInstance | null | undefined): ActivePower[] {
  if (!enemy) return [];
  const t = enemy.template;
  const powers: ActivePower[] = [];

  if (t.chargeResistant) {
    powers.push({ ...ENEMY_POWERS.chargeResistant, resolvedTooltip: ENEMY_POWERS.chargeResistant.tooltip });
  }
  if (t.chainVulnerable) {
    powers.push({ ...ENEMY_POWERS.chainVulnerable, resolvedTooltip: ENEMY_POWERS.chainVulnerable.tooltip });
  }
  if (t.quickPlayImmune) {
    powers.push({ ...ENEMY_POWERS.quickPlayImmune, resolvedTooltip: ENEMY_POWERS.quickPlayImmune.tooltip });
  }
  if (t.quickPlayDamageMultiplier != null && !t.quickPlayImmune) {
    const pct = Math.round(t.quickPlayDamageMultiplier * 100);
    powers.push({
      ...ENEMY_POWERS.quickPlayDamageMultiplier,
      resolvedTooltip: ENEMY_POWERS.quickPlayDamageMultiplier.tooltip.replace('{value}', String(pct)),
    });
  }
  if (t.chainMultiplierOverride != null) {
    powers.push({ ...ENEMY_POWERS.chainMultiplierOverride, resolvedTooltip: ENEMY_POWERS.chainMultiplierOverride.tooltip });
  }
  if (t.hardcoverArmor != null && t.hardcoverArmor > 0) {
    const armor = (enemy as any)._hardcover ?? t.hardcoverArmor;
    const broken = (enemy as any)._hardcoverBroken;
    if (!broken) {
      powers.push({
        ...ENEMY_POWERS.hardcoverArmor,
        resolvedTooltip: ENEMY_POWERS.hardcoverArmor.tooltip.replace('{value}', String(armor)),
      });
    }
  }
  if (t.onPlayerChargeWrong) {
    powers.push({ ...ENEMY_POWERS.onPlayerChargeWrong, resolvedTooltip: ENEMY_POWERS.onPlayerChargeWrong.tooltip });
  }
  if (t.onPlayerChargeCorrect) {
    powers.push({ ...ENEMY_POWERS.onPlayerChargeCorrect, resolvedTooltip: ENEMY_POWERS.onPlayerChargeCorrect.tooltip });
  }
  if (t.onPlayerNoCharge) {
    powers.push({ ...ENEMY_POWERS.onPlayerNoCharge, resolvedTooltip: ENEMY_POWERS.onPlayerNoCharge.tooltip });
  }
  if (t.onEnemyTurnStart) {
    powers.push({ ...ENEMY_POWERS.onEnemyTurnStart, resolvedTooltip: ENEMY_POWERS.onEnemyTurnStart.tooltip });
  }
  if (t.phaseTransitionAt != null) {
    const pct = Math.round(t.phaseTransitionAt * 100);
    // Only show if not yet transitioned
    if (enemy.phase === 1) {
      powers.push({
        ...ENEMY_POWERS.phaseTransitionAt,
        resolvedTooltip: ENEMY_POWERS.phaseTransitionAt.tooltip.replace('{value}', String(pct)),
      });
    }
  }
  if (t.quizPhases && t.quizPhases.length > 0) {
    powers.push({ ...ENEMY_POWERS.quizPhases, resolvedTooltip: ENEMY_POWERS.quizPhases.tooltip });
  }

  return powers;
}
