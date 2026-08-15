import { useState } from 'react'
import { Emph, Panel } from '../components/ui'
import { MISSIONS, READY_TONE, missionStats, type MissionId } from './missions'

/**
 * 목적별 활용 — ⑥ 조치와 효과의 아랫부분.
 *
 * 온톨로지는 그 자체로 값어치가 없다. 누군가 그걸로 **결정을 내릴 때** 값어치가 생긴다.
 * 그래서 이 화면은 「무엇을 만들었나」가 아니라 **「누가 무엇을 결정하는가」**로 시작한다.
 *
 * 질문마다 «지금 답한다 / 부분 / 못 한다»를 적는다. **「못 한다」를 적는 것이 이 표의 값어치다** —
 * 못 하는 이유가 데이터가 없어서인지, 규칙이 없어서인지, 원천이 없어서인지가 완전히 다르기 때문이다.
 * 발주처는 「다 됩니다」보다 「이건 되고 이건 이게 있어야 됩니다」를 신뢰한다.
 */
export default function MissionView() {
  const [id, setId] = useState<MissionId>('policy')
  const m = MISSIONS.find((x) => x.id === id) ?? MISSIONS[0]
  const st = missionStats()

  return (
    <Panel
      title="목적별 활용 — 누가 이 데이터로 무엇을 결정하나"
      right={
        <span className="text-[11px] text-gray-500">
          질문 {st.questions}개 중 답함 {st.ready} · 부분 {st.partial}
        </span>
      }
    >
      <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
        온톨로지는 그 자체로 값어치가 없습니다. 누군가 그걸로 <b className="text-gray-200">결정을 내릴 때</b> 값어치가 생깁니다. 이 도구가 답해야
        하는 결정은 셋입니다.
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
        {MISSIONS.map((x) => {
          const on = x.id === id
          const ok = x.questions.filter((q) => q.ready === '답한다').length
          return (
            <button
              key={x.id}
              onClick={() => setId(x.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                on ? 'bg-gray-800/40' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
              }`}
              style={on ? { borderColor: `${x.color}88`, background: `${x.color}14` } : undefined}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-black" style={{ color: x.color }}>
                  {x.ko}
                </span>
                <span className="text-[10.5px] text-gray-500">{x.who}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-gray-500">
                질문 {x.questions.length}개 중 <b className="text-emerald-400">{ok}개</b> 답함
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 rounded-lg border px-3 py-2.5 break-keep text-[12.5px] leading-relaxed" style={{ borderColor: `${m.color}33`, background: `${m.color}0d` }}>
        <Emph t={m.why} cls="text-gray-100" />
      </div>

      <div className="mt-3 space-y-2">
        {m.questions.map((q) => (
          <div key={q.q} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-black" style={{ color: READY_TONE[q.ready], background: `${READY_TONE[q.ready]}1a` }}>
                {q.ready}
              </span>
              <span className="text-[13px] font-bold text-gray-100">{q.q}</span>
            </div>
            <div className="mt-1.5 break-keep text-[12px] leading-relaxed text-gray-400">
              <Emph t={q.how} cls="text-gray-200" />
            </div>
            {q.need && (
              <div className="mt-1.5 rounded px-2.5 py-1.5 break-keep text-[11.5px] leading-relaxed" style={{ background: '#f59e0b12', color: '#fcd34d' }}>
                <b>더 필요한 것</b> — <Emph t={q.need} cls="text-amber-200" />
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {q.uses.map((u) => (
                <span key={u} className="rounded border border-gray-800 bg-gray-950/60 px-1.5 py-0.5 text-[10.5px] text-gray-500">
                  {u}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11.5px] font-black tracking-wide" style={{ color: m.color }}>
          이 목적을 위해 온톨로지에 넣은 것
        </div>
        <div className="grid grid-cols-2 gap-2 max-[900px]:grid-cols-1">
          {m.built.map((b) => (
            <div key={b.ko} className="rounded-lg border px-3 py-2" style={{ borderColor: `${m.color}33`, background: `${m.color}0a` }}>
              <div className="text-[12.5px] font-bold text-gray-100">{b.ko}</div>
              <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">
                <Emph t={b.what} cls="text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
        <b className="text-gray-400">「못 한다」를 적는 것이 이 표의 값어치입니다.</b> 못 하는 이유가 데이터가 없어서인지, 규칙이 없어서인지, 원천이
        없어서인지는 완전히 다른 문제입니다. 발주처는 「다 됩니다」보다 「이건 되고, 이건 이게 있어야 됩니다」를 신뢰합니다.
      </div>
    </Panel>
  )
}
