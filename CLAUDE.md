# Qdrive Ontology — 프로젝트 컨텍스트

대구 시내버스 데이터의 **의미 구조(온톨로지)** 를 다루는 독립 도구. 2026-08-14에 `qdrive-unified`의
「🧭 온톨로지 스튜디오」 탭을 분리해 만들었다.

## 왜 분리했나
운영 플랫폼(qdrive-unified)은 이해관계자별 화면이 축이고, 온톨로지 스튜디오는 **문법·인과**가 축이라
성격이 다르다. 한 앱에 두면 탭이 11개가 되어 "누가 보는가" 단일 축이 흐려진다. 별도 저장소로 두면
문법을 독립적으로 버전 관리할 수 있고, 다른 도시·사업자에게 그것만 떼어 보여줄 수 있다.

- 이 저장소: https://github.com/hyegeungim3-git/qdrive-ontology · 라이브 https://hyegeungim3-git.github.io/qdrive-ontology/
- 운영 플랫폼: https://github.com/hyegeungim3-git/qdrive-unified · 라이브 https://hyegeungim3-git.github.io/qdrive-unified/

## 핵심 사슬
`관측(Evidence) ─뒷받침한다→ 판정(Claim) ─반영된다→ 성과(Outcome) ←올린다─ 조치(Lever)`

이 사슬이 이 도구의 존재 이유다. 기존 온톨로지는 클래스가 관측·자산·주체에만 몰려 있고 판정·성과·조치가
비어 있어서 "AI가 왜 그렇게 판단했나"를 그래프로 답할 수 없었다. 그 데이터(justified·score·
recommendations·workOrders)는 엔진에 이미 있었고, 노드로 승격만 안 됐던 것.

## 구조
```
src/
  sim/        ← qdrive-unified와 동일한 시뮬레이터 코어 (types/geo/routes/engine/store)
                실단말 연동 시 PacketSource 교체 지점도 동일
  ontology/
    meta.ts        ← 9 스페이스 × 노드 타입 35종 · 메타 엣지 11방향 × 관계 어휘 30종 · 조치 5종/성과 연결 12건
    impactmeta.ts  ← 영향 범주 I1~I7 · 변경 유형 8종 · 전파 계산 · 액티브 메타데이터 4계층 12속성
    ui.tsx         ← Drawer · Sec (unified의 admin/ui에서 필요분만)
    util.ts        ← fmt
    SpaceGraph / Grammar / Simulator / Impact / ActiveMeta
  components/ ← ui.tsx(Panel·KpiCard 등) · DemoControls(배속·시연 트리거)
```

## 유래 — OpenCrab 벤치마킹 (2026-08-14)
사용자가 지정한 참고 대상: https://github.com/AlexAI-MCP/OpenCrab (MetaOntology OS MCP 플러그인, Python·Neo4j·Chroma).
- **가져온 것 = 개념 체계뿐**: 스페이스 문법(space × 허용 관계), 조치→성과 시뮬레이션 얼개, 영향 범주 I1~I7,
  액티브 메타데이터 4계층 12속성.
- **코드는 한 줄도 복사하지 않았다.** 그 저장소에 LICENSE 파일이 없어 기본값이 All rights reserved다.
- 스페이스 이름도 영어 원어를 쓰지 않고 우리 도메인 용어(주체·자산·관측·개념·판정·집단·성과·조치·규정)로
  재정의했다 — 최종 독자가 발주처 담당자라서.
- **도입하지 않은 것**: Neo4j·Chroma·MCP 서버·ReBAC 엔진·크롤러 워커(백엔드 없는 데모 원칙과 충돌),
  d3-force(9~35 노드 규모엔 고정 좌표가 안정적이고 250ms 라이브 리렌더와 충돌 위험).

## 설계 결정 (뒤집으려면 사용자 확인)
- **백엔드 없음** — 시뮬레이터 엔진만으로 자립. 오프라인에서도 돈다.
- **수치는 전부 엔진 파생** — 정적 숫자를 쓰지 않는다. 배속을 올리면 실제로 늘어나는 것이 이 도구의 신뢰 근거.
- **근거 유형별 신뢰도 상한** (실측 0.95 / 환산 0.85 / 추정 0.70 / 정성 0.50) — 강도를 아무리 올려도
  근거가 약한 계수는 상한을 못 넘는다. 모르는 것을 아는 척하지 않는 장치.
- **불이익 결정은 자동화하지 않는다** — 판정 스페이스의 성숙도에 명시.
- 커밋 메시지는 한국어. PowerShell here-string 사용, 쌍따옴표 금지. git identity는 저장소 로컬만.

## 렌더 규칙 (재사용 — 어기면 바로 티가 난다)
- SVG 그래프는 반드시 **엣지 → 라벨 → 노드** 3레이어로 그린다. 노드마다 선+도형을 함께 그리면
  뒤 노드의 선이 앞 노드를 덮는다.
- 엣지는 노드 경계에서 끊는다(`edgePt`). 라벨 겹침은 엣지별 위치값 + `paintOrder: stroke` halo로 회피.
- **짧은 가로 간선의 라벨은 노드에 가린다** → 노드 간 가로 간격을 라벨 폭 이상으로 벌릴 것.
- 동적 Tailwind 클래스(`bg-${x}-400`) 금지 → 인라인 style. JSX 줄바꿈 뒤 텍스트는 `{' '}` 필요.
  한글 줄바꿈은 `break-keep`.

## 검증
- `npm run build`(= `tsc -b && vite build`) 통과 확인. `tsc --noEmit`만으로는 미사용 import(TS6133)를 놓쳐 CI가 깨진다.
- 브라우저 검증은 DOM 텍스트·상태 우선. 5단계 전부 렌더 + 시뮬레이터 값 변동 + 375px 가로 오버플로 0 + pageerror 0.
- vite 8(rolldown) 빌드 크래시 시 `node_modules/.vite`·`dist` 삭제 후 재빌드.

## 2차 발전 (2026-08-14) — 정의만 있는 도구 → 정의가 작동하는 도구
사용자 요청 "온톨로지를 더 발전시켜보자". 5단계 → **8단계, 3그룹(정의·활용·운영)** 으로 재구성.
- **③ 문법 검증 (`Validator.tsx`)** — 출발·관계·도착을 조합해 허용/거부를 즉시 판정. 거부 코드 3종
  (`NO_DIRECTION`·`WRONG_RELATION`·`SAME_SPACE`)과 각각의 대안 힌트. 위반 사례 4종 프리셋.
  **핵심 수치: 만들 수 있는 조합 2,160 중 허용 30 = 1.4%** — "문법의 값어치는 무엇을 못 하는지에 있다".
- **④ 근거 사슬 (`Chain.tsx`)** — 차량을 고르면 안전점수를 역추적. 성과 ← 판정 ← 관측 3단 + 조치·맥락·규정
  3단. 마지막에 **실데이터로 방어 문장을 조립**한다("3742호의 66점은 급진로변경 3건·급가속 7건…의 감점
  판정이 반영된 값이며, 그중 1건은 방어운전으로 인정돼 복원됐습니다. 근거 패킷은 00:35:12…에 기록").
  이 화면이 온톨로지의 존재 이유를 가장 직접적으로 보여준다.
- **⑧ 내보내기 (`Export.tsx`)** — 문법을 4개 형식으로 생성: JSON-LD(13.5KB) · Turtle/OWL(8.8KB,
  `owl:ObjectProperty` + `rdfs:domain/range`로 문법 강제) · Cypher(4.9KB, 제약조건 + **문법 위반 감사 질의**) ·
  문법 명세서(Markdown). 복사·다운로드 실동작. "우리끼리만 아는 구조가 아니다"의 증명.
- 내비를 3그룹으로 묶어 8단계가 한눈에 들어오게 재배치.
- 검증: 빌드 통과 / 8단계 전부 렌더 / 검증기 허용·거부 양쪽(관측→판정 «뒷받침한다» ✅ 핵심 사슬 표시,
  관측→성과 ❌ NO_DIRECTION) / 내보내기 4형식 길이·내용 상이 확인(JSON.parse 통과) /
  근거 사슬 문장 실조립 / 375px 오버플로 0 / pageerror 0.

## 3차 발전 (2026-08-14) — 표준 정렬 · SHACL · 근거 사슬 전면 확장
사용자 요청 "SHACL 추가 + 근거 사슬 성과 지표 전체 확장 + 온톨로지 구조를 더 꼼꼼하게, 다른 온톨로지 벤치마킹".
8단계 → **9단계**. OpenCrab의 가장 큰 결손(외부 표준 정렬 없음)을 메운 것이 이번 발전의 핵심.

### 벤치마킹 조사 결과 — 무엇을 참고했나
OpenCrab 외에 조사한 표준 10종. 조사 근거는 W3C/OGC 규격 원문과 CEN Transmodel 문서.
- **PROV-O**(W3C) — Entity/Activity/Agent + wasDerivedFrom/wasGeneratedBy/wasAttributedTo.
  **우리 핵심 사슬(관측→판정→성과)이 문자 그대로 PROV의 파생 사슬**이다. 가장 중요한 정렬.
- **SOSA/SSN**(W3C·OGC) — Observation/Sensor/Platform/FeatureOfInterest. DTG·OBD·RTK 산출물이 곧 sosa:Observation,
  차량이 FeatureOfInterest, 단말이 Platform. 정확 일치로 붙는다.
- **Transmodel/NeTEx**(CEN) + **GTFS** — Line/Route/ScheduledStopPoint/VehicleJourney. 노선·정류장·회차.
- **DQV**(W3C) — QualityMeasurement/Metric/Dimension. 품질 6룰과 통과율.
- **SKOS**(W3C) — Concept/Collection + 매핑 관계(exact/close/broad/narrow). **정렬 강도 표기에 그대로 사용**.
- **ODRL**(W3C) — Policy/Permission/Prohibition/Duty. 규정 스페이스.
- **OWL-Time · GeoSPARQL · SHACL**(W3C·OGC) — 시간 구간 · 공간 대조 · 제약 검증.
- **공단 DTG 409/521** — 이미 준수 중인 국내 법정 표준.
- **도입하지 않음**: DCAT(데이터셋 카탈로그 — 온톨로지 층이 아님), QUDT(단위 — 지금 규모엔 과함).

### 구현
- **`standards.ts`** — STANDARDS 10종 · SPACE_ALIGN(9/9) · TYPE_ALIGN(16종) · **REL_META**(관계 30종 전부에
  카디널리티·필수 여부·역관계·표준 정렬) · TYPE_PROPS(12 타입의 속성 스키마 — SHACL의 근거).
  정렬 강도는 SKOS 매핑을 그대로 쓰고 **억지로 exact를 주장하지 않는다** — 인과 어휘 13종은 «고유».
- **`shacl.ts`** — 4종 제약 생성: ①속성(필수·자료형·범위·열거) ②관계(도착 클래스·카디널리티) ③문법(sh:closed)
  ④**도메인 규칙**(근거 없는 판정 금지 · 감점 자동확정 금지 · 실명 금지 · 회차 연료 누적값 탐지는 sh:sparql).
- **`StdAlign.tsx`**(③ 표준 정렬) — 정렬 현황·참조 표준 카드·정렬 표 3탭(스페이스/노드 타입/관계).
  **파일명 주의**: 컴포넌트를 `Standards.tsx`로 두면 데이터 `standards.ts`와 Windows에서 대소문자 충돌(TS1149) → `StdAlign.tsx`.
- **`chains.ts` + `Chain.tsx`**(⑤ 근거 사슬) — 성과 지표 **6종**으로 확장. 지표마다 사슬이 다르다:
  안전점수·경제운전(차량별, 실측) / 연료 절감률(반사실 비교, 실측) / CO₂(환산) / 배차 간격 편차(실측) /
  **정시율(미측정 — 원천이 없으면 숫자를 만들지 않는다는 것 자체를 사슬로 보여준다)**.
- **⑨ 내보내기** — SHACL 추가로 5형식. JSON-LD 13.5→26KB(정렬 포함), Turtle 8.8→11.6KB, SHACL 19KB.

### 함정
- **배차 간격 편차 오집계**: `headway`가 있어도 `frontId`가 null(앞차 없음)인 차량이 평균에 들어가 18.18분이 나왔다.
  `v.headway?.frontId`로 걸러 4.68분(7대)로 정정. chains.ts와 meta.ts(시뮬레이터 base) **양쪽 모두** 고쳐야 한다.
- 이 환경의 Bash는 긴 한글 heredoc에서 파싱이 깨진다 → 패치 스크립트는 Write로 파일 생성 후 실행할 것.

### 검증
빌드 통과 / 9단계 렌더 / 표준 정렬 9-9·16-35·17-30, 정확일치 15·근접 26·상위 9 / 관계 표에 카디널리티·역관계·필수 /
근거 사슬 6종 전부 다른 사슬·근거 유형(실측·환산·미측정) 구분·문장 실조립 / SHACL에 NodeShape·targetClass·minCount·
sh:in·sh:closed·sh:sparql·도메인 규칙 4종 확인 / 내보내기 5형식 상이 / 375px 오버플로 0 / pageerror 0.

## 남은 후보
- 스페이스 노드에서 운영 플랫폼의 해당 화면으로 딥링크(현재는 영향 분석에서만 화면 이름 표시)
- 인스턴스 탐색기(레코드 사이를 걷는 그래프) 이식 — 현재 qdrive-unified의 데이터 관리자에 있음
- 문법 v1.1: 관계에 시간 유효성(언제부터 언제까지 성립하는 관계인가) 추가
- SHACL 검증을 브라우저에서 실제로 돌려보기 (rdf-validate-shacl 등)
- 표준 정렬을 역방향으로도 — 외부 표준 데이터를 우리 문법으로 받아들이는 매핑
