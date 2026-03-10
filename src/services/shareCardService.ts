/**
 * @file shareCardService.ts
 * Client-side share card renderer. Generates 1200×630 px PNG share cards
 * using HTML5 Canvas. No external image-rendering libraries required.
 * All text is drawn via Canvas 2D API; no innerHTML or eval used.
 */

export type ShareCardTemplate = 'fact_mastery' | 'dive_record' | 'guild_win'

export interface ShareCardPayload {
  template: ShareCardTemplate
  /** Player's display name (sanitized before render — see sanitizeDisplayName). */
  displayName: string
  /** Primary numeric metric displayed on the card (facts mastered, layer reached, etc.). */
  primaryMetric: number
  /** Optional secondary label e.g. biome name, guild name. */
  secondaryLabel?: string
  /** Player's Knowledge Tree completion percent (0–100), drawn as a progress arc. */
  treeCompletionPct: number
  /** Whether the player has a patron badge — affects card accent color. */
  isPatron: boolean
}

export interface ShareCardResult {
  /** PNG encoded as a data URL (data:image/png;base64,...). */
  dataUrl: string
  /** Suggested filename for download. */
  filename: string
  /** Title string suitable for use in navigator.share(). */
  shareTitle: string
  /** Body text suitable for use in navigator.share(). */
  shareText: string
}

// ── Card dimensions ────────────────────────────────────────────────────────
const CARD_W = 1200
const CARD_H = 630

// ── Palette ────────────────────────────────────────────────────────────────
const PALETTE = {
  bg:          '#0D1B2A',   // near-black deep-space blue
  bgGrad:      '#1A3A5C',   // mid-blue gradient stop
  accent:      '#00CCFF',   // cyan — matches suit visor colour from character palette
  accentGold:  '#FFD700',   // patron gold accent
  textPrimary: '#F0F4FF',
  textMuted:   '#8AA8CC',
  treeFill:    '#00CCFF',
  treeTrack:   '#1E3A5C',
  logoText:    '#FFFFFF',
}

/**
 * Sanitize a display name before rendering to canvas.
 * Canvas drawText is not vulnerable to XSS but we still strip control
 * characters to prevent line-break injection in composed strings.
 *
 * @param name - Raw player display name from PlayerSave.
 * @returns Sanitized name, max 24 chars.
 */
export function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[\x00-\x1F\x7F]/g, '')   // strip control characters
    .trim()
    .slice(0, 24)
}

/**
 * Draw the knowledge tree completion arc in the bottom-right corner.
 * Arc goes from 12 o'clock clockwise; fills proportionally to pct.
 */
function drawTreeArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  pct: number,
  isPatron: boolean,
): void {
  const startAngle = -Math.PI / 2           // 12 o'clock
  const endAngle   = startAngle + (Math.PI * 2 * (pct / 100))
  const accentColor = isPatron ? PALETTE.accentGold : PALETTE.treeFill

  // Track ring
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = PALETTE.treeTrack
  ctx.lineWidth = 8
  ctx.stroke()

  // Fill arc
  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, endAngle)
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.stroke()

  // Center label
  ctx.fillStyle = PALETTE.textPrimary
  ctx.font = 'bold 22px "Space Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${Math.round(pct)}%`, cx, cy)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = '14px "Space Mono", monospace'
  ctx.fillText('TREE', cx, cy + 22)
}

/**
 * Render a share card to a 1200×630 canvas and return the result.
 * This is a pure rendering function; it creates its own offscreen canvas
 * and does not touch the DOM.
 *
 * @param payload - Card data.
 * @returns ShareCardResult with dataUrl, filename, shareTitle, shareText.
 */
export async function renderShareCard(payload: ShareCardPayload): Promise<ShareCardResult> {
  const canvas = document.createElement('canvas')
  canvas.width  = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const name    = sanitizeDisplayName(payload.displayName)
  const accent  = payload.isPatron ? PALETTE.accentGold : PALETTE.accent

  // ── Background gradient ────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  grad.addColorStop(0, PALETTE.bg)
  grad.addColorStop(1, PALETTE.bgGrad)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // ── Top accent stripe ──────────────────────────────────────────────────
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, CARD_W, 6)

  // ── Game logo / wordmark (top-left) ────────────────────────────────────
  ctx.fillStyle = PALETTE.logoText
  ctx.font = 'bold 28px "Space Mono", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('RECALL ROGUE', 48, 32)

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = '16px "Space Mono", monospace'
  ctx.fillText('terragacha.com', 48, 68)

  // ── Player name ────────────────────────────────────────────────────────
  ctx.fillStyle = PALETTE.textMuted
  ctx.font = '20px "Space Mono", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(name, 48, 150)

  // ── Headline (template-specific) ───────────────────────────────────────
  const headlines: Record<ShareCardTemplate, string> = {
    fact_mastery: `Mastered ${payload.primaryMetric.toLocaleString()} facts`,
    dive_record:  `Reached Layer ${payload.primaryMetric}`,
    guild_win:    payload.secondaryLabel
                    ? `${payload.secondaryLabel} conquered the\nKnowledge Challenge`
                    : 'Guild challenge complete',
  }
  const headlineLines = headlines[payload.template].split('\n')
  ctx.fillStyle = PALETTE.textPrimary
  ctx.font = 'bold 56px "Space Mono", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  headlineLines.forEach((line, i) => {
    ctx.fillText(line, 48, 200 + i * 72)
  })

  // ── Secondary label (biome, category, etc.) ────────────────────────────
  if (payload.secondaryLabel && payload.template !== 'guild_win') {
    ctx.fillStyle = accent
    ctx.font = '22px "Space Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(payload.secondaryLabel, 48, 360)
  }

  // ── Knowledge tree arc (bottom-right) ─────────────────────────────────
  drawTreeArc(ctx, CARD_W - 120, CARD_H - 120, 80, payload.treeCompletionPct, payload.isPatron)

  // ── Bottom stripe ──────────────────────────────────────────────────────
  ctx.fillStyle = accent
  ctx.fillRect(0, CARD_H - 6, CARD_W, 6)

  // ── Encode ─────────────────────────────────────────────────────────────
  const dataUrl = canvas.toDataURL('image/png')

  const shareTexts: Record<ShareCardTemplate, string> = {
    fact_mastery: `I just mastered ${payload.primaryMetric.toLocaleString()} facts about Earth's deep past in Recall Rogue! Join me: https://terragacha.com`,
    dive_record:  `I reached Layer ${payload.primaryMetric} in Recall Rogue! How deep can you go? https://terragacha.com`,
    guild_win:    `My guild just completed a Knowledge Challenge in Recall Rogue. The Earth still has secrets to share. https://terragacha.com`,
  }

  return {
    dataUrl,
    filename: `recall-rogue-${payload.template}-${Date.now()}.png`,
    shareTitle: 'Recall Rogue',
    shareText: shareTexts[payload.template],
  }
}

/**
 * Invoke the Web Share API if available, or trigger a download fallback.
 * Never throws; failures are silently caught.
 *
 * @param result - Output from renderShareCard().
 */
export async function shareOrDownloadCard(result: ShareCardResult): Promise<void> {
  // Web Share API (mobile browsers, Capacitor WebView)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // Attempt file sharing (supported on iOS Safari 15+, Android Chrome 76+)
      const response = await fetch(result.dataUrl)
      const blob = await response.blob()
      const file = new File([blob], result.filename, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: result.shareTitle, text: result.shareText, files: [file] })
        return
      }
      // Fall back to text-only share if file share not supported
      await navigator.share({ title: result.shareTitle, text: result.shareText })
      return
    } catch {
      // AbortError (user dismissed) or NotAllowedError — silently fall through
    }
  }

  // Download fallback (desktop browsers, share API unavailable)
  const a = document.createElement('a')
  a.href = result.dataUrl
  a.download = result.filename
  a.click()
}
