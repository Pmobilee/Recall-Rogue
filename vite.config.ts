/**
 * CDN Strategy (DD-V2-219):
 * - Static assets (sprites, audio, facts.db) → Cloudflare R2
 * - Web build → Cloudflare Pages
 * - Hashed filenames get: Cache-Control: public, max-age=31536000, immutable
 * - facts.db gets: Cache-Control: public, max-age=3600 (1h TTL for updates)
 * - Set VITE_ASSET_BASE_URL env var to CDN origin for production builds
 */
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base: process.env.VITE_ASSET_BASE_URL || '/',
  server: {
    // Mobile testing on local network
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    // Optimize for mobile — target <500KB per chunk
    // Run `npm run build -- --mode analyze` with rollup-plugin-visualizer to inspect
    target: 'es2022',
    minify: 'esbuild',
    chunkSizeWarningLimit: 500, // 500KB warning threshold
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          'sql-wasm': ['sql.js'],
        },
      },
    },
  },
})
