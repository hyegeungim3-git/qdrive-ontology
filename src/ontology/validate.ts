import D from '@rdfjs/dataset'
import { Parser, type Quad } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'
import { buildShacl } from './shacl'
import { currentVersion } from './grammar'
import { activeSignature } from './validity'
import { buildDataGraph, checkFuelPerKm, downstream, type FaultId, type GraphResult } from './rdf'
import type { SimSnapshot } from '../sim/types'

/**
 * SHACL을 브라우저에서 실제로 돌린다.
 *
 * 셰이프를 생성만 하고 "이런 걸 막습니다"라고 말하는 것과, 데이터를 넣어 실제로 막히는 것을
 * 보여주는 것은 다르다. 여기는 후자다. 엔진은 W3C SHACL 구현체(rdf-validate-shacl)를 그대로 쓴다.
 *
 * 한 가지 정직하게 밝힐 것: 이 엔진은 sh:sparql(SPARQL 기반 제약)을 지원하지 않는다.
 * 그래서 셰이프에서 빼고 돌리되, 같은 규칙을 JS로 따로 검사해 «보조 검사»로 표시한다.
 */

export type Finding = {
  /** 격리 큐가 그래프를 되짚을 수 있게 원 IRI를 남긴다 */
  focusIri: string
  focus: string
  focusLabel: string
  /** 노드 타입 — 격리 큐에서 «어떤 종류의 레코드인가» */
  focusType: string
  /** 스페이스 — 격리 이력이 어느 스페이스의 메타데이터를 갱신하는가 */
  focusSpace: string
  path: string
  constraint: string
  severity: 'Violation' | 'Warning' | 'Info'
  message: string
  /** SHACL 엔진이 낸 것인가, 보조 검사인가 */
  engine: 'SHACL' | 'JS'
  /** 이 레코드를 보류하면 흔들리는 성과 */
  downstream: string[]
}

export type RunResult = {
  conforms: boolean
  findings: Finding[]
  graph: GraphResult
  shapesTurtle: string
  shapeQuads: number
  dataQuads: number
  ms: number
  error?: string
}

const short = (v?: string) => (v ?? '').replace(/^https:\/\/qdrive\.ai\/(ontology|id)\//, '').replace(/^http.*[#/]/, '')

/**
 * 셰이프 그래프는 스냅샷과 무관하니 파싱 결과를 재사용한다.
 * 다만 **문법 버전에 묶어 둔다** — 발행으로 문법이 바뀌었는데 옛 셰이프로 계속 검사하면
 * 「발행했다」가 거짓말이 된다. 실제로 이 캐시 때문에 v1.1 발행 후에도 v1.0 규칙이 돌았다.
 */
let shapesCache: { key: string; turtle: string; quads: Quad[] } | null = null
function shapes() {
  // 문법 버전뿐 아니라 **규정 시행 상태**도 키에 넣는다 —
  // 시행일이 지나 규칙이 켜졌는데 옛 셰이프로 계속 검사하면 「시행됐다」가 거짓말이 된다.
  // 8차의 「발행했는데 옛 셰이프로 검사」와 정확히 같은 함정이다.
  const key = `${currentVersion()}:${activeSignature()}`
  if (!shapesCache || shapesCache.key !== key) {
    const turtle = buildShacl({ sparql: false })
    shapesCache = { key, turtle, quads: new Parser().parse(turtle) }
  }
  return shapesCache
}

export async function runValidation(snap: SimSnapshot, faults: Set<FaultId>): Promise<RunResult> {
  const t0 = performance.now()
  const graph = buildDataGraph(snap, faults)
  const { turtle: shapesTurtle, quads: shapeQuads } = shapes()

  const base: Omit<RunResult, 'conforms' | 'findings'> = {
    graph,
    shapesTurtle,
    shapeQuads: shapeQuads.length,
    dataQuads: 0,
    ms: 0,
  }

  try {
    const dataQuads = new Parser().parse(graph.turtle)
    const validator = new SHACLValidator(D.dataset(shapeQuads))
    const report = await validator.validate(D.dataset(dataQuads))

    // 인스턴스 라벨 사전 — 결과에 IRI 대신 사람이 읽는 이름을 보이려고
    const labels = new Map<string, string>()
    dataQuads.forEach((q) => {
      if (q.predicate.value.endsWith('rdf-schema#label')) labels.set(q.subject.value, q.object.value)
    })
    // 역경로(sh:inversePath)는 path가 공백 노드로 잡힌다 — 셰이프 그래프에서 실제 경로를 되찾는다
    const inverse = new Map<string, string>()
    shapeQuads.forEach((q: Quad) => {
      if (q.predicate.value.endsWith('shacl#inversePath')) inverse.set(q.subject.value, short(q.object.value))
    })

    const findings: Finding[] = report.results.map((r) => {
      const pathTerm = r.path as { value?: string; termType?: string } | undefined
      const raw = pathTerm?.value ?? ''
      const path = pathTerm?.termType === 'BlankNode' ? `← ${inverse.get(raw) ?? '역경로'}` : short(raw)
      const iri = (r.focusNode?.value ?? '').replace('https://qdrive.ai/id/', 'qdi:')
      return {
        focusIri: iri,
        focus: short(r.focusNode?.value),
        focusLabel: labels.get(r.focusNode?.value ?? '') ?? '',
        focusType: graph.index.type[iri] ?? '',
        focusSpace: graph.index.space[iri] ?? '',
        path,
        constraint: short(r.sourceConstraintComponent?.value).replace(/ConstraintComponent$/, ''),
        severity: (short(r.severity?.value) || 'Violation') as Finding['severity'],
        message: r.message.map((m) => m.value).join(' ') || '(메시지 없음)',
        engine: 'SHACL',
        downstream: downstream(graph.index, iri),
      }
    })

    // sh:sparql 대체 — 엔진이 못 도는 규칙을 JS로
    checkFuelPerKm(graph.turtle).forEach((c) =>
      findings.push({
        focusIri: c.focus,
        focus: c.focus.replace('qdi:', ''),
        focusLabel: c.label,
        focusType: graph.index.type[c.focus] ?? 'Trip',
        focusSpace: graph.index.space[c.focus] ?? 'Evidence',
        path: 'fuelM3',
        constraint: 'SPARQL',
        severity: 'Violation',
        message: c.msg,
        engine: 'JS',
        downstream: downstream(graph.index, c.focus),
      }),
    )

    findings.sort((a, b) => (a.severity === b.severity ? a.focus.localeCompare(b.focus) : a.severity === 'Violation' ? -1 : 1))

    return {
      ...base,
      dataQuads: dataQuads.length,
      ms: Math.round(performance.now() - t0),
      conforms: findings.length === 0,
      findings,
    }
  } catch (e) {
    return { ...base, ms: Math.round(performance.now() - t0), conforms: false, findings: [], error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 임의의 Turtle을 **같은 셰이프로** 검사한다 — 역방향 적재 어댑터가 쓴다.
 *
 * 외부 표준 레코드를 우리 문법으로 옮긴 결과가 «정말 통과하는가»는 말로 답할 수 없다.
 * 시뮬레이터 스냅샷을 검사하는 것과 **완전히 같은 셰이프 그래프**를 쓴다 —
 * 적재 경로만 다르고 규칙은 하나여야 한다.
 */
export async function validateTurtle(turtle: string): Promise<{ conforms: boolean; results: { focus: string; path: string; constraint: string; message: string }[]; error?: string }> {
  try {
    const { quads: shapeQuads } = shapes()
    const dataQuads = new Parser().parse(turtle)
    const validator = new SHACLValidator(D.dataset(shapeQuads))
    const report = await validator.validate(D.dataset(dataQuads))
    const results = report.results.map((r) => ({
      focus: short(r.focusNode?.value).replace('qdi:', ''),
      path: short((r.path as { value?: string } | undefined)?.value ?? ''),
      constraint: short(r.sourceConstraintComponent?.value).replace(/ConstraintComponent$/, ''),
      message: r.message.map((m) => m.value).join(' ') || '(메시지 없음)',
    }))
    return { conforms: results.length === 0, results }
  } catch (e) {
    return { conforms: false, results: [], error: e instanceof Error ? e.message : String(e) }
  }
}
