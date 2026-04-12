/**
 * generate-steam-images.mjs
 *
 * Generates 6 static PNG images for the Steam store page "About This Game" section.
 * Uses Playwright to screenshot HTML sections rendered in a headless Chrome browser.
 *
 * Usage: node scripts/generate-steam-images.mjs
 * Output: steam/store-images/*.png + steam/store-images/banner.webp
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'steam', 'store-images');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Absolute file:// paths ──────────────────────────────────────────────────
const ENEMY = (name) => `file://${PROJECT_ROOT}/public/assets/sprites/enemies/${name}`;
const ICON  = (name) => `file://${PROJECT_ROOT}/public/assets/sprites/icons/${name}`;
// ── HTML ────────────────────────────────────────────────────────────────────
function buildHTML() {
  const enemies = [
    { name: 'The Final Lesson', sprite: ENEMY('final_lesson_idle.png'), desc: 'Boss. Quiz phases at 66% and 33% HP. Wrong answers make it permanently stronger.' },
    { name: 'The Curriculum', sprite: ENEMY('curriculum_idle.png'), desc: 'Boss. Immune to quick plays at half health. Only charged knowledge gets through.' },
    { name: 'The Textbook', sprite: ENEMY('textbook_idle.png'), desc: 'Mini-boss. Hardcover armor. Correct answers crack it. Wrong answers reinforce it.' },
    { name: 'Pop Quiz', sprite: ENEMY('pop_quiz_idle.png'), desc: 'Stunned by correct answers. Grows permanently stronger if you skip the questions.' },
    { name: 'The Helicopter Parent', sprite: ENEMY('helicopter_parent_idle.png'), desc: 'Mini-boss. Shields you from damage — and from growing. Blocks your card upgrades.' },
    { name: 'The Trick Question', sprite: ENEMY('trick_question_idle.png'), desc: 'Wrong answers heal it and lock that fact card for 2 turns.' },
  ];

  const relics = [
    { name: 'Volatile Core', icon: ICON('icon_relic_volatile_core.png'), desc: 'All attacks +50%. Wrong answers deal 3 damage to you.' },
    { name: 'Soul Jar', icon: ICON('icon_relic_soul_jar.png'), desc: '5 correct answers stores 1 charge. Spend it to auto-succeed any quiz.' },
    { name: 'Mirror of Knowledge', icon: ICON('icon_relic_mirror_of_knowledge.png'), desc: 'After a correct Charge, replay card at 1.5× — no quiz, no AP cost.' },
    { name: 'Prismatic Shard', icon: ICON('icon_relic_prismatic_shard.png'), desc: 'All chain multipliers +0.5×. 5-chains grant +1 AP.' },
    { name: 'Chain Reactor', icon: ICON('icon_relic_chain_reactor.png'), desc: 'Chains of 2+ deal 6 splash damage per link.' },
    { name: 'Chain Forge', icon: ICON('icon_relic_chain_forge.png'), desc: 'Once per fight, saves a broken chain and keeps the multiplier.' },
    { name: 'Time Warp', icon: ICON('icon_relic_time_warp.png'), desc: 'Surge turns: timer halved, but 5× charge multiplier and +1 AP.' },
    { name: "Scholar's Gambit", icon: ICON('icon_relic_scholars_gambit.png'), desc: '+1 relic slot. Wrong Charged answers deal 1 self-damage.' },
    { name: "Scholar's Crown", icon: ICON('icon_relic_scholars_crown.png'), desc: '+40% damage on review queue facts. +10% on all other correct Charges.' },
    { name: 'Double Down', icon: ICON('icon_relic_double_down.png'), desc: 'Two quizzes, one card. Both right: 5× power. Both wrong: 0.3×.' },
    { name: 'Quick Study', icon: ICON('icon_relic_quick_study.png'), desc: '3+ correct Charges: preview 1 answer. Wrong answers hurt more.' },
    { name: 'Insight Prism', icon: ICON('icon_relic_insight_prism.png'), desc: 'Wrong answers reveal the correct answer. Next time, auto-succeed.' },
  ];

  const dialogues = [
    { enemy: 'The Singularity', sprite: ENEMY('singularity_idle.png'), quote: '"I am the end of human learning."' },
    { enemy: "Devil's Advocate", sprite: ENEMY('devils_advocate_idle.png'), quote: '"Everything you say is wrong — watch me prove it."' },
    { enemy: 'The Institution', sprite: ENEMY('institution_idle.png'), quote: '"I am the system. The system cannot break."' },
    { enemy: 'Moth of Enlightenment', sprite: ENEMY('moth_of_enlightenment_idle.png'), quote: '"Knowledge is a light — come burn with me."' },
    { enemy: 'The Lost Thesis', sprite: ENEMY('lost_thesis_idle.png'), quote: `"I've already thought through every scenario. You're in one of them."` },
  ];

  const domains = [
    { name: 'History',            color: '#D4A44A', decks: 'Ancient Greece · WWII · US Presidents' },
    { name: 'Science',            color: '#2A9D8F', decks: 'Periodic Table · AP Biology · AP Physics' },
    { name: 'Languages',          color: '#6B4C9A', decks: 'Japanese N5-N1 · Spanish A1-C2 · French' },
    { name: 'Geography',          color: '#4A90D9', decks: 'World Capitals · Countries · World Flags' },
    { name: 'Art & Culture',      color: '#D4766C', decks: 'Famous Paintings · Music History · Literature' },
    { name: 'Mythology',          color: '#8B6914', decks: 'Greek · Norse · Egyptian Mythology' },
    { name: 'Games',              color: '#4CAF50', decks: 'Chess Tactics (620K+ puzzles) · Anime & Manga' },
    { name: 'Health & Medicine',  color: '#E74C3C', decks: 'Human Anatomy · Medical Terminology · Pharmacology' },
    { name: 'General Knowledge',  color: '#9A9590', decks: 'Pop Culture · Movies & Cinema · Famous Inventions' },
    { name: 'AP Exams',           color: '#F0C75E', decks: '12 AP subjects covered' },
  ];

  const hex2rgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return /* html */`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --gold: #d4a44a;
    --gold-bright: #f0c75e;
    --gold-dim: #8a6d2b;
    --bg-deep: #0a0a0f;
    --bg-card: #12121a;
    --text: #e8e4dc;
    --text-dim: #9a9590;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: transparent; font-family: 'Inter', sans-serif; }

  /* ── Shared panel style ── */
  .glass-panel {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  /* ══════════════════════════════════════════════
     SECTION 1 — ENEMY SHOWCASE  1560 × 1100
  ══════════════════════════════════════════════ */
  #enemy-showcase {
    width: 1560px;
    height: 1100px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    gap: 24px;
  }
  #enemy-showcase .section-title {
    font-family: 'Cinzel', serif;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  #enemy-showcase .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 20px;
    width: 100%;
    flex: 1;
  }
  #enemy-showcase .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    transition: none;
  }
  #enemy-showcase .card img {
    height: 180px;
    max-width: 180px;
    image-rendering: pixelated;
    object-fit: contain;
  }
  #enemy-showcase .card .name {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    font-weight: 600;
    color: var(--gold);
    text-align: center;
  }
  #enemy-showcase .card .desc {
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    color: var(--text-dim);
    text-align: center;
    line-height: 1.4;
  }

  /* ══════════════════════════════════════════════
     SECTION 2 — RELIC GRID  1560 × 1200
  ══════════════════════════════════════════════ */
  #relic-grid {
    width: 1560px;
    height: 1200px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 20px;
  }
  #relic-grid .section-title {
    font-family: 'Cinzel', serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  #relic-grid .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 16px;
    width: 100%;
    flex: 1;
  }
  #relic-grid .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  #relic-grid .card img {
    width: 80px;
    height: 80px;
    image-rendering: pixelated;
    object-fit: contain;
    flex-shrink: 0;
  }
  #relic-grid .card .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  #relic-grid .card .name {
    font-family: 'Cinzel', serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--gold);
    line-height: 1.2;
  }
  #relic-grid .card .desc {
    font-family: 'Inter', sans-serif;
    font-size: 0.75rem;
    color: var(--text-dim);
    line-height: 1.4;
  }

  /* ══════════════════════════════════════════════
     SECTION 4 — DIALOGUE SHOWCASE  1560 × 900
  ══════════════════════════════════════════════ */
  #dialogue-showcase {
    width: 1560px;
    height: 900px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    padding: 40px 48px;
    gap: 20px;
  }
  #dialogue-showcase .section-title {
    font-family: 'Cinzel', serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
    align-self: flex-start;
  }
  #dialogue-showcase .strip {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 24px;
    flex: 1;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 12px;
    padding: 16px 24px;
  }
  #dialogue-showcase .strip img {
    width: 100px;
    height: 100px;
    image-rendering: pixelated;
    object-fit: contain;
    flex-shrink: 0;
  }
  #dialogue-showcase .bubble {
    flex: 1;
    background: var(--bg-card);
    border-left: 3px solid var(--gold-dim);
    border-radius: 0 8px 8px 0;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  #dialogue-showcase .bubble .quote {
    font-family: 'Inter', sans-serif;
    font-size: 1.05rem;
    font-style: italic;
    color: var(--text);
    line-height: 1.5;
  }
  #dialogue-showcase .bubble .speaker {
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--gold);
    letter-spacing: 0.05em;
  }

  /* ══════════════════════════════════════════════
     SECTION 5 — DECK DOMAINS  1560 × 500
  ══════════════════════════════════════════════ */
  #deck-domains {
    width: 1560px;
    height: 700px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 48px;
    gap: 24px;
  }
  #deck-domains .section-title {
    font-family: 'Cinzel', serif;
    font-size: 2rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  #deck-domains .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
    align-items: flex-start;
    max-width: 1400px;
  }
  .domain-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 28px;
    border-radius: 20px;
    gap: 6px;
    min-width: 160px;
  }
  .domain-badge .domain-name {
    font-family: 'Cinzel', serif;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .domain-badge .domain-decks {
    font-family: 'Inter', sans-serif;
    font-size: 0.82rem;
    color: var(--text-dim);
    text-align: center;
    line-height: 1.3;
  }
</style>
</head>
<body>

<!-- SECTION 1: Enemy Showcase -->
<section id="enemy-showcase">
  <div class="section-title">Meet Your Enemies</div>
  <div class="grid">
    ${enemies.map(e => `
    <div class="card">
      <img src="${e.sprite}" alt="${e.name}">
      <div class="name">${e.name}</div>
      <div class="desc">${e.desc}</div>
    </div>`).join('\n')}
  </div>
</section>

<!-- SECTION 2: Relic Grid -->
<section id="relic-grid">
  <div class="section-title">Relics of Power</div>
  <div class="grid">
    ${relics.map(r => `
    <div class="card">
      <img src="${r.icon}" alt="${r.name}">
      <div class="info">
        <div class="name">${r.name}</div>
        <div class="desc">${r.desc}</div>
      </div>
    </div>`).join('\n')}
  </div>
</section>


<!-- SECTION 4: Dialogue Showcase -->
<section id="dialogue-showcase">
  <div class="section-title">They Have Words for You</div>
  ${dialogues.map(d => `
  <div class="strip">
    <img src="${d.sprite}" alt="${d.enemy}">
    <div class="bubble">
      <div class="quote">${d.quote}</div>
      <div class="speaker">${d.enemy}</div>
    </div>
  </div>`).join('\n')}
</section>

<!-- SECTION 5: Deck Domains -->
<section id="deck-domains">
  <div class="section-title">Learn Anything. Fight Everything.</div>
  <div class="grid">
    ${domains.map(d => `
    <div class="domain-badge" style="background:${hex2rgba(d.color, 0.15)};border:1px solid ${d.color};">
      <div class="domain-name" style="color:${d.color};">${d.name}</div>
      <div class="domain-decks">${d.decks}</div>
    </div>`).join('\n')}
  </div>
</section>

</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const html = buildHTML();
const tmpPath = join(OUTPUT_DIR, '_temp.html');
writeFileSync(tmpPath, html);
console.log(`Wrote temp HTML to ${tmpPath}`);

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1600, height: 3400 } });
const page = await context.newPage();

await page.goto(`file://${tmpPath}`);

// Wait for fonts (Google Fonts) to load; fall back gracefully if offline
await page.waitForTimeout(2500);

const sections = [
  { id: 'enemy-showcase',    file: 'enemy-showcase.png',    w: 1560, h: 1100 },
  { id: 'relic-grid',        file: 'relic-grid.png',        w: 1560, h: 1200 },
  { id: 'dialogue-showcase', file: 'dialogue-showcase.png', w: 1560, h: 900  },
  { id: 'deck-domains',      file: 'deck-domains.png',      w: 1560, h: 700  },
];

for (const { id, file, w, h } of sections) {
  const el = page.locator(`#${id}`);
  const outPath = join(OUTPUT_DIR, file);
  await el.screenshot({ path: outPath, omitBackground: true });
  console.log(`Saved ${file} (${w}x${h})`);
}

await browser.close();


// Clean up temp
unlinkSync(tmpPath);
console.log('Done. Output:', OUTPUT_DIR);
