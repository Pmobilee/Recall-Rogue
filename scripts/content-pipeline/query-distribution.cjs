const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function main() {
  // Read the database file
  const dbPath = path.join(__dirname, '../../public/facts.db');
  const fileBuffer = fs.readFileSync(dbPath);

  // Initialize sql.js and load the database
  const SQL = await initSqlJs();
  const db = new SQL.Database(fileBuffer);

  console.log('\n=== Facts Distribution by Category ===\n');

  // Query: subcategories (excluding Language)
  const query = `
    SELECT category_l1, category_l2, COUNT(*) as cnt
    FROM facts
    WHERE status='approved' AND category_l1 NOT IN ('Language')
    GROUP BY category_l1, category_l2
    ORDER BY category_l1, cnt DESC
  `;

  const result = db.exec(query);
  if (result.length === 0) {
    console.log('No results found.');
    return;
  }

  const rows = result[0].values;
  const columns = result[0].columns;

  // Group by category_l1
  const grouped = {};
  rows.forEach(row => {
    const l1 = row[0];
    const l2 = row[1];
    const cnt = row[2];

    if (!grouped[l1]) {
      grouped[l1] = [];
    }
    grouped[l1].push({ l2, cnt });
  });

  // Print grouped results
  let totalApproved = 0;
  Object.keys(grouped).sort().forEach(l1 => {
    console.log(`\n${l1}:`);
    let domainTotal = 0;
    grouped[l1].forEach(({ l2, cnt }) => {
      console.log(`  ${l2 || '(empty)'}: ${cnt}`);
      domainTotal += cnt;
      totalApproved += cnt;
    });
    console.log(`  [Domain Total: ${domainTotal}]`);
  });

  // Query Language domain separately
  const langQuery = `
    SELECT COUNT(*) as cnt FROM facts
    WHERE status='approved' AND category_l1='Language'
  `;
  const langResult = db.exec(langQuery);
  if (langResult.length > 0) {
    const langCount = langResult[0].values[0][0];
    console.log(`\nLanguage:`);
    console.log(`  [Domain Total: ${langCount}]`);
    totalApproved += langCount;
  }

  // Query facts with empty or null category_l2
  const emptyL2Query = `
    SELECT COUNT(*) as cnt FROM facts
    WHERE status='approved' AND (category_l2 IS NULL OR category_l2='')
  `;
  const emptyResult = db.exec(emptyL2Query);
  if (emptyResult.length > 0) {
    const emptyCount = emptyResult[0].values[0][0];
    console.log(`\nFacts with empty/null category_l2: ${emptyCount}`);
  }

  console.log(`\n=== Overall Total (approved): ${totalApproved} ===\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
