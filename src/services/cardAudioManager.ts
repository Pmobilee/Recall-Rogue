import { get, writable, type Writable } from 'svelte/store'
import { audioManager, type SoundName } from './audioService'

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

const CUE_TO_SOUND: Record<CardAudioCue, SoundName> = {
  'correct-impact': 'quiz_correct',
  'correct-critical': 'mastery_glow',
  'wrong-fizzle': 'quiz_wrong',
  'card-draw': 'item_pickup',
  'card-cast': 'button_click',
  'enemy-hit': 'mine_rock',
  'enemy-death': 'mine_break',
  'turn-chime': 'collect',
  'combo-3': 'streak_milestone',
  'combo-5': 'mastery_fullscreen',
  'card-swoosh-attack': 'card_swoosh_attack',
  'card-swoosh-shield': 'card_swoosh_shield',
  'card-swoosh-buff': 'card_swoosh_buff',
  'card-swoosh-debuff': 'card_swoosh_debuff',
  'card-swoosh-wild': 'card_swoosh_wild',
  'card-discard': 'card_discard',
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
