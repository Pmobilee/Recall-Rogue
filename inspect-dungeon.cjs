const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  // Navigate
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial');
  await page.waitForTimeout(4000);

  async function takeScreenshot(label) {
    try {
      const path = await page.evaluate(() => window.__terraScreenshotFile());
      console.log(`SCREENSHOT [${label}]: ${path}`);
      return path;
    } catch (e) {
      const fallbackPath = `/tmp/inspect-${label.replace(/[^a-z0-9]/gi, '_')}.png`;
      await page.screenshot({ path: fallbackPath, fullPage: false });
      console.log(`SCREENSHOT_FALLBACK [${label}]: ${fallbackPath}`);
      return fallbackPath;
    }
  }

  async function exists(selector) {
    return (await page.$(selector)) !== null;
  }

  async function disableAnimations() {
    await page.evaluate(() => document.documentElement.setAttribute('data-pw-animations', 'disabled'));
  }

  // ===== CHECK 1: Hub Screen =====
  console.log('\n=== CHECK 1: Hub Screen Loads ===');
  await disableAnimations();
  await takeScreenshot('01-hub');
  const startRunBtn = await exists('[data-testid="btn-start-run"]');
  console.log('Start Run button visible:', startRunBtn);
  const studyModeSelector = await page.evaluate(() => {
    return document.querySelector('.study-mode-container') !== null ||
           document.querySelector('.study-mode-selector') !== null;
  });
  console.log('Old StudyModeSelector visible (should be false):', studyModeSelector);
  const hubInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 60));
    return { buttons: buttons.filter(b => b.length > 0) };
  });
  console.log('Hub buttons:', JSON.stringify(hubInfo.buttons));

  // ===== CHECK 2: Click Start Run =====
  console.log('\n=== CHECK 2: Click Start Run -> Dungeon Selection Screen ===');
  if (startRunBtn) {
    await page.click('[data-testid="btn-start-run"]');
  } else {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent.includes('Start') || b.textContent.includes('Play') || b.textContent.includes('Run')) {
          b.click(); break;
        }
      }
    });
  }
  await page.waitForTimeout(1500);
  await disableAnimations();
  await takeScreenshot('02-dungeon-selection');

  const modeToggle = await page.evaluate(() => {
    const el = document.querySelector('.mode-toggle');
    if (!el) return null;
    return {
      tabs: Array.from(el.querySelectorAll('.tab')).map(t => t.textContent.trim()),
      activeTab: el.querySelector('.tab.active')?.textContent?.trim() || 'none'
    };
  });
  console.log('Mode toggle:', JSON.stringify(modeToggle));

  const sidebar = await page.evaluate(() => {
    const el = document.querySelector('.domain-sidebar');
    if (!el) {
      const alt = document.querySelector('[class*="sidebar"], [class*="domain"], [class*="category"]');
      return { found: false, altClass: alt?.className?.substring(0, 80) || 'none' };
    }
    return {
      found: true,
      items: Array.from(el.querySelectorAll('.domain-item, .domain-row, li, button')).map(i => i.textContent.trim().substring(0, 30)),
      count: el.children.length
    };
  });
  console.log('Sidebar:', JSON.stringify(sidebar));

  const overflowCheck = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('.tab-label, .tab, .mode-toggle *').forEach(el => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement?.getBoundingClientRect();
      if (parent && (rect.right > parent.right + 2 || rect.left < parent.left - 2)) {
        issues.push(`Overflow: "${el.textContent?.trim()}" extends beyond parent`);
      }
    });
    return issues;
  });
  console.log('Text overflow issues:', overflowCheck.length ? overflowCheck : 'NONE');

  const dsAllButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent.trim().substring(0, 50), disabled: b.disabled }))
  );
  console.log('All buttons on screen:', JSON.stringify(dsAllButtons));

  // ===== CHECK 3: Trivia Dungeon Tab =====
  console.log('\n=== CHECK 3: Trivia Dungeon Tab ===');
  const triviaTabClicked = await page.evaluate(() => {
    const tabs = document.querySelectorAll('.tab, [role="tab"], button');
    for (const t of tabs) {
      if (t.textContent.includes('Trivia')) { t.click(); return true; }
    }
    return false;
  });
  console.log('Trivia tab clicked:', triviaTabClicked);
  await page.waitForTimeout(500);
  await disableAnimations();
  await takeScreenshot('03-trivia-tab');

  const triviaContent = await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const contentArea = document.querySelector('.trivia-content-area, .subdomain-checklist, [class*="trivia"]');
    const allButtons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 40));
    return {
      checkboxCount: checkboxes.length,
      hasContentArea: contentArea !== null,
      contentAreaClass: contentArea?.className?.substring(0, 80) || 'none',
      buttons: allButtons.filter(b => b.length > 0)
    };
  });
  console.log('Trivia content:', JSON.stringify(triviaContent));

  // ===== CHECK 4: Study Temple Tab =====
  console.log('\n=== CHECK 4: Study Temple Tab ===');
  const studyTabClicked = await page.evaluate(() => {
    const tabs = document.querySelectorAll('.tab, [role="tab"], button');
    for (const t of tabs) {
      if (t.textContent.includes('Study') || t.textContent.includes('Temple')) { t.click(); return true; }
    }
    return false;
  });
  console.log('Study tab clicked:', studyTabClicked);
  await page.waitForTimeout(500);
  await disableAnimations();
  await takeScreenshot('04-study-tab');

  const allViewContent = await page.evaluate(() => {
    const tiles = document.querySelectorAll('.deck-tile, [class*="deck-tile"], [class*="deck-card"]');
    return {
      tileCount: tiles.length,
      tileNames: Array.from(tiles).map(t => {
        const name = t.querySelector('.deck-name, .tile-name, h3, h4');
        return name?.textContent?.trim() || t.textContent.trim().substring(0, 30);
      }),
    };
  });
  console.log('All view tiles:', JSON.stringify(allViewContent));

  // ===== CHECK 5: Vocabulary Domain =====
  console.log('\n=== CHECK 5: Vocabulary Domain ===');
  const vocabClicked = await page.evaluate(() => {
    const items = document.querySelectorAll('.domain-item, .domain-row, li, [class*="sidebar"] button, [class*="sidebar"] a, [class*="sidebar"] *');
    for (const i of items) {
      if (i.textContent.includes('Vocab') || i.textContent.includes('Language')) {
        i.click(); return true;
      }
    }
    return false;
  });
  console.log('Vocab item clicked:', vocabClicked);
  await page.waitForTimeout(500);
  await disableAnimations();
  await takeScreenshot('05-vocabulary');

  const vocabTree = await page.evaluate(() => {
    const langHeaders = document.querySelectorAll('.language-header, .language-header-row, [class*="language"]');
    const settingsBtn = document.querySelectorAll('.options-cogwheel, .settings-btn, [class*="settings"]');
    const studyAllBtns = document.querySelectorAll('[class*="study-all"]');
    return {
      languageCount: langHeaders.length,
      languages: Array.from(langHeaders).map(h => h.textContent.trim().substring(0, 50)),
      settingsButtonCount: settingsBtn.length,
      studyAllButtonCount: studyAllBtns.length,
    };
  });
  console.log('Vocab tree:', JSON.stringify(vocabTree));

  const scrollCheck = await page.evaluate(() => {
    const candidates = document.querySelectorAll('.grid-wrapper, .vocab-tree, [class*="content-area"], [class*="scroll"]');
    for (const scrollable of candidates) {
      if (scrollable.scrollHeight > scrollable.clientHeight + 10) {
        const before = scrollable.scrollTop;
        scrollable.scrollTop = 999;
        const after = scrollable.scrollTop;
        scrollable.scrollTop = 0;
        return {
          scrollable: true, canScroll: after > before,
          scrollHeight: scrollable.scrollHeight, clientHeight: scrollable.clientHeight,
          className: scrollable.className.substring(0, 80)
        };
      }
    }
    return { scrollable: false, note: 'No scrollable container found or nothing to scroll' };
  });
  console.log('Scroll check:', JSON.stringify(scrollCheck));

  // ===== CHECK 6: Click a deck -> Detail Panel =====
  console.log('\n=== CHECK 6: Click a deck -> Detail Panel ===');
  const deckRowClicked = await page.evaluate(() => {
    const rows = document.querySelectorAll('.deck-row, .deck-tile, [class*="deck-row"], [class*="deck-tile"]');
    if (rows.length) { rows[0].click(); return true; }
    return false;
  });
  console.log('Deck row clicked:', deckRowClicked);
  await page.waitForTimeout(500);
  await disableAnimations();
  await takeScreenshot('06-deck-detail');

  const detailPanel = await page.evaluate(() => {
    const panel = document.querySelector('.deck-detail, .detail-panel, [class*="deck-detail"], [class*="detail-panel"]');
    if (!panel) return { visible: false, note: 'No panel found' };
    const runBtn = panel.querySelector('[class*="start"], button');
    const customBtn = panel.querySelector('[class*="custom"]');
    return {
      visible: true,
      hasRunButton: runBtn !== null,
      hasCustomButton: customBtn !== null,
      panelClass: panel.className.substring(0, 80),
      text: panel.textContent?.substring(0, 200) || '',
    };
  });
  console.log('Detail panel:', JSON.stringify(detailPanel));

  // ===== CHECK 7: Start a run from Trivia Dungeon =====
  console.log('\n=== CHECK 7: Start a run from Trivia Dungeon ===');
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('.tab, [role="tab"], button');
    for (const t of tabs) {
      if (t.textContent.includes('Trivia')) { t.click(); return; }
    }
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const items = document.querySelectorAll('.domain-item, .domain-row, li, [class*="sidebar"] *');
    for (const i of items) {
      if (i.textContent.includes('Hist')) { i.click(); return; }
    }
  });
  await page.waitForTimeout(500);

  const startBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const text = b.textContent.trim();
      if ((text.includes('Start') || text.includes('Delve') || text.includes('Enter') || text.includes('Begin')) && !b.disabled) {
        b.click(); return text;
      }
    }
    return null;
  });
  console.log('Clicked start button:', startBtn);
  await page.waitForTimeout(3500);
  await disableAnimations();
  await takeScreenshot('07-combat');

  const currentScreen = await page.evaluate(() => {
    try {
      const sym = Symbol.for('terra:currentScreen');
      if (globalThis[sym]) return globalThis[sym]();
      return 'unknown';
    } catch(e) { return 'error: ' + e.message; }
  });
  console.log('Current screen after start:', currentScreen);

  const postStartButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 40)).filter(b => b.length > 0)
  );
  console.log('Post-start buttons:', JSON.stringify(postStartButtons));

  // ===== CHECK 8: Console Errors =====
  console.log('\n=== CHECK 8: Console Errors ===');
  console.log('Total console errors:', consoleErrors.length);
  consoleErrors.forEach((e, i) => console.log(`  Error ${i + 1}: ${e.substring(0, 200)}`));
  console.log('Total console warnings:', consoleWarnings.length);
  consoleWarnings.slice(0, 5).forEach((w, i) => console.log(`  Warning ${i + 1}: ${w.substring(0, 150)}`));

  // ===== CHECK 9: Layout overflow =====
  console.log('\n=== CHECK 9: Layout Overflow Issues ===');
  const layoutIssues = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 5 && rect.width > 10) {
        const cls = (el.className?.substring?.(0, 50) || 'unknown').replace(/\s+/g,' ');
        issues.push(`${el.tagName}.${cls} overflows right: ${Math.round(rect.right)} > ${window.innerWidth}`);
      }
    });
    return issues.slice(0, 10);
  });
  console.log('Layout overflow issues:', layoutIssues.length ? JSON.stringify(layoutIssues) : 'NONE');

  await browser.close();
  console.log('\n=== INSPECTION COMPLETE ===');
})().catch(e => { console.error('FATAL:', e.message, '\n', e.stack); process.exit(1); });
