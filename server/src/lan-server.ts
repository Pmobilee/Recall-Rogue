/**
 * Minimal LAN relay server for Recall Rogue multiplayer.
 *
 * Only includes the MP lobby subsystem (REST + WebSocket relay).
 * No auth, no database, no JWT — just lobby management and message relay.
 *
 * Intended for non-Tauri platforms (web browsers) where a host player
 * runs this on their machine so LAN peers can discover and connect.
 *
 * Usage:
 *   npx tsx server/src/lan-server.ts [--port 19738]
 *
 * Environment variables:
 *   LAN_HOST_NAME  — Human-readable name shown to scanning players (default: "LAN Server")
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { mpLobbyRoutes } from './routes/mpLobby.js'
import { mpLobbyWsRoutes } from './routes/mpLobbyWs.js'

const DEFAULT_PORT = 19738

// ── Argument parsing ──────────────────────────────────────────────────────────

function parsePort(): number {
  const args = process.argv;
  const portIdx = args.findIndex(a => a === '--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    const parsed = parseInt(args[portIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) return parsed;
  }
  return DEFAULT_PORT;
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = parsePort();
  const hostName = process.env['LAN_HOST_NAME'] ?? 'LAN Server'

  const app = Fastify({ logger: true })

  // Allow all origins so LAN clients from arbitrary IPs can connect.
  await app.register(cors, { origin: true })

  // WebSocket support — required by mpLobbyWsRoutes.
  await app.register(websocket)

  // ── Health check ──────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok' }))

  // ── Discovery endpoint (used by LAN scanner) ───────────────────────────────

  /**
   * GET /mp/discover
   *
   * LAN scanner probes this endpoint to identify Recall Rogue servers.
   * The `game` field is the discriminator — only `"recall-rogue"` is accepted
   * by `probeLanServer()` in `lanDiscoveryService.ts`.
   */
  app.get('/mp/discover', async () => ({
    game: 'recall-rogue',
    version: '0.1.0',
    hostName,
    port,
  }))

  // ── MP lobby REST routes ───────────────────────────────────────────────────

  await app.register(mpLobbyRoutes, { prefix: '/mp' })

  // WebSocket route — registered at root level (no prefix), listens on /mp/ws
  await app.register(mpLobbyWsRoutes)

  // ── Start ─────────────────────────────────────────────────────────────────

  await app.listen({ port, host: '0.0.0.0' })

  // Fastify's logger already prints the listen address; these help human scanners.
  console.log(`LAN server listening on 0.0.0.0:${port}`)
  console.log(`Players can connect at: http://<your-ip>:${port}`)
  console.log(`Discovery: GET /mp/discover  |  Lobby API: POST /mp/lobbies`)
}

main().catch(err => {
  console.error('Failed to start LAN server:', err)
  process.exit(1)
})
