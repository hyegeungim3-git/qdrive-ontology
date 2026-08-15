import { useState } from 'react'
import { ink } from './ink'
import { Emph, Panel } from '../components/ui'
import { CONF_TONE, CONSUMERS, KIND_TONE, PRODUCED, flowStats, type ConsumerKind, type ProducedKind } from './dataflow'
import { BUSES, CHANNELS, INTAKE_TONE } from './sensors'
import type { Jump } from './nav'

/**
 * 수집 → 생성 → 활용 — ⑭ 데이터 목록의 아랫부분.
 *
 * 수집 항목만 적으면 절반이다. 시스템이 **만들어 내는 것**과 그것이 **나가는 곳**까지 세야
 * 「이 시스템이 다루는 데이터」가 다 적힌다.
 *
 * 생성 데이터가 수집 데이터보다 위험하다 — 수집값은 틀리면 센서를 고치면 되지만
 * **생성값은 틀려도 그럴듯해 보인다.** 그래서 생성물마다 출처·방법·신뢰도를 함께 보인다.
 */
export default function FlowStages({ jump }: { jump: Jump }) {
  const [stage, setStage] = useState<'수집' | '생성' | '활용'>('생성')
  const st = flowStats()

  return (
    <Panel
      title="수집 → 생성 → 활용 — 이 시스템이 다루는 데이터 전부"
      right={<span className="text-[11px] text-gray-500">합계 {st.total}종</span>}
    >
      <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
        수집 항목만 적으면 절반입니다. 시스템이 <b className="text-gray-200">만들어 내는 것</b>과 그것이{' '}
        <b className="text-gray-200">나가는 곳</b>까지 세야 「이 시스템이 다루는 데이터」가 다 적힙니다. 실무에서 사고가 나는 자리도 대개
        뒤쪽입니다 — 「원본은 5년인데 그걸로 만든 분석셋은 몇 년인가」, 「이 지표를 누가 어디서 보나」.
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ['수집', st.collected, st.collectedLive, '차량과 외부에서 들어온다', '#38bdf8'],
            ['생성', st.produced, st.producedLive, '시스템이 만들어 낸다', '#f472b6'],
            ['활용', st.consumers, st.consumersLive, '화면·파일·연계로 나간다', '#34d399'],
          ] as const
        ).map(([k, n, live, sub, c]) => {
          const on = stage === k
          return (
            <button
              key={k}
              onClick={() => setStage(k as '수집' | '생성' | '활용')}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                on ? '' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
              }`}
              style={on ? { borderColor: `${c}88`, background: `${c}14` } : undefined}
            >
              <div className="text-xl font-black tabular-nums" style={{ color: ink(c)}}>
                {n}
                <span className="ml-1 text-[11px] font-bold text-gray-500">종</span>
              </div>
              <div className="mt-0.5 text-[12.5px] font-bold text-gray-200">{k}</div>
              <div className="text-[11px] text-gray-600">{sub}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: ink(c)}}>
                지금 도는 것 {live}
              </div>
            </button>
          )
        })}
      </div>

      {stage === '수집' && (
        <div className="mt-3">
          <div className="mb-2 break-keep text-[12px] leading-relaxed text-gray-400">
            계통 {BUSES.length}개 · 항목 {st.collected}종. 자세한 표는 <b className="text-gray-200">③ 국제 표준 → 수집 항목</b>에 있습니다.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BUSES.map((b) => {
              const n = CHANNELS.filter((c) => c.bus === b).length
              const live = CHANNELS.filter((c) => c.bus === b && c.intake === '수집·연결').length
              return (
                <button
                  key={b}
                  onClick={() => jump('standards')}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1.5 text-left transition-colors hover:border-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span className="text-[12px] font-bold text-gray-200">{b}</span>
                  <span className="ml-1.5 text-[11px] tabular-nums text-gray-500">{n}</span>
                  {live > 0 && (
                    <span className="ml-1 rounded px-1 py-px text-[10px] font-black" style={{ color: ink(INTAKE_TONE['수집·연결']), background: `${INTAKE_TONE['수집·연결']}1a` }}>
                      연결 {live}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {stage === '생성' && (
        <div className="mt-3">
          <div className="mb-2 rounded-lg border px-3 py-2 break-keep text-[12px] leading-relaxed text-rose-300" style={{ borderColor: '#f43f5e33', background: '#f43f5e0d' }}>
            <b>생성 데이터가 수집 데이터보다 위험합니다.</b> 수집값은 틀리면 센서를 고치면 되지만{' '}
            <b>생성값은 틀려도 그럴듯해 보입니다.</b> 그래서 항목마다 <b>어디서 왔고 · 어떻게 만들었고 · 얼마나 믿을 만한지</b>를 함께 적습니다. 이
            셋이 없는 생성값은 쓰면 안 됩니다.
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {st.byKind.map((k) => (
              <span key={k.k} className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ color: ink(KIND_TONE[k.k as ProducedKind]), background: `${KIND_TONE[k.k as ProducedKind]}1a` }}>
                {k.k} {k.n}
                <span className="ml-1 opacity-70">({k.live} 작동)</span>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-[12px]">
              <thead className="text-[11px] text-gray-500">
                <tr className="border-b border-gray-800">
                  <th className="py-2 pr-3 font-semibold">생성물</th>
                  <th className="py-2 pr-3 font-semibold">무엇에서</th>
                  <th className="py-2 pr-3 font-semibold">어떻게</th>
                  <th className="py-2 pr-3 font-semibold">신뢰도</th>
                  <th className="py-2 pr-3 font-semibold">보존</th>
                  <th className="py-2 pr-3 font-semibold">주의</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCED.map((p) => (
                  <tr key={p.id} className={`border-b border-gray-800/60 align-top ${p.live ? '' : 'bg-amber-400/[0.04]'}`}>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-gray-100">{p.ko}</span>
                        {!p.live && <span className="rounded bg-amber-400/15 px-1 py-px text-[9.5px] font-black text-amber-300">아직</span>}
                      </div>
                      <span className="rounded px-1 py-px text-[10px] font-black" style={{ color: ink(KIND_TONE[p.kind]), background: `${KIND_TONE[p.kind]}1a` }}>
                        {p.kind}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 break-keep text-[11.5px] text-gray-400">{p.from}</td>
                    <td className="py-1.5 pr-3 text-[11.5px] text-gray-500">{p.method}</td>
                    <td className="py-1.5 pr-3">
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ color: ink(CONF_TONE[p.conf]), background: `${CONF_TONE[p.conf]}1a` }}>
                        {p.conf}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-[11.5px] tabular-nums text-gray-500">{p.keep}</td>
                    <td className="py-1.5 pr-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
                      <Emph t={p.note} cls="text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stage === '활용' && (
        <div className="mt-3">
          <div className="mb-2 break-keep text-[12px] leading-relaxed text-gray-400">
            활용처를 적으면 <b className="text-gray-200">파급이 보입니다.</b> 「이 값을 고치면 어디가 흔들리나」는 이 목록이 있어야 답합니다 — ⑦
            영향 분석이 하는 일을 데이터 단위로 미리 적어 두는 것입니다.
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {st.byConsumer.map((k) => (
              <span key={k.k} className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[11px] font-bold text-gray-300">
                {k.k} {k.n}
                <span className="ml-1 text-emerald-400">({k.live} 작동)</span>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-[12px]">
              <thead className="text-[11px] text-gray-500">
                <tr className="border-b border-gray-800">
                  <th className="py-2 pr-3 font-semibold">활용처</th>
                  <th className="py-2 pr-3 font-semibold">종류</th>
                  <th className="py-2 pr-3 font-semibold">누가 보나</th>
                  <th className="py-2 pr-3 font-semibold">주기</th>
                  <th className="py-2 pr-3 font-semibold">무엇을 쓰나</th>
                  <th className="py-2 pr-3 font-semibold">주의</th>
                </tr>
              </thead>
              <tbody>
                {CONSUMERS.map((c) => (
                  <tr key={c.id} className={`border-b border-gray-800/60 align-top ${c.live ? '' : 'bg-gray-800/20'}`}>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-gray-100">{c.ko}</span>
                        {!c.live && <span className="rounded bg-gray-700/50 px-1 py-px text-[9.5px] font-black text-gray-400">실서비스</span>}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-[11.5px] text-gray-500">{c.kind as ConsumerKind}</td>
                    <td className="py-1.5 pr-3 text-[11.5px] text-gray-400">{c.who}</td>
                    <td className="py-1.5 pr-3 text-[11.5px] text-gray-500">{c.cycle}</td>
                    <td className="py-1.5 pr-3 break-keep text-[11.5px] text-gray-400">{c.uses}</td>
                    <td className="py-1.5 pr-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
                      <Emph t={c.note} cls="text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d' }}>
          <div className="text-[12px] font-black text-violet-300">AI 산출은 판정이 아니라 초안입니다</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            민원 증빙 자동매칭·수요 예측·코칭 문구는 모두 모델이 만든 값입니다. 신뢰도 상한이 <b className="text-gray-200">추정 70% · 정성 50%</b>
            이고, <b className="text-gray-200">사람이 확정해야 효력이 생깁니다.</b> 특히 코칭 문구는 표현이 사람을 다치게 할 수 있어 결핍·비난이
            아니라 지원 표현으로 씁니다.
          </div>
        </div>
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#38bdf833', background: '#38bdf80d' }}>
          <div className="text-[12px] font-black text-sky-300">보존 기간이 생성물마다 다릅니다</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            정산·배출 근거는 <b className="text-gray-200">5년</b>, 개정 이력과 유효 구간은 <b className="text-gray-200">영구</b>, 실시간 판정은{' '}
            <b className="text-gray-200">1년</b>입니다. 검증 스탬프는 <b className="text-gray-200">원본과 동일</b>하게 갑니다 — 스탬프만 먼저
            지우면 「어느 규칙으로 검증했나」를 잃습니다.
          </div>
        </div>
      </div>
    </Panel>
  )
}
