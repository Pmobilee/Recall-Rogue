<script lang="ts">
  /**
   * PendingNextStepsOverlay — dev-only ambient text overlay on the Hub.
   *
   * Reads `.claude/pending-next-steps.json` (written by the
   * `persist-whats-next.sh` Stop hook at session end) via the dev-server
   * endpoint `/__rr_pending_next_steps.json` and renders the top 1–3
   * `## What's Next` items as low-opacity corner text.
   *
   * Closes the loop between session-end persistence and the developer
   * actually noticing the prior session's reminders without invoking
   * `/catchup`.
   *
   * GATING: Caller MUST wrap this component in `{#if $devMode}` —
   * see `.claude/rules/ui-layout.md` § "Dev-only UI Gating". The component
   * also self-tags every rendered DOM element with `data-dev-only="true"`
   * for assertion-based tests that verify absence in non-dev mode.
   *
   * STATES (per `.claude/rules/ui-layout.md` § Softlock Prevention):
   *   - loading      → spinner-style placeholder + dismiss button
   *   - empty/missing→ "No pending next-steps from previous session" + dismiss
   *   - error        → "Failed to load…" + dismiss
   *   - populated    → top 1-3 subjects + dismiss
   *
   * Dismiss state is local component state (resets on page reload).
   */

  import { onMount } from 'svelte'

  /** Shape returned by /__rr_pending_next_steps.json (see persist-whats-next.sh). */
  interface PendingItem {
    raw: string
    subject: string
    description: string
  }
  interface PendingPayload {
    generated: string
    source: string
    items: PendingItem[]
  }

  /** Number of items to show in the overlay; truncate to keep it ambient. */
  const MAX_ITEMS = 3
  /** Truncate long subjects so the overlay never grows past a sane width. */
  const MAX_SUBJECT_CHARS = 60

  type Status = 'loading' | 'ready' | 'empty' | 'error'

  let status = $state<Status>('loading')
  let items = $state<PendingItem[]>([])
  let generatedAt = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)
  let dismissed = $state(false)

  function truncate(s: string, n: number): string {
    if (s.length <= n) return s
    return s.slice(0, Math.max(0, n - 1)).trimEnd() + '…'
  }

  function formatGenerated(iso: string | null): string {
    if (!iso) return ''
    // Show as YYYY-MM-DD HH:mm UTC; if parsing fails, show raw.
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      const yyyy = d.getUTCFullYear()
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mi = String(d.getUTCMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}Z`
    } catch {
      return iso
    }
  }

  async function load() {
    status = 'loading'
    errorMessage = null
    try {
      const res = await fetch('/__rr_pending_next_steps.json', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const payload = (await res.json()) as PendingPayload | null
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        items = []
        generatedAt = payload?.generated ?? null
        status = 'empty'
        return
      }
      items = payload.items.slice(0, MAX_ITEMS)
      generatedAt = payload.generated ?? null
      status = 'ready'
    } catch (err) {
      console.warn('[PendingNextStepsOverlay] failed to load pending next-steps:', err)
      errorMessage = err instanceof Error ? err.message : String(err)
      status = 'error'
    }
  }

  onMount(() => {
    void load()
  })

  function handleDismiss() {
    dismissed = true
  }

  function handleRefresh() {
    void load()
  }
</script>

{#if !dismissed}
  <aside
    class="pending-next-steps-overlay"
    data-dev-only="true"
    data-testid="pending-next-steps-overlay"
    aria-label="Pending next-steps from previous session"
  >
    <header class="pns-header" data-dev-only="true">
      <span class="pns-title">What's Next (prior session)</span>
      <div class="pns-actions" data-dev-only="true">
        <button
          type="button"
          class="pns-btn"
          data-dev-only="true"
          data-testid="pending-next-steps-refresh"
          aria-label="Reload pending next-steps"
          onclick={handleRefresh}
          title="Reload"
        >
          ↻
        </button>
        <button
          type="button"
          class="pns-btn pns-btn-close"
          data-dev-only="true"
          data-testid="pending-next-steps-dismiss"
          aria-label="Dismiss pending next-steps overlay"
          onclick={handleDismiss}
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </header>

    {#if status === 'loading'}
      <p class="pns-msg" data-dev-only="true" data-testid="pending-next-steps-loading">
        Loading…
      </p>
    {:else if status === 'error'}
      <p class="pns-msg pns-msg-error" data-dev-only="true" data-testid="pending-next-steps-error">
        Failed to load: {errorMessage ?? 'unknown error'}
      </p>
    {:else if status === 'empty'}
      <p class="pns-msg" data-dev-only="true" data-testid="pending-next-steps-empty">
        No pending next-steps from previous session.
      </p>
    {:else}
      <ol class="pns-list" data-dev-only="true" data-testid="pending-next-steps-list">
        {#each items as item, idx (idx)}
          <li class="pns-item" data-dev-only="true" title={item.description}>
            <span class="pns-index">{idx + 1}.</span>
            <span class="pns-subject">{truncate(item.subject, MAX_SUBJECT_CHARS)}</span>
          </li>
        {/each}
      </ol>
      {#if generatedAt}
        <p class="pns-footer" data-dev-only="true">
          {formatGenerated(generatedAt)}
        </p>
      {/if}
    {/if}
  </aside>
{/if}

<style>
  /*
   * All sizing uses calc(Npx * var(--layout-scale, 1)) per
   * .claude/rules/ui-layout.md § Dynamic Scaling. Font sizes use
   * var(--text-scale, 1). Hardcoded px exceptions allowed:
   * 1px borders, 0 values, percentages, opacity, z-index.
   */
  .pending-next-steps-overlay {
    position: fixed;
    top: calc(72px * var(--layout-scale, 1));
    right: calc(16px * var(--layout-scale, 1));
    z-index: 95; /* above hub layers, below modals (CampUpgradeModal is z>=100) */
    max-width: calc(360px * var(--layout-scale, 1));
    min-width: calc(220px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(8, 12, 20, 0.62);
    color: rgba(220, 230, 245, 0.92);
    border: 1px solid rgba(120, 180, 230, 0.32);
    border-radius: calc(6px * var(--layout-scale, 1));
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: calc(12px * var(--text-scale, 1));
    line-height: 1.4;
    opacity: 0.78;
    pointer-events: auto; /* dismiss/refresh need clicks; rest of hub still receives events outside */
    user-select: none;
    transition: opacity 120ms ease-out;
  }

  .pending-next-steps-overlay:hover {
    opacity: 0.95;
  }

  .pns-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(6px * var(--layout-scale, 1));
  }

  .pns-title {
    font-weight: 600;
    font-size: calc(11px * var(--text-scale, 1));
    text-transform: uppercase;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    color: rgba(180, 210, 240, 0.95);
  }

  .pns-actions {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .pns-btn {
    /* Min tap target 44x44 per ui-layout.md, but this is dev-only utility UI;
       we keep it compact intentionally. */
    min-width: calc(22px * var(--layout-scale, 1));
    min-height: calc(22px * var(--layout-scale, 1));
    padding: 0 calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    color: rgba(230, 240, 250, 0.85);
    border: 1px solid rgba(180, 200, 230, 0.25);
    border-radius: calc(3px * var(--layout-scale, 1));
    font-family: inherit;
    font-size: calc(13px * var(--text-scale, 1));
    line-height: 1;
    cursor: pointer;
    transition: background 100ms ease-out, border-color 100ms ease-out;
  }

  .pns-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(180, 200, 230, 0.5);
  }

  .pns-btn-close {
    color: rgba(255, 200, 200, 0.9);
  }

  .pns-msg {
    margin: 0;
    padding: calc(2px * var(--layout-scale, 1)) 0;
    font-style: italic;
    color: rgba(200, 215, 235, 0.78);
  }

  .pns-msg-error {
    color: rgba(255, 180, 180, 0.92);
    font-style: normal;
  }

  .pns-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .pns-item {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    align-items: baseline;
  }

  .pns-index {
    flex-shrink: 0;
    color: rgba(150, 190, 230, 0.75);
    font-weight: 600;
  }

  .pns-subject {
    flex: 1 1 auto;
    word-break: break-word;
    color: rgba(225, 235, 245, 0.95);
  }

  .pns-footer {
    margin: calc(6px * var(--layout-scale, 1)) 0 0 0;
    padding-top: calc(4px * var(--layout-scale, 1));
    border-top: 1px solid rgba(120, 180, 230, 0.18);
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(160, 180, 210, 0.6);
    text-align: right;
  }
</style>
