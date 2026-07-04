// 반응형 검증 — 360px(최소)·768px(PC 2열) 결과 화면 캡처 + 오버플로 체크
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('../scratch/', import.meta.url));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

for (const [w, h, tag] of [[360, 780, '360'], [768, 1024, '768'], [1100, 900, '1100']]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#score');
  await page.type('#score', '3.00');
  await page.click('#go');
  await page.waitForSelector('.summary-cell');
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    cols: getComputedStyle(document.querySelector('.results')).gridTemplateColumns.split(' ').length }));
  console.log(`${tag}px: overflow ${r.sw>r.iw+1?'⚠'+r.sw:'OK'} | 결과 열수=${r.cols}`);
  await page.screenshot({ path: OUT + `r-${tag}.png`, fullPage: false });
  await page.close();
}
await browser.close();
console.log('완료');
