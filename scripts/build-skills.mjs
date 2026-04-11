#!/usr/bin/env node
// build-skills.mjs — expand {{include: path[#heading]}} macros in
// .claude/skills/*/SKILL.md.template files into concrete SKILL.md files.
//
// Usage:
//   node scripts/build-skills.mjs          # build all templates
//   node scripts/build-skills.mjs --check  # verify SKILL.md matches template expansion (diff mode)
//
// Exit codes:
//   0  — all templates expanded successfully, or check mode reports no drift
//   1  — check mode found drift (stdout shows the diff)
//   2  — expansion error (missing include target, malformed template)
//
// See docs/roadmap/active/autonomy-overhaul-followups.md Item 4.
// Rule: .claude/rules/agent-mindset.md → "Two-sided enforcement".
//
// The canonical sources referenced by templates live in .claude/rules/*.md
// and can be anchored by heading via the `#heading-slug` suffix. The slug
// is a lowercased dash-separated version of the heading text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const AUTO_GEN_BANNER = `<!-- AUTO-GENERATED from SKILL.md.template — edit the template, not this file.
     Run \`node scripts/build-skills.mjs\` to regenerate.
     Drift is detected by \`node scripts/lint/check-skill-drift.mjs\` (pre-commit). -->`;

const INCLUDE_RE = /\{\{include:\s*([^#}\s]+)(?:#([^}]+))?\s*\}\}/g;

/**
 * Slugify a heading the same way our templates expect.
 * "## The Clarification Bar" → "the-clarification-bar"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Read a source file and, if `heading` is provided, return just the section
 * from that heading up to the next same-level-or-higher heading. Returns the
 * whole file if heading is empty.
 */
function extractSection(absPath, heading) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`include target not found: ${absPath}`);
  }
  const content = fs.readFileSync(absPath, 'utf8');
  if (!heading) {
    // Strip frontmatter if present so template output doesn't accidentally
    // inherit a second frontmatter block.
    return stripFrontmatter(content).trim();
  }
  const targetSlug = slugify(heading);
  const lines = stripFrontmatter(content).split('\n');
  let startIdx = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    if (slugify(m[2]) === targetSlug) {
      startIdx = i;
      startLevel = m[1].length;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error(`heading "${heading}" (slug "${targetSlug}") not found in ${absPath}`);
  }
  // Walk forward until we hit a heading of the same level or shallower.
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= startLevel) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n').trim();
}

function stripFrontmatter(content) {
  if (!content.startsWith('---\n')) return content;
  const closeIdx = content.indexOf('\n---\n', 4);
  if (closeIdx === -1) return content;
  return content.slice(closeIdx + 5);
}

/**
 * Expand a template string by replacing every {{include: ...}} macro.
 *
 * **Markdown-aware.** The regex is ONLY applied to plain text. Matches
 * inside fenced code blocks (``` or ~~~) and inline backtick spans
 * (`...` or ``...``) are left untouched so authors can document the
 * macro syntax itself without triggering expansion.
 *
 * Include paths are resolved from REPO_ROOT.
 */
function expandTemplate(templateString, templateAbsPath) {
  const expandOne = (match, rawPath, heading) => {
    const relPath = rawPath.trim();
    const targetAbs = path.resolve(REPO_ROOT, relPath);
    if (!targetAbs.startsWith(REPO_ROOT)) {
      throw new Error(`include path must stay within the repo: ${relPath}`);
    }
    try {
      return extractSection(targetAbs, heading ? heading.trim() : null);
    } catch (err) {
      throw new Error(`${templateAbsPath}: ${err.message}`);
    }
  };

  // Walk line by line, tracking fenced-code-block state. Inside a fence,
  // pass lines through verbatim. Outside a fence, further split each line
  // by inline backtick spans and only expand the non-backtick runs.
  const lines = templateString.split('\n');
  const out = [];
  let inFence = false;
  let fenceMarker = null;
  for (const line of lines) {
    // Fence open/close detection. A fence line starts with at least 3
    // backticks or tildes at the beginning of the line (with optional
    // leading whitespace for nested fences — rare in SKILL.md, but cheap).
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0]; // "`" or "~"
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Not in a fence. Split the line on inline backtick spans. We match
    // backtick spans of 1 or 2 backticks (covers the common case); odd-
    // indexed segments in the result are "inside backticks", even-indexed
    // are plain text. Include-macro expansion runs only on plain text.
    const segments = line.split(/(``[^`]*``|`[^`]*`)/);
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 1) continue; // backtick-wrapped → leave alone
      segments[i] = segments[i].replace(INCLUDE_RE, expandOne);
    }
    out.push(segments.join(''));
  }
  return out.join('\n');
}

function buildOne(templatePath) {
  const raw = fs.readFileSync(templatePath, 'utf8');
  const expanded = expandTemplate(raw, templatePath);
  // Splice the banner in after the frontmatter (if any), otherwise at the top.
  let output;
  if (expanded.startsWith('---\n')) {
    const closeIdx = expanded.indexOf('\n---\n', 4);
    if (closeIdx !== -1) {
      output = expanded.slice(0, closeIdx + 5) + '\n' + AUTO_GEN_BANNER + '\n' + expanded.slice(closeIdx + 5);
    } else {
      output = AUTO_GEN_BANNER + '\n\n' + expanded;
    }
  } else {
    output = AUTO_GEN_BANNER + '\n\n' + expanded;
  }
  // Normalize trailing newline.
  if (!output.endsWith('\n')) output += '\n';
  return output;
}

function findTemplates() {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  const templates = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tpl = path.join(skillsDir, entry.name, 'SKILL.md.template');
    if (fs.existsSync(tpl)) {
      templates.push(tpl);
    }
  }
  return templates;
}

function outputPath(templatePath) {
  return templatePath.replace(/\.template$/, '');
}

function main() {
  const checkMode = process.argv.includes('--check');
  const verbose = process.argv.includes('--verbose');
  const templates = findTemplates();
  if (templates.length === 0) {
    if (verbose) console.log('[build-skills] no SKILL.md.template files found — nothing to do');
    process.exit(0);
  }
  let hadError = false;
  let hadDrift = false;
  for (const tpl of templates) {
    const out = outputPath(tpl);
    let expanded;
    try {
      expanded = buildOne(tpl);
    } catch (err) {
      console.error(`[build-skills] ERROR expanding ${path.relative(REPO_ROOT, tpl)}:`);
      console.error(`  ${err.message}`);
      hadError = true;
      continue;
    }
    if (checkMode) {
      const existing = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      if (existing !== expanded) {
        hadDrift = true;
        console.log(`[build-skills] DRIFT in ${path.relative(REPO_ROOT, out)}:`);
        const expectedLines = expanded.split('\n');
        const actualLines = existing.split('\n');
        const maxLines = Math.max(expectedLines.length, actualLines.length);
        let shown = 0;
        for (let i = 0; i < maxLines && shown < 20; i++) {
          if (expectedLines[i] !== actualLines[i]) {
            console.log(`  line ${i + 1}:`);
            console.log(`    expected: ${JSON.stringify(expectedLines[i] ?? '<EOF>')}`);
            console.log(`    actual:   ${JSON.stringify(actualLines[i] ?? '<EOF>')}`);
            shown++;
          }
        }
        if (shown >= 20) console.log('  [... more differences truncated ...]');
      } else if (verbose) {
        console.log(`[build-skills] OK ${path.relative(REPO_ROOT, out)}`);
      }
    } else {
      fs.writeFileSync(out, expanded, 'utf8');
      if (verbose) console.log(`[build-skills] wrote ${path.relative(REPO_ROOT, out)} (${expanded.length} bytes)`);
    }
  }
  if (hadError) process.exit(2);
  if (checkMode && hadDrift) process.exit(1);
  if (!checkMode) {
    console.log(`[build-skills] expanded ${templates.length} template(s) successfully`);
  } else if (verbose) {
    console.log(`[build-skills] check mode: no drift across ${templates.length} template(s)`);
  }
  process.exit(0);
}

main();
