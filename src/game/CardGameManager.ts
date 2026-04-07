/**
 * Minimal Phaser game manager for the card roguelite.
 * Only boots BootScene + CombatScene — no dome, no mine.
 */
import Phaser from 'phaser'
import BootAnimScene from './scenes/BootAnimScene'
import { BootScene } from './scenes/BootScene'
import { CombatScene } from './scenes/CombatScene'
import { RewardRoomScene } from './scenes/RewardRoomScene'
import { DepthLightingFX } from './shaders/DepthLightingFX'
import { layoutMode, getCanvasForMode } from '../stores/layoutStore'
import { get } from 'svelte/store'
import type { LayoutMode } from '../stores/layoutStore'
import { startFpsMonitoring } from '../dev/debugBridge'

export class CardGameManager {
  private static instance: CardGameManager | null = null
  private game: Phaser.Game | null = null
  private unsubLayoutMode: (() => void) | null = null

  static getInstance(): CardGameManager {
    if (!CardGameManager.instance) {
      CardGameManager.instance = new CardGameManager()
    }
    return CardGameManager.instance
  }

  /** Boot Phaser engine with only CombatScene. */
  boot(startAnimation = false): void {
    if (this.game) return

    // Register on globalThis so encounterBridge can access without circular imports
    const reg = globalThis as Record<symbol, unknown>
    reg[Symbol.for('rr:cardGameManager')] = this

    // Boot Phaser with the correct canvas dimensions for the current layout mode.
    // Using the right dimensions at construction time avoids a post-boot resize race
    // where the ScaleManager may not be fully initialized yet.
    const bootMode = get(layoutMode)
    const bootCanvas = getCanvasForMode(bootMode)

    const isBotMode = (globalThis as Record<symbol, unknown>)[Symbol.for('rr:botMode')] === true;

    this.game = new Phaser.Game({
      type: isBotMode ? Phaser.HEADLESS : Phaser.AUTO,
      parent: 'phaser-container',
      width: bootCanvas.width,
      height: bootCanvas.height,
      backgroundColor: startAnimation ? 'rgba(0,0,0,0)' : '#0D1117',
      scale: {
        mode: Phaser.Scale.RESIZE,
      },
      scene: startAnimation
        ? [BootAnimScene, BootScene, CombatScene, RewardRoomScene]
        : [BootScene, CombatScene, RewardRoomScene],
      render: {
        pixelArt: true,
        antialias: false,
        preserveDrawingBuffer: true,  // Enable canvas screenshots via canvas.toDataURL()
      },
      input: {
        activePointers: 1,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pipeline: { DepthLightingFX } as any,
      // Transparent during boot animation so HubScreen renders behind Phaser canvas
      transparent: startAnimation,
    })

    // Wire FPS telemetry to the live Phaser loop (dev + prod — analytics is gated inside).
    // In headless bot mode game.loop.actualFps is always 0, which is fine.
    startFpsMonitoring(this.game)

    // Subscribe to layout mode changes for future orientation switches.
    // Skip the immediate callback (bootMode already applied above) by checking
    // whether the emitted value differs from what we booted with.
    let firstEmit = true
    this.unsubLayoutMode = layoutMode.subscribe((mode) => {
      if (firstEmit) {
        firstEmit = false
        return // Already handled by bootCanvas above
      }
      this.handleLayoutChange(mode)
    })
  }

  /**
   * Resize the Phaser canvas to match the new layout mode and notify all active scenes.
   * Called automatically when layoutMode store changes.
   */
  private handleLayoutChange(mode: LayoutMode): void {
    if (!this.game) return
    const canvas = getCanvasForMode(mode)
    this.game.scale.setGameSize(canvas.width, canvas.height)
    this.game.scale.refresh()

    // Notify active scenes — each scene may implement handleLayoutChange(mode)
    const activeScenes = this.game.scene.getScenes(true) as Array<Phaser.Scene & { handleLayoutChange?: (m: LayoutMode) => void }>
    for (const scene of activeScenes) {
      if (typeof scene.handleLayoutChange === 'function') {
        scene.handleLayoutChange(mode)
      }
    }
  }

  /** Get the Phaser Game instance for event listening. */
  getGame(): Phaser.Game | null {
    return this.game
  }

  /** Stop the boot animation scene if it is running. */
  stopBootAnim(): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('BootAnimScene')
    if (scene) {
      // Scene may be active, sleeping, or paused — stop it regardless
      this.game.scene.stop('BootAnimScene')
    }
  }

  /** Get the CombatScene instance. */
  getCombatScene(): CombatScene | null {
    if (!this.game) return null
    return this.game.scene.getScene('CombatScene') as CombatScene | null
  }

  /** Start the combat scene. */
  startCombat(): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('CombatScene')
    if (scene && !scene.scene.isActive()) {
      this.game.scene.start('CombatScene')
    }
  }

  /** Stop the combat scene. */
  stopCombat(): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('CombatScene')
    if (scene && scene.scene.isActive()) {
      this.game.scene.stop('CombatScene')
    }
  }

  /** Get the RewardRoomScene instance. */
  getRewardRoomScene(): RewardRoomScene | null {
    if (!this.game) return null
    return this.game.scene.getScene('RewardRoom') as RewardRoomScene | null
  }

  /** Start the reward room scene with data. */
  startRewardRoom(data: import('./scenes/RewardRoomScene').RewardRoomData): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('RewardRoom')
    if (scene && scene.scene.isActive()) {
      this.game.scene.stop('RewardRoom')
    }
    this.game.scene.start('RewardRoom', data)
    // Bring RewardRoom above CombatScene, which may have been pushed to top by stopRewardRoom().
    this.game.scene.bringToTop('RewardRoom')
  }

  /** Stop the reward room scene. */
  stopRewardRoom(): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('RewardRoom')
    if (scene && scene.scene.isActive()) {
      this.game.scene.stop('RewardRoom')
    }
    // Ensure CombatScene renders above any stopped scene remnants
    const combat = this.game.scene.getScene('CombatScene')
    if (combat && combat.scene.isActive()) {
      this.game.scene.bringToTop('CombatScene')
    }
  }

  /** Destroy the Phaser game instance. */
  destroy(): void {
    this.unsubLayoutMode?.()
    this.unsubLayoutMode = null
    this.game?.destroy(true)
    this.game = null
    CardGameManager.instance = null
  }
}
