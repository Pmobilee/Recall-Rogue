<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { purchaseProduct, kidModeIapGuard } from '../../services/iapService'

  interface Props {
    onClose: () => void
  }
  let { onClose }: Props = $props()

  type PioneerPackExtras = {
    hasPioneerPack?: boolean
    pioneerPackDismissed?: boolean
    installDate?: number
    tankBank?: number
    purchasedProducts?: string[]
  }

  const PIONEER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

  const isVisible = $derived(() => {
    const save = $playerSave
    if (!save) return false
    const s = save as typeof save & PioneerPackExtras
    if (s.hasPioneerPack) return false
    if (s.pioneerPackDismissed) return false
    const installDate = s.installDate ?? save.createdAt
    return Date.now() - installDate < PIONEER_WINDOW_MS
  })

  const daysRemaining = $derived(() => {
    const save = $playerSave
    if (!save) return 0
    const s = save as typeof save & PioneerPackExtras
    const installDate = s.installDate ?? save.createdAt
    const elapsed = Date.now() - installDate
    return Math.max(0, Math.ceil((PIONEER_WINDOW_MS - elapsed) / (24 * 60 * 60 * 1000)))
  })

  let purchasing = $state(false)

  /** True when player is in kid mode (parents must approve purchases). */
  const isKidMode = $derived($playerSave?.ageRating === 'kid')

  async function doPurchase() {
    purchasing = true
    const result = await purchaseProduct('com.terragacha.pioneerpack')
    if (result.success) {
      playerSave.update(s => {
        if (!s) return s
        const extra = s as typeof s & PioneerPackExtras
        return {
          ...s,
          hasPioneerPack: true,
          minerals: { ...s.minerals, greyMatter: (s.minerals.greyMatter ?? 0) + 500 },
          tankBank: (extra.tankBank ?? 0) + 3,
          purchasedProducts: [...(extra.purchasedProducts ?? []), 'com.terragacha.pioneerpack'],
          ownedCosmetics: [...s.ownedCosmetics, 'pioneer_pickaxe'],
        } as typeof s
      })
      persistPlayer()
    }
    // In dev/browser mode, IAP not available — silently handle
    purchasing = false
    onClose()
  }

  function handlePurchase() {
    kidModeIapGuard(() => { void doPurchase() })
  }

  function handleDismiss() {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, pioneerPackDismissed: true }
    })
    persistPlayer()
    onClose()
  }
</script>

{#if isVisible()}
  <div class="pioneer-overlay" data-testid="pioneer-pack-modal">
    <div class="pioneer-modal">
      <h2 class="pioneer-title">Pioneer Pack</h2>
      <p class="pioneer-subtitle">{daysRemaining()} days remaining</p>

      <div class="pioneer-items">
        <div class="item">
          <span class="item-icon">💎</span>
          <span class="item-text">500 Grey Matter</span>
        </div>
        <div class="item">
          <span class="item-icon">🏆</span>
          <span class="item-text">Guaranteed Rare+ Artifact</span>
        </div>
        <div class="item">
          <span class="item-icon">⛏️</span>
          <span class="item-text">Pioneer's Pickaxe Skin</span>
        </div>
        <div class="item">
          <span class="item-icon">🫧</span>
          <span class="item-text">3 Bonus Oxygen Tanks</span>
        </div>
        <div class="item">
          <span class="item-icon">🎖️</span>
          <span class="item-text">Pioneer Badge</span>
        </div>
      </div>

      <button
        class="purchase-btn"
        class:ask-parent-btn={isKidMode}
        onclick={handlePurchase}
        disabled={purchasing}
        aria-label={isKidMode ? 'Ask a Parent to purchase Pioneer Pack' : 'Purchase Pioneer Pack for $4.99'}
      >
        {purchasing ? 'Processing...' : isKidMode ? 'Ask a Parent' : '$4.99 — One-Time Offer'}
      </button>
      <button class="dismiss-btn" onclick={handleDismiss}>
        Not now
      </button>
    </div>
  </div>
{/if}

<style>
  .pioneer-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    pointer-events: auto;
  }
  .pioneer-modal {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border: 2px solid #e2b714;
    border-radius: 12px;
    padding: 24px;
    max-width: 340px;
    width: 90%;
    text-align: center;
    font-family: var(--font-rpg);
  }
  .pioneer-title {
    color: #e2b714;
    font-size: 16px;
    margin: 0 0 4px;
  }
  .pioneer-subtitle {
    color: #9ca3af;
    font-size: 8px;
    margin: 0 0 16px;
  }
  .pioneer-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }
  .item-icon {
    font-size: 16px;
  }
  .item-text {
    color: #e5e7eb;
    font-size: 9px;
    text-align: left;
  }
  .purchase-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #e2b714, #d4a010);
    color: #1a1a2e;
    border: none;
    border-radius: 8px;
    font-family: var(--font-rpg);
    font-size: 10px;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .purchase-btn:hover {
    filter: brightness(1.1);
  }
  .purchase-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Kid mode: "Ask a Parent" button — amber/orange instead of gold */
  .ask-parent-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }
  .dismiss-btn {
    width: 100%;
    padding: 8px;
    background: transparent;
    color: #6b7280;
    border: 1px solid #374151;
    border-radius: 8px;
    font-family: var(--font-rpg);
    font-size: 8px;
    cursor: pointer;
  }
  .dismiss-btn:hover {
    color: #9ca3af;
    border-color: #4b5563;
  }
</style>
