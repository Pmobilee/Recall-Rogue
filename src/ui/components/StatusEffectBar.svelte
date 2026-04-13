<script lang="ts">
  import { PERMANENT_DURATION_SENTINEL } from '../../data/statusEffects'

  interface StatusEffect {
    type: string
    value: number
    turnsRemaining: number
  }

  interface Props {
    effects: StatusEffect[]
    position: 'enemy' | 'player'
  }

  let { effects, position }: Props = $props()

  let activeEffectType = $state<string | null>(null)

  const EFFECT_INFO: Record<string, { name: string; icon: string; spriteIcon?: string; color: string; desc: (v: number, t: number) => string }> = {
    poison: { name: 'Doubt', icon: '☠️', spriteIcon: '/assets/sprites/icons/icon_status_poison.png', color: '#22c55e', desc: (v, t) => `${v} doubt damage at end of turn (${t} turn${t !== 1 ? 's' : ''} left)` },
    weakness: { name: 'Drawing Blanks', icon: '⬇', spriteIcon: '/assets/sprites/icons/icon_status_weakness.png', color: '#a78bfa', desc: (v, t) => `Attacks deal 25% less damage (${t} turn${t !== 1 ? 's' : ''} left)` },
    vulnerable: { name: 'Exposed', icon: '🎯', spriteIcon: '/assets/sprites/icons/icon_status_vulnerable.png', color: '#f87171', desc: (v, t) => `Takes 50% more damage (${t} turn${t !== 1 ? 's' : ''} left)` },
    strength: { name: 'Clarity', icon: '💪', spriteIcon: '/assets/sprites/icons/icon_status_strength.png', color: '#fbbf24', desc: (v, t) => `Attacks deal +25% damage per stack (${v} stack${v !== 1 ? 's' : ''})` },
    regen: { name: 'Recall', icon: '💚', spriteIcon: '/assets/sprites/icons/icon_status_regen.png', color: '#4ade80', desc: (v, t) => `Heals ${v} HP at end of turn (${t} turn${t !== 1 ? 's' : ''} left)` },
    immunity: { name: 'Shielded Mind', icon: '✨', spriteIcon: '/assets/sprites/icons/icon_status_immunity.png', color: '#60a5fa', desc: () => `Absorbs next doubt instance` },
    thorns: { name: 'Thorns', icon: '🌿', color: '#86efac', desc: (v) => `Deals ${v} damage back when hit this turn` },
    empower: { name: 'Empower', icon: '⚡', color: '#fcd34d', desc: (v) => `Next card gets +${v}% effect` },
    double_strike: { name: 'Double Strike', icon: '⚔️', color: '#fb923c', desc: (v) => `Next attack hits twice at ${v}%` },
    focus: { name: 'Focus', icon: '🔮', color: '#c084fc', desc: (v) => `Next ${v} card${v !== 1 ? 's' : ''} cost 1 less AP` },
    foresight: { name: 'Foresight', icon: '👁️', color: '#67e8f9', desc: (v, t) => `See enemy intents (${t} turn${t !== 1 ? 's' : ''} left)` },
    fortify: { name: 'Fortify', icon: '🏰', color: '#94a3b8', desc: (v) => `${v} block persists into next turn` },
    overclock: { name: 'Overclock', icon: '⚙️', color: '#e879f9', desc: () => `Next card effect doubled, draw -1 next turn` },
    slow: { name: 'Slow', icon: '🐌', color: '#a1a1aa', desc: (v, t) => `Skips next defend/buff action (${t} turn${t !== 1 ? 's' : ''} left)` },
    burn: { name: 'Brain Burn', icon: '🔥', spriteIcon: '/assets/sprites/icons/icon_status_burn.png', color: '#f97316', desc: (v) => `Next hit deals +${v} bonus damage, then halves.` },
    bleed: { name: 'Lingering Doubt', icon: '🩸', spriteIcon: '/assets/sprites/icons/icon_status_bleed.png', color: '#ef4444', desc: (v) => `Incoming card attacks deal +${v} damage. Decays 1/turn.` },
    freeze: { name: 'Freeze', icon: '❄️', color: '#38bdf8', desc: (v, t) => `Frozen — skips action (${t} turn${t !== 1 ? 's' : ''} left)` },
    // Knowledge Aura states (AR-261) — desc reflects actual fog level thresholds (0-2: flow, 3-6: neutral, 7-10: fog)
    brain_fog: { name: 'Brain Fog', icon: '🌫️', color: '#818cf8', desc: (v) => {
      if (v >= 7) return `Brain Fog active: enemies deal +20% damage. Fog: ${v}/10`;
      if (v <= 2) return `Flow State: draw +1 card/turn. Fog: ${v}/10`;
      return `Neutral — no aura effect. Fog: ${v}/10`;
    }},
    flow_state: { name: 'Flow State', icon: '✨', color: '#fbbf24', desc: (v) => {
      if (v >= 7) return `Brain Fog active: enemies deal +20% damage. Fog: ${v}/10`;
      if (v <= 2) return `Flow State active: draw +1 card/turn. Fog: ${v}/10`;
      return `Neutral — no aura effect. Fog: ${v}/10`;
    }},
    // Enemy-specific mechanics (AR-263)
    stunned: { name: 'Stunned', icon: '💫', color: '#fbbf24', desc: () => `Stunned — skips next action` },
    hardcover: { name: 'Hardcover', icon: '📖', color: '#a78bfa', desc: (v) => `Hardcover armor: ${v}. Reduces Quick Play damage. Charges strip it away.` },
    locked: { name: 'Locked', icon: '🔒', color: '#f87171', desc: () => `A card is locked — must Charge with the locked fact to unlock` },
    // Accuracy grade (AR-262)
    accuracy_s: { name: 'S Grade', icon: '⭐', color: '#fbbf24', desc: () => `Perfect accuracy — bonus rewards incoming` },
  }

  function getInfo(type: string): { name: string; icon: string; spriteIcon?: string; color: string; desc: (v: number, t: number) => string } {
    return EFFECT_INFO[type] ?? { name: type, icon: '❓', color: '#94a3b8', desc: (v: number, t: number) => `${type}: value ${v}, ${t} turns.` }
  }

  function showEffect(type: string) {
    activeEffectType = activeEffectType === type ? null : type
  }

  function dismissPopup() {
    activeEffectType = null
  }

  /**
   * Returns the display label for a turnsRemaining value.
   * Permanent effects (>= PERMANENT_DURATION_SENTINEL) show ∞ instead of the raw sentinel number.
   */
  function turnsLabel(t: number): string {
    return t >= PERMANENT_DURATION_SENTINEL ? '∞' : String(t)
  }

  /**
   * Returns a tooltip desc string that is sentinel-aware.
   * For permanent effects the t argument passed to desc() is replaced with a special
   * sentinel so the desc function's "${t} turns left" fragment reads "permanent" instead.
   * The replacement value is intentionally not PERMANENT_DURATION_SENTINEL so desc functions
   * that use the raw number (e.g. `${v} stacks`) still receive the correct value count.
   */
  function descForEffect(effect: StatusEffect): string {
    const info = getInfo(effect.type)
    if (effect.turnsRemaining >= PERMANENT_DURATION_SENTINEL) {
      // Build desc with a sentinel-aware turns value, then patch away any "(9999 turn…)" fragments
      const raw = info.desc(effect.value, effect.turnsRemaining)
      // Replace any "(9999 turns left)", "(9999 turn left)", or just the number alone in parens
      return raw
        .replace(/\(\s*9999\s+turns?\s+left\)/gi, '(permanent)')
        .replace(/\b9999\b/g, '∞')
    }
    return info.desc(effect.value, effect.turnsRemaining)
  }

  // Only show effects with turns remaining
  let grouped = $derived(effects.filter(e => e.turnsRemaining > 0))
</script>

{#if grouped.length > 0}
  <div class="effect-bar" class:effect-bar-enemy={position === 'enemy'} class:effect-bar-player={position === 'player'} class:status-effect-bar-enemy={position === 'enemy'} class:status-effect-bar-player={position === 'player'}>
    {#each grouped as effect}
      {@const info = getInfo(effect.type)}
      {@const isPermanent = effect.turnsRemaining >= PERMANENT_DURATION_SENTINEL}
      <button
        class="effect-icon"
        onclick={() => showEffect(effect.type)}
        aria-label="{info.name}: {effect.value} stacks, {isPermanent ? 'permanent' : `${effect.turnsRemaining} turns`}"
      >
        {#if info.spriteIcon}
          <img src={info.spriteIcon} alt={info.name} class="effect-sprite-icon" />
        {:else}
          <span class="effect-emoji">{info.icon}</span>
        {/if}
        {#if effect.value > 1}
          <span class="effect-stack" style="background: {info.color};">{effect.value}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeEffectType !== null}
    {@const activeEffect = grouped.find(e => e.type === activeEffectType)}
    {#if activeEffect}
      {@const info = getInfo(activeEffect.type)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="effect-popup-backdrop" onclick={dismissPopup} onkeydown={() => {}}>
        <div class="effect-popup" class:popup-enemy={position === 'enemy'} class:popup-player={position === 'player'}>
          <div class="popup-row">
            {#if info.spriteIcon}
              <img src={info.spriteIcon} alt={info.name} class="popup-sprite-icon" />
            {:else}
              <span class="popup-icon" style="color: {info.color};">{info.icon}</span>
            {/if}
            <div class="popup-text">
              <span class="popup-name" style="color: {info.color};">{info.name}</span>
              <!-- Bug 2 fix: use sentinel-aware desc so popup never shows "9999 turns" -->
              <span class="popup-desc">{descForEffect(activeEffect)}</span>
              <span class="popup-stacks">{activeEffect.value} stack{activeEffect.value !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .effect-bar {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    z-index: 10;
    pointer-events: auto;
  }

  /* Portrait: enemy HP bar is at ~12% viewport height; icons sit just below it (~14vh) */
  .effect-bar-enemy {
    top: calc(14vh + var(--safe-top, 0px));
  }

  .effect-bar-player {
    top: calc(calc(4px * var(--layout-scale, 1)) + var(--safe-top, 0px));
    right: calc(10px * var(--layout-scale, 1));
    left: auto;
    transform: none;
  }

  .effect-icon {
    position: relative;
    width: calc(50px * var(--layout-scale, 1));
    height: calc(50px * var(--layout-scale, 1));
    border-radius: 50%;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    padding: 0;
    font-family: inherit;
    /* White outline glow for icon visibility against varied backgrounds */
    filter: drop-shadow(0 0 calc(1px * var(--layout-scale, 1)) rgba(255,255,255,0.7)) drop-shadow(0 0 calc(1px * var(--layout-scale, 1)) rgba(255,255,255,0.5));
  }

  .effect-emoji {
    font-size: calc(22px * var(--layout-scale, 1));
    line-height: 1;
  }

  .effect-stack {
    position: absolute;
    bottom: calc(-6px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    min-width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 800;
    color: #000;
    text-shadow: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 calc(2px * var(--layout-scale, 1));
  }

  .effect-popup-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
  }

  .effect-popup {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: calc(340px * var(--layout-scale, 1));
    max-width: calc(100vw - calc(32px * var(--layout-scale, 1)));
    padding: calc(14px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 10px;
    backdrop-filter: blur(8px);
    z-index: 51;
  }

  /* Portrait: popup appears just below the icons (~16vh) */
  .popup-enemy {
    top: calc(16vh + var(--safe-top, 0px));
  }

  .popup-player {
    bottom: calc(calc(88px * var(--layout-scale, 1)) + var(--safe-bottom, 0px));
  }

  .popup-row {
    display: flex;
    align-items: flex-start;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .popup-row:last-child {
    border-bottom: none;
  }

  .popup-icon {
    font-size: calc(24px * var(--layout-scale, 1));
    flex-shrink: 0;
    width: calc(32px * var(--layout-scale, 1));
    text-align: center;
  }

  .popup-text {
    display: flex;
    flex-direction: column;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .popup-name {
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 700;
  }

  .popup-desc {
    font-size: calc(16px * var(--layout-scale, 1));
    color: #94a3b8;
    line-height: 1.4;
  }

  .popup-stacks {
    font-size: calc(13px * var(--text-scale, 1));
    color: #64748b;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .effect-sprite-icon {
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
  }

  .popup-sprite-icon {
    width: calc(40px * var(--layout-scale, 1));
    height: calc(40px * var(--layout-scale, 1));
    object-fit: contain;
    flex-shrink: 0;
  }

</style>
