<script lang="ts">
  import { onMount } from 'svelte'
  import { getOmniscientQuip } from '../../data/omniscientQuips'
  import { playerSave, persistPlayer } from '../stores/playerData'

  interface Props {
    onDone: () => void
  }

  const { onDone }: Props = $props()

  const STORAGE_KEY = 'terra_omniscient_revealed'

  let phase = $state<'flash' | 'text' | 'done'>('flash')
  const quote = getOmniscientQuip('greeting')

  onMount(() => {
    // Phase 1: white flash 600ms
    const t1 = setTimeout(() => { phase = 'text' }, 600)
    // Phase 2: text visible 3s
    const t2 = setTimeout(() => {
      phase = 'done'
      // Stamp omniscientUnlockedAt if not already set
      const save = $playerSave
      if (save && !save.omniscientUnlockedAt) {
        playerSave.set({ ...save, omniscientUnlockedAt: Date.now() })
        persistPlayer()
      }
      localStorage.setItem(STORAGE_KEY, 'true')
      onDone()
    }, 3600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  })
</script>

{#if phase === 'flash'}
  <div class="overlay flash"></div>
{:else if phase === 'text'}
  <div class="overlay text-phase">
    <div class="title-text">OMNISCIENT</div>
    <div class="quote-text">{quote}</div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: all;
  }

  .flash {
    background: #fff;
    animation: flashOut 600ms forwards;
  }

  @keyframes flashOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .text-phase {
    background: rgba(0, 0, 0, 0.85);
  }

  .title-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 2.5rem;
    color: #ffd700;
    text-shadow: 0 0 20px #ffd700, 0 0 40px #ffaa00;
    letter-spacing: 0.3em;
    margin-bottom: 1.5rem;
    animation: pulseGold 2s ease-in-out infinite;
  }

  @keyframes pulseGold {
    0%, 100% { text-shadow: 0 0 20px #ffd700, 0 0 40px #ffaa00; }
    50% { text-shadow: 0 0 40px #ffd700, 0 0 80px #ffaa00; }
  }

  .quote-text {
    font-family: 'Press Start 2P', monospace;
    color: #fff;
    font-size: 0.7rem;
    text-align: center;
    max-width: 320px;
    line-height: 1.8;
    padding: 0 16px;
  }
</style>
