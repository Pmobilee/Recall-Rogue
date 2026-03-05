/**
 * MineTileRenderer — extracted rendering functions from MineScene.
 * Each function receives the MineScene instance as its first parameter.
 * Pure utility functions (shiftColor, seededModulo) need no scene reference.
 */
import Phaser from 'phaser'
import { BALANCE } from '../../data/balance'
import { BlockType, type MineCell } from '../../data/types'
import { resolveTileSpriteKey, transitionTileSpriteKey } from '../../data/biomeTileSpec'
import type { TileCategory } from '../../data/biomeTileSpec'
import { computeDepthModifiers } from '../systems/DepthGradientSystem'
import { BlockAnimSystem } from '../systems/BlockAnimSystem'
import { miniMapData } from '../../ui/stores/miniMap'
import type { MineScene } from './MineScene'

const TILE_SIZE = BALANCE.TILE_SIZE

/** Block-type to fallback color mapping — used only by rendering. */
export const BLOCK_COLORS: Record<BlockType, number> = {
  [BlockType.Empty]: 0x3a3550,
  [BlockType.Dirt]: 0x5c4033,
  [BlockType.SoftRock]: 0x7a6652,
  [BlockType.Stone]: 0x6b6b6b,
  [BlockType.HardRock]: 0x4a4a4a,
  [BlockType.MineralNode]: 0x4ecca3,
  [BlockType.ArtifactNode]: 0xe94560,
  [BlockType.OxygenCache]: 0x5dade2,
  [BlockType.QuizGate]: 0xffd369,
  [BlockType.UpgradeCrate]: 0xc49b1a,
  [BlockType.ExitLadder]: 0x00ff88,
  [BlockType.DescentShaft]: 0x6633cc,
  [BlockType.RelicShrine]: 0xd4af37,
  [BlockType.QuoteStone]: 0x7788aa,
  [BlockType.LavaBlock]: 0xcc3300,
  [BlockType.GasPocket]: 0x446633,
  [BlockType.UnstableGround]: 0x8B7355,
  [BlockType.SendUpStation]: 0x44aadd,
  [BlockType.OxygenTank]: 0x00ccaa,
  [BlockType.DataDisc]: 0x22aacc,
  [BlockType.FossilNode]: 0xd4a574,
  [BlockType.Chest]: 0xffd700,
  [BlockType.Tablet]: 0x8888cc,
  [BlockType.OfferingAltar]: 0x9944cc,
  [BlockType.LockedBlock]: 0x4a4a4a,
  [BlockType.RecipeFragmentNode]: 0x44ccaa,
  [BlockType.ChallengeGate]: 0xff6600,
  [BlockType.WallText]: 0x997755,
  [BlockType.Unbreakable]: 0x2c2c2c,
}

/** Pure function — shifts RGB channels of a color by a signed amount. */
export function shiftColor(color: number, amount: number): number {
  const r = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255)
  const g = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255)
  const b = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255)
  return (r << 16) | (g << 8) | b
}

/** Pure function — returns a deterministic modulo value seeded by tile position. */
export function seededModulo(tileX: number, tileY: number, salt: number, modulo: number): number {
  const rawSeed = tileX * 31 + tileY * 17 + salt * 13
  const positiveSeed = ((rawSeed % 7919) + 7919) % 7919
  return positiveSeed % modulo
}

/**
 * Returns the biome accent tint color for critical special blocks (DD-V2-241).
 * Critical blocks (QuizGate, DescentShaft, ExitLadder) use a universal shape
 * with biome-specific accent coloring for visual integration.
 */
export function getBiomeAccentTint(scene: MineScene): number {
  return scene.currentBiome.palette?.accent ?? scene.currentBiome.ambientColor
}

/**
 * Phase 33.6: Returns the transition edge direction for a cell based on its grid position.
 * Top rows return 'n', bottom rows return 's'.
 */
export function getTransitionEdge(scene: MineScene, tileX: number, tileY: number): 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' {
  if (tileY < 3) return 'n'
  if (tileY >= scene.gridHeight - 3) return 's'
  if (tileX < 3) return 'w'
  if (tileX >= scene.gridWidth - 3) return 'e'
  return 'n'
}

/**
 * Phase 33.5: Draws a semi-transparent dark overlay over the entire viewport.
 * Overlay alpha scales with depth: 0 at layer 0, ~0.30 at layer 19.
 */
export function drawDepthOverlay(scene: MineScene): void {
  if (!scene.depthOverlayGraphics) return
  const { viewportDarkAlpha } = computeDepthModifiers(scene.currentLayer, scene.currentBiome)
  scene.depthOverlayGraphics.clear()
  if (viewportDarkAlpha > 0) {
    const cam = scene.cameras.main
    scene.depthOverlayGraphics.fillStyle(0x000000, viewportDarkAlpha)
    scene.depthOverlayGraphics.fillRect(0, 0, cam.width, cam.height)
  }
}

/** Returns a pooled sprite from the sprite pool, creating one if necessary. */
export function getPooledSprite(scene: MineScene, key: string, x: number, y: number): Phaser.GameObjects.Image {
  const POOL_CEILING = 500
  const idx = scene.itemSpritePoolIndex >= POOL_CEILING ? POOL_CEILING - 1 : scene.itemSpritePoolIndex
  let sprite = scene.itemSpritePool[idx]
  if (!sprite) {
    sprite = scene.add.image(x, y, key)
    scene.itemSpritePool.push(sprite)
  } else {
    sprite.setTexture(key)
    sprite.setPosition(x, y)
    sprite.setVisible(true)
  }
  sprite.setDisplaySize(TILE_SIZE, TILE_SIZE)
  sprite.setDepth(5)
  scene.itemSpritePoolIndex++
  return sprite
}

/** Renders the block-specific sprite/pattern for a single cell. */
export function drawBlockPattern(scene: MineScene, cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
  const cx = px + TILE_SIZE * 0.5
  const cy = py + TILE_SIZE * 0.5
  switch (cell.type) {
    case BlockType.Dirt:
    case BlockType.SoftRock: {
      const mask = cell.tileVariant ?? 0
      const category: TileCategory = 'soil'
      const biomeSpriteKey = resolveTileSpriteKey(scene.currentBiome.id, category, mask, scene.textures)
      if (cell.isTransitionZone && scene.transitionBiomeId) {
        const edgeDir = getTransitionEdge(scene, tileX, tileY)
        const transKey = transitionTileSpriteKey(scene.currentBiome.id, scene.transitionBiomeId, category, edgeDir)
        if (scene.textures.exists(transKey)) {
          getPooledSprite(scene, transKey, cx, cy)
          break
        }
      }
      getPooledSprite(scene, biomeSpriteKey, cx, cy)
      break
    }
    case BlockType.Stone:
    case BlockType.HardRock:
    case BlockType.Unbreakable: {
      const mask = cell.tileVariant ?? 0
      const category: TileCategory = 'rock'
      const biomeSpriteKey = resolveTileSpriteKey(scene.currentBiome.id, category, mask, scene.textures)
      if (cell.isTransitionZone && scene.transitionBiomeId) {
        const edgeDir = getTransitionEdge(scene, tileX, tileY)
        const transKey = transitionTileSpriteKey(scene.currentBiome.id, scene.transitionBiomeId, category, edgeDir)
        if (scene.textures.exists(transKey)) {
          getPooledSprite(scene, transKey, cx, cy)
          break
        }
      }
      getPooledSprite(scene, biomeSpriteKey, cx, cy)
      break
    }
    case BlockType.OxygenCache: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.OxygenCache, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_oxygen_cache', cx, cy)
      break
    }
    case BlockType.UpgradeCrate: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.UpgradeCrate, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_upgrade_crate', cx, cy)
      break
    }
    case BlockType.QuizGate: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.QuizGate, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_quiz_gate', cx, cy)
      break
    }
    case BlockType.ExitLadder:
      getPooledSprite(scene, 'block_exit_ladder', cx, cy)
      break
    case BlockType.DescentShaft: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.DescentShaft, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_descent_shaft', cx, cy)
      break
    }
    case BlockType.MineralNode: {
      const tier = cell.content?.mineralType ?? 'dust'
      const mineralKey = tier === 'essence' ? 'block_mineral_essence'
        : tier === 'geode' ? 'block_mineral_geode'
        : tier === 'crystal' ? 'block_mineral_crystal'
        : tier === 'shard' ? 'block_mineral_shard'
        : 'block_mineral_dust'
      getPooledSprite(scene, mineralKey, cx, cy)
      const shimmerKey = BlockAnimSystem.getFrameKey(BlockType.MineralNode, scene.time.now, scene.textures)
      if (shimmerKey) {
        const shimmer = getPooledSprite(scene, shimmerKey, cx, cy)
        shimmer.setAlpha(0.3)
        shimmer.setDepth(6)
      }
      if (tier === 'essence') {
        const r = TILE_SIZE * 0.38
        scene.overlayGraphics.lineStyle(2, 0xffd700, 0.9)
        scene.overlayGraphics.lineBetween(cx, cy - r, cx, cy + r)
        scene.overlayGraphics.lineBetween(cx - r, cy, cx + r, cy)
        const rd = r * 0.65
        scene.overlayGraphics.lineStyle(1, 0xffd700, 0.55)
        scene.overlayGraphics.lineBetween(cx - rd, cy - rd, cx + rd, cy + rd)
        scene.overlayGraphics.lineBetween(cx + rd, cy - rd, cx - rd, cy + rd)
        scene.overlayGraphics.fillStyle(0xffffff, 1)
        scene.overlayGraphics.fillCircle(cx, cy, 3)
      }
      break
    }
    case BlockType.ArtifactNode: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.ArtifactNode, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_artifact', cx, cy)
      break
    }
    case BlockType.LavaBlock: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.LavaBlock, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_lava', cx, cy)
      scene.overlayGraphics.fillStyle(0xff8800, 0.6)
      const dotX = px + 4 + seededModulo(tileX, tileY, 7, TILE_SIZE - 8)
      const dotY = py + 4 + seededModulo(tileX, tileY, 11, TILE_SIZE - 8)
      scene.overlayGraphics.fillCircle(dotX, dotY, 2)
      break
    }
    case BlockType.GasPocket: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.GasPocket, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_gas', cx, cy)
      break
    }
    case BlockType.UnstableGround: {
      getPooledSprite(scene, 'block_unstable', cx, cy)
      break
    }
    case BlockType.QuoteStone: {
      getPooledSprite(scene, 'block_quote_stone', cx, cy)
      break
    }
    case BlockType.WallText: {
      // Render as a glowing text-inscribed wall block
      const wg = scene.tileGraphics
      wg.fillStyle(0x997755, 1)
      wg.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      // Glow effect — slightly lighter inner rectangle
      wg.fillStyle(0xbbaa88, 0.3)
      wg.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6)
      // Inscription lines
      wg.fillStyle(0xddccaa, 0.5)
      wg.fillRect(px + 5, py + 6, TILE_SIZE - 10, 1)
      wg.fillRect(px + 5, py + 10, TILE_SIZE - 10, 1)
      wg.fillRect(px + 5, py + 14, TILE_SIZE - 12, 1)
      break
    }
    case BlockType.RelicShrine: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.RelicShrine, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_relic_shrine', cx, cy)
      break
    }
    case BlockType.SendUpStation: {
      getPooledSprite(scene, 'block_send_up', cx, cy)
      break
    }
    case BlockType.OxygenTank: {
      getPooledSprite(scene, 'block_oxygen_tank', cx, cy)
      break
    }
    case BlockType.DataDisc: {
      getPooledSprite(scene, 'block_data_disc', cx, cy)
      break
    }
    case BlockType.FossilNode: {
      const animKey = BlockAnimSystem.getFrameKey(BlockType.FossilNode, scene.time.now, scene.textures)
      getPooledSprite(scene, animKey ?? 'block_fossil', cx, cy)
      break
    }
    case BlockType.Chest: {
      const g = scene.tileGraphics
      g.fillStyle(0xffd700)
      g.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
      g.fillStyle(0xcc9900)
      g.fillRect(px + 4, py + TILE_SIZE / 2 - 1, TILE_SIZE - 8, 2)
      break
    }
    case BlockType.Tablet: {
      const g = scene.tileGraphics
      g.fillStyle(0x8888cc)
      g.fillRect(px + 3, py + 1, TILE_SIZE - 6, TILE_SIZE - 2)
      g.fillStyle(0xaaaaee)
      g.fillRect(px + 5, py + 3, TILE_SIZE - 10, 1)
      g.fillRect(px + 5, py + 6, TILE_SIZE - 10, 1)
      g.fillRect(px + 5, py + 9, TILE_SIZE - 12, 1)
      break
    }
    default:
      break
  }
}

/**
 * Renders a sprite-based crack overlay on a damaged block.
 * Replaces the old procedural crack drawing with 4 damage stages.
 */
export function drawCrackOverlay(scene: MineScene, cell: MineCell, tileX: number, tileY: number, px: number, py: number): void {
  if (cell.maxHardness <= 0 || cell.hardness <= 0 || cell.hardness >= cell.maxHardness) return

  const damagePercent = 1 - cell.hardness / cell.maxHardness
  if (damagePercent < 0.25) return

  const cx = px + TILE_SIZE * 0.5
  const cy = py + TILE_SIZE * 0.5

  let crackKey: string
  if (damagePercent < 0.50) {
    crackKey = 'crack_stage1'
  } else if (damagePercent < 0.75) {
    crackKey = 'crack_stage2'
  } else if (damagePercent < 0.90) {
    crackKey = 'crack_stage3'
  } else {
    crackKey = 'crack_stage4'
  }

  if (!scene.textures.exists(crackKey)) {
    drawLegacyCracks(scene, px, py, tileX, tileY, damagePercent)
    return
  }

  const crackSprite = getPooledSprite(scene, crackKey, cx, cy)
  crackSprite.setDepth(6)
  crackSprite.setAlpha(0.7 + damagePercent * 0.3)

  if (cell.type === BlockType.Dirt || cell.type === BlockType.SoftRock) {
    crackSprite.setTint(0x6b3a2a)
  } else if (cell.type === BlockType.LavaBlock) {
    crackSprite.setTint(0xcc2200)
  } else if (cell.type === BlockType.GasPocket) {
    crackSprite.setTint(0x224422)
  } else {
    crackSprite.setTint(0x2a2a2a)
  }
}

/**
 * Draws procedural crack lines on the overlayGraphics for a partially mined block.
 * Uses a position-seeded pattern so cracks are visually consistent across redraws.
 */
export function drawLegacyCracks(scene: MineScene, px: number, py: number, tileX: number, tileY: number, damagePercent: number): void {
  if (damagePercent <= 0.33) return

  const s = TILE_SIZE
  const cx = px + s * 0.5
  const cy = py + s * 0.5

  const ox1 = seededModulo(tileX, tileY, 5, s * 0.15)
  const oy1 = seededModulo(tileX + 1, tileY, 7, s * 0.15)
  const ox2 = seededModulo(tileX, tileY + 1, 11, s * 0.15)
  const oy2 = seededModulo(tileX + 2, tileY, 13, s * 0.15)

  if (damagePercent <= 0.66) {
    scene.overlayGraphics.lineStyle(1, 0x1a1a1a, 0.6)
    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(px + s * 0.2 + ox1, py + s * 0.1 + oy1)
    scene.overlayGraphics.lineTo(cx, cy)
    scene.overlayGraphics.lineTo(px + s * 0.8 + ox2, py + s * 0.9 + oy2)
    scene.overlayGraphics.strokePath()

    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(px + s * 0.6 + ox2, py + s * 0.05 + oy1)
    scene.overlayGraphics.lineTo(cx - ox1 * 0.5, cy - oy1 * 0.5)
    scene.overlayGraphics.strokePath()
  } else {
    scene.overlayGraphics.lineStyle(2, 0x1a1a1a, 0.65)
    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(px + s * 0.2 + ox1, py + s * 0.1 + oy1)
    scene.overlayGraphics.lineTo(cx, cy)
    scene.overlayGraphics.lineTo(px + s * 0.8 + ox2, py + s * 0.9 + oy2)
    scene.overlayGraphics.strokePath()

    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(px + s * 0.1 + ox2, py + s * 0.7 + oy2)
    scene.overlayGraphics.lineTo(cx + ox1 * 0.3, cy - oy1 * 0.3)
    scene.overlayGraphics.lineTo(px + s * 0.9 - ox1, py + s * 0.3 - oy2)
    scene.overlayGraphics.strokePath()

    scene.overlayGraphics.lineStyle(1, 0x1a1a1a, 0.5)
    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(cx, cy)
    scene.overlayGraphics.lineTo(px + s * 0.55 + ox2, py + s * 0.05 + oy1)
    scene.overlayGraphics.strokePath()

    scene.overlayGraphics.beginPath()
    scene.overlayGraphics.moveTo(cx, cy)
    scene.overlayGraphics.lineTo(px + s * 0.05 + ox1, py + s * 0.45 + oy2)
    scene.overlayGraphics.strokePath()

    scene.overlayGraphics.fillStyle(0x000000, 0.30)
    scene.overlayGraphics.fillTriangle(
      px + 3 + ox1, py + 3 + oy1,
      px + 3 + ox1 + 5, py + 3 + oy1,
      px + 3 + ox1, py + 3 + oy1 + 5,
    )
  }
}

/** Main tile rendering pass — draws all visible tiles within the camera viewport. */
export function drawTiles(scene: MineScene): void {
  const camera = scene.cameras.main
  if (!camera || !camera.worldView) return

  scene.itemSpritePoolIndex = 0
  scene.itemSpritePool.forEach(s => s.setVisible(false))
  scene.tileGraphics.clear()
  scene.overlayGraphics.clear()

  const viewWidth = camera.worldView.width > 0 ? camera.worldView.width : camera.width
  const viewHeight = camera.worldView.height > 0 ? camera.worldView.height : camera.height
  const viewX = camera.worldView.width > 0 ? camera.worldView.x : camera.scrollX
  const viewY = camera.worldView.height > 0 ? camera.worldView.y : camera.scrollY

  const startX = Math.max(0, Math.floor(viewX / TILE_SIZE) - 1)
  const endX = Math.min(scene.gridWidth - 1, Math.ceil((viewX + viewWidth) / TILE_SIZE) + 1)
  const startY = Math.max(0, Math.floor(viewY / TILE_SIZE) - 1)
  const endY = Math.min(scene.gridHeight - 1, Math.ceil((viewY + viewHeight) / TILE_SIZE) + 1)

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const cell = scene.grid[y][x]
      const px = x * TILE_SIZE
      const py = y * TILE_SIZE

      if (!cell.revealed) {
        const scannerCount = scene.activeUpgrades.get('scanner_boost') ?? 0
        const tierInfo = BALANCE.SCANNER_TIERS[scene.scannerTierIndex]
        const visLevel = cell.visibilityLevel ?? 0

        // Phase 33.4: Use per-biome fog palette for distinct colored fog
        const fp = scene.currentBiome.fogPalette
        if (visLevel === 1) {
          // Ring 1: render actual tile sprite, dimmed by biome ring1 tint
          const borderBrightness = Math.min(0.90, 0.80 + scannerCount * 0.05)
          scene.tileGraphics.fillStyle(fp.ring1, 1)
          scene.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          drawBlockPattern(scene, cell, x, y, px, py)
          const dimAmount = Math.max(1.0 - borderBrightness, fp.ring1DimAlpha * 0.5)
          scene.overlayGraphics.fillStyle(0x000000, dimAmount)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          // Rarity hint: full-tile shimmer overlays for valuable blocks (Advanced+ scanner)
          if (tierInfo.showsRarity) {
            const shimmerBase = 0.5 + 0.5 * Math.sin(scene.time.now / 1000)
            if (cell.type === BlockType.ArtifactNode) {
              const artifactAlpha = 0.10 + 0.05 * shimmerBase
              scene.overlayGraphics.fillStyle(0xffc832, artifactAlpha)
              scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
              scene.overlayGraphics.fillStyle(0xffd700, artifactAlpha + 0.08)
              const cw = TILE_SIZE * 0.5
              scene.overlayGraphics.fillRect(px + cw * 0.5, py + cw * 0.5, cw, cw)
              scene.overlayGraphics.lineStyle(2, 0xffd700, 0.55 + 0.25 * shimmerBase)
              scene.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            } else if (cell.type === BlockType.MineralNode) {
              const tier = cell.content?.mineralType ?? 'dust'
              const glowColor = tier === 'essence' ? 0xffd700
                : tier === 'geode' ? 0xda70d6
                : tier === 'crystal' ? 0xff4444
                : tier === 'shard' ? 0x44ff88
                : 0x4ecca3
              const mineralAlpha = 0.08 + 0.04 * shimmerBase
              scene.overlayGraphics.fillStyle(glowColor, mineralAlpha)
              scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
              scene.overlayGraphics.fillStyle(glowColor, 0.80 + 0.15 * shimmerBase)
              scene.overlayGraphics.fillCircle(px + TILE_SIZE - 7, py + 7, 5)
              scene.overlayGraphics.lineStyle(1, glowColor, 0.45)
              scene.overlayGraphics.strokeCircle(px + TILE_SIZE - 7, py + 7, 7)
            } else if (cell.type === BlockType.DataDisc) {
              const discAlpha = 0.10 + 0.05 * shimmerBase
              scene.overlayGraphics.fillStyle(0x00c8ff, discAlpha)
              scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
              scene.overlayGraphics.lineStyle(2, 0x00c8ff, 0.45 + 0.20 * shimmerBase)
              scene.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            } else if (cell.type === BlockType.FossilNode) {
              const fossilAlpha = 0.08 + 0.04 * shimmerBase
              scene.overlayGraphics.fillStyle(0xb48c50, fossilAlpha)
              scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
              scene.overlayGraphics.lineStyle(2, 0xd4a574, 0.40 + 0.20 * shimmerBase)
              scene.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            }
          }
          // Hazard hint: pulsing red border outline around the tile (Enhanced+ scanner)
          if (tierInfo.showsHazards) {
            if (
              cell.type === BlockType.LavaBlock ||
              cell.type === BlockType.GasPocket ||
              cell.type === BlockType.UnstableGround
            ) {
              const hazardPulse = 0.5 + 0.5 * Math.sin(scene.time.now / 400)
              scene.overlayGraphics.lineStyle(3, 0xff3333, 0.25 + 0.15 * hazardPulse)
              scene.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              scene.overlayGraphics.fillStyle(0xff3333, 0.06 + 0.04 * hazardPulse)
              scene.overlayGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              const tx = px + 4
              const ty = py + 4
              const ts = 9
              scene.overlayGraphics.fillStyle(0xff2200, 0.85 + 0.10 * hazardPulse)
              scene.overlayGraphics.fillTriangle(tx, ty + ts, tx + ts * 0.5, ty, tx + ts, ty + ts)
              scene.overlayGraphics.lineStyle(1, 0xffffff, 0.70)
              scene.overlayGraphics.strokeTriangle(tx, ty + ts, tx + ts * 0.5, ty, tx + ts, ty + ts)
            }
          }
          // hazard_alert companion: show pulsing amber warning on hazards within companion range
          if (scene.companionEffect?.type === 'hazard_alert') {
            const alertRadius = scene.companionEffect.value
            const distX = Math.abs(x - scene.player.gridX)
            const distY = Math.abs(y - scene.player.gridY)
            const withinRange = distX <= alertRadius && distY <= alertRadius
            if (withinRange && (
              cell.type === BlockType.LavaBlock ||
              cell.type === BlockType.GasPocket ||
              cell.type === BlockType.UnstableGround
            )) {
              scene.overlayGraphics.lineStyle(2, 0xffaa00, 0.85)
              scene.overlayGraphics.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
              scene.overlayGraphics.fillStyle(0xffaa00, 0.25)
              scene.overlayGraphics.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            }
          }
        } else if (visLevel === 2 && scannerCount >= 1) {
          // Ring 2: only visible with scanner; render sprite with lighter dim
          const dimBrightness = Math.min(0.30, 0.10 + (scannerCount - 1) * 0.10)
          scene.tileGraphics.fillStyle(fp.ring2, 1)
          scene.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          drawBlockPattern(scene, cell, x, y, px, py)
          const dimAmount = Math.max(1.0 - dimBrightness, fp.ring2DimAlpha)
          scene.overlayGraphics.fillStyle(0x000000, dimAmount)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        } else {
          scene.tileGraphics.fillStyle(fp.hidden, 1)
          scene.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
        continue
      }

      if (cell.type === BlockType.Empty) {
        scene.tileGraphics.fillStyle(scene.currentBiome.bgColor, 1)
        scene.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
      } else {
        const color = (scene.currentBiome.blockColorOverrides[cell.type] ?? BLOCK_COLORS[cell.type]) ?? scene.currentBiome.fogTint
        scene.tileGraphics.fillStyle(color, 1)
        scene.tileGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        drawBlockPattern(scene, cell, x, y, px, py)
        if (
          cell.type === BlockType.Dirt ||
          cell.type === BlockType.SoftRock ||
          cell.type === BlockType.Stone ||
          cell.type === BlockType.HardRock
        ) {
          const hw = scene.currentBiome.hazardWeights
          const mw = scene.currentBiome.mineralWeights
          if (hw.lavaBlockDensity > 0.3) {
            scene.overlayGraphics.fillStyle(0xb43c1e, 0.05)
            scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else if (mw.crystalMultiplier >= 1.5 || mw.geodeMultiplier >= 1.5) {
            scene.overlayGraphics.fillStyle(0x5078c8, 0.05)
            scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          } else {
            scene.overlayGraphics.fillStyle(scene.currentBiome.ambientColor, 0.04)
            scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
          }
        }
        if (
          cell.type === BlockType.QuizGate ||
          cell.type === BlockType.DescentShaft ||
          cell.type === BlockType.ExitLadder
        ) {
          scene.overlayGraphics.fillStyle(getBiomeAccentTint(scene), 0.12)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
        if (cell.type === BlockType.LavaBlock) {
          const pulse = 0.15 + 0.10 * Math.sin(scene.time.now / 500)
          scene.overlayGraphics.fillStyle(0xff6600, pulse)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        } else if (cell.type === BlockType.GasPocket) {
          const pulse = 0.10 + 0.06 * Math.sin(scene.time.now / 700)
          scene.overlayGraphics.fillStyle(0x33ff33, pulse)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        } else if (cell.type === BlockType.UnstableGround) {
          const pulse = 0.05 + 0.03 * Math.sin(scene.time.now / 1200)
          scene.overlayGraphics.fillStyle(0x8b7355, pulse)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
      }

      if (cell.maxHardness > 0 && cell.hardness > 0 && cell.hardness < cell.maxHardness) {
        drawCrackOverlay(scene, cell, x, y, px, py)
      }

      const flashKey = `${x},${y}`
      const flashStart = scene.flashTiles.get(flashKey)
      if (flashStart !== undefined) {
        const elapsed = scene.time.now - flashStart
        if (elapsed < 150) {
          const alpha = 0.45 * (1 - elapsed / 150)
          scene.overlayGraphics.fillStyle(0xffffff, alpha)
          scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        } else {
          scene.flashTiles.delete(flashKey)
        }
      }
    }
  }

  // Biome glow pass: emitting blocks bleed color into adjacent unexplored fog
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const cell = scene.grid[y][x]
      if (!cell.revealed && (cell.visibilityLevel ?? 0) < 1) continue

      let glowColor: number | null = null
      if (cell.type === BlockType.LavaBlock) {
        glowColor = 0xff6600
      } else if (cell.type === BlockType.MineralNode) {
        const tier = cell.content?.mineralType
        if (tier === 'crystal') glowColor = 0x44aaff
        else if (tier === 'essence') glowColor = 0x9944cc
      }
      if (glowColor === null) continue

      const neighbors = [
        { nx: x, ny: y - 1 },
        { nx: x, ny: y + 1 },
        { nx: x - 1, ny: y },
        { nx: x + 1, ny: y },
      ]
      for (const { nx, ny } of neighbors) {
        if (ny < 0 || ny >= scene.gridHeight || nx < 0 || nx >= scene.gridWidth) continue
        const neighbor = scene.grid[ny][nx]
        if (neighbor.revealed || (neighbor.visibilityLevel ?? 0) >= 1) continue
        const npx = nx * TILE_SIZE
        const npy = ny * TILE_SIZE
        scene.overlayGraphics.fillStyle(glowColor, 0.10)
        scene.overlayGraphics.fillRect(npx, npy, TILE_SIZE, TILE_SIZE)
      }
    }
  }
}

/** Lerps the player sprite toward the logical grid position and snaps when close. */
export function drawPlayer(scene: MineScene): void {
  const targetX = scene.player.gridX * TILE_SIZE + TILE_SIZE * 0.5
  const targetY = scene.player.gridY * TILE_SIZE + TILE_SIZE

  scene.playerVisualX += (targetX - scene.playerVisualX) * scene.MOVE_LERP
  scene.playerVisualY += (targetY - scene.playerVisualY) * scene.MOVE_LERP

  if (Math.abs(scene.playerVisualX - targetX) < 1) scene.playerVisualX = targetX
  if (Math.abs(scene.playerVisualY - targetY) < 1) scene.playerVisualY = targetY

  scene.playerSprite.setPosition(scene.playerVisualX, scene.playerVisualY)

  const atTarget = scene.playerVisualX === targetX && scene.playerVisualY === targetY
  if (atTarget && !scene.animController?.isPlayingMineAnim) {
    scene.animController?.setIdle()
  }
}

/** Orchestrates a full frame redraw: depth overlay, tiles, player, and mini-map update. */
export function redrawAll(scene: MineScene): void {
  scene.updateCameraTarget()
  drawDepthOverlay(scene)
  drawTiles(scene)
  drawPlayer(scene)
  miniMapData.set({
    grid: scene.grid,
    playerX: scene.player.gridX,
    playerY: scene.player.gridY,
  })
}

/** Emits block-break particles at the center of a tile. */
export function spawnBreakParticles(scene: MineScene, px: number, py: number, blockType: BlockType): void {
  scene.particles.emitBreak(blockType, px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5)
}
