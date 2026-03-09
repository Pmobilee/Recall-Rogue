<script lang="ts">
  import type { Screen } from '../stores/gameState'

  interface Props {
    current: Screen
    onNavigate: (screen: Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal'>) => void
  }

  let { current, onNavigate }: Props = $props()

  const NAV_ITEMS: Array<{ key: Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal'>; label: string; icon: string }> = [
    { key: 'hub', label: 'Start', icon: '🏃' },
    { key: 'library', label: 'Library', icon: '📖' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'journal', label: 'Journal', icon: '📜' },
  ]
</script>

<nav class="hub-nav" aria-label="Primary navigation">
  {#each NAV_ITEMS as item}
    <button
      type="button"
      class="nav-btn"
      class:active={current === item.key || (item.key === 'hub' && current === 'mainMenu')}
      onclick={() => onNavigate(item.key)}
      aria-label={item.label}
    >
      <span class="icon" aria-hidden="true">{item.icon}</span>
      <span class="label">{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .hub-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    background: rgba(9, 14, 24, 0.94);
    border-top: 1px solid rgba(148, 163, 184, 0.35);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    z-index: 280;
    backdrop-filter: blur(6px);
  }

  .nav-btn {
    min-height: 48px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: #93a4ba;
    display: grid;
    place-items: center;
    gap: 2px;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .nav-btn.active {
    color: #f8fafc;
    border-color: rgba(56, 189, 248, 0.45);
    background: rgba(15, 33, 53, 0.7);
  }

  .icon {
    font-size: 16px;
    line-height: 1;
  }

  .label {
    line-height: 1;
  }
</style>
