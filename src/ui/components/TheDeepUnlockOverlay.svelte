<!-- src/ui/components/TheDeepUnlockOverlay.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'

  interface Props { onProceed: () => void }
  let { onProceed }: Props = $props()

  let fading = $state(false)

  onMount(() => {
    const t = setTimeout(() => {
      fading = true
      setTimeout(onProceed, 500)
    }, 3500)
    return () => clearTimeout(t)
  })
</script>

<div class="deep-unlock" class:fading>
  <div class="layer-label">LAYER 21</div>
  <div class="title">THE DEEP</div>
  <div class="subtitle">All bosses defeated. The abyss opens.</div>
  <div class="gaia-quote">GAIA: "Pilot... these readings are impossible. Proceed."</div>
</div>

<style>
  .deep-unlock {
    position: fixed; inset: 0;
    background: #000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 950; color: #fff; gap: 14px; text-align: center;
    pointer-events: none;
    animation: deepIn 1.2s ease;
  }
  .deep-unlock.fading { animation: deepOut 0.5s ease forwards; }
  .layer-label { font-size: 0.75rem; letter-spacing: 0.3em; color: #770099; text-transform: uppercase; }
  .title       { font-size: 2.6rem; font-weight: bold; color: #cc00ff; text-shadow: 0 0 24px #cc00ff88; }
  .subtitle    { font-size: 0.95rem; color: #aaa; }
  .gaia-quote  { font-size: 0.8rem; color: #7af; font-style: italic; max-width: 280px; }
  @keyframes deepIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes deepOut { from { opacity: 1 } to { opacity: 0 } }
</style>
