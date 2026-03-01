/**
 * GAIA visual identity — expression states and metadata.
 * All avatar presentation is emoji-based; no image assets required.
 */

export interface GaiaExpression {
  id: string
  /** Primary emoji used to represent this expression */
  emoji: string
  label: string
}

/** All available GAIA expression states */
export const GAIA_EXPRESSIONS: Record<string, GaiaExpression> = {
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
  mine_entry:      'excited',
  mineEntry:       'excited',
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
}

/**
 * Resolve the GAIA expression for a given trigger and current mood.
 * Falls back to `neutral` for unknown triggers.
 *
 * @param trigger - Event/trigger name (camelCase or snake_case both work)
 * @param mood    - Current player-selected GAIA mood
 */
export function getGaiaExpression(trigger: string, mood: string): GaiaExpression {
  let exprId = EXPRESSION_MAP[trigger] ?? 'neutral'

  // Mood-based overrides for neutral/ambiguous triggers
  if ((trigger === 'quiz_wrong' || trigger === 'idle') && mood === 'snarky') {
    exprId = 'snarky'
  }

  return GAIA_EXPRESSIONS[exprId] ?? GAIA_EXPRESSIONS.neutral
}

/** Short display name shown in UI headers */
export const GAIA_NAME = 'G.A.I.A.'

/** Full expanded name shown in tooltip / About section */
export const GAIA_FULL_NAME = 'Geological Analytical Intelligence Assistant'

/** One-line tagline shown below the full name */
export const GAIA_TAGLINE = 'Your AI companion, since the crash...'
