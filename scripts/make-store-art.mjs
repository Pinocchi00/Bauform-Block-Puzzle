import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const font=readFileSync('src/fonts/jost-latin-500-normal.woff2').toString('base64');
const source=readFileSync('public/favicon.svg','utf8');
const art=source.slice(source.indexOf('<g id="art">'),source.lastIndexOf('</svg>'));
for(const [lang,caption] of [['fr','UNE PIÈCE. UNE FORME. UNE AFFICHE.'],['en','ONE PIECE. ONE SHAPE. ONE POSTER.']]) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500"><defs><style>@font-face{font-family:Jost;src:url(data:font/woff2;base64,${font})}text{font-family:Jost,sans-serif;font-weight:500}</style></defs><rect width="1024" height="500" fill="#e4dccd"/><path d="M64 64H960M64 436H960" fill="none" stroke="#aca597"/><text x="70" y="126" font-size="14" letter-spacing="4" fill="#5f5a51">BLOCK PUZZLE</text><text x="64" y="244" font-size="83" letter-spacing="3" fill="#141414">BAUFORM</text><text x="70" y="297" font-size="16" letter-spacing="2" fill="#5f5a51">${caption}</text><circle cx="82" cy="363" r="12" fill="#ae3622"/><rect x="116" y="351" width="24" height="24" fill="#223f80"/><path d="M160 375l14-24 14 24z" fill="#be921f"/><g transform="translate(555 6) scale(.94)">${art}</g></svg>`;
  writeFileSync(`release/graphics/feature-${lang}-1024x500.svg`,svg);
}
const options={headless:true};
if(process.env.QA_BROWSER_PATH)options.executablePath=process.env.QA_BROWSER_PATH;
if(process.env.QA_BROWSER_ARGS)options.args=JSON.parse(process.env.QA_BROWSER_ARGS);
const browser=await chromium.launch(options);
try{
  const page=await browser.newPage({viewport:{width:1024,height:500},deviceScaleFactor:1});
  for(const lang of ['fr','en']){
    await page.setContent('<style>body{margin:0}</style>'+readFileSync(`release/graphics/feature-${lang}-1024x500.svg`,'utf8'));
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`release/graphics/feature-${lang}-1024x500.png`});
  }
  await page.setViewportSize({width:512,height:512});
  await page.setContent('<style>body{margin:0}</style>'+source);
  await page.screenshot({path:'release/graphics/play-icon-512.png'});
}finally{await browser.close()}
