<!-- src/ui/components/BossIntroOverlay.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { Boss } from '../../game/entities/Boss'

  interface Props {
    boss: Boss
    onDismiss: () => void
  }
  let { boss, onDismiss }: Props = $props()

  let fading = $state(false)

  onMount(() => {
    const timer = setTimeout(() => {
      fading = true
      setTimeout(onDismiss, 400)
    }, 2200)
    return () => clearTimeout(timer)
  })
</script>

<div class="boss-intro" class:fading>
  <div class="boss-tier">BOSS ENCOUNTER</div>
  <div class="boss-name">{boss.name}</div>
  <div class="boss-title">{boss.title}</div>
  <div class="boss-hp">HP: {boss.maxHp}</div>
  <div class="boss-quote">
    GAIA: "{boss.phases[0]?.dialogue ?? 'Prepare yourself, pilot.'}"
  </div>
</div>

<style>
  .boss-intro {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 900;
    color: #fff;
    text-align: center;
    gap: 10px;
    pointer-events: none;
    animation: bossReveal 0.5s ease;
  }
  .boss-intro.fading { animation: bossFade 0.4s ease forwards; }
  .boss-tier  { font-size: 0.7rem; color: #ffd369; letter-spacing: 0.25em; text-transform: uppercase; }
  .boss-name  { font-size: 2.2rem; font-weight: bold; color: #e94560; text-shadow: 0 0 16px #e94560; }
  .boss-title { font-size: 0.9rem; color: #ccc; }
  .boss-hp    { font-size: 0.75rem; color: #888; }
  .boss-quote { font-size: 0.78rem; color: #7af; font-style: italic; max-width: 290px; margin-top: 8px; }
  @keyframes bossReveal { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
  @keyframes bossFade   { from { opacity: 1 } to { opacity: 0 } }
</style>
