<script lang="ts">
  import type { PlayerProfile } from '../../../data/profileTypes'

  interface Props {
    profiles: PlayerProfile[]
    onSelect: (id: string) => void
    onAddProfile: () => void
    onManageProfiles: () => void
  }

  const { profiles, onSelect, onAddProfile, onManageProfiles }: Props = $props()

  const MAX_PROFILES = 4

  /** Slots: filled profile or null (empty add-slot). */
  const slots = $derived.by(() => {
    const filled = profiles.slice(0, MAX_PROFILES)
    const empties = MAX_PROFILES - filled.length
    return [
      ...filled.map(p => ({ type: 'profile' as const, profile: p })),
      ...Array.from({ length: empties }, () => ({ type: 'empty' as const, profile: null })),
    ]
  })

  const canAddMore = $derived(profiles.length < MAX_PROFILES)
</script>

<div class="profile-select-view">
  <div class="header">
    <h1 class="title">Recall Rogue</h1>
    <p class="subtitle">Select your explorer</p>
  </div>

  <div class="profile-grid">
    {#each slots as slot}
      {#if slot.type === 'profile' && slot.profile}
        {@const p = slot.profile}
        <button
          class="profile-card"
          type="button"
          onclick={() => onSelect(p.id)}
          aria-label="Select profile {p.name}"
        >
          <span class="avatar">{p.avatarKey}</span>
          <span class="profile-name">{p.name}</span>
          <span class="level-badge">Lv. {p.level}</span>
        </button>
      {:else}
        <button
          class="profile-card add-card"
          type="button"
          onclick={onAddProfile}
          disabled={!canAddMore}
          aria-label={canAddMore ? 'Add new profile' : 'Maximum profiles reached'}
        >
          <span class="add-icon">{canAddMore ? '+' : '—'}</span>
          <span class="add-label">{canAddMore ? 'Add Profile' : 'Max Reached'}</span>
        </button>
      {/if}
    {/each}
  </div>

  <div class="footer">
    <button class="manage-btn" type="button" onclick={onManageProfiles}>
      Manage Profiles
    </button>
  </div>
</div>

<style>
  .profile-select-view {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    background: #1a1a2e;
    z-index: 100;
    font-family: 'Courier New', monospace;
    padding: 1.5rem;
  }

  .header {
    text-align: center;
  }

  .title {
    font-size: clamp(2rem, 7vw, 3rem);
    color: #ffd369;
    text-transform: uppercase;
    letter-spacing: 4px;
    margin: 0 0 0.4rem;
    text-shadow: 0 0 20px rgba(255, 211, 105, 0.3);
  }

  .subtitle {
    color: #888;
    font-size: 0.95rem;
    letter-spacing: 2px;
    margin: 0;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    width: min(100%, 22rem);
  }

  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0.75rem;
    border: 2px solid rgba(233, 69, 96, 0.4);
    border-radius: 16px;
    background: rgba(233, 69, 96, 0.08);
    color: #eee;
    font-family: inherit;
    cursor: pointer;
    transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    min-height: 110px;
  }

  .profile-card:hover:not(:disabled) {
    border-color: #e94560;
    background: rgba(233, 69, 96, 0.18);
    transform: translateY(-2px);
  }

  .profile-card:active:not(:disabled) {
    transform: scale(0.97);
  }

  .avatar {
    font-size: 2.4rem;
    line-height: 1;
  }

  .profile-name {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 1px;
    color: #eee;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .level-badge {
    font-size: 0.75rem;
    color: #ffd369;
    letter-spacing: 1px;
  }

  .add-card {
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
  }

  .add-card:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  .add-card:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .add-icon {
    font-size: 2rem;
    color: #888;
    font-weight: 300;
  }

  .add-label {
    font-size: 0.8rem;
    color: #888;
    letter-spacing: 1px;
  }

  .footer {
    margin-top: 0.5rem;
  }

  .manage-btn {
    background: none;
    border: none;
    color: #888;
    font-family: inherit;
    font-size: 0.85rem;
    letter-spacing: 1px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0.5rem 1rem;
    transition: color 120ms ease;
  }

  .manage-btn:hover {
    color: #ccc;
  }
</style>
