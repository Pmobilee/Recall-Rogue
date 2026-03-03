/**
 * Balance simulation: runs 1,000 synthetic dives and reports key metrics.
 * Run with: node scripts/simulate-balance.mjs
 */
const MOVE_O2_BASE = 1
const MINE_O2_BASE = 2
const HAZARD_HIT_PROBABILITY_PER_TICK = 0.02
const QUIZ_CORRECT_PROBABILITY = 0.65
const QUIZ_O2_REWARD_BASE = 5
const QUIZ_TRIGGER_RATE = 0.08
const LAVA_DAMAGE = 20
const GAS_DAMAGE = 5

function getGridSize(layer) {
  if (layer <= 5) return [20, 20]
  if (layer <= 10) return [25, 25]
  if (layer <= 15) return [30, 30]
  return [40, 40]
}

const O2_BY_LAYER = [100,100,100,100,100,110,115,120,125,130,140,145,150,155,160,175,185,195,205,220]
const HAZARD_DENSITY = [0,0.2,0.4,0.6,0.8,1.0,1.1,1.2,1.3,1.4,1.6,1.8,2.0,2.2,2.5,2.8,3.2,3.6,4.0,4.5]

function getO2Decay(layer) {
  return 1.0 + ((layer - 1) / 19) * 1.5
}

function simulateRun() {
  let currentLayer = 1
  let totalO2Consumed = 0
  let totalQuizzes = 0
  let totalBlocks = 0
  let deaths = 0

  for (let layer = 1; layer <= 20; layer++) {
    const [w, h] = getGridSize(layer)
    const totalCells = w * h
    const tankO2 = O2_BY_LAYER[layer - 1]
    const hazardDensity = HAZARD_DENSITY[layer - 1]
    const o2Decay = getO2Decay(layer)
    let o2 = tankO2
    let survived = true
    const targetBlocks = Math.floor(totalCells * 0.6)
    for (let tick = 0; tick < targetBlocks; tick++) {
      const moveCost = MOVE_O2_BASE * o2Decay
      o2 -= moveCost
      totalO2Consumed += moveCost
      totalBlocks++
      if (Math.random() < QUIZ_TRIGGER_RATE) {
        totalQuizzes++
        if (Math.random() < QUIZ_CORRECT_PROBABILITY) {
          o2 += QUIZ_O2_REWARD_BASE
          totalO2Consumed -= QUIZ_O2_REWARD_BASE
        }
      }
      if (hazardDensity > 0 && Math.random() < HAZARD_HIT_PROBABILITY_PER_TICK * hazardDensity * 0.01) {
        const dmg = Math.random() < 0.5 ? LAVA_DAMAGE : GAS_DAMAGE
        o2 -= dmg
        totalO2Consumed += dmg
      }
      if (o2 <= 0) { deaths++; survived = false; break }
    }
    if (!survived) { currentLayer = layer; break }
    currentLayer = layer
  }
  return { layerReached: currentLayer, died: deaths > 0, totalO2Consumed, totalQuizzes, totalBlocks }
}

const N = 1000
const results = Array.from({ length: N }, simulateRun)
const avgLayer = results.reduce((s, r) => s + r.layerReached, 0) / N
const deathRate = results.filter(r => r.died).length / N
const avgO2 = results.reduce((s, r) => s + r.totalO2Consumed, 0) / N
const avgQuizzes = results.reduce((s, r) => s + r.totalQuizzes, 0) / N
const deathsByLayer = {}
for (const r of results) { if (r.died) deathsByLayer[r.layerReached] = (deathsByLayer[r.layerReached] ?? 0) + 1 }

console.log('=== Balance Simulation Results (N=1000) ===')
console.log(`Average layer reached: ${avgLayer.toFixed(2)}`)
console.log(`Overall death rate: ${(deathRate * 100).toFixed(1)}%`)
console.log(`Average O2 consumed per run: ${avgO2.toFixed(0)}`)
console.log(`Average quizzes triggered per run: ${avgQuizzes.toFixed(1)}`)
console.log('\nDeath rate by layer:')
for (let l = 1; l <= 20; l++) {
  const count = deathsByLayer[l] ?? 0
  const rate = ((count / N) * 100).toFixed(1)
  console.log(`  L${String(l).padStart(2)}: ${rate.padStart(5)}%`)
}
