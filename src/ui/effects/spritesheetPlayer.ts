/**
 * Spritesheet Player Utility
 *
 * Generic helpers for drawing horizontal spritesheet strips onto a
 * CanvasRenderingContext2D and for pre-loading image assets.
 * Consumed by AnimatedPet.svelte (and any future sprite renderers).
 */

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw a single frame from a horizontal spritesheet strip onto a canvas context.
 *
 * @param ctx        - Canvas 2D rendering context
 * @param image      - The loaded spritesheet HTMLImageElement
 * @param frameIndex - Which frame to draw (0-based)
 * @param frameWidth - Width of each frame in the source image (px)
 * @param frameHeight - Height of each frame in the source image (px)
 * @param destX      - Destination X on the canvas
 * @param destY      - Destination Y on the canvas
 * @param destWidth  - Destination width (for scaling)
 * @param destHeight - Destination height (for scaling)
 * @param flipX      - If true, draw the frame mirrored horizontally
 */
export function drawSpritesheetFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frameIndex: number,
  frameWidth: number,
  frameHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
  flipX: boolean = false,
): void {
  const srcX = frameIndex * frameWidth

  if (flipX) {
    ctx.save()
    // Translate to the right edge of the destination rect then scale -1 on X
    ctx.translate(destX + destWidth, destY)
    ctx.scale(-1, 1)
    ctx.drawImage(image, srcX, 0, frameWidth, frameHeight, 0, 0, destWidth, destHeight)
    ctx.restore()
  } else {
    ctx.drawImage(image, srcX, 0, frameWidth, frameHeight, destX, destY, destWidth, destHeight)
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load an image from a URL and return a Promise that resolves when the image
 * is fully decoded and ready to draw.
 *
 * @param src - URL of the image asset
 * @returns Promise that resolves to the loaded HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}
