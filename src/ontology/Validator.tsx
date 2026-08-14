import { useState } from 'react'
import { Panel } from '../components/ui'
import { META_EDGES, RELATION_GLOSSARY, SPACES, spaceOf, type SpaceId } from './meta'

/**
 * ③ 문법 검증 — 문법이 말뿐인지, 실제로 막히는지 눌러서 확인한다.
 * 가능한 조합 대비 허용 조합이 얼마나 적은지를 보여주는 것이 요점.
 */

type Verdict =
  | { ok: true; edge: (typeof META_EDGES)[number] }
  | { ok: false; code: 'NO_DIRECTION' | 'WRONG_RELATION' | 'SAME_SPACE'; reason: string; hint: string }

function validate(from: SpaceId, to: SpaceId, rel: string): Verdict {
  if (from === to) {
    return {
      ok: false, code: 'SAME_SPACE',
      reason: '같은 스페이스 안에서의 관계는 문법 v1.0에 정의돼 있지 않습니다.',
      hint: '개념끼리의 상하위 같은 관계가 필요하면 문법에 방향을 먼저 추가해야 합니다.',
    }
  }
  const edge = META_EDGES.find((e) => e.from === from && e.to === to)
  if (!edge) {
    const reverse = META_EDGES.find((e) => e.from === to && e.to === from)
    return {
      ok: false, code: 'NO_DIRECTION',
      reason: `${spaceOf(from).ko} → ${spaceOf(to).ko} 방향은 문법에 없습니다.`,
      hint: reverse
        ? `반대 방향(${spaceOf(to).ko} → ${spaceOf(from).ko})은 정의돼 있습니다 — 방향을 뒤집어 보세요.`
        : '두 스페이스를 직접 잇지 말고, 사이에 있는 스페이스를 거쳐야 합니다.',
    }
  }
  if (!edge.relations.includes(rel)) {
    return {
      ok: false, code: 'WRONG_RELATION',
      reason: `«${rel}»은 ${spaceOf(from).ko} → ${spaceOf(to).ko} 방향에서 쓸 수 없습니다.`,
      hint: `이 방향에 허용된 어휘: ${edge.relations.join(' · ')}`,
    }
  }
  return { ok: true, edge }
}

const CASES: { ko: string; from: SpaceId; to: SpaceId; rel: string; why: string }[] = [
  { ko: '관측 → 성과 직접 연결', from: 'evidence', to: 'outcome', rel: '기여한다', why: '패킷을 성과에 바로 꽂으면 "왜 그 숫자인가"의 중간 단계가 사라진다' },
  { ko: '조치 → 관측 (거꾸로)', from: 'lever', to: 'evidence', rel: '올린다', why: '조치가 관측을 만들어내는 것처럼 쓰면 인과가 뒤집힌다' },
  { ko: '판정에 «올린다» 사용', from: 'claim', to: 'outcome', rel: '올린다', why: '판정은 반영·보정만 한다. 올리고 내리는 것은 조치의 몫' },
  { ko: '주체 → 성과 직접 연결', from: 'subject', to: 'outcome', rel: '기여한다', why: '사람을 성과에 직접 잇는 순간 개인 평가 도구가 된다 — 규정 위반' },
]

export default function Validator({ preset }: { preset?: { from: SpaceId; to: SpaceId; rel: string } }) {
  // 격리 큐에서 «이 조합 눌러보기»로 넘어온 경우, 그 조합을 초기값으로 연다
  const [from, setFrom] = useState<SpaceId>(preset?.from ?? 'evidence')
  const [to, setTo] = useState<SpaceId>(preset?.to ?? 'outcome')
  const [rel, setRel] = useState<string>(preset?.rel ?? '기여한다')
  const [caseKey, setCaseKey] = useState<string | null>(preset ? null : CASES[0].ko)

  const all = [...new Set(META_EDGES.flatMap((e) => e.relations))]
  const v = validate(from, to, rel)
  const combos = SPACES.length * (SPACES.length - 1) * all.length
  const allowed = META_EDGES.reduce((n, e) => n + e.relations.length, 0)
  const pct = ((allowed / combos) * 100).toFixed(1)

  const pickCase = (c: (typeof CASES)[number]) => {
    setFrom(c.from)
    setTo(c.to)
    setRel(c.rel)
    setCaseKey(c.ko)
  }
  const manual = (fn: () => void) => {
    fn()
    setCaseKey(null)
  }

  return (
    <div className="space-y-3">
      <Panel title="문법은 무엇을 못 하게 하는가" right={<span className="text-[11px] text-gray-500">허용 조합 비율</span>}>
        <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
          <Stat n={combos.toLocaleString('ko-KR')} label="만들 수 있는 조합" sub={`${SPACES.length}개 스페이스 × ${SPACES.length - 1} × 어휘 ${all.length}종`} color="#94a3b8" />
          <Stat n={String(allowed)} label="문법이 허용하는 조합" sub={`${META_EDGES.length}개 방향에 정의된 것만`} color="#34d399" />
          <Stat n={`${pct}%`} label="허용률" sub={`나머지 ${(100 - Number(pct)).toFixed(1)}%는 만들 수 없습니다`} color="#fb7185" />
        </div>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          문법의 값어치는 <b className="text-gray-300">무엇을 할 수 있는지가 아니라 무엇을 못 하는지</b>에 있습니다. 관계를 자유롭게 만들 수 있으면
          당장은 편하지만, 반년 뒤에는 아무도 그 연결이 무슨 뜻인지 모릅니다.
        </div>
      </Panel>

      <Panel title="위반 사례 — 실제로 막히는지 눌러보기">
        <div className="grid grid-cols-4 gap-2 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
          {CASES.map((c) => {
            const on = caseKey === c.ko
            return (
              <button
                key={c.ko}
                onClick={() => pickCase(c)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-red-400/60 bg-red-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <div className={`text-[12px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{c.ko}</div>
                <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{c.why}</div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title="직접 조합해 보기" right={<span className="text-[11px] text-gray-500">출발 · 관계 · 도착</span>}>
        <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
          <Picker label="출발 스페이스" items={SPACES.map((s) => s.id)} value={from} onChange={(x) => manual(() => setFrom(x as SpaceId))} render={(x) => spaceOf(x as SpaceId).ko} colorOf={(x) => spaceOf(x as SpaceId).color} />
          <Picker label="관계 어휘" items={all} value={rel} onChange={(x) => manual(() => setRel(x))} render={(x) => x} />
          <Picker label="도착 스페이스" items={SPACES.map((s) => s.id)} value={to} onChange={(x) => manual(() => setTo(x as SpaceId))} render={(x) => spaceOf(x as SpaceId).ko} colorOf={(x) => spaceOf(x as SpaceId).color} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-3">
          <span className="rounded px-2.5 py-1.5 text-[13px] font-black" style={{ background: `${spaceOf(from).color}22`, color: spaceOf(from).color }}>
            {spaceOf(from).ko}
          </span>
          <span className="text-gray-600">─</span>
          <span className="rounded bg-gray-800 px-2 py-1 text-[12px] font-bold text-gray-200">{rel}</span>
          <span className="text-gray-600">→</span>
          <span className="rounded px-2.5 py-1.5 text-[13px] font-black" style={{ background: `${spaceOf(to).color}22`, color: spaceOf(to).color }}>
            {spaceOf(to).ko}
          </span>
        </div>

        {v.ok ? (
          <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <div className="text-[13px] font-black text-emerald-400">✅ 허용 — 문법에 정의된 관계입니다</div>
            <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-300">
              {RELATION_GLOSSARY[rel] ?? ''} {v.edge.core && <b className="text-sky-300">핵심 사슬에 속한 관계입니다.</b>}
            </div>
            <div className="mt-1 text-[11px] text-gray-500">이 방향의 다른 어휘 — {v.edge.relations.filter((r) => r !== rel).join(' · ') || '없음'}</div>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-black text-red-400">❌ 거부</span>
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">{v.code}</span>
            </div>
            <div className="mt-1 break-keep text-[12px] font-semibold leading-relaxed text-gray-200">{v.reason}</div>
            <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">→ {v.hint}</div>
          </div>
        )}

        <div className="mt-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
          실서비스에서는 이 검사가 <b className="text-gray-300">적재 시점에 돌아갑니다</b> — 문법에 없는 관계를 만들려는 시도는 저장되지 않고 보류
          큐로 갑니다. 새 관계가 정말 필요하면 문법을 먼저 고치고 버전을 올립니다.
        </div>
      </Panel>
    </div>
  )
}

function Stat({ n, label, sub, color }: { n: string; label: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2.5">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-0.5 text-2xl font-black tabular-nums" style={{ color }}>
        {n}
      </div>
      <div className="mt-0.5 break-keep text-[10.5px] text-gray-500">{sub}</div>
    </div>
  )
}

function Picker({
  label, items, value, onChange, render, colorOf,
}: {
  label: string
  items: string[]
  value: string
  onChange: (v: string) => void
  render: (v: string) => string
  colorOf?: (v: string) => string
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold text-gray-400">{label}</div>
      <div className="flex max-h-[128px] flex-wrap gap-1 overflow-y-auto pr-1">
        {items.map((x) => {
          const on = x === value
          return (
            <button
              key={x}
              onClick={() => onChange(x)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${on ? '' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'}`}
              style={on ? { background: `${colorOf?.(x) ?? '#38bdf8'}22`, color: colorOf?.(x) ?? '#7dd3fc' } : undefined}
            >
              {render(x)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
