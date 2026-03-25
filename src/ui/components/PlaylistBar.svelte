<script lang="ts">
  import type { CustomPlaylist } from '../../data/studyPreset';

  interface Props {
    playlists: CustomPlaylist[];
    activePlaylistId: string | null;
    onSwitchPlaylist: (id: string) => void;
    onStartCustomRun: () => void;
    onViewPlaylist: () => void;
  }

  let { playlists, activePlaylistId, onSwitchPlaylist, onStartCustomRun, onViewPlaylist }: Props = $props();

  const activePlaylist = $derived(
    activePlaylistId ? playlists.find(p => p.id === activePlaylistId) ?? null : null
  );

  const activeItems = $derived(activePlaylist?.items ?? []);

  const showBar = $derived(playlists.length > 0 && playlists.some(p => p.items.length > 0));
</script>

{#if showBar}
  <div class="playlist-bar">
    <div class="bar-left">
      <span class="playlist-icon">&#128203;</span>
      {#if playlists.length > 1}
        <select
          class="playlist-select"
          value={activePlaylistId ?? ''}
          onchange={(e) => onSwitchPlaylist((e.target as HTMLSelectElement).value)}
        >
          {#each playlists as pl (pl.id)}
            <option value={pl.id}>{pl.name}</option>
          {/each}
        </select>
      {:else}
        <span class="playlist-name">{activePlaylist?.name ?? playlists[0]?.name ?? 'Playlist'}</span>
      {/if}
      <span class="playlist-meta">{activeItems.length} item{activeItems.length !== 1 ? 's' : ''}</span>
    </div>

    <div class="bar-right">
      <button class="btn-view" onclick={onViewPlaylist}>View</button>
      <button class="btn-start" onclick={onStartCustomRun}>
        <span class="play-icon">&#9654;</span> Start
      </button>
    </div>
  </div>
{/if}

<style>
  .playlist-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(90deg, rgba(79, 70, 229, 0.15), rgba(99, 102, 241, 0.12));
    border-top: 1px solid rgba(99, 102, 241, 0.3);
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    min-width: 0;
  }

  .playlist-icon {
    font-size: calc(18px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .playlist-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #c4b5fd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(200px * var(--layout-scale, 1));
  }

  .playlist-select {
    background: rgba(79, 70, 229, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #c4b5fd;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    max-width: calc(200px * var(--layout-scale, 1));
  }

  .playlist-select:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.8);
  }

  .playlist-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #6b7280;
    white-space: nowrap;
  }

  .bar-right {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .btn-view {
    background: transparent;
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #818cf8;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 500;
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-view:hover {
    border-color: rgba(99, 102, 241, 0.9);
    color: #a5b4fc;
  }

  .btn-start {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-start:hover {
    opacity: 0.88;
  }

  .play-icon {
    font-size: calc(11px * var(--text-scale, 1));
  }
</style>
