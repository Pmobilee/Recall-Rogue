// src/game/systems/AnimationSystem.ts
// Phase 29: Character Animation System
// Implements DD-V2-011, DD-V2-249, DD-V2-250

import Phaser from 'phaser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All possible animation states for the miner character.
 * Priority order (highest first): hurt > fall > mine_* > walk_* > idle
 */
export type MinerAnimState =
  | 'idle'
  | 'walk_down' | 'walk_up' | 'walk_left' | 'walk_right'
  | 'mine_down' | 'mine_left' | 'mine_right'
  | 'hurt'
  | 'fall'

export type FacingDir = 'left' | 'right' | 'up' | 'down'

/** Priority values — higher number wins when two states compete. */
const STATE_PRIORITY: Record<MinerAnimState, number> = {
  idle:       0,
  walk_down:  1,
  walk_up:    1,
  walk_left:  1,
  walk_right: 1,
  mine_down:  2,
  mine_left:  2,
  mine_right: 2,
  fall:       3,
  hurt:       4,
}

export interface AnimFrameConfig {
  /** Phaser animation key (also used as texture atlas key in Phaser's AnimationManager). */
  key: MinerAnimState
  /** Start frame index in the horizontal sprite sheet (0-based). */
  startFrame: number
  /** Number of frames in this animation strip. */
  frameCount: number
  /** Frames per second. */
  frameRate: number
  /** -1 = loop indefinitely, 0 = play once then stop. */
  repeat: number
}

// ---------------------------------------------------------------------------
// Frame Layout (matches PHASE-29-CHARACTER-ANIMATION.md §29.1.1)
// ---------------------------------------------------------------------------

/**
 * Sprite sheet: horizontal strip, each frame 32×48 px.
 * Total: 52 frames → sheet is 1664×48 px at 32px resolution, 13312×384 px at 256px.
 *
 * Frame index map:
 *   0–3   idle       (4 frames)
 *   4–9   walk_down  (6 frames)
 *   10–15 walk_up    (6 frames)
 *   16–21 walk_left  (6 frames)
 *   22–27 walk_right (6 frames — mirrored from walk_left in stitch script)
 *   28–33 mine_down  (6 frames)
 *   34–39 mine_left  (6 frames)
 *   40–45 mine_right (6 frames — mirrored from mine_left in stitch script)
 *   46–47 hurt       (2 frames — stumble back + recovery)
 *   48–51 fall       (4 frames — freefall loop)
 */
export const ANIM_CONFIGS: AnimFrameConfig[] = [
  // Idle: gentle breathing loop at 5 fps
  { key: 'idle',       startFrame: 0,  frameCount: 4, frameRate: 5,  repeat: -1 },

  // Walk cycles: 6 frames at 10 fps (one full stride every 0.6 s)
  { key: 'walk_down',  startFrame: 4,  frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_up',    startFrame: 10, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_left',  startFrame: 16, frameCount: 6, frameRate: 10, repeat: -1 },
  { key: 'walk_right', startFrame: 22, frameCount: 6, frameRate: 10, repeat: -1 },

  // Mine swings: 6 frames at 14 fps (one swing every ~0.43 s)
  // repeat: 0 = play once then stop (triggers onComplete for buffered input)
  { key: 'mine_down',  startFrame: 28, frameCount: 6, frameRate: 14, repeat: 0 },
  { key: 'mine_left',  startFrame: 34, frameCount: 6, frameRate: 14, repeat: 0 },
  { key: 'mine_right', startFrame: 40, frameCount: 6, frameRate: 14, repeat: 0 },

  // Hurt: 2 frames at 12 fps, play once
  { key: 'hurt',       startFrame: 46, frameCount: 2, frameRate: 12, repeat: 0 },

  // Fall: 4 frames at 8 fps, loop while falling
  { key: 'fall',       startFrame: 48, frameCount: 4, frameRate: 8,  repeat: -1 },
]

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Map a movement delta to the appropriate walk animation state.
 *
 * @param dx - Horizontal movement delta (negative = left, positive = right)
 * @param dy - Vertical movement delta (negative = up, positive = down)
 * @returns The walk animation state that matches the direction of movement
 */
export function getWalkState(dx: number, dy: number): MinerAnimState {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'walk_left' : 'walk_right'
  }
  return dy < 0 ? 'walk_up' : 'walk_down'
}

/**
 * Map the delta from player to target block to the appropriate mine animation state.
 * Mining upward is not possible in the current game design (DD-V2-011), so only
 * mine_down, mine_left, mine_right are produced.
 *
 * @param dx - Horizontal delta from player to target block
 * @param dy - Vertical delta (positive = block is below; negative = block is above)
 * @returns The mine animation state that matches the swing direction
 */
export function getMineState(dx: number, dy: number): MinerAnimState {
  if (dx < 0) return 'mine_left'
  if (dx > 0) return 'mine_right'
  return 'mine_down'   // dy > 0 (block below) or dy < 0 (mining upward falls back to mine_down)
}

// ---------------------------------------------------------------------------
// MinerAnimController
// ---------------------------------------------------------------------------

/**
 * State machine controller for the miner character sprite.
 *
 * Wraps a Phaser.GameObjects.Sprite and enforces animation priority rules:
 *   hurt > fall > mine_* > walk_* > idle
 *
 * The compressed swing model (DD-V2-249):
 *   - Mining damage is applied on input, before any animation plays
 *   - setMine() starts the visual-only animation AFTER damage is registered
 *   - The `mineSwingFrame` event is emitted at frame 3 of each mine strip for
 *     particle and screen-shake triggers (see 29.3)
 *
 * Usage in MineScene.create():
 *   this.animController = new MinerAnimController(this.playerSprite)
 *   this.animController.registerAnims(this)
 *   this.animController.setIdle()
 *
 * Usage in handleMoveOrMine():
 *   // After moving:
 *   this.animController.setWalk(dx, dy)
 *   // After mining (damage already applied):
 *   this.animController.setMine(dx, dy, () => this.onMineAnimComplete())
 */
export class MinerAnimController {
  private currentState: MinerAnimState = 'idle'
  private isMiningAnim = false
  private isFalling = false
  private isHurt = false

  constructor(private sprite: Phaser.GameObjects.Sprite) {}

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Registers all animation configs on the Phaser scene's AnimationManager.
   * Safe to call multiple times — skips existing keys.
   * Must be called after `miner_sheet` spritesheet is loaded (in MineScene.create()).
   *
   * @param scene - The Phaser scene whose AnimationManager will store the configs
   */
  registerAnims(scene: Phaser.Scene): void {
    // Get the actual frame count from the loaded texture
    const texture = scene.textures.get('miner_sheet')
    const totalFrames = texture ? texture.frameTotal - 1 : 0 // frameTotal includes __BASE

    for (const cfg of ANIM_CONFIGS) {
      if (scene.anims.exists(cfg.key)) continue

      // Skip animations whose frames don't exist in the loaded spritesheet
      if (cfg.startFrame >= totalFrames) {
        // Fall back: create a single-frame animation using frame 0
        scene.anims.create({
          key: cfg.key,
          frames: scene.anims.generateFrameNumbers('miner_sheet', { start: 0, end: 0 }),
          frameRate: cfg.frameRate,
          repeat: cfg.repeat,
        })
        continue
      }

      const endFrame = Math.min(cfg.startFrame + cfg.frameCount - 1, totalFrames - 1)
      const frames = scene.anims.generateFrameNumbers('miner_sheet', {
        start: cfg.startFrame,
        end: endFrame,
      })

      scene.anims.create({
        key: cfg.key,
        frames,
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      })
    }
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  /**
   * Transition to idle state.
   * No-ops if already idle or if a higher-priority animation is playing.
   */
  setIdle(): void {
    if (!this.canTransitionTo('idle')) return
    this.currentState = 'idle'
    this.isMiningAnim = false
    this.sprite.play('idle', true)
  }

  /**
   * Trigger walk animation for the given movement delta.
   * No-ops if the sprite is already playing the matching walk animation,
   * or if a higher-priority animation is playing.
   *
   * @param dx - Horizontal movement delta
   * @param dy - Vertical movement delta
   */
  setWalk(dx: number, dy: number): void {
    const state = getWalkState(dx, dy)
    if (!this.canTransitionTo(state)) return
    if (this.currentState === state) return  // already playing this direction
    this.currentState = state
    this.isMiningAnim = false
    this.sprite.play(state, true)
  }

  /**
   * Trigger a mine animation for a mining action (DD-V2-249).
   * Always restarts the animation even if the same direction is already playing,
   * because each tap should produce a fresh swing from frame 0.
   * The `mineSwingFrame` event is emitted at animation frame 3 (see 29.3).
   *
   * Calling code MUST apply block damage BEFORE calling setMine().
   *
   * @param dx - Delta X from player to target block
   * @param dy - Delta Y from player to target block
   * @param onComplete - Called when the full mine animation finishes; use this to
   *                     flush buffered input or re-enable input gating
   */
  setMine(dx: number, dy: number, onComplete?: () => void): void {
    const state = getMineState(dx, dy)
    // Mine always overrides walk; only hurt and fall can override mine
    if (this.isHurt || this.isFalling) return

    this.currentState = state
    this.isMiningAnim = true
    this.sprite.play(state, true)

    if (onComplete) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.isMiningAnim = false
        onComplete()
      })
    }
  }

  /**
   * Trigger the hurt flash animation.
   * Overrides all states except another in-progress hurt.
   * Automatically reverts to idle when the animation completes.
   */
  setHurt(): void {
    if (this.isHurt) return  // already hurting — don't restart
    this.isHurt = true
    this.isMiningAnim = false
    this.currentState = 'hurt'
    this.sprite.play('hurt', true)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.isHurt = false
      this.setIdle()
    })
  }

  /**
   * Start the fall loop animation (used during layer descent shaft transitions).
   * Loop runs until stopFall() is called.
   */
  startFall(): void {
    if (this.isFalling) return
    this.isFalling = true
    this.isHurt = false
    this.isMiningAnim = false
    this.currentState = 'fall'
    this.sprite.play('fall', true)
  }

  /**
   * Stop the fall animation and return to idle.
   */
  stopFall(): void {
    if (!this.isFalling) return
    this.isFalling = false
    this.setIdle()
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** True while a mine animation is playing (use to gate input). */
  get isPlayingMineAnim(): boolean {
    return this.isMiningAnim
  }

  /** True while the hurt animation is playing. */
  get isPlayingHurt(): boolean {
    return this.isHurt
  }

  /** True while the fall loop is playing. */
  get isPlayingFall(): boolean {
    return this.isFalling
  }

  /** The current animation state key. */
  get state(): MinerAnimState {
    return this.currentState
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if a transition to `targetState` is allowed given the
   * priority of the currently playing state.
   */
  private canTransitionTo(targetState: MinerAnimState): boolean {
    return STATE_PRIORITY[targetState] >= STATE_PRIORITY[this.currentState]
      || (!this.isMiningAnim && !this.isHurt && !this.isFalling)
  }
}
