import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'

function enemySpritePath(name: string): string {
  const suffix = getDeviceTier() === 'low-end' ? '_1x.webp' : '.webp'
  return `assets/sprites/enemies/${name}${suffix}`
}

/**
 * BootScene: First scene loaded. Previously handled asset preloading,
 * now sprite loading is deferred to MineScene for faster initial boot.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.load.image('bg-combat', 'assets/backgrounds/combat/bg_combat_dungeon.webp')

    // Player sprites are intentionally not preloaded in first-person combat mode.
    this.load.image('enemy-cave_bat-idle', enemySpritePath('cave_bat_idle'))
    this.load.image('enemy-cave_bat-hit', enemySpritePath('cave_bat_hit'))
    this.load.image('enemy-cave_bat-death', enemySpritePath('cave_bat_death'))

    this.load.image('enemy-crystal_golem-idle', enemySpritePath('crystal_golem_idle'))
    this.load.image('enemy-crystal_golem-hit', enemySpritePath('crystal_golem_hit'))
    this.load.image('enemy-crystal_golem-death', enemySpritePath('crystal_golem_death'))

    this.load.image('enemy-the_excavator-idle', enemySpritePath('the_excavator_idle'))
    this.load.image('enemy-the_excavator-hit', enemySpritePath('the_excavator_hit'))
    this.load.image('enemy-the_excavator-death', enemySpritePath('the_excavator_death'))
  }

  create(): void {
    // Emit boot-complete so main.ts can transition to base screen
    this.game.events.emit('boot-complete')

    // Scene sleeps — MineScene will be started on demand by GameManager
    this.scene.sleep()
  }
}
