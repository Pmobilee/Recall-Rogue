# Visual Audit Findings — 1920x1080 Landscape Desktop
**Auditor role:** Senior UX Designer
**Context:** Dark RPG card roguelite — Recall Rogue
**Date:** 2026-03-22
**Scope:** All landscape-mode screens derived from DOM measurements, CSS source analysis, and component review

Issues are sorted by severity (Critical → Major → Minor → Polish) within each section. All issue IDs are globally unique for cross-referencing.

---

## CRITICAL ISSUES

### F-01 — Background Gradient Not Applied to Screen Content
**Category:** Background / Atmosphere
**Severity:** Critical
**Screens:** ALL non-hub screens in landscape

**Current state:** The `.card-app` element has `background: #0d1117` (flat near-black). The atmospheric gradient rule in `CardApp.svelte` is:
```css
[data-layout="landscape"] .card-app {
  background: radial-gradient(ellipse at center, #151020 0%, #0d0b15 60%, #050408 100%) !important;
}
```
This is a **descendant selector** written inside a `<style>` block in `CardApp.svelte`. Svelte scopes all styles to the component via a generated attribute selector (e.g., `.card-app.svelte-xxxx`). A rule written as `[data-layout="landscape"] .card-app` inside a scoped `<style>` block is transformed to something like `[data-layout="landscape"] .card-app.svelte-xxxx` — which correctly matches the element. However, every non-hub screen component renders as `position: fixed; inset: 0` and places its own `background` on its own root element, painting on top of `.card-app`. So the gradient is technically applied to `.card-app` but is entirely invisible because every screen's overlay covers it completely.

**Expected state:** All non-hub screens should show the `radial-gradient(ellipse at center, #151020, #0d0b15, #050408)` as their background, giving the dark RPG dungeon atmosphere.

**Root cause:** Each screen component (KnowledgeLibrary, SettingsPanel, ProfileScreen, JournalScreen, etc.) independently declares its own `background` on their fixed root div. The gradient on `.card-app` is permanently occluded. Svelte `:global()` selectors in each component's style block would be needed to override those local backgrounds.

**Fix approach:**
Option A (preferred): Add `:global([data-layout="landscape"]) .library-overlay`, `:global([data-layout="landscape"]) .settings-overlay`, etc. in each screen to replace `background: linear-gradient(...)` with `background: transparent` — letting `.card-app`'s gradient show through. Requires each overlay to not paint its own bg in landscape.
Option B: In each screen component's landscape override block, explicitly set `background: radial-gradient(ellipse at center, #151020 0%, #0d0b15 60%, #050408 100%)` directly on the overlay root.
The existing `:global([data-layout="landscape"]) .library-overlay` rule in `KnowledgeLibrary.svelte` does NOT override `background` — it only sets margin/padding. The base `.library-overlay` rule sets `background: linear-gradient(180deg, #081225 0%, #121f33 100%)` which wins.

---

### F-02 — h2 Typography Override Failing Due to Local Component Overrides
**Category:** Font / Typography
**Severity:** Critical
**Screens:** Library, Profile, Settings, Journal, Leaderboards, Social

**Current state:** `CardApp.svelte` defines:
```css
[data-layout="landscape"] h2 {
  font-size: 32px;
  font-family: 'Cinzel', 'Georgia', serif;
}
```
This is a global override. However, every screen component independently styles its `h2` inside a scoped `<style>` block:
- `KnowledgeLibrary.svelte`: `h2 { font-size: calc(20px * var(--text-scale, 1)); }` — with landscape override adding `:global([data-layout="landscape"]) .library-overlay .library-topbar h2 { font-size: 22px; font-family: 'Cinzel', serif; }`
- `SettingsPanel.svelte`: `h2 { font-size: calc(20px * var(--text-scale, 1)); }` (no landscape font-size override)
- `ProfileScreen.svelte`: `.header h2 { font-size: calc(22px * var(--text-scale, 1)); }` (no landscape override)

The `CardApp.svelte` rule `[data-layout="landscape"] h2` is written inside a Svelte `<style>` block and gets scoped to `.card-app`. In the rendered DOM, `.card-app` does not contain h2 elements directly — the h2 elements live inside child component shadow trees with their own Svelte scope attributes. Because the child component's scoped `h2` rule carries a higher specificity (scoped class attribute), it wins over CardApp's descendant selector.

**Expected state:** ALL landscape h2 elements should be 32px Cinzel.
**Actual state:** Library h2 is 22px Cinzel (local override), Profile h2 is 22px (no override at all), Settings h2 is ~20px.

**Root cause:** Svelte style scoping isolates component styles. The CardApp `[data-layout="landscape"] h2` rule only affects h2 elements that are direct children of CardApp's own template — not children of imported components.

**Fix approach:** In each screen component's landscape desktop overrides block, explicitly add `:global([data-layout="landscape"]) .screen-root h2 { font-size: 32px; font-family: 'Cinzel', serif; }`. The Library already does this at 22px — it needs changing to 32px per spec. All other screens need the same treatment.

---

### F-03 — Sidebar Label Font Unreadable at 11px Press Start 2P
**Category:** Font / Readability
**Severity:** Critical
**Screens:** ALL screens with sidebar visible

**Current state:** `HubNavBar.svelte` `.sidebar-label` is `font-size: 11px` using the global `button` rule `font-family: var(--font-pixel)` which resolves to `'Press Start 2P', 'Courier New', monospace`. Press Start 2P is a bitmap pixel font — it has no sub-pixel hinting, no kerning, and renders as blocky pixel blocks at any size. At 11px on a 1920x1080 display rendered at ~100 DPI (standard LCD), "Library", "Settings", "Leaderboards" are essentially unreadable at arm's length. "Leaderboards" is truncated to "Boards" to fit, but even "Boards" is challenging.

The `.sidebar-btn` itself is also `font-size: calc(10px * var(--text-scale, 1))` for button base text.

**Expected state:** Sidebar labels should be legible at desktop viewing distance. Minimum 13px, preferably 14px in a legible font (system UI sans-serif or Cinzel).

**Root cause:** The global `button` rule in `app.css` sets `font-family: var(--font-pixel); font-size: 10px`. This cascades to all buttons including sidebar navigation. Press Start 2P at 11px is only readable at mobile screen-to-eye distances (25–30cm), not desktop distances (60–80cm).

**Fix approach:**
In `HubNavBar.svelte`, override the font for landscape sidebar:
```css
.nav-sidebar .sidebar-label {
  font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  font-size: 13px;
  letter-spacing: 0.02em;
}
```
Or use Cinzel for a thematic label. Either way, remove the pixel font from sidebar navigation labels entirely.

---

### F-04 — Global Button Font-Size 10px Applied to All Buttons
**Category:** Font / Readability
**Severity:** Critical
**Screens:** ALL screens

**Current state:** `app.css` defines:
```css
button {
  font-family: var(--font-pixel);
  font-size: 10px;
  line-height: 1.4;
}
```
`var(--font-pixel)` = `'Press Start 2P', 'Courier New', monospace`. This means every button on every screen — including critical navigation buttons, tab buttons, filter dropdowns, and action CTAs — renders at 10px Press Start 2P unless explicitly overridden. At 1920x1080 landscape, 10px text is below the WCAG AA minimum of 18px for normal weight or 14px for bold, and is objectively unreadable without leaning in.

**Expected state:** Buttons in landscape mode should use a minimum 14px readable font. Critical action buttons (Start Run, Resume, etc.) should be 16px+.

**Root cause:** The 10px Press Start 2P rule was designed for the 390px-wide mobile portrait layout where the pixel font creates a deliberate retro aesthetic. At desktop resolution it becomes illegible.

**Fix approach:** Add to `CardApp.svelte` landscape overrides:
```css
[data-layout="landscape"] button {
  font-size: 14px;
  font-family: system-ui, 'Segoe UI', Arial, sans-serif;
}
```
Pixel font can remain for specific thematic elements (card titles, combat HUD, boss names) but general UI buttons should switch to a readable sans-serif at desktop.

---

### F-05 — Press Start 2P Throughout Tab Buttons at Desktop Scale
**Category:** Font / Aesthetics
**Severity:** Critical
**Screens:** Library (tab buttons), Subcategory chips, Filter dropdowns

**Current state:** Library tab buttons (Knowledge, Deck Builder) use `font-size: calc(14px * var(--layout-scale, 1))` from the scoped `.tab-btn` rule. The landscape override in KnowledgeLibrary.svelte correctly changes these to `font-size: 16px; font-family: 'Cinzel', serif` — so Library tabs are correctly handled. **However** subcategory filter chips use:
```css
.sub-chip { font-size: calc(11px * var(--layout-scale, 1)); }
```
with no landscape font override and no font-family override, meaning they inherit `var(--font-pixel)` from `app.css`. At 11px, these chips displaying subcategory names are unreadable.

Similarly, `<select>` elements (Tier / Sort filters) have no font override and will render with the browser's default UI font — mismatching the overall Cinzel/pixel-font aesthetic. This creates a three-way font mismatch on the filters bar alone: Cinzel tabs, Press Start 2P chips, browser default selects.

**Expected state:** All filter/navigation chips in landscape should be system UI sans-serif at 13px minimum.

**Fix approach:** In KnowledgeLibrary.svelte landscape overrides:
```css
:global([data-layout="landscape"]) .library-overlay .sub-chip {
  font-family: system-ui, Arial, sans-serif;
  font-size: 13px;
}
:global([data-layout="landscape"]) .library-overlay select {
  font-family: system-ui, Arial, sans-serif;
  font-size: 14px;
}
```

---

## MAJOR ISSUES

### F-06 — Cinzel Font Not Loaded — No @import or <link> in index.html
**Category:** Font / Loading
**Severity:** Major
**Screens:** ALL screens where Cinzel is specified

**Current state:** `CardApp.svelte` and `KnowledgeLibrary.svelte` specify `font-family: 'Cinzel', 'Georgia', serif`. However, there is no `@import url('https://fonts.googleapis.com/...')` or `<link>` tag in `index.html` loading the Cinzel font, and no `@font-face` declaration with a self-hosted Cinzel WOFF2 file (only Press Start 2P has a `@font-face` in `overlay.css`). Cinzel is not a system font on any operating system.

**Expected state:** Cinzel should load reliably. Without it, all Cinzel-specified elements fall back to `'Georgia', serif` which has a completely different visual character — much less elegant, more book-like.

**Root cause:** Font was specified in CSS without being imported. The overlay.css self-hosts Press Start 2P but Cinzel was never added.

**Fix approach:**
Option A: Add to `index.html` head: `<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">` — but this breaks offline Capacitor builds.
Option B (preferred): Download Cinzel WOFF2 to `src/assets/fonts/` and add a `@font-face` block to `overlay.css` alongside the Press Start 2P declaration.

---

### F-07 — Settings Sidebar Not Offset from Global Sidebar — Double Sidebar Collision
**Category:** Layout
**Severity:** Major
**Screens:** Settings

**Current state:** `SettingsPanel.svelte` landscape layout is `settings-card-landscape` which is a `grid-template-columns: 200px 1fr` two-column layout — a "secondary sidebar" of 200px for Audio/Accessibility/Notifications/Account categories. The global `HubNavBar` sidebar is 100px wide and is `position: fixed; left: 0`. The settings overlay uses `:global([data-layout="landscape"]) .settings-overlay { margin-left: 100px; }` to offset from the global sidebar. This means the visible content area starts at x:100px, which is correct. However, the `settings-card-landscape` fills 100% of the offset area, putting the 200px internal sidebar flush against the 100px global sidebar — creating 300px of navigation chrome on the left before any actual settings content appears.

At 1920x1080 with 300px of left nav, the content area is 1620px — but `settings-panel-content .settings-section { max-width: 800px }` then constrains content to 800px centered within that, leaving ~820px empty. The content is not centered within the viewport — it's left-aligned in the remaining space after the sidebar.

**Expected state per AR-128:** The Settings internal sidebar should be replaced with horizontal category tabs at the top (as AR-128 specifies: "Remove internal sidebar — category tabs become horizontal tabs at top"). AR-128 sub-step 3 was defined but NOT implemented in the current SettingsPanel.svelte — the internal sidebar still exists.

**Root cause:** AR-128 step 3 (Settings horizontal tab redesign) was not yet implemented.

**Fix approach:** Implement AR-128 step 3: replace `.settings-sidebar` with a horizontal pill-tab row, remove the `grid-template-columns: 200px 1fr` two-column layout, center content at `max-width: 800px`.

---

### F-08 — Mastery Strip & Lore Section Occupy Vertical Space Before Domain Grid
**Category:** Layout / Spacing
**Severity:** Major
**Screens:** Library

**Current state:** The library summary view renders in this order:
1. `.mastery-strip` ("Mastered Facts: N") — padded card element
2. `.lore-unlock` (conditional — new lore unlocked notification)
3. `.lore-grid` (conditional — lore cards, 3-column)
4. `.domain-grid` (the main content)

For a new user with 0 lore unlocked, items 2 and 3 are hidden, so the gap between tabs and domain grid is only `margin-top: 24px` from the landscape override plus the mastery strip height (~44px). That is an acceptable ~68px gap.

However, for users with even 1 lore fragment, the lore grid renders above the domain grid, burying the domain grid further down. The lore grid is not visually prominent enough to justify its position above the primary content (domains). On a first visit, the domain grid is what users came for — lore is secondary.

The current layout gives equal visual weight to lore and domains, and the order (lore first) is wrong for the information hierarchy.

**Expected state:** Domain grid should be the primary content, rendered first. Lore section should be a secondary panel, either below domains, in a sidebar, or as a collapsible "Lore Unlocked" banner.

**Fix approach:** Reorder the summary-section markup: domain-grid first, mastery-strip + lore as a secondary section beneath. In landscape, consider a two-column layout: domain grid on the left (primary, 3/4 width), lore + mastery on the right (secondary, 1/4 width).

---

### F-09 — Domain Card Text Still Uses Press Start 2P at Desktop
**Category:** Font / Readability
**Severity:** Major
**Screens:** Library

**Current state:** `.domain-row`, `.domain-meta`, `.progress-fill` labels all inherit from the global `button` rule (since `.domain-card` is a `<button>` element) which sets `font-family: var(--font-pixel)`. The landscape overrides in KnowledgeLibrary correctly set:
- `.domain-row strong { font-size: 16px }`
- `.domain-row span { font-size: 14px }`
- `.domain-meta { font-size: 13px }`

But NO override changes the font-family. Press Start 2P at 16px is displayable but still renders as large blocky pixel glyphs — not in keeping with the Cinzel headings above the grid, creating a jarring switch from elegant serif headers to 8-bit pixel labels inside the cards.

**Expected state:** Domain card content should use system UI sans-serif or a legible body font at desktop. The domain name could optionally use Cinzel for a thematic touch.

**Fix approach:**
```css
:global([data-layout="landscape"]) .library-overlay .domain-card {
  font-family: system-ui, -apple-system, Arial, sans-serif;
}
:global([data-layout="landscape"]) .library-overlay .domain-row strong {
  font-family: 'Cinzel', 'Georgia', serif;
}
```

---

### F-10 — Settings Panel Has No Landscape Back Button Suppression for h2
**Category:** Font / Layout
**Severity:** Major
**Screens:** Settings

**Current state:** SettingsPanel.svelte `.settings-sidebar-header` contains both the `<h2>Settings</h2>` and the Back button. The landscape override correctly hides the Back button: `:global([data-layout="landscape"]) .back-btn { display: none }`. However, the `<h2>` in the landscape layout uses `h2 { font-size: calc(20px * var(--text-scale, 1)); }` from the scoped style. No landscape font-size override is applied to this h2 specifically. With `--text-scale` = 1, this renders at 20px in the scoped Svelte style, which outweighs the CardApp `[data-layout="landscape"] h2 { font-size: 32px }` rule due to Svelte scoping specificity.

The Settings heading reads 20px in the internal sidebar instead of 32px as the global spec requires.

**Fix approach:** Add to SettingsPanel landscape overrides:
```css
:global([data-layout="landscape"]) .settings-sidebar-header h2 {
  font-size: 32px;
  font-family: 'Cinzel', serif;
}
```

---

### F-11 — No Scrollbar Styling — Browser Default Scrollbars on Dark UI
**Category:** Visual Polish / Scrollbars
**Severity:** Major
**Screens:** Library (summary-section, domain-section), Settings (settings-panel-content), Profile (landscape-left, landscape-right)

**Current state:** Multiple containers have `overflow-y: auto` in landscape:
- Library: `.summary-section`, `.domain-section` — `max-height: calc(100vh - 140px)`
- Settings: `.settings-panel-content` — `overflow-y: auto`
- Profile: `.landscape-left`, `.landscape-right` — `overflow-y: auto`

These containers will render with the browser's default scrollbar: a pale-gray track with a light-gray thumb. On a nearly black `#081225` background, this scrollbar looks like a visual intrusion — bright, unstyled, clearly default browser chrome. It breaks the dark RPG aesthetic completely.

**Expected state:** Scrollbars should use `::-webkit-scrollbar` styling (thin, dark track, subtle semi-transparent thumb) OR `scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.3) transparent` (Firefox/modern Chromium).

**Fix approach:** Add to `desktop.css` or a shared landscape style:
```css
@media (min-width: 1200px) {
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.25); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }
  * { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.25) transparent; }
}
```

---

### F-12 — Profile Screen h2 Has No Landscape Font Override
**Category:** Font / Typography
**Severity:** Major
**Screens:** Profile

**Current state:** `ProfileScreen.svelte` `.header h2` is styled at `font-size: calc(22px * var(--text-scale, 1))` in the scoped style block. The landscape desktop overrides block only sets `margin-left`, `max-width`, and `padding` on the root element — there is no font-size/font-family override for the h2. The CardApp global `[data-layout="landscape"] h2 { font-size: 32px; font-family: 'Cinzel' }` does not pierce Svelte scoping.

Result: Profile h2 "Profile" renders at 22px in whatever font is inherited (likely Courier New from the body rule), not 32px Cinzel.

**Fix approach:** Add to ProfileScreen.svelte landscape overrides:
```css
:global([data-layout="landscape"]) .profile-screen h2 {
  font-size: 32px;
  font-family: 'Cinzel', serif;
}
```

---

### F-13 — Profile Stat Labels Inherit Pixel Font — 11px Unreadable
**Category:** Font / Readability
**Severity:** Major
**Screens:** Profile

**Current state:** `.stat span { font-size: calc(11px * var(--text-scale, 1)); color: #93c5fd }`. The stat labels ("Facts Learned", "Mastered Facts", "Runs Completed", "Best Floor", "Best Streak", "Milestones") inherit `font-family: var(--font-pixel)` = Press Start 2P from the global button rule (since `.stat` elements may be inside the flow but are `div` not `button` — however they also do not have an explicit font-family, so they inherit from `.profile-screen` which inherits from `body { font-family: 'Courier New', monospace }`).

At `--text-scale: 1`, stat labels are 11px Courier New. Courier New at 11px is readable but very small for desktop. The landscape override adds `font-size: 13px` which is barely adequate. No font-family override is present.

**Expected state:** Stat labels at 14px system-sans or Cinzel.

**Fix approach:**
```css
:global([data-layout="landscape"]) .stat span {
  font-size: 14px;
  font-family: system-ui, Arial, sans-serif;
}
```

---

### F-14 — Settings Category Buttons Use Press Start 2P via Button Rule
**Category:** Font / Readability
**Severity:** Major
**Screens:** Settings

**Current state:** `.category-btn { font-size: calc(13px * var(--text-scale, 1)); }` in the scoped style. The global `button` rule in `app.css` sets `font-family: var(--font-pixel)`. SettingsPanel.svelte does not override `font-family` on `.category-btn`. The landscape override only adds `font-size: 13px` (same size, no effect). So category nav buttons (Audio, Accessibility, Notifications, Account) render in Press Start 2P 13px.

At 13px, Press Start 2P is just barely legible but looks very retro/8-bit — inconsistent with the overall dark RPG aesthetic of the settings panel.

**Fix approach:** Override font-family on category buttons:
```css
.category-btn {
  font-family: system-ui, -apple-system, Arial, sans-serif;
}
```

---

### F-15 — Library Tabs Maxed at 520px in Portrait — Landscape Tab Max-Width Override Incomplete
**Category:** Layout
**Severity:** Major
**Screens:** Library

**Current state:** The base `.library-tabs` style sets `max-width: calc(520px * var(--layout-scale, 1))`. The landscape override (inside `.library-overlay.landscape`) sets `max-width: none` on `.library-overlay.landscape .library-tabs`. HOWEVER, there is ALSO a `:global([data-layout="landscape"])` override that sets `max-width: none; margin-bottom: 0; flex: none` — this one should win.

The issue is subtler: `.tab-btn` in the landscape override uses `flex: none; padding: 10px 24px` — removing the `flex: 1` from portrait. This means the tab buttons only expand to fit their text content and do NOT fill the full width of the tab bar. At 1920px wide, with a `margin-left: 100px` and `padding: 32px 48px`, the content is ~1620px wide but the tab buttons are narrow pill-shapes huddled at the left. The rest of the tab bar is an empty border-bottom line extending to the right.

**Expected state:** Tabs should extend to a reasonable width — either fill the full content width OR have consistent pill-like spacing (e.g., 200px each) as a clear visual tab bar.

**Fix approach:** On the tab bar in landscape, set a minimum width for each tab button or use gap-based spacing to push tabs further apart. The current left-huddled narrow tabs look incomplete.

---

### F-16 — Hover States Blocked for Non-`.sprite-hitbox` Buttons by Svelte Scope
**Category:** Interactive / Hover
**Severity:** Major
**Screens:** ALL screens

**Current state:** `CardApp.svelte` defines:
```css
[data-layout="landscape"] button:not(.sprite-hitbox):hover {
  filter: brightness(1.15);
  transition: filter 120ms ease, transform 120ms ease;
}
```
This is inside a Svelte `<style>` block. Svelte scopes button selectors: the rendered rule becomes something like `[data-layout="landscape"] button.svelte-xxxxx:not(.sprite-hitbox):hover`. Buttons inside child components (KnowledgeLibrary, SettingsPanel, ProfileScreen) carry DIFFERENT Svelte scope attributes, so the brightness hover effect does NOT apply to them.

Individual components that DO have their own hover states: `domain-card:hover { filter: brightness(1.1) }` in KnowledgeLibrary (correctly scoped). But most other buttons across all screens have no hover feedback.

**Expected state:** ALL buttons on ALL landscape screens should respond to hover with a visual change.

**Root cause:** Svelte scope isolation prevents the global CardApp hover rule from reaching child component buttons.

**Fix approach:** Two options:
1. Move the hover rule to `desktop.css` (which is a plain CSS file, not Svelte-scoped): `@media (min-width: 1200px) { button:not(.sprite-hitbox):hover { filter: brightness(1.15); transition: filter 120ms; } }` — this will apply globally.
2. Add hover states individually to each component in their landscape override blocks.

Option 1 is far more efficient and immediately fixes all screens.

---

## MINOR ISSUES

### F-17 — h3 Section Headings Override May Not Pierce Svelte Scope
**Category:** Font / Typography
**Severity:** Minor
**Screens:** Library, Settings, Profile

**Current state:** `CardApp.svelte` defines `[data-layout="landscape"] h3 { font-size: 20px; font-family: 'Cinzel', 'Georgia', serif; }`. Same Svelte scope isolation problem as h2 (see F-02). Local component h3 styles will win. SettingsPanel has `h3 { font-size: calc(14px * var(--text-scale, 1)); color: #93c5fd; }` scoped. The landscape override adds `:global([data-layout="landscape"]) .settings-section h3 { font-size: 20px; margin-bottom: 12px; }` — this DOES work (uses :global correctly) but does NOT set font-family.

**Fix approach:** Ensure all landscape h3 overrides also set `font-family: 'Cinzel', serif` or `font-family: system-ui`.

---

### F-18 — Stat Cards on Profile Use Courier New Not Cinzel or Sans-Serif
**Category:** Font
**Severity:** Minor
**Screens:** Profile

**Current state:** `.stat strong { font-size: calc(22px * var(--text-scale, 1)) }` — landscape override sets 28px. No font-family override. Inherits `body { font-family: 'Courier New', monospace }`. Stat values ("0", "5", etc.) display in Courier New 28px. Courier New looks like a typewriter font — acceptable in a pinch but inconsistent.

**Fix approach:** Set stat strong values to `font-family: 'Cinzel', serif` or a bold sans-serif for the numeric display values.

---

### F-19 — Domain Card Progress Bars Have No Label
**Category:** Information Architecture
**Severity:** Minor
**Screens:** Library

**Current state:** Each domain card shows a progress bar (colored fill) and below it "Completion 0% • Mastery 0%". At 1920x1080 with a 315px card, the progress bar is 12px tall and visually distinct. The `domain-meta` text at 13px (landscape override) adequately communicates the values. However, there is no visual distinction between "Completion" and "Mastery" in the progress bar — only one bar is shown. The textual label is the only disambiguation.

**Expected state:** Consider a dual-bar or second track to visually differentiate Completion vs Mastery, OR add a legend chip. The current single bar with two textual metrics creates ambiguity about what the bar actually represents.

---

### F-20 — Domain Card Hover Amber Border Competes with Semantic Domain Colors
**Category:** Color / Interaction
**Severity:** Minor
**Screens:** Library

**Current state:** Domain cards have `border-left: 4px solid var(--domain-accent)` — each domain has its semantic color (blue for Science, green for Geography, etc.). On hover, `border-left-color: #f59e0b` (amber) overrides the domain color. This is disorienting: hovering over the Science card changes its identifying blue border to a generic amber, removing its visual identity during the interaction.

**Expected state:** Hover should enhance the existing domain color, not replace it. A brightness increase of the existing border color, or a glow/shadow effect, would maintain domain identity while providing hover feedback.

**Fix approach:**
```css
.domain-card:hover {
  filter: brightness(1.12);
  /* Do NOT change border-left-color — keep domain identity */
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
```

---

### F-21 — Body/html Font Family Set to Courier New — Affects All Non-Overridden Text
**Category:** Font / Consistency
**Severity:** Minor
**Screens:** ALL screens

**Current state:** `app.css` sets `font-family: 'Courier New', monospace` on `html, body`. This is the fallback for all elements that don't explicitly override font-family. Courier New is a monospaced typewriter font. At desktop scale, body copy in Courier New at 13–15px renders with uneven letter spacing and looks amateurish. The game uses a "hybrid font system" (Press Start 2P + system UI per `overlay.css`), but in practice most text elements inherit Courier New.

**Expected state:** Non-game-UI text should inherit system-ui or a readable body font. The Courier New base is appropriate for mobile where everything is overridden with Press Start 2P, but at desktop it bleeds through on unspecified elements.

**Fix approach:** In `desktop.css` media query or CardApp landscape override:
```css
[data-layout="landscape"] {
  font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
}
```

---

### F-22 — Sidebar Button Width 91px Inside 100px Container — 9px Unaccounted
**Category:** Layout / Spacing
**Severity:** Minor
**Screens:** ALL landscape screens (sidebar)

**Current state:** `.nav-sidebar` is `width: 100px; padding: 8px 4px`. `.sidebar-btn` is `width: 100%` (100% of the nav-sidebar inner width = 100px - 4px - 4px padding = 92px). However the button is `border-radius: 10px` with `border: 1px solid transparent` plus `border-left: 3px solid transparent` — this creates a 1+3=4px left border, reducing inner content width. The effective label area is about 84px.

9 sidebar items from `y:288` to `y:793` spans 505px centered in 1080px — that is visually correct. However the 9 items × 52px min-height = 468px + 8 × 4px gap = 500px. Actual span 505px suggests one item may be slightly taller due to text wrapping. "Leaderboards" is labelled "Boards" to prevent this, which works, but "Library" (7 chars) and "Settings" (8 chars) fit while others might be borderline.

**Expected state:** All labels should fit on a single line with comfortable padding. Text clipping or overflow ellipsis on a 84px-wide label is not acceptable.

---

### F-23 — No Active Run Banner Landscape Offset Covers Sidebar Correctly But Content Bleeds
**Category:** Layout
**Severity:** Minor
**Screens:** Any screen visible when an active run exists

**Current state:** `[data-layout="landscape"] .active-run-banner { margin-top: 0; left: 100px; }` — the banner correctly starts after the 100px sidebar. The banner is `position: fixed; top: 0; right: 0` with `left: 100px`. This renders above all content. However, screens like KnowledgeLibrary use `position: fixed; inset: 0` and have their own sticky topbar. The banner sits at z-index:250, library at z-index:260. The library's topbar will paint over the banner if the user scrolls or if z-index stacking is not managed.

**Fix approach:** Ensure banner z-index exceeds or matches the library topbar z-index. Currently library is 260, banner is 250 — the banner will be covered by the library. Increase banner to z-index:270 in landscape.

---

### F-24 — Lore Grid Font Size Not Overridden in Landscape
**Category:** Font
**Severity:** Minor
**Screens:** Library

**Current state:** `.lore-card span { font-size: calc(11px * var(--text-scale, 1)); color: #bfdbfe }` — the "Unlocked at N mastered" subtitle. No landscape font-size override present for lore card sub-text. At 1920x1080, this renders at 11px Courier New/Press Start 2P — below the 13px minimum for desktop readability.

**Fix approach:** Add to Library landscape overrides:
```css
:global([data-layout="landscape"]) .library-overlay .lore-card span {
  font-size: 13px;
}
```

---

### F-25 — Detail Grid in Fact View Uses 12px — Minimum Not Met
**Category:** Font / Readability
**Severity:** Minor
**Screens:** Library (fact detail view)

**Current state:** `.detail-grid { font-size: calc(12px * var(--text-scale, 1)); }` — the 4-column Tier/Attempts/Correct/Avg RT/Stability/Difficulty/Next Review grid. No landscape font-size override is present. At 12px, these stat labels are slightly under the 13px minimum for desktop.

**Fix approach:**
```css
:global([data-layout="landscape"]) .library-overlay .detail-grid {
  font-size: 14px;
}
```

---

### F-26 — Variant List Uses 12px Text
**Category:** Font / Readability
**Severity:** Minor
**Screens:** Library (fact detail view)

**Current state:** `.variant-list { font-size: calc(12px * var(--text-scale, 1)); }` — question variant preview items. No landscape override. 12px text for full question strings is too small at desktop distances.

**Fix approach:** Add landscape override for variant-list to 15px.

---

### F-27 — Profile h4 "Runs Per Domain" Has No Landscape Override
**Category:** Font
**Severity:** Minor
**Screens:** Profile

**Current state:** `.domain-runs h4 { font-size: calc(12px * var(--text-scale, 1)); text-transform: uppercase; color: #93c5fd; }`. Renders at 12px. No landscape font-size override. "RUNS PER DOMAIN" in uppercase 12px is hard to read at desktop.

**Fix approach:** Add to ProfileScreen landscape overrides: `font-size: 14px`.

---

### F-28 — Checkbox Touch Targets 44x44px in Landscape — Too Large for Mouse
**Category:** Interactive / Affordances
**Severity:** Minor
**Screens:** Settings

**Current state:** `:global([data-layout="landscape"]) input[type='checkbox'] { width: 44px; height: 44px; }` — these are giant browser-default checkboxes. On desktop, native checkboxes at 44x44px are jarring and look like mobile form elements. They break visual proportions with the 15px toggle labels beside them.

**Expected state:** Desktop checkboxes should be styled as custom toggles (pill-shaped, ~40x22px) for a game UI aesthetic. Native browser checkboxes at 44px each are inconsistent with the dark RPG aesthetic.

**Fix approach:** Replace with CSS-styled toggle switches or reduce native checkbox size to 20x20px and use a custom `appearance: none` styled checkbox for landscape.

---

## POLISH ISSUES

### F-29 — Mastery Strip Has Redundant Display in Two Places
**Category:** Information Architecture
**Severity:** Polish
**Screens:** Library

**Current state:** In landscape, `.mastery-inline` is shown inline in the topbar (via `:global` display override). The `.mastery-strip` in the summary section ALSO shows "Mastered Facts: N". This creates duplication — the mastered count appears in both the heading bar AND as a standalone section card below the tabs.

**Fix approach:** In landscape, hide `.mastery-strip` when `.mastery-inline` is visible to avoid duplication:
```css
:global([data-layout="landscape"]) .library-overlay .mastery-strip {
  display: none;
}
```
Since the inline topbar version handles it.

---

### F-30 — Library Detail Card Two-Column Grid Causes h3 Statement Text to Span Both Columns But May Break Mid-Word
**Category:** Layout
**Severity:** Polish
**Screens:** Library (fact detail view)

**Current state:** `.library-overlay.landscape .detail-card { display: grid; grid-template-columns: 1fr 1fr; }` with `.detail-card h3 { grid-column: 1 / -1; }`. The h3 displays the full fact statement. Long statements (some facts can be 60–80 characters) span the full grid width. At 1920x1080 with `max-width` not explicitly set on detail-card, a 60-character sentence at 16px (scoped style, no landscape override) could run to an uncomfortably wide line.

**Fix approach:** Set `max-width: 800px` on the detail card content and ensure the h3 has `line-height: 1.5` for readable wrapping.

---

### F-31 — No Keyboard Shortcut Hints on Desktop Sidebar
**Category:** Interactive / Discoverability
**Severity:** Polish
**Screens:** ALL landscape screens (sidebar)

**Current state:** Sidebar navigation buttons have `aria-label` but no visible keyboard shortcut hint. On desktop, power users expect keyboard navigation. `KeyboardShortcutHelp.svelte` exists in the codebase suggesting shortcuts are available, but the sidebar provides no visual cue.

**Expected state:** Consider showing shortcut key hints (e.g., "G" for Library, "S" for Settings) as small labels in the sidebar button corners on desktop.

---

### F-32 — Sidebar Icon Images May Fail to Load — Emoji Fallback Is Mismatched Aesthetic
**Category:** Visual
**Severity:** Polish
**Screens:** ALL landscape screens (sidebar)

**Current state:** `HubNavBar.svelte` sidebar buttons use `<img src={getNavIconPath(item.iconKey)} onerror=...>` with an emoji fallback `{item.icon}`. The icons are "🏃", "📖", "🤝", "⚙️", "👤", "📜", "🏆", "🏺", "🃏". If any image fails to load, these emoji render inside the dark RPG navigation bar. Emoji rendering is OS-dependent — on Windows, emoji appear in colorful flat-design style, inconsistent with the dark pixel art aesthetic.

**Expected state:** The fallback should be an SVG icon or at minimum a text label if the image fails — not OS emoji that look completely out of place in a dark RPG.

---

### F-33 — Empty Lore Section Border-Bottom of Tab Bar Extends Full Width
**Category:** Visual
**Severity:** Polish
**Screens:** Library

**Current state:** `.library-tabs { border-bottom: 1px solid rgba(148, 163, 184, 0.3); }` — the tab bar has a separator line. In landscape with narrow pill-like tabs huddled left (F-15 issue), the border extends across the full content width. This creates a strong horizontal divider that draws the eye but the tabs themselves don't fill the line, making the section look unfinished.

**Expected state:** Either extend tabs to fill the bar (stretch), or make the border-bottom match only the tab bar's visual weight, or use a different visual separator approach in landscape.

---

### F-34 — sidebar-btn Active Indicator Left Border Colors Are Low Contrast
**Category:** Color / Contrast
**Severity:** Polish
**Screens:** ALL landscape screens (sidebar)

**Current state:** `.sidebar-btn.active { border-left-color: rgba(56, 189, 248, 0.9); background: rgba(15, 33, 53, 0.7); }`. The 3px left border in sky blue (#38BDF8 at 0.9 opacity) against the sidebar background `rgba(9, 14, 24, 0.94)` — contrast is approximately 4.2:1 which passes AA for large text but the 3px indicator line is thin enough that it might be missed visually. The active state relies primarily on the blue left border for identification.

**Expected state:** Consider widening the active indicator to 4px and adding a more visible background differentiation.

---

### F-35 — Settings Toggle Rows Use Grid with Fixed 130px Label Column That May Clip
**Category:** Layout
**Severity:** Polish
**Screens:** Settings

**Current state:** `.toggle-row { grid-template-columns: 1fr auto; }` — label gets 1fr which is flexible. `.slider-row { grid-template-columns: calc(130px * var(--layout-scale, 1)) 1fr auto; }` — label column is fixed at 130px. The landscape override changes this to `grid-template-columns: calc(140px * var(--layout-scale, 1)) minmax(280px, 1fr) auto`. "Music Volume" = 12 chars, "SFX Volume" = 10 chars — these fit at 130–140px. But "Push Notifications" = 18 chars could be tight in toggle rows depending on font. With Press Start 2P (proportional character width but wider than system fonts), this label may wrap.

**Fix approach:** Use `minmax(160px, auto)` for the label column to allow natural expansion.

---

## CROSS-CUTTING SUMMARY

### Font Usage Map (as implemented)
| Element | Font | Size | Landscape Override | Status |
|---|---|---|---|---|
| `html/body` | Courier New | inherited | None | Problematic — monospaced bleeds through |
| `button` (global) | Press Start 2P | 10px | Partially blocked by scoping | Critical |
| Sidebar labels | Press Start 2P | 11px | None | Critical — too small/wrong font |
| Library h2 | Cinzel (via :global) | 22px | Set to 22px not 32px | Major — wrong size |
| Library tabs | Cinzel (via :global) | 16px | Correctly overridden | OK |
| Domain card text | Press Start 2P | 16px/13px | Size only, not family | Major |
| Settings h2 | Courier New (no override) | 20px | Missing family override | Major |
| Profile h2 | Courier New (no override) | 22px | Missing override entirely | Major |
| Profile stat values | Courier New | 28px | Correct size, wrong font | Minor |
| Stat labels | Courier New | 13px | Size correct, font not | Minor |

### Background Gradient Issue Summary
The atmospheric gradient `radial-gradient(ellipse, #151020, #0d0b15, #050408)` is specified in three places with slightly different approaches:
1. `CardApp.svelte` line 1850: `[data-layout="landscape"] .card-app { background: radial-gradient(...) !important }` — occluded by screen overlays
2. `AR-127 spec`: defined as a sub-step to implement
3. `AR-128 Library spec`: the Library currently has `background: linear-gradient(180deg, #081225, #121f33)` which is a different, bluer palette

The result is that each screen has its own flat or simple linear gradient, none of which matches the intended dungeon atmosphere. This is a systemic fix requiring each screen's root element to adopt the shared atmospheric gradient.

### Screens Not Yet Reviewed in Detail
- **JournalScreen.svelte** — likely shares the same font, h2, scrollbar, and hover issues
- **LeaderboardsScreen.svelte** — likely missing landscape font/layout overrides
- **SocialScreen.svelte** — minimal content, lower risk
- **HubScreen.svelte** — has its own landscape implementation, not evaluated here
- **Combat overlays** (CardCombatOverlay, QuizOverlay, CardHand) — separate Phaser/canvas context, not in scope for this audit

---

## RECOMMENDED PRIORITY ORDER FOR FIXES

| Priority | Issues | Effort | Impact |
|---|---|---|---|
| P0 — Fix first | F-04 (global button font), F-03 (sidebar labels), F-16 (hover states) | Low (3 CSS changes in desktop.css) | Fixes ALL screens at once |
| P1 — High impact | F-01 (background gradient), F-02 (h2 typography), F-06 (Cinzel loading) | Medium | Transforms visual atmosphere |
| P2 — Screen-specific | F-07 (settings double-sidebar), F-09 (domain card font), F-10 F-12 (h2 per-screen) | Medium | Improves primary screens |
| P3 — Polish | F-11 (scrollbars), F-08 (lore layout), F-15 (tab width), F-21 (body font) | Low-Medium | Refinement |
| P4 — Deferred | F-19 (dual progress bar), F-28 (custom toggles), F-31 (keyboard hints), F-32 (emoji fallback) | High | Enhancement |

The single highest-leverage change is moving the hover rule and button font override to `desktop.css` (plain CSS, no Svelte scope) — this would fix hover states and button font readability across every screen simultaneously without touching any component file.
