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
  ARTIFACT_QUIZ_CHANCE: 0.7,           // 70% chance artifact triggers quiz
  EXIT_ROOM_WIDTH: 7,                  // Interior width of exit room
  EXIT_ROOM_HEIGHT: 5,                 // Interior height of exit room
  EXIT_GATE_QUESTIONS: 3,               // Number of correct answers needed to pass exit gate

  // === LAYER ENTRANCE ===
  LAYER_ENTRANCE_QUESTIONS: 1,       // Questions to answer before descending
  LAYER_ENTRANCE_WRONG_O2_COST: 10,  // O2 penalty for wrong answer

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
  CONSISTENCY_PENALTY_O2: 8,      // Extra O2 cost for inconsistent answer (knew it before, got it wrong now)
  CONSISTENCY_PENALTY_DUST: -5,   // Lose 5 dust during dive mineral tracking (future use)
  CONSISTENCY_MIN_REPS: 2,        // Only penalize facts with 2+ successful reps (actually learned)

  // === SM-2 DEFAULTS ===
  SM2_INITIAL_EASE: 2.5,
  SM2_MIN_EASE: 1.3,

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
} as const

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

// ---- SM-2 Tuning Constants (DD-V2-085, DD-V2-095) ----
export const SM2_SECOND_INTERVAL_DAYS = 3          // second interval: 3 days (default SM-2 = 6)
export const SM2_CONSISTENCY_PENALTY_O2 = 5        // O2 drained when lapsing a mature fact
export const SM2_CONSISTENCY_PENALTY_REPS_MIN = 4  // minimum reps before penalty applies
export const SM2_MASTERY_INTERVAL_GENERAL = 60     // days — general fact mastered threshold
export const SM2_MASTERY_INTERVAL_VOCAB = 30       // days — vocab fact mastered threshold

// ---- Quiz Rate System (DD-V2-060, DD-V2-085) ----
export const QUIZ_BASE_RATE = 0.08
export const QUIZ_COOLDOWN_BLOCKS = 15
export const QUIZ_FIRST_TRIGGER_AFTER_BLOCKS = 10
export const QUIZ_FATIGUE_PENALTY_PER_QUIZ = 0.02
export const QUIZ_FATIGUE_THRESHOLD = 5
export const QUIZ_MIN_RATE = 0.02
export const QUIZ_DISCOVERY_O2_REWARD = 5
export const QUIZ_REVIEW_O2_PENALTY = 8

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
