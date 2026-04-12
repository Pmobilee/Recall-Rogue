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
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Read package.json for version injection.
// __RR_VERSION__ is consumed by src/services/dbDecoder.ts at runtime.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

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
        : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.recallrogue.com https://localhost:*; font-src 'self'"
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
        'url': 'https://recallrogue.com/',
        'description': 'A card roguelite where knowledge is power — answer to charge your cards, chain related facts for massive damage.',
        'genre': ['Educational', 'Roguelite', 'Puzzle'],
        'gamePlatform': ['Web', 'Steam', 'Android', 'iOS'],
        'applicationCategory': 'Game',
        'operatingSystem': 'Windows, macOS, Linux',
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

/**
 * Strips hires cardback images from the production build.
 * These are ComfyUI sprite-gen output used only during development;
 * production serves lowres/ exclusively (see cardbackManifest.ts).
 */
function excludeHiresCardbacks(): Plugin {
  return {
    name: 'exclude-hires-cardbacks',
    closeBundle: {
      sequential: true,
      async handler() {
        const { rm } = await import('fs/promises')
        const { resolve } = await import('path')
        const hiresDir = resolve('dist/assets/cardbacks/hires')
        await rm(hiresDir, { recursive: true, force: true }).catch(() => {})
        console.log('[build] Stripped hires cardbacks from dist (dev-only assets)')
      },
    },
  }
}

/**
 * Dev-only Vite plugin that exposes a POST /__dev/screenshot endpoint.
 * Accepts a base64 data URL in the request body and writes it to /tmp as a file.
 * Used by captureScreenshotToFile() in screenshotHelper.ts so Playwright tests
 * can retrieve screenshots as server-side files instead of triggering browser downloads.
 */
function devScreenshotEndpoint(): Plugin {
  return {
    name: 'dev-screenshot-endpoint',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/__dev/screenshot') {
          return next()
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { data: string }
          const dataUrl: string = body.data
          // Detect mime type from the data URL header (e.g. "data:image/jpeg;base64,...")
          const mimeMatch = dataUrl.match(/^data:(image\/[a-z]+);base64,/)
          const mime = mimeMatch?.[1] ?? 'image/png'
          const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
          const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
          const filePath = `/tmp/rr-screenshot.${ext}`
          const { writeFile } = await import('fs/promises')
          await writeFile(filePath, Buffer.from(base64, 'base64'))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: filePath }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

/**
 * Dev-only Vite plugin that exposes GET /__rr_pending_next_steps.json.
 * Serves the contents of `.claude/pending-next-steps.json` (written by the
 * `persist-whats-next.sh` Stop hook) so the dev-mode hub overlay can display
 * the prior session's pending next-step reminders.
 *
 * The file may be missing (no prior session, or Form B closer used). In that
 * case the endpoint returns `null` (HTTP 200) so the client can render its
 * "no pending next steps" empty state without treating it as an error.
 *
 * Dev-only by construction: `configureServer` only runs under `vite dev`.
 * The endpoint is never compiled into the production bundle.
 */
function pendingNextStepsEndpoint(): Plugin {
  return {
    name: 'rr-pending-next-steps',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/__rr_pending_next_steps.json') {
          return next()
        }
        try {
          const filePath = join(process.cwd(), '.claude', 'pending-next-steps.json')
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          if (!existsSync(filePath)) {
            res.end('null')
            return
          }
          const raw = readFileSync(filePath, 'utf8')
          // Validate JSON before serving — never echo a corrupt file.
          try {
            JSON.parse(raw)
          } catch (parseErr) {
            console.warn('[pending-next-steps] file is malformed:', parseErr)
            res.end('null')
            return
          }
          res.end(raw)
        } catch (err) {
          console.error('[pending-next-steps] failed to read file:', err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

/**
 * Adds Cache-Control headers for static assets during development.
 * Prevents the Android webview from re-fetching every image on every app launch.
 * Applies Cache-Control: public, max-age=86400 (1 day) to /assets/ requests ONLY
 * when the file actually exists in public/. Missing files get no-cache so the SPA
 * fallback index.html is never cached — which previously caused deck front images to
 * appear missing for 24 hours after the file was added to disk.
 */
function staticAssetCachePlugin(): Plugin {
  return {
    name: 'static-asset-cache',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/')) {
          // Only cache responses for files that actually exist in public/
          // to avoid caching SPA fallback HTML for missing assets
          const filePath = join(process.cwd(), 'public', req.url.split('?')[0])
          if (existsSync(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400')
          }
        }
        next()
      })
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
    devScreenshotEndpoint(),
    pendingNextStepsEndpoint(),
    staticAssetCachePlugin(),
    svelte(),
    cspInjectPlugin(),
    structuredDataPlugin(),
    excludeHiresCardbacks(),
    ...(visualizerPlugin ? [visualizerPlugin] : []),
  ],
  // Inject build-time constants consumed by runtime modules.
  // __RR_VERSION__ is used by src/services/dbDecoder.ts to derive the XOR key
  // that matches the key used by scripts/obfuscate-db.mjs at build time.
  define: {
    __RR_VERSION__: JSON.stringify(pkg.version),
  },
  base: process.env.VITE_ASSET_BASE_URL || '/',
  server: {
    // Mobile testing on local network
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    watch: {
      ignored: [
        // Sprites & assets — absolute paths so chokidar reliably ignores public/
        '**/public/**',
        '**/sprite-gen/**',
        // Documentation
        '**/docs/**',
        '**/*.md',
        // Playtest data & reports
        '**/data/playtests/**',
        // Test files & output
        '**/tests/**',
        '**/.playwright-mcp/**',
        // Server DB & build output
        '**/server/**',
        '**/dist/**',
      ],
    },
  },
  // Force Phaser to be pre-bundled eagerly at dev-server start.
  // Without this, Vite discovers Phaser lazily on first import and may serve a
  // stale pre-bundle handle, resulting in a 504 "Outdated Optimize Dep" error
  // that prevents CardGameManager from loading the Phaser layer entirely.
  optimizeDeps: {
    include: ['phaser'],
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
          if (id.includes('/data/biomes') || id.includes('/data/creatures') || id.includes('/data/relics')) return 'game-data'
          // Let Rollup place Capacitor modules naturally to avoid circular manual-chunk edges
          // (observed: combat -> capacitor -> combat).
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
