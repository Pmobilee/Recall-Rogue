import Phaser from 'phaser'

export interface CameraConfig {
  /** Tiles visible horizontally at default zoom */
  targetTilesX: number
  /** Tiles visible vertically at default zoom */
  targetTilesY: number
  /** Camera follow lerp factor (0-1) */
  lerpFactor: number
  /** Minimum zoom level */
  minZoom: number
  /** Maximum zoom level */
  maxZoom: number
}

const DEFAULT_CONFIG: CameraConfig = {
  targetTilesX: 12,
  targetTilesY: 10,
  lerpFactor: 0.12,
  minZoom: 0.5,
  maxZoom: 3.0,
}

/**
 * Calculates the initial camera zoom level so that targetTilesX tiles
 * fit horizontally in the current viewport.
 */
export function calcInitialZoom(
  viewportWidth: number,
  tileSize: number,
  targetTilesX: number
): number {
  return viewportWidth / (targetTilesX * tileSize)
}

/**
 * Sets up camera bounds, zoom, and clamp for a mine scene.
 * Call once in MineScene.create().
 */
export function setupCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldWidth: number,
  worldHeight: number,
  tileSize: number,
  config: Partial<CameraConfig> = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  camera.setBounds(0, 0, worldWidth, worldHeight)
  const zoom = calcInitialZoom(camera.width, tileSize, cfg.targetTilesX)
  camera.setZoom(Phaser.Math.Clamp(zoom, cfg.minZoom, cfg.maxZoom))
}

/**
 * Manages pinch-to-zoom state for mobile touch input.
 * Call update() in the scene's update loop.
 */
export class PinchZoomController {
  private initialPinchDistance = 0
  private initialZoom = 1
  private camera: Phaser.Cameras.Scene2D.Camera
  private input: Phaser.Input.InputPlugin
  private minZoom: number
  private maxZoom: number

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    input: Phaser.Input.InputPlugin,
    minZoom = 0.5,
    maxZoom = 3.0
  ) {
    this.camera = camera
    this.input = input
    this.minZoom = minZoom
    this.maxZoom = maxZoom
    // Enable second touch point for pinch detection
    input.addPointer(1)
  }

  /**
   * Process pinch-to-zoom each frame.
   * Returns true if a pinch gesture is active (suppress game input).
   */
  update(): boolean {
    const pointers = this.input.manager.pointers
    const p1 = pointers[0]
    const p2 = pointers[1]

    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
      if (this.initialPinchDistance === 0) {
        this.initialPinchDistance = dist
        this.initialZoom = this.camera.zoom
      } else {
        const newZoom = Phaser.Math.Clamp(
          this.initialZoom * (dist / this.initialPinchDistance),
          this.minZoom,
          this.maxZoom
        )
        this.camera.setZoom(newZoom)
      }
      return true
    }

    this.initialPinchDistance = 0
    return false
  }
}
