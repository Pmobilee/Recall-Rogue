<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { activeProfile } from '../stores/profileStore'

  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const save = $derived($playerSave)
  const profileName = $derived($activeProfile?.name ?? 'Explorer')
  const stats = $derived(save?.stats)

  const milestones = $derived((save?.claimedMilestones ?? []).length)
  const totalRuns = $derived(stats?.totalDivesCompleted ?? 0)
  const bestFloor = $derived(stats?.deepestLayerReached ?? 0)
  const factsLearned = $derived(stats?.totalFactsLearned ?? 0)
  const masteredFacts = $derived((save?.reviewStates ?? []).filter((state) => (state.stability ?? state.interval ?? 0) >= 25).length)
</script>

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
</section>

<style>
  .profile-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 18px 16px 96px;
    background: linear-gradient(180deg, #0a1220 0%, #101a2b 100%);
    color: #e2e8f0;
    display: grid;
    gap: 14px;
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
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid #475569;
    background: #1e293b;
    color: #dbeafe;
    padding: 0 12px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .hero {
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    gap: 12px;
    align-items: center;
    background: rgba(15, 23, 42, 0.78);
  }

  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(30, 64, 175, 0.35);
    font-size: 28px;
  }

  .hero h3 {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
  }

  .hero p {
    margin: 2px 0 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat {
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.76);
    padding: 10px;
    display: grid;
    gap: 6px;
  }

  .stat span {
    font-size: calc(11px * var(--text-scale, 1));
    color: #93c5fd;
  }

  .stat strong {
    font-size: calc(22px * var(--text-scale, 1));
    color: #f8fafc;
  }
</style>
