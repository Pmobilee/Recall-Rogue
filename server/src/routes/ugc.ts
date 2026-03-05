/**
 * UGC (User Generated Content) routes.
 * Full submission pipeline: auth, auto-filter, duplicate check, community voting,
 * appeal workflow, and webhook trigger on approval.
 * DD-V2-200: Community-driven content contribution flywheel.
 */
import { FastifyInstance } from 'fastify'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { autoFilterSubmission, evaluateCommunityVotes } from '../services/ugcReviewService.js'
import { checkDuplicate } from '../services/deduplication.js'
import { factsDb } from '../db/facts-db.js'
import { triggerWebhook } from '../services/webhookService.js'
import { config } from '../config.js'

export interface UGCSubmission {
  id: string
  playerId: string
  factText: string
  correctAnswer: string
  distractors: string[]
  category: string[]
  sourceUrl: string
  sourceName: string
  licenseConsented: boolean
  autoFilterResult?: {
    passed: boolean
    reason?: string
  }
  upvotes: number
  downvotes: number
  submittedAt: string
  status: 'pending' | 'community_vote' | 'admin_review' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
  appealId?: string
}

export async function ugcRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /submit — authenticated submission ────────────────────────────────
  app.post('/submit', { preHandler: requireAuth }, async (req, reply) => {
    const user = getAuthUser(req)
    const body = req.body as {
      factText: string
      correctAnswer: string
      distractors: string[]
      category: string[]
      sourceUrl: string
      sourceName: string
      licenseConsented: boolean
    }

    // Required field validation
    if (!body.licenseConsented) {
      return reply.status(400).send({ error: 'License consent is required' })
    }
    if (!body.factText || !body.correctAnswer || !body.sourceUrl || !body.sourceName) {
      return reply.status(400).send({ error: 'Missing required fields' })
    }
    if (!Array.isArray(body.distractors) || body.distractors.length < 3) {
      return reply.status(400).send({ error: 'At least 3 distractors required' })
    }

    const factText = body.factText.slice(0, 500)
    const correctAnswer = body.correctAnswer.slice(0, 200)
    const distractors = body.distractors.slice(0, 5).map(d => String(d).slice(0, 200))

    // Auto-filter
    const filterResult = autoFilterSubmission(factText, correctAnswer, distractors)

    // Duplicate check against approved facts
    const dupResult = await checkDuplicate(factText, body.category[0] ?? '')
    if (dupResult.isDuplicate) {
      return reply.status(409).send({
        error: 'Duplicate fact detected',
        similarFactId: dupResult.similarFactId
      })
    }

    const id = `ugc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    const initialStatus = filterResult.passed ? 'community_vote' : 'rejected'

    // Persist to facts DB ugc_submissions table
    factsDb.prepare(`
      INSERT INTO ugc_submissions
        (id, player_id, fact_text, correct_answer, distractors, category,
         source_url, source_name, license_consented, auto_filter_passed,
         auto_filter_reason, upvotes, downvotes, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 0, ?, ?)
    `).run(
      id, user.sub, factText, correctAnswer,
      JSON.stringify(distractors), JSON.stringify(body.category),
      body.sourceUrl.slice(0, 500), body.sourceName.slice(0, 200),
      filterResult.passed ? 1 : 0,
      filterResult.reason ?? null,
      initialStatus, now
    )

    // Fire webhook for integrations listening to ugc.submitted
    if (initialStatus !== 'rejected') {
      await triggerWebhook('ugc.submitted', { submissionId: id, status: initialStatus })
    }

    return reply.status(201).send({
      submissionId: id,
      status: initialStatus,
      autoFilter: filterResult
    })
  })

  // ── POST /vote/:submissionId — community voting ────────────────────────────
  app.post('/vote/:submissionId', { preHandler: requireAuth }, async (req, reply) => {
    const user = getAuthUser(req)
    const { submissionId } = req.params as { submissionId: string }
    const { vote } = req.body as { vote: 'up' | 'down' }

    if (!['up', 'down'].includes(vote)) {
      return reply.status(400).send({ error: 'vote must be "up" or "down"' })
    }

    const sub = factsDb.prepare(
      `SELECT * FROM ugc_submissions WHERE id = ? AND status = 'community_vote'`
    ).get(submissionId) as Record<string, unknown> | undefined

    if (!sub) {
      return reply.status(404).send({ error: 'Submission not in community_vote stage' })
    }

    // Prevent duplicate votes: check ugc_votes table
    const existing = factsDb.prepare(
      `SELECT id FROM ugc_votes WHERE submission_id = ? AND voter_id = ?`
    ).get(submissionId, user.sub)

    if (existing) {
      return reply.status(409).send({ error: 'Already voted on this submission' })
    }

    // Record vote
    factsDb.prepare(
      `INSERT INTO ugc_votes (id, submission_id, voter_id, vote, voted_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      `vote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      submissionId, user.sub, vote, new Date().toISOString()
    )

    // Update counters
    const field = vote === 'up' ? 'upvotes' : 'downvotes'
    factsDb.prepare(
      `UPDATE ugc_submissions SET ${field} = ${field} + 1 WHERE id = ?`
    ).run(submissionId)

    // Re-evaluate community vote threshold
    const updated = factsDb.prepare(
      `SELECT upvotes, downvotes FROM ugc_submissions WHERE id = ?`
    ).get(submissionId) as { upvotes: number; downvotes: number }

    const voteResult = evaluateCommunityVotes(updated.upvotes, updated.downvotes, 5)

    if (voteResult.passed) {
      // Promote to admin_review
      factsDb.prepare(
        `UPDATE ugc_submissions SET status = 'admin_review' WHERE id = ?`
      ).run(submissionId)
      await triggerWebhook('ugc.ready_for_review', { submissionId })
    }

    return reply.send({ success: true, newStatus: voteResult.passed ? 'admin_review' : 'community_vote' })
  })

  // ── POST /appeal/:submissionId — file an appeal for a rejected submission ──
  app.post('/appeal/:submissionId', { preHandler: requireAuth }, async (req, reply) => {
    const user = getAuthUser(req)
    const { submissionId } = req.params as { submissionId: string }
    const { reason } = req.body as { reason: string }

    if (!reason || reason.trim().length < 20) {
      return reply.status(400).send({ error: 'Appeal reason must be at least 20 characters' })
    }

    const sub = factsDb.prepare(
      `SELECT * FROM ugc_submissions WHERE id = ? AND player_id = ? AND status = 'rejected'`
    ).get(submissionId, user.sub)

    if (!sub) {
      return reply.status(404).send({ error: 'Rejected submission not found for this player' })
    }

    // One appeal per submission
    const existingAppeal = factsDb.prepare(
      `SELECT id FROM ugc_appeals WHERE submission_id = ?`
    ).get(submissionId)
    if (existingAppeal) {
      return reply.status(409).send({ error: 'An appeal has already been filed for this submission' })
    }

    const appealId = `appeal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    factsDb.prepare(`
      INSERT INTO ugc_appeals (id, submission_id, appellant_id, reason, status, filed_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(appealId, submissionId, user.sub, reason.trim().slice(0, 2000), Date.now())

    factsDb.prepare(
      `UPDATE ugc_submissions SET appeal_id = ? WHERE id = ?`
    ).run(appealId, submissionId)

    return reply.status(201).send({ appealId, status: 'pending' })
  })

  // ── POST /appeal/:appealId/resolve — admin resolves an appeal ──────────────
  app.post('/appeal/:appealId/resolve', async (req, reply) => {
    const adminKey = req.headers['x-admin-key']
    if (!adminKey || adminKey !== config.adminApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const { appealId } = req.params as { appealId: string }
    const { decision, note } = req.body as { decision: 'upheld' | 'denied'; note?: string }

    if (!['upheld', 'denied'].includes(decision)) {
      return reply.status(400).send({ error: 'decision must be "upheld" or "denied"' })
    }

    factsDb.prepare(`
      UPDATE ugc_appeals
      SET status = ?, moderator_note = ?, resolved_at = ?
      WHERE id = ?
    `).run(decision, note ?? null, Date.now(), appealId)

    if (decision === 'upheld') {
      // Re-queue the submission for admin_review
      const appeal = factsDb.prepare(
        `SELECT submission_id FROM ugc_appeals WHERE id = ?`
      ).get(appealId) as { submission_id: string } | undefined
      if (appeal) {
        factsDb.prepare(
          `UPDATE ugc_submissions SET status = 'admin_review' WHERE id = ?`
        ).run(appeal.submission_id)
      }
    }

    return reply.send({ appealId, decision })
  })

  // ── GET /my-submissions — player's own submissions ─────────────────────────
  app.get('/my-submissions', { preHandler: requireAuth }, async (req, reply) => {
    const user = getAuthUser(req)
    const submissions = factsDb.prepare(
      `SELECT id, fact_text, status, submitted_at, upvotes, downvotes, rejection_reason
       FROM ugc_submissions WHERE player_id = ? ORDER BY submitted_at DESC LIMIT 50`
    ).all(user.sub)
    return reply.send({ submissions })
  })

  // ── GET /review-queue — admin queue of submissions needing review ──────────
  app.get('/review-queue', async (req, reply) => {
    const adminKey = req.headers['x-admin-key']
    if (!adminKey || adminKey !== config.adminApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const status = (req.query as Record<string, string>)['status'] ?? 'admin_review'
    const queue = factsDb.prepare(
      `SELECT id, player_id, fact_text, correct_answer, distractors, category,
              source_url, source_name, auto_filter_passed, auto_filter_reason,
              upvotes, downvotes, status, submitted_at
       FROM ugc_submissions WHERE status = ? ORDER BY submitted_at ASC LIMIT 50`
    ).all(status)
    return reply.send({ queue, total: queue.length })
  })

  // ── POST /review/:submissionId — admin approve/reject a submission ─────────
  app.post('/review/:submissionId', async (req, reply) => {
    const adminKey = req.headers['x-admin-key']
    if (!adminKey || adminKey !== config.adminApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const { submissionId } = req.params as { submissionId: string }
    const { action, reason } = req.body as { action: 'approve' | 'reject'; reason?: string }
    if (!['approve', 'reject'].includes(action)) {
      return reply.status(400).send({ error: 'Action must be approve or reject' })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const now = new Date().toISOString()
    factsDb.prepare(`
      UPDATE ugc_submissions
      SET status = ?, reviewed_at = ?, rejection_reason = ?
      WHERE id = ?
    `).run(newStatus, now, reason ?? null, submissionId)

    const event = action === 'approve' ? 'ugc.approved' : 'ugc.rejected'
    await triggerWebhook(event, { submissionId, status: newStatus })

    return reply.send({ submissionId, status: newStatus, reason })
  })
}
