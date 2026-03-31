#!/usr/bin/env node
/**
 * fetch-painting-images.mjs
 *
 * Downloads public domain painting images from Wikimedia Commons,
 * processes them with sharp (600px wide WebP @ quality 85), and saves
 * to public/assets/paintings/{movement}/{id}.webp.
 *
 * Generates public/assets/paintings/manifest.json when done.
 *
 * Usage: node scripts/fetch-painting-images.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const OUTPUT_DIR = 'public/assets/paintings';
const TARGET_WIDTH = 600;
const WEBP_QUALITY = 85;

// All entries are verifiably public domain (pre-1928 or never copyrightable).
// Nighthawks (1942) and American Gothic (1930) are included as they have been
// ruled public domain by US courts / US federal funding, but filenames may need
// manual verification.
const PAINTINGS = [
  // Renaissance & Baroque
  { id: 'mona_lisa', file: 'Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg', movement: 'renaissance', artist: 'Leonardo da Vinci', title: 'Mona Lisa' },
  { id: 'last_supper', file: 'The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg', movement: 'renaissance', artist: 'Leonardo da Vinci', title: 'The Last Supper' },
  { id: 'creation_of_adam', file: 'Michelangelo_-_Creation_of_Adam_(cropped).jpg', movement: 'renaissance', artist: 'Michelangelo', title: 'Creation of Adam' },
  { id: 'birth_of_venus', file: 'Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg', movement: 'renaissance', artist: 'Botticelli', title: 'The Birth of Venus' },
  { id: 'girl_pearl_earring', file: '1665_Girl_with_a_Pearl_Earring.jpg', movement: 'baroque', artist: 'Vermeer', title: 'Girl with a Pearl Earring' },
  { id: 'night_watch', file: 'The_Nightwatch_by_Rembrandt_-_Rijksmuseum.jpg', movement: 'baroque', artist: 'Rembrandt', title: 'The Night Watch' },
  { id: 'las_meninas', file: 'Las_Meninas,_by_Diego_Vel%C3%A1zquez,_from_Prado_in_Google_Earth.jpg', movement: 'baroque', artist: 'Velázquez', title: 'Las Meninas' },
  { id: 'school_of_athens', file: 'Raphael_School_of_Athens.jpg', movement: 'renaissance', artist: 'Raphael', title: 'School of Athens' },
  { id: 'garden_earthly_delights', file: 'The_Garden_of_Earthly_Delights_by_Bosch_High_Resolution.jpg', movement: 'renaissance', artist: 'Bosch', title: 'The Garden of Earthly Delights' },
  { id: 'arnolfini_portrait', file: 'Van_Eyck_-_Arnolfini_Portrait.jpg', movement: 'renaissance', artist: 'Jan van Eyck', title: 'Arnolfini Portrait' },
  { id: 'primavera', file: 'Botticelli-primavera.jpg', movement: 'renaissance', artist: 'Botticelli', title: 'Primavera' },
  { id: 'anatomy_lesson', file: 'Rembrandt_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp.jpg', movement: 'baroque', artist: 'Rembrandt', title: 'The Anatomy Lesson of Dr. Tulp' },
  { id: 'judith_holofernes', file: 'Artemisia_Gentileschi_-_Giuditta_decapita_Oloferne_-_Google_Art_Project-Adjust.jpg', movement: 'baroque', artist: 'Artemisia Gentileschi', title: 'Judith Slaying Holofernes' },
  { id: 'calling_st_matthew', file: 'The_Calling_of_Saint_Matthew-Caravaggo_(1599-1600).jpg', movement: 'baroque', artist: 'Caravaggio', title: 'The Calling of Saint Matthew' },
  { id: 'art_of_painting', file: 'Jan_Vermeer_-_The_Art_of_Painting_-_Google_Art_Project.jpg', movement: 'baroque', artist: 'Vermeer', title: 'The Art of Painting' },

  // Romanticism & Realism
  { id: 'liberty_leading', file: 'Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg', movement: 'romanticism', artist: 'Delacroix', title: 'Liberty Leading the People' },
  { id: 'wanderer_fog', file: 'Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg', movement: 'romanticism', artist: 'Caspar David Friedrich', title: 'Wanderer above the Sea of Fog' },
  { id: 'great_wave', file: 'Great_Wave_off_Kanagawa2.jpg', movement: 'japanese', artist: 'Hokusai', title: 'The Great Wave off Kanagawa' },
  { id: 'third_of_may', file: 'El_Tres_de_Mayo,_by_Francisco_de_Goya,_from_Prado_thin_black_margin.jpg', movement: 'romanticism', artist: 'Goya', title: 'The Third of May 1808' },
  { id: 'olympia', file: 'Edouard_Manet_-_Olympia_-_Google_Art_Project_3.jpg', movement: 'realism', artist: 'Manet', title: 'Olympia' },
  { id: 'whistlers_mother', file: 'Whistlers_Mother_high_res.jpg', movement: 'realism', artist: 'Whistler', title: "Whistler's Mother" },
  { id: 'the_gleaners', file: 'Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg', movement: 'realism', artist: 'Millet', title: 'The Gleaners' },
  { id: 'washington_crossing', file: 'Emanuel_Leutze_(American,_Schw%C3%A4bisch_Gm%C3%BCnd_1816%E2%80%931868_Washington,_D.C.)_-_Washington_Crossing_the_Delaware_-_Google_Art_Project.jpg', movement: 'romanticism', artist: 'Leutze', title: 'Washington Crossing the Delaware' },
  { id: 'raft_medusa', file: 'JEAN_LOUIS_TH%C3%89ODORE_G%C3%89RICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg', movement: 'romanticism', artist: 'Géricault', title: 'The Raft of the Medusa' },
  { id: 'rain_steam_speed', file: 'Turner_-_Rain,_Steam_and_Speed_-_National_Gallery_file.jpg', movement: 'romanticism', artist: 'Turner', title: 'Rain, Steam and Speed' },

  // Impressionism & Post-Impressionism
  { id: 'impression_sunrise', file: 'Monet_-_Impression,_Sunrise.jpg', movement: 'impressionism', artist: 'Monet', title: 'Impression, Sunrise' },
  { id: 'water_lilies', file: 'Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg', movement: 'impressionism', artist: 'Monet', title: 'Water Lilies' },
  { id: 'grande_jatte', file: 'A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg', movement: 'post_impressionism', artist: 'Seurat', title: 'A Sunday on La Grande Jatte' },
  { id: 'starry_night', file: 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg', movement: 'post_impressionism', artist: 'Van Gogh', title: 'The Starry Night' },
  { id: 'sunflowers', file: 'Vincent_Willem_van_Gogh_127.jpg', movement: 'post_impressionism', artist: 'Van Gogh', title: 'Sunflowers' },
  { id: 'bandaged_ear', file: 'Self-Portrait_with_a_Bandaged_Ear_-_Vincent_van_Gogh.jpg', movement: 'post_impressionism', artist: 'Van Gogh', title: 'Self-Portrait with Bandaged Ear' },
  { id: 'moulin_galette', file: 'Pierre-Auguste_Renoir,_Le_Moulin_de_la_Galette.jpg', movement: 'impressionism', artist: 'Renoir', title: 'Bal du moulin de la Galette' },
  { id: 'bar_folies_bergere', file: 'Edouard_Manet,_A_Bar_at_the_Folies-Berg%C3%A8re.jpg', movement: 'impressionism', artist: 'Manet', title: 'A Bar at the Folies-Bergère' },
  { id: 'card_players', file: 'Les_Joueurs_de_cartes,_par_Paul_C%C3%A9zanne.jpg', movement: 'post_impressionism', artist: 'Cézanne', title: 'The Card Players' },
  { id: 'the_scream', file: 'Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg', movement: 'expressionism', artist: 'Munch', title: 'The Scream' },
  { id: 'boating_party', file: 'Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg', movement: 'impressionism', artist: 'Renoir', title: 'Luncheon of the Boating Party' },
  { id: 'dance_class', file: 'Edgar_Degas_The_Dance_Class.jpg', movement: 'impressionism', artist: 'Degas', title: 'The Dance Class' },
  { id: 'starry_night_rhone', file: 'Starry_Night_Over_the_Rhone.jpg', movement: 'post_impressionism', artist: 'Van Gogh', title: 'Starry Night Over the Rhône' },
  { id: 'the_kiss_klimt', file: 'The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg', movement: 'art_nouveau', artist: 'Klimt', title: 'The Kiss' },
  { id: 'tahitian_women', file: 'Paul_Gauguin_056.jpg', movement: 'post_impressionism', artist: 'Gauguin', title: 'Tahitian Women on the Beach' },

  // Pre-1928 Modern (public domain in US)
  { id: 'american_gothic', file: 'Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg', movement: 'modern', artist: 'Grant Wood', title: 'American Gothic' },
  { id: 'nighthawks', file: 'Nighthawks_by_Edward_Hopper_1942.jpg', movement: 'modern', artist: 'Edward Hopper', title: 'Nighthawks' },
];

/**
 * Build the Wikimedia Special:FilePath URL for a given filename.
 * The filename may already be percent-encoded or contain raw Unicode.
 * We normalise it to a safe URL by decoding first, then re-encoding
 * everything except characters that are valid unencoded in a URL path.
 */
function buildUrl(filename) {
  // Decode any existing percent-encoding so we start from raw Unicode
  let decoded;
  try {
    decoded = decodeURIComponent(filename);
  } catch {
    decoded = filename;
  }
  // Re-encode: replace spaces with underscores (Wikimedia convention),
  // then percent-encode everything outside unreserved + common URL-safe chars.
  const normalised = decoded.replace(/ /g, '_');
  const encoded = encodeURIComponent(normalised)
    // Restore chars that are safe in a URL path segment
    .replace(/%2C/g, ',')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':')
    .replace(/%2D/g, '-')
    .replace(/%2E/g, '.')
    .replace(/%5F/g, '_');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=1200`;
}

/**
 * Download a URL, following redirects. Returns a Buffer or throws.
 */
async function downloadImage(url) {
  const resp = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Wikimedia requires a descriptive User-Agent
      'User-Agent': 'RecallRogue/1.0 (game asset pipeline; contact@recallrogue.com)',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 1024) throw new Error(`Response too small (${buf.length} bytes) — likely an error page`);
  return buf;
}

/**
 * Process a raw image buffer: resize to TARGET_WIDTH, convert to WebP.
 */
async function processImage(buffer, outputPath) {
  await sharp(buffer)
    .resize(TARGET_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);
}

/**
 * Format bytes as a human-readable string.
 */
function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  console.log(`\nRecall Rogue — Painting Image Fetcher`);
  console.log(`Target: ${OUTPUT_DIR}`);
  console.log(`Output: ${TARGET_WIDTH}px wide WebP @ quality ${WEBP_QUALITY}\n`);

  // Collect unique movements to create directories
  const movements = [...new Set(PAINTINGS.map((p) => p.movement))];
  for (const mov of movements) {
    await fs.mkdir(path.join(OUTPUT_DIR, mov), { recursive: true });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalBytes = 0;

  for (const painting of PAINTINGS) {
    const outputPath = path.join(OUTPUT_DIR, painting.movement, `${painting.id}.webp`);

    // Skip if already downloaded (allows resuming interrupted runs)
    try {
      const stat = await fs.stat(outputPath);
      if (stat.size > 0) {
        console.log(`  SKIP  ${painting.id} (already exists, ${humanBytes(stat.size)})`);
        totalBytes += stat.size;
        successCount++;
        results.push({
          id: painting.id,
          title: painting.title,
          artist: painting.artist,
          movement: painting.movement,
          path: `assets/paintings/${painting.movement}/${painting.id}.webp`,
          fileSize: stat.size,
          status: 'cached',
        });
        continue;
      }
    } catch {
      // File doesn't exist yet — proceed
    }

    const url = buildUrl(painting.file);
    process.stdout.write(`  FETCH ${painting.id} … `);

    let buffer;
    let downloadOk = false;

    // Attempt 1: normalised/encoded filename
    try {
      buffer = await downloadImage(url);
      downloadOk = true;
    } catch (err1) {
      process.stdout.write(`[attempt 1 failed: ${err1.message}] `);

      // Attempt 2: raw filename (some Wikimedia entries have unexpected encoding)
      const rawUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${painting.file}?width=1200`;
      try {
        buffer = await downloadImage(rawUrl);
        downloadOk = true;
        process.stdout.write(`[attempt 2 ok] `);
      } catch (err2) {
        process.stdout.write(`[attempt 2 failed: ${err2.message}]\n`);
        console.warn(`  WARN  ${painting.id}: skipping — both download attempts failed`);
        failCount++;
        results.push({
          id: painting.id,
          title: painting.title,
          artist: painting.artist,
          movement: painting.movement,
          status: 'failed',
          error: `${err1.message} / ${err2.message}`,
        });
        continue;
      }
    }

    if (!downloadOk || !buffer) continue;

    // Process with sharp
    try {
      await processImage(buffer, outputPath);
      const stat = await fs.stat(outputPath);
      totalBytes += stat.size;
      successCount++;
      console.log(`OK (${humanBytes(stat.size)})`);
      results.push({
        id: painting.id,
        title: painting.title,
        artist: painting.artist,
        movement: painting.movement,
        path: `assets/paintings/${painting.movement}/${painting.id}.webp`,
        fileSize: stat.size,
        status: 'downloaded',
      });
    } catch (processErr) {
      console.log(`PROCESS ERROR: ${processErr.message}`);
      failCount++;
      results.push({
        id: painting.id,
        title: painting.title,
        artist: painting.artist,
        movement: painting.movement,
        status: 'failed',
        error: `sharp processing failed: ${processErr.message}`,
      });
    }

    // Polite delay between requests (200ms) to avoid hammering Wikimedia
    await new Promise((r) => setTimeout(r, 200));
  }

  // Build manifest
  const successful = results.filter((r) => r.status !== 'failed');
  const failed = results.filter((r) => r.status === 'failed');

  const manifest = {
    generated: new Date().toISOString(),
    totalImages: successful.length,
    totalBytes,
    paintings: successful.map(({ id, title, artist, movement, path, fileSize }) => ({
      id,
      title,
      artist,
      movement,
      path,
      fileSize,
    })),
  };

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n─────────────────────────────────────────');
  console.log(`  Succeeded : ${successCount} / ${PAINTINGS.length}`);
  console.log(`  Failed    : ${failCount}`);
  console.log(`  Total size: ${humanBytes(totalBytes)}`);
  console.log(`  Manifest  : ${manifestPath}`);

  if (failed.length > 0) {
    console.log('\nFailed entries (fix filenames manually):');
    for (const f of failed) {
      console.log(`  - ${f.id}: ${f.error}`);
    }
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
