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

/** 세로 선의 x — 서로 다른 자리를 써야 라벨이 겹치지 않는다 */
const DOWN_X = 540 // 검사대 → 막힌 데이터
/* 되먹임은 **말 바꾸기(…408)와 검사대(498…) 사이의 빈 복도**로 올라온다.
   처음 610을 썼더니 막힌 데이터 상자(498~648) 한가운데를 뚫었다.
   복도를 고를 때는 «그 x가 어느 상자의 가로 범위에도 안 들어가는지»를 먼저 확인해야 한다. */
const BACK_X = 453
const FLOOR = 292

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

  const lines: { d: string; c: string; dash?: boolean }[] = [
    ...['s1', 's2', 's3'].map((s) => ({ d: curve(byId(s), byId('adp')), c: '#475569' })),
    { d: curve(byId('adp'), byId('gate')), c: '#475569' },
    { d: curve(byId('gate'), byId('graph')), c: '#475569' },
    ...['u1', 'u2', 'u3', 'u4'].map((u) => ({ d: curve(byId('graph'), byId(u)), c: '#475569' })),
    { d: `M ${DOWN_X} 152 L ${DOWN_X} 218`, c: '#fb7185' },
    { d: `M 648 242 L 738 242`, c: '#c084fc' },
    { d: `M ${BACK_X} 266 L ${BACK_X} ${FLOOR} L ${BACK_X} ${FLOOR}`, c: '#c084fc', dash: true },
  ]
  // 되먹임: 규칙 고치기 아래 → 바닥 → BACK_X 로 올라와 검사대 아래로
  const back = `M 817 266 L 817 ${FLOOR} L ${BACK_X} ${FLOOR} L ${BACK_X} 152 L 498 152`
  lines[lines.length - 1] = { d: back, c: '#c084fc', dash: true }

  const labels = [
    { x: 453, y: 112, t: '옮겨서', c: '#64748b' },
    { x: 693, y: 112, t: `통과한 것만 ${passed}`, c: '#34d399' },
    { x: DOWN_X, y: 190, t: `어긋나면 ${gate.held.size}건`, c: '#fb7185' },
    { x: 693, y: 234, t: '자꾸 막히면', c: '#c084fc' },
    { x: 645, y: 286, t: '고친 규칙이 검사대에 반영된다', c: '#c084fc' },
  ]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[880px]" role="img" aria-label="데이터 흐름도">
        {lines.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={l.c} strokeWidth={1.4} strokeDasharray={l.dash ? '5 4' : undefined} opacity={0.8} />
        ))}
        {labels.map((l) => (
          <text
            key={l.t}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill={l.c}
            stroke="#030712"
            strokeWidth={3.5}
            paintOrder="stroke"
          >
            {l.t}
          </text>
        ))}
        {NODES.map((n) => (
          <g key={n.id} onClick={() => n.step && jump(n.step)} style={{ cursor: n.step ? 'pointer' : 'default' }}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill={`${n.c}14`} stroke={`${n.c}66`} strokeWidth={1.1} />
            <text x={n.x + n.w / 2} y={n.y + (n.h > 50 ? 27 : 20)} textAnchor="middle" fontSize={12.5} fontWeight={800} fill={n.c}>
              {n.ko}
            </text>
            <text x={n.x + n.w / 2} y={n.y + (n.h > 50 ? 45 : 34)} textAnchor="middle" fontSize={10} fill="#94a3b8">
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
            className="flex w-full items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 text-left transition-colors hover:border-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="w-[132px] shrink-0 text-[11.5px] font-bold" style={{ color: r.from.color }}>
              {r.from.ko}
              <span className="mx-1 text-gray-600">→</span>
              <span style={{ color: r.to.color }}>{r.to.ko}</span>
            </span>
            {r.core && <span className="shrink-0 rounded bg-pink-400/15 px-1 py-px text-[9.5px] font-black text-pink-300">핵심</span>}
            <span className="min-w-0 flex-1">
              <span className="block h-2 rounded-full" style={{ width: `${Math.max(2, (r.n / max) * 100)}%`, background: `${r.to.color}88` }} />
            </span>
            <span className="w-[52px] shrink-0 text-right text-[11.5px] font-bold tabular-nums" style={{ color: r.n ? '#e5e7eb' : '#4b5563' }}>
              {r.n}
            </span>
            <span className="hidden w-[168px] shrink-0 truncate text-[10.5px] text-gray-600 min-[900px]:block">{r.rels.join(' · ')}</span>
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
