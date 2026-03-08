const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(2).catch((err) => {
  console.error(err)
  process.exit(1)
})
