export type ChallengePillar = 'mining' | 'learning' | 'collecting'

export interface WeeklyChallenge {
  id: string
  pillar: ChallengePillar
  title: string
  description: string
  /** The stat key tracked in ChallengeTracker */
  trackingKey: 'blocksMinedThisWeek' | 'factsLearnedThisWeek' | 'fossilsFoundThisWeek' |
               'deepestLayerThisWeek' | 'artifactsFoundThisWeek' | 'studySessionsThisWeek' |
               'diveCompletionsThisWeek' | 'quizCorrectThisWeek' | 'mineralsCollectedThisWeek' |
               'dataDiscsFoundThisWeek'
  targetValue: number
}

/**
 * Pool of 30 challenge definitions.
 * Every Monday, getWeeklyChallenges() picks 3 from this pool
 * (1 per pillar) using a seeded random based on the ISO week number.
 * Per DD-V2-140: one mining, one learning, one collecting challenge per week.
 */
export const WEEKLY_CHALLENGE_POOL: WeeklyChallenge[] = [
  // === MINING CHALLENGES ===
  { id: 'mine_500_blocks',     pillar: 'mining',     title: 'Deep Digger',         description: 'Mine 500 blocks this week.',                          trackingKey: 'blocksMinedThisWeek',       targetValue: 500  },
  { id: 'mine_reach_layer8',   pillar: 'mining',     title: 'Layer 8 Diver',       description: 'Reach layer 8 or deeper in a single dive.',           trackingKey: 'deepestLayerThisWeek',      targetValue: 8    },
  { id: 'mine_reach_layer12',  pillar: 'mining',     title: 'Layer 12 Expedition', description: 'Reach layer 12 or deeper in a single dive.',          trackingKey: 'deepestLayerThisWeek',      targetValue: 12   },
  { id: 'mine_5_dives',        pillar: 'mining',     title: 'Five Dives',          description: 'Complete 5 dives this week.',                         trackingKey: 'diveCompletionsThisWeek',   targetValue: 5    },
  { id: 'mine_3_dives',        pillar: 'mining',     title: 'Three Dives',         description: 'Complete 3 dives this week.',                         trackingKey: 'diveCompletionsThisWeek',   targetValue: 3    },
  { id: 'mine_1000_minerals',  pillar: 'mining',     title: 'Mineral Hoarder',     description: 'Collect 1,000 total mineral units this week.',        trackingKey: 'mineralsCollectedThisWeek', targetValue: 1000 },
  { id: 'mine_200_minerals',   pillar: 'mining',     title: 'Weekend Haul',        description: 'Collect 200 total mineral units this week.',          trackingKey: 'mineralsCollectedThisWeek', targetValue: 200  },
  { id: 'mine_reach_layer5',   pillar: 'mining',     title: 'Beneath the Surface', description: 'Reach layer 5 or deeper in a single dive.',           trackingKey: 'deepestLayerThisWeek',      targetValue: 5    },
  { id: 'mine_reach_layer15',  pillar: 'mining',     title: 'Deep Trenches',       description: 'Reach layer 15. The Archive is down there.',          trackingKey: 'deepestLayerThisWeek',      targetValue: 15   },
  { id: 'mine_300_blocks',     pillar: 'mining',     title: 'Steady Pick',         description: 'Mine 300 blocks this week.',                          trackingKey: 'blocksMinedThisWeek',       targetValue: 300  },

  // === LEARNING CHALLENGES ===
  { id: 'learn_5_facts',       pillar: 'learning',   title: 'First Lessons',       description: 'Learn 5 new facts this week.',                        trackingKey: 'factsLearnedThisWeek',      targetValue: 5    },
  { id: 'learn_10_facts',      pillar: 'learning',   title: 'Eager Scholar',       description: 'Learn 10 new facts this week.',                       trackingKey: 'factsLearnedThisWeek',      targetValue: 10   },
  { id: 'learn_20_facts',      pillar: 'learning',   title: 'Knowledge Surge',     description: 'Lock in 20 new facts this week.',                     trackingKey: 'factsLearnedThisWeek',      targetValue: 20   },
  { id: 'study_3_sessions',    pillar: 'learning',   title: 'Review Run',          description: 'Complete 3 study sessions this week.',                trackingKey: 'studySessionsThisWeek',     targetValue: 3    },
  { id: 'study_5_sessions',    pillar: 'learning',   title: 'Back to Back',        description: 'Complete 5 study sessions this week.',                trackingKey: 'studySessionsThisWeek',     targetValue: 5    },
  { id: 'quiz_20_correct',     pillar: 'learning',   title: 'Sharp',               description: 'Answer 20 questions correctly this week.',            trackingKey: 'quizCorrectThisWeek',       targetValue: 20   },
  { id: 'quiz_50_correct',     pillar: 'learning',   title: 'Crack Shot',          description: 'Answer 50 questions correctly this week.',            trackingKey: 'quizCorrectThisWeek',       targetValue: 50   },
  { id: 'learn_3_facts',       pillar: 'learning',   title: 'Light Reading',       description: 'Learn 3 new facts this week.',                        trackingKey: 'factsLearnedThisWeek',      targetValue: 3    },
  { id: 'learn_disc',          pillar: 'learning',   title: 'Disc Decoder',        description: 'Find and decode 1 Data Disc this week.',              trackingKey: 'dataDiscsFoundThisWeek',    targetValue: 1    },
  { id: 'quiz_100_correct',    pillar: 'learning',   title: 'Fact Machine',        description: 'Answer 100 questions correctly this week.',           trackingKey: 'quizCorrectThisWeek',       targetValue: 100  },

  // === COLLECTING CHALLENGES ===
  { id: 'collect_3_fossils',   pillar: 'collecting', title: 'Fossil Hunter',       description: 'Find 3 fossil fragments this week.',                  trackingKey: 'fossilsFoundThisWeek',      targetValue: 3    },
  { id: 'collect_1_fossil',    pillar: 'collecting', title: 'First Fragment',      description: 'Find 1 fossil fragment this week.',                   trackingKey: 'fossilsFoundThisWeek',      targetValue: 1    },
  { id: 'collect_5_artifacts', pillar: 'collecting', title: 'Buried Goods',        description: 'Find 5 artifacts this week.',                         trackingKey: 'artifactsFoundThisWeek',    targetValue: 5    },
  { id: 'collect_10_artifacts',pillar: 'collecting', title: 'Relic Hunter',        description: 'Find 10 artifacts this week.',                        trackingKey: 'artifactsFoundThisWeek',    targetValue: 10   },
  { id: 'collect_rare_plus',   pillar: 'collecting', title: 'Good Eye',            description: 'Find 2 Rare or better artifacts this week.',          trackingKey: 'artifactsFoundThisWeek',    targetValue: 2    },
  { id: 'collect_2_discs',     pillar: 'collecting', title: 'Data Archivist',      description: 'Find 2 Data Discs this week.',                        trackingKey: 'dataDiscsFoundThisWeek',    targetValue: 2    },
  { id: 'collect_5_fossils',   pillar: 'collecting', title: 'Bone Collector',      description: 'Find 5 fossil fragments this week.',                  trackingKey: 'fossilsFoundThisWeek',      targetValue: 5    },
  { id: 'collect_20_artifacts',pillar: 'collecting', title: 'Full Haul',           description: 'Find 20 artifacts this week.',                        trackingKey: 'artifactsFoundThisWeek',    targetValue: 20   },
  { id: 'collect_legend_art',  pillar: 'collecting', title: 'Legend Seeker',       description: 'Find 1 Legendary artifact this week.',                trackingKey: 'artifactsFoundThisWeek',    targetValue: 1    },
  { id: 'collect_minerals_all',pillar: 'collecting', title: 'Full Spectrum',       description: 'Collect at least 1 of every mineral tier this week.', trackingKey: 'mineralsCollectedThisWeek', targetValue: 5    },
]

/**
 * Selects 3 challenges for the current week (1 per pillar).
 * Uses ISO week number as seed for deterministic selection.
 * Resets on Monday (when ISO week number changes).
 */
export function getWeeklyChallenges(): [WeeklyChallenge, WeeklyChallenge, WeeklyChallenge] {
  const now = new Date()
  // ISO week number as seed
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const weekNum = Math.floor(dayOfYear / 7)

  function seededPick(pool: WeeklyChallenge[], pillar: ChallengePillar, seed: number): WeeklyChallenge {
    const filtered = pool.filter(c => c.pillar === pillar)
    return filtered[(seed * 31 + filtered.length) % filtered.length]
  }

  return [
    seededPick(WEEKLY_CHALLENGE_POOL, 'mining',     weekNum),
    seededPick(WEEKLY_CHALLENGE_POOL, 'learning',   weekNum + 1),
    seededPick(WEEKLY_CHALLENGE_POOL, 'collecting', weekNum + 2),
  ]
}

/** Returns ms until next Monday 00:00:00 local time. */
export function msUntilNextMonday(): number {
  const now = new Date()
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  nextMonday.setHours(0, 0, 0, 0)
  return nextMonday.getTime() - now.getTime()
}
