<script lang="ts">
  import type { SpecialEvent } from '../../data/specialEvents'
  import { rollMysteryEffect } from '../../data/specialEvents'

  interface Props {
    event: SpecialEvent | null
    onresolve: (choice?: unknown) => void
  }

  let { event, onresolve }: Props = $props()

  let mysteryResult = $state<string | null>(null)

  function getEventIcon(type: string): string {
    switch (type) {
      case 'relic_forge': return '\uD83D\uDD25'     // 🔥
      case 'card_transform': return '\u2728'         // ✨
      case 'deck_thin': return '\uD83D\uDCC9'       // 📉
      case 'knowledge_spring': return '\uD83D\uDCA7' // 💧
      case 'mystery': return '\u2753'                 // ❓
      default: return '\u2B50'                        // ⭐
    }
  }

  function handleRevealMystery(): void {
    const effect = rollMysteryEffect()
    mysteryResult = effect.label
    // Store effect so handleResolve can pass it when the user clicks Continue
    pendingMysteryEffect = effect
  }

  function handleResolve(): void {
    const effectToPass = pendingMysteryEffect
    mysteryResult = null
    pendingMysteryEffect = null
    onresolve(effectToPass ? { mysteryEffect: effectToPass } : undefined)
  }

  let pendingMysteryEffect = $state<ReturnType<typeof rollMysteryEffect> | null>(null)

  function handleKnowledgeSpring(): void {
    onresolve({ type: 'knowledge_spring' })
  }

  function handleDeckThin(): void {
    // Simplified: auto-resolve for now (full deck picker in future phase)
    onresolve({ type: 'deck_thin' })
  }

  function handleCardTransform(): void {
    // Simplified: auto-resolve for now (full card picker in future phase)
    onresolve({ type: 'card_transform' })
  }

  function handleRelicForge(): void {
    // Simplified: auto-resolve for now (full relic picker in future phase)
    onresolve({ type: 'relic_forge' })
  }
</script>

{#if event}
  <div class="special-overlay">
    <div class="special-card">
      <span class="event-icon">{getEventIcon(event.type)}</span>
      <h2 class="event-name">{event.name}</h2>
      <p class="event-desc">{event.description}</p>

      {#if mysteryResult}
        <p class="mystery-result">{mysteryResult}</p>
      {/if}

      <div class="event-actions">
        {#if event.type === 'knowledge_spring'}
          <button class="action-btn primary" onclick={handleKnowledgeSpring}>
            Apply Stability Bonus
          </button>
        {:else if event.type === 'deck_thin'}
          <button class="action-btn primary" onclick={handleDeckThin}>
            Thin Deck
          </button>
        {:else if event.type === 'card_transform'}
          <button class="action-btn primary" onclick={handleCardTransform}>
            Transform Card
          </button>
        {:else if event.type === 'relic_forge'}
          <button class="action-btn primary" onclick={handleRelicForge}>
            Enter Forge
          </button>
        {:else if event.type === 'mystery'}
          {#if mysteryResult}
            <button class="action-btn primary" onclick={handleResolve}>
              Continue
            </button>
          {:else}
            <button class="action-btn primary" onclick={handleRevealMystery}>
              Reveal
            </button>
          {/if}
        {:else}
          <button class="action-btn primary" onclick={handleResolve}>
            Continue
          </button>
        {/if}

        <button class="action-btn secondary" onclick={handleResolve} data-testid="special-event-skip">
          Skip
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .special-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba(30, 40, 60, 0.95) 0%, rgba(10, 14, 20, 0.98) 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .special-card {
    background: linear-gradient(180deg, #1a1d24, #0f1318);
    border: 2px solid #f59e0b;
    border-radius: calc(14px * var(--layout-scale, 1));
    padding: calc(28px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    max-width: min(calc(420px * var(--layout-scale, 1)), 90vw);
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(14px * var(--layout-scale, 1));
  }

  .event-icon {
    font-size: calc(56px * var(--text-scale, 1));
  }

  .event-name {
    font-size: calc(20px * var(--text-scale, 1));
    color: #fbbf24;
    margin: 0;
    text-align: center;
    letter-spacing: 0.5px;
  }

  .event-desc {
    font-size: calc(14px * var(--text-scale, 1));
    color: #cbd5e1;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .mystery-result {
    font-size: calc(14px * var(--text-scale, 1));
    color: #86efac;
    text-align: center;
    font-style: italic;
    margin: 0;
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(34, 197, 94, 0.1);
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .event-actions {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    width: 100%;
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .action-btn {
    width: 100%;
    min-height: calc(48px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .action-btn:active {
    transform: scale(0.97);
  }

  .action-btn.primary {
    border: 2px solid #f59e0b;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
  }

  .action-btn.secondary {
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(30, 41, 59, 0.75);
    color: #94a3b8;
    font-weight: 500;
    font-size: calc(13px * var(--text-scale, 1));
    min-height: calc(40px * var(--layout-scale, 1));
  }
</style>
