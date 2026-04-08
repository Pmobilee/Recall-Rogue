/**
 * narrativeTypes.ts — Data types for the Woven Narrative Architecture.
 *
 * Pure data interfaces only — no logic, no imports from game code.
 * Any service may import from this file without creating circular deps.
 *
 * Design spec: docs/mechanics/narrative.md
 * Status: IMPLEMENTATION — supports the four-thread procedural narrative system.
 */

// ============================================================
// TYPE ALIASES
// ============================================================

/**
 * Classification of a quiz answer for narrative gravity evaluation.
 * Used to select appropriate echo templates and determine gravity level.
 */
export type AnswerType =
  | 'person'
  | 'place'
  | 'date'
  | 'number'
  | 'concept'
  | 'foreign_word'
  | 'object';

/**
 * Three-tier gravity system controlling whether an answer may appear in dark RPG prose.
 * - high: always safe for dramatic echo templates
 * - medium: neutral templates only
 * - low: answer-free fallback templates only — never named in prose
 */
export type GravityLevel = 'high' | 'medium' | 'low';

/**
 * The four concurrent narrative threads assembled per room transition.
 * - descent: structural arc tied to floor progression and archetype beats
 * - echo: fact-reactive references to knowledge the player has encountered
 * - seeker: character arc responding to HP, streaks, relics, and mastery
 * - inhabitants: NPC dialogue with within-run memory
 * - ambient: answer-free fallback lines when no other thread fires
 */
export type NarrativeThread = 'descent' | 'echo' | 'seeker' | 'inhabitants' | 'ambient';

/**
 * Trigger points for Descent Archetype beats across the run lifecycle.
 */
export type BeatTrigger =
  | 'run_start'
  | 'first_boss_kill'
  | 'floor_2_start'
  | 'mid_run'
  | 'pre_final'
  | 'run_victory'
  | 'run_defeat';

// ============================================================
// ECHO SYSTEM
// ============================================================

/**
 * A fact the player has encountered during this run, ready for narrative reference.
 * Facts are only eligible for echoes after the player has been quizzed on them
 * (correct or incorrect). The narrative NEVER references unseen facts.
 */
export interface FactEcho {
  /** Stable fact identifier. */
  factId: string;
  /** The correctAnswer field from the fact (English translation for vocab facts). */
  answer: string;
  /**
   * The string to use in echo templates:
   * - Vocab decks: the foreign word extracted from quizQuestion (e.g. "abandonar")
   * - Knowledge decks: same as correctAnswer
   */
  echoText: string;
  /** Original quiz question, used in context_echo templates when echoText alone is thin. */
  quizQuestion: string;
  /** Answer type derived by classifyAnswerType(). Controls which templates are eligible. */
  answerType: AnswerType;
  /** Gravity level derived by scoreGravity(). Controls whether this fact may appear in prose. */
  gravity: GravityLevel;
  /** Knowledge domain of the source deck (e.g. "history", "science", "language"). */
  domain: string;
  /** Whether the player answered correctly. Wrong-answer echoes draw from this. */
  wasCorrect: boolean;
  /** Room number when this fact was encountered (1-indexed within the run). */
  roomNumber: number;
  /** Time the player took to answer in milliseconds. >3000ms indicates deeper engagement. */
  responseTimeMs?: number;
  /** Chain color this fact belonged to, if any. */
  chainColor?: string;
}

// ============================================================
// RUN STATE
// ============================================================

/**
 * Per-run narrative state maintained by the narrative engine.
 * Initialized at run start, persisted across rooms, discarded on run end.
 */
export interface RunNarrativeState {
  /** Selected Descent Archetype ID for this run. */
  archetypeId: string;
  /** Selected Domain Lens ID for this run, derived from deck category. */
  domainLensId: string;
  /** Index into the archetype's beats array (0 = first beat not yet shown). */
  currentBeat: number;
  /** All facts encountered during this run, in encounter order. */
  memorableFacts: FactEcho[];
  /**
   * Set of factIds already used in echo lines this run.
   * The same fact is never echoed twice per run.
   */
  echoesShown: Set<string>;
  /** Answer sequences from chain completions (for chain echo arrows). */
  lastChainCompletion: string[];
  /** Number of shop rooms visited this run. */
  shopVisits: number;
  /** Number of rest rooms visited this run. */
  restVisits: number;
  /** Number of mystery rooms visited this run. */
  mysteryVisits: number;
  /** Type of the player's last shop purchase, if any. */
  lastShopPurchaseType?: 'card' | 'relic' | 'heal';
  /** Action taken at the last rest site. */
  lastRestAction?: 'rest' | 'upgrade';
  /** Player HP as a fraction of max HP at the start of the previous room (0.0–1.0). */
  prevHpPercent: number;
  /** Consecutive correct answer streak at the start of the previous room. */
  prevStreak: number;
  /** Number of relics held at the start of the previous room. */
  prevRelicCount: number;
  /** IDs of all relics the player has acquired this run. */
  relicsSeen: string[];
  /**
   * Set of narrative line IDs already shown this run.
   * Prevents exact-same authored text from repeating.
   */
  linesShown: Set<string>;
  /**
   * Per-thread cooldown: minimum room number before that thread may fire again.
   * Prevents any single thread from dominating consecutive rooms.
   */
  threadCooldowns: Map<NarrativeThread, number>;
  /**
   * Smart narration ratio tracking (Task 4.5 — Ch4 narrative overhaul).
   * 'Smart' lines are those from Echo/Seeker/Inhabitants/Descent threads that
   * contain run-specific content (fact echoes, state reactions, archetype beats).
   * 'Generic' lines are ambient fallbacks.
   *
   * Used to detect template starvation: if smartCount/totalCount < 0.65 at the
   * midpoint (floor 2 or after 5 rooms), Seeker thread selection gets a ×1.5
   * weight boost so run-specific content appears more frequently.
   */
  smartNarrativeCount: number;
  /** Total narrative lines emitted this run (smart + generic). */
  totalNarrativeCount: number;
  /**
   * Whether the ×1.5 Seeker weight boost is active.
   * Set to true at midpoint if smartCount/totalCount < 0.65.
   */
  seekerBoostActive: boolean;
}

// ============================================================
// ENGINE OUTPUT
// ============================================================

/**
 * A single resolved narrative line emitted by the engine for one room transition.
 * The engine assembles 1-3 lines per room from different threads.
 */
export interface NarrativeLine {
  /** Thread that produced this line. */
  thread: NarrativeThread;
  /** ID of the template that was selected (for deduplication tracking). */
  templateId: string;
  /**
   * Fully resolved text with all placeholders substituted.
   * Ready for direct display — no further processing needed.
   */
  text: string;
  /** factId this line references, if it is an echo line. */
  factId?: string;
}

// ============================================================
// YAML DATA TYPES (loaded from data/narratives/)
// ============================================================

/**
 * A single beat in a Descent Archetype — tied to a specific run progression trigger.
 * Template text uses {lens_field} placeholders filled by the Domain Lens at render time.
 */
export interface ArchetypeBeat {
  /** When in the run this beat fires. */
  trigger: BeatTrigger;
  /** Template text with {setting_noun}, {knowledge_noun}, and other lens field placeholders. */
  text: string;
}

/**
 * A conditional Descent line that fires when a state condition is met.
 * Unlike beats (which fire once in sequence), branches check conditions every room.
 */
export interface ArchetypeBranch {
  /**
   * Condition expression, e.g. "hp_below_30", "streak_5_plus", "many_relics".
   * Evaluated by the narrative engine against current RunNarrativeState.
   */
  condition: string;
  /**
   * Event that triggers the branch check, e.g. "any_room_enter", "chain_complete".
   */
  trigger: string;
  /** Template text, may use lens field placeholders. */
  text: string;
  /** If true, this branch fires at most once per run. */
  once: boolean;
}

/**
 * A Descent Archetype — the structural backbone of a run's narrative.
 * 12 universal archetypes are pre-authored; one is selected at run start.
 */
export interface DescentArchetype {
  /** Unique identifier matching YAML filename (e.g. "lost_archive"). */
  id: string;
  /** Display name (e.g. "The Lost Archive"). */
  name: string;
  /**
   * Which deck types this archetype is eligible for.
   * - 'universal': any deck
   * - 'knowledge': knowledge decks only
   * - 'vocab': vocabulary decks only
   * - string[]: specific deck IDs only
   */
  scope: 'universal' | 'knowledge' | 'vocab' | string[];
  /** Ordered sequence of beats, one per major run progression trigger. */
  beats: ArchetypeBeat[];
  /** Conditional branches checked every room for supplementary lines. */
  branches: ArchetypeBranch[];
}

/**
 * A Domain Lens — vocabulary set that transforms generic archetype templates
 * into domain-specific prose for a particular knowledge category.
 * ~15 lenses cover all deck categories.
 */
export interface DomainLens {
  /** Unique identifier (e.g. "history_ancient", "language_european"). */
  id: string;
  /** Deck category IDs this lens applies to (e.g. ["history_ancient", "history_classical"]). */
  deckCategories: string[];
  /**
   * Named vocabulary fields substituted into archetype templates.
   * Standard fields include: setting_noun, knowledge_noun, knowledge_plural,
   * discovery_verb, container_noun, guardian_noun, danger_noun, atmosphere, material.
   */
  fields: Record<string, string>;
}

/**
 * An Echo Chamber template — references specific knowledge the player encountered.
 * Templates use {echoText}, {quizQuestion}, and chain placeholders {a1}–{a5}.
 */
export interface EchoTemplate {
  /** Unique template identifier (for deduplication tracking). */
  id: string;
  /**
   * Template text. Placeholders:
   * - {echoText}: the foreign word or correct answer
   * - {quizQuestion}: the original quiz question
   * - {a1}–{a5}: individual answers in a chain completion sequence
   */
  text: string;
  /**
   * Minimum gravity level required for this template to be eligible.
   * Templates with dramatic framing require 'high' gravity.
   * Neutral templates accept 'medium' or higher.
   */
  minGravity: GravityLevel;
  /**
   * Optional additional condition beyond gravity, e.g. "echoText_length_lt_12".
   * Evaluated by the narrative engine at selection time.
   */
  condition?: string;
}

/**
 * A single greeting variant for an Inhabitant NPC, keyed by visit number.
 * 'default' applies on all visits not explicitly listed.
 */
export interface InhabitantGreeting {
  /** 1-indexed visit count this greeting applies to, or 'default' as fallback. */
  visitNumber: number | 'default';
  /** Greeting text (no placeholders — direct authored prose). */
  text: string;
}

/**
 * Dialogue data for a single Inhabitant NPC.
 * NPCs remember prior interactions within the run and react to player state.
 */
export interface InhabitantDialogue {
  /** NPC identifier (e.g. "the_oracle", "the_merchant", "the_warden"). */
  npc: string;
  /** Personality descriptor influencing tone (e.g. "cryptic", "sardonic", "weary"). */
  personality: string;
  /** Ordered greeting variants by visit count. */
  greeting: InhabitantGreeting[];
  /**
   * State-reactive lines keyed by condition string.
   * Conditions match the same vocabulary as Seeker thread conditions
   * (e.g. "hp_below_30", "streak_5_plus", "many_relics").
   */
  stateReactive: Record<string, string>;
  /** NPC-specific dialogue fields vary; use Record for extensibility. */
  [key: string]: unknown;
}

/**
 * A Seeker thread line — responds to player state changes (HP, streak, relics, mastery).
 */
export interface SeekerLine {
  /** Unique line identifier (for deduplication tracking). */
  id: string;
  /**
   * Condition that must be true for this line to fire.
   * Matches the state condition vocabulary from docs/mechanics/narrative.md §Thread 3.
   */
  condition: string;
  /** Authored line text (no placeholders). */
  text: string;
}

/**
 * A relic callback line — fires when the player carries a specific relic
 * and enters a specific room type or meets a condition.
 */
export interface RelicCallback {
  /** Relic identifier matching src/data/relics/ entries. */
  relicId: string;
  /**
   * Condition for this callback to fire (e.g. "hp_below_30", "shop_visit",
   * "chain_complete", "post_boss", "rest_visit", "mystery_visit", "any_room").
   */
  condition: string;
  /** Authored line text, typically references the relic by name. */
  text: string;
}

/**
 * A fallback ambient line shown when no other thread produces output for a room.
 * Answer-free — never references specific knowledge.
 */
export interface AmbientLine {
  /** Unique line identifier (for deduplication tracking). */
  id: string;
  /** Short, atmospheric authored text. */
  text: string;
}
