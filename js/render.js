// 렌더링 — 요약 스트립, 결과 카드, 시그니처 컷 스케일바, 아코디언 상세
import { verdictOf, verdictReason, jungsiEffective, VERDICT_ORDER, VERDICTS } from './verdict.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => (v == null ? '—' : String(v));

// ── 스케일바 위치 계산 ─────────────────────────────────────
// 수시=낮을수록 우수(betterIsLow), 정시=높을수록 우수. 항상 왼쪽=유리하게 정규화.
function scaleGeometry(c50, c70, score, betterIsLow) {
  const vals = [c50, c70].filter(v => v != null);
  if (score != null) vals.push(score);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!(hi > lo)) { hi = lo + 1; lo = lo - 1; }
  const pad = (hi - lo) * 0.35;
  lo -= pad; hi += pad;
  const norm = v => (v - lo) / (hi - lo);
  const x = v => betterIsLow ? norm(v) : 1 - norm(v);
  const a = x(c50), b = x(c70);
  return {
    left: Math.min(a, b) * 100,
    width: Math.abs(b - a) * 100,
    dot: score != null ? x(score) * 100 : null
  };
}

function scaleBar(record, meta, score, verdict, engGrade) {
  const isJungsi = meta.admissionRound === '정시';
  // 정시: 영어 입력 시 종합백분위(국수탐+영어환산)로, 아니면 국수탐 백분위로 표시
  let c50, c70, dotScore;
  if (isJungsi) {
    const e = jungsiEffective(record, score, engGrade);
    c50 = e.cut50; c70 = e.cut; dotScore = e.my;
  } else {
    c50 = record.cut50; c70 = record.cut70; dotScore = score;
  }
  if (c50 == null && c70 == null) return '';
  const g = scaleGeometry(c50, c70, dotScore, !isJungsi);
  const unit = isJungsi ? '백분위' : '등급';
  const colorCls = (verdict && verdict.color) ? verdict.color : 'v-none';
  const d50 = c50 == null ? null : Math.round(c50); // 종합값은 소수 → 라벨은 정수로
  const d70 = c70 == null ? null : Math.round(c70);
  const dDot = dotScore == null ? null : Math.round(dotScore);
  const dotAria = dotScore != null
    ? `내 ${unit} ${dDot}, 작년 컷 ${d70} 기준 ${verdict ? verdict.key : ''}`
    : `작년 컷 구간 ${d50}~${d70}`;
  return `
    <div class="scale" role="img" aria-label="${esc(dotAria)}">
      <div class="scale-labels"><span>컷50 ${num(d50)}</span><span>컷70 ${num(d70)}</span></div>
      <div class="scale-track">
        <div class="scale-band ${colorCls}" style="left:${g.left.toFixed(1)}%;width:${g.width.toFixed(1)}%"></div>
        ${g.dot != null ? `<div class="scale-dot" style="left:${g.dot.toFixed(1)}%"></div>` : ''}
      </div>
    </div>`;
}

// ── 영어 보조지표(정시 전용) ─────────────────────────────────────
// 국수탐 백분위 판정과는 별개. 영어는 절대평가 '등급'이라 백분위 평균에 섞지 않고 따로 비교.
// engScore=사용자 영어 등급(1~9), record.eng70=작년 70%컷 영어 평균등급.
function engLine(record, meta, engScore) {
  if (meta.admissionRound !== '정시' || record.eng70 == null) return '';
  const cut = record.eng70;
  let cls = 'eng-neutral', mark = '';
  if (engScore != null) {
    const ok = engScore <= cut;            // 등급은 낮을수록 우수
    cls = ok ? 'eng-ok' : 'eng-under';
    mark = ok ? '충족' : '미달';
  }
  const mine = engScore != null ? `내 <b>${esc(String(engScore))}</b>등급` : '영어';
  return `<p class="eng-line ${cls}">영어 ${mine} · 작년 컷 ${esc(String(cut))}등급${mark ? ` · ${mark}` : ''}</p>`;
}

// ── 카드 ─────────────────────────────────────
export function renderCard(record, score, idx, engScore = null) {
  const meta = record._meta, uni = record._uni;
  const verdict = verdictOf(record, meta, score, engScore);
  const badge = verdict || VERDICTS.정보없음; // 미입력 열람 모드에선 배지 숨김 처리(아래)
  const showBadge = verdict != null; // 성적 미입력이면 배지 없음
  const isJungsi = meta.admissionRound === '정시';

  const campus = uni.campusMerged
    ? `<span class="campus-badge">${esc(uni.campus)}·통합</span>`
    : (uni.campus ? `<span class="campus-badge">${esc(uni.campus)}</span>` : '');
  const badgeHtml = showBadge
    ? `<span class="badge ${badge.color}">${esc(badge.key)}</span>`
    : '';

  const gunTag = isJungsi && record.gun ? ` · <span class="gun-tag">${esc(record.gun)}군</span>` : '';
  const reason = verdictReason(record, meta, score, verdict, engScore);

  // 상세 그리드
  const rows = [
    ['모집인원', num(record.quotaFinal)],
    ['경쟁률', record.ratio != null ? `${record.ratio}:1` : '—'],
    ['충원인원', num(record.waitlistFilled)]
  ];
  if (isJungsi) {
    rows.push(['평균백분위(50/70)', `${num(record.pct50)} / ${num(record.pct70)}`]);
    if (record.eng70 != null || record.eng50 != null)
      rows.push(['영어 평균등급(50/70)', `${num(record.eng50)} / ${num(record.eng70)}`]);
    rows.push(['환산점수(50/70)', `${num(record.score50)} / ${num(record.score70)}`]);
  } else {
    rows.push(['컷 등급(50/70)', `${num(record.cut50)} / ${num(record.cut70)}`]);
    if (record.score50 != null) rows.push(['환산점수(50/70)', `${num(record.score50)} / ${num(record.score70)}`]);
  }
  const grid = rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join('');

  const remark = record.remark && !/확인요망/.test(record.remark)
    ? `<div class="detail-remark">${esc(record.remark)}</div>` : '';
  const refNote = meta.referenceOnly
    ? `<div class="detail-ref">서류·면접 중심 정성평가 전형으로 내신 컷만으로 판단할 수 없습니다.</div>` : '';

  return `
  <article class="card" data-idx="${idx}">
    <button class="card-head" aria-expanded="false">
      <div class="card-row1">
        <span class="card-uni">${esc(uni.name)}</span>
        ${campus}
        <span class="spacer"></span>
        ${badgeHtml}
      </div>
      <h3 class="card-dept">${esc(record.dept)}</h3>
      <p class="card-screening">${esc(record.screeningName)}${gunTag}</p>
      ${scaleBar(record, meta, score, verdict, engScore)}
      ${engLine(record, meta, engScore)}
    </button>
    <div class="card-detail">
      ${reason ? `<p class="detail-reason">${esc(reason)}</p>` : ''}
      <div class="detail-grid">${grid}</div>
      ${remark}${refNote}
    </div>
  </article>`;
}

// ── 요약 스트립 ─────────────────────────────────────
export function renderSummary(records, score, engGrade = null) {
  const counts = {};
  for (const r of records) {
    const v = verdictOf(r, r._meta, score, engGrade) || VERDICTS.정보없음;
    counts[v.key] = (counts[v.key] || 0) + 1;
  }
  const cells = VERDICT_ORDER
    .filter(k => counts[k])
    .map(k => {
      const v = VERDICTS[k];
      return `<button class="summary-cell ${v.color}" data-verdict="${k}" aria-pressed="false" style="color:var(--${v.color})">
        <span class="n">${counts[k]}</span><span class="l">${k}</span></button>`;
    }).join('');
  return cells;
}

// 판정별 개수(정렬 우선순위용)
export function verdictKey(record, score, engGrade = null) {
  const v = verdictOf(record, record._meta, score, engGrade) || VERDICTS.정보없음;
  return v.key;
}
