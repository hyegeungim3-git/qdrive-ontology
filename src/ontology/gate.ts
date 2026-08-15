import { useSyncExternalStore } from 'react'
import { RISK_WEIGHT, SCORE_FLOOR } from './meta'
import { relKo, type FaultId, type GraphResult } from './rdf'
import { currentVersion } from './grammar'
import { runValidation, type Finding } from './validate'
import type { SimSnapshot } from '../sim/types'

/**
 * 온톨로지 적재 게이트 — **서비스가 온톨로지 위에서 도는 지점**.
 *
 * 이전 구조는 `엔진 → 스냅샷 → 화면`이었고 온톨로지는 옆에서 구경만 했다. ⑩ 화면이
 * «격리된 레코드는 하류로 내려보내지 않습니다»라고 적어 놓았지만 실제로는 아무 숫자도 안 바뀌었다.
 * 여기서 흐름을 `엔진 → **게이트** → 화면`으로 바꾼다.
 *
 * 게이트가 하는 일은 둘이다.
 *  1) **통과시킬지 정한다** — SHACL 검증에 걸린 레코드는 하류 집계에서 뺀다.
 *  2) **확정값을 계산한다** — 안전점수를 엔진 상수가 아니라 **개념 스페이스의 감점 가중치**(RISK_WEIGHT)로
 *     다시 계산한다. 단말이 준 점수는 참고치, 하류로 나가는 것은 온톨로지가 만든 값이다.
 *
 * 실서비스에서는 이것이 적재 파이프라인의 검증 단계다. 데모에서는 브라우저에서 같은 일을 한다 —
 * 규모만 다르고 순서는 같다.
 */

export type GatedScore = {
  vehicleId: string
  /** 온톨로지가 그래프에서 계산한 확정 점수 */
  ontology: number
  /** 단말(엔진)이 준 참고치 */
  engine: number
  /** 감점에 실제로 쓰인 패킷 수 (격리분 제외) */
  counted: number
  /** 격리되어 감점에서 빠진 패킷 수 */
  blocked: number
}

export type GateResult = {
  /** 검증 시각 (시뮬레이션 초) */
  at: number
  /** 어느 문법 버전으로 검증했나 — 레코드에 붙는 스탬프 */
  version: string
  graph: GraphResult
  findings: Finding[]
  /** 하류로 못 내려가는 레코드 */
  held: Set<string>
  /** 게이트 통과분만으로 다시 센 하류 값 */
  downstream: {
    events: { raw: number; passed: number }
    trips: { raw: number; passed: number }
    fuelM3: { raw: number; passed: number }
    co2Kg: { raw: number; passed: number }
    scores: GatedScore[]
  }
  ms: number
  error?: string
}

const EMPTY: GateResult = {
  at: 0,
  version: 'v1.0',
  graph: { turtle: '', triples: 0, subjects: 0, byClass: [], index: { label: {}, type: {}, space: {}, out: {}, inc: {} } },
  findings: [],
  held: new Set(),
  downstream: {
    events: { raw: 0, passed: 0 },
    trips: { raw: 0, passed: 0 },
    fuelM3: { raw: 0, passed: 0 },
    co2Kg: { raw: 0, passed: 0 },
    scores: [],
  },
  ms: 0,
}

/* ── 저장소 ── */
let result: GateResult = EMPTY
let running = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/**
 * 게이트를 한 번 돌린다.
 *
 * 통과 여부는 **레코드 단위**다 — 위반이 하나라도 걸린 노드는 그 레코드만 하류에서 뺀다.
 * 차량이나 기사를 통째로 빼지 않는다(연좌하지 않는다).
 */
export async function runGate(snap: SimSnapshot, faults: Set<FaultId>): Promise<GateResult> {
  if (running) return result
  running = true
  const t0 = performance.now()
  const r = await runValidation(snap, faults)
  const ix = r.graph.index

  const held = new Set(r.findings.filter((f) => f.severity === 'Violation').map((f) => f.focusIri))

  /* ── 하류 재계산: 통과분만 ── */
  const isType = (iri: string, t: string) => ix.type[iri] === t
  const nodes = Object.keys(ix.type)

  const events = nodes.filter((i) => isType(i, 'RiskEvent'))
  const trips = nodes.filter((i) => isType(i, 'Trip'))
  const num = (block: string | undefined, prop: string) => Number(block?.match(new RegExp(`qd:${prop} "([\\d.]+)"`))?.[1] ?? 0)
  const blockOf = (iri: string) => r.graph.turtle.split('\n\n').find((b) => b.trim().startsWith(iri + ' '))

  const passedTrips = trips.filter((t) => !held.has(t))
  const sumTrip = (list: string[], prop: string) => list.reduce((n, t) => n + num(blockOf(t), prop), 0)

  /**
   * 안전점수 — 그래프를 순회해 계산한다.
   * 차량 → (생성한다) → 위험운전 패킷 → (뒷받침한다) → 정당 판정
   * 판정이 «정당 인정»이면 감점하지 않고, 게이트에 걸린 패킷도 감점하지 않는다.
   * 가중치는 개념 스페이스의 RISK_WEIGHT에서 온다 — 엔진 상수가 아니다.
   */
  const verdictOf = (evt: string) => {
    const cl = (ix.out[evt] ?? []).find((e) => ix.space[e.o] === 'Claim')
    if (!cl) return ''
    return blockOf(cl.o)?.match(/qd:verdict "([^"]+)"/)?.[1] ?? ''
  }
  const typeOfEvent = (evt: string) => blockOf(evt)?.match(/qd:eventType "([^"]+)"/)?.[1] ?? ''

  const scores: GatedScore[] = snap.vehicles.map((v) => {
    const vehIri = nodes.find((i) => isType(i, 'Vehicle') && ix.label[i] === v.id)
    const mine = vehIri ? (ix.out[vehIri] ?? []).filter((e) => ix.type[e.o] === 'RiskEvent').map((e) => e.o) : []
    let penalty = 0
    let counted = 0
    let blocked = 0
    mine.forEach((evt) => {
      if (held.has(evt)) {
        blocked++
        return
      }
      if (verdictOf(evt) === '정당 인정') return
      penalty += RISK_WEIGHT[typeOfEvent(evt)] ?? 0
      counted++
    })
    return {
      vehicleId: v.id,
      ontology: Math.max(SCORE_FLOOR, Math.round((100 - penalty) * 10) / 10),
      engine: Math.round(v.score * 10) / 10,
      counted,
      blocked,
    }
  })

  result = {
    at: snap.simTime,
    version: currentVersion(),
    graph: r.graph,
    findings: r.findings,
    held,
    downstream: {
      events: { raw: events.length, passed: events.filter((e) => !held.has(e)).length },
      trips: { raw: trips.length, passed: passedTrips.length },
      fuelM3: { raw: Math.round(sumTrip(trips, 'fuelM3') * 10) / 10, passed: Math.round(sumTrip(passedTrips, 'fuelM3') * 10) / 10 },
      co2Kg: { raw: Math.round(sumTrip(trips, 'co2Kg') * 10) / 10, passed: Math.round(sumTrip(passedTrips, 'co2Kg') * 10) / 10 },
      scores,
    },
    ms: Math.round(performance.now() - t0),
    error: r.error,
  }
  running = false
  emit()
  return result
}

export function useGate(): GateResult {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => result,
  )
}

/** 격리된 레코드가 어떤 관계로 하류에 닿아 있었는지 — «무엇이 막혔나»를 말로 */
export function heldSummary(g: GateResult): { iri: string; label: string; type: string; via: string }[] {
  const ix = g.graph.index
  return [...g.held].map((iri) => {
    const outs = (ix.out[iri] ?? []).map((e) => relKo(e.p))
    return {
      iri: iri.replace('qdi:', ''),
      label: ix.label[iri] ?? iri,
      type: ix.type[iri] ?? '',
      via: outs.length ? outs.join(' · ') : '연결 없음',
    }
  })
}
