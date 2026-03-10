/** All tunable game balance numbers. Change here, affects everything. */
export const BALANCE = {
  // === OXYGEN ===
  STARTING_OXYGEN_TANKS: 3,           // Player starts with 3 tanks per day
  OXYGEN_PER_TANK: 100,               // Each tank = 100 oxygen points
  OXYGEN_COST_MINE_DIRT: 1,
  OXYGEN_COST_MINE_SOFT_ROCK: 2,
  OXYGEN_COST_MINE_STONE: 3,
  OXYGEN_COST_MINE_HARD_ROCK: 5,
  OXYGEN_COST_MOVE: 1,                // Moving through empty space
  OXYGEN_COST_QUIZ_ATTEMPT: 5,        // Each quiz gate attempt
  OXYGEN_CACHE_RESTORE: 30,           // Oxygen from mining an oxygen cache
  OXYGEN_CACHE_QUIZ_CHANCE: 0.4,    // 40% chance oxygen cache triggers a quiz
  OXYGEN_LAYER_BONUS: 15,             // Oxygen recovered on layer descent
  OXYGEN_REGEN_MS: 5_400_000,            // 90 minutes per tank regen (DD-V2-138)
  OXYGEN_MAX_BANK_FREE: 3,               // Max tanks banked for free players

  // === MINE GRID ===
  MINE_WIDTH: 20,                     // Blocks wide per layer (default/L1-5; actual size via getLayerGridSize)
  MINE_LAYER_HEIGHT: 40,              // Blocks tall per layer (legacy; actual size via getLayerGridSize)
  MAX_LAYERS: 20,                     // Total layers per dive
  DESCENT_SHAFT_COUNT: 1,             // One shaft per layer (except last)
  LAYER_OXYGEN_BONUS: 15,             // O2 restored on layer transition
  LAYER_HARDNESS_SCALE: 1.3,          // Each layer is 30% harder
  VIEWPORT_TILES_X: 11,              // Visible tiles horizontally (odd = centered)
  VIEWPORT_TILES_Y: 15,              // Visible tiles vertically
  TILE_SIZE: 32,                      // Pixels per tile

  // === BLOCK HARDNESS ===
  HARDNESS_DIRT: 1,
  HARDNESS_SOFT_ROCK: 2,
  HARDNESS_STONE: 3,
  HARDNESS_HARD_ROCK: 5,
  HARDNESS_MINERAL_NODE: 3,
  HARDNESS_ARTIFACT_NODE: 4,
  HARDNESS_QUIZ_GATE: 1,             // 1 tap to interact, quiz handles the rest

  // === NODE DENSITY (per layer, approximate) ===
  DENSITY_MINERAL_NODES: 18,
  DENSITY_ARTIFACT_NODES: 6,
  DENSITY_OXYGEN_CACHES: 4,
  DENSITY_QUIZ_GATES: 0,
  DENSITY_EMPTY_POCKETS: 5,          // Small pre-cleared areas
  DENSITY_UNBREAKABLE_RATIO: 0.03,   // 5% of blocks are unbreakable walls

  // === INVENTORY ===
  STARTING_INVENTORY_SLOTS: 6,
  DUST_STACK_SIZE: 50,
  SHARD_STACK_SIZE: 20,
  CRYSTAL_STACK_SIZE: 5,
  GEODE_STACK_SIZE: 3,
  ESSENCE_STACK_SIZE: 1,

  // === ARTIFACT DROP RATES ===
  ARTIFACT_RARITY_WEIGHTS: {
    common: 60,
    uncommon: 25,
    rare: 10,
    epic: 4,
    legendary: 0.9,
    mythic: 0.1,
  },

  // === MINERAL DROP AMOUNTS ===
  MINERAL_DROP_MIN: 5,               // Min dust from a mineral node
  MINERAL_DROP_MAX: 15,              // Max dust from a mineral node

  // === DEPTH-BASED MINERAL TIERS ===
  MINERAL_SHARD_DEPTH_THRESHOLD: 0.4,    // Shards can appear after 40% depth
  MINERAL_CRYSTAL_DEPTH_THRESHOLD: 0.7,  // Crystals can appear after 70% depth
  MINERAL_GEODE_DEPTH_THRESHOLD: 0.85,   // Geodes appear at 85%+ depth
  MINERAL_ESSENCE_DEPTH_THRESHOLD: 0.95, // Primordial Essence at 95%+ depth (very deep)
  MINERAL_SHARD_CHANCE: 0.3,             // 30% chance for shard (when eligible)
  MINERAL_CRYSTAL_CHANCE: 0.15,          // 15% chance for crystal (when eligible)
  MINERAL_GEODE_CHANCE: 0.10,            // 10% chance for geode (when eligible)
  MINERAL_ESSENCE_CHANCE: 0.05,          // 5% chance for essence (when eligible)
  MINERAL_SHARD_DROP_MIN: 2,
  MINERAL_SHARD_DROP_MAX: 6,
  MINERAL_CRYSTAL_DROP_MIN: 1,
  MINERAL_CRYSTAL_DROP_MAX: 3,
  MINERAL_GEODE_DROP_MIN: 1,
  MINERAL_GEODE_DROP_MAX: 2,
  MINERAL_ESSENCE_DROP_MIN: 1,
  MINERAL_ESSENCE_DROP_MAX: 1,

  // === ARTIFACT RARITY BOOST ===
  ARTIFACT_QUIZ_QUESTIONS: 3,          // Total questions offered per artifact appraisal
  ARTIFACT_BOOST_CHANCE: 0.6,          // 60% chance to boost rarity per correct answer

  // === EXIT ROOM ===
  ARTIFACT_QUIZ_CHANCE: 0.35,          // 35% chance artifact triggers quiz
  EXIT_ROOM_WIDTH: 7,                  // Interior width of exit room
  EXIT_ROOM_HEIGHT: 5,                 // Interior height of exit room
  EXIT_GATE_QUESTIONS: 3,               // Number of correct answers needed to pass exit gate

  // === LAYER ENTRANCE ===
  LAYER_ENTRANCE_QUESTIONS: 3,       // Questions to answer before descending
  LAYER_ENTRANCE_WRONG_O2_COST: 7,   // O2 penalty for wrong answer (tuned down from 10, playtest 002)

  // === QUIZ ===
  QUIZ_DISTRACTORS_SHOWN: 3,         // 3 wrong + 1 correct = 4 choices
  QUIZ_GATE_MAX_FAILURES: 2,
  QUIZ_GATE_FAILURE_OXYGEN_COST: 10, // Extra oxygen penalty per wrong answer

  // === RANDOM MINING QUIZ ===
  RANDOM_QUIZ_CHANCE: 0.04,          // 4% chance per block mined
  RANDOM_QUIZ_REWARD_DUST: 8,        // Dust reward for correct answer
  RANDOM_QUIZ_WRONG_O2_COST: 5,      // Small O2 penalty for wrong answer
  RANDOM_QUIZ_MIN_BLOCKS: 5,         // Don't trigger until this many blocks mined

  // === CONSISTENCY PENALTY ===
  CONSISTENCY_PENALTY_O2: 6,      // Extra O2 cost for inconsistent answer (tuned down from 8, playtest 002)
  CONSISTENCY_PENALTY_DUST: -5,   // Lose 5 dust during dive mineral tracking (future use)
  CONSISTENCY_MIN_REPS: 1,        // Penalize facts with 1+ successful reps (graduated to review)

  // === SM-2 DEFAULTS ===
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,
  SM2_LEARNING_STEPS: [1, 10] as number[],
  SM2_RELEARNING_STEPS: [10] as number[],
  SM2_GRADUATING_INTERVAL: 1,
  SM2_EASY_INTERVAL: 4,
  SM2_LAPSE_NEW_INTERVAL_PCT: 0.70,
  SM2_LEECH_THRESHOLD: 8,

  // === VISIBILITY ===
  FOG_REVEAL_RADIUS: 1,              // Penumbra ring width around revealed open space
  SCANNER_BASE_RADIUS: 1,            // Scanner reveals special blocks at this range

  // === SCANNER TIERS ===
  SCANNER_TIERS: [
    { name: 'Basic Scanner', revealRadius: 1, showsRarity: false, showsHazards: false },
    { name: 'Enhanced Scanner', revealRadius: 2, showsRarity: false, showsHazards: true },
    { name: 'Advanced Scanner', revealRadius: 3, showsRarity: true, showsHazards: true },
    { name: 'Deep Scanner', revealRadius: 4, showsRarity: true, showsHazards: true },
  ] as const,

  // === PICKAXE TIERS ===
  PICKAXE_TIERS: [
    { name: 'Stone Pick', damage: 1, color: '#888888' },
    { name: 'Iron Pick', damage: 2, color: '#c0c0c0' },
    { name: 'Steel Pick', damage: 3, color: '#4a9eff' },
    { name: 'Diamond Pick', damage: 5, color: '#00ffcc' },
    { name: 'Plasma Cutter', damage: 8, color: '#ff44ff' },
  ] as const,

  // === UPGRADE CRATES ===
  UPGRADE_PICKAXE_BOOST: 1,          // Reduces all hardness by 1 (min 1 tap)
  UPGRADE_SCANNER_RADIUS: 2,          // Extra scanner radius
  UPGRADE_BACKPACK_SLOTS: 2,          // Extra inventory slots (legacy, kept for compatibility)
  UPGRADE_OXYGEN_EFFICIENCY: 0.5,     // Multiply oxygen costs by this
  DENSITY_UPGRADE_CRATES: 3,          // Crates per mine
  BACKPACK_MAX_TEMP_EXPANSIONS: 3,    // Max number of in-run temporary expansions
  BACKPACK_EXPANSION_SIZES: [2, 2, 4] as const, // Slots added per expansion (indexed by expansion count)

  // === BOMB ===
  BOMB_RADIUS: 1,                    // 3x3 area (1 cell in each direction)
  BOMB_OXYGEN_COST: 5,               // Small O2 cost to use bomb
  BOMB_DROP_WEIGHT: 15,              // Weight in upgrade crate roll (other upgrades are ~25 each)
  BOMB_MAX_STACK: 3,                 // Max bombs carriable

  // === EMPTY CAVERNS ===
  EMPTY_CAVERN_COUNT: 3,              // Number of natural open caverns per mine
  EMPTY_CAVERN_MIN_SIZE: 3,          // Minimum dimension (width or height) of a cavern
  EMPTY_CAVERN_MAX_SIZE: 5,          // Maximum dimension (width or height) of a cavern

  // === MICRO-STRUCTURES ===
  MICRO_STRUCTURE_COUNT: 3,           // Number of micro-structures per mine
  LIBRARY_ROOM_MIN_DEPTH: 8,         // Minimum y for library rooms
  REST_ALCOVE_MIN_DEPTH: 5,          // Minimum y for rest alcoves
  CRYSTAL_CAVERN_MIN_DEPTH: 12,      // Only appears deep in the mine
  CRYSTAL_CAVERN_MINERAL_COUNT: 4,   // Number of mineral nodes inside the cavern
  COLLAPSED_TUNNEL_MIN_DEPTH: 6,     // Collapsed tunnels appear in mid-depth areas
  COLLAPSED_TUNNEL_LENGTH: 7,        // Horizontal length of the collapsed tunnel in cells
  RUINS_MIN_DEPTH: 10,              // Ruins appear deeper than other structures

  // === HAZARDS ===
  LAVA_OXYGEN_COST: 15,              // Extra O2 cost when mining a lava block
  LAVA_MIN_DEPTH_PERCENT: 0.4,       // Lava only appears below 40% depth
  LAVA_DENSITY: 0.03,                // 3% chance per eligible cell
  GAS_POCKET_OXYGEN_DRAIN: 8,        // O2 lost when stepping on gas
  GAS_POCKET_MIN_DEPTH_PERCENT: 0.25, // Gas appears below 25% depth
  GAS_POCKET_DENSITY: 0.02,          // 2% chance per eligible cell

  // === RELICS ===
  RELIC_SHRINE_COUNT: 2,             // Shrines per mine layer
  RELIC_SHRINE_MIN_DEPTH: 6,         // Minimum row depth for placement

  // === QUOTE STONES ===
  QUOTE_STONE_COUNT: 3,              // Per mine layer
  QUOTE_STONE_MIN_DEPTH: 3,          // Minimum row depth

  // === MINE ATMOSPHERE ===
  AMBIENT_STORY_TRIGGER_CHANCE: 0.20,  // 20% chance per block mine
  WALL_TEXT_ALCOVE_CHANCE: 0.25,       // 25% of rest alcoves get a wall text
  SCANNER_PULSE_INTERVAL_MS: 4000,
  SCANNER_TIER_0_RADIUS: 0,
  SCANNER_TIER_1_RADIUS: 3,
  SCANNER_TIER_2_RADIUS: 5,
  SCANNER_TIER_3_RADIUS: 8,

  // === CAVE-IN ===
  UNSTABLE_GROUND_MIN_DEPTH_PERCENT: 0.3,
  UNSTABLE_GROUND_DENSITY: 0.015,
  CAVE_IN_RADIUS: 2,           // Blocks affected around the broken unstable block
  CAVE_IN_COLLAPSE_CHANCE: 0.4, // 40% chance each affected block collapses to rubble

  // === SEND-UP STATION ===
  SEND_UP_STATION_COUNT: 1,          // One per layer (except last)
  SEND_UP_MAX_ITEMS: 3,              // Max items per send-up

  // === MINERAL CONVERSION ===
  MINERAL_CONVERSION_RATIO: 100,     // 100 of lower tier = 1 of higher tier
  MINERAL_CONVERSION_TAX: 0.10,      // 10% tax (lose 10 extra units)

  // === ECONOMY SINKS ===
  RESCUE_BEACON_COST: { dust: 500, shard: 20 } as Record<string, number>,
  OXYGEN_REFILL_COST: { dust: 50 } as Record<string, number>,
  SCALING_CRAFT_MULTIPLIER: 1.25,    // Each craft of same recipe costs 25% more
  INSURANCE_COST_PERCENT: 0.15,      // 15% of dust holdings to insure a dive

  // === EARTHQUAKES ===
  EARTHQUAKE_CHANCE_PER_BLOCK: 0.008,    // 0.8% chance per block mined
  EARTHQUAKE_MIN_BLOCKS: 20,             // Only after 20+ blocks mined in this layer
  EARTHQUAKE_COLLAPSE_COUNT: 8,          // Number of blocks affected in collapse phase
  EARTHQUAKE_REVEAL_COUNT: 4,            // Number of hidden blocks that get revealed
  EARTHQUAKE_COOLDOWN: 15,               // Minimum blocks between earthquakes

  // === OXYGEN TANK PICKUP ===
  OXYGEN_TANK_COUNT: 1,              // Max 1 per mine (very rare)
  OXYGEN_TANK_MIN_DEPTH_PERCENT: 0.6, // Only in bottom 40% of mine
  OXYGEN_TANK_MAX_TOTAL: 8,          // Cap on total tanks a player can have

  // === DATA DISCS ===
  DATA_DISC_COUNT: 1,                    // Max 1 per mine
  DATA_DISC_MIN_DEPTH_PERCENT: 0.4,      // Bottom 60% of mine

  // === REVIEW RITUALS ===
  MORNING_REVIEW_HOUR: 7,               // 7 AM - 11 AM
  MORNING_REVIEW_END: 11,
  EVENING_REVIEW_HOUR: 19,              // 7 PM - 11 PM
  EVENING_REVIEW_END: 23,
  RITUAL_BONUS_DUST: 25,                // bonus dust for completing a ritual
  RITUAL_CARD_COUNT: 5,                 // cards per ritual session
  MORNING_REVIEW_FACT_COUNT: 5,       // Facts required to claim morning bonus
  EVENING_REVIEW_FACT_COUNT: 5,       // Facts required to claim evening bonus
  MORNING_REVIEW_O2_BONUS: 1,        // Oxygen tanks awarded for morning review
  EVENING_REVIEW_O2_BONUS: 1,        // Oxygen tanks awarded for evening review
  STRUGGLE_WRONG_THRESHOLD: 3,       // Wrong count before GAIA shows mnemonic
  ARTIFACT_BOOST_QUESTION_COUNT: 2,  // Questions in artifact boost quiz
  ARTIFACT_BOOST_RARITY_CHANCE_PER_CORRECT: 0.15, // 15% rarity upgrade chance per correct answer

  // === FOSSILS ===
  FOSSIL_NODE_COUNT: 2,                  // Per mine
  FOSSIL_NODE_MIN_DEPTH_PERCENT: 0.35,   // Only below 35% depth
  FOSSIL_HARDNESS: 4,                    // Taps to break a fossil node

  // === STREAK SYSTEM ===
  STREAK_MILESTONES: [
    { days: 3,   reward: 'oxygen_bonus',  value: 1,    name: '3-Day Explorer',    description: '+1 oxygen tank on all future dives', title: undefined },
    { days: 7,   reward: 'dust_bonus',    value: 100,  name: 'Weekly Miner',      description: '+100 bonus dust + title unlocked', title: 'Explorer' },
    { days: 14,  reward: 'crystal_bonus', value: 3,    name: 'Dedicated Scholar', description: '+3 crystals', title: undefined },
    { days: 21,  reward: 'dust_bonus',    value: 200,  name: 'Three Weeks Deep',  description: '+200 dust', title: undefined },
    { days: 30,  reward: 'geode_bonus',   value: 2,    name: 'Monthly Master',    description: '+2 geodes + title unlocked', title: 'Miner' },
    { days: 45,  reward: 'shard_bonus',   value: 10,   name: 'Forty-Five',        description: '+10 shards', title: undefined },
    { days: 60,  reward: 'essence_bonus', value: 1,    name: 'Legendary Streak',  description: '+1 primordial essence + title unlocked', title: 'Scholar' },
    { days: 75,  reward: 'dust_bonus',    value: 500,  name: 'Seventy-Five Days', description: '+500 dust', title: undefined },
    { days: 90,  reward: 'geode_bonus',   value: 5,    name: 'Quarter Year',      description: '+5 geodes + exclusive cosmetic badge', title: undefined },
    { days: 100, reward: 'title',         value: 0,    name: 'Centurion',         description: 'Exclusive "Centurion" title', title: 'Centurion' },
    { days: 120, reward: 'essence_bonus', value: 3,    name: 'Four Months',       description: '+3 essence', title: undefined },
    { days: 150, reward: 'dust_bonus',    value: 1000, name: 'Five Months',       description: '+1000 dust', title: undefined },
    { days: 180, reward: 'crystal_bonus', value: 20,   name: 'Half Year',         description: '+20 crystals + title unlocked', title: 'Researcher' },
    { days: 210, reward: 'geode_bonus',   value: 10,   name: 'Seven Months',      description: '+10 geodes', title: undefined },
    { days: 240, reward: 'essence_bonus', value: 5,    name: 'Eight Months',      description: '+5 essence', title: undefined },
    { days: 270, reward: 'dust_bonus',    value: 2000, name: 'Nine Months',       description: '+2000 dust', title: undefined },
    { days: 300, reward: 'crystal_bonus', value: 50,   name: 'Ten Months',        description: '+50 crystals', title: undefined },
    { days: 330, reward: 'essence_bonus', value: 10,   name: 'Eleven Months',     description: '+10 essence', title: undefined },
    { days: 365, reward: 'title',         value: 0,    name: 'Cartographer',      description: '"Cartographer" title + unique golden dome cosmetic', title: 'Cartographer' },
  ] as const,
  STREAK_PROTECTION_COST: { dust: 200 } as Record<string, number>,
  STREAK_FREEZE_MAX: 3,

  // === GRACE PERIOD (DD-V2-158) ===
  GRACE_PERIOD_WINDOW_DAYS: 30,
  GRACE_PERIOD_MAX_PER_WINDOW: 1,

  // === GACHA ANIMATION TIERS (Phase 17.1) ===
  GACHA_TIERS: {
    common:   { durationMs: 400,  particleCount: 0,   screenFlash: false, screenShake: false, soundKey: 'reveal_common',    bgColor: '#1a1a2e', glowColor: '#888888', labelText: 'Common Find' },
    uncommon: { durationMs: 600,  particleCount: 8,   screenFlash: false, screenShake: false, soundKey: 'reveal_uncommon',  bgColor: '#1a2e1a', glowColor: '#4ec9a0', labelText: 'Uncommon Discovery' },
    rare:     { durationMs: 900,  particleCount: 20,  screenFlash: true,  screenShake: false, soundKey: 'reveal_rare',      bgColor: '#1a1a3e', glowColor: '#4a9eff', labelText: 'Rare Artifact!' },
    epic:     { durationMs: 1400, particleCount: 40,  screenFlash: true,  screenShake: false, soundKey: 'reveal_epic',      bgColor: '#2a1a3e', glowColor: '#cc44ff', labelText: 'EPIC ARTIFACT!!' },
    legendary:{ durationMs: 2200, particleCount: 80,  screenFlash: true,  screenShake: true,  soundKey: 'reveal_legendary', bgColor: '#2a1a00', glowColor: '#ffd700', labelText: 'LEGENDARY!!!' },
    mythic:   { durationMs: 3500, particleCount: 150, screenFlash: true,  screenShake: true,  soundKey: 'reveal_mythic',    bgColor: '#1a0a2e', glowColor: '#ff44aa', labelText: 'MYTHIC' },
  } as const,

  // === MASTERY CELEBRATIONS (DD-V2-108, DD-V2-119) ===
  MASTERY_CELEBRATION_THRESHOLDS: [
    { count: 1,   tier: 'fullscreen', dustBonus: 0,    title: null,            gaiaKey: 'firstMastery' },
    { count: 5,   tier: 'mini',       dustBonus: 15,   title: null,            gaiaKey: 'mastery5' },
    { count: 10,  tier: 'banner',     dustBonus: 50,   title: null,            gaiaKey: 'mastery10' },
    { count: 25,  tier: 'medium',     dustBonus: 100,  title: 'Scholar',       gaiaKey: 'mastery25' },
    { count: 50,  tier: 'medium',     dustBonus: 200,  title: 'Researcher',    gaiaKey: 'mastery50' },
    { count: 100, tier: 'major',      dustBonus: 500,  title: 'Archivist',     gaiaKey: 'mastery100' },
    { count: 250, tier: 'major',      dustBonus: 1000, title: 'Encyclopedist', gaiaKey: 'mastery250' },
    { count: 500, tier: 'fullscreen', dustBonus: 2500, title: 'Omniscient',    gaiaKey: 'mastery500' },
  ] as const,

  // === NEAR-MISS MESSAGES (Phase 17.1) ===
  NEAR_MISS_MESSAGES: {
    epic_nearLegendary: [
      'Almost Legendary! Epic is still incredible.',
      'So close to Legendary! An Epic find is a win.',
      'Just one tier away from Legendary. Epic it is!',
    ],
    legendary_nearMythic: [
      'Legendary! Mythic is rarer than this world deserves.',
      'Legendary -- you were this close to Mythic.',
      'A Legendary find. Mythic is out there somewhere...',
    ],
  } as const,

  // === SESSION DESIGN (Phase 17.3, DD-V2-135/137/141) ===
  SESSION_QUICK_TARGET_MS: 5 * 60 * 1000,
  SESSION_DEEP_TARGET_MS: 15 * 60 * 1000,
  SESSION_COZY_TARGET_MS: 3 * 60 * 1000,

  // === ANTI-BINGE DIMINISHING RETURNS ===
  ANTI_BINGE_DIVE_THRESHOLD: 3,
  ANTI_BINGE_MINERAL_MULT: 0.65,
  ANTI_BINGE_DISABLE_QUIZ_BONUS: true,
  ANTI_BINGE_GAIA_MESSAGES: [
    "You've been at this a while. Your brain learns better with rest -- even a 10-minute break helps.",
    "Three dives! That's impressive dedication. A short break now will make the next dive more fun.",
    "G.A.I.A. recommends: rest. The minerals will still be here.",
  ] as const,

  // === LOGIN CALENDAR (Phase 17.4, DD-V2-144) ===
  LOGIN_CALENDAR_REWARDS: [
    { day: 1, type: 'dust',                amount: 50,  icon: 'icon_dust',     label: '50 Dust',              description: 'A small stash to get you going.' },
    { day: 2, type: 'bomb',                amount: 1,   icon: 'icon_bomb',     label: '1 Bomb',               description: 'Clears a 3x3 area underground.' },
    { day: 3, type: 'dust',                amount: 100, icon: 'icon_dust',     label: '100 Dust',             description: 'Double the haul.' },
    { day: 4, type: 'streak_freeze',       amount: 1,   icon: 'icon_freeze',   label: 'Streak Freeze',        description: 'Protect your streak from one missed day.' },
    { day: 5, type: 'shard',               amount: 1,   icon: 'icon_shard',    label: '1 Shard',              description: 'A mineral fragment from deeper layers.' },
    { day: 6, type: 'data_disc_random',    amount: 1,   icon: 'icon_disc',     label: 'Random Data Disc',     description: 'Unlocks a collection of facts.' },
    { day: 7, type: 'artifact_uncommon_plus', amount: 1, icon: 'icon_artifact', label: 'Uncommon+ Artifact',  description: "The week's prize. Uncommon or better." },
  ] as const,

  // === COMEBACK BONUS (Phase 17.4) ===
  COMEBACK_BONUS_THRESHOLD_DAYS: 3,
  COMEBACK_OXYGEN_BONUS: 1,
  COMEBACK_ARTIFACT_RARITY_FLOOR: 'uncommon' as const,

  // === DOME ROOMS ===
  DOME_ROOMS: [
    { id: 'command', name: 'Command Center', icon: '🏠', unlockDives: 0, description: 'Your main operations hub' },
    { id: 'lab', name: 'Research Lab', icon: '🔬', unlockDives: 2, description: 'Study and review your knowledge' },
    { id: 'workshop', name: 'Workshop', icon: '⚒️', unlockDives: 3, description: 'Craft equipment and upgrades' },
    { id: 'museum', name: 'Museum', icon: '🏛️', unlockDives: 5, description: 'Display your fossil collection' },
    { id: 'market', name: 'Market', icon: '🏪', unlockDives: 7, description: 'Buy cosmetics and deals' },
    { id: 'archive', name: 'Archive', icon: '📚', unlockDives: 10, description: 'Knowledge tree and data discs' },
  ] as const,

  // === ECONOMY REBALANCE (Phase 21, DD-V2-151) ===
  DOME_MAINTENANCE_BASE_DUST: 50,       // Dust per room per week (first 2 rooms free)
  DOME_MAINTENANCE_FREE_ROOMS: 2,       // Command + Lab are free
  SPENDING_BONUS_THRESHOLD: 500,        // Dust spent per week to activate bonus
  SPENDING_BONUS_YIELD_MULTIPLIER: 1.1, // +10% mineral yield when bonus active
  SPENDING_BONUS_RESET_DAY: 1,          // Monday (ISO day of week)

  // === QUIZ GATES (Phase 35.1) ===
  QUIZ_GATE_DENSITY: 0.005,           // ~0.5% of eligible cells become quiz gates
  QUIZ_GATE_MIN_DEPTH_PERCENT: 0.15,  // Only below 15% grid depth (not in spawn row)
  // Note: QUIZ_GATE_MAX_FAILURES already defined above (value 2)
  QUIZ_GATE_FAILURE_O2_COST: 10,      // O2 penalty per wrong answer at a gate
  QUIZ_GATE_PASS_DUST_REWARD: 15,     // Dust dropped when gate unlocks correctly

  // === OFFERING ALTARS (Phase 35.3) ===
  ALTAR_PER_LANDMARK_LAYER: true,       // One altar per landmark layer
  ALTAR_SACRIFICE_COSTS: {
    tier1: { dust: 200 },                // Guaranteed uncommon artifact
    tier2: { dust: 100, shard: 5 },      // Guaranteed rare artifact
    tier3: { shard: 10, crystal: 2 },    // Guaranteed epic artifact
    tier4: { crystal: 5, geode: 1 },     // Guaranteed legendary + small recipe-fragment chance
  } as const,
  ALTAR_FRAGMENT_CHANCE_TIER4: 0.35,   // 35% chance tier-4 sacrifice yields a recipe fragment
  ALTAR_COLOR: 0x9944cc,               // Purple — distinct from RelicShrine gold

  // === LAYER INSTABILITY (Phase 35.4) ===
  INSTABILITY_WARNING_THRESHOLD: 75,     // Meter appears at 75%
  INSTABILITY_COLLAPSE_TICKS: 40,        // Player has 40 ticks to reach descent shaft
  INSTABILITY_COLLAPSE_BLOCK_COUNT: 12,  // Blocks randomly collapsed during the event
  INSTABILITY_LAVA_FLOOD_RADIUS: 2,      // Lava spawned around collapse center
  INSTABILITY_DELTAS: {
    lava_adjacent:  12,
    unstable_broke: 20,
    cave_in:        25,
    hard_rock_deep:  8,
    altar_tier4:    15,
  } as const,

  // === RECIPE FRAGMENTS (Phase 35.5) ===
  FRAGMENT_NODE_DENSITY: 0.003,         // Approximately 1 per eligible layer
  HARDNESS_RECIPE_FRAGMENT: 4,          // Same as HardRock — rewarding to reach

  // === LOCKED BLOCKS (Phase 35.6) ===
  LOCKED_BLOCK_DENSITY: 0.012,          // ~1.2% of deep-layer stone becomes locked
  LOCKED_BLOCK_MIN_DEPTH_PERCENT: 0.45, // Only below 45% mine depth
  LOCKED_BLOCK_TIER_WEIGHTS: [
    { tier: 1, weight: 40 },   // Iron pick required — most common
    { tier: 2, weight: 30 },   // Steel pick
    { tier: 3, weight: 20 },   // Diamond pick
    { tier: 4, weight: 10 },   // Plasma Cutter only
  ] as const,
  LOCKED_BLOCK_HARDNESS: 6,             // Harder than standard HardRock (5) when unlocked

  // === MINE EVENTS (Phase 35.7) ===
  MINE_EVENT_MIN_TICKS: 30,             // Minimum ticks between events
  MINE_EVENT_CHANCE_PER_TICK: 0.015,    // ~1.5% per tick after min ticks elapsed

  // === BIOME TRANSITIONS (Phase 49.2, DD-V2-235) ===
  DUAL_BIOME_CHANCE: 0.15,     // 15% of layers get a secondary biome blend
  TRANSITION_BAND_WIDTH: 5,    // Cells wide for the transition gradient band

  // === ANOMALY ZONES (Phase 49.4, DD-V2-237) ===
  ANOMALY_ZONE_BASE_CHANCE: 0.18,  // Base probability per injection attempt per layer
  ANOMALY_MAX_PER_LAYER: 2,        // Maximum anomaly zones per layer

  // === DYNAMIC DIFFICULTY (Phase 49.7) ===
  DD_HARDNESS_SCALE: 0.20,   // Max ±20% hardness adjustment from engagement score
  DD_HAZARD_SCALE:   0.25,   // Max ±25% hazard density adjustment
  DD_OXYGEN_SCALE:   0.15,   // Max ±15% oxygen cache count adjustment

  // === COMBAT SYSTEM (Phase 36) ===
  COMBAT_PLAYER_BASE_HP: 100,
  COMBAT_PLAYER_HP_PER_LAYER: 5,
  COMBAT_BASE_PLAYER_ATTACK: 20,
  COMBAT_BASE_PLAYER_DEFENSE: 10,
  COMBAT_QUIZ_ATTACK_MULTIPLIER: 1.5,
  COMBAT_WRONG_O2_COST: 10,
  COMBAT_FLEE_O2_COST: 15,
  COMBAT_DEFEND_DAMAGE_REDUCTION: 0.5,
  CREATURE_SPAWN_CHANCE_PER_BLOCK: 0.015,
  CREATURE_SPAWN_MIN_BLOCKS: 10,
  CREATURE_SPAWN_COOLDOWN: 20,
  BOSS_LAYER_INDICES: [4, 9, 14, 19] as const,
  THE_DEEP_MIN_LAYER: 20,
  THE_DEEP_UNLOCK_REQUIRES_ALL_BOSSES: true,

  // === CHALLENGE MODE (DD-V2-052) ===
  CHALLENGE_SPEED_SECONDS: 8,
  CHALLENGE_GATE_LAYER_THRESHOLD: 15,
  CHALLENGE_STREAK_MILESTONES: [10, 25, 50, 100] as const,
  CHALLENGE_STREAK_PRESTIGE_POINTS: { 10: 5, 25: 15, 50: 40, 100: 100 } as Record<number, number>,
  CHALLENGE_GATE_MINERAL_MULTIPLIER: 2.0,

  // === PHASE 57: VISUAL POLISH ===
  DIRT_TINT_THRESHOLD_1: 20,
  DIRT_TINT_THRESHOLD_2: 50,
  DIRT_TINT_THRESHOLD_3: 100,
  BARELY_MADE_IT_THRESHOLD: 5,

  // === DOME TIER DESCRIPTIONS ===
  DOME_TIER_INFO: [
    { tier: 0, label: 'Basic', description: 'Basic facilities, 3 objects', objectCount: 3 },
    { tier: 1, label: 'Expanded', description: 'Expanded rooms, 5 objects', objectCount: 5 },
    { tier: 2, label: 'Full Workshop', description: 'Full workshop, 8 objects', objectCount: 8 },
    { tier: 3, label: 'Maximum', description: 'Maximum capacity, 12 objects', objectCount: 12 },
  ] as const,

  // === PHASE 55: ECONOMY DEPTH ===
  MIX_MIN_CARDS: 3,
  MIX_FEE_DUST: 100,
  MIX_RARITY_SAME: 0.60,
  MIX_RARITY_ONE_UP: 0.30,
  MIX_RARITY_TWO_UP: 0.10,

  // === ACTIVATION CAP ===
  ACTIVATION_CAP_BASE: 5,          // Starting max new+learning cards
  ACTIVATION_CAP_PER_MASTERED: 1,  // +1 cap per N mastered
  ACTIVATION_CAP_MASTERED_DIVISOR: 5,  // per 5 mastered cards
  ACTIVATION_CAP_MAX: 20,         // Hard ceiling

  // === WORKLOAD MANAGEMENT ===
  NEW_CARDS_PER_SESSION: 3,          // Max new cards introduced per study session
  NEW_CARD_THROTTLE_RATIO: 3,       // Suppress new cards if dueReviews > ratio × newCardsToday
} as const

/**
 * Compute adaptive artifact quiz chance based on player state.
 * Returns a probability 0.0–0.8 based on:
 * - depth (deeper = slightly higher chance, encouraging learning)
 * - due reviews (more overdue = higher chance, nudging review)
 * - new unstudied facts (more = higher chance, encouraging discovery)
 * - study score (lower score = higher chance, helping struggling learners)
 */
export function getAdaptiveArtifactQuizChance(
  currentLayer: number,
  dueReviewCount: number,
  unlearnedFactCount: number,
  studyScore: number,
): number {
  const base = BALANCE.ARTIFACT_QUIZ_CHANCE // 0.35

  // Depth factor: +0 to +0.1 across 20 layers
  const depthBonus = (currentLayer / (BALANCE.MAX_LAYERS - 1)) * 0.1

  // Due reviews factor: +0 to +0.15 (capped at 10+ due)
  const dueBonus = Math.min(dueReviewCount / 10, 1) * 0.15

  // Unlearned facts factor: +0 to +0.1 (capped at 20+ unlearned)
  const unlearnedBonus = Math.min(unlearnedFactCount / 20, 1) * 0.1

  // Study health factor: lower score → higher chance (struggling = more practice)
  // score 1.0 → +0, score 0.0 → +0.1
  const healthBonus = (1 - studyScore) * 0.1

  return Math.min(base + depthBonus + dueBonus + unlearnedBonus + healthBonus, 0.8)
}

/**
 * Compute adaptive new card limit based on review backlog.
 * Low backlog = more new cards (up to 5), high backlog = fewer (down to 2).
 * Replaces static NEW_CARDS_PER_SESSION in study flows.
 */
export function getAdaptiveNewCardLimit(dueReviewCount: number): number {
  const base = BALANCE.NEW_CARDS_PER_SESSION // 3
  if (dueReviewCount <= 5) return Math.min(base + 2, 5)   // low backlog: up to 5
  if (dueReviewCount >= 15) return Math.max(base - 1, 2)  // high backlog: down to 2
  return base                                               // normal: 3
}

/**
 * Returns the O2 cost multiplier for the given layer (0-indexed).
 * Layer 0 = 1.0×, Layer 9 ≈ 1.5×, Layer 19 = 2.5×. Linear interpolation. (DD-V2-061)
 */
export function getO2DepthMultiplier(layer: number): number {
  const clamped = Math.max(0, Math.min(19, layer))
  return 1.0 + (1.5 * clamped / 19)
}

/**
 * Returns the [width, height] grid dimensions for the given layer (1-indexed).
 * Tier boundaries: L1-5 = 20x20, L6-10 = 25x25, L11-15 = 30x30, L16-20 = 40x40.
 * (DD-V2-054)
 */
export function getLayerGridSize(layer: number): [number, number] {
  if (layer <= 5)  return [20, 20];
  if (layer <= 10) return [25, 25];
  if (layer <= 15) return [30, 30];
  return [40, 40];
}

// Anki-faithful learning step constants
export const SM2_LEARNING_STEPS = [1, 10]          // minutes (Anki default: 1m, 10m)
export const SM2_RELEARNING_STEPS = [10]            // minutes (Anki default: 10m)
export const SM2_GRADUATING_INTERVAL = 1            // days — interval when Good on final learning step
export const SM2_EASY_INTERVAL = 4                  // days — interval when Easy during learning
export const SM2_LAPSE_NEW_INTERVAL_PCT = 0.70      // 70% of old interval preserved after lapse
export const SM2_LEECH_THRESHOLD = 8                // lapses before leech flag
export const SM2_EASY_BONUS_MULTIPLIER = 1.3        // Good button: interval * ease * 1.3

export const ACTIVATION_CAP_BASE = BALANCE.ACTIVATION_CAP_BASE
export const ACTIVATION_CAP_PER_MASTERED = BALANCE.ACTIVATION_CAP_PER_MASTERED
export const ACTIVATION_CAP_MASTERED_DIVISOR = BALANCE.ACTIVATION_CAP_MASTERED_DIVISOR
export const ACTIVATION_CAP_MAX = BALANCE.ACTIVATION_CAP_MAX
export const NEW_CARDS_PER_SESSION = BALANCE.NEW_CARDS_PER_SESSION
export const NEW_CARD_THROTTLE_RATIO = BALANCE.NEW_CARD_THROTTLE_RATIO
export const SM2_STARTING_FACTS_COUNT = 5           // facts seeded for new players
export const SM2_DAILY_NEW_LIMIT = 10               // max new cards introduced per day/session

// ---- SM-2 Tuning Constants (DD-V2-085, DD-V2-095) ----
export const SM2_SECOND_INTERVAL_DAYS = 3          // second interval: 3 days (default SM-2 = 6)
export const SM2_CONSISTENCY_PENALTY_O2 = BALANCE.CONSISTENCY_PENALTY_O2  // O2 drained when lapsing a mature fact (unified with BALANCE)
export const SM2_CONSISTENCY_PENALTY_REPS_MIN = 4  // minimum reps before penalty applies
export const SM2_MASTERY_INTERVAL_GENERAL = 60     // days — general fact mastered threshold
export const SM2_MASTERY_INTERVAL_VOCAB = 40       // days — vocab fact mastered threshold (raised from 30, playtest 002)

// ---- Quiz Rate System (DD-V2-060, DD-V2-085) ----
export const QUIZ_BASE_RATE = 0.08
export const QUIZ_COOLDOWN_BLOCKS = 15
export const QUIZ_FIRST_TRIGGER_AFTER_BLOCKS = 10
export const QUIZ_FATIGUE_PENALTY_PER_QUIZ = 0.02
export const QUIZ_FATIGUE_THRESHOLD = 5
export const QUIZ_MIN_RATE = 0.02
export const QUIZ_DISCOVERY_O2_REWARD = 5
export const QUIZ_REVIEW_O2_PENALTY = 8
export const QUIZ_BURST_THRESHOLD = 3              // quizzes within burst window triggers extended cooldown
export const QUIZ_BURST_COOLDOWN_MULTIPLIER = 2.0  // multiply normal cooldown after burst

// ---- Consumable Drop Chance (DD-V2-064) ----
export const CONSUMABLE_DROP_CHANCE = 0.04  // 4% chance per block broken

// ---- Hazard Damage Constants (DD-V2-060/062) ----
export const BASE_LAVA_HAZARD_DAMAGE = 20
export const BASE_GAS_HAZARD_DAMAGE = 5
export const HAZARD_MAX_DEFENSE_REDUCTION = 0.5

// ---- Tick-Based Timing Constants (DD-V2-051) ----
export const TICK_LAVA_SPREAD_INTERVAL = 1;          // lava expands every N ticks
export const TICK_GAS_DRIFT_INTERVAL = 2;            // gas cloud moves every N ticks
export const TICK_GAS_DISSIPATE_AFTER = 30;          // gas cloud lifetime in ticks
export const TICK_INSTABILITY_WARNING = 0.75;        // 75% = doubled earthquake frequency
export const TICK_INSTABILITY_COLLAPSE = 1.0;        // 100% = evacuation countdown begins
export const UNSTABLE_GROUND_TICK_THRESHOLD = 3;     // ticks adjacent before collapse
export const TICK_INSTABILITY_PER_ACTION = 0.001;    // instability gained per player action

// ---- Per-Layer Difficulty Curve (DD-V2-053) ----

/** Hazard density multiplier per layer. Applied to lava/gas/unstable densities at generation time. */
export const HAZARD_DENSITY_BY_LAYER: Record<number, number> = {
  1: 0.0, 2: 0.2, 3: 0.4, 4: 0.6, 5: 0.8,
  6: 1.0, 7: 1.1, 8: 1.2, 9: 1.3, 10: 1.4,
  11: 1.6, 12: 1.8, 13: 2.0, 14: 2.2, 15: 2.5,
  16: 2.8, 17: 3.2, 18: 3.6, 19: 4.0, 20: 4.5,
}

// ---- Loot Loss Rates on Death (DD-V2-181) ----
export const LOOT_LOSS_RATE_SHALLOW = 0       // L1-5: no loss
export const LOOT_LOSS_RATE_MID = 0.15        // L6-10: 15% of un-banked minerals lost
export const LOOT_LOSS_RATE_DEEP = 0.30       // L11-20: 30% of un-banked minerals lost

// ---- Send-Up Pod (DD-V2-053) ----
export const SEND_UP_TICK_COST = 5

// ---- Phase 51: Sacrifice Thresholds (DD-021) ----
/** Fraction of filled backpack slots that must be sacrificed at each layer depth (0-based index). */
export const SACRIFICE_THRESHOLD_BY_LAYER: Record<number, number> = {
  0: 0.20, 1: 0.25, 2: 0.30, 3: 0.35, 4: 0.40,
  5: 0.50, 6: 0.60, 7: 0.70, 8: 0.75,
}
export const SACRIFICE_THRESHOLD_MAX = 0.80

// ---- Phase 51: Send-Up Slots by Layer (DD-039) ----
/** Max items a player can send to the surface from a given 1-based layer index. */
export const SEND_UP_SLOTS_BY_LAYER: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4,
}
export const SEND_UP_SLOTS_MAX = 4

/** Returns the number of send-up slots available at the given 1-based layer index. */
export function getSendUpSlots(layer: number): number {
  return SEND_UP_SLOTS_BY_LAYER[layer] ?? SEND_UP_SLOTS_MAX
}

// ---- Phase 51: Backpack Stacking Limits (DD-037) ----
/** Maximum number of a given mineral tier that fits in a single backpack slot. */
export const MINERAL_STACK_LIMITS: Record<string, number> = {
  dust: 50, shard: 20, crystal: 5, geode: 2, essence: 1,
}

/** Number of backpack SLOTS an artifact of a given rarity occupies. */
export const ARTIFACT_SLOT_COST: Record<string, number> = {
  common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3,
}

/** Number of backpack slots a fossil fragment occupies. */
export const FOSSIL_SLOT_COST = 3

// ---- Phase 51: Rescue Beacon Cost (DD-038) ----
export const RESCUE_BEACON_COST_CRYSTAL = 200
export const RESCUE_BEACON_COST_GEODE = 2

/** O2 tank size per layer. Deep layers have larger tanks. */
export const O2_TANK_SIZE_BY_LAYER: Record<number, number> = {
  1: 100, 2: 100, 3: 100, 4: 100, 5: 100,
  6: 110, 7: 115, 8: 120, 9: 125, 10: 130,
  11: 140, 12: 145, 13: 150, 14: 155, 15: 160,
  16: 175, 17: 185, 18: 195, 19: 205, 20: 220,
}

/** Mineral rarity tier minimum per layer. 0=dust, 1=shards+, 2=crystals+, 3=geodes. */
export const MINERAL_TIER_MINIMUM_BY_LAYER: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 2, 12: 2, 13: 2, 14: 2, 15: 2,
  16: 3, 17: 3, 18: 3, 19: 3, 20: 3,
}

/** Biome danger rating for difficulty estimate in PreDiveScreen. 1=safe, 5=extreme. */
export const BIOME_DANGER_RATING: Partial<Record<string, number>> = {
  limestone_caves: 1, mudstone_tunnels: 1, sandstone_corridors: 1,
  clay_hollows: 1, chalk_beds: 1,
  granite_press: 2, basalt_flow: 3, obsidian_vent: 4,
  magma_shelf: 5, void_pocket: 5,
}

// ---- Auto-Balance Easing (DD-V2-053) ----
export const AUTO_BALANCE_DEATH_THRESHOLD = 3
export const AUTO_BALANCE_HAZARD_SCALAR = 0.75
export const AUTO_BALANCE_O2_BONUS = 10

/** Pickaxe tier impact profiles — each tier adds unique visual signature to mining feedback. */
export const PICKAXE_TIER_VISUALS = [
  { name: 'Stone Pick',    shakeMultiplier: 1.0, flashIntensity: 0.2, particleBonus: 0  },
  { name: 'Iron Pick',     shakeMultiplier: 1.2, flashIntensity: 0.3, particleBonus: 3  },
  { name: 'Diamond Pick',  shakeMultiplier: 1.5, flashIntensity: 0.5, particleBonus: 6  },
  { name: 'Quantum Pick',  shakeMultiplier: 2.0, flashIntensity: 0.8, particleBonus: 10 },
] as const

// === REVEAL TIMING (Phase 31.1) ===
// All values in milliseconds.
// anticipationMs : time the '?' box is shown before suspense begins
// suspenseMs     : pulse duration before reveal flash
// flashMs        : hold on the bright reveal frame (screenFlash tiers only)
// payoffMs       : artifact + fact text shown before Collect button appears
// collectMs      : time Collect button is visible before auto-advance
export const REVEAL_TIMING: Record<string, {
  anticipationMs: number
  suspenseMs: number
  flashMs: number
  payoffMs: number
  collectMs: number
  suspensePulseHz: number   // Pulse frequency during suspense (higher = faster pulse)
  particleWaveCount: number // How many burst waves fire in sequence
}> = {
  common:    { anticipationMs: 300,  suspenseMs: 400,  flashMs: 0,    payoffMs: 400,   collectMs: 1500, suspensePulseHz: 1.0, particleWaveCount: 1 },
  uncommon:  { anticipationMs: 400,  suspenseMs: 600,  flashMs: 0,    payoffMs: 600,   collectMs: 2000, suspensePulseHz: 1.2, particleWaveCount: 1 },
  rare:      { anticipationMs: 600,  suspenseMs: 900,  flashMs: 80,   payoffMs: 900,   collectMs: 2500, suspensePulseHz: 1.5, particleWaveCount: 2 },
  epic:      { anticipationMs: 900,  suspenseMs: 1400, flashMs: 120,  payoffMs: 1400,  collectMs: 3000, suspensePulseHz: 2.0, particleWaveCount: 3 },
  legendary: { anticipationMs: 1400, suspenseMs: 2200, flashMs: 180,  payoffMs: 2200,  collectMs: 4000, suspensePulseHz: 2.5, particleWaveCount: 4 },
  mythic:    { anticipationMs: 2000, suspenseMs: 3500, flashMs: 250,  payoffMs: 3500,  collectMs: 5000, suspensePulseHz: 3.0, particleWaveCount: 6 },
} as const

// === BLOCK SHIMMER TIERS (Phase 31.3) ===
// Controls the ambient shimmer overlay on ArtifactNode tiles by rarity.
// shimmerAlpha     : peak opacity of the shimmer overlay (0-1)
// shimmerColor     : hex tint of the shimmer overlay
// shimmerPeriodMs  : full cycle duration in ms
// shimmerRadiusTiles : how many adjacent tiles the shimmer glow bleeds into (0 = tile only)
export const BLOCK_SHIMMER_TIERS: Record<string, {
  shimmerAlpha: number
  shimmerColor: number
  shimmerPeriodMs: number
  shimmerRadiusTiles: number
}> = {
  common:    { shimmerAlpha: 0.00, shimmerColor: 0x888888, shimmerPeriodMs: 0,    shimmerRadiusTiles: 0 },
  uncommon:  { shimmerAlpha: 0.00, shimmerColor: 0x4ec9a0, shimmerPeriodMs: 0,    shimmerRadiusTiles: 0 },
  rare:      { shimmerAlpha: 0.20, shimmerColor: 0x4a9eff, shimmerPeriodMs: 1800, shimmerRadiusTiles: 0 },
  epic:      { shimmerAlpha: 0.30, shimmerColor: 0xcc44ff, shimmerPeriodMs: 1400, shimmerRadiusTiles: 1 },
  legendary: { shimmerAlpha: 0.45, shimmerColor: 0xffd700, shimmerPeriodMs: 1000, shimmerRadiusTiles: 1 },
  mythic:    { shimmerAlpha: 0.60, shimmerColor: 0xff44aa, shimmerPeriodMs: 700,  shimmerRadiusTiles: 2 },
} as const

// === DESCENT ANIMATION (Phase 31.5) ===
export const DESCENT_ANIM = {
  /** Duration of camera pan down before fade, in ms */
  panDurationMs: 400,
  /** Camera zoom multiplier during descent (>1 = zoom in slightly) */
  zoomDuringDescent: 1.15,
  /** Duration of screen fade-to-black, in ms */
  fadeDurationMs: 350,
  /** Duration of new-layer fade-in, in ms */
  fadeInDurationMs: 400,
  /** How long the depth counter card is held visible, in ms */
  depthCounterHoldMs: 900,
  /** How long a biome-change name card is shown, in ms (0 if biome unchanged) */
  biomeCardHoldMs: 1200,
  /** Oxygen restore flash duration (already in BALANCE, but gated here for the visual) */
  oxygenFlashMs: 600,
} as const

// === STREAK VISUAL THRESHOLDS (Phase 31.6) ===
export const STREAK_VISUAL = {
  TIER_1_COUNT: 3,   multiplier_1: 1.20,  // 3 correct in a row → +20% dust
  TIER_2_COUNT: 5,   multiplier_2: 1.35,  // 5 correct in a row → +35% dust
  TIER_3_COUNT: 7,   multiplier_3: 1.50,  // 7 correct in a row → +50% dust
  RESET_ON_WRONG: true,
} as const

// === PHASE 42: VIRAL GROWTH — REFERRAL REWARD TIERS ===

/** Referral reward tiers. Index = number of qualifying referrals. */
export const REFERRAL_REWARD_TIERS: {
  threshold: number
  rewardType: 'fossil_egg' | 'cosmetic_frame' | 'companion_skin' | 'nameplate'
  rewardKey: string
  label: string
}[] = [
  { threshold: 1,  rewardType: 'fossil_egg',      rewardKey: 'egg_referral_common',   label: 'Fossil Egg' },
  { threshold: 3,  rewardType: 'cosmetic_frame',   rewardKey: 'frame_explorer_invite', label: 'Explorer Frame' },
  { threshold: 5,  rewardType: 'companion_skin',   rewardKey: 'skin_miner_envoy',      label: 'Envoy Miner Skin' },
  { threshold: 10, rewardType: 'nameplate',        rewardKey: 'nameplate_connector',   label: 'Connector Nameplate' },
]

/** Number of days after a link click within which an install can be attributed. */
export const REFERRAL_ATTRIBUTION_DAYS = 30

/** Maximum qualifying referrals per player per calendar year (anti-fraud cap). */
export const REFERRAL_MAX_PER_YEAR = 10

// === PHASE 53: LEARNING SPARKS ===

export const LEARNING_SPARKS_PER_MILESTONE = {
  /** Fact reaches 'familiar' mastery. */
  fact_familiar: 1,
  /** Fact reaches 'known' mastery. */
  fact_known: 3,
  /** Fact reaches 'mastered' mastery. */
  fact_mastered: 5,
  /** Branch reaches 25% explored. */
  branch_25_pct: 10,
  /** Branch reaches 50% explored. */
  branch_50_pct: 20,
  /** Branch reaches 100% explored. */
  branch_100_pct: 25,
} as const

// === PHASE 42: ASO — REVIEW PROMPT TRIGGERS ===

/** Review prompt trigger thresholds. All must be met before the prompt fires. */
export const REVIEW_PROMPT_TRIGGERS = {
  /** Minimum dives completed before the review prompt is eligible. */
  minDives: 5,
  /** Minimum facts mastered before the review prompt is eligible. */
  minFactsMastered: 10,
  /** Cooldown in days between prompt appearances. */
  cooldownDays: 90,
} as const

// ============================================================
// CARD ROGUELITE BALANCE (CR-01)
// ============================================================

// Card Combat
export const HAND_SIZE = 5;
export const DEFAULT_POOL_SIZE = 120;
export const POOL_PRIMARY_PCT = 0.40;
export const POOL_SECONDARY_PCT = 0.30;
export const POOL_REVIEW_PCT = 0.30;

// Base effect values by card type
// Uses Record<string, number> instead of Record<CardType, number> to avoid
// circular imports (balance.ts should NOT import from card-types.ts).
export const BASE_EFFECT: Record<string, number> = {
  attack: 8,
  shield: 6,
  heal: 5,
  utility: 0,
  buff: 0,
  debuff: 0,
  regen: 3,
  wild: 0,
};

// Tier multipliers — Tier 3 is passive (no active effect value)
export const TIER_MULTIPLIER: Record<'1' | '2a' | '2b' | '3', number> = {
  '1': 1.0,
  '2a': 1.3,
  '2b': 1.6,
  '3': 0,
};

// Legacy compatibility for numeric-tier callers.
export const LEGACY_TIER_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: TIER_MULTIPLIER['1'],
  2: TIER_MULTIPLIER['2a'],
  3: TIER_MULTIPLIER['3'],
};

/** Passive bonus values for Tier 3 mastered cards by card type. */
export const TIER3_PASSIVE_VALUE: Record<string, number> = {
  attack: 1,    // +1 flat damage to all attacks
  shield: 1,    // +1 flat block to all shields
  heal: 1,      // +1 HP healed at turn start
  utility: 1,   // +1 extra card drawn at turn start (capped)
  buff: 2,      // +2% to next card buff baseline
  debuff: 1,    // +1 to debuff potency
  regen: 1,     // +1 regen at turn start
  wild: 1,      // +1 to wild card effect
};

export const TIER3_PASSIVE = TIER3_PASSIVE_VALUE;

export const MASTERY_TRIAL = {
  TIMER_SECONDS: 4,
  ANSWER_OPTIONS: 5,
  REQUIRED_STABILITY: 30,
  REQUIRED_CONSECUTIVE_CORRECT: 7,
  USE_HARDEST_VARIANT: true,
  SLOW_READER_BONUS: false,
} as const;

export const TIER_QUESTION_FORMAT: Record<'1' | '2a' | '2b' | '3', {
  options: number;
  allowReverse: boolean;
  allowFillBlank: boolean;
  useCloseDistractors: boolean;
}> = {
  '1': { options: 3, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
  '2a': { options: 4, allowReverse: true, allowFillBlank: false, useCloseDistractors: false },
  '2b': { options: 5, allowReverse: true, allowFillBlank: true, useCloseDistractors: true },
  '3': { options: 0, allowReverse: false, allowFillBlank: false, useCloseDistractors: false },
};

// Difficulty-proportional power: lower ease = harder card = higher multiplier
// Sorted ascending by maxEase. First match wins.
export const EASE_POWER: Array<{ maxEase: number; multiplier: number }> = [
  { maxEase: 1.5,      multiplier: 1.6 },  // Very Hard (ease < 1.5)
  { maxEase: 2.0,      multiplier: 1.3 },  // Hard      (ease < 2.0)
  { maxEase: 2.5,      multiplier: 1.0 },  // Medium    (ease < 2.5)
  { maxEase: Infinity,  multiplier: 0.8 },  // Easy      (ease >= 2.5)
];

// Player defaults
export const PLAYER_START_HP = 80;
export const PLAYER_MAX_HP = 80;
export const HINTS_PER_ENCOUNTER = 1;
export const START_AP_PER_TURN = 3;
export const MAX_AP_PER_TURN = 5;

// Speed scaling (timer in seconds by floor)
export const FLOOR_TIMER: Array<{ maxFloor: number; seconds: number }> = [
  { maxFloor: 6,        seconds: 12 },   // Segment 1: Shallow Depths
  { maxFloor: 12,       seconds: 9 },    // Segment 2: Deep Caverns
  { maxFloor: 18,       seconds: 7 },    // Segment 3: The Abyss
  { maxFloor: 24,       seconds: 5 },    // Segment 4: The Archive
  { maxFloor: Infinity, seconds: 4 },    // Endless
];

// Q&A brevity limits — enforced by generation prompts and validation pipeline
export const QA_LIMITS = {
  /** Max words for base quizQuestion */
  QUESTION_MAX_WORDS: 12,
  /** Max words for any answer option (correct or distractor) */
  ANSWER_MAX_WORDS: 5,
  /** Max characters for any answer option */
  ANSWER_MAX_CHARS: 30,
  /** Max characters for distractors specifically */
  DISTRACTOR_MAX_CHARS: 30,
  /** Minimum distractors per fact (top-level pool) */
  DISTRACTOR_MIN_COUNT: 8,
  /** Maximum distractors per fact (top-level pool) */
  DISTRACTOR_MAX_COUNT: 12,
  /** Minimum variants per knowledge fact */
  VARIANT_MIN_COUNT: 4,
  /** Target variants per knowledge fact */
  VARIANT_TARGET_COUNT: 5,
  /** Answer options must be within this tolerance of each other's char count */
  SIMILAR_LENGTH_TOLERANCE: 0.20,
  /** Per-variant-type question word limits */
  VARIANT_QUESTION_MAX_WORDS: {
    forward: 12,
    reverse: 15,
    negative: 10,
    fill_blank: 15,
    true_false: 15,
    context: 15,
  },
  /** Per-variant-type answer word limits */
  VARIANT_ANSWER_MAX_WORDS: {
    forward: 5,
    reverse: 4,
    negative: 5,
    fill_blank: 3,
    true_false: 1,
    context: 4,
  },
} as const;

// Knowledge combo multipliers
// Index 0 = 1st correct, index 4 = 5th correct (perfect turn)
export const COMBO_MULTIPLIERS = [1.0, 1.15, 1.3, 1.5, 2.0];

// Speed bonus
export const SPEED_BONUS_THRESHOLD = 0.25;    // answer in first 25% of timer
export const SPEED_BONUS_MULTIPLIER = 1.5;

export const MAX_ACTIVE_RELICS = 12;
export const DORMANCY_THRESHOLD = 0.7;

export const ECHO = {
  REAPPEARANCE_CHANCE: 0.70,
  POWER_MULTIPLIER: 0.70,
  FSRS_STABILITY_BONUS: 2.0,
  MAX_ECHOES_PER_RUN: 15,
  INSERT_DELAY_CARDS: 3,
} as const;

/** Currency multiplier per difficulty mode. Applied at end-of-run. */
export const DIFFICULTY_REWARD_MULTIPLIER: Record<'explorer' | 'standard' | 'scholar', number> = {
  explorer: 1.00,
  standard: 1.00,
  scholar: 1.20,
};

/** Reward retention on death, by segment. Retreat/victory keep 100%. */
export const DEATH_PENALTY: Record<1 | 2 | 3 | 4, number> = {
  1: 0.80,
  2: 0.65,
  3: 0.50,
  4: 0.35,
};

export const SEGMENT_BOSS_FLOORS = [3, 6, 9, 12, 15, 18, 21, 24] as const;
export const ENDLESS_BOSS_INTERVAL = 3;

/** Number of encounters per floor (2 regular + 1 mini-boss/boss). */
export const ENCOUNTERS_PER_FLOOR = 3;

/** Maximum floors in a standard run. */
export const MAX_FLOORS = 24;

/** Human-readable segment names. */
export const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Shallow Depths',
  2: 'Deep Caverns',
  3: 'The Abyss',
  4: 'The Archive',
};

// === FEATURE FLAGS ===

/** When true, phase 2 mechanics are included in the card pool. */
export const ENABLE_PHASE2_MECHANICS = false;

/** When true, language domains appear in the domain picker. */
export const ENABLE_LANGUAGE_DOMAINS = false;

/** Number of runs that force Story Mode (explorer) difficulty. */
export const STORY_MODE_FORCED_RUNS = 3;

/** Number of completed runs before archetype selection unlocks (auto-balanced until then). */
export const ARCHETYPE_UNLOCK_RUNS = 3;
