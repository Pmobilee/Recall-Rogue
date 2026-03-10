/**
 * Admin Facts Dashboard — server-rendered HTML pages for fact content management.
 * Provides browse, edit, and bulk operations for the facts database.
 *
 * Routes:
 *   GET  /admin/facts           — Filterable, paginated fact listing
 *   GET  /admin/facts/:id/edit  — Edit form for a single fact
 *   POST /admin/facts/:id       — Save edited fact
 *   POST /admin/facts/bulk      — Bulk approve/reject/archive
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { factsDb } from "../db/facts-db.js";

// ── Row types ────────────────────────────────────────────────────────────────

interface FactRow {
  id: string;
  statement: string;
  category_l1: string;
  status: string;
  distractor_count: number;
  source_url: string | null;
  source_name: string | null;
  correct_answer: string;
  explanation: string;
  gaia_comments: string | null;
  age_rating: string;
  [key: string]: unknown;
}

interface CountRow {
  count: number;
}

// ── Sanitization helpers ─────────────────────────────────────────────────────

/**
 * HTML-escape a string to prevent XSS in server-rendered output.
 *
 * @param s - Raw string to escape.
 * @returns Escaped string safe for HTML embedding.
 */
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip all HTML tags from a string. Used to sanitize form inputs.
 *
 * @param s - Raw string potentially containing HTML.
 * @returns Plain text with all tags removed.
 */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

/**
 * Truncate a string to a max length, appending ellipsis if truncated.
 *
 * @param s - String to truncate.
 * @param max - Maximum character length.
 * @returns Truncated string.
 */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}

// ── Allowed enums ────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["draft", "approved", "archived"]);
const VALID_AGE_RATINGS = new Set(["child", "teen", "adult"]);

// ── Shared CSS ───────────────────────────────────────────────────────────────

const PAGE_CSS = `
  body {
    font-family: 'Courier New', monospace;
    background: #1a1a2e;
    color: #e0e0e0;
    margin: 0;
    padding: 2rem;
  }
  h1, h2 { color: #e94560; }
  a { color: #00d2ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1rem 0;
  }
  th, td {
    border: 1px solid #333;
    padding: 8px 12px;
    text-align: left;
    font-size: 0.85rem;
  }
  th { background: #16213e; color: #e94560; }
  tr:nth-child(even) { background: #16213e; }
  tr:hover { background: #1a1a3e; }
  .summary {
    display: flex;
    gap: 2rem;
    margin: 1rem 0;
    flex-wrap: wrap;
  }
  .summary-card {
    background: #16213e;
    padding: 1rem 2rem;
    border-radius: 8px;
    border: 1px solid #333;
  }
  .summary-card .count { font-size: 2rem; color: #e94560; font-weight: bold; }
  .summary-card .label { color: #888; font-size: 0.85rem; }
  form.filters {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
    align-items: center;
  }
  select, input[type="text"], input[type="url"] {
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #333;
    padding: 6px 10px;
    border-radius: 4px;
    font-family: inherit;
  }
  button, input[type="submit"] {
    background: #e94560;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-weight: bold;
  }
  button:hover, input[type="submit"]:hover { background: #c73550; }
  .pagination {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    align-items: center;
  }
  textarea {
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #333;
    padding: 8px;
    border-radius: 4px;
    font-family: inherit;
    width: 100%;
    min-height: 80px;
  }
  .form-group { margin-bottom: 1rem; }
  .form-group label { display: block; margin-bottom: 4px; color: #aaa; font-size: 0.85rem; }
  .bulk-bar {
    background: #16213e;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 8px;
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .tag-yes { color: #4caf50; }
  .tag-no { color: #f44336; }
  .status-approved { color: #4caf50; }
  .status-draft { color: #ff9800; }
  .status-archived { color: #888; }
`;

// ── Route registration ───────────────────────────────────────────────────────

/**
 * Register admin facts dashboard routes.
 * These routes serve server-rendered HTML for fact management.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function adminFactsRoutes(fastify: FastifyInstance): Promise<void> {
  // Register a content-type parser for URL-encoded form submissions.
  // Fastify only parses application/json by default; we need this for HTML forms.
  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body: string, done) => {
      const parsed: Record<string, string> = {};
      for (const pair of body.split("&")) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx < 0) continue;
        const key = decodeURIComponent(pair.slice(0, eqIdx).replace(/\+/g, " "));
        const value = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, " "));
        parsed[key] = value;
      }
      done(null, parsed);
    }
  );

  // ── GET /admin/facts — Fact listing page ─────────────────────────────────

  fastify.get(
    "/admin/facts",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const qs = request.query as Record<string, string>;
      const page = Math.max(1, parseInt(qs["page"] ?? "1", 10));
      const perPage = 50;
      const offset = (page - 1) * perPage;

      // Build filters
      const categoryFilter = qs["category"] ?? "";
      const rawStatus = qs["status"] ?? "";
      const statusFilter = VALID_STATUSES.has(rawStatus) ? rawStatus : "";
      const hasSourceFilter = qs["has_source"] ?? "";

      let whereClause = "WHERE 1=1";
      const params: (string | number)[] = [];

      if (statusFilter) {
        whereClause += " AND status = ?";
        params.push(statusFilter);
      }
      if (categoryFilter) {
        whereClause += " AND category_l1 = ?";
        params.push(categoryFilter);
      }
      if (hasSourceFilter === "no") {
        whereClause += " AND (source_url IS NULL OR source_url = '')";
      } else if (hasSourceFilter === "yes") {
        whereClause += " AND source_url IS NOT NULL AND source_url != ''";
      }

      // Count totals (unfiltered)
      const totalRow = factsDb
        .prepare("SELECT COUNT(*) as count FROM facts")
        .get() as CountRow;
      const approvedRow = factsDb
        .prepare("SELECT COUNT(*) as count FROM facts WHERE status = 'approved'")
        .get() as CountRow;
      const draftRow = factsDb
        .prepare("SELECT COUNT(*) as count FROM facts WHERE status = 'draft'")
        .get() as CountRow;
      const archivedRow = factsDb
        .prepare("SELECT COUNT(*) as count FROM facts WHERE status = 'archived'")
        .get() as CountRow;

      // Filtered count
      const filteredCountRow = factsDb
        .prepare(`SELECT COUNT(*) as count FROM facts ${whereClause}`)
        .get(...params) as CountRow;
      const filteredCount = filteredCountRow.count;
      const totalPages = Math.max(1, Math.ceil(filteredCount / perPage));

      // Fetch facts
      const facts = factsDb
        .prepare(
          `SELECT id, statement, category_l1, status, distractor_count, source_url
           FROM facts ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, perPage, offset) as FactRow[];

      // Get unique categories for filter dropdown
      const categories = factsDb
        .prepare(
          "SELECT DISTINCT category_l1 FROM facts WHERE category_l1 != '' ORDER BY category_l1"
        )
        .all() as Array<{ category_l1: string }>;

      // Build filter query string (preserving other params)
      function filterUrl(overrides: Record<string, string>): string {
        const p: Record<string, string> = {
          category: categoryFilter,
          status: statusFilter,
          has_source: hasSourceFilter,
          page: "1",
          ...overrides,
        };
        const parts = Object.entries(p)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
        return `/admin/facts${parts.length ? "?" + parts.join("&") : ""}`;
      }

      // Render rows
      const rows = facts
        .map(
          (f) => `
          <tr>
            <td><input type="checkbox" name="factIds" value="${esc(f.id)}" class="fact-checkbox" /></td>
            <td><code>${esc(f.id.slice(0, 12))}</code></td>
            <td>${esc(truncate(f.statement, 80))}</td>
            <td>${esc(f.category_l1)}</td>
            <td><span class="status-${esc(f.status)}">${esc(f.status)}</span></td>
            <td>${f.distractor_count}</td>
            <td>${f.source_url ? '<span class="tag-yes">Yes</span>' : '<span class="tag-no">No</span>'}</td>
            <td><a href="/admin/facts/${esc(f.id)}/edit">Edit</a></td>
          </tr>`
        )
        .join("");

      const categoryOptions = categories
        .map(
          (c) =>
            `<option value="${esc(c.category_l1)}"${categoryFilter === c.category_l1 ? " selected" : ""}>${esc(c.category_l1)}</option>`
        )
        .join("");

      // Pagination links
      const prevPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facts Dashboard — Recall Rogue Admin</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <h1>Facts Dashboard</h1>

  <div class="summary">
    <div class="summary-card"><div class="count">${totalRow.count}</div><div class="label">Total</div></div>
    <div class="summary-card"><div class="count">${approvedRow.count}</div><div class="label">Approved</div></div>
    <div class="summary-card"><div class="count">${draftRow.count}</div><div class="label">Draft</div></div>
    <div class="summary-card"><div class="count">${archivedRow.count}</div><div class="label">Archived</div></div>
  </div>

  <form class="filters" method="get" action="/admin/facts">
    <select name="category">
      <option value="">All Categories</option>
      ${categoryOptions}
    </select>
    <select name="status">
      <option value="">All Statuses</option>
      <option value="draft"${statusFilter === "draft" ? " selected" : ""}>Draft</option>
      <option value="approved"${statusFilter === "approved" ? " selected" : ""}>Approved</option>
      <option value="archived"${statusFilter === "archived" ? " selected" : ""}>Archived</option>
    </select>
    <select name="has_source">
      <option value="">Any Source</option>
      <option value="yes"${hasSourceFilter === "yes" ? " selected" : ""}>Has Source</option>
      <option value="no"${hasSourceFilter === "no" ? " selected" : ""}>No Source</option>
    </select>
    <button type="submit">Filter</button>
    <a href="/admin/facts">Reset</a>
  </form>

  <div class="bulk-bar">
    <span>Bulk:</span>
    <button type="button" onclick="bulkAction('approve')">Approve Selected</button>
    <button type="button" onclick="bulkAction('reject')">Reject Selected</button>
    <button type="button" onclick="bulkAction('archive')">Archive Selected</button>
    <label><input type="checkbox" id="select-all" /> Select All</label>
  </div>

  <p>Showing ${facts.length} of ${filteredCount} facts (page ${page}/${totalPages})</p>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>ID</th>
        <th>Statement</th>
        <th>Category</th>
        <th>Status</th>
        <th>Distractors</th>
        <th>Source</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8">No facts found</td></tr>'}
    </tbody>
  </table>

  <div class="pagination">
    ${prevPage ? `<a href="${filterUrl({ page: String(prevPage) })}">Previous</a>` : "<span>Previous</span>"}
    <span>Page ${page} of ${totalPages}</span>
    ${nextPage ? `<a href="${filterUrl({ page: String(nextPage) })}">Next</a>` : "<span>Next</span>"}
  </div>

  <script>
    document.getElementById('select-all').addEventListener('change', function() {
      var checked = this.checked;
      document.querySelectorAll('.fact-checkbox').forEach(function(cb) { cb.checked = checked; });
    });

    function bulkAction(action) {
      var ids = [];
      document.querySelectorAll('.fact-checkbox:checked').forEach(function(cb) { ids.push(cb.value); });
      if (ids.length === 0) { alert('No facts selected'); return; }
      if (ids.length > 100) { alert('Max 100 facts per bulk operation'); return; }
      if (!confirm('Are you sure you want to ' + action + ' ' + ids.length + ' facts?')) return;

      fetch('/admin/facts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, factIds: ids })
      }).then(function(r) { return r.json(); }).then(function(data) {
        alert(action + ': ' + data.updated + ' facts updated');
        window.location.reload();
      }).catch(function(err) { alert('Error: ' + err.message); });
    }
  </script>
</body>
</html>`;

      return reply.type("text/html").send(html);
    }
  );

  // ── GET /admin/facts/:id/edit — Edit form ────────────────────────────────

  fastify.get(
    "/admin/facts/:id/edit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const fact = factsDb
        .prepare("SELECT * FROM facts WHERE id = ?")
        .get(id) as FactRow | undefined;

      if (!fact) {
        return reply.status(404).type("text/html").send(`
          <!DOCTYPE html><html><head><title>Not Found</title><style>${PAGE_CSS}</style></head>
          <body><h1>Fact Not Found</h1><a href="/admin/facts">Back to list</a></body></html>
        `);
      }

      function selectedIf(val: string, current: string): string {
        return val === current ? " selected" : "";
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Fact ${esc(id.slice(0, 12))} — Recall Rogue Admin</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <h1>Edit Fact</h1>
  <p><a href="/admin/facts">Back to list</a> | ID: <code>${esc(id)}</code></p>

  <form method="post" action="/admin/facts/${esc(id)}">
    <div class="form-group">
      <label for="statement">Statement (max 500 chars)</label>
      <textarea id="statement" name="statement" maxlength="500">${esc(fact.statement)}</textarea>
    </div>

    <div class="form-group">
      <label for="correctAnswer">Correct Answer</label>
      <input type="text" id="correctAnswer" name="correctAnswer" value="${esc(fact.correct_answer)}" style="width:100%" />
    </div>

    <div class="form-group">
      <label for="explanation">Explanation</label>
      <textarea id="explanation" name="explanation">${esc(fact.explanation)}</textarea>
    </div>

    <div class="form-group">
      <label for="gaiaComment">GAIA Comments (JSON)</label>
      <textarea id="gaiaComment" name="gaiaComment">${esc(fact.gaia_comments ?? "")}</textarea>
    </div>

    <div class="form-group">
      <label for="sourceUrl">Source URL</label>
      <input type="url" id="sourceUrl" name="sourceUrl" value="${esc(fact.source_url ?? "")}" style="width:100%" />
    </div>

    <div class="form-group">
      <label for="sourceName">Source Name</label>
      <input type="text" id="sourceName" name="sourceName" value="${esc(fact.source_name ?? "")}" style="width:100%" />
    </div>

    <div class="form-group">
      <label for="ageRating">Age Rating</label>
      <select id="ageRating" name="ageRating">
        <option value="child"${selectedIf("child", fact.age_rating)}>Child</option>
        <option value="teen"${selectedIf("teen", fact.age_rating)}>Teen</option>
        <option value="adult"${selectedIf("adult", fact.age_rating)}>Adult</option>
      </select>
    </div>

    <div class="form-group">
      <label for="status">Status</label>
      <select id="status" name="status">
        <option value="draft"${selectedIf("draft", fact.status)}>Draft</option>
        <option value="approved"${selectedIf("approved", fact.status)}>Approved</option>
        <option value="archived"${selectedIf("archived", fact.status)}>Archived</option>
      </select>
    </div>

    <button type="submit">Save Changes</button>
  </form>
</body>
</html>`;

      return reply.type("text/html").send(html);
    }
  );

  // ── POST /admin/facts/:id — Handle edit form submission ──────────────────

  fastify.post(
    "/admin/facts/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const existing = factsDb
        .prepare("SELECT id FROM facts WHERE id = ?")
        .get(id) as { id: string } | undefined;

      if (!existing) {
        return reply.status(404).send({ error: "Fact not found" });
      }

      const body = request.body as Record<string, string> | null;
      if (!body) {
        return reply.status(400).send({ error: "Missing form body" });
      }

      // Sanitize inputs
      const statement = stripHtml(body["statement"] ?? "").slice(0, 500);
      const correctAnswer = stripHtml(body["correctAnswer"] ?? "").slice(0, 500);
      const explanation = stripHtml(body["explanation"] ?? "").slice(0, 2000);
      const gaiaComment = stripHtml(body["gaiaComment"] ?? "").slice(0, 2000);
      const sourceUrl = stripHtml(body["sourceUrl"] ?? "").slice(0, 2000);
      const sourceName = stripHtml(body["sourceName"] ?? "").slice(0, 500);
      const ageRating = VALID_AGE_RATINGS.has(body["ageRating"] ?? "")
        ? body["ageRating"]
        : "teen";
      const status = VALID_STATUSES.has(body["status"] ?? "")
        ? body["status"]
        : "draft";

      // Validate
      if (!statement) {
        return reply.status(400).type("text/html").send(
          `<!DOCTYPE html><html><head><style>${PAGE_CSS}</style></head><body>
          <h1>Error</h1><p>Statement is required.</p>
          <a href="/admin/facts/${esc(id)}/edit">Go back</a></body></html>`
        );
      }

      // Validate sourceUrl format if provided
      if (sourceUrl) {
        try {
          new URL(sourceUrl);
        } catch {
          return reply.status(400).type("text/html").send(
            `<!DOCTYPE html><html><head><style>${PAGE_CSS}</style></head><body>
            <h1>Error</h1><p>Invalid source URL format.</p>
            <a href="/admin/facts/${esc(id)}/edit">Go back</a></body></html>`
          );
        }
      }

      factsDb
        .prepare(
          `UPDATE facts SET
            statement = ?,
            correct_answer = ?,
            explanation = ?,
            gaia_comments = ?,
            source_url = ?,
            source_name = ?,
            age_rating = ?,
            status = ?,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          statement,
          correctAnswer,
          explanation,
          gaiaComment || null,
          sourceUrl || null,
          sourceName || null,
          ageRating,
          status,
          Date.now(),
          id
        );

      // Redirect back to edit page with success
      return reply.redirect(`/admin/facts/${id}/edit`);
    }
  );

  // ── POST /admin/facts/bulk — Bulk operations ────────────────────────────

  fastify.post(
    "/admin/facts/bulk",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        action?: string;
        factIds?: string[];
      } | null;

      if (!body) {
        return reply.status(400).send({ error: "Missing request body" });
      }

      const { action, factIds } = body;

      // Validate action
      if (!action || !["approve", "reject", "archive"].includes(action)) {
        return reply
          .status(400)
          .send({ error: "Invalid action. Must be approve, reject, or archive." });
      }

      // Validate factIds
      if (!Array.isArray(factIds) || factIds.length === 0) {
        return reply.status(400).send({ error: "factIds must be a non-empty array" });
      }

      if (factIds.length > 100) {
        return reply
          .status(400)
          .send({ error: "Maximum 100 fact IDs per bulk operation" });
      }

      // Map action to status
      const statusMap: Record<string, string> = {
        approve: "approved",
        reject: "draft",
        archive: "archived",
      };
      const newStatus = statusMap[action];

      const now = Date.now();
      const placeholders = factIds.map(() => "?").join(", ");

      const result = factsDb
        .prepare(
          `UPDATE facts SET status = ?, updated_at = ? WHERE id IN (${placeholders})`
        )
        .run(newStatus, now, ...factIds);

      return reply.send({
        action,
        updated: result.changes,
        requestedIds: factIds.length,
      });
    }
  );
}
