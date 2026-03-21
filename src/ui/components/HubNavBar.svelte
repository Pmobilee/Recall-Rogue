<script lang="ts">
  import type { Screen } from '../stores/gameState'
  import { getNavIconPath } from '../utils/iconAssets'
  import { isLandscape } from '../../stores/layoutStore'

  type NavScreen = Extract<Screen, 'hub' | 'library' | 'settings' | 'profile' | 'journal' | 'social' | 'leaderboards'>

  type SidebarItem = {
    label: string
    icon: string
    iconKey?: NavScreen
    key?: NavScreen
    action?: 'relicSanctum' | 'deckBuilder'
    activeScreen?: Screen
  }

  interface Props {
    current: Screen
    onNavigate: (screen: NavScreen) => void
    onOpenRelicSanctum?: () => void
    onOpenDeckBuilder?: () => void
  }

  let { current, onNavigate, onOpenRelicSanctum, onOpenDeckBuilder }: Props = $props()

  const NAV_ITEMS: Array<{ key: NavScreen; label: string; icon: string }> = [
    { key: 'hub', label: 'Start', icon: '🏃' },
    { key: 'library', label: 'Library', icon: '📖' },
    { key: 'social', label: 'Social', icon: '🤝' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'journal', label: 'Journal', icon: '📜' },
  ]

  const SIDEBAR_ITEMS: SidebarItem[] = [
    { key: 'hub', label: 'Start', icon: '🏃', iconKey: 'hub' },
    { key: 'library', label: 'Library', icon: '📖', iconKey: 'library' },
    { key: 'social', label: 'Social', icon: '🤝', iconKey: 'social' },
    { key: 'settings', label: 'Settings', icon: '⚙️', iconKey: 'settings' },
    { key: 'profile', label: 'Profile', icon: '👤', iconKey: 'profile' },
    { key: 'journal', label: 'Journal', icon: '📜', iconKey: 'journal' },
    { key: 'leaderboards', label: 'Boards', icon: '🏆', iconKey: 'leaderboards' },
    { action: 'relicSanctum', label: 'Relics', icon: '🏺', activeScreen: 'relicSanctum' as Screen },
    { action: 'deckBuilder', label: 'Decks', icon: '🃏' },
  ]

  function handleSidebarClick(item: SidebarItem): void {
    if (item.key) {
      onNavigate(item.key)
    } else if (item.action === 'relicSanctum') {
      onOpenRelicSanctum?.()
    } else if (item.action === 'deckBuilder') {
      onOpenDeckBuilder?.()
    }
  }

  function isSidebarActive(item: SidebarItem): boolean {
    if (item.key) {
      return current === item.key || (item.key === 'hub' && current === 'mainMenu')
    }
    if (item.activeScreen) {
      return current === item.activeScreen
    }
    return false
  }
</script>

{#if $isLandscape}
  <!-- ═══ LANDSCAPE: Left sidebar navigation ═══════════════════════════════ -->
  <nav class="nav-sidebar" aria-label="Primary navigation">
    {#each SIDEBAR_ITEMS as item}
      <button
        type="button"
        class="sidebar-btn"
        class:active={isSidebarActive(item)}
        onclick={() => handleSidebarClick(item)}
        aria-label={item.label}
      >
        {#if item.iconKey}
          <img class="nav-icon-img" src={getNavIconPath(item.iconKey)} alt=""
            onerror={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'inline'); }} />
          <span class="nav-icon-fallback" style="display:none" aria-hidden="true">{item.icon}</span>
        {:else}
          <span class="nav-icon-fallback" aria-hidden="true">{item.icon}</span>
        {/if}
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
    width: calc(100px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    background: rgba(9, 14, 24, 0.94);
    border-right: 1px solid rgba(148, 163, 184, 0.35);
    padding: calc(8px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    z-index: 280;
    backdrop-filter: blur(6px);
  }

  .sidebar-btn {
    width: 100%;
    min-height: calc(52px * var(--layout-scale, 1));
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: #93a4ba;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    font-size: calc(10px * var(--text-scale, 1));
    cursor: pointer;
    /* Active indicator on left edge */
    border-left: calc(3px * var(--layout-scale, 1)) solid transparent;
    padding: calc(6px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
  }

  .sidebar-btn:hover {
    background: rgba(255, 200, 100, 0.08);
    color: #dbeafe;
    transition: background 150ms ease, color 150ms ease;
  }

  .sidebar-btn.active {
    color: #f8fafc;
    border-color: rgba(56, 189, 248, 0.45);
    border-left-color: rgba(56, 189, 248, 0.9);
    background: rgba(15, 33, 53, 0.7);
  }

  .sidebar-label {
    font-size: calc(11px * var(--text-scale, 1));
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
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
    min-height: calc(48px * var(--layout-scale, 1));
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
    width: calc(24px * var(--layout-scale, 1));
    height: calc(24px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .nav-icon-fallback {
    font-size: calc(20px * var(--text-scale, 1));
    line-height: 1;
  }

  .label {
    line-height: 1;
  }
</style>
