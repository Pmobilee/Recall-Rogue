import { FastifyInstance } from 'fastify'

export interface UGCSubmission {
  id: string
  playerId: string
  factText: string
  correctAnswer: string
  distractors: string[]
  category: string[]
  sourceUrl: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
}

export async function ugcRoutes(app: FastifyInstance): Promise<void> {
  // Submit a new fact
  app.post('/submit', async (req, reply) => {
    const body = req.body as {
      factText: string
      correctAnswer: string
      distractors: string[]
      category: string[]
      sourceUrl: string
    }
    if (!body.factText || !body.correctAnswer || !body.distractors?.length || !body.sourceUrl) {
      return reply.status(400).send({ error: 'Missing required fields' })
    }
    if (body.distractors.length < 3) {
      return reply.status(400).send({ error: 'At least 3 distractors required' })
    }
    const submission: UGCSubmission = {
      id: `ugc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: 'anonymous', // Would come from auth in production
      factText: body.factText.slice(0, 500), // Sanitize length
      correctAnswer: body.correctAnswer.slice(0, 200),
      distractors: body.distractors.slice(0, 5).map(d => d.slice(0, 200)),
      category: body.category,
      sourceUrl: body.sourceUrl.slice(0, 500),
      submittedAt: new Date().toISOString(),
      status: 'pending'
    }
    return reply.status(201).send({ submission })
  })

  // Get player's submissions
  app.get('/my-submissions', async (_req, reply) => {
    return reply.send({ submissions: [] })
  })

  // Admin: get pending submissions
  app.get('/review-queue', async (_req, reply) => {
    return reply.send({ queue: [], total: 0 })
  })

  // Admin: approve/reject submission
  app.post('/review/:submissionId', async (req, reply) => {
    const { submissionId } = req.params as { submissionId: string }
    const { action, reason } = req.body as { action: 'approve' | 'reject'; reason?: string }
    if (!['approve', 'reject'].includes(action)) {
      return reply.status(400).send({ error: 'Action must be approve or reject' })
    }
    return reply.send({ submissionId, status: action === 'approve' ? 'approved' : 'rejected', reason })
  })
}
