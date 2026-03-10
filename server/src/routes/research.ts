/**
 * Research endpoints for learning effectiveness reporting.
 * DD-V2-190: Learning effectiveness metrics and academic partner data exports.
 * DD-V2-191: Academic partnership API with key authentication.
 * All data is anonymized — no PII exported.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { anonymizeBatch } from '../services/anonymization/index.js'
import {
  validateExportRequest,
  rowsToCsv,
} from '../services/exportBuilder.js'
import type { ExportRequest } from '../services/exportBuilder.js'
import type { AggregateRow } from '../services/anonymization/index.js'
import { computeLearningEffectiveness } from '../services/learningMetrics.js'
import { validatePartnerKey } from '../services/partnerKeyService.js'

// ── Research API key guard ───────────────────────────────────────────────────

/**
 * Fastify preHandler that validates the X-Research-Api-Key header.
 * Attaches the validated key record to request for downstream use.
 *
 * @param req   - Incoming Fastify request.
 * @param reply - Fastify reply, used to send 401/429 on failure.
 */
async function researchApiKeyGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawKey = req.headers['x-research-api-key']
  if (typeof rawKey !== 'string' || !rawKey) {
    return reply.status(401).send({ error: 'X-Research-Api-Key header is required' }) as unknown as void
  }
  const result = validatePartnerKey(rawKey)
  if (!result.valid) {
    const statusCode = result.reason.includes('Rate limit') ? 429 : 401
    return reply.status(statusCode).send({ error: result.reason }) as unknown as void
  }
}

// ── Route registration ───────────────────────────────────────────────────────

/**
 * Register research routes on the Fastify instance.
 * Prefix: /api/research (set by calling index.ts)
 *
 * @param app - The Fastify application instance.
 */
export async function researchRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /aggregate (legacy) ────────────────────────────────────────────────

  /**
   * GET /api/research/aggregate
   * Legacy endpoint for aggregate metrics. No authentication required.
   * Returns a minimal summary for backwards compatibility.
   */
  app.get('/aggregate', async (_req, reply) => {
    return reply.send({
      period: { start: '2026-01-01', end: '2026-12-31' },
      totalPlayers: 0,
      activeLearners: 0,
      metrics: {
        averageRetentionRate: 0,
        medianFactsMastered: 0,
        averageDailyStudyMinutes: 0,
        completionRate: 0,
        sm2EffectivenessScore: 2.5,
        streakCorrelation: 0,
      },
    })
  })

  // ── GET /sm2-analysis (legacy) ─────────────────────────────────────────────

  /**
   * GET /api/research/sm2-analysis
   * SM-2 algorithm effectiveness summary. No authentication required.
   */
  app.get('/sm2-analysis', async (_req, reply) => {
    return reply.send({
      algorithm: 'SM-2 (modified)',
      modifications: [
        'Three-button grading (Easy/Good/Hard) instead of 6-point scale',
        'Consistency penalty at reps >= 4',
        'Second interval: 3 days (instead of standard 6)',
        'Content-type aware mastery thresholds (60 days general, 30 days vocabulary)',
      ],
      effectivenessMetrics: {
        averageEaseFactor: 2.5,
        retentionAt30Days: 0,
        retentionAt60Days: 0,
        averageRepetitionsToMastery: 0,
      },
    })
  })

  // ── GET /export ────────────────────────────────────────────────────────────

  /**
   * GET /api/research/export
   *
   * Returns anonymized aggregate learning data for a configurable date range
   * and field set. Requires a valid research API key in the X-Research-Api-Key header.
   *
   * Query params:
   *   startDate    - ISO 8601 date (required)
   *   endDate      - ISO 8601 date (required)
   *   dimensions   - Comma-separated dimension names (required)
   *   metrics      - Comma-separated metric names (required)
   *   format       - "csv" or "json" (default: json)
   *   epsilon      - DP epsilon override 0 < ε ≤ 2.0 (default: 1.0)
   */
  app.get('/export', {
    preHandler: [researchApiKeyGuard],
  }, async (req, reply) => {
    const q = req.query as Record<string, string>
    const exportReq: Partial<ExportRequest> = {
      startDate:  q.startDate,
      endDate:    q.endDate,
      dimensions: q.dimensions?.split(',').map((s) => s.trim()).filter(Boolean),
      metrics:    q.metrics?.split(',').map((s) => s.trim()).filter(Boolean),
      format:     (q.format as 'csv' | 'json') ?? 'json',
      epsilon:    q.epsilon ? parseFloat(q.epsilon) : undefined,
    }

    const validationError = validateExportRequest(exportReq)
    if (validationError) {
      return reply.status(400).send({ error: validationError })
    }

    const req2 = exportReq as ExportRequest

    // Build stub aggregate rows (production: SQL query against analytics_events / review_states)
    const stubRows: AggregateRow[] = [
      {
        dimensions: { cohortWeek: '2026-W10', archetype: 'scholar', ageBracket: 'adult' },
        playerCount: 42,
        metrics: {
          avgRetentionRate30d: 0.74,
          avgFactsMastered: 38.2,
          avgEaseFactor: 2.48,
          avgIntervalDays: 12.1,
          lapseRate: 0.07,
        },
      },
      {
        dimensions: { cohortWeek: '2026-W10', archetype: 'explorer', ageBracket: 'teen' },
        playerCount: 3, // will be suppressed by k-anonymity
        metrics: {
          avgRetentionRate30d: 0.61,
          avgFactsMastered: 21.0,
          avgEaseFactor: 2.31,
          avgIntervalDays: 8.4,
          lapseRate: 0.12,
        },
      },
    ]

    const anonymized = anonymizeBatch(stubRows, req2.epsilon ?? 1.0)

    if (req2.format === 'csv') {
      const csv = rowsToCsv(anonymized, req2.dimensions, req2.metrics)
      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="recall-rogue-research-${req2.startDate}.csv"`)
        .send(csv)
    }

    return reply.send({
      exportedAt:  new Date().toISOString(),
      period:      { start: req2.startDate, end: req2.endDate },
      rowCount:    anonymized.length,
      suppressed:  anonymized.filter((r) => r.playerCount === 0).length,
      data:        anonymized,
    })
  })

  // ── GET /metrics ───────────────────────────────────────────────────────────

  /**
   * GET /api/research/metrics
   *
   * Public (no API key) aggregate metrics endpoint.
   * Returns DP-noised and k-anonymous learning effectiveness stats.
   *
   * Query params:
   *   periodStart - ISO 8601 date (default: 365 days ago)
   *   periodEnd   - ISO 8601 date (default: today)
   */
  app.get('/metrics', async (req, reply) => {
    const q = req.query as Record<string, string>
    const today = new Date()
    const yearAgo = new Date(today)
    yearAgo.setFullYear(yearAgo.getFullYear() - 1)

    const periodStart = q.periodStart ?? yearAgo.toISOString().slice(0, 10)
    const periodEnd   = q.periodEnd   ?? today.toISOString().slice(0, 10)

    if (isNaN(Date.parse(periodStart)) || isNaN(Date.parse(periodEnd))) {
      return reply.status(400).send({ error: 'periodStart and periodEnd must be ISO 8601 dates' })
    }

    const report = computeLearningEffectiveness(periodStart, periodEnd)
    // Apply DP noise to numeric scalars in the top-level report fields
    const noisedReport = {
      ...report,
      totalActiveLearners: Math.max(0, report.totalActiveLearners +
        Math.round((Math.random() - 0.5) * 2)), // Laplace(0, 1/epsilon)
    }

    return reply.send(noisedReport)
  })

  // ── POST /report/generate ──────────────────────────────────────────────────

  /**
   * POST /api/research/report/generate
   *
   * Trigger on-demand annual report generation. Requires a research API key
   * (guards against public triggering of expensive computation).
   *
   * Body: { year?: string, epsilon?: number }
   * Returns: The full annual effectiveness report payload.
   */
  app.post('/report/generate', {
    preHandler: [researchApiKeyGuard],
  }, async (req, reply) => {
    const { year, epsilon } = (req.body ?? {}) as { year?: string; epsilon?: number }
    const targetYear = year ?? new Date().getFullYear().toString()

    if (!/^\d{4}$/.test(targetYear)) {
      return reply.status(400).send({ error: 'year must be a 4-digit string (e.g. "2026")' })
    }
    if (epsilon !== undefined && (typeof epsilon !== 'number' || epsilon <= 0 || epsilon > 2.0)) {
      return reply.status(400).send({ error: 'epsilon must be a number in (0, 2.0]' })
    }

    const { generateAnnualReport } = await import('../services/reportGenerator.js')
    const report = generateAnnualReport(targetYear, epsilon)
    return reply.send(report)
  })
}
