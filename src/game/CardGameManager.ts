/**
 * Minimal Phaser game manager for the card roguelite.
 * Only boots BootScene + CombatScene — no dome, no mine.
 */
import Phaser from 'phaser'
import BootAnimScene from './scenes/BootAnimScene'
import { BootScene } from './scenes/BootScene'
import { CombatScene } from './scenes/CombatScene'
import { RewardRoomScene } from './scenes/RewardRoomScene'

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
  boot(startAnimation = false): void {
    if (this.game) return

    // Register on globalThis so encounterBridge can access without circular imports
    const reg = globalThis as Record<symbol, unknown>
    reg[Symbol.for('terra:cardGameManager')] = this

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: 390,
      height: 844,
      backgroundColor: startAnimation ? 'rgba(0,0,0,0)' : '#0D1117',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: startAnimation
        ? [BootAnimScene, BootScene, CombatScene, RewardRoomScene]
        : [BootScene, CombatScene, RewardRoomScene],
      render: {
        pixelArt: true,
        antialias: false,
      },
      input: {
        activePointers: 1,
      },
      // Transparent during boot animation so HubScreen renders behind Phaser canvas
      transparent: startAnimation,
    })
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
  }

  /** Stop the reward room scene. */
  stopRewardRoom(): void {
    if (!this.game) return
    const scene = this.game.scene.getScene('RewardRoom')
    if (scene && scene.scene.isActive()) {
      this.game.scene.stop('RewardRoom')
    }
  }

  /** Destroy the Phaser game instance. */
  destroy(): void {
    this.game?.destroy(true)
    this.game = null
    CardGameManager.instance = null
  }
}
