// 렌더된 PNG를 좌/우(또는 상/하) 조각으로 크롭 — 정시 등 초고밀도 표 판독용
// 사용: node scripts/crop.mjs <png경로> [cols=2] [rows=1] [overlapPx=60]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const [src, colsArg, rowsArg, ovArg] = process.argv.slice(2);
const cols = colsArg ? parseInt(colsArg) : 2;
const rows = rowsArg ? parseInt(rowsArg) : 1;
const ov = ovArg ? parseInt(ovArg) : 60;

const img = await loadImage(src);
const cw = Math.ceil(img.width / cols);
const ch = Math.ceil(img.height / rows);
const stem = src.replace(/\.png$/i, '');

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const sx = Math.max(0, c * cw - ov), sy = Math.max(0, r * ch - ov);
    const ex = Math.min(img.width, (c + 1) * cw + ov), ey = Math.min(img.height, (r + 1) * ch + ov);
    const w = ex - sx, h = ey - sy;
    const canvas = createCanvas(w, h);
    canvas.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, w, h);
    const out = `${stem}_r${r}c${c}.png`;
    writeFileSync(out, canvas.toBuffer('image/png'));
    console.log(`크롭: ${out} (${w}x${h})`);
  }
}
