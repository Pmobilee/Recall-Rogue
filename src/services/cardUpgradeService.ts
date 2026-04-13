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
export const MASTERY_STAT_TABLES: Record<string, MasteryStatTable> = {
  // ─── ATTACK CARDS (20) — Phase 2 Batch 1 ────────────────────────────────────

  // ── Core Attacks (7) ────────────────────────────────────────────────────────

  /** Standard reliable attack. L3 and L5 are the big damage jumps. L5: +4 bonus if 3+ cards played this turn (Tempo archetype). */
  strike: {
    levels: [
      { qpValue: 4 },                                                         // L0 — Weak but reliable
      { qpValue: 4 },                                                         // L1
      { qpValue: 5 },                                                         // L2
      { qpValue: 6 },                                                         // L3
      { qpValue: 7 },                                                         // L4
      { qpValue: 8, tags: ['strike_tempo3'] },                                // L5 — Bread and butter + Tempo bonus
    ],
  },

  /** Multi-hit: low per-hit, scales by adding hits. L1 = 3rd hit, L4 = 4th hit. */
  multi_hit: {
    levels: [
      { qpValue: 2, hitCount: 2 },                                           // L0 — Plinks (was 1, bumped for L0 viability)
      { qpValue: 2, hitCount: 3 },                                           // L1 — Extra hit! (bumped to match L0)
      { qpValue: 2, hitCount: 3 },                                           // L2
      { qpValue: 2, hitCount: 3, tags: ['multi_bleed1'] },                  // L3 — +1 Bleed per hit
      { qpValue: 2, hitCount: 4 },                                           // L4 — Four hits!
      { qpValue: 3, hitCount: 4, tags: ['multi_bleed1'] },                  // L5 — Death by a thousand cuts
    ],
  },

  /** High-base slow attack. L5 AP reduction is the WOW moment. */
  heavy_strike: {
    levels: [
      { qpValue: 7 },                                                         // L0 — Big but expensive
      { qpValue: 8 },                                                         // L1
      { qpValue: 9 },                                                         // L2
      { qpValue: 10 },                                                        // L3
      { qpValue: 11 },                                                        // L4
      { qpValue: 12, apCost: 1 },                                           // L5 — WOW: costs 1 AP now!
    ],
  },

  /** Piercing: ignores block. L3 strips enemy block, L5 adds Vuln. */
  piercing: {
    levels: [
      { qpValue: 3 },                                                         // L0 — Weak pierce
      { qpValue: 3 },                                                         // L1
      { qpValue: 3 },                                                         // L2
      { qpValue: 4, tags: ['pierce_strip3'] },                              // L3 — also strips 3 enemy block
      { qpValue: 5 },                                                         // L4
      { qpValue: 6, tags: ['pierce_strip3', 'pierce_vuln1'] },             // L5 — also applies Vuln 1t
    ],
  },

  /** Reckless: high damage, self-damage decreases as you master it. L5: qp=10, selfDmg=0, scales self-damage with chain length instead (reckless_selfdmg_scale3 — takes 3 self-damage per chain tier). */
  reckless: {
    levels: [
      { qpValue: 4,  extras: { selfDmg: 4 } },                             // L0 — Hurts you a lot
      { qpValue: 5,  extras: { selfDmg: 4 } },                             // L1
      { qpValue: 6,  extras: { selfDmg: 3 } },                             // L2 — Self-damage drops!
      { qpValue: 8,  extras: { selfDmg: 3 } },                             // L3
      { qpValue: 10, extras: { selfDmg: 2 } },                             // L4 — Mastering the recklessness
      { qpValue: 10, extras: { selfDmg: 0 }, tags: ['reckless_selfdmg_scale3'] }, // L5 — 0 flat self-dmg, chain-scaled
    ],
  },

  /** Execute: bonus damage below HP threshold. L3 widens to 40%, L5 to 50%. */
  execute: {
    levels: [
      { qpValue: 2, extras: { execBonus: 8 } },                            // L0 — execBonus 4→8 to match resolver runtime (was reading mechanic.bonusValue=8)
      { qpValue: 3, extras: { execBonus: 5 } },                            // L1
      { qpValue: 3, extras: { execBonus: 6 } },                            // L2
      { qpValue: 4, extras: { execBonus: 8,  execThreshold: 0.4 } },      // L3 — triggers at 40% HP!
      { qpValue: 4, extras: { execBonus: 10, execThreshold: 0.4 } },      // L4
      { qpValue: 5, extras: { execBonus: 12, execThreshold: 0.5 } },      // L5 — triggers at 50%! Massive finisher
    ],
  },

  /** Lifetap: heals % of damage dealt. L2 improves heal rate, L5 reduces AP cost. */
  lifetap: {
    levels: [
      { qpValue: 5 },                                                         // L0 — bumped 3→5 for L0 viability (was too weak at 2AP)
      { qpValue: 5 },                                                         // L1 — bumped 4→5 to keep monotonic (L2 was already 5)
      { qpValue: 5, tags: ['lifetap_heal30'] },                             // L2 — heals 30% instead of 20%
      { qpValue: 6 },                                                         // L3
      { qpValue: 7 },                                                         // L4
      { qpValue: 8, apCost: 1 },                                           // L5 — costs 1 AP! Sustain machine
    ],
  },

  // ── Expansion Attacks (8) ────────────────────────────────────────────────────

  /** Power Strike: clean scaling. L5: qp=8, applies Vulnerable for 2 turns AND at 75% efficiency (power_vuln2t, power_vuln75). */
  power_strike: {
    levels: [
      { qpValue: 4 },                                                         // L0
      { qpValue: 5 },                                                         // L1
      { qpValue: 6 },                                                         // L2
      { qpValue: 7 },                                                         // L3
      { qpValue: 8 },                                                         // L4
      { qpValue: 8, tags: ['power_vuln2t', 'power_vuln75'] },               // L5 — Vuln 2 turns + 75% vuln bonus
    ],
  },

  /** Twin Strike: two hits, L3 adds third hit, L5 adds Burn per hit + chain-extends Burn (twin_burn_chain). */
  twin_strike: {
    levels: [
      { qpValue: 2, hitCount: 2 },                                           // L0
      { qpValue: 3, hitCount: 2 },                                           // L1
      { qpValue: 3, hitCount: 2 },                                           // L2
      { qpValue: 3, hitCount: 3 },                                           // L3 — third strike!
      { qpValue: 4, hitCount: 3 },                                           // L4
      { qpValue: 4, hitCount: 3, tags: ['twin_burn2', 'twin_burn_chain'] }, // L5 — 2 Burn/hit + chain extends Burn
    ],
  },

  /** Iron Wave: attack + block simultaneously. Both scale together. L5: block doubles (iron_wave_block_double). */
  iron_wave: {
    levels: [
      { qpValue: 3, secondaryValue: 5 },                                     // L0 — 3 dmg + 5 block (restored from seed; was 2+3 — unintentional nerf)
      { qpValue: 3, secondaryValue: 5 },                                     // L1 — prevent block regression from L0
      { qpValue: 3, secondaryValue: 5 },                                     // L2
      { qpValue: 4, secondaryValue: 5 },                                     // L3
      { qpValue: 4, secondaryValue: 6 },                                     // L4
      { qpValue: 5, secondaryValue: 7, tags: ['iron_wave_block_double'] },  // L5 — Balanced fighter's dream + block doubles
    ],
  },

  /** Bash: applies Vulnerable. L3 extends to 2 turns, L5 adds Weak. ap=2 at L0 only; L1+ inherits mechanic default. */
  bash: {
    levels: [
      { qpValue: 4, apCost: 2 },                                            // L0 — 4 dmg + Vuln 1t (was 3, bumped for L0 viability)
      { qpValue: 4 },                                                         // L1
      { qpValue: 5 },                                                         // L2
      { qpValue: 5, tags: ['bash_vuln2t'] },                                // L3 — Vuln lasts 2 turns!
      { qpValue: 6 },                                                         // L4
      { qpValue: 7, tags: ['bash_vuln2t', 'bash_weak1t'] },                // L5 — also Weakens!
    ],
  },

  /** Rupture: attack + Bleed stacks. L5 Bleed becomes permanent (no decay). */
  rupture: {
    levels: [
      { qpValue: 2, secondaryValue: 2 },                                     // L0 — 2 dmg + 2 Bleed
      { qpValue: 3, secondaryValue: 2 },                                     // L1
      { qpValue: 3, secondaryValue: 3 },                                     // L2 — More bleed
      { qpValue: 4, secondaryValue: 3 },                                     // L3
      { qpValue: 4, secondaryValue: 4 },                                     // L4
      { qpValue: 5, secondaryValue: 5, tags: ['rupture_bleed_perm'] },     // L5 — Bleed doesn't decay!
    ],
  },

  /** Lacerate: Bleed-heavy debuff-style attack. Low direct damage. L5 adds Vuln. */
  lacerate: {
    levels: [
      { qpValue: 1, secondaryValue: 4 },                                     // L0 — 1 dmg + 4 Bleed — secondaryValue 3→4 to match resolver runtime (was falling back to mechanic.secondaryValue=4)
      { qpValue: 2, secondaryValue: 3 },                                     // L1
      { qpValue: 2, secondaryValue: 4 },                                     // L2
      { qpValue: 2, secondaryValue: 5 },                                     // L3 — Bleed specialist
      { qpValue: 3, secondaryValue: 5 },                                     // L4
      { qpValue: 3, secondaryValue: 6, tags: ['lacerate_vuln1t'] },        // L5 — also Vulnerable 1t
    ],
  },

  /** Kindle: deals Burn stacks that trigger immediately. L5 triggers Burn twice. */
  kindle: {
    levels: [
      { qpValue: 1, secondaryValue: 4 },                                     // L0 — 1 dmg + 4 Burn (trigger) — secondaryValue 2→4 to match resolver runtime (was falling back to mechanic.secondaryValue=4)
      { qpValue: 2, secondaryValue: 3 },                                     // L1
      { qpValue: 2, secondaryValue: 4 },                                     // L2
      { qpValue: 3, secondaryValue: 4 },                                     // L3
      { qpValue: 3, secondaryValue: 5 },                                     // L4
      { qpValue: 4, secondaryValue: 6, tags: ['kindle_double_trigger'] },  // L5 — triggers Burn TWICE
    ],
  },

  /** Overcharge: bonus scales with Charges used this encounter. L3 doubles that scaling. */
  overcharge: {
    levels: [
      { qpValue: 2 },                                                         // L0
      { qpValue: 3 },                                                         // L1
      { qpValue: 3 },                                                         // L2
      { qpValue: 4, tags: ['overcharge_bonus_x2'] },                       // L3 — encounter scaling x2!
      { qpValue: 4 },                                                         // L4
      { qpValue: 5, tags: ['overcharge_bonus_x2', 'overcharge_draw1'] },  // L5 — also draw 1
    ],
  },

  // ── Flagship Attacks (5) ────────────────────────────────────────────────────

  /** Gambit: QP deals damage + self-damage; CC heals. Risk falls as mastery rises. */
  gambit: {
    levels: [
      { qpValue: 4,  extras: { selfDmg: 4, healOnCC: 3 } },               // L0 — Risky
      { qpValue: 5,  extras: { selfDmg: 4, healOnCC: 4 } },               // L1
      { qpValue: 6,  extras: { selfDmg: 3, healOnCC: 4 } },               // L2 — Less self-damage
      { qpValue: 7,  extras: { selfDmg: 3, healOnCC: 5 } },               // L3
      { qpValue: 8,  extras: { selfDmg: 2, healOnCC: 6 } },               // L4
      { qpValue: 10, extras: { selfDmg: 1, healOnCC: 8 } },               // L5 — nearly free + massive heal on CC
    ],
  },

  /** Chain Lightning: CC scales with chain length. L3 min chain = 2, L5 costs 1 AP. */
  chain_lightning: {
    levels: [
      { qpValue: 4, apCost: 2 },                                            // L0 — bumped 3→4 for L0 viability
      { qpValue: 5 },                                                         // L1 — bumped 4→5 to keep delta
      { qpValue: 5 },                                                         // L2 — bumped 4→5 to keep monotonic with L1
      { qpValue: 5, tags: ['chain_lightning_min2'] },                      // L3 — minimum chain count = 2
      { qpValue: 5 },                                                         // L4
      { qpValue: 6, apCost: 1, tags: ['chain_lightning_min2'] },          // L5 — 1 AP! Chain nuke
    ],
  },

  /** Volatile Slash: CC forgets the card. L5 removes forget penalty — repeatable nuke. */
  volatile_slash: {
    levels: [
      { qpValue: 4  },                                                        // L0 — CC + forget
      { qpValue: 5  },                                                        // L1
      { qpValue: 6  },                                                        // L2
      { qpValue: 8  },                                                        // L3
      { qpValue: 10 },                                                        // L4
      { qpValue: 12, tags: ['volatile_no_forget'] },                      // L5 — no longer forgets! Repeatable nuke
    ],
  },

  /** Precision Strike: CC bonus scales with question difficulty. L3 +50% timer, L5 doubles bonus. */
  precision_strike: {
    levels: [
      { qpValue: 5 },                                                         // L0 — CC + difficulty bonus
      { qpValue: 6 },                                                         // L1
      { qpValue: 6 },                                                         // L2
      { qpValue: 7, tags: ['precision_timer_ext50'] },                     // L3 — +50% quiz timer
      { qpValue: 8 },                                                         // L4
      { qpValue: 9, tags: ['precision_timer_ext50', 'precision_bonus_x2'] }, // L5 — difficulty bonus x2
    ],
  },

  /** Riposte: attack + block. L5: qp=3, sec=5, block-based counterattack deals 40% of block as bonus damage (riposte_block_dmg40). */
  riposte: {
    levels: [
      { qpValue: 2, secondaryValue: 4 },                                     // L0 — 2 dmg + 4 block — secondaryValue 3→4 to match resolver runtime (was falling back to mechanic.secondaryValue=4)
      { qpValue: 3, secondaryValue: 3 },                                     // L1
      { qpValue: 3, secondaryValue: 4 },                                     // L2
      { qpValue: 4, secondaryValue: 5 },                                     // L3
      { qpValue: 4, secondaryValue: 6 },                                     // L4
      { qpValue: 4, secondaryValue: 5, tags: ['riposte_block_dmg40'] },    // L5 — deals bonus dmg = 40% of block; qpValue kept at 4 (not 3) for monotonic invariant
    ],
  },

  // ── Chase Attacks (5) ────────────────────────────────────────────────────────

  /** Smite: scales with Aura. L3 doubles Aura scaling, L5 costs 1 AP. */
  smite: {
    levels: [
      { qpValue: 7,  apCost: 2 },                                           // L0 — bumped 6→7 for L0 viability
      { qpValue: 8  },                                                        // L1 — bumped 7→8 (keep monotonic)
      { qpValue: 9  },                                                        // L2 — bumped 8→9 (keep monotonic)
      { qpValue: 10, tags: ['smite_aura_x2'] },                            // L3 — Aura scaling x2; bumped 9→10
      { qpValue: 11 },                                                        // L4 — bumped 10→11
      { qpValue: 12, apCost: 1, tags: ['smite_aura_x2'] },                // L5 — 1 AP! Keep cap at 12
    ],
  },

  /** Feedback Loop: CW = 0 + Aura crash. L3 halves crash, L5 makes CW deal damage instead of 0. */
  feedback_loop: {
    levels: [
      { qpValue: 3 },                                                         // L0 — CW = 0 + crash
      { qpValue: 4 },                                                         // L1
      { qpValue: 5 },                                                         // L2
      { qpValue: 6, tags: ['feedback_crash_half'] },                       // L3 — CW Aura crash halved
      { qpValue: 7 },                                                         // L4
      { qpValue: 8, tags: ['feedback_crash_half', 'feedback_cw_nonzero'] }, // L5 — CW deals 50% instead of 0
    ],
  },

  /** Recall: bonus CC when card is from review queue. L3 heals on review CC, L5 draws. */
  recall: {
    levels: [
      { qpValue: 5  },                                                        // L0 — CC + review bonus
      { qpValue: 6  },                                                        // L1
      { qpValue: 7  },                                                        // L2
      { qpValue: 8,  tags: ['recall_heal3'] },                             // L3 — also heals 3 on review CC
      { qpValue: 9  },                                                        // L4
      { qpValue: 10, tags: ['recall_heal3', 'recall_draw1'] },             // L5 — also draws 1 on review CC
    ],
  },

  /** Hemorrhage: consumes all enemy Bleed stacks (damage = bleedMult × stacks). L5 costs 1 AP. */
  hemorrhage: {
    levels: [
      { qpValue: 4, apCost: 2, extras: { bleedMult: 3 } },                 // L0 — bumped 2→4 (was too weak at 2AP; bleedMult is the value)
      { qpValue: 4, apCost: 2, extras: { bleedMult: 4 } },                 // L1 — bumped 2→4
      { qpValue: 4, apCost: 2, extras: { bleedMult: 4 } },                 // L2 — bumped 2→4
      { qpValue: 5, apCost: 2, extras: { bleedMult: 5 } },                 // L3 — bumped 3→5; 5x Bleed!
      { qpValue: 5, apCost: 2, extras: { bleedMult: 6 } },                 // L4 — bumped 3→5
      { qpValue: 6, apCost: 1, extras: { bleedMult: 7 } },                 // L5 — bumped 4→6; 1 AP! 7x Bleed finisher
    ],
  },

  /** Eruption: X-cost (spends all AP), deals dmgPerAp x AP. L5 refunds 1 AP after play. */
  eruption: {
    levels: [
      { qpValue: 0, extras: { dmgPerAp: 6  } },                            // L0 — 6 dmg per AP spent
      { qpValue: 0, extras: { dmgPerAp: 7  } },                            // L1
      { qpValue: 0, extras: { dmgPerAp: 8  } },                            // L2
      { qpValue: 0, extras: { dmgPerAp: 9  } },                            // L3
      { qpValue: 0, extras: { dmgPerAp: 10 } },                            // L4
      { qpValue: 0, extras: { dmgPerAp: 12 }, tags: ['eruption_refund1'] }, // L5 — refunds 1 AP after play
    ],
  },


  // ─── Shield Cards — Phase 2 Batch 2 ────────────────────────────────────────

  // ── Core Shields (7) ──────────────────────────────────────────────────────

  /** block: simple block scaling, reliable baseline. L5: +bonus block when played 3+ times consecutively (block_consecutive3). */
  block: {
    levels: [
      { qpValue: 4 },                                          // L0: weak but reliable
      { qpValue: 4 },                                          // L1
      { qpValue: 5 },                                          // L2
      { qpValue: 6 },                                          // L3
      { qpValue: 7 },                                          // L4
      { qpValue: 8, tags: ['block_consecutive3'] },            // L5: bonus block on 3+ consecutive plays
    ],
  },

  /** thorns: block + reflect damage — sec=reflect value */
  thorns: {
    levels: [
      { qpValue: 2, secondaryValue: 3 },                       // L0: 2 block + 3 reflect — secondaryValue 1→3 to match resolver runtime (was reading hardcoded 3)
      { qpValue: 3, secondaryValue: 2 },                       // L1
      { qpValue: 3, secondaryValue: 2 },                       // L2
      { qpValue: 4, secondaryValue: 3 },                       // L3: real reflect damage
      { qpValue: 5, secondaryValue: 3 },                       // L4
      { qpValue: 6, secondaryValue: 4, tags: ['thorns_persist'] }, // L5: thorns persist entire encounter!
    ],
  },

  /** emergency: doubles below 30% HP — extras.emergThreshold controls trigger threshold */
  emergency: {
    levels: [
      { qpValue: 2 },                                          // L0: CC=4 (x2 if <30%)
      { qpValue: 3 },                                          // L1
      { qpValue: 4 },                                          // L2
      { qpValue: 5, extras: { emergThreshold: 0.4 } },         // L3: triggers at 40% HP!
      { qpValue: 6 },                                          // L4
      { qpValue: 7, extras: { emergThreshold: 0.5 } },         // L5: triggers at 50% HP — defensive anchor
    ],
  },

  /** fortify: ap=2, doubles current block — big block potential */
  fortify: {
    levels: [
      { qpValue: 5, apCost: 2 },                               // L0 — bumped 4→5 for L0 viability
      { qpValue: 6 },                                          // L1 — bumped 5→6
      { qpValue: 7 },                                          // L2 — bumped 6→7
      { qpValue: 8 },                                          // L3 — bumped 7→8
      { qpValue: 9 },                                          // L4 — bumped 8→9
      { qpValue: 10, apCost: 1, tags: ['fortify_carry'] },      // L5: block persists next turn! AP cost reduced to 1 (unchanged)
    ],
  },

  /** brace: block = enemy telegraph value — extra block value from plan is QP base */
  brace: {
    levels: [
      { qpValue: 2 },                                          // L0: CC=4 + telegraph match
      { qpValue: 3 },                                          // L1
      { qpValue: 4 },                                          // L2
      { qpValue: 4, tags: ['brace_exceed2'] },                  // L3: block exceeds telegraph by +2
      { qpValue: 5 },                                          // L4
      { qpValue: 6, tags: ['brace_exceed2', 'brace_draw1'] },   // L5: also draws 1
    ],
  },

  /** overheal: ap=2, doubles below 60% HP (was 50%) — hybrid offensive/defensive */
  overheal: {
    levels: [
      { qpValue: 6, apCost: 2 },                               // L0 — bumped 5→6 for L0 viability
      { qpValue: 7 },                                          // L1 — bumped 6→7
      { qpValue: 8 },                                          // L2 — bumped 7→8
      { qpValue: 8, apCost: 1, tags: ['overheal_heal2'] },      // L3: also heals 2 HP! AP cost reduced to 1 (bumped 6→8 for monotonic after L2=8)
      { qpValue: 8, apCost: 1 },                               // L4 — was missing apCost:1 (bug: AP reverted to 2); fixed + keep monotonic L3=8
      { qpValue: 9, apCost: 1, tags: ['overheal_heal2', 'overheal_heal_pct5'] }, // L5 — bumped 8→9; also heals 5% max HP. AP=1
    ],
  },

  /** parry: block + draw if enemy attacks — sec=drawCount on enemy attack */
  parry: {
    levels: [
      { qpValue: 1, secondaryValue: 1 },                       // L0: 1 block + draw 1 on enemy atk
      { qpValue: 2, secondaryValue: 1 },                       // L1
      { qpValue: 3, secondaryValue: 1 },                       // L2
      { qpValue: 3, secondaryValue: 2 },                       // L3: draws 2 on enemy attack!
      { qpValue: 4, secondaryValue: 2 },                       // L4
      { qpValue: 5, secondaryValue: 2, tags: ['parry_counter3'] }, // L5: also deals 3 damage to attacker
    ],
  },

  // ── Expansion Shields (5) ─────────────────────────────────────────────────

  /** reinforce: solid block scaling with late-game draw payoff. L5: draws 1 AND gains 1 permanent block (reinforce_perm1). */
  reinforce: {
    levels: [
      { qpValue: 5 },                                          // L0
      { qpValue: 6 },                                          // L1
      { qpValue: 6 },                                          // L2
      { qpValue: 7 },                                          // L3
      { qpValue: 8 },                                          // L4
      { qpValue: 9, tags: ['reinforce_draw1', 'reinforce_perm1'] }, // L5: draw 1 + 1 permanent block
    ],
  },

  /** shrug_it_off: block + draw — drawCount field */
  shrug_it_off: {
    levels: [
      { qpValue: 2, drawCount: 1 },                            // L0: 2 block + draw 1
      { qpValue: 3, drawCount: 1 },                            // L1
      { qpValue: 4, drawCount: 1 },                            // L2
      { qpValue: 4, drawCount: 2 },                            // L3: draws 2!
      { qpValue: 5, drawCount: 2 },                            // L4
      { qpValue: 6, drawCount: 2, tags: ['shrug_cleanse1'] },   // L5: also removes 1 debuff
    ],
  },

  /** guard: ap=2, big block with late taunt */
  guard: {
    levels: [
      { qpValue: 8, apCost: 2 },                               // L0
      { qpValue: 9 },                                          // L1
      { qpValue: 10 },                                         // L2
      { qpValue: 11 },                                         // L3
      { qpValue: 12 },                                         // L4
      { qpValue: 14, apCost: 1, tags: ['guard_taunt1t'] },      // L5: taunt + AP cost reduced to 1
    ],
  },

  /** absorb: block with CC draw payoff. L5: CC draws 2 + refunds 1 AP when block absorbs damage (absorb_ap_on_block). */
  absorb: {
    levels: [
      { qpValue: 2 },                                          // L0: CC=4 + draw 1
      { qpValue: 3 },                                          // L1
      { qpValue: 4 },                                          // L2
      { qpValue: 4, tags: ['absorb_draw2cc'] },                 // L3: CC draws 2!
      { qpValue: 5 },                                          // L4
      { qpValue: 6, tags: ['absorb_draw2cc', 'absorb_ap_on_block'] }, // L5: CC draws 2 + AP refund on block
    ],
  },

  /** reactive_shield: block + thorns — sec=thorns value */
  reactive_shield: {
    levels: [
      { qpValue: 2, secondaryValue: 2 },                       // L0: 2 block + 2 thorns — secondaryValue 1→2 to match resolver runtime (was falling back to mechanic.secondaryValue=2)
      { qpValue: 2, secondaryValue: 2 },                       // L1
      { qpValue: 3, secondaryValue: 2 },                       // L2
      { qpValue: 3, secondaryValue: 3 },                       // L3: 3 thorns damage
      { qpValue: 4, secondaryValue: 3 },                       // L4
      { qpValue: 5, secondaryValue: 4, tags: ['reactive_thorns_persist'] }, // L5: thorns persist this encounter
    ],
  },

  // ── Phase 3 Chase Shields (3) ─────────────────────────────────────────────

  /** bulwark: ap=2 (was 3), forget removed at L3+; L5=1 AP — massive block ceiling */
  bulwark: {
    maxLevel: 5,
    levels: [
      { qpValue: 9, apCost: 2 },                                                        // L0: 2 AP for 9 block (CC: 16 block + FORGET)
      { qpValue: 10 },                                                                   // L1
      { qpValue: 12 },                                                                   // L2
      { qpValue: 12, tags: ['bulwark_no_forget'] },                                    // L3: forget removed! Still 2 AP
      { qpValue: 14, tags: ['bulwark_no_forget'] },                                    // L4
      { qpValue: 16, apCost: 1, tags: ['bulwark_no_forget'] },                         // L5: 1 AP premium shield, no forget
    ],
  },

  /** conversion (Shield Bash): deal damage = current block — sec block treated separately */
  conversion: {
    maxLevel: 5,
    levels: [
      { qpValue: 3 },                                          // L0: CC=5 + deals block as dmg
      { qpValue: 4 },                                          // L1
      { qpValue: 5 },                                          // L2
      { qpValue: 5, tags: ['conversion_bonus_50pct'] },         // L3: deals 150% of block
      { qpValue: 6 },                                          // L4
      { qpValue: 7, tags: ['conversion_bonus_50pct', 'conversion_keep_block'] }, // L5: doesn't consume block!
    ],
  },

  /** ironhide: ap=2, block + Strength — extras.str and extras.strPerm; perm from L0 on CC */
  ironhide: {
    maxLevel: 5,
    levels: [
      { qpValue: 6, apCost: 2, extras: { str: 1, strPerm: 1 } },  // L0 — bumped 5→6 for L0 viability
      { qpValue: 7,            extras: { str: 1, strPerm: 1 } },  // L1 — bumped 6→7
      { qpValue: 7,            extras: { str: 1, strPerm: 1 } },  // L2 — bumped 6→7
      { qpValue: 7,            extras: { str: 1, strPerm: 1 } },  // L3: Strength is PERMANENT on CC! Fixed drop 5→7 (was non-monotonic)
      { qpValue: 7,            extras: { str: 2, strPerm: 1 } },  // L4: +2 Str! (was 6, fixed non-monotonic after L3 fix)
      { qpValue: 8, apCost: 1, extras: { str: 2, strPerm: 1 } },  // L5: 1 AP! bumped 7→8
    ],
  },
  /** burnout_shield: CC forgets at L0-L4; L5 CC no longer forgets (burnout_no_forget tag). ap=1. Block scales strongly. */
  burnout_shield: {
    maxLevel: 5,
    levels: [
      { qpValue: 5 },                                              // L0: 5 block (CC forgets)
      { qpValue: 6 },                                              // L1
      { qpValue: 7 },                                              // L2
      { qpValue: 9 },                                              // L3
      { qpValue: 11 },                                             // L4
      { qpValue: 13, tags: ['burnout_no_forget'] },               // L5: no longer forgets (wired 2026-04-10)
    ],
  },

  /** knowledge_ward: knowledge-scaling block shield. ap=1. L3+ cleanses 1 debuff (knowledge_ward_cleanse tag). */
  knowledge_ward: {
    maxLevel: 5,
    levels: [
      { qpValue: 6 },                                              // L0
      { qpValue: 7 },                                              // L1
      { qpValue: 8 },                                              // L2
      { qpValue: 9,  tags: ['knowledge_ward_cleanse'] },           // L3: cleanses 1 debuff (wired 2026-04-10)
      { qpValue: 10, tags: ['knowledge_ward_cleanse'] },           // L4
      { qpValue: 12, tags: ['knowledge_ward_cleanse'] },           // L5
    ],
  },

  // ── Buff Cards ──

  /** empower: percentage buff to next card(s). L5: 60% to next 2 cards + applies Weakness 2 to enemy (empower_weak2). */
  empower: {
    levels: [
      { qpValue: 30 },                                           // L0: 30% boost
      { qpValue: 35 },                                           // L1
      { qpValue: 40 },                                           // L2
      { qpValue: 45, tags: ['empower_2cards'] },                 // L3: boosts next 2 cards!
      { qpValue: 50 },                                           // L4
      { qpValue: 60, tags: ['empower_2cards', 'empower_weak2'] }, // L5: 60% to next 2 cards + Weakness 2 on enemy
    ],
  },

  quicken: {
    levels: [
      { qpValue: 1, apCost: 0 },                                 // L0: +1 AP
      { qpValue: 1, tags: ['quicken_draw1'] },                   // L1: also draws 1!
      { qpValue: 1, tags: ['quicken_draw1'] },                   // L2
      { qpValue: 1, tags: ['quicken_draw2'] },                   // L3: draws 2!
      { qpValue: 1, tags: ['quicken_draw2'] },                   // L4
      { qpValue: 1, tags: ['quicken_draw2', 'quicken_ap2'] },    // L5: +2 AP instead of +1!
    ],
  },

  focus: {
    levels: [
      { qpValue: 1 },                                            // L0: next card -1 AP
      { qpValue: 1 },                                            // L1
      { qpValue: 1, tags: ['focus_draw1'] },                     // L2: also draws 1
      { qpValue: 1, apCost: 0, tags: ['focus_draw1', 'focus_ap0'] }, // L3: Focus itself costs 0 AP!
      { qpValue: 1, apCost: 0, tags: ['focus_draw1', 'focus_ap0'] }, // L4
      { qpValue: 1, apCost: 0, tags: ['focus_draw1', 'focus_next2free'] }, // L5: next 2 cards cost 0!
    ],
  },

  double_strike: {
    levels: [
      { qpValue: 1, apCost: 2, extras: { hitMult: 75 } },        // L0: 75% power per hit (QP)
      { qpValue: 1, apCost: 2, extras: { hitMult: 80 } },        // L1
      { qpValue: 1, apCost: 2, extras: { hitMult: 85 } },        // L2
      { qpValue: 1, apCost: 1, extras: { hitMult: 90 } },        // L3: AP cost reduced to 1
      { qpValue: 1, apCost: 1, extras: { hitMult: 95 } },        // L4
      { qpValue: 1, apCost: 1, extras: { hitMult: 100 }, tags: ['double_strike_pierce'] }, // L5: 100% power + pierces block!
    ],
  },

  inscription_fury: {
    levels: [
      { qpValue: 1, apCost: 2 },                                 // L0: +1 flat ATK all combat
      { qpValue: 1, apCost: 2 },                                 // L1
      { qpValue: 2, apCost: 2 },                                 // L2: +2 flat ATK
      { qpValue: 2, apCost: 1 },                                 // L3: AP cost reduced to 1
      { qpValue: 3, apCost: 1 },                                 // L4: +3 flat ATK
      { qpValue: 3, apCost: 1, tags: ['insc_fury_cc_bonus2'] },  // L5: CC gets extra +2 on top
    ],
  },

  inscription_iron: {
    levels: [
      { qpValue: 1, apCost: 2 },                                 // L0: +1 block per turn all combat
      { qpValue: 2, apCost: 2 },                                 // L1: +2
      { qpValue: 2, apCost: 2 },                                 // L2
      { qpValue: 3, apCost: 1 },                                 // L3: +3. AP cost reduced to 1
      { qpValue: 3, apCost: 1 },                                 // L4
      { qpValue: 4, apCost: 1, tags: ['insc_iron_thorns1'] },    // L5: also +1 thorns per turn
    ],
  },

  warcry: {
    levels: [
      { qpValue: 1, extras: { str: 1, strTurns: 1 } },           // L0: +1 Str (this turn)
      { qpValue: 1, extras: { str: 2, strTurns: 1 } },           // L1
      { qpValue: 1, extras: { str: 2, strTurns: 2 } },           // L2: lasts 2 turns
      { qpValue: 1, extras: { str: 2, strTurns: 2 }, tags: ['warcry_freecharge'] }, // L3: next Charge free!
      { qpValue: 1, extras: { str: 3, strTurns: 2 } },           // L4
      { qpValue: 1, extras: { str: 3, strTurns: 99 }, tags: ['warcry_freecharge'] }, // L5: +3 Str PERMANENT on CC!
    ],
  },

  battle_trance: {
    levels: [
      { qpValue: 0, drawCount: 2 },                              // L0: Draw 2 (lockout on QP/CW)
      { qpValue: 0, drawCount: 2 },                              // L1
      { qpValue: 0, drawCount: 3 },                              // L2: Draw 3!
      { qpValue: 0, drawCount: 3, tags: ['trance_no_lockout_qp'] }, // L3: QP no longer locks you out!
      { qpValue: 0, drawCount: 4 },                              // L4: Draw 4!
      { qpValue: 0, drawCount: 4, tags: ['trance_no_lockout_qp', 'trance_cc_ap1'] }, // L5: CC grants +1 AP
    ],
  },

  frenzy: {
    levels: [
      { qpValue: 1, apCost: 2, extras: { freeCards: 1 } },       // L0: Next 1 card free
      { qpValue: 1, apCost: 2, extras: { freeCards: 2 } },       // L1: Next 2 free!
      { qpValue: 1, apCost: 2, extras: { freeCards: 2 } },       // L2
      { qpValue: 1, apCost: 2, extras: { freeCards: 3 } },       // L3: next 3 free!
      { qpValue: 1, apCost: 2, extras: { freeCards: 3 } },       // L4
      { qpValue: 1, apCost: 1, extras: { freeCards: 3 }, tags: ['frenzy_draw1'] }, // L5: 1 AP + draws 1
    ],
  },

  /** mastery_surge: boost mastery of cards in hand. L5: choose 3 cards, +2 mastery each, refunds 1 AP (msurge_ap_on_l5). */
  mastery_surge: {
    levels: [
      { qpValue: 0, extras: { targets: 1 } },                    // L0: +1 mastery to 1 card
      { qpValue: 0, extras: { targets: 1 } },                    // L1
      { qpValue: 0, extras: { targets: 2 } },                    // L2: 2 cards!
      { qpValue: 0, extras: { targets: 2 }, tags: ['msurge_choose'] }, // L3: choose which cards (not random)
      { qpValue: 0, extras: { targets: 3 } },                    // L4: 3 cards!
      { qpValue: 0, extras: { targets: 3 }, tags: ['msurge_choose', 'msurge_plus2', 'msurge_ap_on_l5'] }, // L5: +2 mastery + AP refund
    ],
  },

  // ── Debuff Cards ──

  /** weaken: applies Weakness stacks to enemy (reduces enemy damage). L5: 3 stacks 3 turns + player gains 30 block (weaken_shield30). */
  weaken: {
    levels: [
      { qpValue: 0, extras: { stacks: 1, turns: 1 } },           // L0: 1 Weakness, 1 turn
      { qpValue: 0, extras: { stacks: 1, turns: 2 } },           // L1: Lasts 2 turns
      { qpValue: 0, extras: { stacks: 1, turns: 2 } },           // L2
      { qpValue: 0, extras: { stacks: 2, turns: 2 } },           // L3: 2 stacks!
      { qpValue: 0, extras: { stacks: 2, turns: 3 } },           // L4
      { qpValue: 0, extras: { stacks: 3, turns: 3 }, tags: ['weaken_shield30'] }, // L5: 3 stacks 3 turns + 30 shield
    ],
  },

  /** expose: applies Vulnerable stacks to enemy (increases damage taken). L5: 2 stacks 3 turns, deals 3 damage, 75% Vuln amplification (expose_dmg3, expose_vuln75). */
  expose: {
    levels: [
      { qpValue: 0, extras: { stacks: 1, turns: 1 } },           // L0: 1 Vulnerable, 1 turn
      { qpValue: 0, extras: { stacks: 1, turns: 1 } },           // L1
      { qpValue: 0, extras: { stacks: 1, turns: 2 } },           // L2: Lasts 2 turns
      { qpValue: 0, extras: { stacks: 2, turns: 2 } },           // L3: 2 stacks!
      { qpValue: 0, extras: { stacks: 2, turns: 2 } },           // L4
      { qpValue: 0, extras: { stacks: 2, turns: 3 }, tags: ['expose_dmg3', 'expose_vuln75'] }, // L5: 3 dmg + 75% Vuln amp
    ],
  },

  hex: {
    levels: [
      { qpValue: 0, extras: { stacks: 3, turns: 3 } },           // L0: 3 Poison, 3 turns — stacks/turns 2→3 to match resolver runtime
      { qpValue: 0, extras: { stacks: 2, turns: 3 } },           // L1
      { qpValue: 0, extras: { stacks: 3, turns: 3 } },           // L2
      { qpValue: 0, extras: { stacks: 3, turns: 3 }, tags: ['hex_vuln1t'] }, // L3: also Vulnerable 1t
      { qpValue: 0, extras: { stacks: 4, turns: 3 } },           // L4
      { qpValue: 0, extras: { stacks: 5, turns: 4 }, tags: ['hex_vuln1t'] }, // L5: massive poison
    ],
  },

  slow: {
    levels: [
      { qpValue: 0, apCost: 2 },                                 // L0: Skip enemy defend/buff
      { qpValue: 0, apCost: 2 },                                 // L1
      { qpValue: 0, apCost: 2, tags: ['slow_any_action'] },      // L2: can skip ANY action, not just defend/buff!
      { qpValue: 0, apCost: 1, tags: ['slow_any_action'] },      // L3: costs 1 AP!
      { qpValue: 0, apCost: 1 },                                 // L4
      { qpValue: 0, apCost: 1, tags: ['slow_any_action', 'slow_weak1t'] }, // L5: also applies Weakness 1t
    ],
  },

  sap: {
    levels: [
      { qpValue: 1 },                                            // L0: 1 dmg + Weakness 1t
      { qpValue: 2 },                                            // L1: 2 dmg
      { qpValue: 2, tags: ['sap_weak2t'] },                      // L2: Weakness lasts 2t
      { qpValue: 3, tags: ['sap_weak2t'] },                      // L3
      { qpValue: 3 },                                            // L4
      { qpValue: 4, tags: ['sap_weak2t', 'sap_strip3block'] },   // L5: also strips 3 enemy block
    ],
  },

  corrode: {
    levels: [
      { qpValue: 2 },                                            // L0: CC=4 + strip block + Weak 1t
      { qpValue: 3 },                                            // L1
      { qpValue: 3 },                                            // L2
      { qpValue: 4, tags: ['corrode_vuln1t'] },                  // L3: also Vulnerable 1t
      { qpValue: 4 },                                            // L4
      { qpValue: 5, tags: ['corrode_vuln1t', 'corrode_strip_all'] }, // L5: strips ALL enemy block
    ],
  },

  curse_of_doubt: {
    levels: [
      { qpValue: 15, extras: { pctBonus: 15, turns: 1 } },       // L0: +15% charge dmg, 1t
      { qpValue: 20, extras: { pctBonus: 20, turns: 2 } },       // L1
      { qpValue: 25, extras: { pctBonus: 25, turns: 2 } },       // L2
      { qpValue: 30, extras: { pctBonus: 30, turns: 2 } },       // L3
      { qpValue: 35, extras: { pctBonus: 35, turns: 3 } },       // L4
      { qpValue: 45, extras: { pctBonus: 45, turns: 3 } },       // L5: nearly half more damage for 3 turns
    ],
  },

  mark_of_ignorance: {
    levels: [
      { qpValue: 2, extras: { flatBonus: 2, turns: 1 } },        // L0: +2 flat charge dmg, 1t
      { qpValue: 2, extras: { flatBonus: 2, turns: 2 } },        // L1
      { qpValue: 3, extras: { flatBonus: 3, turns: 2 } },        // L2
      { qpValue: 3, extras: { flatBonus: 3, turns: 3 } },        // L3: 3 turns!
      { qpValue: 4, extras: { flatBonus: 4, turns: 3 } },        // L4
      { qpValue: 5, extras: { flatBonus: 5, turns: 3 } },        // L5: +5 flat per charge
    ],
  },

  corroding_touch: {
    levels: [
      { qpValue: 0, apCost: 0, extras: { weakStacks: 1, weakTurns: 1 } }, // L0
      { qpValue: 0, extras: { weakStacks: 1, weakTurns: 2 } },   // L1
      { qpValue: 0, extras: { weakStacks: 2, weakTurns: 2 } },   // L2
      { qpValue: 0, extras: { weakStacks: 2, weakTurns: 2 }, tags: ['corrtouch_vuln1t'] }, // L3: also Vulnerable 1t
      { qpValue: 0, extras: { weakStacks: 2, weakTurns: 3 } },   // L4
      { qpValue: 0, extras: { weakStacks: 3, weakTurns: 3 }, tags: ['corrtouch_vuln1t'] }, // L5: 3 stacks + Vuln
    ],
  },

  entropy: {
    levels: [
      { qpValue: 0, apCost: 2, extras: { burn: 2, poison: 1, poisonTurns: 2 } },  // L0
      { qpValue: 0, apCost: 2, extras: { burn: 3, poison: 2, poisonTurns: 2 } },  // L1
      { qpValue: 0, apCost: 2, extras: { burn: 4, poison: 2, poisonTurns: 2 } },  // L2
      { qpValue: 0, apCost: 2, extras: { burn: 4, poison: 3, poisonTurns: 3 } },  // L3: poison lasts 3t
      { qpValue: 0, apCost: 2, extras: { burn: 5, poison: 3, poisonTurns: 3 } },  // L4
      { qpValue: 0, apCost: 1, extras: { burn: 6, poison: 4, poisonTurns: 3 } },  // L5: 1 AP!
    ],
  },

  // ── Utility Cards ──

  cleanse: {
    levels: [
      { qpValue: 0, drawCount: 0 },                              // L0: Remove debuffs
      { qpValue: 0, drawCount: 1 },                              // L1: also draws 1!
      { qpValue: 0, drawCount: 1 },                              // L2
      { qpValue: 0, drawCount: 1, tags: ['cleanse_heal3'] },     // L3: also heals 3 HP
      { qpValue: 0, drawCount: 2 },                              // L4: draws 2!
      { qpValue: 0, drawCount: 2, tags: ['cleanse_heal3', 'cleanse_block3'] }, // L5: +3 block too
    ],
  },

  scout: {
    levels: [
      { qpValue: 0, drawCount: 1, apCost: 1 },                   // L0: Draw 1
      { qpValue: 0, drawCount: 2 },                              // L1: Draw 2!
      { qpValue: 0, drawCount: 2 },                              // L2
      { qpValue: 0, drawCount: 2, tags: ['scout_scry2'] },       // L3: also scry 2
      { qpValue: 0, drawCount: 3 },                              // L4: Draw 3!
      { qpValue: 0, drawCount: 3, apCost: 0, tags: ['scout_scry2'] }, // L5: FREE! Draw 3 + scry 2
    ],
  },

  recycle: {
    levels: [
      { qpValue: 0, drawCount: 2 },                              // L0: Draw 2
      { qpValue: 0, drawCount: 2 },                              // L1
      { qpValue: 0, drawCount: 3 },                              // L2: Draw 3!
      { qpValue: 0, drawCount: 3, tags: ['recycle_discard_pick'] }, // L3: choose which card from discard
      { qpValue: 0, drawCount: 3 },                              // L4
      { qpValue: 0, drawCount: 4, tags: ['recycle_discard_pick'] }, // L5: draw 4 + pick from discard
    ],
  },

  foresight: {
    // BATCH-ULTRA Cluster G: Foresight was 0 AP at all mastery levels — strictly dominant.
    // Fix: free at mastery 0 (onboarding), 1 AP at mastery 1+ (restores decision tension).
    levels: [
      { qpValue: 0, drawCount: 1, apCost: 0 },                            // L0: Free draw 1 — zero-cost for new players
      { qpValue: 0, drawCount: 1, apCost: 1 },                            // L1: Draw 1, now costs 1 AP
      { qpValue: 0, drawCount: 2, apCost: 1 },                            // L2: Draw 2!
      { qpValue: 0, drawCount: 2, apCost: 1, tags: ['foresight_intent'] }, // L3: see enemy's NEXT intent too
      { qpValue: 0, drawCount: 2, apCost: 1 },                            // L4
      { qpValue: 0, drawCount: 3, apCost: 1, tags: ['foresight_intent'] }, // L5: draw 3 + see next intent
    ],
  },

  conjure: {
    levels: [
      { qpValue: 0, extras: { picks: 1, tier: 1 } },             // L0: Choose 1 of 3 common cards
      { qpValue: 0, extras: { picks: 1, tier: 1 } },             // L1
      { qpValue: 0, extras: { picks: 1, tier: 2 } },             // L2: uncommon cards!
      { qpValue: 0, extras: { picks: 2, tier: 2 } },             // L3: pick 2 cards!
      { qpValue: 0, extras: { picks: 2, tier: 2 } },             // L4
      { qpValue: 0, extras: { picks: 2, tier: 3 } },             // L5: pick 2 rare cards!
    ],
  },

  forge: {
    levels: [
      { qpValue: 0, extras: { upgrades: 1, amount: 1 } },        // L0: +1 mastery to 1 card
      { qpValue: 0, extras: { upgrades: 1, amount: 1 } },        // L1
      { qpValue: 0, extras: { upgrades: 1, amount: 2 } },        // L2: +2 mastery!
      { qpValue: 0, extras: { upgrades: 2, amount: 1 } },        // L3: upgrade 2 cards
      { qpValue: 0, extras: { upgrades: 2, amount: 2 } },        // L4
      { qpValue: 0, extras: { upgrades: 3, amount: 2 } },        // L5: +2 mastery to 3 cards!
    ],
  },

  transmute: {
    levels: [
      { qpValue: 0, extras: { transforms: 1 } },                 // L0: Transform weakest card
      { qpValue: 0, extras: { transforms: 1 } },                 // L1
      { qpValue: 0, extras: { transforms: 1 }, tags: ['transmute_choose'] }, // L2: choose which card
      { qpValue: 0, extras: { transforms: 1 }, tags: ['transmute_choose', 'transmute_upgrade1'] }, // L3: transformed card gets +1 mastery
      { qpValue: 0, extras: { transforms: 1 }, tags: ['transmute_choose', 'transmute_upgrade1'] }, // L4
      { qpValue: 0, extras: { transforms: 2 }, tags: ['transmute_choose', 'transmute_upgrade1'] }, // L5: transform 2 cards!
    ],
  },

  immunity: {
    levels: [
      { qpValue: 0, extras: { absorb: 4 } },                     // L0: Absorb up to 4 dmg
      { qpValue: 0, extras: { absorb: 5 } },                     // L1
      { qpValue: 0, extras: { absorb: 6 } },                     // L2
      { qpValue: 0, extras: { absorb: 8 } },                     // L3: absorbs 8!
      { qpValue: 0, extras: { absorb: 10 } },                    // L4
      { qpValue: 0, extras: { absorb: 12 }, tags: ['immunity_reflect50'] }, // L5: reflects 50% of absorbed damage
    ],
  },

  sift: {
    levels: [
      { qpValue: 0, extras: { scryCount: 2 } },                  // L0: Look at top 2
      { qpValue: 0, extras: { scryCount: 3 } },                  // L1
      { qpValue: 0, extras: { scryCount: 3 } },                  // L2
      { qpValue: 0, extras: { scryCount: 4 }, tags: ['sift_draw1'] }, // L3: also draw 1
      { qpValue: 0, extras: { scryCount: 5 } },                  // L4
      { qpValue: 0, extras: { scryCount: 5 }, tags: ['sift_draw1', 'sift_discard_dmg2'] }, // L5: discarded cards deal 2 dmg each
    ],
  },

  scavenge: {
    levels: [
      { qpValue: 0, extras: { picks: 1 } },                      // L0: Put 1 card from discard on top
      { qpValue: 0, extras: { picks: 1 } },                      // L1
      { qpValue: 0, extras: { picks: 1 }, tags: ['scavenge_draw1'] }, // L2: also draw 1
      { qpValue: 0, extras: { picks: 2 }, tags: ['scavenge_draw1'] }, // L3: pick 2 cards!
      { qpValue: 0, extras: { picks: 2 } },                      // L4
      { qpValue: 0, apCost: 0, extras: { picks: 2 }, tags: ['scavenge_draw1'] }, // L5: costs 0 AP!
    ],
  },

  swap: {
    levels: [
      { qpValue: 0, drawCount: 1, apCost: 0 },                   // L0: Discard 1, draw 1 (free)
      { qpValue: 0, drawCount: 1 },                              // L1
      { qpValue: 0, drawCount: 2 },                              // L2: Discard 1, draw 2!
      { qpValue: 0, drawCount: 2, tags: ['swap_cc_draw3'] },     // L3: CC draws 3!
      { qpValue: 0, drawCount: 2 },                              // L4
      { qpValue: 0, drawCount: 3, tags: ['swap_cc_draw3'] },     // L5: discard 1, draw 3
    ],
  },

  archive: {
    levels: [
      { qpValue: 0, extras: { retain: 1 } },                     // L0: Retain 1 card
      { qpValue: 0, extras: { retain: 1 } },                     // L1
      { qpValue: 0, extras: { retain: 2 } },                     // L2: retain 2!
      { qpValue: 0, extras: { retain: 2 }, tags: ['archive_block2_per'] }, // L3: retained cards gain +2 block
      { qpValue: 0, extras: { retain: 3 } },                     // L4: Retain 3!
      { qpValue: 0, extras: { retain: 3 }, tags: ['archive_block2_per', 'archive_draw1'] }, // L5: also draw 1
    ],
  },

  reflex: {
    levels: [
      { qpValue: 0, drawCount: 1, extras: { passiveBlock: 2 } }, // L0: Draw 1; passive: discard=2 block
      { qpValue: 0, drawCount: 2, extras: { passiveBlock: 2 } }, // L1: Draw 2!
      { qpValue: 0, drawCount: 2, extras: { passiveBlock: 3 } }, // L2
      { qpValue: 0, drawCount: 2, extras: { passiveBlock: 3 }, tags: ['reflex_draw3cc'] }, // L3: CC draws 3
      { qpValue: 0, drawCount: 3, extras: { passiveBlock: 4 } }, // L4
      { qpValue: 0, drawCount: 3, extras: { passiveBlock: 5 }, tags: ['reflex_draw3cc'] }, // L5: draw 3 + 5 block on discard
    ],
  },

  recollect: {
    levels: [
      { qpValue: 0, extras: { returns: 1 } },                    // L0: Return 1 forgotten
      { qpValue: 0, extras: { returns: 1 } },                    // L1
      { qpValue: 0, extras: { returns: 2 } },                    // L2: return 2!
      { qpValue: 0, extras: { returns: 2 }, tags: ['recollect_upgrade1'] }, // L3: returned cards +1 mastery
      { qpValue: 0, extras: { returns: 3 } },                    // L4
      { qpValue: 0, extras: { returns: 3 }, tags: ['recollect_upgrade1', 'recollect_play_free'] }, // L5: play 1 returned card free!
    ],
  },

  synapse: {
    levels: [
      { qpValue: 0, drawCount: 1 },                              // L0: Draw 1
      { qpValue: 0, drawCount: 2 },                              // L1: Draw 2!
      { qpValue: 0, drawCount: 2 },                              // L2
      { qpValue: 0, drawCount: 2, tags: ['synapse_chain_link'] }, // L3: CC counts as wildcard chain link!
      { qpValue: 0, drawCount: 3 },                              // L4: Draw 3!
      { qpValue: 0, drawCount: 3, tags: ['synapse_chain_link', 'synapse_chain_plus1'] }, // L5: chain link +1 bonus
    ],
  },

  siphon_knowledge: {
    levels: [
      { qpValue: 0, drawCount: 1, apCost: 2, extras: { previewSec: 2 } }, // L0: Draw 1, 2s preview
      { qpValue: 0, drawCount: 2, apCost: 2, extras: { previewSec: 3 } }, // L1
      { qpValue: 0, drawCount: 2, apCost: 2, extras: { previewSec: 3 } }, // L2
      { qpValue: 0, drawCount: 2, apCost: 1, extras: { previewSec: 4 } }, // L3: 1 AP! 4s preview
      { qpValue: 0, drawCount: 3, apCost: 1, extras: { previewSec: 4 } }, // L4
      { qpValue: 0, drawCount: 3, apCost: 1, extras: { previewSec: 5 }, tags: ['siphon_eliminate1'] }, // L5: eliminate 1 wrong answer
    ],
  },

  tutor: {
    levels: [
      { qpValue: 0, extras: { search: 1 } },                     // L0: Search for 1 card
      { qpValue: 0, extras: { search: 1 } },                     // L1
      { qpValue: 0, extras: { search: 1 }, tags: ['tutor_free_play'] }, // L2: found card costs 0 AP this turn!
      { qpValue: 0, extras: { search: 2 }, tags: ['tutor_free_play'] }, // L3: search top 2 choices
      { qpValue: 0, extras: { search: 2 } },                     // L4
      { qpValue: 0, apCost: 0, extras: { search: 3 }, tags: ['tutor_free_play'] }, // L5: 0 AP! Search 3, play free
    ],
  },

  // ── Wild Cards ──

  mirror: {
    levels: [
      { qpValue: 0, extras: { copyMult: 70 } },                  // L0: Copy at 70% (stored ×100)
      { qpValue: 0, extras: { copyMult: 80 } },                  // L1
      { qpValue: 0, extras: { copyMult: 90 } },                  // L2
      { qpValue: 0, extras: { copyMult: 100 } },                 // L3: 100% copy!
      { qpValue: 0, extras: { copyMult: 100 } },                 // L4
      { qpValue: 0, extras: { copyMult: 100 }, tags: ['mirror_chain_inherit'] }, // L5: inherits chain type
    ],
  },

  adapt: {
    levels: [
      { qpValue: 3 },                                            // L0: 3 dmg or 3 block or cleanse
      { qpValue: 4 },                                            // L1
      { qpValue: 5 },                                            // L2
      { qpValue: 5, tags: ['adapt_draw1'] },                     // L3: also draws 1
      { qpValue: 6 },                                            // L4
      { qpValue: 7, tags: ['adapt_draw1', 'adapt_dual'] },       // L5: does BOTH attack and block
    ],
  },

  overclock: {
    levels: [
      { qpValue: 0, apCost: 2, extras: { mult: 150 } },          // L0: Next card ×1.5 (stored ×100)
      { qpValue: 0, apCost: 2, extras: { mult: 160 } },          // L1
      { qpValue: 0, apCost: 2, extras: { mult: 170 } },          // L2
      { qpValue: 0, apCost: 2, extras: { mult: 180 } },          // L3
      { qpValue: 0, apCost: 2, extras: { mult: 190 } },          // L4
      { qpValue: 0, apCost: 1, extras: { mult: 200 } },          // L5: 1 AP + full ×2.0!
    ],
  },

  phase_shift: {
    levels: [
      { qpValue: 3 },                                            // L0: 3 dmg OR 3 block; CC=5 both
      { qpValue: 4 },                                            // L1
      { qpValue: 5 },                                            // L2
      { qpValue: 6 },                                            // L3
      { qpValue: 7 },                                            // L4
      { qpValue: 8, tags: ['phase_shift_draw1'] },               // L5: also draws 1
    ],
  },

  chameleon: {
    levels: [
      { qpValue: 0, extras: { qpMult: 70, ccMult: 100, cwMult: 50 } },   // L0
      { qpValue: 0, extras: { qpMult: 80, ccMult: 100, cwMult: 50 } },   // L1
      { qpValue: 0, extras: { qpMult: 90, ccMult: 110, cwMult: 60 } },   // L2
      { qpValue: 0, extras: { qpMult: 100, ccMult: 120, cwMult: 70 } },  // L3: QP copy at 100%!
      { qpValue: 0, extras: { qpMult: 100, ccMult: 130, cwMult: 70 } },  // L4
      { qpValue: 0, extras: { qpMult: 100, ccMult: 150, cwMult: 80 }, tags: ['chameleon_chain'] }, // L5: CC at 150% + chain
    ],
  },

  dark_knowledge: {
    levels: [
      { qpValue: 0, extras: { dmgPerCurse: 2 } },                // L0: 2 dmg per curse
      { qpValue: 0, extras: { dmgPerCurse: 3 } },                // L1
      { qpValue: 0, extras: { dmgPerCurse: 3 } },                // L2
      { qpValue: 0, extras: { dmgPerCurse: 4 } },                // L3
      { qpValue: 0, extras: { dmgPerCurse: 5 } },                // L4
      { qpValue: 0, extras: { dmgPerCurse: 6 }, tags: ['dark_heal1_per_curse'] }, // L5: also heals 1 per curse
    ],
  },

  chain_anchor: {
    levels: [
      { qpValue: 0, drawCount: 1 },                              // L0: Draw 1 + CC sets chain to 2
      { qpValue: 0, drawCount: 1 },                              // L1
      { qpValue: 0, drawCount: 2 },                              // L2: Draw 2!
      { qpValue: 0, drawCount: 2, tags: ['chain_anchor_set3'] }, // L3: sets chain to 3!
      { qpValue: 0, drawCount: 2 },                              // L4
      { qpValue: 0, drawCount: 3, apCost: 0, tags: ['chain_anchor_set3', 'chain_anchor_ap0'] }, // L5: 0 AP + draw 3 + chain 3
    ],
  },

  unstable_flux: {
    levels: [
      { qpValue: 4 },                                            // L0: Random effect at ×0.8
      { qpValue: 5 },                                            // L1
      { qpValue: 6 },                                            // L2
      { qpValue: 6, tags: ['flux_choose_qp'] },                  // L3: QP also lets you choose!
      { qpValue: 7 },                                            // L4
      { qpValue: 8, tags: ['flux_choose_qp', 'flux_double'] },   // L5: effect fires twice!
    ],
  },

  sacrifice: {
    levels: [
      { qpValue: 0, apCost: 0, extras: { hpCost: 6, draw: 1, apGain: 1 } },  // L0
      { qpValue: 0, apCost: 0, extras: { hpCost: 5, draw: 2, apGain: 1 } },  // L1: Less HP cost, draw 2
      { qpValue: 0, apCost: 0, extras: { hpCost: 5, draw: 2, apGain: 1 } },  // L2
      { qpValue: 0, apCost: 0, extras: { hpCost: 4, draw: 2, apGain: 2 } },  // L3: +2 AP!
      { qpValue: 0, apCost: 0, extras: { hpCost: 3, draw: 3, apGain: 2 } },  // L4
      { qpValue: 0, apCost: 0, extras: { hpCost: 2, draw: 3, apGain: 2 } },  // L5: only 2 HP for 3 draw + 2 AP
    ],
  },

  catalyst: {
    levels: [
      { qpValue: 0, tags: ['catalyst_poison'] },                 // L0: Double Poison
      { qpValue: 0, tags: ['catalyst_poison'] },                 // L1
      { qpValue: 0, tags: ['catalyst_poison', 'catalyst_burn'] }, // L2: also doubles Burn!
      { qpValue: 0, tags: ['catalyst_poison', 'catalyst_burn'] }, // L3
      { qpValue: 0, tags: ['catalyst_poison', 'catalyst_burn', 'catalyst_bleed'] }, // L4: also doubles Bleed!
      { qpValue: 0, tags: ['catalyst_poison', 'catalyst_burn', 'catalyst_bleed', 'catalyst_triple'] }, // L5: TRIPLE instead of double!
    ],
  },

  mimic: {
    levels: [
      { qpValue: 0, extras: { qpMult: 60 } },                    // L0: Random discard at 60%
      { qpValue: 0, extras: { qpMult: 70 } },                    // L1
      { qpValue: 0, extras: { qpMult: 80 } },                    // L2
      { qpValue: 0, extras: { qpMult: 80 }, tags: ['mimic_choose'] }, // L3: choose which card!
      { qpValue: 0, extras: { qpMult: 90 } },                    // L4
      { qpValue: 0, extras: { qpMult: 100 }, tags: ['mimic_choose'] }, // L5: 100% power + choose
    ],
  },

  aftershock: {
    levels: [
      { qpValue: 0, extras: { qpMult: 40, ccMult: 50 } },        // L0
      { qpValue: 0, extras: { qpMult: 50, ccMult: 60 } },        // L1
      { qpValue: 0, extras: { qpMult: 50, ccMult: 70 } },        // L2
      { qpValue: 0, extras: { qpMult: 60, ccMult: 80 } },        // L3
      { qpValue: 0, extras: { qpMult: 70, ccMult: 90 } },        // L4
      { qpValue: 0, extras: { qpMult: 80, ccMult: 100 }, tags: ['aftershock_no_quiz'] }, // L5: CC repeat at 100%, no quiz!
    ],
  },

  knowledge_bomb: {
    levels: [
      { qpValue: 0, apCost: 2, extras: { perCorrect: 3 } },      // L0: 3 dmg per correct charge
      { qpValue: 0, apCost: 2, extras: { perCorrect: 3 } },      // L1
      { qpValue: 0, apCost: 2, extras: { perCorrect: 4 } },      // L2
      { qpValue: 0, apCost: 2, extras: { perCorrect: 4 }, tags: ['kbomb_count_past'] }, // L3: counts ALL charges this run, not encounter
      { qpValue: 0, apCost: 2, extras: { perCorrect: 5 } },      // L4
      { qpValue: 0, apCost: 1, extras: { perCorrect: 6 }, tags: ['kbomb_count_past'] }, // L5: 1 AP! 6 per charge this run
    ],
  },

  ignite: {
    levels: [
      { qpValue: 2, extras: { burnStacks: 2 } },                 // L0: Next attack +2 Burn
      { qpValue: 3, extras: { burnStacks: 3 } },                 // L1
      { qpValue: 3, extras: { burnStacks: 3 } },                 // L2
      { qpValue: 4, extras: { burnStacks: 4 }, tags: ['ignite_2attacks'] }, // L3: applies to next 2 attacks!
      { qpValue: 5, extras: { burnStacks: 5 } },                 // L4
      { qpValue: 6, extras: { burnStacks: 6 }, tags: ['ignite_2attacks'] }, // L5: 6 Burn on next 2 attacks
    ],
  },

  war_drum: {
    levels: [
      { qpValue: 1, extras: { bonus: 1 } },                      // L0: +1 to all hand cards
      { qpValue: 1, extras: { bonus: 1 } },                      // L1
      { qpValue: 2, extras: { bonus: 2 } },                      // L2: +2!
      { qpValue: 2, extras: { bonus: 2 } },                      // L3
      { qpValue: 3, extras: { bonus: 3 } },                      // L4: +3!
      { qpValue: 4, extras: { bonus: 4 }, tags: ['war_drum_draw1'] }, // L5: +4 to all + draw 1
    ],
  },

  inscription_wisdom: {
    levels: [
      { qpValue: 0, apCost: 2, extras: { drawPerCC: 1, healPerCC: 0 } }, // L0: Each future CC draws 1 extra
      { qpValue: 0, apCost: 2, extras: { drawPerCC: 1, healPerCC: 0 } }, // L1
      { qpValue: 0, apCost: 2, extras: { drawPerCC: 1, healPerCC: 1 } }, // L2: also heal 1 per CC!
      { qpValue: 0, apCost: 1, extras: { drawPerCC: 1, healPerCC: 1 } }, // L3: AP cost reduced to 1
      { qpValue: 0, apCost: 1, extras: { drawPerCC: 2, healPerCC: 1 } }, // L4: draw 2 per CC!
      { qpValue: 0, apCost: 1, extras: { drawPerCC: 2, healPerCC: 2 } }, // L5: draw 2 + heal 2 per CC
    ],
  },

  aegis_pulse: {
    levels: [
      { qpValue: 2 },                                            // L0: 2 block; CC: same-chain cards +2 block
      { qpValue: 3 },                                            // L1
      { qpValue: 4 },                                            // L2
      { qpValue: 4, tags: ['aegis_chain_buff3'] },               // L3: chain cards get +3 block
      { qpValue: 5 },                                            // L4
      { qpValue: 6, tags: ['aegis_chain_buff3', 'aegis_draw1cc'] }, // L5: CC also draws 1
    ],
  },

  siphon_strike: {
    levels: [
      { qpValue: 2, extras: { minHeal: 2, maxHeal: 6 } },        // L0 — minHeal 1→2 to match resolver runtime (hardcoded: masteryLevel>=3?3:2, so L0=2)
      { qpValue: 3, extras: { minHeal: 1, maxHeal: 7 } },        // L1
      { qpValue: 3, extras: { minHeal: 2, maxHeal: 8 } },        // L2
      { qpValue: 4, extras: { minHeal: 2, maxHeal: 10 } },       // L3: heals up to 10
      { qpValue: 5, extras: { minHeal: 3, maxHeal: 10 } },       // L4
      { qpValue: 6, extras: { minHeal: 3, maxHeal: 12 } },       // L5: guaranteed 3 heal, up to 12
    ],
  },

  stagger: {
    levels: [
      { qpValue: 1 },                                            // L0: Skip enemy action
      { qpValue: 1 },                                            // L1
      { qpValue: 1, tags: ['stagger_weak1t'] },                  // L2: also Weakness 1t
      { qpValue: 1, tags: ['stagger_weak1t', 'stagger_draw1'] }, // L3: also draws 1
      { qpValue: 1, tags: ['stagger_weak1t', 'stagger_draw1'] }, // L4
      { qpValue: 1, apCost: 0, tags: ['stagger_weak1t', 'stagger_draw1'] }, // L5: costs 0 AP! qpValue kept at 1 (not 0) for monotonic invariant — stagger's primary value is action skip, not damage
    ],
  },

};

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

  // Compute tags from addTagAtLevel and addTagsAtLevel.
  const tags: string[] = [];
  if (def?.addTagAtLevel && clampedLevel >= def.addTagAtLevel[0]) {
    tags.push(def.addTagAtLevel[1]);
  }
  if (def?.addTagsAtLevel && clampedLevel >= def.addTagsAtLevel[0]) {
    tags.push(...def.addTagsAtLevel[1]);
  }

  return {
    qpValue: mechDef.quickPlayValue + bonus,
    apCost: apReductions > 0 ? mechDef.apCost - apReductions : undefined,
    secondaryValue: mechDef.secondaryValue != null ? mechDef.secondaryValue + secBonus : undefined,
    cwValue: undefined, // use mechanic default chargeWrongValue
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Get the effective AP cost for a card at its current mastery level.
 * Prefers MASTERY_STAT_TABLES[id].levels[N].apCost (design intent),
 * falls back to the card's seeded apCost (from mechanic.apCost at build time).
 *
 * Why this exists: mastery tables promise "L5: 1 AP" reductions, but the
 * card.apCost field is only set once at runPoolBuilder time and never
 * refreshed on mastery-up. This helper computes the live effective cost.
 */
export function getEffectiveApCost(card: Card): number {
  const stats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0);
  if (stats?.apCost != null) return Math.max(0, stats.apCost);
  return Math.max(0, card.apCost ?? 1);
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
  /** Multiple tags added at a specific level. [level, tagNames[]] */
  addTagsAtLevel?: [number, string[]];
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
  mirror:        { perLevelDelta: 0.03, addTagAtLevel: [3, 'mirror_chain_inherit'] },  // 1.0 -> 1.15× (L5) — Modest; L3: copy inherits chain type
  adapt:         { perLevelDelta: 0.03, addTagsAtLevel: [3, ['adapt_draw1', 'adapt_dual']] }, // 1.0 -> 1.15× (L5); L3: draw 1 + does both forms
  // Debuffs
  weaken:        { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  expose:        { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  slow:          { perLevelDelta: 0.3 },                         // 1 -> 2.5t (L5) — Solid
  hex:           { perLevelDelta: 0.4 },                         // 2 -> 4/t (L5) — Solid
  // Utility
  scout:         { perLevelDelta: 0, addTagsAtLevel: [3, ['draw', 'scout_scry2']] }, // +1 draw at L3; scry 2 at L3
  recycle:       { perLevelDelta: 0.12, addTagAtLevel: [3, 'recycle_discard_pick'] }, // slight nerf; L3: player chooses from discard
  foresight:     { perLevelDelta: 0, secondaryPerLevelDelta: 0.12 }, // slight nerf
  quicken:       { perLevelDelta: 0, addTagAtLevel: [3, 'draw'], maxLevel: 3 },
  cleanse:       { perLevelDelta: 0, addTagsAtLevel: [2, ['cleanse_heal3', 'cleanse_block3']], maxLevel: 2 }, // L2: also heal 3 and block 3
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
  ignite:            { perLevelDelta: 0.4, addTagAtLevel: [3, 'ignite_2attacks'] },   // 2 -> 4 (L5); L3: applies to next 2 attacks

  // Basic new cards
  overcharge:        { perLevelDelta: 0.9 },                         // 3 -> 7 (L5) — Solid 2.5×
  riposte:           { perLevelDelta: 0.9, secondaryPerLevelDelta: 1.2 }, // 3+4 -> 7+10 (L5) — Solid
  absorb:            { perLevelDelta: 0.6, addTagAtLevel: [3, 'draw2'] }, // 3 -> 6 (L5) — Modest 2×
  reactive_shield:   { perLevelDelta: 0.4, addTagAtLevel: [3, 'thorns_ext'] }, // 2 -> 4 (L5) — Modest 2×
  sift:              { perLevelDelta: 0.4, addTagsAtLevel: [3, ['sift_draw1', 'sift_discard_dmg2']] }, // look 3->look 5; L3: draw 1, discards deal 2 dmg
  scavenge:          { perLevelDelta: 0, addTagsAtLevel: [3, ['scavenge2', 'scavenge_draw1']], maxLevel: 3 }, // L3: puts 2 on top + draw 1
  precision_strike:  { perLevelDelta: 1.2, addTagAtLevel: [3, 'timer_ext75'] }, // 8 -> 14 (L5) — Modest 1.75×, L3 +75% timer is very powerful
  stagger:           { perLevelDelta: 0, addTagAtLevel: [3, 'weak_apply'], maxLevel: 3 }, // L3: QP applies 1t Weakness
  corrode:           { perLevelDelta: 0.6, addTagAtLevel: [3, 'weak_ext'] }, // 3 -> 6 (L5) — Modest 2×
  swap:              { perLevelDelta: 0, addTagAtLevel: [3, 'swap_cc_draw3'], maxLevel: 3 }, // L3: CC draws 3
  siphon_strike:     { perLevelDelta: 0.6, addTagAtLevel: [3, 'min_heal3'] }, // 3 -> 6 (L5) — Modest 2×, L3 heal is strong
  aegis_pulse:       { perLevelDelta: 0.6, addTagAtLevel: [3, 'chain_buff3'] }, // 3 -> 6 (L5) — Modest 2×

  // Inscription cards
  inscription_fury:  { perLevelDelta: 0.3 },                        // 1 -> 2.5 atk (L5) — Solid
  inscription_iron:  { perLevelDelta: 0.4 },                        // 2 -> 4 block/turn (L5) — Solid

  // ── AR-207: Phase 2 Identity / Flagship Cards ─────────────────────────────

  // Attacks
  gambit:            { perLevelDelta: 2.0, addTagAtLevel: [3, 'self_dmg_minus1'] }, // 5 -> 15 (L5) — Great 3×, big risk
  chain_lightning:   { perLevelDelta: 1.2 },                         // 4 -> 10 (L5) — Solid 2.5×, chain mult is separate
  volatile_slash:    { perLevelDelta: 2.0 },                         // 5 -> 15 (L5) — Great 3×, forgets = earns it

  // Shields
  burnout_shield:    { perLevelDelta: 1.6 },                         // 4 -> 12 (L5) — Great 3×, CC forgets
  knowledge_ward:    { perLevelDelta: 0.9 },                         // 6 -> 10 (L5) — Modest 1.75×

  // Buffs
  warcry:            { perLevelDelta: 0, maxLevel: 3 }, // L3+: permanent Str handled via direct masteryLevel>=3 check in turnManager — warcry_perm_str tag removed (dead, zero readers)
  battle_trance:     { perLevelDelta: 0, addTagsAtLevel: [3, ['battle_trance_draw4', 'trance_cc_ap1']], maxLevel: 3 }, // L3 QP: draw 4; CC grants +1 AP

  // Debuffs
  curse_of_doubt:    { perLevelDelta: 3.0 },                         // 20 -> 35% (L5) — Solid
  mark_of_ignorance: { perLevelDelta: 0.4 },                         // 2 -> 4 (L5) — Solid
  corroding_touch:   { perLevelDelta: 0.5, maxLevel: 3 },            // 1 -> 2.5t (L3) — Solid

  // Wilds
  phase_shift:       { perLevelDelta: 1.2 },                         // 4 -> 10 (L5) — Solid 2.5×
  chameleon:         { perLevelDelta: 0, addTagAtLevel: [3, 'chameleon_qp_chain'], maxLevel: 3 }, // L3 QP: also inherits chain type
  dark_knowledge:    { perLevelDelta: 0.6 },                         // 3 -> 6 (L5) — Solid 2×
  chain_anchor:      { perLevelDelta: 0, addTagsAtLevel: [3, ['chain_anchor_set3', 'chain_anchor_ap0']], maxLevel: 3 }, // L3: CC sets chain to 3; costs 0 AP
  unstable_flux:     { perLevelDelta: 0, addTagsAtLevel: [3, ['flux_choose_qp', 'flux_double']], maxLevel: 3 }, // L3: QP lets player choose; effect fires twice

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
  frenzy:            { perLevelDelta: 0, addTagsAtLevel: [3, ['frenzy_qp3', 'frenzy_draw1']], maxLevel: 3 }, // L3: QP frees 3 cards; also draw 1
  mastery_surge:     { perLevelDelta: 0, addTagsAtLevel: [3, ['mastery_surge_qp2', 'msurge_plus2']], maxLevel: 3 }, // L3: QP upgrades 2; CC gives +2 mastery per card
  war_drum:          { perLevelDelta: 0.1, maxLevel: 5 },                            // 1 -> 1.5 buff (L5) — very conservative, buffs ALL hand cards

  // Debuffs
  entropy:           { perLevelDelta: 0.7, addTagAtLevel: [3, 'entropy_poison_qp'], maxLevel: 3 }, // 2 -> 4 (L3) — Solid

  // Utility
  archive:           { perLevelDelta: 0, addTagsAtLevel: [3, ['archive_retain2_qp', 'archive_block2_per', 'archive_draw1']], maxLevel: 3 }, // L3: retain 2 QP; retained cards +2 block; draw 1
  reflex:            { perLevelDelta: 0, addTagsAtLevel: [3, ['reflex_enhanced', 'reflex_draw3cc']], maxLevel: 3 }, // L3: QP draws 3; CC draws 3; passive = 4 block
  recollect:         { perLevelDelta: 0, addTagsAtLevel: [3, ['recollect_qp2', 'recollect_upgrade1', 'recollect_play_free']], maxLevel: 3 }, // L3: return 2; returned get +1 mastery; play 1 free
  synapse:           { perLevelDelta: 0, addTagsAtLevel: [3, ['synapse_draw3_qp', 'synapse_chain_link', 'synapse_chain_plus1']], maxLevel: 3 }, // L3: QP draws 3; CC = wildcard chain link; chain +1 bonus
  siphon_knowledge:  { perLevelDelta: 0, addTagsAtLevel: [3, ['siphon_qp3_time4s', 'siphon_eliminate1']], maxLevel: 3 }, // L3: QP draws 3 + 4s preview; CC eliminates 1 wrong answer
  tutor:             { perLevelDelta: 0, addTagAtLevel: [3, 'tutor_free_play'], maxLevel: 3 },     // L3: tutored card costs 0 AP (QP+CC)

  // Wild
  sacrifice:         { perLevelDelta: 0, addTagAtLevel: [3, 'sacrifice_draw3_qp'], maxLevel: 3 }, // L3 QP: draws 3
  catalyst:          { perLevelDelta: 0, addTagsAtLevel: [3, ['catalyst_bleed', 'catalyst_triple']], maxLevel: 3 }, // L3: also triples Poison/Burn/Bleed
  mimic:             { perLevelDelta: 0, addTagAtLevel: [3, 'mimic_choose'], maxLevel: 3 },        // L3: player chooses from discard
  aftershock:        { perLevelDelta: 0.1, addTagAtLevel: [3, 'aftershock_no_quiz'], maxLevel: 3 }, // QP mult 0.5->0.8; CC mult 0.7->1.0; L3: CC repeat needs no quiz
  knowledge_bomb:    { perLevelDelta: 0.8, addTagAtLevel: [3, 'kbomb_count_past'], maxLevel: 5 }, // per-correct; L3: counts charges for entire run

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
    // Within same tier, prefer lower mastery level (more room to grow)
    return (a.masteryLevel ?? 0) - (b.masteryLevel ?? 0);
  });

  return eligible.slice(0, count);
}
