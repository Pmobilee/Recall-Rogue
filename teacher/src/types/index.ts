/**
 * Shared TypeScript interfaces for the Terra Gacha Teacher Dashboard.
 */

/** A classroom owned by an educator. */
export interface Classroom {
  id: string
  teacherId: string
  name: string
  joinCode: string
  ageRating: 'kid' | 'teen'
  isArchived: number
  createdAt: number
  updatedAt: number
  studentCount?: number
}

/** A student member of a classroom. */
export interface ClassroomStudent {
  id: string
  classroomId: string
  studentId: string
  joinedAt: number
  isActive: number
  displayName?: string | null
}

/** A homework assignment. */
export interface HomeworkAssignment {
  id: string
  classroomId: string
  title: string
  categories: string[]
  startDate: number
  dueDate: number
  isActive: number
  createdAt: number
}

/** A class announcement. */
export interface ClassAnnouncement {
  id: string
  classroomId: string
  message: string
  postedAt: number
  expiresAt: number
  isDeleted: number
}

/** Per-student analytics summary. */
export interface StudentAnalyticsSummary {
  studentId: string
  displayName: string | null
  factsMastered: number
  masteryRate: number
  lastActive: number | null
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

/** Navigation params for the simple router. */
export interface RouteParams {
  page: string
  params?: Record<string, string>
}
