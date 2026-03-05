/**
 * Aggregate analytics for a classroom.
 * Pulls from analytics_events for mastery data; joins display names from users table.
 * All queries are aggregate-level — no individual quiz answers exposed.
 *
 * Note: The analytics_events table stores userId inside the JSON `properties` column,
 * not as a separate column. Queries use JSON text matching to identify per-student events.
 */

import { db } from '../db/index.js'
import { analyticsEvents, users } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/** Analytics summary for a single student. */
export interface StudentAnalyticsSummary {
  studentId: string
  displayName: string | null
  factsMastered: number
  masteryRate: number          // 0.0–1.0
  lastActive: number | null    // Unix epoch ms
  streakDays: number
  isStruggling: boolean
}

/** Full class analytics payload. */
export interface ClassAnalytics {
  classroomId: string
  studentCount: number
  activeTodayCount: number
  averageFactsMastered: number
  averageMasteryRate: number
  categoryBreakdown: Record<string, { avgMastery: number; studentsCovered: number }>
  students: StudentAnalyticsSummary[]
  topFacts: Array<{ factId: string; factText: string; masteredByCount: number }>
  hardestFacts: Array<{ factId: string; factText: string; avgEaseFactor: number }>
}

/**
 * Aggregate analytics for a classroom.
 * Pulls from analytics_events for mastery data; pulls display names from users table.
 * All queries are read-only and aggregate-level — no individual quiz answers exposed.
 *
 * @param classroomId - UUID of the classroom.
 * @param studentIds  - List of active student user IDs in the classroom.
 * @returns Aggregated class analytics.
 */
export async function aggregateClassAnalytics(
  classroomId: string,
  studentIds: string[],
): Promise<ClassAnalytics> {
  if (studentIds.length === 0) {
    return {
      classroomId,
      studentCount: 0,
      activeTodayCount: 0,
      averageFactsMastered: 0,
      averageMasteryRate: 0,
      categoryBreakdown: {},
      students: [],
      topFacts: [],
      hardestFacts: [],
    }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Pull display names from users table
  const userRows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})`)
    .all()
  const displayNameById = new Map(userRows.map((u) => [u.id, u.displayName]))

  // For each student, get their most recent 'save_synced' analytics event
  // userId is stored in the JSON properties blob as: {"userId":"<id>", ...}
  const studentDataMap = new Map<string, { factsMastered: number; masteryRate: number; streakDays: number; lastActive: number | null }>()

  for (const sid of studentIds) {
    const latestSave = await db
      .select({
        properties: analyticsEvents.properties,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventName, 'save_synced'),
          sql`${analyticsEvents.properties} LIKE ${'%"userId":"' + sid + '"%'}`,
        ),
      )
      .orderBy(desc(analyticsEvents.createdAt))
      .get()

    if (latestSave) {
      let props: Record<string, unknown> = {}
      try {
        props = JSON.parse(latestSave.properties as string) as Record<string, unknown>
      } catch { /* malformed JSON — skip */ }
      const factsMastered = (props['masteredFacts'] as number) ?? 0
      const totalFacts = (props['totalFactsSeen'] as number) ?? 0
      const masteryRate = totalFacts > 0 ? factsMastered / totalFacts : 0
      const streakDays = (props['streakDays'] as number) ?? 0
      studentDataMap.set(sid, { factsMastered, masteryRate, streakDays, lastActive: latestSave.createdAt })
    } else {
      studentDataMap.set(sid, { factsMastered: 0, masteryRate: 0, streakDays: 0, lastActive: null })
    }
  }

  const students: StudentAnalyticsSummary[] = studentIds.map((sid) => {
    const data = studentDataMap.get(sid) ?? { factsMastered: 0, masteryRate: 0, streakDays: 0, lastActive: null }
    return {
      studentId: sid,
      displayName: displayNameById.get(sid) ?? null,
      factsMastered: data.factsMastered,
      masteryRate: data.masteryRate,
      lastActive: data.lastActive,
      streakDays: data.streakDays,
      isStruggling:
        data.masteryRate < 0.4 ||
        (data.lastActive !== null && Date.now() - data.lastActive > 7 * 86400_000),
    }
  })

  const activeTodayCount = students.filter(
    (s) => s.lastActive !== null && s.lastActive >= todayStart.getTime(),
  ).length

  const averageFactsMastered =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.factsMastered, 0) / students.length
      : 0

  const averageMasteryRate =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.masteryRate, 0) / students.length
      : 0

  // Category breakdown from 'quiz_answered' events for all students
  const categoryMastery: Record<string, { total: number; mastered: number; studentSet: Set<string> }> = {}

  for (const sid of studentIds) {
    const quizEvents = await db
      .select({ properties: analyticsEvents.properties })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventName, 'quiz_answered'),
          sql`${analyticsEvents.properties} LIKE ${'%"userId":"' + sid + '"%'}`,
        ),
      )
      .all()

    for (const event of quizEvents) {
      let props: Record<string, unknown> = {}
      try {
        props = JSON.parse(event.properties as string) as Record<string, unknown>
      } catch { continue }
      const category = props['factCategory'] as string | undefined
      const mastered = props['mastered'] as boolean | undefined
      if (!category || mastered === undefined) continue
      if (!categoryMastery[category]) {
        categoryMastery[category] = { total: 0, mastered: 0, studentSet: new Set() }
      }
      categoryMastery[category].total++
      if (mastered) categoryMastery[category].mastered++
      categoryMastery[category].studentSet.add(sid)
    }
  }

  const categoryBreakdown: Record<string, { avgMastery: number; studentsCovered: number }> = {}
  for (const [cat, data] of Object.entries(categoryMastery)) {
    categoryBreakdown[cat] = {
      avgMastery: data.total > 0 ? data.mastered / data.total : 0,
      studentsCovered: data.studentSet.size,
    }
  }

  return {
    classroomId,
    studentCount: studentIds.length,
    activeTodayCount,
    averageFactsMastered,
    averageMasteryRate,
    categoryBreakdown,
    students,
    topFacts: [],     // Populated by separate query in production
    hardestFacts: [], // Populated by separate query in production
  }
}
