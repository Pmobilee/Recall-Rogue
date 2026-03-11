import Phaser from 'phaser'

/**
 * BootScene: First scene loaded. Asset preloading is handled by CombatScene
 * to avoid race conditions when CombatScene starts before BootScene finishes loading.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    this.game.events.emit('boot-complete')
    this.scene.sleep()
  }
}
