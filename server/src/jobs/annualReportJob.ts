/**
 * Annual learning effectiveness report generation job.
 * Compiles the year's anonymized aggregate statistics and writes a JSON payload.
 * DD-V2-190: Annual effectiveness report generator.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { generateAnnualReport } from '../services/reportGenerator.js'

/**
 * Run the annual effectiveness report generation job.
 * Writes the report JSON to the configured output path.
 *
 * @param year       - 4-digit year to report on (defaults to current year).
 * @param outputPath - File path for the output JSON (defaults to /tmp/recall-rogue-annual-report.json).
 * @returns The generated report object.
 */
export async function runAnnualReportJob(
  year = new Date().getFullYear().toString(),
  outputPath = '/tmp/recall-rogue-annual-report.json',
): Promise<ReturnType<typeof generateAnnualReport>> {
  console.log(`[AnnualReportJob] Generating ${year} effectiveness report...`)

  const report = generateAnnualReport(year)

  const dir = path.dirname(outputPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8')

  console.log(`[AnnualReportJob] Report written to ${outputPath} (${JSON.stringify(report).length} bytes)`)
  return report
}

// CLI entry point: node dist/jobs/annualReportJob.js [year] [outputPath]
if (process.argv[1]?.endsWith('annualReportJob.js')) {
  const year       = process.argv[2] ?? new Date().getFullYear().toString()
  const outputPath = process.argv[3] ?? '/tmp/recall-rogue-annual-report.json'
  runAnnualReportJob(year, outputPath).catch((err) => {
    console.error('[AnnualReportJob] Fatal error:', err)
    process.exit(1)
  })
}
