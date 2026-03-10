/**
 * Minimal Phaser game manager for the card roguelite.
 * Only boots BootScene + CombatScene — no dome, no mine.
 */
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { CombatScene } from './scenes/CombatScene'

export class CardGameManager {
  private static instance: CardGameManager | null = null
  private game: Phaser.Game | null = null

  static getInstance(): CardGameManager {
    if (!CardGameManager.instance) {
      CardGameManager.instance = new CardGameManager()
    }
    return CardGameManager.instance
  }

  /** Boot Phaser engine with only CombatScene. */
  boot(): void {
    if (this.game) return

    // Register on globalThis so encounterBridge can access without circular imports
    const reg = globalThis as Record<symbol, unknown>
    reg[Symbol.for('terra:cardGameManager')] = this

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: 390,
      height: 844,
      backgroundColor: '#0D1117',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, CombatScene],
      render: {
        pixelArt: true,
        antialias: false,
      },
      input: {
        activePointers: 2,
      },
      // Transparent so Svelte overlays show through
      transparent: false,
    })
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

  /** Destroy the Phaser game instance. */
  destroy(): void {
    this.game?.destroy(true)
    this.game = null
    CardGameManager.instance = null
  }
}
