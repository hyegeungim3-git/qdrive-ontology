import { META_EDGES, spaceOf, type SpaceId } from './meta'

/**
 * 영향 분석(I1~I7) + 액티브 메타데이터(4계층 12속성).
 *
 * 문법(meta.ts)이 "무엇이 무엇과 어떻게 연결되나"라면,
 * 여기는 "그게 바뀌면 어디까지 흔들리나"와 "그 데이터를 얼마나 믿을 수 있나"를 다룬다.
 */

/* ═══════════ 영향 분석 (I1~I7) ═══════════ */
export type ImpactId = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7'

export const IMPACTS: { id: ImpactId; ko: string; q: string }[] = [
  { id: 'I1', ko: '데이터 영향', q: '어떤 값·레코드가 바뀌나?' },
  { id: 'I2', ko: '관계 영향', q: '어떤 연결이 끊기거나 새로 생기나?' },
  { id: 'I3', ko: '스페이스 영향', q: '어느 스페이스의 경계가 흔들리나?' },
  { id: 'I4', ko: '권한 영향', q: '누가 볼 수 있고 승인할 수 있는지가 바뀌나?' },
  { id: 'I5', ko: '로직 영향', q: '어떤 판정·산출식을 다시 계산해야 하나?' },
  { id: 'I6', ko: '집계·색인 영향', q: '어떤 집계·인덱스를 다시 만들어야 하나?' },
  { id: 'I7', ko: '다운스트림 영향', q: '어떤 서비스 화면의 숫자가 흔들리나?' },
]

/** 스페이스가 바뀌면 기본으로 트리거되는 범주 */
export const SPACE_IMPACTS: Record<SpaceId, ImpactId[]> = {
  policy: ['I4', 'I5'],
  resource: ['I1', 'I6'],
  subject: ['I1', 'I4'],
  evidence: ['I1', 'I2', 'I5'],
  concept: ['I2', 'I5', 'I6'],
  claim: ['I2', 'I5'],
  community: ['I2', 'I6'],
  outcome: ['I1', 'I5', 'I7'],
  lever: ['I1', 'I5', 'I7'],
}

export type ChangeKind = 'update' | 'create' | 'delete' | 'relAdd' | 'relRemove' | 'permission' | 'bulk' | 'schema'

export const CHANGES: { id: ChangeKind; ko: string; desc: string; ids: ImpactId[] }[] = [
  { id: 'update', ko: '값 수정', desc: '계수·기준값을 고친다', ids: ['I1', 'I5', 'I6'] },
  { id: 'create', ko: '신규 추가', desc: '노드 타입·인스턴스를 새로 만든다', ids: ['I2', 'I6'] },
  { id: 'delete', ko: '삭제', desc: '노드를 제거한다', ids: ['I1', 'I2', 'I3', 'I5', 'I6'] },
  { id: 'relAdd', ko: '관계 추가', desc: '새 연결을 만든다', ids: ['I2', 'I5'] },
  { id: 'relRemove', ko: '관계 제거', desc: '연결을 끊는다', ids: ['I2', 'I3', 'I5'] },
  { id: 'permission', ko: '권한 변경', desc: '누가 볼지·승인할지를 바꾼다', ids: ['I4', 'I5'] },
  { id: 'bulk', ko: '대량 적재', desc: '새 원천을 통째로 붓는다', ids: ['I1', 'I2', 'I3', 'I6', 'I7'] },
  { id: 'schema', ko: '스키마 변경', desc: '원천 필드 구조가 바뀐다', ids: ['I2', 'I3', 'I5', 'I6', 'I7'] },
]

/** 스페이스가 흔들리면 숫자가 바뀌는 서비스 화면 */
export const SPACE_SERVICES: Record<SpaceId, { name: string; tab: string }[]> = {
  policy: [{ name: '데이터 관리자 거버넌스', tab: 'admin' }],
  resource: [
    { name: '운수사 차량·노선 관리', tab: 'operator' },
    { name: '시티 대시보드', tab: 'city' },
  ],
  subject: [
    { name: '기사 앱', tab: 'driver' },
    { name: '운수사 기사 관리', tab: 'operator' },
  ],
  evidence: [
    { name: '시티 대시보드', tab: 'city' },
    { name: '운수사 관제', tab: 'operator' },
    { name: '기사 앱', tab: 'driver' },
  ],
  concept: [
    { name: '운수사 관제', tab: 'operator' },
    { name: '데이터 관리자', tab: 'admin' },
  ],
  claim: [
    { name: '시티 정산 검증', tab: 'city' },
    { name: '정책 보고서 에이전트', tab: 'policy' },
    { name: '기사 앱 상황 설명', tab: 'driver' },
  ],
  community: [{ name: '성과 검증 A/B', tab: 'proof' }],
  outcome: [
    { name: '탄소중립 분석', tab: 'carbon' },
    { name: '성과 검증', tab: 'proof' },
    { name: '경영·투자', tab: 'operator' },
  ],
  lever: [
    { name: '운수사 승인 루프', tab: 'operator' },
    { name: '기사 앱 코칭', tab: 'driver' },
    { name: '경영·투자', tab: 'operator' },
  ],
}

/** 실제로 있을 법한 변경 시나리오 */
export const SCENARIOS: { key: string; ko: string; space: SpaceId; change: ChangeKind; note: string }[] = [
  { key: 'dtg', ko: 'DTG 409 스키마 v2.1 → v2.2', space: 'evidence', change: 'schema', note: '단말 펌웨어 갱신으로 필드가 추가되는 경우' },
  { key: 'justify', ko: '정당 판정 기준 조정', space: 'claim', change: 'update', note: '보행자 회피 인정 범위를 넓히는 경우' },
  { key: 'coef', ko: '코칭 효과 계수 재보정', space: 'lever', change: 'update', note: '실증 데이터로 추정 계수를 실측으로 교체' },
  { key: 'afc', ko: 'AFC 2차 원천 대량 적재', space: 'evidence', change: 'bulk', note: '컨소시엄 협약 후 교통카드 데이터 유입' },
  { key: 'pseudo', ko: '기사 가명키 재발급', space: 'subject', change: 'permission', note: '개인정보 보호 정책 갱신' },
  { key: 'route', ko: '노선 개편 — 정류장 관계 제거', space: 'resource', change: 'relRemove', note: '노선이 바뀌면 경유 정류장 관계가 끊긴다' },
]

/** 변경 전파 — 관계를 타고 몇 스페이스까지 번지나 */
export function propagate(from: SpaceId, depth = 2): SpaceId[] {
  let frontier: SpaceId[] = [from]
  const seen = new Set<SpaceId>([from])
  for (let d = 0; d < depth; d++) {
    const next: SpaceId[] = []
    frontier.forEach((s) => {
      META_EDGES.forEach((e) => {
        if (e.from === s && !seen.has(e.to)) {
          seen.add(e.to)
          next.push(e.to)
        }
        if (e.to === s && !seen.has(e.from)) {
          seen.add(e.from)
          next.push(e.from)
        }
      })
    })
    frontier = next
  }
  return [...seen].filter((s) => s !== from)
}

/** 스페이스 × 변경 유형 → 트리거 범주 · 전파 범위 · 영향 화면 */
export function analyse(space: SpaceId, change: ChangeKind) {
  const ch = CHANGES.find((c) => c.id === change)!
  const ids = new Set<ImpactId>(['I1']) // 어떤 변경이든 데이터 영향은 항상
  SPACE_IMPACTS[space].forEach((i) => ids.add(i))
  ch.ids.forEach((i) => ids.add(i))
  const spaces = propagate(space)
  if (spaces.length > 2) ids.add('I3')
  const services = [...new Map([space, ...spaces].flatMap((s) => SPACE_SERVICES[s]).map((s) => [s.name, s])).values()]
  if (services.length > 2) ids.add('I7')
  return { ids: IMPACTS.filter((i) => ids.has(i.id)), spaces, services, change: ch }
}

/* ═══════════ 액티브 메타데이터 (4계층 12속성) ═══════════ */
export type AttrKey =
  | 'identity' | 'provenance' | 'lineage'
  | 'confidence' | 'freshness' | 'completeness'
  | 'dependency' | 'sensitivity' | 'maturity'
  | 'usage' | 'mutation' | 'effect'

export type LayerId = 'existence' | 'quality' | 'relational' | 'behavioral'

export const META_LAYERS: { id: LayerId; ko: string; desc: string; color: string; attrs: { key: AttrKey; ko: string; desc: string }[] }[] = [
  {
    id: 'existence', ko: '존재', color: '#a78bfa', desc: '이 데이터가 무엇이고 어디서 왔나',
    attrs: [
      { key: 'identity', ko: '식별자', desc: '무엇으로 이 노드를 특정하는가' },
      { key: 'provenance', ko: '출처', desc: '어느 원천에서 왔는가' },
      { key: 'lineage', ko: '계보', desc: '원본에서 여기까지 어떤 처리를 거쳤는가' },
    ],
  },
  {
    id: 'quality', ko: '품질', color: '#34d399', desc: '얼마나 믿을 수 있나',
    attrs: [
      { key: 'confidence', ko: '신뢰도', desc: '값의 확실성 — 실측인가 파생인가' },
      { key: 'freshness', ko: '신선도', desc: '언제 갱신되는가' },
      { key: 'completeness', ko: '완전성', desc: '있어야 할 것이 다 채워졌는가' },
    ],
  },
  {
    id: 'relational', ko: '관계', color: '#38bdf8', desc: '무엇에 기대고 있고 얼마나 조심해야 하나',
    attrs: [
      { key: 'dependency', ko: '의존성', desc: '이 스페이스가 기대고 있는 다른 스페이스' },
      { key: 'sensitivity', ko: '민감도', desc: '개인정보·기밀 등급' },
      { key: 'maturity', ko: '성숙도', desc: '초안인가 운영 중인가' },
    ],
  },
  {
    id: 'behavioral', ko: '행동', color: '#f59e0b', desc: '실제로 어떻게 쓰이고 얼마나 바뀌나',
    attrs: [
      { key: 'usage', ko: '사용량', desc: '어느 화면이 이걸 쓰는가' },
      { key: 'mutation', ko: '변경률', desc: '얼마나 자주 바뀌는가' },
      { key: 'effect', ko: '파급', desc: '바뀌면 무엇이 흔들리는가' },
    ],
  },
]

type Fixed = Pick<Record<AttrKey, string>, 'identity' | 'provenance' | 'confidence' | 'freshness' | 'completeness' | 'sensitivity' | 'maturity' | 'mutation'>

export const SPACE_META: Record<SpaceId, Fixed & { pii?: boolean }> = {
  policy: {
    identity: '규정 코드', provenance: '내부 정책 문서', confidence: '확정 — 사람이 정한 규칙',
    freshness: '정책 개정 시', completeness: '4개 항목 정의 완료', sensitivity: '내부',
    maturity: '운영 중', mutation: '연 단위',
  },
  resource: {
    identity: '차량번호 · 노선ID · 정류장명', provenance: '운수사 대장 + 인가노선', confidence: '확정 — 등록 기준',
    freshness: '등록·개편 시', completeness: '실증 범위 100%', sensitivity: '공개 가능',
    maturity: '운영 중', mutation: '월 단위',
  },
  subject: {
    identity: '기사 가명키 (원본은 분리 보관)', provenance: '운수사 인사 + 시 담당자', confidence: '확정 — 등록 기준',
    freshness: '인사 발령 시', completeness: '실증 9명 100%', sensitivity: '개인정보 — 가명 처리 필수',
    maturity: '운영 중', mutation: '월 단위', pii: true,
  },
  evidence: {
    identity: '(차량, 시각) 복합키', provenance: 'DTG 409·521 · OBD/CAN · RTK · BIS', confidence: '실측 — 원본 무변형 보존',
    freshness: '1초 (회차 기록은 회차 종료 시)', completeness: '품질 6룰 통과분만 적재', sensitivity: '준민감 — 위치 이력',
    maturity: '운영 중', mutation: '초 단위 — 가장 빠름',
  },
  concept: {
    identity: '표준 코드값', provenance: '공단 표준 8종 · 내부 등급 정의', confidence: '확정 — 법정 표준',
    freshness: '표준 개정 시', completeness: '8종 전부 정의', sensitivity: '공개 가능',
    maturity: '운영 중', mutation: '거의 없음 — 표준이라 고정',
  },
  claim: {
    identity: '판정ID (근거 관측 참조 포함)', provenance: '관측 + 규칙·모델 + 사람 확인', confidence: '확신도 % 병기 — 낮으면 사람에게 회부',
    freshness: '이벤트 즉시 (확정은 담당자 검토 후)', completeness: '근거 없는 판정은 만들지 않음', sensitivity: '준민감 — 개인에게 귀속되는 판정',
    maturity: '운영 중 — 불이익 결정은 자동화 금지', mutation: '이벤트 단위',
  },
  community: {
    identity: '군 코드', provenance: '관측·개념에서 군집화', confidence: '파생 — 군집 기준에 따라 달라짐',
    freshness: '일 마감 재계산', completeness: '실증 표본 9명 — 통계적으로 작음', sensitivity: '내부 — 개인 특정 금지',
    maturity: '검토 중', mutation: '일 단위',
  },
  outcome: {
    identity: '지표 코드 × 대상 × 기간', provenance: '관측 집계 + 판정 반영', confidence: '실측·환산·추정 구분 표기',
    freshness: '실시간 (일 마감에 확정)', completeness: '기준선 12개월 확보', sensitivity: '공개 가능 — 시민 리포트에 노출',
    maturity: '운영 중', mutation: '초 단위 집계 · 일 단위 확정',
  },
  lever: {
    identity: '조치ID (승인 이력 포함)', provenance: '규칙·모델 제안 + 담당자 승인', confidence: '계수는 근거 유형별 신뢰도 상한 적용',
    freshness: '이벤트 즉시', completeness: '조치 5종 중 3종 실동작 · 2종은 제도·투자', sensitivity: '내부 — 승인 이력은 감사 대상',
    maturity: '운영 중 — 실행은 승인 후', mutation: '이벤트 단위',
  },
}

/** 계보·의존성·사용량·파급은 문법에서 계산한다 */
export function derivedMeta(id: SpaceId): Record<'lineage' | 'dependency' | 'usage' | 'effect', string> {
  const deps = [...new Set(META_EDGES.filter((e) => e.to === id).map((e) => e.from))]
  const services = SPACE_SERVICES[id]
  return {
    lineage: '원천 수집 → 품질 6룰 → 정규화·매핑 → 온톨로지 적재',
    dependency: deps.length ? deps.map((d) => spaceOf(d).ko).join(' · ') : '없음 — 최상위',
    usage: `${services.length}개 화면 — ${services.map((s) => s.name).join(' · ')}`,
    effect: SPACE_IMPACTS[id].join(' · '),
  }
}

export function metaValue(id: SpaceId, key: AttrKey): string {
  const d = derivedMeta(id)
  if (key === 'lineage' || key === 'dependency' || key === 'usage' || key === 'effect') return d[key]
  return SPACE_META[id][key]
}
