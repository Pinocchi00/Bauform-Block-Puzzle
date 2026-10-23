import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

// Captures du vrai jeu web (1080x1920) pour la fiche Play : parties jouées par le moteur réel,
// poses légales choisies de façon compacte pour obtenir des compositions lisibles.
// Usage : node scripts/make-screenshots.mjs <seed> [dossier]
const seed = process.argv[2] ?? '17';
const out = process.argv[3] ?? 'release/graphics/screenshots-web';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  for (let n = 0; n < 100; n++) {
    if (await fetch('http://127.0.0.1:5189').then(r => r.ok).catch(() => false)) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const opts = { headless: true };
  if (process.env.QA_BROWSER_PATH) opts.executablePath = process.env.QA_BROWSER_PATH;
  browser = await chromium.launch(opts);
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => { localStorage.setItem('bauform.tutorialDone', 'true'); });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:5189/#seed${seed}`);
  await page.waitForFunction(() => window.bauform?.game);
  await page.evaluate(() => document.fonts.ready);
  const advance = (shapes, fill) => page.evaluate(([shapes, fill]) => {
    const { game, rerender } = window.bauform;
    const pct = () => Math.round(100 * game.filled.size / game.active.cells.size);
    for (let n = 0; n < 4000 && !game.over; n++) {
      if (game.shapes.length - 1 >= shapes && pct() >= fill) break;
      const opts = game.hand.flatMap((p, slot) => p ? game.anchors(p).map(a => ({ slot, p, ...a })) : []);
      if (!opts.length) break;
      opts.sort((a, b) => (a.y + a.x * 0.6) - (b.y + b.x * 0.6) || b.p.w * b.p.h - a.p.w * a.p.h);
      game.place(opts[0].slot, opts[0].x, opts[0].y);
    }
    rerender();
    return { shapes: game.shapes.length - 1, over: game.over, score: game.score };
  }, [shapes, fill]);
  const settle = () => page.waitForTimeout(1800);
  const shot = async name => { await settle(); await page.screenshot({ path: `${out}/${name}.png` }); };
  console.log(JSON.stringify(await advance(0, 70)));
  await shot('01-puzzle');
  console.log(JSON.stringify(await advance(3, 55)));
  await shot('02-composition');
  console.log(JSON.stringify(await page.evaluate(() => {
    const { game, rerender, showGameOver } = window.bauform;
    for (let n = 0; n < 6000 && !game.over; n++) {
      const opts = game.hand.flatMap((p, slot) => p ? game.anchors(p).map(a => ({ slot, p, ...a })) : []);
      if (!opts.length) break;
      opts.sort((a, b) => (a.y + a.x * 0.6) - (b.y + b.x * 0.6) || b.p.w * b.p.h - a.p.w * a.p.h);
      game.place(opts[0].slot, opts[0].x, opts[0].y);
    }
    rerender(); showGameOver();
    return { shapes: game.shapes.length - 1, over: game.over, score: game.score };
  })));
  await shot('03-affiche');
  await page.locator('#expand-btn').tap();
  await shot('04-plein-ecran');
} finally {
  await browser?.close(); server.kill();
}
