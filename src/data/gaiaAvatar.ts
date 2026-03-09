/**
 * Keeper visual identity — expression states and metadata.
 * All avatar presentation is emoji-based; no image assets required.
 */

export interface KeeperExpression {
  id: string
  /** Primary emoji used to represent this expression */
  emoji: string
  label: string
}

/** All available Keeper expression states */
export const KEEPER_EXPRESSIONS: Record<string, KeeperExpression> = {
  neutral:   { id: 'neutral',   emoji: '🤖', label: 'Neutral' },
  happy:     { id: 'happy',     emoji: '😊', label: 'Happy' },
  excited:   { id: 'excited',   emoji: '🤩', label: 'Excited' },
  thinking:  { id: 'thinking',  emoji: '🤔', label: 'Thinking' },
  worried:   { id: 'worried',   emoji: '😟', label: 'Worried' },
  proud:     { id: 'proud',     emoji: '😤', label: 'Proud' },
  snarky:    { id: 'snarky',    emoji: '😏', label: 'Snarky' },
  surprised: { id: 'surprised', emoji: '😲', label: 'Surprised' },
}

/** Maps known trigger names to an expression id. */
const EXPRESSION_MAP: Record<string, string> = {
  dungeon_entry:   'excited',
  dungeonEntry:    'excited',
  depth_25:        'neutral',
  depthMilestone25: 'neutral',
  depth_50:        'thinking',
  depthMilestone50: 'thinking',
  depth_75:        'worried',
  depthMilestone75: 'worried',
  low_oxygen:      'worried',
  lowOxygen:       'worried',
  exit_reached:    'happy',
  exitReached:     'happy',
  artifact_found:  'surprised',
  artifactFound:   'surprised',
  upgrade_found:   'excited',
  descent_shaft:   'thinking',
  cave_in:         'worried',
  caveIn:          'worried',
  earthquake:      'worried',
  fossil_found:    'excited',
  relic_found:     'proud',
  quiz_correct:    'happy',
  quiz_wrong:      'thinking', // overridden below for snarky mood
  idle:            'neutral',  // overridden below for snarky mood
  pet_comment:     'happy',
  expedition_return:         'happy',
  postExpeditionReaction:    'happy',
  postExpeditionShallow:     'neutral',
  postExpeditionDeep:        'excited',
  postExpeditionFreeGift:    'surprised',
  postExpeditionBiomeTeaser: 'thinking',
  memory:              'thinking',
  barely_made_it:      'worried',
  barelyMadeIt:        'worried',
  branch_completion:   'excited',
  branchCompletion:    'excited',
}

/**
 * Resolve the Keeper expression for a given trigger and current mood.
 * Falls back to `neutral` for unknown triggers.
 *
 * @param trigger - Event/trigger name (camelCase or snake_case both work)
 * @param mood    - Current player-selected Keeper mood
 */
export function getKeeperExpression(trigger: string, mood: string): KeeperExpression {
  let exprId = EXPRESSION_MAP[trigger] ?? 'neutral'

  // Mood-based overrides for neutral/ambiguous triggers
  if ((trigger === 'quiz_wrong' || trigger === 'idle') && mood === 'snarky') {
    exprId = 'snarky'
  }

  return KEEPER_EXPRESSIONS[exprId] ?? KEEPER_EXPRESSIONS.neutral
}

/** Short display name shown in UI headers */
export const KEEPER_NAME = 'Keeper'

/** Full expanded name shown in tooltip / About section */
export const KEEPER_FULL_NAME = 'The Keeper of Knowledge'

/** One-line tagline shown below the full name */
export const KEEPER_TAGLINE = 'Your guide through the depths...'
