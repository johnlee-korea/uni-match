// 셀프테스트 — 브라우저 모듈(verdict/filter/render)을 그대로 불러와 파이프라인 검증
import { readFileSync } from 'node:fs';
import { verdictOf, VERDICTS } from '../js/verdict.js';
import { byTab, applyFilters, sortRecords, facets } from '../js/filter.js';
import { renderCard, renderSummary } from '../js/render.js';

const rd = p => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const manifest = rd('universities.json');
const fieldMap = rd('field-map.json');

function resolveField(dept, given) {
  if (given) return given;
  if (fieldMap.map?.[dept]) return fieldMap.map[dept];
  for (const pre of Object.keys(fieldMap.prefix || {})) if (dept?.startsWith(pre)) return fieldMap.prefix[pre];
  return '기타';
}
const records = [];
for (const u of manifest.universities)
  for (const f of u.files) {
    const j = rd(f);
    for (const r of j.records) records.push({ ...r, field: resolveField(r.dept, r.field), _uni: u, _meta: j.meta });
  }

let pass = 0, fail = 0;
const ok = (name, cond, extra='') => { (cond ? pass++ : fail++); console.log(`${cond?'✅':'❌'} ${name}${extra?' — '+extra:''}`); };

// 1) 단위검증(DKU2 회귀): 내신 3.0 → DKU2 교과 판정 분포 3/3/30/10
//    (다중 학교로 확장돼도 DKU2 정답지 판정은 고정이어야 함)
const susi = byTab(records, 'susi');
const gyo = susi.filter(r => r._meta.screeningType === '교과');
const gyoDku = gyo.filter(r => r._uni.code === 'DKU2');
const dist = {};
for (const r of gyoDku) { const v = (verdictOf(r, r._meta, 3.0) || VERDICTS.정보없음).key; dist[v] = (dist[v]||0)+1; }
ok('내신3.0 DKU2교과 판정분포 3/3/30/10',
   dist['초상향']===3 && dist['상향']===3 && dist['적정']===30 && dist['안정']===10,
   JSON.stringify(dist));

// 2) 종합은 전부 '참고'
const jong = susi.filter(r => r._meta.screeningType === '종합');
ok('종합전형 전부 참고배지', jong.every(r => verdictOf(r, r._meta, 3.0).key === '참고'), `n=${jong.length}`);

// 3) 정시 백분위 72 판정 동작 + 전 레코드 군(가/나/다) 표기
const jungsi = byTab(records, 'jungsi');
ok('정시 레코드 존재/군 표기', jungsi.length>0 && jungsi.every(r => r.gun), `n=${jungsi.length}`);
const jv = jungsi.map(r => verdictOf(r, r._meta, 72).key);
ok('정시 판정 4종 산출', jv.includes('적정') && jv.includes('안정') && jv.includes('초상향'));

// 4) 정렬(판정순) 첫 항목이 적정 우선
const sorted = sortRecords(gyo, 'verdict', 3.0);
ok('판정순 정렬 = 적정 먼저', (verdictOf(sorted[0], sorted[0]._meta, 3.0)||{}).key === '적정');

// 5) 필터: 계열=보건의료
const f = { unis:new Set(), screeningTypes:new Set(), fields:new Set(['보건의료']), verdicts:new Set(), query:'' };
const hb = applyFilters(susi, f, 3.0);
ok('계열 필터(보건의료) 동작', hb.length>0 && hb.every(r => r.field==='보건의료'), `n=${hb.length}`);

// 6) 검색: '간호'
const fq = { unis:new Set(), screeningTypes:new Set(), fields:new Set(), verdicts:new Set(), query:'간호' };
ok('검색(간호) 동작', applyFilters(susi, fq, 3.0).length>0);

// 7) 카드 렌더 스모크(HTML 문자열)
const html = renderCard(gyo[0], 3.0, 0);
ok('카드 렌더 HTML 생성', html.includes('card-dept') && html.includes('scale-track'));
ok('요약 스트립 생성', renderSummary(gyo, 3.0).includes('summary-cell'));

// 8) 열람 모드(score=null) 배지 없음
const cardNoScore = renderCard(gyo[0], null, 0);
ok('성적 미입력 시 판정배지 숨김', !cardNoScore.includes('class="badge'));
ok('성적 미입력 시 스케일 구간만(점 없음)', cardNoScore.includes('scale-band') && !cardNoScore.includes('scale-dot'));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패, 총 레코드 ${records.length}`);
process.exit(fail ? 1 : 0);
