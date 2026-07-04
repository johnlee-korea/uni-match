// 스크린샷/동작 검증 — puppeteer-core + 시스템 Edge. 뷰포트 375px 모바일.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../scratch/', import.meta.url));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
const logs = [];
page.on('console', m => logs.push(`[console] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

async function overflow(tag) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  console.log(`${tag}: scrollWidth=${r.sw} innerWidth=${r.iw} ${r.sw > r.iw + 1 ? '⚠ 가로overflow' : 'OK'}`);
}

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.hero h1', { timeout: 8000 });
await overflow('입력화면');
await page.screenshot({ path: OUT + "a-input.png", fullPage: true });

// 내신 3.00 입력 → 결과 보기
await page.type('#score', '3.00');
await page.click('#go');
await page.waitForSelector('.summary-cell', { timeout: 8000 });
await overflow('결과화면');
await page.screenshot({ path: OUT + "b-results.png", fullPage: false });

// 요약 카운트 텍스트
const summary = await page.$$eval('.summary-cell', els => els.map(e => e.querySelector('.l').textContent + e.querySelector('.n').textContent).join(' · '));
console.log('요약 스트립:', summary);

// 첫 카드 확장
await page.click('.card .card-head');
await new Promise(r => setTimeout(r, 250));
await page.screenshot({ path: OUT + "c-expanded.png", fullPage: false });
const firstCard = await page.$eval('.card', el => el.innerText.replace(/\n+/g, ' | ').slice(0, 200));
console.log('첫 카드:', firstCard);

// 정시 탭으로 전환 후 백분위 입력
await page.click('#edit-score');
await page.waitForSelector('[data-tab="jungsi"]');
await page.click('[data-tab="jungsi"]');
await page.waitForSelector('#score');
await page.type('#score', '72');
await page.click('#go');
await page.waitForSelector('.summary-cell', { timeout: 8000 });
await overflow('정시결과');
await page.screenshot({ path: OUT + "d-jungsi.png", fullPage: false });

// 필터 시트 열기
await page.click('#open-filter');
await new Promise(r => setTimeout(r, 250));
await page.screenshot({ path: OUT + "e-filter.png", fullPage: false });

console.log('\n--- page logs ---');
console.log(logs.join('\n') || '(없음)');
await browser.close();
console.log('완료');
