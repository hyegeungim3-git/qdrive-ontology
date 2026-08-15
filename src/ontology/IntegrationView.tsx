import { useState } from 'react'
import { Emph, Panel } from '../components/ui'
import { GIVES_TONE, INTEGRATIONS, ORG_KINDS, STATUS_TONE, integrationStats, type Gives, type OrgKind } from './integrations'

/**
 * 연계 시스템 — ⓪ 시작하기의 「어디서 데이터를 받나」.
 *
 * 흐름도의 «들어오는 데이터»가 DTG·GTFS·BIS 셋으로만 보이면 «차량에서만 온다»로 읽힌다.
 * 실제로는 노선망은 국가표준노드링크, 날씨는 기상청, 충전은 충전사업자, 차령은 자동차등록정보가 준다.
 *
 * **이 표에서 가장 중요한 칸은 «무엇을 주나»다.** 밖에서 오는 값이 우리가 검증할 원천 관측인지,
 * 이미 남이 낸 결론인지, 사실로 받아들이는 기준 정보인지에 따라 취급이 완전히 달라진다.
 */
export default function IntegrationView() {
  const [kind, setKind] = useState<OrgKind | '전체'>('전체')
  const st = integrationStats()
  const rows = INTEGRATIONS.filter((x) => kind === '전체' || x.kind === kind)

  return (
    <Panel
      title="어디서 데이터를 받나 — 차량에서만 오지 않습니다"
      right={<span className="text-[11px] text-gray-500">기관 {st.orgs}곳 · 연계 {st.total}건</span>}
    >
      <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
        노선망은 <b className="text-gray-200">국가표준노드링크</b>, 날씨는 <b className="text-gray-200">기상청</b>, 충전 이력은{' '}
        <b className="text-gray-200">충전사업자</b>, 차령은 <b className="text-gray-200">자동차등록정보</b>가 줍니다. 차량 단말만으로는 절반도
        못 채웁니다.
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 max-[820px]:grid-cols-2">
        {[
          { n: String(st.total), ko: '연계처', sub: `기관 ${st.orgs}곳`, c: '#e5e7eb' },
          { n: String(st.linked), ko: '연동됨', sub: '지금 받고 있다', c: STATUS_TONE['연동됨'] },
          { n: String(st.planned), ko: '연동 예정', sub: '규격은 정해져 있다', c: STATUS_TONE['연동 예정'] },
          { n: String(st.outbound), ko: '밖으로 나감', sub: '규정이 다시 걸린다', c: '#f472b6' },
        ].map((k) => (
          <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
            <div className="text-xl font-black tabular-nums" style={{ color: k.c }}>
              {k.n}
            </div>
            <div className="mt-0.5 text-[12px] font-bold text-gray-300">{k.ko}</div>
            <div className="text-[11px] text-gray-600">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border px-3 py-2.5 break-keep text-[12px] leading-relaxed" style={{ borderColor: '#fbbf2433', background: '#fbbf240d', color: '#fde68a' }}>
        <b>밖에서 오는 값이 «원천»인지 «남이 만든 판정»인지 구분해야 합니다.</b> 교통카드 정산이 주는 승하차 수치는 우리가 관측한 것이 아니라{' '}
        <b>이미 남이 집계한 값</b>입니다. 그런 값을 우리 관측처럼 다루면 «누가 만든 숫자인지»를 잃습니다 — 받은 값에는{' '}
        <b>만든 주체가 함께 따라와야</b> 합니다.
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {st.byGives.map((g) => (
          <span key={g.g} className="rounded px-1.5 py-0.5 text-[11.5px] font-bold" style={{ color: GIVES_TONE[g.g as Gives], background: `${GIVES_TONE[g.g as Gives]}1a` }}>
            {g.g} {g.n}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(['전체', ...ORG_KINDS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k as OrgKind | '전체')}
            className={`rounded-md px-2 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
              kind === k ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {k}
            <span className="ml-1 text-[10px] text-gray-600">{k === '전체' ? INTEGRATIONS.length : INTEGRATIONS.filter((x) => x.kind === k).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="text-[11px] text-gray-500">
            <tr className="border-b border-gray-800">
              <th className="py-2 pr-3 font-semibold">연계처</th>
              <th className="py-2 pr-3 font-semibold">무엇을 주나</th>
              <th className="py-2 pr-3 font-semibold">방향</th>
              <th className="py-2 pr-3 font-semibold">내용</th>
              <th className="py-2 pr-3 font-semibold">형식</th>
              <th className="py-2 pr-3 font-semibold">상태 · 주의</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-b border-gray-800/60 align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-bold text-gray-100">{x.ko}</div>
                  <div className="text-[10.5px] text-gray-600">{x.org}</div>
                </td>
                <td className="py-1.5 pr-3">
                  <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-black" style={{ color: GIVES_TONE[x.gives], background: `${GIVES_TONE[x.gives]}1a` }}>
                    {x.gives}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-[11.5px] text-gray-400">{x.dir}</td>
                <td className="py-1.5 pr-3 break-keep text-[11.5px] text-gray-400">{x.what}</td>
                <td className="py-1.5 pr-3 text-[11px] text-gray-600">{x.how}</td>
                <td className="py-1.5 pr-3">
                  <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: STATUS_TONE[x.status], background: `${STATUS_TONE[x.status]}1a` }}>
                    {x.status}
                  </span>
                  <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-500">
                    <Emph t={x.note} cls="text-gray-300" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#f472b633', background: '#f472b60d' }}>
          <div className="text-[12px] font-black text-pink-300">나가는 연계에는 규정이 다시 걸립니다</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            연계는 받기만 하는 게 아닙니다. BIS에 위치를 <b className="text-gray-200">주고</b>, 국토부에 운행기록을{' '}
            <b className="text-gray-200">제출</b>하고, 보험사에 운전 데이터를 <b className="text-gray-200">제공</b>할 수도 있습니다. 특히 보험
            요율에 쓰이면 <b className="text-gray-200">기사에게 불이익</b>이 되므로 제공 범위에 별도 동의가 필요합니다.
          </div>
        </div>
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#38bdf833', background: '#38bdf80d' }}>
          <div className="text-[12px] font-black text-sky-300">가장 크게 비어 있는 곳은 «운행 계획»입니다</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            시각표·계획 운행횟수·결행은 <b className="text-gray-200">운수사 배차 시스템</b>에 있습니다. 센서가 아니라{' '}
            <b className="text-gray-200">사내 시스템 연계</b>가 필요한 것이고, 정시율·결행·첫막차·공차가 전부 이것 하나에 걸려 있습니다.
          </div>
        </div>
      </div>
    </Panel>
  )
}
