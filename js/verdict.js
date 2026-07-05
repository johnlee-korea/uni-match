// 판정 로직 — 수시(내신 등급)·정시(평균백분위) 지원 가능성 판정
// 컷70 기준. 초기값(마스터 기획서), 검수 시 상수만 조정하면 됨.

// 판정 등급 정의(색은 tokens.css와 일치)
export const VERDICTS = {
  초상향: { key: '초상향', color: 'v-reach2' },
  상향:   { key: '상향',   color: 'v-reach1' },
  적정:   { key: '적정',   color: 'v-fit'    },
  안정:   { key: '안정',   color: 'v-safe'   },
  참고:   { key: '참고',   color: 'v-ref'    }, // 학생부종합
  정보없음: { key: '정보없음', color: 'v-none' } // 컷 null(미제출) 등
};

// 판정 임계값(조정 지점)
export const THRESHOLDS = {
  susi:   { reach2: 1.0, reach1: 0.5, fit: 0.5 },  // 내등급 - 컷70
  jungsi: { reach2: 7,   reach1: 3,   fit: 3   }   // 컷70 - 내백분위
};

// ── 영어 반영(정시) ─────────────────────────────────────
// 수능 영어는 절대평가 '등급'이라 국수탐 백분위 평균에 그냥 못 섞는다.
// 등급을 백분위로 근사 환산해, 국수탐 평균백분위와 가중합한 '종합 백분위'로 판정한다.
// 사용자 영어등급과 레코드의 영어 평균등급(eng70)을 같은 표로 환산하므로 서로 공정하게 비교됨.
export const ENG_GRADE_TO_PCT = { 1: 99, 2: 92, 3: 82, 4: 70, 5: 58, 6: 46, 7: 34, 8: 22, 9: 10 };
export const ENG_WEIGHT = 0.25; // 종합백분위 = 국수탐평균*(1-w) + 영어환산*w

export function engToPct(grade) {
  if (grade == null) return null;
  return ENG_GRADE_TO_PCT[grade] ?? null;
}

// 국수탐 평균백분위(academicPct)에 영어등급(engGrade)을 환산·가중합. 영어 없으면 그대로 반환.
export function combinedPct(academicPct, engGrade) {
  if (academicPct == null) return null;
  const e = engToPct(engGrade);
  if (e == null) return academicPct;
  return academicPct * (1 - ENG_WEIGHT) + e * ENG_WEIGHT;
}

// 정시 판정에 쓸 유효 백분위 쌍(내 점수/작년 컷). 사용자·레코드 둘 다 영어가 있을 때만 종합 반영.
// { my, cut, cut50, usedEng } 반환
export function jungsiEffective(record, academicPct, engGrade) {
  const useEng = engGrade != null && record.eng70 != null;
  return {
    my:    useEng ? combinedPct(academicPct, engGrade) : academicPct,
    cut:   useEng ? combinedPct(record.pct70, record.eng70) : record.pct70,
    cut50: useEng ? combinedPct(record.pct50, record.eng50 ?? record.eng70) : record.pct50,
    usedEng: useEng
  };
}

// 수시(내신 등급): 낮을수록 우수. diff = 내등급 - 컷70
export function verdictSusi(myGrade, cut70) {
  if (cut70 == null) return VERDICTS.정보없음;
  const t = THRESHOLDS.susi;
  const diff = myGrade - cut70;
  if (diff >= t.reach2) return VERDICTS.초상향;
  if (diff >= t.reach1) return VERDICTS.상향;
  if (diff >= -t.fit)   return VERDICTS.적정;
  return VERDICTS.안정;
}

// 정시(평균백분위): 높을수록 우수. diff = 컷70 - 내백분위
export function verdictJungsi(myPct, cut70) {
  if (cut70 == null) return VERDICTS.정보없음;
  const t = THRESHOLDS.jungsi;
  const diff = cut70 - myPct;
  if (diff >= t.reach2) return VERDICTS.초상향;
  if (diff >= t.reach1) return VERDICTS.상향;
  if (diff >= -t.fit)   return VERDICTS.적정;
  return VERDICTS.안정;
}

// 레코드 판정 진입점. score=내 성적(수시=등급, 정시=국수탐 평균백분위), engGrade=정시 영어등급(선택)
// null이면 미입력(열람 모드)
export function verdictOf(record, meta, score, engGrade = null) {
  if (meta.referenceOnly) return VERDICTS.참고;              // 종합전형
  const cut = meta.admissionRound === '정시' ? record.pct70 : record.cut70;
  if (cut == null) return VERDICTS.정보없음;                 // 미제출
  if (score == null) return null;                            // 성적 미입력
  if (meta.admissionRound === '정시') {
    const e = jungsiEffective(record, score, engGrade);      // 영어 있으면 종합백분위로 판정
    return verdictJungsi(e.my, e.cut);
  }
  return verdictSusi(score, cut);
}

// 판정 사유 문구(사실 서술, 감정 표현 금지). engGrade=정시 영어등급(선택)
export function verdictReason(record, meta, score, verdict, engGrade = null) {
  if (!verdict) return '';
  if (verdict.key === '참고') return '서류·면접 중심 정성평가 전형으로 내신 컷만으로 판단할 수 없습니다.';
  if (verdict.key === '정보없음') return '작년 데이터가 없습니다(미제출).';
  if (meta.admissionRound === '정시') {
    const e = jungsiEffective(record, score, engGrade);
    const unit = e.usedEng ? '종합 백분위(영어 포함)' : '백분위';
    const d = (e.cut - e.my).toFixed(1).replace(/\.0$/, '');
    if (verdict.key === '초상향') return `작년 컷이 내 ${unit}보다 ${d} 이상 높았어요.`;
    if (verdict.key === '상향')   return `작년 컷이 내 ${unit}보다 조금 높았어요(약 ${d}).`;
    if (verdict.key === '적정')   return `작년 컷이 내 ${unit}와 비슷했어요.`;
    return `작년 컷이 내 ${unit}보다 낮았어요(약 ${Math.abs(d)}).`;
  }
  {
    const cut = record.cut70;
    const d = (score - cut).toFixed(2).replace(/0$/, '').replace(/\.$/, '');
    if (verdict.key === '초상향') return `작년 컷이 내 성적보다 1등급 이상 높았어요.`;
    if (verdict.key === '상향')   return `작년 컷이 내 성적보다 조금 높았어요.`;
    if (verdict.key === '적정')   return '작년 컷이 내 성적과 비슷했어요.';
    return '작년 컷이 내 성적보다 낮았어요.';
  }
}

// 판정 기준 설명(툴팁/시트용)
export const VERDICT_HELP = {
  초상향: '작년 합격 컷이 내 성적보다 크게 높았던 구간이에요. 도전에 해당해요.',
  상향:   '작년 합격 컷이 내 성적보다 다소 높았던 구간이에요.',
  적정:   '작년 합격 컷이 내 성적과 비슷했던 구간이에요. 원서 전략의 중심이 돼요.',
  안정:   '작년 합격 컷이 내 성적보다 낮았던 구간이에요.',
  참고:   '학생부종합은 서류·면접 중심 정성평가라 컷만으로 판정하지 않고 참고로만 표시해요.',
  정보없음: '작년 입시결과가 공개되지 않은(미제출) 모집단위예요.'
};

// 요약/정렬용 순서(적정 우선 → 안정 → 상향 → 초상향, 마지막에 참고/정보없음)
export const VERDICT_ORDER = ['적정', '안정', '상향', '초상향', '참고', '정보없음'];
