import Phaser from 'phaser'
import { getSpriteUrls } from '../spriteManifest'
import { getSpriteResolution } from '../../ui/stores/settings'

/**
 * BootScene: First scene loaded. Handles asset preloading
 * and displays a loading indicator.
 *
 * After loading completes, it sleeps — the GameManager handles
 * screen transitions, and MineScene is started on demand.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x16213e, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#e94560',
    })
    loadingText.setOrigin(0.5, 0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xe94560, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })

    const resolution = getSpriteResolution()
    const spriteUrls = getSpriteUrls(resolution)
    for (const [key, url] of Object.entries(spriteUrls)) {
      this.load.image(key, url)
    }

    // Load miner sprite sheet separately as a spritesheet (not a single image)
    // Remove the image-loaded version and re-load as spritesheet with frame config
    const minerSheetKey = 'miner_sheet'
    if (spriteUrls[minerSheetKey]) {
      // Phaser allows overriding — loading as spritesheet will replace the image entry
      this.load.spritesheet(minerSheetKey, spriteUrls[minerSheetKey], {
        frameWidth: resolution === 'high' ? 256 : 32,
        frameHeight: resolution === 'high' ? 256 : 32,
      })
    }
  }

  create(): void {
    // Apply LINEAR filter for hi-res sprites (downscaled from 256px to 32px)
    if (getSpriteResolution() === 'high') {
      const texManager = this.textures
      for (const key of Object.keys(getSpriteUrls('high'))) {
        const texture = texManager.get(key)
        if (texture) {
          texture.setFilter(Phaser.Textures.FilterMode.LINEAR)
        }
      }
    }

    // Emit boot-complete so main.ts can transition to base screen
    this.game.events.emit('boot-complete')

    // Scene sleeps — MineScene will be started on demand by GameManager
    this.scene.sleep()
  }
}
