import { useMemo, useState } from 'react'
import { ink } from './ink'
import { SPACES } from './meta'
import { buildDataGraph, degreeOf, metricOf, relKo, vehicleOf, type GraphIndex } from './rdf'
import { METRICS } from './chains'
import { useGate } from './gate'
import { can, maskName, useRole } from './policy'
import type { Jump } from './nav'
import type { SimSnapshot } from '../sim/types'

/**
 * 인스턴스 그래프 — 스페이스가 아니라 **레코드 하나하나**가 노드다.
 *
 * 메타 그래프는 «관측은 판정을 뒷받침할 수 있다»를 말한다. 그건 규칙이지 데이터가 아니다.
 * 여기서는 «3742호가 만든 이 패킷이 이 정당 판정을 뒷받침하고, 그 판정이 이 안전점수에 반영됐다»를
 * 실제 노드로 그린다. ⑨ SHACL이 검사하는 것과 **같은 그래프**다 — 따로 그린 그림이 아니다.
 *
 * 레이아웃을 한 노드 중심의 방사형으로 짰다가 갈아엎었다. 이 데이터는 «넓고 얕다» —
 * 레코드 하나에 붙은 연결이 보통 2~4개라, 자아 중심 그래프로는 늘 부챗살 몇 개로 보인다.
 * 대신 **핵심 사슬을 가로지르는 다열 짜임**으로 자른다. 자산 → 관측 → 판정 → 성과 ← 조치를
 * 열로 세우고 **연결된 것만 골라** 채우면, 실제로 걸려 있는 그물이 한 화면에 들어온다.
 *
 * 렌더 규칙(이 저장소 공통): 간선 → 라벨 → 노드 3레이어. 간선은 노드 경계에서 끊는다.
 */

const NW = 108
const NH = 34
const COLS = [
  { ko: '주체', x: 66 },
  { ko: '자산', x: 244 },
  { ko: '관측', x: 434 },
  { ko: '판정', x: 620 },
  { ko: '성과', x: 794 },
  { ko: '조치', x: 926 },
]
const TOP = 62
const BOT = 470

/**
 * 간선은 **가로 접선을 가진 곡선**으로 그린다.
 *
 * 처음엔 직선으로 그렸는데 49개 중 20개가 다른 노드 상자를 관통했다(이 저장소 렌더 규칙 위반).
 * 원인은 열 사이 간격(약 70px)에 비해 세로 폭(약 400px)이 커서 대각선이 가팔라지는 것.
 * 상자 오른쪽에서 **수평으로 출발해 왼쪽으로 수평 도착**하면, 곡선이 열 사이 복도를 벗어나지 않는다.
 * 흐름도(Sankey)가 쓰는 방식이고, 보기에도 «흐른다»는 느낌이 난다.
 */
function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const half = NW / 2 + 4
  // 같은 열 안의 연결은 왼쪽으로 크게 돌린다 — 사이에 낀 상자들을 피해야 한다
  if (Math.abs(x2 - x1) < NW) {
    const bx = x1 - half - 44
    return `M ${x1 - half} ${y1} C ${bx} ${y1}, ${bx} ${y2}, ${x2 - half} ${y2}`
  }
  const fwd = x2 > x1
  const sx = x1 + (fwd ? half : -half)
  const ex = x2 - (fwd ? half : -half)
  const dx = (ex - sx) * 0.55
  return `M ${sx} ${y1} C ${sx + dx} ${y1}, ${ex - dx} ${y2}, ${ex} ${y2}`
}

/** 라벨을 놓을 자리 — 곡선의 가운데는 대체로 두 y의 중간, x는 복도 한가운데 */
function labelAt(x1: number, y1: number, x2: number, y2: number, at: number) {
  const half = NW / 2 + 4
  if (Math.abs(x2 - x1) < NW) return { x: x1 - half - 30, y: (y1 + y2) / 2 }
  const fwd = x2 > x1
  const sx = x1 + (fwd ? half : -half)
  const ex = x2 - (fwd ? half : -half)
  return { x: sx + (ex - sx) * at, y: y1 + (y2 - y1) * at - 4 }
}

/** 핵심 사슬에 속한 관계는 굵게 — 이 길이 먼저 보여야 한다 */
const CORE_REL = new Set(['supports', 'reflectedIn', 'raises', 'lowers'])

type Placed = { iri: string; x: number; y: number; col: number }
type Link = { from: string; to: string; p: string }

export default function InstanceMap({ snap, onGoto }: { snap: SimSnapshot; onGoto: Jump }) {
  // 스냅샷은 250ms마다 바뀐다 — 읽는 중에 그래프가 흔들리면 못 쓴다.
  // 누른 순간의 상태로 굳히고, 새로 보고 싶으면 명시적으로 다시 뜬다.
  const [gen, setGen] = useState(0)
  const graph = useMemo(() => buildDataGraph(snap), [gen]) // eslint-disable-line react-hooks/exhaustive-deps
  const ix = graph.index

  const vehicles = useMemo(
    () =>
      Object.keys(ix.type)
        .filter((i) => ix.type[i] === 'Vehicle')
        .sort((a, b) => degreeOf(ix, b) - degreeOf(ix, a)),
    [ix],
  )
  const gate = useGate()
  const role = useRole()
  const [seed, setSeed] = useState<string>('')
  const [pick, setPick] = useState<string | null>(null)

  const { placed, links } = useMemo(() => weave(ix, seed), [ix, seed])
  const pos = new Map(placed.map((p) => [p.iri, p]))

  const colorOf = (iri: string) => SPACES.find((s) => s.en === ix.space[iri])?.color ?? '#94a3b8'
  // 규정이 막는다 — 기사 노드 라벨은 실명 권한이 있어야 실명으로 보인다
  const name = (iri: string) => {
    const l = ix.label[iri] ?? iri.replace('qdi:', '')
    return ix.type[iri] === 'Driver' && !can(role, 'seeDriverName') ? maskName(role, l, snap) : l
  }
  /** 이 레코드가 어떤 표준 코드로 분류됐나 — 개념 스페이스로 나가는 «분류된다» */
  const classOf = (iri: string) => {
    const c = (ix.out[iri] ?? []).find((e) => ix.space[e.o] === 'Concept')
    return c ? (ix.label[c.o] ?? '') : ''
  }
  const totalLinks = Object.values(ix.out).reduce((n, a) => n + a.length, 0)

  /** 고른 노드에 붙은 것만 살린다 — 그물 안에서 한 가닥을 짚는 방식 */
  const near = useMemo(() => {
    if (!pick) return null
    const s = new Set<string>([pick])
    links.forEach((l) => {
      if (l.from === pick) s.add(l.to)
      if (l.to === pick) s.add(l.from)
    })
    return s
  }, [pick, links])
  const litNode = (iri: string) => !near || near.has(iri)
  const litLink = (l: Link) => !pick || l.from === pick || l.to === pick

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-2.5">
        <span className="whitespace-nowrap text-[12px] font-bold text-gray-200">
          이 화면 <b className="text-sky-300">{placed.length}</b>개 노드 · <b className="text-emerald-300">{links.length}</b>개 연결
        </span>
        <span className="whitespace-nowrap text-[11.5px] text-gray-500">
          전체 그래프 {graph.subjects}개 노드 · {totalLinks}개 연결
        </span>
        <span className="break-keep text-[11.5px] text-gray-500">
          ⑨ SHACL이 검사하는 것과 같은 그래프입니다 — 노드를 누르면 그 레코드에 붙은 연결만 남습니다.
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {pick && (
            <button
              onClick={() => setPick(null)}
              className="whitespace-nowrap rounded-md border border-gray-700 bg-gray-900 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              전체 보기
            </button>
          )}
          <button
            onClick={() => setGen((g) => g + 1)}
            className="whitespace-nowrap rounded-md border border-sky-500/40 bg-sky-500/12 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ↻ 지금 상태로
          </button>
        </div>
      </div>

      {/* 어느 차량에서 뻗은 그물을 볼 것인가 */}
      {vehicles.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-500">기준 차량</span>
          <button
            onClick={() => {
              setSeed('')
              setPick(null)
            }}
            className={`rounded-md border px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-sky-500 ${
              seed === '' ? 'border-sky-400/60 bg-sky-400/15 text-sky-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            연결 많은 순
          </button>
          {vehicles.slice(0, 6).map((v) => (
            <button
              key={v}
              onClick={() => {
                setSeed(v)
                setPick(null)
              }}
              className={`rounded-md border px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-sky-500 ${
                seed === v ? 'border-sky-400/60 bg-sky-400/15 text-sky-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
              }`}
            >
              {name(v)}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <svg viewBox="0 0 980 520" className="w-full min-w-[880px]" role="img" aria-label="인스턴스 그래프 — 레코드 사이의 실제 연결">
          {/* 열 머리글 */}
          <g>
            {COLS.map((c) => (
              <text key={c.ko} x={c.x} y={30} textAnchor="middle" fontSize={11} fontWeight={900} fill="var(--color-gray-500)">
                {c.ko}
              </text>
            ))}
          </g>

          {/* ① 간선 */}
          <g fill="none">
            {links.map((l, i) => {
              const a = pos.get(l.from)
              const b = pos.get(l.to)
              if (!a || !b) return null
              const core = CORE_REL.has(l.p.replace('qd:', ''))
              const on = litLink(l)
              return (
                <path
                  key={i}
                  d={linkPath(a.x, a.y, b.x, b.y)}
                  stroke={colorOf(l.to)}
                  strokeOpacity={on ? (core ? 0.72 : 0.32) : 0.05}
                  strokeWidth={core ? 2.1 : 1.1}
                />
              )
            })}
          </g>

          {/* ② 관계 라벨 — 고른 노드에 붙은 것만. 전부 적으면 글자가 그래프를 덮는다 */}
          <g>
            {pick &&
              links
                .filter(litLink)
                .map((l, i) => {
                  const a = pos.get(l.from)
                  const b = pos.get(l.to)
                  if (!a || !b) return null
                  const q = labelAt(a.x, a.y, b.x, b.y, l.from === pick ? 0.34 : 0.66)
                  return (
                    <text
                      key={i}
                      x={q.x}
                      y={q.y}
                      textAnchor="middle"
                      fontSize={8.5}
                      fontWeight={700}
                      fill={ink(colorOf(l.to))}
                      style={{ paintOrder: 'stroke', stroke: 'var(--color-gray-900)', strokeWidth: 3.5, strokeLinejoin: 'round' }}
                    >
                      {relKo(l.p)}
                    </text>
                  )
                })}
          </g>

          {/* ③ 노드 */}
          <g>
            {placed.map((p) => {
              const c = colorOf(p.iri)
              const isPick = p.iri === pick
              const on = litNode(p.iri)
              const label = name(p.iri)
              const d = degreeOf(ix, p.iri)
              // 게이트에 막힌 레코드 — 이 노드는 하류로 안 내려간다. 그래프에서도 보여야 한다.
              const blocked = gate.held.has(p.iri)
              return (
                <g
                  key={p.iri}
                  onClick={() => setPick(isPick ? null : p.iri)}
                  style={{ cursor: 'pointer' }}
                  opacity={on ? 1 : 0.16}
                >
                  <rect
                    x={p.x - NW / 2}
                    y={p.y - NH / 2}
                    width={NW}
                    height={NH}
                    rx={8}
                    fill="var(--color-gray-900)"
                    stroke={blocked ? '#fb7185' : c}
                    strokeWidth={isPick ? 2.4 : blocked ? 2 : 1.2}
                    strokeDasharray={blocked ? '4 3' : undefined}
                    strokeOpacity={isPick || blocked ? 1 : 0.7}
                  />
                  <rect
                    x={p.x - NW / 2}
                    y={p.y - NH / 2}
                    width={NW}
                    height={NH}
                    rx={8}
                    fill={blocked ? '#fb7185' : c}
                    fillOpacity={isPick ? 0.22 : blocked ? 0.14 : 0.08}
                  />
                  <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={ink(blocked ? '#fda4af' : c)}>
                    {blocked && '⛔ '}
                    {label.length > 15 ? label.slice(0, 14) + '…' : label}
                  </text>
                  <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="var(--color-gray-500)">
                    {/* 표준 코드 분류는 선 대신 노드 안에 적는다 — 개념 노드를 열로 세우면
                        관측→판정 선이 그 상자를 관통한다. 연결은 보이되 선은 깨끗해야 한다. */}
                    {classOf(p.iri) ? `분류 ${classOf(p.iri)} · 연결 ${d}` : `연결 ${d}`}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-[12.5px] leading-relaxed text-gray-500">
        {pick ? (
          <>
            <span>
              고른 노드 <b className="text-gray-300">{name(pick)}</b> — 이 화면에서{' '}
              <b className="text-gray-300">{links.filter(litLink).length}</b>개 연결이 붙어 있습니다. 다시 누르면 전체로 돌아갑니다.
            </span>
            <ChainLink ix={ix} iri={pick} onGoto={onGoto} />
            <button
              onClick={() => onGoto('live', { live: { focusIri: pick } })}
              className="rounded-md border border-pink-400/45 bg-pink-400/12 px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-pink-200 hover:bg-pink-400/22 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑨ 이 레코드가 받은 검사 →
            </button>
          </>
        ) : (
          <span>
            <b className="text-gray-300">굵은 선 = 핵심 사슬</b>(뒷받침한다 · 반영된다 · 올린다). <b className="text-rose-300">⛔ 점선 = 게이트에 막힌 레코드</b> — 하류로 안 내려갑니다.
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 고른 레코드를 ⑤ 근거 사슬로 넘긴다.
 *
 * 그래프는 «무엇이 무엇과 걸려 있나»까지만 보여준다. 「그래서 이 숫자가 어떻게 나온 건데」는
 * 근거 사슬의 몫이다. 넘어갈 때 **어느 지표를 어느 차량으로 볼지**까지 들고 간다 —
 * 화면만 열고 조건을 사용자가 다시 맞추게 하면 딥링크가 아니라 그냥 링크다.
 */
function ChainLink({ ix, iri, onGoto }: { ix: GraphIndex; iri: string; onGoto: Jump }) {
  const metric = metricOf(ix, iri)
  const vehicleId = vehicleOf(ix, iri)
  const ko = METRICS.find((m) => m.key === metric)?.ko ?? '성과'

  return (
    <button
      onClick={() => onGoto('chain', { chain: { metric, vehicleId } })}
      className="rounded-md border border-violet-400/45 bg-violet-400/12 px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-400/22 focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      ⑤ 근거 사슬에서 되짚기 — {vehicleId ? `${vehicleId} ` : ''}
      {ko} →
    </button>
  )
}

/**
 * 사슬을 가로지르는 짜임을 만든다.
 * 핵심은 «연결된 것만 고르는 것» — 각 열을 아무거나 채우면 선이 거의 안 그려진다.
 * 자산에서 출발해 관측 → 판정 → 성과 → (성과로 들어오는) 조치 순으로 **따라가며** 채운다.
 */
function weave(ix: GraphIndex, seedVehicle: string): { placed: Placed[]; links: Link[] } {
  const CAP = [4, 8, 11, 11, 6, 6]
  const outTo = (iri: string, space: string) => (ix.out[iri] ?? []).filter((e) => ix.space[e.o] === space).map((e) => e.o)
  const incFrom = (iri: string, space: string) => (ix.inc[iri] ?? []).filter((e) => ix.space[e.s] === space).map((e) => e.s)

  const vehicles = Object.keys(ix.type)
    .filter((i) => ix.type[i] === 'Vehicle')
    .sort((a, b) => degreeOf(ix, b) - degreeOf(ix, a))
  const seeds = seedVehicle && ix.type[seedVehicle] ? [seedVehicle] : vehicles.slice(0, 4)

  // 주체는 자기 열로 뺐다 — 자산과 한 열에 두면 «운전한다»가 같은 열 안의 선이 되어
  // 사이에 낀 상자들을 지난다. 열을 나누면 그냥 옆으로 흐르는 선이 된다.
  const col0: string[] = []
  seeds.forEach((v) => incFrom(v, 'Subject').forEach((s) => col0.includes(s) || col0.push(s)))

  const col1 = [...seeds]
  seeds.forEach((v) => {
    const dev = `qdi:dev-${v.replace('qdi:veh-', '')}`
    if (ix.type[dev] && !col1.includes(dev)) col1.push(dev)
  })

  const col2: string[] = []
  col1.forEach((n) => outTo(n, 'Evidence').forEach((e) => col2.includes(e) || col2.push(e)))

  const col3: string[] = []
  col2.slice(0, CAP[2]).forEach((e) => outTo(e, 'Claim').forEach((c) => col3.includes(c) || col3.push(c)))

  const col4: string[] = []
  col3.slice(0, CAP[3]).forEach((c) => outTo(c, 'Outcome').forEach((o) => col4.includes(o) || col4.push(o)))

  const col5: string[] = []
  col4.slice(0, CAP[4]).forEach((o) => incFrom(o, 'Lever').forEach((l) => col5.includes(l) || col5.push(l)))

  const cols = [col0, col1, col2, col3, col4, col5].map((c, i) => c.slice(0, CAP[i]))

  const placed: Placed[] = []
  cols.forEach((list, ci) => {
    const n = list.length
    list.forEach((iri, i) => {
      const y = n === 1 ? (TOP + BOT) / 2 : TOP + ((BOT - TOP) * i) / (n - 1)
      placed.push({ iri, x: COLS[ci].x, y, col: ci })
    })
  })

  /* 배치된 노드 사이의 **모든** 연결을 그린다 — 이게 있어야 그물로 보인다 */
  const on = new Set(placed.map((p) => p.iri))
  const links: Link[] = []
  const seen = new Set<string>()
  on.forEach((s) => {
    ;(ix.out[s] ?? []).forEach(({ p, o }) => {
      if (!on.has(o)) return
      const k = `${s}|${o}|${p}`
      if (seen.has(k)) return
      seen.add(k)
      links.push({ from: s, to: o, p })
    })
  })

  return { placed, links }
}
