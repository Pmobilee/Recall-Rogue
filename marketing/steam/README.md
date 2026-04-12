# Recall Rogue — Steam Store Assets

Everything needed for the Steam store page lives here. Raw source material under `source/`, finished deliverables (sized exactly to Steam's specs) under `capsules/` and `screenshots/`.

## 🗂 Checklist — cross off as you go

Tick a box when an asset is **finished and dropped in `capsules/` or `screenshots/` at the exact Steam dimensions**. Tick the Steamworks line when it's uploaded through the partner portal. Dimensions are verified against Valve's current partner UI (pasted 2026-04-11).

**Legend:** 🎨 Gemini Studio (you) · 🎮 In-game capture (me) · 🔧 Derivation / composite (either)

### Store Assets — 0/4 uploaded
- [🟡] 🔧 **Main Capsule** — `capsules/main_capsule_1232x706.png` — 1232 × 706 — **DERIVED from banner, awaiting review.** Center crop of `source/banners/banner_3584x1184.jpg`. Loses some of the stone golem's left edge and the rogue's right edge due to aggressive side crop (banner is 3:1, Main Capsule is 1.74:1). Center composition (mummy + jellyfish + rogue) intact. Caveat: "Bramblegate Games" subtitle is present — Valve allows "game artwork, game name, and any official subtitle"; studio name is borderline but commonly accepted.
- [🟡] 🔧 **Header Capsule** — `capsules/header_capsule_920x430.png` — 920 × 430 — **DERIVED from banner, awaiting review.** Center crop at 2534×1184 → resize. Looser framing than Main Capsule (aspect 2.14:1 is closer to the banner's 3.03:1). All 4 characters visible, logo + subtitle intact.
- [ ] 🎨 **Small Capsule** — `capsules/small_capsule_462x174.png` — 462 × 174 — **cannot derive from banner.** The banner's logo is only ~36% of the banner width; after cropping to 2.66:1 aspect the logo would be tiny at 462×174. Valve: "your logo should nearly fill the small capsule." Needs its own logo-dominant composition (Gemini, or composite `logo_1024` onto a simple dark background).
- [ ] 🎨 **Vertical Capsule** — `capsules/vertical_capsule_748x896.png` — 748 × 896 — portrait, pairs with Library Capsule. No usable source; needs fresh Gemini generation.
- [ ] 🎮 **Page Background** (optional) — `capsules/page_background_1438x810.png` — 1438 × 810 — ambient combat scene; Steam tints blue. Will be captured in-game later.
- [ ] Uploaded to Steamworks (Store Assets section)

### Screenshot Assets — 0/5 uploaded (min 5 required)
- [ ] 🎮 **S1 — Combat hero shot** — `screenshots/screenshot_01_combat.png` — 1920 × 1080 — mid-combat, full hand, enemy visible
- [ ] 🎮 **S2 — Chain combo moment** — `screenshots/screenshot_02_chain.png` — 1920 × 1080 — combo mid-play, multiplier on, particles
- [ ] 🎮 **S3 — Quiz panel** ⭐ — `screenshots/screenshot_03_quiz.png` — 1920 × 1080 — the game's unique hook
- [ ] 🎮 **S4 — Dungeon map** — `screenshots/screenshot_04_map.png` — 1920 × 1080 — branching floor nav, communicates roguelite
- [ ] 🎮 **S5 — Card reward** — `screenshots/screenshot_05_reward.png` — 1920 × 1080 — post-combat "choose 1 of 3"
- [ ] 🎮 **S6 — Boss encounter** (bonus) — `screenshots/screenshot_06_boss.png` — 1920 × 1080
- [ ] 🎮 **S7 — Shop or Rest** (bonus) — `screenshots/screenshot_07_node.png` — 1920 × 1080
- [ ] Mark 4+ as "suitable for all ages" in Steamworks UI
- [ ] Uploaded to Steamworks (Screenshot Assets section)

### Library Assets — 0/5 uploaded
- [ ] 🎨 **Library Capsule** — `capsules/library_capsule_600x900.png` — 600 × 900 — portrait, "depict something important." No usable source; needs fresh Gemini portrait generation (can share session with Vertical Capsule).
- [🟡] 🔧 **Library Header** — `capsules/library_header_920x430.png` — 920 × 430 — **DERIVED, awaiting review.** Copy of `header_capsule_920x430.png` (identical dimensions; Valve explicitly says the same file can serve both slots).
- [ ] 🎨 **Library Hero** — `capsules/library_hero_3840x1240.png` — 3840 × 1240 — wide panoramic, **no text/logo**, 860 × 380 safe area at center. **Our banner is disqualified as source** because Valve forbids text/logo on the hero and our banner has "RECALL ROGUE" + "Bramblegate Games" baked in. Needs fresh Gemini generation (text-free panoramic).
- [🟡] 🔧 **Library Logo** — `capsules/library_logo_720x720.png` — 720 × 720 transparent PNG — **DERIVED from `source/logos/logo_1024.png`, awaiting review.** Black background removed via floodfill alpha extraction (fuzz 12%), resized to 720×720 square. Satisfies Valve's "720 tall" requirement. **Concerns:** (a) square framing wastes horizontal space in the 3840×1240 hero bottom-left pin position — a wide wordmark variant would sit better, (b) if the floodfill ate any interior dark shadows, we regenerate with lower fuzz. Open the file and check before accepting.
- [ ] 🔧 **Placement Tool** — configure logo position (bottom-left default) + max scale in Steamworks UI after Hero+Logo upload.
- [ ] Uploaded to Steamworks (Library Assets section)

### Broadcast Assets — 0/2 (SUGGESTED, skippable for launch)
- [ ] ⏭ **Broadcast Panel Left** — 199 × 433 — only if we ever do a Steam broadcast
- [ ] ⏭ **Broadcast Panel Right** — 199 × 433 — same
- [ ] Skip for launch; revisit post-launch

### Other Steam submission items (text, not images — reminders so they don't slip)
- [ ] Short description (≤300 chars), humanizer pass per `.claude/rules/human-prose.md`
- [ ] Long description (store page body)
- [ ] Tags: Card Game, Roguelite, Education, Deckbuilder, Turn-Based (request from Valve)
- [ ] Trailer video (30s–3min, recommended, separate upload path in Steamworks)
- [ ] Age-rating questionnaire
- [ ] Client icon `.ico` (32×32) — separate from store assets, handled by `steam-deploy` skill

---


## Folder layout

```
marketing/steam/
├── README.md              ← this file (canonical sizes, inventory, plan)
├── SPEC.md                ← per-asset art direction
├── source/                ← raw material, not shipped to Steam
│   ├── banners/           ← hero-candidate wide panoramics
│   ├── logos/             ← square logos, icons
│   ├── backgrounds/       ← in-game biome atmospherics
│   └── ORIGINAL-prompts.md ← original marketing art spec from the site repo
├── capsules/              ← final PNGs sized to Steam spec (empty — TODO)
└── screenshots/           ← 1920×1080 gameplay captures (empty — TODO)
```

## Steam asset requirements — canonical (from Steamworks partner UI, pasted 2026-04-11)

**Store Assets (4 required + 1 optional)**

| Asset | Dimensions | Aspect | Where it shows | Required? |
|---|---|---|---|---|
| **Header Capsule** | **920 × 430** | ~2.14:1 | Top of store page, recommended carousels, client grid view, Big Picture browse, daily deals | ✅ Required |
| **Small Capsule** | **462 × 174** | ~2.66:1 | All list views: search results, top-sellers, new releases. **Logo must nearly fill the capsule.** | ✅ Required |
| **Main Capsule** | **1232 × 706** | ~1.74:1 | Featured & Recommended carousel on front page | ✅ Required |
| **Vertical Capsule** | **748 × 896** | ~0.83:1 | Front page during seasonal sales, other sale pages | ✅ Required |
| **Page Background** | 1438 × 810 | 16:9 | Behind your store page; Steam auto-tints blue + fades edges | Optional (Steam auto-generates if omitted) |

**Screenshot Assets** — minimum 5, 1920×1080 PNG/JPG, 16:9, pure gameplay. No menus unless the menu is "a unique component of your game." Four must be marked **suitable for all ages** if you have mature content.

**Library Assets (5 required)**

| Asset | Dimensions | Purpose | Notes |
|---|---|---|---|
| **Library Capsule** | **600 × 900** | Library overview & collection portrait tile | Key art + logo; half-size 300×450 auto-generated |
| **Library Header** | **920 × 430** | Steam client library (Recent Games, etc.) | If not set, Header Capsule is used. Same dimensions — one master can serve both. |
| **Library Hero** | **3840 × 1240** | Parallax background at the top of the library detail page | **No text or logos** — logo is a separate asset. **Safe area: center 860 × 380** (nothing critical outside it — it gets cropped at narrow window widths). Half-size 1920×620 auto-generated. |
| **Library Logo** | **1280 wide AND/OR 720 tall**, transparent PNG | Overlaid on Library Hero with parallax scroll | Either-or dimension (flexible aspect). Must be legible on the hero; drop shadow helps. Placement tool lets you pin to bottom-left / center-top / center-middle / center-bottom — bottom-left is the default. |
| **Placement Tool** | — | Configures Library Logo position + max scale | Not an asset — done in the Steamworks UI after upload |

**Broadcast Assets (suggested, not required)** — two panels at 199 × 433 each (left and right of the live-broadcast video on your store page). Skippable for launch; revisit if we ever do a Steam broadcast.

**Filename localization:** Append the Steam API language code before the extension to auto-assign the language. `capsule_sm_english.png`, `capsule_sm_schinese.png`, `capsule_sm_japanese.png`, etc. Recall Rogue ships in EN first; other locales come later.

**Spec source:** All numbers and per-asset design language above are quoted verbatim from the Steamworks partner UI (Graphical Assets + Library Asset Guidelines pages, pasted 2026-04-11). Per-asset Valve quotes and deeper art direction are in `SPEC.md`. When Valve revises the partner UI, update both files — the partner UI is the source of truth, not any third-party article or older Valve docs.

## Source inventory (already copied from `../recall_rogue_site/`)

### Wide banners (Library Hero candidates)
- `source/banners/banner_3584x1184.jpg` — 3584×1184 JPEG (~3.03:1), from site `public/assets/banner.jpg`. **Closest to the 3840×1240 Library Hero target** — 93% of target width. Needs ~7% upscale and letterbox pad.
- `source/banners/banner_3584x1184.webp` — same content, WebP.
- `source/banners/twitter_banner_3584x1184.jpg` — alt version, identical dimensions.
- `source/banners/banner_bg_3168x1344.jpg` — 3168×1344 (~2.36:1). Rougher aspect. Usable as crop source for Header / Main Capsules or Page Background.

### Logos
- `source/logos/logo_1024.png` — 1024×1024 PNG with alpha. **Primary source for Library Logo.**
- `source/logos/logo_1024.jpg` — same, no alpha. Fallback.
- `source/logos/apple-touch-icon.png`, `icon-192.png`, `favicon.ico` — smaller derivatives.

### Biome atmospherics (reference / backdrops)
Seven in-game biome WebPs at ~720p. Too small to be direct capsule assets but useful as composition reference or background-layer source in a composite.
- `bg_shallow.webp`, `bg_combat_dungeon.webp`, `bg_archive.webp`, `bg_abyss.webp`
- `bg_shadow_hydra.webp`, `bg_mantle_dragon.webp`, `bg_salt_wraith.webp`

### Original spec
`source/ORIGINAL-prompts.md` — the marketing art spec that was already drafted in the site repo. Style prompts are still good (system prompt calibrates the game's palette and aesthetic), but **its target dimensions are outdated** (it lists older sizes that got superseded in Valve's current partner UI). Use the canonical table above, not this file, for sizing.

## Production plan — Gemini Studio vs in-game capture

Your ask was to split this between **"I generate in Gemini Studio"** and **"we produce together from the running game."** Here's the split I'd recommend:

### 🎨 Gemini Studio — polished key art (7 deliverables)
These are the illustrated, marketing-quality pieces. They're all key-art compositions: logo + dungeon scene + game's palette. Best done in one session with consistent style prompts, then resized/cropped into each target. I can hand you the exact Gemini prompts (calibrated to our game's aesthetic — warm cave browns, teal-cyan crystals, gold knowledge accents, purple arcane magic).

| # | Asset | Dimensions | Strategy |
|---|---|---|---|
| 1 | **Main Capsule** | 1232×706 | Master key-art piece. Biggest capsule, most visible. Start here — everything else derives from it. |
| 2 | **Header Capsule** = **Library Header** | 920×430 | Horizontal crop/recompose from the Main Capsule key art. One file serves both slots. |
| 3 | **Small Capsule** | 462×174 | **Logo-dominant.** Different treatment — nearly all logo, minimal background. Not a crop of the Header. |
| 4 | **Vertical Capsule** | 748×896 | Portrait recompose. Needs separate generation or heavy re-layout from the Main Capsule. |
| 5 | **Library Capsule** | 600×900 | Portrait, similar to Vertical Capsule. Can share a Gemini session with #4. |
| 6 | **Library Hero** | 3840×1240 | Wide panoramic, **no text/logo**, 860×380 safe area at center. Our `banner_3584x1184.jpg` is the closest existing source — either upscale and extend it, or regen cleanly. |
| 7 | **Library Logo** | transparent PNG, 1280w and/or 720t | The wordmark with drop shadow, alpha background. Extract from `logo_1024.png` or redesign in Gemini. |

**Prompt kit:** I'll draft a Gemini-Studio-ready prompt pack at `source/GEMINI-PROMPTS.md` that has (a) a shared system prompt calibrating style, (b) per-asset scene direction, (c) the exact target dimensions, and (d) a legibility checklist for each. You paste + tweak; we iterate on output together before anything lands in `capsules/`.

### 🎮 Our game + Docker visual-test harness (6–8 deliverables)
These are authentic gameplay captures. Steam's rules explicitly require that Screenshots show gameplay, not marketing renders — **the game's screenshot folder must not contain recomposed key art.** We have excellent in-house tooling for this: `scripts/docker-visual-test.sh --warm` + `__rrScenario.load()` + `__rrScreenshotFile()` captures at 1920×1080 with full WebGL.

| # | Asset | Source | Scenario/state |
|---|---|---|---|
| S1 | **Hero screenshot** — combat with full hand | in-game capture | Mid-combat, 5-card hand laid out, enemy visible, HP bar full, chain counter on. |
| S2 | **Chain combo / big turn** | in-game capture | Combo mid-play — chain multiplier displayed, damage number popping, particles. Shows the payoff moment. |
| S3 | **Quiz panel close-up** ⭐ | in-game capture | The quiz-answer overlay mid-question. **This is the game's unique hook** — must be in the lineup. Menu-screen rule doesn't apply here because quiz IS gameplay. |
| S4 | **Map / dungeon descent** | in-game capture | The floor/map screen showing the branching dungeon path. Communicates roguelite genre instantly. |
| S5 | **Card reward selection** | in-game capture | Post-combat "choose 1 of 3" card reward overlay. Communicates deckbuilder genre. |
| S6 | **Boss encounter** (bonus) | in-game capture | Boss reveal or mid-fight with a large enemy sprite. Use one of the existing bosses (shadow hydra / mantle dragon / salt wraith). |
| S7 | **Shop or Rest** (bonus) | in-game capture | Rogue-like node variety. Pick whichever reads better visually. |
| **PB** | **Page Background** | in-game capture (optional) | Combat scene that looks good once Steam tints it blue + fades edges. Ambient, no high contrast, no text-heavy UI in the center. If we skip, Steam auto-picks one of our screenshots. |

**How we capture:**
```bash
scripts/docker-visual-test.sh --warm start --agent-id steam-screens
# For each shot: write an actions JSON that loads a scenario, waits ≥5s,
# then calls __rrScreenshotFile('/tmp/rr-docker-visual/.../screenshot.png')
scripts/docker-visual-test.sh --warm test --agent-id steam-screens --actions-file /tmp/shot-01.json
# ... repeat ...
scripts/docker-visual-test.sh --warm stop --agent-id steam-screens
```

I'll drive this via the `visual-inspect` / `scenario-playtest` skills once we're ready. Files land in `screenshots/` named `screenshot_01_combat.png`, etc.

### Reuse chart (what shares a master)

- Header Capsule **=** Library Header → 920×430 — **one file, two slots**
- Main Capsule → Header Capsule → Small Capsule — **horizontal derivative family** (same master, three crops)
- Vertical Capsule ≈ Library Capsule → **portrait family** (same Gemini session, two outputs at different aspects)
- Library Hero stands alone (wide panoramic, no logo)
- Library Logo stands alone (transparent PNG)

So the **minimum distinct Gemini generation targets** are: Main Capsule (horizontal master) + one portrait (Vertical + Library Capsule share) + Library Hero + Library Logo = **4 distinct Gemini sessions**. Everything else is a crop/recompose.

## Priority order (what to tackle first)

1. **Gemini: Main Capsule (1232×706).** Largest, most visible, master for 3 capsule derivatives. Start here.
2. **Gemini: Library Hero (3840×1240).** Second most visible, standalone. Hand you the prompt; our `banner_3584x1184.jpg` is the closest existing source if you want to iterate from it.
3. **Gemini: Library Logo (transparent PNG).** Cheap — mostly a wordmark pass. Unlocks hero preview.
4. **In-game: core 5 screenshots (S1–S5).** I run the Docker harness, capture all five in one warm-container session. Cheap once we have good scenarios picked.
5. **Gemini: portrait family (Vertical + Library Capsule).** Batch together — one portrait Gemini session, two crops.
6. **Derive: Header Capsule + Small Capsule + Library Header** from the Main Capsule master. Done in-repo, no new Gemini session.
7. **Optional: Page Background + bonus screenshots S6/S7.** Polish pass.
8. **Skip for launch: Broadcast panels.** Revisit when we do our first Steam broadcast.

## Gap analysis — current state vs target

| Asset | Target | Status | Next step |
|---|---|---|---|
| Main Capsule 1232×706 | required | ❌ | Gemini session #1 (master) |
| Header Capsule 920×430 | required | ❌ | Derive from Main master |
| Small Capsule 462×174 | required | ❌ | Gemini logo-dominant OR derive from Header |
| Vertical Capsule 748×896 | required | ❌ | Gemini portrait session #2 |
| Library Capsule 600×900 | required | ❌ | Derive from portrait master |
| Library Header 920×430 | required | ❌ | Reuse Header Capsule (same dimensions) |
| Library Hero 3840×1240 | required | 🟡 close source | Gemini session #3 OR upscale `banner_3584x1184` |
| Library Logo transparent | required | 🟡 close source | Gemini session #4 OR extract from `logo_1024.png` |
| Page Background 1438×810 | optional | ❌ | In-game capture (later) |
| Screenshots ×5+ | required | ❌ | In-game capture session (6–8 shots) |
| Broadcast panels ×2 | suggested | ❌ | Skip for launch |

## Where Steam uploads happen

`steam-deploy` skill handles the client build side; **store-page and library assets are uploaded separately** through the Steamworks partner site under **App Admin → Store Presence → Graphical Assets** (and **Library Assets** alongside). There's no CLI for this — once a batch of finished capsules lives in `capsules/`, you drag-drop them into the Steamworks UI by hand. Steam auto-categorizes by dimension when dropped in.

## What I need from you next

Pick one:
- **(A)** "Draft the Gemini prompt pack." → I write `source/GEMINI-PROMPTS.md` with four ready-to-paste prompts + style calibration + legibility notes. You run them in Gemini Studio and drop outputs into `capsules/`.
- **(B)** "Start the screenshot session." → I spin up the Docker warm container, plan the six scenarios, and capture S1–S5 tonight. You review.
- **(C)** "Both, in parallel." → I write the prompt pack AND run the screenshot session. You handle Gemini on your side while I produce the in-game captures on mine.

Recommend **(C)** — fastest path to having something reviewable in every slot.
