<script lang="ts">
  import { onMount } from 'svelte'
  import { authStore } from '../stores/authStore'
  import { playerSave } from '../stores/playerData'
  import { parentalStore } from '../stores/parentalStore'
  import {
    getDailyExpeditionStatus,
    getDailyExpeditionGlobalLeaderboard,
    type DailyExpeditionStatus,
  } from '../../services/dailyExpeditionService'
  import {
    getEndlessDepthsLeaderboard,
    getEndlessDepthsGlobalLeaderboard,
    type EndlessDepthsEntry,
  } from '../../services/endlessDepthsService'
  import {
    getScholarChallengeStatus,
    getScholarChallengeGlobalLeaderboard,
    type ScholarChallengeStatus,
  } from '../../services/scholarChallengeService'
  import { createLobby } from '../../services/coopService'
  import { scoreSubmissionQueueStatus } from '../../services/scoreSubmissionQueue'
  import WeeklyChallenge from './WeeklyChallenge.svelte'
  import CoopLobby from './CoopLobby.svelte'
  import DuelView from './DuelView.svelte'
  import GuildView from './GuildView.svelte'

  interface Props {
    onBack: () => void
    onOpenSettings: () => void
    onStartDailyExpedition: () => Promise<{ ok: true } | { ok: false; reason: string }>
    onStartEndlessDepths: () => Promise<{ ok: true } | { ok: false; reason: string }>
    onStartScholarChallenge: () => Promise<{ ok: true } | { ok: false; reason: string }>
    onOpenRelicSanctum: () => { ok: true } | { ok: false; reason: string }
    onOpenArcanePass: () => void
    onOpenSeasonPass: () => void
    onOpenCosmeticStore: () => void
  }

  let {
    onBack,
    onOpenSettings,
    onStartDailyExpedition,
    onStartEndlessDepths,
    onStartScholarChallenge,
    onOpenRelicSanctum,
    onOpenArcanePass,
    onOpenSeasonPass,
    onOpenCosmeticStore,
  }: Props = $props()

  type SocialPanel = 'coop' | 'duel' | 'guild' | null
  let activePanel = $state<SocialPanel>(null)
  let coopLobbyId = $state(makeLobbyId())
  let dailyStatus = $state<DailyExpeditionStatus>(getDailyExpeditionStatus())
  let dailyMessage = $state('')
  let dailyRows = $state<DailyExpeditionStatus['leaderboard']>([])
  let endlessRows = $state<EndlessDepthsEntry[]>(getEndlessDepthsLeaderboard(5))
  let scholarStatus = $state<ScholarChallengeStatus>(getScholarChallengeStatus())
  let scholarRows = $state(getScholarChallengeStatus().leaderboard.slice(0, 5))
  let endlessMessage = $state('')
  let scholarMessage = $state('')
  let relicMessage = $state('')
  let leaderboardMessage = $state('')
  let coopMessage = $state('')

  const socialEnabled = $derived($parentalStore.socialEnabled)
  const playerId = $derived($authStore.userId ?? $playerSave?.playerId ?? 'local-player')
  const playerName = $derived($authStore.displayName ?? `Rogue-${playerId.slice(0, 6)}`)
  const masteredCount = $derived(($playerSave?.reviewStates ?? []).filter((state) => (
    (state.stability ?? state.interval ?? 0) >= 30 && Boolean(state.passedMasteryTrial)
  )).length)
  const scoreSyncHasFailure = $derived(
    $scoreSubmissionQueueStatus.lastFailureAt !== null &&
    ($scoreSubmissionQueueStatus.lastFailureAt ?? 0) >= ($scoreSubmissionQueueStatus.lastSuccessAt ?? 0),
  )

  function formatQueueTimestamp(ts: number | null): string {
    if (ts === null) return 'Never'
    try {
      return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'Unknown'
    }
  }

  function makeLobbyId(): string {
    const stamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `local-${stamp}-${random}`
  }

  async function createCoopLobby(): Promise<void> {
    try {
      const { roomId } = await createLobby(playerId, playerName)
      coopLobbyId = roomId
      coopMessage = ''
    } catch {
      coopLobbyId = makeLobbyId()
      coopMessage = 'Unable to create a cloud lobby, using local fallback ID.'
    }
  }

  function openPanel(panel: Exclude<SocialPanel, null>): void {
    if (!socialEnabled) return
    if (panel === 'coop') {
      void (async () => {
        await createCoopLobby()
        activePanel = panel
      })()
      return
    }
    activePanel = panel
  }

  function closePanel(): void {
    activePanel = null
  }

  function startCoopRun(): void {
    activePanel = null
  }

  async function regenerateLobby(): Promise<void> {
    await createCoopLobby()
  }

  async function refreshDailyStatus(): Promise<void> {
    dailyStatus = getDailyExpeditionStatus()
    dailyRows = dailyStatus.leaderboard.slice(0, 5)
    const remoteRows = await getDailyExpeditionGlobalLeaderboard(dailyStatus.dateKey, 5)
    if (remoteRows && remoteRows.length > 0) {
      dailyRows = remoteRows
      leaderboardMessage = ''
    } else {
      leaderboardMessage = 'Using local fallback leaderboard.'
    }
  }

  async function refreshEndlessRows(): Promise<void> {
    endlessRows = getEndlessDepthsLeaderboard(5)
    const remoteRows = await getEndlessDepthsGlobalLeaderboard(5)
    if (remoteRows && remoteRows.length > 0) {
      endlessRows = remoteRows
      leaderboardMessage = ''
    } else if (!leaderboardMessage) {
      leaderboardMessage = 'Using local fallback leaderboard.'
    }
  }

  async function refreshScholarRows(): Promise<void> {
    scholarStatus = getScholarChallengeStatus()
    scholarRows = scholarStatus.leaderboard.slice(0, 5)
    const remoteRows = await getScholarChallengeGlobalLeaderboard(scholarStatus.weekKey, 5)
    if (remoteRows && remoteRows.length > 0) {
      scholarRows = remoteRows
      leaderboardMessage = ''
    } else if (!leaderboardMessage) {
      leaderboardMessage = 'Using local fallback leaderboard.'
    }
  }

  async function startDaily(): Promise<void> {
    const started = await onStartDailyExpedition()
    if (started.ok) {
      dailyMessage = ''
      await refreshDailyStatus()
      return
    }
    if (started.reason === 'already_attempted_today') {
      dailyMessage = 'Daily attempt already used. Next reset is tomorrow.'
    } else if (started.reason === 'onboarding_required') {
      dailyMessage = 'Finish onboarding before Daily Expedition unlocks.'
    } else {
      dailyMessage = 'Unable to start daily expedition right now.'
    }
    await refreshDailyStatus()
  }

  async function startEndless(): Promise<void> {
    const started = await onStartEndlessDepths()
    if (started.ok) {
      endlessMessage = ''
      return
    }
    if (started.reason === 'onboarding_required') {
      endlessMessage = 'Finish onboarding before Endless Depths unlocks.'
    } else {
      endlessMessage = 'Unable to start Endless Depths right now.'
    }
    await refreshEndlessRows()
  }

  async function startScholarChallenge(): Promise<void> {
    const started = await onStartScholarChallenge()
    if (started.ok) {
      scholarMessage = ''
      await refreshScholarRows()
      return
    }
    if (started.reason === 'already_attempted_this_week') {
      scholarMessage = 'Scholar Challenge already attempted this week.'
    } else if (started.reason === 'onboarding_required') {
      scholarMessage = 'Finish onboarding before Scholar Challenge unlocks.'
    } else {
      scholarMessage = 'Unable to start Scholar Challenge right now.'
    }
    await refreshScholarRows()
  }

  function openRelicSanctum(): void {
    const opened = onOpenRelicSanctum()
    if (opened.ok) {
      relicMessage = ''
      return
    }
    if (opened.reason === 'insufficient_mastered') {
      relicMessage = 'Relic Sanctum unlocks once you have more than 12 mastered relic facts.'
    } else if (opened.reason === 'run_active') {
      relicMessage = 'Finish or abandon the active run before opening Relic Sanctum.'
    } else {
      relicMessage = 'Unable to open Relic Sanctum right now.'
    }
  }

  onMount(() => {
    void refreshDailyStatus()
    void refreshEndlessRows()
    void refreshScholarRows()
  })
</script>

<section class="social-screen" aria-label="Social features">
  <header class="header">
    <h2>Social Features</h2>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  {#if !socialEnabled}
    <article class="blocked-card" role="status" aria-live="polite">
      <h3>Social features are disabled</h3>
      <p>Enable social access in Parental Controls to use co-op, duels, and guilds.</p>
      <button type="button" class="settings-btn" onclick={onOpenSettings}>Open Settings</button>
    </article>
  {:else}
    <article class="score-sync-card" data-testid="score-sync-status">
      <h3>Competitive Score Sync</h3>
      <div class="sync-row">
        <span>Pending submissions</span>
        <strong>{$scoreSubmissionQueueStatus.pendingCount}</strong>
      </div>
      <div class="sync-row">
        <span>
          {#if scoreSyncHasFailure}
            Last attempt failed
          {:else if $scoreSubmissionQueueStatus.lastSuccessAt !== null}
            Last attempt succeeded
          {:else if $scoreSubmissionQueueStatus.lastAttemptAt !== null}
            Last attempt started
          {:else}
            Waiting for first submission
          {/if}
        </span>
        <span>{formatQueueTimestamp($scoreSubmissionQueueStatus.lastAttemptAt)}</span>
      </div>
      {#if scoreSyncHasFailure && $scoreSubmissionQueueStatus.lastErrorMessage}
        <div class="sync-error">Last error: {$scoreSubmissionQueueStatus.lastErrorMessage}</div>
      {/if}
    </article>

    <p class="helper">
      Co-op, duel, and guild frontends are now accessible from the app flow.
      Matchmaking and backend reliability hardening are tracked in AR-20.
    </p>
    {#if leaderboardMessage}
      <p class="helper">{leaderboardMessage}</p>
    {/if}

    <div class="cards">
      <article class="card">
        <h3>Daily Expedition</h3>
        <p>Same daily seed for everyone, one attempt per day, read-only leaderboard.</p>
        <div class="meta">Today: <code>{dailyStatus.dateKey}</code> • Seed <code>{dailyStatus.seed}</code></div>
        {#if dailyStatus.attempt}
          <div class="meta">Status: {dailyStatus.attempt.status === 'completed' ? 'Completed' : 'In Progress'}</div>
          {#if dailyStatus.playerRank !== null}
            <div class="meta">Rank: #{dailyStatus.playerRank} • Reward: {dailyStatus.rewardLabel ?? 'Participation badge'}</div>
          {/if}
        {:else}
          <div class="meta">Status: Not attempted yet</div>
        {/if}
        <div class="actions">
          <button type="button" class="primary" onclick={startDaily} disabled={!dailyStatus.canAttempt}>Start Daily Run</button>
        </div>
        {#if dailyMessage}
          <p class="inline-message">{dailyMessage}</p>
        {/if}
        <div class="meta reward-preview">
          {#each dailyStatus.rewardPreview as rewardLine}
            <div>{rewardLine}</div>
          {/each}
        </div>
        <div class="leaderboard-mini" aria-label="Daily expedition leaderboard">
          {#each dailyRows as row}
            <div class="leaderboard-row">
              <span class="leader-rank">#{row.rank}</span>
              <span class="leader-name">{row.playerName}</span>
              <span class="leader-score">{row.score}</span>
            </div>
          {/each}
        </div>
      </article>

      <article class="card">
        <h3>Co-op Lobby</h3>
        <p>Create or join a shared dive room and ready up together.</p>
        <div class="meta">Lobby: <code>{coopLobbyId.slice(-8).toUpperCase()}</code></div>
        <div class="actions">
          <button type="button" onclick={() => void regenerateLobby()}>New Lobby ID</button>
          <button type="button" class="primary" onclick={() => openPanel('coop')}>Open Co-op</button>
        </div>
        {#if coopMessage}
          <p class="inline-message">{coopMessage}</p>
        {/if}
      </article>

      <article class="card">
        <h3>Endless Depths</h3>
        <p>Starts at Floor 10 and keeps scaling. Separate endless leaderboard.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={startEndless}>Start Endless Run</button>
        </div>
        {#if endlessMessage}
          <p class="inline-message">{endlessMessage}</p>
        {/if}
        <div class="leaderboard-mini" aria-label="Endless depths leaderboard">
          {#each endlessRows as row}
            <div class="leaderboard-row">
              <span class="leader-rank">#{row.rank}</span>
              <span class="leader-name">{row.playerName}</span>
              <span class="leader-score">F{row.floorReached} • {row.score}</span>
            </div>
          {/each}
        </div>
      </article>

      <article class="card">
        <h3>Scholar Challenge</h3>
        <p>Weekly curated run with a deterministic seed and a cycle-scoped leaderboard.</p>
        <div class="meta">
          Week: <code>{scholarStatus.weekKey}</code> • Seed <code>{scholarStatus.seed}</code>
        </div>
        <div class="meta">
          Domains: {scholarStatus.primaryDomain.replace('_', ' ')} + {scholarStatus.secondaryDomain.replace('_', ' ')}
        </div>
        {#if scholarStatus.attempt}
          <div class="meta">Status: {scholarStatus.attempt.status === 'completed' ? 'Completed' : 'In Progress'}</div>
          {#if scholarStatus.playerRank !== null}
            <div class="meta">Rank: #{scholarStatus.playerRank}</div>
          {/if}
        {:else}
          <div class="meta">Status: Not attempted this week</div>
        {/if}
        <div class="actions">
          <button type="button" class="primary" onclick={startScholarChallenge} disabled={!scholarStatus.canAttempt}>Start Scholar Run</button>
        </div>
        {#if scholarMessage}
          <p class="inline-message">{scholarMessage}</p>
        {/if}
        <div class="leaderboard-mini" aria-label="Scholar challenge leaderboard">
          {#each scholarRows as row}
            <div class="leaderboard-row">
              <span class="leader-rank">#{row.rank}</span>
              <span class="leader-name">{row.playerName}</span>
              <span class="leader-score">{row.score}</span>
            </div>
          {/each}
        </div>
      </article>

      <article class="card">
        <h3>Relic Sanctum</h3>
        <p>Between runs, choose which mastered relics stay in your active 12-slot loadout.</p>
        <div class="meta">Mastered relic facts: {masteredCount}</div>
        <div class="actions">
          <button type="button" class="primary" onclick={openRelicSanctum}>Open Sanctum</button>
        </div>
        {#if relicMessage}
          <p class="inline-message">{relicMessage}</p>
        {/if}
      </article>

      <article class="card">
        <h3>Knowledge Duels</h3>
        <p>Challenge friends, review pending duels, and track duel record stats.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={() => openPanel('duel')}>Open Duels</button>
        </div>
      </article>

      <article class="card">
        <h3>Guilds</h3>
        <p>Browse guilds, create one, and monitor contribution/progression panels.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={() => openPanel('guild')}>Open Guilds</button>
        </div>
      </article>

      <article class="card">
        <h3>Arcane Pass</h3>
        <p>Subscription tiers, ad-free unlock, and subscriber-only category filtering.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={onOpenArcanePass}>Open Arcane Pass</button>
        </div>
      </article>

      <article class="card">
        <h3>Season Pass</h3>
        <p>Track free and premium milestones for the current season.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={onOpenSeasonPass}>Open Season Pass</button>
        </div>
      </article>

      <article class="card">
        <h3>Cosmetic Store</h3>
        <p>Daily mineral deals, premium cosmetics, and mystery cache reveals.</p>
        <div class="actions">
          <button type="button" class="primary" onclick={onOpenCosmeticStore}>Open Store</button>
        </div>
      </article>

      <article class="card">
        <h3>Weekly Challenges</h3>
        <p>Progress on weekly goals tied to mining, learning, and collecting.</p>
        <WeeklyChallenge />
      </article>
    </div>
  {/if}
</section>

{#if activePanel === 'coop'}
  <CoopLobby
    lobbyId={coopLobbyId}
    playerId={playerId}
    playerName={playerName}
    onStart={startCoopRun}
    onClose={closePanel}
  />
{/if}

{#if activePanel === 'duel'}
  <DuelView onClose={closePanel} />
{/if}

{#if activePanel === 'guild'}
  <GuildView onClose={closePanel} />
{/if}

<style>
  .social-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(96px * var(--layout-scale, 1));
    background:
      radial-gradient(circle at 8% 0%, rgba(100, 200, 255, 0.16), transparent 30%),
      radial-gradient(circle at 90% 5%, rgba(255, 190, 100, 0.16), transparent 28%),
      linear-gradient(180deg, #0f172a, #111827);
    color: #e2e8f0;
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h2 {
    margin: 0;
    font-size: calc(22px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .back-btn,
  .settings-btn,
  .actions button {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    padding: 0 calc(12px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
  }

  .actions button.primary {
    border-color: rgba(125, 211, 252, 0.55);
    background: rgba(12, 74, 110, 0.7);
    color: #e0f2fe;
  }

  .helper {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .blocked-card,
  .score-sync-card,
  .card {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.72);
    padding: calc(12px * var(--layout-scale, 1));
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .blocked-card h3,
  .score-sync-card h3,
  .card h3 {
    margin: 0;
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
  }

  .blocked-card p,
  .card p {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .cards {
    display: grid;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .meta {
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .reward-preview {
    display: grid;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .inline-message {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #fca5a5;
  }

  .leaderboard-mini {
    display: grid;
    gap: calc(5px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(2, 6, 23, 0.45);
    padding: calc(8px * var(--layout-scale, 1));
  }

  .leaderboard-row {
    display: grid;
    grid-template-columns: calc(40px * var(--layout-scale, 1)) minmax(0, 1fr) auto;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .leader-rank {
    color: #fde68a;
    font-weight: 700;
  }

  .leader-name {
    color: #e2e8f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leader-score {
    color: #93c5fd;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .score-sync-card {
    gap: 6px;
    border-color: rgba(125, 211, 252, 0.45);
    background: rgba(8, 25, 43, 0.75);
  }

  .sync-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .sync-row strong {
    color: #7dd3fc;
    font-weight: 800;
  }

  .sync-error {
    font-size: calc(11px * var(--text-scale, 1));
    color: #fca5a5;
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  :global([data-layout="landscape"]) .social-screen {
    margin-left: calc(100px * var(--layout-scale, 1));
    max-width: calc(1400px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(96px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .back-btn {
    display: none;
  }

  /* Cards grid: 2 columns in landscape */
  :global([data-layout="landscape"]) .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* Body text / card descriptions */
  :global([data-layout="landscape"]) .card p,
  :global([data-layout="landscape"]) .blocked-card p {
    font-size: calc(15px * var(--text-scale, 1));
  }

  /* Small labels */
  :global([data-layout="landscape"]) .meta {
    font-size: calc(13px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .helper {
    font-size: calc(13px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .inline-message {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Leaderboard text */
  :global([data-layout="landscape"]) .leaderboard-row {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Disabled state: atmospheric heading */
  :global([data-layout="landscape"]) .blocked-card h3 {
    font-size: calc(24px * var(--text-scale, 1));
    font-family: 'Cinzel', serif;
  }

  :global([data-layout="landscape"]) .blocked-card p {
    font-size: calc(16px * var(--text-scale, 1));
    max-width: calc(600px * var(--layout-scale, 1));
    margin-left: auto;
    margin-right: auto;
  }

  /* "Open Settings" button: prominent gold-bordered style */
  :global([data-layout="landscape"]) .settings-btn {
    min-width: calc(200px * var(--layout-scale, 1));
    height: calc(48px * var(--layout-scale, 1));
    border: 1px solid #f59e0b;
    background: rgba(15, 23, 42, 0.9);
    color: #fde68a;
    font-size: calc(15px * var(--text-scale, 1));
  }

  /* Vertically center the disabled state content */
  :global([data-layout="landscape"]) .blocked-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - calc(64px * var(--layout-scale, 1)));
    text-align: center;
  }
</style>
