// 입력화면(정시 탭) 모바일 오버플로 진단 — 360px에서 화면 밖으로 벗어나는 요소 탐지
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('../scratch/', import.meta.url));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });

for (const tab of ['susi', 'jungsi']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.tabs');
  if (tab === 'jungsi') { await page.click('[data-tab="jungsi"]'); await page.waitForSelector('.subj-grid'); }
  const diag = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 0.5 || r.left < -0.5) {
        bad.push({ sel: el.className || el.tagName, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    return { vw, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 12) };
  });
  console.log(`\n=== ${tab} @360px === vw=${diag.vw} scrollWidth=${diag.sw} ${diag.sw>diag.vw+1?'⚠ 오버플로':'OK'}`);
  diag.bad.forEach(b => console.log(`  넘침: ${b.sel} [left=${b.left} right=${b.right} w=${b.w}]`));
  await page.screenshot({ path: OUT + `input-${tab}-360.png`, fullPage: false });
  await page.close();
}
await browser.close();
console.log('\n완료');
