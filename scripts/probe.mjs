// PDF 구조 탐색용 프로브 — 페이지별 텍스트 아이템을 좌표와 함께 덤프
// 사용: node scripts/probe.mjs <pdf경로> [시작페이지] [끝페이지]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';

const [pdfPath, startArg, endArg] = process.argv.slice(2);
const data = new Uint8Array(readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const start = startArg ? parseInt(startArg) : 1;
const end = endArg ? parseInt(endArg) : Math.min(doc.numPages, start);

console.log(`총 ${doc.numPages}페이지 / 덤프: ${start}~${end}`);
for (let p = start; p <= end; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  console.log(`\n===== PAGE ${p} (w=${vp.width.toFixed(0)} h=${vp.height.toFixed(0)}) items=${tc.items.length} =====`);
  // y로 행 묶기(반올림), x 정렬
  const rows = new Map();
  for (const it of tc.items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    const key = Math.round(y);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: Math.round(x), s: it.str });
  }
  const ys = [...rows.keys()].sort((a, b) => b - a); // 위→아래
  for (const y of ys) {
    const cells = rows.get(y).sort((a, b) => a.x - b.x);
    console.log(`y${y}: ` + cells.map(c => `[${c.x}]${c.s}`).join(' '));
  }
}
