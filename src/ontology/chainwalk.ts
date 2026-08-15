import { META_EDGES, spaceOf, type SpaceId } from './meta'
import { REL_META } from './standards'
import { relKo } from './rdf'
import type { GateResult } from './gate'
import type { ChainView } from './chains'

/**
 * 근거 사슬을 **그래프에서 걸어서** 만든다.
 *
 * 이 화면은 «이 숫자가 어디서 왔나»를 답하는 자리인데, 정작 답은 손으로 쓴 빌더 6개가 스냅샷을
 * 읽어 만들고 있었다. 그러면 문법을 아무리 고쳐도 사슬은 안 바뀐다 — 온톨로지가 답을 만드는 게 아니라
 * 답을 설명만 하는 셈이다.
 *
 * 여기서는 **문법(META_EDGES)이 허용한 관계만** 따라 성과에서 거꾸로 걷는다.
 *   성과 ←[판정→성과에 허용된 어휘]← 판정 ←[관측→판정에 허용된 어휘]← 관측
 * 술어를 손으로 적지 않고 문법에서 꺼내므로, **문법을 발행으로 고치면 사슬이 실제로 달라진다.**
 * 예: v1.1에서 «관측 → 성과»를 열면, 판정을 거치지 않는 직접 경로가 이 순회에 나타난다.
 */

export type WalkNode = { iri: string; label: string; type: string; blocked: boolean; via: string }
export type ChainWalk = {
  ok: boolean
  reason?: string
  outcome: WalkNode | null
  claims: (WalkNode & { verdict: string })[]
  /** 판정을 거쳐 닿은 관측 */
  evidence: (WalkNode & { through: string; detail: string; when: string; value: string })[]
  /** 판정을 거치지 않고 성과에 바로 붙은 관측 — 문법이 열어 줬을 때만 생긴다 */
  direct: WalkNode[]
  levers: WalkNode[]
  concepts: WalkNode[]
  /** 순회에 쓴 관계 어휘 (실제 데이터에 있던 것) */
  used: string[]
  /** 문법이 이 방향들에 허용한 어휘 — 순회의 근거 */
  allowed: { dir: string; rels: string[] }[]
  /** 게이트에 막혀 사슬에서 빠진 관측 수 */
  blocked: number
}

/** 지표 → 성과 스페이스의 노드 타입. 노드가 없는 지표는 순회할 수 없다 — 그걸 숨기지 않는다. */
const OUTCOME_TYPE: Record<string, string> = {
  safety: 'SafetyScore',
  eco: 'EcoScore',
  fuel: 'FuelSaving',
  co2: 'Co2Reduction',
  punctual: 'Punctuality',
}

/** 문법이 이 방향에 허용한 관계 어휘 — 손으로 적지 않는다 */
const relsBetween = (from: SpaceId, to: SpaceId) => META_EDGES.filter((e) => e.from === from && e.to === to).flatMap((e) => e.relations)
const predsOf = (rels: string[]) => new Set(rels.map((r) => `qd:${REL_META[r]?.en}`).filter((x) => !x.endsWith('undefined')))

const EMPTY: ChainWalk = {
  ok: false,
  outcome: null,
  claims: [],
  evidence: [],
  direct: [],
  levers: [],
  concepts: [],
  used: [],
  allowed: [],
  blocked: 0,
}

export function walkChain(g: GateResult, metricKey: string, vehicleId?: string): ChainWalk {
  const type = OUTCOME_TYPE[metricKey]
  if (!type) {
    return {
      ...EMPTY,
      reason: '이 지표는 아직 성과 스페이스에 노드 타입이 없어 그래프로 걸을 수 없습니다 — 값은 엔진 집계로 보여드립니다.',
    }
  }
  const ix = g.graph.index
  const nodes = Object.keys(ix.type)
  const label = (i: string) => ix.label[i] ?? i.replace('qdi:', '')

  const outcomeIri =
    nodes.find((i) => ix.type[i] === type && (!vehicleId || (ix.label[i] ?? '').includes(vehicleId))) ??
    nodes.find((i) => ix.type[i] === type)
  if (!outcomeIri) {
    return { ...EMPTY, reason: `그래프에 «${type}» 노드가 아직 없습니다 — 엔진이 이 성과를 만들기 전입니다.` }
  }

  const mk = (iri: string, via: string): WalkNode => ({
    iri,
    label: label(iri),
    type: ix.type[iri] ?? '',
    blocked: g.held.has(iri),
    via,
  })

  const used = new Set<string>()
  /** 문법이 허용한 어휘로만 역방향 한 걸음 */
  const back = (target: string, from: SpaceId, to: SpaceId) => {
    const preds = predsOf(relsBetween(from, to))
    const fromEn = spaceOf(from).en
    return (ix.inc[target] ?? [])
      .filter((e) => preds.has(e.p) && ix.space[e.s] === fromEn)
      .map((e) => {
        used.add(relKo(e.p))
        return mk(e.s, relKo(e.p))
      })
  }
  /** 정방향 한 걸음 (관측 → 개념) */
  const fwd = (source: string, from: SpaceId, to: SpaceId) => {
    const preds = predsOf(relsBetween(from, to))
    const toEn = spaceOf(to).en
    return (ix.out[source] ?? [])
      .filter((e) => preds.has(e.p) && ix.space[e.o] === toEn)
      .map((e) => {
        used.add(relKo(e.p))
        return mk(e.o, relKo(e.p))
      })
  }

  const outcome = mk(outcomeIri, '')
  const claims = back(outcomeIri, 'claim', 'outcome').map((c) => ({
    ...c,
    verdict: g.graph.turtle.split('\n\n').find((b) => b.trim().startsWith(c.iri + ' '))?.match(/qd:verdict "([^"]+)"/)?.[1] ?? '',
  }))

  const evidence: (WalkNode & { through: string; detail: string; when: string; value: string })[] = []
  const seenEv = new Set<string>()
  claims.forEach((c) => {
    back(c.iri, 'evidence', 'claim').forEach((e) => {
      if (seenEv.has(e.iri)) return
      seenEv.add(e.iri)
      const block = g.graph.turtle.split('\n\n').find((b) => b.trim().startsWith(e.iri + ' '))
      const t = block?.match(/qd:eventType "([^"]+)"/)?.[1]
      const sp = block?.match(/qd:speedKmh "([\d.]+)"/)?.[1]
      // 행이 좁으니 세 칸을 짧게 나눈다 — 시각 / 유형 / 값. 라벨을 통째로 넣으면 375px에서 잘린다.
      const when = block?.match(/qd:(?:occurredAt|startTime|observedAt) "[^T]+T(\d\d:\d\d:\d\d)/)?.[1] ?? ''
      evidence.push({
        ...e,
        through: c.label,
        detail: t ?? ix.type[e.iri] ?? '',
        when,
        value: sp ? `${Math.round(Number(sp))}km/h` : '',
      })
    })
  })

  // 판정을 거치지 않고 성과에 바로 붙은 관측 — 문법이 그 방향을 열어 줬을 때만 나온다
  const direct = back(outcomeIri, 'evidence', 'outcome')
  const levers = back(outcomeIri, 'lever', 'outcome')
  const concepts: WalkNode[] = []
  const seenC = new Set<string>()
  evidence.forEach((e) =>
    fwd(e.iri, 'evidence', 'concept').forEach((c) => {
      if (seenC.has(c.iri)) return
      seenC.add(c.iri)
      concepts.push(c)
    }),
  )

  const allowed = [
    { dir: '판정 → 성과', rels: relsBetween('claim', 'outcome') },
    { dir: '관측 → 판정', rels: relsBetween('evidence', 'claim') },
    { dir: '조치 → 성과', rels: relsBetween('lever', 'outcome') },
    { dir: '관측 → 성과', rels: relsBetween('evidence', 'outcome') },
  ]

  return {
    ok: true,
    outcome,
    claims,
    evidence,
    direct,
    levers,
    concepts,
    used: [...used],
    allowed,
    blocked: [...claims, ...evidence].filter((n) => n.blocked).length,
  }
}

/**
 * 순회 결과를 사슬 화면의 칸에 넣는다.
 *
 * 성과 값·맥락(날씨·노선)·규정은 그래프 노드가 아니라 스냅샷·정적 정의에서 오므로 그대로 둔다.
 * **판정·관측·조치·개념 칸과 문장의 근거 부분만** 순회 결과로 덮는다 — 이 넷이 «온톨로지가 답하는» 부분이다.
 */
export function mergeWalk(base: ChainView, w: ChainWalk): ChainView {
  if (!w.ok) return base
  const alive = w.evidence.filter((e) => !e.blocked)
  const deducted = w.claims.filter((c) => c.verdict !== '정당 인정' && !c.blocked)
  const justified = w.claims.filter((c) => c.verdict === '정당 인정')

  const path = [
    '성과',
    ...(w.claims.length ? [`←${w.claims[0].via}← 판정 ${w.claims.length}`] : []),
    ...(alive.length ? [`←${alive[0].via}← 관측 ${alive.length}`] : []),
  ].join(' ')

  return {
    ...base,
    claimTitle: `판정 — 그래프에서 ${w.claims.length}건`,
    claimBig: w.claims.length
      ? [
          { n: deducted.length, label: '감점', color: '#fb7185' },
          { n: justified.length, label: '정당 인정', color: '#34d399' },
        ]
      : undefined,
    claimLines: w.claims.slice(0, 4).map((c) => ({ k: c.label, v: `${c.verdict || c.type}${c.blocked ? ' · 격리' : ''}` })),
    claimNote: w.blocked > 0 ? `게이트에 막힌 ${w.blocked}건은 사슬에서 빠졌습니다 — 근거가 없으면 판정도 없습니다.` : base.claimNote,
    claimEmpty: w.claims.length === 0 ? '이 성과에 닿은 판정이 그래프에 없습니다' : undefined,

    evidenceTitle: `관측 — «${w.evidence[0]?.via ?? '뒷받침한다'}»로 닿은 ${w.evidence.length}건`,
    evidenceRows: w.evidence.slice(0, 5).map((e) => ({
      a: e.when || e.label.slice(0, 8),
      b: e.detail,
      c: e.blocked ? '⛔ 격리' : e.value,
      ok: !e.blocked,
    })),
    evidenceMore: Math.max(0, w.evidence.length - 5),
    evidenceEmpty: w.evidence.length === 0 ? '판정을 뒷받침하는 관측이 그래프에 없습니다' : undefined,

    leverLines: w.levers.length ? w.levers.slice(0, 4).map((l) => ({ k: l.label, v: `«${l.via}»` })) : base.leverLines,
    leverNote: w.levers.length ? `조치는 «${[...new Set(w.levers.map((l) => l.via))].join(' · ')}» 관계로 이 성과에 붙어 있습니다.` : base.leverNote,

    contextLines: w.concepts.length
      ? [...base.contextLines.slice(0, 1), ...w.concepts.slice(0, 2).map((c) => ({ k: `«${c.via}»`, v: c.label }))]
      : base.contextLines,

    sentence:
      base.sentence +
      ` 이 사슬은 문법이 허용한 관계만 따라 그래프에서 직접 걸어 만든 것입니다 — ${path}` +
      (w.direct.length ? `, 그리고 문법이 열어 준 «관측 → 성과» 직접 경로 ${w.direct.length}건` : '') +
      `. 사용한 관계 어휘: ${w.used.join(' · ') || '없음'}.`,
  }
}
