/**
 * musicService.ts
 *
 * BGM playback service using HTMLAudioElement + Web Audio API AnalyserNode.
 *
 * Uses HTMLAudioElement for playback (browser-native codec decoding — works on
 * Safari, Chrome, Firefox without decodeAudioData issues) and connects it to a
 * Web Audio graph via createMediaElementSource for the spectrogram visualiser.
 *
 * Audio graph:
 *   HTMLAudioElement → MediaElementSourceNode → gainNode → AnalyserNode → destination
 */

import { type MusicCategory, type MusicTrack, getTracksByCategory } from '../data/musicTracks'
import { ambientAudio } from './ambientAudioService'

const PREFS_KEY = 'music_prefs'
const CROSSFADE_MS = 1500

interface MusicPrefs {
  volume: number
  muted: boolean
  category: MusicCategory
  lastTrackId: string | null
}

class MusicService {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null

  /** The currently active audio element. */
  private currentAudio: HTMLAudioElement | null = null
  /** MediaElementSource for the current audio — can only be created once per element. */
  private currentMediaSource: MediaElementAudioSourceNode | null = null

  private _isPlaying = false
  private _currentTrack: MusicTrack | null = null
  private _currentCategory: MusicCategory = 'quiet'
  private _volume = 0.5
  private _muted = false
  private _userGestureReceived = false

  private shuffleQueue: MusicTrack[] = []
  private listeners = new Set<() => void>()

  // ─── Public getters ──────────────────────────────────────────────────────

  get isPlaying(): boolean { return this._isPlaying }
  get currentTrack(): MusicTrack | null { return this._currentTrack }
  get currentCategory(): MusicCategory { return this._currentCategory }
  get volume(): number { return this._volume }
  get muted(): boolean { return this._muted }
  get ready(): boolean {
    return this._userGestureReceived && this.ctx != null && this.ctx.state !== 'suspended'
  }

  // ─── Initialisation ───────────────────────────────────────────────────────

  /** Create AudioContext + AnalyserNode lazily. Safe to call multiple times. */
  init(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 64
    this.analyser.smoothingTimeConstant = 0.75
    this.analyser.connect(this.ctx.destination)
    this.loadPrefs()
  }

  /** Mark user gesture received and resume suspended context. */
  unlock(): void {
    this._userGestureReceived = true
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  /** Ensure AudioContext is running. */
  private async ensureRunning(): Promise<boolean> {
    if (!this.ctx) return false
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    return this.ctx.state === 'running'
  }

  /**
   * Play a track using HTMLAudioElement for playback (browser-native decoding).
   * Connects to Web Audio AnalyserNode AFTER playback starts, for spectrogram.
   */
  async playTrack(track: MusicTrack): Promise<void> {
    try {
      this.init()
      console.log(`[Music] Playing: ${track.title} (${track.file})`)

      // Create audio element — do NOT connect to Web Audio yet (Safari fails if
      // createMediaElementSource is called before the element can play)
      const audio = new Audio()
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0  // start silent for crossfade-in

      // Wait for loadable state before playing
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve() }
        const onError = () => {
          cleanup()
          const e = audio.error
          reject(new Error(`Failed to load: ${track.file} (code=${e?.code ?? '?'}, ${e?.message ?? 'unknown'})`))
        }
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay)
          audio.removeEventListener('error', onError)
        }
        audio.addEventListener('canplaythrough', onCanPlay, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.src = track.file
        audio.load()
      })

      // Crossfade out old track
      if (this.currentAudio) {
        this.fadeOutAndDispose(this.currentAudio)
      }

      // Start playback — volume crossfade via element.volume (not Web Audio gain)
      await audio.play()
      this.crossfadeIn(audio)

      // Now connect to Web Audio analyser (after playback started)
      this.connectAnalyser(audio)

      this.currentAudio = audio

      ambientAudio.setMusicCoexistence(true)
      console.log(`[Music] PLAYING: "${track.title}"`)
      this._currentTrack = track
      this._isPlaying = true
      this.persistPrefs()
      this.notify()
    } catch (err) {
      console.error('[Music] playTrack failed:', err)
    }
  }

  /** Crossfade audio.volume from 0 → target over CROSSFADE_MS. */
  private crossfadeIn(audio: HTMLAudioElement): void {
    const target = this._muted ? 0 : this._volume
    const steps = 30
    const stepMs = CROSSFADE_MS / steps
    let step = 0
    const interval = setInterval(() => {
      step++
      audio.volume = Math.min(1, (step / steps) * target)
      if (step >= steps) clearInterval(interval)
    }, stepMs)
  }

  /** Fade out an audio element and clean it up after the fade. */
  private fadeOutAndDispose(audio: HTMLAudioElement): void {
    const startVol = audio.volume
    const steps = 20
    const stepMs = CROSSFADE_MS / steps
    let step = 0
    const interval = setInterval(() => {
      step++
      audio.volume = Math.max(0, startVol * (1 - step / steps))
      if (step >= steps) {
        clearInterval(interval)
        audio.pause()
        audio.src = ''
        audio.load()
      }
    }, stepMs)
  }

  /** Try to connect audio element to Web Audio analyser for spectrogram data. */
  private connectAnalyser(audio: HTMLAudioElement): void {
    if (!this.ctx || !this.analyser) return
    try {
      // Resume context if needed
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      const source = this.ctx.createMediaElementSource(audio)
      source.connect(this.analyser)
      this.currentMediaSource = source
    } catch (err) {
      // Non-fatal — spectrogram just won't animate from real data
      console.warn('[Music] Could not connect analyser (spectrogram will use idle animation):', err)
    }
  }

  /** Set the active category, build a shuffled queue, and begin playback. */
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

  /** Switch to a different category. No-op if already on that category and playing. */
  switchCategory(category: MusicCategory): void {
    this._userGestureReceived = true
    console.log(`[Music] switchCategory: ${category} (current=${this._currentCategory}, playing=${this._isPlaying})`)
    if (category === this._currentCategory && this._isPlaying) return
    void this.playCategory(category)
  }

  /** Skip to the next track in the shuffle queue. */
  async next(): Promise<void> {
    this._userGestureReceived = true
    const tracks = getTracksByCategory(this._currentCategory)
    if (tracks.length === 0) return

    if (this.shuffleQueue.length === 0) {
      const lastId = this._currentTrack?.id
      const fresh = this.shuffleArray([...tracks])
      if (fresh.length > 1 && fresh[fresh.length - 1]!.id === lastId) {
        const tmp = fresh[fresh.length - 1]!
        fresh[fresh.length - 1] = fresh[fresh.length - 2]!
        fresh[fresh.length - 2] = tmp
      }
      this.shuffleQueue = fresh
    }

    const next = this.shuffleQueue.pop()
    if (next) {
      await this.playTrack(next)
    }
  }

  /** Play a random track from the current category. */
  async prev(): Promise<void> {
    this._userGestureReceived = true
    const tracks = getTracksByCategory(this._currentCategory)
    if (tracks.length === 0) return
    this.shuffleQueue = this.shuffleArray([...tracks])
    await this.next()
  }

  /** Set master volume (0–1). */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.currentAudio && !this._muted) {
      this.currentAudio.volume = this._volume
    }
    this.persistPrefs()
    this.notify()
  }

  /** Toggle mute. */
  toggleMute(): void {
    this._muted = !this._muted
    if (this.currentAudio) {
      this.currentAudio.volume = this._muted ? 0 : this._volume
    }
    this.persistPrefs()
    this.notify()
  }

  /** Toggle play/pause. Called from user click. */
  togglePlayPause(): void {
    this._userGestureReceived = true
    console.log(`[Music] togglePlayPause: playing=${this._isPlaying}, track=${this._currentTrack?.title ?? 'none'}`)
    if (!this._currentTrack) {
      void this.playCategory(this._currentCategory)
      return
    }
    if (this._isPlaying && this.currentAudio) {
      this.currentAudio.pause()
      this._isPlaying = false
      ambientAudio.setMusicCoexistence(false)
      this.notify()
    } else if (this.currentAudio) {
      void this.currentAudio.play().then(() => {
        this._isPlaying = true
        ambientAudio.setMusicCoexistence(true)
        this.notify()
      })
    } else {
      void this.playCategory(this._currentCategory)
    }
  }

  /** Start playback if not already playing. No-op without prior user gesture. */
  startIfNotPlaying(): void {
    if (this._isPlaying) return
    if (!this._userGestureReceived) return
    void this.playCategory(this._currentCategory)
  }

  /** Fade out to silence and stop. */
  async fadeOutAndStop(durationMs: number): Promise<void> {
    if (!this.currentAudio) return
    this.fadeOutAndDispose(this.currentAudio)
    await new Promise<void>(resolve => setTimeout(resolve, durationMs + 200))
    this.currentAudio = null
    this.currentMediaSource = null
    ambientAudio.setMusicCoexistence(false)
    this._isPlaying = false
    this.notify()
  }

  // ─── Visualiser ───────────────────────────────────────────────────────────

  /** Populate `out` with frequency data for the spectrogram. */
  getFrequencyData(out: Uint8Array<ArrayBuffer>): void {
    this.analyser?.getByteFrequencyData(out)
  }

  // ─── Pub/Sub ──────────────────────────────────────────────────────────────

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
    } catch { /* localStorage may be unavailable */ }
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) return
      const prefs = JSON.parse(raw) as Partial<MusicPrefs>
      if (typeof prefs.volume === 'number') this._volume = Math.max(0, Math.min(1, prefs.volume))
      if (typeof prefs.muted === 'boolean') this._muted = prefs.muted
      if (prefs.category === 'epic' || prefs.category === 'quiet') this._currentCategory = prefs.category
    } catch { /* ignore malformed prefs */ }
  }

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

/** Singleton instance. */
export const musicService = new MusicService()
