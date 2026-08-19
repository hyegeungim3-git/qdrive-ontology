import { DEPOTS } from '../sim/depots'
import { ROUTES } from '../sim/routes'
import { RISK_EVENT_TYPES, type SimSnapshot } from '../sim/types'

/**
 * Qdrive 메타 온톨로지 — 9개 스페이스 문법.
 *
 * 데이터 관리자(🔗)가 "어떤 원천이 어떻게 들어오나"를 다룬다면,
 * 여기는 "그 데이터가 어떤 의미 구조로 서 있나"를 다룬다.
 *
 * 핵심 사슬:  관측(Evidence) ─뒷받침→ 판정(Claim) ─반영→ 성과(Outcome) ←올림─ 조치(Lever)
 * 이 사슬이 있어야 "AI가 왜 그렇게 판단했나"에 근거를 대며 답할 수 있다.
 */

export type SpaceId = 'policy' | 'resource' | 'subject' | 'evidence' | 'concept' | 'claim' | 'community' | 'outcome' | 'lever'

export type NodeType = {
  ko: string
  en: string
  /** 인스턴스 수 */
  count: (s: SimSnapshot) => number
  /** 엔진 실집계 여부 */
  live: boolean
  note: string
}

export type Space = {
  id: SpaceId
  ko: string
  en: string
  color: string
  desc: string
  types: NodeType[]
  /** 메타 그래프 좌표 */
  x: number
  y: number
}

/**
 * 위험운전 유형별 감점 가중치 — **개념 스페이스가 들고 있는 값**.
 *
 * 원래는 시뮬레이터 엔진(`EVENT_SCORE`)에 상수로 박혀 있었다. 그러면 «위험운전 가중치를 바꾸려면
 * 코드를 고친다»가 되어, 온톨로지는 그 결정을 구경만 하는 층이 된다.
 * 여기로 올려야 «규칙을 바꾸려면 개념 스페이스를 고치고 문법을 발행한다»가 성립한다.
 *
 * 엔진의 값은 이제 «단말이 준 참고치»이고, **하류로 나가는 확정 점수는 이 값으로 계산한다**(gate.ts).
 */
export const RISK_WEIGHT: Record<string, number> = {
  급가속: 1.5,
  급출발: 1.5,
  급감속: 2.0,
  급정지: 2.2,
  급진로변경: 1.8,
  급앞지르기: 2.4,
  급좌우회전: 1.2,
  급유턴: 2.6,
}
/** 안전점수 하한 — 아무리 감점돼도 여기 아래로 내려가지 않는다(제도적 하한) */
export const SCORE_FLOOR = 40

const uniqDrivers = (s: SimSnapshot) => new Set(s.vehicles.map((v) => v.driverName)).size
const sensorRows = (s: SimSnapshot) => Math.floor(s.simTime) * s.vehicles.length

export const SPACES: Space[] = [
  {
    id: 'policy', ko: '규정', en: 'Policy', color: '#f59e0b', x: 85, y: 70,
    desc: '무엇을 허용하고 무엇을 금지하는가 — 접근·보존·비식별·자동화 한계',
    types: [
      { ko: '접근 권한', en: 'AccessPolicy', count: () => 3, live: false, note: '시 · 운수사 · 기사 각자 자기 범위만' },
      { ko: '보존 기간', en: 'RetentionPolicy', count: () => 3, live: false, note: '원본 5년 · 분석셋 3년 · 격리 로그 1년' },
      { ko: '가명 처리', en: 'Pseudonymization', count: () => 1, live: false, note: '기사 식별정보는 분석셋에서 분리' },
      { ko: '불이익 결정 금지', en: 'NoAutoAdverse', count: () => 1, live: false, note: '평가·징계·정산 확정은 자동화하지 않음' },
      // 유효 구간은 «언제부터 언제까지 이 관계가 성립하는가»를 정하는 규칙이라 규정 스페이스에 둔다.
      // 보존 기간이 이미 시간 규칙인 것과 같은 자리다. 실서비스에서는 RDF-star나 named graph로 간다.
      { ko: '유효 구간', en: 'Validity', count: () => 0, live: true, note: '관계가 언제부터 언제까지 성립하나 — OWL-Time' },
    ],
  },
  {
    id: 'resource', ko: '자산', en: 'Resource', color: '#34d399', x: 335, y: 175,
    desc: '주체가 다루는 대상 — 차량·노선·정류장·단말',
    types: [
      { ko: '차량', en: 'Vehicle', count: (s) => s.vehicles.length, live: true, note: '차량번호가 자연키 — 모든 원천의 조인 축' },
      { ko: '노선', en: 'Route', count: () => ROUTES.length, live: true, note: '인가노선 폴리라인 = 정산 검증 기준' },
      { ko: '정류장', en: 'Stop', count: () => ROUTES.reduce((n, r) => n + r.stops.length, 0), live: true, note: '정차 품질·배차 간격의 기준점' },
      { ko: '차내 단말', en: 'Device', count: (s) => s.vehicles.length, live: true, note: 'DTG·OBD·RTK 통합 수집 지점' },
      // 차고지가 없으면 «수입 없이 달린 거리(공차)»를 걸 자리가 없다 — 엔진·AI Q는 이미 이 축으로 답한다
      { ko: '차고지', en: 'Depot', count: () => DEPOTS.length, live: true, note: '출·입고 지점 — 기점과 떨어진 만큼 공차가 생긴다' },
    ],
  },
  {
    id: 'subject', ko: '주체', en: 'Subject', color: '#a78bfa', x: 85, y: 175,
    desc: '의도와 권한을 가진 행위자 — 기사·관제·담당 공무원',
    types: [
      { ko: '기사', en: 'Driver', count: uniqDrivers, live: true, note: '분석셋에서는 가명 처리' },
      { ko: '관제 담당', en: 'Controller', count: () => 2, live: false, note: 'AI 조치안을 승인하는 사람' },
      { ko: '담당 공무원', en: 'Officer', count: () => 1, live: false, note: '보고서·공문을 결재하는 사람' },
    ],
  },
  {
    id: 'evidence', ko: '관측', en: 'Evidence', color: '#22d3ee', x: 335, y: 280,
    desc: '실제로 일어난 일의 기록 — 판정의 근거가 되는 원 데이터',
    types: [
      { ko: '운행 기록', en: 'Trip', count: (s) => s.trips.length + s.deadheads.length, live: true, note: 'DTG 521 — 온톨로지의 시간 축 (영업 + 공차)' },
      { ko: '위험운전 패킷', en: 'RiskEvent', count: (s) => s.kpi.totalEvents, live: true, note: 'DTG 409 — 공단 표준 8종' },
      { ko: '센서 측정', en: 'SensorReading', count: sensorRows, live: true, note: 'OBD/CAN 21종 · 1초' },
      { ko: '위치 관측', en: 'Location', count: sensorRows, live: true, note: 'RTK cm급 — 차로 단위' },
      // 엔진이 이미 내고 있는데 그래프가 안 받던 값들 — 정의만 늘리는 게 아니라 실제로 연결한다
      { ko: '승객 관측', en: 'PassengerCount', count: (s) => s.vehicles.length, live: true, note: 'APC 재차 인원 — 혼잡도 판정의 근거' },
      { ko: '정류장 통과', en: 'StopEvent', count: (s) => s.vehicles.filter((v) => v.dwellRemaining > 0).length, live: true, note: '정차 중인 차량 — 도착 실측이 붙으면 정시율의 근거가 된다' },
      { ko: '환경 관측', en: 'EnvReading', count: () => 1, live: true, note: '날씨·기온·강수 — 급조작이 방어운전인지 가리는 맥락' },
      { ko: '상황 설명', en: 'Plea', count: (s) => s.pleas.length, live: true, note: '기사의 음성·버튼 진술' },
    ],
  },
  {
    id: 'concept', ko: '개념', en: 'Concept', color: '#b8bb26', x: 585, y: 385,
    desc: '반복해서 쓰는 분류 어휘 — 표준 코드를 그대로 쓴다',
    types: [
      { ko: '위험운전 유형', en: 'RiskType', count: () => RISK_EVENT_TYPES.length, live: false, note: '공단 표준 8종 — 자체 정의 금지 · 유형별 감점 가중치를 여기가 들고 있다' },
      { ko: '노선 등급', en: 'RouteGrade', count: () => 3, live: false, note: '효율 A·B·C' },
      // 탄소 — 계수를 코드 상수가 아니라 그래프에 둔다. 「어느 계수를 썼나」에 답해야 검증이 된다
      { ko: '배출계수', en: 'EmissionFactor', count: () => 3, live: false, note: 'CNG 2.68 · 전력 0.4594 · 경유 2.61 kg-CO₂ 단위당' },
      { ko: '감축 수단', en: 'AbatementMeasure', count: () => 4, live: false, note: '경제운전 · 배차 최적화 · 공회전 제한 · 전기 전환' },
      // 안전 — 위험운전을 공간으로 묶는다. 「그 기사가 문제」와 「그 구간이 문제」는 다른 정책이다
      { ko: '위험 구간', en: 'RiskZone', count: (s) => Math.min(6, s.events.length), live: true, note: '위험운전이 반복되는 지점 — 격자로 묶는다' },
      { ko: '혼잡 등급', en: 'CrowdLevel', count: () => 3, live: false, note: '여유 · 보통 · 혼잡 — 재차율 구간' },
      { ko: '낭비 요인', en: 'WasteFactor', count: () => 4, live: false, note: '공회전 · 급조작 · 습관 · 냉난방' },
      { ko: '연료 종류', en: 'FuelType', count: () => 2, live: false, note: 'CNG · 전기' },
      { ko: '운행유형', en: 'TripKind', count: () => 2, live: true, note: '영업 · 공차 — 거리·연료만으로는 갈라지지 않는 축' },
    ],
  },
  {
    id: 'claim', ko: '판정', en: 'Claim', color: '#fb7185', x: 585, y: 175,
    desc: '관측에서 끌어낸 주장 — 반드시 근거를 달고 다닌다',
    types: [
      { ko: '정당 판정', en: 'JustifyVerdict', count: (s) => s.kpi.totalEvents, live: true, note: '급조작이 방어운전이었나 — 인정 시 감점 복원' },
      { ko: '민원 사실 판정', en: 'ComplaintVerdict', count: (s) => s.complaints.filter((c) => c.evidence).length, live: true, note: '증빙 매칭 결과 + 사실 가능성 %' },
      { ko: '노선 준수 판정', en: 'RouteCompliance', count: (s) => s.trips.length, live: true, note: '인가노선 대조 — 정산 검증 근거' },
      { ko: '연료 낭비 분해', en: 'FuelWaste', count: (s) => s.trips.length, live: true, note: '공회전·급조작·습관·냉난방 — 「왜 더 썼나」에 답한다' },
      { ko: '배출 산정', en: 'Emission', count: (s) => s.trips.length, live: true, note: '활동자료 × 배출계수 — 계산이 아니라 판정이다' },
      { ko: '혼잡 판정', en: 'CrowdingVerdict', count: (s) => s.vehicles.length, live: true, note: '재차율이 혼잡 구간에 들었나' },
      { ko: '고장 예측', en: 'FaultPrediction', count: (s) => (s.fault ? 1 : 0) + s.workOrders.length, live: true, note: '센서 이상 징후 → 잔여수명 추정' },
      {
        ko: '몰림 판정',
        en: 'BunchingVerdict',
        count: (s) => s.vehicles.filter((v) => v.headway?.frontId).length,
        live: true,
        note: '앞차 간격이 이상값에서 얼마나 벗어났나 — 배차 간격 성과의 근거',
      },
    ],
  },
  {
    id: 'community', ko: '집단', en: 'Community', color: '#8ec07c', x: 335, y: 385,
    desc: '비슷한 것끼리 묶은 군 — 개인이 아니라 군 단위로 봐야 보이는 것',
    types: [
      { ko: '운전군', en: 'DriverCohort', count: () => 3, live: false, note: '모범 · 평균 · 코칭 대상 — A/B 효과 검증 단위' },
      { ko: '운수사', en: 'Operator', count: (s) => new Set([...s.trips, ...s.deadheads].map((t) => t.company)).size, live: true, note: '차고지·차량·기사를 묶는 정산·평가 단위' },
      { ko: '시간대군', en: 'TimeBand', count: () => 4, live: false, note: '출근 · 낮 · 퇴근 · 심야 — 증차·감차 판단의 축' },
      { ko: '노선군', en: 'RouteCluster', count: () => 2, live: false, note: '급행 · 순환' },
    ],
  },
  {
    id: 'outcome', ko: '성과', en: 'Outcome', color: '#38bdf8', x: 835, y: 175,
    desc: '측정 가능한 결과 — 조치가 움직이려는 대상',
    types: [
      { ko: '안전점수', en: 'SafetyScore', count: (s) => s.vehicles.length, live: true, note: '차량·기사 단위 0~100' },
      { ko: '경제운전 점수', en: 'EcoScore', count: (s) => s.vehicles.length, live: true, note: '관성주행·조기 발떼기' },
      { ko: '연료 절감', en: 'FuelSaving', count: () => 1, live: true, note: '코칭 미적용 기준선 대비 순수 절감' },
      { ko: 'CO₂ 감축', en: 'Co2Reduction', count: () => 1, live: true, note: '연료 실측 × 배출계수' },
      {
        ko: '배차 간격',
        en: 'Headway',
        count: (s) => s.vehicles.filter((v) => v.headway?.frontId).length,
        live: true,
        note: '앞차 간격 편차 — 관측·판정을 거쳐 성과가 된다',
      },
      { ko: '감축 실적', en: 'Reduction', count: () => 1, live: true, note: '기준선 대비 — 기준선 없는 감축 주장은 검증이 안 된다' },
      { ko: '수송 실적', en: 'Ridership', count: (s) => s.passengers, live: true, note: '누적 탑승객 — 배차 효과의 최종 지표' },
      { ko: '정시율', en: 'Punctuality', count: () => ROUTES.length, live: false, note: '노선별 — 2차 APC 연동 시 실측' },
    ],
  },
  {
    id: 'lever', ko: '조치', en: 'Lever', color: '#d3869b', x: 835, y: 385,
    desc: '성과를 움직이려고 우리가 당기는 손잡이 — 여기가 서비스의 실체',
    types: [
      { ko: '실시간 코칭', en: 'Coaching', count: (s) => s.kpi.totalEvents, live: true, note: '급조작 감지 즉시 기사에게' },
      { ko: '배차 권고', en: 'DispatchAdvice', count: (s) => s.recommendations.length, live: true, note: '몰림 해소 — 승인 후 실행' },
      { ko: '예지정비', en: 'PredictiveMaint', count: (s) => s.workOrders.length, live: true, note: '고장 전 작업지시' },
      { ko: '안전 인센티브', en: 'Incentive', count: () => 1, live: false, note: '제도 — 상위 점수 가산' },
      { ko: '전기 전환', en: 'Electrification', count: () => 1, live: false, note: '3차 — 차량 교체 투자' },
    ],
  },
]

export const spaceOf = (id: SpaceId) => SPACES.find((s) => s.id === id)!

/* ═══════════ 메타 엣지 — 스페이스 사이에 허용된 관계 어휘 ═══════════ */
export type MetaEdge = {
  from: SpaceId
  to: SpaceId
  /** 이 방향에서 쓸 수 있는 관계 (이 밖의 관계는 만들지 않는다) */
  relations: string[]
  desc: string
  /** 핵심 사슬 여부 — 그래프에서 굵게 */
  core?: boolean
  /** 곡선 정도 (직선이 다른 노드를 지날 때) */
  bow?: number
}

export const META_EDGES: MetaEdge[] = [
  { from: 'subject', to: 'resource', relations: ['운전한다', '관리한다', '조회권한', '승인권한'], desc: '주체는 자산에 대한 역할과 권한을 가진다' },
  { from: 'resource', to: 'evidence', relations: ['생성한다', '기록된다'], desc: '자산이 움직이면 관측이 남는다' },
  // 관측 → 자산: 「이 운행이 어느 차고지 소속인가」. 자산 → 관측(생성한다)과 방향이 반대인 별개 관계다
  { from: 'evidence', to: 'resource', relations: ['소속차고지'], desc: '관측이 어느 자산에 소속돼 일어났는가' },
  // 자산 → 집단: 책임 소재. 운수사는 사람이 아니라 «집단»이라 주체가 아닌 집단 스페이스에 선다
  { from: 'resource', to: 'community', relations: ['운영주체'], desc: '그 자산의 운영 책임이 어느 집단(운수사)에 있는가' },
  { from: 'evidence', to: 'concept', relations: ['분류된다', '예시가 된다'], desc: '관측은 표준 어휘로 분류된다' },
  { from: 'evidence', to: 'claim', relations: ['뒷받침한다', '반박한다', '시각을 고정한다'], desc: '판정은 관측 없이 성립하지 않는다', core: true },
  { from: 'claim', to: 'outcome', relations: ['반영된다', '보정한다'], desc: '판정이 확정되면 성과 수치에 반영된다', core: true },
  { from: 'concept', to: 'outcome', relations: ['기여한다', '제약한다', '예측한다', '악화시킨다'], desc: '어떤 개념이 성과를 끌고 내리는가' },
  { from: 'lever', to: 'outcome', relations: ['올린다', '낮춘다', '안정시킨다', '최적화한다'], desc: '조치가 성과를 움직인다 — 시뮬레이션의 근거', core: true },
  { from: 'lever', to: 'concept', relations: ['바꾼다'], desc: '조치는 습관·상태 같은 개념도 바꾼다' },
  { from: 'community', to: 'concept', relations: ['묶는다', '요약한다'], desc: '군 단위로 묶어야 보이는 패턴' },
  { from: 'policy', to: 'resource', relations: ['보호한다', '등급을 매긴다', '제한한다'], desc: '규정이 자산의 취급을 정한다' },
  { from: 'policy', to: 'subject', relations: ['허용한다', '금지한다', '승인을 요구한다'], desc: '규정이 주체가 할 수 있는 일을 정한다' },
]

/** 관계 어휘 사전 — 문법표에서 뜻을 보여준다 */
export const RELATION_GLOSSARY: Record<string, string> = {
  운전한다: '기사가 그 차량을 실제로 운전했다.',
  관리한다: '운수사·시가 그 자산을 관리 책임진다.',
  조회권한: '그 자산의 데이터를 볼 수 있다.',
  승인권한: '그 자산에 대한 조치를 승인할 수 있다.',
  생성한다: '자산이 움직이면서 그 관측을 만들어냈다.',
  소속차고지: '그 운행이 출·입고한 차고지. 회차마다 정확히 하나여야 한다.',
  운영주체: '그 차고지·차량을 운영하는 운수사. 정산·평가의 책임 단위다.',
  기록된다: '자산의 상태가 그 관측으로 기록됐다.',
  분류된다: '관측이 표준 어휘의 어느 값에 해당한다.',
  '예시가 된다': '그 개념의 구체 사례다.',
  뒷받침한다: '관측이 판정을 성립시킨다 — 근거.',
  반박한다: '관측이 판정과 어긋난다.',
  '시각을 고정한다': '판정이 언제 일인지 관측이 확정한다.',
  반영된다: '판정 결과가 성과 수치에 들어간다.',
  보정한다: '판정이 성과 산출을 교정한다 (예: 정당 인정 → 감점 복원).',
  기여한다: '그 개념이 성과를 끌어올린다.',
  제약한다: '그 개념이 성과의 상한을 누른다.',
  예측한다: '그 개념이 성과의 선행 지표다.',
  악화시킨다: '그 개념이 성과를 떨어뜨린다.',
  올린다: '조치를 쓰면 성과가 올라간다.',
  낮춘다: '조치를 쓰면 성과(비용·사고 등)가 내려간다.',
  안정시킨다: '조치가 성과의 변동을 줄인다.',
  최적화한다: '조치가 성과를 목표치로 끌어간다.',
  바꾼다: '조치가 개념(습관·상태)을 바꾼다.',
  묶는다: '비슷한 것끼리 하나의 군으로 묶는다.',
  요약한다: '군의 특징을 요약한다.',
  보호한다: '규정이 그 자산을 보호한다.',
  '등급을 매긴다': '민감도 등급을 부여한다.',
  제한한다: '사용 방법을 제한한다.',
  허용한다: '주체에게 그 행위를 허용한다.',
  금지한다: '주체에게 그 행위를 금지한다.',
  '승인을 요구한다': '그 행위 전에 승인을 받아야 한다.',
}

/* ═══════════ 조치(Lever) → 성과(Outcome) — 시뮬레이션 정의 ═══════════ */
export type Basis = '실측' | '환산' | '추정' | '정성'
/** 근거 유형별 신뢰도 상한 — 정직하게 상한을 다르게 둔다 */
export const BASIS_CAP: Record<Basis, number> = { 실측: 0.95, 환산: 0.85, 추정: 0.7, 정성: 0.5 }

export type LeverTarget = {
  outcome: string
  rel: '올린다' | '낮춘다' | '안정시킨다' | '최적화한다'
  /** 강도 1.0일 때의 변화율 */
  sensitivity: number
  unit: string
  decimals: number
  basis: Basis
  /** 계수의 출처 */
  why: string
  base: (s: SimSnapshot) => number
}

export type LeverDef = {
  key: string
  ko: string
  en: string
  desc: string
  stage: '1차' | '2차' | '3차'
  live: (s: SimSnapshot) => number
  liveLabel: string
  targets: LeverTarget[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export const LEVERS: LeverDef[] = [
  {
    key: 'coaching', ko: '실시간 코칭', en: 'Coaching', stage: '1차',
    desc: '급조작을 감지한 즉시 기사 태블릿에 코칭을 띄운다',
    live: (s) => s.kpi.totalEvents, liveLabel: '오늘 발화',
    targets: [
      { outcome: '연료 절감', rel: '올린다', sensitivity: 0.35, unit: '%', decimals: 2, basis: '실측',
        why: '코칭 미적용 기준선(baselineFuelM3)과 실측 연료의 차이 — 유가·날씨가 제거된 순수 효과', base: (s) => s.kpi.fuelSavedPct },
      { outcome: 'CO₂ 감축', rel: '올린다', sensitivity: 0.35, unit: 'kg', decimals: 1, basis: '환산',
        why: '연료 절감량 × 배출계수 2.68', base: (s) => s.kpi.totalCo2SavedKg },
      { outcome: '평균 안전점수', rel: '올린다', sensitivity: 0.12, unit: '점', decimals: 1, basis: '추정',
        why: '운전군별 개선율 차이(모범 2.86% · 평균 5.25% · 코칭대상 6.34%)에서 유도', base: (s) => s.kpi.avgScore },
      { outcome: '경제운전 점수', rel: '올린다', sensitivity: 0.15, unit: '점', decimals: 1, basis: '추정',
        why: '관성주행 비율 개선 — 실증에서 재검증 대상', base: (s) => avg(s.vehicles.map((v) => v.ecoScore)) },
    ],
  },
  {
    key: 'dispatch', ko: '배차 권고', en: 'DispatchAdvice', stage: '1차',
    desc: '앞차와 몰리면 정류장 추가 대기를 권고한다 (승인 후 실행)',
    live: (s) => s.recommendations.length, liveLabel: '오늘 권고',
    targets: [
      { outcome: '배차 간격 편차', rel: '낮춘다', sensitivity: 0.3, unit: '분', decimals: 2, basis: '실측',
        why: '앞차 간격과 이상 간격의 차이 — 엔진 headway 실집계',
        base: (s) => avg(s.vehicles.filter((v) => v.headway?.frontId).map((v) => Math.abs(v.headway!.frontGapMin - v.headway!.idealMin))) },
      { outcome: '정시율', rel: '안정시킨다', sensitivity: 0.04, unit: '%', decimals: 2, basis: '추정',
        why: '몰림 해소 시 도착 편차 축소 — 2차 APC 연동 시 실측으로 대체', base: () => 95.0 },
    ],
  },
  {
    key: 'maint', ko: '예지정비', en: 'PredictiveMaint', stage: '1차',
    desc: '센서 이상 징후를 잡아 고장 전에 작업지시를 낸다',
    live: (s) => s.workOrders.length, liveLabel: '오늘 발행',
    targets: [
      { outcome: '월 정비비', rel: '낮춘다', sensitivity: 0.4, unit: '만원', decimals: 0, basis: '추정',
        why: '긴급수리 → 예방정비 전환 시 절감 (26개사 평균 추정)', base: () => 340 },
      { outcome: '결행률', rel: '낮춘다', sensitivity: 0.45, unit: '%', decimals: 2, basis: '추정',
        why: '운행 중 고장으로 인한 결행 감소', base: () => 0.8 },
    ],
  },
  {
    key: 'incentive', ko: '안전 인센티브', en: 'Incentive', stage: '2차',
    desc: '안전점수 상위 기사에게 가산 — 수용성을 높이는 제도 손잡이',
    live: () => 1, liveLabel: '운영 제도',
    targets: [
      { outcome: '평균 안전점수', rel: '올린다', sensitivity: 0.06, unit: '점', decimals: 1, basis: '추정',
        why: '코칭 단독 대비 추가 효과 — 실증에서 A/B로 분리 검증 필요', base: (s) => s.kpi.avgScore },
      { outcome: '기사 수용성', rel: '올린다', sensitivity: 0.1, unit: '%', decimals: 1, basis: '정성',
        why: '설문 기반 — 아직 측정 체계 없음, 실증에서 수립', base: () => 78 },
    ],
  },
  {
    key: 'ev', ko: '전기 전환', en: 'Electrification', stage: '3차',
    desc: '노후 CNG 차량을 전기버스로 교체 — 가장 큰 손잡이, 가장 큰 투자',
    live: () => 1, liveLabel: '투자 조치',
    targets: [
      { outcome: 'CO₂ 감축', rel: '올린다', sensitivity: 1.8, unit: 'kg', decimals: 1, basis: '환산',
        why: '전환 대상 차량의 연료 사용이 0이 됨 — 전력 배출계수는 별도 차감 필요', base: (s) => s.kpi.totalCo2SavedKg },
      { outcome: '월 연료비', rel: '낮춘다', sensitivity: 0.6, unit: '만원', decimals: 0, basis: '추정',
        why: 'CNG 대비 전력 단가 차이 — 충전 인프라 비용 미포함', base: () => 1550 },
    ],
  },
]

/** 방향 부호 — OpenCrab의 lever_simulate와 같은 얼개, 계수만 우리 엔진 값 */
export const DIR_SIGN: Record<LeverTarget['rel'], number> = { 올린다: 1, 낮춘다: -1, 안정시킨다: 0, 최적화한다: 0.8 }

/** 예측 결과 */
export function simulate(t: LeverTarget, magnitude: number, s: SimSnapshot) {
  const base = t.base(s)
  const sign = DIR_SIGN[t.rel]
  const delta = base * t.sensitivity * magnitude * sign
  const predicted = base + delta
  /** 변동 축소형(안정시킨다)은 값이 아니라 편차가 줄어든다 */
  const spreadCut = t.rel === '안정시킨다' ? t.sensitivity * magnitude : 0
  const confidence = Math.min(BASIS_CAP[t.basis], 0.45 + magnitude * 0.5)
  return { base, delta, predicted, spreadCut, confidence }
}

/** 조치를 움직였을 때 함께 흔들리는 영향 범주 (OpenCrab I1~I7 얼개) */
export const IMPACT_ON_LEVER = [
  { id: 'I5', ko: '로직 영향', why: '성과 산출식과 추론 사슬이 다시 계산됩니다' },
  { id: 'I7', ko: '다운스트림 영향', why: '탄소중립 분석·성과 검증·경영 손익 화면의 숫자가 함께 바뀝니다' },
]
