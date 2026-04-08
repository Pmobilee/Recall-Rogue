/**
 * narrativeEngine.ts — Core weaving algorithm for the Woven Narrative Architecture.
 *
 * Stateful service that maintains RunNarrativeState across a run and assembles
 * 1-3 narrative lines per room transition from four concurrent threads:
 * Descent, Echo, Seeker, and Inhabitants.
 *
 * Design spec: docs/mechanics/narrative.md §The Weaving Engine
 * Status: IMPLEMENTATION
 *
 * Key constraints:
 * - Never reference facts the player has not been quizzed on this run.
 * - Same template never shown twice per run (linesShown dedup).
 * - Same fact never echoed twice per run (echoesShown dedup).
 * - Echo thread fires at most every other room (2-room cooldown).
 * - Never two lines from the same thread in one room transition.
 */

import type {
  RunNarrativeState,
  NarrativeLine,
  NarrativeThread,
  FactEcho,
  BeatTrigger,
  EchoTemplate,
  GravityLevel,
} from './narrativeTypes';
import type { RunState } from './runManager';
import {
  loadAllArchetypes,
  loadAllLenses,
  loadEchoTemplates,
  loadInhabitant,
  loadSeekerLines,
  loadRelicCallbacks,
  loadAmbientLines,
  isNarrativeDataReady,
} from './narrativeLoader';
import {
  classifyAnswerType,
  scoreGravity,
  buildEchoText,
} from './narrativeGravity';

// ============================================================
// MODULE-LEVEL STATE (pattern mirrors turnManager)
// ============================================================

let _state: RunNarrativeState | null = null;

/** Running room counter incremented each call to getNarrativeLines. */
let _currentRoom = 0;

// ============================================================
// INPUT TYPES
// ============================================================

/** Data collected from an encounter for narrative purposes. */
export interface EncounterNarrativeData {
  correctAnswers: Array<{
    factId: string;
    answer: string;
    quizQuestion: string;
    partOfSpeech?: string;
    responseTimeMs?: number;
  }>;
  wrongAnswers: Array<{
    factId: string;
    answer: string;
    quizQuestion: string;
  }>;
  /** Arrays of echoText values for each chain that reached 3+ answers. */
  chainCompletions: string[][];
  enemyId?: string;
  isBoss: boolean;
  isElite: boolean;
  /** Knowledge domain of the source deck (e.g. "history", "language"). */
  domain: string;
}

/** Context provided for each room transition. */
export interface NarrativeContext {
  roomType: 'combat' | 'elite' | 'boss' | 'mystery' | 'rest' | 'treasure' | 'shop';
  isPostBoss: boolean;
  isPostEncounter: boolean;
  floor: number;
  segment: 1 | 2 | 3 | 4;
  playerHp: number;
  playerMaxHp: number;
  relicIds: string[];
  currentStreak: number;
  /** Names of the 3 run chain types (e.g. ["Crimson", "Obsidian", "Azure"]). */
  chainColors: string[];
  /** Which chain has been used most this run. */
  dominantChainColor?: string;
  topicLabels?: string[];
  /**
   * ID of the mystery event that was resolved (e.g. "tutor", "flashcard_merchant").
   * Only set when roomType === "mystery" and narration fires on exit.
   * When set, getNarrativeLines checks for pool-specific templates first;
   * falls back to global mystery pool if none are found.
   * Template authoring is content-agent work — infrastructure only here.
   */
  mysteryRoomId?: string;
}

// ============================================================
// SEEDED RNG (LCG — same algorithm as chainDistribution.ts)
// ============================================================

/** LCG state for deterministic archetype/template selection. */
function makeLcg(seed: number): { next: (range: number) => number } {
  let s = seed;
  return {
    next(range: number): number {
      s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (s >>> 0) % range;
    },
  };
}

// ============================================================
// TEMPLATE FILLING
// ============================================================

/**
 * Replace `{key}` and `{key|capitalize}` placeholders in a template string.
 * Unknown keys are left as-is so missing vars don't crash the engine.
 */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)(?:\|(\w+))?\}/g, (_match, key: string, modifier?: string) => {
    const value = vars[key];
    if (value === undefined) return _match; // leave placeholder if key not found
    if (modifier === 'capitalize') {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  });
}

// ============================================================
// ARCHETYPE + LENS SELECTION
// ============================================================

/** Map deck domain string to a lens ID. Falls back to general_trivia. */
function selectLensForDomain(domain: string): string {
  // Exact match first
  const allLenses = isNarrativeDataReady() ? loadAllLenses() : [];
  for (const lens of allLenses) {
    if (lens.deckCategories.includes(domain)) {
      return lens.id;
    }
  }
  // Partial prefix match (e.g. domain "history_ancient" → lens "history_ancient")
  for (const lens of allLenses) {
    if (lens.id === domain) return lens.id;
  }
  // Prefix match (e.g. "history" covers "history_ancient")
  for (const lens of allLenses) {
    if (domain.startsWith(lens.id) || lens.id.startsWith(domain.split('_')[0])) {
      return lens.id;
    }
  }
  return 'general_trivia';
}

/** Select an archetype for the run deterministically from the seed. */
function selectArchetypeForRun(runSeed: number, domain: string, deckMode?: { type?: string }): string {
  if (!isNarrativeDataReady()) return 'lost_archive';

  const allArchetypes = loadAllArchetypes();
  const deckType = deckMode?.type === 'study' ? 'knowledge' : 'vocab';

  const eligible = allArchetypes.filter(a => {
    if (a.scope === 'universal') return true;
    if (a.scope === 'knowledge' && deckType === 'knowledge') return true;
    if (a.scope === 'vocab' && deckType === 'vocab') return true;
    if (Array.isArray(a.scope) && a.scope.includes(domain)) return true;
    return false;
  });

  if (eligible.length === 0) return allArchetypes[0]?.id ?? 'lost_archive';

  const rng = makeLcg(runSeed ^ 0xDEAD_BEEF);
  const idx = rng.next(eligible.length);
  return eligible[idx].id;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Initialize narrative state for a new run.
 * Must be called once before any other engine function.
 * Selects archetype and domain lens deterministically from the run seed.
 */
export function initNarrative(runState: RunState): void {
  const domain = runState.primaryDomain ?? 'general_trivia';
  const lensId = selectLensForDomain(domain);
  const archetypeId = selectArchetypeForRun(runState.runSeed, domain, runState.deckMode);

  _state = {
    archetypeId,
    domainLensId: lensId,
    currentBeat: 0,
    memorableFacts: [],
    echoesShown: new Set(),
    lastChainCompletion: [],
    shopVisits: 0,
    restVisits: 0,
    mysteryVisits: 0,
    lastShopPurchaseType: undefined,
    lastRestAction: undefined,
    prevHpPercent: 1.0,
    prevStreak: 0,
    prevRelicCount: 0,
    relicsSeen: [],
    linesShown: new Set(),
    threadCooldowns: new Map(),
  };

  _currentRoom = 0;

  if (import.meta.env.DEV) {
    console.log(`[NarrativeEngine] Init — archetype: ${archetypeId}, lens: ${lensId}`);
  }
}

/**
 * Record encounter results after combat, building FactEcho entries.
 * Call from onEncounterComplete (after victory only).
 */
export function recordEncounterResults(results: EncounterNarrativeData): void {
  if (!_state) return;

  const roomNum = _currentRoom;

  // Build FactEcho entries for correct answers
  for (const ca of results.correctAnswers) {
    const answerType = classifyAnswerType(
      ca.answer,
      ca.quizQuestion,
      ca.partOfSpeech,
      results.domain,
    );
    const echoText = buildEchoText(ca.answer, ca.quizQuestion, ca.partOfSpeech);
    const gravity = scoreGravity(answerType, results.domain, echoText.length);

    const echo: FactEcho = {
      factId: ca.factId,
      answer: ca.answer,
      echoText,
      quizQuestion: ca.quizQuestion,
      answerType,
      gravity,
      domain: results.domain,
      wasCorrect: true,
      roomNumber: roomNum,
      responseTimeMs: ca.responseTimeMs,
    };
    _state.memorableFacts.push(echo);
  }

  // Build FactEcho entries for wrong answers (low priority echoes)
  for (const wa of results.wrongAnswers) {
    const answerType = classifyAnswerType(wa.answer, wa.quizQuestion, undefined, results.domain);
    const echoText = buildEchoText(wa.answer, wa.quizQuestion);
    const gravity = scoreGravity(answerType, results.domain, echoText.length);

    const echo: FactEcho = {
      factId: wa.factId,
      answer: wa.answer,
      echoText,
      quizQuestion: wa.quizQuestion,
      answerType,
      gravity,
      domain: results.domain,
      wasCorrect: false,
      roomNumber: roomNum,
    };
    _state.memorableFacts.push(echo);
  }

  // Store last chain completion (most recent chain with 3+ answers)
  if (results.chainCompletions.length > 0) {
    _state.lastChainCompletion = results.chainCompletions[results.chainCompletions.length - 1];
  }
}

/**
 * Record a shop purchase for Merchant dialogue state-reactive lines.
 */
export function recordShopPurchase(type: 'card' | 'relic' | 'heal'): void {
  if (!_state) return;
  _state.lastShopPurchaseType = type;
}

/**
 * Record a rest action for Keeper dialogue state-reactive lines.
 */
export function recordRestAction(action: 'rest' | 'upgrade'): void {
  if (!_state) return;
  _state.lastRestAction = action;
}

/**
 * Get current narrative state (for the Expedition Journal display).
 * Returns null before initNarrative() is called or after resetNarrative().
 */
export function getNarrativeState(): RunNarrativeState | null {
  return _state;
}

/**
 * Reset narrative state on run end.
 */
export function resetNarrative(): void {
  _state = null;
  _currentRoom = 0;
}

/**
 * Main entry point — assemble narrative lines for the current room transition.
 *
 * Returns 1-3 NarrativeLine objects from different threads, ready for display.
 * Returns empty array if narrative data is not ready or state is not initialized.
 */
export function getNarrativeLines(context: NarrativeContext): NarrativeLine[] {
  if (!_state || !isNarrativeDataReady()) {
    if (_state && !isNarrativeDataReady()) {
      console.warn('[NarrativeEngine] Data not ready, skipping narrative lines');
    }
    return [];
  }

  _currentRoom += 1;
  const state = _state;

  // Increment NPC visit counters before selecting lines
  if (context.roomType === 'shop') state.shopVisits += 1;
  if (context.roomType === 'rest') state.restVisits += 1;
  if (context.roomType === 'mystery') state.mysteryVisits += 1;

  // ── Mystery room pool-specific template check (13.4 infrastructure) ──
  // When mysteryRoomId is set, a per-event template pool can be checked here.
  // No per-event pools are authored yet — this is the hook point for content-agent.
  // Pattern: if (context.mysteryRoomId) { check pool for context.mysteryRoomId; if found, use it; else fall through }

  // Update relic tracking for callbacks
  for (const rid of context.relicIds) {
    if (!state.relicsSeen.includes(rid)) {
      state.relicsSeen.push(rid);
    }
  }

  // Determine HP band for seeker detection
  const hpPercent = context.playerMaxHp > 0 ? context.playerHp / context.playerMaxHp : 1.0;

  // Determine line budget
  const budget = getBudget(context);

  // Build lens vars for template filling
  const lensVars = buildLensVars(state.domainLensId, context);

  const lines: NarrativeLine[] = [];
  const usedThreads = new Set<NarrativeThread>();

  // ── PRIORITY 1: Inhabitants — always fire for special rooms ──
  if (lines.length < budget && !usedThreads.has('inhabitants')) {
    const inhabitantLine = selectInhabitantLine(state, context, lensVars);
    if (inhabitantLine) {
      lines.push(inhabitantLine);
      usedThreads.add('inhabitants');
    }
  }

  // ── PRIORITY 2: Descent beats — structural arc moments ──
  if (lines.length < budget && !usedThreads.has('descent')) {
    const beatTrigger = getBeatTrigger(context, state);
    const descentLine = selectDescentLine(state, beatTrigger, context, lensVars);
    if (descentLine) {
      lines.push(descentLine);
      usedThreads.add('descent');
    }
  }

  // ── PRIORITY 3: Echo — fact-reactive references, at most every other room ──
  if (lines.length < budget && !usedThreads.has('echo')) {
    const echoCooldown = state.threadCooldowns.get('echo') ?? 0;
    if (_currentRoom >= echoCooldown && context.isPostEncounter) {
      const echoLine = selectEchoLine(state, context, lensVars);
      if (echoLine) {
        lines.push(echoLine);
        usedThreads.add('echo');
        // Cooldown: echo cannot fire for the next 2 rooms
        state.threadCooldowns.set('echo', _currentRoom + 2);
      }
    }
  }

  // ── PRIORITY 4: Seeker — fires on state change only ──
  if (lines.length < budget && !usedThreads.has('seeker')) {
    const seekerCooldown = state.threadCooldowns.get('seeker') ?? 0;
    if (_currentRoom >= seekerCooldown) {
      const seekerLine = selectSeekerLine(state, context, hpPercent, lensVars);
      if (seekerLine) {
        lines.push(seekerLine);
        usedThreads.add('seeker');
        state.threadCooldowns.set('seeker', _currentRoom + 2);
      }
    }
  }

  // ── FALLBACK: Ambient — fills remaining budget ──
  if (lines.length < budget && !usedThreads.has('ambient')) {
    const ambientCooldown = state.threadCooldowns.get('ambient') ?? 0;
    if (_currentRoom >= ambientCooldown) {
      const ambientLine = selectAmbientLine(state, lensVars);
      if (ambientLine) {
        lines.push(ambientLine);
        usedThreads.add('ambient');
        state.threadCooldowns.set('ambient', _currentRoom + 1);
      }
    }
  }

  // Update prev-state for next room's change detection
  state.prevHpPercent = hpPercent;
  state.prevStreak = context.currentStreak;
  state.prevRelicCount = context.relicIds.length;

  return lines;
}

// ============================================================
// BUDGET
// ============================================================

/** Determine maximum lines to show for this room type. */
function getBudget(context: NarrativeContext): number {
  if (context.isPostBoss) return 3;
  if (context.roomType === 'mystery' || context.roomType === 'rest' || context.roomType === 'shop') {
    return 3; // NPC rooms: greeting + state line + optional
  }
  if (context.roomType === 'boss') return 2;
  if (context.roomType === 'treasure') return 1;
  // combat / elite: 1-2
  return context.isPostEncounter ? 2 : 1;
}

// ============================================================
// LENS VARS
// ============================================================

/** Build the variable map for template filling from the domain lens + context. */
function buildLensVars(lensId: string, context: NarrativeContext): Record<string, string> {
  const vars: Record<string, string> = {};

  // Load lens fields
  try {
    const allLenses = loadAllLenses();
    const lens = allLenses.find(l => l.id === lensId);
    if (lens) {
      for (const [k, v] of Object.entries(lens.fields)) {
        vars[k] = v;
      }
    }
  } catch {
    // Lens not found; proceed with minimal vars
  }

  // Chain color vars
  for (let i = 0; i < context.chainColors.length; i++) {
    vars[`chain_${i}_color`] = context.chainColors[i] ?? '';
  }
  if (context.dominantChainColor) {
    vars['dominant_chain_color'] = context.dominantChainColor;
  }
  vars['roomNumber'] = String(_currentRoom);
  vars['floor'] = String(context.floor);

  return vars;
}

// ============================================================
// BEAT TRIGGER DETECTION
// ============================================================

/** Derive the BeatTrigger for the current context, or null if no beat fires. */
function getBeatTrigger(context: NarrativeContext, state: RunNarrativeState): BeatTrigger | null {
  // run_start: first room of floor 1
  if (context.floor === 1 && _currentRoom === 1) return 'run_start';
  // floor_2_start: entering floor 2 for the first time
  if (context.floor === 2 && state.prevHpPercent >= 0 && _currentRoom <= 8) {
    // Heuristic: floor 2 first room has room number ~5-7 range
    // We detect via segment transition
    if (context.segment === 2 && state.currentBeat <= 1) return 'floor_2_start';
  }
  // first_boss_kill: post-boss on floor <=2
  if (context.isPostBoss && context.floor <= 2) return 'first_boss_kill';
  // mid_run: segment 2 mid-point
  if (context.segment === 2 && !context.isPostBoss && state.currentBeat <= 3) return 'mid_run';
  // pre_final: entering floor 3 boss area
  if (context.floor >= 3 && context.roomType === 'boss' && !context.isPostBoss) return 'pre_final';
  // run_victory / run_defeat are handled externally via context roomType markers
  return null;
}

// ============================================================
// DESCENT THREAD
// ============================================================

/** Select a Descent beat or branch line if one is eligible. */
function selectDescentLine(
  state: RunNarrativeState,
  beatTrigger: BeatTrigger | null,
  context: NarrativeContext,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  if (!isNarrativeDataReady()) return null;

  let archetype;
  try {
    const allArchetypes = loadAllArchetypes();
    archetype = allArchetypes.find(a => a.id === state.archetypeId);
  } catch {
    return null;
  }
  if (!archetype) return null;

  const descentCooldown = state.threadCooldowns.get('descent') ?? 0;
  if (_currentRoom < descentCooldown) return null;

  // Check beats: fire the current beat if its trigger matches
  if (beatTrigger !== null && state.currentBeat < archetype.beats.length) {
    const beat = archetype.beats[state.currentBeat];
    if (beat && beat.trigger === beatTrigger) {
      const templateId = `${state.archetypeId}_beat_${state.currentBeat}`;
      if (!state.linesShown.has(templateId)) {
        const text = fillTemplate(beat.text, lensVars);
        state.linesShown.add(templateId);
        state.currentBeat += 1;
        state.threadCooldowns.set('descent', _currentRoom + 3);
        return { thread: 'descent', templateId, text };
      }
    }
  }

  // Check branches: fire if condition met and not once-already-shown
  const hpPercent = context.playerMaxHp > 0 ? context.playerHp / context.playerMaxHp : 1.0;
  for (const branch of archetype.branches) {
    const branchId = `${state.archetypeId}_branch_${branch.condition}`;
    if (branch.once && state.linesShown.has(branchId)) continue;
    if (!evaluateBranchCondition(branch.condition, branch.trigger, context, hpPercent, state)) continue;

    const text = fillTemplate(branch.text, lensVars);
    state.linesShown.add(branchId);
    state.threadCooldowns.set('descent', _currentRoom + 2);
    return { thread: 'descent', templateId: branchId, text };
  }

  return null;
}

/** Evaluate a branch condition string against current state. */
function evaluateBranchCondition(
  condition: string,
  trigger: string,
  context: NarrativeContext,
  hpPercent: number,
  _state: RunNarrativeState,
): boolean {
  // Trigger check
  if (trigger === 'chain_complete' && _state.lastChainCompletion.length === 0) return false;
  if (trigger === 'shop_visit' && context.roomType !== 'shop') return false;
  if (trigger === 'rest_visit' && context.roomType !== 'rest') return false;
  if (trigger === 'mystery_visit' && context.roomType !== 'mystery') return false;
  if (trigger === 'post_boss' && !context.isPostBoss) return false;

  // Condition check
  if (condition === 'hp_below_30') return hpPercent < 0.3;
  if (condition === 'hp_above_80') return hpPercent > 0.8;
  if (condition === 'hp_30_to_80') return hpPercent >= 0.3 && hpPercent <= 0.8;
  if (condition === 'streak_5_plus') return context.currentStreak >= 5;
  if (condition === 'streak_3_plus') return context.currentStreak >= 3;
  if (condition === 'streak_broken') {
    return _state.prevStreak >= 3 && context.currentStreak === 0;
  }
  if (condition === 'many_relics') return context.relicIds.length >= 4;
  if (condition === 'post_boss') return context.isPostBoss;
  if (condition === 'chain_complete') return _state.lastChainCompletion.length > 0;
  if (condition === 'floor_1') return context.floor === 1;
  if (condition === 'floor_2') return context.floor === 2;
  if (condition === 'floor_3') return context.floor >= 3;

  // Unknown conditions fire by default (content author responsibility)
  return true;
}

// ============================================================
// ECHO THREAD
// ============================================================

/** Select the best echo line from the most recent encounter. */
function selectEchoLine(
  state: RunNarrativeState,
  _context: NarrativeContext,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  if (!isNarrativeDataReady()) return null;

  // First: check if a chain completion echo is appropriate
  if (state.lastChainCompletion.length >= 3) {
    const chainLine = buildChainCompletionLine(state, lensVars);
    if (chainLine) {
      state.lastChainCompletion = []; // consume
      return chainLine;
    }
  }

  // Find best fact from memorable facts not yet echoed
  const candidates = state.memorableFacts.filter(
    f => !state.echoesShown.has(f.factId) && f.wasCorrect,
  );

  if (candidates.length === 0) {
    // Fallback: wrong answers
    const wrongCandidates = state.memorableFacts.filter(
      f => !state.echoesShown.has(f.factId) && !f.wasCorrect,
    );
    if (wrongCandidates.length > 0) {
      const fact = wrongCandidates[wrongCandidates.length - 1];
      return buildWrongAnswerLine(state, fact, lensVars);
    }
    return buildAnswerFreeLine(state, lensVars);
  }

  // Score candidates: prefer high gravity, chain involvement, longer response time
  const scored = candidates.map(f => {
    let score = 0;
    if (f.gravity === 'high') score += 3;
    else if (f.gravity === 'medium') score += 1;
    if (f.chainColor) score += 2;
    if ((f.responseTimeMs ?? 0) > 3000) score += 1;
    return { fact: f, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0].fact;
  return buildEchoLineForFact(state, best, lensVars);
}

/** Build an echo line for a single fact based on its gravity. */
function buildEchoLineForFact(
  state: RunNarrativeState,
  fact: FactEcho,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  const { gravity, answerType, echoText } = fact;

  // Determine which template category to use
  let templateCategory: string;
  if (gravity === 'high') {
    templateCategory = answerType; // dramatic echo
  } else if (gravity === 'medium' && echoText.length < 12) {
    templateCategory = 'context'; // context echo uses quizQuestion
  } else if (gravity === 'medium') {
    templateCategory = answerType; // neutral template
  } else {
    // low gravity — answer-free fallback UNLESS this is the first echo of the run
    if (state.echoesShown.size === 0) {
      // First echo: always fact-specific to establish narrative knowledge-weaving.
      // 'context' category uses quizQuestion rather than the answer text, so even
      // short answers produce meaningful echoes like:
      //   "'What does 的確 mean?' — carried through three floors of stone."
      templateCategory = 'context';
    } else {
      return buildAnswerFreeLine(state, lensVars);
    }
  }

  const templates = loadEchoTemplates(templateCategory);
  const eligible = filterEligibleEchoTemplates(templates, gravity, fact, state);

  if (eligible.length === 0) {
    // Try answer_free as fallback
    return buildAnswerFreeLine(state, lensVars);
  }

  const rng = makeLcg(state.memorableFacts.length ^ fact.factId.charCodeAt(0));
  const template = eligible[rng.next(eligible.length)];

  const vars: Record<string, string> = {
    ...lensVars,
    echoText: fact.echoText,
    answer: fact.answer,
    quizQuestion: fact.quizQuestion,
  };
  const text = fillTemplate(template.text, vars);

  state.echoesShown.add(fact.factId);
  state.linesShown.add(template.id);

  return { thread: 'echo', templateId: template.id, text, factId: fact.factId };
}

/** Filter echo templates by gravity and condition. */
function filterEligibleEchoTemplates(
  templates: EchoTemplate[],
  gravity: GravityLevel,
  fact: FactEcho,
  state: RunNarrativeState,
): EchoTemplate[] {
  const gravityOrder: GravityLevel[] = ['low', 'medium', 'high'];
  const gIdx = gravityOrder.indexOf(gravity);

  return templates.filter(t => {
    // Must not already be shown
    if (state.linesShown.has(t.id)) return false;
    // Gravity must meet template minimum
    const tIdx = gravityOrder.indexOf(t.minGravity);
    if (gIdx < tIdx) return false;
    // Optional condition
    if (t.condition) {
      if (t.condition === 'echoText_length_lt_12' && fact.echoText.length >= 12) return false;
      if (t.condition === 'echoText_length_gte_12' && fact.echoText.length < 12) return false;
    }
    return true;
  });
}

/** Build a chain completion echo line. */
function buildChainCompletionLine(
  state: RunNarrativeState,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  const chain = state.lastChainCompletion;
  const templates = loadEchoTemplates('chain_completion');
  const eligible = templates.filter(t => !state.linesShown.has(t.id));
  if (eligible.length === 0) return null;

  const rng = makeLcg(chain.length ^ (chain[0]?.charCodeAt(0) ?? 1));
  const template = eligible[rng.next(eligible.length)];

  const vars: Record<string, string> = { ...lensVars };
  for (let i = 0; i < 5; i++) {
    vars[`a${i + 1}`] = chain[i] ?? '';
  }

  const text = fillTemplate(template.text, vars);
  state.linesShown.add(template.id);

  return { thread: 'echo', templateId: template.id, text };
}

/** Build a wrong-answer echo line. */
function buildWrongAnswerLine(
  state: RunNarrativeState,
  fact: FactEcho,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  const templates = loadEchoTemplates('wrong_answer');
  const eligible = templates.filter(t => !state.linesShown.has(t.id));
  if (eligible.length === 0) return null;

  const rng = makeLcg(fact.factId.charCodeAt(0));
  const template = eligible[rng.next(eligible.length)];

  const text = fillTemplate(template.text, lensVars);
  state.linesShown.add(template.id);
  state.echoesShown.add(fact.factId);

  return { thread: 'echo', templateId: template.id, text, factId: fact.factId };
}

/** Build an answer-free echo line when no fact has sufficient gravity. */
function buildAnswerFreeLine(
  state: RunNarrativeState,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  const templates = loadEchoTemplates('answer_free');
  const eligible = templates.filter(t => !state.linesShown.has(t.id));
  if (eligible.length === 0) return null;

  const rng = makeLcg(_currentRoom ^ 0x5A5A);
  const template = eligible[rng.next(eligible.length)];

  const text = fillTemplate(template.text, lensVars);
  state.linesShown.add(template.id);

  return { thread: 'echo', templateId: template.id, text };
}

// ============================================================
// SEEKER THREAD
// ============================================================

/** Select a Seeker line based on state changes since the last room. */
function selectSeekerLine(
  state: RunNarrativeState,
  context: NarrativeContext,
  hpPercent: number,
  _lensVars: Record<string, string>,
): NarrativeLine | null {
  if (!isNarrativeDataReady()) return null;

  // Detect what changed
  const conditions: string[] = [];

  // HP band crossing
  const prevBand = hpBand(state.prevHpPercent);
  const currBand = hpBand(hpPercent);
  if (prevBand !== currBand) {
    conditions.push(`hp_${currBand.replace('-', '_to_')}`);
  }
  if (hpPercent < 0.3) conditions.push('hp_below_30');
  if (hpPercent > 0.8) conditions.push('hp_above_80');

  // Streak thresholds
  if (context.currentStreak >= 5 && state.prevStreak < 5) {
    conditions.push('streak_5_plus');
  }
  if (context.currentStreak >= 3 && state.prevStreak < 3) {
    conditions.push('streak_3_plus');
  }
  if (state.prevStreak >= 3 && context.currentStreak === 0) {
    conditions.push('streak_broken');
  }

  // New relic acquired
  if (context.relicIds.length > state.prevRelicCount) {
    conditions.push('new_relic');
    if (context.relicIds.length >= 4) conditions.push('many_relics');
  }

  // Floor progression
  conditions.push(`floor_${context.floor}`);
  if (context.isPostBoss) conditions.push('post_boss');

  // Check relic callbacks first (more specific)
  const relicCallbacks = loadRelicCallbacks();
  for (const rid of context.relicIds) {
    const callbacks = relicCallbacks.filter(cb => cb.relicId === rid);
    for (const cb of callbacks) {
      if (!state.linesShown.has(`relic_${rid}_${cb.condition}`)) {
        if (isRelicConditionMet(cb.condition, context, hpPercent, state)) {
          const id = `relic_${rid}_${cb.condition}`;
          state.linesShown.add(id);
          return { thread: 'seeker', templateId: id, text: cb.text };
        }
      }
    }
  }

  if (conditions.length === 0) return null;

  // Find seeker lines matching any detected condition
  const allSeekerLines = loadSeekerLines();
  const eligible = allSeekerLines.filter(
    l => conditions.includes(l.condition) && !state.linesShown.has(l.id),
  );

  if (eligible.length === 0) return null;

  const rng = makeLcg(_currentRoom ^ context.currentStreak);
  const line = eligible[rng.next(eligible.length)];
  state.linesShown.add(line.id);

  return { thread: 'seeker', templateId: line.id, text: line.text };
}

/** Returns normalized HP band label for change detection. */
function hpBand(pct: number): string {
  if (pct > 0.8) return 'above_80';
  if (pct < 0.3) return 'below_30';
  return '30-80';
}

/** Check if a relic callback condition is met in the current context. */
function isRelicConditionMet(
  condition: string,
  context: NarrativeContext,
  hpPercent: number,
  state: RunNarrativeState,
): boolean {
  if (condition === 'hp_below_30') return hpPercent < 0.3;
  if (condition === 'shop_visit') return context.roomType === 'shop';
  if (condition === 'rest_visit') return context.roomType === 'rest';
  if (condition === 'mystery_visit') return context.roomType === 'mystery';
  if (condition === 'post_boss') return context.isPostBoss;
  if (condition === 'chain_complete') return state.lastChainCompletion.length > 0;
  if (condition === 'streak_5_plus') return context.currentStreak >= 5;
  if (condition === 'high_mastery') return false; // mastery not in context; future expansion
  if (condition === 'any_room') return true;
  if (condition === 'surge_turn') return false; // not available in context
  return false;
}

// ============================================================
// INHABITANTS THREAD
// ============================================================

/** Select inhabitant dialogue for special rooms (shop/rest/mystery/boss). */
function selectInhabitantLine(
  state: RunNarrativeState,
  context: NarrativeContext,
  lensVars: Record<string, string>,
): NarrativeLine | null {
  if (!isNarrativeDataReady()) return null;

  const npcMap: Partial<Record<NarrativeContext['roomType'], string>> = {
    shop: 'the_merchant',
    rest: 'the_keeper',
    mystery: 'the_oracle',
    boss: 'the_guardian',
    elite: 'the_guardian',
  };

  const npcId = npcMap[context.roomType];
  if (!npcId) return null;

  let dialogue;
  try {
    dialogue = loadInhabitant(npcId);
  } catch {
    return null;
  }

  // Determine visit count for this NPC type
  const visitCount = getVisitCount(state, context.roomType);

  // Select greeting by visit count
  const greeting = selectGreeting(dialogue.greeting, visitCount);
  if (!greeting) return null;

  // Oracle: prefer a fact callback over plain greeting
  if (npcId === 'the_oracle' && state.memorableFacts.length > 0) {
    const oracleLine = buildOracleFactCallback(state, context, dialogue, lensVars);
    if (oracleLine) return oracleLine;
  }

  // Check state-reactive conditions
  const hpPercent = context.playerMaxHp > 0 ? context.playerHp / context.playerMaxHp : 1.0;
  const stateCondition = detectInhabitantCondition(context, hpPercent, state);

  let text: string;
  let templateId: string;

  if (stateCondition && dialogue.stateReactive[stateCondition]) {
    templateId = `${npcId}_state_${stateCondition}_v${visitCount}`;
    if (state.linesShown.has(templateId)) {
      // Fall back to greeting
      templateId = `${npcId}_greeting_v${visitCount}`;
      text = fillTemplate(greeting, { ...lensVars, visitCount: String(visitCount) });
    } else {
      text = fillTemplate(dialogue.stateReactive[stateCondition], lensVars);
    }
  } else {
    templateId = `${npcId}_greeting_v${visitCount}`;
    text = fillTemplate(greeting, { ...lensVars, visitCount: String(visitCount) });
  }

  if (state.linesShown.has(templateId)) return null;
  state.linesShown.add(templateId);

  return { thread: 'inhabitants', templateId, text };
}

/** Get visit count for the current room type. */
function getVisitCount(state: RunNarrativeState, roomType: NarrativeContext['roomType']): number {
  if (roomType === 'shop') return state.shopVisits;
  if (roomType === 'rest') return state.restVisits;
  if (roomType === 'mystery') return state.mysteryVisits;
  return 1;
}

/** Select greeting text by visit number. Falls back to 'default'. */
function selectGreeting(
  greetings: Array<{ visitNumber: number | 'default'; text: string }>,
  visitCount: number,
): string | null {
  // Exact match first
  const exact = greetings.find(g => g.visitNumber === visitCount);
  if (exact) return exact.text;
  // Default fallback
  const defaultGreeting = greetings.find(g => g.visitNumber === 'default');
  return defaultGreeting?.text ?? null;
}

/** Detect the most relevant state condition for inhabitant dialogue. */
function detectInhabitantCondition(
  context: NarrativeContext,
  hpPercent: number,
  state: RunNarrativeState,
): string | null {
  if (hpPercent < 0.3) return 'hp_low';
  if (hpPercent > 0.8 && context.relicIds.length === 0) return 'hp_full';
  if (context.relicIds.length >= 4) return 'many_relics';
  if (state.lastShopPurchaseType && context.roomType === 'shop') return `on_${state.lastShopPurchaseType}`;
  if (state.lastRestAction && context.roomType === 'rest') {
    if (state.lastRestAction === 'upgrade') return 'on_upgrade';
    return `hp_${hpPercent < 0.5 ? 'low' : 'high'}`;
  }
  return null;
}

// ============================================================
// ORACLE FACT CALLBACK
// ============================================================

/**
 * Select a fact callback for the Oracle mystery room.
 * Weights by recency (further = higher weight) and gravity.
 * Maximum ONE callback per Oracle visit.
 */
function buildOracleFactCallback(
  state: RunNarrativeState,
  context: NarrativeContext,
  _dialogue: { stateReactive: Record<string, string> },
  lensVars: Record<string, string>,
): NarrativeLine | null {
  // Only facts that were correct, medium+ gravity, not already echoed
  const candidates = state.memorableFacts.filter(
    f => f.wasCorrect && f.gravity !== 'low' && !state.echoesShown.has(f.factId),
  );
  if (candidates.length === 0) return null;

  // Check if there's an unseen oracle callback template for this visit
  const visitId = `the_oracle_callback_v${state.mysteryVisits}`;
  if (state.linesShown.has(visitId)) return null;

  // Weight by distance (older facts rank higher)
  const scored = candidates.map(f => {
    const distance = _currentRoom - f.roomNumber;
    const gravityMult = f.gravity === 'high' ? 2.0 : 1.0;
    const weight = distance * gravityMult;
    return { fact: f, weight };
  });
  scored.sort((a, b) => b.weight - a.weight);

  // Pick from top 3 using seeded RNG
  const topN = scored.slice(0, 3);
  const rng = makeLcg(state.mysteryVisits ^ (state.memorableFacts.length * 7));
  const chosen = topN[rng.next(topN.length)].fact;

  // Select Oracle callback template for the fact's answer type
  const templates = loadEchoTemplates(chosen.answerType);
  const oracleTemplates = templates.filter(
    t => t.minGravity !== 'high' || chosen.gravity === 'high',
  ).filter(t => !state.linesShown.has(t.id));

  if (oracleTemplates.length === 0) return null;

  const template = oracleTemplates[rng.next(oracleTemplates.length)];

  const vars: Record<string, string> = {
    ...lensVars,
    echoText: chosen.echoText,
    answer: chosen.answer,
    quizQuestion: chosen.quizQuestion,
    N: String(chosen.roomNumber),
    floor: String(context.floor),
  };
  const text = fillTemplate(template.text, vars);

  state.echoesShown.add(chosen.factId);
  state.linesShown.add(template.id);
  state.linesShown.add(visitId);

  return { thread: 'inhabitants', templateId: template.id, text, factId: chosen.factId };
}

// ============================================================
// AMBIENT THREAD
// ============================================================

/** Select a domain-ambient fallback line when no other thread fires. */
function selectAmbientLine(
  state: RunNarrativeState,
  _lensVars: Record<string, string>,
): NarrativeLine | null {
  if (!isNarrativeDataReady()) return null;

  const ambientLines = loadAmbientLines(state.domainLensId);
  // Also try general_trivia as fallback
  const fallbackLines = state.domainLensId !== 'general_trivia'
    ? loadAmbientLines('general_trivia')
    : [];

  const combined = [...ambientLines, ...fallbackLines];
  const eligible = combined.filter(l => !state.linesShown.has(l.id));
  if (eligible.length === 0) return null;

  const rng = makeLcg(_currentRoom ^ 0xAB_CD);
  const line = eligible[rng.next(eligible.length)];
  state.linesShown.add(line.id);

  return { thread: 'ambient', templateId: line.id, text: line.text };
}
