# Phase 44: Teacher Dashboard

**Last Updated**: 2026-03-04
**Status**: Planned (post-Phase 43)
**Prerequisite Phases**: Phase 19 (Auth & Cloud), Phase 24 (Language Learning), Phase 25 (Advanced Features — specifically 25.10 Kid Mode for student-side enforcement), Phase 41 (Advanced Analytics)

---

## Overview

**Goal**: Build a standalone educator-facing web application that lets verified teachers create and manage classes, monitor aggregate student learning progress, and push homework category locks directly into students' games. The teacher dashboard is a separate Vite app served from `teacher/` in the repository root; it shares only the backend API and TypeScript types with the main game. It does not use Phaser or Capacitor.

**Why this phase exists**: Recall Rogue's SM-2 engine and category system make it uniquely suited for structured classroom use. A teacher who can lock the fact category to "Geology" for a week, see which students are struggling with specific facts, and schedule a due-date deadline has a genuinely useful pedagogical tool — not a toy. The Dashboard is the B2B wedge that unlocks school licensing deals and provides third-party proof of learning effectiveness.

**Design decisions governing this phase**:
- **DD-V2-169**: Teacher Dashboard launches post-launch, after D30 retention >= 10%. The dashboard is useless without an installed player base in schools.
- **DD-V2-170**: Educator accounts are separate from regular player accounts; they share the same `users` table with a `role` field (`player` | `educator` | `admin`). A player can request educator elevation; they cannot self-approve.
- **DD-V2-171**: Class codes are 6-character alphanumeric strings (e.g., `GEO42X`). Students join via the game's Settings screen; the join code is the only linkage mechanism. No QR codes, no email invites for V1.
- **DD-V2-172**: Homework assignments define a category lock (one or more fact categories), a start date, and a due date. When a student's game is live during an active assignment, the quiz pool is filtered to assignment categories. Students are never forced into a quiz — the filter only biases the quiz pool. The assignment expires automatically at the due date.

**What this phase does NOT include**:
- Direct messaging between teacher and individual students
- In-game notifications pushed from teacher to student in real time
- Gradebook integrations (Canvas, Google Classroom, Clever) — planned for Phase 50
- Parent dashboard — covered by Phase 45
- Subscription billing for institutional licenses — this is a separate commercial decision; the dashboard is built first to validate demand

**Estimated complexity**: High. Three separate deliverables: a standalone Vite app, backend route additions, and in-game integration for category-lock delivery. The educator verification flow involves manual review; a simple admin UI panel is required. The analytics aggregation queries need to be efficient enough to not lock the database when a class has 30 students.

---

## Prerequisites

Before beginning Phase 44:

1. Phase 19 (Auth & Cloud) complete: the `users` table exists; JWT access tokens are issued; the `requireAuth` middleware is available. The `classroom.ts` stub route exists at `server/src/routes/classroom.ts` and must be replaced by the full implementation.
2. Phase 41 (Advanced Analytics) complete: the analytics event pipeline is operational. Teacher analytics aggregate from `analytics_events`; without a populated events table the dashboard shows zeros.
3. The `users` table in `server/src/db/schema.ts` must have a `role` column (`player` | `educator` | `admin`) before any educator-account logic is written. If the migration has not run, run it as the first sub-step of 44.1.
4. `npm run typecheck` passes on both `src/` and `server/src/` before starting.
5. The existing `server/src/routes/classroom.ts` stub is deleted and replaced entirely in 44.3. Do not build on the stub; it is a placeholder only.

---

## Sub-Phase 44.1: Teacher Dashboard App Scaffold

### What

Bootstrap a standalone Vite 7 + Svelte 5 + TypeScript application in `teacher/` at the repository root. This app is a separate build target; it has its own `package.json`, `vite.config.ts`, and `index.html`. It is NOT embedded in the main game. It runs on port 5174 in development. In production it is served by the same Fastify server at the path prefix `/teacher/`.

### Where

- `teacher/` — new top-level directory (entire scaffold)
- `teacher/package.json`
- `teacher/tsconfig.json`
- `teacher/vite.config.ts`
- `teacher/index.html`
- `teacher/src/main.ts`
- `teacher/src/App.svelte`
- `teacher/src/app.css`
- `teacher/src/lib/api.ts` — typed fetch wrapper pointing at `/api/*`
- `teacher/src/lib/auth.ts` — educator auth store (JWT storage, login/logout)
- `teacher/src/routes/` — page components (SvelteKit-style route convention but using manual routing via a simple router, no SvelteKit dependency)
- `teacher/src/routes/Login.svelte`
- `teacher/src/routes/Dashboard.svelte` — top-level class list after login
- `teacher/src/routes/ClassDetail.svelte` — per-class analytics view
- `teacher/src/routes/AssignmentEditor.svelte` — homework assignment creation
- `teacher/src/routes/VerificationPending.svelte` — shown after educator registration while awaiting approval
- `teacher/src/components/NavBar.svelte`
- `teacher/src/components/ClassCard.svelte`
- `teacher/src/components/StudentRow.svelte`
- `teacher/src/components/CategoryPicker.svelte`
- `teacher/src/components/ProgressBar.svelte`
- `teacher/src/types/index.ts` — shared educator-side types

### How

**Step 1: `teacher/package.json`**

```json
{
  "name": "recall-rogue-teacher",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174",
    "build": "vite build",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "svelte": "^5.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0"
  }
}
```

**Step 2: `teacher/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  base: '/teacher/',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../server/public/teacher',
    emptyOutDir: true,
  },
})
```

**Step 3: `teacher/src/lib/api.ts` — typed fetch wrapper**

```typescript
/**
 * Typed API client for the teacher dashboard.
 * All requests are authenticated with a Bearer token stored in localStorage.
 * Throws ApiError on non-2xx responses.
 */

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getToken(): string | null {
  return localStorage.getItem('teacher_access_token')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(res.status, (err as { error: string }).error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}

/** Convenience methods. */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

**Step 4: `teacher/src/lib/auth.ts` — educator auth store**

```typescript
/**
 * Educator auth store for the teacher dashboard.
 * Wraps the same /api/auth/* endpoints as the main game
 * but targets the 'educator' role specifically.
 */

import { writable, derived } from 'svelte/store'

export interface EducatorUser {
  id: string
  email: string
  displayName: string | null
  role: 'educator' | 'admin'
  verificationStatus: 'pending' | 'approved' | 'rejected'
}

const _user = writable<EducatorUser | null>(null)
export const currentUser = derived(_user, (u) => u)
export const isLoggedIn = derived(_user, (u) => u !== null)
export const isPendingVerification = derived(
  _user,
  (u) => u?.verificationStatus === 'pending',
)

export function setUser(user: EducatorUser): void {
  _user.set(user)
}

export function clearUser(): void {
  _user.set(null)
  localStorage.removeItem('teacher_access_token')
  localStorage.removeItem('teacher_refresh_token')
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('teacher_access_token', accessToken)
  localStorage.setItem('teacher_refresh_token', refreshToken)
}
```

**Step 5: `teacher/src/App.svelte` — minimal router**

The teacher app uses a flat manual router (no SvelteKit, no extra dependencies). The router reads a `currentRoute` writable store and renders the matching page component.

```svelte
<script lang="ts">
  import { writable } from 'svelte/store'
  import NavBar from './components/NavBar.svelte'
  import Login from './routes/Login.svelte'
  import Dashboard from './routes/Dashboard.svelte'
  import ClassDetail from './routes/ClassDetail.svelte'
  import AssignmentEditor from './routes/AssignmentEditor.svelte'
  import VerificationPending from './routes/VerificationPending.svelte'
  import { isLoggedIn, isPendingVerification } from './lib/auth'

  export const currentRoute = writable<{ page: string; params?: Record<string, string> }>({ page: 'login' })

  function navigate(page: string, params?: Record<string, string>): void {
    currentRoute.set({ page, params })
  }
</script>

{#if !$isLoggedIn}
  <Login {navigate} />
{:else if $isPendingVerification}
  <VerificationPending />
{:else}
  <NavBar {navigate} />
  {#if $currentRoute.page === 'dashboard'}
    <Dashboard {navigate} />
  {:else if $currentRoute.page === 'class'}
    <ClassDetail classId={$currentRoute.params?.classId ?? ''} {navigate} />
  {:else if $currentRoute.page === 'assignment'}
    <AssignmentEditor classId={$currentRoute.params?.classId ?? ''} assignmentId={$currentRoute.params?.assignmentId} {navigate} />
  {/if}
{/if}
```

**Step 6: Database migration — add `role` and educator columns to `users`**

In `server/src/db/schema.ts`, extend the `users` table with:

```typescript
// Add to users table definition:
role: text('role').notNull().default('player'),           // 'player' | 'educator' | 'admin'
educatorVerification: text('educator_verification'),       // 'pending' | 'approved' | 'rejected' | null
educatorOrg: text('educator_org'),                         // School name (free text, 100 chars)
educatorDomain: text('educator_domain'),                   // Email domain (e.g., 'school.edu')
classLimit: integer('class_limit').notNull().default(5),   // Max classes per educator
```

Run a migration in `server/src/db/migrate.ts` to `ALTER TABLE users ADD COLUMN ...` for each new column (SQLite supports `ADD COLUMN`; no data is lost). PostgreSQL migration uses the same `ALTER TABLE` syntax.

### Acceptance Criteria for 44.1

- [ ] `teacher/` directory exists with a valid `package.json`, `vite.config.ts`, `tsconfig.json`
- [ ] `cd teacher && npm install && npm run build` succeeds with no TypeScript errors
- [ ] `npm run typecheck` (inside `teacher/`) passes with zero errors
- [ ] Dev server starts on port 5174 (`npm run dev` inside `teacher/`)
- [ ] Navigating to `http://localhost:5174/teacher/` shows the Login page
- [ ] `server/src/db/schema.ts` has the four new `users` columns with correct types
- [ ] Database migration runs without error on a fresh SQLite database
- [ ] `api.ts` fetch wrapper correctly injects the Bearer token from `localStorage`

---

## Sub-Phase 44.2: Educator Verification Flow

### What

A teacher account begins as a regular registered account. To become an educator, the user submits a verification request from the teacher dashboard Login page: their school name, school email domain (must end in `.edu`, `.ac.*`, `.k12.*`, or be a manually allowlisted domain), and an optional verification note. The request enters a manual review queue visible to admins. Until approved, the teacher sees the `VerificationPending` screen. On approval, their `role` is set to `educator` and `educatorVerification` to `approved`; on rejection, the status is set to `rejected` with a rejection reason.

Email domain validation is a first-pass heuristic to reduce spam; it is NOT a guarantee. The admin review step is mandatory.

### Where

- `teacher/src/routes/Login.svelte` — Add "Request Educator Access" flow as a secondary action below the standard login form
- `teacher/src/routes/VerificationPending.svelte` — shown after submission
- `teacher/src/routes/VerificationRejected.svelte` — shown if rejected (new file)
- `server/src/routes/educator.ts` — new file, all educator-account endpoints
- `server/src/routes/admin.ts` — extend with educator review queue routes
- `server/src/db/schema.ts` — `educatorVerificationRequests` table (new)

### How

**Step 1: `educatorVerificationRequests` table**

```typescript
// server/src/db/schema.ts

export const educatorVerificationRequests = sqliteTable('educator_verification_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolName: text('school_name').notNull(),           // Free text, max 200 chars
  emailDomain: text('email_domain').notNull(),         // Extracted from user email automatically
  schoolUrl: text('school_url'),                       // Optional school website URL
  verificationNote: text('verification_note'),         // Optional message from applicant, max 500 chars
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewed_by'),                     // Admin user ID
  reviewNote: text('review_note'),                     // Rejection reason shown to applicant
  submittedAt: integer('submitted_at').notNull(),      // Unix epoch ms
  reviewedAt: integer('reviewed_at'),
})
```

**Step 2: Email domain validation helper**

```typescript
// server/src/services/educatorDomainValidator.ts

/** Known educational TLD patterns for first-pass heuristic validation. */
const EDUCATIONAL_PATTERNS: RegExp[] = [
  /\.edu$/i,
  /\.edu\./i,          // e.g., .edu.au, .edu.cn
  /\.ac\./i,           // e.g., .ac.uk, .ac.nz
  /\.k12\./i,          // e.g., .k12.ca.us
  /\.school\./i,
  /\.schools\./i,
]

/**
 * Check whether an email domain passes the heuristic educational domain test.
 * This is NOT authoritative — manual review always follows.
 *
 * @param domain - The domain portion of the applicant's email address.
 * @returns True if the domain matches a known educational pattern.
 */
export function looksLikeEducationalDomain(domain: string): boolean {
  return EDUCATIONAL_PATTERNS.some((pattern) => pattern.test(domain))
}

/**
 * Extract the domain from a full email address.
 * Returns null if the email is malformed.
 *
 * @param email - Full email address string.
 */
export function extractEmailDomain(email: string): string | null {
  const parts = email.split('@')
  if (parts.length !== 2 || !parts[1] || parts[1].length < 3) return null
  return parts[1].toLowerCase()
}
```

**Step 3: `server/src/routes/educator.ts` — educator account endpoints**

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users, educatorVerificationRequests } from '../db/schema.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { looksLikeEducationalDomain, extractEmailDomain } from '../services/educatorDomainValidator.js'

export async function educatorRoutes(app: FastifyInstance): Promise<void> {

  /**
   * POST /api/educator/verify-request
   * Submit an educator verification request.
   * The user must already be logged in as a regular player account.
   * Body: { schoolName: string; schoolUrl?: string; verificationNote?: string }
   */
  app.post(
    '/verify-request',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId, email } = getAuthUser(request)

      // Prevent duplicate submissions
      const existing = await db
        .select()
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.userId, userId))
        .get()

      if (existing && existing.status === 'pending') {
        return reply.status(409).send({ error: 'Verification request already pending' })
      }
      if (existing && existing.status === 'approved') {
        return reply.status(409).send({ error: 'Account is already an approved educator' })
      }

      const body = request.body as {
        schoolName: string
        schoolUrl?: string
        verificationNote?: string
      }

      if (!body.schoolName || body.schoolName.trim().length === 0) {
        return reply.status(400).send({ error: 'School name is required' })
      }

      const domain = extractEmailDomain(email)
      if (!domain) {
        return reply.status(400).send({ error: 'Unable to determine email domain' })
      }

      const domainIsEducational = looksLikeEducationalDomain(domain)

      const requestRecord = {
        id: crypto.randomUUID(),
        userId,
        schoolName: body.schoolName.trim().slice(0, 200),
        emailDomain: domain,
        schoolUrl: body.schoolUrl?.trim().slice(0, 500) ?? null,
        verificationNote: body.verificationNote?.trim().slice(0, 500) ?? null,
        status: 'pending' as const,
        reviewedBy: null,
        reviewNote: null,
        submittedAt: Date.now(),
        reviewedAt: null,
      }

      await db.insert(educatorVerificationRequests).values(requestRecord)

      // Flag on the user record immediately so the frontend can show the pending state
      await db
        .update(users)
        .set({ educatorVerification: 'pending' })
        .where(eq(users.id, userId))

      return reply.status(201).send({
        requestId: requestRecord.id,
        domainIsEducational,
        message: domainIsEducational
          ? 'Request submitted. Your domain looks educational — typical review time is 1–2 business days.'
          : 'Request submitted. Your email domain is not a standard .edu domain, so manual review may take longer (3–5 business days).',
      })
    },
  )

  /**
   * GET /api/educator/status
   * Check the caller's current educator verification status.
   * Returns role, verificationStatus, and rejection reason if rejected.
   */
  app.get(
    '/status',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request)

      const user = await db
        .select({
          role: users.role,
          educatorVerification: users.educatorVerification,
          classLimit: users.classLimit,
        })
        .from(users)
        .where(eq(users.id, userId))
        .get()

      if (!user) return reply.status(404).send({ error: 'User not found' })

      const verReq = await db
        .select({ reviewNote: educatorVerificationRequests.reviewNote })
        .from(educatorVerificationRequests)
        .where(eq(educatorVerificationRequests.userId, userId))
        .get()

      return reply.send({
        role: user.role,
        verificationStatus: user.educatorVerification ?? 'not_requested',
        rejectionReason: verReq?.reviewNote ?? null,
        classLimit: user.classLimit,
      })
    },
  )
}
```

**Step 4: Admin review queue routes (extend `server/src/routes/admin.ts`)**

Add these two endpoints inside the existing `adminRoutes` function:

```typescript
// GET /api/admin/educator-queue — list pending verification requests
app.get('/educator-queue', { preHandler: requireAdmin }, async (_req, reply) => {
  const queue = await db
    .select({
      requestId: educatorVerificationRequests.id,
      userId: educatorVerificationRequests.userId,
      schoolName: educatorVerificationRequests.schoolName,
      emailDomain: educatorVerificationRequests.emailDomain,
      schoolUrl: educatorVerificationRequests.schoolUrl,
      verificationNote: educatorVerificationRequests.verificationNote,
      status: educatorVerificationRequests.status,
      submittedAt: educatorVerificationRequests.submittedAt,
    })
    .from(educatorVerificationRequests)
    .where(eq(educatorVerificationRequests.status, 'pending'))
    .all()

  return reply.send({ queue, total: queue.length })
})

// POST /api/admin/educator-queue/:requestId/decide — approve or reject
app.post(
  '/educator-queue/:requestId/decide',
  { preHandler: requireAdmin },
  async (request, reply) => {
    const { requestId } = request.params as { requestId: string }
    const { decision, reviewNote, classLimit } = request.body as {
      decision: 'approve' | 'reject'
      reviewNote?: string
      classLimit?: number
    }

    if (decision !== 'approve' && decision !== 'reject') {
      return reply.status(400).send({ error: 'decision must be "approve" or "reject"' })
    }

    const verReq = await db
      .select()
      .from(educatorVerificationRequests)
      .where(eq(educatorVerificationRequests.id, requestId))
      .get()

    if (!verReq) return reply.status(404).send({ error: 'Request not found' })
    if (verReq.status !== 'pending') {
      return reply.status(409).send({ error: 'Request already reviewed' })
    }

    await db
      .update(educatorVerificationRequests)
      .set({
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewNote: reviewNote?.slice(0, 500) ?? null,
        reviewedAt: Date.now(),
      })
      .where(eq(educatorVerificationRequests.id, requestId))

    if (decision === 'approve') {
      await db
        .update(users)
        .set({
          role: 'educator',
          educatorVerification: 'approved',
          classLimit: classLimit ?? 5,
        })
        .where(eq(users.id, verReq.userId))
    } else {
      await db
        .update(users)
        .set({ educatorVerification: 'rejected' })
        .where(eq(users.id, verReq.userId))
    }

    return reply.send({ requestId, decision, userId: verReq.userId })
  },
)
```

**Step 5: `teacher/src/routes/Login.svelte` — verification request form**

The Login screen has two modes: standard login (for already-approved educators) and a "Request Educator Access" secondary form. Switching between them is done via a tab-like toggle.

```svelte
<script lang="ts">
  import { api } from '../lib/api'
  import { setUser, saveTokens } from '../lib/auth'

  let mode: 'login' | 'register' = 'login'
  let email = ''
  let password = ''
  let schoolName = ''
  let schoolUrl = ''
  let verificationNote = ''
  let error = ''
  let submitting = false

  async function handleLogin() {
    submitting = true
    error = ''
    try {
      const res = await api.post<{ token: string; refreshToken: string; user: Record<string, unknown> }>(
        '/auth/login',
        { email, password },
      )
      saveTokens(res.token, res.refreshToken)
      const statusRes = await api.get<{ role: string; verificationStatus: string; classLimit: number }>(
        '/educator/status',
      )
      if (statusRes.role !== 'educator' && statusRes.role !== 'admin') {
        error = 'This account is not an approved educator account. Request access below.'
        return
      }
      setUser({
        id: res.user.id as string,
        email: res.user.email as string,
        displayName: res.user.displayName as string | null,
        role: statusRes.role as 'educator' | 'admin',
        verificationStatus: statusRes.verificationStatus as 'pending' | 'approved' | 'rejected',
      })
    } catch (e) {
      error = e instanceof Error ? e.message : 'Login failed'
    } finally {
      submitting = false
    }
  }

  async function handleVerificationRequest() {
    submitting = true
    error = ''
    try {
      // First register a new account (or login to existing)
      const authRes = await api.post<{ token: string; refreshToken: string }>(
        '/auth/register',
        { email, password, displayName: schoolName.slice(0, 30) },
      )
      saveTokens(authRes.token, authRes.refreshToken)
      // Then submit the verification request
      await api.post('/educator/verify-request', { schoolName, schoolUrl, verificationNote })
      const statusRes = await api.get<{ role: string; verificationStatus: string; classLimit: number }>(
        '/educator/status',
      )
      setUser({
        id: '',
        email,
        displayName: null,
        role: 'educator',
        verificationStatus: 'pending',
      })
    } catch (e) {
      error = e instanceof Error ? e.message : 'Submission failed'
    } finally {
      submitting = false
    }
  }
</script>

<!-- Template: Login / Request Access form rendered here -->
```

### Acceptance Criteria for 44.2

- [ ] `POST /api/educator/verify-request` returns 201 with `requestId` for a valid request
- [ ] Submitting a duplicate pending request returns 409
- [ ] `GET /api/educator/status` returns `{ role: 'player', verificationStatus: 'pending' }` after submission
- [ ] `GET /api/admin/educator-queue` (with admin key) returns the pending request
- [ ] `POST /api/admin/educator-queue/:id/decide` with `decision: 'approve'` sets `users.role = 'educator'` and `users.educatorVerification = 'approved'`
- [ ] `POST /api/admin/educator-queue/:id/decide` with `decision: 'reject'` and `reviewNote` sets `educatorVerification = 'rejected'`; the rejection reason is returned by `GET /api/educator/status`
- [ ] Educator logging in after approval sees the Dashboard (not VerificationPending)
- [ ] A regular player logging into the teacher dashboard sees an error message, not the dashboard
- [ ] `npm run typecheck` passes in both `teacher/` and `server/src/`

---

## Sub-Phase 44.3: Class Management

### What

An approved educator can create up to `classLimit` classes (default: 5), each with a unique 6-character join code. Students join via the main Recall Rogue game's Settings screen by entering the join code. The teacher can view the student roster, remove students, and archive (soft-delete) a class. The `classroom.ts` stub is deleted and replaced by `classrooms.ts` with full database persistence.

### Where

- `server/src/routes/classrooms.ts` — new file (replaces deleted `classroom.ts`)
- `server/src/db/schema.ts` — `classrooms`, `classroomStudents` tables
- `src/ui/components/ClassJoinPanel.svelte` — in-game UI for students to enter a join code (new file)
- `src/services/classroomService.ts` — student-side classroom API calls (new file)
- `src/ui/stores/classroomStore.ts` — Svelte store for active classroom membership (new file)
- `teacher/src/routes/Dashboard.svelte` — lists educator's classes with create button
- `teacher/src/routes/ClassDetail.svelte` — student roster, assignment list, analytics summary
- `teacher/src/components/ClassCard.svelte` — class summary tile on Dashboard

### How

**Step 1: Database tables**

```typescript
// server/src/db/schema.ts additions

export const classrooms = sqliteTable('classrooms', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                            // Max 100 chars
  joinCode: text('join_code').notNull().unique(),          // 6-char alphanumeric, e.g. 'GEO42X'
  ageRating: text('age_rating').notNull().default('teen'), // 'kid' | 'teen'
  isArchived: integer('is_archived').notNull().default(0), // 0 = active, 1 = archived
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const classroomStudents = sqliteTable('classroom_students', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  studentId: text('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at').notNull(),
  isActive: integer('is_active').notNull().default(1),     // 0 = removed by teacher
})
```

**Step 2: Join code generation**

```typescript
// server/src/services/classCodeGenerator.ts

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed I, O, 0, 1 for readability

/**
 * Generate a unique 6-character classroom join code.
 * Uses a rejection-sampling loop to guarantee uniqueness.
 * Collision probability at 1,000 active classes: ~0.003% — acceptable.
 *
 * @param existingCodes - Set of codes currently in use (fetched from DB before calling).
 * @returns A 6-character alphanumeric code guaranteed to not be in existingCodes.
 */
export function generateJoinCode(existingCodes: Set<string>): string {
  let code: string
  let attempts = 0
  do {
    code = Array.from({ length: 6 }, () =>
      CHARSET[Math.floor(Math.random() * CHARSET.length)],
    ).join('')
    attempts++
    if (attempts > 1000) throw new Error('Unable to generate unique join code — too many classes?')
  } while (existingCodes.has(code))
  return code
}
```

**Step 3: `server/src/routes/classrooms.ts` — full implementation**

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as crypto from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { classrooms, classroomStudents, users } from '../db/schema.js'
import { requireAuth, getAuthUser } from '../middleware/auth.js'
import { generateJoinCode } from '../services/classCodeGenerator.js'

/** Middleware: require educator or admin role. */
async function requireEducator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return
  const { sub: userId } = getAuthUser(request)
  const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
  if (!user || (user.role !== 'educator' && user.role !== 'admin')) {
    return reply.status(403).send({ error: 'Educator account required' })
  }
}

export async function classroomsRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/classrooms — create a classroom
  app.post('/', { preHandler: requireEducator }, async (request, reply) => {
    const { sub: teacherId } = getAuthUser(request)
    const body = request.body as { name: string; ageRating?: 'kid' | 'teen' }
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

    if (activeClasses.length >= (teacher?.classLimit ?? 5)) {
      return reply.status(429).send({ error: `Class limit reached (max ${teacher?.classLimit ?? 5})` })
    }

    const existingCodes = new Set(
      (await db.select({ joinCode: classrooms.joinCode }).from(classrooms).all()).map((r) => r.joinCode),
    )

    const classroom = {
      id: crypto.randomUUID(),
      teacherId,
      name: body.name.trim().slice(0, 100),
      joinCode: generateJoinCode(existingCodes),
      ageRating: body.ageRating ?? 'teen',
      isArchived: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db.insert(classrooms).values(classroom)
    return reply.status(201).send({ classroom })
  })

  // GET /api/classrooms — list educator's classes
  app.get('/', { preHandler: requireEducator }, async (request, reply) => {
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

  // DELETE /api/classrooms/:classroomId — archive a classroom
  app.delete('/:classroomId', { preHandler: requireEducator }, async (request, reply) => {
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

  // POST /api/classrooms/join — student joins a classroom by code
  app.post('/join', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: studentId } = getAuthUser(request)
    const { joinCode } = request.body as { joinCode: string }
    if (!joinCode) return reply.status(400).send({ error: 'Join code required' })

    const classroom = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.joinCode, joinCode.toUpperCase().trim()), eq(classrooms.isArchived, 0)))
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

  // DELETE /api/classrooms/:classroomId/students/:studentId — remove a student
  app.delete(
    '/:classroomId/students/:studentId',
    { preHandler: requireEducator },
    async (request, reply) => {
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
}
```

**Step 4: In-game join panel (`src/ui/components/ClassJoinPanel.svelte`)**

Rendered inside the Settings screen, under a new "Classroom" section:

```svelte
<script lang="ts">
  import { classroomStore } from '../stores/classroomStore'
  import { apiPost } from '../../services/api'

  let joinCode = ''
  let error = ''
  let success = ''
  let loading = false

  async function joinClass() {
    joinCode = joinCode.toUpperCase().trim()
    if (joinCode.length !== 6) { error = 'Join code must be 6 characters'; return }
    loading = true; error = ''; success = ''
    try {
      const res = await apiPost<{ className: string; classroomId: string }>('/classrooms/join', { joinCode })
      classroomStore.set({ classroomId: res.classroomId, className: res.className })
      success = `Joined "${res.className}"`
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to join class'
    } finally {
      loading = false
    }
  }
</script>

<div class="class-join-panel">
  <h3>Join a Class</h3>
  <p>Enter the 6-character code from your teacher.</p>
  <div class="join-row">
    <input
      type="text"
      bind:value={joinCode}
      placeholder="E.g. GEO42X"
      maxlength="6"
      disabled={loading}
      aria-label="Class join code"
    />
    <button on:click={joinClass} disabled={loading || joinCode.length !== 6}>
      {loading ? 'Joining...' : 'Join'}
    </button>
  </div>
  {#if error}<p class="error">{error}</p>{/if}
  {#if success}<p class="success">{success}</p>{/if}
</div>
```

### Acceptance Criteria for 44.3

- [ ] `POST /api/classrooms` (educator JWT) creates a classroom with a unique 6-char join code
- [ ] Creating a 6th class when limit is 5 returns 429 with a clear error message
- [ ] `GET /api/classrooms` returns the teacher's non-archived classes with correct `studentCount`
- [ ] `POST /api/classrooms/join` with a valid code adds the student; a second call returns 409
- [ ] `POST /api/classrooms/join` with an invalid code returns 404
- [ ] `DELETE /api/classrooms/:id/students/:sid` marks the membership `isActive = 0`
- [ ] `DELETE /api/classrooms/:id` (archive) hides the class from `GET /api/classrooms`
- [ ] `ClassJoinPanel.svelte` renders in the game Settings screen; join flow works end-to-end
- [ ] `classroomStore` persists the joined class name and ID to localStorage
- [ ] Old `server/src/routes/classroom.ts` stub is deleted; no import references remain
- [ ] `npm run typecheck` passes

---

## Sub-Phase 44.4: Aggregate Analytics

### What

The teacher dashboard's ClassDetail view shows per-class and per-student learning analytics. Data is aggregated from the `analytics_events` table (populated by Phase 41). No raw SM-2 state is exposed — teachers see aggregate mastery rates and category breakdowns, not individual quiz answers. Privacy rule: student display names are shown to the teacher who manages their class; they are not exposed to other teachers.

Six analytics panels are shown:

1. **Class Overview** — average facts mastered, average mastery rate, class streak distribution, active-today count
2. **Category Breakdown** — bar chart per fact category: average mastery % across all students
3. **Student Progress Table** — one row per student: display name, facts mastered, mastery rate, last active, current streak
4. **Struggling Students** — students whose mastery rate is below 40% or who have not been active in 7+ days
5. **Top Facts** — the 10 most-mastered facts in the class (useful for teacher to know what content is sticking)
6. **Hardest Facts** — the 10 facts with lowest average ease factor across the class (content to review in class)

### Where

- `server/src/routes/classrooms.ts` — add analytics endpoints to the existing file
- `server/src/services/classroomAnalytics.ts` — new file, aggregation query logic
- `teacher/src/routes/ClassDetail.svelte` — renders all 6 panels
- `teacher/src/components/StudentRow.svelte` — individual student row with mini sparkline
- `teacher/src/components/CategoryBar.svelte` — horizontal progress bar for category analytics

### How

**Step 1: `server/src/services/classroomAnalytics.ts`**

```typescript
import { db } from '../db/index.js'
import { analyticsEvents, classroomStudents } from '../db/schema.js'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'

export interface StudentAnalyticsSummary {
  studentId: string
  displayName: string | null
  factsMastered: number
  masteryRate: number          // 0.0–1.0
  lastActive: number | null    // Unix epoch ms
  streakDays: number
  isStruggling: boolean
}

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

  // Pull save snapshots from analytics_events (event: 'save_synced' carries SM-2 summary)
  const saveEvents = await db
    .select({
      userId: analyticsEvents.userId,
      properties: analyticsEvents.properties,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.eventName, 'save_synced'),
        inArray(analyticsEvents.userId, studentIds),
      ),
    )
    .orderBy(desc(analyticsEvents.createdAt))
    .all()

  // Keep only the most recent save event per student
  const latestByStudent = new Map<string, { properties: unknown; createdAt: number }>()
  for (const event of saveEvents) {
    if (!event.userId) continue
    if (!latestByStudent.has(event.userId)) {
      latestByStudent.set(event.userId, { properties: event.properties, createdAt: event.createdAt })
    }
  }

  // Pull display names
  const userRows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, studentIds))
    .all()
  const displayNameById = new Map(userRows.map((u) => [u.id, u.displayName]))

  const students: StudentAnalyticsSummary[] = studentIds.map((sid) => {
    const latest = latestByStudent.get(sid)
    const props = latest?.properties as Record<string, unknown> | undefined
    const factsMastered = (props?.masteredFacts as number) ?? 0
    const totalFacts = (props?.totalFactsSeen as number) ?? 0
    const masteryRate = totalFacts > 0 ? factsMastered / totalFacts : 0
    const streakDays = (props?.streakDays as number) ?? 0
    const lastActive = latest?.createdAt ?? null

    return {
      studentId: sid,
      displayName: displayNameById.get(sid) ?? null,
      factsMastered,
      masteryRate,
      lastActive,
      streakDays,
      isStruggling: masteryRate < 0.4 || (lastActive !== null && Date.now() - lastActive > 7 * 86400_000),
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

  // Category breakdown from 'quiz_answered' events
  const quizEvents = await db
    .select({ userId: analyticsEvents.userId, properties: analyticsEvents.properties })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.eventName, 'quiz_answered'),
        inArray(analyticsEvents.userId, studentIds),
      ),
    )
    .all()

  const categoryMastery: Record<string, { total: number; mastered: number; students: Set<string> }> = {}
  for (const event of quizEvents) {
    const props = event.properties as Record<string, unknown> | null
    if (!props) continue
    const category = props['factCategory'] as string | undefined
    const mastered = props['mastered'] as boolean | undefined
    if (!category || mastered === undefined) continue
    if (!categoryMastery[category]) {
      categoryMastery[category] = { total: 0, mastered: 0, students: new Set() }
    }
    categoryMastery[category].total++
    if (mastered) categoryMastery[category].mastered++
    if (event.userId) categoryMastery[category].students.add(event.userId)
  }

  const categoryBreakdown: Record<string, { avgMastery: number; studentsCovered: number }> = {}
  for (const [cat, data] of Object.entries(categoryMastery)) {
    categoryBreakdown[cat] = {
      avgMastery: data.total > 0 ? data.mastered / data.total : 0,
      studentsCovered: data.students.size,
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
```

**Step 2: Analytics endpoint in `server/src/routes/classrooms.ts`**

```typescript
// GET /api/classrooms/:classroomId/analytics — class analytics for teacher
app.get('/:classroomId/analytics', { preHandler: requireEducator }, async (request, reply) => {
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
```

### Acceptance Criteria for 44.4

- [ ] `GET /api/classrooms/:id/analytics` returns correct `studentCount` matching active memberships
- [ ] `activeTodayCount` reflects students who have a `save_synced` event since midnight UTC
- [ ] `isStruggling` is `true` for a student with `masteryRate < 0.40`
- [ ] `isStruggling` is `true` for a student with `lastActive` older than 7 days
- [ ] `categoryBreakdown` object has correct keys matching `factCategory` values in the events table
- [ ] Teacher cannot access analytics for a classroom belonging to another teacher (returns 404)
- [ ] Dashboard renders all 6 analytics panels with loading states and empty-state messages
- [ ] `npm run typecheck` passes

---

## Sub-Phase 44.5: Homework Assignments

### What

A teacher creates a homework assignment on a class: select one or more fact categories, set a start date and due date, and optionally add a display name (e.g., "Week 3 — Geology Review"). When the assignment is active (current date is between start and due), the game's quiz pool on that student's device is biased toward the assignment categories using the existing category lock system from Phase 12. The student is not told it is a teacher-assigned lock; it appears as a natural quiz focus. After the due date, the lock expires automatically and the student's normal interest-based quiz pool resumes.

A student can be in at most one assignment at a time per class. If two assignments overlap in time, the server returns the most recently created one.

The game client polls `GET /api/classrooms/my-active-assignment` on app launch and every 30 minutes. The response feeds directly into the category lock store.

### Where

- `server/src/db/schema.ts` — `homeworkAssignments` table
- `server/src/routes/classrooms.ts` — CRUD endpoints for assignments + student polling endpoint
- `src/services/classroomService.ts` — `fetchActiveAssignment()`, `applyAssignmentLock()` (extends existing file)
- `src/ui/stores/classroomStore.ts` — add `activeAssignment` field
- `src/services/interestSpawner.ts` — extend to respect assignment category lock if present
- `teacher/src/routes/AssignmentEditor.svelte` — assignment creation/edit form

### How

**Step 1: `homeworkAssignments` table**

```typescript
export const homeworkAssignments = sqliteTable('homework_assignments', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),                  // e.g., "Week 3 — Geology Review"
  categories: text('categories').notNull(),         // JSON array of category strings, e.g. '["Geology","Chemistry"]'
  startDate: integer('start_date').notNull(),       // Unix epoch ms — inclusive
  dueDate: integer('due_date').notNull(),           // Unix epoch ms — inclusive
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})
```

**Step 2: Assignment endpoints**

```typescript
// POST /api/classrooms/:classroomId/assignments — create assignment
app.post('/:classroomId/assignments', { preHandler: requireEducator }, async (request, reply) => {
  const { sub: teacherId } = getAuthUser(request)
  const { classroomId } = request.params as { classroomId: string }

  const classroom = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
    .get()
  if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

  const body = request.body as {
    title: string
    categories: string[]
    startDate: number
    dueDate: number
  }

  if (!body.title?.trim()) return reply.status(400).send({ error: 'Assignment title required' })
  if (!Array.isArray(body.categories) || body.categories.length === 0) {
    return reply.status(400).send({ error: 'At least one category is required' })
  }
  if (body.dueDate <= body.startDate) {
    return reply.status(400).send({ error: 'Due date must be after start date' })
  }

  const assignment = {
    id: crypto.randomUUID(),
    classroomId,
    title: body.title.trim().slice(0, 200),
    categories: JSON.stringify(body.categories.slice(0, 10)), // Max 10 categories
    startDate: body.startDate,
    dueDate: body.dueDate,
    isActive: 1,
    createdAt: Date.now(),
  }

  await db.insert(homeworkAssignments).values(assignment)
  return reply.status(201).send({ assignment: { ...assignment, categories: body.categories } })
})

// GET /api/classrooms/my-active-assignment — student endpoint, no class ID needed
// Returns the active assignment (if any) for any class the student is enrolled in.
app.get('/my-active-assignment', { preHandler: requireAuth }, async (request, reply) => {
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
```

**Step 3: In-game assignment lock (`src/services/classroomService.ts`)**

```typescript
import { get, writable } from 'svelte/store'
import { classroomStore } from '../ui/stores/classroomStore'

export interface ActiveAssignment {
  id: string
  title: string
  categories: string[]
  dueDate: number
}

/**
 * Fetch the active homework assignment for the current player.
 * Called on app launch and every 30 minutes.
 * Updates the classroomStore with the assignment (or null).
 */
export async function syncActiveAssignment(): Promise<void> {
  try {
    const res = await fetch('/api/classrooms/my-active-assignment', {
      headers: { Authorization: `Bearer ${localStorage.getItem('tg_access_token') ?? ''}` },
    })
    if (!res.ok) return
    const data = await res.json() as { assignment: ActiveAssignment | null }
    classroomStore.update((s) => ({ ...s, activeAssignment: data.assignment }))
  } catch {
    // Network failure: retain last known state; do not clear the assignment
  }
}
```

**Step 4: Apply assignment lock in `src/services/interestSpawner.ts`**

In the existing `selectFactsForSession()` function, check `classroomStore` before applying the player's own category lock:

```typescript
// At the top of selectFactsForSession():
const classroom = get(classroomStore)
if (classroom.activeAssignment) {
  // Teacher assignment overrides player interest lock
  return filterFactsByCategories(allFacts, classroom.activeAssignment.categories)
}
// ... existing interest-based logic follows
```

**Step 5: `teacher/src/routes/AssignmentEditor.svelte`**

The AssignmentEditor renders a form with:
- Text field: assignment title
- `CategoryPicker` component: multi-select from all available fact categories fetched from `GET /api/facts/categories`
- Date range picker: start date and due date (HTML `<input type="date">`)
- Preview text: "Students in this class will see quiz questions focused on [selected categories] from [start date] to [due date]"
- Submit → `POST /api/classrooms/:classroomId/assignments`

### Acceptance Criteria for 44.5

- [ ] `POST /api/classrooms/:id/assignments` creates an assignment with correct `categories` JSON
- [ ] Due date before start date returns 400
- [ ] Empty `categories` array returns 400
- [ ] `GET /api/classrooms/my-active-assignment` returns `assignment: null` for a student not enrolled in any class
- [ ] Returns the most recent active assignment when the student is enrolled and an assignment is live
- [ ] Returns `null` after the `dueDate` has passed (the date check uses server `Date.now()`)
- [ ] `syncActiveAssignment()` populates `classroomStore.activeAssignment` on app launch
- [ ] When `activeAssignment` is set, the quiz pool is filtered to the assignment categories — verified by checking quizzes served in a dev session
- [ ] Assignment lock is transparent: no UI indication to the student that a teacher assigned it
- [ ] `AssignmentEditor.svelte` in the teacher dashboard creates an assignment visible in `GET /api/classrooms/:id/assignments`
- [ ] `npm run typecheck` passes

---

## Sub-Phase 44.6: Teacher-Student Communication

### What

Two one-directional communication channels from teacher to students:

1. **Class Announcements**: The teacher posts a short plain-text announcement (max 280 chars) on a class. Students see it as a dismissable banner in the game at the top of the Settings screen and at the start of the next session. Announcements auto-expire after 14 days.

2. **Progress Reports**: The teacher can trigger a one-time progress report email for all students in a class. The email contains each student's facts mastered this week and their active streak. The email is addressed to the student's registered email (subject to COPPA: students under 13 must have a parent email on file from Phase 45; if not present, the report is skipped for that student). This is a batch job, not a real-time push.

This sub-phase does NOT include individual student messaging — that is deferred to Phase 50 for privacy and COPPA compliance reasons.

### Where

- `server/src/db/schema.ts` — `classAnnouncements` table
- `server/src/routes/classrooms.ts` — announcement endpoints + progress report trigger
- `server/src/services/emailService.ts` — extend with `sendProgressReport()` method
- `src/services/classroomService.ts` — `fetchActiveAnnouncement()` method
- `src/ui/components/AnnouncementBanner.svelte` — dismissable in-game banner (new file)
- `teacher/src/routes/ClassDetail.svelte` — "Post Announcement" panel + "Send Progress Reports" button

### How

**Step 1: `classAnnouncements` table**

```typescript
export const classAnnouncements = sqliteTable('class_announcements', {
  id: text('id').primaryKey(),
  classroomId: text('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),              // Max 280 chars, plain text
  postedAt: integer('posted_at').notNull(),
  expiresAt: integer('expires_at').notNull(),      // postedAt + 14 days
  isDeleted: integer('is_deleted').notNull().default(0),
})
```

**Step 2: Announcement endpoints**

```typescript
// POST /api/classrooms/:classroomId/announcements
app.post('/:classroomId/announcements', { preHandler: requireEducator }, async (request, reply) => {
  const { sub: teacherId } = getAuthUser(request)
  const { classroomId } = request.params as { classroomId: string }
  const classroom = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
    .get()
  if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

  const body = request.body as { message: string }
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

// GET /api/classrooms/my-announcement — student: get active announcement for any enrolled class
app.get('/my-announcement', { preHandler: requireAuth }, async (request, reply) => {
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
    .select({ id: classAnnouncements.id, message: classAnnouncements.message, expiresAt: classAnnouncements.expiresAt })
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

// POST /api/classrooms/:classroomId/progress-report — trigger batch email
app.post('/:classroomId/progress-report', { preHandler: requireEducator }, async (request, reply) => {
  const { sub: teacherId } = getAuthUser(request)
  const { classroomId } = request.params as { classroomId: string }
  const classroom = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
    .get()
  if (!classroom) return reply.status(404).send({ error: 'Classroom not found' })

  // Queue the job — do not await; return 202 immediately
  queueProgressReportJob(classroomId).catch((err) => {
    console.error('Progress report job failed:', err)
  })

  return reply.status(202).send({ message: 'Progress report emails are being sent' })
})
```

**Step 3: `AnnouncementBanner.svelte` — in-game component**

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { classroomStore } from '../stores/classroomStore'

  let announcement: { id: string; message: string; expiresAt: number } | null = null
  let dismissed = false

  onMount(async () => {
    const dismissed_key = 'tg_dismissed_announcements'
    const dismissedIds: string[] = JSON.parse(localStorage.getItem(dismissed_key) ?? '[]')

    try {
      const res = await fetch('/api/classrooms/my-announcement', {
        headers: { Authorization: `Bearer ${localStorage.getItem('tg_access_token') ?? ''}` },
      })
      if (res.ok) {
        const data = await res.json() as { announcement: typeof announcement }
        if (data.announcement && !dismissedIds.includes(data.announcement.id)) {
          announcement = data.announcement
        }
      }
    } catch { /* silent — offline */ }
  })

  function dismiss() {
    if (!announcement) return
    const key = 'tg_dismissed_announcements'
    const ids: string[] = JSON.parse(localStorage.getItem(key) ?? '[]')
    ids.push(announcement.id)
    localStorage.setItem(key, JSON.stringify(ids.slice(-50))) // Keep last 50
    dismissed = true
  }
</script>

{#if announcement && !dismissed}
  <div class="announcement-banner" role="alert" aria-live="polite">
    <span class="announcement-icon" aria-hidden="true">📋</span>
    <p class="announcement-text">{announcement.message}</p>
    <button class="dismiss-btn" on:click={dismiss} aria-label="Dismiss announcement">✕</button>
  </div>
{/if}
```

### Acceptance Criteria for 44.6

- [ ] `POST /api/classrooms/:id/announcements` creates an announcement; second call by same teacher creates a second (not overwrite)
- [ ] `GET /api/classrooms/my-announcement` returns the latest non-expired, non-deleted announcement
- [ ] Announcement with `expiresAt` in the past is excluded from the response
- [ ] `AnnouncementBanner.svelte` appears in the Settings screen for enrolled students with an active announcement
- [ ] Dismissing the banner stores the announcement ID in `localStorage`; banner does not reappear after reload
- [ ] `POST /api/classrooms/:id/progress-report` returns 202 immediately without waiting for emails to send
- [ ] Teacher without ownership of the classroom gets 404 on all endpoints
- [ ] `npm run typecheck` passes

---

## Sub-Phase 44.7: Admin Panel Integration

### What

The server admin panel (accessed via `X-Admin-Key` header) gains two new panels relevant to Phase 44:

1. **Educator Approval Queue**: Lists pending educator verification requests with applicant email, school name, domain, and submission date. Admin can approve (with optional class limit override) or reject (with required rejection reason). Already implemented in 44.2; this sub-phase adds rate limits and a minimal HTML review UI at `GET /api/admin/educator-queue-ui`.

2. **Classroom Health**: Aggregate statistics for the classroom system — total educators, total classes, total student-class memberships, active assignments today, flagged classes (any class with a student:teacher ratio > 60, suggesting a bulk enrollment bot).

The admin HTML UI is a minimal server-rendered HTML page (no React, no framework) served directly from the Fastify handler. It is protected by `X-Admin-Key` and should never be publicly accessible.

### Where

- `server/src/routes/admin.ts` — extend with educator and classroom health endpoints + HTML UI
- `server/src/middleware/adminAuth.ts` — verify no changes needed; confirm X-Admin-Key check covers new routes

### How

**Step 1: Classroom health endpoint**

```typescript
// GET /api/admin/classroom-health
app.get('/classroom-health', { preHandler: requireAdmin }, async (_req, reply) => {
  const educatorCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, 'educator'))
    .get()

  const classCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(classrooms)
    .where(eq(classrooms.isArchived, 0))
    .get()

  const membershipCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(classroomStudents)
    .where(eq(classroomStudents.isActive, 1))
    .get()

  const now = Date.now()
  const activeAssignmentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(homeworkAssignments)
    .where(
      and(
        eq(homeworkAssignments.isActive, 1),
        sql`${homeworkAssignments.startDate} <= ${now}`,
        sql`${homeworkAssignments.dueDate} >= ${now}`,
      ),
    )
    .get()

  return reply.send({
    educators: educatorCount?.count ?? 0,
    classes: classCount?.count ?? 0,
    memberships: membershipCount?.count ?? 0,
    activeAssignments: activeAssignmentCount?.count ?? 0,
  })
})
```

**Step 2: Rate limiting on educator approval endpoints**

Educator approval queue endpoints must not be callable more than 100 times per minute from a single IP (prevents bulk approval scripting). The existing `createRateLimiter` utility from `server/src/index.ts` should be applied to the `/api/admin/educator-queue/*` prefix:

```typescript
// server/src/index.ts — add after existing rate limiter setup:
const adminEducatorRateLimit = createRateLimiter(100, 60_000)

// Apply in the admin routes registration:
await fastify.register(
  async (adminInstance) => {
    adminInstance.addHook('preHandler', async (req, reply) => {
      const url = req.routeOptions.url ?? ''
      if (url.startsWith('/educator-queue')) {
        return adminEducatorRateLimit(req, reply)
      }
    })
    await adminRoutes(adminInstance)
  },
  { prefix: '/api/admin' },
)
```

**Step 3: Minimal admin HTML review UI**

```typescript
// GET /api/admin/educator-queue-ui — server-rendered review page
app.get('/educator-queue-ui', { preHandler: requireAdmin }, async (_req, reply) => {
  const queue = await db
    .select()
    .from(educatorVerificationRequests)
    .where(eq(educatorVerificationRequests.status, 'pending'))
    .orderBy(desc(educatorVerificationRequests.submittedAt))
    .all()

  const rows = queue
    .map(
      (r) => `
      <tr>
        <td>${r.id.slice(0, 8)}</td>
        <td>${sanitizeHtml(r.schoolName)}</td>
        <td>${sanitizeHtml(r.emailDomain)}</td>
        <td>${new Date(r.submittedAt).toLocaleDateString()}</td>
        <td>${sanitizeHtml(r.verificationNote ?? '')}</td>
        <td>
          <form method="post" action="/api/admin/educator-queue/${r.id}/decide-ui">
            <select name="decision"><option value="approve">Approve</option><option value="reject">Reject</option></select>
            <input type="text" name="reviewNote" placeholder="Note (required for reject)" />
            <input type="hidden" name="adminKey" value="" />
            <button type="submit">Submit</button>
          </form>
        </td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Educator Queue — Recall Rogue Admin</title>
<style>body{font-family:system-ui;padding:2rem}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:8px;text-align:left}tr:nth-child(even){background:#f9f9f9}</style>
</head>
<body>
<h1>Educator Verification Queue</h1>
<p>${queue.length} pending requests</p>
<table><thead><tr><th>ID</th><th>School</th><th>Domain</th><th>Submitted</th><th>Note</th><th>Action</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No pending requests</td></tr>'}</tbody></table>
</body></html>`

  return reply.type('text/html').send(html)
})
```

Note: `sanitizeHtml` is a simple string-escape function — NOT `innerHTML`. No third-party sanitization library is imported.

```typescript
function sanitizeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

### Acceptance Criteria for 44.7

- [ ] `GET /api/admin/classroom-health` returns correct counts for educators, classes, memberships, active assignments
- [ ] Counts update correctly after: creating a class, enrolling a student, creating an active assignment
- [ ] `GET /api/admin/educator-queue-ui` (with valid `X-Admin-Key` header) returns HTML with pending requests table
- [ ] HTML output contains no unescaped user content (school names with `<` or `>` characters are escaped)
- [ ] Admin rate limiter triggers 429 after 100 requests/minute on educator queue endpoints
- [ ] A request without `X-Admin-Key` to any admin endpoint returns 401
- [ ] `npm run typecheck` passes on `server/src/`

---

## Playwright Tests

All Playwright tests write to `/tmp/ss-teacher-*.png` and use the Node.js script pattern from `CLAUDE.md`.

### Test 44.A — Teacher Dashboard Login Page

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('http://localhost:5174/teacher/')
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.screenshot({ path: '/tmp/ss-teacher-login.png' })

  // Check for "Request Educator Access" toggle
  const toggleBtn = await page.$('[data-testid="request-access-toggle"]')
  console.assert(toggleBtn !== null, 'Request Educator Access toggle should exist')

  await browser.close()
  console.log('PASS: Teacher dashboard login page renders')
})()
```

### Test 44.B — Class Management: Create and Join

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('http://localhost:5174/teacher/')
  await page.waitForSelector('[data-testid="dashboard-class-list"]', { timeout: 15000 })

  // Create a class via the dashboard button
  await page.click('[data-testid="create-class-btn"]')
  await page.waitForSelector('[data-testid="class-name-input"]')
  await page.fill('[data-testid="class-name-input"]', 'Test Geology Class')
  await page.click('[data-testid="create-class-submit"]')
  await page.waitForSelector('[data-testid="class-card"]', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-teacher-dashboard-with-class.png' })

  // Verify the join code is displayed
  const joinCode = await page.textContent('[data-testid="join-code"]')
  console.assert(joinCode && /^[A-Z0-9]{6}$/.test(joinCode.trim()), `Join code should be 6 alphanumeric chars, got: "${joinCode}"`)

  await browser.close()
  console.log('PASS: Class created with valid join code')
})()
```

### Test 44.C — Class Analytics Panel

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('http://localhost:5174/teacher/')
  await page.waitForSelector('[data-testid="class-card"]', { timeout: 15000 })
  await page.click('[data-testid="class-card"]:first-child')
  await page.waitForSelector('[data-testid="class-detail-view"]', { timeout: 5000 })
  await page.waitForSelector('[data-testid="analytics-overview"]', { timeout: 8000 })
  await page.screenshot({ path: '/tmp/ss-teacher-class-detail.png' })

  // All 6 panels should exist
  const panelIds = [
    'analytics-overview',
    'analytics-category-breakdown',
    'analytics-student-table',
    'analytics-struggling',
    'analytics-top-facts',
    'analytics-hardest-facts',
  ]
  for (const id of panelIds) {
    const el = await page.$(`[data-testid="${id}"]`)
    console.assert(el !== null, `Analytics panel "${id}" should exist`)
  }

  await browser.close()
  console.log('PASS: All 6 analytics panels render in ClassDetail')
})()
```

### Test 44.D — Homework Assignment Creation

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('http://localhost:5174/teacher/')
  await page.waitForSelector('[data-testid="class-card"]', { timeout: 15000 })
  await page.click('[data-testid="class-card"]:first-child')
  await page.waitForSelector('[data-testid="create-assignment-btn"]', { timeout: 5000 })
  await page.click('[data-testid="create-assignment-btn"]')
  await page.waitForSelector('[data-testid="assignment-editor"]', { timeout: 5000 })

  await page.fill('[data-testid="assignment-title-input"]', 'Week 3 — Geology Review')
  await page.click('[data-testid="category-chip-Geology"]')
  await page.fill('[data-testid="assignment-start-date"]', '2026-03-10')
  await page.fill('[data-testid="assignment-due-date"]', '2026-03-17')
  await page.click('[data-testid="assignment-submit-btn"]')
  await page.waitForSelector('[data-testid="assignment-list-item"]', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-teacher-assignment-created.png' })

  const assignmentTitle = await page.textContent('[data-testid="assignment-list-item"]:first-child')
  console.assert(
    assignmentTitle?.includes('Geology Review'),
    'Created assignment should appear in the list',
  )

  await browser.close()
  console.log('PASS: Homework assignment created and visible in list')
})()
```

### Test 44.E — In-Game Class Join Panel (Main Game)

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to settings
  await page.click('[data-testid="settings-btn"]')
  await page.waitForSelector('[data-testid="settings-view"]', { timeout: 5000 })
  // Scroll to classroom section
  await page.evaluate(() => document.querySelector('[data-testid="classroom-section"]')?.scrollIntoView())
  await page.screenshot({ path: '/tmp/ss-ingame-classroom-section.png' })

  const joinInput = await page.$('[data-testid="join-code-input"]')
  console.assert(joinInput !== null, 'Join code input should exist in settings')

  // Enter an invalid code
  await page.fill('[data-testid="join-code-input"]', 'XXXZZZ')
  await page.click('[data-testid="join-class-btn"]')
  await page.waitForSelector('[data-testid="join-error"]', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss-ingame-join-error.png' })

  await browser.close()
  console.log('PASS: In-game class join panel renders and shows error for invalid code')
})()
```

### Test 44.F — Announcement Banner

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  // Seed an active announcement via API before navigating
  const res = await fetch('http://localhost:3001/api/classrooms/TESTCLASS_ID/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer TEACHER_TOKEN' },
    body: JSON.stringify({ message: 'Geology quiz on Friday — review Chapter 3!' }),
  })
  console.assert(res.status === 201, 'Announcement should be created')

  const page = await (await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })).newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('[data-testid="announcement-banner"]', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-announcement-banner.png' })

  // Dismiss it
  await page.click('[data-testid="announcement-dismiss"]')
  await page.waitForTimeout(500)
  const banner = await page.$('[data-testid="announcement-banner"]')
  console.assert(banner === null, 'Banner should be gone after dismissal')

  await browser.close()
  console.log('PASS: Announcement banner appears and dismisses correctly')
})()
```

---

## Verification Gate

The following checklist MUST pass in full before Phase 44 is marked complete. No sub-phase can be skipped.

### TypeScript & Build

- [ ] `cd teacher && npm run typecheck` — zero errors
- [ ] `cd teacher && npm run build` — zero errors, output in `server/public/teacher/`
- [ ] `npm run typecheck` (root) — zero errors in `src/`
- [ ] `cd server && npm run typecheck` — zero errors in `server/src/`

### Database

- [ ] Fresh SQLite database initializes all Phase 44 tables without error: `classrooms`, `classroomStudents`, `homeworkAssignments`, `classAnnouncements`, `educatorVerificationRequests`
- [ ] `users` table has `role`, `educatorVerification`, `educatorOrg`, `educatorDomain`, `classLimit` columns
- [ ] No foreign key constraint violations when a user is deleted (cascade deletes work correctly)

### API

- [ ] All educator endpoints return 403 (not 401) when accessed with a `player`-role JWT
- [ ] All educator endpoints return 401 when accessed with no token
- [ ] All admin endpoints return 401 when `X-Admin-Key` header is absent or wrong
- [ ] `POST /api/educator/verify-request` → `GET /api/educator/status` → `POST /api/admin/educator-queue/:id/decide` full workflow works end-to-end
- [ ] Join code generation never produces a code with `I`, `O`, `0`, or `1` (readability constraint)
- [ ] `GET /api/classrooms/my-active-assignment` returns `null` outside assignment date range
- [ ] `GET /api/classrooms/my-active-assignment` returns the assignment inside date range
- [ ] Announcement auto-expires after `expiresAt` (verified by manipulating `expiresAt` to past timestamp)

### Security

- [ ] All user-supplied strings rendered in admin HTML are HTML-escaped (no raw `<script>` injection possible)
- [ ] `joinCode` input is normalized to uppercase before DB lookup (prevents case-sensitive bypass)
- [ ] `categories` in assignment body is validated as an array; non-string entries are rejected
- [ ] School name and announcement message are length-capped server-side (not client-only)
- [ ] No educator endpoint exposes the SM-2 `easeFactor` of individual quiz cards — only aggregate mastery rates
- [ ] No teacher can retrieve data for a classroom they do not own (all queries include `teacherId` constraint)
- [ ] COPPA: progress report email is skipped for students under 13 without a parent email on file

### Visual / UX

- [ ] Screenshot `/tmp/ss-teacher-login.png` shows login form with "Request Educator Access" toggle
- [ ] Screenshot `/tmp/ss-teacher-dashboard-with-class.png` shows class card with visible 6-char join code
- [ ] Screenshot `/tmp/ss-teacher-class-detail.png` shows all 6 analytics panels
- [ ] Screenshot `/tmp/ss-teacher-assignment-created.png` shows the new assignment in the list
- [ ] Screenshot `/tmp/ss-ingame-classroom-section.png` shows the join panel in Settings
- [ ] Screenshot `/tmp/ss-announcement-banner.png` shows the announcement banner

### Integration

- [ ] When a student joins a class and the teacher creates an active assignment, the student's next game session applies the category lock (verify by checking `classroomStore.activeAssignment` in browser console)
- [ ] After the assignment's `dueDate`, the quiz pool reverts to the student's interest-based selection
- [ ] Dismissing an announcement in one browser session does not show it again after a page reload

---

## Files Affected

### New Files — Teacher App (`teacher/`)

| File | Purpose |
|------|---------|
| `teacher/package.json` | Standalone Vite app manifest |
| `teacher/tsconfig.json` | TypeScript config for teacher app |
| `teacher/vite.config.ts` | Vite build config; proxies `/api` to localhost:3001; builds to `server/public/teacher/` |
| `teacher/index.html` | App shell |
| `teacher/src/main.ts` | Entry point |
| `teacher/src/App.svelte` | Root component with manual router |
| `teacher/src/app.css` | Global styles |
| `teacher/src/lib/api.ts` | Typed fetch wrapper with Bearer token injection |
| `teacher/src/lib/auth.ts` | Educator auth Svelte stores |
| `teacher/src/types/index.ts` | Educator-side TypeScript interfaces |
| `teacher/src/routes/Login.svelte` | Login + verification request form |
| `teacher/src/routes/Dashboard.svelte` | Class list with create button |
| `teacher/src/routes/ClassDetail.svelte` | Per-class analytics + roster + assignment list |
| `teacher/src/routes/AssignmentEditor.svelte` | Homework assignment creation/edit |
| `teacher/src/routes/VerificationPending.svelte` | Holding screen post-submission |
| `teacher/src/routes/VerificationRejected.svelte` | Rejection screen with reason |
| `teacher/src/components/NavBar.svelte` | Top navigation bar |
| `teacher/src/components/ClassCard.svelte` | Class summary tile |
| `teacher/src/components/StudentRow.svelte` | Per-student analytics row |
| `teacher/src/components/CategoryPicker.svelte` | Multi-select fact category chips |
| `teacher/src/components/CategoryBar.svelte` | Horizontal progress bar for category analytics |
| `teacher/src/components/ProgressBar.svelte` | Generic progress bar |

### New Files — Server (`server/src/`)

| File | Purpose |
|------|---------|
| `server/src/routes/educator.ts` | Educator account endpoints (verify-request, status) |
| `server/src/routes/classrooms.ts` | Full classroom CRUD, student join, assignment CRUD, announcement CRUD, analytics endpoint |
| `server/src/services/classCodeGenerator.ts` | 6-char join code generation with uniqueness check |
| `server/src/services/educatorDomainValidator.ts` | Email domain heuristic for educational TLDs |
| `server/src/services/classroomAnalytics.ts` | Aggregate analytics queries for ClassDetail view |

### New Files — Game Client (`src/`)

| File | Purpose |
|------|---------|
| `src/ui/components/ClassJoinPanel.svelte` | In-game Settings panel for joining a classroom |
| `src/ui/components/AnnouncementBanner.svelte` | Dismissable in-game announcement banner |
| `src/ui/stores/classroomStore.ts` | Svelte store: active classroom membership + assignment + announcement |
| `src/services/classroomService.ts` | `syncActiveAssignment()`, `fetchActiveAnnouncement()` |

### Modified Files

| File | Change |
|------|--------|
| `server/src/db/schema.ts` | Add `classrooms`, `classroomStudents`, `homeworkAssignments`, `classAnnouncements`, `educatorVerificationRequests` tables; extend `users` with `role`, `educatorVerification`, `educatorOrg`, `educatorDomain`, `classLimit` |
| `server/src/db/migrate.ts` | Add migration for all 5 new tables and 5 new `users` columns |
| `server/src/routes/admin.ts` | Add educator approval queue + decide endpoints; add classroom health endpoint; add sanitized HTML review UI |
| `server/src/index.ts` | Register `educatorRoutes` at `/api/educator`; register `classroomsRoutes` at `/api/classrooms`; delete import of old `classroom.ts`; add admin educator rate limiter |
| `src/services/interestSpawner.ts` | Check `classroomStore.activeAssignment` before applying player's category lock |
| `src/ui/components/Settings.svelte` (or equivalent settings entry point) | Add "Classroom" section containing `ClassJoinPanel` |
| `src/App.svelte` | Mount `AnnouncementBanner` near the top of the component tree (renders above all views) |

### Deleted Files

| File | Reason |
|------|--------|
| `server/src/routes/classroom.ts` | Replaced entirely by `classrooms.ts`; the stub was a placeholder only |

---

## Design Notes

### Privacy Architecture

The teacher dashboard is built with privacy as a first-class constraint, not an afterthought:

- **Aggregate only**: Teachers see mastery rates and category breakdowns, not individual quiz responses. A teacher cannot determine which specific wrong answers a student gave.
- **Display names only**: Student identification in the teacher dashboard uses the same display name the student chose. Real names, email addresses, and account IDs are not exposed via the classroom API.
- **No teacher-to-student chat**: Direct messaging between teachers and individual students is deferred to Phase 50, where it will be implemented with full COPPA-compliant parental consent gating.
- **Assignment transparency**: The category lock applied by a homework assignment is functionally identical to a player-set interest lock. The student's UI does not indicate it was set by a teacher. This preserves the game's motivational framing: the student is exploring the mine, not completing homework.
- **Educator role is not self-serve**: A player cannot unilaterally upgrade their account to educator. Manual admin review is always required. This prevents rogue actors from using the educator system to harvest aggregate data on players they trick into joining their class.

### Scalability Considerations

The analytics aggregation queries in `classroomAnalytics.ts` scan all `analytics_events` rows for the enrolled student IDs. At 30 students per class and 1,000 events per student, a single `GET /api/classrooms/:id/analytics` call scans 30,000 rows. This is acceptable for SQLite development but requires index enforcement for PostgreSQL production:

```sql
CREATE INDEX idx_analytics_events_user_event ON analytics_events(user_id, event_name, created_at DESC);
```

This index reduces the per-class analytics query from a full table scan to an index range scan. The index should be added to `server/src/db/schema.ts` as part of the PostgreSQL migration plan documented in `pgReadiness.ts`.

### Email Domain Allowlist

The `looksLikeEducationalDomain()` function covers common patterns but will miss some valid school domains (e.g., `school.org`, custom district domains). The design intentionally requires manual admin review for all requests — the domain check is only a signal to the reviewer, not a gate. Future iterations may maintain an admin-editable allowlist table in the database.
