// 필터·검색·정렬
import { verdictOf, VERDICT_ORDER, VERDICTS } from './verdict.js';

// 현재 탭(수시/정시)에 맞는 레코드만 1차 필터
export function byTab(records, tab) {
  const round = tab === 'jungsi' ? '정시' : '수시';
  return records.filter(r => r._meta.admissionRound === round);
}

// 필터 상태: { unis:Set, screeningTypes:Set, fields:Set, verdicts:Set, query:string }
export function applyFilters(records, f, score, engGrade = null) {
  const q = (f.query || '').trim().toLowerCase();
  return records.filter(r => {
    if (f.unis?.size && !f.unis.has(r._uni.code)) return false;
    if (f.screeningTypes?.size && !f.screeningTypes.has(r._meta.screeningType)) return false;
    if (f.fields?.size && !f.fields.has(r.field)) return false;
    if (f.verdicts?.size) {
      const v = (verdictOf(r, r._meta, score, engGrade) || VERDICTS.정보없음).key;
      if (!f.verdicts.has(v)) return false;
    }
    if (q) {
      const hay = `${r._uni.name} ${r.dept} ${r.screeningName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const orderIndex = k => { const i = VERDICT_ORDER.indexOf(k); return i < 0 ? 99 : i; };

// 정렬. 기본=판정순(적정→안정→상향→초상향→참고→정보없음), 그 외 컷/대학/경쟁률
export function sortRecords(records, sortKey, score, engGrade = null) {
  const arr = records.slice();
  const cutOf = r => r._meta.admissionRound === '정시' ? (r.pct70 ?? -1) : (r.cut70 ?? 99);
  if (sortKey === 'cut') {
    // 수시=등급 오름차순(낮을수록 위), 정시=백분위 내림차순(높을수록 위)
    arr.sort((a, b) => {
      const ja = a._meta.admissionRound === '정시';
      return ja ? (b.pct70 ?? -1) - (a.pct70 ?? -1) : (a.cut70 ?? 99) - (b.cut70 ?? 99);
    });
  } else if (sortKey === 'uni') {
    arr.sort((a, b) => a._uni.name.localeCompare(b._uni.name, 'ko') || a.dept.localeCompare(b.dept, 'ko'));
  } else if (sortKey === 'ratio') {
    arr.sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  } else {
    // verdict(기본): 판정 우선순위 → 같은 판정 내 컷 근접순
    arr.sort((a, b) => {
      const va = (verdictOf(a, a._meta, score, engGrade) || VERDICTS.정보없음).key;
      const vb = (verdictOf(b, b._meta, score, engGrade) || VERDICTS.정보없음).key;
      const d = orderIndex(va) - orderIndex(vb);
      if (d) return d;
      return cutOf(a) - cutOf(b);
    });
  }
  return arr;
}

// 필터 옵션 후보 추출
export function facets(records) {
  const unis = new Map(), types = new Set(), fields = new Set();
  for (const r of records) {
    unis.set(r._uni.code, r._uni.name);
    types.add(r._meta.screeningType);
    fields.add(r.field);
  }
  return { unis: [...unis], types: [...types], fields: [...fields] };
}
