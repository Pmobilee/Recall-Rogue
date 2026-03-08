const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(16).catch((err) => {
  console.error(err)
  process.exit(1)
})
