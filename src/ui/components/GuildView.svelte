<script lang="ts">
  import type { GuildInfo, GuildChallenge } from '../../data/types'
  import { ApiError } from '../../services/apiClient'
  import { guildService, type GuildRecord } from '../../services/guildService'

  interface GuildMember {
    playerId: string
    displayName: string
    role: 'leader' | 'officer' | 'member'
    weeklyContribution: number
    lastActive: string
  }

  interface GuildSearchResult {
    id: string
    name: string
    tag: string
    rank: number
    memberCount: number
    maxMembers: number
    isOpen: boolean
    description: string
  }

  interface ApiGuildMember {
    userId: string
    displayName: string | null
    role: 'leader' | 'officer' | 'member'
    joinedAt: number
  }

  interface ApiGuildChallenge {
    id: string
    title: string
    targetCount: number
    currentCount: number
    completedAt: number | null
  }

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  const GUILD_EMBLEMS = ['🛡️', '⚔️', '🔮', '🌟', '🏰', '🐉', '🌿', '🔥', '💎', '🌊', '🦅', '🐺', '🌙', '☀️', '⚡', '🍀', '🔱', '🎭', '🗝️', '🧭']

  type Tab = 'my-guild' | 'find-guilds' | 'create-guild'

  // Mock: whether the player has a guild (would come from player save)
  let hasGuild = $state(false)
  let activeTab = $state<Tab>('find-guilds')

  // My guild data
  let myGuild = $state<GuildInfo | null>(null)
  let members = $state<GuildMember[]>([])
  let challenges = $state<GuildChallenge[]>([])
  let topContributors = $state<GuildMember[]>([])
  let loadingGuild = $state(false)

  // Find guilds
  let searchQuery = $state('')
  let searchResults = $state<GuildSearchResult[]>([])
  let searchLoading = $state(false)

  // Create guild form
  let createName = $state('')
  let createTag = $state('')
  let createEmblem = $state(0)
  let createDescription = $state('')
  let createLoading = $state(false)
  let createError = $state('')
  let createSuccess = $state(false)

  let errorMessage = $state('')
  let didBootstrap = $state(false)

  function emblemIndex(emblemId: string): number {
    const parsed = Number.parseInt(emblemId, 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed % GUILD_EMBLEMS.length
    let hash = 0
    for (let i = 0; i < emblemId.length; i += 1) {
      hash = ((hash << 5) - hash) + emblemId.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash) % GUILD_EMBLEMS.length
  }

  function guildRank(gkp: number): number {
    return Math.max(1, Math.floor(gkp / 1000) + 1)
  }

  function mapApiGuild(guild: GuildRecord): {
    guildInfo: GuildInfo
    mappedMembers: GuildMember[]
    mappedChallenges: GuildChallenge[]
  } {
    const mappedMembers: GuildMember[] = guild.members.map((member) => ({
      playerId: member.userId,
      displayName: member.displayName ?? `Rogue-${member.userId.slice(0, 6)}`,
      role: member.role,
      weeklyContribution: 0,
      lastActive: new Date(member.joinedAt).toISOString(),
    }))
    const mappedChallenges: GuildChallenge[] = guild.challenges.map((challenge) => ({
      id: challenge.id,
      challengeType: challenge.title,
      target: challenge.targetCount,
      progress: challenge.currentCount,
      isCompleted: challenge.completedAt !== null,
      weekStart: challenge.completedAt ?? Date.now(),
    }))
    return {
      guildInfo: {
        id: guild.id,
        name: guild.name,
        tag: guild.tag,
        emblemId: emblemIndex(guild.emblemId),
        rank: guildRank(guild.gkp),
        gkp: guild.gkp,
        memberCount: guild.members.length,
        isOpen: guild.open,
        description: guild.description,
      },
      mappedMembers,
      mappedChallenges,
    }
  }

  async function bootstrapGuildState(): Promise<void> {
    try {
      const guild = await guildService.getMyGuild()
      const mapped = mapApiGuild(guild)
      hasGuild = true
      myGuild = mapped.guildInfo
      members = mapped.mappedMembers
      challenges = mapped.mappedChallenges
      topContributors = [...members]
        .sort((a, b) => b.weeklyContribution - a.weeklyContribution)
        .slice(0, 5)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        hasGuild = false
        myGuild = null
        members = []
        challenges = []
        topContributors = []
        if (activeTab === 'my-guild') activeTab = 'find-guilds'
        return
      }
      // Ignore bootstrap failures; search/create tabs can still be used.
    }
  }

  async function loadMyGuild(): Promise<void> {
    loadingGuild = true
    errorMessage = ''
    try {
      const guild = await guildService.getMyGuild()
      const mapped = mapApiGuild(guild)
      hasGuild = true
      myGuild = mapped.guildInfo
      members = mapped.mappedMembers
      challenges = mapped.mappedChallenges
      topContributors = [...members]
        .sort((a, b) => b.weeklyContribution - a.weeklyContribution)
        .slice(0, 5)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to load guild'
    } finally {
      loadingGuild = false
    }
  }

  async function searchGuilds(): Promise<void> {
    const trimmed = searchQuery.trim()
    if (trimmed.length === 0) {
      searchResults = []
      return
    }
    searchLoading = true
    errorMessage = ''
    try {
      const data = await guildService.search(trimmed)
      searchResults = data.map((guild) => ({
        id: guild.id,
        name: guild.name,
        tag: guild.tag,
        rank: guildRank(guild.gkp),
        memberCount: guild.memberCount,
        maxMembers: guild.maxMembers,
        isOpen: guild.open,
        description: guild.description,
      }))
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Search failed'
      searchResults = []
    } finally {
      searchLoading = false
    }
  }

  async function joinGuild(guildId: string): Promise<void> {
    try {
      await guildService.joinGuild(guildId)
      hasGuild = true
      activeTab = 'my-guild'
      await loadMyGuild()
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to join guild'
    }
  }

  async function createGuild(): Promise<void> {
    if (!createName.trim() || createName.length < 2 || createName.length > 30) {
      createError = 'Guild name must be 2–30 characters.'
      return
    }
    if (!createTag.trim() || createTag.length < 2 || createTag.length > 4) {
      createError = 'Tag must be 2–4 characters.'
      return
    }
    createLoading = true
    createError = ''
    try {
      await guildService.createGuild({
        name: createName.trim(),
        tag: createTag.trim().toUpperCase(),
        emblemId: String(createEmblem),
        description: createDescription.trim(),
      })
      createSuccess = true
      hasGuild = true
      activeTab = 'my-guild'
      await loadMyGuild()
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create guild'
    } finally {
      createLoading = false
    }
  }

  function handleSearchInput(e: Event): void {
    searchQuery = (e.target as HTMLInputElement).value
  }

  function handleSearchKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') searchGuilds()
  }

  function rankLabel(rank: number): string {
    if (rank >= 9) return 'Legendary'
    if (rank >= 7) return 'Diamond'
    if (rank >= 5) return 'Gold'
    if (rank >= 3) return 'Silver'
    return 'Bronze'
  }

  function rankColor(rank: number): string {
    if (rank >= 9) return '#f43f5e'
    if (rank >= 7) return '#60a5fa'
    if (rank >= 5) return '#fbbf24'
    if (rank >= 3) return '#9ca3af'
    return '#92400e'
  }

  function roleLabel(role: string): string {
    const m: Record<string, string> = { leader: 'Leader', officer: 'Officer', member: 'Member' }
    return m[role] ?? role
  }

  function roleColor(role: string): string {
    if (role === 'leader') return '#f59e0b'
    if (role === 'officer') return '#60a5fa'
    return '#64748b'
  }

  function gkpToNextRank(gkp: number): number {
    return Math.ceil(gkp / 1000) * 1000
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  $effect(() => {
    if (!didBootstrap) {
      didBootstrap = true
      void bootstrapGuildState()
    }
    if (activeTab === 'my-guild' && hasGuild && !myGuild) loadMyGuild()
    if (activeTab === 'find-guilds' && searchQuery.trim().length > 0 && searchResults.length === 0 && !searchLoading) searchGuilds()
  })
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Guild"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
>
  <div class="modal" role="document">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Guild</h2>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close guild view">✕</button>
    </div>

    <!-- Tabs -->
    <div class="tabs" role="tablist" aria-label="Guild sections">
      {#if hasGuild}
        <button
          class="tab"
          class:tab-active={activeTab === 'my-guild'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'my-guild'}
          onclick={() => { activeTab = 'my-guild' }}
        >My Guild</button>
      {/if}
      <button
        class="tab"
        class:tab-active={activeTab === 'find-guilds'}
        type="button"
        role="tab"
        aria-selected={activeTab === 'find-guilds'}
        onclick={() => { activeTab = 'find-guilds' }}
      >Find Guilds</button>
      {#if !hasGuild}
        <button
          class="tab"
          class:tab-active={activeTab === 'create-guild'}
          type="button"
          role="tab"
          aria-selected={activeTab === 'create-guild'}
          onclick={() => { activeTab = 'create-guild' }}
        >Create Guild</button>
      {/if}
    </div>

    {#if errorMessage}
      <div class="error-banner" role="alert">{errorMessage}</div>
    {/if}

    <div class="tab-content">

      <!-- ===== MY GUILD ===== -->
      {#if activeTab === 'my-guild'}
        {#if loadingGuild}
          <div class="state-msg" role="status" aria-live="polite">Loading guild...</div>
        {:else if myGuild}
          <!-- Guild header -->
          <div class="guild-header-card" aria-label="Guild overview">
            <div class="guild-emblem" aria-hidden="true">{GUILD_EMBLEMS[myGuild.emblemId] ?? '🛡️'}</div>
            <div class="guild-info">
              <div class="guild-name-row">
                <span class="guild-name">{myGuild.name}</span>
                <span class="guild-tag">[{myGuild.tag}]</span>
                <span
                  class="rank-badge"
                  style="background: {rankColor(myGuild.rank)}22; color: {rankColor(myGuild.rank)}; border-color: {rankColor(myGuild.rank)}66;"
                >{rankLabel(myGuild.rank)}</span>
              </div>
              <p class="guild-desc">{myGuild.description}</p>
              <div class="gkp-row" aria-label="Guild Knowledge Points progress">
                <span class="gkp-label">GKP: {myGuild.gkp} / {gkpToNextRank(myGuild.gkp)}</span>
                <div class="gkp-bar" role="progressbar" aria-valuenow={myGuild.gkp} aria-valuemax={gkpToNextRank(myGuild.gkp)}>
                  <div
                    class="gkp-fill"
                    style="width: {Math.min(100, (myGuild.gkp % 1000) / 10)}%"
                  ></div>
                </div>
              </div>
              {#if myGuild.primaryFocus}
                <span class="primary-focus" aria-label="Primary focus: {myGuild.primaryFocus}">Focus: {myGuild.primaryFocus}</span>
              {/if}
              <span class="member-count">{myGuild.memberCount}/30 members</span>
              {#if myGuild.guildXp != null}
                <span class="guild-xp-label" aria-label="Guild XP: {myGuild.guildXp}">Guild XP: {myGuild.guildXp}</span>
              {/if}
            </div>
          </div>

          <!-- Phase 56: Branch Completion Progress -->
          {#if myGuild.branchCompletion && Object.keys(myGuild.branchCompletion).length > 0}
            <h3 class="section-title">Branch Completion</h3>
            <div class="branch-list" aria-label="Knowledge branch completion">
              {#each Object.entries(myGuild.branchCompletion) as [branch, pct]}
                <div class="branch-row" aria-label="{branch}: {pct}%">
                  <span class="branch-name">{branch}</span>
                  <div class="branch-bar" role="progressbar" aria-valuenow={pct} aria-valuemax={100}>
                    <div class="branch-fill" style="width: {Math.min(100, pct)}%"></div>
                  </div>
                  <span class="branch-pct">{pct}%</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Weekly Challenges -->
          <h3 class="section-title">Weekly Challenges</h3>
          {#if challenges.length === 0}
            <div class="state-msg">No active challenges.</div>
          {:else}
            <div class="challenges-list" aria-label="Weekly guild challenges">
              {#each challenges.slice(0, 3) as challenge}
                <div class="challenge-card" aria-label="{challenge.challengeType}: {challenge.progress}/{challenge.target}">
                  <div class="challenge-info">
                    <span class="challenge-type">{challenge.challengeType}</span>
                    <span class="challenge-progress">{challenge.progress}/{challenge.target}</span>
                  </div>
                  <div
                    class="challenge-bar"
                    role="progressbar"
                    aria-valuenow={challenge.progress}
                    aria-valuemax={challenge.target}
                  >
                    <div
                      class="challenge-fill"
                      class:challenge-complete={challenge.isCompleted}
                      style="width: {Math.min(100, (challenge.progress / challenge.target) * 100)}%"
                    ></div>
                  </div>
                  {#if challenge.isCompleted}
                    <span class="completed-badge" aria-label="Completed">✓ Complete</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Top Contributors -->
          <h3 class="section-title">Top Contributors This Week</h3>
          {#if topContributors.length === 0}
            <div class="state-msg">No contributions yet.</div>
          {:else}
            <div class="contributors-list" aria-label="Top weekly contributors">
              {#each topContributors as member, idx}
                <div class="contributor-row" aria-label="{member.displayName}: {member.weeklyContribution} GKP">
                  <span class="contributor-rank" aria-hidden="true">#{idx + 1}</span>
                  <span class="contributor-name">{member.displayName}</span>
                  <span
                    class="contributor-role"
                    style="color: {roleColor(member.role)}"
                  >{roleLabel(member.role)}</span>
                  <span class="contributor-gkp">{member.weeklyContribution} GKP</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- All Members -->
          <h3 class="section-title">Members ({members.length}/30)</h3>
          <div class="members-list" aria-label="Guild members">
            {#each members as member}
              <div class="member-row" aria-label="{member.displayName}, {roleLabel(member.role)}">
                <span class="member-name">{member.displayName}</span>
                <span
                  class="member-role"
                  style="color: {roleColor(member.role)}"
                >{roleLabel(member.role)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="state-msg">No guild data available.</div>
        {/if}
      {/if}

      <!-- ===== FIND GUILDS ===== -->
      {#if activeTab === 'find-guilds'}
        <div class="search-row">
          <input
            class="search-input"
            type="search"
            placeholder="Search guilds..."
            value={searchQuery}
            oninput={handleSearchInput}
            onkeydown={handleSearchKeydown}
            aria-label="Search guilds by name"
          />
          <button
            class="btn-search"
            type="button"
            onclick={searchGuilds}
            aria-label="Search"
          >Search</button>
        </div>

        {#if searchLoading}
          <div class="state-msg" role="status" aria-live="polite">Searching...</div>
        {:else if searchResults.length === 0}
          <div class="state-msg">No guilds found. Try a different search.</div>
        {:else}
          <div class="guilds-list" aria-label="Guild search results">
            {#each searchResults as guild}
              <div class="guild-result-card" aria-label="{guild.name} [{guild.tag}]">
                <div class="guild-result-info">
                  <div class="guild-result-name-row">
                    <span class="guild-name">{guild.name}</span>
                    <span class="guild-tag">[{guild.tag}]</span>
                    <span
                      class="rank-badge"
                      style="background: {rankColor(guild.rank)}22; color: {rankColor(guild.rank)}; border-color: {rankColor(guild.rank)}66;"
                    >{rankLabel(guild.rank)}</span>
                  </div>
                  <p class="guild-desc">{guild.description}</p>
                  <span class="member-count">{guild.memberCount}/{guild.maxMembers} members</span>
                </div>
                {#if guild.isOpen}
                  <button
                    class="btn-join"
                    type="button"
                    onclick={() => joinGuild(guild.id)}
                    aria-label="Join {guild.name}"
                  >Join</button>
                {:else}
                  <span class="closed-badge" aria-label="Guild is closed">Closed</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- ===== CREATE GUILD ===== -->
      {#if activeTab === 'create-guild'}
        {#if createSuccess}
          <div class="success-panel" role="status" aria-live="polite">
            <span class="success-icon" aria-hidden="true">🏰</span>
            <p class="success-msg">Guild created successfully!</p>
          </div>
        {:else}
          <div class="create-form" aria-label="Create guild form">
            {#if createError}
              <div class="error-banner" role="alert">{createError}</div>
            {/if}

            <div class="form-field">
              <label class="form-label" for="guild-name">Guild Name <span class="req">*</span></label>
              <input
                id="guild-name"
                class="form-input"
                type="text"
                placeholder="2–30 characters"
                maxlength={30}
                bind:value={createName}
                aria-required="true"
                aria-label="Guild name, 2 to 30 characters"
              />
              <span class="char-count" aria-live="polite">{createName.length}/30</span>
            </div>

            <div class="form-field">
              <label class="form-label" for="guild-tag">Tag <span class="req">*</span></label>
              <input
                id="guild-tag"
                class="form-input tag-input"
                type="text"
                placeholder="2–4 chars"
                maxlength={4}
                bind:value={createTag}
                aria-required="true"
                aria-label="Guild tag, 2 to 4 characters"
              />
            </div>

            <div class="form-field">
              <span class="form-label">Emblem</span>
              <div class="emblem-grid" role="radiogroup" aria-label="Choose guild emblem">
                {#each GUILD_EMBLEMS as emblem, idx}
                  <button
                    class="emblem-btn"
                    class:emblem-selected={createEmblem === idx}
                    type="button"
                    role="radio"
                    aria-checked={createEmblem === idx}
                    aria-label="Emblem {idx + 1}: {emblem}"
                    onclick={() => { createEmblem = idx }}
                  >{emblem}</button>
                {/each}
              </div>
            </div>

            <div class="form-field">
              <label class="form-label" for="guild-description">Description</label>
              <textarea
                id="guild-description"
                class="form-textarea"
                placeholder="Describe your guild... (max 500 chars)"
                maxlength={500}
                bind:value={createDescription}
                rows={3}
                aria-label="Guild description, optional, max 500 characters"
              ></textarea>
              <span class="char-count" aria-live="polite">{createDescription.length}/500</span>
            </div>

            <button
              class="btn-create"
              type="button"
              disabled={createLoading}
              onclick={createGuild}
              aria-label="Create guild"
            >
              {createLoading ? 'Creating...' : 'Create Guild'}
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
    pointer-events: auto;
    padding: 16px;
  }

  .modal {
    background: #16213e;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    width: 100%;
    max-width: 540px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e2e8f0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f59e0b44;
    background: #1a1a2e;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f59e0b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: color 0.12s;
  }

  .close-btn:hover { color: #e2e8f0; }
  .close-btn:active { transform: translateY(1px); }

  .tabs {
    display: flex;
    border-bottom: 1px solid #f59e0b44;
    flex-shrink: 0;
    background: #1a1a2e;
  }

  .tab {
    flex: 1;
    padding: 10px 6px;
    background: transparent;
    border: 0;
    border-bottom: 3px solid transparent;
    color: #64748b;
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: color 0.12s, border-color 0.12s;
  }

  .tab:hover { color: #94a3b8; }
  .tab-active { color: #f59e0b; border-bottom-color: #f59e0b; }

  .error-banner {
    background: #7f1d1d;
    border-bottom: 1px solid #ef4444;
    color: #fca5a5;
    font-size: 0.78rem;
    padding: 8px 16px;
    flex-shrink: 0;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Guild header card */
  .guild-header-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    gap: 12px;
  }

  .guild-emblem {
    font-size: 2.4rem;
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    background: #1e293b;
    border-radius: 10px;
  }

  .guild-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .guild-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .guild-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f59e0b;
  }

  .guild-tag {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .rank-badge {
    border-radius: 999px;
    border: 1px solid;
    padding: 2px 8px;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .guild-desc {
    font-size: 0.73rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .gkp-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 4px;
  }

  .gkp-label {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  .gkp-bar {
    background: #1e293b;
    border-radius: 4px;
    height: 6px;
    overflow: hidden;
  }

  .gkp-fill {
    background: #f59e0b;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .member-count {
    font-size: 0.68rem;
    color: #64748b;
  }

  .guild-xp-label {
    font-size: 0.68rem;
    color: #f59e0b;
    font-weight: 700;
  }

  /* Section titles */
  .section-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 4px 0 0;
  }

  /* Challenges */
  .challenges-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .challenge-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }

  .challenge-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .challenge-type {
    font-size: 0.78rem;
    color: #e2e8f0;
    font-weight: 600;
  }

  .challenge-progress {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 700;
  }

  .challenge-bar {
    background: #1e293b;
    border-radius: 4px;
    height: 6px;
    overflow: hidden;
  }

  .challenge-fill {
    background: #3b82f6;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .challenge-complete { background: #22c55e; }

  .completed-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: #4ade80;
    align-self: flex-start;
  }

  /* Contributors */
  .contributors-list, .members-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .contributor-row, .member-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0f172a;
    border-radius: 8px;
    padding: 8px 10px;
  }

  .contributor-rank {
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    width: 22px;
    flex-shrink: 0;
    text-align: center;
  }

  .contributor-name, .member-name {
    font-size: 0.78rem;
    color: #cbd5e1;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .contributor-role, .member-role {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  .contributor-gkp {
    font-size: 0.72rem;
    font-weight: 700;
    color: #f59e0b;
    flex-shrink: 0;
  }

  /* Find guilds */
  .search-row {
    display: flex;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.82rem;
    padding: 9px 12px;
  }

  .search-input::placeholder { color: #475569; }
  .search-input:focus { outline: 2px solid #f59e0b; outline-offset: -2px; }

  .btn-search {
    background: #f59e0b;
    border: 0;
    border-radius: 8px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 9px 16px;
    cursor: pointer;
    transition: background 0.12s;
    flex-shrink: 0;
  }

  .btn-search:hover { background: #fbbf24; }
  .btn-search:active { transform: translateY(1px); }

  .guilds-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .guild-result-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .guild-result-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .guild-result-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .btn-join {
    background: #16a34a;
    border: 0;
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 8px 14px;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .btn-join:hover { background: #22c55e; }
  .btn-join:active { transform: translateY(1px); }

  .closed-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: #64748b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 5px 8px;
    flex-shrink: 0;
    text-transform: uppercase;
  }

  /* Create guild form */
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .form-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .req { color: #ef4444; }

  .form-input, .form-textarea {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e2e8f0;
    font-family: inherit;
    font-size: 0.85rem;
    padding: 9px 12px;
    transition: border-color 0.12s;
    resize: vertical;
  }

  .form-input:focus, .form-textarea:focus {
    outline: none;
    border-color: #f59e0b;
  }

  .form-input::placeholder, .form-textarea::placeholder { color: #475569; }

  .tag-input { text-transform: uppercase; width: 100px; }

  .char-count {
    font-size: 0.65rem;
    color: #475569;
    align-self: flex-end;
  }

  .emblem-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 6px;
  }

  .emblem-btn {
    background: #0f172a;
    border: 2px solid #334155;
    border-radius: 8px;
    font-size: 1.1rem;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    padding: 0;
  }

  .emblem-btn:hover { border-color: #f59e0b; }
  .emblem-btn:active { transform: translateY(1px); }

  .emblem-selected {
    border-color: #f59e0b;
    background: #f59e0b1a;
  }

  .btn-create {
    background: #f59e0b;
    border: 0;
    border-radius: 10px;
    color: #1a1a2e;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 12px;
    cursor: pointer;
    letter-spacing: 1px;
    text-transform: uppercase;
    transition: background 0.12s;
    margin-top: 4px;
  }

  .btn-create:hover { background: #fbbf24; }
  .btn-create:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
  .btn-create:active:not(:disabled) { transform: translateY(1px); }

  /* Success panel */
  .success-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 20px;
  }

  .success-icon { font-size: 2.5rem; }

  .success-msg {
    font-size: 0.9rem;
    color: #e2e8f0;
    text-align: center;
    margin: 0;
  }

  .state-msg {
    text-align: center;
    color: #64748b;
    font-size: 0.82rem;
    padding: 20px 0;
  }

  /* Phase 56: Primary focus */
  .primary-focus {
    font-size: 0.68rem;
    color: #60a5fa;
    font-weight: 600;
  }

  /* Phase 56: Branch completion */
  .branch-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .branch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0f172a;
    border-radius: 6px;
    padding: 6px 10px;
  }

  .branch-name {
    font-size: 0.72rem;
    color: #cbd5e1;
    min-width: 80px;
    flex-shrink: 0;
  }

  .branch-bar {
    flex: 1;
    background: #1e293b;
    border-radius: 4px;
    height: 6px;
    overflow: hidden;
  }

  .branch-fill {
    background: #3b82f6;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .branch-pct {
    font-size: 0.68rem;
    font-weight: 700;
    color: #60a5fa;
    min-width: 30px;
    text-align: right;
  }

  @media (max-width: 480px) {
    .emblem-grid { grid-template-columns: repeat(5, 1fr); }
    .modal-title { font-size: 0.85rem; }
  }
</style>
