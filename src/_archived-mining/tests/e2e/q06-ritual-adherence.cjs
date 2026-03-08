const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(6).catch((err) => {
  console.error(err)
  process.exit(1)
})
