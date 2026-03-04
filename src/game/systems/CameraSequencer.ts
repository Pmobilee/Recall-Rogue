import Phaser from 'phaser'

export interface ZoomToPointOptions {
  /** World X to zoom into */
  worldX: number
  /** World Y to zoom into */
  worldY: number
  /** Target zoom level (1.0 = default zoom, >1 = magnified) */
  targetZoomMultiplier: number
  /** Duration of zoom-in tween in ms */
  zoomInMs: number
  /** How long to hold the zoomed view in ms */
  holdMs: number
  /** Duration of zoom-out tween in ms */
  zoomOutMs: number
  /** Callback fired when hold phase begins (use to trigger GAIA line or overlay) */
  onHoldStart?: () => void
  /** Callback fired when zoom-out completes */
  onComplete?: () => void
}

/**
 * Scripted camera sequences for dramatic moments in MineScene.
 *
 * Usage:
 *   const seq = new CameraSequencer(scene)
 *   seq.zoomToPoint({ worldX, worldY, targetZoomMultiplier: 2.5, ... })
 */
export class CameraSequencer {
  private scene: Phaser.Scene
  private baseZoom = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.baseZoom = scene.cameras.main.zoom
  }

  /**
   * Zooms the camera into a world point, holds, then returns to base zoom.
   * Lerps camera scroll position toward the target during zoom-in.
   */
  zoomToPoint(opts: ZoomToPointOptions): void {
    const cam = this.scene.cameras.main
    const originalScrollX = cam.scrollX
    const originalScrollY = cam.scrollY
    const targetZoom = this.baseZoom * opts.targetZoomMultiplier

    // Center the camera on the target world point during zoom
    const targetScrollX = opts.worldX - cam.width / (2 * targetZoom)
    const targetScrollY = opts.worldY - cam.height / (2 * targetZoom)

    this.scene.tweens.add({
      targets: cam,
      zoom: targetZoom,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      duration: opts.zoomInMs,
      ease: 'Cubic.Out',
      onComplete: () => {
        opts.onHoldStart?.()
        this.scene.time.delayedCall(opts.holdMs, () => {
          this.scene.tweens.add({
            targets: cam,
            zoom: this.baseZoom,
            scrollX: originalScrollX,
            scrollY: originalScrollY,
            duration: opts.zoomOutMs,
            ease: 'Cubic.InOut',
            onComplete: () => opts.onComplete?.(),
          })
        })
      },
    })
  }

  /**
   * Returns the current base zoom (zoom level before any scripted sequences).
   * Use this to restore zoom after a sequence ends.
   */
  getBaseZoom(): number {
    return this.baseZoom
  }

  /**
   * Refreshes the stored base zoom (call after any permanent zoom change).
   */
  updateBaseZoom(): void {
    this.baseZoom = this.scene.cameras.main.zoom
  }
}
