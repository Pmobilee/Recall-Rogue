# Steam Store Asset Specifications — Art Direction

**Canonical sizes, inventory, and production split: see `README.md`. This file is the per-asset deep dive: what each slot is for, where Steam shows it, what Valve's own UI says about the design intent, and Recall-Rogue-specific notes.**

All numeric specs and "Design"/"Usage" language below are quoted from the Steamworks partner UI as pasted on 2026-04-11. If Valve revises the partner UI, update this file — it's the source of per-asset truth for the repo.

---

## Store Assets

### Header Capsule — 920 × 430 ✳ Required
**Valve — Design:** "This image should focus on the branding of your product. For best results, please use the same artwork that you use for any retail box or marketing and make sure the logo is clearly legible."
**Valve — Usage:** "It will appear at the top of your page in the store, in the 'recommended for you' section, in 'grid view' in customers libraries in the Steam client, in browse views on Big Picture mode, and for daily deals if applicable."

**Recall Rogue notes:**
- Logo must be clearly legible even when scaled down by Steam's layout
- Dungeon key art as background, warm cave brown → teal crystal gradient
- No subtitle text, no review quotes, no "Coming Soon" — Valve explicitly forbids those on base assets
- **Reusable as Library Header (same 920×430)** — one master, two slots

### Small Capsule — 462 × 174 ✳ Required
**Valve — Design:** "These are small, so they should focus on making the logo clearly legible, even at the smallest size."
**Valve — Usage:** "These are used for all the lists throughout Steam. Search results, top-sellers, new releases, etc."
**Valve — Requirements:** "Small Capsule should contain readable logo, even at smallest size. In most cases, this means your logo should nearly fill the small capsule."

**Recall Rogue notes:**
- Nearly 100% logo at this aspect ratio — don't try to cram card art in
- Legibility trumps every other design choice here
- Background should be solid/simple dark tone so the logo pops
- **Don't** just crop the Header Capsule — the logo needs to be larger/recomposed for this tiny size

### Main Capsule — 1232 × 706 ✳ Required
**Valve — Design:** "These should be designed to market the product. For best results, please use the key art and logo that is being used for any retail boxes or marketing. Do not include quotes, review scores, or awards."
**Valve — Usage:** "These appear at the top of the front page in the featured and recommended carousel."

**Recall Rogue notes:**
- The **most visible asset** — front-page carousel placement. Highest production priority.
- Full key-art composition: logo + dungeon scene + atmospheric lighting + hero card or character if possible
- Mood: dark, atmospheric, knowledge-powered card roguelite. Warm cave browns left, deeper teal/purple right (mirrors the game's depth progression)
- Acts as the **master file** — Header Capsule and Small Capsule can be derived from crops/recomposes of this

### Vertical Capsule — 748 × 896 ✳ Required
**Valve — Design:** "This is a vertical asset that is designed to market your game. For best results, please use the key art and logo that is being used for any retail boxes or marketing. Do not include quotes, review scores, or awards."
**Valve — Usage:** "These can appear at the top of the front page during seasonal sales, and on other new sale pages."

**Recall Rogue notes:**
- Portrait — 0.83:1 — the only capsule that isn't landscape
- Logo top-third, key art bottom two-thirds (vertical dungeon descent reads well in this ratio)
- Needs fresh composition; horizontal key art doesn't re-frame cleanly into portrait
- **Pairs with Library Capsule (600×900)** — same portrait orientation, similar composition, can share a Gemini session

### Page Background — 1438 × 810 (Optional)
**Valve — Design:** "This should be ambient so as not to compete with the content on the page, so try to avoid high-contrast images or images with lots of text. A template will automatically be applied to your uploaded file, which will tint it blue and fade out the edges. If you don't upload an image here, we'll automatically take a random screenshot and generate a background image from that."
**Valve — Usage:** "This is the image that will be used in the background of your store page."

**Recall Rogue notes:**
- Steam tints the upload blue and fades edges automatically — don't compensate for it
- Best produced as an **in-game capture** of an atmospheric combat or map scene (ambient, low-contrast, no text-heavy UI in the center)
- Skippable — if we omit it, Steam picks a random screenshot. Providing one is polish.

---

## Screenshots — 1920 × 1080 minimum, 16:9 ✳ Required, minimum 5

**Valve — Design:** "Select screenshots that clearly show off the player perspective and gameplay in action. Select screenshots that clearly communicate the genre of your game. Showing HUD elements typically help communicate that to players pretty quickly. Avoid menu screens."
**Valve — Formatting:** "Should be high-res, widescreen format (16:9 aspect ratio) and at least 1920px x 1080px."
**Valve — Requirements:** "Screenshots should exclusively show the gameplay of your game. This means avoiding using concept art, pre-rendered cinematic stills, or images showing awards, marketing copy, written descriptions, and so on. Please show customers what your game is actually like to play. **Menu screens should only be included if they are a unique component of your game.**"

**Recall Rogue notes:**
- **Quiz panel counts as gameplay, not a menu.** Quiz is the game's core mechanic, not a settings screen. The "unique component" carve-out protects it.
- Show HUD (cards in hand, HP, chain counter, status effects) — it helps communicate deckbuilder + roguelite + educational genres at a glance
- Shot plan lives in `README.md` → Production plan → In-game capture table (S1–S7)
- Mark at least 4 shots as "suitable for all ages" (we have no mature content, but it gates visibility in safe-for-work placements)

---

## Library Assets

### Library Capsule — 600 × 900 ✳ Required
**Valve — Design:** "This should be graphically-centric and give the user some sense of the experience. Please use the key art that is being used for any retail boxes or marketing as well as the name of your game, ideally using the same logo / title as printed on any retail or marketing. Do not include quotes, marketing copy, or other strings of text beyond the title of your application. The art should depict something important about your product. The logo should be easily legible against the background."
**Valve — Usage:** "This image is primarily used in the library overview and collection views."
**Valve — Note:** An additional half-size 300×450 PNG is auto-generated.

**Recall Rogue notes:**
- Portrait, similar to Vertical Capsule — can share a Gemini session
- Must depict "something important about the product" — i.e. a scene that shows the core fantasy, not just atmosphere
- Logo legible against the background, not overlaid in a dead corner

### Library Header — 920 × 430 ✳ Required
**Valve — Design:** "This image should focus on the branding of your product. For best results, please use similar artwork to the Library Capsule and make sure the logo is clearly legible."
**Valve — Usage:** "Appears in various places in the Steam Client Library, including Recent Games. If not set, then the Header Capsule is used."

**Recall Rogue notes:**
- **Identical dimensions to Header Capsule.** Reuse one master file for both.
- Valve recommends matching the Library Capsule's art style — the Library tile and its header should feel like a set

### Library Hero — 3840 × 1240 ✳ Required
**Valve — Design:** "This should be a visually rich image that is easily recognizable. For best results, please use the key art that is used for any retail boxes or marketing. Do not include quotes or other strings of text. At the center of the template is a 'safe area' of **860px × 380px**. This area will remain uncropped across scaling and resizing of the Steam client window. Artwork should extend across the entire template, but critical content should be within the safe area. Library Hero image **should not contain any text or logos.** Your logo to display at the top of your library detail page should be uploaded separately in the Library Logo file."
**Valve — Usage:** "Appears at the top of a user's library details page for this product."
**Valve — Note:** Half-size 1920 × 620 PNG auto-generated.

**Recall Rogue notes:**
- **🚨 No text, no logos in the hero itself** — they're a separate layer (Library Logo) with parallax scroll
- **860 × 380 safe area at center** — main character/focal imagery must live entirely inside this box or risk getting cropped at narrow window widths
- Wide panoramic — warm cave entry on left, deeper biomes on right reads well (mirrors the dungeon descent)
- **Closest existing source:** `source/banners/banner_3584x1184.jpg` — 93% of target width, needs ~7% upscale + letterbox pad. Verify the banner has no text/logo baked in before using it (if it does, regen fresh)

### Library Logo — 1280 wide AND/OR 720 tall, transparent PNG ✳ Required
**Valve — Design:** "For best results, use the logo that is being used for any retail boxes or marketing. You'll want to ensure the logo is both visible and legible against the hero graphic background, sometimes a drop shadow can help. The PNG image should have a transparent background. You should use the best aspect ratio for your art, however the logo must be either 1280px wide and/or 720px tall."
**Valve — Usage:** "Appears at the top of a user's library details page for this product, placed on top of the hero graphic."
**Valve — Note:** "If a hero graphic and logo are not uploaded, the hero area will display a screenshot from the store, with the application name in text overlaid in the bottom left corner."

**Recall Rogue notes:**
- **Either 1280 wide OR 720 tall — not both.** Aspect ratio is flexible. Pick whichever dimension our wordmark wants.
- Logo-only, no screenshots, no character art, no marketing copy
- **Drop shadow recommended** — Steam's own UI tip. Helps legibility against variable hero backgrounds.
- **Closest existing source:** `source/logos/logo_1024.png` (square, 1024×1024, has alpha). May need recomposing — square logos waste vertical space in a 1280×720-ish canvas; a wordmark variant is better.

### Placement Tool (configured in Steamworks UI, not an asset)
**Valve:** Configures where the Library Logo pins on the hero — bottom-left, center-top, center-middle, or center-bottom — and the logo's max scale (blue bounding box limits both max width relative to hero and max height).

**Recall Rogue notes:**
- **Default to bottom-left** per Valve's recommendation
- Consider center-bottom if our hero's left side has important art (e.g. a character in the lower-left safe area)
- Play with the scale bounding box once uploaded — logo should not overlap critical hero art or dominate when the window scales up

---

## Broadcast Assets — 2 × (199 × 433), Suggested (not required)

**Valve — Design:** "The live broadcast will appear on the store page above the trailer and the screenshot section. The broadcast video is smaller than the width of the store page. It is centered with customizable artwork space on the left and right of the video. To customize with your own artwork, drag & drop images at the top of this page and choose the 'broadcast panel' and the right/left direction."
**Valve — Requirements:** "No custom artwork available (requires both left and right panels)."

**Recall Rogue notes:**
- Only matters if we ever run a Steam broadcast (live Twitch/YouTube-style stream on the store page)
- **Skip for launch.** Revisit post-launch if broadcasting becomes relevant.

---

## Technical Requirements (all assets)
- PNG files must be RGB or RGBA — **no indexed color**. Steam rejects paletted PNGs.
- JPEG is accepted but PNG is preferred ("For best results, please upload .png files")
- File size: Steam's upload limit is generous (~5 MB per asset is safe; larger may be accepted but compress first)
- **No age ratings, no review scores, no "Coming Soon" banners** on base graphical assets — Valve overlays those dynamically and treats them as Artwork Overrides if you want to promote an event
- **Localization:** append the Steam API language code before the extension (`capsule_sm_english.png`, `capsule_sm_schinese.png`, `capsule_sm_japanese.png`). Full code list: Valve's "Localization and Languages Documentation" → "API language code" column
- Recall Rogue ships English at launch. Localized capsules come later.

## Photoshop templates
Valve provides official Photoshop templates for every asset size on Dropbox (linked from the partner UI as "Download Photoshop templates"). When we move into final composition, pull those first — they have the exact canvases, safe areas, and bleed marks pre-set. Link is in the Steamworks partner UI under each asset; we don't need to mirror it in-repo.

## Steam store description (text, not an image — reference only)
Short description (up to 300 chars) — **needs humanizer pass before submission** per `.claude/rules/human-prose.md`. Current working draft:

> "A card roguelite where every card is a fact. Answer questions to unleash powerful combos, build knowledge-powered decks, and delve ever deeper into procedurally generated dungeons. Learning IS the game."

Tags to request: Card Game, Roguelite, Education, Deckbuilder, Turn-Based.
