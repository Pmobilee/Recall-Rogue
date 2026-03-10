<script lang="ts">
  import { authStore } from '../stores/authStore'
  import { playerSave } from '../stores/playerData'
  import { parentalStore } from '../stores/parentalStore'
  import { getDailyExpeditionStatus, type DailyExpeditionStatus } from '../../services/dailyExpeditionService'
  import { getEndlessDepthsLeaderboard, type EndlessDepthsEntry } from '../../services/endlessDepthsService'
  import CoopLobby from './CoopLobby.svelte'
  import DuelView from './DuelView.svelte'
  import GuildView from './GuildView.svelte'

  interface Props {
    onBack: () => void
    onOpenSettings: () => void
    onStartDailyExpedition: () => { ok: true } | { ok: false; reason: string }
    onStartEndlessDepths: () => { ok: true } | { ok: false; reason: string }
  }

  let {
    onBack,
    onOpenSettings,
    onStartDailyExpedition,
    onStartEndlessDepths,
  }: Props = $props()

  type SocialPanel = 'coop' | 'duel' | 'guild' | null
  let activePanel = $state<SocialPanel>(null)
  let coopLobbyId = $state(makeLobbyId())
  let dailyStatus = $state<DailyExpeditionStatus>(getDailyExpeditionStatus())
  let dailyMessage = $state('')
  let endlessRows = $state<EndlessDepthsEntry[]>(getEndlessDepthsLeaderboard(5))
  let endlessMessage = $state('')

  const socialEnabled = $derived($parentalStore.socialEnabled)
  const playerId = $derived($authStore.userId ?? $playerSave?.playerId ?? 'local-player')
  const playerName = $derived($authStore.displayName ?? `Rogue-${playerId.slice(0, 6)}`)

  function makeLobbyId(): string {
    const stamp = Date.now().toString(36)
    const random = Math.random().toString(36).slice(2, 8)
    return `local-${stamp}-${random}`
  }

  function openPanel(panel: Exclude<SocialPanel, null>): void {
    if (!socialEnabled) return
    activePanel = panel
  }

  function closePanel(): void {
    activePanel = null
  }

  function startCoopRun(): void {
    activePanel = null
  }

  function regenerateLobby(): void {
    coopLobbyId = makeLobbyId()
  }

  function refreshDailyStatus(): void {
    dailyStatus = getDailyExpeditionStatus()
  }

  function refreshEndlessRows(): void {
    endlessRows = getEndlessDepthsLeaderboard(5)
  }

  function startDaily(): void {
    const started = onStartDailyExpedition()
    if (started.ok) {
      dailyMessage = ''
      refreshDailyStatus()
      return
    }
    if (started.reason === 'already_attempted_today') {
      dailyMessage = 'Daily attempt already used. Next reset is tomorrow.'
    } else if (started.reason === 'onboarding_required') {
      dailyMessage = 'Finish onboarding before Daily Expedition unlocks.'
    } else {
      dailyMessage = 'Unable to start daily expedition right now.'
    }
    refreshDailyStatus()
  }

  function startEndless(): void {
    const started = onStartEndlessDepths()
    if (started.ok) {
      endlessMessage = ''
      return
    }
    if (started.reason === 'onboarding_required') {
      endlessMessage = 'Finish onboarding before Endless Depths unlocks.'
    } else {
      endlessMessage = 'Unable to start Endless Depths right now.'
    }
    refreshEndlessRows()
  }

  $effect(() => {
    playerName
    refreshDailyStatus()
    refreshEndlessRows()
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
    <p class="helper">
      Co-op, duel, and guild frontends are now accessible from the app flow.
      Matchmaking and backend reliability hardening are tracked in AR-20.
    </p>

    <div class="cards">
      <article class="card">
        <h3>Daily Expedition</h3>
        <p>Same daily seed for everyone, one attempt per day, read-only leaderboard.</p>
        <div class="meta">Today: <code>{dailyStatus.dateKey}</code> • Seed <code>{dailyStatus.seed}</code></div>
        {#if dailyStatus.attempt}
          <div class="meta">Status: {dailyStatus.attempt.status === 'completed' ? 'Completed' : 'In Progress'}</div>
        {:else}
          <div class="meta">Status: Not attempted yet</div>
        {/if}
        <div class="actions">
          <button type="button" class="primary" onclick={startDaily} disabled={!dailyStatus.canAttempt}>Start Daily Run</button>
        </div>
        {#if dailyMessage}
          <p class="inline-message">{dailyMessage}</p>
        {/if}
        <div class="leaderboard-mini" aria-label="Daily expedition leaderboard">
          {#each dailyStatus.leaderboard.slice(0, 5) as row}
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
          <button type="button" onclick={regenerateLobby}>New Lobby ID</button>
          <button type="button" class="primary" onclick={() => openPanel('coop')}>Open Co-op</button>
        </div>
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
    padding: 16px 16px 96px;
    background:
      radial-gradient(circle at 8% 0%, rgba(100, 200, 255, 0.16), transparent 30%),
      radial-gradient(circle at 90% 5%, rgba(255, 190, 100, 0.16), transparent 28%),
      linear-gradient(180deg, #0f172a, #111827);
    color: #e2e8f0;
    display: grid;
    gap: 12px;
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
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.85);
    color: #e2e8f0;
    padding: 0 12px;
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
  .card {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.72);
    padding: 12px;
    display: grid;
    gap: 8px;
  }

  .blocked-card h3,
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
    gap: 10px;
  }

  .meta {
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .inline-message {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #fca5a5;
  }

  .leaderboard-mini {
    display: grid;
    gap: 5px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(2, 6, 23, 0.45);
    padding: 8px;
  }

  .leaderboard-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 8px;
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
    gap: 8px;
  }
</style>
