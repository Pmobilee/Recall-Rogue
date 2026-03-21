# AR-LANDSCAPE-UX-AUDIT — Desktop Landscape UX Improvement Spec

**Viewport Target:** 1920×1080 (PC/desktop landscape)
**Aesthetic:** Dark RPG dungeon — Slay the Spire atmosphere, Hades readability, Darkest Dungeon texture
**Status:** Audit document — awaiting implementation prioritization

---

## Overview

At 1920×1080, Recall Rogue currently presents as a mobile app stretched onto a large canvas. Text is too small to read comfortably, content occupies a narrow strip in the center of the viewport, decorative atmosphere is absent from most screens, and interactive affordances (hover states, cursor feedback, tooltips) are missing entirely. This document catalogs every issue per screen and provides a complete, developer-actionable improvement spec.

**Guiding principles for all screens:**
- Every screen should feel like part of the same dungeon world — not a settings panel that could belong to any app
- Desktop users have a mouse; every interactive element must signal that it is interactive
- Content should fill the viewport intelligently — not stretch to fill, and not hide in a narrow column
- RPG typography hierarchy: Cinzel or equivalent for headings/labels, a readable serif or clean sans for body text
- The persistent sidebar nav should be visible on ALL screens, not just the hub

---

## Cross-Cutting Issues (Apply to All Screens)

### C1 — Sidebar Navigation Visibility

**Current:** The left sidebar (100px wide, 9 nav buttons) only appears on the Hub screen. All other screens show no persistent navigation. Users must use the Back button to return to Hub, then navigate from there.

**Proposed:** The sidebar must be present on every screen. It is the primary navigation of the game. On the Hub it is already visible. On all other screens it should appear identically — same width, same icons, same z-index. The active screen should highlight its corresponding button (e.g., the Library button glows amber when the Library screen is open).

**Implementation details:**
- Move sidebar into the top-level App shell component, not inside the Hub component
- Pass `activeScreen` prop to highlight the current nav item
- Sidebar width: increase from 100px to 120px at 1920×1080 — current 100px feels cramped at this viewport
- Button height: increase from 52px to 64px
- Icon size: increase from 24px to 28px
- Label font: increase from 11px to 13px, use letter-spacing: 0.08em for small-caps feel
- Active indicator: left-side amber vertical bar (4px wide, full button height), not just a color change
- Hover state: background lightens to rgba(255,200,100,0.12), icon gains amber tint, subtle 150ms ease transition
- Tooltip: on hover show the button label in a floating tooltip to the right (since labels are short, they can stay visible, but the tooltip confirms it for partially-obscured states)

### C2 — Content Container Strategy

**Current:** Screens use wildly inconsistent content widths — some fill full 1920px, some are cramped at 560px.

**Proposed:** Establish a two-tier content container system:
- **Sidebar-offset container:** `margin-left: 120px`, width fills remaining 1800px. Used for all screens.
- **Centered content area:** Within that 1800px, centered content should max at `1400px` with `margin: 0 auto` and `padding: 0 48px`. This prevents text columns becoming unreadably wide while using the space purposefully.
- **Wide-layout screens** (Leaderboards, Library grid, Profile stats): may use a two-column layout within the 1400px container — left column for primary content, right column for secondary info, tips, or decorative elements.

### C3 — Background Treatment

**Current:** Non-hub screens have plain dark backgrounds with no visual character. The dungeon atmosphere stops at the Hub.

**Proposed:** Every screen gets a subtle atmospheric background treatment. This does NOT mean a full illustrated scene — it means texture and depth:
- Base: very dark (`#0d0b0f`) near-black background
- Subtle stone tile texture as a CSS `background-image` (low-opacity repeating PNG, ~8% opacity) — the same stone texture used in combat
- Vignette: radial gradient overlay, dark at edges, slightly lighter at center — creates the "lantern light in a dungeon" feel
- Optional: extremely subtle parallax on scroll (background moves at 0.2x scroll speed)
- Screen-specific accent colors bleed in via a radial gradient at one corner (e.g., Library = cool blue-purple; Settings = neutral grey; Profile = warm amber)

### C4 — Typography Scale (Desktop Overrides)

**Current:** Most UI text is sized for mobile (9–18px). At 1920×1080, this reads as tiny.

**Proposed desktop type scale (apply via CSS media query `min-width: 1280px`):**

| Element | Mobile size | Desktop size | Font |
|---|---|---|---|
| Screen title (h1) | 18px | 36px | Cinzel or MedievalSharp |
| Section heading (h2) | 14px | 22px | Cinzel, letter-spacing 0.05em |
| Card/item label | 13px | 16px | System sans or Lato |
| Body text / descriptions | 12px | 15px | System sans |
| Stat values / numbers | 18px | 28px | Cinzel or monospace |
| Small labels / footnotes | 11px | 13px | System sans |
| Nav button labels | 11px | 13px | Cinzel caps |
| Tab labels | 21px | 18px | Cinzel — already large enough, reduce slightly for consistency |

All font-size changes should be wrapped in a single `@media (min-width: 1280px)` block in a `desktop.css` override file, not scattered inline.

### C5 — Hover States and Cursor Feedback

**Current:** No hover states exist anywhere in the non-Phaser UI. Buttons change nothing on hover. Cursor stays as default pointer everywhere.

**Proposed — global rules:**
- `cursor: pointer` on all clickable elements (already likely set, verify it applies to all custom components)
- `cursor: default` on non-interactive text/decorative elements
- All buttons: on hover, brightness increases 15-20%, subtle scale(1.02) transform, 100ms ease transition
- All card-style containers (domain cards, leaderboard rows, relic cards): on hover, border color shifts from dim grey to amber/gold, box-shadow gains a soft amber glow (2-4px blur, low opacity)
- Transition timing: `transition: all 120ms ease` as a base rule for interactive elements
- Focus states (for keyboard/gamepad navigation): amber outline, 2px solid, 4px offset — never remove `:focus-visible` outlines

### C6 — Decorative Dividers and Borders

**Current:** Screens use plain CSS borders or no visual separation between sections.

**Proposed:** RPG-appropriate section dividers:
- Horizontal rule style: a thin line (1px) with a small diamond or sword icon centered on it — can be a single SVG inline or a CSS `::before`/`::after` trick
- Section containers: use `border: 1px solid rgba(180,140,60,0.25)` (dim gold) with `border-radius: 4px` for card-style sections
- Top-level screen header: separated from content by a full-width ornamental divider (the diamond-rule style)
- Panel backgrounds: `background: rgba(20,16,28,0.85)` — slightly purple-tinted dark, not pure black

---

## Screen 1 — Hub (Campsite)

### Current Issues

1. **Empty side panels:** `hub-side-left` (656px) and `hub-side-right` (656px) are gradient-overlaid emptiness. At 1920px, this is 1312px of unused screen real estate flanking a 608px center column.
2. **HUD pills too small:** Streak and dust indicators use 20px icons and 18px values. At desktop they should be more prominent status displays.
3. **Level badge placement:** `position:fixed, bottom-right` means it floats over whatever content is there. At desktop it can be integrated into a proper status bar.
4. **Center column feels mobile-sized:** The 9:16 aspect-ratio center column is the right approach for maintaining the campsite art composition, but the flanking panels need purpose.
5. **Sidebar nav buttons are cramped at 100px wide.**
6. **Study mode pill is too small** — this is a key game feature that should be more prominent.

### Proposed Improvements

**Left panel (656px) — Player Status Panel:**
- Background: semi-transparent dark panel with stone texture, matching the campsite atmosphere
- Top section: Player avatar (larger, 96px), player name, current title (e.g., "Apprentice Arcanist"), XP bar displayed prominently (300px wide, 12px tall, amber fill, labelled "Level 7 — 340/500 XP")
- Middle section: "Current Deck" summary — shows deck name, card count, brief breakdown (Attack/Defense/etc.) as small icon-count pairs
- Bottom section: "Active Relics" — shows up to 4 relic icons in a 2×2 grid with names below
- Dividers between sections: ornamental rule style described in C6
- This panel only appears when a run is in progress (deck + relics exist); otherwise shows a decorative illustration or "Begin your journey" prompt

**Right panel (656px) — Daily/Meta Panel:**
- Top section: Daily challenge teaser — "Today's Trial: Geography Gauntlet" with a golden border and timer showing time until reset
- Middle section: Recent journal entry — last completed run's summary (floors reached, cards collected, cause of death) in a scroll/parchment style container
- Bottom section: Tip of the day or lore snippet — flavour text in italic, attributed to a fictional in-world character ("As written in the Arcanist's Codex, Vol. III...")
- Same dark panel treatment as left panel

**HUD pills (top of center column):**
- Increase icon size to 28px, value text to 22px
- Move from top of center column into a dedicated top strip across the full 1800px content area (above the three-column layout)
- Left-aligned: Player name + level
- Center: Streak counter (flame icon, prominent)
- Right-aligned: Dust/currency balance

**Level badge:**
- Remove `position:fixed`
- Integrate into the top strip HUD area described above

**Study mode pill:**
- Increase size significantly: full-width within center column, 56px tall, prominent amber/gold border
- Label: "Study Mode — Practice without a run" — make the value proposition clear
- Icon: open book, 24px

**Sidebar (applies to all screens):**
- Width: 120px (from 100px)
- Apply active state highlight for current screen

### RPG Design Notes

- The left and right panels transform the Hub from "a campsite you pass through" to "your adventurer's base camp" — it contextualizes your progress, your loadout, and what's coming next
- Reference: Slay the Spire's main menu shows deck/relic/HP prominently before entering combat. The Hub should do the same for the overall run state.
- The right panel's journal entry and lore snippet give the world texture without requiring the player to navigate to separate screens
- Campfire canvas and character sprites in the center column should retain their mobile proportions — they are the compositional anchor; the side panels frame them

---

## Screen 2 — Library

### Current Issues

1. **330px gap between tabs and content grid** — a massive dead zone
2. **Heading misalignment:** "Library" heading is at x:1806, which is near the right edge. This is clearly a layout bug.
3. **No sidebar visible** (see C1)
4. **Domain cards use 13px labels and 11px footnotes** — unreadable at desktop
5. **4-column grid at 454px each** — at 1800px available (with sidebar), this produces oversized cards with lots of internal whitespace. Cards should either be smaller (showing more) or taller (showing more info).
6. **"Mastered Facts: 0"** is isolated text with no visual context — it should be part of a progress summary section
7. **Back button and heading are the only header content** — wastes the full header zone

### Proposed Improvements

**Header zone (top ~120px):**
- Remove the back button — navigation is now handled by the sidebar
- "Library" as large screen title (36px Cinzel), left-aligned within the content container
- Subtitle: "Your knowledge grows with every card you master" — italic, 14px, dim amber
- Right-aligned in the header: Progress summary capsule — "847 Facts Known — 23 Mastered — 4 Domains Active" in three small stat chips with icons
- Ornamental divider below the header (C6 style)

**Tabs:**
- Reduce from 930px each to proportional tabs within the 1400px content max-width
- Tabs: 320px each, centered within the content area, not stretched edge-to-edge
- Tab style: not full-width buttons — parchment-style tabs with a slightly raised visual (lighter top border, darker bottom border when inactive, reversed when active)
- Font: Cinzel, 16px, letter-spacing 0.1em
- Active tab: amber bottom border, 3px; tab background slightly lighter
- The 330px gap below tabs is eliminated by moving "Mastered Facts" into the header summary and tightening the tab-to-grid spacing to ~24px

**Domain grid:**
- At 1800px wide, use a 6-column grid (6 × ~270px with gaps) — shows all 12 domains in 2 rows
- Card dimensions: 270px wide × 180px tall
- Card content (scaled up for desktop):
  - Domain icon: 40px (from implied small size)
  - Domain name: 18px Cinzel
  - Fact count: 15px, dim text
  - Completion bar: full-width within card, 8px tall, amber fill
  - Mastery %: 13px, right-aligned below bar
- Card hover: gold border glow, slight scale(1.02), 120ms ease
- Card background: `rgba(20,16,28,0.9)` with a very subtle domain-color tint (blue for Science, green for Geography, etc.)

**Domain color coding (RPG flavor):**
| Domain | Accent Color |
|---|---|
| Science | Cyan-blue `#4a9eff` |
| Space | Deep purple `#8b5cf6` |
| Geography | Forest green `#22c55e` |
| Capitals | Gold `#f59e0b` |
| History | Aged brown `#a16207` |
| Mythology | Violet `#7c3aed` |
| Animals | Earth orange `#ea580c` |
| Health | Rose `#e11d48` |
| Cuisine | Warm amber `#d97706` |
| Art | Mauve `#9333ea` |
| Language | Teal `#0d9488` |
| General | Silver `#94a3b8` |

**Deck Builder tab:**
- When active, show a two-column layout: card list on the left (~900px), deck composition panel on the right (~460px)
- Deck panel: shows current deck with drag-to-reorder, card count, domain breakdown bar
- This tab is the most complex — its layout should be specified in a dedicated AR when the feature matures

### RPG Design Notes

- Domain cards should feel like tomes or grimoires on a library shelf — each with a unique color and symbol, not just flat rectangles
- The Library is where the player's knowledge growth is visible. It should feel rewarding to open — a wall of progress, not an empty grid.
- Reference: Hades' Codex screen — organized, readable, with flavor text per entry. The Library should aspire to that level of presentational care.
- "Mastered Facts" should show as a glowing golden number with a sparkle icon — mastery is the core reward loop and deserves visual celebration

---

## Screen 3 — Settings

### Current Issues

1. **Settings panel only 560px wide out of 1720px available** — 1160px of dead space to the right
2. **Has its own 200px sidebar** with category tabs — this conflicts with the global sidebar pattern and should be reconsidered
3. **Labels at 12px, headings at 14px** — microscopic at desktop
4. **No visual character** — could be a browser settings panel
5. **No Back button equivalent in the global sidebar pattern** — settings should be closeable from the nav

### Proposed Improvements

**Layout restructure:**
- Remove the internal 200px sidebar. Category navigation (Audio, Accessibility, Notifications, Account) moves to a horizontal tab strip at the top of the content area, below the screen title.
- Content area: `max-width: 800px`, centered within the sidebar-offset container — settings panels do not need to be wide, but 560px is too narrow. 800px reads well at desktop.
- Left/right margins remain as decorative atmosphere (the stone background does the work)

**Typography scale:**
- Section heading ("Audio Settings"): 22px Cinzel
- Toggle row labels: 16px
- Slider labels: 15px
- Category tab labels: 15px Cinzel

**Category tabs (replacing internal sidebar):**
- Horizontal strip of 4 tabs: Audio | Accessibility | Notifications | Account
- Each tab: 180px wide, 48px tall, centered label
- Style: same parchment-tab style as Library tabs
- Active tab: amber underline, 3px

**Individual setting rows:**
- Each row: 64px tall (was implied ~40px), full 800px content width
- Label on left, control (toggle/slider) on right
- Rows separated by a very thin 1px line at 15% opacity
- Toggle switches: 52px × 28px (not small mobile-scale toggles) — the thumb should be large enough to click confidently with a mouse
- Volume sliders: 300px wide track, 20px thumb diameter, amber track fill
- Hover state on row: row background slightly lightens, cursor changes to pointer if the row is interactive

**Account section:**
- Login / Register / Logout buttons should be full-width within the 800px container, 52px tall, with RPG button styling (dark background, amber border, slight glow on hover)

**Decorative treatment:**
- A subtle circular emblem (the game's crest or a dungeon lock icon) watermarked at very low opacity behind the content area
- Section headings preceded by a small amber diamond bullet

### RPG Design Notes

- Settings is usually the least-designed screen in games, but it's also the most-visited by new players struggling with audio or accessibility. It should feel like "adjusting your adventurer's preparations at the camp," not filing a form.
- Reference: Slay the Spire's settings panel — clean, readable, every toggle is obvious. Not decorated, but clearly part of the same game world via consistent palette and font.
- The audio section specifically should have a "preview" affordance — clicking the SFX toggle should play a brief sound. The volume slider should produce audio feedback on scrub.

---

## Screen 4 — Profile

### Current Issues

1. **6 stats all showing "0"** — empty state with no visual hierarchy or guidance
2. **Avatar section uses a 👤 emoji** — this is placeholder-tier and needs proper treatment
3. **"All-time run and learning stats" subtitle** is functional but not atmospheric
4. **Full 1920px width with 16px padding** — extremely wide text columns, poor readability
5. **"No domain runs recorded yet" empty state** is bare text with no illustration or guidance

### Proposed Improvements

**Two-column layout:**
- Left column (~560px): Player identity panel
- Right column (~800px): Stats and progress panel
- Total: 1400px max-width, centered, sidebar-offset

**Left column — Player Identity Panel:**
- Avatar container: 128×128px circle with a decorative border ring (amber, double-line style, like a medal)
- Below avatar: Player name (24px Cinzel), editable on click (pencil icon appears on hover)
- Player title: "Apprentice Arcanist" (16px italic, dim amber) — title earned from milestones
- "Adventurer Since: [date]" — 13px, dim text
- Below identity: a vertical list of earned badges/achievements (icon + name), scrollable if many
- Panel background: same dark RPG panel style (C6 borders, stone texture)

**Right column — Stats Panel:**
- Stats grid: 2×3, each stat in its own card container (not raw text)
- Each stat card: 280px wide × 120px tall
  - Large value: 36px Cinzel (the number)
  - Stat label: 14px below
  - Icon: 32px top-left corner
  - Subtle accent color per stat type (flame for streak, skull for runs, book for facts, etc.)
- Stats: Facts Learned, Mastered Facts, Runs Completed, Best Floor, Best Streak, Milestones Hit

**Empty state (no runs recorded):**
- Replace bare text with an illustrated empty-state panel:
  - A closed tome icon (SVG or sprite, ~64px)
  - Heading: "Your Legend Has Not Yet Been Written" (20px Cinzel)
  - Body: "Complete your first run to begin recording your adventurer's history." (14px)
  - CTA button: "Begin a Run" — styled as a primary action button, links to Start Run flow

**Domain progress section (below stats):**
- Full-width within the right column: shows domain mastery as a horizontal bar chart
- Each domain: colored bar (using domain color coding from Library spec), domain name left, percentage right
- Section title: "Domain Mastery" with ornamental divider

### RPG Design Notes

- The Profile screen is the player's trophy room — it should feel earned and personal, not like a database record
- Reference: Hades' mirror room / character stats screen — every value has a clear icon and feels significant even when small
- The player title system ("Apprentice Arcanist" → "Seasoned Scholar" → "Dungeon Sage") gives the avatar section immediate RPG identity even with minimal stats
- Empty state messaging should use in-world flavor language throughout — never "No data available"

---

## Screen 5 — Journal (Adventurer's Journal)

### Current Issues

1. **Empty state is just two lines of text** — no character, no guidance
2. **Search box** is present but searching an empty journal is pointless — it should appear only when entries exist
3. **Full 1920px width with 16px padding** — same wide-column problem as Profile
4. **"Adventurer's Journal" heading** — the RPG name is good, but the presentation is flat

### Proposed Improvements

**Layout:**
- `max-width: 1100px`, centered, sidebar-offset
- Two-column when entries exist: run list on left (~380px), run detail on right (~680px)
- Single centered column when empty (empty state)

**Header:**
- "Adventurer's Journal" in 36px Cinzel
- Subtitle: "A record of every expedition into the dungeon depths"
- Ornamental divider
- Search bar appears only when entries exist — positioned top-right of the content area, 280px wide, with a magnifying glass icon inside

**Empty state:**
- Large parchment scroll SVG or image (160px tall)
- "The pages await your first expedition" (22px Cinzel italic)
- "Each run writes a new entry — your victories, your defeats, the knowledge you gained." (15px body)
- CTA: "Descend into the Dungeon" — primary button linking to Start Run
- Subtle particles or dust motes animation (CSS keyframes, extremely subtle — floating specks at 2% opacity)

**Entry list (left column):**
- Each entry: 380px wide × 80px tall
- Shows: date, floor reached, outcome icon (skull for defeat, crown for victory), domain played
- Active entry: highlighted with amber left border
- Hover: lighter background, cursor pointer
- Most recent at top

**Entry detail (right column):**
- Entry header: "Run #12 — Floor 8 — Defeated by Stone Golem" (20px Cinzel)
- Date and duration: 13px dim text
- Cards encountered this run (small card icons in a horizontal row)
- Relics held when defeated
- Domain breakdown: which domains were quizzed, % correct per domain
- Memorable moment: "Longest combo: 4 cards" — highlighted in amber

### RPG Design Notes

- The Journal should feel like a handwritten logbook from an actual dungeon adventurer — entries should read like adventure logs, not database records
- Consider auto-generating one or two flavour sentences per run: "On this day, the Scholar ventured to Floor 6 before meeting their end at the hands of a Stone Golem, their mastery of Geography insufficient to withstand the assault." This is achievable with a template system, no LLM needed.
- Reference: Darkest Dungeon's end-of-run summary — every run is given narrative weight, even the bad ones

---

## Screen 6 — Leaderboards

### Current Issues

1. **"Local rankings" subtitle** — at desktop, local rankings are less compelling than global ones. But even if only local is available now, the presentation is bare.
2. **Emoji icons** (🔥💰🗻) — these work fine visually but should be replaced with consistent SVG/sprite icons that match the game's art style
3. **10 entries displayed** as flat rows with minimal visual differentiation
4. **Full 1920px width with 16px padding** — ranks 1–10 stretched across the full screen is awkward

### Proposed Improvements

**Layout:**
- Two-column: leaderboard table on left (~840px), stats/context panel on right (~520px)
- Total: 1400px max-width, centered, sidebar-offset

**Leaderboard table (left column):**
- Header row: Rank | Adventurer | Streak | Dust | Deepest Floor — 16px Cinzel, amber text
- Row height: 64px (was ~48px)
- Rank column: 60px — top 3 get gold/silver/bronze medal icons (SVG), rest get plain numbers
- Name: 18px, with a small class icon to the left (Scholar, Warrior, etc. if class system exists)
- Values: 16px, right-aligned per column
- Alternate row tinting: even rows slightly lighter (`rgba(255,255,255,0.03)`)
- Top 3 rows: left border in gold/silver/bronze respectively (3px solid)
- "You" row (current player): amber background tint, bold text
- Hover on row: slight background lighten, cursor pointer (row may be clickable to see full profile)

**Context panel (right column):**
- Top section: "Your Ranking" card — shows the current player's rank prominently (large number), with their stats
- Middle section: "This Week's Top Scores" — if daily/weekly data exists, show a small chart or just the #1 scores
- Bottom section: "Categories" — let user switch between leaderboard types: Total Dust, Best Floor, Longest Streak, Most Facts
- These category buttons styled as RPG category chips (pill shape, amber border, dark background)

**Empty/local-only state:**
- If only local (seeded/dummy) data: show a note at the bottom: "Rankings reflect local play. Connect your account to compete globally."

### RPG Design Notes

- Leaderboards are motivational. The top 3 entries should feel genuinely prestigious — consider a podium illustration or at minimum a distinct visual treatment for #1 (golden name text, a small crown icon)
- Reference: Dead Cells / Hades online leaderboard panels — clean table, but the #1 entry always has special visual weight
- The "Your Ranking" panel on the right is a retention mechanic — it shows where you stand and implicitly motivates improvement

---

## Screen 7 — Social

### Current Issues

1. **"Social features are disabled" state occupies the entire screen** with a single button
2. **No context** on what social features will be (the player doesn't know what they're missing)
3. **Full 1920px width with 16px padding** — the disabled state looks especially sparse here

### Proposed Improvements

**Layout:**
- `max-width: 960px`, centered, sidebar-offset
- Disabled state is centered vertically within the content area

**Disabled state redesign:**
- Icon: a broken chain or two shields (community/social metaphor), 64px, amber tint
- Heading: "The Adventurers' Guild" (24px Cinzel) — name gives it identity even when disabled
- Subheading: "Social features are currently disabled"
- Body paragraph explaining what guild features will include (friend challenges, guild leaderboards, shared knowledge packs, co-op dungeon runs)
- This "preview" of features makes the disabled state informative rather than a dead end
- CTA: "Enable in Settings" button — styled prominently, links directly to the Notifications/Account section of Settings
- Below the CTA: "Or continue your solo expedition" text link that navigates back to Hub

**Future-state layout (when social is enabled):**
- Left column: Friends list (status, recent activity)
- Center: Activity feed (who cleared what floor, who mastered what domain)
- Right column: Guild challenges, co-op invites

### RPG Design Notes

- "The Adventurers' Guild" framing transforms a disabled feature screen into a piece of world-building — there's a guild, it exists, you just haven't joined it yet
- Disabled states should always preview what's coming — it builds anticipation. The player should leave this screen thinking "I should enable that" not "this is broken."

---

## Implementation Priority Order

Based on impact vs. effort:

| Priority | Change | Impact | Effort |
|---|---|---|---|
| P1 | Global sidebar on all screens (C1) | High — navigation consistency | Medium |
| P1 | Desktop typography scale (C4) | High — readability everywhere | Low |
| P1 | Library layout fixes (gap, heading, grid) | High — most-used non-combat screen | Medium |
| P2 | Hover states globally (C5) | High — desktop feel | Low |
| P2 | Background atmospheric treatment (C3) | Medium — atmosphere | Low |
| P2 | Content container strategy (C2) | High — layout sanity | Low |
| P3 | Hub side panels | High — visual wow | High |
| P3 | Profile two-column layout | Medium | Medium |
| P3 | Settings restructure (remove internal sidebar) | Medium | Medium |
| P4 | Journal two-column with flavour text | Medium | Medium |
| P4 | Leaderboards two-column | Medium | Low |
| P4 | Social disabled-state redesign | Low | Low |
| P5 | Decorative dividers (C6) | Medium — polish | Low |
| P5 | Domain color coding in Library | Medium — identity | Low |

---

## Verification Checklist (per implementation batch)

After implementing any batch of these changes:

- [ ] Navigate to each affected screen at 1920×1080 — take Playwright screenshot
- [ ] Verify sidebar is visible and correct nav item is highlighted
- [ ] Verify no text is below 13px at desktop
- [ ] Verify content container does not exceed 1400px max-width where specified
- [ ] Verify hover states are present on all interactive elements
- [ ] Verify no layout overflow or horizontal scroll at 1920×1080
- [ ] Run `npm run typecheck` — no new errors
- [ ] Run `npm run build` — no new errors
- [ ] Update `docs/GAME_DESIGN.md` if any player-facing screen behavior changed
- [ ] Update `data/inspection-registry.json` — set `lastChangedDate` for all touched screens

---

## Files Likely Affected

| File | Changes |
|---|---|
| `src/ui/HubScreen.svelte` | Side panel content, HUD strip, study mode pill |
| `src/ui/LibraryScreen.svelte` | Header, tab layout, grid columns, empty state |
| `src/ui/SettingsScreen.svelte` | Internal sidebar removal, horizontal tabs, content width |
| `src/ui/ProfileScreen.svelte` | Two-column layout, stat cards, empty state |
| `src/ui/JournalScreen.svelte` | Two-column layout, empty state redesign |
| `src/ui/LeaderboardsScreen.svelte` | Two-column layout, row styling, context panel |
| `src/ui/SocialScreen.svelte` | Disabled state redesign |
| `src/ui/Sidebar.svelte` (or equivalent) | Move to App shell, add active state, increase size |
| `src/ui/App.svelte` | Sidebar always-visible integration |
| `src/assets/styles/desktop.css` (new or existing) | Global desktop media query overrides |
| `docs/GAME_DESIGN.md` | Update UI sections for all changed screens |
| `data/inspection-registry.json` | Update `lastChangedDate` for all 7 screens |
