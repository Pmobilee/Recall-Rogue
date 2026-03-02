import {
  currentScreen,
  inventory,
  showSendUp,
} from '../../ui/stores/gameState'
import type { InventorySlot } from '../../data/types'
import type { MineScene } from '../scenes/MineScene'

/**
 * Manages in-dive inventory operations: syncing from the scene, dropping items,
 * confirming/skipping send-up station interactions, closing the backpack, and using bombs.
 *
 * Extracted from GameManager to keep inventory logic self-contained.
 */
export class InventoryManager {
  private getMineScene: () => MineScene | null

  /** Items secured at a send-up station — preserved across layers, exempt from forced-surface loss. */
  sentUpItems: InventorySlot[] = []

  constructor(getMineScene: () => MineScene | null) {
    this.getMineScene = getMineScene
  }

  /** Sync inventory from MineScene to the Svelte inventory store */
  syncInventoryFromScene(): void {
    const scene = this.getMineScene()
    if (!scene) return
    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory) {
      inventory.set([...sceneAny.inventory])
    }
  }

  /** Drop an item from the backpack during a dive */
  dropItem(index: number): void {
    const scene = this.getMineScene()
    if (!scene) return

    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory && sceneAny.inventory[index]) {
      sceneAny.inventory[index] = { type: 'empty' }
      inventory.set([...sceneAny.inventory])
    }
  }

  /**
   * Called by SendUpOverlay when the player confirms their item selection.
   * Passes selected items to MineScene (which removes them from in-run inventory),
   * caches them on the InventoryManager so they survive layer transitions, and
   * hides the overlay.
   */
  confirmSendUp(selectedItems: InventorySlot[]): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromSendUp(selectedItems)
      // Merge newly sent-up items into our accumulator.
      this.sentUpItems.push(...selectedItems)
    }
    showSendUp.set(false)
    currentScreen.set('mining')
  }

  /**
   * Called by SendUpOverlay when the player skips without sending anything.
   * Simply resumes mining.
   */
  skipSendUp(): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromSendUp([])
    }
    showSendUp.set(false)
    currentScreen.set('mining')
  }

  /** Close backpack overlay and return to mining */
  closeBackpack(): void {
    currentScreen.set('mining')
  }

  /** Trigger bomb detonation in the active MineScene. */
  useBomb(): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.useBomb()
    }
  }
}
