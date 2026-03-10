<script lang="ts">
  interface Props {
    onbegin: (slowReader: boolean) => void
  }

  let { onbegin }: Props = $props()

  function handleEnter(): void {
    // Slow reader setting moved to Settings panel; skip question during onboarding
    onbegin(false)
  }
</script>

<div class="onboarding-screen">
  <div class="onboarding-panel">
    <h1>RECALL ROGUE</h1>
    <p>Enter the depths and test your recall.</p>
    <button class="enter-btn" onclick={handleEnter}>ENTER THE DEPTHS</button>
  </div>
</div>

<style>
  .onboarding-screen {
    position: fixed;
    inset: 0;
    background:
      linear-gradient(rgba(6, 8, 13, 0.65), rgba(6, 8, 13, 0.85)),
      url('/assets/backgrounds/menu/bg_menu_title.png') center / cover no-repeat,
      #0d1117;
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

  .enter-btn {
    width: 220px;
    max-width: 100%;
    min-height: 56px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #f5b83d, #c97d16);
    color: #1b1304;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 1px;
  }

</style>
