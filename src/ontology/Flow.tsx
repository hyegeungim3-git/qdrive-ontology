import { META_EDGES, SPACES, spaceOf } from './meta'
import { edgeLinkCounts } from './rdf'
import { useGate } from './gate'
import type { Jump, StepId } from './nav'

/**
 * 흐름도 + 연결 구조 — ⓪ 시작하기의 그림 두 장.
 *
 * ## 글자 크기
 * 도면 좌표계(viewBox)가 좁으면 **컨테이너 폭에 맞춰 늘어나면서 글자까지 확대된다.**
 * 처음 690폭으로 그렸더니 1240px 화면에서 1.8배가 되어 글자가 거대해졌다.
 * 좌표계를 실제 표시 폭에 가깝게(1180) 잡으면 배율이 1에 가까워져 의도한 크기로 나온다.
 *
 * ## 라벨이 상자를 침범하지 않게
 * 라벨은 **열과 열 사이 빈 복도의 한가운데**에만 놓는다. 그러려면 복도가 라벨 폭보다 넓어야 한다 —
 * 그래서 열 간격을 80px 이상으로 잡았다. 세로 선도 서로 다른 x를 쓴다(검사→격리는 왼쪽,
 * 되먹임은 오른쪽). 같은 x를 쓰면 라벨 자리가 겹친다.
 *
 * ## 연결이 얼마나 많은지
 * 흐름도만 보면 «한 줄로 지나간다»로 읽힌다. 실제로는 방향 11개에 수백 개의 연결이 걸려 있다.
 * 그 사실을 **실시간 숫자로** 두 번째 그림이 보여준다 — 정의상 허용이 아니라 지금 몇 개가 붙어 있는지.
 */

/* ── 1) 파이프라인 ── */

type N = { id: string; x: number; y: number; w: number; h: number; ko: string; sub: string; c: string; step?: StepId }

const W = 1180
const H = 310

const NODES: N[] = [
  { id: 's1', x: 16, y: 46, w: 152, h: 42, ko: 'DTG 운행기록', sub: '공단 · 1초마다', c: '#94a3b8', step: 'standards' },
  { id: 's2', x: 16, y: 98, w: 152, h: 42, ko: 'GTFS-RT', sub: '국제 표준 위치', c: '#94a3b8', step: 'standards' },
  { id: 's3', x: 16, y: 150, w: 152, h: 42, ko: '대구 BIS', sub: '정류소 도착', c: '#94a3b8', step: 'standards' },
  // 데이터는 차량에서만 오지 않는다 — 노선망·날씨·충전·차적은 다른 시스템이 준다
  { id: 's4', x: 16, y: 202, w: 152, h: 42, ko: '타 시스템 연계', sub: '기상 · 카드 · 충전 · 차적', c: '#94a3b8', step: 'guide' },

  { id: 'adp', x: 258, y: 86, w: 150, h: 66, ko: '말 바꾸기', sub: '남의 용어 → 우리 용어', c: '#38bdf8', step: 'standards' },
  { id: 'gate', x: 498, y: 86, w: 150, h: 66, ko: '검사대', sub: '규칙에 맞는지 확인', c: '#f472b6', step: 'live' },
  { id: 'graph', x: 738, y: 86, w: 158, h: 66, ko: '연결된 데이터', sub: '점과 선으로 저장', c: '#34d399', step: 'spaces' },

  { id: 'u1', x: 986, y: 24, w: 178, h: 40, ko: '근거 따라가기', sub: '이 숫자가 어디서', c: '#a78bfa', step: 'chain' },
  { id: 'u2', x: 986, y: 72, w: 178, h: 40, ko: '조치 내리기', sub: '코칭 · 배차 · 정비', c: '#fbbf24', step: 'sim' },
  { id: 'u3', x: 986, y: 120, w: 178, h: 40, ko: '데이터 목록', sub: '무엇이 있나', c: '#38bdf8', step: 'catalog' },
  { id: 'u4', x: 986, y: 168, w: 178, h: 40, ko: 'AI에 넘기기', sub: '표준 파일로', c: '#34d399', step: 'export' },

  { id: 'held', x: 498, y: 218, w: 150, h: 48, ko: '막힌 데이터', sub: '통과 못 한 것', c: '#fb7185', step: 'quarantine' },
  { id: 'fix', x: 738, y: 218, w: 158, h: 48, ko: '규칙 고치기', sub: '새 버전을 낸다', c: '#c084fc', step: 'release' },
]
const byId = (id: string) => NODES.find((n) => n.id === id)!

/** 세로 선의 x — 서로 다른 자리를 써야 라벨 자리가 겹치지 않는다 */
const DOWN_X = 540 // 검사대 → 막힌 데이터
/* 되먹임은 **말 바꾸기(…408)와 검사대(498…) 사이의 빈 복도**로 올라온다.
   처음 610을 썼더니 막힌 데이터 상자(498~648) 한가운데를 뚫었다.
   복도를 고를 때는 «그 x가 어느 상자의 가로 범위에도 안 들어가는지»를 먼저 확인해야 한다. */
const BACK_X = 453
const FLOOR = 292

/**
 * 라벨은 **선 위쪽에 얹는다** — 선 한가운데 놓고 검은 테두리로 파내던 방식을 버렸다.
 * 테두리로 글자를 파내면 어디서든 읽히긴 하지만 촌스럽고, 배경색이 바뀌면 그대로 깨진다.
 * 선 위 여백에 두면 아무 장치 없이도 겹치지 않는다 — 대신 **여백이 있는지 먼저 확인해야 한다.**
 */
type Lab = { x: number; y: number; t: string; c: string; anchor?: 'start' | 'middle'; strong?: string }

/** 모서리를 둥글린 직각 경로 — 꺾이는 점마다 짧은 호를 넣는다 */
const elbow = (pts: [number, number][], r = 10) => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const [nx, ny] = pts[i + 1]
    const inDir = [Math.sign(cx - px), Math.sign(cy - py)]
    const outDir = [Math.sign(nx - cx), Math.sign(ny - cy)]
    d += ` L ${cx - inDir[0] * r} ${cy - inDir[1] * r}`
    d += ` Q ${cx} ${cy} ${cx + outDir[0] * r} ${cy + outDir[1] * r}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last[0]} ${last[1]}`
  return d
}

const ARROWS: [string, string][] = [
  ['a-gray', '#64748b'],
  ['a-rose', '#fb7185'],
  ['a-violet', '#c084fc'],
]

export function Pipeline({ jump }: { jump: Jump }) {
  const gate = useGate()
  const passed = gate.graph.subjects ? gate.graph.subjects - gate.held.size : 0

  const curve = (a: N, b: N) => {
    const x1 = a.x + a.w
    const y1 = a.y + a.h / 2
    const x2 = b.x
    const y2 = b.y + b.h / 2
    const dx = Math.max(28, (x2 - x1) * 0.5)
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }

  const lines: { d: string; c: string; m: string; dash?: boolean }[] = [
    ...['s1', 's2', 's3', 's4'].map((s) => ({ d: curve(byId(s), byId('adp')), c: '#3f4a5a', m: 'a-gray' })),
    { d: curve(byId('adp'), byId('gate')), c: '#3f4a5a', m: 'a-gray' },
    { d: curve(byId('gate'), byId('graph')), c: '#3f4a5a', m: 'a-gray' },
    ...['u1', 'u2', 'u3', 'u4'].map((u) => ({ d: curve(byId('graph'), byId(u)), c: '#3f4a5a', m: 'a-gray' })),
    { d: `M ${DOWN_X} 152 L ${DOWN_X} 218`, c: '#fb7185', m: 'a-rose' },
    { d: `M 648 242 L 738 242`, c: '#c084fc', m: 'a-violet' },
    {
      // 규칙 고치기 아래 → 바닥 → 왼쪽 복도 → 검사대 왼쪽 아래로
      d: elbow([
        [817, 266],
        [817, FLOOR],
        [BACK_X, FLOOR],
        [BACK_X, 152],
        [498, 152],
      ]),
      c: '#c084fc',
      m: 'a-violet',
      dash: true,
    },
  ]

  // 선 위쪽 여백에 얹는다. 숫자는 한 줄 아래에 굵게 — 한 줄로 붙이면 폭이 복도를 넘는다.
  const labels: Lab[] = [
    { x: 453, y: 108, t: '옮겨서', c: '#7c8798' },
    { x: 693, y: 100, t: '통과한 것만', c: '#7c8798' },
    { x: 693, y: 114, t: String(passed), c: '#34d399', strong: '1' },
    { x: 556, y: 182, t: '어긋나면', c: '#7c8798', anchor: 'start' },
    { x: 556, y: 196, t: `${gate.held.size}건`, c: '#fb7185', anchor: 'start', strong: '1' },
    { x: 693, y: 232, t: '자꾸 막히면', c: '#a78bfa' },
    { x: 645, y: 284, t: '고친 규칙이 검사대에 반영된다', c: '#8b7bb8' },
  ]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[880px]" role="img" aria-label="데이터 흐름도">
        <defs>
          {ARROWS.map(([id, c]) => (
            <marker key={id} id={id} viewBox="0 0 7 6" refX="7" refY="3" markerWidth="7" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L7 3 L0 6 z" fill={c} opacity={0.85} />
            </marker>
          ))}
        </defs>
        {lines.map((l, i) => (
          <path
            key={i}
            d={l.d}
            fill="none"
            stroke={l.c}
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeDasharray={l.dash ? '6 5' : undefined}
            markerEnd={`url(#${l.m})`}
          />
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor ?? 'middle'}
            fontSize={l.strong ? 11.5 : 10.5}
            fontWeight={l.strong ? 800 : 600}
            fill={l.c}
            letterSpacing="0.01em"
          >
            {l.t}
          </text>
        ))}
        {NODES.map((n) => (
          <g key={n.id} onClick={() => n.step && jump(n.step)} style={{ cursor: n.step ? 'pointer' : 'default' }}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill={`${n.c}12`} stroke={`${n.c}55`} strokeWidth={1} />
            <text x={n.x + n.w / 2} y={n.y + (n.h > 50 ? 28 : 21)} textAnchor="middle" fontSize={12} fontWeight={700} fill={n.c}>
              {n.ko}
            </text>
            <text x={n.x + n.w / 2} y={n.y + (n.h > 50 ? 45 : 34)} textAnchor="middle" fontSize={10.5} fill="#8b95a5">
              {n.sub}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── 2) 연결 구조 — 지금 몇 개가 붙어 있나 ── */

export function Connections({ jump }: { jump: Jump }) {
  const gate = useGate()
  const counts = gate.graph.index ? edgeLinkCounts(gate.graph.index) : {}
  const rows = META_EDGES.map((e) => {
    const from = spaceOf(e.from)
    const to = spaceOf(e.to)
    return { from, to, rels: e.relations, core: !!e.core, n: counts[`${from.en}→${to.en}`] ?? 0 }
  }).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))
  const total = rows.reduce((s, r) => s + r.n, 0)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[12.5px] text-gray-400">
          지금 <b className="text-emerald-300 tabular-nums">{total.toLocaleString()}</b>개의 연결이 붙어 있습니다
        </span>
        <span className="text-[11.5px] text-gray-600">
          방향 {rows.length}개 · 노드 {gate.graph.subjects?.toLocaleString() ?? 0}개 · 자리 {SPACES.length}개
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <button
            key={`${r.from.en}-${r.to.en}`}
            onClick={() => jump('spaces')}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 max-[640px]:min-h-[40px] text-left transition-colors hover:border-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="w-[132px] shrink-0 text-[11.5px] font-bold" style={{ color: r.from.color }}>
              {r.from.ko}
              <span className="mx-1 text-gray-600">→</span>
              <span style={{ color: r.to.color }}>{r.to.ko}</span>
            </span>
            {r.core && <span className="shrink-0 rounded bg-pink-400/15 px-1 py-px text-[11px] font-black text-pink-300">핵심</span>}
            <span className="min-w-0 flex-1">
              <span className="block h-2 rounded-full" style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: `${r.to.color}88` }} />
            </span>
            <span className="w-[52px] shrink-0 text-right text-[11.5px] font-bold tabular-nums" style={{ color: r.n ? '#e5e7eb' : '#4b5563' }}>
              {r.n}
            </span>
            {/* 잘라 버리면 읽는 사람에겐 그냥 사라진 글자다 — 줄여서 «다 보이게» 하고 전체는 title로 */}
            <span
              title={r.rels.join(' · ')}
              className="hidden w-[176px] shrink-0 text-[11px] text-gray-600 min-[900px]:block"
            >
              {r.rels.length > 2 ? `${r.rels.slice(0, 2).join(' · ')} 외 ${r.rels.length - 2}` : r.rels.join(' · ')}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
        막대는 <b className="text-gray-400">정의상 허용</b>이 아니라 <b className="text-gray-400">지금 실제로 붙어 있는 개수</b>입니다. 배속을 올리면
        늘어납니다. 「핵심」은 관측 → 판정 → 성과로 이어지는 뼈대입니다 — 이 세 줄이 끊기면 「왜 그 숫자인가」에 답할 수 없습니다.
      </div>
    </div>
  )
}
