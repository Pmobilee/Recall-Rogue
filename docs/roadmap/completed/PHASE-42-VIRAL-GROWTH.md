# Phase 42: Viral Growth Engine

**Status**: NOT STARTED
**Goal**: Build a self-reinforcing growth loop that converts satisfied players into acquisition channels. Share card generator, referral optimization, social proof badges, deep link routing, ASO iteration, and K-factor analytics all work together. Every growth mechanic must be honest: never manufacture fake social proof, never spam contacts, and never gate core learning features behind referral walls.
**Design Decisions**: DD-V2-150 (sharing), DD-V2-151 (referral system)

---

## Overview

Phase 42 implements the viral coefficient infrastructure. A live game that cannot bring in new players without paid ads will stagnate once marketing budgets dry up. Organic sharing is the sustainable alternative: players who share because the game genuinely impressed them bring in higher-quality installs with better retention than paid channels.

The approach here is deliberate:

1. **Share cards (42.1)** give players a visually impressive artefact to post. A screenshot of raw game UI is not shareworthy. A custom-rendered card showing "I just mastered 200 facts about prehistoric Earth" is.
2. **Referral system (42.2)** optimises the existing Phase 22 referral scaffold — codes, attribution, and reward tiers — rather than starting from scratch. The Phase 22 implementation has a working `ReferralModal.svelte` and `/api/referrals/*` endpoints; this phase extends them.
3. **Social proof badges (42.3)** let high-achieving players display verifiable credentials inside and outside the game, which signals quality to prospective players who encounter the badge image.
4. **Deep links (42.4)** ensure that an invite link tapped on a phone opens the app (or App Store) and deposits the new player directly at the relevant content — never at a generic home screen.
5. **ASO iteration (42.5)** treats the App Store and Google Play listings as live products, with keyword tracking, screenshot A/B testing, and an in-app review prompt that targets the right moment.
6. **Viral loop analytics (42.6)** close the loop: if K-factor is below target, the analytics tell us which funnel step is leaking.

**Dependencies (must be complete before starting)**:
- Phase 19: Auth & Cloud — player accounts, JWT, server-side saves, PostgreSQL. All share cards embed the player's anonymized ID. Referral attribution requires server-persisted codes.
- Phase 20: Mobile Launch — App Store and Play Store presences must exist before deep links can resolve, before review prompts make sense, and before ASO iteration has a surface to test.
- Phase 22: Social & Multiplayer — `ReferralModal.svelte`, `socialService.ts`, friend graph, guild system. Phase 42 extends these rather than replacing them.
- Phase 41 (recommended, not hard-blocked): A/B testing framework helps run ASO experiments, but 42.5 can function with a simpler manual-swap approach if Phase 41 is not yet complete.

**Estimated complexity**: Medium-High. No new game-mechanics complexity. The canvas rendering pipeline for share cards (42.1) is the most technically involved piece. Deep link routing (42.4) touches both Capacitor and the Fastify server. ASO work (42.5) is labour-intensive but low-risk.

**What this phase does NOT do**:
- It does not add real-money referral payouts. Rewards are in-game only (fossil eggs, dust, cosmetics).
- It does not introduce cross-promotion with external games or ad networks.
- It does not expose any new user PII to third parties.
- It does not lock Knowledge Tree progress behind referral milestones.

---

## Prerequisites

- Phase 19 backend running with PostgreSQL
- Phase 20 App Store + Play Store listings live
- Phase 22 referral scaffold (`ReferralModal.svelte`, `/api/referrals/*` routes, `ReferralRecord` type in `src/data/types.ts`)
- `src/services/analyticsService.ts` (Phase 19.7) — new events in 42.6 extend this service
- `src/data/balance.ts` — reward constants added in 42.2

---

## Sub-Phase 42.1: Share Card Generator

### What

A canvas-based share card generator that produces a 1200×630 px PNG from the player's current stats. This is the standard Open Graph image size and works natively for Twitter/X cards, Facebook previews, Instagram stories (with a portrait crop), and Discord link unfurls. The image is generated client-side using a plain HTML5 `<canvas>` element (no server-side rendering required), encoded as a data URL, and then handed to the Web Share API or downloaded directly.

Three card templates are provided, selected automatically based on the trigger context:

| Template ID | Trigger | Headline |
|---|---|---|
| `fact_mastery` | Player masters their Nth fact | "I just mastered {N} facts about Earth's deep past" |
| `dive_record` | Player reaches a personal-best layer | "Reached Layer {N} in Terra Gacha" |
| `guild_win` | Player's guild completes a weekly challenge | "{GuildName} conquered the Knowledge Challenge" |

### Where

- `src/services/shareCardService.ts` — **new file**, card rendering logic
- `src/ui/components/ShareCardModal.svelte` — **new file**, preview + share/download UI
- `src/assets/share/` — **new directory**, card background PNGs and font files
- `src/ui/components/DiveResults.svelte` — add share card trigger on personal-best layer
- `src/ui/components/MilestoneCelebration.svelte` — add share card trigger on fact milestones (50, 100, 200, 500)
- `src/ui/components/GuildView.svelte` — add share card trigger on guild challenge win

### How

#### `src/services/shareCardService.ts`

```typescript
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
function sanitizeDisplayName(name: string): string {
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
  ctx.fillText('TERRA GACHA', 48, 32)

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
    fact_mastery: `I just mastered ${payload.primaryMetric.toLocaleString()} facts about Earth's deep past in Terra Gacha! Join me: https://terragacha.com`,
    dive_record:  `I reached Layer ${payload.primaryMetric} in Terra Gacha! How deep can you go? https://terragacha.com`,
    guild_win:    `My guild just completed a Knowledge Challenge in Terra Gacha. The Earth still has secrets to share. https://terragacha.com`,
  }

  return {
    dataUrl,
    filename: `terra-gacha-${payload.template}-${Date.now()}.png`,
    shareTitle: 'Terra Gacha',
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
```

#### `src/ui/components/ShareCardModal.svelte`

```svelte
<script lang="ts">
  import { renderShareCard, shareOrDownloadCard, type ShareCardTemplate } from '../../services/shareCardService'
  import { playerData } from '../stores/playerData'

  interface Props {
    template: ShareCardTemplate
    primaryMetric: number
    secondaryLabel?: string
    onClose: () => void
  }

  let { template, primaryMetric, secondaryLabel, onClose }: Props = $props()

  let previewUrl = $state<string | null>(null)
  let rendering  = $state(false)
  let sharing    = $state(false)
  let errorMsg   = $state('')

  const save = $derived($playerData)

  async function buildPreview(): Promise<void> {
    rendering = true
    errorMsg  = ''
    try {
      const result = await renderShareCard({
        template,
        primaryMetric,
        secondaryLabel,
        displayName:      save.displayName ?? 'Explorer',
        treeCompletionPct: computeTreePct(save),
        isPatron:         save.isPatron ?? false,
      })
      previewUrl = result.dataUrl
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Failed to render card'
    } finally {
      rendering = false
    }
  }

  async function doShare(): Promise<void> {
    if (!previewUrl) return
    sharing = true
    const result = await renderShareCard({
      template,
      primaryMetric,
      secondaryLabel,
      displayName:      save.displayName ?? 'Explorer',
      treeCompletionPct: computeTreePct(save),
      isPatron:         save.isPatron ?? false,
    })
    await shareOrDownloadCard(result)
    sharing = false
    onClose()
  }

  function computeTreePct(s: typeof save): number {
    const mastered = s.reviewStates
      ? Object.values(s.reviewStates).filter(r => r.interval >= 60).length
      : 0
    const total = s.totalFacts ?? 522
    return Math.min(100, Math.round((mastered / total) * 100))
  }

  // Render preview on mount
  $effect(() => { buildPreview() })
</script>

<div class="share-card-modal" role="dialog" aria-label="Share card preview">
  <div class="modal-content">
    <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
    <h2>Share Your Progress</h2>

    {#if rendering}
      <div class="preview-placeholder" aria-busy="true">Rendering card…</div>
    {:else if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {:else if previewUrl}
      <img
        class="card-preview"
        src={previewUrl}
        alt="Share card preview showing your Terra Gacha progress"
      />
    {/if}

    <div class="action-row">
      <button
        class="btn-primary"
        onclick={doShare}
        disabled={sharing || rendering || !previewUrl}
        data-testid="share-card-share-btn"
      >
        {sharing ? 'Sharing…' : 'Share / Save'}
      </button>
      <button class="btn-secondary" onclick={onClose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .share-card-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    pointer-events: auto;
  }
  .modal-content {
    background: #0D1B2A;
    border: 1px solid #00CCFF;
    border-radius: 12px;
    padding: 24px;
    max-width: 660px;
    width: 95%;
    display: flex; flex-direction: column; gap: 16px;
  }
  .close-btn {
    align-self: flex-end;
    background: none; border: none;
    color: #8AA8CC; font-size: 20px; cursor: pointer;
  }
  h2 { color: #F0F4FF; margin: 0; font-size: 20px; }
  .preview-placeholder {
    height: 200px; background: #1A3A5C;
    display: flex; align-items: center; justify-content: center;
    color: #8AA8CC; border-radius: 8px;
  }
  .card-preview {
    width: 100%; border-radius: 8px;
    border: 1px solid #1E3A5C;
  }
  .action-row { display: flex; gap: 12px; justify-content: flex-end; }
  .btn-primary {
    background: #00CCFF; color: #0D1B2A;
    border: none; padding: 10px 24px; border-radius: 8px;
    font-weight: bold; cursor: pointer;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-secondary {
    background: transparent; color: #8AA8CC;
    border: 1px solid #1E3A5C; padding: 10px 20px; border-radius: 8px;
    cursor: pointer;
  }
  .error-msg { color: #FF6B6B; }
</style>
```

#### Integration points

In `src/ui/components/MilestoneCelebration.svelte`, after the existing milestone animation fires, add:

```typescript
// After existing milestone animation completes:
if ([50, 100, 200, 500, 1000].includes(factsMastered)) {
  showShareCard = true
  shareCardTemplate = 'fact_mastery'
  shareCardMetric = factsMastered
}
```

In `src/ui/components/DiveResults.svelte`, after checking personal-best layer:

```typescript
if (layerReached > previousPersonalBest) {
  showShareCard = true
  shareCardTemplate = 'dive_record'
  shareCardMetric = layerReached
  shareCardSecondary = currentBiomeName
}
```

### Acceptance Criteria — 42.1
- [ ] `renderShareCard({ template: 'fact_mastery', ... })` returns a PNG data URL with dimensions 1200×630 (verify via `Image` object `naturalWidth`/`naturalHeight`)
- [ ] `renderShareCard({ template: 'dive_record', ... })` returns a distinct card with layer number visible
- [ ] `shareOrDownloadCard()` triggers the native share sheet on mobile (Web Share API) and a file download on desktop
- [ ] `sanitizeDisplayName()` strips control characters and truncates to 24 chars
- [ ] Share card modal renders correctly at 320 px viewport width (mobile)
- [ ] No `innerHTML`, `eval()`, or `Function()` used in `shareCardService.ts`
- [ ] `npm run typecheck` passes

### Playwright Test — 42.1
```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Open milestone celebration programmatically
  await page.evaluate(async () => {
    const { renderShareCard } = await import('/src/services/shareCardService.ts')
    const result = await renderShareCard({
      template: 'fact_mastery',
      displayName: 'TestExplorer',
      primaryMetric: 100,
      treeCompletionPct: 42,
      isPatron: false,
    })
    // Verify dimensions via Image
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth !== 1200 || img.naturalHeight !== 630) {
          reject(new Error(`Bad dimensions: ${img.naturalWidth}x${img.naturalHeight}`))
        } else {
          resolve(true)
        }
      }
      img.onerror = () => reject(new Error('Image failed to load'))
      img.src = result.dataUrl
    })
  })

  await page.screenshot({ path: '/tmp/ss-42-1-share-card.png' })
  console.log('42.1 share card render: PASS')
  await browser.close()
})()
```

---

## Sub-Phase 42.2: Referral System Optimization

### What

Phase 22 built a functional referral modal and `/api/referrals/*` endpoints. Phase 42.2 extends this with:

1. **Tiered reward milestones** — first referral gives a fossil egg; at 3, 5, and 10 successful referrals the rewards escalate (cosmetic frame, rare companion skin, exclusive nameplate).
2. **Referral code persistence** — codes now survive account migration; if a player loses progress and re-registers, their code is restored from the server so they do not lose referral credit.
3. **Attribution window** — installs attributed within 30 days of link click; beyond 30 days the attribution expires and the invite code no longer earns credit for the sender.
4. **Referral funnel tracking** — the server logs three events per referral: `link_clicked`, `app_installed`, `first_dive_complete`. Only the third event unlocks the reward.
5. **Fraud prevention** — IP deduplication (same IP within 24 hours counts as one referral), device-fingerprint stub for future enhancement, and a cap of 10 referrals per calendar year.

### Where

- `src/data/balance.ts` — add `REFERRAL_REWARD_TIERS` constant
- `src/data/types.ts` — extend `ReferralRecord` and `PlayerSave.referralStats`
- `src/ui/components/ReferralModal.svelte` — extend to show tier progress and pending rewards
- `server/src/routes/referrals.ts` — **new file**, extend existing referral endpoints
- `server/src/services/referralService.ts` — **new file**, attribution and fraud logic
- `src/services/socialService.ts` — add `claimReferralReward()` method

### How

#### `src/data/balance.ts` additions

```typescript
/** Referral reward tiers. Index = number of qualifying referrals. */
export const REFERRAL_REWARD_TIERS: {
  threshold: number
  rewardType: 'fossil_egg' | 'cosmetic_frame' | 'companion_skin' | 'nameplate'
  rewardKey: string
  label: string
}[] = [
  { threshold: 1,  rewardType: 'fossil_egg',      rewardKey: 'egg_referral_common',   label: 'Fossil Egg' },
  { threshold: 3,  rewardType: 'cosmetic_frame',   rewardKey: 'frame_explorer_invite', label: 'Explorer Frame' },
  { threshold: 5,  rewardType: 'companion_skin',   rewardKey: 'skin_miner_envoy',      label: 'Envoy Miner Skin' },
  { threshold: 10, rewardType: 'nameplate',        rewardKey: 'nameplate_connector',   label: 'Connector Nameplate' },
]

export const REFERRAL_ATTRIBUTION_DAYS = 30
export const REFERRAL_MAX_PER_YEAR     = 10
```

#### `src/data/types.ts` extensions

```typescript
/** Extended from Phase 22 base. */
export interface ReferralRecord {
  referredPlayerId: string
  linkClickedAt:    string   // ISO timestamp
  appInstalledAt:   string | null
  firstDiveAt:      string | null
  qualified:        boolean  // true once first dive complete within attribution window
  rewardClaimed:    boolean
}

// Add to PlayerSave:
referralStats: {
  code:                string           // permanent per-player code
  qualifiedCount:      number           // total qualifying referrals all-time
  yearlyCount:         number           // qualifying referrals this calendar year
  yearlyResetDate:     string           // ISO date of next yearly reset
  pendingRewardTiers:  number[]         // threshold values of unclaimed rewards
  claimedRewardKeys:   string[]         // reward keys already credited
}
```

#### `server/src/services/referralService.ts`

```typescript
/**
 * @file referralService.ts
 * Server-side referral attribution and fraud prevention.
 */

import type { FastifyInstance } from 'fastify'

export interface AttributionClick {
  referralCode: string
  clickedAt: Date
  ipHash:    string   // SHA-256 of IP — never store raw IPs
  userAgent: string
}

export interface ReferralServiceConfig {
  attributionDays: number
  maxPerYear: number
}

/**
 * Record a link click. Idempotent per (code, ipHash, day) — duplicate
 * clicks from the same IP on the same calendar day are ignored.
 */
export async function recordLinkClick(
  db: FastifyInstance['db'],
  click: AttributionClick,
): Promise<void> {
  await db.query(
    `INSERT INTO referral_clicks (code, clicked_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code, ip_hash, DATE(clicked_at)) DO NOTHING`,
    [click.referralCode, click.clickedAt, click.ipHash, click.userAgent],
  )
}

/**
 * Attempt to attribute a new player registration to a referral code.
 * Returns the referrer's player ID if attribution succeeds, or null if the
 * code is invalid, expired, or the IP has already been attributed today.
 */
export async function attributeInstall(
  db: FastifyInstance['db'],
  referralCode: string,
  newPlayerId: string,
  ipHash: string,
  config: ReferralServiceConfig,
): Promise<string | null> {
  // Look up the referrer
  const referrer = await db.query<{ player_id: string; created_at: Date }>(
    `SELECT player_id, created_at FROM referral_codes WHERE code = $1`,
    [referralCode],
  )
  if (!referrer.rows.length) return null

  const referrerId = referrer.rows[0].player_id
  if (referrerId === newPlayerId) return null  // cannot refer yourself

  // Check attribution window: click must exist within last N days
  const windowStart = new Date(Date.now() - config.attributionDays * 86_400_000)
  const click = await db.query(
    `SELECT 1 FROM referral_clicks
     WHERE code = $1 AND ip_hash = $2 AND clicked_at >= $3
     LIMIT 1`,
    [referralCode, ipHash, windowStart],
  )
  if (!click.rows.length) return null   // no click within window from this IP

  // IP dedup: same IP cannot qualify more than once per referrer per day
  const dupCheck = await db.query(
    `SELECT 1 FROM referral_installs
     WHERE referrer_id = $1 AND ip_hash = $2
       AND installed_at >= NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [referrerId, ipHash],
  )
  if (dupCheck.rows.length) return null

  // Insert install record
  await db.query(
    `INSERT INTO referral_installs
       (referrer_id, referred_player_id, ip_hash, installed_at)
     VALUES ($1, $2, $3, NOW())`,
    [referrerId, newPlayerId, ipHash],
  )

  return referrerId
}

/**
 * Mark a referral as qualified (new player completed first dive).
 * Increments the referrer's qualified count and appends pending reward tiers.
 * Enforces the yearly cap.
 */
export async function qualifyReferral(
  db: FastifyInstance['db'],
  referrerId: string,
  referredPlayerId: string,
  config: ReferralServiceConfig,
): Promise<{ newCount: number; newRewardThresholds: number[] }> {
  // Fetch current stats
  const stats = await db.query<{
    qualified_count: number
    yearly_count: number
    yearly_reset_date: string
  }>(
    `SELECT qualified_count, yearly_count, yearly_reset_date
     FROM player_referral_stats WHERE player_id = $1`,
    [referrerId],
  )

  let qualifiedCount = stats.rows[0]?.qualified_count ?? 0
  let yearlyCount    = stats.rows[0]?.yearly_count ?? 0
  const resetDate    = stats.rows[0]?.yearly_reset_date
    ? new Date(stats.rows[0].yearly_reset_date)
    : new Date(new Date().getFullYear() + 1, 0, 1)  // next Jan 1

  // Reset yearly counter if past reset date
  if (new Date() >= resetDate) {
    yearlyCount = 0
  }

  if (yearlyCount >= config.maxPerYear) return { newCount: qualifiedCount, newRewardThresholds: [] }

  qualifiedCount += 1
  yearlyCount    += 1

  // Determine newly crossed reward thresholds
  const { REFERRAL_REWARD_TIERS } = await import('../../src/data/balance')  // dynamic — server stub
  const prevCount = qualifiedCount - 1
  const newThresholds = REFERRAL_REWARD_TIERS
    .filter(t => t.threshold > prevCount && t.threshold <= qualifiedCount)
    .map(t => t.threshold)

  // Upsert stats
  await db.query(
    `INSERT INTO player_referral_stats
       (player_id, qualified_count, yearly_count, yearly_reset_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id) DO UPDATE
     SET qualified_count = $2, yearly_count = $3`,
    [referrerId, qualifiedCount, yearlyCount, resetDate],
  )

  return { newCount: qualifiedCount, newRewardThresholds: newThresholds }
}
```

#### Database schema additions (`server/db/referrals.sql`)

```sql
CREATE TABLE referral_codes (
  code          TEXT PRIMARY KEY,
  player_id     UUID NOT NULL REFERENCES players(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE referral_clicks (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL REFERENCES referral_codes(code),
  clicked_at    TIMESTAMPTZ NOT NULL,
  ip_hash       TEXT NOT NULL,
  user_agent    TEXT,
  UNIQUE (code, ip_hash, DATE(clicked_at))
);

CREATE TABLE referral_installs (
  id                  SERIAL PRIMARY KEY,
  referrer_id         UUID NOT NULL REFERENCES players(id),
  referred_player_id  UUID NOT NULL REFERENCES players(id),
  ip_hash             TEXT NOT NULL,
  installed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE player_referral_stats (
  player_id         UUID PRIMARY KEY REFERENCES players(id),
  qualified_count   INTEGER NOT NULL DEFAULT 0,
  yearly_count      INTEGER NOT NULL DEFAULT 0,
  yearly_reset_date DATE NOT NULL DEFAULT DATE_TRUNC('year', NOW()) + INTERVAL '1 year'
);
```

### Acceptance Criteria — 42.2
- [ ] `attributeInstall()` returns `null` when the same `ipHash` has already been attributed within 24 hours for the same referrer
- [ ] `qualifyReferral()` does not increment `yearlyCount` beyond `REFERRAL_MAX_PER_YEAR`
- [ ] `REFERRAL_REWARD_TIERS` contains exactly 4 entries at thresholds 1, 3, 5, 10
- [ ] `ReferralModal.svelte` shows a tier progress bar: "X / 3 referrals for Explorer Frame"
- [ ] Claiming a reward credits the correct item to `PlayerSave` (fossil egg → `reviewStates` seed, cosmetic → `unlockedCosmetics`)
- [ ] A player cannot refer themselves (server returns 400)
- [ ] `npm run typecheck` passes

---

## Sub-Phase 42.3: Social Proof Badges

### What

Verifiable achievement badges that players can share to social media. Unlike the share cards in 42.1 (which are one-off images), badges are persistent public credentials. Each badge has a canonical URL at `https://terragacha.com/badge/:playerId/:badgeId` that renders a live image (SVG) using real-time data from the server. When shared, the URL unfurls into a rich preview card.

Five badge types are defined for v1:

| Badge ID | Earn Condition | Display |
|---|---|---|
| `century_scholar` | 100 facts mastered | "Century Scholar — 100 Facts Mastered" |
| `deep_diver` | Layer 15+ reached | "Deep Diver — Layer 15+" |
| `streak_legend` | 30-day login streak | "Streak Legend — 30 Day Streak" |
| `guild_champion` | Guild wins 3 challenges | "Guild Champion" |
| `pioneer` | Purchased Pioneer Pack | "Pioneer — Early Supporter" |

### Where

- `server/src/routes/badges.ts` — **new file**, badge verification and SVG rendering endpoint
- `src/services/badgeService.ts` — **new file**, client-side badge fetching and share trigger
- `src/ui/components/BadgeDisplay.svelte` — **new file**, badge grid for profile and dome hub
- `src/ui/components/auth/ProfileView.svelte` — add badge grid section
- `src/data/types.ts` — add `earnedBadges: EarnedBadge[]` to `PlayerSave`

### How

#### `src/services/badgeService.ts`

```typescript
/**
 * @file badgeService.ts
 * Client-side badge service. Fetches earned badges and triggers
 * sharing via the share card pipeline.
 */

export interface BadgeDefinition {
  id: string
  label: string
  description: string
  iconSvgPath: string  // Path within the badge SVG template
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id:          'century_scholar',
    label:       'Century Scholar',
    description: '100 facts mastered',
    iconSvgPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  },
  {
    id:          'deep_diver',
    label:       'Deep Diver',
    description: 'Reached Layer 15',
    iconSvgPath: 'M20 14l-8 8-8-8 1.4-1.4L11 17.2V4h2v13.2l5.6-5.6L20 14z',
  },
  {
    id:          'streak_legend',
    label:       'Streak Legend',
    description: '30-day login streak',
    iconSvgPath: 'M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 13C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05Z',
  },
  {
    id:          'guild_champion',
    label:       'Guild Champion',
    description: 'Guild completed 3 challenges',
    iconSvgPath: 'M12 1L15.39 8.28L23 9.27L17.5 14.64L18.78 22.27L12 18.77L5.22 22.27L6.5 14.64L1 9.27L8.61 8.28L12 1Z',
  },
  {
    id:          'pioneer',
    label:       'Pioneer',
    description: 'Early Supporter',
    iconSvgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  },
]

export interface EarnedBadge {
  id:       string
  earnedAt: string  // ISO timestamp
}

/** Fetch earned badges from the server for the current player. */
export async function fetchEarnedBadges(): Promise<EarnedBadge[]> {
  const res = await fetch('/api/badges/me', { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json() as { badges: EarnedBadge[] }
  return data.badges ?? []
}

/**
 * Evaluate which new badges the player has earned based on their current save.
 * Returns an array of badge IDs that are newly earned (not yet in earnedBadges).
 */
export function evaluateNewBadges(
  save: {
    reviewStates?: Record<string, { interval: number }>
    deepestLayer?: number
    loginStreak?: number
    guildChampionWins?: number
    isPioneer?: boolean
  },
  alreadyEarned: Set<string>,
): string[] {
  const newBadges: string[] = []

  const masteredCount = save.reviewStates
    ? Object.values(save.reviewStates).filter(r => r.interval >= 60).length
    : 0

  if (masteredCount >= 100 && !alreadyEarned.has('century_scholar')) {
    newBadges.push('century_scholar')
  }
  if ((save.deepestLayer ?? 0) >= 15 && !alreadyEarned.has('deep_diver')) {
    newBadges.push('deep_diver')
  }
  if ((save.loginStreak ?? 0) >= 30 && !alreadyEarned.has('streak_legend')) {
    newBadges.push('streak_legend')
  }
  if ((save.guildChampionWins ?? 0) >= 3 && !alreadyEarned.has('guild_champion')) {
    newBadges.push('guild_champion')
  }
  if (save.isPioneer && !alreadyEarned.has('pioneer')) {
    newBadges.push('pioneer')
  }

  return newBadges
}

/**
 * Return the public badge page URL for sharing.
 * This URL serves a meta-tag-enriched HTML page that unfurls in social media.
 */
export function getBadgeShareUrl(playerId: string, badgeId: string): string {
  return `https://terragacha.com/badge/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}`
}
```

#### `server/src/routes/badges.ts` (key endpoint)

```typescript
/**
 * GET /badge/:playerId/:badgeId
 * Returns an HTML page with Open Graph meta tags and an inline SVG badge.
 * Used for social media link unfurling.
 */
fastify.get<{ Params: { playerId: string; badgeId: string } }>(
  '/badge/:playerId/:badgeId',
  { config: { rateLimit: { max: 100, timeWindow: '1m' } } },
  async (req, reply) => {
    const { playerId, badgeId } = req.params
    // Validate inputs — alphanumeric + hyphens only
    if (!/^[\w-]{1,64}$/.test(playerId) || !/^[\w-]{1,64}$/.test(badgeId)) {
      return reply.status(400).send('Invalid parameters')
    }

    const row = await fastify.db.query<{ earned_at: string; display_name: string }>(
      `SELECT b.earned_at, p.display_name
       FROM player_badges b
       JOIN players p ON p.id = b.player_id
       WHERE b.player_id = $1 AND b.badge_id = $2 AND b.is_visible = TRUE`,
      [playerId, badgeId],
    )
    if (!row.rows.length) return reply.status(404).send('Badge not found')

    const { earned_at, display_name } = row.rows[0]
    const def = BADGE_DEFINITIONS_SERVER.find(b => b.id === badgeId)
    if (!def) return reply.status(404).send('Unknown badge')

    // Sanitize display_name — strip any HTML special chars
    const safeName = display_name.replace(/[<>&"']/g, c =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

    const ogImageUrl = `https://terragacha.com/api/badges/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}/image.svg`

    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${safeName} earned: ${def.label}">
  <meta property="og:description" content="${def.description} — Terra Gacha">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:url" content="https://terragacha.com/badge/${playerId}/${badgeId}">
  <meta name="twitter:card" content="summary_large_image">
  <title>${safeName} — ${def.label} | Terra Gacha</title>
</head>
<body>
  <p>Redirecting to Terra Gacha…</p>
  <script>
    // Deep link redirect — opens app if installed, App Store otherwise
    window.location = 'terragacha://badge/${playerId}/${badgeId}'
    setTimeout(() => { window.location = 'https://terragacha.com' }, 2000)
  </script>
</body>
</html>`)
  },
)
```

### Acceptance Criteria — 42.3
- [ ] `evaluateNewBadges()` returns `['century_scholar']` when `masteredCount >= 100` and badge not already earned
- [ ] `GET /badge/:playerId/:badgeId` returns 400 for non-alphanumeric parameters
- [ ] `GET /badge/:playerId/:badgeId` HTML response includes correct Open Graph `og:title` meta tag
- [ ] Display name in HTML response has all `<>&"'` characters entity-encoded
- [ ] `BadgeDisplay.svelte` renders all 5 badge slots; unearned badges shown as greyed-out locks
- [ ] `npm run typecheck` passes

---

## Sub-Phase 42.4: Deep Link System

### What

Universal links (iOS) and App Links (Android) that open Terra Gacha at specific in-app destinations when tapped from outside the app. The same URL also works in a browser (graceful fallback to web). Three link types are supported:

| Route | In-App Destination | Browser Fallback |
|---|---|---|
| `/invite/:code` | Referral onboarding screen | Web landing page with App Store/Play Store buttons |
| `/badge/:playerId/:badgeId` | Badge detail view | Badge HTML page from 42.3 |
| `/fact/:factId` | Fact card in Knowledge Tree | Static fact page (requires CDN render) |

### Where

- `src/services/deepLinkService.ts` — **new file**, parse and dispatch deep links
- `src/App.svelte` — register deep link listener on app init
- `server/src/routes/deepLinks.ts` — **new file**, redirect/AASA endpoint
- `public/.well-known/apple-app-site-association` — **new file**, iOS universal link config
- `public/.well-known/assetlinks.json` — **new file**, Android App Links config

### How

#### `src/services/deepLinkService.ts`

```typescript
/**
 * @file deepLinkService.ts
 * Parses incoming deep link URLs and dispatches navigation events.
 * Handles both Capacitor app-launched-from-url and in-browser URL params.
 *
 * Route patterns:
 *   terragacha://invite/:code       → show ReferralOnboarding, pre-fill code
 *   terragacha://badge/:pid/:bid    → show BadgeDetail modal
 *   terragacha://fact/:factId       → open KnowledgeTree to that fact
 *   https://terragacha.com/invite/:code  → same as above (universal link)
 */

export type DeepLinkRoute =
  | { type: 'invite';  code: string }
  | { type: 'badge';   playerId: string; badgeId: string }
  | { type: 'fact';    factId: string }
  | { type: 'unknown' }

/**
 * Parse a deep link URL into a typed route object.
 * Returns `{ type: 'unknown' }` for unrecognized patterns rather than throwing.
 *
 * @param rawUrl - The full URL string (custom scheme or https).
 * @returns Typed route or unknown sentinel.
 */
export function parseDeepLink(rawUrl: string): DeepLinkRoute {
  let url: URL
  try {
    // Normalize custom scheme to https for URL parsing
    const normalised = rawUrl.replace(/^terragacha:\/\//, 'https://terragacha.com/')
    url = new URL(normalised)
  } catch {
    return { type: 'unknown' }
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (!parts.length) return { type: 'unknown' }

  switch (parts[0]) {
    case 'invite': {
      const code = parts[1]
      // Validate: alphanumeric + hyphens, 6-32 chars
      if (!code || !/^[a-zA-Z0-9-]{6,32}$/.test(code)) return { type: 'unknown' }
      return { type: 'invite', code }
    }
    case 'badge': {
      const playerId = parts[1]
      const badgeId  = parts[2]
      if (!playerId || !badgeId) return { type: 'unknown' }
      if (!/^[\w-]{1,64}$/.test(playerId) || !/^[\w-]{1,64}$/.test(badgeId)) return { type: 'unknown' }
      return { type: 'badge', playerId, badgeId }
    }
    case 'fact': {
      const factId = parts[1]
      if (!factId || !/^[\w-]{1,64}$/.test(factId)) return { type: 'unknown' }
      return { type: 'fact', factId }
    }
    default:
      return { type: 'unknown' }
  }
}

/**
 * Register platform-specific deep link listeners.
 * Call once on app init from App.svelte.
 * Dispatches a custom DOM event `terra:deeplink` with the parsed route.
 *
 * On web: reads `?link=` query parameter from window.location.
 * On Capacitor: listens for `appUrlOpen` from @capacitor/core App plugin.
 */
export function registerDeepLinkListener(): void {
  // Web: check URL on load
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const linkParam = params.get('link')
    if (linkParam) {
      try {
        const decoded = decodeURIComponent(linkParam)
        const route = parseDeepLink(decoded)
        if (route.type !== 'unknown') {
          window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
        }
      } catch { /* malformed — ignore */ }
    }

    // Also handle the full page URL as a potential universal link
    const route = parseDeepLink(window.location.href)
    if (route.type !== 'unknown') {
      window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
    }
  }

  // Capacitor: listen for appUrlOpen
  try {
    // Use dynamic registration pattern from Phase 20 (no @capacitor/app import)
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core')
    const App = registerPlugin<{ addListener: (event: string, cb: (data: { url: string }) => void) => void }>('App')
    App.addListener('appUrlOpen', (data: { url: string }) => {
      const route = parseDeepLink(data.url)
      if (route.type !== 'unknown' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
      }
    })
  } catch { /* Capacitor not available on web — ignore */ }
}
```

#### `public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.terragacha.app",
        "paths": ["/invite/*", "/badge/*/*", "/fact/*"]
      }
    ]
  }
}
```

#### `public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.terragacha.app",
      "sha256_cert_fingerprints": ["PLACEHOLDER_REPLACE_WITH_KEYSTORE_SHA256"]
    }
  }
]
```

> IMPORTANT: Replace `TEAMID` and `PLACEHOLDER_REPLACE_WITH_KEYSTORE_SHA256` with real values before App Store / Play Store submission. These files must be served with `Content-Type: application/json` and no redirect.

### Acceptance Criteria — 42.4
- [ ] `parseDeepLink('terragacha://invite/ABC123')` returns `{ type: 'invite', code: 'ABC123' }`
- [ ] `parseDeepLink('terragacha://invite/<script>alert(1)</script>')` returns `{ type: 'unknown' }`
- [ ] `parseDeepLink('https://terragacha.com/badge/player-uuid/deep_diver')` returns correct badge route
- [ ] `registerDeepLinkListener()` dispatches `terra:deeplink` event when `?link=` param is present in URL
- [ ] `.well-known/apple-app-site-association` is valid JSON (parse without error)
- [ ] `.well-known/assetlinks.json` is valid JSON
- [ ] `npm run typecheck` passes

---

## Sub-Phase 42.5: ASO Iteration

### What

App Store Optimization tooling embedded in the game itself. Three components:

1. **Keyword rank tracker** — a Fastify cron job that queries App Store Connect API and Google Play Developer API nightly and stores keyword rankings in the database, producing a trend chart in the admin dashboard.
2. **Review prompt** — an in-app review prompt that fires at the optimal moment using the `StoreReview` Capacitor plugin. The trigger logic targets high-satisfaction moments, not raw time-in-app.
3. **Screenshot A/B config** — a server-side feature flag that controls which variant of the App Store screenshots the player sees in the `PlayStoreHelper` component (used by `PwaInstallPrompt.svelte`). Variant assignment is logged so click-through can be correlated to store install rate.

### Where

- `src/services/reviewPromptService.ts` — **new file**, trigger logic for in-app review
- `server/src/jobs/asoKeywordTracker.ts` — **new file**, nightly keyword rank cron
- `server/src/routes/aso.ts` — **new file**, admin endpoint for ASO dashboard
- `src/ui/components/ReviewPromptTrigger.svelte` — **new file**, mounts invisibly in BaseView, fires prompt at correct moment
- `src/data/balance.ts` — add `REVIEW_PROMPT_TRIGGERS` constant

#### `src/services/reviewPromptService.ts`

```typescript
/**
 * @file reviewPromptService.ts
 * Manages when to surface the native in-app review prompt.
 *
 * Trigger rules (DD-V2-150):
 * - Player has completed at least 5 dives
 * - Player has mastered at least 10 facts
 * - Player has NOT been prompted in the last 90 days
 * - Prompt fires at most once per app install lifecycle
 * - Fires after a positive moment: streak milestone, fact mastery milestone,
 *   or dive personal best — never mid-session or after a death
 */

const REVIEW_PROMPT_KEY      = 'terra-review-prompt-last'
const REVIEW_PROMPT_COOLDOWN = 90 * 24 * 60 * 60 * 1000  // 90 days in ms
const MIN_DIVES_BEFORE_PROMPT = 5
const MIN_FACTS_BEFORE_PROMPT = 10

export interface ReviewEligibilityData {
  totalDives:     number
  masteredFacts:  number
  wasPositiveMoment: boolean  // set to true by caller on streak/mastery/PB events
}

/**
 * Check whether the review prompt should fire now.
 * Returns true if all conditions are met; false otherwise.
 */
export function shouldShowReviewPrompt(data: ReviewEligibilityData): boolean {
  if (!data.wasPositiveMoment) return false
  if (data.totalDives < MIN_DIVES_BEFORE_PROMPT) return false
  if (data.masteredFacts < MIN_FACTS_BEFORE_PROMPT) return false

  const lastPrompted = parseInt(localStorage.getItem(REVIEW_PROMPT_KEY) ?? '0', 10)
  if (Date.now() - lastPrompted < REVIEW_PROMPT_COOLDOWN) return false

  return true
}

/**
 * Fire the native in-app review prompt via Capacitor StoreReview plugin.
 * Records the prompt timestamp to enforce cooldown.
 * Never throws — failures are silently absorbed.
 */
export async function fireReviewPrompt(): Promise<void> {
  try {
    localStorage.setItem(REVIEW_PROMPT_KEY, String(Date.now()))
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core')
    const StoreReview = registerPlugin<{ requestReview: () => Promise<void> }>('StoreReview')
    await StoreReview.requestReview()
  } catch { /* plugin not available on web or error — ignore */ }
}
```

#### `server/src/jobs/asoKeywordTracker.ts`

```typescript
/**
 * @file asoKeywordTracker.ts
 * Nightly cron job (03:30 UTC) that fetches keyword rank data from
 * App Store Connect and Google Play Developer APIs and stores results.
 *
 * Prerequisites: APPLE_ASC_KEY_ID, APPLE_ASC_ISSUER_ID, APPLE_ASC_P8_KEY
 * and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env vars must be set.
 * If either API is unconfigured, that platform's tracking is skipped silently.
 */

export const TARGET_KEYWORDS = [
  'mining game',
  'educational game',
  'space miner',
  'quiz game',
  'knowledge game',
  'geology game',
  'fossil game',
  'earth history',
  'fact learning game',
  'spaced repetition game',
]

/** Minimal rank data stored per keyword per day. */
export interface KeywordRankRow {
  keyword:    string
  platform:   'ios' | 'android'
  rank:       number | null   // null = not in top 250
  checked_at: Date
}

/**
 * Run the ASO keyword tracker. Fetches current ranks for all TARGET_KEYWORDS
 * and upserts into the `aso_keyword_ranks` table.
 * Intended to be called by the cron scheduler (server/src/jobs/scheduler.ts).
 */
export async function runAsoKeywordTracker(db: unknown): Promise<void> {
  const results: KeywordRankRow[] = []

  // iOS — App Store Connect Search Ads API (rank approximation via keyword volume)
  if (process.env.APPLE_ASC_KEY_ID) {
    for (const keyword of TARGET_KEYWORDS) {
      // Stub: real implementation calls ASC API with JWT auth
      results.push({ keyword, platform: 'ios', rank: null, checked_at: new Date() })
    }
  }

  // Android — Google Play Developer Reporting API (stub)
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    for (const keyword of TARGET_KEYWORDS) {
      results.push({ keyword, platform: 'android', rank: null, checked_at: new Date() })
    }
  }

  // Upsert — ON CONFLICT replaces same keyword+platform+day
  for (const row of results) {
    await (db as { query: (sql: string, params: unknown[]) => Promise<void> }).query(
      `INSERT INTO aso_keyword_ranks (keyword, platform, rank, checked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (keyword, platform, DATE(checked_at))
       DO UPDATE SET rank = EXCLUDED.rank`,
      [row.keyword, row.platform, row.rank, row.checked_at],
    )
  }
}
```

### Acceptance Criteria — 42.5
- [ ] `shouldShowReviewPrompt()` returns `false` when `wasPositiveMoment` is `false`
- [ ] `shouldShowReviewPrompt()` returns `false` when `totalDives < 5`
- [ ] `shouldShowReviewPrompt()` returns `false` if `REVIEW_PROMPT_KEY` was set within the last 90 days
- [ ] `shouldShowReviewPrompt()` returns `true` when all conditions satisfied and no recent prompt
- [ ] `fireReviewPrompt()` does not throw when Capacitor StoreReview plugin is unavailable (web environment)
- [ ] `TARGET_KEYWORDS` contains at least 10 entries
- [ ] `runAsoKeywordTracker()` does not throw when API env vars are absent
- [ ] `npm run typecheck` passes

---

## Sub-Phase 42.6: Viral Loop Analytics

### What

K-factor tracking and the full referral funnel. K-factor = (average referrals sent per user) × (conversion rate of referral to install). A K-factor above 1.0 means the app is self-sustaining through word of mouth alone.

Four new analytics events extend `src/services/analyticsService.ts`:

| Event | When | Key Properties |
|---|---|---|
| `share_card_generated` | Player taps "Share / Save" in ShareCardModal | `template`, `platform` (web_share / download) |
| `referral_link_shared` | Player taps share in ReferralModal | `channel` (copy / native_share / social) |
| `referral_converted` | New player completes first dive with a referral code | `days_since_click`, `referrer_tier` |
| `badge_shared` | Player taps share on a badge | `badge_id`, `share_method` |

A new server-side analytics route and admin dashboard panel expose K-factor, install-to-first-dive funnel, and share-to-install rate.

### Where

- `src/services/analyticsService.ts` — extend with 4 new event types
- `server/src/analytics/viralMetrics.ts` — **new file**, K-factor computation
- `server/src/routes/analytics.ts` — extend with `/api/analytics/viral` endpoint
- `src/ui/components/ShareCardModal.svelte` — add analytics call on share
- `src/ui/components/ReferralModal.svelte` — add analytics call on share
- `src/ui/components/BadgeDisplay.svelte` — add analytics call on badge share

### How

#### New events in `src/services/analyticsService.ts`

```typescript
/** Fired when a share card is generated and the player confirms sharing. */
interface ShareCardGeneratedEvent {
  name: 'share_card_generated'
  properties: {
    template: 'fact_mastery' | 'dive_record' | 'guild_win'
    platform: 'web_share' | 'download' | 'clipboard'
    facts_mastered: number
    tree_completion_pct: number
  }
}

/** Fired when the player shares their referral link from the ReferralModal. */
interface ReferralLinkSharedEvent {
  name: 'referral_link_shared'
  properties: {
    channel: 'copy' | 'native_share' | 'direct'
    qualified_referrals_so_far: number
    current_tier_threshold: number
  }
}

/** Fired on the NEW player's device when they complete their first dive
 *  and a referral code was present in their onboarding session. */
interface ReferralConvertedEvent {
  name: 'referral_converted'
  properties: {
    days_since_click:  number   // float
    referrer_tier:     string   // 'none' | 'patron' | 'pioneer'
    onboarding_source: 'invite_link' | 'badge_link' | 'organic'
  }
}

/** Fired when a player shares a social proof badge. */
interface BadgeSharedEvent {
  name: 'badge_shared'
  properties: {
    badge_id:     string
    share_method: 'clipboard' | 'native_share' | 'direct_link'
  }
}
```

#### `server/src/analytics/viralMetrics.ts`

```typescript
/**
 * @file viralMetrics.ts
 * Computes K-factor, referral funnel conversion rates, and
 * share-to-install rate from raw analytics events.
 *
 * K-factor formula:
 *   K = (shares_per_active_user_30d) × (referral_install_rate)
 *
 * Where:
 *   shares_per_active_user_30d = COUNT(referral_link_shared events in last 30d)
 *                                / COUNT(distinct active players in last 30d)
 *   referral_install_rate      = COUNT(referral_converted events in last 30d)
 *                                / COUNT(referral_link_shared events in last 30d)
 */

export interface ViralMetricsReport {
  kFactor:              number
  sharesPerActiveUser:  number
  referralInstallRate:  number
  installToFirstDivePct: number  // % of referral installs that complete first dive
  shareCardGenerated30d: number
  referralLinksShared30d: number
  referralConverted30d:   number
  badgesShared30d:        number
  topTemplate:           string  // most-shared card template in last 30d
  computedAt:            Date
}

/**
 * Compute viral metrics from analytics events in the last N days.
 * All queries run against the `analytics_events` table populated by
 * the existing analytics pipeline (Phase 19.7).
 */
export async function computeViralMetrics(
  db: unknown,
  windowDays = 30,
): Promise<ViralMetricsReport> {
  const since = new Date(Date.now() - windowDays * 86_400_000)
  const q = db as { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }

  const [shared, converted, activeUsers, cardGen, badgeShared] = await Promise.all([
    q.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'referral_link_shared' AND created_at >= $1`, [since]),
    q.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'referral_converted' AND created_at >= $1`, [since]),
    q.query<{ count: string }>(`
      SELECT COUNT(DISTINCT player_id) AS count FROM analytics_events
      WHERE created_at >= $1`, [since]),
    q.query<{ count: string; template: string }>(`
      SELECT COUNT(*) AS count, properties->>'template' AS template
      FROM analytics_events
      WHERE name = 'share_card_generated' AND created_at >= $1
      GROUP BY template ORDER BY count DESC LIMIT 1`, [since]),
    q.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'badge_shared' AND created_at >= $1`, [since]),
  ])

  const sharesN    = parseInt(shared.rows[0]?.count ?? '0', 10)
  const convertN   = parseInt(converted.rows[0]?.count ?? '0', 10)
  const activeN    = parseInt(activeUsers.rows[0]?.count ?? '1', 10)
  const cardGenN   = parseInt(cardGen.rows[0]?.count ?? '0', 10)
  const badgeShareN = parseInt(badgeShared.rows[0]?.count ?? '0', 10)

  const sharesPerUser  = activeN > 0 ? sharesN / activeN : 0
  const installRate    = sharesN > 0 ? convertN / sharesN : 0
  const kFactor        = sharesPerUser * installRate

  // First-dive completion: referral_converted / referral installs (approximated by shares)
  const installToFirstDive = sharesN > 0 ? convertN / sharesN : 0

  return {
    kFactor:               Math.round(kFactor * 1000) / 1000,
    sharesPerActiveUser:   Math.round(sharesPerUser * 1000) / 1000,
    referralInstallRate:   Math.round(installRate * 1000) / 1000,
    installToFirstDivePct: Math.round(installToFirstDive * 100 * 10) / 10,
    shareCardGenerated30d:  cardGenN,
    referralLinksShared30d: sharesN,
    referralConverted30d:   convertN,
    badgesShared30d:        badgeShareN,
    topTemplate:            cardGen.rows[0]?.template ?? 'none',
    computedAt:             new Date(),
  }
}
```

### Acceptance Criteria — 42.6
- [ ] `computeViralMetrics()` returns `kFactor: 0` when `sharesN === 0` (no division by zero)
- [ ] `computeViralMetrics()` returns `kFactor: 0` when `activeN === 0`
- [ ] All 4 new analytics events are listed in `analyticsService.ts` with correct property shapes
- [ ] `GET /api/analytics/viral` returns a JSON body matching `ViralMetricsReport` shape
- [ ] `share_card_generated` event is fired in `ShareCardModal.svelte` on user confirmation
- [ ] `referral_link_shared` event is fired in `ReferralModal.svelte` on copy and on native share
- [ ] `npm run typecheck` passes

---

## Playwright Tests

### Full Integration Test Suite

```js
/**
 * Phase 42 Playwright integration tests.
 * Run with: node /tmp/test-phase-42.js
 * Requires: dev server running at localhost:5173
 */
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })

  let allPassed = true
  function assert(condition, message) {
    if (!condition) {
      console.error(`  FAIL: ${message}`)
      allPassed = false
    } else {
      console.log(`  PASS: ${message}`)
    }
  }

  // ── Test 42.1 — Share Card Generator ───────────────────────────────────
  console.log('\n=== 42.1 Share Card Generator ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    // Verify renderShareCard produces correct dimensions
    const result = await page.evaluate(async () => {
      const mod = await import('/src/services/shareCardService.ts')
      const card = await mod.renderShareCard({
        template: 'fact_mastery',
        displayName: 'Tester',
        primaryMetric: 100,
        treeCompletionPct: 50,
        isPatron: false,
      })
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, urlLen: card.dataUrl.length })
        img.onerror = reject
        img.src = card.dataUrl
      })
    })

    assert(result.w === 1200, `Card width should be 1200, got ${result.w}`)
    assert(result.h === 630,  `Card height should be 630, got ${result.h}`)
    assert(result.urlLen > 1000, 'dataUrl should have content')

    // Verify control-character stripping
    const safeResult = await page.evaluate(async () => {
      const mod = await import('/src/services/shareCardService.ts')
      // Access the sanitizer via a card with a malformed name
      const card = await mod.renderShareCard({
        template: 'fact_mastery',
        displayName: 'Test\x00\x1FUser<script>',
        primaryMetric: 1,
        treeCompletionPct: 0,
        isPatron: false,
      })
      return card.shareText.includes('<script>') === false
    })
    assert(safeResult, 'Share text must not contain raw <script> from display name')

    await page.screenshot({ path: '/tmp/ss-42-1-base.png' })
    await page.close()
  }

  // ── Test 42.2 — Referral Tiers in UI ───────────────────────────────────
  console.log('\n=== 42.2 Referral System ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    // Navigate to Archive room where ReferralModal is accessible
    await page.click('[data-testid="room-tab-archive"]').catch(() => {})
    await page.waitForTimeout(600)

    const referralBtn = await page.$('[data-testid="referral-modal-open"]')
    assert(referralBtn !== null, 'Referral modal open button should exist in Archive room')

    // Check balance constant is accessible
    const tiersOk = await page.evaluate(async () => {
      const bal = await import('/src/data/balance.ts')
      return Array.isArray(bal.REFERRAL_REWARD_TIERS) && bal.REFERRAL_REWARD_TIERS.length === 4
    })
    assert(tiersOk, 'REFERRAL_REWARD_TIERS should be an array of 4 entries')

    await page.screenshot({ path: '/tmp/ss-42-2-referral.png' })
    await page.close()
  }

  // ── Test 42.3 — Badge Evaluation ───────────────────────────────────────
  console.log('\n=== 42.3 Social Proof Badges ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    const badgeResult = await page.evaluate(async () => {
      const mod = await import('/src/services/badgeService.ts')
      const newBadges = mod.evaluateNewBadges(
        { reviewStates: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`fact_${i}`, { interval: 60 }])) },
        new Set([]),
      )
      return newBadges
    })
    assert(badgeResult.includes('century_scholar'), 'century_scholar badge should be awarded at 100 mastered facts')

    const noBadge = await page.evaluate(async () => {
      const mod = await import('/src/services/badgeService.ts')
      return mod.evaluateNewBadges(
        { reviewStates: Object.fromEntries(Array.from({ length: 99 }, (_, i) => [`fact_${i}`, { interval: 60 }])) },
        new Set([]),
      )
    })
    assert(!noBadge.includes('century_scholar'), 'century_scholar should NOT be awarded at 99 facts')

    await page.screenshot({ path: '/tmp/ss-42-3-badges.png' })
    await page.close()
  }

  // ── Test 42.4 — Deep Link Parsing ──────────────────────────────────────
  console.log('\n=== 42.4 Deep Link System ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    const parsed = await page.evaluate(async () => {
      const mod = await import('/src/services/deepLinkService.ts')
      return {
        invite:  mod.parseDeepLink('terragacha://invite/ABC-123'),
        badge:   mod.parseDeepLink('terragacha://badge/player-uuid/deep_diver'),
        xss:     mod.parseDeepLink('terragacha://invite/<script>alert(1)</script>'),
        unknown: mod.parseDeepLink('terragacha://unknown/path'),
      }
    })

    assert(parsed.invite.type === 'invite',  'invite link should parse as invite')
    assert((parsed.invite as { code?: string }).code === 'ABC-123', 'invite code should be ABC-123')
    assert(parsed.badge.type === 'badge',    'badge link should parse as badge')
    assert(parsed.xss.type === 'unknown',    'XSS invite should return unknown')
    assert(parsed.unknown.type === 'unknown','unrecognized path should return unknown')

    await page.screenshot({ path: '/tmp/ss-42-4-deeplinks.png' })
    await page.close()
  }

  // ── Test 42.5 — Review Prompt Gating ───────────────────────────────────
  console.log('\n=== 42.5 ASO & Review Prompt ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    const promptResult = await page.evaluate(async () => {
      const mod = await import('/src/services/reviewPromptService.ts')
      localStorage.removeItem('terra-review-prompt-last')
      const shouldShow = mod.shouldShowReviewPrompt({
        totalDives: 10,
        masteredFacts: 15,
        wasPositiveMoment: true,
      })
      const tooFewDives = mod.shouldShowReviewPrompt({
        totalDives: 2,
        masteredFacts: 15,
        wasPositiveMoment: true,
      })
      const noPositive = mod.shouldShowReviewPrompt({
        totalDives: 10,
        masteredFacts: 15,
        wasPositiveMoment: false,
      })
      return { shouldShow, tooFewDives, noPositive }
    })

    assert(promptResult.shouldShow    === true,  'Review prompt should fire when all conditions met')
    assert(promptResult.tooFewDives   === false, 'Review prompt should not fire with <5 dives')
    assert(promptResult.noPositive    === false, 'Review prompt should not fire without positive moment')

    await page.screenshot({ path: '/tmp/ss-42-5-review.png' })
    await page.close()
  }

  // ── Test 42.6 — Viral Metrics K-factor ─────────────────────────────────
  console.log('\n=== 42.6 Viral Loop Analytics ===')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('http://localhost:5173')
    await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

    // Verify analyticsService has new events
    const eventsOk = await page.evaluate(async () => {
      const src = await fetch('/src/services/analyticsService.ts').then(r => r.text())
      return (
        src.includes('share_card_generated') &&
        src.includes('referral_link_shared') &&
        src.includes('referral_converted') &&
        src.includes('badge_shared')
      )
    })
    assert(eventsOk, 'analyticsService.ts should contain all 4 new viral event types')

    await page.screenshot({ path: '/tmp/ss-42-6-analytics.png' })
    await page.close()
  }

  console.log(`\n=== Phase 42 Tests ${allPassed ? 'ALL PASSED' : 'SOME FAILED'} ===`)
  await browser.close()
  process.exit(allPassed ? 0 : 1)
})()
```

---

## Verification Gate

All of the following must be true before Phase 42 is marked complete in PROGRESS.md.

### Typecheck
```bash
npm run typecheck
```
Must exit 0 with no new errors. All new `.ts` and `.svelte` files must type-check cleanly.

### Build
```bash
npm run build
```
Must complete without errors. No new chunks should exceed 500 KB.

### Functional Checks

- [ ] **42.1 Canvas render**: `renderShareCard({ template: 'fact_mastery', ... })` returns a PNG data URL whose decoded image dimensions are exactly 1200×630 px.
- [ ] **42.1 Sanitization**: `sanitizeDisplayName('abc\x00def<script>')` returns `'abcdef<script>'` (control chars stripped, HTML not escaped — canvas is safe; HTML escaping is done in 42.3 server-side).
- [ ] **42.1 Share modal**: `ShareCardModal.svelte` renders in the DOM when imported and `previewUrl` is set.
- [ ] **42.2 Tiers**: `REFERRAL_REWARD_TIERS` has exactly 4 entries at thresholds 1, 3, 5, 10.
- [ ] **42.2 Anti-fraud**: `attributeInstall()` returns `null` for duplicate IP within 24 hours.
- [ ] **42.2 Self-referral**: `attributeInstall()` returns `null` when `newPlayerId === referrerId`.
- [ ] **42.3 Badge award**: `evaluateNewBadges()` awards `century_scholar` at exactly ≥100 mastered facts.
- [ ] **42.3 OG tags**: `GET /badge/:playerId/:badgeId` response HTML contains `og:title` meta tag with entity-encoded player name.
- [ ] **42.4 XSS resistance**: `parseDeepLink('terragacha://invite/<script>alert(1)</script>')` returns `{ type: 'unknown' }`.
- [ ] **42.4 Valid invite**: `parseDeepLink('terragacha://invite/VALID-CODE')` returns `{ type: 'invite', code: 'VALID-CODE' }`.
- [ ] **42.5 Cooldown**: `shouldShowReviewPrompt()` returns `false` when `REVIEW_PROMPT_KEY` was set within the last 90 days.
- [ ] **42.5 No-throw**: `fireReviewPrompt()` completes without throwing in a web environment (Capacitor plugin absent).
- [ ] **42.6 Zero-safe**: `computeViralMetrics()` returns `kFactor: 0` when shares count is 0.
- [ ] **42.6 Event coverage**: `analyticsService.ts` defines `share_card_generated`, `referral_link_shared`, `referral_converted`, and `badge_shared` events.

### Visual Checks (screenshot)

Run the Playwright test suite (`node /tmp/test-phase-42.js`), then visually inspect:

- `/tmp/ss-42-1-base.png` — Share card modal visible; card preview renders with game branding
- `/tmp/ss-42-2-referral.png` — Archive room showing referral modal entry point
- `/tmp/ss-42-3-badges.png` — Badge Display area visible in profile
- `/tmp/ss-42-4-deeplinks.png` — No crash; game renders normally when deep link is parsed on startup
- `/tmp/ss-42-5-review.png` — No review prompt visible (conditions not met in test environment)
- `/tmp/ss-42-6-analytics.png` — Game renders normally; no console errors from new analytics events

### Security Checks

- [ ] No `innerHTML` with dynamic content anywhere in new files
- [ ] No `eval()` or `Function()` calls
- [ ] `sanitizeDisplayName()` strips control characters from player name before canvas render
- [ ] Player display name is HTML entity-encoded in all server-rendered HTML (badge OG pages)
- [ ] All deep link parsing uses allowlist regex validation, not blocklist
- [ ] IP addresses are stored only as SHA-256 hashes in `referral_clicks` and `referral_installs`
- [ ] `/badge/:playerId/:badgeId` endpoint validates parameters with `/^[\w-]{1,64}$/` before DB query

---

## Files Affected

### New Files

| Path | Sub-Phase | Description |
|---|---|---|
| `src/services/shareCardService.ts` | 42.1 | Canvas-based share card renderer |
| `src/ui/components/ShareCardModal.svelte` | 42.1 | Share card preview and share/download UI |
| `src/assets/share/` | 42.1 | Directory for card background assets (created but empty; assets loaded at runtime via CSS) |
| `server/src/routes/referrals.ts` | 42.2 | Referral attribution endpoints |
| `server/src/services/referralService.ts` | 42.2 | Server-side referral logic and fraud prevention |
| `server/db/referrals.sql` | 42.2 | Referral schema migrations |
| `src/services/badgeService.ts` | 42.3 | Badge definitions, evaluation, and share URL generation |
| `src/ui/components/BadgeDisplay.svelte` | 42.3 | Badge grid component for profile and hub |
| `server/src/routes/badges.ts` | 42.3 | Badge OG page and SVG image endpoints |
| `src/services/deepLinkService.ts` | 42.4 | Deep link URL parser and Capacitor listener |
| `server/src/routes/deepLinks.ts` | 42.4 | Server-side AASA/assetlinks proxy if needed |
| `public/.well-known/apple-app-site-association` | 42.4 | iOS Universal Links config |
| `public/.well-known/assetlinks.json` | 42.4 | Android App Links config |
| `src/services/reviewPromptService.ts` | 42.5 | In-app review prompt trigger logic |
| `src/ui/components/ReviewPromptTrigger.svelte` | 42.5 | Invisible mount in BaseView, fires prompt |
| `server/src/jobs/asoKeywordTracker.ts` | 42.5 | Nightly ASO keyword rank cron job |
| `server/src/routes/aso.ts` | 42.5 | Admin ASO dashboard endpoint |
| `server/src/analytics/viralMetrics.ts` | 42.6 | K-factor and viral funnel computation |

### Modified Files

| Path | Sub-Phase | Change |
|---|---|---|
| `src/data/balance.ts` | 42.2, 42.5 | Add `REFERRAL_REWARD_TIERS`, `REFERRAL_ATTRIBUTION_DAYS`, `REFERRAL_MAX_PER_YEAR`, `REVIEW_PROMPT_TRIGGERS` |
| `src/data/types.ts` | 42.2, 42.3 | Extend `ReferralRecord`, add `referralStats` and `earnedBadges` to `PlayerSave` |
| `src/ui/components/ReferralModal.svelte` | 42.2 | Add tier progress bar, analytics event on share |
| `src/ui/components/MilestoneCelebration.svelte` | 42.1 | Trigger share card modal at milestones 50/100/200/500 |
| `src/ui/components/DiveResults.svelte` | 42.1 | Trigger share card modal on personal-best layer |
| `src/ui/components/GuildView.svelte` | 42.1 | Trigger share card modal on guild challenge win |
| `src/ui/components/auth/ProfileView.svelte` | 42.3 | Add badge grid section |
| `src/App.svelte` | 42.4 | Register deep link listener on init; route `terra:deeplink` events |
| `src/services/analyticsService.ts` | 42.6 | Add 4 new event type definitions and `track()` calls |
| `server/src/routes/analytics.ts` | 42.6 | Add `/api/analytics/viral` endpoint |
| `src/ui/components/BaseView.svelte` | 42.5 | Mount `ReviewPromptTrigger` and pass positive-moment flag |
