import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture = await readFile('release/qa/replay-fixture.json','utf8');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5189','--strictPort'],{stdio:'pipe'});
let browser;
const result={errors:[], checks:[]};
try{
  for(let n=0;n<100;n++){if(await fetch('http://127.0.0.1:5189').then(r=>r.ok).catch(()=>false))break;await new Promise(r=>setTimeout(r,100));}
  const opts={headless:true};if(process.env.QA_BROWSER_PATH)opts.executablePath=process.env.QA_BROWSER_PATH;if(process.env.QA_BROWSER_ARGS)opts.args=JSON.parse(process.env.QA_BROWSER_ARGS);
  browser=await chromium.launch(opts);
  for(const corrupt of [false,true]){
    const ctx=await browser.newContext({viewport:{width:360,height:640},hasTouch:true});
    await ctx.addInitScript(({fixture,corrupt})=>{
      localStorage.setItem('bauform.current',corrupt?'null':fixture);
      if(corrupt){localStorage.setItem('bauform.stats','null');localStorage.setItem('bauform.record','"oops"');}
    },{fixture,corrupt});
    const page=await ctx.newPage();page.on('pageerror',e=>result.errors.push(e.message));
    await page.goto('http://127.0.0.1:5189/');
    assert.equal(await page.evaluate(()=>typeof window.bauform),'undefined','aucun accès au moteur en production');
    assert.equal(await page.locator('#app').getAttribute('data-screen'),'play');
    const score=Number((await page.locator('#score').textContent()).replace(/\s/g,''));
    assert.ok(corrupt ? score===0 : score>0,'reprise/stockage endommagé en production');
    await page.locator('#pause-btn').tap();await page.locator('#privacy-link').tap();
    assert.ok((await page.textContent('body')).includes('Politique de confidentialité'));
    await ctx.close();
  }
  assert.deepEqual(result.errors,[]);
  result.checks=['reprise du jeu compilé','aucune API de debug exposée','données corrompues tolérées','politique accessible dans le build'];
}finally{await writeFile('release/qa/production-report.json',JSON.stringify(result,null,2));await browser?.close();server.kill();}
console.log('Build production : smoke test réussi.');
