import { useState } from 'react'
import { Emph, Panel } from '../components/ui'
import { MISSIONS, READY_TONE, missionStats, roadmap, type MissionId } from './missions'
import { CHANNELS } from './sensors'

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
                <b>왜 아직 안 되나</b> — <Emph t={q.need} cls="text-amber-200" />
              </div>
            )}
            {/* «못 한다»에서 멈추지 않는다. 무엇이 들어오면 어떻게 되는지까지 적어야 계획이 된다 */}
            {q.then && (
              <div className="mt-1.5 rounded border px-2.5 py-2 break-keep text-[11.5px] leading-relaxed" style={{ borderColor: '#34d39933', background: '#34d39910', color: '#a7f3d0' }}>
                <div className="mb-1 flex flex-wrap gap-1">
                  {(q.unlock ?? []).map((c) => {
                    const ch = CHANNELS.find((x) => x.id === c)
                    return (
                      <span key={c} className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-300">
                        {ch?.ko ?? c}
                      </span>
                    )
                  })}
                </div>
                <b>이 데이터가 들어오면</b> — <Emph t={q.then} cls="text-emerald-200" />
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

      {/* 「이것도 필요하고 저것도 필요하다」는 계획이 아니다. 파급이 큰 것부터가 계획이다. */}
      <div className="mt-4">
        <div className="mb-1 text-[12px] font-black tracking-wide text-emerald-300">무엇부터 확보해야 하나 — 파급 순</div>
        <div className="mb-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          「이것도 필요하고 저것도 필요하다」는 계획이 아닙니다. 채널마다 <b className="text-gray-300">몇 개 질문을 여는지</b>를 세면 순서가
          정해집니다. 예산이 한정된 실증에서 합리적인 순서는 이것뿐입니다.
        </div>
        <div className="space-y-1">
          {roadmap().slice(0, 10).map((r, i) => {
            const ch = CHANNELS.find((x) => x.id === r.id)
            return (
              /* 고정폭 열을 좁은 화면에 그대로 두면 잘린다 — 375px에서는 세로로 쌓는다 */
              <div key={r.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[11px] font-black tabular-nums text-gray-600">{i + 1}</span>
                  <span className="shrink-0 text-[12.5px] font-bold text-gray-100">{ch?.ko ?? r.id}</span>
                  <span className="shrink-0 text-[10.5px] text-gray-600">{ch?.bus}</span>
                  <span className="shrink-0 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10.5px] font-black text-emerald-300">
                    질문 {r.count}개
                  </span>
                </div>
                <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-gray-500">{r.questions.join(' · ')}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
        <b className="text-gray-400">「못 한다」를 적는 것이 이 표의 값어치입니다.</b> 못 하는 이유가 데이터가 없어서인지, 규칙이 없어서인지, 원천이
        없어서인지는 완전히 다른 문제입니다. 발주처는 「다 됩니다」보다 「이건 되고, 이건 이게 있어야 됩니다」를 신뢰합니다.
      </div>
    </Panel>
  )
}
