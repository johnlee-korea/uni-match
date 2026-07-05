// 정시 영어 종합판정 시각 확인 — 과목 백분위 + 영어등급 입력 후 결과 캡처
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('../scratch/', import.meta.url));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
await page.click('[data-tab="jungsi"]');
await page.waitForSelector('.subj-grid');
// 과목 백분위 입력(국65 수65 탐구65,65 → 평균65)
for (const [k, v] of [['kor', '65'], ['math', '65'], ['tam1', '65'], ['tam2', '65']]) {
  await page.type(`.subj-input[data-subj="${k}"]`, v);
}
// 영어 1등급 선택
await page.select('#js-eng', '1');
await page.click('#go');
await page.waitForSelector('.card');
// 첫 정시 카드의 판정/사유/영어줄 추출
const info = await page.evaluate(() => {
  const c = document.querySelector('.card');
  return {
    badge: c.querySelector('.badge')?.textContent,
    reason: c.querySelector('.detail-reason')?.textContent,
    eng: c.querySelector('.eng-line')?.textContent,
    labels: c.querySelector('.scale-labels')?.textContent,
  };
});
console.log('첫 카드:', JSON.stringify(info, null, 2));
await page.screenshot({ path: OUT + 'eng-results.png', fullPage: false });
await browser.close();
console.log('완료');
