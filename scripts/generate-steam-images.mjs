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
import { writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'steam', 'store-images');

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Absolute file:// paths ──────────────────────────────────────────────────
const ENEMY = (name) => `file://${PROJECT_ROOT}/public/assets/sprites/enemies/${name}`;
const ICON  = (name) => `file://${PROJECT_ROOT}/public/assets/sprites/icons/${name}`;
const CAT_SPRITE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAwAAAAVhCAYAAAAz+elLAAAACXBIWXMAAAsTAAALEwEAmpwYAABNbUlEQVR4nO39eZRt2V3Yef7OHSNuzG8e8r2cB6WESEkICbAYBJIxxmAVtMtYDCVjpjLG7TJNU+3GLle3YZWXq6DschswXeB2CZawC7oFFGaQDZqQQBapKZXze5n53ss3xnxv3Pn0OicysygvVvWq1YnTlb/PZ61Y8SLixo0bGfnH+e69z95FWZYBAADk0HilXwAAAPDvjwAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAA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AQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAACQiAAAAIBEBAAAACQiAAAAIBEBAAAAiQgAAABIRAAAAEAiAgAAABIRAAAAkIgAAACARAQAAAAkIgAAACARAQAAAIkIAAAASEQAAABAIgIAAAASEQAAAJCIAAAAgEQEAAAAJCIAAAAgEQEAAACJCAAAAEhEAAAAQCICAAAAEhEAAAAQefx/AcS42joPcJDzAAAAAElFTkSuQmCC';
const CAMP_BG = `file:///Users/damion/CODE/recall_rogue_site/generated/backgrounds-landscape/camp/camp-background-wide.webp`;

// ── HTML ────────────────────────────────────────────────────────────────────
function buildHTML() {
  const enemies = [
    { name: 'The Burning Deadline', sprite: ENEMY('burning_deadline_idle.png'), desc: 'Screaming clocks on fire. Rapid-fire quiz phase at 50% HP.' },
    { name: 'The Group Project',    sprite: ENEMY('group_project_idle.png'),    desc: 'Four heads. One deadline. Second head wakes up at half health.' },
    { name: 'The Moth of Enlightenment', sprite: ENEMY('moth_of_enlightenment_idle.png'), desc: '"Knowledge is a light — come burn with me."' },
    { name: 'The Curriculum',       sprite: ENEMY('curriculum_idle.png'),       desc: 'Immune to everything but charged knowledge in phase 2.' },
    { name: 'The Dunning-Kruger',   sprite: ENEMY('dunning_kruger_idle.png'),   desc: '"I don\'t study. I already know."' },
    { name: 'Fake News',            sprite: ENEMY('fake_news_idle.png'),         desc: 'Reads a newspaper full of lies. Every wrong answer makes it stronger.' },
  ];

  const relics = [
    { name: 'Volatile Core',      icon: ICON('icon_relic_volatile_core.png') },
    { name: 'Double Down',        icon: ICON('icon_relic_double_down.png') },
    { name: 'Quicksilver Quill',  icon: ICON('icon_relic_quicksilver.png') },
    { name: 'Blood Price',        icon: ICON('icon_relic_blood_price.png') },
    { name: 'Lucky Coin',         icon: ICON('icon_relic_lucky_coin.png') },
    { name: 'Insight Prism',      icon: ICON('icon_relic_insight_prism.png') },
    { name: 'Phoenix Feather',    icon: ICON('icon_relic_phoenix_feather.png') },
    { name: 'Paradox Engine',     icon: ICON('icon_relic_paradox_engine.png') },
    { name: 'Akashic Record',     icon: ICON('icon_relic_akashic_record.png') },
    { name: "Dragon's Heart",     icon: ICON('icon_relic_dragon_s_heart.png') },
    { name: 'Omniscience',        icon: ICON('icon_relic_omniscience.png') },
    { name: 'Capacitor',          icon: ICON('icon_relic_capacitor.png') },
  ];

  const dialogues = [
    { enemy: 'The Dunning-Kruger',    sprite: ENEMY('dunning_kruger_idle.png'),    quote: '"I don\'t study. I already know."' },
    { enemy: 'The Singularity',       sprite: ENEMY('singularity_idle.png'),       quote: '"I am the end of human learning."' },
    { enemy: 'The Helicopter Parent', sprite: ENEMY('helicopter_parent_idle.png'), quote: '"I won\'t let you fail — or grow!"' },
    { enemy: 'The Student Debt',      sprite: ENEMY('student_debt_idle.png'),      quote: '"Debt compounds. So does my strength!"' },
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
  body { background: var(--bg-deep); font-family: 'Inter', sans-serif; }

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
     SECTION 1 — ENEMY SHOWCASE  1560 × 900
  ══════════════════════════════════════════════ */
  #enemy-showcase {
    width: 1560px;
    height: 900px;
    background: var(--bg-deep);
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
    height: 120px;
    max-width: 120px;
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
     SECTION 2 — RELIC GRID  1560 × 600
  ══════════════════════════════════════════════ */
  #relic-grid {
    width: 1560px;
    height: 600px;
    background: var(--bg-deep);
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
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 16px;
    width: 100%;
    flex: 1;
  }
  #relic-grid .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  #relic-grid .card img {
    width: 64px;
    height: 64px;
    image-rendering: pixelated;
    object-fit: contain;
  }
  #relic-grid .card .name {
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--gold);
    text-align: center;
    line-height: 1.2;
  }

  /* ══════════════════════════════════════════════
     SECTION 3 — CAMP CAT  1560 × 500
  ══════════════════════════════════════════════ */
  #camp-cat {
    width: 1560px;
    height: 500px;
    position: relative;
    overflow: hidden;
  }
  #camp-cat .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
  }
  #camp-cat .cat-img {
    position: absolute;
    bottom: 20px;
    right: 140px;
    width: 128px;
    height: 229px;
    image-rendering: pixelated;
    z-index: 2;
  }
  #camp-cat .caption {
    position: absolute;
    bottom: 24px;
    left: 32px;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    color: rgba(232,228,220,0.7);
    font-style: italic;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }

  /* ══════════════════════════════════════════════
     SECTION 4 — DIALOGUE SHOWCASE  1560 × 800
  ══════════════════════════════════════════════ */
  #dialogue-showcase {
    width: 1560px;
    height: 800px;
    background: var(--bg-deep);
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
    height: 500px;
    background: var(--bg-deep);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 48px;
    gap: 24px;
  }
  #deck-domains .section-title {
    font-family: 'Cinzel', serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  #deck-domains .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
    align-items: flex-start;
    max-width: 1400px;
  }
  .domain-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 20px;
    border-radius: 20px;
    gap: 3px;
    min-width: 140px;
  }
  .domain-badge .domain-name {
    font-family: 'Cinzel', serif;
    font-size: 0.88rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .domain-badge .domain-decks {
    font-family: 'Inter', sans-serif;
    font-size: 0.68rem;
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
      <div class="name">${r.name}</div>
    </div>`).join('\n')}
  </div>
</section>

<!-- SECTION 3: Camp Cat -->
<section id="camp-cat">
  <img class="bg" src="${CAMP_BG}" alt="Camp background">
  <img class="cat-img" src="${CAT_SPRITE}" alt="Camp cat">
  <div class="caption">A cat. You can pet it.</div>
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
  { id: 'enemy-showcase',    file: 'enemy-showcase.png',    w: 1560, h: 900  },
  { id: 'relic-grid',        file: 'relic-grid.png',        w: 1560, h: 600  },
  { id: 'camp-cat',          file: 'camp-cat.png',          w: 1560, h: 500  },
  { id: 'dialogue-showcase', file: 'dialogue-showcase.png', w: 1560, h: 800  },
  { id: 'deck-domains',      file: 'deck-domains.png',      w: 1560, h: 500  },
];

for (const { id, file, w, h } of sections) {
  const el = page.locator(`#${id}`);
  const outPath = join(OUTPUT_DIR, file);
  await el.screenshot({ path: outPath });
  console.log(`Saved ${file} (${w}x${h})`);
}

await browser.close();

// Copy banner
const bannerSrc = '/Users/damion/CODE/recall_rogue_site/public/assets/banner.webp';
const bannerDst = join(OUTPUT_DIR, 'banner.webp');
copyFileSync(bannerSrc, bannerDst);
console.log('Copied banner.webp');

// Clean up temp
unlinkSync(tmpPath);
console.log('Done. Output:', OUTPUT_DIR);
