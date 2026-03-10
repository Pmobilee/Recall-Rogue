/**
 * CDN Strategy (DD-V2-219):
 * - Static assets (sprites, audio, facts.db) → Cloudflare R2
 * - Web build → Cloudflare Pages
 * - Hashed filenames get: Cache-Control: public, max-age=31536000, immutable
 * - facts.db gets: Cache-Control: public, max-age=3600 (1h TTL for updates)
 * - Set VITE_ASSET_BASE_URL env var to CDN origin for production builds
 */
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/**
 * Vite plugin that injects a Content-Security-Policy meta tag into index.html.
 * In development (Vite dev server active), a relaxed policy is used to allow
 * HMR and Phaser eval. In production, a strict policy is enforced (DD-V2-228).
 */
function cspInjectPlugin(): Plugin {
  return {
    name: 'csp-inject',
    transformIndexHtml(html, ctx) {
      const isDev = ctx.server !== undefined
      const csp = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: http://localhost:* http://*:3001; font-src 'self'"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.terragacha.com; font-src 'self'"
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  </head>`
      )
    },
  }
}

function structuredDataPlugin(): Plugin {
  return {
    name: 'structured-data-inject',
    transformIndexHtml(html, ctx) {
      // Only inject in production builds
      if (ctx.server !== undefined) return html
      const schema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        'name': 'Recall Rogue',
        'url': 'https://terragacha.com/',
        'description': 'A spaced-repetition mining roguelite set on far-future Earth.',
        'genre': ['Educational', 'Roguelite', 'Puzzle'],
        'gamePlatform': ['Web', 'Android', 'iOS'],
        'applicationCategory': 'Game',
        'operatingSystem': 'Any',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD',
          'availability': 'https://schema.org/InStock',
        },
        'author': {
          '@type': 'Organization',
          'name': 'Recall Rogue Team',
        },
      })
      return html.replace(
        '</head>',
        `  <script type="application/ld+json">${schema}<\/script>\n  </head>`
      )
    },
  }
}

// Conditionally import visualizer for bundle analysis (DD-V2-218)
// Run: ANALYZE=true npm run build (or npm run analyze)
let visualizerPlugin: Plugin | null = null
if (process.env.ANALYZE === 'true') {
  try {
    // Dynamic require so it doesn't fail when rollup-plugin-visualizer is not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { visualizer } = require('rollup-plugin-visualizer')
    visualizerPlugin = visualizer({
      filename: 'docs/perf/bundle-report.html',
      gzipSize: true,
      template: 'treemap',
    }) as Plugin
  } catch (_) {
    console.warn('[vite] rollup-plugin-visualizer not installed; skipping bundle analysis')
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    cspInjectPlugin(),
    structuredDataPlugin(),
    ...(visualizerPlugin ? [visualizerPlugin] : []),
  ],
  base: process.env.VITE_ASSET_BASE_URL || '/',
  server: {
    // Mobile testing on local network
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: '100.74.153.81',
      port: 5173,
      overlay: false,
    },
    watch: {
      ignored: [
        '**/public/assets/cardbacks/**',
        '**/sprite-gen/**',
      ],
    },
  },
  build: {
    // Optimize for mobile — target <500KB per chunk
    // Run `npm run build -- --mode analyze` with rollup-plugin-visualizer to inspect
    target: 'es2022',
    minify: 'esbuild',
    chunkSizeWarningLimit: 500, // 500KB warning threshold
    rollupOptions: {
      output: {
        manualChunks(id) {
          // GAIA dialogue data — 1009 lines of strings, lazy-loaded
          if (id.includes('data/gaiaDialogue')) return 'gaiaDialogue'
          // Combat system — only needed during mine encounters
          if (id.includes('EncounterManager') || id.includes('CombatOverlay')) return 'combat'
          // Heavy game data modules — only needed after game boot
          if (id.includes('/data/biomes') || id.includes('/data/fossils') || id.includes('/data/creatures') || id.includes('/data/relics') || id.includes('/data/premiumRecipes') || id.includes('/data/recipes') || id.includes('/data/hubFloors') || id.includes('/data/ambientStories')) return 'game-data'
          // Capacitor native bridge — only needed on mobile
          if (id.includes('node_modules/@capacitor')) return 'capacitor'
          // Dev panel is never loaded in production
          if (id.includes('DevPanel'))  return 'dev'
          // Phaser and sql.js are large; always split
          if (id.includes('node_modules/phaser')) return 'phaser'
          if (id.includes('node_modules/sql.js')) return 'sql-wasm'
          // Social features — only loaded when social tab is opened in hub
          if (id.includes('GuildView') || id.includes('DuelView') || id.includes('LeaderboardView')) {
            return 'social'
          }
          // Season pass UI — only loaded on season pass screen
          if (id.includes('SeasonPass') || id.includes('SeasonBanner')) return 'seasons'
        },
        assetFileNames: (assetInfo) => {
          // Preserve fact sprite filenames (no content hash) so URLs are stable
          // across builds and match the manifest IDs.
          if (assetInfo.name && assetInfo.name.startsWith('facts/')) {
            return 'assets/sprites/facts/[name][extname]'
          }
          // All other assets use content hash for cache busting
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
