# uni-match — 천안권 대학 지원 가능성 조회

수시 원서를 앞둔 수험생·학부모가 **내 성적(내신/수능)으로 지원 가능한 천안권 대학·학과**를 조회하고 지원 판정(초상향~안정)을 확인하는 무료·비회원·개인정보 무수집 정적 웹서비스입니다.

- **데이터 기준**: 2026학년도 입시결과 (출처: 대입정보포털 어디가)
- **1차 범위**: 천안 소재 4년제 8개교 (현재 단국대 천안캠퍼스 데이터 탑재, 나머지 확장 예정)
- **기술**: 순수 HTML/CSS/JavaScript, 백엔드 없음, 정적 JSON

## 주요 기능
- 수시(내신 등급)·정시(수능 평균백분위) 탭
- 판정: 초상향/상향/적정/안정 (컷70 기준), 학생부종합은 '참고'
- **컷 스케일바**: 컷50~컷70 구간에 내 성적 위치를 점으로 표시
- 요약 스트립(판정별 개수·탭 필터), 필터(대학·전형·계열·판정), 검색, 정렬
- 성적 미입력 시 '열람 모드'(입결만 조회)
- 모바일 우선, PC 2열, 접근성(색+텍스트 병행·44px 타깃·reduced-motion)

## 로컬 실행
```bash
npm install                 # (개발 스크립트용) puppeteer/pdfjs 등
node scripts/serve.mjs 5173 # http://localhost:5173
```
> `file://` 직접 열기는 ES모듈/JSON fetch가 막혀 동작하지 않습니다. 반드시 로컬 서버로 여세요.

## 폴더 구조
```
index.html
css/    tokens.css · style.css · card.css
js/     app.js · loader.js · verdict.js · render.js · filter.js · storage.js
data/   universities.json(매니페스트) · field-map.json(계열매핑) · {대학}_{연도}_{구분}.json
scripts/ render·crop·serve·selftest·shots 등 개발용
raw/    원본 PDF (.gitignore, 커밋 금지)
```

## 데이터 파이프라인
"어디가" 인쇄 PDF가 **이미지(텍스트 레이어 없음)**라, `scripts/render.mjs`로 PNG 렌더 후 비전 판독으로 JSON 전사합니다. 미제출(컷 없음) 모집단위는 제외하고 `meta.omittedNoData`에 건수만 기록합니다. 대학 추가는 `data/`에 JSON을 넣고 `universities.json`에 등록하면 됩니다(코드 수정 불필요).

## 검증
```bash
node scripts/selftest.mjs   # 판정·필터·렌더 파이프라인 (내신3.0 → 3/3/30/10 재현 등)
```

## 면책
2026학년도 입시결과 기반 참고 자료이며 합격을 보장하지 않습니다. 대학별 성적 산출 방식에 따라 실제와 차이가 있을 수 있습니다. 출처: 대입정보포털 어디가.
