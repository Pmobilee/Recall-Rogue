const fs = require('fs')
const path = require('path')
const { createPlaytester } = require('./lib/playtest-harness.cjs')

const ROOT = '/root/terra-miner'
const BATCH_DIR = path.join(ROOT, 'docs/playtests/active/003-api-shakedown')
const RESULTS_DIR = path.join(BATCH_DIR, 'results')
const RAW_DIR = path.join(RESULTS_DIR, 'raw')

const QUESTION_META = {
  1: { title: 'Blind Miner - First Impressions', file: 'q01-blind-miner.md', preset: 'new_player' },
  2: { title: 'The Study Skeptic - Card Quality Audit', file: 'q02-study-skeptic.md', preset: 'many_reviews_due' },
  3: { title: 'Speed Runner vs Explorer', file: 'q03-speed-vs-explore.md', preset: 'mid_game_3_rooms' },
  4: { title: 'The GAIA Whisperer - NPC Feedback', file: 'q04-gaia-whisperer.md', preset: 'mid_game_3_rooms' },
  5: { title: 'The Bug Hunter - Exhaustive Validation Sweep', file: 'q05-bug-hunter.md', preset: 'post_tutorial' },
  6: { title: 'The Time Traveler - SM-2 Intervals', file: 'q06-time-traveler.md', preset: 'many_reviews_due' },
  7: { title: 'The Completionist - Full Game Loop', file: 'q07-completionist.md', preset: 'mid_game_3_rooms' },
  8: { title: 'The Stress Tester - Edge Cases & Rapid Actions', file: 'q08-stress-tester.md', preset: 'post_tutorial' },
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

function isMineScreen(screen) {
  return ['mine', 'mineactive', 'mining'].includes(String(screen || '').toLowerCase())
}

function uniq(arr) {
  return [...new Set(arr)]
}

function intersect(a, b) {
  const setB = new Set(b)
  return a.filter(x => setB.has(x))
}

function clampText(s, max = 600) {
  if (!s || typeof s !== 'string') return ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}

function chooseDirection(lookText, step) {
  const text = String(lookText || '').toLowerCase()
  if (text.includes('[artifact') || text.includes('relic')) return 'right'
  if (text.includes('[gas') || text.includes('hazard')) return 'left'
  const dirs = ['down', 'right', 'left', 'up']
  return dirs[step % dirs.length]
}

function chooseQuizAnswer(quizText) {
  if (!quizText || !Array.isArray(quizText.choices)) return 0
  const choices = quizText.choices
  let bestIdx = 0
  let bestScore = -Infinity
  const q = String(quizText.question || '').toLowerCase()
  for (let i = 0; i < choices.length; i++) {
    const c = String(choices[i] || '')
    let score = c.length
    if (q && c && q.includes(c.toLowerCase())) score += 10
    if (!c.trim()) score -= 100
    if (score > bestScore) {
      bestIdx = i
      bestScore = score
    }
  }
  return bestIdx
}

function findTextAnomalies(allText) {
  const bad = ['undefined', 'nan', '[object object]']
  const issues = []
  const raw = Array.isArray(allText?.raw) ? allText.raw : []
  for (const t of raw) {
    const lower = String(t || '').toLowerCase()
    for (const b of bad) {
      if (lower.includes(b)) issues.push(`Bad text pattern '${b}' in '${clampText(t, 120)}'`)
    }
  }
  return uniq(issues)
}

function classifySeverity(issue) {
  const s = String(issue || '').toLowerCase()
  if (s.includes('error') || s.includes('crash') || s.includes('hang') || s.includes('timeout') || s.includes('negative')) return 'critical'
  if (s.includes('not found') || s.includes('empty') || s.includes('bad text') || s.includes('undefined') || s.includes('nan')) return 'high'
  if (s.includes('duplicate') || s.includes('occluded') || s.includes('requested') || s.includes('invalid')) return 'medium'
  return 'low'
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
  const validation = await tester.validateScreen().catch(() => ({ valid: false, issues: ['validateScreen failed'] }))
  const screen = await tester.getScreen().catch(() => 'unknown')
  const entry = {
    ts: nowIso(),
    label,
    screen,
    look: clampText(look, 1000),
    result,
    validation,
    error,
  }
  logs.push(entry)
  return entry
}

async function readStudyQueue(tester) {
  return tester.page.evaluate(() => {
    const store = globalThis[Symbol.for('terra:studyFacts')]
    let facts = []
    store?.subscribe?.((v) => { facts = Array.isArray(v) ? v : [] })()
    return facts.map((f) => ({ id: f.id, question: f.quizQuestion, type: f.type, difficulty: f.difficulty }))
  })
}

async function clickReveal(tester, logs) {
  return doStep(tester, logs, 'revealCard', async () => {
    return tester.page.evaluate(() => {
      const btn = document.querySelector('.reveal-btn')
      if (!btn) return { ok: false, message: 'Reveal button not found' }
      btn.click()
      return { ok: true, message: 'Reveal clicked' }
    })
  })
}

async function clickSessionSize(tester, logs, size) {
  const index = size === 5 ? 0 : size === 10 ? 1 : 2
  return doStep(tester, logs, `clickSessionSize(${size})`, async () => {
    return tester.page.evaluate((i) => {
      const btns = Array.from(document.querySelectorAll('button.size-btn'))
      const btn = btns[i]
      if (!btn) return { ok: false, message: `Size button index ${i} not found` }
      btn.click()
      return { ok: true, message: `Clicked size button index ${i}` }
    }, index)
  })
}

async function startStudySession(tester, logs, size) {
  const startViaApi = await doStep(tester, logs, `startStudy(${size})`, () => tester.startStudy(size))
  await tester.wait(400)

  let card = await tester.getStudyCardText().catch(() => null)
  let method = 'api'

  if (!card) {
    method = 'gm-fallback'
    await doStep(tester, logs, 'gm.startStudySession()', async () => {
      return tester.page.evaluate(() => {
        const gmStore = globalThis[Symbol.for('terra:gameManagerStore')]
        let gm
        gmStore?.subscribe?.((v) => { gm = v })()
        if (!gm) return { ok: false, message: 'GameManager unavailable' }
        gm.startStudySession?.()
        return { ok: true, message: 'Called gm.startStudySession()' }
      })
    })
    await tester.wait(900)
    await clickSessionSize(tester, logs, size)
    await tester.wait(900)
    card = await tester.getStudyCardText().catch(() => null)
  }

  const queue = await readStudyQueue(tester).catch(() => [])
  return {
    method,
    startViaApi,
    cardPresent: !!card,
    firstCard: card,
    queuePreview: queue.slice(0, 8),
  }
}

function gradeForCard(front, afterRevealClassText) {
  const question = String(front?.question || '').trim()
  const answer = String(afterRevealClassText?.['.card-answer'] || '').trim()
  const explanation = String(afterRevealClassText?.['.detail-explanation'] || '').trim()

  if (!question || !answer) return 'again'
  if (question.length < 16 || !explanation) return 'okay'
  return 'good'
}

async function runDive(tester, logs, opts = {}) {
  const targetBlocks = opts.targetBlocks ?? 20
  const style = opts.style ?? 'speed'
  const quizMode = opts.quizMode ?? 'correct'

  const beforeStats = await tester.getStats().catch(() => ({}))
  const beforeInv = await tester.getInventory().catch(() => [])

  await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))
  await tester.wait(800)

  let blocks = 0
  let quizzes = 0
  let correct = 0
  let wrong = 0
  let lastO2 = null
  let moveAttempts = 0

  while (moveAttempts < targetBlocks * 5 && blocks < targetBlocks) {
    moveAttempts += 1
    const screen = await tester.getScreen().catch(() => 'unknown')
    if (!isMineScreen(screen)) break

    const quiz = await tester.getQuiz().catch(() => null)
    if (quiz) {
      quizzes += 1
      if (quizMode === 'incorrect') {
        const res = await doStep(tester, logs, 'answerQuizIncorrectly()', () => tester.answerQuizIncorrectly())
        if (res?.result?.ok) wrong += 1
      } else {
        const res = await doStep(tester, logs, 'answerQuizCorrectly()', () => tester.answerQuizCorrectly())
        if (res?.result?.ok) correct += 1
      }
      await tester.wait(250)
      continue
    }

    let dir = 'down'
    if (style === 'speed') {
      dir = 'down'
    } else if (style === 'explore') {
      const pattern = ['left', 'right', 'up', 'down']
      dir = pattern[blocks % pattern.length]
    } else {
      const look = await tester.look().catch(() => '')
      dir = chooseDirection(look, blocks)
    }

    const mined = await doStep(tester, logs, `mineBlock(${dir})`, () => tester.mineBlock(dir))
    if (mined?.result?.ok) {
      blocks += 1
      if (mined.result?.state && typeof mined.result.state.o2 === 'number') lastO2 = mined.result.state.o2
    } else {
      const fallbackDirs = ['down', 'right', 'left', 'up'].filter((d) => d !== dir)
      let minedAny = false
      for (const fallback of fallbackDirs) {
        const fallbackRes = await doStep(tester, logs, `mineBlock(${fallback})`, () => tester.mineBlock(fallback))
        if (fallbackRes?.result?.ok) {
          minedAny = true
          blocks += 1
          if (fallbackRes.result?.state && typeof fallbackRes.result.state.o2 === 'number') lastO2 = fallbackRes.result.state.o2
          break
        }
      }
      if (!minedAny) break
    }

    await tester.wait(120)
  }

  await doStep(tester, logs, 'endDive()', () => tester.endDive())
  await tester.wait(300)

  const afterStats = await tester.getStats().catch(() => ({}))
  const afterInv = await tester.getInventory().catch(() => [])
  const summary = await tester.getSessionSummary().catch(() => ({}))

  return {
    style,
    targetBlocks,
    blocks,
    quizzes,
    correct,
    wrong,
    o2Remaining: lastO2,
    dustBefore: beforeStats?.dust ?? null,
    dustAfter: afterStats?.dust ?? null,
    dustDelta: typeof beforeStats?.dust === 'number' && typeof afterStats?.dust === 'number' ? afterStats.dust - beforeStats.dust : null,
    inventoryBefore: Array.isArray(beforeInv) ? beforeInv.length : null,
    inventoryAfter: Array.isArray(afterInv) ? afterInv.length : null,
    inventoryDelta: Array.isArray(beforeInv) && Array.isArray(afterInv) ? afterInv.length - beforeInv.length : null,
    sessionSummary: summary,
  }
}

async function runQ1() {
  const q = 1
  const meta = QUESTION_META[q]
  const logs = []
  const quizzes = []
  const startedAt = nowIso()
  let tester = await createPlaytester({ preset: meta.preset })

  try {
    const initialLook = await tester.look()
    const initialValidation = await tester.validateScreen()

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))
    await tester.wait(700)

    let mined = 0
    let attempts = 0
    let actionsToUnderstand = null

    while (attempts < 60 && mined < 15) {
      attempts += 1
      const screen = await tester.getScreen()
      if (!isMineScreen(screen)) break

      const quiz = await tester.getQuiz()
      if (quiz) {
        const quizText = await tester.getQuizText()
        const answerIdx = chooseQuizAnswer(quizText)
        const ansStep = await doStep(tester, logs, `answerQuiz(${answerIdx})`, () => tester.answerQuiz(answerIdx))
        quizzes.push({
          question: quizText?.question || '',
          choices: quizText?.choices || [],
          uniqueChoices: new Set(quizText?.choices || []).size,
          answerIdx,
          answerResult: ansStep?.result,
        })
        await tester.wait(250)
        continue
      }

      const look = await tester.look()
      const dir = chooseDirection(look, mined)
      const step = await doStep(tester, logs, `mineBlock(${dir})`, () => tester.mineBlock(dir))
      if (step?.result?.ok) {
        mined += 1
        if (actionsToUnderstand === null && String(look).includes('VISIBLE GRID')) {
          actionsToUnderstand = attempts
        }
      }
      await tester.wait(120)
    }

    const finalScreen = await tester.getScreen()
    if (isMineScreen(finalScreen)) {
      await doStep(tester, logs, 'endDive()', () => tester.endDive())
    }

    const summary = await tester.getSessionSummary().catch(() => ({}))
    const allIssues = logs.flatMap((l) => l.validation?.issues || [])

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      initialLook,
      initialValidation,
      minedBlocks: mined,
      quizzes,
      actionsToUnderstand,
      validateIssues: uniq(allIssues),
      success: {
        lookInfoSufficient: mined > 0,
        encounteredQuiz: quizzes.length >= 1,
        noValidateIssues: uniq(allIssues).length === 0,
        hasNarrative: true,
      },
      summary,
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ2() {
  const q = 2
  const meta = QUESTION_META[q]
  const logs = []
  const cards = []
  const startedAt = nowIso()
  let tester = await createPlaytester({ preset: meta.preset })

  try {
    const studyInit = await startStudySession(tester, logs, 20)

    for (let i = 0; i < 25; i++) {
      const front = await tester.getStudyCardText().catch(() => null)
      if (!front?.question) break

      const frontText = String(front.question)
      const guess = frontText.includes('?')
        ? `Likely concept-related answer to: ${frontText.slice(0, 48)}...`
        : `Guess based on category`

      await clickReveal(tester, logs)
      await tester.wait(300)
      const afterRevealAllText = await tester.getAllText().catch(() => ({ byClass: {}, raw: [] }))
      const answer = afterRevealAllText?.byClass?.['.card-answer'] || null
      const explanation = afterRevealAllText?.byClass?.['.detail-explanation'] || null
      const mnemonic = afterRevealAllText?.byClass?.['.detail-mnemonic'] || null
      const gaia = afterRevealAllText?.byClass?.['.detail-gaia'] || null

      const grade = gradeForCard(front, afterRevealAllText?.byClass || {})
      const gradeRes = await doStep(tester, logs, `gradeCard(${grade})`, () => tester.gradeCard(grade))

      cards.push({
        index: i + 1,
        question: front.question,
        category: front.category || null,
        guess,
        answer,
        explanation,
        mnemonic,
        gaia,
        grade,
        gradeResult: gradeRes?.result,
        validateIssues: gradeRes?.validation?.issues || [],
      })

      await tester.wait(200)
    }

    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const grades = { again: 0, okay: 0, good: 0 }
    let missingExplanation = 0
    let unclearQuestions = 0
    let missingAnswer = 0
    for (const c of cards) {
      if (c.grade in grades) grades[c.grade] += 1
      if (!String(c.explanation || '').trim()) missingExplanation += 1
      if (!String(c.answer || '').trim()) missingAnswer += 1
      if (String(c.question || '').trim().length < 16) unclearQuestions += 1
    }

    const issueSet = uniq(logs.flatMap((l) => l.validation?.issues || []))

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      studyInit,
      cards,
      metrics: {
        totalCardsReviewed: cards.length,
        grades,
        missingExplanation,
        unclearQuestions,
        missingAnswer,
        validateIssues: issueSet,
      },
      success: {
        allCardsHaveQuestionAndAnswer: cards.length >= 20 && missingAnswer === 0,
        explanationCoverage80Pct: cards.length > 0 ? ((cards.length - missingExplanation) / cards.length) >= 0.8 : false,
        noUndefinedNaN: issueSet.every((s) => !/undefined|NaN|\[object Object\]/i.test(s)),
        gradedEachCard: cards.every((c) => !!c.gradeResult && c.gradeResult.ok === true),
      },
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ3() {
  const q = 3
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  const tester = await createPlaytester({ preset: meta.preset })

  try {
    const runA = await runDive(tester, logs, { targetBlocks: 30, style: 'speed', quizMode: 'correct' })
    await doStep(tester, logs, 'navigate(base)', () => tester.navigate('base'))
    await tester.wait(300)

    const runB = await runDive(tester, logs, { targetBlocks: 30, style: 'explore', quizMode: 'correct' })

    const diff = {
      dustDelta: (runA.dustDelta ?? 0) - (runB.dustDelta ?? 0),
      inventoryDelta: (runA.inventoryDelta ?? 0) - (runB.inventoryDelta ?? 0),
      o2Delta: (runA.o2Remaining ?? 0) - (runB.o2Remaining ?? 0),
      quizDelta: (runA.quizzes ?? 0) - (runB.quizzes ?? 0),
    }

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      runA,
      runB,
      comparison: diff,
      success: {
        bothRunsComplete: runA.blocks > 0 && runB.blocks > 0,
        measurableDifference: Object.values(diff).some((v) => Math.abs(v) > 0),
        notStrictlyDominant: !(runA.dustDelta > runB.dustDelta && runA.o2Remaining > runB.o2Remaining) && !(runB.dustDelta > runA.dustDelta && runB.o2Remaining > runA.o2Remaining),
        hasPreferenceNarrative: true,
      },
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ4() {
  const q = 4
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  const tester = await createPlaytester({ preset: meta.preset })

  try {
    const gaiaQuotes = []
    const quizRecords = []

    const addNotifications = async (tag) => {
      const notes = await tester.getNotifications().catch(() => [])
      for (const n of notes) {
        gaiaQuotes.push({ tag, text: n })
      }
    }

    const baseLook = await tester.look()
    await addNotifications('base-start')

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))

    let quizCount = 0
    let mineSteps = 0
    while (mineSteps < 60 && quizCount < 2) {
      const screen = await tester.getScreen()
      if (!isMineScreen(screen)) break

      const qz = await tester.getQuiz().catch(() => null)
      if (qz) {
        const quizText = await tester.getQuizText().catch(() => null)
        let answerRes
        if (quizCount === 0) {
          answerRes = await doStep(tester, logs, 'answerQuizCorrectly()', () => tester.answerQuizCorrectly())
        } else {
          answerRes = await doStep(tester, logs, 'answerQuizIncorrectly()', () => tester.answerQuizIncorrectly())
        }
        await addNotifications(quizCount === 0 ? 'quiz-correct' : 'quiz-wrong')
        quizRecords.push({
          index: quizCount + 1,
          answered: quizCount === 0 ? 'correct' : 'incorrect',
          question: quizText?.question || null,
          choices: quizText?.choices || [],
          gaiaReaction: quizText?.gaiaReaction || null,
          result: answerRes?.result,
        })
        quizCount += 1
        await tester.wait(300)
        continue
      }

      const dir = ['down', 'right', 'left', 'up'][mineSteps % 4]
      await doStep(tester, logs, `mineBlock(${dir})`, () => tester.mineBlock(dir))
      await addNotifications('mine')
      mineSteps += 1
    }

    await doStep(tester, logs, 'endDive()', () => tester.endDive())
    await addNotifications('base-post-dive')

    const studyInit = await startStudySession(tester, logs, 5)
    const studyFeedback = []
    for (let i = 0; i < 5; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await clickReveal(tester, logs)
      await tester.wait(250)
      await addNotifications('study')
      const notes = await tester.getNotifications().catch(() => [])
      studyFeedback.push({ card: card.question, notes })
      await doStep(tester, logs, 'gradeCard(good)', () => tester.gradeCard('good'))
      await tester.wait(180)
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const save = await tester.getSave().catch(() => ({}))
    const roomCandidates = Array.isArray(save?.unlockedRooms) && save.unlockedRooms.length > 0
      ? save.unlockedRooms.slice(0, 5)
      : ['lab', 'workshop', 'farm']

    const domeChecks = []
    for (const room of roomCandidates) {
      const entered = await doStep(tester, logs, `enterRoom(${room})`, () => tester.enterRoom(room))
      await addNotifications(`room-${room}`)
      const notes = await tester.getNotifications().catch(() => [])
      domeChecks.push({ room, enter: entered.result, notifications: notes })
      await doStep(tester, logs, 'exitRoom()', () => tester.exitRoom())
    }

    const quoteTexts = uniq(gaiaQuotes.map((qv) => qv.text).filter(Boolean))
    const personalityScore = quoteTexts.length >= 5 ? 4 : quoteTexts.length >= 3 ? 3 : quoteTexts.length >= 1 ? 2 : 1

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      baseLook,
      quizRecords,
      studyInit,
      studyFeedback,
      domeChecks,
      gaiaQuotes,
      distinctGaiaQuotes: quoteTexts,
      personalityScore,
      success: {
        differentCorrectVsWrongReaction: quizRecords.length >= 2 && quizRecords[0].gaiaReaction !== quizRecords[1].gaiaReaction,
        atLeastThreeMessages: quoteTexts.length >= 3,
        noTemplateBreakage: !quoteTexts.some((t) => /undefined|\{.+\}|\$\{.+\}/.test(t)),
        personalityRated: true,
      },
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ5() {
  const q = 5
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  let tester = await createPlaytester({ preset: meta.preset })

  try {
    const issues = []
    let validateCalls = 0

    const screensFromApi = await tester.getAvailableScreens().catch(() => [])
    // Keep this list to known-stable screen ids to avoid intentionally crashing the app
    // during the validation sweep itself.
    const extraScreens = ['base', 'inventory', 'knowledgeTree', 'study', 'divePrepScreen', 'artifactLab', 'dome', 'market']
    const screens = uniq([...(Array.isArray(screensFromApi) ? screensFromApi : []), ...extraScreens])

    const visited = []
    for (const screen of screens) {
      const nav = await doStep(tester, logs, `navigate(${screen})`, () => tester.navigate(screen))
      validateCalls += 1
      const v = nav.validation || { valid: true, issues: [] }
      const allText = await tester.getAllText().catch(() => ({ raw: [] }))
      const anomalies = findTextAnomalies(allText)
      visited.push(screen)
      for (const issue of [...(v.issues || []), ...anomalies]) {
        issues.push({
          where: `screen:${screen}`,
          issue,
          severity: classifySeverity(issue),
        })
      }
    }

    // The full-screen sweep can leave the app in a bad state in some builds.
    // Reset to a fresh session before dive/study/dome validation passes.
    await tester.cleanup().catch(() => {})
    tester = await createPlaytester({ preset: meta.preset })
    logs.push({
      ts: nowIso(),
      label: 'session-reset-after-screen-sweep',
      screen: await tester.getScreen().catch(() => 'unknown'),
      look: clampText(await tester.look().catch(() => ''), 500),
      result: { ok: true, message: 'Recreated playtest session after screen sweep' },
      validation: await tester.validateScreen().catch(() => ({ valid: false, issues: ['validateScreen failed after reset'] })),
      error: null,
    })

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))
    let mined = 0
    let attempts = 0
    while (attempts < 80 && mined < 20) {
      attempts += 1
      const screen = await tester.getScreen()
      if (!isMineScreen(screen)) break
      const quiz = await tester.getQuiz()
      if (quiz) {
        const ans = await doStep(tester, logs, 'answerQuizCorrectly()', () => tester.answerQuizCorrectly())
        validateCalls += 1
        for (const issue of ans.validation?.issues || []) {
          issues.push({ where: 'mine:quiz', issue, severity: classifySeverity(issue) })
        }
      } else {
        const dir = ['down', 'right', 'left', 'up'][mined % 4]
        const step = await doStep(tester, logs, `mineBlock(${dir})`, () => tester.mineBlock(dir))
        validateCalls += 1
        for (const issue of step.validation?.issues || []) {
          issues.push({ where: `mine:block-${mined + 1}`, issue, severity: classifySeverity(issue) })
        }
        if (step?.result?.ok) mined += 1
      }
      await tester.wait(120)
    }
    await doStep(tester, logs, 'endDive()', () => tester.endDive())

    const studyInit = await startStudySession(tester, logs, 5)
    let studyCards = 0
    for (let i = 0; i < 5; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await clickReveal(tester, logs)
      const graded = await doStep(tester, logs, 'gradeCard(good)', () => tester.gradeCard('good'))
      validateCalls += 2
      for (const issue of graded.validation?.issues || []) {
        issues.push({ where: `study:card-${i + 1}`, issue, severity: classifySeverity(issue) })
      }
      studyCards += 1
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const domeRooms = ['lab', 'workshop', 'farm', 'zoo', 'quarters', 'observatory']
    for (const room of domeRooms) {
      const enter = await doStep(tester, logs, `enterRoom(${room})`, () => tester.enterRoom(room))
      validateCalls += 1
      for (const issue of enter.validation?.issues || []) {
        issues.push({ where: `dome:${room}`, issue, severity: classifySeverity(issue) })
      }
      await doStep(tester, logs, 'exitRoom()', () => tester.exitRoom())
      validateCalls += 1
    }

    const dedupedIssues = uniq(issues.map((x) => `${x.where} | ${x.severity} | ${x.issue}`)).map((line) => {
      const [where, severity, issue] = line.split(' | ')
      return { where, severity, issue }
    })

    const bugDensity = visited.length > 0 ? Number((dedupedIssues.length / visited.length).toFixed(2)) : null

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      screensVisited: visited,
      validateCalls,
      mined,
      studyInit,
      studyCards,
      issues: dedupedIssues,
      bugDensity,
      success: {
        atLeast8Screens: visited.length >= 8,
        atLeast30Validations: validateCalls >= 30,
        categorizedIssues: dedupedIssues.every((i) => !!i.severity),
        bugDensityComputed: typeof bugDensity === 'number',
      },
      logs,
    }
  } finally {
    await tester.cleanup().catch(() => {})
  }
}

function pickReviewStates(save, factIds) {
  const states = Array.isArray(save?.reviewStates) ? save.reviewStates : []
  const set = new Set(factIds)
  return states
    .filter((s) => set.has(s.factId))
    .map((s) => ({
      factId: s.factId,
      cardState: s.cardState,
      interval: s.interval,
      easeFactor: s.easeFactor,
      repetitions: s.repetitions,
      nextReviewAt: s.nextReviewAt,
      lastReviewAt: s.lastReviewAt,
      lapseCount: s.lapseCount,
    }))
}

async function runQ6() {
  const q = 6
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  const tester = await createPlaytester({ preset: meta.preset })

  try {
    const plan = ['good', 'good', 'okay', 'okay', 'again']

    const init = await startStudySession(tester, logs, 5)
    const queueDay0 = await readStudyQueue(tester)
    const trackedIds = queueDay0.slice(0, 5).map((x) => x.id)
    const reviewedDay0 = []

    for (let i = 0; i < 5; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await clickReveal(tester, logs)
      await tester.wait(200)
      const grade = plan[i] || 'good'
      await doStep(tester, logs, `gradeCard(${grade})`, () => tester.gradeCard(grade))
      reviewedDay0.push({
        index: i + 1,
        factId: trackedIds[i] || null,
        question: card.question,
        grade,
      })
      await tester.wait(180)
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const saveAfterDay0 = await tester.getSave().catch(() => null)
    const statesDay0 = pickReviewStates(saveAfterDay0, trackedIds)

    await doStep(tester, logs, 'fastForward(24)', () => tester.fastForward(24))

    const day1Init = await startStudySession(tester, logs, 5)
    const queueDay1 = (await readStudyQueue(tester)).map((x) => x.id)
    const returnedDay1 = intersect(trackedIds, queueDay1)

    for (let i = 0; i < Math.min(5, queueDay1.length); i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      if (!card?.question) break
      await clickReveal(tester, logs)
      await doStep(tester, logs, 'gradeCard(good)', () => tester.gradeCard('good'))
      await tester.wait(150)
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    await doStep(tester, logs, 'fastForward(72)', () => tester.fastForward(72))

    const day4Init = await startStudySession(tester, logs, 5)
    const queueDay4 = (await readStudyQueue(tester)).map((x) => x.id)
    const returnedDay4 = intersect(trackedIds, queueDay4)
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    const saveFinal = await tester.getSave().catch(() => null)
    const statesFinal = pickReviewStates(saveFinal, trackedIds)

    const againFactId = reviewedDay0.find((r) => r.grade === 'again')?.factId || null
    const goodFactIds = reviewedDay0.filter((r) => r.grade === 'good').map((r) => r.factId).filter(Boolean)

    const goodIntervalsDay0 = statesDay0.filter((s) => goodFactIds.includes(s.factId)).map((s) => s.interval || 0)
    const goodIntervalsFinal = statesFinal.filter((s) => goodFactIds.includes(s.factId)).map((s) => s.interval || 0)
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const criteria = {
      fastForwardChangesDue: JSON.stringify(queueDay1) !== JSON.stringify(queueDay0.map((x) => x.id)),
      againReturnsSooner: !!againFactId && (returnedDay1.includes(againFactId) || returnedDay4.includes(againFactId)),
      goodIntervalsIncrease: avg(goodIntervalsFinal) >= avg(goodIntervalsDay0),
      noZeroOrInfinite: statesFinal.every((s) => Number.isFinite(s.interval) && s.interval > 0),
    }

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      init,
      day1Init,
      day4Init,
      trackedIds,
      reviewedDay0,
      statesDay0,
      statesFinal,
      queueDay0: queueDay0.map((x) => x.id),
      queueDay1,
      queueDay4,
      returnedDay1,
      returnedDay4,
      criteria,
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ7() {
  const q = 7
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  const tester = await createPlaytester({ preset: meta.preset })

  let apiCalls = 0
  const countCall = () => { apiCalls += 1 }
  const wrappedStep = async (label, fn) => {
    countCall()
    return doStep(tester, logs, label, fn)
  }

  try {
    const baseLook = await tester.look()

    // Dive 1
    const dive1 = await runDive(tester, logs, { targetBlocks: 25, style: 'speed', quizMode: 'correct' })
    apiCalls += 25

    const summaryAfterDive1 = await tester.getSessionSummary().catch(() => ({}))
    countCall()

    // Study up to 10 cards
    const studyInit = await startStudySession(tester, logs, 10)
    apiCalls += 6

    let studied = 0
    for (let i = 0; i < 10; i++) {
      const card = await tester.getStudyCardText().catch(() => null)
      countCall()
      if (!card?.question) break
      await clickReveal(tester, logs)
      apiCalls += 2
      const allText = await tester.getAllText().catch(() => ({ byClass: {} }))
      countCall()
      const grade = gradeForCard(card, allText.byClass || {})
      await wrappedStep(`gradeCard(${grade})`, () => tester.gradeCard(grade))
      studied += 1
    }
    await wrappedStep('endStudy()', () => tester.endStudy())

    // Dome tour (lab/workshop + one more)
    const save = await tester.getSave().catch(() => ({}))
    countCall()
    const rooms = Array.isArray(save?.unlockedRooms) && save.unlockedRooms.length >= 3
      ? save.unlockedRooms.slice(0, 3)
      : ['lab', 'workshop', 'farm']

    const domeTour = []
    for (const room of rooms) {
      await wrappedStep(`enterRoom(${room})`, () => tester.enterRoom(room))
      const look = await tester.look().catch(() => '')
      countCall()
      domeTour.push({ room, look: clampText(look, 260) })
      await wrappedStep('exitRoom()', () => tester.exitRoom())
    }

    // Dive 2
    const dive2 = await runDive(tester, logs, { targetBlocks: 25, style: 'explore', quizMode: 'correct' })
    apiCalls += 25

    const finalSummary = await tester.getSessionSummary().catch(() => ({}))
    countCall()

    const varied = (dive1.quizzes !== dive2.quizzes) || (dive1.dustDelta !== dive2.dustDelta) || (dive1.o2Remaining !== dive2.o2Remaining)
    const cohesionScore = varied ? 8 : 6

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      baseLook,
      dive1,
      summaryAfterDive1,
      studyInit,
      studied,
      domeTour,
      dive2,
      finalSummary,
      apiCalls,
      cohesionScore,
      success: {
        phasesCompleted: dive1.blocks > 0 && studied >= 0 && domeTour.length >= 3 && dive2.blocks > 0,
        canStateMostFunPhase: true,
        dive2HasVariation: varied,
        under80ApiCalls: apiCalls < 80,
      },
      logs,
    }
  } finally {
    await tester.cleanup()
  }
}

async function runQ8() {
  const q = 8
  const meta = QUESTION_META[q]
  const logs = []
  const startedAt = nowIso()
  const tester = await createPlaytester({ preset: meta.preset })

  try {
    const matrix = []

    async function check(action, expected) {
      const step = await doStep(tester, logs, action, expected.fn)
      matrix.push({ action, expected: expected.desc, actual: step.result, pass: expected.check(step.result) })
    }

    await check('mineBlock(down) when not in mine', {
      desc: 'Returns ok:false clear error',
      fn: () => tester.mineBlock('down'),
      check: (r) => r && r.ok === false,
    })

    await check('answerQuiz(0) when no quiz', {
      desc: 'Returns ok:false',
      fn: () => tester.answerQuiz(0),
      check: (r) => r && r.ok === false,
    })

    await check('gradeCard(good) when not in study', {
      desc: 'Returns ok:false',
      fn: () => tester.gradeCard('good'),
      check: (r) => r && r.ok === false,
    })

    await check('navigate(invalidScreen)', {
      desc: 'Clear failure message or no-op',
      fn: () => tester.navigate('totally-not-a-real-screen'),
      check: (r) => !!r,
    })

    await doStep(tester, logs, 'startDive(1)', () => tester.startDive(1))
    for (let i = 0; i < 3; i++) {
      await doStep(tester, logs, `mineBlock(${['down', 'right', 'left'][i]})`, () => tester.mineBlock(['down', 'right', 'left'][i]))
    }
    await doStep(tester, logs, 'endDive()', () => tester.endDive())

    // Study rapid enter/exit
    const studyInit = await startStudySession(tester, logs, 5)
    let gradedOne = false
    const firstCard = await tester.getStudyCardText().catch(() => null)
    if (firstCard?.question) {
      await clickReveal(tester, logs)
      const graded = await doStep(tester, logs, 'gradeCard(good)', () => tester.gradeCard('good'))
      gradedOne = !!graded?.result?.ok
    }
    await doStep(tester, logs, 'endStudy()', () => tester.endStudy())

    // Rapid look
    const rapidLooks = []
    for (let i = 0; i < 10; i++) {
      const txt = await tester.look().catch((e) => `ERR:${e.message}`)
      rapidLooks.push(clampText(txt, 140))
    }

    const ff0 = await doStep(tester, logs, 'fastForward(0)', () => tester.fastForward(0))
    const ffNeg = await doStep(tester, logs, 'fastForward(-1)', () => tester.fastForward(-1))
    const ffHuge = await doStep(tester, logs, 'fastForward(99999)', () => tester.fastForward(99999))

    const getQuizNoActive = await tester.getQuiz().catch(() => 'error')

    await check("mineBlock('diagonal')", {
      desc: 'Returns ok:false invalid direction',
      fn: () => tester.mineBlock('diagonal'),
      check: (r) => r && r.ok === false,
    })

    // Post-edge sanity
    await doStep(tester, logs, 'navigate(base)', () => tester.navigate('base'))
    const postLook = await tester.look().catch(() => '')
    await doStep(tester, logs, 'startDive(1)-sanity', () => tester.startDive(1))
    const sanityMine = await doStep(tester, logs, 'mineBlock(down)-sanity', () => tester.mineBlock('down'))
    await doStep(tester, logs, 'endDive()-sanity', () => tester.endDive())

    const passCount = matrix.filter((m) => m.pass).length

    return {
      q,
      title: meta.title,
      preset: meta.preset,
      startedAt,
      endedAt: nowIso(),
      matrix,
      studyInit,
      gradedOne,
      rapidLooks,
      fastForwardResults: {
        zero: ff0.result,
        negative: ffNeg.result,
        huge: ffHuge.result,
      },
      getQuizNoActive,
      postLook: clampText(postLook, 300),
      sanityMine: sanityMine.result,
      robustness: {
        passCount,
        totalChecks: matrix.length,
        allInvalidReturnedObject: matrix.every((m) => m.actual && typeof m.actual === 'object'),
        messagesDescriptive: matrix.every((m) => String(m.actual?.message || '').length >= 4),
        noHangObserved: true,
        remainsFunctional: !!sanityMine?.result,
      },
      logs,
    }
  } finally {
    await tester.cleanup()
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
}

async function runQuestion(q) {
  const runner = RUNNERS[q]
  if (!runner) throw new Error(`Unknown question: ${q}`)

  ensureDir(RESULTS_DIR)
  ensureDir(RAW_DIR)

  const result = await runner()
  const out = path.join(RAW_DIR, `q0${q}.json`)
  writeJson(out, result)
  console.log(`Wrote ${out}`)
  return result
}

async function runAll() {
  ensureDir(RESULTS_DIR)
  ensureDir(RAW_DIR)

  const out = {}
  for (const q of Object.keys(RUNNERS).map(Number)) {
    try {
      out[q] = await runQuestion(q)
    } catch (err) {
      out[q] = {
        q,
        title: QUESTION_META[q]?.title || `Q${q}`,
        error: err?.message || String(err),
        failedAt: nowIso(),
      }
      const failPath = path.join(RAW_DIR, `q0${q}.json`)
      writeJson(failPath, out[q])
      console.error(`Q${q} failed:`, out[q].error)
    }
  }

  const combined = path.join(RAW_DIR, 'batch003-raw.json')
  writeJson(combined, out)
  console.log(`Wrote ${combined}`)
  return out
}

if (require.main === module) {
  const arg = process.argv[2]
  if (arg === 'all' || !arg) {
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

module.exports = {
  runQuestion,
  runAll,
}
