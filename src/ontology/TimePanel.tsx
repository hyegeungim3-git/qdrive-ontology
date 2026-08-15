import { Panel } from '../components/ui'
import { META_EDGES } from './meta'
import { REL_META } from './standards'
import { useGate } from './gate'
import { POLICY_VALIDITY, SHIFT_SEC, TEMPORAL, TIMELESS, clock, isTemporal, policyActive, shiftAt, untilActive } from './validity'

/**
 * 시간 유효성 — ② 관계 문법의 아랫부분.
 *
 * 이 화면의 요점은 «모든 관계에 시간을 붙였다»가 아니라 **어떤 관계가 시간을 갖고 어떤 관계는
 * 안 갖는지, 그리고 왜인지**를 말하는 것이다. 전부 붙이면 그래프만 부풀고 아무것도 더 답하지 못한다.
 *
 * 그리고 규정의 시행 여부는 **말이 아니라 동작으로** 보인다 — 미시행 규정은 그래프에 관계를
 * 만들지 않고 SHACL 제약도 생성되지 않는다. 시각이 시행일을 지나면 그때부터 실제로 막힌다.
 */
export default function TimePanel() {
  const gate = useGate()
  const at = gate.at
  const sh = shiftAt(at)
  const rels = [...new Set(META_EDGES.flatMap((e) => e.relations))]
  const temporal = rels.filter(isTemporal)
  const timeless = rels.filter((r) => !isTemporal(r))

  return (
    <div className="space-y-3">
      <Panel
        title="시간 유효성 — 언제부터 언제까지 성립하는 관계인가"
        right={
          <span className="text-[11px] text-gray-500">
            지금 {clock(at)} · {sh.n}교대
          </span>
        }
      >
        <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
          여기까지 그래프의 모든 관계는 «항상 참»이었습니다. 그러면 <b className="text-gray-200">「3월에는 누가 몰았나」</b>와{' '}
          <b className="text-gray-200">「이 판정이 났을 때 그 규정이 이미 있었나」</b>에 답할 수 없습니다.
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 max-[820px]:grid-cols-1">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <div className="text-[11px] font-black text-sky-300">유효 시간 — 현실에서 언제 참인가</div>
            <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">
              여기서 새로 넣은 것. 배정 구간, 규정 시행일, 권한 부여 기간.
            </div>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <div className="text-[11px] font-black text-emerald-300">기록 시간 — 우리가 언제 알았나</div>
            <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">
              이미 갖고 있습니다 — 검증 스탬프(어느 문법으로)와 실행 리니지(prov:Activity). 둘을 함께 가지면{' '}
              <b className="text-gray-300">이중 시간</b>이 됩니다.
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          <div>
            <div className="mb-1 text-[11px] font-black tracking-wide text-sky-300">시간을 갖는 관계 {temporal.length}종</div>
            <div className="space-y-1">
              {temporal.map((r) => (
                <div key={r} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: '#38bdf833', background: '#38bdf80d' }}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11.5px] font-bold text-gray-100">{r}</span>
                    <span className="font-mono text-[9.5px] text-gray-600">{REL_META[r]?.en}</span>
                  </div>
                  <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{TEMPORAL[r]}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-black tracking-wide text-gray-400">시간을 갖지 않는 관계 — 왜 없는지가 더 중요합니다</div>
            <div className="space-y-1">
              {timeless
                .filter((r) => TIMELESS[r])
                .map((r) => (
                  <div key={r} className="rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11.5px] font-bold text-gray-300">{r}</span>
                      <span className="font-mono text-[9.5px] text-gray-600">{REL_META[r]?.en}</span>
                    </div>
                    <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{TIMELESS[r]}</div>
                  </div>
                ))}
              <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d' }}>
                <div className="break-keep text-[10.5px] leading-relaxed text-gray-400">
                  <b className="text-violet-300">인과 관계는 사후에 바뀌지 않습니다.</b> 「이 관측이 이 판정을 뒷받침했다」는 나중에 거짓이 되지
                  않습니다 — 바뀌는 것은 판정이지 관계가 아닙니다. 나머지 {timeless.length - Object.keys(TIMELESS).filter((r) => timeless.includes(r)).length}
                  종도 같은 이유로 시간을 갖지 않습니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="규정 시행일 — 미시행 규정은 아무것도 막지 않습니다"
        right={<span className="text-[11px] text-gray-500">시행 중 {POLICY_VALIDITY.filter((p) => policyActive(p.id, at)).length}/{POLICY_VALIDITY.length}</span>}
      >
        <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
          「시행 예정이라 아직 적용되지 않습니다」를 <b className="text-gray-200">화면 문구로만</b> 적으면 그것은 연극입니다. 미시행 규정은 그래프에
          관계를 만들지 않고 <b className="text-gray-200">SHACL 제약도 생성되지 않습니다</b> — 시각이 시행일을 지나면 그때부터 실제로 막힙니다.
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11.5px]">
            <thead className="text-[10.5px] text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="py-2 pr-3 font-semibold">규정</th>
                <th className="py-2 pr-3 font-semibold">시행</th>
                <th className="py-2 pr-3 font-semibold">상태</th>
                <th className="py-2 pr-3 font-semibold">근거</th>
              </tr>
            </thead>
            <tbody>
              {POLICY_VALIDITY.map((p) => {
                const on = policyActive(p.id, at)
                const left = untilActive(p.id, at)
                return (
                  <tr key={p.id} className={`border-b border-gray-800/60 align-top ${on ? '' : 'bg-amber-400/[0.05]'}`}>
                    <td className="py-1.5 pr-3 font-bold text-gray-100">{p.ko}</td>
                    <td className="py-1.5 pr-3 font-mono text-[10.5px] tabular-nums text-gray-400">{clock(p.from)}</td>
                    <td className="py-1.5 pr-3">
                      {on ? (
                        <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-black text-emerald-300">시행 중</span>
                      ) : (
                        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                          시행 예정 · {left}초 남음
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 break-keep text-[10.5px] leading-relaxed text-gray-500">{p.basis}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {POLICY_VALIDITY.some((p) => !policyActive(p.id, at)) ? (
          <div className="mt-2 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed" style={{ borderColor: '#f59e0b44', background: '#f59e0b12', color: '#fcd34d' }}>
            ⚠ <b>「불이익 결정 자동화 금지」가 아직 시행 전입니다.</b> 지금 ⑨ 실검증에서 「감점 자동 확정」 결함을 켜도{' '}
            <b>걸리지 않습니다</b> — 규칙 자체가 생성되지 않았기 때문입니다. 배속을 올려 시행 시각을 지나면 같은 결함이 걸리기 시작합니다.
          </div>
        ) : (
          <div className="mt-2 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed" style={{ borderColor: '#34d39944', background: '#34d39912', color: '#6ee7b7' }}>
            ✅ <b>규정 5종이 모두 시행 중입니다.</b> 「불이익 결정 자동화 금지」는 {clock(1800)}에 시행됐고, 그때부터 SHACL 제약이 생성돼
            감점 자동 확정을 막습니다. <b>발행은 소급하지 않듯 시행도 소급하지 않습니다</b> — 시행 전 레코드는 그 규칙으로 검사되지 않았습니다.
          </div>
        )}
      </Panel>

      <Panel title="배정 구간 — 「지금 누가 모나」와 「그때 누가 몰았나」는 다른 질문">
        <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
          기사 배정에 기간을 붙였습니다. 엔진이 주는 배정을 바꾸지 않고 <b className="text-gray-200">그 배정이 언제까지 유효한지</b>만 그래프에
          적습니다. 교대 길이는 시뮬레이션 {SHIFT_SEC}초입니다.
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[12px] font-bold text-sky-200">
            {sh.n}교대 · {clock(sh.from)} ~ {clock(sh.to)}
          </span>
          <span className="text-[11px] text-gray-500">
            다음 교대까지 <b className="tabular-nums text-gray-300">{Math.max(0, Math.round(sh.to - at))}</b>초
          </span>
        </div>
        <div className="mt-2 break-keep text-[10.5px] leading-relaxed text-gray-500">
          그래프에 <span className="font-mono text-gray-400">qd:Validity</span> 노드로 들어가 있습니다 —{' '}
          <span className="font-mono text-gray-400">onRelation «운전한다»</span> ·{' '}
          <span className="font-mono text-gray-400">validFrom / validTo</span>. OWL-Time의 <span className="font-mono text-gray-400">time:Interval</span>에
          맞춰 정렬했습니다. 유효 구간은 도메인 인스턴스가 아니라 <b className="text-gray-400">관계에 대한 메타데이터</b>라서 규정 스페이스에
          두었습니다 — 보존 기간이 이미 시간 규칙인 것과 같은 자리입니다. 실서비스에서는 RDF-star나 named graph로 갑니다.
        </div>
      </Panel>
    </div>
  )
}
