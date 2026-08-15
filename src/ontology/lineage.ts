import { useSyncExternalStore } from 'react'

/**
 * 실행 리니지 — 게이트가 «돈 것» 자체를 그래프에 남긴다.
 *
 * 17차에서 레코드마다 검증 스탬프를 붙였지만 스탬프는 **문법 버전**만 알았다.
 * 「이 판정은 어느 규칙으로 나왔나」에는 답하는데 「어느 실행이 만들었나」에는 답하지 못한다.
 * PROV-O에 정렬해 놓고 정작 `prov:Activity`를 한 번도 만들지 않은 셈이었다.
 *
 * 여기서 게이트 실행 한 번을 **활동(Activity)** 으로 기록한다. OpenLineage가 Run/Job/Dataset으로
 * 모델링하는 것과 같은 대상이고, 우리는 이미 PROV에 정렬돼 있으니 PROV 어휘를 그대로 쓴다.
 *
 * ```
 * qdi:run-7 a prov:Activity ;
 *   prov:startedAtTime  "..." ;  prov:endedAtTime "..." ;
 *   prov:wasAssociatedWith qd:LoadGate ;        # 누가(무엇이) 했나
 *   qd:grammarVersion "v1.1" ;                  # 어느 문법으로
 *   prov:generated  qdi:evt-… , …               # 무엇을 만들었나
 * ```
 *
 * 데이터 카탈로그의 «신선도»와 Croissant의 «프로버넌스»가 전부 여기서 나온다 —
 * 리니지가 없으면 카탈로그는 «언제 것인지 모르는 목록»이 된다.
 */

export type Run = {
  /** qdi:run-N */
  id: string
  seq: number
  /** 시뮬레이션 시각(초) — 이 데모의 «벽시계» */
  at: number
  /** 소요 시간(ms) */
  ms: number
  /** 어느 문법으로 돌았나 */
  version: string
  /** 활동의 주체 — 실서비스에서는 파이프라인 잡 이름이 된다 */
  agent: string
  /** 입력: 이 실행이 본 것 */
  used: { vehicles: number; triples: number; nodes: number }
  /** 출력: 이 실행이 만든 것 */
  generated: { passed: number; held: number; stamped: number }
  status: '성공' | '실패'
  error?: string
}

/** 최근 N회만 들고 있는다 — 데모는 메모리, 실서비스는 리니지 저장소 */
const KEEP = 24
let runs: Run[] = []
let seq = 0

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function record(r: Omit<Run, 'id' | 'seq'>): Run {
  seq += 1
  const run: Run = { ...r, id: `qdi:run-${seq}`, seq }
  runs = [run, ...runs].slice(0, KEEP)
  emit()
  return run
}

export const lastRun = () => runs[0]
export const runOf = (id: string) => runs.find((r) => r.id === id)
export const allRuns = () => runs

/** 게이트를 몇 번 돌렸나 — 「격리 0건」이 검사를 안 한 결과인지 가려내는 근거 */
export const runCount = () => seq

export function resetLineage() {
  runs = []
  seq = 0
  emit()
}

export function useLineage(): Run[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => runs,
  )
}

/**
 * 실행 이력을 PROV 트리플로. 내보내기(Croissant·JSON-LD)와 화면이 같은 정의를 읽는다.
 * 시각은 시뮬레이션 초를 ISO 구간으로 환산한다 — 데모의 벽시계가 그것뿐이라 지어내지 않는다.
 */
export const simIso = (t: number) => new Date(Date.UTC(2026, 7, 15, 6, 0, 0) + Math.round(t * 1000)).toISOString()

export function lineageTurtle(): string {
  if (!runs.length) return '# 아직 게이트가 돈 적이 없습니다 — 실행 리니지가 비어 있습니다.\n'
  const L: string[] = [
    '@prefix qd:   <https://qdrive.ai/ontology/> .',
    '@prefix qdi:  <https://qdrive.ai/id/> .',
    '@prefix prov: <http://www.w3.org/ns/prov#> .',
    '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
    '',
    'qd:LoadGate a prov:SoftwareAgent ; rdfs:label "온톨로지 적재 게이트"@ko .',
    '',
  ]
  runs.forEach((r) => {
    L.push(`${r.id} a prov:Activity ;`)
    L.push(`  prov:startedAtTime "${simIso(r.at)}"^^xsd:dateTime ;`)
    L.push(`  prov:endedAtTime   "${simIso(r.at + r.ms / 1000)}"^^xsd:dateTime ;`)
    L.push(`  prov:wasAssociatedWith qd:LoadGate ;`)
    L.push(`  qd:grammarVersion "${r.version}" ;`)
    L.push(`  qd:inputNodes ${r.used.nodes} ; qd:inputTriples ${r.used.triples} ;`)
    L.push(`  qd:passedRecords ${r.generated.passed} ; qd:heldRecords ${r.generated.held} ;`)
    L.push(`  qd:durationMs ${r.ms} .`)
    L.push('')
  })
  return L.join('\n')
}
