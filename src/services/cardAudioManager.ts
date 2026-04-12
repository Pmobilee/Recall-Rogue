import { get, writable, type Writable } from 'svelte/store'
import { audioManager, type SoundName } from './audioService'
import { ambientAudio } from './ambientAudioService'

export type CardAudioCue =
  | 'correct-impact'
  | 'correct-critical'
  | 'wrong-fizzle'
  | 'card-draw'
  | 'card-cast'
  | 'enemy-hit'
  | 'enemy-death'
  | 'turn-chime'
  | 'combo-3'
  | 'combo-5'
  | 'card-swoosh-attack'
  | 'card-swoosh-shield'
  | 'card-swoosh-buff'
  | 'card-swoosh-debuff'
  | 'card-swoosh-wild'
  | 'card-discard'
  // Card events
  | 'card-select'
  | 'card-deselect'
  | 'card-fizzle'
  | 'card-forget'
  | 'charge-initiate'
  | 'double-strike'
  | 'inscription-resolve'
  // Enemy events
  | 'enemy-intent'
  | 'enemy-attack'
  | 'enemy-charge-up'
  | 'enemy-charge-release'
  | 'enemy-defend'
  | 'enemy-buff'
  | 'enemy-debuff'
  | 'enemy-enrage'
  | 'enemy-phase-transition'
  | 'enemy-heal'
  // Player health
  | 'player-damage'
  | 'shield-absorb'
  | 'shield-break'
  | 'shield-gain'
  | 'player-heal'
  | 'immunity-trigger'
  | 'player-defeated'
  | 'low-hp-warning'
  // Status effects
  | 'status-poison-apply'
  | 'status-poison-tick'
  | 'status-burn-apply'
  | 'status-burn-tick'
  | 'status-bleed-apply'
  | 'status-weakness-apply'
  | 'status-vulnerability-apply'
  | 'status-strength-apply'
  | 'status-regen-apply'
  | 'status-focus-apply'
  | 'status-expire'
  | 'status-regen-tick'
  // Chain system
  | 'chain-link-1'
  | 'chain-link-2'
  | 'chain-link-3'
  | 'chain-link-4'
  | 'chain-link-5'
  | 'chain-break'
  | 'chain-momentum'
  // Turn flow
  | 'enemy-turn-start'
  | 'ap-spend'
  | 'ap-gain'
  | 'ap-exhausted'
  | 'surge-announce'
  | 'surge-end'
  | 'perfect-turn'
  | 'combo-10'
  | 'end-turn'
  // Relic triggers
  | 'relic-trigger'
  | 'relic-death-prevent'
  | 'relic-card-spawn'
  // Quiz
  | 'quiz-appear'
  | 'quiz-answer-select'
  | 'quiz-speed-bonus'
  | 'quiz-dismiss'
  | 'quiz-timer-tick'
  // Encounters
  | 'encounter-start'
  | 'encounter-start-boss'
  | 'encounter-start-elite'
  | 'encounter-victory'
  | 'encounter-defeat'
  | 'boss-defeated'
  | 'boss-intro'
  // Map
  | 'map-open'
  | 'map-node-click'
  | 'floor-transition'
  | 'room-transition'
  // Hub
  | 'hub-welcome'
  | 'hub-start-run'
  // Shop
  | 'shop-open'
  | 'shop-purchase'
  | 'shop-insufficient'
  | 'shop-close'
  | 'shop-sell'
  | 'shop-haggle-correct'
  | 'shop-haggle-wrong'
  | 'shop-removal-burn'
  | 'shop-removal-complete'
  | 'shop-transform-shimmer'
  | 'shop-transform-dissolve'
  | 'shop-transform-vortex'
  | 'shop-transform-split'
  | 'shop-transform-materialize'
  | 'shop-transform-reveal'
  | 'shop-transform-confirm'
  | 'shop-price-tick'
  | 'shop-unaffordable'
  | 'shop-card-appear'
  | 'shop-card-flip'
  | 'shop-coin-fly'
  | 'shop-bark'
  // Rest
  | 'rest-open'
  | 'rest-heal'
  | 'rest-study'
  | 'rest-meditate'
  | 'rest-card-removed'
  // Rewards
  | 'reward-screen'
  | 'gold-collect'
  | 'card-accepted'
  | 'card-skipped'
  | 'card-rerolled'
  | 'relic-acquired'
  // Mystery
  | 'mystery-appear'
  | 'event-choice'
  | 'event-positive'
  | 'event-negative'
  // Run lifecycle
  | 'run-start'
  | 'domain-select'
  | 'floor-cleared'
  | 'retreat-chosen'
  | 'delve-deeper'
  | 'run-victory'
  | 'run-defeat'
  | 'stat-tick'
  | 'enemy-badge-tick'
  | 'fact-badge-tick'
  | 'grey-matter-tally-tick'
  | 'grade-reveal'
  | 'xp-award'
  | 'level-up'
  // UI
  | 'modal-open'
  | 'modal-close'
  | 'toggle-on'
  | 'toggle-off'
  | 'tab-switch'
  | 'deck-shuffle'
  | 'notification-ping'
  | 'error-deny'
  // Progression
  | 'fact-mastered'
  | 'mastery-challenge'
  | 'mastery-trial-pass'
  | 'mastery-trial-fail'
  | 'mechanic-unlock'
  // Keeper
  | 'keeper-calm'
  | 'keeper-excited'
  | 'keeper-stern'
  | 'keeper-curious'
  // Transitions
  | 'transition-hub-dungeon'
  | 'transition-combat-reward'
  | 'boot-logo'
  // Tutorial
  | 'tutorial-tooltip'
  | 'tutorial-step-complete'
  | 'tutorial-complete'

const CUE_TO_SOUND: Record<CardAudioCue, SoundName> = {
  'correct-impact': 'quiz_correct',
  'correct-critical': 'mastery_glow',
  'wrong-fizzle': 'quiz_wrong',
  'card-draw': 'card_deal',
  'card-cast': 'button_click',
  'enemy-hit': 'enemy_attack',
  'enemy-death': 'enemy_phase_transition',
  'turn-chime': 'collect',
  'combo-3': 'streak_milestone',
  'combo-5': 'mastery_fullscreen',
  'card-swoosh-attack': 'card_swoosh_attack',
  'card-swoosh-shield': 'card_swoosh_shield',
  'card-swoosh-buff': 'card_swoosh_buff',
  'card-swoosh-debuff': 'card_swoosh_debuff',
  'card-swoosh-wild': 'card_swoosh_wild',
  'card-discard': 'card_discard',
  // Card events
  'card-select': 'card_select',
  'card-deselect': 'card_deselect',
  'card-fizzle': 'card_fizzle',
  'card-forget': 'card_forget',
  'charge-initiate': 'charge_initiate',
  'double-strike': 'double_strike',
  'inscription-resolve': 'inscription_resolve',
  // Enemy events
  'enemy-intent': 'enemy_intent',
  'enemy-attack': 'enemy_attack',
  'enemy-charge-up': 'enemy_charge_up',
  'enemy-charge-release': 'enemy_charge_release',
  'enemy-defend': 'enemy_defend',
  'enemy-buff': 'enemy_buff',
  'enemy-debuff': 'enemy_debuff_player',
  'enemy-enrage': 'enemy_enrage',
  'enemy-phase-transition': 'enemy_phase_transition',
  'enemy-heal': 'enemy_heal',
  // Player health
  'player-damage': 'player_damage',
  'shield-absorb': 'shield_absorb',
  'shield-break': 'shield_break',
  'shield-gain': 'shield_gain',
  'player-heal': 'player_heal',
  'immunity-trigger': 'immunity_trigger',
  'player-defeated': 'player_defeated',
  'low-hp-warning': 'low_hp_warning',
  // Status effects
  'status-poison-apply': 'status_poison_apply',
  'status-poison-tick': 'status_poison_tick',
  'status-burn-apply': 'status_burn_apply',
  'status-burn-tick': 'status_burn_tick',
  'status-bleed-apply': 'status_bleed_apply',
  'status-weakness-apply': 'status_weakness_apply',
  'status-vulnerability-apply': 'status_vulnerability_apply',
  'status-strength-apply': 'status_strength_apply',
  'status-regen-apply': 'status_regen_apply',
  'status-focus-apply': 'status_focus_apply',
  'status-expire': 'status_expire',
  'status-regen-tick': 'status_regen_tick',
  // Chain
  'chain-link-1': 'chain_link_1',
  'chain-link-2': 'chain_link_2',
  'chain-link-3': 'chain_link_3',
  'chain-link-4': 'chain_link_4',
  'chain-link-5': 'chain_link_5',
  'chain-break': 'chain_break',
  'chain-momentum': 'chain_momentum',
  // Turn flow
  'enemy-turn-start': 'enemy_turn_start',
  'ap-spend': 'ap_spend',
  'ap-gain': 'ap_gain',
  'ap-exhausted': 'ap_exhausted',
  'surge-announce': 'surge_announce',
  'surge-end': 'surge_end',
  'perfect-turn': 'perfect_turn',
  'combo-10': 'combo_10',
  'end-turn': 'end_turn_click',
  // Relic
  'relic-trigger': 'relic_trigger_generic',
  'relic-death-prevent': 'relic_death_prevent',
  'relic-card-spawn': 'relic_card_spawn',
  // Quiz
  'quiz-appear': 'quiz_appear',
  'quiz-answer-select': 'quiz_answer_select',
  'quiz-speed-bonus': 'quiz_speed_bonus',
  'quiz-dismiss': 'quiz_dismiss',
  'quiz-timer-tick': 'quiz_timer_tick',
  // Encounters
  'encounter-start': 'encounter_start',
  'encounter-start-boss': 'encounter_start_boss',
  'encounter-start-elite': 'encounter_start_elite',
  'encounter-victory': 'encounter_victory',
  'encounter-defeat': 'encounter_defeat',
  'boss-defeated': 'boss_defeated',
  'boss-intro': 'boss_intro',
  // Map
  'map-open': 'map_open',
  'map-node-click': 'map_node_click',
  'floor-transition': 'floor_transition',
  'room-transition': 'room_transition',
  // Hub
  'hub-welcome': 'hub_welcome',
  'hub-start-run': 'hub_start_run',
  // Shop
  'shop-open': 'shop_open',
  'shop-purchase': 'shop_purchase',
  'shop-insufficient': 'shop_insufficient_gold',
  'shop-close': 'shop_close',
  'shop-sell': 'shop_sell',
  'shop-haggle-correct': 'quiz_correct',
  'shop-haggle-wrong': 'quiz_wrong',
  'shop-removal-burn': 'shop_removal_burn',
  'shop-removal-complete': 'shop_removal_complete',
  'shop-transform-shimmer': 'shop_transform_shimmer',
  'shop-transform-dissolve': 'shop_transform_dissolve',
  'shop-transform-vortex': 'shop_transform_vortex',
  'shop-transform-split': 'shop_transform_split',
  'shop-transform-materialize': 'shop_transform_materialize',
  'shop-transform-reveal': 'shop_transform_reveal',
  'shop-transform-confirm': 'shop_transform_confirm',
  'shop-price-tick': 'shop_price_tick',
  'shop-unaffordable': 'shop_unaffordable',
  'shop-card-appear': 'shop_card_appear',
  'shop-card-flip': 'shop_card_flip',
  'shop-coin-fly': 'shop_coin_fly',
  'shop-bark': 'shop_bark',
  // Rest
  'rest-open': 'rest_open',
  'rest-heal': 'rest_heal',
  'rest-study': 'rest_study',
  'rest-meditate': 'rest_meditate',
  'rest-card-removed': 'rest_card_removed',
  // Rewards
  'reward-screen': 'reward_screen',
  'gold-collect': 'gold_collect',
  'card-accepted': 'card_accepted',
  'card-skipped': 'card_skipped',
  'card-rerolled': 'card_rerolled',
  'relic-acquired': 'relic_acquired',
  // Mystery
  'mystery-appear': 'mystery_appear',
  'event-choice': 'event_choice',
  'event-positive': 'event_outcome_positive',
  'event-negative': 'event_outcome_negative',
  // Run lifecycle
  'run-start': 'run_start',
  'domain-select': 'domain_select',
  'floor-cleared': 'floor_cleared',
  'retreat-chosen': 'retreat_chosen',
  'delve-deeper': 'delve_deeper',
  'run-victory': 'run_victory',
  'run-defeat': 'run_defeat',
  'stat-tick': 'stat_tick',
  'enemy-badge-tick': 'stat_tick',
  'fact-badge-tick': 'stat_tick',
  'grey-matter-tally-tick': 'stat_tick',
  'grade-reveal': 'mastery_glow',
  'xp-award': 'xp_award',
  'level-up': 'level_up',
  // UI
  'modal-open': 'modal_open',
  'modal-close': 'modal_close',
  'toggle-on': 'toggle_on',
  'toggle-off': 'toggle_off',
  'tab-switch': 'tab_switch',
  'deck-shuffle': 'card_shuffle',
  'notification-ping': 'notification_ping',
  'error-deny': 'error_deny',
  // Progression
  'fact-mastered': 'fact_mastered',
  'mastery-challenge': 'mastery_challenge_appear',
  'mastery-trial-pass': 'mastery_trial_pass',
  'mastery-trial-fail': 'mastery_trial_fail',
  'mechanic-unlock': 'mechanic_unlock',
  // Keeper
  'keeper-calm': 'keeper_calm',
  'keeper-excited': 'keeper_excited',
  'keeper-stern': 'keeper_stern',
  'keeper-curious': 'keeper_curious',
  // Transitions
  'transition-hub-dungeon': 'transition_hub_dungeon',
  'transition-combat-reward': 'transition_combat_reward',
  'boot-logo': 'boot_logo',
  // Tutorial
  'tutorial-tooltip': 'tutorial_tooltip',
  'tutorial-step-complete': 'tutorial_step_complete',
  'tutorial-complete': 'tutorial_complete',
}

function readValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function persistedWritable<T>(key: string, fallback: T): Writable<T> {
  const store = writable<T>(readValue(key, fallback))
  if (typeof window !== 'undefined') {
    store.subscribe((value) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Ignore storage failures.
      }
    })
  }
  return store
}

export const sfxEnabled = persistedWritable<boolean>('card:sfxEnabled', true)
export const musicEnabled = persistedWritable<boolean>('card:musicEnabled', true)
export const sfxVolume = persistedWritable<number>('card:sfxVolume', 1)
export const musicVolume = persistedWritable<number>('card:musicVolume', 0.5)
export const ambientEnabled = persistedWritable<boolean>('card:ambientEnabled', true)
export const ambientVolume = persistedWritable<number>('card:ambientVolume', 0.7)
/** Persisted user-pause flag — survives page reloads and new runs. */
export const musicUserPaused = persistedWritable<boolean>('card:musicUserPaused', false)

let initialized = false

function applyAudioSettings(): void {
  audioManager.setVolume(Math.max(0, Math.min(1, get(sfxVolume))))

  const enabled = get(sfxEnabled)
  if (enabled) audioManager.unmute()
  else audioManager.mute()
}

export function initCardAudio(): void {
  if (initialized) return
  initialized = true

  sfxEnabled.subscribe(() => applyAudioSettings())
  sfxVolume.subscribe(() => applyAudioSettings())

  // Reserved toggles for future BGM channel integration.
  musicEnabled.subscribe(() => {})
  musicVolume.subscribe(() => {})

  // Ambient audio enable/volume — wired to ambientAudioService.
  ambientEnabled.subscribe((enabled) => {
    if (enabled) {
      ambientAudio.setEnabled(true)
    } else {
      ambientAudio.setEnabled(false)
    }
  })
  ambientVolume.subscribe((vol) => {
    ambientAudio.setVolume(Math.max(0, Math.min(1, vol)))
  })

  applyAudioSettings()
}

export function unlockCardAudio(): void {
  initCardAudio()
  audioManager.unlock()
}

export function playCardAudio(cue: CardAudioCue): void {
  if (!get(sfxEnabled)) return
  initCardAudio()
  const sound = CUE_TO_SOUND[cue]
  if (!sound) return
  audioManager.playSound(sound)
}
