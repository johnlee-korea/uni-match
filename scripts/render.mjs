// PDF 페이지 → PNG 렌더링 (이미지 기반 PDF 대응)
// 사용: node scripts/render.mjs <pdf경로> <출력디렉터리> [scale] [시작] [끝]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const [pdfPath, outDir, scaleArg, startArg, endArg] = process.argv.slice(2);
const scale = scaleArg ? parseFloat(scaleArg) : 2.2;
mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const base = basename(pdfPath, '.pdf');
const start = startArg ? parseInt(startArg) : 1;
const end = endArg ? parseInt(endArg) : doc.numPages;

for (let p = start; p <= end; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const out = `${outDir}/${base}_p${String(p).padStart(2, '0')}.png`;
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`저장: ${out} (${vp.width.toFixed(0)}x${vp.height.toFixed(0)})`);
}
console.log(`완료: ${base} ${end - start + 1}p`);
