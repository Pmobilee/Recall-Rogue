const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(24).catch((err) => {
  console.error(err)
  process.exit(1)
})
