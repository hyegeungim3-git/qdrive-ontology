import D from '@rdfjs/dataset'
import { Parser, type Quad } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'
import { buildShacl } from './shacl'
import { buildDataGraph, checkFuelPerKm, type FaultId, type GraphResult } from './rdf'
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
  focus: string
  focusLabel: string
  path: string
  constraint: string
  severity: 'Violation' | 'Warning' | 'Info'
  message: string
  /** SHACL 엔진이 낸 것인가, 보조 검사인가 */
  engine: 'SHACL' | 'JS'
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

/** 셰이프 그래프는 스냅샷과 무관하니 한 번만 파싱해 재사용한다 */
let shapesCache: { turtle: string; quads: Quad[] } | null = null
function shapes() {
  if (!shapesCache) {
    const turtle = buildShacl({ sparql: false })
    shapesCache = { turtle, quads: new Parser().parse(turtle) }
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
      return {
        focus: short(r.focusNode?.value),
        focusLabel: labels.get(r.focusNode?.value ?? '') ?? '',
        path,
        constraint: short(r.sourceConstraintComponent?.value).replace(/ConstraintComponent$/, ''),
        severity: (short(r.severity?.value) || 'Violation') as Finding['severity'],
        message: r.message.map((m) => m.value).join(' ') || '(메시지 없음)',
        engine: 'SHACL',
      }
    })

    // sh:sparql 대체 — 엔진이 못 도는 규칙을 JS로
    checkFuelPerKm(graph.turtle).forEach((c) =>
      findings.push({
        focus: short(c.focus).replace('qdi:', ''),
        focusLabel: c.label,
        path: 'fuelM3',
        constraint: 'SPARQL',
        severity: 'Violation',
        message: c.msg,
        engine: 'JS',
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
