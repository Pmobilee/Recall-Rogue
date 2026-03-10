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
}

// ---------------------------------------------------------------------------
// AudioManager class
// ---------------------------------------------------------------------------

class AudioManager {
  private ctx: AnyAudioContext | null = null
  private masterGain: GainNode | null = null
  private volume: number = 1.0
  private muted: boolean = false

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
   * Plays a named sound programmatically using Web Audio API synthesis.
   * No-op when muted, volume is zero, or AudioContext is unavailable.
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

    const fn = SOUND_MAP[name]
    fn(ctx, master)
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
