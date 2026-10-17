import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Capture le vrai moteur et le vrai DOM. Aucun plateau, score ou bouton fictif.
// Le pilote de développement sert uniquement à choisir des coups légaux.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { stdio: 'pipe' });
let browser;
const report = { source: 'Jeu web réel en viewport mobile, pas une capture Android native', formats: [], errors: [], checks: [] };
const out = 'release/qa';
await mkdir(out, { recursive: true });
await mkdir('release/graphics/screenshots-web', { recursive: true });
try {
  for (let n = 0; n < 100; n++) {
    if (await fetch('http://127.0.0.1:5188').then(r => r.ok).catch(() => false)) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const opts = { headless: true };
  if (process.env.QA_BROWSER_PATH) opts.executablePath = process.env.QA_BROWSER_PATH;
  if (process.env.QA_BROWSER_ARGS) opts.args = JSON.parse(process.env.QA_BROWSER_ARGS);
  browser = await chromium.launch(opts);
  for (const [width, height] of [[320,568], [360,640], [360,800], [390,844], [412,915], [800,1280]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: width === 360 && height === 640 ? 3 : 1, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const requests = [];
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:5188') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
    await page.goto('http://127.0.0.1:5188/#seed17');
    await page.waitForFunction(() => window.bauform?.game);
    await page.evaluate(() => document.fonts.ready);
    const nextMove = () => page.evaluate(() => {
      const { game, cam } = window.bauform;
      for (let slot=0;slot<game.hand.length;slot++) {
        const p = game.hand[slot];
        const a = p && game.anchors(p)[0];
        if (a) return { slot, x:cam.tx+(a.x+p.w/2)*cam.s, y:cam.ty+(a.y+p.h/2)*cam.s,
          dragY:cam.ty+(a.y+p.h)*cam.s+40, score:game.score };
      }
      throw Error('aucune pose');
    });
    let move = await nextMove();
    await page.locator('.slot').nth(move.slot).tap();
    await page.touchscreen.tap(move.x, move.y);
    assert.ok(await page.evaluate(() => window.bauform.game.score) > move.score, 'pose tactile par sélection');
    const saved = await page.evaluate(() => localStorage.getItem('bauform.current'));
    assert.ok(saved, 'sauvegarde après la pose');
    if (width === 360 && height === 640) await writeFile(out+'/replay-fixture.json', saved);
    await page.goto('http://127.0.0.1:5188/');
    await page.waitForFunction(() => window.bauform?.game?.score > 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bauform.current')).seed), 17);
    // Vrai glisser tactile, via le protocole de saisie Chromium.
    move = await nextMove();
    const box = await page.locator('.slot').nth(move.slot).boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = box.x + box.width/2, y = box.y + box.height/2;
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y}] });
    await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:move.x,y:move.dragY}] });
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    assert.ok(await page.evaluate(() => window.bauform.game.score) > move.score, 'glisser tactile');
    await page.locator('#pause-btn').tap();
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'pause');
    await page.locator('#opt-sound').uncheck();
    await page.locator('#resume-btn').tap();
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'play');
    if (width === 360 && height === 640) await page.screenshot({path:'release/graphics/screenshots-web/01-puzzle.png'});
    // Avance dans une partie par poses légales, sans modifier les règles ou les données visuelles.
    await page.evaluate(() => {
      const { game, rerender } = window.bauform;
      for (let n=0;n<300 && !game.over && game.shapesCompleted<7;n++) {
        const opts=game.hand.flatMap((p,slot)=>p?game.anchors(p).map(a=>({slot,...a})):[]);
        const m=opts[n%opts.length];game.place(m.slot,m.x,m.y);
      }
      rerender();
    });
    if (width === 360 && height === 640) await page.screenshot({path:'release/graphics/screenshots-web/02-composition.png'});
    await page.evaluate(() => {
      const {game,rerender,showGameOver}=window.bauform;
      for(let n=0;n<1500&&!game.over;n++) {
        const opts=game.hand.flatMap((p,slot)=>p?game.anchors(p).map(a=>({slot,...a})):[]);
        const m=opts[n%opts.length];game.place(m.slot,m.x,m.y);
      }
      if(!game.over)throw Error('La partie ne se termine pas');rerender();showGameOver();
    });
    const controls = await page.locator('#over-screen button:not([hidden])').evaluateAll(els => els.map(e => {
      const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};
    }));
    for (const r of controls) assert.ok(r.y >= 0 && r.y+r.h <= height+1 && r.w>=44 && r.h>=44, JSON.stringify(r));
    if (width === 360 && height === 640) await page.screenshot({path:'release/graphics/screenshots-web/03-affiche.png'});
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#share-btn').tap();
    const download = await downloadPromise;
    if (width === 360 && height === 640) await download.saveAs('release/graphics/exemple-affiche-1080x1440.png');
    assert.equal(await page.locator('#share-status').textContent(), '');
    await page.locator('#expand-btn').tap();
    if (width === 360 && height === 640) await page.screenshot({path:'release/graphics/screenshots-web/04-plein-ecran.png'});
    await page.locator('#full-screen').tap();
    await page.locator('#retry-btn').tap();
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'play');
    await page.reload();
    await page.waitForFunction(() => window.bauform?.game?.retryUsed);
    // Le jeu déjà chargé continue hors ligne.
    await context.setOffline(true);
    await page.locator('#pause-btn').tap();
    await page.locator('#resume-btn').tap();
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'play');
    await context.setOffline(false);
    await page.locator('#pause-btn').tap();
    await page.locator('#privacy-link').tap();
    assert.ok((await page.textContent('body')).includes('Politique de confidentialité'));
    report.formats.push({width,height,controls,externalRequests:requests});
    assert.deepEqual(requests, []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.checks=['pose tactile par sélection','glisser tactile','reprise après rechargement','pause/reprise','préférences','fin de partie','export PNG','plein écran','retry et sa reprise','jeu chargé hors ligne','confidentialité','aucune requête distante observée'];
} finally {
  await writeFile(out+'/mobile-report.json', JSON.stringify(report,null,2));
  await browser?.close();server.kill();
}
console.log('QA mobile : 6 formats validés. Captures = jeu web, pas Android natif.');
