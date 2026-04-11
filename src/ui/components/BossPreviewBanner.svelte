<script lang="ts">
  /**
   * BossPreviewBanner.svelte
   *
   * Slay-the-Spire-style boss-preview banner shown on the dungeon map when the
   * player is approaching the act boss (within 2 rows of BOSS_ROW).
   *
   * Converts the "what happened?!" floor-cliff surprise (BATCH-2026-04-11-ULTRA
   * Cluster A — floor 4→6 3.11× harder, floor 17→18 14× damage spike) into
   * "okay I know what's coming." Mirrors the STS pattern of showing the boss icon
   * + name on the map before the player commits to the boss path.
   *
   * Props:
   *   enemyId   — Phaser sprite ID for the boss (e.g. 'the_algorithm')
   *   enemyName — Display name of the boss (e.g. 'The Algorithm')
   *   enemyDesc — Flavor / ability description (from EnemyTemplate.description)
   *   bossFloor — Floor number of the boss encounter (e.g. 6, 12, 18, 24)
   *
   * See: BATCH-2026-04-11-ULTRA/MASTER-SYNTHESIS.md Cluster A + F
   *      data/playtests/llm-batches/BATCH-2026-04-11-ULTRA-WAVE-A/WAVE-A-REPORT.md
   *      docs/ui/screens.md (dungeonMap)
   *      docs/mechanics/progression.md (Segments and Boss Floors)
   */
  interface Props {
    enemyId: string
    enemyName: string
    enemyDesc: string
    bossFloor: number
  }

  let { enemyId, enemyName, enemyDesc, bossFloor }: Props = $props()

  /** Silhouette sprite path — same as map node boss sprite. */
  let spriteUrl = $derived(`assets/sprites/enemies/${enemyId}_idle.webp`)
</script>

<div class="boss-preview-banner" data-testid="boss-preview-banner" role="status" aria-live="polite">
  <div class="boss-silhouette" aria-hidden="true">
    <img
      class="boss-sprite"
      src={spriteUrl}
      alt={enemyName}
      onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
    />
  </div>
  <div class="boss-info">
    <div class="boss-label">ACT BOSS — FLOOR {bossFloor}</div>
    <div class="boss-name">{enemyName}</div>
    <div class="boss-desc">{enemyDesc}</div>
  </div>
</div>

<style>
  /* =========================================================
     Boss Preview Banner
     Positioned in the map header area, right of the segment title.
     On landscape: shown as a compact horizontal bar at the top.
     On portrait: shown below the segment title.
     BATCH-ULTRA Cluster A — floor cliff telegraph affordance.
     ========================================================= */
  .boss-preview-banner {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(30, 10, 10, 0.85);
    border: 1px solid rgba(192, 57, 43, 0.55);
    border-radius: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
    /* Animate in from top on first show */
    animation: bannerReveal 0.4s ease-out;
    min-width: calc(180px * var(--layout-scale, 1));
    max-width: calc(340px * var(--layout-scale, 1));
  }

  @keyframes bannerReveal {
    from { opacity: 0; transform: translateY(calc(-8px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ---- Silhouette ---- */
  .boss-silhouette {
    flex-shrink: 0;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .boss-sprite {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* Desaturated red silhouette effect — matches StS boss preview style */
    filter: brightness(0.35) saturate(0.6) sepia(0.5) hue-rotate(-20deg) contrast(1.2);
  }

  /* ---- Text info ---- */
  .boss-info {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .boss-label {
    font-family: monospace;
    font-size: calc(9px * var(--text-scale, 1));
    color: #c0392b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    white-space: nowrap;
  }

  .boss-name {
    font-family: monospace;
    font-size: calc(13px * var(--text-scale, 1));
    color: #f1f5f9;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .boss-desc {
    font-family: monospace;
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
    line-height: 1.35;
    /* Clamp to 2 lines on small viewports */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
</style>
