/**
 * Manages biome ambient audio, crossfading, and hazard sound effects.
 * Phase 9.7 — optimized for mobile with lazy loading and compressed formats.
 */

import { BIOME_AUDIO, type BiomeAudio } from '../../data/biomeAudio'

/**
 * Manages biome ambient audio with crossfading between biome tracks.
 * Audio assets are lazy-loaded per biome to minimize initial load time.
 */
export class AudioManager {
  private scene: Phaser.Scene
  private currentLoop: Phaser.Sound.BaseSound | null = null
  private currentBiomeId: string | null = null
  private isCrossfading = false
  private musicVolume = 1.0
  private sfxVolume = 1.0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.loadVolumeSettings()
  }

  /**
   * Transitions to the ambient loop for the given biome.
   * Crossfades from the current loop using the biome's volumeProfile.crossfadeDuration.
   */
  public transitionToBiome(biomeId: string): void {
    if (this.currentBiomeId === biomeId) return
    const audio = BIOME_AUDIO[biomeId]
    if (!audio) return

    this.playTransitionSting(audio)
    this.crossfadeToLoop(audio)
    this.currentBiomeId = biomeId
  }

  /**
   * Plays a hazard-specific sound effect for the current biome.
   * @param hazardKey - one of the keys in BiomeAudio.hazardSfx
   */
  public playHazardSfx(hazardKey: string): void {
    if (!this.currentBiomeId) return
    const audio = BIOME_AUDIO[this.currentBiomeId]
    if (!audio || !audio.hazardSfx.includes(hazardKey)) return
    if (!this.scene.cache.audio.has(hazardKey)) return
    this.scene.sound.play(hazardKey, {
      volume: audio.volumeProfile.hazardVolume * this.sfxVolume,
    })
  }

  /** Stops all audio and releases resources. */
  public stopAll(): void {
    this.currentLoop?.stop()
    this.currentLoop = null
    this.currentBiomeId = null
    this.isCrossfading = false
  }

  /** Sets master music volume (0.0-1.0) and persists to localStorage. */
  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol))
    localStorage.setItem('settingsMusicVolume', String(this.musicVolume))
    if (this.currentLoop && 'volume' in this.currentLoop) {
      (this.currentLoop as Phaser.Sound.WebAudioSound).setVolume(
        this.musicVolume * (BIOME_AUDIO[this.currentBiomeId ?? '']?.volumeProfile.ambientVolume ?? 0.4),
      )
    }
  }

  /** Sets master SFX volume (0.0-1.0) and persists to localStorage. */
  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol))
    localStorage.setItem('settingsSfxVolume', String(this.sfxVolume))
  }

  /** Returns current music volume. */
  public getMusicVolume(): number { return this.musicVolume }

  /** Returns current SFX volume. */
  public getSfxVolume(): number { return this.sfxVolume }

  private loadVolumeSettings(): void {
    const music = localStorage.getItem('settingsMusicVolume')
    const sfx = localStorage.getItem('settingsSfxVolume')
    if (music !== null) this.musicVolume = parseFloat(music) || 1.0
    if (sfx !== null) this.sfxVolume = parseFloat(sfx) || 1.0
  }

  private playTransitionSting(audio: BiomeAudio): void {
    if (this.scene.cache.audio.has(audio.transitionSting)) {
      this.scene.sound.play(audio.transitionSting, {
        volume: audio.volumeProfile.ambientVolume * this.musicVolume,
      })
    }
  }

  private crossfadeToLoop(audio: BiomeAudio): void {
    if (this.isCrossfading) return
    this.isCrossfading = true
    const { crossfadeDuration, ambientVolume } = audio.volumeProfile
    const outgoing = this.currentLoop

    // Fade out outgoing
    if (outgoing) {
      this.scene.tweens.add({
        targets: outgoing,
        volume: 0,
        duration: crossfadeDuration,
        onComplete: () => { outgoing.stop(); outgoing.destroy() },
      })
    }

    // Fade in incoming (only if audio is cached)
    if (this.scene.cache.audio.has(audio.ambientLoop)) {
      const incoming = this.scene.sound.add(audio.ambientLoop, {
        loop: true,
        volume: 0,
      })
      incoming.play()
      this.scene.tweens.add({
        targets: incoming,
        volume: ambientVolume * this.musicVolume,
        duration: crossfadeDuration,
        onComplete: () => { this.isCrossfading = false },
      })
      this.currentLoop = incoming
    } else {
      this.currentLoop = null
      this.isCrossfading = false
    }
  }
}
