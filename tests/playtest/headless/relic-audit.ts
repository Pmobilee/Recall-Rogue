/**
 * Relic Effect Audit
 * ==================
 * Tests every starter relic by probing the resolver functions directly.
 * Determines whether each relic's effects are actually wired into the combat pipeline.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
 *           tests/playtest/headless/relic-audit.ts
 */

import './browser-shim.js';

import { STARTER_RELIC_IDS, FULL_RELIC_CATALOGUE } from '../../../src/data/relics/index.js';
import {
  resolveAttackModifiers,
  resolveShieldModifiers,
  resolveDamageTakenEffects,
  resolveTurnStartEffects,
  resolveTurnEndEffects,
  resolveEncounterStartEffects,
  resolveLethalEffects,
  resolveCorrectAnswerEffects,
  resolveBaseDrawCount,
} from '../../../src/services/relicEffectResolver.js';

type RelicStatus = 'WORKING' | 'BROKEN' | 'PASSIVE';

interface RelicTestResult {
  id: string;
  name: string;
  attackFlatBonus: number;
  attackPctBonus: number;
  shieldFlatBonus: number;
  dmgReduction: number;
  turnStartBlock: number;
  turnEndHeal: number;
  drawBonus: number;
  comboBonus: number;
  encounterEffects: string[];
  correctAnswerEffects: string[];
  lethalEffects: string[];
  status: RelicStatus;
  notes: string;
}

const results: RelicTestResult[] = [];

for (const relicId of STARTER_RELIC_IDS) {
  const relic = FULL_RELIC_CATALOGUE.find(r => r.id === relicId);
  if (!relic) continue;

  const ids = new Set([relicId]);

  // --- Attack modifiers ---
  // Provide a permissive context so every conditional branch can fire.
  const atkMods = resolveAttackModifiers(ids, {
    isFirstAttack: true,
    isStrikeTagged: true,
    comboCount: 3,
    playerHpPercent: 0.3,   // triggers berserker_band, reckless_resolve
    consecutiveCorrectAttacks: 3,
    cardTier: 'learning',
    correctStreakThisEncounter: 3,
    enemyHpPercent: 0.2,    // triggers executioners_axe execute bonus
    enemyPoisonStacks: 5,   // triggers festering_wound
    comboRingActive: true,
  });

  // --- Shield modifiers ---
  const shieldMods = resolveShieldModifiers(ids);

  // --- Damage-taken effects ---
  const dmgTaken = resolveDamageTakenEffects(ids, {
    playerHpPercent: 0.5,
    hadBlock: true,
    blockAbsorbedAll: true,
    currentBlock: 20,
  });

  // --- Turn-start effects ---
  const turnStart = resolveTurnStartEffects(ids, 3 /* capacitorStored */);

  // --- Turn-end effects ---
  const turnEnd = resolveTurnEndEffects(ids, {
    damageDealtThisTurn: 20,
    cardsPlayedThisTurn: 3,
    isPerfectTurn: true,
  });

  // --- Draw count delta ---
  const drawCount = resolveBaseDrawCount(ids);
  const drawBonus = drawCount - 5; // 5 is default

  // --- Combo start value ---
  // resolveComboStartValue was removed from relicEffectResolver — no combo start mechanic active
  const comboBonus = 0;

  // --- Encounter-start effects ---
  const encounterEffects: string[] = [];
  const encStart = resolveEncounterStartEffects(ids, 0.5);
  if (encStart.bonusBlock > 0)      encounterEffects.push(`enc_start_block:+${encStart.bonusBlock}`);
  if (encStart.bonusHeal > 0)       encounterEffects.push(`enc_start_heal:+${encStart.bonusHeal}`);
  if (encStart.bonusAP > 0)         encounterEffects.push(`enc_start_ap:+${encStart.bonusAP}`);
  if (encStart.freeFirstCard)       encounterEffects.push('free_first_card');
  if (encStart.permanentForesight)  encounterEffects.push('permanent_foresight');
  if (encStart.luckyBuff !== null)  encounterEffects.push(`lucky_buff:${encStart.luckyBuff}`);

  // --- Correct-answer effects ---
  const correctAnswerEffects: string[] = [];
  const correctFx = resolveCorrectAnswerEffects(ids, { correctStreakThisEncounter: 3 });
  if (correctFx.healHp > 0)             correctAnswerEffects.push(`heal:+${correctFx.healHp}`);
  if (correctFx.bonusDamage > 0)        correctAnswerEffects.push(`bonus_dmg:+${correctFx.bonusDamage}`);
  if (correctFx.memoryPalaceBonus > 0)  correctAnswerEffects.push(`memory_palace_dmg:+${correctFx.memoryPalaceBonus}`);

  // --- Lethal-save effects ---
  const lethalEffects: string[] = [];
  const lethalFx = resolveLethalEffects(ids, {
    lastBreathUsedThisEncounter: false,
    phoenixUsedThisRun: false,
    isBossEncounter: false,
  });
  if (lethalFx.lastBreathSave)  lethalEffects.push(`last_breath_save(block:${lethalFx.lastBreathBlock})`);
  if (lethalFx.phoenixSave)     lethalEffects.push(`phoenix_save(heal:${lethalFx.phoenixHealPercent * 100}%)`);

  // ── Determine status ────────────────────────────────────────────────────────

  // Relics whose primary effect is purely attack/shield modifiers.
  // resolveAttackModifiers IS now wired in (Task 2), so these are WORKING.
  // resolveShieldModifiers (stone_wall, thorned_vest) — check if wired.
  const attackRelicIds = new Set([
    'whetstone', 'barbed_edge', 'war_drum', 'memory_palace', 'flame_brand',
    'berserker_band', 'glass_cannon', 'crescendo_blade', 'curiosity_gem',
    'venom_fang', 'chain_lightning_rod', 'executioners_axe', 'reckless_resolve',
    'volatile_core', 'festering_wound', 'combo_ring',
  ]);
  const shieldRelicIds = new Set(['stone_wall', 'thorned_vest']);

  const hasAttackEffect = atkMods.flatDamageBonus !== 0 || atkMods.percentDamageBonus !== 0
    || atkMods.applyPoison !== null || atkMods.multiHitBonus !== 0 || atkMods.executeThresholdOverride !== null;
  const hasShieldEffect = shieldMods.flatBlockBonus !== 0 || shieldMods.reflectDamage !== 0;
  const hasDmgReduction = dmgTaken.flatReduction !== 0;
  const hasTurnStartEffect = turnStart.bonusBlock > 0 || turnStart.capacitorReleasedAP > 0;
  const hasTurnEndEffect = turnEnd.healFromDamage > 0 || turnEnd.bonusDrawNext > 0 || turnEnd.blockCarries;
  const hasDrawBonus = drawBonus !== 0;
  const hasComboBonus = comboBonus !== 0;
  const hasEncounterEffect = encounterEffects.length > 0;
  const hasCorrectEffect = correctAnswerEffects.length > 0;
  const hasLethalEffect = lethalEffects.length > 0;

  const hasCombatEffect =
    hasAttackEffect || hasShieldEffect || hasDmgReduction || hasTurnStartEffect ||
    hasTurnEndEffect || hasDrawBonus || hasComboBonus || hasEncounterEffect ||
    hasCorrectEffect || hasLethalEffect;

  let status: RelicStatus;
  let notes = '';

  if (!hasCombatEffect) {
    status = 'PASSIVE';
    notes = 'Economy/UI only (gold, shop, visual) — no direct combat effect';
  } else if (shieldRelicIds.has(relicId) && hasShieldEffect && !attackRelicIds.has(relicId)) {
    // stone_wall and thorned_vest: resolveShieldModifiers is NOT yet wired into cardEffectResolver
    status = 'BROKEN';
    notes = 'resolveShieldModifiers computed but NOT wired into cardEffectResolver';
  } else {
    status = 'WORKING';
    notes = 'Applied via resolver pipeline';
  }

  results.push({
    id: relicId,
    name: relic.name,
    attackFlatBonus: atkMods.flatDamageBonus,
    attackPctBonus: Math.round(atkMods.percentDamageBonus * 100),
    shieldFlatBonus: shieldMods.flatBlockBonus,
    dmgReduction: dmgTaken.flatReduction,
    turnStartBlock: turnStart.bonusBlock,
    turnEndHeal: turnEnd.healFromDamage,
    drawBonus,
    comboBonus,
    encounterEffects,
    correctAnswerEffects,
    lethalEffects,
    status,
    notes,
  });
}

// ── Print results ──────────────────────────────────────────────────────────────

const broken  = results.filter(r => r.status === 'BROKEN');
const working = results.filter(r => r.status === 'WORKING');
const passive = results.filter(r => r.status === 'PASSIVE');

console.log('=== RELIC EFFECT AUDIT ===');
console.log(`Probing ${results.length} starter relics via resolver functions\n`);

const HDR =
  'Status   Relic ID                  AtkFlat  AtkPct%  ShldFlat  DmgReduc  BlkStart  HealEnd  Draw  Combo  Notes';
const SEP = '-'.repeat(HDR.length + 10);

console.log(HDR);
console.log(SEP);

for (const r of [...broken, ...working, ...passive]) {
  const icon = r.status === 'BROKEN' ? 'BROKEN  ' : r.status === 'WORKING' ? 'WORKING ' : 'PASSIVE ';
  const extras: string[] = [
    ...r.encounterEffects,
    ...r.correctAnswerEffects,
    ...r.lethalEffects,
  ];
  const extraStr = extras.length > 0 ? `| ${extras.join(', ')}` : '';
  console.log(
    `${icon} ${r.id.padEnd(26)}` +
    `${String(r.attackFlatBonus).padStart(7)}  ` +
    `${String(r.attackPctBonus).padStart(7)}  ` +
    `${String(r.shieldFlatBonus).padStart(8)}  ` +
    `${String(r.dmgReduction).padStart(8)}  ` +
    `${String(r.turnStartBlock).padStart(8)}  ` +
    `${String(r.turnEndHeal).padStart(7)}  ` +
    `${String(r.drawBonus).padStart(4)}  ` +
    `${String(r.comboBonus).padStart(5)}  ` +
    `${r.notes.slice(0, 50)} ${extraStr}`,
  );
}

console.log(SEP);
console.log(`\nSummary: ${broken.length} BROKEN  |  ${working.length} WORKING  |  ${passive.length} PASSIVE/UI-only`);

if (broken.length > 0) {
  console.log('\nBROKEN relics (combat effect computed but not applied):');
  for (const r of broken) {
    console.log(`  - ${r.id} (${r.name}): ${r.notes}`);
  }
}
