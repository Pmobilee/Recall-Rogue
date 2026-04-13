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
      const hits = stats?.hitCount ?? secondary ?? 3;
      return `Deal ${power} damage ${hits} times (${power * hits} total).` + apSuffix;
    }
    case 'heavy_strike':
      return `Deal ${power} damage.${apSuffix}`;
    case 'piercing': {
      const pierceStrip = (stats?.tags ?? []).includes('pierce_strip3');
      const pierceVuln = (stats?.tags ?? []).includes('pierce_vuln1');
      return `Deal ${power} damage. Ignores enemy Block.${pierceStrip ? ' Also strips 3 enemy Block.' : ''}${pierceVuln ? ' Applies Exposed 1t.' : ''}` + apSuffix;
    }
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
      const sec = stats?.secondaryValue ?? 5;
      return `Deal ${power} damage and gain ${sec} Block. CC: both scale up. L5: Block doubles when you have 10+ Block.` + apSuffix;
    }
    case 'bash': {
      const bashVulnTurns = (stats?.tags ?? []).includes('bash_vuln2t') ? 2 : 1;
      return `Deal ${power} damage. Apply Exposed ${bashVulnTurns} turn${bashVulnTurns > 1 ? 's' : ''} (CC: ${bashVulnTurns === 2 ? '2 turns — both QP and CC' : '2 turns via CC'}).` + apSuffix;
    }
    case 'sap':
      return `Deal ${power} damage and apply Drawing Blanks 1 turn. CC: more damage.` + apSuffix;
    case 'rupture': {
      const bleed = stats?.secondaryValue ?? 2;
      return `Deal ${power} damage and apply ${bleed} Lingering Doubt. CC: double Lingering Doubt stacks.` + apSuffix;
    }
    case 'lacerate': {
      const bleed = stats?.secondaryValue ?? 3;
      const lacerVuln = (stats?.tags ?? []).includes('lacerate_vuln1t');
      return `Deal ${power} damage and apply ${bleed} Lingering Doubt. CC: massive Lingering Doubt bonus.${lacerVuln ? ' L5: also applies Exposed 1t.' : ''}` + apSuffix;
    }
    case 'kindle': {
      const burn = stats?.secondaryValue ?? 4;
      return `Deal ${power} damage, apply ${burn} Brain Burn, then trigger Brain Burn immediately. CC: more Brain Burn. L5: trigger twice.` + apSuffix;
    }
    case 'overcharge': {
      const ovchX2 = (stats?.tags ?? []).includes('overcharge_bonus_x2');
      return `Deal ${power} damage. CC: deal ${Math.round(power * 1.75)} damage + ${ovchX2 ? '4' : '2'} per correct Charge used this encounter (own CC counts).${ovchX2 ? ' (L3+: bonus doubled.)' : ''}` + apSuffix;
    }
    case 'riposte': {
      const sec = stats?.secondaryValue ?? 4;
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
    case 'block': {
      const blockConsec = (stats?.tags ?? []).includes('block_consecutive3');
      return `Gain ${power} Block. Absorbs damage before HP.${blockConsec ? ' Bonus Block when played 3+ times consecutively.' : ''}` + apSuffix;
    }
    case 'thorns': {
      const reflect = stats?.secondaryValue ?? secondary ?? 3;
      return `Gain ${power} Block. Reflect ${reflect} damage when hit.` + apSuffix;
    }
    case 'fortify':
      // 2026-04-11 audit fix: resolver uses current block x 0.5/0.75, NOT a flat value.
      // fortify_carry (persistence) is only at L5 tag.
      return `Gain Block = 50% of current Block (QP) or 75% + card value (CC). L5: Block persists next turn.` + apSuffix;
    case 'parry': {
      const parryDraw = stats?.secondaryValue ?? 1;
      return `Gain ${power} Block. Draw ${parryDraw} card${parryDraw > 1 ? 's' : ''} if enemy attacks.` + apSuffix;
    }
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
    case 'immunity': {
      const absorbAmt = stats?.extras?.['absorb'] ?? 4;
      return `Absorb next damage instance (up to ${absorbAmt}).` + apSuffix;
    }
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
      const thorns = stats?.secondaryValue ?? 2;
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
    case 'empower': {
      const emp2cards = (stats?.tags ?? []).includes('empower_2cards');
      return `Next ${emp2cards ? '2 cards deal' : 'card deals'} ${power}% more damage.` + apSuffix;
    }
    case 'quicken': {
      const qkDraw1 = (stats?.tags ?? []).includes('quicken_draw1');
      const qkDraw2 = (stats?.tags ?? []).includes('quicken_draw2');
      const qkAp2 = (stats?.tags ?? []).includes('quicken_ap2');
      const qkAp = qkAp2 ? 2 : 1;
      const qkDrawCount = qkDraw2 ? 2 : qkDraw1 ? 1 : 0;
      return `Gain +${qkAp} AP this turn.${qkDrawCount > 0 ? ` Also draws ${qkDrawCount} card${qkDrawCount > 1 ? 's' : ''}.` : ''}` + apSuffix;
    }
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
      const warcryFree = (stats?.tags ?? []).includes('warcry_freecharge');
      return `QP: gain +${str} Clarity this turn. CC: gain Clarity permanently${warcryFree ? ' and next Charge costs 0 AP' : ''}.` + apSuffix;
    }
    case 'battle_trance': {
      const drawCount = stats?.drawCount ?? 2;
      const tranceNoLock = (stats?.tags ?? []).includes('trance_no_lockout_qp');
      const tranceCcAp1 = (stats?.tags ?? []).includes('trance_cc_ap1');
      return `Draw ${drawCount} cards. ${tranceNoLock ? 'CW: cannot play more cards this turn. CC: no restriction.' : 'QP/CW: cannot play or Charge more cards this turn. CC: no restriction.'}${tranceCcAp1 ? ' L5: CC grants +1 AP.' : ''}` + apSuffix;
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
    case 'weaken': {
      const weakenTurns = stats?.extras?.['turns'] ?? 1;
      return `Apply ${power} Drawing Blanks for ${weakenTurns} turn${weakenTurns !== 1 ? 's' : ''}. Enemy deals less damage.` + apSuffix;
    }
    case 'expose': {
      const exposeTurns = stats?.extras?.['turns'] ?? 1;
      return `Apply ${power} Exposed for ${exposeTurns} turn${exposeTurns !== 1 ? 's' : ''}. Enemy takes more damage.` + apSuffix;
    }
    case 'slow':
      return `Skip enemy's next defend or buff action.` + apSuffix;
    case 'hex': {
      const turns = stats?.extras?.['turns'] ?? secondary ?? 3;
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
      const drawCount = stats?.drawCount ?? Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
      return `Draw ${drawCount} extra card(s) this turn.` + apSuffix;
    }
    case 'focus': {
      const focusFree = (stats?.tags ?? []).includes('focus_ap0');
      const focusNext2 = (stats?.tags ?? []).includes('focus_next2free');
      return `Next card costs 1 less AP to play.${apSuffix}${focusFree ? ' (This card is free.)' : ''}${focusNext2 ? ' L5: next 2 cards cost 0 AP.' : ''}`;
    }
    case 'recycle':
      return `Draw 3 cards.` + apSuffix;
    case 'foresight':
      return `Draw ${power} cards. Forget: removed from combat after use.` + apSuffix;
    case 'transmute': {
      const transChoices = stats?.extras?.['transforms'] === 2 ? 2 : 1;
      return `QP: Auto-transform into a random new card for this encounter. CC: Choose 1 of 3 new cards (${transChoices === 2 ? '2' : '1'} at L5) for this encounter. CW: Auto-transform into a random card.${transChoices === 2 ? ' L5: transform 2 cards.' : ''}` + apSuffix;
    }
    case 'sift': {
      const scryCount = stats?.extras?.['scryCount'] ?? 2;
      return `Look at top ${scryCount} cards of your draw pile and discard any. CC: look at more cards. L3+: also draw 1.` + apSuffix;
    }
    case 'scavenge': {
      const scavPicks = stats?.extras?.['picks'] ?? 1;
      return `Put ${scavPicks} card${scavPicks > 1 ? 's' : ''} from your discard pile on top of your draw pile. CC: same effect. L2+: also draw 1. L5: costs 0 AP.` + apSuffix;
    }
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
    case 'chameleon': {
      const chamQp = stats?.extras?.['qpMult'] ?? 70;
      const chamCc = stats?.extras?.['ccMult'] ?? 100;
      const chamCw = stats?.extras?.['cwMult'] ?? 40;
      return `Copy the previous card's effect at ${chamQp}% power (QP). CC: ${chamCc}% power and inherit its chain type. CW: ${chamCw}% power.` + apSuffix;
    }
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
    case 'strike': return `Deal ${power} damage`;
    case 'multi_hit': return `Hit ${stats?.hitCount ?? secondary ?? 3}× for ${power}`;
    case 'heavy_strike': return `Deal ${power} damage`;
    case 'piercing': return `Pierce for ${power}`;
    case 'reckless': return `Deal ${power}, take ${stats?.extras?.['selfDmg'] ?? secondary ?? 4} self-damage`;
    case 'execute': return `Deal ${power}, bonus if wounded`;
    case 'power_strike': return `Deal ${power} damage`;
    case 'twin_strike': return `Hit ${stats?.hitCount ?? 2}× for ${power}`;
    case 'iron_wave': return `Deal ${power}, gain ${stats?.secondaryValue ?? 5} block`;
    case 'bash': return `Deal ${power}, apply Exposed`;
    case 'sap': return `Deal ${power}, apply Weakness`;
    case 'rupture': return `Deal ${power}, apply ${stats?.secondaryValue ?? 2} Lingering Doubt`;
    case 'lacerate': return `Deal ${power}, apply ${stats?.secondaryValue ?? 3} Lingering Doubt`;
    case 'kindle': return `Deal ${power}, apply ${stats?.secondaryValue ?? 4} Brain Burn`;
    case 'overcharge': return `Deal ${power}, scales with charges`;
    case 'riposte': return `Deal ${power}, gain ${stats?.secondaryValue ?? 4} block`;
    case 'siphon_strike': return `Deal ${power}, drain life`;
    case 'gambit': return `Deal ${power}, risk and reward`;
    case 'chain_lightning': return `Deal ${power} per chain link`;
    case 'volatile_slash': return `Deal ${power}, consumed on charge`;
    case 'hemorrhage': return `Deal ${power} + Lingering Doubt bonus`;
    case 'eruption': return `Spend all AP, ${stats?.extras?.['dmgPerAp'] ?? 6} per AP`;
    case 'precision_strike': return `Deal ${power} per option`;
    case 'smite': return `Deal ${power}, scales with aura`;
    case 'feedback_loop': return `Deal ${power}, scales with flow`;
    case 'recall': return `Deal ${power}, bonus on review`;
    case 'aftershock': return `Repeat last at ${stats?.extras?.['qpMult'] ?? 40}%`;
    case 'knowledge_bomb': return `Deal ${stats?.extras?.['perCorrect'] ?? 3} per correct charge`;
    case 'lifetap': return `Deal ${power}, drain life`;

    // ── Shield ───────────────────────────────────────────────────────────────
    case 'block': return `Gain ${power} block`;
    case 'thorns': return `Gain ${power} block, reflect ${stats?.secondaryValue ?? secondary ?? 3}`;
    case 'fortify': return 'Block from current block';  // 2026-04-11: resolver scales current block
    case 'parry': return `Gain ${power} block, draw`;
    case 'brace': return 'Block equal to enemy intent';
    case 'cleanse': return 'Remove all debuffs';
    case 'overheal': return `Gain ${power} block, ×2 if wounded`;
    case 'emergency': return `Gain ${power} block, ×2 if wounded`;
    case 'immunity': return 'Absorb next hit';
    case 'reinforce': return `Gain ${power} block`;
    case 'shrug_it_off': return `Gain ${power} block, draw`;
    case 'guard': return `Gain ${power} block`;
    case 'absorb': return `Gain ${power} block`;
    case 'reactive_shield': return `Gain ${power} block + thorns`;
    case 'aegis_pulse': return `Gain ${power} block, boost chain`;
    case 'burnout_shield': return `Gain ${power} block, consumed`;
    case 'bulwark': return `Gain ${power} block, consumed`;
    case 'conversion': return 'Deal current block as damage';
    case 'ironhide': return `Gain ${power} block + Strength`;
    case 'knowledge_ward': return 'Block scales with charges';

    // ── Buff ─────────────────────────────────────────────────────────────────
    case 'empower': return `Next card +${power}% damage`;
    case 'quicken': return 'Gain 1 action point';
    case 'focus': return 'Next card costs 1 less';
    case 'double_strike': return 'Next attack hits twice';
    case 'ignite': return `Next attack +${stats?.extras?.['burnStacks'] ?? 2} Brain Burn`;
    case 'inscription_fury': return `All attacks +${power} damage`;
    case 'inscription_iron': return `+${power} block each turn`;
    case 'inscription_wisdom': return 'Draw extra on correct charge';
    case 'warcry': return `Gain +${stats?.extras?.['str'] ?? 1} Strength`;
    case 'battle_trance': return `Draw ${stats?.drawCount ?? 2}, end actions`;
    case 'frenzy': return `Next ${stats?.extras?.['freeCards'] ?? 1} cards cost 0`;
    case 'mastery_surge': return `Upgrade ${stats?.extras?.['targets'] ?? 1} cards`;
    case 'war_drum': return `All cards +${stats?.extras?.['bonus'] ?? 1} this turn`;
    case 'forge': return `Upgrade a card +${stats?.extras?.['amount'] ?? 1}`;

    // ── Debuff ───────────────────────────────────────────────────────────────
    case 'weaken': return `Apply ${power} Weakness`;
    case 'expose': return `Apply ${power} Exposed`;
    case 'slow': return 'Skip enemy action';
    case 'hex': return `Apply ${power} Drawing Blanks`;
    case 'stagger': return 'Skip enemy action';
    case 'corrode': return 'Strip block, apply Weakness';
    case 'curse_of_doubt': return `Charges deal +${stats?.extras?.['pctBonus'] ?? 15}%`;
    case 'mark_of_ignorance': return `Charges deal +${stats?.extras?.['flatBonus'] ?? 2} bonus`;
    case 'corroding_touch': return 'Apply Weakness for free';
    case 'entropy': return `${stats?.extras?.['burn'] ?? 2} Brain Burn + ${stats?.extras?.['poison'] ?? 1} Drawing Blanks`;

    // ── Utility ──────────────────────────────────────────────────────────────
    case 'scout': return `Draw ${stats?.drawCount ?? power ?? 1}`;
    case 'recycle': return 'Draw 3';
    case 'foresight': {
      // 10.2: use drawCount from mastery stat table, not qpValue (which is 0)
      const foresightStatsShort = getMasteryStats(mechanic.id, card.masteryLevel ?? 0);
      const foresightDrawShort = foresightStatsShort?.drawCount ?? 1;
      return `Draw ${foresightDrawShort}`;
    }
    case 'transmute': return 'Transform this card';
    case 'sift': return `Look at top ${stats?.extras?.['scryCount'] ?? 2}`;
    case 'scavenge': return 'Recover a discarded card';
    case 'swap': return `Discard 1, draw ${stats?.drawCount ?? 1}`;
    case 'archive': return `Retain ${stats?.extras?.['retain'] ?? 1} in hand`;
    case 'reflex': return `Draw ${stats?.drawCount ?? 1}, block on discard`;
    case 'recollect': return `Return ${stats?.extras?.['returns'] ?? 1} forgotten`;
    case 'synapse': return `Draw ${stats?.drawCount ?? 1}, extend chain`;
    case 'siphon_knowledge': return `Draw ${stats?.drawCount ?? 1}, preview answers`;
    case 'tutor': return 'Search and add a card';
    case 'conjure': return `Summon ${stats?.extras?.['picks'] ?? 1} cards`;

    // ── Wild ─────────────────────────────────────────────────────────────────
    case 'mirror': return 'Copy last card';
    case 'adapt': return 'Auto-pick best action';
    case 'overclock': return 'Double next effect';
    case 'phase_shift': return `Deal ${power} or gain block`;
    case 'chameleon': return 'Copy last card effect';
    case 'dark_knowledge': return `${stats?.extras?.['dmgPerCurse'] ?? 2} per cursed card`;
    case 'chain_anchor': return `Draw ${stats?.drawCount ?? 1}, boost chain`;
    case 'unstable_flux': return 'Random effect or choose';
    case 'sacrifice': return 'Lose 5 HP, draw 2, gain AP';
    case 'catalyst': return 'Double all Drawing Blanks';
    case 'mimic': return 'Replay a discarded card';

    default: {
      // Type-based sensible defaults — better than just mechanic.name
      const fallbackPower = Math.round(card.baseEffectValue);
      switch (card.cardType) {
        case 'attack': return `Deal ${fallbackPower} damage`;
        case 'shield': return `Gain ${fallbackPower} block`;
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
  /** Knowledge Chain multiplier (1.0 = no chain, default). Applied at base for attack/shield. */
  chainMultiplier?: number;
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
  const _partsBasePower = powerOverride ?? (_partsStatsForPower?.qpValue != null ? _partsStatsForPower.qpValue : Math.round(card.baseEffectValue));
  // AR-CHAIN-REWORK: apply chain multiplier to power for attack/shield display.
  const _partsChainMult = gameState?.chainMultiplier ?? 1.0;
  const power = (card.cardType === 'attack' || card.cardType === 'shield')
    ? Math.round(_partsBasePower * _partsChainMult)
    : _partsBasePower;

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
      const hits = stats?.hitCount ?? secondary ?? 3;
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
      const sec = stats?.secondaryValue ?? 5;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nGain '), num(sec), txt(' '), kw('Block', 'block')];
    }
    case 'bash': {
      const bashTurns = (stats?.tags ?? []).includes('bash_vuln2t') ? 2 : 1;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), kw('Exposed', 'vulnerable'), txt(` ${bashTurns} turn(s)`)];
    }
    case 'sap':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nApply '), kw('Drawing Blanks', 'weakness')];
    case 'rupture': {
      const bleed = stats?.secondaryValue ?? 2;
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\n'), num(bleed), txt(' '), kw('Lingering Doubt', 'bleed')];
    }
    case 'lacerate': {
      const bleed = stats?.secondaryValue ?? 3;
      return [txt('Deal '), num(power), txt(' damage\n'), num(bleed), txt(' '), kw('Lingering Doubt', 'bleed')];
    }
    case 'kindle': {
      const burn = stats?.secondaryValue ?? 4;
      return [txt('Deal '), num(power), txt(' damage\n'), num(burn), txt(' '), kw('Brain Burn', 'burn'), txt(' ▶trigger')];
    }
    case 'overcharge':
      return [txt('Deal '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nCC: ×charges')];
    case 'riposte': {
      const sec = stats?.secondaryValue ?? 4;
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
      return [txt('Spend all AP\n'), num(dpa), txt(' damage per AP')];
    }

    // ── Shields ───────────────────────────────────────────────────────────────
    case 'block':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'thorns':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nReflect '), ...numWithSecondaryMastery(stats?.secondaryValue ?? secondary ?? 3, mechanic.id, masteryLevel)];
    case 'fortify':
      // 2026-04-11 audit fix: resolver scales current block, not flat block.
      // Persistence only happens at L5 (fortify_carry tag).
      return [txt('Gain half your\ncurrent '), kw('Block', 'block')];
    case 'parry': {
      const parryDrawCount = stats?.secondaryValue ?? 1;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDraw '), num(parryDrawCount), txt(' on hit')];
    }
    case 'brace':
      return [kw('Block', 'block'), txt('\n= enemy attack')];
    case 'overheal':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDoubled if wounded')];
    case 'emergency':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDoubled if wounded')];
    case 'reinforce':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'shrug_it_off': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nDraw '), num(draws)];
    }
    case 'guard':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
    case 'absorb':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCharge: draw a card')];
    case 'reactive_shield': {
      const thorns = stats?.secondaryValue ?? 2;
      return [txt('Gain '), num(power), txt(' '), kw('Block', 'block'), txt('\n'), num(thorns), txt(' '), kw('Thorns', 'thorns'), txt(' 1 turn')];
    }
    case 'aegis_pulse':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCharge: +2 chain block')];
    case 'burnout_shield':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCharge: consumed')];
    case 'bulwark':
      return [txt('Gain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCharge: consumed')];
    case 'conversion':
      return [txt('Deal your '), kw('Block', 'block'), txt(' as damage\nGain '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block')];
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
    case 'double_strike':
      return [txt('Next attack\nhits twice')];
    case 'ignite': {
      const burn = stats?.extras?.['burnStacks'] ?? 2;
      return [txt('Next attack\n+'), num(burn), txt(' '), kw('Brain Burn', 'burn')];
    }
    case 'inscription_fury':
      return [txt('All attacks +'), ...numWithMastery(power, mechanic.id, masteryLevel), txt('\nrest of combat')];
    case 'inscription_iron':
      return [txt('+'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt(' per turn\nRest of combat')];
    case 'inscription_wisdom': {
      const dpc = stats?.extras?.['drawPerCC'] ?? 1;
      return [txt('Draw +'), num(dpc), txt(' on charge\nRest of combat')];
    }
    case 'warcry': {
      const str = stats?.extras?.['str'] ?? 1;
      return [txt('+'), num(str), txt(' '), kw('Clarity', 'strength'), txt('\nCharge: permanent')];
    }
    case 'battle_trance': {
      const draws = stats?.drawCount ?? 2;
      return [txt('Draw '), num(draws), txt('\nEnds your turn')];
    }
    case 'frenzy': {
      const free = stats?.extras?.['freeCards'] ?? 1;
      return [txt('Next '), num(free), txt(' card(s)\ncost 0 AP')];
    }
    case 'mastery_surge': {
      const tgts = stats?.extras?.['targets'] ?? 1;
      return [txt('+1 '), kw('Mastery', 'mastery'), txt(' to\n'), num(tgts), txt(' card(s)')];
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
    case 'weaken': {
      const weakTurns = stats?.extras?.['turns'] ?? 1;
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Drawing Blanks', 'weakness'), txt('\n'), num(weakTurns), txt(' turn(s)')];
    }
    case 'expose': {
      const expTurns = stats?.extras?.['turns'] ?? 1;
      return [txt('Apply\n'), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Exposed', 'vulnerable'), txt('\n'), num(expTurns), txt(' turn(s)')];
    }
    case 'slow':
      return [txt("Skip enemy's\nnext action")];
    case 'hex': {
      const turns = stats?.extras?.['turns'] ?? secondary ?? 3;
      return [txt('Apply '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Doubt', 'poison'), txt('\n'), num(turns), txt(' turns')];
    }
    case 'stagger':
      return [txt("Skip enemy's\nnext action")];
    case 'corrode':
      return [txt('Strip '), kw('Block', 'block'), txt('\nApply '), kw('Drawing Blanks', 'weakness')];
    case 'curse_of_doubt': {
      const pct = stats?.extras?.['pctBonus'] ?? 15;
      const turns = stats?.extras?.['turns'] ?? 1;
      return [txt('+'), num(pct), txt('% charge damage\n'), num(turns), txt(' turns. CC: doubled')];
    }
    case 'mark_of_ignorance': {
      const flat = stats?.extras?.['flatBonus'] ?? 2;
      const turns = stats?.extras?.['turns'] ?? 1;
      return [txt('+'), num(flat), txt(' per charge\n'), num(turns), txt(' turns')];
    }
    case 'corroding_touch': {
      const ws = stats?.extras?.['weakStacks'] ?? 1;
      const wt = stats?.extras?.['weakTurns'] ?? 1;
      return [txt('Apply '), num(ws), txt(' '), kw('Drawing Blanks', 'weakness'), txt('\n'), num(wt), txt(' turns\nFree. CC: +'), kw('Exposed', 'vulnerable')];
    }
    case 'entropy': {
      const burn = stats?.extras?.['burn'] ?? 2;
      const pois = stats?.extras?.['poison'] ?? 1;
      const pt = stats?.extras?.['poisonTurns'] ?? 2;
      return [num(burn), txt(' '), kw('Brain Burn', 'burn'), txt(' + '), num(pois), txt(' '), kw('Doubt', 'poison'), txt('\n'), num(pt), txt(' turn(s)')];
    }

    // ── Utility ───────────────────────────────────────────────────────────────
    case 'scout': {
      const drawCount = stats?.drawCount ?? Math.max(1, Math.floor((secondary as number | undefined) ?? power ?? 2));
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
      return [txt('Transform this card\nCharge: choose from 3')];
    case 'cleanse':
      return [txt('Remove debuffs\nDraw 1')];
    case 'immunity': {
      const immAbsorb = stats?.extras?.['absorb'] ?? 4;
      return [txt('Absorb next hit\nup to '), num(immAbsorb)];
    }
    case 'sift': {
      const sc = stats?.extras?.['scryCount'] ?? 2;
      return [txt('Look at top '), num(sc), txt('\nDiscard any')];
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
      return [txt('Draw '), num(draws), txt('\nCharge: chain link')];
    }
    case 'siphon_knowledge': {
      const draws = stats?.drawCount ?? 1;
      const sec = stats?.extras?.['previewSec'] ?? 2;
      return [txt('Draw '), num(draws), txt('\nPreview '), num(sec), txt(' seconds')];
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
      return [txt('Auto-picks best:\nAttack, Block, or Cleanse')];
    case 'overclock':
      return [txt('Next card ×2')];
    case 'phase_shift':
      return [txt('Choose: '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' damage\nor '), ...numWithMastery(power, mechanic.id, masteryLevel), txt(' '), kw('Block', 'block'), txt('\nCC: both')];
    case 'chameleon':
      return [txt('Copy last card')];
    case 'dark_knowledge': {
      const dpc = stats?.extras?.['dmgPerCurse'] ?? 2;
      return [txt('Deal '), num(dpc), txt(' per\ncursed card')];
    }
    case 'chain_anchor': {
      const draws = stats?.drawCount ?? 1;
      return [txt('Draw '), num(draws), txt('\nCharge: boost chain')];
    }
    case 'unstable_flux':
      return [txt('Random effect\nCC: choose effect')];
    case 'sacrifice':
      return [txt('−'), num(5), txt(' HP\nDraw '), num(2), txt(' +'), num(1), txt(' AP')];
    case 'catalyst':
      return [txt('Double '), kw('Doubt', 'poison'), txt('\nCharge: also '), kw('Brain Burn', 'burn')];
    case 'mimic': {
      const qpM = stats?.extras?.['qpMult'] ?? 60;
      return [txt('Replay a discarded\ncard at '), num(qpM), txt('%')];
    }
    case 'aftershock': {
      const qpM = stats?.extras?.['qpMult'] ?? 40;
      return [txt('Repeat last card\nat '), num(qpM), txt('% power')];
    }
    case 'knowledge_bomb': {
      const ppc = stats?.extras?.['perCorrect'] ?? 3;
      return [txt('Deal '), num(ppc), txt(' per\ncorrect charge')];
    }

    // ── AR-264: Quiz-integrated cards ──────────────────────────────────────────
    case 'recall':
      return [txt('Deal '), num(power), txt(' damage\nBonus on review')];
    case 'precision_strike':
      return [txt('Deal '), num(power), txt(' damage\nPer answer option')];
    case 'knowledge_ward':
      return [txt('Gain '), kw('Block', 'block'), txt(' ×\ncorrect charges')];
    case 'smite': {
      // 2026-04-11 audit fix: qpValue from stat table (L0=7, not old seed 10).
      const smPartsPower = _partsStatsForPower?.qpValue ?? 7;
      return [txt('Deal '), num(smPartsPower), txt(' damage\nScales with aura')];
    }
    case 'feedback_loop':
      // 2026-04-11 audit fix: Pass 8 reduced CC from 40 to 28 (max 40 in Flow State).
      return [txt('Deal '), num(power), txt(' damage\n'), kw('Flow State', 'flow_state'), txt(' bonus')];

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
