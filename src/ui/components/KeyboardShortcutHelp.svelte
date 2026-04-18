<script lang="ts">
  /**
   * KeyboardShortcutHelp.svelte — Modal overlay listing keyboard shortcuts and
   * all game mechanics (buffs, debuffs, combat concepts, enemy passives).
   *
   * AR-74: Input System Overhaul
   *
   * Toggle with the '?' key (landscape only). Dismisses with '?' again or Escape.
   * Only renders in landscape mode.
   *
   * Main tabs: Shortcuts | Mechanics
   * Mechanics sub-tabs: Buffs | Debuffs | Combat | Enemy
   */
  import { onMount, onDestroy } from 'svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'

  let visible = $state(false)
  let activeTab = $state<'shortcuts' | 'mechanics'>('shortcuts')
  let activeMechanicsTab = $state<'buffs' | 'debuffs' | 'combat' | 'enemy'>('buffs')

  function show(): void { visible = true }
  function hide(): void { visible = false }
  function toggle(): void { visible = !visible }

  let unsubToggle: (() => void) | null = null
  let unsubCancel: (() => void) | null = null

  onMount(() => {
    unsubToggle = inputService.on('TOGGLE_KEYBOARD_HELP', toggle)
    unsubCancel = inputService.on('CANCEL', () => { if (visible) hide() })
  })

  onDestroy(() => {
    unsubToggle?.()
    unsubCancel?.()
  })

  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay-backdrop')) hide()
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  interface MechanicEntry {
    name: string
    /** Sprite path — renders as <img>. Mutually exclusive with emoji. */
    sprite?: string
    /** Emoji character — renders as a span. Mutually exclusive with sprite. */
    emoji?: string
    /** kbd key character — renders as <kbd>. Mutually exclusive with the above. */
    key?: string
    color: string
    desc: string
  }

  const BUFF_ENTRIES: MechanicEntry[] = [
    {
      name: 'Clarity',
      sprite: '/assets/sprites/icons/icon_status_strength.png',
      color: '#fbbf24',
      desc: '+25% attack damage per stack. Does not tick down.',
    },
    {
      name: 'Recall',
      sprite: '/assets/sprites/icons/icon_status_regen.png',
      color: '#4ade80',
      desc: 'Heals HP at the start of each turn. Decreases by 1 each turn.',
    },
    {
      name: 'Shielded Mind',
      sprite: '/assets/sprites/icons/icon_status_immunity.png',
      color: '#60a5fa',
      desc: 'Absorbs the next Doubt damage. Consumed on trigger.',
    },
    {
      name: 'Focus',
      sprite: '/assets/sprites/icons/icon_reward_focus_crystal.png',
      color: '#c084fc',
      desc: 'Next card(s) cost 1 less AP.',
    },
    {
      name: 'Foresight',
      sprite: '/assets/sprites/icons/icon_reward_fortune_eye.png',
      color: '#67e8f9',
      desc: 'See enemy intents for a number of turns.',
    },
    {
      name: 'Fortify',
      sprite: '/assets/sprites/icons/icon_reward_mirror_guard.png',
      color: '#94a3b8',
      desc: 'Block persists into the next turn.',
    },
    {
      name: 'Empower',
      emoji: '⚡',
      color: '#fcd34d',
      desc: 'Next card gets boosted effect.',
    },
    {
      name: 'Double Strike',
      sprite: '/assets/sprites/icons/icon_reward_twin_blades.png',
      color: '#fb923c',
      desc: 'Next attack hits twice.',
    },
    {
      name: 'Overclock',
      sprite: '/assets/sprites/icons/icon_reward_tempo_charm.png',
      color: '#e879f9',
      desc: 'Next card effect doubled, draw -1 next turn.',
    },
    {
      name: 'Flow State',
      emoji: '✨',
      color: '#fbbf24',
      desc: 'Answer streak active: draw +1 card per turn.',
    },
    {
      name: 'S Grade',
      emoji: '⭐',
      color: '#fbbf24',
      desc: 'Perfect accuracy this fight — bonus rewards incoming.',
    },
  ]

  const DEBUFF_ENTRIES: MechanicEntry[] = [
    {
      name: 'Doubt',
      sprite: '/assets/sprites/icons/icon_status_poison.png',
      color: '#22c55e',
      desc: 'Deals damage each turn. Decreases by 1 per turn.',
    },
    {
      name: 'Brain Burn',
      sprite: '/assets/sprites/icons/icon_status_burn.png',
      color: '#f97316',
      desc: 'On-hit: deals bonus damage equal to stacks, then stacks halve.',
    },
    {
      name: 'Lingering Doubt',
      sprite: '/assets/sprites/icons/icon_status_bleed.png',
      color: '#ef4444',
      desc: 'Card-play attacks deal +1 bonus damage per stack. Decays 1/turn.',
    },
    {
      name: 'Drawing Blanks',
      sprite: '/assets/sprites/icons/icon_status_weakness.png',
      color: '#a78bfa',
      desc: 'Enemy deals 25% less damage while weakened.',
    },
    {
      name: 'Exposed',
      sprite: '/assets/sprites/icons/icon_status_vulnerable.png',
      color: '#f87171',
      desc: 'Target takes 50% more damage while vulnerable.',
    },
    {
      name: 'Slow',
      emoji: '🐌',
      color: '#a1a1aa',
      desc: 'Enemy skips its next defend or buff action.',
    },
    {
      name: 'Freeze',
      emoji: '❄️',
      color: '#38bdf8',
      desc: 'Frozen — target skips its next action entirely.',
    },
    {
      name: 'Stunned',
      emoji: '💫',
      color: '#fbbf24',
      desc: 'Stunned — skips next action. Triggered by correct Charges against certain enemies.',
    },
    {
      name: 'Brain Fog',
      emoji: '🌫️',
      color: '#818cf8',
      desc: 'Wrong-answer streak: enemies deal +20% damage.',
    },
    {
      name: 'Locked',
      emoji: '🔒',
      color: '#f87171',
      desc: 'A card is locked — must Charge with the correct fact to unlock it.',
    },
  ]

  const COMBAT_ENTRIES: MechanicEntry[] = [
    {
      name: 'Block',
      emoji: '🛡️',
      color: '#60a5fa',
      desc: 'Absorbs incoming damage before HP. Resets at start of your turn.',
    },
    {
      name: 'AP',
      emoji: '⚡',
      color: '#fcd34d',
      desc: 'Action Points — spend to play cards. Refreshes each turn.',
    },
    {
      name: 'Quick Play',
      key: 'Q',
      color: '#e0e0e0',
      desc: 'Play a card instantly without a quiz. Uses base damage value.',
    },
    {
      name: 'Charge Play',
      key: 'E',
      color: '#e0e0e0',
      desc: 'Answer a quiz to boost your card. Correct = 1.5× effect. Wrong = 0.5× effect.',
    },
    {
      name: 'Surge',
      emoji: '🌊',
      color: '#38bdf8',
      desc: 'Every 4th turn grants +1 bonus AP.',
    },
    {
      name: 'Chains',
      emoji: '🔗',
      color: '#fb923c',
      desc: 'Playing same-type cards in a row builds a chain multiplier. Higher chains = stronger base effects.',
    },
    {
      name: 'Mastery',
      emoji: '⭐',
      color: '#fbbf24',
      desc: 'Cards gain mastery through use (0–5). Higher mastery = stronger effects, new abilities at 3 and 5.',
    },
    {
      name: 'Echo',
      emoji: '👻',
      color: '#94a3b8',
      desc: 'A ghostly copy of a card. Fades after use.',
    },
    {
      name: 'Persistent Block',
      emoji: '🏰',
      color: '#60a5fa',
      desc: 'Block that carries over to the next turn instead of resetting.',
    },
    {
      name: 'Thorns',
      emoji: '🌿',
      color: '#4ade80',
      desc: 'When hit, reflect damage back to the attacker.',
    },
    {
      name: 'Lifetap',
      emoji: '💜',
      color: '#c084fc',
      desc: 'Heal a percentage of damage dealt to the enemy.',
    },
    {
      name: 'Mastery Trial',
      emoji: '📜',
      color: '#fbbf24',
      desc: 'A special challenge. Answering correctly masters the fact permanently.',
    },
  ]

  const ENEMY_ENTRIES: MechanicEntry[] = [
    {
      name: 'Charge Resistant',
      emoji: '🛡️',
      color: '#60a5fa',
      desc: 'Quick Play deals 50% damage. Use Charge plays for full damage.',
    },
    {
      name: 'Chain Vulnerable',
      emoji: '🔗',
      color: '#fb923c',
      desc: 'Chain attacks (2+ chain) deal +50% bonus damage. Build chains to exploit this.',
    },
    {
      name: 'Quick Play Immune',
      emoji: '🚫',
      color: '#f87171',
      desc: 'Quick Play deals 0 damage. Only Charge plays can hurt this enemy.',
    },
    {
      name: 'Hardcover',
      sprite: '/assets/sprites/icons/icon_reward_field_tome.png',
      color: '#94a3b8',
      desc: 'Armor that reduces Quick Play damage. Successful Charges strip it away.',
    },
    {
      name: 'Domain Immunity',
      emoji: '🏛️',
      color: '#e0e0e0',
      desc: 'Immune to one knowledge domain — cards from that domain deal 0 damage.',
    },
    {
      name: 'Chain Lock',
      emoji: '🔒',
      color: '#a78bfa',
      desc: 'All chain multipliers locked at 1.0× — chains still build but do not multiply.',
    },
    {
      name: 'Enrage',
      emoji: '🔥',
      color: '#f97316',
      desc: 'Enemy grows stronger each turn, gaining bonus attack damage over time.',
    },
    {
      name: 'Phase Shift',
      emoji: '⚡',
      color: '#e879f9',
      desc: 'At low HP, enemy shifts to a stronger second phase with new attack patterns.',
    },
    {
      name: 'Strip Block',
      emoji: '💥',
      color: '#f87171',
      desc: 'Enemy removes your block before attacking.',
    },
    {
      name: 'Charge Attack',
      emoji: '⚔️',
      color: '#fcd34d',
      desc: 'Enemy telegraphs a powerful charged attack for next turn.',
    },
  ]
</script>

{#if visible && $isLandscape}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="overlay-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts and mechanics"
    tabindex="-1"
    onclick={handleBackdropClick}
  >
    <div class="overlay-card" role="document">
      <!-- Header -->
      <div class="overlay-header">
        <h2 class="overlay-title">HELP</h2>
        <button class="close-btn" onclick={hide} type="button" aria-label="Close">✕</button>
      </div>

      <!-- Main tabs -->
      <div class="main-tabs" role="tablist">
        <button
          class="main-tab"
          class:active={activeTab === 'shortcuts'}
          role="tab"
          aria-selected={activeTab === 'shortcuts'}
          onclick={() => { activeTab = 'shortcuts' }}
          type="button"
        >
          Shortcuts
        </button>
        <button
          class="main-tab"
          class:active={activeTab === 'mechanics'}
          role="tab"
          aria-selected={activeTab === 'mechanics'}
          onclick={() => { activeTab = 'mechanics' }}
          type="button"
        >
          Mechanics
        </button>
      </div>

      <!-- ── Shortcuts tab ──────────────────────────────────────────────── -->
      {#if activeTab === 'shortcuts'}
        <div class="sections-grid">
          <section class="shortcut-section">
            <h3 class="section-title">Combat</h3>
            <div class="shortcut-rows">
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>1</kbd>–<kbd>5</kbd></span>
                <span class="label-cell">Select card from hand</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Q</kbd></span>
                <span class="label-cell">Quick Play (no quiz)</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>E</kbd></span>
                <span class="label-cell">Charge Play (quiz for bonus)</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Enter</kbd></span>
                <span class="label-cell">End Turn</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Tab</kbd></span>
                <span class="label-cell">Toggle deck / discard view</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Esc</kbd></span>
                <span class="label-cell">Deselect card / cancel</span>
              </div>
            </div>
          </section>

          <section class="shortcut-section">
            <h3 class="section-title">Quiz</h3>
            <div class="shortcut-rows">
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>1</kbd>–<kbd>4</kbd></span>
                <span class="label-cell">Select answer choice</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Space</kbd></span>
                <span class="label-cell">Confirm / continue</span>
              </div>
            </div>
          </section>

          <section class="shortcut-section">
            <h3 class="section-title">Navigation</h3>
            <div class="shortcut-rows">
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Esc</kbd></span>
                <span class="label-cell">Go back / close modal</span>
              </div>
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>Space</kbd></span>
                <span class="label-cell">Skip animation</span>
              </div>
            </div>
          </section>

          <section class="shortcut-section">
            <h3 class="section-title">General</h3>
            <div class="shortcut-rows">
              <div class="shortcut-row">
                <span class="keys-cell"><kbd>?</kbd></span>
                <span class="label-cell">Open / close this overlay</span>
              </div>
            </div>
          </section>
        </div>
      {/if}

      <!-- ── Mechanics tab ───────────────────────────────────────────────── -->
      {#if activeTab === 'mechanics'}
        <!-- Sub-tabs -->
        <div class="sub-tabs" role="tablist">
          <button
            class="sub-tab"
            class:active={activeMechanicsTab === 'buffs'}
            role="tab"
            aria-selected={activeMechanicsTab === 'buffs'}
            onclick={() => { activeMechanicsTab = 'buffs' }}
            type="button"
          >
            Buffs
          </button>
          <button
            class="sub-tab"
            class:active={activeMechanicsTab === 'debuffs'}
            role="tab"
            aria-selected={activeMechanicsTab === 'debuffs'}
            onclick={() => { activeMechanicsTab = 'debuffs' }}
            type="button"
          >
            Debuffs
          </button>
          <button
            class="sub-tab"
            class:active={activeMechanicsTab === 'combat'}
            role="tab"
            aria-selected={activeMechanicsTab === 'combat'}
            onclick={() => { activeMechanicsTab = 'combat' }}
            type="button"
          >
            Combat
          </button>
          <button
            class="sub-tab"
            class:active={activeMechanicsTab === 'enemy'}
            role="tab"
            aria-selected={activeMechanicsTab === 'enemy'}
            onclick={() => { activeMechanicsTab = 'enemy' }}
            type="button"
          >
            Enemy
          </button>
        </div>

        <!-- Effect list -->
        <div class="effect-list">
          {#if activeMechanicsTab === 'buffs'}
            {#each BUFF_ENTRIES as entry (entry.name)}
              <div class="effect-row">
                <span class="effect-icon-cell">
                  {#if entry.sprite}
                    <img class="effect-sprite" src={entry.sprite} alt={entry.name} />
                  {:else if entry.key}
                    <kbd class="effect-key">{entry.key}</kbd>
                  {:else if entry.emoji}
                    <span class="effect-emoji">{entry.emoji}</span>
                  {/if}
                </span>
                <span class="effect-name" style="color: {entry.color}">{entry.name}</span>
                <span class="effect-desc">{entry.desc}</span>
              </div>
            {/each}
          {:else if activeMechanicsTab === 'debuffs'}
            {#each DEBUFF_ENTRIES as entry (entry.name)}
              <div class="effect-row">
                <span class="effect-icon-cell">
                  {#if entry.sprite}
                    <img class="effect-sprite" src={entry.sprite} alt={entry.name} />
                  {:else if entry.key}
                    <kbd class="effect-key">{entry.key}</kbd>
                  {:else if entry.emoji}
                    <span class="effect-emoji">{entry.emoji}</span>
                  {/if}
                </span>
                <span class="effect-name" style="color: {entry.color}">{entry.name}</span>
                <span class="effect-desc">{entry.desc}</span>
              </div>
            {/each}
          {:else if activeMechanicsTab === 'combat'}
            {#each COMBAT_ENTRIES as entry (entry.name)}
              <div class="effect-row">
                <span class="effect-icon-cell">
                  {#if entry.sprite}
                    <img class="effect-sprite" src={entry.sprite} alt={entry.name} />
                  {:else if entry.key}
                    <kbd class="effect-key">{entry.key}</kbd>
                  {:else if entry.emoji}
                    <span class="effect-emoji">{entry.emoji}</span>
                  {/if}
                </span>
                <span class="effect-name" style="color: {entry.color}">{entry.name}</span>
                <span class="effect-desc">{entry.desc}</span>
              </div>
            {/each}
          {:else if activeMechanicsTab === 'enemy'}
            {#each ENEMY_ENTRIES as entry (entry.name)}
              <div class="effect-row">
                <span class="effect-icon-cell">
                  {#if entry.sprite}
                    <img class="effect-sprite" src={entry.sprite} alt={entry.name} />
                  {:else if entry.key}
                    <kbd class="effect-key">{entry.key}</kbd>
                  {:else if entry.emoji}
                    <span class="effect-emoji">{entry.emoji}</span>
                  {/if}
                </span>
                <span class="effect-name" style="color: {entry.color}">{entry.name}</span>
                <span class="effect-desc">{entry.desc}</span>
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <p class="footer-note">
        All actions are also clickable — keyboard shortcuts are optional acceleration.
      </p>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    pointer-events: auto;
    padding: calc(24px * var(--layout-scale, 1));
    animation: backdrop-in 180ms ease-out;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .overlay-card {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-primary, #4ecdc4);
    border-radius: calc(16px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    width: min(calc(780px * var(--layout-scale, 1)), 100%);
    max-height: 80vh;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    color: var(--color-text, #e0e0e0);
    animation: panel-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  @keyframes panel-in {
    from { transform: scale(0.95); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }

  /* ── Header ────────────────────────────────────────────────────────────── */

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: calc(10px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(78, 205, 196, 0.2);
  }

  .overlay-title {
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 700;
    /* High-contrast white — not teal-on-dark which is hard to read */
    color: #e0e0e0;
    letter-spacing: calc(3px * var(--layout-scale, 1));
    text-transform: uppercase;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 1px solid var(--color-text-dim, #888);
    color: var(--color-text-dim, #888);
    font-size: calc(14px * var(--text-scale, 1));
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    border-radius: 50%;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: color 120ms, border-color 120ms;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: var(--color-text, #e0e0e0);
    border-color: var(--color-text, #e0e0e0);
  }

  /* ── Main tabs ─────────────────────────────────────────────────────────── */

  .main-tabs {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .main-tab {
    background: transparent;
    border: none;
    border-bottom: calc(2px * var(--layout-scale, 1)) solid transparent;
    margin-bottom: calc(-1px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    font-family: 'Courier New', monospace;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    letter-spacing: calc(1px * var(--layout-scale, 1));
    text-transform: uppercase;
    /* Inactive: dimmed */
    color: var(--color-text-dim, #888);
    cursor: pointer;
    transition: color 120ms, border-color 120ms;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .main-tab:hover {
    color: #c8d0dc;
  }

  .main-tab.active {
    /* Active tab: bright white text, teal underline accent */
    color: #e0e0e0;
    border-bottom-color: var(--color-primary, #4ecdc4);
  }

  /* ── Shortcuts tab content ─────────────────────────────────────────────── */

  .sections-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(20px * var(--layout-scale, 1));
  }

  .shortcut-section {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .section-title {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: calc(1.5px * var(--layout-scale, 1));
    text-transform: uppercase;
    color: var(--color-warning, #ffd369);
    margin: 0 0 calc(4px * var(--layout-scale, 1));
    padding-bottom: calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 211, 105, 0.2);
  }

  .shortcut-rows {
    display: flex;
    flex-direction: column;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .keys-cell {
    flex-shrink: 0;
    min-width: calc(64px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  kbd {
    display: inline-block;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-bottom-width: 2px;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    font-family: 'Courier New', monospace;
    font-size: calc(13px * var(--text-scale, 1));
    color: #e0e0e0;
    line-height: 1.4;
  }

  .label-cell {
    font-size: calc(14px * var(--text-scale, 1));
    color: #c8d0dc;
    line-height: 1.3;
  }

  /* ── Mechanics sub-tabs ────────────────────────────────────────────────── */

  .sub-tabs {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .sub-tab {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(20px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    font-family: 'Courier New', monospace;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    letter-spacing: calc(0.5px * var(--layout-scale, 1));
    color: var(--color-text-dim, #888);
    cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .sub-tab:hover {
    color: #c8d0dc;
    background: rgba(255, 255, 255, 0.1);
  }

  .sub-tab.active {
    background: rgba(78, 205, 196, 0.15);
    border-color: var(--color-primary, #4ecdc4);
    /* Bright white text for active pill — not teal on dark */
    color: #e0e0e0;
  }

  /* ── Effect list ───────────────────────────────────────────────────────── */

  .effect-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    max-height: calc(320px * var(--layout-scale, 1));
    overflow-y: auto;
    padding-right: calc(4px * var(--layout-scale, 1));
  }

  .effect-list::-webkit-scrollbar {
    width: calc(4px * var(--layout-scale, 1));
  }

  .effect-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .effect-list::-webkit-scrollbar-thumb {
    background: rgba(78, 205, 196, 0.3);
    border-radius: calc(2px * var(--layout-scale, 1));
  }

  .effect-row {
    display: flex;
    align-items: flex-start;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
  }

  .effect-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .effect-icon-cell {
    flex-shrink: 0;
    width: calc(24px * var(--layout-scale, 1));
    height: calc(24px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: calc(1px * var(--layout-scale, 1));
  }

  .effect-sprite {
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: auto;
  }

  .effect-emoji {
    font-size: calc(16px * var(--text-scale, 1));
    line-height: 1;
  }

  .effect-key {
    display: inline-block;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-bottom-width: 2px;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: 0 calc(5px * var(--layout-scale, 1));
    font-family: 'Courier New', monospace;
    font-size: calc(12px * var(--text-scale, 1));
    color: #e0e0e0;
    line-height: calc(20px * var(--layout-scale, 1));
    font-weight: 700;
  }

  .effect-name {
    flex-shrink: 0;
    width: calc(130px * var(--layout-scale, 1));
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    line-height: 1.3;
    /* color set inline from entry data */
  }

  .effect-desc {
    font-size: calc(13px * var(--text-scale, 1));
    /* Brighter than --color-text-dim so it reads on the dark surface */
    color: #c8d0dc;
    line-height: 1.35;
  }

  /* ── Footer ────────────────────────────────────────────────────────────── */

  .footer-note {
    margin: 0;
    padding-top: calc(10px * var(--layout-scale, 1));
    border-top: 1px solid rgba(78, 205, 196, 0.15);
    font-size: calc(12px * var(--text-scale, 1));
    color: var(--color-text-dim, #888);
    text-align: center;
    font-style: italic;
  }
</style>
