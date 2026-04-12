/**
 * Card description service — generates human-readable descriptions
 * for card mechanics on the reward/inspect screens.
 *
 * Style conventions (verb-first, as of 2026-04-08):
 * - getCardDescriptionParts: verb-first, `\n` for line breaks (2 lines max ideal)
 * - getShortCardDescription: terse verb-first, ≤20 chars target
 * - getDetailedCardDescription: full prose, verb-first, proper sentences
 *
 * All 98 mechanics covered as of 2026-04-09 (62 added in Phase 4).
 */

import type { Card, CardType } from '../data/card-types';
import { getMechanicDefinition } from '../data/mechanics';
import { getMasteryBaseBonus, getMasterySecondaryBonus, getMasteryStats, getEffectiveApCost } from './cardUpgradeService';

const GENERIC_TYPE_DESCRIPTIONS: Record<CardType, string> = {
  attack: 'Deal direct damage to enemies.',
  shield: 'Gain block before enemy attacks.',
  buff: 'Increase output and combo pressure.',
  debuff: 'Reduce enemy tempo and threat.',
  utility: 'Tech effects for flexible turns.',
  wild: 'High-impact wildcard effect.',
};

/**
 * Get a detailed, human-readable description of what a card does mechanically.
 * Uses the card's mechanic definition to generate specific numbers and effects.
 * Verb-first prose; proper sentences.
 */
export function getDetailedCardDescription(card: Card, powerOverride?: number): string {
  const mechanic = getMechanicDefinition(card.mechanicId);
  // 2026-04-11: Use stat-table qpValue as canonical power source (audit fix — baseEffectValue
  // is BASE_EFFECT[cardType] which is attack=4/shield=3 and does NOT reflect per-mechanic balance).
  // See docs/gotchas.md 2026-04-11 entry and docs/content/card-description-audit.md root-cause §2.
  const _statsForPower = mechanic ? getMasteryStats(mechanic.id, card.masteryLevel ?? 0) : null;
  const power = powerOverride ?? (_statsForPower?.qpValue != null ? _statsForPower.qpValue : Math.round(card.baseEffectValue));

  const apCost = getEffectiveApCost(card);
  const apSuffix = apCost === 0 ? ' (Free)' : apCost === 2 ? ' (Costs 2 AP)' : apCost >= 3 ? ` (Costs ${apCost} AP — full turn)` : '';

  if (!mechanic) {
    // Fallback to generic descriptions with power value
    switch (card.cardType) {
      case 'attack': return `Deal ${power} damage.${apSuffix}`;
      case 'shield': return `Gain ${power} Block.${apSuffix}`;
      case 'buff': return `Buff next card by ${power}%.${apSuffix}`;
      case 'debuff': return `Weaken enemy for ${power} turn(s).${apSuffix}`;
      case 'utility': return `Draw ${power} card(s).${apSuffix}`;
      case 'wild': return `Apply a wildcard effect.${apSuffix}`;
      default: return (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '') + apSuffix;
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;
  const stats = getMasteryStats(mechanic.id, card.masteryLevel ?? 0);

  switch (mechanic.id) {
    // ── Attack mechanics ─────────────────────────────────────────────────────
    case 'strike':
      return `Deal ${power} damage.` + apSuffix;
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return `Deal ${power} damage ${hits} times (${power * hits} total).` + apSuffix;
    }
    case 'heavy_strike':
      return `Deal ${power} damage.${apSuffix}`;
    case 'piercing':
      return `Deal ${power} damage. Ignores enemy Block.` + apSuffix;
    case 'reckless': {
      const selfDmg = stats?.extras?.['selfDmg'] ?? secondary ?? 4;
      return `Deal ${power} damage. Take ${selfDmg} self-damage.` + apSuffix;
    }
    case 'execute': {
      const bonusDmg = stats?.extras?.['execBonus'] ?? secondary ?? 8;
      const threshold = stats?.extras?.['execThreshold'] ?? 0.3;
      return `Deal ${power} damage. +${bonusDmg} bonus if enemy below ${Math.round(threshold * 100)}% HP.` + apSuffix;
    }
    case 'power_strike':
      return `Deal ${power} damage. CC: +${Math.round(power * 0.75)} bonus damage. L5: also applies Exposed 1 turn.` + apSuffix;
    case 'twin_strike': {
      const hits = stats?.hitCount ?? 2;
      return `Deal ${power} damage ${hits} times. Each hit triggers Lingering Doubt and Brain Burn separately. CC: ${hits + 1} hits at L3+.` + apSuffix;
    }
    case 'iron_wave': {
      const sec = stats?.secondaryValue ?? 3;
      return `Deal ${power} damage and gain ${sec} Block. CC: both scale up. L5: Block doubles when you have 10+ Block.` + apSuffix;
    }
    case 'bash': {
      return `Deal ${power} damage. Apply Exposed 1 turn (CC: 2 turns).` + apSuffix;
    }
    case 'sap':
      return `Deal ${power} damage and apply Drawing Blanks 1 turn. CC: more damage.` + apSuffix;
    case 'rupture': {
      const bleed = stats?.secondaryValue ?? 2;
      return `Deal ${power} damage and apply ${bleed} Lingering Doubt. CC: double Lingering Doubt stacks.` + apSuffix;
    }
    case 'lacerate': {
      const bleed = stats?.secondaryValue ?? 3;
      return `Deal ${power} damage and apply ${bleed} Lingering Doubt. CC: massive Lingering Doubt bonus.` + apSuffix;
    }
    case 'kindle': {
      const burn = stats?.secondaryValue ?? 2;
      return `Deal ${power} damage, apply ${burn} Brain Burn, then trigger Brain Burn immediately. CC: more Brain Burn. L5: trigger twice.` + apSuffix;
    }
    case 'overcharge':
      return `Deal ${power} damage. CC: deal ${Math.round(power * 1.75)} damage + 2 per correct Charge used this encounter (own CC counts).` + apSuffix;
    case 'riposte': {
      const sec = stats?.secondaryValue ?? 3;
      return `Deal ${power} damage and gain ${sec} Block. CC: both scale. L5: also deal 40% of Block as bonus damage.` + apSuffix;
    }
    case 'siphon_strike': {
      const minH = stats?.extras?.['minHeal'] ?? 1;
      const maxH = stats?.extras?.['maxHeal'] ?? 6;
      return `Deal ${power} damage. Heal based on overkill damage (min ${minH}, max ${maxH} HP). CC: more damage and heal range.` + apSuffix;
    }
    case 'gambit': {
      // 2026-04-11 reframe: lead with CC heal upside so first-time players see the reward, not the risk.
      // Old: "Deal X damage and lose Y HP (QP). CC: deal damage and heal Z HP instead."
      // New: "CC: Deal X damage and heal Z HP. QP: deal X damage, lose Y HP. CW: deal X damage, lose extra HP."
      const selfDmg = stats?.extras?.['selfDmg'] ?? 4;
      const healOnCC = stats?.extras?.['healOnCC'] ?? 3;
      return `CC: Deal ${power} damage and heal ${healOnCC} HP. QP: deal ${power} damage, lose ${selfDmg} HP. CW: deal damage and lose extra HP.` + apSuffix;
    }
    case 'chain_lightning':
      return `Deal ${power} damage (QP). CC: deal ${power} × chain length damage (counts itself). Requires chain. L5: costs 1 AP.` + apSuffix;
    case 'volatile_slash':
      return `Deal ${power} damage. CC: ${Math.round(power * 1.75)} damage then Forget this card. L5: CC no longer Forgets.` + apSuffix;
    case 'hemorrhage': {
      const bleedMult = stats?.extras?.['bleedMult'] ?? 3;
      return `Deal ${power} damage plus ${bleedMult}× enemy Lingering Doubt stacks as bonus damage, then consume all Lingering Doubt. CC: higher multiplier.` + apSuffix;
    }
    case 'eruption': {
      const dpa = stats?.extras?.['dmgPerAp'] ?? 6;
      return `Spend all remaining AP. Deal ${dpa} damage per AP spent (QP). CC: ${Math.round(dpa * 1.5)} per AP. CW: ${Math.round(dpa * 0.5)} per AP. L5: refund 1 AP.` + apSuffix;
    }

    // ── Shield mechanics ─────────────────────────────────────────────────────
    case 'block':
      return `Gain ${power} Block. Absorbs damage before HP.` + apSuffix;
    case 'thorns': {
      const reflect = secondary ?? 3;
      return `Gain ${power} Block. Reflect ${reflect} damage when hit.` + apSuffix;
    }
    case 'fortify':
      // 2026-04-11 audit fix: resolver uses current block x 0.5/0.75, NOT a flat value.
      // fortify_carry (persistence) is only at L5 tag.
      return `Gain Block = 50% of current Block (QP) or 75% + card value (CC). L5: Block persists next turn.` + apSuffix;
    case 'parry':
      return `Gain ${power} Block. Draw 1 card if enemy attacks.` + apSuffix;
    case 'brace':
      return `Gain Block equal to enemy's telegraphed attack damage.` + apSuffix;
    case 'cleanse':
      return `Purge all debuffs. Draw 1 card.` + apSuffix;
    case 'overheal':
      // 2026-04-11 audit fix: resolver checks healthPercentage < 0.6 (60%), not 50%.
      return `Gain ${power} Block. Double if HP below 60%.` + apSuffix;
    case 'lifetap':
      return `Deal ${power} damage. Heal 20% of damage dealt.` + apSuffix;
    case 'emergency':
      return `Gain ${power} Block. Double if HP below 30%.` + apSuffix;
    case 'immunity':
      return `Absorb next damage instance (up to ${power}).` + apSuffix;
    case 'reinforce':
      return `Gain ${power} Block. CC: ${Math.round(power * 1.75)} Block. Mastery increases both.` + apSuffix;
    case 'shrug_it_off': {
      const draws = stats?.drawCount ?? 1;
      return `Gain ${power} Block and draw ${draws} card. No draw on Charge Wrong. CC: more Block.` + apSuffix;
    }
    case 'guard':
      return `Gain ${power} Block. CC: ${Math.round(power * 1.75)} Block.` + apSuffix;
    case 'absorb':
      return `Gain ${power} Block. CC: also draw 1 card (2 at L3+). L5: refund 1 AP when the Block absorbs damage.` + apSuffix;
    case 'reactive_shield': {
      const thorns = stats?.secondaryValue ?? 1;
      return `Gain ${power} Block and apply ${thorns} Thorns for 1 turn. CC: more of each.` + apSuffix;
    }
    case 'aegis_pulse':
      return `Gain ${power} Block. CC: same-chain cards in hand gain +2 Block (3 at L3+). L5: CC also draws 1.` + apSuffix;
    case 'burnout_shield':
      return `Gain ${power} Block. CC: ${Math.round(power * 1.75)} Block then Forget this card. L5: CC no longer Forgets.` + apSuffix;
    case 'bulwark':
      return `Gain ${power} Block. CC: ${Math.round(power * 1.75)} Block then Forget this card. L3+: CC no longer Forgets.` + apSuffix;
    case 'conversion':
      return `Gain ${power} Block, then deal damage equal to your current Block (consuming it). CC: deal 1.5× your Block instead. L5: Block is NOT consumed.` + apSuffix;
    case 'ironhide': {
      const str = stats?.extras?.['str'] ?? 1;
      return `Gain ${power} Block and +${str} Clarity this turn (QP) or permanently (CC). L5: costs 1 AP.` + apSuffix;
    }

    // ── Buff mechanics ────────────────────────────────────────────────────────
    case 'empower':
      return `Next card deals ${power}% more damage.` + apSuffix;
    case 'quicken':
      return `Gain +1 AP this turn.` + apSuffix;
    case 'double_strike': {
      const hitMult = stats?.extras?.['hitMult'] ?? 75;
      return `Next attack card hits twice at ${hitMult}% power each.` + apSuffix;
    }
    case 'ignite': {
      const burnStacks = stats?.extras?.['burnStacks'] ?? 2;
      return `Next attack applies ${burnStacks} Brain Burn stacks. CC: double stacks. L3+: applies to next 2 attacks.` + apSuffix;
    }
    case 'inscription_fury':
      return `Forgets on play. All attacks deal +${power} bonus damage for the rest of combat. CC: double bonus.` + apSuffix;
    case 'inscription_iron':
      return `Forgets on play. Gain +${power} Block at the start of each turn for the rest of combat. CC: double.` + apSuffix;
    case 'inscription_wisdom': {
      const dpc = stats?.extras?.['drawPerCC'] ?? 1;
      return `Forgets on play. QP: each future Charge Correct draws ${dpc} extra card. CC: also heals 1 HP per CC. CW: fizzles completely — card is lost.` + apSuffix;
    }
    case 'warcry': {
      const str = stats?.extras?.['str'] ?? 1;
      return `QP: gain +${str} Clarity this turn. CC: gain Clarity permanently and next Charge costs 0 AP. L5: +3 Str permanent.` + apSuffix;
    }
    case 'battle_trance': {
      const drawCount = stats?.drawCount ?? 2;
      return `Draw ${drawCount} cards. QP/CW: cannot play or Charge more cards this turn. CC: no restriction. L3: QP no longer locks out.` + apSuffix;
    }
    case 'frenzy': {
      const freeCards = stats?.extras?.['freeCards'] ?? 1;
      return `Next ${freeCards} card(s) cost 0 AP (QP). CC: ${freeCards + 1} free cards. CW: 1 free card. L5: costs 1 AP and draws 1.` + apSuffix;
    }
    case 'mastery_surge': {
      const targets = stats?.extras?.['targets'] ?? 1;
      return `QP: randomly grant +1 mastery to ${targets} card(s) in hand. CC: choose which cards. CW: no effect. L3+: choose targets.` + apSuffix;
    }
    case 'war_drum': {
      const bonus = stats?.extras?.['bonus'] ?? 1;
      return `All cards in your hand gain +${bonus} base effect this turn. CC: +${bonus * 2}. CW: +${Math.round(bonus * 0.5)}. L5: also draws 1.` + apSuffix;
    }
    case 'forge': {
      const ups = stats?.extras?.['upgrades'] ?? 1;
      const amt = stats?.extras?.['amount'] ?? 1;
      return `Grant +${amt} mastery to ${ups} card(s) in your hand for this encounter. CC: upgrade 2 cards. L2: +2 mastery each. L5: upgrade 3 cards at +2 mastery.` + apSuffix;
    }

    // ── Debuff mechanics ──────────────────────────────────────────────────────
    case 'weaken':
      return `Apply ${power} Drawing Blanks. Enemy deals less damage.` + apSuffix;
    case 'expose':
      return `Apply ${power} Exposed. Enemy takes more damage.` + apSuffix;
    case 'slow':
      return `Skip enemy's next defend or buff action.` + apSuffix;
    case 'hex': {
      const turns = secondary ?? 3;
      return `Apply ${power} Doubt over ${turns} turns.` + apSuffix;
    }
    case 'stagger':
      return `Skip the enemy's next action. Turn counter still advances. CC: same. L2+: also apply Drawing Blanks 1 turn.` + apSuffix;
    case 'corrode':
      return `QP: Remove enemy Block and apply Drawing Blanks 1 turn. CC: Remove ALL enemy Block + Drawing Blanks 2 turns. CW: Remove 3 Block + Drawing Blanks 1 turn.` + apSuffix;
    case 'curse_of_doubt': {
      const pctBonus = stats?.extras?.['pctBonus'] ?? 15;
      const turns = stats?.extras?.['turns'] ?? 1;
      return `Enemy takes +${pctBonus}% more damage from Charged attacks for ${turns} turn(s). CC: higher bonus and more turns.` + apSuffix;
    }
    case 'mark_of_ignorance': {
      const flatBonus = stats?.extras?.['flatBonus'] ?? 2;
      const turns = stats?.extras?.['turns'] ?? 1;
      return `Enemy takes +${flatBonus} flat damage from every Charged attack for ${turns} turn(s). CC: higher bonus and more turns.` + apSuffix;
    }
    case 'corroding_touch': {
      const weakStacks = stats?.extras?.['weakStacks'] ?? 1;
      const weakTurns = stats?.extras?.['weakTurns'] ?? 1;
      return `Free. Apply ${weakStacks} Drawing Blanks for ${weakTurns} turn(s). CC: more stacks + Exposed 1t. Charge costs standard +1 AP surcharge.` + apSuffix;
    }
    case 'entropy': {
      const burn = stats?.extras?.['burn'] ?? 2;
      const poison = stats?.extras?.['poison'] ?? 1;
      const poisonTurns = stats?.extras?.['poisonTurns'] ?? 2;
      return `Apply ${burn} Brain Burn and ${poison} Doubt for ${poisonTurns} turn(s). CC: higher values and more turns.` + apSuffix;
    }

    // ── Utility mechanics ─────────────────────────────────────────────────────
    case 'scout': {
      const drawCount = Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
      return `Draw ${drawCount} extra card(s) this turn.` + apSuffix;
    }
    case 'focus':
      return `Next card costs 1 less AP to play.` + apSuffix;
    case 'recycle':
      return `Draw 3 cards.` + apSuffix;
    case 'foresight':
      return `Draw ${power} cards. Forget: removed from combat after use.` + apSuffix;
    case 'transmute':
      return `QP: Auto-transform into a random new card for this encounter. CC: Choose 1 of 3 new cards (2 at mastery 3+) for this encounter. CW: Auto-transform into a random card.` + apSuffix;
    case 'sift': {
      const scryCount = stats?.extras?.['scryCount'] ?? 2;
      return `Look at top ${scryCount} cards of your draw pile and discard any. CC: look at more cards. L3+: also draw 1.` + apSuffix;
    }
    case 'scavenge':
      return `Put 1 card from your discard pile on top of your draw pile. CC: same effect. L2+: also draw 1. L5: costs 0 AP.` + apSuffix;
    case 'swap': {
      const draws = stats?.drawCount ?? 1;
      return `Discard 1 card and draw ${draws} replacement (free). CC: draw 2 (3 at L3+). CW: discard 1, draw 1 (same as QP).` + apSuffix;
    }
    case 'archive': {
      const retain = stats?.extras?.['retain'] ?? 1;
      return `Choose ${retain} card(s) in hand to retain past turn end. CC: retain 2. L3+: retained cards gain +2 Block. L5: also draws 1.` + apSuffix;
    }
    case 'reflex': {
      const drawCount = stats?.drawCount ?? 1;
      const passiveBlock = stats?.extras?.['passiveBlock'] ?? 2;
      return `Draw ${drawCount} card(s). PASSIVE: when discarded from hand, gain ${passiveBlock} Block. CC: draw more. L3: CC draws 3.` + apSuffix;
    }
    case 'recollect': {
      const returns = stats?.extras?.['returns'] ?? 1;
      return `Return ${returns} forgotten card(s) to your discard pile. CC: return 2. Cannot target Inscriptions. L3+: returned cards gain +1 mastery.` + apSuffix;
    }
    case 'synapse': {
      const drawCount = stats?.drawCount ?? 1;
      return `Draw ${drawCount} card(s). CC: also extend the active chain by 1 (wildcard link). L3+ only.` + apSuffix;
    }
    case 'siphon_knowledge': {
      const drawCount = stats?.drawCount ?? 1;
      const previewSec = stats?.extras?.['previewSec'] ?? 2;
      return `Draw ${drawCount} card(s) and briefly show all current quiz answers for ${previewSec} seconds. CC: more draws, longer preview.` + apSuffix;
    }
    case 'tutor':
      return `Search your draw pile; choose a card and add it to hand. CC: that card costs 0 AP this turn. L3+: search top 2 choices. L5: costs 0 AP.` + apSuffix;
    case 'conjure': {
      const picks = stats?.extras?.['picks'] ?? 1;
      return `Summon ${picks} of 3 cards to your hand for this encounter. CC: same. L3+: summon 2 cards. L5: rare-quality cards.` + apSuffix;
    }

    // ── Wild mechanics ────────────────────────────────────────────────────────
    case 'mirror':
      return `Copy the previous card's effect.` + apSuffix;
    case 'adapt':
      return `Smart action: enemy attacking → Block, debuffing → Cleanse, else → Attack. Charged: 1.5× power. Wrong: 0.7×.` + apSuffix;
    case 'overclock':
      return `Next card's effect is doubled.` + apSuffix;
    case 'phase_shift':
      return `QP/CW: choose ${power} damage OR ${power} Block. CC: deal ${Math.round(power * 1.75)} damage AND gain the same Block.` + apSuffix;
    case 'chameleon':
      return `Copy the previous card's effect at 100% power (QP). CC: 130% power and inherit its chain type. CW: 70% power.` + apSuffix;
    case 'dark_knowledge': {
      const dmgPerCurse = stats?.extras?.['dmgPerCurse'] ?? 2;
      return `Deal ${dmgPerCurse} damage per cursed fact in your deck. CC: higher multiplier. L5: also heal 1 HP per curse.` + apSuffix;
    }
    case 'chain_anchor': {
      const draws = stats?.drawCount ?? 1;
      return `Draw ${draws} card. CC: set your chain counter to 2 for the next chain card played, then draw 1. Not a chain link itself.` + apSuffix;
    }
    case 'unstable_flux':
      return `QP/CW: apply a random effect (damage, Block, draw, or debuff) at ${power} power. CC: choose the effect at ${Math.round(power * 1.75)} power.` + apSuffix;
    case 'sacrifice':
      return `Lose 5 HP. Draw 2 cards and gain +1 AP (QP). CC: draw 3 cards and gain +2 AP. CW: draw 1 card and gain +1 AP. (Free)` + apSuffix;
    case 'catalyst':
      return `Double all enemy Doubt stacks. CC: also double enemy Brain Burn. L2+: always also doubles Brain Burn. L4+: also doubles Lingering Doubt. L5: TRIPLE instead of double.` + apSuffix;
    case 'mimic': {
      const qpMult = stats?.extras?.['qpMult'] ?? 60;
      const cwMult = stats?.extras?.['cwMult'] ?? 30;
      return `Play a random card from your discard pile at ${qpMult}% power (QP). CC: choose which card at 100% power. CW: random at ${cwMult}%.` + apSuffix;
    }
    case 'aftershock': {
      const qpMult = stats?.extras?.['qpMult'] ?? 40;
      const ccMult = stats?.extras?.['ccMult'] ?? 50;
      return `Repeat the last card played this turn at ${qpMult}% power (QP). CC: repeat last Charged card at ${ccMult}% with no quiz. CW: ${Math.round(qpMult * 0.75)}%.` + apSuffix;
    }
    case 'knowledge_bomb': {
      const perCorrect = stats?.extras?.['perCorrect'] ?? 3;
      return `QP/CW: deal 4 damage. CC: deal ${perCorrect} × total correct Charges this encounter as damage (own CC counts).` + apSuffix;
    }

    // ── AR-264: Quiz-integrated cards ─────────────────────────────────────────
    case 'recall': {
      const recallQpDmg = _statsForPower?.qpValue ?? 5;
      // 2026-04-11 audit fix: stat table L0 qpValue=5 (not 10, the old seed). CC=20/30 still hardcoded in resolver.
      return `Deal ${recallQpDmg} damage (QP). CC: 20 damage (30 on Review Queue fact). CW: ${Math.max(1, Math.round(recallQpDmg * 0.75))} damage.` + apSuffix;
    }
    case 'precision_strike': {
      const psQpDmg = _statsForPower?.qpValue ?? 5;
      // 2026-04-11 audit fix: stat table L0 qpValue=5 (not 8). Pass 8: CC formula uses 6x not 8x.
      // CC: 6 x (distractors+1). At L0 (2 distractors): 18. At L3+ (4 distractors): 30.
      return `Deal ${psQpDmg} damage (QP). CC: scales with difficulty (6 × options, min 18). CW: ${Math.round(psQpDmg * 0.5)} damage.` + apSuffix;
    }
    case 'knowledge_ward':
      return `Gain Block scaled by correct Charges this encounter. QP: 6×Charges. CC: 10×Charges. CW: 4 Block.` + apSuffix;
    case 'smite': {
      const smQpValue = _statsForPower?.qpValue ?? 7;
      // 2026-04-11 audit fix: stat table L0 qpValue=7 (not 10, the old seed value).
      return `Deal ${smQpValue} damage (QP). CC: 10 + (6 × Aura level) damage. CW: 6 damage + Aura −1.` + apSuffix;
    }
    case 'feedback_loop': {
      const flQpValue = _statsForPower?.qpValue ?? 3;
      // Pass 8 (2026-04-10): CC base reduced 40->28; flow bonus reduced +16->+12.
      // 2026-04-11 audit fix: description was showing stale pre-Pass-8 values.
      return `Deal ${flQpValue} damage (QP). CC: 28 damage (+12 in Flow State, max 40). CW: 0 damage + Aura −3 crash.` + apSuffix;
    }

    default: {
      // Type-based sensible defaults — better than just mechanic.name
      const fallbackPower = Math.round(card.baseEffectValue);
      switch (card.cardType) {
        case 'attack': return `Deal ${fallbackPower} damage.${apSuffix}`;
        case 'shield': return `Gain ${fallbackPower} Block.${apSuffix}`;
        case 'buff': return `Buff +${fallbackPower}%.${apSuffix}`;
        case 'debuff': return `Debuff ${fallbackPower} turns.${apSuffix}`;
        case 'utility': return `Draw ${fallbackPower}.${apSuffix}`;
        case 'wild': return `Wild effect.${apSuffix}`;
        default: return (mechanic.description || (GENERIC_TYPE_DESCRIPTIONS[card.cardType] ?? '')) + apSuffix;
      }
    }
  }
}

/**
 * Get a short (1-2 word) mechanic tag for display on card option buttons.
 * Returns the mechanic name or the card type if no mechanic is assigned.
 */
export function getMechanicTag(card: Card): string {
  if (card.mechanicName) return card.mechanicName;
  const mechanic = getMechanicDefinition(card.mechanicId);
  if (mechanic) return mechanic.name;
  return card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1);
}

/**
 * Get a short parchment-friendly description for card effect display.
 * Verb-first terse format, ≤20 chars target.
 */
export function getShortCardDescription(card: Card, powerOverride?: number): string {
  const mechanic = getMechanicDefinition(card.mechanicId);
  // 2026-04-11 audit fix: use stat-table qpValue not baseEffectValue.
  const _shortStatsForPower = mechanic ? getMasteryStats(mechanic.id, card.masteryLevel ?? 0) : null;
  const power = powerOverride ?? (_shortStatsForPower?.qpValue != null ? _shortStatsForPower.qpValue : Math.round(card.baseEffectValue));

  if (!mechanic) {
    switch (card.cardType) {
      case 'attack': return `Deal ${power}`;
      case 'shield': return `Gain ${power}`;
      case 'buff': return `+${power}%`;
      case 'debuff': return `${power} turns`;
      case 'utility': return `Draw ${power}`;
      case 'wild': return 'Wild effect';
      default: return '';
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;
  const stats = getMasteryStats(mechanic.id, card.masteryLevel ?? 0);

  switch (mechanic.id) {
    // ── Attack ───────────────────────────────────────────────────────────────
    case 'strike': return `Deal ${power}`;
    case 'multi_hit': return `${secondary ?? 3}× ${power} dmg`;
    case 'heavy_strike': return `Deal ${power}`;
    case 'piercing': return `${power} pierce`;
    case 'reckless': return `${power} dmg, ${stats?.extras?.['selfDmg'] ?? secondary ?? 4} self`;
    case 'execute': {
      const eb = stats?.extras?.['execBonus'] ?? secondary ?? 8;
      const et = stats?.extras?.['execThreshold'] ?? 0.3;
      return `${power}+${eb} <${Math.round(et * 100)}%`;
    }
    case 'power_strike': return `Deal ${power}`;
    case 'twin_strike': {
      const hits = stats?.hitCount ?? 2;
      return `${hits}× ${power} dmg`;
    }
    case 'iron_wave': {
      const sec = stats?.secondaryValue ?? 3;
      return `${power} dmg +${sec} blk`;
    }
    case 'bash': return `${power} dmg +Vuln`;
    case 'sap': return `${power} dmg +Weak`;
    case 'rupture': {
      const bleed = stats?.secondaryValue ?? 2;
      return `${power} dmg +${bleed} L.Doubt`;
    }
    case 'lacerate': {
      const bleed = stats?.secondaryValue ?? 3;
      return `${power} dmg +${bleed} L.Doubt`;
    }
    case 'kindle': {
      const burn = stats?.secondaryValue ?? 2;
      return `${power} dmg +${burn} B.Burn▶`;
    }
    case 'overcharge': return `${power} / CC×charges`;
    case 'riposte': {
      const sec = stats?.secondaryValue ?? 3;
      return `${power} dmg +${sec} blk`;
    }
    case 'siphon_strike': return `${power} drain`;
    case 'gambit': return `CC:+${power}hp / QP:-hp`; // 2026-04-11: lead with CC heal
    case 'chain_lightning': return `${power} × chain (CC)`;
    case 'volatile_slash': return `${power} / CC+Forget`;
    case 'hemorrhage': {
      const bleedMult = stats?.extras?.['bleedMult'] ?? 3;
      return `${power}+${bleedMult}×L.Doubt`;
    }
    case 'eruption': {
      const dpa = stats?.extras?.['dmgPerAp'] ?? 6;
      return `${dpa} dmg/AP (X)`;
    }

    // ── Shield ───────────────────────────────────────────────────────────────
    case 'block': return `Gain ${power}`;
    case 'thorns': return `Gain ${power}, refl ${secondary ?? 3}`;
    case 'fortify': return '50% block';  // 2026-04-11: resolver scales current block
    case 'parry': return `Gain ${power}, draw`;
    case 'brace': return 'Match telegraph';
    case 'cleanse': return 'Purge';
    case 'overheal': return `Gain ${power} ×2<50%`;
    case 'lifetap': return `${power} drain`;
    case 'emergency': return `Gain ${power} ×2<30%`;
    case 'immunity': return 'Absorb next';
    case 'reinforce': return `Gain ${power}`;
    case 'shrug_it_off': return `${power} blk +draw`;
    case 'guard': return `Gain ${power}`;
    case 'absorb': return `${power} blk, CC+draw`;
    case 'reactive_shield': {
      const thorns = stats?.secondaryValue ?? 1;
      return `${power} blk +${thorns}▸`;
    }
    case 'aegis_pulse': return `${power} blk, CC+chain`;
    case 'burnout_shield': return `${power} / CC+Forget`;
    case 'bulwark': return `${power} / CC+Forget`;
    case 'conversion': return 'Deal Block as dmg';
    case 'ironhide': {
      const str = stats?.extras?.['str'] ?? 1;
      return `${power} blk +${str} Str`;
    }

    // ── Buff ─────────────────────────────────────────────────────────────────
    case 'empower': return `Next +${power}%`;
    case 'quicken': return '+1 AP';
    case 'focus': return 'Next −1 AP';
    case 'double_strike': return `2× ${stats?.extras?.['hitMult'] ?? 75}% power`;
    case 'ignite': {
      const burnStacks = stats?.extras?.['burnStacks'] ?? 2;
      return `Next +${burnStacks} B.Burn`;
    }
    case 'inscription_fury': return `+${power} dmg all atk`;
    case 'inscription_iron': return `+${power} blk/turn`;
    case 'inscription_wisdom': return '+1 draw/CC';
    case 'warcry': {
      const str = stats?.extras?.['str'] ?? 1;
      return `+${str} Str / CC perm`;
    }
    case 'battle_trance': {
      const drawCount = stats?.drawCount ?? 2;
      return `Draw ${drawCount} +lock`;
    }
    case 'frenzy': {
      const freeCards = stats?.extras?.['freeCards'] ?? 1;
      return `Next ${freeCards} free`;
    }
    case 'mastery_surge': {
      const targets = stats?.extras?.['targets'] ?? 1;
      return `+1 mastery ×${targets}`;
    }
    case 'war_drum': {
      const bonus = stats?.extras?.['bonus'] ?? 1;
      return `Hand +${bonus} this turn`;
    }
    case 'forge': {
      const amt = stats?.extras?.['amount'] ?? 1;
      return `Forge +${amt} mastery`;
    }

    // ── Debuff ───────────────────────────────────────────────────────────────
    case 'weaken': return `Weak ${power}`;
    case 'expose': return `Vuln ${power}`;
    case 'slow': return 'Skip action';
    case 'hex': return `Doubt ${power}×${secondary ?? 3}`;
    case 'stagger': return 'Skip action';
    case 'corrode': return 'Strip blk +Weak';
    case 'curse_of_doubt': {
      const pctBonus = stats?.extras?.['pctBonus'] ?? 15;
      return `+${pctBonus}% chg dmg`;
    }
    case 'mark_of_ignorance': {
      const flatBonus = stats?.extras?.['flatBonus'] ?? 2;
      return `+${flatBonus} flat/chg`;
    }
    case 'corroding_touch': {
      const weakStacks = stats?.extras?.['weakStacks'] ?? 1;
      return `${weakStacks} Weak (free)`;
    }
    case 'entropy': {
      const burn = stats?.extras?.['burn'] ?? 2;
      const poison = stats?.extras?.['poison'] ?? 1;
      return `${burn}B.Burn +${poison}Doubt`;
    }

    // ── Utility ──────────────────────────────────────────────────────────────
    case 'scout': return `Draw ${power}`;
    case 'recycle': return 'Draw 3';
    case 'foresight': {
      // 10.2: use drawCount from mastery stat table, not qpValue (which is 0)
      const foresightStatsShort = getMasteryStats(mechanic.id, card.masteryLevel ?? 0);
      const foresightDrawShort = foresightStatsShort?.drawCount ?? 1;
      return `Draw ${foresightDrawShort}`;
    }
    case 'transmute': return 'Transform';
    case 'sift': {
      const scryCount = stats?.extras?.['scryCount'] ?? 2;
      return `Scry ${scryCount}`;
    }
    case 'scavenge': return 'Recover 1';
    case 'swap': {
      const draws = stats?.drawCount ?? 1;
      return `Cycle 1→${draws}`;
    }
    case 'archive': {
      const retain = stats?.extras?.['retain'] ?? 1;
      return `Retain ${retain}`;
    }
    case 'reflex': {
      const drawCount = stats?.drawCount ?? 1;
      return `Draw ${drawCount} +passive`;
    }
    case 'recollect': {
      const returns = stats?.extras?.['returns'] ?? 1;
      return `Return ${returns} forget`;
    }
    case 'synapse': {
      const drawCount = stats?.drawCount ?? 1;
      return `Draw ${drawCount} / CC+chain`;
    }
    case 'siphon_knowledge': {
      const drawCount = stats?.drawCount ?? 1;
      return `Draw ${drawCount} +preview`;
    }
    case 'tutor': return 'Search & add';
    case 'conjure': {
      const picks = stats?.extras?.['picks'] ?? 1;
      return `Summon ${picks}`;
    }

    // ── Wild ─────────────────────────────────────────────────────────────────
    case 'mirror': return 'Copy last';
    case 'adapt': return 'Smart';
    case 'overclock': return '2× effect';
    case 'phase_shift': return `${power} dmg OR blk`;
    case 'chameleon': return 'Copy last';
    case 'dark_knowledge': {
      const dmgPerCurse = stats?.extras?.['dmgPerCurse'] ?? 2;
      return `${dmgPerCurse} dmg/curse`;
    }
    case 'chain_anchor': {
      const draws = stats?.drawCount ?? 1;
      return `Draw ${draws} / CC→2`;
    }
    case 'unstable_flux': return 'Random / CC: choose';
    case 'sacrifice': return '-5HP: draw 2+AP';
    case 'catalyst': return 'Double Doubt (CC+B.Burn)';
    case 'mimic': {
      const qpMult = stats?.extras?.['qpMult'] ?? 60;
      return `Replay disc ${qpMult}%`;
    }
    case 'aftershock': {
      const qpMult = stats?.extras?.['qpMult'] ?? 40;
      return `Echo ${qpMult}% / CC>`;
    }
    case 'knowledge_bomb': {
      const perCorrect = stats?.extras?.['perCorrect'] ?? 3;
      return `CC: ${perCorrect}×charges`;
    }

    // ── AR-264: Quiz-integrated cards ─────────────────────────────────────────
    case 'recall': return '10/20/30 dmg';
    case 'precision_strike': return 'Deal 8×options';
    case 'knowledge_ward': return 'Gain ×charges';
    case 'smite': return '7+CC×Aura dmg';  // 2026-04-11 audit: L0 QP=7 from stat table
    case 'feedback_loop': return 'CC: 28/40 dmg';  // 2026-04-11 Pass-8 updated values

    default: {
      // Type-based sensible defaults — better than just mechanic.name
      const fallbackPower = Math.round(card.baseEffectValue);
      switch (card.cardType) {
        case 'attack': return `Deal ${fallbackPower}`;
        case 'shield': return `Gain ${fallbackPower}`;
        case 'buff': return `+${fallbackPower}%`;
        case 'debuff': return `${fallbackPower} turns`;
        case 'utility': return `Draw ${fallbackPower}`;
        case 'wild': return 'Wild effect';
        default: return mechanic.name;
      }
    }
  }
}

/** Structured part of a card description for rich rendering */
export type CardDescPart =
  | { type: 'text'; value: string }
  | { type: 'number'; value: string }
  | { type: 'keyword'; value: string; keywordId: string }
  | { type: 'conditional-number'; value: string; active: boolean }
  | { type: 'mastery-bonus'; value: string };

interface CardGameState {
  playerHpPercent?: number;
  enemyHpPercent?: number;
}

function num(v: number | string): CardDescPart {
  return { type: 'number', value: String(v) };
}
function masteryNum(v: number | string): CardDescPart {
  return { type: 'mastery-bonus', value: String(v) };
}
/**
 * Returns [num(base)] or [num(base), masteryNum('+bonus')] depending on mastery level.
 * `total` may already include the mastery bonus (e.g. from getEffectValue()), so we
 * subtract it back out to recover the true base for display ("4 +3", not "7 +3").
 */
function numWithMastery(total: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  // Derive bonus via stat table when available; fall back to old perLevelDelta helper.
  const stats = getMasteryStats(mechanicId, masteryLevel);
  const l0Stats = getMasteryStats(mechanicId, 0);
  const bonus = (stats && l0Stats) ? Math.round(stats.qpValue - l0Stats.qpValue) : Math.round(getMasteryBaseBonus(mechanicId, masteryLevel));
  if (bonus <= 0 || masteryLevel <= 0) return [num(total)];
  return [num(total - bonus), masteryNum('+' + bonus)];
}
/**
 * Returns [num(base)] or [num(base), masteryNum('+bonus')] using secondary mastery bonus.
 * `total` may already include the mastery bonus, so we subtract it back out to recover
 * the true base for display.
 */
function numWithSecondaryMastery(total: number, mechanicId: string, masteryLevel: number): CardDescPart[] {
  // Derive secondary bonus via stat table when available; fall back to old perLevelDelta helper.
  const stats = getMasteryStats(mechanicId, masteryLevel);
  const l0Stats = getMasteryStats(mechanicId, 0);
  const secBonus = (stats?.secondaryValue != null && l0Stats?.secondaryValue != null)
    ? Math.round(stats.secondaryValue - l0Stats.secondaryValue)
    : Math.round(getMasterySecondaryBonus(mechanicId, masteryLevel));
  if (secBonus <= 0 || masteryLevel <= 0) return [num(total)];
  return [num(total - secBonus), masteryNum('+' + secBonus)];
}
function txt(v: string): CardDescPart {
  return { type: 'text', value: v };
}
function kw(name: string, id: string): CardDescPart {
  return { type: 'keyword', value: name, keywordId: id };
}
function cond(v: number, active: boolean): CardDescPart {
  return { type: 'conditional-number', value: String(v), active };
}

/**
 * Get structured description parts for rich card text rendering.
 * Returns an array of typed segments for rendering with styled numbers,
 * bold keywords, and conditional values.
 *
 * Style: verb-first; use `\n` in txt() for line breaks (renderer splits on \n into .desc-line divs).
 * 2 lines max ideal. Keywords use kw(), numbers use num()/numWithMastery().
 */
export function getCardDescriptionParts(card: Card, gameState?: CardGameState, powerOverride?: number): CardDescPart[] {
  const mechanic = getMechanicDefinition(card.mechanicId);
  const masteryLevel = card.masteryLevel ?? 0;
  // 2026-04-11 audit fix: use stat-table qpValue not baseEffectValue.
  const _partsStatsForPower = mechanic ? getMasteryStats(mechanic.id, masteryLevel) : null;
  const power = powerOverride ?? (_partsStatsForPower?.qpValue != null ? _partsStatsForPower.qpValue : Math.round(card.baseEffectValue));

  if (!mechanic) {
    switch (card.cardType) {
      case 'attack': return [txt('Deal '), ...numWithMastery(power, card.mechanicId ?? '', masteryLevel), txt(' damage')];
      case 'shield': return [txt('Gain '), ...numWithMastery(power, card.mechanicId ?? '', masteryLevel), txt(' '), kw('Block', 'block')];
      case 'buff': return [txt('Buff +'), num(power), txt('%')];
      case 'debuff': return [txt('Debuff '), num(power), txt(' turns')];
      case 'utility': return [txt('Draw '), num(power)];
      case 'wild': return [txt('Wild effect')];
      default: return [txt(card.cardType)];
    }
  }

  const secondary = card.secondaryValue ?? mechanic.secondaryValue;
  const pHp = gameState?.playerHpPercent ?? 1;
  const eHp = gameState?.enemyHpPercent ?? 1;
  const stats = getMasteryStats(mechanic.id, masteryLevel);

  switch (mechanic.id) {
    // ── Attacks ───────────────────────────────────────────────────────────────
    case 'strike':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'multi_hit': {
      const hits = secondary ?? 3;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), num(hits), txt(' times')];
    }
    case 'heavy_strike':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'piercing':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), kw('Pierce', 'pierce')];
    case 'reckless': {
      const selfDmg = stats?.extras?.['selfDmg'] ?? secondary ?? 4;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nSelf-hit '), num(selfDmg)];
    }
    case 'execute': {
      const bonus = stats?.extras?.['execBonus'] ?? secondary ?? 8;
      const threshold = stats?.extras?.['execThreshold'] ?? 0.3;
      const active = eHp < threshold;
      const secMasteryBonus = getMasterySecondaryBonus(mechanic.id, masteryLevel);
      const bonusParts: CardDescPart[] = secMasteryBonus > 0 && masteryLevel > 0
        ? [cond(bonus, active), masteryNum('+' + Math.round(secMasteryBonus))]
        : [cond(bonus, active)];
      return [txt('Deal '), num(power), txt(' damage\n+'), ...bonusParts, txt(` if <${Math.round(threshold * 100)}% HP`)];
    }
    case 'lifetap':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nHeal 20%')];
    case 'power_strike':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage')];
    case 'twin_strike': {
      const hits = stats?.hitCount ?? 2;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), num(hits), txt('× hits')];
    }
    case 'iron_wave': {
      const sec = stats?.secondaryValue ?? 3;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nGain '), num(sec), txt(' '), kw('Block', 'block')];
    }
    case 'bash': {
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), kw('Vuln', 'vulnerable'), txt(' 1t')];
    }
    case 'sap':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), kw('Drawing Blanks', 'weakness'), txt(' 1t')];
    case 'rupture': {
      const bleed = stats?.secondaryValue ?? 2;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), num(bleed), txt(' '), kw('Lingering Doubt', 'bleed')];
    }
    case 'lacerate': {
      const bleed = stats?.secondaryValue ?? 3;
      return [txt('Deal '), num(power), txt(' damage\n'), num(bleed), txt(' '), kw('Lingering Doubt', 'bleed')];
    }
    case 'kindle': {
      const burn = stats?.secondaryValue ?? 2;
      return [txt('Deal '), num(power), txt(' damage\n'), num(burn), txt(' '), kw('Brain Burn', 'burn'), txt(' ▶trigger')];
    }
    case 'overcharge':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nCC: ×charges')];
    case 'riposte': {
      const sec = stats?.secondaryValue ?? 3;
      return [txt('Deal '), num(power), txt(' damage\nGain '), num(sec), txt(' '), kw('Block', 'block')];
    }
    case 'siphon_strike': {
      const minH = stats?.extras?.['minHeal'] ?? 1;
      const maxH = stats?.extras?.['maxHeal'] ?? 6;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nDrain '), num(minH), txt('–'), num(maxH), txt(' HP')];
    }
    case 'gambit': {
      const selfDmg = stats?.extras?.['selfDmg'] ?? 4;
      const heal = stats?.extras?.['healOnCC'] ?? 3;
      // 2026-04-11 reframe: show CC heal first, then QP self-damage — reward-forward framing.
      return [txt('Deal '), num(power), txt(' damage\nCC: +'), num(heal), txt(' HP  QP: −'), num(selfDmg), txt(' HP')];
    }
    case 'chain_lightning':
      return [txt('Deal '), num(power), txt(' damage\nCC: ×chain length')];
    case 'volatile_slash':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nCC: '), kw('Forget', 'forget')];
    case 'hemorrhage': {
      const mult = stats?.extras?.['bleedMult'] ?? 3;
      return [txt('Deal '), num(power), txt('+'), num(mult), txt('×'), kw('Lingering Doubt', 'bleed'), txt('\nConsume L.Doubt')];
    }
    case 'eruption': {
      const dpa = stats?.extras?.['dmgPerAp'] ?? 6;
      return [txt('Spend all AP\n'), num(dpa), txt(' dmg/AP (X)')];
    }

    // ── Shields ───────────────────────────────────────────────────────────────
    case 'block':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'thorns':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nReflect '), ...numWithSecondaryMastery(secondary ?? 3, mechanic.id, masteryLevel)];
    case 'fortify':
      // 2026-04-11 audit fix: resolver scales current block, not flat block.
      // Persistence only happens at L5 (fortify_carry tag).
      return [txt('50% Block'), txt('\nCC: 75% Block')];
    case 'parry':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDraw on hit')];
    case 'brace':
      return [kw('Block', 'block'), txt('\n= enemy attack')];
    case 'overheal': {
      const doubled = power * 2;
      const active = pHp < 0.5;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\n×2 ('), cond(doubled, active), txt(') if <50%')];
    }
    case 'emergency': {
      const active = pHp < 0.3;
      const val = active ? power * 2 : power;
      return [txt('Gain '), ...numWithMastery(val, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\n×2 if <30%')];
    }
    case 'reinforce':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'shrug_it_off': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDraw '), num(draws)];
    }
    case 'guard':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'absorb':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCC: draw 1')];
    case 'reactive_shield': {
      const thorns = stats?.secondaryValue ?? 1;
      return [txt('Gain '), num(power), txt(' '), kw('Block', 'block'), txt('\n'), num(thorns), txt(' '), kw('Thorns', 'thorns'), txt(' 1t')];
    }
    case 'aegis_pulse':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCC: chain +2 blk')];
    case 'burnout_shield':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCC: '), kw('Forget', 'forget')];
    case 'bulwark':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCC: '), kw('Forget', 'forget')];
    case 'conversion':
      return [txt('Deal Block as dmg\nGain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'ironhide': {
      const str = stats?.extras?.['str'] ?? 1;
      return [txt('Gain '), num(power), txt(' '), kw('Block', 'block'), txt('\n+'), num(str), txt(' '), kw('Clarity', 'strength')];
    }

    // ── Buffs ─────────────────────────────────────────────────────────────────
    case 'empower':
      return [txt('Next card\n+'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('% damage')];
    case 'quicken':
      return [txt('+'), num(1), txt(' AP\nthis turn')];
    case 'focus': {
      const count = Math.max(1, Math.floor((secondary as number | undefined) ?? 1));
      return count > 1
        ? [txt('Next '), num(count), txt(' cards −1 AP')]
        : [txt('Next card −1 AP')];
    }
    case 'double_strike': {
      const hitMult = stats?.extras?.['hitMult'] ?? 75;
      return [txt('Next attack\nhits twice at '), num(hitMult + '%'), txt(' power')];
    }
    case 'ignite': {
      const burn = stats?.extras?.['burnStacks'] ?? 2;
      return [txt('Next attack\n+'), num(burn), txt(' '), kw('Brain Burn', 'burn')];
    }
    case 'inscription_fury':
      return [txt('All attacks +'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('\nrest of combat')];
    case 'inscription_iron':
      return [txt('+'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('/turn\nrest of combat')];
    case 'inscription_wisdom': {
      const dpc = stats?.extras?.['drawPerCC'] ?? 1;
      return [txt('Each CC: draw +'), num(dpc), txt('\nrest of combat')];
    }
    case 'warcry': {
      const str = stats?.extras?.['str'] ?? 1;
      return [txt('+'), num(str), txt(' '), kw('Clarity', 'strength'), txt('\nCC: permanent')];
    }
    case 'battle_trance': {
      const draws = stats?.drawCount ?? 2;
      return [txt('Draw '), num(draws), txt('\nQP: lockout')];
    }
    case 'frenzy': {
      const free = stats?.extras?.['freeCards'] ?? 1;
      return [txt('Next '), num(free), txt(' card(s)\ncost 0 AP')];
    }
    case 'mastery_surge': {
      const tgts = stats?.extras?.['targets'] ?? 1;
      return [txt('+1 '), kw('Mastery', 'mastery'), txt('\n'), num(tgts), txt(' card(s) (CC: choose)')];
    }
    case 'war_drum': {
      const bon = stats?.extras?.['bonus'] ?? 1;
      return [txt('All hand cards\n+'), num(bon), txt(' this turn')];
    }
    case 'forge': {
      const ups = stats?.extras?.['upgrades'] ?? 1;
      const amt = stats?.extras?.['amount'] ?? 1;
      return [txt('Forge '), num(ups), txt(' card(s)\n+'), num(amt), txt(' '), kw('Mastery', 'mastery')];
    }

    // ── Debuffs ───────────────────────────────────────────────────────────────
    case 'weaken':
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Drawing Blanks', 'weakness')];
    case 'expose':
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Exposed', 'vulnerable')];
    case 'slow':
      return [txt("Skip enemy's\nnext action")];
    case 'hex': {
      const turns = secondary ?? 3;
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Doubt', 'poison'), txt('\n'), num(turns), txt(' turns')];
    }
    case 'stagger':
      return [txt("Skip enemy's\nnext action")];
    case 'corrode':
      return [txt('Strip '), kw('Block', 'block'), txt('\n+'), kw('Drawing Blanks', 'weakness'), txt(' 1t')];
    case 'curse_of_doubt': {
      const pct = stats?.extras?.['pctBonus'] ?? 15;
      const turns = stats?.extras?.['turns'] ?? 1;
      return [txt('+'), num(pct), txt('% charge dmg\n'), num(turns), txt('t  CC: ×2')];
    }
    case 'mark_of_ignorance': {
      const flat = stats?.extras?.['flatBonus'] ?? 2;
      const turns = stats?.extras?.['turns'] ?? 1;
      return [txt('+'), num(flat), txt(' flat/charge\n'), num(turns), txt('t  CC: more')];
    }
    case 'corroding_touch': {
      const ws = stats?.extras?.['weakStacks'] ?? 1;
      const wt = stats?.extras?.['weakTurns'] ?? 1;
      return [txt('Apply '), num(ws), txt(' '), kw('Drawing Blanks', 'weakness'), txt(' '), num(wt), txt('t\nFree  CC: +Vuln')];
    }
    case 'entropy': {
      const burn = stats?.extras?.['burn'] ?? 2;
      const pois = stats?.extras?.['poison'] ?? 1;
      const pt = stats?.extras?.['poisonTurns'] ?? 2;
      return [txt('Apply '), num(burn), txt(' '), kw('Brain Burn', 'burn'), txt('+'), num(pois), txt(' '), kw('Doubt', 'poison'), txt('\n'), num(pt), txt('t')];
    }

    // ── Utility ───────────────────────────────────────────────────────────────
    case 'scout': {
      const drawCount = Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
      return [txt('Draw '), num(drawCount)];
    }
    case 'recycle':
      return [txt('Draw '), num(3)];
    case 'foresight': {
      // 10.2: foresight qpValue=0 at all mastery levels (utility draw card); draw count comes
      // from drawCount in the mastery stat table, not from power (which would show "Draw 0").
      const foresightStats = getMasteryStats(mechanic.id, masteryLevel);
      const foresightDraw = foresightStats?.drawCount ?? 1;
      return [txt('Draw '), num(foresightDraw), txt('\n'), kw('Forget', 'forget')];
    }
    case 'transmute':
      // 2026-04-12: Fixed word-boundary issue. Previous parts had 'for\nencounter' which,
      // when rendered in contexts that don't split on \n (RunDeckOverlay inline span),
      // displayed as 'forencounterCharge: choose 1/3' — confirmed playtest BATCH-2026-04-12-001 Bug F.
      return [txt('Transform for encounter'), txt('\nCharge: choose 1/3')];
    case 'cleanse':
      return [txt('Purge debuffs\nDraw 1')];
    case 'immunity':
      return [txt('Absorb next hit\nup to '), num(power)];
    case 'sift': {
      const sc = stats?.extras?.['scryCount'] ?? 2;
      return [txt('Scry '), num(sc), txt('\nDiscard any')];
    }
    case 'scavenge': {
      const picks = stats?.extras?.['picks'] ?? 1;
      return [txt('Recover '), num(picks), txt('\nfrom discard')];
    }
    case 'swap': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Discard 1\nDraw '), num(draws)];
    }
    case 'archive': {
      const ret = stats?.extras?.['retain'] ?? 1;
      return [txt('Retain '), num(ret), txt(' in hand\npast turn end')];
    }
    case 'reflex': {
      const draws = stats?.drawCount ?? 1;
      const pb = stats?.extras?.['passiveBlock'] ?? 2;
      return [txt('Draw '), num(draws), txt('\nPassive: discard→+'), num(pb), txt(' '), kw('Block', 'block')];
    }
    case 'recollect': {
      const rets = stats?.extras?.['returns'] ?? 1;
      return [txt('Return '), num(rets), txt(' '), kw('Forgotten', 'forget'), txt('\nto discard')];
    }
    case 'synapse': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Draw '), num(draws), txt('\nCC: chain link')];
    }
    case 'siphon_knowledge': {
      const draws = stats?.drawCount ?? 1;
      const sec = stats?.extras?.['previewSec'] ?? 2;
      return [txt('Draw '), num(draws), txt('\nPreview answers '), num(sec), txt('s')];
    }
    case 'tutor': {
      const srch = stats?.extras?.['search'] ?? 1;
      return [txt('Search '), num(srch), txt(' from pile\nAdd to hand')];
    }
    case 'conjure': {
      const picks = stats?.extras?.['picks'] ?? 1;
      return [txt('Summon '), num(picks), txt(' card(s)\nfor encounter')];
    }

    // ── Wild ──────────────────────────────────────────────────────────────────
    case 'mirror':
      return [txt('Copy last card')];
    case 'adapt':
      return [txt('Auto:\n'), kw('Block', 'block'), txt('·Atk·'), kw('Cleanse', 'cleanse')];
    case 'overclock':
      return [txt('Next card ×2')];
    case 'phase_shift':
      return [txt('Choose: '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' dmg\nor same Block\nCC: BOTH')];
    case 'chameleon':
      return [txt('Copy last card')];
    case 'dark_knowledge': {
      const dpc = stats?.extras?.['dmgPerCurse'] ?? 2;
      return [txt('Deal '), num(dpc), txt(' per curse\nCC: '), num(Math.round(dpc * 1.5)), txt(' per curse')];
    }
    case 'chain_anchor': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Draw '), num(draws), txt('\nCC: set chain→2')];
    }
    case 'unstable_flux':
      return [txt('Random effect\nCC: choose effect')];
    case 'sacrifice':
      return [txt('−'), num(5), txt(' HP\nDraw '), num(2), txt(' +'), num(1), txt(' AP')];
    case 'catalyst':
      return [txt('Double '), kw('Doubt', 'poison'), txt('\nCC: +B.Burn  L4: +L.Doubt')];
    case 'mimic': {
      const qpM = stats?.extras?.['qpMult'] ?? 60;
      return [txt('Replay discard\n'), num(qpM), txt('% / CC: choose')];
    }
    case 'aftershock': {
      const qpM = stats?.extras?.['qpMult'] ?? 40;
      return [txt('Echo last card\n'), num(qpM), txt('%  CC: '), num(stats?.extras?.['ccMult'] ?? 50), txt('%')];
    }
    case 'knowledge_bomb': {
      const ppc = stats?.extras?.['perCorrect'] ?? 3;
      return [txt('QP: 4 dmg\nCC: '), num(ppc), txt('×charges')];
    }

    // ── AR-264: Quiz-integrated cards ──────────────────────────────────────────
    case 'recall':
      return [txt('Deal '), num(10), txt(' damage\nCC: '), num(20), txt(' / Review: '), num(30)];
    case 'precision_strike':
      return [txt('Deal '), num(8), txt(' damage\nCC: ×(options+1)')];
    case 'knowledge_ward':
      return [txt('Gain '), kw('Block', 'block'), txt(' ×\ncorrect charges')];
    case 'smite': {
      // 2026-04-11 audit fix: qpValue from stat table (L0=7, not old seed 10).
      const smPartsPower = _partsStatsForPower?.qpValue ?? 7;
      return [txt('Deal '), num(smPartsPower), txt(' dmg\nCC: +Aura scale')];
    }
    case 'feedback_loop':
      // 2026-04-11 audit fix: Pass 8 reduced CC from 40 to 28 (max 40 in Flow State).
      return [txt('CC: 28/40 dmg\n'), kw('Flow State', 'flow_state'), txt(' bonus')];

    default: {
      // Type-based sensible defaults — better than just mechanic.name
      const powerNum = Math.round(card.baseEffectValue);
      switch (card.cardType) {
        case 'attack': return [txt('Deal '), num(powerNum), txt(' damage')];
        case 'shield': return [txt('Gain '), num(powerNum), txt(' '), kw('Block', 'block')];
        case 'buff': return [txt('Buff +'), num(powerNum), txt('%')];
        case 'debuff': return [txt('Debuff '), num(powerNum), txt(' turns')];
        case 'utility': return [txt('Draw '), num(powerNum)];
        case 'wild': return [txt('Wild effect')];
        default: return [txt(mechanic.name)];
      }
    }
  }
}
