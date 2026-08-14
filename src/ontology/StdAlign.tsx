import { useState } from 'react'
import { Panel } from '../components/ui'
import { META_EDGES, SPACES, spaceOf } from './meta'
import { MATCH_LABEL, REL_META, SPACE_ALIGN, STANDARDS, TYPE_ALIGN, alignStats, stdOf, type MatchLevel } from './standards'

/**
 * ③ 표준 정렬 — 우리 어휘가 국제 표준의 어디에 붙는가.
 * 정렬 강도를 억지로 exact로 올리지 않는 것이 이 화면의 정직성이다.
 */

const TABS = ['스페이스', '노드 타입', '관계'] as const
type Tab = (typeof TABS)[number]

export default function Standards() {
  const [tab, setTab] = useState<Tab>('스페이스')
  const [openStd, setOpenStd] = useState<string | null>('prov')
  const st = alignStats()
  const std = openStd ? stdOf(openStd) : null

  return (
    <div className="space-y-3">
      <Panel
        title="정렬 현황 — 우리 어휘는 얼마나 표준 위에 서 있나"
        right={<span className="text-[11px] text-gray-500">표준 {STANDARDS.length}종</span>}
      >
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
          <Stat n={`${st.spaceAligned}/${SPACES.length}`} label="스페이스 정렬" sub="9개 전부 표준 대응" color="#a78bfa" />
          <Stat n={`${st.typeAligned}/${st.totalTypes}`} label="노드 타입 정렬" sub="핵심 타입 우선" color="#34d399" />
          <Stat n={`${st.aligned}/${st.rels}`} label="관계 정렬" sub="인과 어휘는 표준이 없다" color="#38bdf8" />
          <Stat n={`${STANDARDS.length}`} label="참조 표준" sub="W3C · OGC · CEN · 국내 법정" color="#fb7185" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['exact', 'close', 'broad', 'narrow'] as MatchLevel[]).map((m) => {
            const n = st.byMatch.find((x) => x.m === m)?.n ?? 0
            return (
              <span key={m} className={`rounded-md border border-gray-800 bg-gray-900/60 px-2 py-1 text-[11px] font-bold ${MATCH_LABEL[m].tone}`}>
                {MATCH_LABEL[m].ko} {n}건
                <span className="ml-1 font-mono text-[9.5px] text-gray-600">{MATCH_LABEL[m].skos}</span>
              </span>
            )
          })}
        </div>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          정렬 강도는 <b className="text-gray-300">SKOS 매핑 관계를 그대로</b> 씁니다. 억지로 «정확 일치»를 주장하지 않는 것이 이 표의 값어치입니다 —
          «상위 개념»이라고 정직하게 적어야 나중에 합칠 때 사고가 나지 않습니다. 조치→성과의 인과 어휘(올린다·낮춘다)는 대응하는 표준이 없어
          <b className="text-gray-300"> 고유</b>로 둡니다.
        </div>
      </Panel>

      <Panel title="참조 표준" right={<span className="text-[11px] text-gray-500">누르면 왜 필요한지</span>}>
        <div className="grid grid-cols-5 gap-2 max-[1100px]:grid-cols-3 max-[720px]:grid-cols-2">
          {STANDARDS.map((s) => {
            const on = openStd === s.key
            return (
              <button
                key={s.key}
                onClick={() => setOpenStd(s.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-sky-400/60 bg-sky-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <code className={`text-[11px] font-bold ${on ? 'text-sky-300' : 'text-gray-500'}`}>{s.prefix}:</code>
                <div className={`mt-0.5 break-keep text-[12px] font-bold leading-tight ${on ? 'text-gray-50' : 'text-gray-300'}`}>{s.ko}</div>
                <div className="mt-0.5 text-[10px] text-gray-600">{s.org}</div>
              </button>
            )
          })}
        </div>
        {std && (
          <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[13px] font-black text-sky-300">{std.ko}</span>
              <code className="text-[10.5px] text-gray-500">{std.uri}</code>
            </div>
            <div className="mt-1.5 break-keep text-[11.5px] leading-relaxed text-gray-300">
              <b className="text-gray-400">무엇을 정의하나</b> — {std.what}
            </div>
            <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-200">
              <b className="text-sky-300">왜 우리에게 필요한가</b> — {std.why}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="정렬 표"
        right={
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                  tab === t ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] text-gray-500">
                <th className="py-2 pr-3 font-semibold">우리 어휘</th>
                {tab === '관계' && <th className="py-2 pr-3 font-semibold">카디널리티</th>}
                <th className="py-2 pr-3 font-semibold">표준 어휘</th>
                <th className="py-2 pr-3 font-semibold">정렬 강도</th>
                <th className="py-2 font-semibold">비고</th>
              </tr>
            </thead>
            <tbody>
              {tab === '스페이스' &&
                SPACES.map((s) =>
                  SPACE_ALIGN[s.id].map((a, i) => (
                    <tr key={`${s.id}-${i}`} className="border-b border-gray-800/60">
                      <td className="py-2 pr-3">
                        {i === 0 && (
                          <span className="font-bold" style={{ color: s.color }}>
                            {s.ko}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-[11.5px] text-gray-200">{a.term}</code>
                        <span className="ml-1.5 text-[10px] text-gray-600">{stdOf(a.std)?.org}</span>
                      </td>
                      <Match m={a.match} />
                      <td className="py-2 break-keep text-gray-500">{a.note ?? MATCH_LABEL[a.match].why}</td>
                    </tr>
                  )),
                )}

              {tab === '노드 타입' &&
                Object.entries(TYPE_ALIGN).map(([type, aligns]) => {
                  const sp = SPACES.find((s) => s.types.some((t) => t.en.replace(/[^A-Za-z0-9]/g, '') === type))
                  const ko = sp?.types.find((t) => t.en.replace(/[^A-Za-z0-9]/g, '') === type)?.ko ?? type
                  return aligns.map((a, i) => (
                    <tr key={`${type}-${i}`} className="border-b border-gray-800/60">
                      <td className="py-2 pr-3">
                        {i === 0 && (
                          <>
                            <span className="font-bold text-gray-100">{ko}</span>
                            <code className="ml-1.5 text-[10px] text-gray-600">{type}</code>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-[11.5px] text-gray-200">{a.term}</code>
                      </td>
                      <Match m={a.match} />
                      <td className="py-2 break-keep text-gray-500">{a.note ?? MATCH_LABEL[a.match].why}</td>
                    </tr>
                  ))
                })}

              {tab === '관계' &&
                META_EDGES.flatMap((e) =>
                  e.relations.map((r) => {
                    const m = REL_META[r]
                    return (
                      <tr key={`${e.from}-${e.to}-${r}`} className="border-b border-gray-800/60">
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-bold text-gray-100">{r}</span>
                            {m.required && <span className="rounded bg-red-500/15 px-1 py-0.5 text-[9.5px] font-bold text-red-400">필수</span>}
                          </div>
                          <div className="text-[10px] text-gray-600">
                            {spaceOf(e.from).ko} → {spaceOf(e.to).ko} · 역 {m.inverse}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <code className="rounded bg-gray-800 px-1.5 py-0.5 text-[10.5px] font-bold text-gray-300">{m.card}</code>
                        </td>
                        <td className="py-2 pr-3">
                          {m.align ? <code className="text-[11.5px] text-gray-200">{m.align.term}</code> : <span className="text-[11px] text-gray-600">—</span>}
                        </td>
                        <Match m={m.align?.match ?? 'none'} />
                        <td className="py-2 break-keep text-gray-500">
                          {m.align?.note ?? (m.align ? MATCH_LABEL[m.align.match].why : '인과·권한 어휘는 표준이 없어 고유로 둔다')}
                        </td>
                      </tr>
                    )
                  }),
                )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-300">
        <b className="text-emerald-400">왜 정렬이 문법보다 중요할 수 있나</b> — 문법을 아무리 잘 만들어도 우리만 쓰면 반쪽입니다. 관측이
        <code className="mx-1 text-gray-200">sosa:Observation</code>이고 판정이 <code className="mx-1 text-gray-200">prov:wasDerivedFrom</code>으로 근거에
        매달려 있으면, 다른 도시가 만든 데이터도·검증기관의 도구도 우리 그래프를 그대로 읽습니다. 참고한 OpenCrab에는 이 정렬 층이 없습니다 —
        자체 문법만 있고 외부 표준과의 대응이 없어, 그 자체로는 밖으로 나가지 못합니다.
      </div>
    </div>
  )
}

function Match({ m }: { m: MatchLevel }) {
  const L = MATCH_LABEL[m]
  return (
    <td className="py-2 pr-3">
      <span className={`whitespace-nowrap rounded bg-gray-800/70 px-1.5 py-0.5 text-[10.5px] font-bold ${L.tone}`}>{L.ko}</span>
    </td>
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
