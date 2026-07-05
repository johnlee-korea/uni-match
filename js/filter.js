// 필터·검색·정렬
import { verdictOf, VERDICT_ORDER, VERDICTS } from './verdict.js';

// 현재 탭(수시/정시)에 맞는 레코드만 1차 필터
export function byTab(records, tab) {
  const round = tab === 'jungsi' ? '정시' : '수시';
  return records.filter(r => r._meta.admissionRound === round);
}

// 전형명(수시)을 3가지 유형으로 분류: 일반전형 / 지역인재 / 기회·특별
// 전형명이 대학마다 제각각이라, 특별·기회균형 키워드 → 지역인재 키워드 → 나머지는 일반 순으로 판정
export const ADM_TYPE_ORDER = ['일반전형', '지역인재', '기회·특별'];
export function screeningGroup(name) {
  const s = name || '';
  if (/기회균형|고른기회|기초생활|차상위|사회배려|사회통합|사회기여|배려|농어촌|서해5도|특성화고|장애인|성인학습자|목회자|체육실기|계약학과|조기취업|취업자/.test(s)) return '기회·특별';
  if (/지역인재|지역메디바이오|글로컬지역|충남형지역|충청형지역|지역저소득|지역균형/.test(s)) return '지역인재';
  return '일반전형';
}

// 필터 상태: { unis:Set, screeningTypes:Set, fields:Set, verdicts:Set, query:string }
export function applyFilters(records, f, score, engGrade = null) {
  const q = (f.query || '').trim().toLowerCase();
  return records.filter(r => {
    if (f.unis?.size && !f.unis.has(r._uni.code)) return false;
    if (f.screeningTypes?.size && !f.screeningTypes.has(r._meta.screeningType)) return false;
    if (f.guns?.size && !f.guns.has(r.gun)) return false;                       // 정시 모집군(가/나/다)
    if (f.admTypes?.size && !f.admTypes.has(screeningGroup(r.screeningName))) return false; // 수시 전형유형
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
  const unis = new Map(), types = new Set(), fields = new Set(), guns = new Set(), admTypes = new Set();
  for (const r of records) {
    unis.set(r._uni.code, r._uni.name);
    types.add(r._meta.screeningType);
    fields.add(r.field);
    if (r.gun) guns.add(r.gun);
    admTypes.add(screeningGroup(r.screeningName));
  }
  // 모집군은 가·나·다 순, 전형유형은 일반→지역→특별 순으로 고정 정렬
  const gunOrder = ['가', '나', '다'];
  return {
    unis: [...unis], types: [...types], fields: [...fields],
    guns: gunOrder.filter(g => guns.has(g)),
    admTypes: ADM_TYPE_ORDER.filter(t => admTypes.has(t))
  };
}
