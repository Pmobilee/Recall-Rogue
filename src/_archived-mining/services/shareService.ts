/**
 * shareService.ts
 *
 * Exports a composited painting card PNG to the device.
 * On Capacitor (Android/iOS): writes to the app cache directory
 * and opens the native share sheet via the Web Share API.
 * On web/PWA: triggers a browser <a download> link.
 *
 * SECURITY: No user input is interpolated into canvas drawText calls.
 * All text comes from the validated PAINTINGS constant.
 */
import type { Painting } from '../data/paintings'
import { TIER_VISUALS } from '../data/achievementTiers'

const CARD_W = 600
const CARD_H = 700

/**
 * Render a share card for the given painting and export to device.
 * @returns Promise resolving to true on success, false on failure.
 */
export async function sharePainting(painting: Painting & { unlocked: boolean }): Promise<boolean> {
  if (!painting.unlocked) return false

  try {
    const blob = await renderShareCard(painting)
    const filename = `terra-gacha-${painting.id.replace('paint_', '')}.png`

    // Try native Web Share API (mobile browsers + Capacitor WebView)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Terra Gacha — ${painting.title}`,
          text: `I unlocked the "${painting.title}" achievement in Terra Gacha! ${painting.description}`,
          files: [file],
        })
        return true
      }
    }

    // Fallback: browser download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch (err) {
    // User cancelled share dialog — not an error
    if (err instanceof Error && err.name === 'AbortError') return false
    console.error('[shareService] Export failed:', err)
    return false
  }
}

/** Compose the share card on an OffscreenCanvas and return as a Blob. */
async function renderShareCard(painting: Painting & { unlocked: boolean }): Promise<Blob> {
  const canvas = new OffscreenCanvas(CARD_W, CARD_H)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  const visuals = TIER_VISUALS[painting.tier]

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H)
  bg.addColorStop(0, '#0e0e1a')
  bg.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Tier-colored border
  ctx.strokeStyle = visuals.borderColor
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, CARD_W - 8, CARD_H - 8)

  // Painting image (centered, square)
  const imgSize = 400
  const imgX = (CARD_W - imgSize) / 2
  const imgY = 60
  try {
    const img = await loadImage(`/assets/sprites-hires/dome/${painting.spriteKey}.png`)
    ctx.drawImage(img, imgX, imgY, imgSize, imgSize)
  } catch {
    // Placeholder if sprite not available
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(imgX, imgY, imgSize, imgSize)
  }

  // Image border
  ctx.strokeStyle = visuals.borderColor
  ctx.lineWidth = 3
  ctx.strokeRect(imgX, imgY, imgSize, imgSize)

  // Title
  ctx.fillStyle = visuals.badgeColor
  ctx.font = '600 24px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(painting.title, CARD_W / 2, imgY + imgSize + 48)

  // Tier badge
  fillRoundedRect(ctx, (CARD_W - 160) / 2, imgY + imgSize + 62, 160, 28, 4)
  ctx.fillStyle = '#0a0a0a'
  ctx.font = '700 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${visuals.label.toUpperCase()} ACHIEVEMENT`, CARD_W / 2, imgY + imgSize + 82)

  // GAIA comment (truncated to 2 lines)
  ctx.fillStyle = '#8acaba'
  ctx.font = '12px monospace'
  const comment = painting.gaiaComment.length > 100
    ? painting.gaiaComment.slice(0, 97) + '...'
    : painting.gaiaComment
  wrapText(ctx, `G.A.I.A.: "${comment}"`, CARD_W / 2, imgY + imgSize + 118, CARD_W - 64, 18)

  // Watermark
  ctx.fillStyle = '#2a3a4a'
  ctx.font = '11px monospace'
  ctx.fillText('Terra Gacha · terra-gacha.app', CARD_W / 2, CARD_H - 20)

  return canvas.convertToBlob({ type: 'image/png' })
}

/** Load an image from a URL into an ImageBitmap. */
async function loadImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image load failed: ${url}`)
  const blob = await res.blob()
  return createImageBitmap(blob)
}

/** Simple text wrap helper for canvas. */
function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.textAlign = 'center'
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, currentY)
}

/** Polyfill for rounded rect fill on OffscreenCanvas. */
function fillRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fill()
  } else {
    ctx.fillRect(x, y, w, h)
  }
}
