import { FastifyInstance } from 'fastify'

/** Classroom configuration */
export interface Classroom {
  id: string
  teacherId: string
  name: string
  joinCode: string
  students: string[]
  createdAt: string
  settings: {
    categories: string[]      // Fact categories to focus on
    dailyGoal: number         // Facts per day target
    ageRating: 'kid' | 'teen'
  }
}

/**
 * Classroom routes for educational partnerships.
 * DD-V2-169: Teacher Dashboard — post-launch only, after D30 >= 10%.
 */
export async function classroomRoutes(app: FastifyInstance): Promise<void> {
  // Create a classroom
  app.post('/create', async (req, reply) => {
    const body = req.body as { name: string; categories?: string[]; dailyGoal?: number; ageRating?: 'kid' | 'teen' }
    if (!body.name) return reply.status(400).send({ error: 'Classroom name required' })

    const classroom: Classroom = {
      id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      teacherId: 'teacher-stub', // From auth in production
      name: body.name.slice(0, 100),
      joinCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      students: [],
      createdAt: new Date().toISOString(),
      settings: {
        categories: body.categories ?? [],
        dailyGoal: body.dailyGoal ?? 10,
        ageRating: body.ageRating ?? 'kid'
      }
    }
    return reply.status(201).send({ classroom })
  })

  // Join a classroom (student)
  app.post('/join', async (req, reply) => {
    const { joinCode } = req.body as { joinCode: string }
    if (!joinCode) return reply.status(400).send({ error: 'Join code required' })
    // In production: look up classroom by code, add student
    return reply.send({ joined: true, classroomId: 'stub' })
  })

  // Get classroom dashboard (teacher)
  app.get('/:classroomId/dashboard', async (req, reply) => {
    const { classroomId } = req.params as { classroomId: string }
    // In production: aggregate student progress data
    return reply.send({
      classroomId,
      studentCount: 0,
      averageFactsMastered: 0,
      topCategories: [],
      weeklyActivity: []
    })
  })

  // Get student progress (teacher)
  app.get('/:classroomId/students', async (req, reply) => {
    const { classroomId } = req.params as { classroomId: string }
    return reply.send({ classroomId, students: [] })
  })

  // Update classroom settings (teacher)
  app.put('/:classroomId/settings', async (req, reply) => {
    const { classroomId } = req.params as { classroomId: string }
    const settings = req.body as Partial<Classroom['settings']>
    return reply.send({ classroomId, settings })
  })
}
