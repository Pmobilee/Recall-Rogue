/**
 * Bridge between game flow controller and RewardRoomScene.
 * Handles scene lifecycle and event forwarding.
 */

import type { Card } from '../data/card-types';
import type { RelicDefinition } from '../data/relics/types';
import type { RewardRoomData, RewardItem } from '../game/scenes/RewardRoomScene';
import { currentScreen } from '../ui/stores/gameState';
import { initRewardSpawnService } from './rewardSpawnService';
import { turboDelay } from '../utils/turboMode';
import { writable } from 'svelte/store';

/** Currently displayed card in the reward room detail overlay. */
export const rewardCardDetail = writable<Card | null>(null);

/** Callbacks for the current card detail. */
let cardDetailCallbacks: { onAccept: () => void; onReject: () => void } | null = null;

/** Get the callbacks for the current card detail overlay. */
export function getCardDetailCallbacks(): { onAccept: () => void; onReject: () => void } | null {
  return cardDetailCallbacks;
}

/** Get the CardGameManager singleton. */
function getManager(): any {
  const reg = globalThis as Record<symbol, unknown>;
  return reg[Symbol.for('rr:cardGameManager')] ?? null;
}

/**
 * Trigger the Continue button from the DOM accessibility overlay.
 *
 * Emits 'sceneComplete' directly on the active RewardRoomScene when available.
 * If the scene is inactive (race: scene stopped before button was clicked, or
 * listener-attachment timing gap), falls back to forceProceedAfterReward() via
 * a lazy import to avoid circular dependency. This ensures the Continue button
 * NEVER softlocks the player regardless of scene state. See bug 2026-05-01.
 *
 * Called by the DOM `<button>` overlay in CardApp.svelte when the user presses
 * Enter/Space or clicks the a11y overlay. See BATCH-ULTRA T11 issue-1744337400013-11-014.
 */
export function triggerRewardRoomContinue(): void {
  const mgr = getManager();
  const scene = mgr?.getRewardRoomScene?.();
  if (scene && scene.scene.isActive()) {
    scene.events.emit('sceneComplete');
    return;
  }
  // Softlock escape: scene is inactive but Continue was clicked — force progression.
  // This covers the listener-race path where sceneComplete fired before listeners
  // attached, causing handleComplete to never run and stopRewardRoom to be skipped,
  // leaving currentScreen stuck on 'rewardRoom'. Bug 2026-05-01.
  console.warn('[RewardRoomBridge] Continue clicked with no active scene — forcing proceedAfterReward (softlock escape)');
  void import('./gameFlowController').then(({ forceProceedAfterReward }) => {
    forceProceedAfterReward();
  });
}

/**
 * Trigger the Accept button for the currently-shown relic detail panel.
 *
 * Emits 'relicDetailAccept' on the active RewardRoomScene. The scene MUST
 * listen for this event in showRelicDetail() and react accordingly (collect
 * the relic, clear overlay, emit 'relicAccepted').
 *
 * NOTE (BATCH-ULTRA T11): RewardRoomScene.ts lines 820/851 are Phaser-only
 * interactive objects without DOM equivalents. This function provides the DOM
 * → scene API bridge. A game-logic agent must add:
 *   this.events.once('relicDetailAccept', () => { acceptBtn.emit('pointerdown'); })
 *   this.events.once('relicDetailLeave', () => { leaveBtn.emit('pointerdown'); })
 * inside showRelicDetail() to complete the wiring.
 *
 * Called by the DOM <button data-testid=btn-reward-room-relic-accept> overlay
 * in RewardRoomOverlay.svelte. See BATCH-ULTRA T11.
 */
export function triggerRelicDetailAccept(): void {
  const mgr = getManager();
  if (!mgr) {
    console.warn('[RewardRoomBridge] triggerRelicDetailAccept: no CardGameManager found');
    return;
  }
  const scene = mgr.getRewardRoomScene();
  if (!scene || !scene.scene.isActive()) {
    console.warn('[RewardRoomBridge] triggerRelicDetailAccept: no active RewardRoomScene');
    return;
  }
  // Requires RewardRoomScene to listen for this event inside showRelicDetail().
  // See function JSDoc — game-logic wiring pending.
  scene.events.emit('relicDetailAccept');
}

/**
 * Trigger the Leave button for the currently-shown relic detail panel.
 *
 * Emits 'relicDetailLeave' on the active RewardRoomScene. The scene MUST
 * listen for this event in showRelicDetail() and call clearOverlay().
 *
 * NOTE: Same wiring requirement as triggerRelicDetailAccept(). See that
 * function's JSDoc for the game-logic change needed to complete the bridge.
 *
 * Called by the DOM <button data-testid=btn-reward-room-relic-leave> overlay
 * in RewardRoomOverlay.svelte. See BATCH-ULTRA T11.
 */
export function triggerRelicDetailLeave(): void {
  const mgr = getManager();
  if (!mgr) {
    console.warn('[RewardRoomBridge] triggerRelicDetailLeave: no CardGameManager found');
    return;
  }
  const scene = mgr.getRewardRoomScene();
  if (!scene || !scene.scene.isActive()) {
    console.warn('[RewardRoomBridge] triggerRelicDetailLeave: no active RewardRoomScene');
    return;
  }
  // Requires RewardRoomScene to listen for this event inside showRelicDetail().
  // See triggerRelicDetailAccept() JSDoc — game-logic wiring pending.
  scene.events.emit('relicDetailLeave');
}

/**
 * Poll for a RewardRoomScene instance (not necessarily active yet), giving up
 * after maxWaitMs. Used to grab the instance early enough to attach listeners
 * before the scene's create() has finished — prevents the race where
 * sceneComplete fires before our handlers are registered.
 *
 * Returns null if no instance appears within the timeout.
 */
async function waitForRewardRoomSceneInstance(mgr: any, maxWaitMs = 500): Promise<any | null> {
  const pollIntervalMs = turboDelay(50);
  const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);

  for (let i = 0; i < maxAttempts; i++) {
    const scene = mgr.getRewardRoomScene();
    if (scene) {
      if (import.meta.env.DEV) console.log(`[RewardRoomBridge] Scene instance available after ${(i + 1) * pollIntervalMs}ms (not yet active)`);
      return scene;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  return null;
}

/**
 * Wait for the RewardRoomScene to become active, polling up to maxWaitMs.
 * Returns the active scene, or null on timeout.
 */
async function waitForRewardRoomScene(mgr: any, maxWaitMs = 3000): Promise<any | null> {
  const pollIntervalMs = turboDelay(50);
  const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);

  for (let i = 0; i < maxAttempts; i++) {
    const scene = mgr.getRewardRoomScene();
    if (scene && scene.scene.isActive()) {
      if (import.meta.env.DEV) console.log(`[RewardRoomBridge] Scene active after ${(i + 1) * pollIntervalMs}ms`);
      return scene;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // Log final state for debugging
  const scene = mgr.getRewardRoomScene();
  console.error(
    '[RewardRoomBridge] Scene did not become active within',
    maxWaitMs,
    'ms. scene:', scene ? 'exists' : 'null',
    'isActive:', scene?.scene?.isActive(),
    'isPaused:', scene?.scene?.isPaused(),
  );
  return null;
}

/** Open the reward room scene with the given rewards. */
export async function openRewardRoom(
  rewards: RewardItem[],
  onGoldCollected: (amount: number) => void,
  onVialCollected: (healAmount: number) => void,
  onCardAccepted: (card: Card) => void,
  onRelicAccepted: (relic: RelicDefinition) => void,
  onComplete: () => void,
): Promise<void> {
  // Ensure spawn service is ready
  await initRewardSpawnService();

  let mgr = getManager();
  if (!mgr) {
    // Boot Phaser if it hasn't been initialized yet
    const { CardGameManager } = await import('../game/CardGameManager');
    const instance = CardGameManager.getInstance();
    instance.boot();
    // Wait for Phaser to initialize
    await new Promise(resolve => setTimeout(resolve, turboDelay(500)));
    mgr = getManager();
    if (import.meta.env.DEV) console.log('[RewardRoomBridge] After boot, mgr:', mgr ? 'found' : 'null');
    if (!mgr) {
      console.error('[RewardRoomBridge] Failed to boot CardGameManager');
      onComplete();
      return;
    }
  }

  // Set screen to show Phaser container
  currentScreen.set('rewardRoom');

  // Small delay to let Phaser container become visible
  await new Promise(resolve => setTimeout(resolve, turboDelay(100)));

  const data: RewardRoomData = { rewards };
  if (import.meta.env.DEV) console.log('[RewardRoomBridge] Opening reward room with', rewards.length, 'rewards');
  mgr.startRewardRoom(data);
  if (import.meta.env.DEV) console.log('[RewardRoomBridge] startRewardRoom called');

  // --- Listener-race fix (bug 2026-05-01) ---
  // Attach listeners as early as possible — get the scene INSTANCE (not
  // necessarily active yet) within a short 500ms window. The Phaser scene
  // EventEmitter exists on the instance as soon as scene.start() queues it,
  // before create() has run. Attaching here guarantees 'sceneComplete' cannot
  // fire into a void between scene instantiation and activation.
  //
  // After attaching early, we still call waitForRewardRoomScene() (3s) as a
  // sanity check that the scene actually became fully active.
  const earlyScene = await waitForRewardRoomSceneInstance(mgr, 500);

  const scene = earlyScene ?? await waitForRewardRoomScene(mgr, 3000);
  if (!scene) {
    console.error('[RewardRoomBridge] RewardRoomScene not found or never became active');
    onComplete();
    return;
  }

  if (import.meta.env.DEV) {
    const activeNow = scene.scene.isActive();
    console.log(`[RewardRoomBridge] Attaching listeners (scene active: ${activeNow}) — early attachment: ${!!earlyScene}`);
  }

  const cleanup = (): void => {
    if (safetyTimeout) clearTimeout(safetyTimeout);
    scene.events.off('goldCollected', handleGold);
    scene.events.off('vialCollected', handleVial);
    scene.events.off('cardAccepted', handleCard);
    scene.events.off('relicAccepted', handleRelic);
    scene.events.off('sceneComplete', handleComplete);
    scene.events.off('cardTapped', handleCardTapped);
  };

  const handleGold = (amount: number): void => onGoldCollected(amount);
  const handleVial = (healAmount: number): void => onVialCollected(healAmount);
  const handleCard = (card: Card): void => onCardAccepted(card);
  const handleRelic = (relic: RelicDefinition): void => onRelicAccepted(relic);
  const handleComplete = (): void => {
    if (import.meta.env.DEV) console.log('[RewardRoomBridge] Reward room complete, calling onComplete');
    cleanup();
    mgr.stopRewardRoom();
    onComplete();
  };

  // AR-225/AR-240: Safety timeout removed per user request — player can take as long as they want.
  // Previously: 60s timeout would force-complete the reward room.
  const safetyTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleCardTapped = (card: Card, item: any): void => {
    rewardCardDetail.set(card);
    cardDetailCallbacks = {
      onAccept: () => {
        rewardCardDetail.set(null);
        cardDetailCallbacks = null;
        const rewardScene = mgr.getRewardRoomScene();
        if (rewardScene) {
          rewardScene.acceptCard(item);
        }
        onCardAccepted(card);
      },
      onReject: () => {
        rewardCardDetail.set(null);
        cardDetailCallbacks = null;
        const rewardScene = mgr.getRewardRoomScene();
        if (rewardScene) {
          rewardScene.rejectCard();
        }
      },
    };
  };

  scene.events.on('goldCollected', handleGold);
  scene.events.on('vialCollected', handleVial);
  scene.events.on('cardAccepted', handleCard);
  scene.events.on('relicAccepted', handleRelic);
  scene.events.on('sceneComplete', handleComplete);
  scene.events.on('cardTapped', handleCardTapped);
}

/** Debug: open reward room with fake test data. */
export async function openTestRewardRoom(): Promise<void> {
  const MECHANIC_POOL = [
    { id: 'strike', name: 'Strike', type: 'attack' as const, ap: 1, effect: 8 },
    { id: 'block', name: 'Block', type: 'shield' as const, ap: 1, effect: 6 },
    { id: 'multi_hit', name: 'Multi Hit', type: 'attack' as const, ap: 2, effect: 4 },
    { id: 'thorns', name: 'Thorns', type: 'shield' as const, ap: 1, effect: 6 },
    { id: 'foresight', name: 'Foresight', type: 'utility' as const, ap: 0, effect: 2 },
    { id: 'scout', name: 'Scout', type: 'utility' as const, ap: 1, effect: 2 },
    { id: 'empower', name: 'Empower', type: 'buff' as const, ap: 1, effect: 50 },
    { id: 'weaken', name: 'Weaken', type: 'debuff' as const, ap: 1, effect: 2 },
    { id: 'hex', name: 'Hex', type: 'debuff' as const, ap: 1, effect: 3 },
    { id: 'piercing', name: 'Piercing', type: 'attack' as const, ap: 1, effect: 6 },
    { id: 'fortify', name: 'Fortify', type: 'shield' as const, ap: 2, effect: 7 },
    { id: 'cleanse', name: 'Cleanse', type: 'utility' as const, ap: 1, effect: 0 },
    { id: 'quicken', name: 'Quicken', type: 'buff' as const, ap: 0, effect: 0 },
    { id: 'adapt', name: 'Adapt', type: 'buff' as const, ap: 1, effect: 1 },
    { id: 'execute', name: 'Execute', type: 'attack' as const, ap: 2, effect: 5 },
    { id: 'lifetap', name: 'Lifetap', type: 'attack' as const, ap: 2, effect: 8 },
    { id: 'heavy_strike', name: 'Crush', type: 'attack' as const, ap: 2, effect: 18 },
    { id: 'expose', name: 'Expose', type: 'debuff' as const, ap: 1, effect: 1 },
    { id: 'recycle', name: 'Recycle', type: 'utility' as const, ap: 1, effect: 3 },
    { id: 'mirror', name: 'Mirror', type: 'buff' as const, ap: 1, effect: 1 },
  ];

  const DOMAINS = ['general_knowledge', 'natural_sciences', 'history', 'geography', 'animals_wildlife', 'space_astronomy'] as const;

  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  function makeCard(upgraded: boolean): RewardItem {
    const m = pick(MECHANIC_POOL);
    return {
      type: 'card',
      card: {
        id: `test_${m.id}_${Math.random().toString(36).slice(2, 6)}`,
        factId: `fact_${Math.random().toString(36).slice(2, 8)}`,
        cardType: m.type,
        domain: pick(DOMAINS),
        tier: pick(['1', '2a', '2b'] as const),
        baseEffectValue: m.effect + (upgraded ? 3 : 0),
        effectMultiplier: 1,
        mechanicId: m.id,
        mechanicName: upgraded ? m.name + '+' : m.name,
        apCost: m.ap,
        isUpgraded: upgraded,
      } as Card,
    };
  }

  const testRewards: RewardItem[] = [];

  // Always gold (random 10-80)
  testRewards.push({ type: 'gold', amount: 10 + Math.floor(Math.random() * 70) });

  // 60% chance health vial
  if (Math.random() < 0.6) {
    const isLarge = Math.random() < 0.3;
    testRewards.push({
      type: 'health_vial',
      size: isLarge ? 'large' : 'small',
      healAmount: isLarge ? 20 + Math.floor(Math.random() * 15) : 8 + Math.floor(Math.random() * 10),
    });
  }

  // 2-3 cards, each with a unique mechanic, one might be upgraded
  const cardCount = 2 + (Math.random() < 0.5 ? 1 : 0);
  const upgradeIdx = Math.random() < 0.4 ? Math.floor(Math.random() * cardCount) : -1;
  const usedMechanicIds = new Set<string>();
  for (let i = 0; i < cardCount; i++) {
    // Pick a mechanic not yet used
    const available = MECHANIC_POOL.filter(m => !usedMechanicIds.has(m.id));
    if (available.length === 0) break;
    const m = pick(available);
    usedMechanicIds.add(m.id);
    testRewards.push({
      type: 'card',
      card: {
        id: `test_${m.id}_${Math.random().toString(36).slice(2, 6)}`,
        factId: `fact_${Math.random().toString(36).slice(2, 8)}`,
        cardType: m.type,
        domain: pick(DOMAINS),
        tier: pick(['1', '2a', '2b'] as const),
        baseEffectValue: m.effect + (i === upgradeIdx ? 3 : 0),
        effectMultiplier: 1,
        mechanicId: m.id,
        mechanicName: i === upgradeIdx ? m.name + '+' : m.name,
        apCost: m.ap,
        isUpgraded: i === upgradeIdx,
      } as Card,
    });
  }

  await openRewardRoom(
    testRewards,
    (amount) => { if (import.meta.env.DEV) console.log('[TestRewardRoom] Gold collected:', amount); },
    (heal) => { if (import.meta.env.DEV) console.log('[TestRewardRoom] Vial collected:', heal); },
    (card) => { if (import.meta.env.DEV) console.log('[TestRewardRoom] Card accepted:', card.mechanicName); },
    (relic) => { if (import.meta.env.DEV) console.log('[TestRewardRoom] Relic accepted:', relic.name); },
    () => {
      if (import.meta.env.DEV) console.log('[TestRewardRoom] Scene complete');
      currentScreen.set('hub');
    },
  );
}
