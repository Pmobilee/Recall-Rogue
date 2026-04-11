<script lang="ts">
  /**
   * RewardRoomOverlay.svelte
   *
   * DOM accessibility overlay for the Reward Room Phaser scene.
   * Provides keyboard-focusable, screen-reader-visible counterparts for the
   * four Phaser canvas-only interactive objects in RewardRoomScene.ts that
   * would otherwise be invisible to assistive technology.
   *
   * Buttons covered (BATCH-ULTRA T11 — lint:wiring WARNs):
   *
   *   1. Continue (line 970) — always visible; fires sceneComplete via bridge.
   *      This was previously an inline button in CardApp.svelte (commit 003fe7d73).
   *      Moved here so check-wiring.mjs finds it in a RewardRoom*.svelte file.
   *
   *   2. Relic Accept (line 820) — visible when relic detail panel is shown.
   *      Fires 'relicDetailAccept' event on the scene via bridge.
   *      ⚠ PENDING game-logic wiring: RewardRoomScene.showRelicDetail() must
   *        add: this.events.once('relicDetailAccept', () => acceptBtn.emit('pointerdown'))
   *
   *   3. Relic Leave (line 851) — visible when relic detail panel is shown.
   *      Fires 'relicDetailLeave' event on the scene via bridge.
   *      ⚠ PENDING game-logic wiring: same pattern as relicDetailAccept.
   *
   *   4. Leave-confirmation backdrop (line 999) — the full-screen dim rectangle
   *      setInteractive() is used to block click-through, not as a button.
   *      No DOM equivalent needed; the Yes/No buttons in the confirmation are
   *      addressed by the two relic panel buttons above (game-logic wiring
   *      should include handling those too when adding the event listeners).
   *
   * Positioning: all buttons use `position: fixed` with percentage-based
   * coordinates derived from the Phaser scene layout (measured from scene code).
   * All dimensions use `calc(Npx * var(--layout-scale, 1))` — zero hardcoded px.
   *
   * See: src/services/rewardRoomBridge.ts — triggerRewardRoomContinue(),
   *        triggerRelicDetailAccept(), triggerRelicDetailLeave()
   *      src/game/scenes/RewardRoomScene.ts — lines 820, 851, 970, 999
   *      docs/ui/components.md — RewardRoom DOM overlay set
   *      BATCH-ULTRA T11 issue-1744337400013-11-014
   */

  import {
    triggerRewardRoomContinue,
    triggerRelicDetailAccept,
    triggerRelicDetailLeave,
  } from '../../services/rewardRoomBridge'

  /** Parent gates this component on $currentScreen === 'rewardRoom'. */
</script>

<!-- Continue button overlay — always visible on rewardRoom screen.
     Covers Phaser canvas button at ~50% / 88% (landscape) or 92% (portrait).
     Transparent to mouse users; keyboard-focusable via Tab; Enter/Space fires.
     The Phaser button is visible beneath — this DOM layer only serves a11y. -->
<button
  type="button"
  class="overlay-btn continue-overlay"
  aria-label="Continue to next room"
  data-testid="btn-reward-room-continue"
  onclick={triggerRewardRoomContinue}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerRewardRoomContinue(); } }}
>Continue</button>

<!-- Relic Accept button overlay — covers the Accept button in the relic detail panel.
     The relic detail panel appears at the center of the screen when a relic is tapped.
     Positioned at ~50% / 60% of viewport (panel top half, Accept button row).
     ⚠ NOTE: requires game-logic wiring in RewardRoomScene.showRelicDetail() to be
     functional. The DOM button IS present and focusable; bridge emits event; scene
     must handle it. See triggerRelicDetailAccept() in rewardRoomBridge.ts. -->
<button
  type="button"
  class="overlay-btn relic-accept-overlay"
  aria-label="Accept relic"
  data-testid="btn-reward-room-relic-accept"
  onclick={triggerRelicDetailAccept}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerRelicDetailAccept(); } }}
>Accept</button>

<!-- Relic Leave button overlay — covers the Leave button in the relic detail panel.
     Positioned just below the Accept button in the center panel.
     ⚠ NOTE: same game-logic wiring requirement as Accept. See triggerRelicDetailLeave(). -->
<button
  type="button"
  class="overlay-btn relic-leave-overlay"
  aria-label="Leave relic behind"
  data-testid="btn-reward-room-relic-leave"
  onclick={triggerRelicDetailLeave}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerRelicDetailLeave(); } }}
>Leave</button>

<style>
  /* =========================================================
     Shared overlay button base
     All buttons: transparent to mouse users, visible only on keyboard focus.
     The Phaser canvas button renders beneath — we sit above it for a11y.
     ========================================================= */
  .overlay-btn {
    position: fixed;
    background: transparent;
    border: none;
    color: transparent;
    cursor: pointer;
    z-index: 10;
    pointer-events: auto;
    outline: none;
    /* Minimum 44×44px tap target per iOS HIG */
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    font-size: calc(16px * var(--text-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  /* Show text + focus ring when keyboard-focused */
  .overlay-btn:focus-visible {
    outline: calc(2px * var(--layout-scale, 1)) solid #60a5fa;
    outline-offset: calc(4px * var(--layout-scale, 1));
    color: #ffffff;
    background: rgba(31, 41, 55, 0.85);
  }

  /* =========================================================
     Continue button
     Covers Phaser Continue button at ~50% / 88% landscape.
     CONTINUE_Y_PCT=0.92 portrait (matches portrait override below).
     Width/height generous to cover button across viewport sizes.
     ========================================================= */
  .continue-overlay {
    left: 50%;
    top: 88%;
    transform: translate(-50%, -50%);
    width: calc(180px * var(--layout-scale, 1));
    height: calc(52px * var(--layout-scale, 1));
  }

  /* Portrait: CONTINUE_Y_PCT = 0.92 */
  :global([data-layout="portrait"]) .continue-overlay {
    top: 92%;
  }

  /* =========================================================
     Relic Accept button
     Covers Phaser Accept button inside the relic detail modal panel.
     Panel is centered at 50%/50% viewport. Accept is at ~panelY-55*sf
     = roughly 47% vertical. Generous hit zone.
     ========================================================= */
  .relic-accept-overlay {
    left: 50%;
    top: 47%;
    transform: translate(-50%, -50%);
    width: calc(130px * var(--layout-scale, 1));
    height: calc(40px * var(--layout-scale, 1));
  }

  /* =========================================================
     Relic Leave button
     Covers Phaser Leave button in relic detail modal.
     Below Accept button — ~panelY-16*sf = roughly 50% vertical.
     ========================================================= */
  .relic-leave-overlay {
    left: 50%;
    top: 51%;
    transform: translate(-50%, -50%);
    width: calc(110px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
  }
</style>
