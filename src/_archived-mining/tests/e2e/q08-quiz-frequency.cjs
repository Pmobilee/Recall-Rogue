const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(8).catch((err) => {
  console.error(err)
  process.exit(1)
})
