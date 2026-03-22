#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const componentsDir = path.join(__dirname, '../src/ui/components')

/**
 * Extract the <style> section from a Svelte component file
 */
function extractStyleBlock(content) {
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (!styleMatch) return null

  const styleContent = styleMatch[1]
  const startPos = content.indexOf(styleMatch[0])

  // Count line breaks before the style block to get accurate line numbers
  const linesBefore = content.substring(0, startPos).split('\n').length

  return {
    content: styleContent,
    startLine: linesBefore,
  }
}

/**
 * Check if a value is inside a calc() with a CSS variable
 */
function isInsideCalcVariable(fullLine) {
  // Match calc(...var(--layout-scale...) or calc(...var(--text-scale...)
  return /calc\s*\(\s*[^)]*?\*\s*var\s*\(\s*--(layout-scale|text-scale)/.test(fullLine)
}

/**
 * Determine the scale variable to suggest for a property
 */
function getSuggestedVariable(property) {
  const textProperties = [
    'font-size',
    'line-height',
    'letter-spacing',
    'text-shadow',
    'text-decoration-thickness',
  ]

  if (textProperties.includes(property)) {
    return 'text-scale'
  }
  return 'layout-scale'
}

/**
 * Check if a line is a violation
 */
function isViolation(line, fullLine) {
  // Skip empty lines and comments
  if (!line.trim() || line.trim().startsWith('/*') || line.trim().startsWith('//')) {
    return false
  }

  // Skip lines inside calc() with variables
  if (isInsideCalcVariable(fullLine)) {
    return false
  }

  // Skip @keyframes blocks
  if (line.includes('@keyframes') || line.includes('@-webkit-keyframes')) {
    return false
  }

  // Match any px value in the line, but not inside calc() or other functions
  // More careful pattern: look for "property: <value with px>" where value is not inside parentheses
  const propertyMatches = fullLine.match(/([a-z-]+)\s*:\s*([^;]+);/gi)

  if (!propertyMatches) {
    return false
  }

  for (const propDecl of propertyMatches) {
    const colonIdx = propDecl.indexOf(':')
    const property = propDecl.substring(0, colonIdx).trim().toLowerCase()
    const valueStr = propDecl.substring(colonIdx + 1).trim()

    // Skip if value is inside calc with variables
    if (/calc\s*\([^)]*?\*\s*var\s*\(\s*--(layout-scale|text-scale)/.test(valueStr)) {
      continue
    }

    // Skip if property is a known exception
    const exceptions = [
      'border-radius',
      'border-width',
      'border',
      'border-left',
      'border-right',
      'border-top',
      'border-bottom',
      'outline-width',
      'text-underline-offset',
      'filter',
      'backdrop-filter',
      'box-shadow',
      'text-shadow',
    ]

    if (exceptions.some((e) => property.includes(e))) {
      continue
    }

    // Look for bare px values (not inside parentheses/calc)
    // Split by parentheses to check only top-level values
    const parts = valueStr.split(/[()]/g)
    const topLevelParts = [parts[0]]

    for (let i = 1; i < parts.length; i += 2) {
      if (i + 1 < parts.length) {
        topLevelParts.push(parts[i + 1])
      }
    }

    const topLevelValue = topLevelParts.join(' ')

    const pxMatches = topLevelValue.match(/(\d+)px/g)
    if (!pxMatches) {
      continue
    }

    for (const pxMatch of pxMatches) {
      const num = parseInt(pxMatch)

      // Skip 0 values
      if (num === 0) {
        continue
      }

      // Skip very small values (1px, 2px) for all properties
      // These are typically borders, hairlines, or minimal spacing
      if (num <= 2) {
        continue
      }

      // This is a violation
      return {
        property,
        value: pxMatch,
        variable: getSuggestedVariable(property),
      }
    }
  }

  return false
}

/**
 * Lint a single Svelte file
 */
function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const styleBlock = extractStyleBlock(content)

  if (!styleBlock) {
    return []
  }

  const violations = []
  const lines = styleBlock.content.split('\n')

  lines.forEach((line, index) => {
    const violation = isViolation(line, line)

    if (violation) {
      violations.push({
        line: styleBlock.startLine + index + 1,
        property: violation.property,
        value: violation.value,
        variable: violation.variable,
      })
    }
  })

  return violations
}

/**
 * Main function
 */
function main() {
  if (!fs.existsSync(componentsDir)) {
    console.error(`Components directory not found: ${componentsDir}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => path.join(componentsDir, f))

  if (files.length === 0) {
    console.log('No Svelte files found.')
    process.exit(0)
  }

  let totalViolations = 0
  const fileViolations = new Map()

  files.forEach((filePath) => {
    const violations = lintFile(filePath)

    if (violations.length > 0) {
      const fileName = path.relative(path.join(__dirname, '..'), filePath)
      fileViolations.set(fileName, violations)
      totalViolations += violations.length
    }
  })

  // Output violations
  if (totalViolations > 0) {
    fileViolations.forEach((violations, fileName) => {
      violations.forEach((v) => {
        console.log(
          `${fileName}:${v.line}  ${v.property}: ${v.value} (should use --${v.variable})`,
        )
      })
    })

    const filesWithViolations = fileViolations.size
    console.log(
      `\nFound ${totalViolations} violation${totalViolations !== 1 ? 's' : ''} in ${filesWithViolations} file${filesWithViolations !== 1 ? 's' : ''}.`,
    )
    process.exit(1)
  } else {
    console.log(`✓ All Svelte files are clean (scanned ${files.length} file${files.length !== 1 ? 's' : ''}).`)
    process.exit(0)
  }
}

main()
