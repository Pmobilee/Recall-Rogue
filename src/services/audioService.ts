/**
 * audioService.ts
 *
 * Programmatic audio for Recall Rogue using the Web Audio API.
 * All sounds are synthesized on the fly — no external audio files needed.
 *
 * Usage:
 *   import { audioManager } from '../services/audioService'
 *   audioManager.unlock()          // call on first user gesture
 *   audioManager.playSound('mine_dirt')
 */

/** Valid sound names for the Recall Rogue audio catalog. */
export type SoundName =
  | 'mine_dirt'
  | 'mine_rock'
  | 'mine_crystal'
  | 'mine_break'
  | 'collect'
  | 'quiz_correct'
  | 'quiz_wrong'
  | 'button_click'
  | 'oxygen_warning'
  | 'reveal_common'
  | 'reveal_uncommon'
  | 'reveal_rare'
  | 'reveal_epic'
  | 'reveal_legendary'
  | 'reveal_mythic'
  | 'mastery_glow'
  | 'mastery_fullscreen'
  | 'streak_milestone'
  | 'gaia_quip'
  | 'lava_sizzle'
  | 'gas_pocket'
  | 'item_pickup'
  | 'oxygen_low'
  | 'oxygen_critical'
  | 'card_swoosh_attack'
  | 'card_swoosh_shield'
  | 'card_swoosh_buff'
  | 'card_swoosh_debuff'
  | 'card_swoosh_wild'
  | 'card_discard'
  | 'card_deal'
  | 'card_shuffle'
  // --- Combat: Card Events ---
  | 'card_select'
  | 'card_deselect'
  | 'card_fizzle'
  | 'card_exhaust'
  | 'charge_initiate'
  | 'double_strike'
  | 'inscription_resolve'
  // --- Combat: Enemy Actions ---
  | 'enemy_intent'
  | 'enemy_attack'
  | 'enemy_charge_up'
  | 'enemy_charge_release'
  | 'enemy_defend'
  | 'enemy_buff'
  | 'enemy_debuff_player'
  | 'enemy_enrage'
  | 'enemy_phase_transition'
  | 'enemy_heal'
  | 'enemy_dialogue'
  // --- Combat: Player Health ---
  | 'player_damage'
  | 'shield_absorb'
  | 'shield_break'
  | 'shield_gain'
  | 'player_heal'
  | 'immunity_trigger'
  | 'player_defeated'
  | 'low_hp_warning'
  // --- Status Effects ---
  | 'status_poison_apply'
  | 'status_poison_tick'
  | 'status_burn_apply'
  | 'status_burn_tick'
  | 'status_bleed_apply'
  | 'status_weakness_apply'
  | 'status_vulnerability_apply'
  | 'status_strength_apply'
  | 'status_regen_apply'
  | 'status_focus_apply'
  | 'status_expire'
  | 'status_regen_tick'
  // --- Chain System ---
  | 'chain_link_1'
  | 'chain_link_2'
  | 'chain_link_3'
  | 'chain_link_4'
  | 'chain_link_5'
  | 'chain_break'
  | 'chain_momentum'
  // --- Turn Flow ---
  | 'enemy_turn_start'
  | 'ap_spend'
  | 'ap_gain'
  | 'ap_exhausted'
  | 'surge_announce'
  | 'surge_active'
  | 'surge_end'
  | 'perfect_turn'
  | 'combo_10'
  | 'end_turn_click'
  // --- Relic Triggers ---
  | 'relic_trigger_generic'
  | 'relic_trigger_defensive'
  | 'relic_trigger_offensive'
  | 'relic_trigger_heal'
  | 'relic_trigger_ap'
  | 'relic_card_spawn'
  | 'relic_death_prevent'
  | 'relic_capacitor_release'
  // --- Quiz ---
  | 'quiz_appear'
  | 'quiz_answer_select'
  | 'quiz_speed_bonus'
  | 'quiz_dismiss'
  | 'quiz_timer_tick'
  | 'quiz_memory_tip'
  | 'quiz_streak'
  // --- Encounter Lifecycle ---
  | 'encounter_start'
  | 'encounter_start_boss'
  | 'encounter_start_elite'
  | 'encounter_victory'
  | 'encounter_defeat'
  | 'boss_defeated'
  | 'boss_intro'
  // --- Map & Navigation ---
  | 'map_open'
  | 'map_node_hover'
  | 'map_node_click'
  | 'map_path_reveal'
  | 'floor_transition'
  | 'room_transition'
  // --- Hub ---
  | 'hub_welcome'
  | 'hub_start_run'
  | 'hub_button_library'
  | 'hub_button_settings'
  // --- Shop ---
  | 'shop_open'
  | 'shop_purchase'
  | 'shop_insufficient_gold'
  | 'shop_haggle_start'
  | 'shop_haggle_success'
  | 'shop_close'
  | 'shop_sell'
  | 'shop_removal_burn'
  | 'shop_removal_complete'
  | 'shop_transform_shimmer'
  | 'shop_transform_dissolve'
  | 'shop_transform_vortex'
  | 'shop_transform_split'
  | 'shop_transform_materialize'
  | 'shop_transform_reveal'
  | 'shop_transform_confirm'
  | 'shop_price_tick'
  | 'shop_unaffordable'
  | 'shop_card_appear'
  | 'shop_card_flip'
  | 'shop_coin_fly'
  | 'shop_bark'
  // --- Rest Site ---
  | 'rest_open'
  | 'rest_heal'
  | 'rest_study'
  | 'rest_meditate'
  | 'rest_card_removed'
  // --- Rewards ---
  | 'reward_screen'
  | 'gold_collect'
  | 'card_accepted'
  | 'card_skipped'
  | 'card_rerolled'
  | 'relic_acquired'
  | 'treasure_item_appear'
  | 'treasure_item_collect'
  // --- Mystery Events ---
  | 'mystery_appear'
  | 'event_choice'
  | 'event_outcome_positive'
  | 'event_outcome_negative'
  | 'event_continue'
  // --- Run Lifecycle ---
  | 'run_start'
  | 'domain_select'
  | 'floor_cleared'
  | 'retreat_chosen'
  | 'delve_deeper'
  | 'run_victory'
  | 'run_defeat'
  | 'stat_tick'
  | 'xp_award'
  | 'level_up'
  | 'ascension_unlock'
  // --- Generic UI ---
  | 'modal_open'
  | 'modal_close'
  | 'toggle_on'
  | 'toggle_off'
  | 'tab_switch'
  | 'notification_ping'
  | 'error_deny'
  | 'ui_pop_in'
  // --- Progression ---
  | 'fact_mastered'
  | 'mastery_challenge_appear'
  | 'mastery_trial_pass'
  | 'mastery_trial_fail'
  | 'mechanic_unlock'
  | 'relic_unlock'
  // --- Keeper NPC ---
  | 'keeper_calm'
  | 'keeper_excited'
  | 'keeper_stern'
  | 'keeper_curious'
  // --- Screen Transitions ---
  | 'transition_hub_dungeon'
  | 'transition_combat_reward'
  | 'transition_to_rest'
  | 'transition_to_shop'
  | 'transition_run_end_hub'
  | 'boot_logo'
  // --- Tutorial ---
  | 'tutorial_tooltip'
  | 'tutorial_step_complete'
  | 'tutorial_complete'
  // --- Chess ---
  | 'chess_move'
  | 'chess_capture'
  | 'chess_check'
  | 'chess_checkmate'


// ---------------------------------------------------------------------------
// File-based SFX mapping
// ---------------------------------------------------------------------------

/**
 * Helper to compute the .m4a file path for a given SoundName.
 * Most sounds follow the pattern /assets/audio/sfx/{prefix}/{name}.m4a where
 * {prefix} is the text before the first underscore.  Special cases are
 * overridden explicitly.
 */
function sfxPath(name: SoundName): string {
  // Explicit overrides for names whose file path doesn't match the prefix rule
  const OVERRIDES: Partial<Record<SoundName, string>> = {
    // surge_active maps to surge_active_loop.m4a
    surge_active: '/assets/audio/sfx/surge/surge_active_loop.m4a',
    // ui/* names — button_click has no underscore prefix folder
    button_click: '/assets/audio/sfx/ui/button_click.m4a',
    modal_open: '/assets/audio/sfx/ui/modal_open.m4a',
    modal_close: '/assets/audio/sfx/ui/modal_close.m4a',
    toggle_on: '/assets/audio/sfx/ui/toggle_on.m4a',
    toggle_off: '/assets/audio/sfx/ui/toggle_off.m4a',
    tab_switch: '/assets/audio/sfx/ui/tab_switch.m4a',
    notification_ping: '/assets/audio/sfx/ui/notification_ping.m4a',
    error_deny: '/assets/audio/sfx/ui/error_deny.m4a',
    ui_pop_in: '/assets/audio/sfx/ui/ui_pop_in.m4a',
    // legacy/* names — all mine_*, oxygen_*, and single-segment legacy names
    collect: '/assets/audio/sfx/legacy/collect.m4a',
    item_pickup: '/assets/audio/sfx/legacy/item_pickup.m4a',
    gaia_quip: '/assets/audio/sfx/legacy/gaia_quip.m4a',
    lava_sizzle: '/assets/audio/sfx/legacy/lava_sizzle.m4a',
    gas_pocket: '/assets/audio/sfx/legacy/gas_pocket.m4a',
    mine_dirt: '/assets/audio/sfx/legacy/mine_dirt.m4a',
    mine_rock: '/assets/audio/sfx/legacy/mine_rock.m4a',
    mine_crystal: '/assets/audio/sfx/legacy/mine_crystal.m4a',
    mine_break: '/assets/audio/sfx/legacy/mine_break.m4a',
    oxygen_warning: '/assets/audio/sfx/legacy/oxygen_warning.m4a',
    oxygen_low: '/assets/audio/sfx/legacy/oxygen_low.m4a',
    oxygen_critical: '/assets/audio/sfx/legacy/oxygen_critical.m4a',
  }
  if (name in OVERRIDES) return OVERRIDES[name]!

  // Auto-derive folder from first underscore segment
  const folder = name.split('_')[0]
  return `/assets/audio/sfx/${folder}/${name}.m4a`
}

/**
 * Maps every SoundName that has a corresponding .m4a file to its path.
 * Generated once at module load — cheap string operations only.
 *
 * Design: file playback takes priority over synthesis when the buffer is
 * cached.  First play of any sound triggers a lazy fetch then falls back to
 * synthesis; subsequent plays use the decoded AudioBuffer directly.
 */
const SFX_FILE_MAP: Partial<Record<SoundName, string>> = {
  // --- Combat: Card Events ---
  card_swoosh_attack: sfxPath('card_swoosh_attack'),
  card_swoosh_shield: sfxPath('card_swoosh_shield'),
  card_swoosh_buff: sfxPath('card_swoosh_buff'),
  card_swoosh_debuff: sfxPath('card_swoosh_debuff'),
  card_swoosh_wild: sfxPath('card_swoosh_wild'),
  card_deal: sfxPath('card_deal'),
  card_shuffle: sfxPath('card_shuffle'),
  card_select: sfxPath('card_select'),
  card_deselect: sfxPath('card_deselect'),
  card_discard: sfxPath('card_discard'),
  card_fizzle: sfxPath('card_fizzle'),
  card_exhaust: sfxPath('card_exhaust'),
  charge_initiate: sfxPath('charge_initiate'),
  double_strike: sfxPath('double_strike'),
  inscription_resolve: sfxPath('inscription_resolve'),
  // --- Combat: Enemy Actions ---
  enemy_intent: sfxPath('enemy_intent'),
  enemy_attack: sfxPath('enemy_attack'),
  enemy_charge_up: sfxPath('enemy_charge_up'),
  enemy_charge_release: sfxPath('enemy_charge_release'),
  enemy_defend: sfxPath('enemy_defend'),
  enemy_buff: sfxPath('enemy_buff'),
  enemy_debuff_player: sfxPath('enemy_debuff_player'),
  enemy_enrage: sfxPath('enemy_enrage'),
  enemy_phase_transition: sfxPath('enemy_phase_transition'),
  enemy_heal: sfxPath('enemy_heal'),
  enemy_dialogue: sfxPath('enemy_dialogue'),
  // --- Combat: Player Health ---
  player_damage: sfxPath('player_damage'),
  shield_absorb: sfxPath('shield_absorb'),
  shield_break: sfxPath('shield_break'),
  shield_gain: sfxPath('shield_gain'),
  player_heal: sfxPath('player_heal'),
  immunity_trigger: sfxPath('immunity_trigger'),
  player_defeated: sfxPath('player_defeated'),
  low_hp_warning: sfxPath('low_hp_warning'),
  // --- Chain System ---
  chain_link_1: sfxPath('chain_link_1'),
  chain_link_2: sfxPath('chain_link_2'),
  chain_link_3: sfxPath('chain_link_3'),
  chain_link_4: sfxPath('chain_link_4'),
  chain_link_5: sfxPath('chain_link_5'),
  chain_break: sfxPath('chain_break'),
  chain_momentum: sfxPath('chain_momentum'),
  // --- Status Effects ---
  status_poison_apply: sfxPath('status_poison_apply'),
  status_poison_tick: sfxPath('status_poison_tick'),
  status_burn_apply: sfxPath('status_burn_apply'),
  status_burn_tick: sfxPath('status_burn_tick'),
  status_bleed_apply: sfxPath('status_bleed_apply'),
  status_weakness_apply: sfxPath('status_weakness_apply'),
  status_vulnerability_apply: sfxPath('status_vulnerability_apply'),
  status_strength_apply: sfxPath('status_strength_apply'),
  status_regen_apply: sfxPath('status_regen_apply'),
  status_focus_apply: sfxPath('status_focus_apply'),
  status_expire: sfxPath('status_expire'),
  status_regen_tick: sfxPath('status_regen_tick'),
  // --- Quiz ---
  quiz_correct: sfxPath('quiz_correct'),
  quiz_wrong: sfxPath('quiz_wrong'),
  quiz_appear: sfxPath('quiz_appear'),
  quiz_answer_select: sfxPath('quiz_answer_select'),
  quiz_speed_bonus: sfxPath('quiz_speed_bonus'),
  quiz_dismiss: sfxPath('quiz_dismiss'),
  quiz_timer_tick: sfxPath('quiz_timer_tick'),
  quiz_memory_tip: sfxPath('quiz_memory_tip'),
  quiz_streak: sfxPath('quiz_streak'),
  // --- Turn Flow ---
  enemy_turn_start: sfxPath('enemy_turn_start'),
  ap_spend: sfxPath('ap_spend'),
  ap_gain: sfxPath('ap_gain'),
  ap_exhausted: sfxPath('ap_exhausted'),
  end_turn_click: sfxPath('end_turn_click'),
  perfect_turn: sfxPath('perfect_turn'),
  combo_10: sfxPath('combo_10'),
  // --- Surge ---
  surge_announce: sfxPath('surge_announce'),
  surge_end: sfxPath('surge_end'),
  surge_active: sfxPath('surge_active'),
  // --- Relic Triggers ---
  relic_trigger_generic: sfxPath('relic_trigger_generic'),
  relic_trigger_defensive: sfxPath('relic_trigger_defensive'),
  relic_trigger_offensive: sfxPath('relic_trigger_offensive'),
  relic_trigger_heal: sfxPath('relic_trigger_heal'),
  relic_trigger_ap: sfxPath('relic_trigger_ap'),
  relic_card_spawn: sfxPath('relic_card_spawn'),
  relic_death_prevent: sfxPath('relic_death_prevent'),
  relic_capacitor_release: sfxPath('relic_capacitor_release'),
  // --- Encounter Lifecycle ---
  encounter_start: sfxPath('encounter_start'),
  encounter_start_boss: sfxPath('encounter_start_boss'),
  encounter_start_elite: sfxPath('encounter_start_elite'),
  encounter_victory: sfxPath('encounter_victory'),
  encounter_defeat: sfxPath('encounter_defeat'),
  boss_defeated: sfxPath('boss_defeated'),
  boss_intro: sfxPath('boss_intro'),
  // --- Map & Navigation ---
  map_open: sfxPath('map_open'),
  map_node_hover: sfxPath('map_node_hover'),
  map_node_click: sfxPath('map_node_click'),
  map_path_reveal: sfxPath('map_path_reveal'),
  floor_transition: sfxPath('floor_transition'),
  room_transition: sfxPath('room_transition'),
  // --- Hub ---
  hub_welcome: sfxPath('hub_welcome'),
  hub_start_run: sfxPath('hub_start_run'),
  hub_button_library: sfxPath('hub_button_library'),
  hub_button_settings: sfxPath('hub_button_settings'),
  // --- Shop ---
  shop_open: sfxPath('shop_open'),
  shop_purchase: sfxPath('shop_purchase'),
  shop_insufficient_gold: sfxPath('shop_insufficient_gold'),
  shop_haggle_start: sfxPath('shop_haggle_start'),
  shop_haggle_success: sfxPath('shop_haggle_success'),
  shop_close: sfxPath('shop_close'),
  shop_sell: sfxPath('shop_sell'),
  shop_removal_burn: sfxPath('shop_removal_burn'),
  shop_removal_complete: sfxPath('shop_removal_complete'),
  shop_transform_shimmer: sfxPath('shop_transform_shimmer'),
  shop_transform_dissolve: sfxPath('shop_transform_dissolve'),
  shop_transform_vortex: sfxPath('shop_transform_vortex'),
  shop_transform_split: sfxPath('shop_transform_split'),
  shop_transform_materialize: sfxPath('shop_transform_materialize'),
  shop_transform_reveal: sfxPath('shop_transform_reveal'),
  shop_transform_confirm: sfxPath('shop_transform_confirm'),
  shop_price_tick: sfxPath('shop_price_tick'),
  shop_unaffordable: sfxPath('shop_unaffordable'),
  shop_card_appear: sfxPath('shop_card_appear'),
  shop_card_flip: sfxPath('shop_card_flip'),
  shop_coin_fly: sfxPath('shop_coin_fly'),
  shop_bark: sfxPath('shop_bark'),
  // --- Rest Site ---
  rest_open: sfxPath('rest_open'),
  rest_heal: sfxPath('rest_heal'),
  rest_study: sfxPath('rest_study'),
  rest_meditate: sfxPath('rest_meditate'),
  rest_card_removed: sfxPath('rest_card_removed'),
  // --- Rewards ---
  reward_screen: sfxPath('reward_screen'),
  gold_collect: sfxPath('gold_collect'),
  card_accepted: sfxPath('card_accepted'),
  card_skipped: sfxPath('card_skipped'),
  card_rerolled: sfxPath('card_rerolled'),
  relic_acquired: sfxPath('relic_acquired'),
  treasure_item_appear: sfxPath('treasure_item_appear'),
  treasure_item_collect: sfxPath('treasure_item_collect'),
  // --- Mystery Events ---
  mystery_appear: sfxPath('mystery_appear'),
  event_choice: sfxPath('event_choice'),
  event_outcome_positive: sfxPath('event_outcome_positive'),
  event_outcome_negative: sfxPath('event_outcome_negative'),
  event_continue: sfxPath('event_continue'),
  // --- Run Lifecycle ---
  run_start: sfxPath('run_start'),
  domain_select: sfxPath('domain_select'),
  floor_cleared: sfxPath('floor_cleared'),
  retreat_chosen: sfxPath('retreat_chosen'),
  delve_deeper: sfxPath('delve_deeper'),
  run_victory: sfxPath('run_victory'),
  run_defeat: sfxPath('run_defeat'),
  stat_tick: sfxPath('stat_tick'),
  xp_award: sfxPath('xp_award'),
  level_up: sfxPath('level_up'),
  ascension_unlock: sfxPath('ascension_unlock'),
  // --- Generic UI ---
  button_click: sfxPath('button_click'),
  modal_open: sfxPath('modal_open'),
  modal_close: sfxPath('modal_close'),
  toggle_on: sfxPath('toggle_on'),
  toggle_off: sfxPath('toggle_off'),
  tab_switch: sfxPath('tab_switch'),
  notification_ping: sfxPath('notification_ping'),
  error_deny: sfxPath('error_deny'),
  ui_pop_in: sfxPath('ui_pop_in'),
  // --- Reveal ---
  reveal_common: sfxPath('reveal_common'),
  reveal_uncommon: sfxPath('reveal_uncommon'),
  reveal_rare: sfxPath('reveal_rare'),
  reveal_epic: sfxPath('reveal_epic'),
  reveal_legendary: sfxPath('reveal_legendary'),
  reveal_mythic: sfxPath('reveal_mythic'),
  // --- Mastery ---
  mastery_glow: sfxPath('mastery_glow'),
  mastery_fullscreen: sfxPath('mastery_fullscreen'),
  streak_milestone: sfxPath('streak_milestone'),
  // --- Keeper NPC ---
  keeper_calm: sfxPath('keeper_calm'),
  keeper_excited: sfxPath('keeper_excited'),
  keeper_stern: sfxPath('keeper_stern'),
  keeper_curious: sfxPath('keeper_curious'),
  // --- Screen Transitions ---
  transition_hub_dungeon: sfxPath('transition_hub_dungeon'),
  transition_combat_reward: sfxPath('transition_combat_reward'),
  transition_to_rest: sfxPath('transition_to_rest'),
  transition_to_shop: sfxPath('transition_to_shop'),
  transition_run_end_hub: sfxPath('transition_run_end_hub'),
  boot_logo: sfxPath('boot_logo'),
  // --- Tutorial ---
  tutorial_tooltip: sfxPath('tutorial_tooltip'),
  tutorial_step_complete: sfxPath('tutorial_step_complete'),
  tutorial_complete: sfxPath('tutorial_complete'),
  // --- Progression ---
  fact_mastered: sfxPath('fact_mastered'),
  mastery_challenge_appear: sfxPath('mastery_challenge_appear'),
  mastery_trial_pass: sfxPath('mastery_trial_pass'),
  mastery_trial_fail: sfxPath('mastery_trial_fail'),
  mechanic_unlock: sfxPath('mechanic_unlock'),
  relic_unlock: sfxPath('relic_unlock'),
  // --- Legacy ---
  mine_dirt: sfxPath('mine_dirt'),
  mine_rock: sfxPath('mine_rock'),
  mine_crystal: sfxPath('mine_crystal'),
  mine_break: sfxPath('mine_break'),
  collect: sfxPath('collect'),
  item_pickup: sfxPath('item_pickup'),
  oxygen_warning: sfxPath('oxygen_warning'),
  oxygen_low: sfxPath('oxygen_low'),
  oxygen_critical: sfxPath('oxygen_critical'),
  gaia_quip: sfxPath('gaia_quip'),
  lava_sizzle: sfxPath('lava_sizzle'),
  gas_pocket: sfxPath('gas_pocket'),
}

// Webkit-prefixed AudioContext fallback for older iOS Safari.
type AnyAudioContext = AudioContext
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

/**
 * Creates a Web Audio API context with webkit-prefix fallback for older iOS.
 */
function createAudioContext(): AnyAudioContext {
  const Ctor = window.AudioContext ?? window.webkitAudioContext
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this environment.')
  }
  return new Ctor()
}

// ---------------------------------------------------------------------------
// Sound synthesis helpers
// ---------------------------------------------------------------------------

/**
 * Schedules an oscillator node with a linear gain ramp to zero.
 *
 * @param ctx - The AudioContext to use.
 * @param masterGain - The master gain node to connect to.
 * @param frequency - Oscillator frequency in Hz.
 * @param type - OscillatorType (sine, square, sawtooth, triangle).
 * @param startVolume - Initial gain value (0–1).
 * @param durationSec - Total duration until silence in seconds.
 * @param startTimeSec - AudioContext time to begin playback.
 */
function scheduleOscillator(
  ctx: AnyAudioContext,
  masterGain: GainNode,
  frequency: number,
  type: OscillatorType,
  startVolume: number,
  durationSec: number,
  startTimeSec: number = ctx.currentTime,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTimeSec)

  gain.gain.setValueAtTime(startVolume, startTimeSec)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTimeSec + durationSec)

  osc.connect(gain)
  gain.connect(masterGain)

  osc.start(startTimeSec)
  osc.stop(startTimeSec + durationSec + 0.01)
}

/**
 * Creates a white-noise burst node connected to masterGain.
 *
 * @param ctx - The AudioContext to use.
 * @param masterGain - The master gain node to connect to.
 * @param startVolume - Initial gain value (0–1).
 * @param durationSec - Total duration in seconds.
 * @param startTimeSec - AudioContext time to begin playback.
 */
function scheduleNoiseBurst(
  ctx: AnyAudioContext,
  masterGain: GainNode,
  startVolume: number,
  durationSec: number,
  startTimeSec: number = ctx.currentTime,
): void {
  const sampleRate = ctx.sampleRate
  const frameCount = Math.ceil(sampleRate * (durationSec + 0.05))
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(startVolume, startTimeSec)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTimeSec + durationSec)

  source.connect(gain)
  gain.connect(masterGain)

  source.start(startTimeSec)
  source.stop(startTimeSec + durationSec + 0.05)
}

// ---------------------------------------------------------------------------
// Individual sound definitions
// ---------------------------------------------------------------------------

/** Soft low thud — short sine wave with quick decay. */
function playMineDirt(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 80, 'sine', 0.6, 0.12)
}

/** Harder impact — noise burst plus low sine, quick decay. */
function playMineRock(ctx: AnyAudioContext, master: GainNode): void {
  scheduleNoiseBurst(ctx, master, 0.4, 0.1)
  scheduleOscillator(ctx, master, 55, 'sine', 0.5, 0.12)
}

/** Crystalline chime — high sine with harmonics and longer decay. */
function playMineCrystal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1200, 'sine', 0.5, 0.4, now)
  scheduleOscillator(ctx, master, 2400, 'sine', 0.25, 0.35, now)
  scheduleOscillator(ctx, master, 3600, 'sine', 0.12, 0.3, now)
}

/** Satisfying shatter — noise burst with low pitch-drop. */
function playMineBreak(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.5, 0.25, now)

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.25)
  gain.gain.setValueAtTime(0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.3)
}

/** Pickup sound — ascending arpeggio of 3 quick notes. */
function playCollect(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99] // C5, E5, G5
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.4, 0.1, now + i * 0.07)
  })
}

/** Gentle positive chime — major chord arpeggio. */
function playQuizCorrect(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.35, 0.3, now + i * 0.08)
  })
}

/** Soft negative tone — minor second interval, not harsh. */
function playQuizWrong(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Minor second: B4 + C5 briefly, then resolve to low tone
  scheduleOscillator(ctx, master, 246.94, 'sine', 0.35, 0.25, now)        // B3
  scheduleOscillator(ctx, master, 261.63, 'sine', 0.25, 0.2, now + 0.05)  // C4
  scheduleOscillator(ctx, master, 174.61, 'sine', 0.3, 0.3, now + 0.2)    // F3 resolve
}

/** Short UI tick — very brief sine blip. */
function playButtonClick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 800, 'sine', 0.3, 0.05)
}

/** Low oxygen alert — pulsing low tone, urgent but not annoying. */
function playOxygenWarning(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Two short pulses at a low, urgent frequency
  scheduleOscillator(ctx, master, 150, 'sine', 0.55, 0.15, now)
  scheduleOscillator(ctx, master, 150, 'sine', 0.55, 0.15, now + 0.22)
}

/** Card swoosh attack — Rising metallic whoosh with sawtooth oscillator. */
function playCardSwooshAttack(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15)

  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.15)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15 + 0.05)

  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  osc.stop(now + 0.2)
}

/** Card swoosh shield — Crystalline barrier chime with dual sine oscillators. */
function playCardSwooshShield(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 800, 'sine', 0.12, 0.2, now)
  scheduleOscillator(ctx, master, 1600, 'sine', 0.12, 0.2, now)
}

/** Card swoosh buff — Ascending power hum with triangle oscillator. */
function playCardSwooshBuff(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.2)

  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  osc.stop(now + 0.2)
}

/** Card swoosh debuff — Descending curse whisper with sawtooth and noise. */
function playCardSwooshDebuff(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2)

  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  osc.stop(now + 0.2)

  scheduleNoiseBurst(ctx, master, 0.04, 0.1, now)
}

/** Card swoosh wild — Prismatic shimmer arpeggio with 4 rapid sine notes. */
function playCardSwooshWild(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.08, 0.035, now + i * 0.035)
  })
}

/** Card discard — Soft thunk with low sine and fast decay. */
function playCardDiscard(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 100, 'sine', 0.1, 0.08)
}

/**
 * Card deal — Short papery flop sound using a shaped noise burst through a bandpass filter.
 * Simulates the satisfying slap of a card landing on a surface.
 */
function playCardDeal(ctx: AnyAudioContext, dest: GainNode): void {
  const now = ctx.currentTime
  // Short noise burst shaped with strong exponential decay (card slap)
  const bufferSize = Math.ceil(ctx.sampleRate * 0.06)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  // Bandpass filter for papery, card-like quality
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2000
  filter.Q.value = 0.8

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.25, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  noise.start(now)
  noise.stop(now + 0.06)
}

/**
 * Card shuffle — Shorter, quieter papery rustle through a bandpass filter.
 * Simulates cards being shuffled back into the draw pile.
 */
function playCardShuffle(ctx: AnyAudioContext, dest: GainNode): void {
  const now = ctx.currentTime
  const bufferSize = Math.round(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 10)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2500
  filter.Q.value = 1.0
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  noise.start(now)
  noise.stop(now + 0.04)
}

// ---------------------------------------------------------------------------
// Helper: filtered noise burst (bandpass or lowpass/highpass)
// ---------------------------------------------------------------------------

/**
 * Creates a noise burst routed through a BiquadFilter before masterGain.
 */
function scheduleFilteredNoise(
  ctx: AnyAudioContext,
  masterGain: GainNode,
  startVolume: number,
  durationSec: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  startTimeSec: number = ctx.currentTime,
): void {
  const sampleRate = ctx.sampleRate
  const frameCount = Math.ceil(sampleRate * (durationSec + 0.05))
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(startVolume, startTimeSec)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTimeSec + durationSec)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(masterGain)
  source.start(startTimeSec)
  source.stop(startTimeSec + durationSec + 0.05)
}

// ---------------------------------------------------------------------------
// Combat: Card Events
// ---------------------------------------------------------------------------

/** Card selected — soft parchment lift, gentle upward "fwip". */
function playCardSelect(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.1, 0.04, 'bandpass', 3000)
}

/** Card deselected — soft settling tap, lower pitched than select. */
function playCardDeselect(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.08, 0.03, 'bandpass', 2000)
}

/** Card fizzle — pathetic puff of smoke, descending sad pfft. */
function playCardFizzle(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(1200, now)
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.2)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.2)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
  scheduleNoiseBurst(ctx, master, 0.04, 0.12, now)
}

/** Card exhaust — paper burning to ash, crackle + descending sizzle. */
function playCardExhaust(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.15, 0.2, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.3)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
}

/** Charge initiate — arcane energy gathering, rising capacitor hum with tremolo. */
function playChargeInitiate(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const ampGain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(100, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.4)

  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(12, now)
  lfoGain.gain.setValueAtTime(0.04, now)

  ampGain.gain.setValueAtTime(0.12, now)
  ampGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)

  lfo.connect(lfoGain)
  lfoGain.connect(ampGain.gain)
  osc.connect(ampGain)
  ampGain.connect(master)

  osc.start(now)
  osc.stop(now + 0.42)
  lfo.start(now)
  lfo.stop(now + 0.42)
}

/** Double strike — metallic ching-CHING, two rapid impacts. */
function playDoubleStrike(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.15, 0.05, now)
  scheduleNoiseBurst(ctx, master, 0.25, 0.06, now + 0.08)
  scheduleOscillator(ctx, master, 1200, 'sine', 0.12, 0.08, now)
  scheduleOscillator(ctx, master, 1600, 'sine', 0.18, 0.1, now + 0.08)
}

/** Inscription resolve — deep resonant VWOOOM, rune etching. */
function playInscriptionResolve(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 80, 'sawtooth', 0.15, 0.5, now)
  scheduleOscillator(ctx, master, 160, 'sawtooth', 0.08, 0.45, now)
  scheduleOscillator(ctx, master, 240, 'sawtooth', 0.04, 0.4, now)
}

// ---------------------------------------------------------------------------
// Enemy Actions
// ---------------------------------------------------------------------------

/** Enemy intent telegraph — ominous low rumble. */
function playEnemyIntent(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 40, 'sine', 0.15, 0.3)
}

/** Enemy attacks player — impact thud with screen-shake quality. */
function playEnemyAttack(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.35, 0.15, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2)
  gain.gain.setValueAtTime(0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
}

/** Enemy charges up — menacing rising drone with tremolo. */
function playEnemyChargeUp(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const ampGain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(60, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.6)

  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(6, now)
  lfoGain.gain.setValueAtTime(0.04, now)

  ampGain.gain.setValueAtTime(0.12, now)
  ampGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

  lfo.connect(lfoGain)
  lfoGain.connect(ampGain.gain)
  osc.connect(ampGain)
  ampGain.connect(master)

  osc.start(now)
  osc.stop(now + 0.62)
  lfo.start(now)
  lfo.stop(now + 0.62)
}

/** Enemy charged attack releases — MASSIVE impact. */
function playEnemyChargeRelease(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.5, 0.15, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.3)
  gain.gain.setValueAtTime(0.7, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
}

/** Enemy gains block — stone wall rising, grinding KRRK. */
function playEnemyDefend(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.2, 0.2, 'lowpass', 500, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.2)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
}

/** Enemy buffs self — dark power surge. */
function playEnemyBuff(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sawtooth'
  osc1.frequency.setValueAtTime(100, now)
  osc1.frequency.exponentialRampToValueAtTime(600, now + 0.3)
  gain1.gain.setValueAtTime(0.12, now)
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc1.connect(gain1)
  gain1.connect(master)
  osc1.start(now)
  osc1.stop(now + 0.32)

  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'square'
  osc2.frequency.setValueAtTime(200, now)
  osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.3)
  gain2.gain.setValueAtTime(0.06, now)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc2.connect(gain2)
  gain2.connect(master)
  osc2.start(now)
  osc2.stop(now + 0.32)
}

/** Enemy debuffs player — curse application, sickly descending. */
function playEnemyDebuffPlayer(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.3)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
  scheduleFilteredNoise(ctx, master, 0.06, 0.15, 'bandpass', 1000, now)
}

/** Enemy enrages — bestial roar, distorted growl. */
function playEnemyEnrage(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.25, 0.4, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(80, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.4)
  gain.gain.setValueAtTime(0.35, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
}

/** Enemy phase transition — glass shatter + ascending minor arpeggio sting. */
function playEnemyPhaseTransition(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.4, 0.08, now)
  // A3, C4, E4, A4 minor arpeggio
  const notes = [220, 261.63, 329.63, 440]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'square', 0.12, 0.15, now + 0.1 + i * 0.08)
  })
}

/** Enemy heal — descending shimmer arpeggio. */
function playEnemyHeal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // G5, E5, C5 descending
  const notes = [783.99, 659.25, 523.25]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.1, 0.15, now + i * 0.08)
  })
}

/** Enemy dialogue — typewriter ticks at distinct pitches. */
function playEnemyDialogue(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const pitches = [400, 450, 380]
  pitches.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.08, 0.03, now + i * 0.05)
  })
}

// ---------------------------------------------------------------------------
// Player Health & Status
// ---------------------------------------------------------------------------

/** Player takes damage — painful dull thump. */
function playPlayerDamage(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.3, 0.1, now)
  scheduleOscillator(ctx, master, 60, 'sine', 0.45, 0.15, now)
}

/** Shield absorbs damage — metallic CLANG + highpass crackle. */
function playShieldAbsorb(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 2000, 'sine', 0.18, 0.05, now)
  scheduleFilteredNoise(ctx, master, 0.15, 0.08, 'highpass', 3000, now)
}

/** Shield breaks — crystalline shatter. */
function playShieldBreak(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.25, 0.06, now)
  scheduleNoiseBurst(ctx, master, 0.2, 0.06, now + 0.03)
  scheduleNoiseBurst(ctx, master, 0.15, 0.06, now + 0.06)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(3000, now)
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.3)
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
}

/** Shield gained — crystalline formation, ascending glass tones. */
function playShieldGain(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // E5, G5, B5
  const notes = [659.25, 783.99, 987.77]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'triangle', 0.12, 0.15, now + i * 0.07)
  })
}

/** Player healed — warm harp glissando. */
function playPlayerHeal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.1, 0.5, now + i * 0.08)
  })
}

/** Immunity triggered — holy bell ring. */
function playImmunityTrigger(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1047, 'sine', 0.2, 0.8, now)
  scheduleOscillator(ctx, master, 2094, 'sine', 0.08, 0.6, now)
}

/** Player defeated — heartbeat slowing to silence. */
function playPlayerDefeated(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 60, 'sine', 0.3, 0.2, now)
  scheduleOscillator(ctx, master, 60, 'sine', 0.2, 0.25, now + 0.6)
  scheduleOscillator(ctx, master, 60, 'sine', 0.1, 0.35, now + 1.4)
}

/** Low HP warning — subtle rhythmic pulse. */
function playLowHpWarning(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 50, 'sine', 0.1, 0.15, now)
  scheduleOscillator(ctx, master, 50, 'sine', 0.1, 0.15, now + 0.4)
}

// ---------------------------------------------------------------------------
// Status Effects
// ---------------------------------------------------------------------------

/** Poison applied — toxic gurgling blorp. */
function playStatusPoisonApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.15)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.17)
  scheduleFilteredNoise(ctx, master, 0.08, 0.1, 'lowpass', 800, now)
}

/** Poison tick — mini drip. */
function playStatusPoisonTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 200, 'sine', 0.08, 0.05)
}

/** Burn applied — fire ignition FWOOSH. */
function playStatusBurnApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.2, 0.2, 'bandpass', 2500, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.2)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
}

/** Burn tick — sizzling ember tss. */
function playStatusBurnTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.06, 0.04, 'highpass', 3000)
}

/** Bleed applied — wet slice schlick. */
function playStatusBleedApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.15, 0.08, 'bandpass', 1500, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.1)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.12)
}

/** Weakness applied — deflating woooo. */
function playStatusWeaknessApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.25)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.27)
}

/** Vulnerability applied — armor crack. */
function playStatusVulnerabilityApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.3, 0.03, now)
  scheduleOscillator(ctx, master, 1500, 'sine', 0.12, 0.05, now)
}

/** Strength applied — engine rev VRRM. */
function playStatusStrengthApply(ctx: AnyAudioContext, master: GainNode): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(100, t)
  osc.frequency.exponentialRampToValueAtTime(500, t + 0.2)
  gain.gain.setValueAtTime(0.15, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t)
  osc.stop(t + 0.22)
}

/** Regen applied — nature bloom, soft triad. */
function playStatusRegenApply(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 440, 'sine', 0.08, 0.3, now)
  scheduleOscillator(ctx, master, 660, 'sine', 0.08, 0.3, now)
  scheduleOscillator(ctx, master, 880, 'sine', 0.08, 0.3, now)
}

/** Focus applied — meditation bell ting. */
function playStatusFocusApply(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 2093, 'sine', 0.1, 0.4)
}

/** Status expires — soft dissolve psssh. */
function playStatusExpire(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.04, 0.1, 'highpass', 4000)
}

/** Regen tick — tiny healing chime. */
function playStatusRegenTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 880, 'sine', 0.06, 0.06)
}

// ---------------------------------------------------------------------------
// Chain System
// ---------------------------------------------------------------------------

/** Chain link 1 — first link forged, metallic clink. */
function playChainLink1(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 880, 'sine', 0.15, 0.1, now)
  scheduleNoiseBurst(ctx, master, 0.1, 0.03, now)
}

/** Chain link 2 — B5, gaining momentum. */
function playChainLink2(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 988, 'sine', 0.16, 0.12, now)
  scheduleNoiseBurst(ctx, master, 0.1, 0.03, now)
}

/** Chain link 3 — C6, add harmonic. */
function playChainLink3(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1047, 'sine', 0.17, 0.13, now)
  scheduleOscillator(ctx, master, 2094, 'sine', 0.06, 0.1, now)
  scheduleNoiseBurst(ctx, master, 0.12, 0.03, now)
}

/** Chain link 4 — D6, shimmer. */
function playChainLink4(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1175, 'sine', 0.18, 0.15, now)
  scheduleOscillator(ctx, master, 2350, 'sine', 0.07, 0.12, now)
  scheduleOscillator(ctx, master, 3525, 'triangle', 0.04, 0.1, now)
  scheduleNoiseBurst(ctx, master, 0.12, 0.03, now)
}

/** Chain link 5 — MAXIMUM, powerful chord resolution. */
function playChainLink5(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1318, 'sine', 0.25, 0.3, now)
  scheduleOscillator(ctx, master, 1568, 'sine', 0.2, 0.28, now)
  scheduleOscillator(ctx, master, 1976, 'sine', 0.15, 0.25, now)
  scheduleNoiseBurst(ctx, master, 0.18, 0.05, now)
}

/** Chain break — sharp metallic snap + scattered tinkles. */
function playChainBreak(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.3, 0.05, now)
  scheduleOscillator(ctx, master, 1200, 'sine', 0.12, 0.08, now + 0.05)
  scheduleOscillator(ctx, master, 800, 'sine', 0.1, 0.08, now + 0.1)
  scheduleOscillator(ctx, master, 400, 'sine', 0.08, 0.08, now + 0.15)
}

/** Chain momentum — ascending platformer power-up arpeggio. */
function playChainMomentum(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'square', 0.1, 0.04, now + i * 0.05)
  })
}

// ---------------------------------------------------------------------------
// Turn Flow & Surge
// ---------------------------------------------------------------------------

/** Enemy turn starts — ominous brass stab. */
function playEnemyTurnStart(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 110, 'sawtooth', 0.15, 0.2, now)
  scheduleOscillator(ctx, master, 165, 'sine', 0.08, 0.2, now)
}

/** AP spent — soap bubble pop. */
function playApSpend(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1200, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.04)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.05)
}

/** AP gained — bright coin ping. */
function playApGain(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1500, 'sine', 0.1, 0.06)
}

/** AP exhausted — hollow empty thud. */
function playApExhausted(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 80, 'sine', 0.12, 0.1, now)
  scheduleFilteredNoise(ctx, master, 0.06, 0.08, 'lowpass', 400, now)
}

/** Surge announced — DRAMATIC bass thrum + golden energy rise. */
function playSurgeAnnounce(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 55, 'sine', 0.3, 0.6, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.6)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.62)
  scheduleNoiseBurst(ctx, master, 0.2, 0.08, now + 0.55)
}

/** Surge turn ambient — warm golden continuous hum. */
function playSurgeActive(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 440, 'sine', 0.04, 2.0, now)
  scheduleOscillator(ctx, master, 554, 'sine', 0.04, 2.0, now)
  scheduleOscillator(ctx, master, 659, 'sine', 0.04, 2.0, now)
}

/** Surge ends — descending fade. */
function playSurgeEnd(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [440, 554, 659]
  notes.forEach(freq => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.5)
    gain.gain.setValueAtTime(0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.52)
  })
}

/** Perfect turn — triumphant da-da-DA. */
function playPerfectTurn(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // G5, B5, D6
  scheduleOscillator(ctx, master, 783.99, 'square', 0.12, 0.1, now)
  scheduleOscillator(ctx, master, 987.77, 'square', 0.12, 0.1, now + 0.1)
  scheduleOscillator(ctx, master, 1174.66, 'square', 0.15, 0.3, now + 0.2)
}

/** Combo 10+ — LEGENDARY celebration. */
function playCombo10(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const baseNotes = [440, 513, 586, 659, 733, 806, 880, 1047]
  baseNotes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'square', 0.1, 0.15, now + i * 0.1)
  })
  scheduleNoiseBurst(ctx, master, 0.15, 0.15, now + 0.85)
  scheduleOscillator(ctx, master, 1760, 'sine', 0.12, 0.6, now + 0.9)
}

/** End turn button — decisive heavy click. */
function playEndTurnClick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 500, 'sine', 0.2, 0.08)
}

// ---------------------------------------------------------------------------
// Relic Triggers
// ---------------------------------------------------------------------------

/** Generic relic trigger — shimmering magical pulse. */
function playRelicTriggerGeneric(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.12)
}

/** Defensive relic — metallic reinforcement clang. */
function playRelicTriggerDefensive(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [659.25, 783.99, 987.77]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'triangle', 0.1, 0.1, now + i * 0.04)
  })
  scheduleNoiseBurst(ctx, master, 0.1, 0.05, now)
}

/** Offensive relic — blade sharpening shing. */
function playRelicTriggerOffensive(ctx: AnyAudioContext, master: GainNode): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(600, t)
  osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1)
  gain.gain.setValueAtTime(0.1, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t)
  osc.stop(t + 0.12)
}

/** Healing relic — leaf rustle + chime. */
function playRelicTriggerHeal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.05, 0.05, now)
  scheduleOscillator(ctx, master, 880, 'sine', 0.1, 0.1, now + 0.03)
}

/** AP relic — electrical zap. */
function playRelicTriggerAp(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(1000, now)

  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(30, now)
  lfoGain.gain.setValueAtTime(200, now)

  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  osc.stop(now + 0.1)
  lfo.start(now)
  lfo.stop(now + 0.1)
}

/** Deja Vu card spawn — magical poof + card snap. */
function playRelicCardSpawn(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.1, 0.06, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(523, now + 0.04)
  osc.frequency.exponentialRampToValueAtTime(1047, now + 0.14)
  gain.gain.setValueAtTime(0.12, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now + 0.04)
  osc.stop(now + 0.16)
}

/** Death prevention — heartbeat stops then THUDS back. */
function playRelicDeathPrevent(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Heavy thud at 200ms
  scheduleOscillator(ctx, master, 40, 'sine', 0.4, 0.3, now + 0.2)
  scheduleNoiseBurst(ctx, master, 0.1, 0.08, now + 0.2)
  // Ascending you're-alive chime
  scheduleOscillator(ctx, master, 523.25, 'sine', 0.12, 0.15, now + 0.55)
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.12, 0.15, now + 0.7)
  scheduleOscillator(ctx, master, 783.99, 'sine', 0.12, 0.2, now + 0.85)
}

/** Capacitor AP release — electrical discharge BZZZT. */
function playRelicCapacitorRelease(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(800, now)

  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(50, now)
  lfoGain.gain.setValueAtTime(400, now)

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)

  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  osc.connect(gain)
  gain.connect(master)

  osc.start(now)
  osc.stop(now + 0.17)
  lfo.start(now)
  lfo.stop(now + 0.17)
  scheduleNoiseBurst(ctx, master, 0.15, 0.1, now)
}

// ---------------------------------------------------------------------------
// Quiz System
// ---------------------------------------------------------------------------

/** Quiz overlay appears — scanner powering on. */
function playQuizAppear(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.3)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
  scheduleOscillator(ctx, master, 1000, 'sine', 0.08, 0.1, now + 0.3)
}

/** Answer selected — tactile click with reverb. */
function playQuizAnswerSelect(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1000, 'sine', 0.2, 0.07)
}

/** Speed bonus — quick ascending ting-ting. */
function playQuizSpeedBonus(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1300, 'sine', 0.12, 0.04, now)
  scheduleOscillator(ctx, master, 1800, 'sine', 0.12, 0.04, now + 0.05)
}

/** Quiz dismissed — scanner powering down. */
function playQuizDismiss(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1000, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.2)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
}

/** Quiz timer tick — sharp metronome. */
function playQuizTimerTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1200, 'square', 0.12, 0.02)
}

/** Memory tip shown — gentle teacher tone. */
function playQuizMemoryTip(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 440, 'sine', 0.06, 0.2, now)
  scheduleOscillator(ctx, master, 554, 'sine', 0.06, 0.2, now)
}

/** Quiz streak — ascending xylophone. */
function playQuizStreak(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'triangle', 0.1, 0.12, now + i * 0.07)
  })
}

// ---------------------------------------------------------------------------
// Encounter Lifecycle
// ---------------------------------------------------------------------------

/** Encounter starts — dramatic percussion + brass sting. */
function playEncounterStart(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.3, 0.12, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(100, now + 0.05)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.4)
  gain.gain.setValueAtTime(0.25, now + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now + 0.05)
  osc.stop(now + 0.42)
}

/** Boss encounter starts — MASSIVE entrance. */
function playEncounterStartBoss(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.4, 0.15, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(50, now + 0.05)
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.5)
  gain.gain.setValueAtTime(0.4, now + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now + 0.05)
  osc.stop(now + 0.82)
  // Choir-like triad
  scheduleOscillator(ctx, master, 220, 'sine', 0.08, 0.8, now + 0.1)
  scheduleOscillator(ctx, master, 277, 'sine', 0.08, 0.8, now + 0.1)
  scheduleOscillator(ctx, master, 330, 'sine', 0.08, 0.8, now + 0.1)
  // Second drum hit
  scheduleNoiseBurst(ctx, master, 0.3, 0.1, now + 0.4)
}

/** Elite encounter — warning gong. */
function playEncounterStartElite(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 110, 'sine', 0.25, 0.6, now)
  scheduleOscillator(ctx, master, 220, 'sine', 0.1, 0.5, now)
  scheduleOscillator(ctx, master, 330, 'sine', 0.06, 0.4, now)
}

/** Encounter victory — triumphant 4-note ascending melody. */
function playEncounterVictory(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    const dur = i === 3 ? 0.4 : 0.1
    scheduleOscillator(ctx, master, freq, 'sine', 0.25, dur, now + i * 0.12)
  })
}

/** Boss defeated — EPIC extended victory. */
function playBossDefeated(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Base melody (C5, E5, G5, C6) doubled at lower octave
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    const dur = i === 3 ? 0.5 : 0.12
    scheduleOscillator(ctx, master, freq, 'sine', 0.25, dur, now + i * 0.12)
    scheduleOscillator(ctx, master, freq * 0.5, 'sine', 0.12, dur, now + i * 0.12)
  })
  // Cymbal burst at end
  scheduleNoiseBurst(ctx, master, 0.2, 0.2, now + 0.6)
}

/** Boss intro — accelerating drum roll. */
function playBossIntro(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // 8 hits over 800ms, getting closer together
  const times = [0, 0.15, 0.28, 0.39, 0.48, 0.55, 0.61, 0.66]
  times.forEach(t => {
    scheduleNoiseBurst(ctx, master, 0.2, 0.05, now + t)
  })
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(80, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.8)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.82)
}

// ---------------------------------------------------------------------------
// Map & Navigation
// ---------------------------------------------------------------------------

/** Map opens — parchment unfurling + adventure phrase. */
function playMapOpen(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.08, 0.2, now)
  scheduleOscillator(ctx, master, 392, 'sine', 0.1, 0.12, now + 0.1)
  scheduleOscillator(ctx, master, 493.88, 'sine', 0.1, 0.12, now + 0.22)
  scheduleOscillator(ctx, master, 587.33, 'sine', 0.1, 0.18, now + 0.34)
}

/** Map node hover — subtle wind whoosh. */
function playMapNodeHover(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.03, 0.1, 'bandpass', 2000)
}

/** Map node clicked — footstep + confirmation. */
function playMapNodeClick(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.12, 0.04, 'lowpass', 800, now)
  scheduleOscillator(ctx, master, 600, 'sine', 0.1, 0.06, now + 0.02)
}

/** Path revealed — stone grinding. */
function playMapPathReveal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.15, 0.3, 'lowpass', 500, now)
  scheduleOscillator(ctx, master, 100, 'sine', 0.08, 0.3, now)
}

/** Floor transition — descending footsteps + boom. */
function playFloorTransition(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // 4 footsteps
  ;[0, 0.15, 0.3, 0.45].forEach(t => {
    scheduleFilteredNoise(ctx, master, 0.1, 0.06, 'lowpass', 600, now + t)
  })
  scheduleOscillator(ctx, master, 40, 'sine', 0.3, 0.4, now + 0.5)
}

/** Room transition — footsteps. */
function playRoomTransition(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  ;[0, 0.12, 0.24, 0.36].forEach(t => {
    scheduleFilteredNoise(ctx, master, 0.08, 0.05, 'bandpass', 1500, now + t)
  })
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

/** Hub welcome — warm welcoming musical phrase. */
function playHubWelcome(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Warm triad sustained
  scheduleOscillator(ctx, master, 261.63, 'sine', 0.1, 0.5, now)
  scheduleOscillator(ctx, master, 329.63, 'sine', 0.1, 0.5, now)
  scheduleOscillator(ctx, master, 392, 'sine', 0.1, 0.5, now)
  // Gentle arpeggio overlay
  const notes = [261.63, 329.63, 392, 523.25]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.06, 0.15, now + 0.1 + i * 0.1)
  })
}

/** Hub start run — bold adventure horn call. */
function playHubStartRun(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 392, 'sawtooth', 0.2, 0.15, now)
  scheduleOscillator(ctx, master, 392, 'sawtooth', 0.2, 0.2, now + 0.18)
  scheduleOscillator(ctx, master, 493.88, 'sawtooth', 0.18, 0.15, now + 0.18)
  scheduleOscillator(ctx, master, 587.33, 'sawtooth', 0.22, 0.25, now + 0.18)
}

/** Hub library button — heavy book thump. */
function playHubButtonLibrary(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.15, 0.08, 'lowpass', 600, now)
  scheduleOscillator(ctx, master, 120, 'sine', 0.12, 0.1, now)
}

/** Hub settings button — gear click-whirr. */
function playHubButtonSettings(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1200, 'sine', 0.08, 0.02, now)
  scheduleFilteredNoise(ctx, master, 0.06, 0.05, 'highpass', 2000, now + 0.01)
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

/** Shop opens — door bell chime. */
function playShopOpen(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1047, 'sine', 0.15, 0.3, now)
  scheduleOscillator(ctx, master, 1319, 'sine', 0.12, 0.3, now + 0.05)
}

/** Shop purchase — satisfying ka-ching. */
function playShopPurchase(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.12, 0.03, now)
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(1200, now + 0.02)
  osc1.frequency.exponentialRampToValueAtTime(1600, now + 0.1)
  gain1.gain.setValueAtTime(0.15, now + 0.02)
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc1.connect(gain1)
  gain1.connect(master)
  osc1.start(now + 0.02)
  osc1.stop(now + 0.22)
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1400, now + 0.04)
  osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.12)
  gain2.gain.setValueAtTime(0.12, now + 0.04)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc2.connect(gain2)
  gain2.connect(master)
  osc2.start(now + 0.04)
  osc2.stop(now + 0.22)
}

/** Insufficient gold — sad empty rattle. */
function playShopInsufficientGold(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.1, 0.04, now)
  scheduleNoiseBurst(ctx, master, 0.1, 0.04, now + 0.08)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.22)
}

/** Haggle start — cunning laugh. */
function playShopHaggleStart(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 600, 'sine', 0.1, 0.06, now)
  scheduleOscillator(ctx, master, 500, 'sine', 0.1, 0.06, now + 0.07)
  scheduleOscillator(ctx, master, 400, 'sine', 0.1, 0.06, now + 0.14)
}

/** Haggle success — discount ching. */
function playShopHaggleSuccess(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.12, 0.03, now)
  scheduleOscillator(ctx, master, 1200, 'sine', 0.15, 0.1, now + 0.02)
  scheduleOscillator(ctx, master, 1600, 'sine', 0.12, 0.1, now + 0.1)
  scheduleOscillator(ctx, master, 2000, 'sine', 0.1, 0.15, now + 0.18)
}

/** Shop closes — descending door bell. */
function playShopClose(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1319, 'sine', 0.12, 0.3, now)
  scheduleOscillator(ctx, master, 1047, 'sine', 0.1, 0.3, now + 0.05)
}

/** Sell card — short white noise burst, like tearing paper. */
function playShopSell(ctx: AnyAudioContext, master: GainNode): void {
  scheduleNoiseBurst(ctx, master, 0.18, 0.15, ctx.currentTime)
}

/** Card removal burn — bandpass-filtered noise crackle, 600ms. */
function playShopRemovalBurn(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.14, 0.6, 'bandpass', 800)
}

/** Card removal complete — low sine gong at 80Hz, slow decay. */
function playShopRemovalComplete(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 80, 'sine', 0.2, 0.3, ctx.currentTime)
}

/** Transform shimmer — high sine sweep upward, 400ms. */
function playShopTransformShimmer(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1200, now)
  osc.frequency.exponentialRampToValueAtTime(3200, now + 0.4)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
}

/** Transform dissolve — highpass-swept noise, 600ms. */
function playShopTransformDissolve(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const sampleRate = ctx.sampleRate
  const frameCount = Math.ceil(sampleRate * 0.65)
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(400, now)
  filter.frequency.exponentialRampToValueAtTime(4000, now + 0.6)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  source.start(now)
}

/** Transform vortex — bandpass-swept noise swirl, 400ms. */
function playShopTransformVortex(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const sampleRate = ctx.sampleRate
  const frameCount = Math.ceil(sampleRate * 0.45)
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(200, now)
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.2)
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.4)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  source.start(now)
}

/** Transform split — very short highpass noise crack, 100ms. */
function playShopTransformSplit(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.2, 0.1, 'highpass', 3000)
}

/** Transform materialize — dual sine bell tone, 150ms. */
function playShopTransformMaterialize(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 800, 'sine', 0.14, 0.15, now)
  scheduleOscillator(ctx, master, 1200, 'sine', 0.1, 0.15, now)
}

/** Transform reveal — card flip, quick noise + low tone. */
function playShopTransformReveal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.15, 0.08, now)
  scheduleOscillator(ctx, master, 400, 'sine', 0.08, 0.12, now + 0.02)
}

/** Transform confirm — positive ascending chime. */
function playShopTransformConfirm(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 880, 'sine', 0.12, 0.15, now)
  scheduleOscillator(ctx, master, 1100, 'sine', 0.1, 0.15, now + 0.08)
  scheduleOscillator(ctx, master, 1320, 'sine', 0.1, 0.2, now + 0.15)
}

/** Price tick — very short soft sine click, 50ms. */
function playShopPriceTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1000, 'sine', 0.07, 0.05, ctx.currentTime)
}

/** Unaffordable — low dull thud, 80ms. */
function playShopUnaffordable(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 100, 'sine', 0.15, 0.08, ctx.currentTime)
}

/** Card appear — soft card place sound. */
function playShopCardAppear(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.08, 0.06, now)
  scheduleOscillator(ctx, master, 350, 'sine', 0.07, 0.1, now + 0.02)
}

/** Card flip — quick noise burst with mid tone. */
function playShopCardFlip(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.12, 0.05, now)
  scheduleOscillator(ctx, master, 500, 'sine', 0.06, 0.08, now + 0.01)
}

/** Coin fly — bright clink, 120ms. */
function playShopCoinFly(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.1, 0.03, now)
  scheduleOscillator(ctx, master, 1800, 'sine', 0.1, 0.12, now + 0.01)
}

/** Shop keeper bark — subtle UI blip. */
function playShopBark(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 600, 'sine', 0.08, 0.06, ctx.currentTime)
}

// ---------------------------------------------------------------------------
// Rest Site
// ---------------------------------------------------------------------------

/** Rest opens — peaceful exhale. */
function playRestOpen(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.06, 0.4, 'bandpass', 500)
}

/** Heal chosen — warm musical swell. */
function playRestHeal(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // Low to high chord swell
  const low = [261.63, 329.63, 392]
  const high = [523.25, 659.25, 783.99]
  low.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.12, 0.5, now + i * 0.08)
  })
  high.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.1, 0.4, now + 0.3 + i * 0.07)
  })
}

/** Study chosen — pen scratch + book. */
function playRestStudy(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  ;[0, 0.04, 0.08].forEach(t => {
    scheduleNoiseBurst(ctx, master, 0.06, 0.02, now + t)
  })
  scheduleOscillator(ctx, master, 300, 'sine', 0.08, 0.1, now + 0.12)
}

/** Meditate — singing bowl strike. */
function playRestMeditate(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 528, 'sine', 0.15, 1.2, now)
  scheduleOscillator(ctx, master, 1056, 'sine', 0.06, 0.8, now)
  scheduleOscillator(ctx, master, 1584, 'sine', 0.03, 0.5, now)
}

/** Card removed via meditation — ascending dissolve. */
function playRestCardRemoved(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(2000, now + 0.4)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
}

// ---------------------------------------------------------------------------
// Rewards & Loot
// ---------------------------------------------------------------------------

/** Reward screen appears — sparkly harp run. */
function playRewardScreen(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.1, 0.12, now + i * 0.04)
  })
}

/** Gold collected — coin cascade. */
function playGoldCollect(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const baseFreqs = [2000, 2400, 2200, 2800, 2600]
  baseFreqs.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.08, 0.02, now + i * 0.03)
  })
}

/** Card accepted — snap + shimmer. */
function playCardAccepted(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleNoiseBurst(ctx, master, 0.15, 0.03, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now + 0.02)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12)
  gain.gain.setValueAtTime(0.12, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now + 0.02)
  osc.stop(now + 0.14)
}

/** Card skipped — neutral whoosh. */
function playCardSkipped(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.06, 0.15, 'bandpass', 1500)
}

/** Card rerolled — dice rattle. */
function playCardRerolled(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  ;[0, 0.03, 0.06, 0.09].forEach(t => {
    scheduleNoiseBurst(ctx, master, 0.1, 0.02, now + t)
  })
  scheduleOscillator(ctx, master, 600, 'sine', 0.08, 0.08, now + 0.1)
}

/** Relic acquired — magical VWOOM. */
function playRelicAcquired(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(100, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.4)
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
  scheduleOscillator(ctx, master, 880, 'sine', 0.1, 0.2, now + 0.3)
  scheduleOscillator(ctx, master, 1047, 'sine', 0.08, 0.2, now + 0.35)
}

/** Treasure item appears — sparkly pop. */
function playTreasureItemAppear(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1500, 'sine', 0.12, 0.05, now)
  scheduleNoiseBurst(ctx, master, 0.08, 0.03, now + 0.02)
}

/** Treasure item collected — eager grab. */
function playTreasureItemCollect(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1200, 'sine', 0.12, 0.04)
}

// ---------------------------------------------------------------------------
// Mystery Events
// ---------------------------------------------------------------------------

/** Mystery appears — harp + wind chimes. */
function playMysteryAppear(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 660, 'sine', 0.1, 0.4, now)
  scheduleOscillator(ctx, master, 880, 'sine', 0.08, 0.4, now)
  scheduleFilteredNoise(ctx, master, 0.05, 0.2, 'highpass', 3000, now + 0.1)
}

/** Event choice selected — wax seal stamp. */
function playEventChoice(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.15, 0.06, 'lowpass', 800, now)
  scheduleOscillator(ctx, master, 300, 'sine', 0.1, 0.08, now + 0.02)
}

/** Positive outcome — bright cheerful phrase. */
function playEventOutcomePositive(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // E5, G#5, B5 major
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.15, 0.08, now)
  scheduleOscillator(ctx, master, 830.61, 'sine', 0.15, 0.08, now + 0.08)
  scheduleOscillator(ctx, master, 987.77, 'sine', 0.15, 0.12, now + 0.16)
}

/** Negative outcome — minor key descent. */
function playEventOutcomeNegative(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // E5, C5, A4 descending minor
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.12, 0.1, now)
  scheduleOscillator(ctx, master, 523.25, 'sine', 0.12, 0.1, now + 0.1)
  scheduleOscillator(ctx, master, 440, 'sine', 0.12, 0.15, now + 0.2)
}

/** Continue/advance text — page flip. */
function playEventContinue(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.05, 0.03, 'highpass', 3000)
}

// ---------------------------------------------------------------------------
// Run Lifecycle
// ---------------------------------------------------------------------------

/** New run started — adventure horn call. */
function playRunStart(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 392, 'sawtooth', 0.2, 0.2, now)
  scheduleOscillator(ctx, master, 493.88, 'sawtooth', 0.18, 0.15, now + 0.22)
  scheduleOscillator(ctx, master, 587.33, 'sawtooth', 0.25, 0.3, now + 0.38)
}

/** Domain selected — domain echo motif. */
function playDomainSelect(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 440, 'sine', 0.15, 0.2, now)
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.15, 0.2, now + 0.22)
}

/** Floor cleared — level complete jingle. */
function playFloorCleared(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'square', 0.12, 0.06, now + i * 0.07)
  })
}

/** Retreat chosen — cautious measured phrase. */
function playRetreatChosen(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 329.63, 'sine', 0.12, 0.2, now)
  scheduleOscillator(ctx, master, 261.63, 'sine', 0.12, 0.2, now + 0.22)
}

/** Delve deeper — dramatic descent. */
function playDelveDeeper(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.5)
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.52)
  scheduleFilteredNoise(ctx, master, 0.1, 0.3, 'lowpass', 400, now)
}

/** Run victory — ULTIMATE triumphant fanfare. */
function playRunVictory(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C4→E4→G4→C5 ascending with orchestra swell
  const melody = [261.63, 329.63, 392, 523.25]
  melody.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sawtooth', 0.18, 0.3, now + i * 0.3)
    scheduleOscillator(ctx, master, freq * 2, 'sine', 0.08, 0.25, now + i * 0.3)
  })
  // Cymbal at peak
  scheduleNoiseBurst(ctx, master, 0.15, 0.2, now + 0.9)
  // Sustained chord C5+E5+G5
  scheduleOscillator(ctx, master, 523.25, 'sine', 0.15, 0.8, now + 1.2)
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.12, 0.8, now + 1.2)
  scheduleOscillator(ctx, master, 783.99, 'sine', 0.1, 0.8, now + 1.2)
}

/** Run defeat — somber reflective descent. */
function playRunDefeat(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // E5→C5→A4→E4 gentle descending
  const notes = [659.25, 523.25, 440, 329.63]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.1, 0.4, now + i * 0.4)
  })
}

/** Stat tally tick — arcade counter. */
function playStatTick(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1000, 'square', 0.08, 0.015)
}

/** XP award — warm building tone. */
function playXpAward(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.3)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
}

/** Level up — triumphant DING + sparkle. */
function playLevelUp(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 2093, 'sine', 0.25, 0.6, now)
  // Rapid ascending arpeggio overlay
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568]
  notes.forEach((freq, i) => {
    scheduleOscillator(ctx, master, freq, 'square', 0.06, 0.08, now + i * 0.06)
  })
  scheduleNoiseBurst(ctx, master, 0.12, 0.1, now + 0.35)
}

/** Ascension unlocked — ominous yet golden. */
function playAscensionUnlock(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 80, 'sawtooth', 0.15, 0.3, now)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(523.25, now + 0.1)
  osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.5)
  gain.gain.setValueAtTime(0.12, now + 0.1)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now + 0.1)
  osc.stop(now + 0.52)
  scheduleNoiseBurst(ctx, master, 0.2, 0.08, now + 0.48)
}

// ---------------------------------------------------------------------------
// Generic UI
// ---------------------------------------------------------------------------

/** Modal opens — panel slide whoosh-click. */
function playModalOpen(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.1, 0.06, 'bandpass', 2000, now)
  scheduleOscillator(ctx, master, 800, 'sine', 0.1, 0.04, now + 0.04)
}

/** Modal closes — panel retract. */
function playModalClose(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 800, 'sine', 0.06, 0.04, now)
  scheduleFilteredNoise(ctx, master, 0.05, 0.06, 'bandpass', 2000, now + 0.02)
}

/** Toggle on — switch flip bright. */
function playToggleOn(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1200, 'sine', 0.1, 0.03)
}

/** Toggle off — switch unflip darker. */
function playToggleOff(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 800, 'sine', 0.08, 0.03)
}

/** Tab switch — page flip fwip. */
function playTabSwitch(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.06, 0.04, 'bandpass', 2500)
}

/** Notification ping — attention ding. */
function playNotificationPing(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1500, 'sine', 0.12, 0.1)
}

/** Error/invalid — gentle bonk. */
function playErrorDeny(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 200, 'sine', 0.12, 0.06, now)
  scheduleOscillator(ctx, master, 180, 'sine', 0.1, 0.06, now + 0.08)
}

/** UI pop-in — quick pleasant pop sound for element appearance animations. */
function playUiPopIn(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 880, 'sine', 0.25, 0.08, now)
  scheduleOscillator(ctx, master, 1200, 'sine', 0.15, 0.06, now + 0.04)
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/** Fact mastered — deep crystalline. */
function playFactMastered(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1047, 'sine', 0.18, 0.6, now)
  scheduleOscillator(ctx, master, 2094, 'sine', 0.08, 0.5, now)
  scheduleOscillator(ctx, master, 3141, 'sine', 0.04, 0.4, now)
}

/** Mastery challenge appears — gong. */
function playMasteryChallengeAppear(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 110, 'sine', 0.2, 0.8, now)
  scheduleOscillator(ctx, master, 220, 'sine', 0.08, 0.6, now)
  scheduleOscillator(ctx, master, 330, 'sine', 0.04, 0.4, now)
}

/** Mastery trial pass — short level up. */
function playMasteryTrialPass(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 1047, 'sine', 0.15, 0.3, now)
  scheduleOscillator(ctx, master, 1319, 'sine', 0.12, 0.25, now + 0.05)
  scheduleOscillator(ctx, master, 1568, 'sine', 0.1, 0.3, now + 0.12)
}

/** Mastery trial fail — gentle descent. */
function playMasteryTrialFail(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.3)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.32)
}

/** Mechanic unlock — bright fanfare + whoosh. */
function playMechanicUnlock(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4)
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
  scheduleNoiseBurst(ctx, master, 0.1, 0.15, now + 0.2)
  scheduleOscillator(ctx, master, 1047, 'sine', 0.12, 0.3, now + 0.35)
}

/** Relic unlock — mystical fanfare with sine triad. */
function playRelicUnlock(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, now)
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.4)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.42)
  scheduleNoiseBurst(ctx, master, 0.1, 0.12, now + 0.25)
  scheduleOscillator(ctx, master, 880, 'sine', 0.1, 0.3, now + 0.35)
  scheduleOscillator(ctx, master, 1047, 'sine', 0.08, 0.3, now + 0.38)
  scheduleOscillator(ctx, master, 1319, 'sine', 0.06, 0.3, now + 0.41)
}

// ---------------------------------------------------------------------------
// Keeper NPC
// ---------------------------------------------------------------------------

/** Keeper calm — soft chime. */
function playKeeperCalm(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 660, 'sine', 0.1, 0.2)
}

/** Keeper excited — brighter, faster. */
function playKeeperExcited(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 880, 'sine', 0.12, 0.15)
}

/** Keeper stern — lower, serious. */
function playKeeperStern(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 330, 'sine', 0.1, 0.25)
}

/** Keeper curious — rising interval. */
function playKeeperCurious(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.15)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.17)
}

// ---------------------------------------------------------------------------
// Screen Transitions
// ---------------------------------------------------------------------------

/** Hub → Dungeon portal VWOOM. */
function playTransitionHubDungeon(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(100, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.5)
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.52)
}

/** Combat → Reward brief victory sting. */
function playTransitionCombatReward(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 659.25, 'sine', 0.15, 0.12, now)
  scheduleOscillator(ctx, master, 783.99, 'sine', 0.15, 0.12, now + 0.1)
  scheduleOscillator(ctx, master, 1046.5, 'sine', 0.15, 0.2, now + 0.2)
}

/** Transition to rest — tension fading. */
function playTransitionToRest(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleFilteredNoise(ctx, master, 0.1, 0.4, 'lowpass', 600, now)
}

/** Transition to shop — door chime. */
function playTransitionToShop(ctx: AnyAudioContext, master: GainNode): void {
  playShopOpen(ctx, master)
}

/** Transition run end → hub — warm sine fading in. */
function playTransitionRunEndHub(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 261.63, 'sine', 0.08, 0.6, now)
  scheduleOscillator(ctx, master, 329.63, 'sine', 0.06, 0.6, now)
  scheduleOscillator(ctx, master, 392, 'sine', 0.05, 0.6, now)
}

/** Boot logo — THE signature sound. Iconic. */
function playBootLogo(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C4, G4, C5 — fundamental sawtooths
  scheduleOscillator(ctx, master, 261.63, 'sawtooth', 0.15, 0.4, now)
  scheduleOscillator(ctx, master, 392, 'sawtooth', 0.12, 0.5, now + 0.5)
  scheduleOscillator(ctx, master, 523.25, 'sawtooth', 0.18, 0.7, now + 1.0)
  // Sine harmonics
  scheduleOscillator(ctx, master, 523.25, 'sine', 0.08, 0.3, now)
  scheduleOscillator(ctx, master, 784, 'sine', 0.07, 0.4, now + 0.5)
  scheduleOscillator(ctx, master, 1046.5, 'sine', 0.1, 0.6, now + 1.0)
  // Sparkle at peak
  scheduleNoiseBurst(ctx, master, 0.08, 0.2, now + 1.4)
  scheduleOscillator(ctx, master, 2093, 'sine', 0.06, 0.5, now + 1.5)
}

// ---------------------------------------------------------------------------
// Tutorial
// ---------------------------------------------------------------------------

/** Tutorial tooltip — gentle ping. */
function playTutorialTooltip(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 880, 'sine', 0.1, 0.15)
}

/** Tutorial step complete — small ding. */
function playTutorialStepComplete(ctx: AnyAudioContext, master: GainNode): void {
  scheduleOscillator(ctx, master, 1200, 'sine', 0.12, 0.1)
}

/** Tutorial complete — mini fanfare. */
function playTutorialComplete(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  scheduleOscillator(ctx, master, 659.25, 'square', 0.1, 0.1, now)
  scheduleOscillator(ctx, master, 783.99, 'square', 0.1, 0.1, now + 0.1)
  scheduleOscillator(ctx, master, 1046.5, 'square', 0.12, 0.2, now + 0.2)
  scheduleNoiseBurst(ctx, master, 0.08, 0.1, now + 0.3)
}


// ---------------------------------------------------------------------------
// Chess sounds
// ---------------------------------------------------------------------------

/**
 * Chess piece move — short wooden click: white noise through a low-pass filter (cutoff 800 Hz).
 * Duration 80 ms, quick gain decay.
 */
function playChessMove(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.3, 0.08, 'lowpass', 800)
}

/**
 * Chess capture — deeper thud: white noise through a low-pass filter (cutoff 400 Hz).
 * Slightly louder and longer than a normal move.
 */
function playChessCapture(ctx: AnyAudioContext, master: GainNode): void {
  scheduleFilteredNoise(ctx, master, 0.5, 0.12, 'lowpass', 400)
}

/**
 * Chess check — sharp rising ding: sine oscillator sweep 800→1200 Hz over 150 ms.
 */
function playChessCheck(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
  gain.gain.setValueAtTime(0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + 0.17)
}

/**
 * Chess checkmate — triumphant chord: three sine oscillators (C5, E5, G5)
 * with exponential decay over 300 ms.
 */
function playChessCheckmate(ctx: AnyAudioContext, master: GainNode): void {
  const now = ctx.currentTime
  // C5=523Hz, E5=659Hz, G5=784Hz
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq) => {
    scheduleOscillator(ctx, master, freq, 'sine', 0.3, 0.3, now)
  })
}

// ---------------------------------------------------------------------------
// Sound dispatch map
// ---------------------------------------------------------------------------

type SoundFn = (ctx: AnyAudioContext, master: GainNode) => void

const SOUND_MAP: Record<SoundName, SoundFn> = {
  mine_dirt: playMineDirt,
  mine_rock: playMineRock,
  mine_crystal: playMineCrystal,
  mine_break: playMineBreak,
  collect: playCollect,
  quiz_correct: playQuizCorrect,
  quiz_wrong: playQuizWrong,
  button_click: playButtonClick,
  oxygen_warning: playOxygenWarning,
  reveal_common: (ctx, m) => {
    scheduleOscillator(ctx, m, 523, 'square', 0.15, 0.15, 0)
    scheduleOscillator(ctx, m, 659, 'square', 0.15, 0.15, 0.12)
    scheduleOscillator(ctx, m, 784, 'square', 0.12, 0.2, 0.24)
  },
  reveal_uncommon: (ctx, m) => {
    scheduleOscillator(ctx, m, 523, 'sawtooth', 0.12, 0.12, 0)
    scheduleOscillator(ctx, m, 659, 'sawtooth', 0.12, 0.12, 0.1)
    scheduleOscillator(ctx, m, 784, 'sawtooth', 0.12, 0.15, 0.2)
    scheduleOscillator(ctx, m, 1047, 'sawtooth', 0.1, 0.25, 0.3)
  },
  reveal_rare: (ctx, m) => {
    scheduleOscillator(ctx, m, 440, 'square', 0.15, 0.1, 0)
    scheduleOscillator(ctx, m, 554, 'square', 0.15, 0.1, 0.08)
    scheduleOscillator(ctx, m, 659, 'square', 0.15, 0.1, 0.16)
    scheduleOscillator(ctx, m, 880, 'triangle', 0.12, 0.3, 0.24)
    scheduleOscillator(ctx, m, 1047, 'triangle', 0.1, 0.4, 0.4)
  },
  reveal_epic: (ctx, m) => {
    for (let i = 0; i < 8; i++) {
      const freq = 262 + i * 66
      scheduleOscillator(ctx, m, freq, 'square', 0.12, 0.1, i * 0.08)
    }
    scheduleOscillator(ctx, m, 1047, 'triangle', 0.15, 0.5, 0.7)
    scheduleNoiseBurst(ctx, m, 0.06, 0.2, 0.9)
  },
  reveal_legendary: (ctx, m) => {
    scheduleOscillator(ctx, m, 220, 'sawtooth', 0.08, 0.3, 0)
    for (let i = 0; i < 6; i++) {
      scheduleOscillator(ctx, m, 330 + i * 110, 'square', 0.12, 0.12, 0.3 + i * 0.1)
    }
    scheduleOscillator(ctx, m, 1320, 'triangle', 0.15, 0.8, 0.9)
    scheduleNoiseBurst(ctx, m, 0.08, 0.3, 1.2)
  },
  reveal_mythic: (ctx, m) => {
    scheduleOscillator(ctx, m, 110, 'sawtooth', 0.05, 0.5, 0.3)
    for (let i = 0; i < 10; i++) {
      const freq = 220 + i * 88
      scheduleOscillator(ctx, m, freq, 'square', 0.1, 0.08, 0.8 + i * 0.08)
    }
    scheduleOscillator(ctx, m, 1760, 'triangle', 0.15, 1.0, 1.6)
    scheduleNoiseBurst(ctx, m, 0.1, 0.4, 2.0)
    scheduleOscillator(ctx, m, 880, 'sine', 0.08, 1.5, 2.2)
  },
  mastery_glow: (ctx, m) => {
    scheduleOscillator(ctx, m, 880, 'sine', 0.08, 0.3, 0)
    scheduleOscillator(ctx, m, 1320, 'sine', 0.06, 0.4, 0.1)
  },
  mastery_fullscreen: (ctx, m) => {
    for (let i = 0; i < 6; i++) {
      scheduleOscillator(ctx, m, 440 + i * 73, 'square', 0.1, 0.15, i * 0.12)
    }
    scheduleOscillator(ctx, m, 1047, 'triangle', 0.15, 0.8, 0.8)
    scheduleNoiseBurst(ctx, m, 0.06, 0.2, 1.2)
  },
  streak_milestone: (ctx, m) => {
    scheduleOscillator(ctx, m, 523, 'square', 0.12, 0.12, 0)
    scheduleOscillator(ctx, m, 659, 'square', 0.12, 0.12, 0.1)
    scheduleOscillator(ctx, m, 784, 'triangle', 0.1, 0.3, 0.2)
  },
  gaia_quip: (ctx, m) => {
    scheduleOscillator(ctx, m, 660, 'sine', 0.06, 0.15, 0)
    scheduleOscillator(ctx, m, 880, 'sine', 0.04, 0.2, 0.08)
  },
  lava_sizzle: (ctx, m) => {
    scheduleNoiseBurst(ctx, m, 0.15, 0.4, 0)
    scheduleOscillator(ctx, m, 150, 'sawtooth', 0.06, 0.3, 0.1)
  },
  gas_pocket: (ctx, m) => {
    scheduleNoiseBurst(ctx, m, 0.12, 0.3, 0)
    scheduleOscillator(ctx, m, 200, 'sine', 0.05, 0.4, 0.1)
  },
  item_pickup: (ctx, m) => {
    scheduleOscillator(ctx, m, 880, 'square', 0.08, 0.08, 0)
    scheduleOscillator(ctx, m, 1320, 'square', 0.06, 0.12, 0.06)
  },
  oxygen_low: (ctx, m) => {
    scheduleOscillator(ctx, m, 220, 'square', 0.1, 0.2, 0)
    scheduleOscillator(ctx, m, 220, 'square', 0.1, 0.2, 0.4)
  },
  oxygen_critical: (ctx, m) => {
    scheduleOscillator(ctx, m, 330, 'square', 0.12, 0.15, 0)
    scheduleOscillator(ctx, m, 330, 'square', 0.12, 0.15, 0.2)
    scheduleOscillator(ctx, m, 330, 'square', 0.12, 0.15, 0.4)
  },
  card_swoosh_attack: playCardSwooshAttack,
  card_swoosh_shield: playCardSwooshShield,
  card_swoosh_buff: playCardSwooshBuff,
  card_swoosh_debuff: playCardSwooshDebuff,
  card_swoosh_wild: playCardSwooshWild,
  card_discard: playCardDiscard,
  card_deal: playCardDeal,
  card_shuffle: playCardShuffle,
  // --- Combat: Card Events ---
  card_select: playCardSelect,
  card_deselect: playCardDeselect,
  card_fizzle: playCardFizzle,
  card_exhaust: playCardExhaust,
  charge_initiate: playChargeInitiate,
  double_strike: playDoubleStrike,
  inscription_resolve: playInscriptionResolve,
  // --- Combat: Enemy Actions ---
  enemy_intent: playEnemyIntent,
  enemy_attack: playEnemyAttack,
  enemy_charge_up: playEnemyChargeUp,
  enemy_charge_release: playEnemyChargeRelease,
  enemy_defend: playEnemyDefend,
  enemy_buff: playEnemyBuff,
  enemy_debuff_player: playEnemyDebuffPlayer,
  enemy_enrage: playEnemyEnrage,
  enemy_phase_transition: playEnemyPhaseTransition,
  enemy_heal: playEnemyHeal,
  enemy_dialogue: playEnemyDialogue,
  // --- Combat: Player Health ---
  player_damage: playPlayerDamage,
  shield_absorb: playShieldAbsorb,
  shield_break: playShieldBreak,
  shield_gain: playShieldGain,
  player_heal: playPlayerHeal,
  immunity_trigger: playImmunityTrigger,
  player_defeated: playPlayerDefeated,
  low_hp_warning: playLowHpWarning,
  // --- Status Effects ---
  status_poison_apply: playStatusPoisonApply,
  status_poison_tick: playStatusPoisonTick,
  status_burn_apply: playStatusBurnApply,
  status_burn_tick: playStatusBurnTick,
  status_bleed_apply: playStatusBleedApply,
  status_weakness_apply: playStatusWeaknessApply,
  status_vulnerability_apply: playStatusVulnerabilityApply,
  status_strength_apply: playStatusStrengthApply,
  status_regen_apply: playStatusRegenApply,
  status_focus_apply: playStatusFocusApply,
  status_expire: playStatusExpire,
  status_regen_tick: playStatusRegenTick,
  // --- Chain System ---
  chain_link_1: playChainLink1,
  chain_link_2: playChainLink2,
  chain_link_3: playChainLink3,
  chain_link_4: playChainLink4,
  chain_link_5: playChainLink5,
  chain_break: playChainBreak,
  chain_momentum: playChainMomentum,
  // --- Turn Flow ---
  enemy_turn_start: playEnemyTurnStart,
  ap_spend: playApSpend,
  ap_gain: playApGain,
  ap_exhausted: playApExhausted,
  surge_announce: playSurgeAnnounce,
  surge_active: playSurgeActive,
  surge_end: playSurgeEnd,
  perfect_turn: playPerfectTurn,
  combo_10: playCombo10,
  end_turn_click: playEndTurnClick,
  // --- Relic Triggers ---
  relic_trigger_generic: playRelicTriggerGeneric,
  relic_trigger_defensive: playRelicTriggerDefensive,
  relic_trigger_offensive: playRelicTriggerOffensive,
  relic_trigger_heal: playRelicTriggerHeal,
  relic_trigger_ap: playRelicTriggerAp,
  relic_card_spawn: playRelicCardSpawn,
  relic_death_prevent: playRelicDeathPrevent,
  relic_capacitor_release: playRelicCapacitorRelease,
  // --- Quiz ---
  quiz_appear: playQuizAppear,
  quiz_answer_select: playQuizAnswerSelect,
  quiz_speed_bonus: playQuizSpeedBonus,
  quiz_dismiss: playQuizDismiss,
  quiz_timer_tick: playQuizTimerTick,
  quiz_memory_tip: playQuizMemoryTip,
  quiz_streak: playQuizStreak,
  // --- Encounter Lifecycle ---
  encounter_start: playEncounterStart,
  encounter_start_boss: playEncounterStartBoss,
  encounter_start_elite: playEncounterStartElite,
  encounter_victory: playEncounterVictory,
  encounter_defeat: playPlayerDefeated,
  boss_defeated: playBossDefeated,
  boss_intro: playBossIntro,
  // --- Map & Navigation ---
  map_open: playMapOpen,
  map_node_hover: playMapNodeHover,
  map_node_click: playMapNodeClick,
  map_path_reveal: playMapPathReveal,
  floor_transition: playFloorTransition,
  room_transition: playRoomTransition,
  // --- Hub ---
  hub_welcome: playHubWelcome,
  hub_start_run: playHubStartRun,
  hub_button_library: playHubButtonLibrary,
  hub_button_settings: playHubButtonSettings,
  // --- Shop ---
  shop_open: playShopOpen,
  shop_purchase: playShopPurchase,
  shop_insufficient_gold: playShopInsufficientGold,
  shop_haggle_start: playShopHaggleStart,
  shop_haggle_success: playShopHaggleSuccess,
  shop_close: playShopClose,
  shop_sell: playShopSell,
  shop_removal_burn: playShopRemovalBurn,
  shop_removal_complete: playShopRemovalComplete,
  shop_transform_shimmer: playShopTransformShimmer,
  shop_transform_dissolve: playShopTransformDissolve,
  shop_transform_vortex: playShopTransformVortex,
  shop_transform_split: playShopTransformSplit,
  shop_transform_materialize: playShopTransformMaterialize,
  shop_transform_reveal: playShopTransformReveal,
  shop_transform_confirm: playShopTransformConfirm,
  shop_price_tick: playShopPriceTick,
  shop_unaffordable: playShopUnaffordable,
  shop_card_appear: playShopCardAppear,
  shop_card_flip: playShopCardFlip,
  shop_coin_fly: playShopCoinFly,
  shop_bark: playShopBark,
  // --- Rest Site ---
  rest_open: playRestOpen,
  rest_heal: playRestHeal,
  rest_study: playRestStudy,
  rest_meditate: playRestMeditate,
  rest_card_removed: playRestCardRemoved,
  // --- Rewards ---
  reward_screen: playRewardScreen,
  gold_collect: playGoldCollect,
  card_accepted: playCardAccepted,
  card_skipped: playCardSkipped,
  card_rerolled: playCardRerolled,
  relic_acquired: playRelicAcquired,
  treasure_item_appear: playTreasureItemAppear,
  treasure_item_collect: playTreasureItemCollect,
  // --- Mystery Events ---
  mystery_appear: playMysteryAppear,
  event_choice: playEventChoice,
  event_outcome_positive: playEventOutcomePositive,
  event_outcome_negative: playEventOutcomeNegative,
  event_continue: playEventContinue,
  // --- Run Lifecycle ---
  run_start: playRunStart,
  domain_select: playDomainSelect,
  floor_cleared: playFloorCleared,
  retreat_chosen: playRetreatChosen,
  delve_deeper: playDelveDeeper,
  run_victory: playRunVictory,
  run_defeat: playRunDefeat,
  stat_tick: playStatTick,
  xp_award: playXpAward,
  level_up: playLevelUp,
  ascension_unlock: playAscensionUnlock,
  // --- Generic UI ---
  modal_open: playModalOpen,
  modal_close: playModalClose,
  toggle_on: playToggleOn,
  toggle_off: playToggleOff,
  tab_switch: playTabSwitch,
  notification_ping: playNotificationPing,
  error_deny: playErrorDeny,
  ui_pop_in: playUiPopIn,
  // --- Progression ---
  fact_mastered: playFactMastered,
  mastery_challenge_appear: playMasteryChallengeAppear,
  mastery_trial_pass: playMasteryTrialPass,
  mastery_trial_fail: playMasteryTrialFail,
  mechanic_unlock: playMechanicUnlock,
  relic_unlock: playRelicUnlock,
  // --- Keeper NPC ---
  keeper_calm: playKeeperCalm,
  keeper_excited: playKeeperExcited,
  keeper_stern: playKeeperStern,
  keeper_curious: playKeeperCurious,
  // --- Screen Transitions ---
  transition_hub_dungeon: playTransitionHubDungeon,
  transition_combat_reward: playTransitionCombatReward,
  transition_to_rest: playTransitionToRest,
  transition_to_shop: playTransitionToShop,
  transition_run_end_hub: playTransitionRunEndHub,
  boot_logo: playBootLogo,
  // --- Tutorial ---
  tutorial_tooltip: playTutorialTooltip,
  tutorial_step_complete: playTutorialStepComplete,
  tutorial_complete: playTutorialComplete,
  // --- Chess ---
  chess_move: playChessMove,
  chess_capture: playChessCapture,
  chess_check: playChessCheck,
  chess_checkmate: playChessCheckmate,
}

// ---------------------------------------------------------------------------
// AudioManager class
// ---------------------------------------------------------------------------

class AudioManager {
  private ctx: AnyAudioContext | null = null
  private masterGain: GainNode | null = null
  private volume: number = 1.0
  private muted: boolean = false

  /** Decoded AudioBuffer cache — null means the file failed to load. */
  private bufferCache = new Map<SoundName, AudioBuffer | null>()
  /** Tracks in-flight fetch+decode calls to avoid duplicate requests. */
  private loadingSet = new Set<SoundName>()

  /**
   * Lazily initializes the AudioContext and master GainNode on first use.
   * Returns null when Web Audio API is unavailable (e.g. in tests or SSR).
   */
  private getContext(): { ctx: AnyAudioContext; master: GainNode } | null {
    if (typeof window === 'undefined' || !window.AudioContext && !window.webkitAudioContext) {
      return null
    }

    if (!this.ctx) {
      try {
        this.ctx = createAudioContext()
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime)
        this.masterGain.connect(this.ctx.destination)
      } catch {
        return null
      }
    }

    return { ctx: this.ctx, master: this.masterGain! }
  }

  /**
   * Lazily fetches and decodes an .m4a file for the given sound name.
   * Caches the result (including null on failure) so each file is decoded
   * at most once per session.  Returns null if no file mapping exists or
   * on any network/decode error.
   */
  private async loadSfxBuffer(name: SoundName): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(name)) return this.bufferCache.get(name)!
    if (this.loadingSet.has(name)) return null // already in-flight, skip

    const path = SFX_FILE_MAP[name]
    if (!path) return null

    this.loadingSet.add(name)
    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const result = this.getContext()
      if (!result) return null
      const audioBuffer = await result.ctx.decodeAudioData(arrayBuffer)
      this.bufferCache.set(name, audioBuffer)
      return audioBuffer
    } catch {
      // File not found or decode error — store null so we never retry.
      this.bufferCache.set(name, null)
      return null
    } finally {
      this.loadingSet.delete(name)
    }
  }

  /**
   * Unlocks the AudioContext by resuming it.
   * Must be called from within a user gesture (click, touch, keydown) to satisfy
   * mobile browser autoplay restrictions. Safe to call multiple times.
   */
  unlock(): void {
    const result = this.getContext()
    if (!result) return
    const { ctx } = result
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Silently ignore — the context may not be resumable yet.
      })
    }
  }

  /**
   * Plays a named sound.  Prefers the decoded .m4a file buffer when cached;
   * otherwise falls back to Web Audio API synthesis immediately and fires a
   * background fetch so the next call uses the file instead.
   *
   * Strategy: zero-latency on first play (synthesis), progressive upgrade to
   * file-based audio on subsequent plays.
   *
   * @param name - The name of the sound to play.
   */
  playSound(name: SoundName): void {
    if (this.muted) return

    const result = this.getContext()
    if (!result) return

    const { ctx, master } = result

    if (ctx.state === 'suspended') {
      // Context not yet unlocked by a user gesture; skip silently.
      return
    }

    // Fast path: use cached AudioBuffer from .m4a file.
    const cached = this.bufferCache.get(name)
    if (cached) {
      const source = ctx.createBufferSource()
      source.buffer = cached
      source.connect(master)
      source.start()
      return
    }

    // If the file mapping exists but isn't loaded yet, start a background
    // fetch for next time.  null in the cache means a previous fetch failed —
    // don't retry.
    if (SFX_FILE_MAP[name] !== undefined && !this.bufferCache.has(name)) {
      void this.loadSfxBuffer(name)
    }

    // Fall back to synthesis for this play.
    const fn = SOUND_MAP[name]
    fn(ctx, master)
  }

  /**
   * Preloads file-based SFX for the given sound names.
   * Call during loading screens to warm the buffer cache for critical sounds.
   *
   * @param names - Array of SoundNames to prefetch and decode.
   */
  async preloadSounds(names: SoundName[]): Promise<void> {
    await Promise.allSettled(names.map(n => this.loadSfxBuffer(n)))
  }

  /**
   * Sets the master volume level.
   *
   * @param level - Volume from 0.0 (silent) to 1.0 (full volume).
   */
  setVolume(level: number): void {
    this.volume = Math.max(0, Math.min(1, level))
    const result = this.getContext()
    if (!result) return
    const { ctx, master } = result
    if (!this.muted) {
      master.gain.setValueAtTime(this.volume, ctx.currentTime)
    }
  }

  /**
   * Mutes all audio output without changing the stored volume level.
   */
  mute(): void {
    this.muted = true
    const result = this.getContext()
    if (!result) return
    const { ctx, master } = result
    master.gain.setValueAtTime(0, ctx.currentTime)
  }

  /**
   * Restores audio output to the previously set volume level.
   */
  unmute(): void {
    this.muted = false
    const result = this.getContext()
    if (!result) return
    const { ctx, master } = result
    master.gain.setValueAtTime(this.volume, ctx.currentTime)
  }

  /**
   * Returns whether audio is currently muted.
   */
  isMuted(): boolean {
    return this.muted
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton AudioManager instance for the Recall Rogue game. */
export const audioManager = new AudioManager()
