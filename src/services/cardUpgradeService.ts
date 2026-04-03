/**
 * Card upgrade service — handles STS-style "+" upgrades at rest sites AND
 * the in-run mastery upgrade system (AR-113).
 *
 * Mastery upgrades boost card values per encounter based on quiz performance.
 * The old rest-site upgrade functions are kept for backward compatibility.
 * Pure logic — no Phaser/Svelte/DOM imports.
 *
 * ## Mastery Stat Table System (Phase 1 Infrastructure)
 *
 * Two systems exist in parallel:
 * 1. Old: `MASTERY_UPGRADE_DEFS` with `perLevelDelta` — all 98 mechanics use this.
 * 2. New: `MASTERY_STAT_TABLES` with explicit per-level snapshots — empty until Phase 2.
 *
 * `getMasteryStats()` checks the new system first, falls back to synthesizing from the old
 * system so that zero behavior changes in Phase 1. Callers should migrate to `getMasteryStats()`
 * now; old per-function helpers are deprecated.
 */

import type { Card } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { MASTERY_MAX_LEVEL } from '../data/balance';

// ─── Mastery Stat Table System (Phase 1 Infrastructure) ────────────────────

/**
 * A single mastery level's stat snapshot for the new per-level system.
 * All fields optional except qpValue — omit to inherit from MechanicDefinition.
 */
export interface MasteryLevelStats {
  /** Quick Play base value at this level. CC = qpValue × CHARGE_CORRECT_MULTIPLIER. */
  qpValue: number;
  /** Override AP cost at this level. Omit to inherit from MechanicDefinition.apCost minus any apCostReduction. */
  apCost?: number;
  /** Secondary value (block on iron_wave, bleed on rupture, thorns reflect, etc.). */
  secondaryValue?: number;
  /** Draw count override for draw/scry cards. */
  drawCount?: number;
  /** Hit count override for multi-hit cards. */
  hitCount?: number;
  /** Charge Wrong base value override. Omit to use mechanic default chargeWrongValue. */
  cwValue?: number;
  /** Cumulative tags active at this level — checked via stats.tags?.includes('tag_name'). */
  tags?: string[];
  /** Mechanic-specific numeric fields (selfDmg, poisonStacks, execBonus, etc.). */
  extras?: Record<string, number>;
}

/** Full stat table for a mechanic across all mastery levels (L0–L5). */
export interface MasteryStatTable {
  /** Stats at each level. Index 0=L0, 5=L5. Length must be maxLevel+1 (default 6). */
  levels: MasteryLevelStats[];
  /** Maximum mastery level. Default: MASTERY_MAX_LEVEL (5). */
  maxLevel?: number;
}

/**
 * Per-level stat tables for mechanics that have been migrated from perLevelDelta.
 * Empty in Phase 1 — populated incrementally in Phase 2 as mechanics are rebalanced.
 * When a mechanic's key exists here, getMasteryStats() uses this table exclusively.
 */
export const MASTERY_STAT_TABLES: Record<string, MasteryStatTable> = {};

/**
 * Get resolved stats for a mechanic at a given mastery level.
 *
 * Checks MASTERY_STAT_TABLES first (new system). Falls back to synthesizing
 * from MASTERY_UPGRADE_DEFS (old system) so that ALL existing mechanics
 * continue to work identically in Phase 1 with zero behavior change.
 *
 * Returns null only if both the stat table AND the mechanic definition are missing.
 */
export function getMasteryStats(mechanicId: string, level: number): MasteryLevelStats | null {
  // New system: explicit stat table takes priority
  const table = MASTERY_STAT_TABLES[mechanicId];
  if (table) {
    const maxLvl = table.maxLevel ?? MASTERY_MAX_LEVEL;
    const clamped = Math.min(Math.max(level, 0), maxLvl);
    return table.levels[clamped] ?? table.levels[table.levels.length - 1];
  }

  // Fallback: synthesize from old perLevelDelta system to preserve identical behavior.
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  const mechDef = getMechanicDefinition(mechanicId);
  if (!mechDef) return null;

  // Clamp level to mechanic's maxLevel (mirrors getMasteryBaseBonus behavior).
  // Note: getMasteryBaseBonus does NOT clamp — it multiplies raw level × delta.
  // We match that by NOT clamping here either, so the math stays identical.
  const clampedLevel = def?.maxLevel ? Math.min(level, def.maxLevel) : level;
  const bonus = def ? def.perLevelDelta * clampedLevel : 0;
  const secBonus = def?.secondaryPerLevelDelta ? def.secondaryPerLevelDelta * clampedLevel : 0;

  // Compute AP reduction from old apCostReductionAtLevels system.
  const apReductions = def?.apCostReductionAtLevels?.filter(l => clampedLevel >= l).length ?? 0;

  // Compute tags from addTagAtLevel.
  const tags: string[] = [];
  if (def?.addTagAtLevel && clampedLevel >= def.addTagAtLevel[0]) {
    tags.push(def.addTagAtLevel[1]);
  }

  return {
    qpValue: mechDef.quickPlayValue + bonus,
    apCost: apReductions > 0 ? mechDef.apCost - apReductions : undefined,
    secondaryValue: mechDef.secondaryValue != null ? mechDef.secondaryValue + secBonus : undefined,
    cwValue: undefined, // use mechanic default chargeWrongValue
    tags: tags.length > 0 ? tags : undefined,
  };
}

// ─── Mastery Upgrade System (AR-113) ───────────────────────────────────────

/** Per-mechanic mastery definition: how values scale per mastery level. */
export interface MasteryUpgradeDef {
  /** Added to baseEffectValue PER mastery level. */
  perLevelDelta: number;
  /** Added to secondaryValue PER mastery level (if applicable). */
  secondaryPerLevelDelta?: number;
  /** AP cost reduction applied at specific levels (array of level thresholds). */
  apCostReductionAtLevels?: number[];
  /** Tag added at a specific level. [level, tagName] */
  addTagAtLevel?: [number, string];
  /** Maximum mastery level this mechanic can reach (default: MASTERY_MAX_LEVEL). */
  maxLevel?: number;
}

/** Mastery scaling definitions for each mechanic. */
export const MASTERY_UPGRADE_DEFS: Record<string, MasteryUpgradeDef> = {
  // Attacks
  strike:        { perLevelDelta: 1.2 },                         // 4 -> 10 (L5: 4 + 5×1.2) — Solid 2.5×
  multi_hit:     { perLevelDelta: 0.6 },                         // per hit — 6→15 total at L5
  heavy_strike:  { perLevelDelta: 2.0 },                         // 10 -> 20 (L5: 10 + 5×2.0) — Solid 2×, already high base
  piercing:      { perLevelDelta: 0.9 },                         // 3 -> 7 (L5: 3 + 5×0.9) — Solid 2.5×
  reckless:      { perLevelDelta: 2.4 },                         // 6 -> 18 (L5: 6 + 5×2.4) — Great 3×, self-dmg earns it
  execute:       { perLevelDelta: 0, secondaryPerLevelDelta: 1.0 }, // bonus 8 -> 13 (L5) — Modest, finisher mechanic does the work
  lifetap:       { perLevelDelta: 1.2 },                         // 4 -> 10 (L5: 4 + 5×1.2) — Great 2.5×, HP cost earns reward
  double_strike: { perLevelDelta: 0.4 },                         // 75% -> 77% per hit at L5 — Modest, already doubles everything
  // Shields
  block:         { perLevelDelta: 1.2 },                         // 3 -> 9 (L5: 3 + 5×1.2) — Solid 3×
  fortify:       { perLevelDelta: 1.5 },                         // 4 -> 11 (L5: 4 + 5×1.5) — Solid 2.75×
  parry:         { perLevelDelta: 0.3 },                         // 2 -> 3 (L5) — Modest 1.75×, draw bonus is its thing
  brace:         { perLevelDelta: 1.2 },                         // 3 -> 9 (L5: 3 + 5×1.2) — Solid 3×
  emergency:     { perLevelDelta: 1.0 },                         // 2 -> 7 (L5: 2 + 5×1.0) — Solid 3.5×
  overheal:      { perLevelDelta: 1.5 },                         // 5 -> 12 (L5: 5 + 5×1.5) — Solid 2.5×
  thorns:        { perLevelDelta: 1.2, secondaryPerLevelDelta: 0.6 }, // primary 0 -> 6 (L5); retaliate 3 -> 6 (L5)
  // Buffs
  empower:       { perLevelDelta: 2.0 },                         // 35 -> 45% (L5) — Modest, already strong multiplicatively
  mirror:        { perLevelDelta: 0.03 },                        // 1.0 -> 1.15× (L5) — Modest, multiplier on multiplier
  adapt:         { perLevelDelta: 0.03 },                        // 1.0 -> 1.15× (L5) — Modest
  // Debuffs
  weaken:        { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  expose:        { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  slow:          { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  hex:           { perLevelDelta: 0.4 },                         // 2 -> 4/t (L5) — Solid
  // Utility
  scout:         { perLevelDelta: 0, addTagAtLevel: [3, 'draw'] }, // +1 draw at L3 (via tag)
  recycle:       { perLevelDelta: 0.12 },                        // slight nerf
  foresight:     { perLevelDelta: 0, secondaryPerLevelDelta: 0.12 }, // slight nerf
  quicken:       { perLevelDelta: 0, addTagAtLevel: [3, 'draw'], maxLevel: 3 },
  cleanse:       { perLevelDelta: 0, maxLevel: 2 },              // binary — no scaling
  focus:         { perLevelDelta: 0, secondaryPerLevelDelta: 0.12 }, // slight nerf
  immunity:      { perLevelDelta: 0, maxLevel: 2 },              // binary
  overclock:     { perLevelDelta: 0, apCostReductionAtLevels: [3], maxLevel: 3 }, // AP-1 at L3
  transmute:     { perLevelDelta: 0.12, maxLevel: 3 },           // slight nerf
  conjure:       { perLevelDelta: 0, maxLevel: 3 },              // Mastery improves candidate tier (handled via sourceMasteryLevel)
  forge:         { perLevelDelta: 0, maxLevel: 3 },              // Mastery improves upgrade amount and pick count

  // ── AR-206: Phase 1 Expansion Cards ─────────────────────────────────────────

  // Filler cards
  power_strike:      { perLevelDelta: 1.5 },                         // 5 -> 12 (L5) — Solid 2.5×
  twin_strike:       { perLevelDelta: 0.9 },                         // 3/hit -> 7/hit (L5), 6→14 total — Solid 2.5×
  iron_wave:         { perLevelDelta: 0.6, secondaryPerLevelDelta: 1.0 }, // 3+5 -> 6+10 (L5) — Solid 2×
  reinforce:         { perLevelDelta: 1.5 },                         // 4 -> 11 (L5) — Solid 2.75×
  shrug_it_off:      { perLevelDelta: 1.2, addTagAtLevel: [3, 'draw2'] }, // 3 -> 9 (L5) — Solid 3×
  bash:              { perLevelDelta: 1.0, addTagAtLevel: [3, 'vuln_ext'] }, // 5 -> 10 (L5) — Modest 2×, L3 vuln is the real power
  guard:             { perLevelDelta: 1.6 },                         // 7 -> 15 (L5) — Solid 2.15×
  sap:               { perLevelDelta: 0.4, addTagAtLevel: [3, 'weak_ext'] }, // 2 -> 4 (L5) — Modest 2×, L3 weak = powerful tag

  // Bleed cards
  rupture:           { perLevelDelta: 0.9, secondaryPerLevelDelta: 0.9 }, // 3+3 -> 7+7 (L5) — Solid 2.5×
  lacerate:          { perLevelDelta: 0.6, secondaryPerLevelDelta: 1.2 }, // 2+4 -> 5+10 (L5) — Solid

  // Burn cards
  kindle:            { perLevelDelta: 0.4, secondaryPerLevelDelta: 0.8 }, // 2+4 -> 4+8 (L5) — Solid 2×, burn does ongoing dmg
  ignite:            { perLevelDelta: 0.4 },                         // 2 -> 4 (L5) — Modest 2×, burn payoff is elsewhere

  // Basic new cards
  overcharge:        { perLevelDelta: 0.9 },                         // 3 -> 7 (L5) — Solid 2.5×
  riposte:           { perLevelDelta: 0.9, secondaryPerLevelDelta: 1.2 }, // 3+4 -> 7+10 (L5) — Solid
  absorb:            { perLevelDelta: 0.6, addTagAtLevel: [3, 'draw2'] }, // 3 -> 6 (L5) — Modest 2×
  reactive_shield:   { perLevelDelta: 0.4, addTagAtLevel: [3, 'thorns_ext'] }, // 2 -> 4 (L5) — Modest 2×
  sift:              { perLevelDelta: 0.4 },                         // look 3 -> look 5 (L5) — nerf
  scavenge:          { perLevelDelta: 0, addTagAtLevel: [3, 'scavenge2'], maxLevel: 3 }, // L3: QP puts 2 on top
  precision_strike:  { perLevelDelta: 1.2, addTagAtLevel: [3, 'timer_ext75'] }, // 8 -> 14 (L5) — Modest 1.75×, L3 +75% timer is very powerful
  stagger:           { perLevelDelta: 0, addTagAtLevel: [3, 'weak_apply'], maxLevel: 3 }, // L3: QP applies 1t Weakness
  corrode:           { perLevelDelta: 0.6, addTagAtLevel: [3, 'weak_ext'] }, // 3 -> 6 (L5) — Modest 2×
  swap:              { perLevelDelta: 0, addTagAtLevel: [3, 'draw3cc'], maxLevel: 3 }, // L3: CC draws 3
  siphon_strike:     { perLevelDelta: 0.6, addTagAtLevel: [3, 'min_heal3'] }, // 3 -> 6 (L5) — Modest 2×, L3 heal is strong
  aegis_pulse:       { perLevelDelta: 0.6, addTagAtLevel: [3, 'chain_buff3'] }, // 3 -> 6 (L5) — Modest 2×

  // Inscription cards
  inscription_fury:  { perLevelDelta: 0.3 },                        // 1 -> 2.5 atk (L5) — Solid
  inscription_iron:  { perLevelDelta: 0.4 },                        // 2 -> 4 block/turn (L5) — Solid

  // ── AR-207: Phase 2 Identity / Flagship Cards ─────────────────────────────

  // Attacks
  gambit:            { perLevelDelta: 2.0, addTagAtLevel: [3, 'self_dmg_minus1'] }, // 5 -> 15 (L5) — Great 3×, big risk
  chain_lightning:   { perLevelDelta: 1.2 },                         // 4 -> 10 (L5) — Solid 2.5×, chain mult is separate
  volatile_slash:    { perLevelDelta: 2.0 },                         // 5 -> 15 (L5) — Great 3×, exhausts = earns it

  // Shields
  burnout_shield:    { perLevelDelta: 1.6 },                         // 4 -> 12 (L5) — Great 3×, CC exhausts
  knowledge_ward:    { perLevelDelta: 0.9 },                         // 6 -> 10 (L5) — Modest 1.75×

  // Buffs
  warcry:            { perLevelDelta: 0, addTagAtLevel: [3, 'warcry_perm_str'], maxLevel: 3 }, // L3 QP: +1 permanent Str
  battle_trance:     { perLevelDelta: 0, addTagAtLevel: [3, 'battle_trance_draw4'], maxLevel: 3 }, // L3 QP: draw 4

  // Debuffs
  curse_of_doubt:    { perLevelDelta: 3.0 },                         // 20 -> 35% (L5) — Solid
  mark_of_ignorance: { perLevelDelta: 0.4 },                         // 2 -> 4 (L5) — Solid
  corroding_touch:   { perLevelDelta: 0.5, maxLevel: 3 },            // 1 -> 2.5t (L3) — Solid

  // Wilds
  phase_shift:       { perLevelDelta: 1.2 },                         // 4 -> 10 (L5) — Solid 2.5×
  chameleon:         { perLevelDelta: 0, addTagAtLevel: [3, 'chameleon_qp_chain'], maxLevel: 3 }, // L3 QP: also inherits chain type
  dark_knowledge:    { perLevelDelta: 0.6 },                         // 3 -> 6 (L5) — Solid 2×
  chain_anchor:      { perLevelDelta: 0, addTagAtLevel: [3, 'chain_anchor_3'], maxLevel: 3 }, // L3 CC: sets chain to 3
  unstable_flux:     { perLevelDelta: 0, addTagAtLevel: [3, 'unstable_flux_qp_choice'], maxLevel: 3 }, // L3 QP: choose 1 of 2 options

  // ── AR-208: Phase 3 Advanced / Chase Cards ────────────────────────────────

  // Attacks
  smite:             { perLevelDelta: 2.0, maxLevel: 5 },                            // 10 -> 20 (L5) — Solid 2×, high base
  feedback_loop:     { perLevelDelta: 1.7, addTagAtLevel: [3, 'feedback_weakness'], maxLevel: 3 }, // 5 -> 10 (L3) — Modest 2×, L3 weakness
  recall:            { perLevelDelta: 0.2, addTagAtLevel: [3, 'recall_draw'], maxLevel: 5 },    // per-card 1.0→2.0; L3: draw 1 after resolving
  hemorrhage:        { perLevelDelta: 0.6, maxLevel: 5 },                            // 2 -> 5 (L5) — Solid, bleed mult is separate
  eruption:          { perLevelDelta: 2.0, maxLevel: 3 },                            // 4 -> 10/AP (L3) — Solid 2.5×

  // Shields
  bulwark:           { perLevelDelta: 3.0, maxLevel: 3 },                            // 9 -> 18 (L3) — Solid 2×
  conversion:        { perLevelDelta: 1.7, maxLevel: 3 },                            // 5 -> 10 (L3) — Solid 2×
  ironhide:          { perLevelDelta: 1.0, addTagAtLevel: [3, 'ironhide_perm_qp'], maxLevel: 3 }, // 3 -> 6 (L3) — Modest 2×

  // Buffs
  frenzy:            { perLevelDelta: 0, addTagAtLevel: [3, 'frenzy_qp3'], maxLevel: 3 },       // L3 QP: frees 3 cards
  mastery_surge:     { perLevelDelta: 0, addTagAtLevel: [3, 'mastery_surge_qp2'], maxLevel: 3 },// L3 QP: upgrades 2 cards
  war_drum:          { perLevelDelta: 0.1, maxLevel: 5 },                            // 1 -> 1.5 buff (L5) — very conservative, buffs ALL hand cards

  // Debuffs
  entropy:           { perLevelDelta: 0.7, addTagAtLevel: [3, 'entropy_poison_qp'], maxLevel: 3 }, // 2 -> 4 (L3) — Solid

  // Utility
  archive:           { perLevelDelta: 0, addTagAtLevel: [3, 'archive_retain2_qp'], maxLevel: 3 }, // L3 QP: retains 2 cards
  reflex:            { perLevelDelta: 0, addTagAtLevel: [3, 'reflex_enhanced'], maxLevel: 3 },    // L3: QP draws 3; passive = 4 block
  recollect:         { perLevelDelta: 0, addTagAtLevel: [3, 'recollect_qp2'], maxLevel: 3 },      // L3 QP: returns 2 exhausted
  synapse:           { perLevelDelta: 0, addTagAtLevel: [3, 'synapse_draw3_qp'], maxLevel: 3 },   // L3 QP: draws 3
  siphon_knowledge:  { perLevelDelta: 0, addTagAtLevel: [3, 'siphon_qp3_time4s'], maxLevel: 3 },  // L3 QP: draws 3 + 4s preview
  tutor:             { perLevelDelta: 0, addTagAtLevel: [3, 'tutor_free_qp'], maxLevel: 3 },      // L3 QP: tutored card costs 0

  // Wild
  sacrifice:         { perLevelDelta: 0, addTagAtLevel: [3, 'sacrifice_draw3_qp'], maxLevel: 3 }, // L3 QP: draws 3
  catalyst:          { perLevelDelta: 0, addTagAtLevel: [3, 'catalyst_bleed_qp'], maxLevel: 3 },  // L3 QP: also doubles Bleed
  mimic:             { perLevelDelta: 0, addTagAtLevel: [3, 'mimic_choose_qp'], maxLevel: 3 },    // L3 QP: player chooses from discard
  aftershock:        { perLevelDelta: 0.1, maxLevel: 3 },                            // QP mult 0.5→0.8; CC mult 0.7→1.0 at L3
  knowledge_bomb:    { perLevelDelta: 0.8, maxLevel: 5 },                            // per-correct, slight nerf

  // Inscription
  inscription_wisdom: { perLevelDelta: 0, addTagAtLevel: [3, 'inscription_wisdom_heal2'], maxLevel: 3 }, // L3 CC: heals 2 HP per correct
};

/**
 * Get the total base value bonus for a given mastery level.
 * @deprecated Use getMasteryStats() instead. Will be removed in Phase 2 migration.
 */
export function getMasteryBaseBonus(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def) return 0;
  return def.perLevelDelta * level;
}

/**
 * Get the total secondary value bonus for a given mastery level.
 * @deprecated Use getMasteryStats() instead. Will be removed in Phase 2 migration.
 */
export function getMasterySecondaryBonus(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.secondaryPerLevelDelta) return 0;
  return def.secondaryPerLevelDelta * level;
}

/**
 * Check if a tag should be added at this mastery level.
 * Returns the tag name if applicable, or null.
 * @deprecated Use getMasteryStats() instead. Will be removed in Phase 2 migration.
 */
export function getMasteryAddedTag(mechanicId: string, level: number): string | null {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.addTagAtLevel) return null;
  const [threshold, tag] = def.addTagAtLevel;
  return level >= threshold ? tag : null;
}

/**
 * Check how many AP reductions apply at this mastery level.
 * @deprecated Use getMasteryStats() instead. Will be removed in Phase 2 migration.
 */
export function getMasteryApReduction(mechanicId: string, level: number): number {
  const def = MASTERY_UPGRADE_DEFS[mechanicId];
  if (!def?.apCostReductionAtLevels) return 0;
  return def.apCostReductionAtLevels.filter(l => level >= l).length;
}

/**
 * Whether a card can be mastery-upgraded.
 * Cards at max level and unknown mechanics cannot upgrade.
 * AR-202: Cursed cards cannot gain mastery until cured.
 * Note: The once-per-encounter cap (masteryChangedThisEncounter) was removed in 2026-04-01
 * balance pass — multiple correct Charges in one encounter each grant +1 mastery.
 */
export function canMasteryUpgrade(card: Card): boolean {
  // AR-202: Cursed cards are locked at effective mastery 0 until cured.
  if (card.isCursed) return false;
  const def = MASTERY_UPGRADE_DEFS[card.mechanicId ?? ''];
  const maxLevel = def?.maxLevel ?? MASTERY_MAX_LEVEL;
  if ((card.masteryLevel ?? 0) >= maxLevel) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in MASTERY_UPGRADE_DEFS;
}

/**
 * Whether a card can be mastery-downgraded.
 * Cards at level 0 cannot downgrade.
 * Note: The once-per-encounter cap was removed in 2026-04-01 balance pass.
 */
export function canMasteryDowngrade(card: Card): boolean {
  if ((card.masteryLevel ?? 0) <= 0) return false;
  return true;
}

/**
 * Upgrade a card's mastery by 1 level. Mutates in place. Returns the card.
 */
export function masteryUpgrade(card: Card): Card {
  const current = card.masteryLevel ?? 0;
  if (current >= MASTERY_MAX_LEVEL) return card;
  card.masteryLevel = current + 1;
  card.masteryChangedThisEncounter = true;
  card.isUpgraded = card.masteryLevel > 0; // backwards compat
  return card;
}

/**
 * Downgrade a card's mastery by 1 level. Mutates in place. Returns the card.
 */
export function masteryDowngrade(card: Card): Card {
  const current = card.masteryLevel ?? 0;
  if (current <= 0) return card;
  card.masteryLevel = current - 1;
  card.masteryChangedThisEncounter = true;
  card.isUpgraded = card.masteryLevel > 0; // backwards compat
  return card;
}

/**
 * Reset masteryChangedThisEncounter for all cards. Call at encounter start.
 */
export function resetEncounterMasteryFlags(cards: Card[]): void {
  for (const card of cards) {
    card.masteryChangedThisEncounter = false;
  }
}

/**
 * Get the effective base effect value including mastery bonus.
 * This is the value that should be used for damage/block calculations.
 */
export function getEffectiveBaseValue(card: Card): number {
  const bonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return card.baseEffectValue + bonus;
}

/**
 * Get the effective secondary value including mastery bonus.
 */
export function getEffectiveSecondaryValue(card: Card): number | undefined {
  const mechDef = getMechanicDefinition(card.mechanicId);
  const base = card.secondaryValue ?? mechDef?.secondaryValue;
  if (base == null) return undefined;
  const bonus = getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  return base + bonus;
}

// ─── Legacy Rest-Site Upgrade System ────────────────────────────────────────
// @deprecated Use mastery system instead. Kept for backward compatibility.

/** Per-mechanic upgrade definition: what values change when upgraded. */
export interface MechanicUpgrade {
  /** Added to baseEffectValue. */
  baseValueDelta: number;
  /** Added to the mechanic's secondaryValue (for multi_hit hits, thorns retaliate, etc.). */
  secondaryValueDelta?: number;
  /** Optional new tag granted on upgrade (e.g., quicken+ adds 'draw'). */
  addTag?: string;
  /** AP cost change on upgrade. Negative = cheaper. */
  apCostDelta?: number;
}

/**
 * Upgrade definitions for each Phase 1 and Phase 2 mechanic.
 * @deprecated Use MASTERY_UPGRADE_DEFS and the mastery system instead.
 */
export const UPGRADE_DEFS: Record<string, MechanicUpgrade> = {
  // Phase 1
  strike:    { baseValueDelta: 3 },                                    // 8→11
  multi_hit: { baseValueDelta: 0, apCostDelta: -1 },                  // AP 2→1
  block:     { baseValueDelta: 3 },                                    // 6→9
  thorns:    { baseValueDelta: 0, secondaryValueDelta: 1, apCostDelta: -1 }, // AP 1→0, reflect +1 (4 total)
  emergency: { baseValueDelta: 2 },                                    // 4→6
  scout:     { baseValueDelta: 1, apCostDelta: -1 },                  // AP 1→0, draw 2→3
  recycle:   { baseValueDelta: 1 },                                    // draw 3→4
  cleanse:   { baseValueDelta: 0, apCostDelta: -1 },                  // AP 1→0
  empower:   { baseValueDelta: 15 },                                   // 50→65%
  quicken:   { baseValueDelta: 0, addTag: 'draw' },                   // +draw (stays 0 AP)
  weaken:    { baseValueDelta: 1 },                                    // 2→3 turns
  expose:    { baseValueDelta: 1 },                                    // 1→2 turns
  mirror:    { baseValueDelta: 0.25 },                                 // 1.0→1.25x
  adapt:     { baseValueDelta: 0.25 },                                 // 1.0→1.25x
  focus:         { baseValueDelta: 0, secondaryValueDelta: 1 },        // next TWO cards cost 1 less AP
  // Phase 2
  heavy_strike:  { baseValueDelta: 0, apCostDelta: -1 },              // AP 3→2
  piercing:      { baseValueDelta: 3 },                                // 6→9
  reckless:      { baseValueDelta: 3 },                                // 12→15
  execute:       { baseValueDelta: 0, secondaryValueDelta: 4 },       // bonus 8→12
  lifetap:       { baseValueDelta: 1, apCostDelta: -1 },              // AP 2→1, 8→9
  fortify:       { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1 (7 block)
  parry:         { baseValueDelta: 2 },                                // 3→5
  brace:         { baseValueDelta: 3 },                                // +3 flat bonus
  overheal:      { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1 (10 block, ×2 <50%)
  double_strike: { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
  slow:          { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
  hex:           { baseValueDelta: 1 },                                // 3→4/turn
  foresight:     { baseValueDelta: 0, secondaryValueDelta: 1 },        // draw 1→2 extra cards
  transmute:     { baseValueDelta: 1 },                                // transform 1→2
  immunity:      { baseValueDelta: 0, apCostDelta: -1 },              // AP 1→0
  overclock:     { baseValueDelta: 0, apCostDelta: -1 },              // AP 2→1
};

/**
 * Returns true if the card can be upgraded (rest-site system).
 * @deprecated Use canMasteryUpgrade for the mastery system instead.
 */
export function canUpgradeCard(card: Card): boolean {
  if (card.isUpgraded) return false;
  if (!card.mechanicId) return false;
  return card.mechanicId in UPGRADE_DEFS;
}

/**
 * Applies the rest-site upgrade to a card in-place.
 * @deprecated Use masteryUpgrade for the mastery system instead.
 */
export function upgradeCard(card: Card): Card {
  const upgrade = UPGRADE_DEFS[card.mechanicId ?? ''];
  if (!upgrade) return card;

  card.baseEffectValue += upgrade.baseValueDelta;

  // Apply secondary value delta if present
  if (upgrade.secondaryValueDelta != null) {
    const mechDef = getMechanicDefinition(card.mechanicId);
    const currentSecondary = card.secondaryValue ?? mechDef?.secondaryValue ?? 0;
    card.secondaryValue = currentSecondary + upgrade.secondaryValueDelta;
  }

  // Apply AP cost delta if present
  if (upgrade.apCostDelta != null) {
    card.apCost = Math.max(0, (card.apCost ?? 1) + upgrade.apCostDelta);
  }

  card.mechanicName = (card.mechanicName ?? '') + '+';
  card.isUpgraded = true;
  return card;
}

/** Upgrade preview data for the UI. */
export interface UpgradePreview {
  upgradedName: string;
  currentBaseValue: number;
  newBaseValue: number;
  secondaryDelta?: number;
  addTag?: string;
  currentApCost?: number;
  newApCost?: number;
}

/**
 * Returns a preview of what the rest-site upgrade would look like without applying it.
 * @deprecated Use mastery system instead.
 */
export function getUpgradePreview(card: Card): UpgradePreview | null {
  const upgrade = UPGRADE_DEFS[card.mechanicId ?? ''];
  if (!upgrade) return null;

  const preview: UpgradePreview = {
    upgradedName: (card.mechanicName ?? '') + '+',
    currentBaseValue: card.baseEffectValue,
    newBaseValue: card.baseEffectValue + upgrade.baseValueDelta,
    secondaryDelta: upgrade.secondaryValueDelta,
    addTag: upgrade.addTag,
  };

  if (upgrade.apCostDelta != null) {
    preview.currentApCost = card.apCost ?? 1;
    preview.newApCost = Math.max(0, (card.apCost ?? 1) + upgrade.apCostDelta);
  }

  return preview;
}

/** Tier priority for sorting upgrade candidates (higher tier = more desirable). */
const TIER_PRIORITY: Record<string, number> = { '3': 4, '2b': 3, '2a': 2, '1': 1 };

/**
 * Returns upgrade candidates from the deck, sorted by knowledge tier (highest first).
 * @deprecated Use mastery system instead.
 *
 * @param deck - All cards in the player's active deck (all piles combined).
 * @param count - Max number of candidates to return.
 */
export function getUpgradeCandidates(deck: Card[], count: number): Card[] {
  const eligible = deck.filter(canUpgradeCard);

  eligible.sort((a, b) => {
    const tierA = TIER_PRIORITY[a.tier] ?? 0;
    const tierB = TIER_PRIORITY[b.tier] ?? 0;
    if (tierB !== tierA) return tierB - tierA;
    // Within same tier, prefer higher effectMultiplier (higher tier = stronger cards)
    return (b.effectMultiplier ?? 1) - (a.effectMultiplier ?? 1);
  });

  return eligible.slice(0, count);
}
