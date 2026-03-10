/**
 * Classroom management routes for the Recall Rogue Teacher Dashboard.
 * Covers full CRUD for classrooms, student membership, homework assignments,
 * class announcements, analytics aggregation, and progress reports.
 *
 * Routes (registered under /api/classrooms):
 *   POST   /                                  — create a classroom (educator)
 *   GET    /                                  — list educator's classes (educator)
 *   DELETE /:classroomId                      — archive a classroom (educator)
 *   POST   /join                              — student joins by code (auth)
 *   DELETE /:classroomId/students/:studentId  — remove a student (educator)
 *   GET    /:classroomId/students             — list students (educator)
 *   GET    /:classroomId/analytics            — class analytics (educator)
 *   POST   /:classroomId/assignments          — create assignment (educator)
 *   GET    /:classroomId/assignments          — list assignments (educator)
 *   GET    /my-active-assignment              — student's active assignment (auth)
 *   POST   /:classroomId/announcements        — post announcement (educator)
 *   GET    /my-announcement                   — student's active announcement (auth)
 *   POST   /:classroomId/progress-report      — trigger progress report emails (educator)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  classrooms,
  classroomStudents,
  homeworkAssignments,
  classAnnouncements,
  users,
} from '../db/schema.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { generateJoinCode } from '../services/classCodeGenerator.js'
import { aggregateClassAnalytics } from '../services/classroomAnalytics.js'

// ── Educator middleware ──────────────────────────────────────────────────────

/**
 * Middleware that requires the caller to be an educator or admin.
 * Must be used after requireAuth.
 */
async function requireEducator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return
  const { sub: userId } = getAuthUser(request)
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
  if (!user || (user.role !== 'educator' && user.role !== 'admin')) {
    return reply.status(403).send({ error: 'Educator account required' })
  }
}

// ── Progress report job (fire-and-forget) ────────────────────────────────────

/**
 * Queue a progress report email job for all students in a classroom.
 * This is a stub implementation — production would delegate to an email job queue.
 *
 * @param classroomId - UUID of the classroom.
 */
async function queueProgressReportJob(classroomId: string): Promise<void> {
  console.log(`[classrooms] Progress report queued for classroom ${classroomId}`)
  // Production: enqueue to a job queue (e.g. Bull, BullMQ) that sends emails
  // to each student asynchronously, respecting COPPA age gates.
}

// ── Route registration ───────────────────────────────────────────────────────

/**
 * Register all classroom routes on the Fastify instance.
 *
 * @param app - The Fastify application instance.
 */
export async function classroomsRoutes(app: FastifyInstance): Promise<void> {

  // ── POST / — create a classroom ─────────────────────────────────────────────

  /**
   * POST /api/classrooms
   * Create a new classroom for the authenticated educator.
   * Body: { name: string; ageRating?: 'kid' | 'teen' }
   */
  app.post('/', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const body = request.body as { name?: string; ageRating?: string }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Class name required' })

    // Enforce class limit
    const teacher = await db
      .select({ classLimit: users.classLimit })
      .from(users)
      .where(eq(users.id, teacherId))
      .get()

    const activeClasses = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isArchived, 0)))
      .all()

    const limit = teacher?.classLimit ?? 5
    if (activeClasses.length >= limit) {
      return reply.status(429).send({ error: `Class limit reached (max ${limit})` })
    }

    const existingCodes = new Set(
      (await db.select({ joinCode: classrooms.joinCode }).from(classrooms).all()).map((r) => r.joinCode),
    )

    const ageRating = body.ageRating === 'kid' ? 'kid' : 'teen'
    const classroom = {
      id: crypto.randomUUID(),
      teacherId,
      name: body.name.trim().slice(0, 100),
      joinCode: generateJoinCode(existingCodes),
      ageRating,
      isArchived: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.insert(classrooms).values(classroom)
    return reply.status(201).send({ classroom })
  })

  // ── GET / — list educator's classes ─────────────────────────────────────────

  /**
   * GET /api/classrooms
   * List the authenticated educator's non-archived classes with student counts.
   */
  app.get('/', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const list = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isArchived, 0)))
      .all()

    // Attach student counts
    const withCounts = await Promise.all(
      list.map(async (c) => {
        const count = await db
          .select({ id: classroomStudents.id })
          .from(classroomStudents)
          .where(and(eq(classroomStudents.classroomId, c.id), eq(classroomStudents.isActive, 1)))
          .all()
        return { ...c, studentCount: count.length }
      }),
    )

    return reply.send({ classrooms: withCounts })
  })

  // ── DELETE /:classroomId — archive a classroom ────────────────────────────────

  /**
   * DELETE /api/classrooms/:classroomId
   * Soft-archive a classroom (hides it from GET /classrooms).
   * Students are not removed — they simply no longer have an active class.
   */
  app.delete('/:classroomId', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }
    const existing = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!existing) return reply.status(404).send({ error: 'Classroom not found' })
    await db.update(classrooms).set({ isArchived: 1, updatedAt: Date.now() }).where(eq(classrooms.id, classroomId))
    return reply.send({ archived: true })
  })

  // ── POST /join — student joins a classroom ────────────────────────────────────

  /**
   * POST /api/classrooms/join
   * Student joins a classroom by entering a 6-character join code.
   * Body: { joinCode: string }
   */
  app.post('/join', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: studentId } = getAuthUser(request)
    const body = request.body as { joinCode?: string }
    if (!body.joinCode) return reply.status(400).send({ error: 'Join code required' })

    const normalised = body.joinCode.toUpperCase().trim()

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.joinCode, normalised), eq(classrooms.isArchived, 0)))
      .get()

    if (!classroom) return reply.status(404).send({ error: 'Class not found — check the code and try again' })

    // Prevent duplicate membership
    const existing = await db
      .select()
      .from(classroomStudents)
      .where(and(eq(classroomStudents.classroomId, classroom.id), eq(classroomStudents.studentId, studentId)))
      .get()

    if (existing?.isActive) return reply.status(409).send({ error: 'Already a member of this class' })

    if (existing && !existing.isActive) {
      // Re-activate removed student
      await db
        .update(classroomStudents)
        .set({ isActive: 1 })
        .where(eq(classroomStudents.id, existing.id))
    } else {
      await db.insert(classroomStudents).values({
        id: crypto.randomUUID(),
        classroomId: classroom.id,
        studentId,
        joinedAt: Date.now(),
        isActive: 1,
      })
    }

    return reply.send({ joined: true, className: classroom.name, classroomId: classroom.id })
  })

  // ── GET /:classroomId/students — list students ───────────────────────────────

  /**
   * GET /api/classrooms/:classroomId/students
   * List all active students in a classroom.
   */
  app.get('/:classroomId/students', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    const members = await db
      .select({
        studentId: classroomStudents.studentId,
        joinedAt: classroomStudents.joinedAt,
        displayName: users.displayName,
      })
      .from(classroomStudents)
      .leftJoin(users, eq(classroomStudents.studentId, users.id))
      .where(and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.isActive, 1)))
      .all()

    return reply.send({ students: members })
  })

  // ── DELETE /:classroomId/students/:studentId — remove a student ───────────────

  /**
   * DELETE /api/classrooms/:classroomId/students/:studentId
   * Remove a student from a classroom (sets isActive = 0).
   */
  app.delete(
    '/:classroomId/students/:studentId',
    { preHandler: requireEducator },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: teacherId } = getAuthUser(request)
      const { classroomId, studentId } = request.params as { classroomId: string; studentId: string }
      const classroom = await db
        .select()
        .from(classrooms)
        .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
        .get()
      if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })
      await db
        .update(classroomStudents)
        .set({ isActive: 0 })
        .where(and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.studentId, studentId)))
      return reply.send({ removed: true })
    },
  )

  // ── GET /:classroomId/analytics — class analytics ─────────────────────────────

  /**
   * GET /api/classrooms/:classroomId/analytics
   * Aggregate learning analytics for a classroom.
   * Only the teacher who owns the classroom may access it.
   */
  app.get('/:classroomId/analytics', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()

    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    const activeStudents = await db
      .select({ studentId: classroomStudents.studentId })
      .from(classroomStudents)
      .where(and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.isActive, 1)))
      .all()

    const studentIds = activeStudents.map((s) => s.studentId)
    const analytics = await aggregateClassAnalytics(classroomId, studentIds)

    return reply.send({ analytics })
  })

  // ── POST /:classroomId/assignments — create assignment ───────────────────────

  /**
   * POST /api/classrooms/:classroomId/assignments
   * Create a homework assignment with category locks and a date range.
   * Body: { title: string; categories: string[]; startDate: number; dueDate: number }
   */
  app.post('/:classroomId/assignments', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    const body = request.body as {
      title?: string
      categories?: unknown
      startDate?: number
      dueDate?: number
    }

    if (!body.title?.trim()) return reply.status(400).send({ error: 'Assignment title required' })
    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return reply.status(400).send({ error: 'At least one category is required' })
    }
    // Validate all entries are strings
    const categories = body.categories as unknown[]
    if (!categories.every(c => typeof c === 'string')) {
      return reply.status(400).send({ error: 'Categories must be an array of strings' })
    }
    if (!body.startDate || !body.dueDate) {
      return reply.status(400).send({ error: 'startDate and dueDate are required' })
    }
    if (body.dueDate <= body.startDate) {
      return reply.status(400).send({ error: 'Due date must be after start date' })
    }

    const assignment = {
      id: crypto.randomUUID(),
      classroomId,
      title: body.title.trim().slice(0, 200),
      categories: JSON.stringify((categories as string[]).slice(0, 10)),
      startDate: body.startDate,
      dueDate: body.dueDate,
      isActive: 1,
      createdAt: Date.now(),
    }

    await db.insert(homeworkAssignments).values(assignment)
    return reply.status(201).send({ assignment: { ...assignment, categories: categories as string[] } })
  })

  // ── GET /:classroomId/assignments — list assignments ─────────────────────────

  /**
   * GET /api/classrooms/:classroomId/assignments
   * List all active assignments for a classroom.
   */
  app.get('/:classroomId/assignments', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    const rows = await db
      .select()
      .from(homeworkAssignments)
      .where(and(eq(homeworkAssignments.classroomId, classroomId), eq(homeworkAssignments.isActive, 1)))
      .orderBy(desc(homeworkAssignments.createdAt))
      .all()

    const assignments = rows.map(a => ({
      ...a,
      categories: JSON.parse(a.categories as string) as string[],
    }))

    return reply.send({ assignments })
  })

  // ── GET /my-active-assignment — student's current assignment ─────────────────

  /**
   * GET /api/classrooms/my-active-assignment
   * Returns the active homework assignment for the authenticated student.
   * If the student is in multiple classes, returns the most recently created active assignment.
   * Returns { assignment: null } if no active assignment.
   */
  app.get('/my-active-assignment', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: studentId } = getAuthUser(request)
    const now = Date.now()

    // Find all classrooms the student is active in
    const memberships = await db
      .select({ classroomId: classroomStudents.classroomId })
      .from(classroomStudents)
      .where(and(eq(classroomStudents.studentId, studentId), eq(classroomStudents.isActive, 1)))
      .all()

    if (memberships.length === 0) return reply.send({ assignment: null })

    const classroomIds = memberships.map((m) => m.classroomId)

    // Find the most recent active assignment across all enrolled classes
    const active = await db
      .select()
      .from(homeworkAssignments)
      .where(
        and(
          inArray(homeworkAssignments.classroomId, classroomIds),
          eq(homeworkAssignments.isActive, 1),
          sql`${homeworkAssignments.startDate} <= ${now}`,
          sql`${homeworkAssignments.dueDate} >= ${now}`,
        ),
      )
      .orderBy(desc(homeworkAssignments.createdAt))
      .get()

    if (!active) return reply.send({ assignment: null })

    return reply.send({
      assignment: {
        id: active.id,
        title: active.title,
        categories: JSON.parse(active.categories as string) as string[],
        dueDate: active.dueDate,
      },
    })
  })

  // ── POST /:classroomId/announcements — post announcement ─────────────────────

  /**
   * POST /api/classrooms/:classroomId/announcements
   * Post a class announcement. Auto-expires after 14 days.
   * Body: { message: string }
   */
  app.post('/:classroomId/announcements', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }
    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    const body = request.body as { message?: string }
    if (!body.message?.trim()) return reply.status(400).send({ error: 'Message required' })

    const now = Date.now()
    const announcement = {
      id: crypto.randomUUID(),
      classroomId,
      message: body.message.trim().slice(0, 280),
      postedAt: now,
      expiresAt: now + 14 * 86400_000,
      isDeleted: 0,
    }

    await db.insert(classAnnouncements).values(announcement)
    return reply.status(201).send({ announcement })
  })

  // ── GET /my-announcement — student's current announcement ────────────────────

  /**
   * GET /api/classrooms/my-announcement
   * Returns the latest non-expired, non-deleted announcement for the student's enrolled classes.
   * Returns { announcement: null } if none is active.
   */
  app.get('/my-announcement', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: studentId } = getAuthUser(request)
    const now = Date.now()

    const memberships = await db
      .select({ classroomId: classroomStudents.classroomId })
      .from(classroomStudents)
      .where(and(eq(classroomStudents.studentId, studentId), eq(classroomStudents.isActive, 1)))
      .all()

    if (memberships.length === 0) return reply.send({ announcement: null })

    const classroomIds = memberships.map((m) => m.classroomId)
    const active = await db
      .select({
        id: classAnnouncements.id,
        message: classAnnouncements.message,
        expiresAt: classAnnouncements.expiresAt,
      })
      .from(classAnnouncements)
      .where(
        and(
          inArray(classAnnouncements.classroomId, classroomIds),
          eq(classAnnouncements.isDeleted, 0),
          sql`${classAnnouncements.expiresAt} >= ${now}`,
        ),
      )
      .orderBy(desc(classAnnouncements.postedAt))
      .get()

    return reply.send({ announcement: active ?? null })
  })

  // ── POST /:classroomId/progress-report — trigger batch email ─────────────────

  /**
   * POST /api/classrooms/:classroomId/progress-report
   * Trigger a batch progress report email to all students in a classroom.
   * Returns 202 immediately; emails are sent asynchronously.
   */
  app.post('/:classroomId/progress-report', { preHandler: requireEducator }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: teacherId } = getAuthUser(request)
    const { classroomId } = request.params as { classroomId: string }
    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .get()
    if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

    // Queue the job — do not await; return 202 immediately
    queueProgressReportJob(classroomId).catch((err: unknown) => {
      console.error('[classrooms] Progress report job failed:', err)
    })

    return reply.status(202).send({ message: 'Progress report emails are being sent' })
  })
}
