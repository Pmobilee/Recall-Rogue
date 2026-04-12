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

import { type MusicCategory, type MusicTrack, getTracksByCategory, getPlayableTracks } from '../data/musicTracks'
import { ambientAudio } from './ambientAudioService'
import { musicVolume, musicEnabled } from './cardAudioManager'
import { get } from 'svelte/store'
import { playerSave } from '../ui/stores/playerData'

const PREFS_KEY = 'music_prefs'
const CROSSFADE_MS = 1500

interface MusicPrefs {
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
  private _userGestureReceived = false
  /** Duration for the next crossfadeIn call — reset to CROSSFADE_MS after use. */
  private _fadeInDuration: number = CROSSFADE_MS
  /**
   * Set to true when the user explicitly pauses via MusicWidget.togglePlayPause().
   * startWithFadeIn() and startIfNotPlaying() respect this flag so screen transitions
   * within a run do not restart music the user deliberately silenced.
   * Reset by resetUserPause() when a NEW run begins.
   */
  private _userPaused = false
  /** Active crossfade-in interval, stored so user volume changes can cancel it immediately. */
  private _crossfadeInterval: ReturnType<typeof setInterval> | null = null

  private shuffleQueue: MusicTrack[] = []
  private listeners = new Set<() => void>()

  // ─── Preview state ────────────────────────────────────────────────────────
  private previewAudio: HTMLAudioElement | null = null
  private previewTimeout: ReturnType<typeof setTimeout> | null = null
  private _isPreviewing = false

  // ─── Public getters ──────────────────────────────────────────────────────

  get isPlaying(): boolean { return this._isPlaying }
  get currentTrack(): MusicTrack | null { return this._currentTrack }
  get currentCategory(): MusicCategory { return this._currentCategory }
  get volume(): number { return get(musicVolume) }
  get muted(): boolean { return !get(musicEnabled) }
  get ready(): boolean {
    return this._userGestureReceived && this.ctx != null && this.ctx.state !== 'suspended'
  }
  get isPreviewing(): boolean { return this._isPreviewing }
  /** True when the user has explicitly paused via the MusicWidget. See resetUserPause(). */
  get userPaused(): boolean { return this._userPaused }

  // ─── Initialisation ───────────────────────────────────────────────────────

  /** Create AudioContext + AnalyserNode lazily. Safe to call multiple times. */
  init(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 64
    this.analyser.smoothingTimeConstant = 0.75
    this.analyser.connect(this.ctx.destination)

    // Sync volume from settings stores.
    // IMPORTANT: Cancel any active crossfade before applying the new volume — this ensures
    // volume slider changes during a 5-second fade-in take immediate precedence (Fix 3).
    musicVolume.subscribe(vol => {
      if (this._crossfadeInterval) {
        clearInterval(this._crossfadeInterval)
        this._crossfadeInterval = null
      }
      if (this.currentAudio && get(musicEnabled)) {
        this.currentAudio.volume = vol
      }
    })
    musicEnabled.subscribe(enabled => {
      if (this._crossfadeInterval) {
        clearInterval(this._crossfadeInterval)
        this._crossfadeInterval = null
      }
      if (this.currentAudio) {
        this.currentAudio.volume = enabled ? get(musicVolume) : 0
      }
    })

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
   * Fades out old track fully BEFORE starting the new one (sequential, not overlapping).
   */
  async playTrack(track: MusicTrack): Promise<void> {
    try {
      this.init()
      console.log(`[Music] Playing: ${track.title} (${track.file})`)

      // Fade out old track fully BEFORE starting new one
      if (this.currentAudio) {
        await this.fadeOutAndDispose(this.currentAudio)
        this.currentAudio = null
        this.currentMediaSource = null
      }

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

      // Start playback — volume crossfade via element.volume (not Web Audio gain)
      await audio.play()

      // Epic tracks: skip 5-second intro (intros sound too similar)
      if (track.category === 'epic') {
        audio.currentTime = 5
      }

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

  /** Crossfade audio.volume from 0 → target over _fadeInDuration ms (then resets to default). */
  private crossfadeIn(audio: HTMLAudioElement): void {
    // Cancel any in-progress crossfade before starting a new one
    if (this._crossfadeInterval) {
      clearInterval(this._crossfadeInterval)
      this._crossfadeInterval = null
    }
    const duration = this._fadeInDuration
    this._fadeInDuration = CROSSFADE_MS  // reset to default after use
    const target = get(musicEnabled) ? get(musicVolume) : 0
    const steps = 30
    const stepMs = duration / steps
    let step = 0
    this._crossfadeInterval = setInterval(() => {
      step++
      audio.volume = Math.min(1, (step / steps) * target)
      if (step >= steps) {
        clearInterval(this._crossfadeInterval!)
        this._crossfadeInterval = null
      }
    }, stepMs)
  }

  /**
   * Fade out an audio element and clean it up after the fade.
   * Returns a Promise that resolves when the fade is fully complete.
   */
  private fadeOutAndDispose(audio: HTMLAudioElement): Promise<void> {
    return new Promise(resolve => {
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
          resolve()
        }
      }, stepMs)
    })
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
    const tracks = getPlayableTracks(category, this.getUnlockedIds())
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
    const tracks = getPlayableTracks(this._currentCategory, this.getUnlockedIds())
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
    const tracks = getPlayableTracks(this._currentCategory, this.getUnlockedIds())
    if (tracks.length === 0) return
    this.shuffleQueue = this.shuffleArray([...tracks])
    await this.next()
  }

  /** Set master volume (0–1) by writing to the shared musicVolume store. */
  setVolume(v: number): void {
    musicVolume.set(Math.max(0, Math.min(1, v)))
    this.notify()
  }

  /** Toggle mute by toggling the shared musicEnabled store.
   * Calls init() first so subscriptions are active even before the first track plays.
   * Also immediately applies the new mute state to currentAudio as belt-and-suspenders
   * (the store subscription handles this too, but only if init() already ran).
   */
  toggleMute(): void {
    this.init()
    musicEnabled.update(v => !v)
    // Immediately apply to currentAudio in case the subscription fires before
    // currentAudio is set (race condition on init)
    if (this.currentAudio) {
      this.currentAudio.volume = get(musicEnabled) ? get(musicVolume) : 0
    }
    this.notify()
  }

  /** Toggle play/pause. Called from user click. */
  togglePlayPause(): void {
    this._userGestureReceived = true
    console.log(`[Music] togglePlayPause: playing=${this._isPlaying}, track=${this._currentTrack?.title ?? 'none'}`)
    if (!this._currentTrack) {
      this._userPaused = false
      void this.playCategory(this._currentCategory)
      return
    }
    if (this._isPlaying && this.currentAudio) {
      this.currentAudio.pause()
      this._isPlaying = false
      this._userPaused = true
      ambientAudio.setMusicCoexistence(false)
      this.notify()
    } else if (this.currentAudio) {
      this._userPaused = false
      void this.currentAudio.play().then(() => {
        this._isPlaying = true
        ambientAudio.setMusicCoexistence(true)
        this.notify()
      })
    } else {
      this._userPaused = false
      void this.playCategory(this._currentCategory)
    }
  }

  /** Start playback if not already playing. No-op without prior user gesture or user-initiated pause. */
  startIfNotPlaying(): void {
    if (this._userPaused) return
    if (this._isPlaying) return
    if (!this._userGestureReceived) return
    void this.playCategory(this._currentCategory)
  }

  /**
   * Start playback with a slow fade-in. Used at run start for a gentle intro.
   * No-op if already playing, no user gesture received, or user has explicitly paused.
   * The user-pause guard prevents screen transitions within a run from restarting
   * music the player deliberately silenced. Call resetUserPause() when a NEW run begins.
   */
  startWithFadeIn(durationMs: number): void {
    if (this._userPaused) return
    if (this._isPlaying) return
    if (!this._userGestureReceived) return
    this._fadeInDuration = durationMs
    void this.playCategory(this._currentCategory)
  }

  /**
   * Clear the user-pause flag so startWithFadeIn/startIfNotPlaying will resume normally.
   * Call this when a NEW run begins (not between screens within a run), so music plays
   * fresh for the next run even if the player paused during the previous one.
   */
  resetUserPause(): void {
    this._userPaused = false
  }

  /** Fade out to silence and stop. */
  async fadeOutAndStop(durationMs: number): Promise<void> {
    if (!this.currentAudio) return
    await this.fadeOutAndDispose(this.currentAudio)
    this.currentAudio = null
    this.currentMediaSource = null
    ambientAudio.setMusicCoexistence(false)
    this._isPlaying = false
    this.notify()
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  /** Play a 15-second preview snippet from the middle of a track. */
  async previewTrack(track: MusicTrack): Promise<void> {
    this.stopPreview()

    try {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.volume = 0

      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve() }
        const onError = () => { cleanup(); reject(new Error(`Preview load failed: ${track.file}`)) }
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay)
          audio.removeEventListener('error', onError)
        }
        audio.addEventListener('canplaythrough', onCanPlay, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.src = track.file
        audio.load()
      })

      // Seek to middle of track
      const midpoint = Math.max(0, (track.duration / 2) - 7.5)
      audio.currentTime = midpoint
      await audio.play()

      this.previewAudio = audio
      this._isPreviewing = true

      // Duck main BGM to 20%
      if (this.currentAudio) {
        this.currentAudio.volume = get(musicVolume) * 0.2
      }

      // Fade in preview over 500ms
      this.fadePreviewVolume(audio, 0, get(musicVolume), 500)

      // Auto-stop after 15 seconds (with 500ms fade-out at end)
      this.previewTimeout = setTimeout(() => {
        this.fadePreviewVolume(audio, audio.volume, 0, 500, () => {
          this.stopPreview()
        })
      }, 14500)

      this.notify()
    } catch (err) {
      console.error('[Music] Preview failed:', err)
      this.stopPreview()
    }
  }

  /** Stop the current preview and restore main BGM volume. */
  stopPreview(): void {
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout)
      this.previewTimeout = null
    }
    if (this.previewAudio) {
      this.previewAudio.pause()
      this.previewAudio.src = ''
      this.previewAudio.load()
      this.previewAudio = null
    }
    // Restore main BGM volume
    if (this.currentAudio && get(musicEnabled)) {
      this.currentAudio.volume = get(musicVolume)
    }
    this._isPreviewing = false
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

  /** Returns the player's unlocked music track IDs from the save. */
  private getUnlockedIds(): string[] {
    return get(playerSave)?.unlockedTracks ?? []
  }

  /** Fade an audio element's volume from -> to over durationMs. */
  private fadePreviewVolume(audio: HTMLAudioElement, from: number, to: number, durationMs: number, onComplete?: () => void): void {
    const steps = 20
    const stepMs = durationMs / steps
    let step = 0
    const interval = setInterval(() => {
      step++
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * (step / steps)))
      if (step >= steps) {
        clearInterval(interval)
        onComplete?.()
      }
    }, stepMs)
  }

  private notify(): void {
    this.listeners.forEach(fn => fn())
  }

  private persistPrefs(): void {
    try {
      const prefs: MusicPrefs = {
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
