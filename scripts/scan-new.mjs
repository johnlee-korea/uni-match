// 신규 전사 데이터 검증·이상값 스캔 — 스키마 일치·범위·레코드수 점검
// 사용: node scripts/scan-new.mjs <code1> <code2> ...
import { readFileSync, existsSync } from 'node:fs';

const codes = process.argv.slice(2);
const DATA = 'data/';

const GYO_KEYS = ['screeningName','dept','field','quotaFinal','ratio','waitlistFilled','score50','score70','cut50','cut70','remark'];
const JUNGSI_KEYS = ['screeningName','gun','dept','field','quotaFinal','ratio','waitlistFilled','score50','score70','pct50','pct70','remark','eng50','eng70'];
const FIELDS = ['인문','자연','공학','보건의료','예체능','기타'];

function load(f){ return JSON.parse(readFileSync(DATA+f,'utf8')); }

let grand = 0;
for (const code of codes) {
  const lc = code.toLowerCase();
  const files = [
    ['교과', `${lc}_2026_susi_gyo.json`, GYO_KEYS, 'cut70', [1,9]],
    ['종합', `${lc}_2026_susi_jong.json`, GYO_KEYS, 'cut70', [1,9]],
    ['정시', `${lc}_2026_jungsi.json`, JUNGSI_KEYS, 'pct70', [0,100]],
  ];
  console.log(`\n===== ${code} =====`);
  for (const [label, file, keys, judgeKey, range] of files) {
    if (!existsSync(DATA+file)) { console.log(`  ${label}: (파일 없음)`); continue; }
    const d = load(file);
    const recs = d.records;
    grand += recs.length;
    const vals = recs.map(r=>r[judgeKey]).filter(v=>v!=null);
    const min = vals.length?Math.min(...vals):null, max = vals.length?Math.max(...vals):null;
    const omitted = d.meta?.omittedNoData?.count ?? 0;
    console.log(`  ${label}: ${recs.length}건 (omit ${omitted}) ${judgeKey} ${min}~${max}`);
    // 검증
    const issues = [];
    recs.forEach((r,i)=>{
      for (const k of keys) if (!(k in r)) issues.push(`#${i} 키누락:${k}`);
      if (r.field && !FIELDS.includes(r.field)) issues.push(`#${i} 잘못된 field:${r.field} (${r.dept})`);
      const jv = r[judgeKey];
      if (jv!=null && (jv<range[0]||jv>range[1])) issues.push(`#${i} ${judgeKey}=${jv} 범위밖 (${r.dept})`);
      if (label==='정시' && r.pct70!=null && (r.pct70<20)) issues.push(`#${i} pct70=${r.pct70} 이상저조 (${r.dept})`);
      if ((label==='교과') && r.cut70!=null && (r.cut70<1.0)) issues.push(`#${i} cut70=${r.cut70} 1.0미만 (${r.dept})`);
      if (r.eng50!=null && (r.eng50<1||r.eng50>9)) issues.push(`#${i} eng50=${r.eng50} 범위밖`);
      if (r.eng70!=null && (r.eng70<1||r.eng70>9)) issues.push(`#${i} eng70=${r.eng70} 범위밖`);
    });
    if (recs.length===0) issues.push('레코드 0건');
    if (issues.length) issues.slice(0,20).forEach(s=>console.log(`    ⚠ ${s}`));
  }
}
console.log(`\n신규 총 레코드: ${grand}`);
