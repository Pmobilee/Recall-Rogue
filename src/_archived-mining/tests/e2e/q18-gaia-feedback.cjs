const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(18).catch((err) => {
  console.error(err)
  process.exit(1)
})
