// src/game/systems/AnimationSystem.ts

import Phaser from 'phaser'

export type MinerAnimState =
  | 'idle'
  | 'walk_left' | 'walk_right' | 'walk_up' | 'walk_down'
  | 'mine_left' | 'mine_right' | 'mine_down'

export type FacingDir = 'left' | 'right' | 'up' | 'down'

export interface AnimFrameConfig {
  key: MinerAnimState
  startFrame: number
  frameCount: number
  frameRate: number
  repeat: number  // -1 = loop, 0 = play once
}

/**
 * Sprite sheet layout — horizontal strip, each frame 32×32.
 * Total: 52 frames (1664×32 at lo-res)
 *
 * Row order:
 *   0-3:   idle (4 frames)
 *   4-9:   walk_left (6 frames)
 *   10-15: walk_right (6 frames)
 *   16-21: walk_up (6 frames)
 *   22-27: walk_down (6 frames)
 *   28-35: mine_left (8 frames)
 *   36-43: mine_right (8 frames)
 *   44-51: mine_down (8 frames)
 */
export const ANIM_CONFIGS: AnimFrameConfig[] = [
  { key: 'idle',       startFrame: 0,  frameCount: 4, frameRate: 5,  repeat: -1 },
  { key: 'walk_left',  startFrame: 4,  frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_right', startFrame: 10, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_up',    startFrame: 16, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_down',  startFrame: 22, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'mine_left',  startFrame: 28, frameCount: 8, frameRate: 14, repeat: 0  },
  { key: 'mine_right', startFrame: 36, frameCount: 8, frameRate: 14, repeat: 0  },
  { key: 'mine_down',  startFrame: 44, frameCount: 8, frameRate: 14, repeat: 0  },
]

/**
 * Determines the walk animation state from a movement delta.
 * @param dx - Horizontal movement delta (negative = left, positive = right)
 * @param dy - Vertical movement delta (negative = up, positive = down)
 * @returns The appropriate walk animation state
 */
export function getWalkState(dx: number, dy: number): MinerAnimState {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'walk_left' : 'walk_right'
  }
  return dy < 0 ? 'walk_up' : 'walk_down'
}

/**
 * Determines the mine animation state from a target position relative to player.
 * @param dx - Horizontal delta from player to target block (negative = left, positive = right)
 * @param dy - Vertical delta from player to target block (used when dx is zero)
 * @returns The appropriate mine animation state
 */
export function getMineState(dx: number, dy: number): MinerAnimState {
  if (dx < 0) return 'mine_left'
  if (dx > 0) return 'mine_right'
  return 'mine_down'
}

/**
 * State machine controller — tracks current state and triggers Phaser animation playback.
 * Wraps a Phaser.GameObjects.Sprite and provides a clean API for transitioning between
 * idle, walk, and mine animation states without redundant replays.
 */
export class MinerAnimController {
  private currentState: MinerAnimState = 'idle'
  private isMining = false

  constructor(private sprite: Phaser.GameObjects.Sprite) {}

  /**
   * Registers all animation configs on the Phaser scene's animation manager.
   * Call once during MineScene.create() after the sprite is created.
   * Safe to call multiple times — skips any animation key that already exists.
   * @param scene - The Phaser scene whose animation manager will receive the configs
   */
  registerAnims(scene: Phaser.Scene): void {
    for (const cfg of ANIM_CONFIGS) {
      if (!scene.anims.exists(cfg.key)) {
        const frames = scene.anims.generateFrameNumbers('miner_sheet', {
          start: cfg.startFrame,
          end: cfg.startFrame + cfg.frameCount - 1,
        })
        scene.anims.create({
          key: cfg.key,
          frames,
          frameRate: cfg.frameRate,
          repeat: cfg.repeat,
        })
      }
    }
  }

  /**
   * Transition to idle. Safe to call every frame when nothing is happening.
   * No-ops if the sprite is already in the idle state.
   */
  setIdle(): void {
    if (this.currentState !== 'idle') {
      this.currentState = 'idle'
      this.isMining = false
      this.sprite.play('idle', true)
    }
  }

  /**
   * Trigger a walk animation for a movement delta.
   * No-ops if the sprite is already playing the matching walk animation.
   * @param dx - Horizontal movement delta
   * @param dy - Vertical movement delta
   */
  setWalk(dx: number, dy: number): void {
    const state = getWalkState(dx, dy)
    if (this.currentState !== state) {
      this.currentState = state
      this.isMining = false
      this.sprite.play(state, true)
    }
  }

  /**
   * Trigger a mine animation for a mining action.
   * Always restarts the animation even if the same direction is already playing,
   * ensuring the swing resets on each new block hit.
   * @param dx - Delta X from player to target block
   * @param dy - Delta Y from player to target block
   * @param onComplete - Callback invoked when the mine animation finishes playing
   */
  setMine(dx: number, dy: number, onComplete?: () => void): void {
    const state = getMineState(dx, dy)
    this.currentState = state
    this.isMining = true
    this.sprite.play(state, true)
    if (onComplete) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        onComplete()
        this.isMining = false
      })
    }
  }

  /**
   * Whether a mine animation is currently playing.
   * Use this to gate input or block new mine actions until the swing completes.
   */
  get isPlayingMineAnim(): boolean {
    return this.isMining
  }
}
