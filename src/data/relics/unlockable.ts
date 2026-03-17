import type { RelicDefinition } from './types';

/**
 * 17 Mastery Coin relics — purchased in the Relic Archive.
 * All Rares (15) + Legendaries (2) = 17 total.
 *
 * Also includes toxic_bloom (Phase 2 excluded) for future use.
 *
 * V2 catalogue — organized around 7 build archetypes.
 */
export const UNLOCKABLE_RELICS: RelicDefinition[] = [

  // === CHAIN (2 unlockable) ===

  {
    id: 'chain_reactor',
    name: 'Chain Reactor',
    description: 'Knowledge Chains of 3+ deal 4 splash damage per chain link.',
    flavorText: 'Recovered from the wreckage of an archivist\'s experimental resonance array. When knowledge chains exceed critical length, the energy discharge is... considerable.',
    visualDescription: 'A glowing reactor coil with chain-link symbols orbiting it, erupting with energy sparks on each activation. Nuclear knowledge aesthetic. 32x32 pixel art.',
    rarity: 'rare',
    category: 'chain',
    trigger: 'on_chain_complete',
    effects: [
      { effectId: 'chain_splash_damage', description: '4 splash damage per chain link (chains 3+)', value: 4, secondaryValue: 3 },
    ],
    icon: '⚛️',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'echo_chamber',
    name: 'Echo Chamber',
    description: 'Completing a 3+ chain replays the first card in the chain at 50% power (no quiz, no AP cost).',
    flavorText: 'A resonance chamber where echoes of played cards linger. Link enough facts together and the chamber reaches harmonic saturation — the opening card echoes again at half strength.',
    visualDescription: 'A round purple resonance chamber with ghostly card silhouettes orbiting the interior walls. Echo ripples bounce between the curved surfaces. 32x32 pixel art.',
    rarity: 'rare',
    category: 'chain',
    trigger: 'on_chain_complete',
    effects: [
      { effectId: 'chain_echo_replay', description: 'First chain card replays at 50% power on 3+ chain', value: 50, secondaryValue: 3 },
    ],
    icon: '🔊',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === SPEED (2 unlockable) ===

  {
    id: 'quicksilver_quill',
    name: 'Quicksilver Quill',
    description: 'Charged quizzes answered in under 2 seconds get an additional 1.5× multiplier.',
    flavorText: 'Dipped in liquid lightning by the Archivist\'s fastest scribe. Answer before the ink dries and the quill doubles down on your certainty.',
    visualDescription: 'A sleek silver quill with mercury-bright ink flowing from its nib. Speed lines blur its trailing edge. The tip glows with potential energy. 32x32 pixel art.',
    rarity: 'rare',
    category: 'speed',
    trigger: 'on_charge_correct',
    effects: [
      { effectId: 'fast_charge_multiplier', description: 'Charge correct <2s: ×1.5 extra multiplier', value: 1.5, secondaryValue: 2000 },
    ],
    icon: '🖊️',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'On Knowledge Surge turns, quiz timer is halved but Charge multiplier increases to 4.0×.',
    flavorText: 'A cracked hourglass from the Temporal Archivist\'s workshop. When surge energy peaks, it compresses time itself — the window is small, but the power is enormous.',
    visualDescription: 'An ornate brass hourglass with purple sand falling at double speed, surrounded by compressed clock hands. Time distortion warps the air around it. 32x32 pixel art.',
    rarity: 'rare',
    category: 'speed',
    trigger: 'on_surge_start',
    effects: [
      { effectId: 'surge_timer_halved', description: 'Surge turns: quiz timer halved', value: 0.5 },
      { effectId: 'surge_charge_multiplier_override', description: 'Surge turns: Charge multiplier 4.0×', value: 4.0 },
    ],
    icon: '⏳',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === GLASS CANNON (1 unlockable) ===

  {
    id: 'crit_lens',
    name: 'Crit Lens',
    description: 'Charged correct answers have 25% chance to DOUBLE the final damage (after all multipliers).',
    flavorText: 'Ground from the focusing lens of a critical strike golem. It doesn\'t just amplify power — it finds the exact angle of maximum force. One in four answers hits the sweet spot.',
    visualDescription: 'A circular magnifying lens with a bullseye reticle etched in gold, a bright flash of light frozen at the focal point. Precision targeting aesthetic. 32x32 pixel art.',
    rarity: 'rare',
    category: 'glass_cannon',
    trigger: 'on_charge_correct',
    effects: [
      { effectId: 'crit_chance_on_charge', description: '25% crit chance on Charged correct (×2 final damage)', value: 25, secondaryValue: 2 },
    ],
    icon: '🎯',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === DEFENSE (2 unlockable) ===

  {
    id: 'thorn_crown',
    name: 'Thorn Crown',
    description: 'When you have 15+ block at start of turn, reflect 5 damage per enemy attack received.',
    flavorText: 'Woven from ironbark thorns by the druids who once tended gardens in the deep. When the dungeon corrupted their grove, the thorns learned to bite back — hardest when the wearer stands firm.',
    visualDescription: 'A crown of dark green ironbark thorns with drops of crimson at each tip. Glows with defensive energy when block is high. Dangerous beauty. 32x32 pixel art.',
    rarity: 'rare',
    category: 'defensive',
    trigger: 'on_damage_taken',
    effects: [
      { effectId: 'high_block_thorns', description: 'Reflect 5 damage when attacked at 15+ block', value: 5, secondaryValue: 15 },
    ],
    icon: '👑',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'bastions_will',
    name: "Bastion's Will",
    description: 'Charged shield cards gain an additional +50% block value.',
    flavorText: 'The iron will of Bastion, last defender of the First Archive. He answered every challenge — and his shields never broke. The relic carries that absolute refusal to yield.',
    visualDescription: 'A shield-shaped iron relic with a glowing fist embossed on the face, radiating steadfast blue energy. Block values float visibly around it. 32x32 pixel art.',
    rarity: 'rare',
    category: 'defensive',
    trigger: 'on_charge_correct',
    effects: [
      { effectId: 'charged_shield_bonus', description: '+50% block when Charging a shield card', value: 50 },
    ],
    icon: '🛡️',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === POISON (1 unlockable) ===

  {
    id: 'festering_wound',
    name: 'Festering Wound',
    description: 'When enemy has 5+ poison stacks, all attacks deal +30% damage.',
    flavorText: 'A cursed bandage from the dungeon\'s plague ward. It doesn\'t heal — it catalogues. When poison reaches critical mass, this wound knows the moment to strike.',
    visualDescription: 'A dark green bandage wrapped around a glowing wound icon, toxic energy seeping from the edges. Poison stacks visualized as bubbles around it. 32x32 pixel art.',
    rarity: 'rare',
    category: 'poison',
    trigger: 'permanent',
    effects: [
      { effectId: 'high_poison_attack_bonus', description: '+30% attack when enemy has 5+ poison', value: 30, secondaryValue: 5 },
    ],
    icon: '☠️',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === BURST (1 unlockable) ===

  {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Unused AP at end of turn stores as Charge (max 3). Next turn, gain stored Charge as bonus AP.',
    flavorText: 'A superconducting crystal that hoards unspent energy. Restrain yourself for a turn and it hands it all back — plus interest.',
    visualDescription: 'A cylindrical capacitor crystal criss-crossed with gold wiring, glowing brighter as energy accumulates. Stored AP visible as stacked sparks inside. 32x32 pixel art.',
    rarity: 'rare',
    category: 'burst',
    trigger: 'on_turn_end',
    effects: [
      // TODO(AR-59.11): Requires per-turn capacitorStoredAP state tracking.
      // on_turn_end: store min(apRemaining, 3) into capacitorStoredAP
      // on_turn_start: release capacitorStoredAP as bonus AP, then reset to 0
      { effectId: 'unused_ap_store', description: 'Store unused AP (max 3)', value: 3 },
      { effectId: 'stored_ap_release', description: 'Release stored AP next turn', value: 1 },
    ],
    icon: '🔋',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'double_down',
    name: 'Double Down',
    description: 'Once per encounter: Charge same card twice. Both correct: 5× power. One correct: 1.5×. Both wrong: 0.3×.',
    flavorText: 'The gambler\'s ultimate bet — double your knowledge or double your shame. The stakes have never been higher.',
    visualDescription: 'Two identical playing cards overlapping at a diagonal, one glowing gold (success) and one shadowed grey (failure). Risk vs. reward energy. 32x32 pixel art.',
    rarity: 'rare',
    category: 'burst',
    trigger: 'on_card_play',
    effects: [
      // TODO(AR-59.11): Requires double-quiz UI flow (two consecutive quiz prompts for same card).
      // Three outcome states: both_correct (5×), one_correct (1.5×), both_wrong (0.3×).
      // Gated by doubleDown_usedThisEncounter run flag.
      { effectId: 'double_charge_activate', description: 'Once/encounter: double Charge a card (5×/1.5×/0.3×)', value: 1 },
    ],
    icon: '🃏',
    unlockCost: 60,
    isStarter: false,
    startsUnlocked: false,
  },

  // === KNOWLEDGE (2 unlockable) ===

  {
    id: 'scholars_crown',
    name: "Scholar's Crown",
    description: 'Tier 2+ facts that are Charged get +30% power. Tier 3 auto-Charged cards get +50%.',
    flavorText: 'The laurel of a master archivist who climbed every floor and remembered every fact. Knowledge mastered is knowledge weaponized.',
    visualDescription: 'A golden scholar\'s crown with scrolls worked into the band and glowing runes across each point. Tier symbols orbit the crown. 32x32 pixel art.',
    rarity: 'rare',
    category: 'knowledge',
    trigger: 'on_charge_correct',
    effects: [
      { effectId: 'tier2_charge_bonus', description: '+30% power for Tier 2+ Charged facts', value: 30 },
      { effectId: 'tier3_charge_bonus', description: '+50% power for Tier 3 auto-Charged facts', value: 50 },
    ],
    icon: '👑',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'domain_mastery_sigil',
    name: 'Domain Mastery Sigil',
    description: 'If deck has 6+ facts from same domain, all same-domain cards get +20% base damage (even Quick Play).',
    flavorText: 'A specialist\'s sigil that awakens when the bearer demonstrates deep expertise. Concentrate your knowledge and every card in that domain strikes with mastery\'s edge.',
    visualDescription: 'A golden pentagon seal with a different domain symbol on each face, the dominant face blazing with white-hot energy. Mastery crown hovering above. 32x32 pixel art.',
    rarity: 'rare',
    category: 'knowledge',
    trigger: 'permanent',
    effects: [
      { effectId: 'domain_concentration_bonus', description: '+20% base damage for concentrated domain (6+ facts)', value: 20, secondaryValue: 6 },
    ],
    icon: '🏆',
    unlockCost: 55,
    isStarter: false,
    startsUnlocked: false,
  },

  // === SPECIAL / CURSED ===

  {
    id: 'phoenix_feather',
    name: 'Phoenix Feather',
    description: 'Once per run: on death, resurrect at 30% HP. All cards auto-Charge free for 2 turns.',
    flavorText: 'From the last phoenix that nested in the volcanic vents beneath Floor 15. It carries one final resurrection — a single defiant rebirth from the ashes of defeat. Once per run.',
    visualDescription: 'A magnificent orange-gold feather with flames dancing along its edges, radiating warmth and brilliant light. Sacred rebirth energy. 32x32 pixel art.',
    rarity: 'rare',
    category: 'sustain',
    trigger: 'on_lethal',
    effects: [
      // TODO(AR-59.11): once/run semantics — requires phoenixFeather_usedThisRun run flag.
      { effectId: 'lethal_save_run', description: 'Resurrect at 30% HP (once/run)', value: 30 },
      { effectId: 'phoenix_autocharge_turns', description: 'Auto-Charge all cards free for 2 turns on resurrect', value: 2 },
    ],
    icon: '🪶',
    unlockCost: 60,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'scholars_gambit',
    name: "Scholar's Gambit",
    description: '5 relic slots → 6. Wrong Charged answers deal 3 damage to you.',
    flavorText: 'Knowledge is power. Power has a price. The Gambit demands both.',
    visualDescription: 'A cracked obsidian tome bound with a golden chain, forbidden glyphs glowing on the cover. Wisps of dark energy seep from the spine. 32x32 pixel art, dark dungeon palette.',
    rarity: 'rare',
    category: 'cursed',
    trigger: 'permanent',
    effects: [
      { effectId: 'relic_slot_bonus', description: '+1 relic slot (max becomes 6)', value: 1 },
      { effectId: 'wrong_charge_self_damage', description: 'Wrong Charged answers deal 3 self-damage', value: 3 },
    ],
    icon: '📖',
    unlockCost: 60,
    isStarter: false,
    startsUnlocked: false,
    curseDescription: 'Wrong Charged answers deal 3 damage to you.',
  },

  // === LEGENDARY (2) ===

  {
    id: 'prismatic_shard',
    name: 'Prismatic Shard',
    description: 'All chain multipliers +0.5×. 5-chains grant +1 AP.',
    flavorText: 'Shattered from the heart of a perfect Knowledge Chain that never broke. It remembers every link — and adds its own.',
    visualDescription: 'A prismatic crystal shard refracting chain-link patterns across all its faces, each face showing a different chain length. Legendary rainbow aura. 32x32 pixel art.',
    rarity: 'legendary',
    category: 'chain',
    trigger: 'permanent',
    effects: [
      { effectId: 'chain_multiplier_bonus', description: 'All chain multipliers +0.5×', value: 0.5 },
      { effectId: 'five_chain_ap_bonus', description: '+1 AP on completing 5-chain', value: 1 },
    ],
    icon: '🌈',
    unlockCost: 75,
    isStarter: false,
    startsUnlocked: false,
  },

  {
    id: 'mirror_of_knowledge',
    name: 'Mirror of Knowledge',
    description: 'Once per encounter: after correct Charge, replay card at 1.5× (no quiz, no AP).',
    flavorText: 'A mirror that reflects not image, but action. Answer correctly and it shows you what you just did — then does it again, for free, with interest.',
    visualDescription: 'An ornate oval mirror with gold frame, showing a ghostly reflection of a card at slightly enlarged scale. Replay ripples emanate from the surface. 32x32 pixel art.',
    rarity: 'legendary',
    category: 'knowledge',
    trigger: 'on_charge_correct',
    effects: [
      // TODO(AR-59.11): Requires mirrorOfKnowledge_usedThisEncounter run flag.
      // Player activates: replay last Charged card at 1.5× (no quiz, no AP cost). Once per encounter.
      { effectId: 'charge_correct_free_replay', description: 'Replay charged card at 1.5× after correct Charge (once/encounter)', value: 150 },
    ],
    icon: '🪞',
    unlockCost: 75,
    isStarter: false,
    startsUnlocked: false,
  },

  // === PHASE 2 ONLY — excluded from drop pool at launch ===

  {
    id: 'toxic_bloom',
    name: 'Toxic Bloom',
    description: 'When enemy dies from poison, spread 3 poison to all other enemies.',
    flavorText: 'A seed pod from the dungeon\'s deep fungal network. Death feeds life — in the Bloom\'s case, it feeds more death.',
    visualDescription: 'A spiky dark green seed pod with toxic spores erupting from every surface, spreading poison clouds. Infectious bloom aesthetic. 32x32 pixel art.',
    rarity: 'uncommon',
    category: 'poison',
    trigger: 'permanent',
    effects: [
      { effectId: 'poison_death_spread', description: 'On poison kill: spread 3 poison to all other enemies', value: 3 },
    ],
    icon: '🌺',
    unlockCost: 40,
    isStarter: false,
    startsUnlocked: false,
    excludeFromPhase1: true, // Requires multi-enemy encounter system — Phase 2 only
  },

  // === ECHO RELICS ===

  {
    id: 'echo_lens',
    name: 'Echo Lens',
    description: 'Echo cards deal full power even on wrong Charge answers (1.0× regardless of quiz result).',
    flavorText: 'Ground from crystals that grow in the Echo Chamber on Floor 11. Normal echoes fade. Through this lens, ghost cards remember their full strength and strike with undiminished force.',
    visualDescription: 'A round purple crystal lens with concentric ripple rings inside, ghostly card silhouettes visible through it at full opacity. Resonance waves. 32x32 pixel art.',
    rarity: 'uncommon',
    category: 'tactical',
    trigger: 'on_echo_play',
    effects: [{ effectId: 'echo_full_power', description: 'Echo at 1.0x regardless of quiz result', value: 1 }],
    icon: '🔮',
    unlockCost: 35,
    isStarter: false,
  },
];
