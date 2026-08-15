import { META_EDGES, SPACES, type SpaceId } from './meta'

/**
 * 표준 정렬 — 우리 어휘를 국제 표준 어휘에 대응시킨다.
 *
 * OpenCrab에는 이 층이 없다(자체 문법만 있고 외부 표준과의 대응이 없음).
 * 정렬이 없으면 "우리끼리만 아는 구조"가 되고, 다른 도시·검증기관·연구자와 데이터를 합칠 수 없다.
 *
 * 정렬 강도는 SKOS 매핑 관계를 그대로 쓴다 — 억지로 exact를 주장하지 않는 것이 요점.
 */

export type MatchLevel = 'exact' | 'close' | 'broad' | 'narrow' | 'none'

export const MATCH_LABEL: Record<MatchLevel, { ko: string; skos: string; tone: string; why: string }> = {
  exact: { ko: '정확 일치', skos: 'skos:exactMatch', tone: 'text-emerald-400', why: '뜻이 같아 서로 바꿔 써도 된다' },
  close: { ko: '근접', skos: 'skos:closeMatch', tone: 'text-sky-400', why: '거의 같지만 맥락이 조금 다르다' },
  broad: { ko: '상위 개념', skos: 'skos:broadMatch', tone: 'text-amber-400', why: '표준 쪽이 더 넓다 — 우리가 그 하위' },
  narrow: { ko: '하위 개념', skos: 'skos:narrowMatch', tone: 'text-violet-400', why: '표준 쪽이 더 좁다' },
  none: { ko: '고유', skos: '—', tone: 'text-gray-500', why: '대응하는 표준 어휘가 없다 — 우리 도메인 고유' },
}

export type Standard = {
  key: string
  prefix: string
  ko: string
  org: string
  uri: string
  what: string
  why: string
}

export const STANDARDS: Standard[] = [
  {
    key: 'prov', prefix: 'prov', ko: 'PROV-O — 출처·근거', org: 'W3C 권고', uri: 'http://www.w3.org/ns/prov#',
    what: 'Entity(산출물) · Activity(행위) · Agent(책임 주체)와 wasDerivedFrom · wasGeneratedBy · wasAttributedTo',
    why: '우리 핵심 사슬(관측 → 판정 → 성과)이 바로 PROV의 파생 사슬이다. 근거를 대는 문법의 국제 표준.',
  },
  {
    key: 'sosa', prefix: 'sosa', ko: 'SOSA/SSN — 센서 관측', org: 'W3C · OGC 공동 권고', uri: 'http://www.w3.org/ns/sosa/',
    what: 'Observation · Sensor · Platform · FeatureOfInterest · ObservableProperty, madeBySensor · observedProperty · hasResult',
    why: 'DTG·OBD·RTK가 만들어내는 것이 정확히 sosa:Observation이다. 차량은 관측 대상, 단말은 플랫폼.',
  },
  {
    key: 'tm', prefix: 'tm', ko: 'Transmodel / NeTEx · GTFS — 대중교통', org: 'CEN 표준 · GTFS 사실상 표준', uri: 'http://www.transmodel-cen.eu/',
    what: 'Line · Route · ScheduledStopPoint · VehicleJourney (GTFS의 route · stop · trip에 대응)',
    why: '노선·정류장·회차는 이미 국제 표준이 있다. 자체 정의를 만들면 대구 BIS·타 도시와 못 붙는다.',
  },
  {
    key: 'dqv', prefix: 'dqv', ko: 'DQV — 데이터 품질', org: 'W3C 노트', uri: 'http://www.w3.org/ns/dqv#',
    what: 'QualityMeasurement · Metric · Dimension · Category, hasQualityMeasurement · isMeasurementOf · value',
    why: '품질 6룰은 dqv:Metric이고, 통과율은 dqv:QualityMeasurement다. 품질을 말로 하지 않고 값으로 남긴다.',
  },
  {
    key: 'skos', prefix: 'skos', ko: 'SKOS — 개념 어휘', org: 'W3C 권고', uri: 'http://www.w3.org/2004/02/skos/core#',
    what: 'Concept · Collection · ConceptScheme, broader · narrower · member, exactMatch · closeMatch · broadMatch',
    why: '위험운전 8종 같은 분류 어휘의 표준. 이 표의 정렬 강도 자체도 SKOS 매핑 관계를 쓴다.',
  },
  {
    key: 'odrl', prefix: 'odrl', ko: 'ODRL — 정책 표현', org: 'W3C 권고', uri: 'http://www.w3.org/ns/odrl/2/',
    what: 'Policy · Permission · Prohibition · Duty, target · assignee · action',
    why: '규정 스페이스(접근 권한·금지)를 사람 말이 아니라 기계가 읽는 정책으로 남긴다.',
  },
  {
    key: 'time', prefix: 'time', ko: 'OWL-Time — 시간', org: 'W3C 권고', uri: 'http://www.w3.org/2006/time#',
    what: 'Interval · Instant, hasBeginning · hasEnd · inXSDDateTime',
    why: '운행은 구간(Interval)이고 이벤트는 시점(Instant)이다. 시간 비교를 표준 방식으로.',
  },
  {
    key: 'sh', prefix: 'sh', ko: 'SHACL — 제약 검증', org: 'W3C 권고', uri: 'http://www.w3.org/ns/shacl#',
    what: 'NodeShape · PropertyShape, targetClass · path · minCount · datatype · class · in · severity',
    why: 'OWL은 어휘를 정의할 뿐 검사하지 않는다. 실제로 막는 것은 SHACL이다.',
  },
  {
    key: 'geo', prefix: 'geo', ko: 'GeoSPARQL — 공간', org: 'OGC 표준', uri: 'http://www.opengis.net/ont/geosparql#',
    what: 'Geometry · asWKT · sfWithin',
    why: '인가노선 폴리라인 대조(정산 검증)를 표준 공간 연산으로 표현할 수 있다.',
  },
  {
    key: 'dtg', prefix: 'dtg', ko: '공단 DTG 409/521', org: '한국교통안전공단 (법정)', uri: 'https://www.kotsa.or.kr/',
    what: '위험운전 8종 코드 · 운행기록 항목 · eTAS 제출 규격',
    why: '이미 쓰고 있다. 국내 법정 표준이라 이걸 지키는 것이 다른 무엇보다 먼저다.',
  },
]

export const stdOf = (key: string) => STANDARDS.find((s) => s.key === key)

export type Align = { std: string; term: string; match: MatchLevel; note?: string }

/* ── 스페이스 정렬 ── */
export const SPACE_ALIGN: Record<SpaceId, Align[]> = {
  policy: [{ std: 'odrl', term: 'odrl:Policy', match: 'close', note: '접근·금지·승인요구는 ODRL Permission/Prohibition/Duty로 표현' }],
  resource: [
    { std: 'sosa', term: 'sosa:FeatureOfInterest', match: 'broad', note: '차량은 정확히 대응 · 노선·정류장은 Transmodel 쪽' },
    { std: 'tm', term: 'tm:Line / tm:ScheduledStopPoint', match: 'close' },
  ],
  subject: [{ std: 'prov', term: 'prov:Agent', match: 'exact', note: '책임을 지는 주체 — 뜻이 그대로 같다' }],
  evidence: [
    { std: 'sosa', term: 'sosa:Observation', match: 'exact', note: '센서·위치·위험운전 패킷 모두 관측 행위의 결과' },
    { std: 'prov', term: 'prov:Entity', match: 'close', note: '파생 사슬의 출발점' },
  ],
  concept: [{ std: 'skos', term: 'skos:Concept', match: 'exact' }],
  claim: [{ std: 'prov', term: 'prov:Entity', match: 'broad', note: '관측에서 파생된 엔티티 — prov:wasDerivedFrom으로 근거를 매단다' }],
  community: [{ std: 'skos', term: 'skos:Collection', match: 'close' }],
  outcome: [
    { std: 'dqv', term: 'dqv:QualityMeasurement', match: 'broad', note: '측정값이라는 점은 같으나 품질 지표에 한정되지 않는다' },
    { std: 'prov', term: 'prov:Entity', match: 'close' },
  ],
  lever: [{ std: 'prov', term: 'prov:Activity', match: 'close', note: '시간에 걸쳐 일어나며 엔티티를 만들어내는 행위' }],
}

/* ── 노드 타입 정렬 (핵심만) ── */
export const TYPE_ALIGN: Record<string, Align[]> = {
  Vehicle: [{ std: 'sosa', term: 'sosa:FeatureOfInterest', match: 'exact' }, { std: 'tm', term: 'GTFS-RT vehicle', match: 'close' }],
  Route: [{ std: 'tm', term: 'tm:Line (GTFS route)', match: 'close', note: 'Transmodel은 Line/Route를 구분 — 우리 「노선」은 Line에 가깝다' }],
  Stop: [{ std: 'tm', term: 'tm:ScheduledStopPoint (GTFS stop)', match: 'close' }],
  Device: [{ std: 'sosa', term: 'sosa:Platform', match: 'exact', note: 'DTG·OBD·RTK 센서를 얹고 있는 플랫폼' }],
  Trip: [{ std: 'tm', term: 'tm:VehicleJourney (GTFS trip)', match: 'close' }, { std: 'time', term: 'time:Interval', match: 'close' }],
  RiskEvent: [{ std: 'sosa', term: 'sosa:Observation', match: 'exact' }, { std: 'dtg', term: 'DTG 409 위험운전 8종', match: 'exact' }],
  SensorReading: [{ std: 'sosa', term: 'sosa:Observation', match: 'exact' }],
  Location: [{ std: 'sosa', term: 'sosa:Observation', match: 'exact' }, { std: 'geo', term: 'geo:Geometry', match: 'close' }],
  Plea: [{ std: 'prov', term: 'prov:Entity', match: 'broad', note: '기사가 만든 진술 — prov:wasAttributedTo 기사' }],
  Driver: [{ std: 'prov', term: 'prov:Agent', match: 'exact' }],
  RiskType: [{ std: 'skos', term: 'skos:Concept', match: 'exact' }, { std: 'dtg', term: '공단 표준 코드', match: 'exact' }],
  JustifyVerdict: [{ std: 'prov', term: 'prov:Entity', match: 'broad' }],
  SafetyScore: [{ std: 'dqv', term: 'dqv:QualityMeasurement', match: 'broad' }],
  Coaching: [{ std: 'prov', term: 'prov:Activity', match: 'close' }],
  AccessPolicy: [{ std: 'odrl', term: 'odrl:Policy', match: 'exact' }],
  Validity: [{ std: 'time', term: 'time:Interval', match: 'close', note: '시작·끝이 있는 구간' }],
  WorkOrder: [{ std: 'prov', term: 'prov:Activity', match: 'close' }],
}

/* ── 관계 메타 — 카디널리티 · 필수 · 역관계 · 표준 정렬 ── */
export type Card = '1:1' | '1:N' | 'N:1' | 'N:M'
export type RelMeta = {
  en: string
  card: Card
  /** 출발 노드에 이 관계가 반드시 하나 이상 있어야 하는가 */
  required: boolean
  inverse: string
  align: Align | null
}

export const REL_META: Record<string, RelMeta> = {
  운전한다: { en: 'drives', card: 'N:M', required: false, inverse: '운전된다', align: { std: 'prov', term: 'prov:wasAttributedTo (역)', match: 'broad' } },
  관리한다: { en: 'manages', card: 'N:M', required: false, inverse: '관리된다', align: null },
  조회권한: { en: 'canView', card: 'N:M', required: false, inverse: '조회허용', align: { std: 'odrl', term: 'odrl:permission', match: 'close' } },
  승인권한: { en: 'canApprove', card: 'N:M', required: false, inverse: '승인허용', align: { std: 'odrl', term: 'odrl:permission', match: 'close' } },

  생성한다: { en: 'produces', card: '1:N', required: false, inverse: '생성됨', align: { std: 'sosa', term: 'sosa:isFeatureOfInterestOf', match: 'close' } },
  기록된다: { en: 'loggedAs', card: '1:N', required: false, inverse: '기록대상', align: { std: 'sosa', term: 'sosa:madeObservation', match: 'close', note: '단말(Platform) 기준' } },

  분류된다: { en: 'classifiedAs', card: 'N:1', required: true, inverse: '분류포함', align: { std: 'sosa', term: 'sosa:observedProperty', match: 'close' } },
  '예시가 된다': { en: 'exemplifies', card: 'N:1', required: false, inverse: '예시를가짐', align: { std: 'skos', term: 'skos:example', match: 'broad' } },

  뒷받침한다: { en: 'supports', card: 'N:M', required: true, inverse: '근거로삼는다', align: { std: 'prov', term: 'prov:wasDerivedFrom (역)', match: 'close', note: '판정 prov:wasDerivedFrom 관측' } },
  반박한다: { en: 'contradicts', card: 'N:M', required: false, inverse: '반박당한다', align: null },
  '시각을 고정한다': { en: 'timestamps', card: 'N:1', required: false, inverse: '시각을받는다', align: { std: 'time', term: 'time:hasTime', match: 'close' } },

  반영된다: { en: 'reflectedIn', card: 'N:M', required: false, inverse: '반영한다', align: { std: 'prov', term: 'prov:wasDerivedFrom (역)', match: 'close' } },
  보정한다: { en: 'adjusts', card: 'N:M', required: false, inverse: '보정된다', align: null },

  기여한다: { en: 'contributesTo', card: 'N:M', required: false, inverse: '기여받는다', align: null },
  제약한다: { en: 'constrains', card: 'N:M', required: false, inverse: '제약받는다', align: null },
  예측한다: { en: 'predicts', card: 'N:M', required: false, inverse: '예측된다', align: null },
  악화시킨다: { en: 'degrades', card: 'N:M', required: false, inverse: '악화된다', align: null },

  올린다: { en: 'raises', card: 'N:M', required: false, inverse: '올려진다', align: null },
  낮춘다: { en: 'lowers', card: 'N:M', required: false, inverse: '낮춰진다', align: null },
  안정시킨다: { en: 'stabilizes', card: 'N:M', required: false, inverse: '안정화된다', align: null },
  최적화한다: { en: 'optimizes', card: 'N:M', required: false, inverse: '최적화된다', align: null },
  바꾼다: { en: 'affects', card: 'N:M', required: false, inverse: '바뀐다', align: null },

  묶는다: { en: 'clusters', card: '1:N', required: false, inverse: '묶인다', align: { std: 'skos', term: 'skos:member', match: 'close' } },
  요약한다: { en: 'summarizes', card: '1:N', required: false, inverse: '요약된다', align: { std: 'skos', term: 'skos:note', match: 'broad' } },

  보호한다: { en: 'protects', card: 'N:M', required: false, inverse: '보호받는다', align: { std: 'odrl', term: 'odrl:target', match: 'close' } },
  '등급을 매긴다': { en: 'classifies', card: 'N:M', required: false, inverse: '등급을받는다', align: null },
  제한한다: { en: 'restricts', card: 'N:M', required: false, inverse: '제한받는다', align: { std: 'odrl', term: 'odrl:prohibition', match: 'close' } },

  허용한다: { en: 'permits', card: 'N:M', required: false, inverse: '허용받는다', align: { std: 'odrl', term: 'odrl:Permission', match: 'exact' } },
  금지한다: { en: 'denies', card: 'N:M', required: false, inverse: '금지당한다', align: { std: 'odrl', term: 'odrl:Prohibition', match: 'exact' } },
  '승인을 요구한다': { en: 'requiresApproval', card: 'N:M', required: false, inverse: '승인이필요하다', align: { std: 'odrl', term: 'odrl:Duty', match: 'close' } },
}

/* ── 노드 타입 속성 (SHACL 제약의 근거) ── */
/**
 * `unit`은 QUDT 대신 둔 최소 장치다. 3차에 「QUDT는 지금 규모엔 과함」으로 뺐는데,
 * AI가 이 데이터를 받아 쓰는 순간 **값에 단위가 안 붙어 있으면 `0.54`를 해석할 수 없다**.
 * 전체 QUDT 온톨로지를 끌어오지 않고, 단위 기호와 QUDT 단위 IRI만 붙인다.
 */
export type PropDef = { name: string; datatype: string; required: boolean; note?: string; min?: number; max?: number; oneOf?: string[]; unit?: string; qudt?: string }

export const TYPE_PROPS: Record<string, PropDef[]> = {
  Vehicle: [
    { name: 'vehicleId', datatype: 'xsd:string', required: true, note: '차량번호 — 모든 원천의 조인 키' },
    { name: 'routeId', datatype: 'xsd:string', required: true },
    { name: 'odometerKm', datatype: 'xsd:decimal', required: false, min: 0, unit: 'km', qudt: 'unit:KiloM' },
  ],
  Trip: [
    { name: 'startTime', datatype: 'xsd:dateTime', required: true },
    { name: 'endTime', datatype: 'xsd:dateTime', required: true },
    { name: 'distanceKm', datatype: 'xsd:decimal', required: true, min: 0, unit: 'km', qudt: 'unit:KiloM' },
    { name: 'fuelM3', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '구간값 — 누적값 금지' },
    { name: 'co2Kg', datatype: 'xsd:decimal', required: true, min: 0, unit: 'kg', qudt: 'unit:KiloGM' },
  ],
  RiskEvent: [
    { name: 'eventType', datatype: 'xsd:string', required: true, note: '공단 표준 8종만', oneOf: ['급가속', '급출발', '급감속', '급정지', '급진로변경', '급앞지르기', '급좌우회전', '급유턴'] },
    { name: 'speedKmh', datatype: 'xsd:decimal', required: true, min: 0, max: 120, unit: 'km/h', qudt: 'unit:KiloM-PER-HR', note: '시내버스 사양 범위' },
    { name: 'rpm', datatype: 'xsd:integer', required: true, min: 0, max: 3000, unit: 'rpm', qudt: 'unit:REV-PER-MIN' },
    { name: 'occurredAt', datatype: 'xsd:dateTime', required: true },
  ],
  SensorReading: [
    { name: 'channel', datatype: 'xsd:string', required: true, note: 'OBD/CAN 21종 채널' },
    { name: 'value', datatype: 'xsd:decimal', required: true, note: '단위는 같은 레코드의 unit 필드가 들고 있다 — 채널마다 달라 스키마에 고정할 수 없다' },
    { name: 'unit', datatype: 'xsd:string', required: true, note: '℃ · bar · m³ 등 — 이 레코드의 value가 무슨 단위인지' },
    { name: 'observedAt', datatype: 'xsd:dateTime', required: true },
  ],
  Location: [
    { name: 'lat', datatype: 'xsd:decimal', required: true, min: 33, max: 39, unit: '°', qudt: 'unit:DEG', note: '대한민국 위도 범위' },
    { name: 'lng', datatype: 'xsd:decimal', required: true, min: 124, max: 132, unit: '°', qudt: 'unit:DEG' },
    { name: 'accuracyM', datatype: 'xsd:decimal', required: true, min: 0, max: 50, unit: 'm', qudt: 'unit:M' },
    { name: 'headingDeg', datatype: 'xsd:decimal', required: false, min: 0, max: 360, unit: '°', qudt: 'unit:DEG', note: '방위 — 역주행·회차 판정' },
    { name: 'fixType', datatype: 'xsd:string', required: true, oneOf: ['RTK Fixed', 'RTK Float', 'Single'] },
  ],
  Driver: [
    { name: 'driverPseudoId', datatype: 'xsd:string', required: true, note: '가명키 — 실명 저장 금지' },
    { name: 'operatorId', datatype: 'xsd:string', required: true },
  ],
  JustifyVerdict: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['정당 인정', '감점', '검토 대기'] },
    { name: 'confidence', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS', note: '확신도 — 낮으면 사람에게 회부' },
    { name: 'decidedBy', datatype: 'xsd:string', required: false, note: '확정한 담당자 — 자동 확정 금지' },
  ],
  // 배차 간격 — 성과 스페이스로 승격하면서 제약도 함께 정의한다. 노드만 만들고 규칙이 없으면
  // «검사받지 않는 성과»가 하나 생기는 셈이다.
  Headway: [
    { name: 'target', datatype: 'xsd:decimal', required: false, note: '목표치 — 정책은 절대값이 아니라 차이로 말한다' },
    { name: 'value', datatype: 'xsd:decimal', required: true, min: 0, max: 60, unit: '분', qudt: 'unit:MIN', note: '이상 간격 대비 편차' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  BunchingVerdict: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['정상', '몰림', '벌어짐'] },
    { name: 'confidence', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS' },
    { name: 'decidedBy', datatype: 'xsd:string', required: false, note: '배차 조정 확정은 관제가 한다' },
  ],
  SafetyScore: [
    { name: 'target', datatype: 'xsd:decimal', required: false, note: '목표치 — 정책은 절대값이 아니라 차이로 말한다' },
    { name: 'value', datatype: 'xsd:decimal', required: true, min: 0, max: 100, unit: '점', qudt: 'unit:UNITLESS' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  Coaching: [
    { name: 'firedAt', datatype: 'xsd:dateTime', required: true },
    { name: 'approvedBy', datatype: 'xsd:string', required: false, note: '불이익 조치는 승인 필수' },
    // 사람이 발행한 조치의 발행 주체. 엔진이 만든 조치에는 없으므로 필수가 아니다 —
    // 「누가 냈는지 모르는 조치」와 「기계가 낸 조치」를 구분하는 자리다.
    { name: 'issuedBy', datatype: 'xsd:string', required: false, note: '사람이 발행한 경우의 발행 주체' },
  ],
  // 배차 권고에는 속성 스키마가 없었다 — ⑭ 카탈로그가 「검사받지 않는 데이터」로 잡아낸 자리.
  // 조치 발행이 생기면서 값이 실제로 들어오게 되어 여기서 정의한다.
  DispatchAdvice: [
    { name: 'holdSec', datatype: 'xsd:decimal', required: false, min: 0, max: 300, unit: '초', qudt: 'unit:SEC', note: '정류장 추가 대기' },
    { name: 'issuedBy', datatype: 'xsd:string', required: false, note: '사람이 발행한 경우의 발행 주체' },
  ],
  Stop: [
    { name: 'stopName', datatype: 'xsd:string', required: true },
    { name: 'atRatio', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS' },
  ],
  Route: [
    { name: 'routeName', datatype: 'xsd:string', required: true },
    { name: 'authorizedPath', datatype: 'geo:wktLiteral', required: true, note: '인가노선 — 정산 검증 기준' },
  ],
  /* ── ⑭ 카탈로그가 「속성 스키마가 없는 데이터셋」으로 지목한 자리들 ──
     라벨만 있고 값이 없는 노드는 «검사받지 않는 데이터»다. 게다가 AI가 받아 쓸 때
     이름만 있고 숫자가 없으면 아무것도 못 한다. 그래서 스키마를 정의하는 김에
     **엔진이 이미 쓰고 있던 숫자를 그래프로 올린다** — 특히 개념 스페이스의 감점 가중치는
     「개념이 값을 들고 있다」고 코드 주석에 적어 두고도 정작 그래프에는 없었다. */

  // 규정 — ODRL Policy. 발주처가 가장 먼저 묻는 자리라 근거 조문을 값으로 넣는다
  AccessPolicy: [
    { name: 'legalBasis', datatype: 'xsd:string', required: true, note: '이 통제의 법적·계약적 근거' },
    { name: 'scope', datatype: 'xsd:string', required: true, note: '적용 범위' },
  ],
  RetentionPolicy: [
    { name: 'legalBasis', datatype: 'xsd:string', required: true },
    { name: 'retentionDays', datatype: 'xsd:integer', required: true, min: 0, max: 3650, unit: '일', qudt: 'unit:DAY' },
  ],
  Pseudonymization: [
    { name: 'legalBasis', datatype: 'xsd:string', required: true },
    { name: 'scope', datatype: 'xsd:string', required: true },
  ],
  NoAutoAdverse: [
    { name: 'legalBasis', datatype: 'xsd:string', required: true },
    { name: 'scope', datatype: 'xsd:string', required: true },
  ],
  /* ── 탄소중립 ── */
  /** 배출계수 — 코드 상수가 아니라 그래프에. 「어느 계수를 썼나」가 MRV의 첫 질문이다 */
  EmissionFactor: [
    { name: 'factorValue', datatype: 'xsd:decimal', required: true, min: 0, max: 10, unit: 'kg/단위', qudt: 'unit:KiloGM', note: '활동자료 1단위당 CO₂' },
    { name: 'fuelKind', datatype: 'xsd:string', required: true, oneOf: ['CNG', '경유', '전력'] },
    { name: 'source', datatype: 'xsd:string', required: true, note: '계수 출처 — 국가 온실가스 배출계수 등' },
  ],
  /** 배출 산정 — 계산이 아니라 «판정»이다. 근거와 계수가 함께 남아야 검증된다 */
  Emission: [
    { name: 'scope', datatype: 'xsd:string', required: true, oneOf: ['1 직접연소', '2 전력', '3 기타'] },
    { name: 'activityValue', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '활동자료 — 연료 소모량' },
    { name: 'co2Kg', datatype: 'xsd:decimal', required: true, min: 0, unit: 'kg', qudt: 'unit:KiloGM' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
  ],
  AbatementMeasure: [
    { name: 'measure', datatype: 'xsd:string', required: true, oneOf: ['경제운전', '배차 최적화', '공회전 제한', '전기 전환'] },
    { name: 'sharePct', datatype: 'xsd:decimal', required: true, min: 0, max: 100, unit: '%', qudt: 'unit:PERCENT', note: '감축 기여도' },
  ],
  Reduction: [
    { name: 'value', datatype: 'xsd:decimal', required: true, unit: 'kg', qudt: 'unit:KiloGM', note: '기준선 대비 감축량' },
    { name: 'baseline', datatype: 'xsd:decimal', required: true, min: 0, unit: 'kg', qudt: 'unit:KiloGM', note: '기준선 — 없으면 감축 주장이 성립하지 않는다' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성', '미측정'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],

  /* ── 안전 ── */
  RiskZone: [
    { name: 'zoneId', datatype: 'xsd:string', required: true, note: '격자 좌표 기반 구간 식별자' },
    { name: 'eventCount', datatype: 'xsd:integer', required: true, min: 0, unit: '건', qudt: 'unit:UNITLESS' },
    { name: 'lat', datatype: 'xsd:decimal', required: true, min: 33, max: 39, unit: '°', qudt: 'unit:DEG' },
    { name: 'lng', datatype: 'xsd:decimal', required: true, min: 124, max: 132, unit: '°', qudt: 'unit:DEG' },
  ],

  /* ── 정책 — 집계 단위 ── */
  Operator: [
    { name: 'operatorId', datatype: 'xsd:string', required: true },
    { name: 'fleetSize', datatype: 'xsd:integer', required: true, min: 0, unit: '대', qudt: 'unit:UNITLESS' },
  ],
  TimeBand: [
    { name: 'band', datatype: 'xsd:string', required: true, oneOf: ['출근', '낮', '퇴근', '심야'] },
    { name: 'fromHour', datatype: 'xsd:integer', required: true, min: 0, max: 23, unit: '시', qudt: 'unit:HR' },
  ],

  PassengerCount: [
    { name: 'onboardPct', datatype: 'xsd:decimal', required: true, min: 0, max: 100, unit: '%', qudt: 'unit:PERCENT', note: '재차율 — 좌석+입석 대비' },
    { name: 'observedAt', datatype: 'xsd:dateTime', required: true },
  ],
  StopEvent: [
    { name: 'stopName', datatype: 'xsd:string', required: true },
    { name: 'dwellSec', datatype: 'xsd:decimal', required: true, min: 0, max: 600, unit: '초', qudt: 'unit:SEC', note: '정차 시간' },
    { name: 'observedAt', datatype: 'xsd:dateTime', required: true },
  ],
  EnvReading: [
    { name: 'condition', datatype: 'xsd:string', required: true, oneOf: ['맑음', '폭우', '폭염'] },
    { name: 'tempC', datatype: 'xsd:decimal', required: true, min: -30, max: 50, unit: '℃', qudt: 'unit:DEG_C' },
    { name: 'rainMm', datatype: 'xsd:decimal', required: true, min: 0, max: 200, unit: 'mm', qudt: 'unit:MilliM' },
    { name: 'observedAt', datatype: 'xsd:dateTime', required: true },
  ],
  /** 연료 낭비 4요인 — 「얼마나 썼나」가 아니라 「왜 더 썼나」를 답하는 자리 */
  FuelWaste: [
    { name: 'idleM3', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '공회전' },
    { name: 'harshM3', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '급조작' },
    { name: 'habitM3', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '운전 습관' },
    { name: 'acM3', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm³', qudt: 'unit:M3', note: '냉난방' },
  ],
  CrowdLevel: [{ name: 'grade', datatype: 'xsd:string', required: true, oneOf: ['여유', '보통', '혼잡'] }],
  WasteFactor: [{ name: 'factor', datatype: 'xsd:string', required: true, oneOf: ['공회전', '급조작', '습관', '냉난방'] }],
  CrowdingVerdict: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['여유', '보통', '혼잡'] },
    { name: 'confidence', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS' },
  ],
  Ridership: [
    { name: 'target', datatype: 'xsd:decimal', required: false, note: '목표치 — 정책은 절대값이 아니라 차이로 말한다' },
    { name: 'value', datatype: 'xsd:decimal', required: true, min: 0, unit: '명', qudt: 'unit:UNITLESS' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성', '미측정'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  /** 유효 구간 — OWL-Time의 Interval에 대응. 끝이 없는 구간(validTo 없음)이 정상이므로 선택 */
  Validity: [
    { name: 'onRelation', datatype: 'xsd:string', required: true, note: '어느 관계에 붙는 구간인가' },
    { name: 'validFrom', datatype: 'xsd:dateTime', required: true },
    { name: 'validTo', datatype: 'xsd:dateTime', required: false, note: '없으면 계속 유효' },
  ],

  // 개념 — 감점 가중치가 여기 있다는 것이 이 온톨로지의 설계다. 그래프에도 있어야 한다
  RiskType: [
    { name: 'stdCode', datatype: 'xsd:string', required: true, note: '공단 위험운전 8종 코드' },
    { name: 'riskWeight', datatype: 'xsd:decimal', required: true, min: 0, max: 5, unit: '점', qudt: 'unit:UNITLESS', note: '안전점수 감점 가중치 — 게이트가 이 값으로 계산한다' },
  ],
  RouteGrade: [{ name: 'grade', datatype: 'xsd:string', required: true, oneOf: ['A', 'B', 'C'] }],
  FuelType: [
    { name: 'co2Factor', datatype: 'xsd:decimal', required: true, min: 0, max: 5, unit: 'kg/m³', qudt: 'unit:KiloGM-PER-M3', note: '연료→CO₂ 배출계수' },
  ],

  // 집단 — 조치 시뮬레이터가 쓰는 개선율이 여기서 나온다
  DriverCohort: [
    { name: 'size', datatype: 'xsd:integer', required: true, min: 0, unit: '명', qudt: 'unit:UNITLESS' },
    { name: 'improveRate', datatype: 'xsd:decimal', required: true, min: 0, max: 100, unit: '%', qudt: 'unit:PERCENT', note: '코칭 적용 시 개선율' },
  ],
  RouteCluster: [{ name: 'size', datatype: 'xsd:integer', required: true, min: 0, unit: '개', qudt: 'unit:UNITLESS' }],

  // 성과 — SafetyScore·Headway와 같은 모양. 정시율만 «미측정»을 쓴다
  EcoScore: [
    { name: 'target', datatype: 'xsd:decimal', required: false, note: '목표치 — 정책은 절대값이 아니라 차이로 말한다' },
    { name: 'value', datatype: 'xsd:decimal', required: true, min: 0, max: 100, unit: '점', qudt: 'unit:UNITLESS' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  FuelSaving: [
    { name: 'value', datatype: 'xsd:decimal', required: true, min: -100, max: 100, unit: '%', qudt: 'unit:PERCENT' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  Co2Reduction: [
    { name: 'value', datatype: 'xsd:decimal', required: true, min: 0, unit: 'kg', qudt: 'unit:KiloGM' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성'] },
    { name: 'periodStart', datatype: 'xsd:dateTime', required: true },
  ],
  /** 정시율은 원천이 없다. 값을 필수로 두면 「없는 숫자를 채우라」는 압력이 생긴다 —
      값은 선택으로, 근거는 «미측정»을 허용해 **모른다는 사실 자체를 스키마가 표현**하게 했다. */
  Punctuality: [
    { name: 'target', datatype: 'xsd:decimal', required: false, note: '목표치 — 정책은 절대값이 아니라 차이로 말한다' },
    { name: 'value', datatype: 'xsd:decimal', required: false, min: 0, max: 100, unit: '%', qudt: 'unit:PERCENT' },
    { name: 'basis', datatype: 'xsd:string', required: true, oneOf: ['실측', '환산', '추정', '정성', '미측정'] },
  ],

  // 자산·주체·관측·조치의 나머지
  Device: [
    { name: 'deviceModel', datatype: 'xsd:string', required: true, note: 'DTG 표준의 운행기록장치 모델명' },
    { name: 'installedAt', datatype: 'xsd:dateTime', required: true },
  ],
  Controller: [{ name: 'operatorId', datatype: 'xsd:string', required: true }],
  Officer: [{ name: 'orgName', datatype: 'xsd:string', required: true }],
  Plea: [
    { name: 'method', datatype: 'xsd:string', required: true, oneOf: ['앱', '전화', '대면'] },
    { name: 'submittedAt', datatype: 'xsd:dateTime', required: true },
  ],
  ComplaintVerdict: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['사실', '사실 아님', '확인 불가'] },
    { name: 'confidence', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS' },
  ],
  RouteCompliance: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['준수', '이탈', '확인 불가'] },
    { name: 'deviationM', datatype: 'xsd:decimal', required: true, min: 0, unit: 'm', qudt: 'unit:M', note: '인가노선 대비 최대 이탈 거리' },
  ],
  FaultPrediction: [
    { name: 'verdict', datatype: 'xsd:string', required: true, oneOf: ['정상', '주의', '경고'] },
    { name: 'confidence', datatype: 'xsd:decimal', required: true, min: 0, max: 1, unit: '비율', qudt: 'unit:UNITLESS' },
  ],
  Incentive: [{ name: 'stage', datatype: 'xsd:string', required: true, oneOf: ['1차', '2차', '3차'] }],
  Electrification: [{ name: 'stage', datatype: 'xsd:string', required: true, oneOf: ['1차', '2차', '3차'] }],

  // 노드 타입 이름과 정확히 같아야 한다 — 다르면 아무 인스턴스도 target되지 않는 유령 셰이프가 된다
  PredictiveMaint: [
    { name: 'kind', datatype: 'xsd:string', required: true },
    { name: 'status', datatype: 'xsd:string', required: true, oneOf: ['초안', '발행됨'] },
    { name: 'estHours', datatype: 'xsd:decimal', required: true, min: 0, unit: 'h', qudt: 'unit:HR' },
    { name: 'issuedBy', datatype: 'xsd:string', required: false, note: '사람이 발행한 경우의 발행 주체' },
  ],
}

/* ── 정렬 통계 ── */
export function alignStats() {
  const rels = Object.values(REL_META)
  const aligned = rels.filter((r) => r.align).length
  const spaceAligned = Object.values(SPACE_ALIGN).filter((a) => a.length > 0).length
  const typeAligned = Object.keys(TYPE_ALIGN).length
  const totalTypes = SPACES.reduce((n, s) => n + s.types.length, 0)
  const byMatch = (['exact', 'close', 'broad', 'narrow'] as MatchLevel[]).map((m) => ({
    m,
    n:
      Object.values(SPACE_ALIGN).flat().filter((a) => a.match === m).length +
      Object.values(TYPE_ALIGN).flat().filter((a) => a.match === m).length +
      rels.filter((r) => r.align?.match === m).length,
  }))
  return { rels: rels.length, aligned, spaceAligned, typeAligned, totalTypes, byMatch, edges: META_EDGES.length }
}
