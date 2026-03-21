/**
 * Bridge between game flow controller and RewardRoomScene.
 * Handles scene lifecycle and event forwarding.
 */

import type { Card } from '../data/card-types';
import type { RelicDefinition } from '../data/relics/types';
import type { RewardRoomData, RewardItem } from '../game/scenes/RewardRoomScene';
import { currentScreen } from '../ui/stores/gameState';
import { initRewardSpawnService } from './rewardSpawnService';
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
  return reg[Symbol.for('terra:cardGameManager')] ?? null;
}

/**
 * Wait for the RewardRoomScene to become active, polling up to maxWaitMs.
 * Returns the active scene, or null on timeout.
 */
async function waitForRewardRoomScene(mgr: any, maxWaitMs = 3000): Promise<any | null> {
  const pollIntervalMs = 50;
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
    await new Promise(resolve => setTimeout(resolve, 500));
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
  await new Promise(resolve => setTimeout(resolve, 100));

  const data: RewardRoomData = { rewards };
  if (import.meta.env.DEV) console.log('[RewardRoomBridge] Opening reward room with', rewards.length, 'rewards');
  mgr.startRewardRoom(data);
  if (import.meta.env.DEV) console.log('[RewardRoomBridge] startRewardRoom called');

  // Wait for the scene to become fully active before attaching listeners.
  // Phaser queues scene.start() asynchronously; the scene isn't active until
  // create() has run, which requires at least one game loop iteration.
  const scene = await waitForRewardRoomScene(mgr, 3000);
  if (!scene) {
    console.error('[RewardRoomBridge] RewardRoomScene not found or never became active');
    onComplete();
    return;
  }
  if (import.meta.env.DEV) console.log('[RewardRoomBridge] Scene is active, attaching listeners');

  const cleanup = (): void => {
    clearTimeout(safetyTimeout);
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

  // Safety timeout: if sceneComplete never fires (e.g. scene crash), force-complete after 60s
  const safetyTimeout = setTimeout(() => {
    console.warn('[RewardRoomBridge] Safety timeout - forcing reward completion');
    handleComplete();
  }, 60000);

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
    { id: 'heavy_strike', name: 'Heavy Strike', type: 'attack' as const, ap: 3, effect: 18 },
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
