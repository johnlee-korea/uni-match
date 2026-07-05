// 진입점 — 상태관리·이벤트 배선. 입력 화면 ↔ 결과 화면.
import { loadAll } from './loader.js';
import { saveScore, loadScore, clearScore, loadFavorites, saveFavorites } from './storage.js';
import { byTab, applyFilters, sortRecords, facets } from './filter.js';
import { renderCard, renderSummary, recordKey } from './render.js';
import { verdictOf } from './verdict.js';
import { VERDICT_HELP, VERDICTS, VERDICT_ORDER, THRESHOLDS } from './verdict.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  data: null,
  tab: 'susi',
  susi: null,      // 내신 등급
  jungsi: null,    // 정시 평균 백분위 — 과목별 입력값의 평균(자동 계산). 하위 판정/정렬은 이 값만 사용
  jungsiSub: { kor: null, math: null, tam1: null, tam2: null }, // 정시 과목별 백분위(입력 원본)
  eng: null,       // 정시 영어 등급(1~9, 절대평가). 판정엔 안 섞고 카드에 보조지표로만 비교
  field: null,     // 선택 계열(선택사항)
  submitted: false,
  sort: 'verdict',
  filters: { unis: new Set(), screeningTypes: new Set(), guns: new Set(), admTypes: new Set(), fields: new Set(), verdicts: new Set(), query: '' },
  favorites: new Set(),  // 관심 학과(레코드 키 집합)
  recMap: new Map()      // 키→레코드(원서함에서 탭 무관하게 조회)
};

// 정시 입력 과목 정의(단순 평균으로 판정. 추후 대학별 반영비율 반영 여지)
const JUNGSI_SUBJECTS = [
  { k: 'kor',  label: '국어' },
  { k: 'math', label: '수학' },
  { k: 'tam1', label: '탐구1' },
  { k: 'tam2', label: '탐구2' }
];

const curScore = () => state.tab === 'jungsi' ? state.jungsi : state.susi;
const curEng = () => state.tab === 'jungsi' ? state.eng : null; // 영어 보조지표(정시만)

// 입력된 과목만 골라 평균 백분위 산출(소수 1자리). 하나도 없으면 null
function calcJungsiAvg() {
  const vals = JUNGSI_SUBJECTS
    .map(s => state.jungsiSub[s.k])
    .filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10) / 10;
}

// 평균 백분위 표시 문구(미입력 시 대시)
const avgReadout = v => `평균 백분위 <b>${v == null ? '—' : v}</b>`;

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
  // 키→레코드 맵(원서함 조회용) + 저장된 관심 학과 복원(현재 데이터에 존재하는 것만)
  state.recMap = new Map(state.data.records.map(r => [recordKey(r), r]));
  state.favorites = new Set(loadFavorites().filter(k => state.recMap.has(k)));

  // 공유 링크(#b=...)로 들어오면 공유받은 원서함 화면부터 표시
  const sharedKeys = getSharedBasketKeys();
  if (sharedKeys) { renderSharedBasket(sharedKeys); return; }

  const saved = loadScore();
  if (saved) {
    state.tab = saved.tab || 'susi'; state.susi = saved.susi; state.jungsi = saved.jungsi; state.field = saved.field;
    state.eng = saved.eng ?? null;
    if (saved.jungsiSub && typeof saved.jungsiSub === 'object')
      state.jungsiSub = { kor: null, math: null, tam1: null, tam2: null, ...saved.jungsiSub };
  }
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

  // 초기화 버튼은 입력된 값이 하나라도 있을 때만 노출
  const hasInput = state.susi != null || state.jungsi != null || state.eng != null
    || state.field != null || Object.values(state.jungsiSub).some(v => v != null);

  // 정시: 과목별 백분위 입력 그리드 + 평균 표시 / 수시: 내신 등급 단일 입력
  const scoreGroup = isJ ? `
    <div class="field-group">
      <label>수능 과목별 백분위</label>
      <div class="subj-grid">
        ${JUNGSI_SUBJECTS.map(s => `
        <div class="subj">
          <span class="subj-lab">${s.label}</span>
          <input class="subj-input" data-subj="${s.k}" type="text" inputmode="decimal" autocomplete="off"
                 placeholder="백분위" value="${state.jungsiSub[s.k] ?? ''}">
        </div>`).join('')}
      </div>
      <p class="hint">아는 과목만 입력해도 돼요. 입력한 과목들의 <b>평균 백분위</b>로 판정합니다.</p>
      <div class="avg-readout" id="js-avg">${avgReadout(state.jungsi)}</div>
      <div class="eng-input-row">
        <label for="js-eng">영어 등급</label>
        <select class="eng-select" id="js-eng">
          <option value="">선택</option>
          ${[1,2,3,4,5,6,7,8,9].map(g => `<option value="${g}" ${state.eng===g?'selected':''}>${g}등급</option>`).join('')}
        </select>
        <span class="eng-input-note">절대평가라 평균에 안 섞고 학과별로 따로 비교해요.</span>
      </div>
    </div>` : `
    <div class="field-group">
      <label for="score">내신 등급 (소수점 2자리)</label>
      <input id="score" class="score-input" type="text" inputmode="decimal" autocomplete="off"
             placeholder="예: 3.00" value="${state.susi ?? ''}">
      <p class="hint">주요 과목 평균 등급을 입력하세요. 낮을수록 상위예요.</p>
    </div>`;

  app.innerHTML = `
  <section class="wrap hero">
    <h1 class="brand">어<span class="dot-sep">.</span>대<span class="dot-sep">.</span>가</h1>
    <p class="brand-sub">내 성적으로 <b>‘어느 대학으로 가는지’</b> 알아보자</p>

    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-tab="susi"   aria-selected="${!isJ}">수시 (내신)</button>
      <button class="tab" role="tab" data-tab="jungsi" aria-selected="${isJ}">정시 (수능)</button>
    </div>

    ${scoreGroup}

    <div class="field-group">
      <label>계열 (선택)</label>
      <div class="chips">${fieldChips}</div>
    </div>

    <button class="btn-primary" id="go">결과 보기</button>
    <button class="btn-ghost" id="browse" style="width:100%;margin-top:8px;border-radius:12px;">성적 없이 입결만 둘러보기</button>
    ${hasInput ? `<button class="btn-reset" id="reset-input" type="button">↺ 입력값 초기화</button>` : ''}

    <div class="disclaimer">
      2026 입시결과 기반 참고 자료이며 합격을 보장하지 않습니다.
      <button id="more-disc">자세히 보기</button>
    </div>

    <p class="privacy">🔒 입력한 성적은 <b>내 기기(브라우저)에만</b> 저장돼요. 서버로 전송하지 않으며, 이름·연락처 등 개인정보는 수집하지 않습니다. 별도 동의 절차가 없어요.</p>

    <a class="contact" href="https://open.kakao.com/o/sPkt6GCi" target="_blank" rel="noopener">
      <span class="contact-ico">💬</span>
      <span class="contact-txt">문의사항 · 대학 데이터 추가 요청은 <b>카카오톡 오픈채팅</b>으로 알려주세요
        <span class="contact-sub">탭하면 카카오톡 오픈채팅으로 이동합니다</span></span>
      <span class="contact-arrow" aria-hidden="true">›</span>
    </a>

    <p class="cheer">이시호 화이팅 아빠가 응원해♥</p>
  </section>`;
}

// ── 결과 화면 ─────────────────────────────────────
function renderResults() {
  state.submitted = true;
  const score = curScore();
  const eng = curEng();
  const base = byTab(state.data.records, state.tab);
  const filtered = applyFilters(base, state.filters, score, eng);
  const sorted = sortRecords(filtered, state.sort, score, eng);

  const scoreDisp = score == null ? '' : (state.tab === 'jungsi' ? String(score) : Number(score).toFixed(2));
  const scoreLabel = score != null
    ? `${state.tab === 'jungsi' ? '백분위' : '내신'} <b class="tnum">${scoreDisp}</b> 기준`
    : `열람 모드`;

  const summaryHtml = score != null ? renderSummary(base, score, eng) : '';
  const activeFilterCount = state.filters.unis.size + state.filters.screeningTypes.size + state.filters.guns.size + state.filters.admTypes.size + state.filters.fields.size + state.filters.verdicts.size;

  const viewNote = score == null
    ? `<div class="viewmode-note">성적을 입력하면 지원 판정이 표시됩니다. 지금은 작년 컷만 보여주는 <b>열람 모드</b>예요.</div>` : '';

  const cards = sorted.length
    ? sorted.map((r, i) => renderCard(r, score, i, eng, state.favorites)).join('')
    : `<div class="empty"><h3>조건에 맞는 학과가 없어요</h3><p>필터를 풀어보세요.</p><button class="btn-ghost" id="reset-filters">필터 초기화</button></div>`;

  const favN = state.favorites.size;
  app.innerHTML = `
  <div class="stickybar">
    <div class="wrap">
      <span class="basis"><span class="k">${state.tab === 'jungsi' ? '정시' : '수시'}</span> ${scoreLabel}</span>
      <span class="spacer"></span>
      <button class="btn-ghost basket-btn" id="open-basket">🔖 원서함${favN ? ` <b class="basket-n">${favN}</b>` : ''}</button>
      <button class="btn-ghost" id="edit-score">수정</button>
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
      <button class="btn-ghost" id="open-help" title="판정 기준 안내">판정 기준</button>
      <button class="btn-ghost" id="share-btn" title="친구에게 공유">↗ 공유</button>
    </div>
    ${viewNote}
    <div class="results" id="results">${cards}</div>
    <div class="footer">
      출처: 대입정보포털 어디가 · 2026학년도 전형결과<br>
      성적 산출 방식에 따라 실제와 차이가 있을 수 있습니다. ${state.data.omittedTotal ? `· 미제출(데이터 없음) ${state.data.omittedTotal}건 제외` : ''}
      <br>입력한 성적은 내 기기에만 저장되며 개인정보를 수집하지 않습니다.
      <br><a class="footer-contact" href="https://open.kakao.com/o/sPkt6GCi" target="_blank" rel="noopener">💬 문의 · 대학 데이터 추가 요청 (카카오톡 오픈채팅으로 이동)</a>
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

  // 정시=모집군(가/나/다), 수시=전형유형(일반/지역인재/기회·특별) 섹션을 탭에 맞춰 노출
  const isJ = state.tab === 'jungsi';
  const gunBoxes = f.guns.map(g => chk('guns', g, `${g}군`, state.filters.guns)).join('');
  const admBoxes = f.admTypes.map(t => chk('admTypes', t, t, state.filters.admTypes)).join('');
  const tabSection = isJ
    ? (f.guns.length ? `<div class="filter-section"><h4>모집군</h4><div class="chips">${gunBoxes}</div></div>` : '')
    : (f.admTypes.length ? `<div class="filter-section"><h4>전형유형</h4><div class="chips">${admBoxes}</div></div>` : '');

  return `
  <div class="sheet-backdrop" id="sheet-bd"></div>
  <div class="sheet" id="sheet" role="dialog" aria-label="필터">
    <div class="sheet-head"><h3>필터</h3><button class="close-x" id="close-sheet" aria-label="닫기">✕</button></div>
    <div class="sheet-body">
      <div class="filter-section"><h4>대학</h4><div class="chips">${uniBoxes}</div></div>
      <div class="filter-section"><h4>전형구분</h4><div class="chips">${typeBoxes}</div></div>
      ${tabSection}
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

  // 실제 임계값(verdict.js THRESHOLDS)을 그대로 문구화 — 코드와 항상 일치
  const s = THRESHOLDS.susi, j = THRESHOLDS.jungsi;
  const critRow = (badge, susiTxt, jungTxt) =>
    `<tr><td><span class="badge ${VERDICTS[badge].color}">${badge}</span></td><td>${susiTxt}</td><td>${jungTxt}</td></tr>`;
  const criteria = `
    <p class="crit-lead">작년 <b>70% 합격 컷</b>과 내 성적의 차이로 판정해요. (수시=내신 등급은 낮을수록, 정시=백분위는 높을수록 우수)</p>
    <div class="crit-wrap">
    <table class="crit-table">
      <thead><tr><th>판정</th><th>수시 (내신 등급)</th><th>정시 (백분위)</th></tr></thead>
      <tbody>
        ${critRow('초상향', `컷보다 <b>${s.reach2}등급+</b> 부족`, `컷이 <b>${j.reach2}+</b> 높음`)}
        ${critRow('상향',   `<b>${s.reach1}~${s.reach2}등급</b> 부족`, `<b>${j.reach1}~${j.reach2}</b> 높음`)}
        ${critRow('적정',   `컷과 <b>±${s.fit}등급</b> 이내`, `컷과 <b>±${j.fit}</b> 이내`)}
        ${critRow('안정',   `컷보다 <b>${s.fit}등급+</b> 여유`, `컷보다 <b>${j.fit}+</b> 여유`)}
      </tbody>
    </table>
    </div>`;

  const el = document.createElement('div');
  el.innerHTML = `
  <div class="sheet-backdrop open" id="help-bd"></div>
  <div class="sheet open" role="dialog" aria-label="판정 기준">
    <div class="sheet-head"><h3>판정 기준</h3><button class="close-x" id="close-help" aria-label="닫기">✕</button></div>
    <div class="sheet-body">${criteria}<ul class="info-list">${items}</ul></div>
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('#help-bd').onclick = close;
  el.querySelector('#close-help').onclick = close;
}

// ── 관심 학과(찜) · 원서함 ─────────────────────────────────────
// 레코드의 소속 탭 성적으로 판정(수시=내신, 정시=백분위+영어). 성적 미입력이면 null.
function itemVerdict(r) {
  const isJ = r._meta.admissionRound === '정시';
  return verdictOf(r, r._meta, isJ ? state.jungsi : state.susi, isJ ? state.eng : null);
}

function toggleFavorite(key, btn) {
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  saveFavorites(state.favorites);
  const on = state.favorites.has(key);
  if (btn) {
    btn.classList.toggle('on', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '관심 학과 해제' : '관심 학과 담기');
  }
  updateBasketCount();
  toast(on ? '원서함에 담았어요' : '원서함에서 뺐어요');
}

function updateBasketCount() {
  const b = $('#open-basket');
  if (!b) return;
  const n = state.favorites.size;
  b.innerHTML = `🔖 원서함${n ? ` <b class="basket-n">${n}</b>` : ''}`;
}

// 원서함 제거 시 결과 목록의 별 상태도 동기화
function syncFavStars() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const on = state.favorites.has(btn.dataset.key);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-pressed', String(on));
  });
}

function basketBodyHtml() {
  const favs = [...state.favorites].map(k => state.recMap.get(k)).filter(Boolean);
  if (!favs.length)
    return `<div class="basket-empty"><p>아직 담은 학과가 없어요.</p>
      <p class="muted">결과 카드의 <b>☆</b>를 눌러 관심 학과를 담아보세요.</p></div>`;

  const itemHtml = r => {
    const v = itemVerdict(r);
    const badge = v ? `<span class="badge ${v.color}">${esc(v.key)}</span>` : '';
    const gunTag = r._meta.admissionRound === '정시' && r.gun ? ` · ${esc(r.gun)}군` : '';
    return `<li class="basket-item">
      <div class="bi-main">
        <div class="bi-dept">${esc(r.dept)}</div>
        <div class="bi-sub">${esc(r._uni.name)} · ${esc(r.screeningName)}${gunTag}</div>
      </div>
      ${badge}
      <button class="bi-remove" data-key="${esc(recordKey(r))}" aria-label="원서함에서 빼기" title="빼기">✕</button>
    </li>`;
  };
  const section = (title, arr, warn) => `<div class="basket-group">
    <h4>${title} <span class="bg-n">${arr.length}</span>${warn ? ` <span class="bg-warn">${warn}</span>` : ''}</h4>
    <ul class="basket-list">${arr.map(itemHtml).join('')}</ul></div>`;

  const susi = favs.filter(r => r._meta.admissionRound === '수시');
  const jung = favs.filter(r => r._meta.admissionRound === '정시');
  let html = '';
  if (susi.length) html += section('수시', susi, susi.length > 6 ? '6곳 초과' : '');
  for (const g of ['가', '나', '다']) {
    const arr = jung.filter(r => r.gun === g);
    if (arr.length) html += section(`정시 ${g}군`, arr, arr.length > 1 ? '군당 1곳 권장' : '');
  }
  const jungEtc = jung.filter(r => !['가', '나', '다'].includes(r.gun));
  if (jungEtc.length) html += section('정시', jungEtc, '');
  return html;
}

function openBasket() {
  const hasFav = state.favorites.size > 0;
  const el = document.createElement('div');
  el.innerHTML = `
  <div class="sheet-backdrop open" data-close="1"></div>
  <div class="sheet open" role="dialog" aria-label="원서함">
    <div class="sheet-head"><h3>🔖 내 원서함</h3><button class="close-x" data-close="1" aria-label="닫기">✕</button></div>
    <div class="sheet-body">
      <p class="basket-note">담은 학과로 원서 전략을 세워보세요. 수시는 최대 <b>6곳</b>, 정시는 <b>가·나·다 군당 1곳</b>씩 지원합니다.</p>
      <div class="basket-body">${basketBodyHtml()}</div>
    </div>
    ${hasFav ? `<div class="sheet-foot"><button class="btn-primary" id="share-basket" style="margin-top:0;flex:1;">🔗 이 원서함 공유하기</button></div>` : ''}
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', e => {
    if (e.target.dataset && e.target.dataset.close) { close(); return; }
    if (e.target.closest('#share-basket')) { shareBasket(); return; }
    const rm = e.target.closest('.bi-remove');
    if (rm) {
      state.favorites.delete(rm.dataset.key);
      saveFavorites(state.favorites);
      const body = el.querySelector('.basket-body');
      if (body) body.innerHTML = basketBodyHtml();
      syncFavStars();
      updateBasketCount();
    }
  });
}

// ── 공유(Web Share API + 클립보드 폴백) ─────────────────────────────
const SITE_URL = 'https://johnlee-korea.github.io/uni-match/';
function shareResult() {
  const score = curScore();
  let text = '어대가 — 내 성적으로 어느 대학 가는지 30초 만에 확인해보세요!';
  if (score != null && state.submitted) {
    const base = byTab(state.data.records, state.tab);
    const eng = curEng();
    let fit = 0, safe = 0;
    for (const r of base) {
      const v = verdictOf(r, r._meta, score, eng);
      if (v && v.key === '적정') fit++;
      else if (v && v.key === '안정') safe++;
    }
    text = `어대가에서 내 성적으로 확인한 결과 — 적정 ${fit}곳·안정 ${safe}곳! 나도 확인해보기 👇`;
  }
  const data = { title: '어.대.가', text, url: SITE_URL };
  if (navigator.share) {
    navigator.share(data).catch(() => {}); // 모바일 네이티브 공유(카톡 등). 사용자 취소는 무시
    return;
  }
  copyText(SITE_URL, '링크를 복사했어요');
}

// 문자열 복사(클립보드 → execCommand 폴백)
function copyText(str, okMsg = '복사했어요! 붙여넣기 하세요') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(() => toast(okMsg)).catch(() => legacyCopy(str, okMsg));
  } else {
    legacyCopy(str, okMsg);
  }
}
function legacyCopy(str, okMsg = '복사했어요! 붙여넣기 하세요') {
  try {
    const ta = document.createElement('textarea');
    ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    toast(ok ? okMsg : '복사에 실패했어요');
  } catch (e) { toast('복사에 실패했어요'); }
}

// ── 원서함 공유 ─────────────────────────────────────
// 관심 학과 키들을 URL 해시(#b=)에 담아 링크로 공유. 성적은 싣지 않음(개인정보 보호).
function encodeBasket(keys) {
  return btoa(unescape(encodeURIComponent(keys.join('\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeBasket(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(b64))).split('\n').filter(Boolean);
  } catch (e) { return []; }
}
function basketShareUrl() { return SITE_URL + '#b=' + encodeBasket([...state.favorites]); }

// 해시에서 공유된 원서함 키(현재 데이터에 존재하는 것만) 추출
function getSharedBasketKeys() {
  const m = (location.hash || '').match(/[#&]b=([^&]+)/);
  if (!m) return null;
  const keys = decodeBasket(m[1]).filter(k => state.recMap.has(k));
  return keys.length ? keys : null;
}
function clearHashToHome() {
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (e) { location.hash = ''; }
}

function buildBasketText(favs) {
  const line = r => `- ${r.dept} (${r._uni.name})`;
  const susi = favs.filter(r => r._meta.admissionRound === '수시');
  const jung = favs.filter(r => r._meta.admissionRound === '정시');
  const out = ['🔖 내 원서함 · 어대가'];
  if (susi.length) { out.push('', `▪ 수시 (${susi.length})`); susi.forEach(r => out.push(line(r))); }
  for (const g of ['가', '나', '다']) {
    const arr = jung.filter(r => r.gun === g);
    if (arr.length) { out.push('', `▪ 정시 ${g}군 (${arr.length})`); arr.forEach(r => out.push(line(r))); }
  }
  const etc = jung.filter(r => !['가', '나', '다'].includes(r.gun));
  if (etc.length) { out.push('', '▪ 정시'); etc.forEach(r => out.push(line(r))); }
  out.push('', '내 성적으론 어디 갈까? 👇');
  return out.join('\n');
}

function shareBasket() {
  const favs = [...state.favorites].map(k => state.recMap.get(k)).filter(Boolean);
  if (!favs.length) { toast('먼저 관심 학과를 담아주세요'); return; }
  const text = buildBasketText(favs);
  const url = basketShareUrl();
  if (navigator.share) { navigator.share({ title: '어.대.가 · 내 원서함', text, url }).catch(() => {}); return; }
  copyText(`${text}\n${url}`, '원서함을 복사했어요! 붙여넣기 하세요');
}

function importSharedBasket() {
  const keys = getSharedBasketKeys() || [];
  keys.forEach(k => state.favorites.add(k));
  saveFavorites(state.favorites);
  clearHashToHome();
  toast(`원서함에 ${keys.length}곳 담았어요`);
  renderInput();
}

// 공유받은 원서함 화면(성적 없이 리스트만 표시)
function renderSharedBasket(keys) {
  state.submitted = false;
  const recs = keys.map(k => state.recMap.get(k)).filter(Boolean);
  const line = r => {
    const gunTag = r._meta.admissionRound === '정시' && r.gun ? ` · ${esc(r.gun)}군` : '';
    return `<li class="basket-item"><div class="bi-main">
      <div class="bi-dept">${esc(r.dept)}</div>
      <div class="bi-sub">${esc(r._uni.name)} · ${esc(r.screeningName)}${gunTag}</div>
    </div></li>`;
  };
  const section = (title, arr) => arr.length
    ? `<div class="basket-group"><h4>${title} <span class="bg-n">${arr.length}</span></h4><ul class="basket-list">${arr.map(line).join('')}</ul></div>` : '';
  const susi = recs.filter(r => r._meta.admissionRound === '수시');
  const jung = recs.filter(r => r._meta.admissionRound === '정시');
  let groups = section('수시', susi);
  for (const g of ['가', '나', '다']) groups += section(`정시 ${g}군`, jung.filter(r => r.gun === g));
  groups += section('정시', jung.filter(r => !['가', '나', '다'].includes(r.gun)));

  app.innerHTML = `
  <section class="wrap shared-view">
    <div class="shared-badge">🔖 공유받은 원서함</div>
    <h1 class="shared-title">누군가 <b>이렇게 지원</b>했어요</h1>
    <p class="shared-sub">총 ${recs.length}곳의 지원 리스트예요. 내 성적으론 어디까지 갈 수 있는지 확인해보세요.</p>
    ${groups}
    <button class="btn-primary" id="exit-shared">내 성적으로 확인해보기</button>
    <button class="btn-ghost" id="import-shared" style="width:100%;margin-top:8px;border-radius:12px;">이 리스트 내 원서함에 담기</button>
    <p class="cheer" style="margin-top:24px;">이시호 화이팅 아빠가 응원해♥</p>
  </section>`;
}

let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

// ── 이벤트 위임 ─────────────────────────────────────
document.addEventListener('input', e => {
  if (e.target.id === 'score') {
    // 수시 내신 등급(정시는 과목별 입력을 사용)
    const v = e.target.value.replace(/[^0-9.]/g, '');
    const n = v === '' ? null : parseFloat(v);
    state.susi = isNaN(n) ? null : n;
  } else if (e.target.classList && e.target.classList.contains('subj-input')) {
    // 정시 과목별 백분위 → 평균 재계산 후 표시만 갱신(재렌더 없이 포커스 유지)
    const key = e.target.dataset.subj;
    const v = e.target.value.replace(/[^0-9.]/g, '');
    let n = v === '' ? null : parseFloat(v);
    if (n != null && !isNaN(n)) n = Math.min(100, Math.max(0, n)); else n = null;
    state.jungsiSub[key] = n;
    state.jungsi = calcJungsiAvg();
    const out = $('#js-avg');
    if (out) out.innerHTML = avgReadout(state.jungsi);
  } else if (e.target.id === 'search') {
    state.filters.query = e.target.value;
    updateResultsOnly();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sort') { state.sort = e.target.value; updateResultsOnly(); }
  else if (e.target.id === 'js-eng') {
    const v = e.target.value;
    state.eng = v === '' ? null : parseInt(v, 10);
  }
});

document.addEventListener('click', e => {
  const t = e.target;
  const favBtn = t.closest('.fav-btn');
  const basketBtn = t.closest('#open-basket');
  const tabBtn = t.closest('[data-tab]');
  const chip = t.closest('[data-field]');
  const sumCell = t.closest('.summary-cell');
  const head = t.closest('.card-head');

  if (favBtn)    { e.stopPropagation(); toggleFavorite(favBtn.dataset.key, favBtn); return; }
  if (basketBtn) { openBasket(); return; }
  if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }
  if (chip)   { selectField(chip.dataset.field); return; }
  if (t.id === 'go')     { commitScore(); renderResults(); return; }
  if (t.id === 'browse') { commitScore(); renderResults(); return; }
  if (t.id === 'reset-input') { resetInput(); return; }
  if (t.id === 'exit-shared') { clearHashToHome(); renderInput(); return; }
  if (t.id === 'import-shared') { importSharedBasket(); return; }
  if (t.id === 'open-help') { openHelp(); return; }
  if (t.id === 'share-btn') { shareResult(); return; }
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
  // 모집군·전형유형은 탭 전용 조건이라 탭 전환 시 초기화(정시 모집군이 수시 결과를 가리는 것 방지)
  state.filters.guns.clear();
  state.filters.admTypes.clear();
  if (state.submitted) renderResults(); else renderInput();
}
function selectField(fl) {
  state.field = fl === '전체' ? null : fl;
  // 계열 칩은 필터에도 반영
  state.filters.fields.clear();
  if (state.field) state.filters.fields.add(state.field);
  renderInput();
}
// 입력값 전체 초기화 — 성적·과목별 백분위·영어·계열 + 저장값·필터를 모두 비우고 입력화면 재렌더
function resetInput() {
  state.susi = null;
  state.jungsi = null;
  state.jungsiSub = { kor: null, math: null, tam1: null, tam2: null };
  state.eng = null;
  state.field = null;
  state.filters = { unis: new Set(), screeningTypes: new Set(), guns: new Set(), admTypes: new Set(), fields: new Set(), verdicts: new Set(), query: '' };
  clearScore();
  renderInput();
}
function commitScore() {
  // 계열 선택을 결과 필터에 확정 반영. 저장값 복원 등 selectField를 거치지 않은 경우에도
  // 조회 시점에 조회조건(계열)이 필터에 확실히 걸리도록 동기화한다.
  state.filters.fields.clear();
  if (state.field) state.filters.fields.add(state.field);
  saveScore({ tab: state.tab, susi: state.susi, jungsi: state.jungsi, jungsiSub: state.jungsiSub, eng: state.eng, field: state.field });
}
function updateResultsOnly() {
  if (!state.submitted) return;
  const score = curScore();
  const eng = curEng();
  const base = byTab(state.data.records, state.tab);
  const filtered = applyFilters(base, state.filters, score, eng);
  const sorted = sortRecords(filtered, state.sort, score, eng);
  const box = $('#results');
  if (!box) return;
  box.innerHTML = sorted.length
    ? sorted.map((r, i) => renderCard(r, score, i, eng, state.favorites)).join('')
    : `<div class="empty"><h3>조건에 맞는 학과가 없어요</h3><p>필터를 풀어보세요.</p><button class="btn-ghost" id="reset-filters">필터 초기화</button></div>`;
}
function toggleSheet(open) {
  const s = $('#sheet'), bd = $('#sheet-bd');
  if (!s) return;
  s.classList.toggle('open', open); bd.classList.toggle('open', open);
}
function applySheet() {
  const boxes = document.querySelectorAll('#sheet input[type="checkbox"]');
  const next = { unis: new Set(), screeningTypes: new Set(), guns: new Set(), admTypes: new Set(), fields: new Set(), verdicts: new Set(), query: state.filters.query };
  boxes.forEach(b => { if (b.checked) next[b.dataset.fk].add(b.value); });
  state.filters = next;
  toggleSheet(false);
  renderResults();
}
function clearFilters() {
  state.filters = { unis: new Set(), screeningTypes: new Set(), guns: new Set(), admTypes: new Set(), fields: new Set(), verdicts: new Set(), query: '' };
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
    입력한 성적은 이용자 기기(브라우저)에만 저장되고 서버로 전송·수집되지 않으며, 이름·연락처 등 개인정보를 일절 수집하지 않아 별도의 수집·이용 동의 절차가 없습니다.
    출처: 대입정보포털 어디가.</div>`;
}

// 판정 설명은 요약 셀 길게 눌러도 되지만, 헤더에 도움 버튼 추가 대신 배지 클릭 시 안내
document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('badge') && e.target.closest('.card-head')) {
    e.stopPropagation(); openHelp();
  }
});
