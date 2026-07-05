// 성적 임시 저장 — LocalStorage에 '성적 값만' 저장(개인정보 무수집 원칙)
const KEY = 'uni-match:score';

// { tab: 'susi'|'jungsi', susi: number|null, jungsi: number|null, field: string|null }
export function loadScore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return (v && typeof v === 'object') ? v : null;
  } catch (e) {
    console.warn('[storage] 성적 복원 실패:', e);
    return null;
  }
}

export function saveScore(state) {
  try {
    // 성적/탭/계열 외 어떤 것도 저장하지 않음
    const safe = {
      tab: state.tab ?? 'susi',
      susi: state.susi ?? null,
      jungsi: state.jungsi ?? null,
      jungsiSub: state.jungsiSub ?? null, // 정시 과목별 백분위(입력 원본)
      eng: state.eng ?? null,             // 정시 영어 등급
      field: state.field ?? null
    };
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch (e) {
    console.warn('[storage] 성적 저장 실패:', e);
  }
}

export function clearScore() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}
