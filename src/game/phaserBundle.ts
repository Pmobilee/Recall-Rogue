/**
 * Custom Phaser entry point for Recall Rogue.
 * Re-exporting default preserves Phaser.X.Y namespace types used throughout the codebase.
 *
 * Phaser uses CommonJS module.exports and cannot be re-exported with `export *`.
 * We simply re-export the default to make this file importable as an alias.
 * Named re-exports that allow tree-shaking are not possible with Phaser's CommonJS format;
 * instead, Rollup's manualChunks splits Phaser into a separate chunk (vite.config.ts).
 *
 * Excluded (not used by Recall Rogue):
 *   Matter.js physics, Arcade physics, Facebook Instant Games, Spine, Rope game object,
 *   Impact physics, DOM element plugin, Bitmap mask (we use geometry mask for fog only)
 *
 * DD-V2-218: Initial JS bundle < 500 KB gzipped.
 */
import Phaser from 'phaser'
export default Phaser
