// 진입점 — 상태관리·이벤트 배선. 입력 화면 ↔ 결과 화면.
import { loadAll } from './loader.js';
import { saveScore, loadScore } from './storage.js';
import { byTab, applyFilters, sortRecords, facets } from './filter.js';
import { renderCard, renderSummary } from './render.js';
import { VERDICT_HELP, VERDICTS, VERDICT_ORDER } from './verdict.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');

const state = {
  data: null,
  tab: 'susi',
  susi: null,      // 내신 등급
  jungsi: null,    // 평균백분위
  field: null,     // 선택 계열(선택사항)
  submitted: false,
  sort: 'verdict',
  filters: { unis: new Set(), screeningTypes: new Set(), fields: new Set(), verdicts: new Set(), query: '' }
};

const curScore = () => state.tab === 'jungsi' ? state.jungsi : state.susi;

// ── 초기 로딩 ─────────────────────────────────────
init();
async function init() {
  app.innerHTML = `<div class="loading">데이터를 불러오는 중…</div>`;
  try {
    state.data = await loadAll();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="error">데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.<br><small>${e.message}</small></div>`;
    return;
  }
  const saved = loadScore();
  if (saved) { state.tab = saved.tab || 'susi'; state.susi = saved.susi; state.jungsi = saved.jungsi; state.field = saved.field; }
  renderInput();
}

// ── 입력 화면 ─────────────────────────────────────
function renderInput() {
  state.submitted = false;
  const f = state.data ? facets(state.data.records) : { fields: [] };
  const fieldChips = ['전체', ...f.fields.filter(x => x !== '기타'), '기타']
    .map(fl => {
      const val = fl === '전체' ? null : fl;
      const on = (state.field ?? null) === val;
      return `<button class="chip" data-field="${fl}" aria-pressed="${on}">${fl}</button>`;
    }).join('');

  const isJ = state.tab === 'jungsi';
  const val = isJ ? (state.jungsi ?? '') : (state.susi ?? '');

  app.innerHTML = `
  <section class="wrap hero">
    <h1>내 성적으로 어디 갈 수 있어?</h1>
    <p class="sub">천안권 대학 8개교 · 2026 입시결과 기준 · 회원가입 없이 바로</p>

    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-tab="susi"   aria-selected="${!isJ}">수시 (내신)</button>
      <button class="tab" role="tab" data-tab="jungsi" aria-selected="${isJ}">정시 (수능)</button>
    </div>

    <div class="field-group">
      <label for="score">${isJ ? '수능 평균 백분위' : '내신 등급 (소수점 2자리)'}</label>
      <input id="score" class="score-input" type="text" inputmode="decimal" autocomplete="off"
             placeholder="${isJ ? '예: 72.5' : '예: 3.00'}" value="${val}">
      <p class="hint">${isJ ? '백분위 입력이 가장 정확해요. (등급만 안다면 대략적인 백분위로 입력)' : '주요 과목 평균 등급을 입력하세요. 낮을수록 상위예요.'}</p>
    </div>

    <div class="field-group">
      <label>계열 (선택)</label>
      <div class="chips">${fieldChips}</div>
    </div>

    <button class="btn-primary" id="go">결과 보기</button>
    <button class="btn-ghost" id="browse" style="width:100%;margin-top:8px;border-radius:12px;">성적 없이 입결만 둘러보기</button>

    <div class="disclaimer">
      2026 입시결과 기반 참고 자료이며 합격을 보장하지 않습니다.
      <button id="more-disc">자세히 보기</button>
    </div>
  </section>`;
}

// ── 결과 화면 ─────────────────────────────────────
function renderResults() {
  state.submitted = true;
  const score = curScore();
  const base = byTab(state.data.records, state.tab);
  const filtered = applyFilters(base, state.filters, score);
  const sorted = sortRecords(filtered, state.sort, score);

  const scoreDisp = score == null ? '' : (state.tab === 'jungsi' ? String(score) : Number(score).toFixed(2));
  const scoreLabel = score != null
    ? `${state.tab === 'jungsi' ? '백분위' : '내신'} <b class="tnum">${scoreDisp}</b> 기준`
    : `열람 모드`;

  const summaryHtml = score != null ? renderSummary(base, score) : '';
  const activeFilterCount = state.filters.unis.size + state.filters.screeningTypes.size + state.filters.fields.size + state.filters.verdicts.size;

  const viewNote = score == null
    ? `<div class="viewmode-note">성적을 입력하면 지원 판정이 표시됩니다. 지금은 작년 컷만 보여주는 <b>열람 모드</b>예요.</div>` : '';

  const cards = sorted.length
    ? sorted.map((r, i) => renderCard(r, score, i)).join('')
    : `<div class="empty"><h3>조건에 맞는 학과가 없어요</h3><p>필터를 풀어보세요.</p><button class="btn-ghost" id="reset-filters">필터 초기화</button></div>`;

  app.innerHTML = `
  <div class="stickybar">
    <div class="wrap">
      <span class="basis"><span class="k">${state.tab === 'jungsi' ? '정시' : '수시'}</span> ${scoreLabel}</span>
      <span class="spacer"></span>
      <button class="btn-ghost" id="edit-score">성적 수정</button>
    </div>
  </div>
  <div class="wrap">
    ${summaryHtml ? `<div class="summary" id="summary">${summaryHtml}</div>` : ''}
    <div class="toolbar">
      <input class="search" id="search" type="search" placeholder="대학·학과 검색" value="${state.filters.query}">
      <select class="select" id="sort" aria-label="정렬">
        <option value="verdict" ${state.sort==='verdict'?'selected':''}>판정순</option>
        <option value="cut" ${state.sort==='cut'?'selected':''}>컷순</option>
        <option value="uni" ${state.sort==='uni'?'selected':''}>대학명순</option>
        <option value="ratio" ${state.sort==='ratio'?'selected':''}>경쟁률순</option>
      </select>
      <button class="btn-ghost filter-btn" id="open-filter">필터${activeFilterCount?` ${activeFilterCount}`:''}${activeFilterCount?'<span class="dot"></span>':''}</button>
    </div>
    ${viewNote}
    <div class="results" id="results">${cards}</div>
    <div class="footer">
      출처: 대입정보포털 어디가 · 2026학년도 전형결과<br>
      성적 산출 방식에 따라 실제와 차이가 있을 수 있습니다. ${state.data.omittedTotal ? `· 미제출(데이터 없음) ${state.data.omittedTotal}건 제외` : ''}
    </div>
  </div>
  ${filterSheet()}`;
}

function filterSheet() {
  const f = facets(byTab(state.data.records, state.tab));
  const chk = (name, val, label, set) =>
    `<label class="chip" style="cursor:pointer;"><input type="checkbox" data-fk="${name}" value="${val}" ${set.has(val)?'checked':''} style="margin-right:6px;">${label}</label>`;
  const uniBoxes = f.unis.map(([code, name]) => chk('unis', code, name, state.filters.unis)).join('');
  const typeBoxes = f.types.map(t => chk('screeningTypes', t, t, state.filters.screeningTypes)).join('');
  const fieldBoxes = f.fields.map(fl => chk('fields', fl, fl, state.filters.fields)).join('');
  const verdictBoxes = VERDICT_ORDER.map(v => chk('verdicts', v, v, state.filters.verdicts)).join('');
  return `
  <div class="sheet-backdrop" id="sheet-bd"></div>
  <div class="sheet" id="sheet" role="dialog" aria-label="필터">
    <div class="sheet-head"><h3>필터</h3><button class="close-x" id="close-sheet" aria-label="닫기">✕</button></div>
    <div class="sheet-body">
      <div class="filter-section"><h4>대학</h4><div class="chips">${uniBoxes}</div></div>
      <div class="filter-section"><h4>전형구분</h4><div class="chips">${typeBoxes}</div></div>
      <div class="filter-section"><h4>계열</h4><div class="chips">${fieldBoxes}</div></div>
      <div class="filter-section"><h4>판정</h4><div class="chips">${verdictBoxes}</div></div>
    </div>
    <div class="sheet-foot">
      <button class="btn-ghost" id="clear-filter" style="flex:1;">초기화</button>
      <button class="btn-primary" id="apply-filter" style="flex:2;margin-top:0;">적용</button>
    </div>
  </div>`;
}

// 판정 설명 시트
function openHelp() {
  const items = VERDICT_ORDER.map(k => {
    const v = VERDICTS[k];
    return `<li><span class="badge ${v.color}">${k}</span><br>${VERDICT_HELP[k]}</li>`;
  }).join('');
  const el = document.createElement('div');
  el.innerHTML = `
  <div class="sheet-backdrop open" id="help-bd"></div>
  <div class="sheet open" role="dialog" aria-label="판정 기준">
    <div class="sheet-head"><h3>판정 기준</h3><button class="close-x" id="close-help" aria-label="닫기">✕</button></div>
    <div class="sheet-body"><ul class="info-list">${items}</ul></div>
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('#help-bd').onclick = close;
  el.querySelector('#close-help').onclick = close;
}

// ── 이벤트 위임 ─────────────────────────────────────
document.addEventListener('input', e => {
  if (e.target.id === 'score') {
    const v = e.target.value.replace(/[^0-9.]/g, '');
    const n = v === '' ? null : parseFloat(v);
    if (state.tab === 'jungsi') state.jungsi = isNaN(n) ? null : n;
    else state.susi = isNaN(n) ? null : n;
  } else if (e.target.id === 'search') {
    state.filters.query = e.target.value;
    updateResultsOnly();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sort') { state.sort = e.target.value; updateResultsOnly(); }
});

document.addEventListener('click', e => {
  const t = e.target;
  const tabBtn = t.closest('[data-tab]');
  const chip = t.closest('[data-field]');
  const sumCell = t.closest('.summary-cell');
  const head = t.closest('.card-head');

  if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }
  if (chip)   { selectField(chip.dataset.field); return; }
  if (t.id === 'go')     { commitScore(); renderResults(); return; }
  if (t.id === 'browse') { commitScore(); renderResults(); return; }
  if (t.id === 'more-disc') { showFullDisclaimer(); return; }
  if (t.id === 'edit-score') { renderInput(); return; }
  if (t.id === 'open-filter') { toggleSheet(true); return; }
  if (t.id === 'close-sheet' || t.id === 'sheet-bd') { toggleSheet(false); return; }
  if (t.id === 'apply-filter') { applySheet(); return; }
  if (t.id === 'clear-filter' || t.id === 'reset-filters') { clearFilters(); return; }

  if (sumCell) { toggleVerdictFilter(sumCell.dataset.verdict); return; }
  if (head)    { head.closest('.card').classList.toggle('open');
                 head.setAttribute('aria-expanded', head.closest('.card').classList.contains('open')); return; }
});

function switchTab(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  state.filters.verdicts.clear();
  if (state.submitted) renderResults(); else renderInput();
}
function selectField(fl) {
  state.field = fl === '전체' ? null : fl;
  // 계열 칩은 필터에도 반영
  state.filters.fields.clear();
  if (state.field) state.filters.fields.add(state.field);
  renderInput();
}
function commitScore() {
  saveScore({ tab: state.tab, susi: state.susi, jungsi: state.jungsi, field: state.field });
}
function updateResultsOnly() {
  if (!state.submitted) return;
  const score = curScore();
  const base = byTab(state.data.records, state.tab);
  const filtered = applyFilters(base, state.filters, score);
  const sorted = sortRecords(filtered, state.sort, score);
  const box = $('#results');
  if (!box) return;
  box.innerHTML = sorted.length
    ? sorted.map((r, i) => renderCard(r, score, i)).join('')
    : `<div class="empty"><h3>조건에 맞는 학과가 없어요</h3><p>필터를 풀어보세요.</p><button class="btn-ghost" id="reset-filters">필터 초기화</button></div>`;
}
function toggleSheet(open) {
  const s = $('#sheet'), bd = $('#sheet-bd');
  if (!s) return;
  s.classList.toggle('open', open); bd.classList.toggle('open', open);
}
function applySheet() {
  const boxes = document.querySelectorAll('#sheet input[type="checkbox"]');
  const next = { unis: new Set(), screeningTypes: new Set(), fields: new Set(), verdicts: new Set(), query: state.filters.query };
  boxes.forEach(b => { if (b.checked) next[b.dataset.fk].add(b.value); });
  state.filters = next;
  toggleSheet(false);
  renderResults();
}
function clearFilters() {
  state.filters = { unis: new Set(), screeningTypes: new Set(), fields: new Set(), verdicts: new Set(), query: '' };
  renderResults();
}
function toggleVerdictFilter(v) {
  const set = state.filters.verdicts;
  if (set.has(v)) set.delete(v); else { set.clear(); set.add(v); }
  renderResults();
}
function showFullDisclaimer() {
  const d = $('.disclaimer');
  if (d) d.outerHTML = `<div class="disclaimer full">
    2026학년도 입시결과 기반 참고 자료이며 합격을 보장하지 않습니다.
    대학별 성적 산출 방식에 따라 실제와 차이가 있을 수 있습니다.
    학생부종합전형은 서류·면접 중심 정성평가로 컷만으로 판단할 수 없어 '참고'로 표시합니다.
    출처: 대입정보포털 어디가.</div>`;
}

// 판정 설명은 요약 셀 길게 눌러도 되지만, 헤더에 도움 버튼 추가 대신 배지 클릭 시 안내
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('badge') && e.target.closest('.card-head')) {
    e.stopPropagation(); openHelp();
  }
});
