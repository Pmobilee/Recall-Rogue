<script lang="ts">
  import type { Screen } from '../stores/gameState'
  import { getNavIconPath } from '../utils/iconAssets'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    current: Screen
    onNavigate: (screen: Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal' | 'social'>) => void
  }

  let { current, onNavigate }: Props = $props()

  const NAV_ITEMS: Array<{ key: Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal' | 'social'>; label: string; icon: string }> = [
    { key: 'hub', label: 'Start', icon: '🏃' },
    { key: 'library', label: 'Library', icon: '📖' },
    { key: 'social', label: 'Social', icon: '🤝' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'journal', label: 'Journal', icon: '📜' },
  ]
</script>

{#if $isLandscape}
  <!-- ═══ LANDSCAPE: Left sidebar navigation ═══════════════════════════════ -->
  <nav class="nav-sidebar" aria-label="Primary navigation">
    {#each NAV_ITEMS as item}
      <button
        type="button"
        class="sidebar-btn"
        class:active={current === item.key || (item.key === 'hub' && current === 'mainMenu')}
        onclick={() => onNavigate(item.key)}
        aria-label={item.label}
      >
        <img class="nav-icon-img" src={getNavIconPath(item.key)} alt=""
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'inline'); }} />
        <span class="nav-icon-fallback" style="display:none" aria-hidden="true">{item.icon}</span>
        <span class="sidebar-label">{item.label}</span>
      </button>
    {/each}
  </nav>
{:else}
  <!-- ═══ PORTRAIT: Bottom tab bar — PIXEL-IDENTICAL TO PRE-PORT ════════════ -->
  <nav class="hub-nav" aria-label="Primary navigation">
    {#each NAV_ITEMS as item}
      <button
        type="button"
        class="nav-btn"
        class:active={current === item.key || (item.key === 'hub' && current === 'mainMenu')}
        onclick={() => onNavigate(item.key)}
        aria-label={item.label}
      >
        <img class="nav-icon-img" src={getNavIconPath(item.key)} alt=""
          onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'inline'); }} />
        <span class="nav-icon-fallback" style="display:none" aria-hidden="true">{item.icon}</span>
        <span class="label">{item.label}</span>
      </button>
    {/each}
  </nav>
{/if}

<style>
  /* ═══ LANDSCAPE SIDEBAR ═════════════════════════════════════════════════════ */

  .nav-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    background: rgba(9, 14, 24, 0.94);
    border-right: 1px solid rgba(148, 163, 184, 0.35);
    padding: 8px 4px;
    z-index: 280;
    backdrop-filter: blur(6px);
  }

  .sidebar-btn {
    width: 100%;
    min-height: 56px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: #93a4ba;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: calc(10px * var(--text-scale, 1));
    cursor: pointer;
    /* Active indicator on left edge */
    border-left: 3px solid transparent;
    padding: 6px 4px;
  }

  .sidebar-btn.active {
    color: #f8fafc;
    border-color: rgba(56, 189, 248, 0.45);
    border-left-color: rgba(56, 189, 248, 0.9);
    background: rgba(15, 33, 53, 0.7);
  }

  .sidebar-label {
    font-size: 9px;
    line-height: 1;
    text-align: center;
  }

  /* ═══ PORTRAIT BOTTOM BAR ═══════════════════════════════════════════════════ */

  .hub-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
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

  .nav-icon-img {
    width: 20px;
    height: 20px;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .nav-icon-fallback {
    font-size: 16px;
    line-height: 1;
  }

  .label {
    line-height: 1;
  }
</style>
