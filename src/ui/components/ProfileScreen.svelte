<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { activeProfile } from '../stores/profileStore'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const save = $derived($playerSave)
  const profileName = $derived($activeProfile?.name ?? 'Explorer')
  const stats = $derived(save?.stats)

  const milestones = $derived((save?.claimedMilestones ?? []).length)
  const totalRuns = $derived(stats?.totalDivesCompleted ?? 0)
  const bestFloor = $derived(stats?.bestFloor ?? 0)
  const factsLearned = $derived(stats?.totalFactsLearned ?? 0)
  const masteredFacts = $derived((save?.reviewStates ?? []).filter((state) => (state.stability ?? state.interval ?? 0) >= 25).length)
  const domainRuns = $derived(
    Object.entries(save?.domainRunCounts ?? {})
      .sort((a, b) => b[1] - a[1])
  )

  function labelDomain(id: string): string {
    try {
      return getDomainMetadata(id as import('../../data/card-types').FactDomain).displayName
    } catch {
      return id.charAt(0).toUpperCase() + id.slice(1).replaceAll('_', ' ')
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onBack()
  }
</script>

{#if $isLandscape}
<!-- LANDSCAPE: two-column layout -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="profile-screen profile-screen-landscape" aria-label="Profile" onkeydown={handleKeydown}>
  <header class="header">
    <h2>Profile</h2>
    <button type="button" class="back" onclick={onBack}>Back</button>
  </header>

  <div class="landscape-columns">
    <!-- Left column: identity + stats -->
    <div class="landscape-left">
      <article class="hero">
        <div class="avatar" aria-hidden="true">👤</div>
        <div>
          <h3>{profileName}</h3>
          <p>All-time run and learning stats</p>
        </div>
      </article>

      <div class="stats-grid stats-grid-landscape">
        <div class="stat"><span>Facts Learned</span><strong>{factsLearned}</strong></div>
        <div class="stat"><span>Mastered Facts</span><strong>{masteredFacts}</strong></div>
        <div class="stat"><span>Runs Completed</span><strong>{totalRuns}</strong></div>
        <div class="stat"><span>Best Floor</span><strong>{bestFloor}</strong></div>
        <div class="stat"><span>Best Streak</span><strong>{stats?.bestStreak ?? 0}</strong></div>
        <div class="stat"><span>Milestones</span><strong>{milestones}</strong></div>
      </div>
    </div>

    <!-- Right column: domain breakdown -->
    <div class="landscape-right">
      {#if domainRuns.length > 0}
        <section class="domain-runs">
          <h4>Runs Per Domain</h4>
          <div class="domain-grid domain-grid-landscape">
            {#each domainRuns as [domain, count] (domain)}
              <div class="domain-item">
                <span>{labelDomain(domain)}</span>
                <strong>{count}</strong>
              </div>
            {/each}
          </div>
        </section>
      {:else}
        <div class="empty-domains">No domain runs recorded yet.</div>
      {/if}
    </div>
  </div>
</section>

{:else}
<!-- PORTRAIT: original layout, pixel-identical -->
<section class="profile-screen" aria-label="Profile">
  <header class="header">
    <h2>Profile</h2>
    <button type="button" class="back" onclick={onBack}>Back</button>
  </header>

  <article class="hero">
    <div class="avatar" aria-hidden="true">👤</div>
    <div>
      <h3>{profileName}</h3>
      <p>All-time run and learning stats</p>
    </div>
  </article>

  <div class="stats-grid">
    <div class="stat"><span>Facts Learned</span><strong>{factsLearned}</strong></div>
    <div class="stat"><span>Mastered Facts</span><strong>{masteredFacts}</strong></div>
    <div class="stat"><span>Runs Completed</span><strong>{totalRuns}</strong></div>
    <div class="stat"><span>Best Floor</span><strong>{bestFloor}</strong></div>
    <div class="stat"><span>Best Streak</span><strong>{stats?.bestStreak ?? 0}</strong></div>
    <div class="stat"><span>Milestones</span><strong>{milestones}</strong></div>
  </div>

  {#if domainRuns.length > 0}
    <section class="domain-runs">
      <h4>Runs Per Domain</h4>
      <div class="domain-grid">
        {#each domainRuns as [domain, count] (domain)}
          <div class="domain-item">
            <span>{labelDomain(domain)}</span>
            <strong>{count}</strong>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</section>
{/if}

<style>
  .profile-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: calc(18px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(96px * var(--layout-scale, 1));
    background: linear-gradient(180deg, #0a1220 0%, #101a2b 100%);
    color: #e2e8f0;
    display: grid;
    gap: calc(14px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h2 {
    margin: 0;
    font-size: calc(22px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .back {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 calc(12px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .hero {
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 14px;
    padding: calc(12px * var(--layout-scale, 1));
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    align-items: center;
    background: rgba(15, 23, 42, 0.78);
  }

  .avatar {
    width: calc(56px * var(--layout-scale, 1));
    height: calc(56px * var(--layout-scale, 1));
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(30, 64, 175, 0.35);
    font-size: calc(28px * var(--layout-scale, 1));
  }

  .hero h3 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
  }

  .hero p {
    margin: calc(2px * var(--layout-scale, 1)) 0 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(10px * var(--layout-scale, 1));
  }

  .stat {
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.76);
    padding: calc(10px * var(--layout-scale, 1));
    display: grid;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .stat span {
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .stat strong {
    font-size: calc(22px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .domain-runs {
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.76);
    padding: calc(10px * var(--layout-scale, 1));
  }

  .domain-runs h4 {
    margin: 0 0 calc(8px * var(--layout-scale, 1));
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .domain-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .domain-item {
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(2, 6, 23, 0.48);
    padding: calc(8px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .domain-item strong {
    color: #f8fafc;
    font-size: calc(14px * var(--text-scale, 1));
  }

  /* ── Landscape Styles ── */

  .profile-screen-landscape {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    padding-bottom: calc(20px * var(--layout-scale, 1));
  }

  .landscape-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(20px * var(--layout-scale, 1));
    overflow: hidden;
    min-height: 0;
  }

  .landscape-left,
  .landscape-right {
    overflow-y: auto;
    display: grid;
    gap: calc(14px * var(--layout-scale, 1));
    align-content: start;
  }

  .stats-grid-landscape {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .domain-grid-landscape {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .empty-domains {
    color: #475569;
    font-size: calc(13px * var(--text-scale, 1));
    text-align: center;
    padding: calc(20px * var(--layout-scale, 1));
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  :global([data-layout="landscape"]) .profile-screen {
    max-width: calc(1600px * var(--layout-scale, 1));
    margin-left: calc(100px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .back {
    display: none;
  }

  /* Stat values */
  :global([data-layout="landscape"]) .stat strong {
    font-size: calc(28px * var(--text-scale, 1));
  }

  /* Small labels */
  :global([data-layout="landscape"]) .stat span {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Body text */
  :global([data-layout="landscape"]) .hero p {
    font-size: calc(15px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .domain-item {
    font-size: calc(15px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .domain-item strong {
    font-size: calc(22px * var(--text-scale, 1));
  }

  /* Stat grid: 3-column with 16px gap */
  :global([data-layout="landscape"]) .stats-grid-landscape {
    grid-template-columns: repeat(3, 1fr);
    gap: calc(16px * var(--layout-scale, 1));
  }

  /* Avatar: larger in landscape */
  :global([data-layout="landscape"]) .avatar {
    width: calc(96px * var(--layout-scale, 1));
    height: calc(96px * var(--layout-scale, 1));
    font-size: calc(48px * var(--text-scale, 1));
  }

  /* Hero title: larger in landscape */
  :global([data-layout="landscape"]) .hero h3 {
    font-size: calc(20px * var(--text-scale, 1));
  }

  /* Empty domains state: styled and centered */
  :global([data-layout="landscape"]) .empty-domains {
    font-size: calc(18px * var(--text-scale, 1));
    font-style: italic;
    color: rgba(255, 255, 255, 0.5);
    margin-top: calc(64px * var(--layout-scale, 1));
    text-align: center;
  }

  :global([data-layout="landscape"]) .stat:hover {
    border-color: rgba(255, 215, 0, 0.3);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(255, 215, 0, 0.1);
    transition: all 150ms ease;
  }

  :global([data-layout="landscape"]) .domain-item:hover {
    background: rgba(15, 23, 42, 0.6);
    border-color: rgba(148, 163, 184, 0.4);
    transition: all 150ms ease;
  }
</style>
