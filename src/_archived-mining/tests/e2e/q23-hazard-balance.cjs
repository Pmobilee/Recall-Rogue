const { runQuestion } = require('./batch002-playtest-core.cjs')

runQuestion(23).catch((err) => {
  console.error(err)
  process.exit(1)
})
