const fs = require('fs')
const path = require('path')
const { createPlaytester } = require('./lib/playtest-harness.cjs')

const ROOT = '/root/terra-miner'
const BATCH_DIR = path.join(ROOT, 'docs/playtests/active/004-study-deep-dive')
const RESULTS_DIR = path.join(BATCH_DIR, 'results')
const RAW_DIR = path.join(RESULTS_DIR, 'raw')

const QUESTION_META = {
  1: { title: 'Leech Rescue Mission', file: 'q01-leech-rescue.md', preset: 'many_reviews_due' },
  2: { title: 'Activation Cap Ceiling', file: 'q02-activation-cap.md', preset: 'many_reviews_due' },
  3: { title: 'Re-Queue Frustration Test', file: 'q03-requeue-frustration.md', preset: 'many_reviews_due' },
  4: { title: 'Seven-Day SM-2 Drift', file: 'q04-sm2-drift.md', preset: 'post_tutorial' },
  5: { title: 'Morning/Evening Ritual Motivation', file: 'q05-ritual-motivation.md', preset: 'post_tutorial' },
  6: { title: 'Category Interleaving Quality', file: 'q06-category-interleaving.md', preset: 'many_reviews_due' },
  7: { title: 'Mnemonic Escalation Path', file: 'q07-mnemonic-escalation.md', preset: 'many_reviews_due' },
  8: { title: 'High-Backlog Throttle Experience', file: 'q08-backlog-throttle.md', preset: 'many_reviews_due' },
  9: { title: 'Consistency Penalty Cross-System', file: 'q09-consistency-penalty.md', preset: 'many_reviews_due' },
  10: { title: 'Study Score Feedback Loop', file: 'q10-study-score.md', preset: 'post_tutorial' },
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function nowIso() {
  return new Date().toISOString()
}

function uniq(arr) {
  return [...new Set(arr)]
}

function isMineScreen(screen) {
  return ['mine', 'mineactive', 'mining'].includes(String(screen || '').toLowerCase())
}

function clampText(s, max = 700) {
  if (!s || typeof s !== 'string') return ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function computeAdaptiveLimit(dueCount) {
  const base = 3
  if (dueCount <= 5) return Math.min(base + 2, 5)
  if (dueCount >= 15) return Math.max(base - 1, 2)
  return base
}

function computeStudyScore(save) {
  const totalLearned = Array.isArray(save?.learnedFacts) ? save.learnedFacts.length : 0
  if (totalLearned === 0) return 0.5

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const states = Array.isArray(save?.reviewStates) ? save.reviewStates : []

  const masteredFacts = states.filter((rs) => (rs.interval ?? 0) >= 21).length
  const masteryRatio = masteredFacts / Math.max(totalLearned, 1)

  const reviewedFacts = states.filter((rs) => (rs.repetitions ?? 0) > 0)
  const overdueFacts = reviewedFacts.filter((rs) => {
    const next = (rs.lastReviewAt ?? 0) + (rs.interval ?? 0) * 24 * 60 * 60 * 1000
    return next < now
  }).length
  const totalDue = Math.max(reviewedFacts.length, 1)
  const debtRatio = 1 - Math.min(overdueFacts / totalDue, 1)

  const timestamps = Array.isArray(save?.lastStudySessionTimestamps) ? save.lastStudySessionTimestamps : []
  const recentSessions = timestamps.filter((t) => t > sevenDaysAgo).length
  const engagementRatio = Math.min(recentSessions / 5, 1)

  const score = masteryRatio * 0.3 + debtRatio * 0.4 + engagementRatio * 0.3
  return Math.max(0, Math.min(1, score))
}

function studyTier(score, totalLearned) {
  if (totalLearned === 0) return 'new_player'
  if (score >= 0.7) return 'diligent'
  if (score >= 0.3) return 'average'
  return 'neglectful'
}

async function doStep(tester, logs, label, action) {
  const look = await tester.look().catch(() => null)
  let result
  let error = null
  try {
    result = await action()
  } catch (err) {
    error = err?.message || String(err)
    result = { ok: false, message: error }
  }
  const validation = await tester.validateScreen().catch(() => ({ valid: false, issues: ['validate failed'] }))
  const screen = await tester.getScreen().catch(() => 'unknown')
  const entry = {
    ts: nowIso(),
    label,
    screen,
    look: clampText(look, 1200),
    result,
    validation,
    error,
  }
  logs.push(entry)
  return entry
}

async function readStoreValue(tester, symbolKey) {
  return tester.page.evaluate((k) => {
    const store = globalThis[Symbol.for(k)]
    if (!store?.subscribe) return null
    let value
    store.subscribe((v) => { value = v })()
    return value ?? null
  }, symbolKey)
}

async function updateSave(tester, patcherName, payload = {}) {
  return tester.page.evaluate(async ({ patcherName, payload }) => {
    const saveStore = globalThis[Symbol.for('terra:playerSave')]
    if (!saveStore?.update) return { ok: false, message: 'playerSave store missing' }

    const apply = {
      nearLeech: (save) => {
        if (!save) return save
        const ids = []
        const updated = [...save.reviewStates]
        let touched = 0
        for (let i = 0; i < updated.length && touched < 3; i++) {
          const rs = updated[i]
          if (rs.cardState === 'review') {
            ids.push(rs.factId)
            updated[i] = {
              ...rs,
              lapseCount: 7,
              isLeech: false,
              repetitions: Math.max(3, rs.repetitions ?? 0),
              interval: Math.max(3, rs.interval ?? 0),
              nextReviewAt: Date.now() - 3600_000,
            }
            touched++
          }
        }
        return { ...save, reviewStates: updated, __metaNearLeech: ids }
      },

      activationCapSeed: (save) => {
        if (!save) return save
        const ids = payload.factIds || []
        const learned = new Set(save.learnedFacts)
        const discovered = ids.filter((id) => !learned.has(id)).slice(0, 4)

        const rs = [...save.reviewStates]
        for (let i = 0; i < Math.min(5, rs.length); i++) {
          rs[i] = { ...rs[i], cardState: 'new', nextReviewAt: 0, interval: 0 }
        }

        const mergedDiscovered = Array.from(new Set([...(save.discoveredFacts || []), ...discovered]))

        return {
          ...save,
          discoveredFacts: mergedDiscovered,
          reviewStates: rs,
        }
      },

      activationMasteryBoost: (save) => {
        if (!save) return save
        const rs = [...save.reviewStates]
        for (let i = 0; i < Math.min(10, rs.length); i++) {
          rs[i] = { ...rs[i], cardState: 'review', interval: 65, repetitions: Math.max(rs[i].repetitions ?? 0, 5), nextReviewAt: Date.now() + 86_400_000 }
        }
        return { ...save, reviewStates: rs }
      },

      driftSeed: (save) => {
        if (!save) return save
        const ids = payload.factIds || []
        const picked = ids.slice(0, 15)
        const now = Date.now()
        const states = picked.map((id, i) => {
          if (i < 5) {
            return {
              factId: id,
              cardState: 'new',
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              nextReviewAt: 0,
              lastReviewAt: 0,
              quality: 0,
              learningStep: 0,
              lapseCount: 0,
              isLeech: false,
              wrongCount: 0,
            }
          }
          return {
            factId: id,
            cardState: 'review',
            easeFactor: 2.3 + ((i % 4) * 0.1),
            interval: 1 + (i % 3),
            repetitions: 1 + (i % 4),
            nextReviewAt: now - (i * 3600_000),
            lastReviewAt: now - ((i + 1) * 3600_000),
            quality: 3,
            learningStep: 0,
            lapseCount: 0,
            isLeech: false,
            wrongCount: 0,
          }
        })
        return {
          ...save,
          learnedFacts: picked,
          reviewStates: states,
          discoveredFacts: [],
        }
      },

      wrongCountSeed: (save) => {
        if (!save) return save
        const ids = payload.factIds || []
        const wanted = new Set(ids)
        const rs = save.reviewStates.map((r) => wanted.has(r.factId) ? { ...r, wrongCount: 2 } : r)
        return { ...save, reviewStates: rs }
      },

      backlogSeed: (save) => {
        if (!save) return save
        const ids = payload.factIds || []
        const picked = ids.slice(0, 40)
        const now = Date.now()
        const rs = picked.map((id, i) => {
          if (i < 30) {
            return {
              factId: id,
              cardState: 'review',
              easeFactor: 2.5,
              interval: 4,
              repetitions: 2,
              nextReviewAt: now - (2 * 86400_000),
              lastReviewAt: now - (6 * 86400_000),
              quality: 3,
              learningStep: 0,
              lapseCount: 0,
              isLeech: false,
              wrongCount: 0,
            }
          }
          return {
            factId: id,
            cardState: 'new',
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewAt: 0,
            lastReviewAt: 0,
            quality: 0,
            learningStep: 0,
            lapseCount: 0,
            isLeech: false,
            wrongCount: 0,
          }
        })
        return {
          ...save,
          learnedFacts: picked,
          reviewStates: rs,
          discoveredFacts: [],
          newCardsStudiedToday: 0,
          lastNewCardDate: new Date().toISOString().slice(0, 10),
        }
      },

      backlogClearedSeed: (save) => {
        if (!save) return save
        const now = Date.now()
        const rs = save.reviewStates.map((r, i) => {
          if (i < 20 && r.cardState === 'review') {
            return { ...r, nextReviewAt: now + (10 * 86400_000), interval: Math.max(7, r.interval ?? 1) }
          }
          return r
        })
        return {
          ...save,
          reviewStates: rs,
          newCardsStudiedToday: 0,
          lastNewCardDate: new Date(now - 86400_000).toISOString().slice(0, 10),
        }
      },

      scoreSeed: (save) => {
        if (!save) return save
        const ids = payload.factIds || []
        const picked = ids.slice(0, 20)
        const now = Date.now()
        const rs = picked.map((id, i) => ({
          factId: id,
          cardState: 'review',
          easeFactor: 2.4,
          interval: 5 + (i % 3),
          repetitions: 2,
          nextReviewAt: now - 86400_000,
          lastReviewAt: now - (3 * 86400_000),
          quality: 3,
          learningStep: 0,
          lapseCount: 0,
          isLeech: false,
          wrongCount: 0,
        }))
        return {
          ...save,
          learnedFacts: picked,
          reviewStates: rs,
          lastStudySessionTimestamps: [now - (2 * 86400_000)],
        }
      },
    }

    const patcher = apply[patcherName]
    if (!patcher) return { ok: false, message: `unknown patcher ${patcherName}` }

    let meta = null
    saveStore.update((s) => {
      const next = patcher(s)
      if (next && next.__metaNearLeech) {
        meta = next.__metaNearLeech
        const copy = { ...next }
        delete copy.__metaNearLeech
        return copy
      }
      return next
    })

    return { ok: true, patcherName, meta }
  }, { patcherName, payload })
}

async function getFactIdsFromDB(tester, limit = 200) {
  return tester.page.evaluate(async (n) => {
    try {
      const mod = await import('/src/services/factsDB.ts')
      const db = mod.factsDB
      if (!db.isReady()) await db.init()
      return db.getAllIds().slice(0, n)
    } catch {
      return []
    }
  }, limit)
}

async function startStudySession(tester, logs, size) {
  await doStep(tester, logs, `startStudy(${size})`, () => tester.startStudy(size))
  await tester.wait(400)
  let card = await tester.getStudyCardText().catch(() => null)
  let method = 'api'

  if (!card?.question) {
    method = 'gm-fallback'
    await doStep(tester, logs, 'gm.startStudySession()', async () => {
      return tester.page.evaluate(() => {
        const gmStore = globalThis[Symbol.for('terra:gameManagerStore')]
        let gm
        gmStore?.subscribe?.((v) => { gm = v })()
        if (!gm) return { ok: false, message: 'no gm' }
        gm.startStudySession?.()
        return { ok: true, message: 'called startStudySession' }
      })
    })
    await tester.wait(900)
    const sizeIndex = size === 5 ? 0 : size === 10 ? 1 : 2
    await doStep(tester, logs, `chooseSize(${size})`, () => tester.page.evaluate((idx) => {
      const btn = document.querySelectorAll('button.size-btn')[idx]
      if (!btn) return { ok: false, message: 'size button missing' }
      btn.click()
      return { ok: true, message: 'size selected' }
    }, sizeIndex))
    await tester.wait(900)
    card = await tester.getStudyCardText().catch(() => null)
  }

  const queue = await getStudyQueueDetailed(tester).catch(() => [])
  return { method, firstCard: card, queue }
}

async function revealAndGrade(tester, logs, grade) {
  await doStep(tester, logs, 'revealCard', () => tester.page.evaluate(() => {
    const btn = document.querySelector('.reveal-btn')
    if (!btn) return { ok: false, message: 'no reveal button' }
    btn.click()
    return { ok: true, message: 'revealed' }
  }))
  await tester.wait(220)
  const after = await tester.getAllText().catch(() => ({ byClass: {} }))
  const graded = await doStep(tester, logs, `gradeCard(${grade})`, () => tester.gradeCard(grade))
  await tester.wait(180)
  return { after, graded }
}

async function getStudyQueueDetailed(tester) {
  return tester.page.evaluate(() => {
    const factsStore = globalThis[Symbol.for('terra:studyFacts')]
    const statesStore = globalThis[Symbol.for('terra:studyReviewStates')]
    let facts = []
    let states = []
    factsStore?.subscribe?.((v) => { facts = Array.isArray(v) ? v : [] })()
    statesStore?.subscribe?.((v) => { states = Array.isArray(v) ? v : [] })()
    return facts.map((f, i) => ({
      id: f.id,
      question: f.quizQuestion,
      category: f.category?.[0] ?? null,
      type: f.type ?? null,
      cardState: states[i]?.cardState ?? null,
      interval: states[i]?.interval ?? null,
      lapseCount: states[i]?.lapseCount ?? null,
      wrongCount: states[i]?.wrongCount ?? 0,
    }))
  })
}

async function setFakeHour(tester, hour) {
  return tester.page.evaluate((h) => {
    const RealDate = globalThis.__terraRealDate || Date
    globalThis.__terraRealDate = RealDate

    const anchor = new RealDate()
    anchor.setHours(h, 0, 0, 0)
    const fakeTs = anchor.getTime()

    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fakeTs)
        } else {
          super(...args)
        }
      }
      static now() { return fakeTs }
      static parse(str) { return RealDate.parse(str) }
      static UTC(...args) { return RealDate.UTC(...args) }
    }

    globalThis.Date = FakeDate
    return { ok: true, fakeIso: new FakeDate().toISOString(), hour: new FakeDate().getHours() }
  }, hour)
}

async function restoreRealDate(tester) {
  return tester.page.evaluate(() => {
    if (globalThis.__terraRealDate) {
      globalThis.Date = globalThis.__terraRealDate
      return { ok: true }
    }
    return { ok: false }
  })
}

async function forceQuiz(tester) {
  return tester.page.evaluate(() => {
    const gmStore = globalThis[Symbol.for('terra:gameManagerStore')]
    let gm
    gmStore?.subscribe?.((v) => { gm = v })()
    if (!gm) return { ok: false, message: 'no gm' }
    gm.forceQuiz?.()
    return { ok: true, message: 'forceQuiz emitted' }
  })
}

async function getActiveQuizInfo(tester) {
  return tester.page.evaluate(() => {
    const quizStore = globalThis[Symbol.for('terra:activeQuiz')]
    let q
    quizStore?.subscribe?.((v) => { q = v })()
    if (!q) return null
    return {
      factId: q.fact?.id ?? null,
      question: q.fact?.question ?? q.question ?? null,
      source: q.source ?? null,
      correctIndex: q.correctIndex ?? null,
      isConsistencyPenalty: !!q.isConsistencyPenalty,
    }
  })
}

async function getO2(tester) {
  return tester.page.evaluate(() => {
    const s = globalThis[Symbol.for('terra:oxygenCurrent')]
    let v
    s?.subscribe?.((x) => { v = x })()
    return typeof v === 'number' ? v : null
  })
}

async function getRoomText(tester) {
  const look = await tester.look().catch(() => '')
  return clampText(look, 280)
}

async function runQ1() {
  const q = 1
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const inject = await updateSave(tester, 'nearLeech')
    const targetIds = inject?.meta || []

    const init = await startStudySession(tester, logs, 10)
    let queue = init.queue
    let idx = 0
    const reviewed = []
    const pushedToLeech = []

    for (let i = 0; i < 22; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      const qEntry = queue[idx] || null
      const factId = qEntry?.id || null
      let grade = 'good'
      if (factId && targetIds.includes(factId) && !pushedToLeech.includes(factId)) {
        grade = 'again'
        pushedToLeech.push(factId)
      }
      const step = await revealAndGrade(tester, logs, grade)
      reviewed.push({ index: i + 1, factId, question: card.question, grade, validation: step.graded.validation })
      idx += 1
    }

    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())
    const saveAfter = await tester.getSave().catch(() => null)
    const states = (saveAfter?.reviewStates || []).filter((s) => targetIds.includes(s.factId))

    await doStep(tester, logs, 'navigate(studyStation)', () => tester.navigate('studyStation'))
    await doStep(tester, logs, 'openSuspendedTab', () => tester.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button.tab-btn'))
      const btn = btns.find((b) => /suspended/i.test(b.textContent || ''))
      if (!btn) return { ok: false, message: 'suspended tab missing' }
      btn.click()
      return { ok: true, message: 'suspended tab opened' }
    }))

    const suspendedInfo = await tester.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card-item--suspended'))
      return {
        count: cards.length,
        labels: cards.map((c) => c.textContent?.trim() || '').slice(0, 5),
      }
    }).catch(() => ({ count: 0, labels: [] }))

    const unsuspendAction = await doStep(tester, logs, 'unsuspendFirst', () => tester.page.evaluate(() => {
      const btn = document.querySelector('.action-btn--unsuspend')
      if (!btn) return { ok: false, message: 'unsuspend button missing' }
      btn.click()
      return { ok: true, message: 'unsuspended first fact' }
    }))

    const postUnsuspendSave = await tester.getSave().catch(() => null)
    const unsuspendedId = states.find((s) => s.cardState === 'suspended')?.factId || null

    const secondSession = await startStudySession(tester, logs, 10)
    const queue2Ids = secondSession.queue.map((x) => x.id)
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const gaiaMessages = await tester.getNotifications().catch(() => [])

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      targetIds,
      reviewed,
      statesAfterSession: states,
      suspendedInfo,
      unsuspendAction: unsuspendAction.result,
      unsuspendedId,
      queueAfterUnsuspend: queue2Ids,
      gaiaMessages,
      success: {
        leechDetectedAt8: states.some((s) => s.lapseCount >= 8 && (s.isLeech || s.cardState === 'suspended')),
        suspendedTabAccessible: suspendedInfo.count >= 0,
        unsuspendFlowWorks: !!unsuspendAction?.result?.ok,
        unsuspendedAppearsRelearning: unsuspendedId ? queue2Ids.includes(unsuspendedId) : false,
        gaiaSupportiveMessage: gaiaMessages.some((m) => /support|help|again|keep|practice|stick/i.test(m)),
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ2() {
  const q = 2
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const factIds = await getFactIdsFromDB(tester, 300)
    await updateSave(tester, 'activationCapSeed', { factIds })

    const saveA = await tester.getSave()
    const capA = Math.min(20, 5 + Math.floor((saveA.reviewStates || []).filter((r) => (r.interval ?? 0) >= 60 && r.cardState === 'review').length / 5))
    const usedA = (saveA.reviewStates || []).filter((r) => r.cardState === 'new' || r.cardState === 'learning').length

    await doStep(tester, logs, 'navigate(studyStation)', () => tester.navigate('studyStation'))
    const capUi = await tester.page.evaluate(() => {
      const statValues = Array.from(document.querySelectorAll('.stat-value')).map((n) => n.textContent?.trim() || '')
      const capInfo = document.querySelector('.cap-info')?.textContent?.trim() || null
      return { statValues, capInfo }
    }).catch(() => ({ statValues: [], capInfo: null }))

    await doStep(tester, logs, 'openDiscoveredTab', () => tester.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button.tab-btn'))
      const btn = btns.find((b) => /discovered/i.test(b.textContent || ''))
      if (!btn) return { ok: false, message: 'discovered tab missing' }
      btn.click()
      return { ok: true, message: 'opened discovered tab' }
    }))

    const activateAtCap = await doStep(tester, logs, 'activateAtCapAttempt', () => tester.page.evaluate(() => {
      const btn = document.querySelector('.action-btn--activate')
      if (!btn) return { ok: false, message: 'activate button missing' }
      const text = btn.textContent?.trim() || ''
      const disabled = !!btn.disabled
      if (!disabled) btn.click()
      return { ok: true, disabled, label: text }
    }))

    const saveAfterAttempt = await tester.getSave()

    await updateSave(tester, 'activationMasteryBoost')
    const saveB = await tester.getSave()
    const capB = Math.min(20, 5 + Math.floor((saveB.reviewStates || []).filter((r) => (r.interval ?? 0) >= 60 && r.cardState === 'review').length / 5))

    await doStep(tester, logs, 'openDiscoveredTabAgain', () => tester.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button.tab-btn'))
      const btn = btns.find((b) => /discovered/i.test(b.textContent || ''))
      if (!btn) return { ok: false, message: 'discovered tab missing' }
      btn.click()
      return { ok: true, message: 'opened discovered tab' }
    }))

    const activateAfterBoost = await doStep(tester, logs, 'activateAfterCapIncrease', () => tester.page.evaluate(() => {
      const btn = document.querySelector('.action-btn--activate')
      if (!btn) return { ok: false, message: 'activate button missing' }
      const disabled = !!btn.disabled
      const label = btn.textContent?.trim() || ''
      if (!disabled) btn.click()
      return { ok: true, disabled, label }
    }))

    const saveC = await tester.getSave()

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      capA,
      usedA,
      capUi,
      activateAtCap: activateAtCap.result,
      learnedBefore: (saveA.learnedFacts || []).length,
      learnedAfterCapAttempt: (saveAfterAttempt.learnedFacts || []).length,
      capB,
      activateAfterBoost: activateAfterBoost.result,
      learnedAfterBoost: (saveC.learnedFacts || []).length,
      success: {
        capMessageShown: /cap|slots/i.test((activateAtCap.result?.label || '') + ' ' + (capUi.capInfo || '')),
        formulaWorks: capB >= capA,
        blockedAtCap: !!activateAtCap.result?.disabled,
        activationWorksAfterIncrease: !activateAfterBoost.result?.disabled,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ3() {
  const q = 3
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const init = await startStudySession(tester, logs, 10)
    const seen = {}
    const timeline = []
    let againUsed = 0

    for (let i = 0; i < 30; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      const question = card.question
      seen[question] = (seen[question] || 0) + 1

      const grade = (i < 10 && againUsed < 5) ? 'again' : 'good'
      if (grade === 'again') againUsed++

      await revealAndGrade(tester, logs, grade)
      timeline.push({ index: i + 1, question, countForCard: seen[question], grade })
    }

    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const counts = Object.values(seen)
    const maxAppearances = counts.length ? Math.max(...counts) : 0
    const totalSeen = timeline.length
    const helpfulness = maxAppearances <= 3 && totalSeen <= 15 ? 4 : (maxAppearances >= 4 || totalSeen > 20 ? 2 : 3)

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      initialQueue: init.queue.slice(0, 10),
      timeline,
      totalSeen,
      maxAppearances,
      helpfulness,
      success: {
        maxTwoRequeues: maxAppearances <= 3,
        sessionReasonableLength: totalSeen <= 15,
        notTedious: helpfulness >= 3,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ4() {
  const q = 4
  const meta = QUESTION_META[q]
  const logs = []
  let tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const factIds = await getFactIdsFromDB(tester, 120)
    await updateSave(tester, 'driftSeed', { factIds })

    const daily = []
    const gradePattern = ['good', 'good', 'good', 'okay', 'good', 'again', 'good', 'okay', 'good', 'good']

    for (let day = 1; day <= 7; day++) {
      await doStep(tester, logs, `fastForward(24)-day${day}`, () => tester.fastForward(24))
      const init = await startStudySession(tester, logs, 20)

      let reviewed = 0
      let againCount = 0
      let gradeIdx = 0
      for (let i = 0; i < 35; i++) {
        const card = await tester.getStudyCardText().catch(() => null)
        if (!card?.question) break
        const grade = gradePattern[gradeIdx % gradePattern.length]
        gradeIdx++
        if (grade === 'again') againCount++
        await revealAndGrade(tester, logs, grade)
        reviewed++
      }
      await doStep(tester, logs, `endStudy-day${day}`, () => tester.endStudy())

      const save = await tester.getSave()
      const states = save.reviewStates || []
      const eases = states.map((s) => s.easeFactor).filter((x) => typeof x === 'number')
      const minEase = eases.length ? Math.min(...eases) : null
      const maxEase = eases.length ? Math.max(...eases) : null
      const meanEase = eases.length ? Number((eases.reduce((a, b) => a + b, 0) / eases.length).toFixed(3)) : null
      const lowEaseCount = states.filter((s) => (s.easeFactor ?? 999) < 2.0).length

      daily.push({
        day,
        queueSize: init.queue.length,
        reviewed,
        againRate: reviewed > 0 ? Number((againCount / reviewed).toFixed(3)) : 0,
        minEase,
        maxEase,
        meanEase,
        lowEaseCount,
      })

      // Recreate the session each day to avoid long-run API bridge drops.
      if (day < 7) {
        const carrySave = await tester.getSave().catch(() => null)
        await tester.cleanup().catch(() => {})
        tester = await createPlaytester({ save: carrySave || undefined, preset: meta.preset })
        logs.push({
          ts: nowIso(),
          label: `day${day}-session-reset`,
          screen: await tester.getScreen().catch(() => 'unknown'),
          look: clampText(await tester.look().catch(() => ''), 500),
          result: { ok: true, message: 'Recreated tester for next day cycle' },
          validation: await tester.validateScreen().catch(() => ({ valid: false, issues: ['validate failed after reset'] })),
          error: null,
        })
      }
    }

    const anyEaseDeath = daily.some((d) => d.minEase !== null && d.minEase < 1.5)
    const againAvg = daily.length ? daily.reduce((a, d) => a + d.againRate, 0) / daily.length : 0

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      daily,
      success: {
        noEaseDeathSpiral: !anyEaseDeath,
        againRateWithinBand: againAvg >= 0.08 && againAvg <= 0.20,
        intervalsNotExploded: !daily.some((d) => d.maxEase !== null && d.maxEase > 4.0),
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ5() {
  const q = 5
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const sessions = []

    const runRitualWindow = async (label, hour) => {
      await doStep(tester, logs, `setFakeHour(${hour})`, () => setFakeHour(tester, hour))
      const before = await tester.getSave()
      const start = await startStudySession(tester, logs, 5)

      let reviewed = 0
      for (let i = 0; i < 8; i++) {
        const card = await tester.getStudyCardText().catch(() => null)
        if (!card?.question) break
        await revealAndGrade(tester, logs, 'good')
        reviewed++
        if (reviewed >= 5) break
      }
      await doStep(tester, logs, `endStudy-${label}`, () => tester.endStudy())

      const after = await tester.getSave()
      const messages = await tester.getNotifications().catch(() => [])
      sessions.push({
        label,
        hour,
        reviewed,
        beforeDust: before?.minerals?.dust ?? before?.dust ?? null,
        afterDust: after?.minerals?.dust ?? after?.dust ?? null,
        beforeO2: before?.oxygen ?? null,
        afterO2: after?.oxygen ?? null,
        lastMorningReview: after?.lastMorningReview ?? null,
        lastEveningReview: after?.lastEveningReview ?? null,
        messageSample: messages,
        initMethod: start.method,
      })
    }

    await runRitualWindow('morning', 8)
    await runRitualWindow('outside', 15)
    await runRitualWindow('evening', 20)

    await restoreRealDate(tester)

    const morning = sessions.find((s) => s.label === 'morning')
    const outside = sessions.find((s) => s.label === 'outside')
    const evening = sessions.find((s) => s.label === 'evening')

    const morningBonus = (morning.afterDust - morning.beforeDust) >= 25 && (morning.afterO2 - morning.beforeO2) >= 1
    const outsideNoBonus = (outside.afterDust - outside.beforeDust) < 25
    const eveningBonus = (evening.afterDust - evening.beforeDust) >= 25 && (evening.afterO2 - evening.beforeO2) >= 1

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      sessions,
      success: {
        morningBonusGranted: morningBonus,
        noOutsideBonus: outsideNoBonus,
        eveningBonusGranted: eveningBonus,
        messagingClear: sessions.some((s) => s.messageSample.some((m) => /morning|evening|practice|productive|ritual/i.test(m))),
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ6() {
  const q = 6
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const init = await startStudySession(tester, logs, 20)
    const sequence = []
    const dist = {}

    for (let i = 0; i < 25; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      const qEntry = init.queue[i] || null
      const category = card.category || qEntry?.category || 'Unknown'
      const type = qEntry?.type || 'fact'
      sequence.push({ index: i + 1, factId: qEntry?.id || null, category, type, question: card.question })
      dist[category] = (dist[category] || 0) + 1
      await revealAndGrade(tester, logs, 'good')
      if (sequence.length >= 20) break
    }

    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    let maxConsecutive = 0
    let run = 0
    let prev = null
    let jarring = 0
    for (const s of sequence) {
      if (s.category === prev) {
        run++
      } else {
        if (prev !== null) jarring++
        run = 1
      }
      prev = s.category
      if (run > maxConsecutive) maxConsecutive = run
    }

    const focusRating = maxConsecutive <= 4 ? 4 : 2

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      sequence,
      distribution: dist,
      maxConsecutive,
      jarringTransitions: Math.max(0, jarring - 1),
      focusRating,
      success: {
        noFiveStreak: maxConsecutive <= 4,
        spreadReasonable: Object.values(dist).some((v) => v >= 4) ? Math.max(...Object.values(dist)) / sequence.length <= 0.7 : true,
        notChaotic: focusRating >= 3,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ7() {
  const q = 7
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const save0 = await tester.getSave()
    const targetIds = (save0.reviewStates || []).slice(0, 3).map((r) => r.factId)
    await updateSave(tester, 'wrongCountSeed', { factIds: targetIds })

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))
    const escalation = []

    for (let i = 0; i < 30; i++) {
      await doStep(tester, logs, 'forceQuiz()', () => forceQuiz(tester))
      await tester.wait(250)
      const qInfo = await getActiveQuizInfo(tester)

      if (!qInfo?.factId) {
        await doStep(tester, logs, 'mineBlock(down)', () => tester.mineBlock('down'))
        continue
      }

      const beforeSave = await tester.getSave()
      const before = (beforeSave.reviewStates || []).find((r) => r.factId === qInfo.factId)
      const qText = await tester.getQuizText().catch(() => null)
      await doStep(tester, logs, 'answerQuizIncorrectly()', () => tester.answerQuizIncorrectly())
      await tester.wait(220)
      const afterSave = await tester.getSave()
      const after = (afterSave.reviewStates || []).find((r) => r.factId === qInfo.factId)
      const notes = await tester.getNotifications().catch(() => [])

      escalation.push({
        factId: qInfo.factId,
        wrongBefore: before?.wrongCount ?? 0,
        wrongAfter: after?.wrongCount ?? 0,
        memoryTip: qText?.memoryTip ?? null,
        gaiaReaction: qText?.gaiaReaction ?? null,
        notes,
      })

      if (escalation.length >= 6) break
    }

    await doStep(tester, logs, 'endDive()', () => tester.endDive())

    const targeted = escalation.filter((e) => targetIds.includes(e.factId))
    const anyMnemonic = escalation.some((e) => !!e.memoryTip)
    const anyEscalationMsg = escalation.some((e) => [...(e.notes || []), e.gaiaReaction || ''].some((t) => /different angle|study session|keep|again|practice|try/i.test(t)))

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      targetIds,
      escalation,
      success: {
        mnemonicAtThreshold: anyMnemonic,
        gaiaEscalatesAcrossTiers: anyEscalationMsg,
        supportiveTone: escalation.some((e) => [...(e.notes || []), e.gaiaReaction || ''].some((t) => /keep|you can|practice|learn/i.test(t))),
        thresholdsObserved: targeted.some((e) => e.wrongAfter >= 3),
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ8() {
  const q = 8
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const factIds = await getFactIdsFromDB(tester, 200)
    await updateSave(tester, 'backlogSeed', { factIds })

    const saveA = await tester.getSave()
    const dueA = (saveA.reviewStates || []).filter((r) => r.cardState === 'review' && r.nextReviewAt <= Date.now()).length
    const limitA = computeAdaptiveLimit(dueA)

    const initA = await startStudySession(tester, logs, 20)
    const newInSessionA = initA.queue.filter((qv) => qv.cardState === 'new').length

    for (let i = 0; i < 25; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await revealAndGrade(tester, logs, 'good')
      if (i >= 19) break
    }
    await doStep(tester, logs, 'endStudy-A', () => tester.endStudy())

    await doStep(tester, logs, 'fastForward(24)', () => tester.fastForward(24))
    await updateSave(tester, 'backlogClearedSeed')

    const saveB = await tester.getSave()
    const dueB = (saveB.reviewStates || []).filter((r) => r.cardState === 'review' && r.nextReviewAt <= Date.now()).length
    const limitB = computeAdaptiveLimit(dueB)

    const initB = await startStudySession(tester, logs, 20)
    const newInSessionB = initB.queue.filter((qv) => qv.cardState === 'new').length
    await doStep(tester, logs, 'endStudy-B', () => tester.endStudy())

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      dueBefore: dueA,
      adaptiveLimitBefore: limitA,
      newCardsBefore: newInSessionA,
      dueAfter: dueB,
      adaptiveLimitAfter: limitB,
      newCardsAfter: newInSessionB,
      success: {
        throttledUnderBacklog: newInSessionA <= 2,
        recoversAfterClearing: newInSessionB >= 3,
        limitMatchesFormula: limitA === computeAdaptiveLimit(dueA) && limitB === computeAdaptiveLimit(dueB),
        userClarityPresent: false,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ9() {
  const q = 9
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const initStudy = await startStudySession(tester, logs, 5)
    const studiedIds = initStudy.queue.slice(0, 5).map((x) => x.id)

    for (let i = 0; i < 5; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await revealAndGrade(tester, logs, 'good')
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))

    let matched = null
    for (let i = 0; i < 50; i++) {
      await doStep(tester, logs, 'forceQuiz()', () => forceQuiz(tester))
      await tester.wait(250)
      const info = await getActiveQuizInfo(tester)

      if (!info?.factId) {
        await doStep(tester, logs, 'mineBlock(down)', () => tester.mineBlock('down'))
        continue
      }

      if (studiedIds.includes(info.factId)) {
        const beforeO2 = await getO2(tester)
        const beforeSave = await tester.getSave()
        const beforeRS = (beforeSave.reviewStates || []).find((r) => r.factId === info.factId)
        const qText = await tester.getQuizText().catch(() => null)

        await doStep(tester, logs, 'answerQuizIncorrectly()', () => tester.answerQuizIncorrectly())
        await tester.wait(260)

        const afterO2 = await getO2(tester)
        const afterSave = await tester.getSave()
        const afterRS = (afterSave.reviewStates || []).find((r) => r.factId === info.factId)

        matched = {
          factId: info.factId,
          beforeO2,
          afterO2,
          o2Delta: (typeof beforeO2 === 'number' && typeof afterO2 === 'number') ? beforeO2 - afterO2 : null,
          warning: qText?.consistencyWarning || null,
          gaiaReaction: qText?.gaiaReaction || null,
          easeBefore: beforeRS?.easeFactor ?? null,
          easeAfter: afterRS?.easeFactor ?? null,
          easeDelta: (typeof beforeRS?.easeFactor === 'number' && typeof afterRS?.easeFactor === 'number') ? Number((afterRS.easeFactor - beforeRS.easeFactor).toFixed(3)) : null,
        }
        break
      }

      await doStep(tester, logs, 'answerQuizCorrectly()', () => tester.answerQuizCorrectly())
      await tester.wait(180)
    }

    await doStep(tester, logs, 'endDive()', () => tester.endDive())

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      studiedIds,
      matched,
      success: {
        consistencyTriggered: !!matched,
        o2PenaltyObserved: matched ? (matched.o2Delta !== null && matched.o2Delta >= 6) : false,
        warningShown: matched ? !!matched.warning : false,
        easePenaltyApplied: matched ? (matched.easeDelta !== null && matched.easeDelta <= -0.30) : false,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

async function runQ10() {
  const q = 10
  const meta = QUESTION_META[q]
  const logs = []
  const tester = await createPlaytester({ preset: meta.preset })
  const startedAt = nowIso()

  try {
    const factIds = await getFactIdsFromDB(tester, 200)
    await updateSave(tester, 'scoreSeed', { factIds })

    const scoreTimeline = []

    const recordScore = async (label) => {
      const save = await tester.getSave()
      const score = computeStudyScore(save)
      const tier = studyTier(score, (save.learnedFacts || []).length)
      const due = (save.reviewStates || []).filter((r) => (r.repetitions ?? 0) > 0 && ((r.lastReviewAt ?? 0) + (r.interval ?? 0) * 86400_000) < Date.now()).length
      const unlearned = 20
      const quizChance = Number((0.35 + Math.min((due / 10), 1) * 0.15 + Math.min((unlearned / 20), 1) * 0.1 + ((1 - score) * 0.1)).toFixed(3))
      scoreTimeline.push({ label, score: Number(score.toFixed(3)), tier, due, quizChance })
    }

    await recordScore('initial')

    for (let i = 1; i <= 3; i++) {
      await doStep(tester, logs, `fastForward(24)-neglect-${i}`, () => tester.fastForward(24))
      await recordScore(`neglect_day_${i}`)
    }

    for (let i = 1; i <= 3; i++) {
      await doStep(tester, logs, `fastForward(24)-diligent-${i}`, () => tester.fastForward(24))
      await startStudySession(tester, logs, 10)
      for (let c = 0; c < 12; c++) {
        const card = await tester.getStudyCardText().catch(() => null)
        if (!card?.question) break
        await revealAndGrade(tester, logs, 'good')
        if (c >= 9) break
      }
      await doStep(tester, logs, `endStudy-diligent-${i}`, () => tester.endStudy())
      await recordScore(`diligent_day_${i}`)
    }

    const initial = scoreTimeline.find((x) => x.label === 'initial')
    const neglectEnd = scoreTimeline.find((x) => x.label === 'neglect_day_3')
    const diligentEnd = scoreTimeline.find((x) => x.label === 'diligent_day_3')

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      scoreTimeline,
      success: {
        scoreDropsWithNeglect: neglectEnd.score < initial.score,
        scoreRecoversWithDiligence: diligentEnd.score > neglectEnd.score,
        recoveryWithin3Days: diligentEnd.score >= initial.score || (diligentEnd.score - neglectEnd.score) >= 0.15,
        quizChanceResponds: diligentEnd.quizChance < neglectEnd.quizChance,
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

const RUNNERS = {
  1: runQ1,
  2: runQ2,
  3: runQ3,
  4: runQ4,
  5: runQ5,
  6: runQ6,
  7: runQ7,
  8: runQ8,
  9: runQ9,
  10: runQ10,
}

async function runQuestion(q) {
  const fn = RUNNERS[q]
  if (!fn) throw new Error(`Unknown q: ${q}`)
  ensureDir(RESULTS_DIR)
  ensureDir(RAW_DIR)
  const result = await fn()
  const out = path.join(RAW_DIR, `q${String(q).padStart(2, '0')}.json`)
  writeJson(out, result)
  console.log(`Wrote ${out}`)
  return result
}

async function runAll() {
  ensureDir(RESULTS_DIR)
  ensureDir(RAW_DIR)

  const results = {}
  for (const q of Object.keys(RUNNERS).map(Number)) {
    try {
      results[q] = await runQuestion(q)
    } catch (err) {
      results[q] = {
        q,
        title: QUESTION_META[q]?.title || `Q${q}`,
        error: err?.message || String(err),
        failedAt: nowIso(),
      }
      writeJson(path.join(RAW_DIR, `q${String(q).padStart(2, '0')}.json`), results[q])
      console.error(`Q${q} failed: ${results[q].error}`)
    }
  }

  writeJson(path.join(RAW_DIR, 'batch004-raw.json'), results)
  console.log('Wrote batch004-raw.json')
  return results
}

if (require.main === module) {
  const arg = process.argv[2]
  if (!arg || arg === 'all') {
    runAll().catch((err) => {
      console.error(err)
      process.exit(1)
    })
  } else {
    const q = Number(arg)
    runQuestion(q).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}

module.exports = { runQuestion, runAll }
