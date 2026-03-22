<script lang="ts">
  import { getMenuBg, getMenuDepthMap } from '../../data/backgroundManifest'
  import ParallaxTransition from './ParallaxTransition.svelte'

  interface Props {
    onbegin: (slowReader: boolean, languageCode: string | null) => void
    onback?: () => void
  }

  let { onbegin, onback }: Props = $props()

  const menuBg = $derived(getMenuBg())

  function handleEnter(): void {
    onbegin(false, null)
  }
</script>

<div class="onboarding-screen" style="background-image: linear-gradient(rgba(6, 8, 13, 0.4), rgba(6, 8, 13, 0.6)), url('{menuBg}')">
  <div class="onboarding-panel">
    {#if onback}
      <button class="back-btn" type="button" onclick={onback}>&larr; Back</button>
    {/if}
    <h1>RECALL ROGUE</h1>
    <p>Enter the depths and test your recall.</p>
    <button class="enter-btn" onclick={handleEnter}>ENTER THE DEPTHS</button>
  </div>
</div>

<style>
  .onboarding-screen {
    position: fixed;
    inset: 0;
    background-color: #0d1117;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: grid;
    place-items: center;
    z-index: 120;
  }

  .onboarding-panel {
    width: min(320px, calc(100vw - 24px));
    border: 1px solid rgba(241, 196, 15, 0.5);
    border-radius: 14px;
    background: rgba(12, 18, 27, 0.92);
    padding: 20px;
    text-align: center;
  }

  h1 {
    margin: 0 0 10px;
    color: #f1c40f;
    font-size: 26px;
    letter-spacing: 2px;
  }

  p {
    margin: 0 0 16px;
    color: #dce7f6;
    font-size: 14px;
  }

  .back-btn {
    position: absolute;
    top: calc(16px + var(--safe-top));
    left: 16px;
    background: none;
    border: none;
    color: #8b949e;
    font-size: 16px;
    cursor: pointer;
    padding: 8px 12px;
    min-width: 44px;
    min-height: 44px;
  }

  .enter-btn {
    width: auto;
    min-width: 220px;
    max-width: 100%;
    min-height: 56px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #f5b83d, #c97d16);
    color: #1b1304;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 1px;
    padding: 12px 28px;
  }

</style>
