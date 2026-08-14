import { useState } from 'react'
import { Panel } from '../components/ui'
import { SPACES, spaceOf, type SpaceId } from './meta'
import { CHANGES, IMPACTS, SCENARIOS, SPACE_IMPACTS, analyse, type ChangeKind } from './impactmeta'

/**
 * ④ 영향 분석 — "이걸 바꾸면 어디까지 흔들리나".
 * 스페이스 × 변경 유형에서 I1~I7 범주를 트리거하고, 관계를 타고 전파 범위와 영향 화면을 낸다.
 */
export default function Impact({ onNavigate, preset }: { onNavigate?: (tab: string) => void; preset?: { space: SpaceId; change: ChangeKind } }) {
  // 격리 큐의 «이렇게 고치면»에서 넘어온 경우, 그 조합을 초기값으로 연다
  const [space, setSpace] = useState<SpaceId>(preset?.space ?? 'evidence')
  const [change, setChange] = useState<ChangeKind>(preset?.change ?? 'schema')
  const [scenario, setScenario] = useState<string | null>(preset ? null : 'dtg')

  const r = analyse(space, change)
  const sp = spaceOf(space)
  const sc = SCENARIOS.find((s) => s.key === scenario)

  const pick = (sId: SpaceId, c: ChangeKind, key: string | null) => {
    setSpace(sId)
    setChange(c)
    setScenario(key)
  }

  return (
    <div className="space-y-3">
      <Panel title="변경 시나리오 — 눌러보면 어디까지 번지는지" right={<span className="text-[11px] text-gray-500">직접 조합해도 됩니다</span>}>
        <div className="grid grid-cols-3 gap-2 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
          {SCENARIOS.map((s) => {
            const on = scenario === s.key
            return (
              <button
                key={s.key}
                onClick={() => pick(s.space, s.change, s.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-amber-400/60 bg-amber-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <div className={`text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{s.ko}</div>
                <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-gray-500">{s.note}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px]">
                  <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: `${spaceOf(s.space).color}22`, color: spaceOf(s.space).color }}>
                    {spaceOf(s.space).ko}
                  </span>
                  <span className="text-gray-600">×</span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 font-semibold text-gray-300">{CHANGES.find((c) => c.id === s.change)!.ko}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-gray-400">무엇이 바뀌나 — 스페이스</div>
            <div className="flex flex-wrap gap-1">
              {SPACES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s.id, change, null)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    space === s.id ? 'ring-1' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                  style={space === s.id ? { background: `${s.color}22`, color: s.color, borderColor: s.color } : undefined}
                >
                  {s.ko}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold text-gray-400">어떻게 바뀌나 — 변경 유형</div>
            <div className="flex flex-wrap gap-1">
              {CHANGES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(space, c.id, null)}
                  title={c.desc}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    change === c.id ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {c.ko}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title={`분석 결과 — ${sp.ko} × ${r.change.ko}`}
        right={<span className="text-[11px] text-gray-500">범주 {r.ids.length} · 전파 {r.spaces.length}스페이스 · 화면 {r.services.length}개</span>}
      >
        {sc && (
          <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 break-keep text-[12px] leading-relaxed text-gray-200">
            <b className="text-amber-400">{sc.ko}</b> — {sc.note}
          </div>
        )}

        <div className="mb-1.5 text-[11px] font-bold text-gray-400">트리거된 영향 범주</div>
        <div className="grid grid-cols-4 gap-2 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
          {IMPACTS.map((i) => {
            const on = r.ids.some((x) => x.id === i.id)
            const always = i.id === 'I1'
            return (
              <div
                key={i.id}
                className={`rounded-lg border px-3 py-2 ${on ? 'border-amber-500/40 bg-amber-500/10' : 'border-dashed border-gray-800 bg-gray-900/30'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-black ${on ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-600'}`}>
                    {i.id}
                  </span>
                  <span className={`text-[12px] font-bold ${on ? 'text-gray-100' : 'text-gray-600'}`}>{i.ko}</span>
                  {on && always && <span className="ml-auto text-[9.5px] font-bold text-gray-500">항상</span>}
                </div>
                <div className={`mt-0.5 break-keep text-[10.5px] leading-relaxed ${on ? 'text-gray-400' : 'text-gray-700'}`}>{i.q}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2.5">
            <div className="mb-1.5 text-[11px] font-bold text-gray-400">전파 범위 — 관계를 타고 2단계까지</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded px-2 py-1 text-[11.5px] font-black" style={{ background: `${sp.color}22`, color: sp.color }}>
                {sp.ko}
              </span>
              <span className="text-gray-600">→</span>
              {r.spaces.map((s) => (
                <button
                  key={s}
                  onClick={() => pick(s, change, null)}
                  className="rounded px-1.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80"
                  style={{ background: `${spaceOf(s).color}18`, color: spaceOf(s).color }}
                >
                  {spaceOf(s).ko}
                </button>
              ))}
            </div>
            <div className="mt-2 break-keep text-[11px] leading-relaxed text-gray-500">
              {sp.ko}은(는) 기본적으로 <b className="text-gray-400">{SPACE_IMPACTS[space].join(' · ')}</b>를 건드립니다. 여기에 «{r.change.ko}»가 더해져
              위 범주가 트리거됐습니다.
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2.5">
            <div className="mb-1.5 text-[11px] font-bold text-gray-400">숫자가 흔들리는 화면 — 미리 알려야 할 곳</div>
            <div className="flex flex-wrap gap-1.5">
              {r.services.map((s) => (
                <button
                  key={s.name}
                  onClick={() => onNavigate?.(s.tab)}
                  className="rounded-md border border-gray-800 px-2 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:border-sky-600 hover:text-sky-300 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {s.name} →
                </button>
              ))}
            </div>
            <div className="mt-2 break-keep text-[11px] leading-relaxed text-gray-500">
              눌러서 그 화면으로 이동할 수 있습니다. 변경 전에 <b className="text-gray-400">영향받는 화면 담당자에게 먼저 알리는 것</b>이 이 분석의
              쓰임새입니다.
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 break-keep text-[11.5px] leading-relaxed text-gray-300">
          <b className="text-sky-300">왜 이걸 미리 계산하나</b> — 데이터를 고치는 일은 늘 "고치면 뭐가 깨지나"에서 막힙니다. 스페이스와 관계가 문법으로
          정의돼 있으면 그 답을 사람이 기억하지 않아도 됩니다. 특히 <b className="text-gray-200">I4(권한)·I5(로직)</b>가 뜨면 담당자 승인 없이 바꾸지
          않는 것이 원칙입니다.
        </div>
      </Panel>
    </div>
  )
}
