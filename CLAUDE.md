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

## 남은 후보
- 스페이스 노드에서 운영 플랫폼의 해당 화면으로 딥링크(현재는 영향 분석에서만 화면 이름 표시)
- 인스턴스 탐색기(레코드 사이를 걷는 그래프) 이식 — 현재 qdrive-unified의 데이터 관리자에 있음
- 문법 v1.1: 관계에 카디널리티(1:N·N:M)와 필수 여부 추가
