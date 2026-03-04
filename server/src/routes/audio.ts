import { FastifyInstance } from 'fastify'
import path from 'path'
import { existsSync, createReadStream } from 'fs'

/**
 * Audio routes for vocabulary pronunciation (DD-V2-094).
 * Streams pre-generated TTS audio files.
 */
export async function audioRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/audio/:factId', async (req, reply) => {
    const { factId } = req.params as { factId: string }

    // Sanitize factId — must match pattern: alphanumeric, hyphens, underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(factId)) {
      return reply.status(400).send({ error: 'Invalid factId format' })
    }

    const filePath = path.join(process.cwd(), 'data', 'audio', `${factId}_recognition.mp3`)

    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: 'Audio not found' })
    }

    reply.header('Content-Type', 'audio/mpeg')
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')  // 1 year CDN cache
    return reply.send(createReadStream(filePath))
  })
}
