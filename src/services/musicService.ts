/**
 * musicService.ts
 *
 * BGM playback service for Recall Rogue using the Web Audio API.
 *
 * Audio graph:
 *   AudioBufferSourceNode → per-source GainNode → masterGain → AnalyserNode → destination
 *
 * Features:
 * - Lazy AudioContext creation (requires user gesture)
 * - Crossfade transitions (1.5s linear ramp)
 * - Shuffle queue with Fisher-Yates, back-to-back repeat avoidance
 * - LRU buffer cache (max 3 decoded AudioBuffers)
 * - Frequency data via AnalyserNode (for visualizers)
 * - Pub/sub state notifications
 * - Preferences persisted to localStorage
 *
 * Usage:
 *   import { musicService } from '../services/musicService'
 *   musicService.init()           // call from first user gesture handler
 *   musicService.playCategory('epic')
 */

import { type MusicCategory, type MusicTrack, getTracksByCategory } from '../data/musicTracks'
import { ambientAudio } from './ambientAudioService'

const PREFS_KEY = 'music_prefs'
const CACHE_MAX = 3
const CROSSFADE_DURATION = 1.5
const CROSSFADE_DISCONNECT_DELAY = 1.6

interface MusicPrefs {
  volume: number
  muted: boolean
  category: MusicCategory
  lastTrackId: string | null
}

class MusicService {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private currentSourceGain: GainNode | null = null

  private _isPlaying = false
  private _currentTrack: MusicTrack | null = null
  private _currentCategory: MusicCategory = 'quiet'
  private _volume = 0.5
  private _muted = false

  /** Ordered list of upcoming tracks; pop from end for O(1) dequeue. */
  private shuffleQueue: MusicTrack[] = []

  /** LRU buffer cache: Map preserves insertion order; we evict the first key. */
  private bufferCache = new Map<string, AudioBuffer>()

  /** Listeners for state change notifications. */
  private listeners = new Set<() => void>()

  /**
   * Flag to prevent `onended` triggering `next()` when we manually stopped a
   * source during crossfade or explicit stop.
   */
  private manualStop = false

  // ─── Public getters ──────────────────────────────────────────────────────

  get isPlaying(): boolean { return this._isPlaying }
  get currentTrack(): MusicTrack | null { return this._currentTrack }
  get currentCategory(): MusicCategory { return this._currentCategory }
  get volume(): number { return this._volume }
  get muted(): boolean { return this._muted }

  // ─── Initialisation ───────────────────────────────────────────────────────

  /** Whether the AudioContext was created inside a real user gesture. */
  private _userGestureReceived = false

  /**
   * Create AudioContext and audio graph lazily.
   * Must be called from within a user gesture handler to satisfy browser autoplay policy.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (this.ctx) return

    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 64
    this.analyser.smoothingTimeConstant = 0.75

    // masterGain → analyser → destination
    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.ctx.destination)

    this.loadPrefs()
  }

  /**
   * Resume a suspended AudioContext and mark that a user gesture has been received.
   * Call from any user gesture handler to unblock audio after the browser suspends it.
   */
  unlock(): void {
    this._userGestureReceived = true
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  /** Whether the service has been unlocked by a user gesture and is ready to play. */
  get ready(): boolean {
    return this._userGestureReceived && this.ctx != null && this.ctx.state !== 'suspended'
  }

  // ─── Buffer management ────────────────────────────────────────────────────

  /**
   * Fetch, decode, and cache an AudioBuffer for a track.
   * Implements a simple LRU by evicting the oldest entry when the cache exceeds CACHE_MAX.
   */
  async loadBuffer(track: MusicTrack): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(track.id)
    if (cached) {
      // Refresh LRU position
      this.bufferCache.delete(track.id)
      this.bufferCache.set(track.id, cached)
      return cached
    }

    if (!this.ctx) {
      throw new Error('musicService.loadBuffer called before init()')
    }

    const response = await fetch(track.file)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio track "${track.id}": ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)

    // Evict oldest if over limit
    if (this.bufferCache.size >= CACHE_MAX) {
      const oldestKey = this.bufferCache.keys().next().value
      if (oldestKey !== undefined) {
        this.bufferCache.delete(oldestKey)
      }
    }
    this.bufferCache.set(track.id, audioBuffer)
    return audioBuffer
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  /**
   * Ensure AudioContext is running. Awaits resume if suspended.
   */
  private async ensureRunning(): Promise<boolean> {
    if (!this.ctx || !this.masterGain) {
      console.warn('[Music] ensureRunning: no AudioContext')
      return false
    }
    if (this.ctx.state === 'suspended') {
      console.log('[Music] Resuming suspended AudioContext...')
      await this.ctx.resume()
      console.log(`[Music] AudioContext resumed: ${this.ctx.state}`)
    }
    return this.ctx.state === 'running'
  }

  /**
   * Load and play a track, crossfading from any currently playing source.
   * New source loops indefinitely. Preloads the next track in the queue.
   */
  async playTrack(track: MusicTrack): Promise<void> {
    try {
      this.init()
      const running = await this.ensureRunning()
      if (!running || !this.ctx || !this.masterGain) {
        console.warn('[Music] playTrack: AudioContext not running')
        return
      }

      console.log(`[Music] Loading: ${track.title} (${track.file})`)

      const buffer = await this.loadBuffer(track)
      console.log(`[Music] Buffer loaded: ${buffer.duration.toFixed(1)}s, ctx.state=${this.ctx.state}`)

      const now = this.ctx.currentTime

      // Create new source + its own gain node.
      // Ramp per-source gain to 1.0 — master gain node controls overall volume.
      const newSourceGain = this.ctx.createGain()
      newSourceGain.gain.setValueAtTime(0, now)
      newSourceGain.gain.linearRampToValueAtTime(1, now + CROSSFADE_DURATION)
      newSourceGain.connect(this.masterGain)

      const newSource = this.ctx.createBufferSource()
      newSource.buffer = buffer
      newSource.loop = true
      newSource.connect(newSourceGain)

      // Fade out old source, if any
      if (this.currentSource && this.currentSourceGain) {
        const oldSource = this.currentSource
        const oldSourceGain = this.currentSourceGain
        oldSourceGain.gain.setValueAtTime(oldSourceGain.gain.value, now)
        oldSourceGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_DURATION)
        setTimeout(() => {
          this.manualStop = true
          try { oldSource.stop() } catch { /* already stopped */ }
          oldSourceGain.disconnect()
          this.manualStop = false
        }, CROSSFADE_DISCONNECT_DELAY * 1000)
      }

      this.currentSource = newSource
      this.currentSourceGain = newSourceGain

      const thisSource = newSource
      newSource.onended = () => {
        if (!this.manualStop && this.currentSource === thisSource) {
          void this.next()
        }
      }

      newSource.start()
      ambientAudio.setMusicCoexistence(true)
      console.log(`[Music] PLAYING: "${track.title}" | gain=${this.masterGain.gain.value}`)
      this._currentTrack = track
      this._isPlaying = true
      this.persistPrefs()
      this.notify()

      // Preload next track
      const peek = this.shuffleQueue[this.shuffleQueue.length - 1]
      if (peek) {
        void this.loadBuffer(peek).catch(() => { /* non-critical */ })
      }
    } catch (err) {
      console.error('[Music] playTrack failed:', err)
    }
  }

  /**
   * Set the active category, build a shuffled queue, and begin playback.
   */
  async playCategory(category: MusicCategory): Promise<void> {
    this.init()
    this._currentCategory = category
    const tracks = getTracksByCategory(category)
    this.shuffleQueue = this.shuffleArray([...tracks])
    const first = this.shuffleQueue.pop()
    if (first) {
      await this.playTrack(first)
    }
  }

  /**
   * Switch to a different category. No-op if already on that category and playing.
   */
  switchCategory(category: MusicCategory): void {
    this._userGestureReceived = true
    console.log(`[Music] switchCategory: ${category} (current=${this._currentCategory}, playing=${this._isPlaying})`)
    if (category === this._currentCategory && this._isPlaying) return
    void this.playCategory(category)
  }

  /**
   * Skip to the next track in the shuffle queue.
   * Reshuffles when the queue is empty, avoiding back-to-back repeat.
   */
  async next(): Promise<void> {
    this._userGestureReceived = true
    const category = this._currentCategory
    const tracks = getTracksByCategory(category)
    if (tracks.length === 0) return

    if (this.shuffleQueue.length === 0) {
      // Reshuffle, avoiding the track that just played
      const lastId = this._currentTrack?.id
      let fresh = this.shuffleArray([...tracks])
      // If the reshuffled first pick is the same as what just played, swap it
      if (fresh.length > 1 && fresh[fresh.length - 1].id === lastId) {
        const tmp = fresh[fresh.length - 1]
        fresh[fresh.length - 1] = fresh[fresh.length - 2]
        fresh[fresh.length - 2] = tmp
      }
      this.shuffleQueue = fresh
    }

    const next = this.shuffleQueue.pop()
    if (next) {
      await this.playTrack(next)
    }
  }

  /**
   * Go to a previous-ish track. Reshuffles and plays a random track from the
   * current category (no history stack maintained).
   */
  async prev(): Promise<void> {
    this._userGestureReceived = true
    const tracks = getTracksByCategory(this._currentCategory)
    if (tracks.length === 0) return
    this.shuffleQueue = this.shuffleArray([...tracks])
    await this.next()
  }

  /**
   * Set master volume (clamped 0–1). Ramps over 50 ms to avoid clicks.
   */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.masterGain && this.ctx && !this._muted) {
      const now = this.ctx.currentTime
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
      this.masterGain.gain.linearRampToValueAtTime(this._volume, now + 0.05)
    }
    this.persistPrefs()
    this.notify()
  }

  /**
   * Toggle mute. When unmuting, restores to current volume level.
   */
  toggleMute(): void {
    this._muted = !this._muted
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime
      const target = this._muted ? 0 : this._volume
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.05)
    }
    this.persistPrefs()
    this.notify()
  }

  /**
   * Toggle play/pause. Called from click handler (user gesture).
   * If no track has been played yet, starts playing the current category.
   */
  togglePlayPause(): void {
    this._userGestureReceived = true
    console.log(`[Music] togglePlayPause: isPlaying=${this._isPlaying}, currentTrack=${this._currentTrack?.title ?? 'none'}, ctx=${this.ctx?.state ?? 'null'}`)
    if (!this._currentTrack) {
      // No track ever played — start from current category
      void this.playCategory(this._currentCategory)
      return
    }
    if (this._isPlaying && this.ctx) {
      void this.ctx.suspend().then(() => {
        this._isPlaying = false
        ambientAudio.setMusicCoexistence(false)
        this.notify()
      })
    } else {
      // Resume — playTrack handles ensureRunning internally
      void this.playCategory(this._currentCategory)
    }
  }

  /**
   * Start playback with the last-used category if not already playing.
   * Safe to call on every screen mount — no-op when music is active or
   * when AudioContext has not been unlocked by a user gesture yet.
   */
  startIfNotPlaying(): void {
    if (this._isPlaying) return
    if (!this._userGestureReceived) return  // can't play without user gesture
    this.init()
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume()
    }
    void this.playCategory(this._currentCategory)
  }

  /**
   * Fade out to silence over the given duration (ms), then stop the source.
   */
  async fadeOutAndStop(durationMs: number): Promise<void> {
    if (!this.masterGain || !this.ctx) return
    const durationSec = durationMs / 1000
    const now = this.ctx.currentTime
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(0, now + durationSec)

    await new Promise<void>(resolve => setTimeout(resolve, durationMs))

    this.manualStop = true
    try { this.currentSource?.stop() } catch { /* already stopped */ }
    this.manualStop = false
    this.currentSource = null
    this.currentSourceGain = null
    ambientAudio.setMusicCoexistence(false)
    this._isPlaying = false
    this.notify()
  }

  // ─── Visualiser ───────────────────────────────────────────────────────────

  /**
   * Populate `out` with the current frequency byte data from the AnalyserNode.
   * `out` must be a Uint8Array of length >= analyser.frequencyBinCount (32 for fftSize=64).
   * No-op if the analyser is not yet initialised.
   */
  getFrequencyData(out: Uint8Array<ArrayBuffer>): void {
    this.analyser?.getByteFrequencyData(out)
  }

  // ─── Pub/Sub ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to state change notifications.
   * @returns Unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private notify(): void {
    this.listeners.forEach(fn => fn())
  }

  private persistPrefs(): void {
    try {
      const prefs: MusicPrefs = {
        volume: this._volume,
        muted: this._muted,
        category: this._currentCategory,
        lastTrackId: this._currentTrack?.id ?? null,
      }
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded)
    }
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) return
      const prefs = JSON.parse(raw) as Partial<MusicPrefs>
      if (typeof prefs.volume === 'number') this._volume = Math.max(0, Math.min(1, prefs.volume))
      if (typeof prefs.muted === 'boolean') this._muted = prefs.muted
      if (prefs.category === 'epic' || prefs.category === 'quiet') this._currentCategory = prefs.category

      // Apply stored volume to masterGain immediately
      if (this.masterGain) {
        this.masterGain.gain.value = this._muted ? 0 : this._volume
      }
    } catch {
      // Malformed prefs — silently ignore and use defaults
    }
  }

  /** Fisher-Yates in-place shuffle. Returns the same array for convenience. */
  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]!
      arr[j] = tmp!
    }
    return arr
  }
}

/** Singleton instance — import this everywhere. */
export const musicService = new MusicService()
