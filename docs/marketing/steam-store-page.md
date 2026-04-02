# Steam Store Page — Recall Rogue

> Reference document for all Steam storefront marketing assets, copy, and strategy.
> Last updated: 2026-04-02

---

## 1. Required Steam Graphics (Exact Specs)

All images must be delivered as JPG or PNG. Transparent backgrounds only where noted. Steam
auto-generates the Page Background from the last screenshot if a custom one is not uploaded.

| Asset | Size (px) | Format | Purpose |
|-------|-----------|--------|---------|
| Header Capsule | 920×430 | JPG or PNG | Store page header, wishlists, recommendations, "More Like This" |
| Small Capsule | 462×174 | JPG or PNG | Search results, tag pages, lists — must be **legible at 120×45** |
| Main Capsule | 1232×706 | JPG or PNG | Steam homepage featured carousel |
| Vertical Capsule | 748×896 | JPG or PNG | Seasonal sale promo pages |
| Hero Graphic | 3840×1240 | JPG or PNG | Wide banner at top of store page (letterboxed to ~1232×353 on most monitors) |
| Logo | 940×460 | PNG (transparent BG) | Overlaid on Hero Graphic; must not be embedded directly in Hero |
| Page Background | 1438×810 | JPG or PNG | Repeating tile behind store page body; auto-generated from last screenshot if absent |
| Screenshots | 1920×1080 | JPG or PNG | Min 5 required; recommend 8-10; first 4 show in hover previews |
| Trailer Thumbnail | 1920×1080 | JPG or PNG | Custom poster frame shown before trailer plays |

### Critical Constraints

- **Logo is separate from Hero Graphic.** Steam composites them. Never bake the logo into the Hero image.
- **Small Capsule legibility at 120×45 is non-negotiable.** The logo or title wordmark must read
  at that scaled-down size. Test by rendering at 120×45 before shipping.
- **No marketing text in capsule images.** Steam policy prohibits review scores, award logos,
  "On Sale" callouts, or promotional copy anywhere in capsule images or the Hero.
- **Screenshots cannot have text overlays or annotations.** Show real UI only.
- Main Capsule and Vertical Capsule are only shown to users who have already seen the game before
  (algorithm-surfaced), so they can be more artistic/abstract than the Header Capsule.

---

## 2. Screenshot Strategy (8-Screenshot Sequence)

Order is critical. The first 4 screenshots appear in hover preview cards on Steam browse and
search pages — they must sell the game without a single click.

| # | Scene | What to Capture | Why |
|---|-------|-----------------|-----|
| 1 | Combat — Charge Quiz Moment | Player has a card selected for charging; quiz overlay is visible with question + answer choices; enemy sprite on screen; chain counter active and building | **This is the hook.** No other card roguelite has facts-as-cards activated by quiz answers. Instant differentiation from every competitor |
| 2 | Full Combat Board State | Hand of 5+ cards across different chain colors (Obsidian, Crimson, Verdant, Auric, Violet); enemy with intent icon visible; HP/AP bars; damage numbers flying mid-animation | Shows it is a real card roguelite with depth, not a quiz app with card chrome |
| 3 | Card Reward Screen | 3-card pick post-combat; cards show art, mechanic name, chain theme, stats | Decision-making moment; communicates card variety, deckbuilding strategy, visual quality of card art |
| 4 | Boss Encounter | Visually impressive boss (Dean, Headmistress, or Final Boss) filling the screen; unique attack pattern visible; player at low HP for tension | Stakes + spectacle; signals this is not a casual game |
| 5 | Deck / Domain Picker | Domain or deck selection screen showing knowledge categories (History, Science, Anatomy, Languages, Dinosaurs, World Wonders) | "I could learn ANYTHING here" — breadth signal, Study Temple mode appeal |
| 6 | Mystery Event Room | One of 40 unique narrative rooms (e.g., Knowing Skull, Forbidden Section, Mirror Scholar); event text + choice buttons visible | Variety + world-building; shows the game has more than just combat |
| 7 | Shop Room | Card upgrades + relics for purchase with gold; relic slots visible; interesting items available | Strategic depth; roguelite loop signaling |
| 8 | Dungeon Map | Node-based procedural ring map showing branching paths, multiple room type icons, current floor depth | Replayability signal; shows map structure and run length |

### Screenshot Production Principles

- Show **real UI** — cards must display mechanic names, chain themes, and charge status.
- Capture **mid-action** states — damage numbers, chain counter incrementing, quiz timer active.
- Use **different enemy types** across screenshots to hint at the 84-enemy roster.
- Show **different chain colors** in hand across screenshots (Obsidian black, Crimson red, Verdant
  green, Auric gold, Violet purple, Lunar silver).
- Never put UI annotations, callout arrows, or text overlays on screenshots (Steam policy violation).
- Avoid showing the same enemy type in multiple screenshots.

### Screenshot Capture Workflow

```
1. npm run dev  (port 5173)
2. Open Playwright with channel: 'chrome'  (WebGL requires system Chrome on macOS ARM64)
3. Use window.__rrScenario.load('combat') or equivalent preset to reach target state
4. Capture with page.screenshot({ path: 'screenshot-N.png' })
   (Do NOT use __rrScreenshotFile — has DOM overlay compositing issues)
5. Light crop/color correction in image editor if needed for framing
```

---

## 3. Capsule Art Direction

### Competitor Analysis

| Game | Capsule Style | Key Lesson |
|------|--------------|------------|
| Balatro | Single iconic Joker card, psychedelic neon on black | One strong focal image beats busy compositions |
| Slay the Spire | Character silhouette + floating cards | Character as anchor, cards as context |
| Inscryption | Single compelling dark card, mystery atmosphere | Mood > content inventory |
| Monster Train | Colorful demon/train, vibrant energy | High-saturation pixel art reads well at small sizes |
| Vault of the Void | Clear UI screenshot style, strategic depth | Works for niche audiences who recognize genre; weaker for discovery |

### Recall Rogue Concept: "Knowledge as Power"

**Core image:** A fan of 3-5 glowing cards from different chains (color variety = visual pop) held
by an unseen hand, with luminous quiz text fragments floating around the cards like spell reagents.
A single prominent enemy silhouette (Bookwyrm recommended — iconic, on-theme) looms in the
background. Library/dungeon atmosphere with warm, dramatic lighting.

**Color palette:** Auric gold + Crimson red + Violet purple as dominant chain glow colors against
a dark dungeon stone background. High contrast. The glow does the visual work.

**Logo placement:** Centered, large, front. The tagline below the logo should be one short phrase
(see copy section). Must remain legible at 120×45 after compositing.

**Elements to include:**
- 3-5 cards (showing art + chain colors — not card text, too small to read)
- 1 prominent enemy silhouette (Bookwyrm or Dean)
- Library/dungeon atmospheric background
- Warm chain-color glow lighting
- Logo (wordmark) front and center

**Elements to exclude:**
- Review scores or award badges
- Marketing text ("Now Available", "Over 2,400 Facts!")
- UI chrome (health bars, AP meters) — this is art, not a screenshot
- More than one enemy (too busy)

### Logo Reference

Current logo: `/public/assets/boot/logo.png`

Verify the logo reads at 120×45 before finalizing any capsule. The wordmark letterforms must
survive heavy downscaling — test with nearest-neighbor interpolation to simulate worst case.

---

## 4. Trailer Strategy (60 Seconds)

The Steam trailer auto-plays muted. The first 5 seconds determine if a viewer keeps watching.
Design for **silent viewing** — every key beat must read visually without audio.

### Recommended Structure

| Time | Content | Notes |
|------|---------|-------|
| 0–5s | **HOOK:** Mid-combat charge → quiz appears → correct answer → MASSIVE chain combo with screen shake and flying damage numbers | No title card. No logos. Explosive action only. Must be visually legible muted |
| 5–15s | **Core Loop:** Draw cards → Quick Play some for base damage → Charge one with a quiz → answer correctly → chain multiplier ticks up → big damage | Show the charge mechanic clearly and completely in one sequence |
| 15–25s | **Variety:** Fast cuts — different enemy types (show at least 5 enemies), different room types, different card mechanics resolving | Pixel art parade. Signals content depth without text |
| 25–35s | **Progression:** Card reward pick → shop purchase → relic slot fills → mastery level-up animation | Show the roguelite loop. The viewer needs to understand runs have structure |
| 35–50s | **Knowledge Breadth:** Flash through domains — dinosaur image question, anatomy diagram, WWII history date, Japanese vocabulary, geography silhouette | "Learn ANYTHING" moment. Keep cuts under 2 seconds each |
| 50–60s | **Climax + Logo:** Boss fight sequence → victory screen → logo fades in + tagline | End on triumph. Viewer leaves feeling good |

### Audio Notes

- Use in-game BGM with SFX layered on top (authentic to the experience).
- Do not rely on voiceover — a significant portion of Steam players watch muted.
- Quiz correct-answer SFX + chain-up SFX are the emotional payoff beats — make sure those land
  visually as well as aurally.

### Technical Specs

| Property | Value |
|----------|-------|
| Resolution | 1920×1080 |
| Frame rate | 30fps minimum; 60fps preferred |
| Video codec | H.264 |
| Audio codec | AAC |
| Container | .mp4 |
| Bitrate | 5000+ Kbps video |
| Max file size | Steam accepts up to ~8GB; target under 500MB for fast loading |

### Capture Notes

- Use OBS or similar screen recorder at native 1080p/60fps.
- Record actual gameplay (not scripted input replay) for authentic feel.
- Capture during Surge turns for maximum visual spectacle.
- Chain combos of 4+ correct answers for the climax sequence.

---

## 5. Store Description Copy

### Short Description (up to 300 characters)

> A card roguelite where knowledge is your weapon. Quick Play cards for base damage, Charge them
> by answering real trivia for massive multipliers — the more you learn, the stronger you become.

This appears below the header capsule and in recommendation widgets. Lead with the unique
mechanic, not the genre.

### Above-the-Fold Bullets (6 max; shown before "Read More" fold)

These six lines appear before the player clicks "Read More." They carry the most weight. Each
line is a standalone pitch.

- **96 unique card mechanics** across 6 chain themes — build synergies that multiply knowledge
  into devastating combos
- **84 hand-crafted pixel art enemies** — from Brain Fog to the Dean, each with unique attack
  patterns and intentions
- **2,400+ real-world facts** across 12+ domains — history, science, anatomy, languages,
  dinosaurs, world wonders
- **FSRS spaced repetition** — the game actually teaches you. Cards you struggle with appear more
  often until mastered
- **40 unique mystery events** — narrative encounters with meaningful choices every run
- **Procedurally generated dungeon rings** — 8 escalating depths, no two runs alike

### Long Description (below fold)

The long description should expand on:

1. The charge mechanic in detail — how Quick Play vs Charge works, what a chain feels like
2. The FSRS learning system — why this is different from a quiz app
3. Content breadth — domains, the curated deck system, Study Temple vs Trivia Dungeon modes
4. Roguelite structure — relics, card upgrades, mastery, mystery rooms, shops
5. Ascension mode for replayability
6. Pixel art aesthetic and enemy variety

Keep paragraphs short. Use bold for key terms. No walls of text.

### Recommended Tags

**Primary (most important for discoverability):**
- Roguelike Deckbuilder
- Card Game
- Turn-Based
- Education

**Secondary:**
- Deckbuilder
- Strategy
- Roguelite
- Trivia
- Single Player

**Avoid:** Tags like "Visual Novel", "Puzzle", "Clicker" that would attract wrong-fit audiences.

---

## 6. Competitive Positioning

### Category Ownership

Recall Rogue occupies a category no other game fully owns: **combat roguelite where knowledge IS
the mechanic, not a minigame.** The key distinction from every competitor:

- Trivia games with roguelite elements (e.g., Trivia Deal): quiz answers unlock progress but cards
  are not the knowledge themselves.
- Recall Rogue: facts ARE cards. Charging a card with a correct answer IS the combat system. FSRS
  makes the learning persistent across sessions.

The pitch is not "educational game" — it is "card roguelite where learning makes you powerful."
Education is a benefit, not the positioning.

### Competitor Analysis

| Game | Reviews | Unique Hook | Presentation Style | Recall Rogue Difference |
|------|---------|-------------|-------------------|------------------------|
| Slay the Spire | 96%+ (266K reviews) | Original deckbuilder roguelike | Minimalist, card-focused character art | Adds knowledge charging and FSRS |
| Balatro | 91-93% | Poker synergies; joker escalation | Psychedelic neon pixel art | Different genre feel; knowledge is not optional |
| Inscryption | 96% (74K reviews) | Horror + deckbuilder + escape room narrative | Dark, narrative-heavy | No knowledge mechanic; story-driven |
| Monster Train | 96% (12K reviews) | Three vertical playfields; tower-defense hybrid | Colorful, high-contrast | Different structural mechanic |
| Vault of the Void | 93% (1.3K reviews) | Threat/intent prediction + preview system | Clear UI, strategic depth | No knowledge mechanic |
| Trivia Deal | Emerging | First trivia roguelite on Steam | Hand-drawn, whimsical | Recall Rogue is a full card roguelite, not trivia-with-cards |

### Positioning Rules

- **NEVER lead with "educational" or "study" framing** in any marketing copy. Lead with combat,
  power, and card mastery.
- **NEVER use "flashcard" or "Anki" language** in store copy. These signal study-app to players,
  not game.
- The library/dungeon/pixel-art aesthetic naturally avoids "textbook" associations — lean into
  the dark academic atmosphere.
- The correct frame: **"You get smarter AND more powerful at the same time."** Not: "Learn while
  you play."

---

## 7. Best Visual Assets for Showcase

These are the recommended in-game assets for use in screenshots, capsule compositing, and
trailer footage, based on visual impact and thematic clarity.

### Best Enemies for Visual Showcase

| Enemy | Why |
|-------|-----|
| Bookwyrm | Iconic; literally a worm made of books; on-theme; strong silhouette |
| Dean | Authority figure boss; intimidating; recognizable archetype |
| Headmistress | Visually imposing; clear boss energy |
| Hydra | Multi-headed spectacle; shows combat can get complex |
| Imposter Syndrome | Clever naming; relatable; memorable |
| Dunning-Kruger | Funny, memorable name; likely to be shared on social |
| Burning Question | Visually dramatic (fire + question mark); strong icon |
| Singularity | Cosmic aesthetic; impressive visual scale |
| Final Boss | Ultimate challenge signal; high visual stakes |

### Best Backgrounds

| Background | Use Case |
|-----------|----------|
| Main menu with parallax depth | Trailer establishing shots; capsule art backdrop |
| Forbidden Section mystery room | Mystery event screenshot |
| Cave ring progression (entrance → crystal → magma → library → void) | Trailer variety cuts; shows world depth |
| Camp/Hub cozy environment | Between-runs feel; Study Temple mode framing |

### Chain Color Reference (for Screenshot Curation)

| Chain | Color | Best Visual Pairing |
|-------|-------|-------------------|
| Obsidian | Black/dark gray | High contrast on light backgrounds |
| Crimson | Red | Boss encounters; high-tension moments |
| Verdant | Green | Mid-dungeon; natural/growth themes |
| Auric | Gold | Treasure rooms; relic reveals; premium feel |
| Violet | Purple | Mystery rooms; arcane/magic atmosphere |
| Lunar | Silver/white | Endgame; final ring; ethereal scenes |

---

## 8. Production Approach

### Phase 1 — Screenshots (achievable now)

1. Run dev server: `npm run dev` (port 5173)
2. Open system Chrome via Playwright (`channel: 'chrome'` — required for WebGL on macOS ARM64)
3. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
4. Use `window.__rrScenario.load('combat')` or the appropriate preset for each target state
5. Capture with `page.screenshot({ path: 'steam-screenshot-N.png', fullPage: false })`
   - Do NOT use `__rrScreenshotFile()` for final captures — it has CSS animation compositing issues
   - Do NOT use `mcp__playwright__browser_take_screenshot` — Phaser RAF blocks it
6. Light touch-up for optimal framing (crop, brightness/contrast only — no UI alterations)

Batch all 8 screenshots in one session to maintain consistent enemy and card state.

### Phase 2 — Capsule Art (needs design work)

Option A — Composite from existing assets:
- Export card art sprites and enemy sprites at full resolution from asset pipeline
- Composite in Figma, Affinity Designer, or Photoshop
- Use actual game pixel art style (no style mismatch)
- Match existing game color palette exactly

Option B — Commission custom capsule art:
- Brief: pixel art style, dark dungeon/library atmosphere, chain-color glow accents
- Reference: existing enemy and card sprites for style continuity
- Deliverables: Header Capsule (920×430), Small Capsule (462×174), Main Capsule (1232×706),
  Vertical Capsule (748×896), Hero Graphic (3840×1240)

Logo source: `/public/assets/boot/logo.png`

### Phase 3 — Trailer (most effort)

1. Install OBS Studio; set capture to 1920×1080 at 60fps
2. Record 20-30 minutes of actual gameplay across different run segments
3. Capture specifically:
   - Multiple charge → correct answer → chain sequences (target 5+ unique examples)
   - At least one 4+ chain combo with screen shake
   - 3 different boss encounters
   - 3 different mystery room events
   - Card reward picks showing interesting cards
   - At least one Surge turn sequence
4. Edit to 60-second structure (see Section 4)
5. Export at 1920×1080, H.264, 5000+ Kbps, .mp4

---

## 9. Key Metrics to Target

| Metric | Target | Rationale |
|--------|--------|-----------|
| Click-Through Rate (CTR) | 4%+ | Games above 4% receive significantly more algorithmic surfacing from Steam |
| Wishlists at launch | 7,000+ | Meaningful algorithmic lift at launch; under ~5K sees minimal boost |
| Capsule CTR proxy | High-contrast, legible at thumbnail size | Capsule gets the most impressions of any asset |
| Trailer average view time | Hold past 10 seconds | Auto-muted trailers need a visual hook in the first 5 seconds to hold attention |
| Review score (target) | 80%+ positive | Below 75% triggers "Mixed" label which halves conversion |

### Wishlist-Building Events

Steam surfaces wishlisted games at launch. Build the list before launch through:
- **Steam Next Fest** (quarterly festival; apply 2+ weeks in advance; free; huge wishlist driver)
- **Coming Soon page** — set up before any social promotion so clicks convert to wishlists
- Press/streamer demos using Steam playtest keys
- Reddit subs: r/roguelikes, r/gamedev, r/indiegaming, r/Steam
- TikTok/YouTube shorts showing the charge mechanic (it's visually distinctive)

---

## 10. Common Mistakes to Avoid

| Mistake | Why It Matters | Fix |
|---------|---------------|-----|
| Launching without a "Coming Soon" page | All pre-launch social momentum is wasted if there is no place to wishlist | Set up Coming Soon page before first public announcement |
| Static store page post-launch | Steam algorithm favors pages with recent updates | Update screenshots/description at major content updates |
| Short description that leads with genre | "A roguelite deckbuilder" tells the player nothing distinctive | Lead with the USP: "knowledge is your weapon" hook |
| Skipping Steam Next Fest | Largest free wishlist acquisition event on Steam; skipping leaves thousands of wishlists on the table | Apply every quarter until accepted |
| No localization | Steam shows country-localized pages; English-only loses EU and Asian markets | Start with top 5 Steam languages: English, German, Simplified Chinese, Spanish, French |
| Store page reads like a press release | Academic tone repels gamers; marketing tone attracts them | Benefit-focused copy, second person ("you"), active verbs |
| Capsule art repeated in first screenshot | Steam policy; also wastes the first screenshot slot | Screenshot 1 should be the charge/quiz hook, not a repeat of capsule art |
| No trailer at launch | Pages without trailers convert at significantly lower rates | Minimum: one 60-second trailer. Bonus: a shorter 15-second "capsule trailer" |
| Missing page background | Default grey Steam background looks unfinished | Upload a custom page background or ensure last screenshot makes a good tile |
| Pricing too high for a first release | Unknown indie games face resistance above $14.99 without significant press | Research competitor pricing; consider $12.99-$14.99 launch |

---

## 11. Additional Platform Considerations

### Steam Deck Compatibility

Steam Deck verification is algorithmically rewarded (badge on store page, separate category
browsing). Recall Rogue is a good candidate given:
- Turn-based (no precision timing required with controller)
- Primarily text UI (need to verify legibility at 1280×800)
- Svelte + Phaser runs in Electron/browser context (Proton-compatible)

Requirements for Verified status: controller support, proper text sizing, no launcher required,
no unsupported overlay.

### Accessibility Notes for Store Page

Steam allows tagging games with accessibility features. Consider flagging:
- Adjustable text size (if implemented)
- No time pressure on quiz (quiz timer is speed-bonus only, not a deadline — see gotchas)
- Colorblind mode (if chain colors have accessible variants)

### "Early Access" vs Full Launch Decision

Given the content depth (2,400+ facts, 84 enemies, 40 mystery rooms), a direct full launch is
reasonable. Early Access is appropriate if:
- Core loop is solid but content volume is thin
- Community feedback loops are wanted before final balance

Do NOT launch Early Access with less than 3 complete domain decks and 8+ functional ring floors.

---

## Sources

- Steamworks Documentation: `store/assets/standard`, `store/trailer`, `store/marketing/graphicassets`
- Indie Game Joe — Steam Page Optimization: Above-the-Fold Best Practices
- Steam Page Analyzer — Complete Guide to Steam Store Page Optimization
- presskit.gg — Steam Page Optimization Guide
- Game Oracle — Every Image You Need for Steam Store Page
- Noble Steed Games — Handy Guide to Graphical Assets
- Indie Game Trailers — How Long Should a Game Trailer Be
