import { useMemo, useState } from 'react'
import { Panel } from '../components/ui'
import { buildCatalog, catalogGaps, catalogStats, type Dataset } from './catalog'
import { useGate } from './gate'
import { simIso, useLineage } from './lineage'
import { roleOf, useRole, type RoleId } from './policy'
import type { Jump } from './nav'

/**
 * ⑭ 데이터 카탈로그 · 리니지 — 「AI가 받아 쓸 수 있는 상태인가」.
 *
 * 화면을 셋으로 나눴다.
 *  1) **목록** — 무엇이 있나. 건수·통과율·연결 수를 실그래프에서.
 *  2) **상세** — 스키마(단위 포함)·상류·하류·접근 권한·표준 정렬.
 *  3) **실행 리니지** — 게이트가 언제 몇 번 돌았나. 신선도의 근거.
 *
 * 카탈로그에서 가장 중요한 칸은 **비어 있는 칸**이다 — 0건인 데이터셋, 스키마 없는 데이터셋,
 * 연결이 하나도 없는 데이터셋. 그래서 「빈칸」 패널을 접지 않고 항상 보이게 뒀다.
 */
export default function Catalog({ jump }: { jump: Jump }) {
  const gate = useGate()
  const runs = useLineage()
  const role = useRole()
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'전체' | '데이터 있음' | '빈 데이터셋'>('전체')

  const list = useMemo(() => buildCatalog(gate), [gate])
  const stats = useMemo(() => catalogStats(list), [list, runs])
  const gaps = useMemo(() => catalogGaps(list), [list])

  const shown = list.filter((d) => (filter === '전체' ? true : filter === '데이터 있음' ? d.rows > 0 : d.rows === 0))
  const open = list.find((d) => d.id === openId) ?? null

  if (!gate.graph.triples) {
    return (
      <Panel title="데이터 카탈로그">
        <div className="break-keep text-[12px] leading-relaxed text-gray-400">
          아직 적재 게이트가 한 번도 돌지 않았습니다. 카탈로그는 <b className="text-gray-200">실행 결과에서 파생</b>되므로 잠시 뒤 채워집니다.
        </div>
      </Panel>
    )
  }

  return (
    <div className="space-y-3">
      <Panel
        title="데이터 카탈로그 — 무엇이 있고, 어디서 왔고, 누가 볼 수 있나"
        right={<span className="text-[11px] text-gray-500">전부 파생 — 손으로 적은 항목 0개</span>}
      >
        <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
          AI가 이 데이터를 쓰려면 먼저 <b className="text-gray-200">무엇이 있는지</b> 알아야 합니다. 이 카탈로그는 손으로 적지 않습니다 —
          스키마는 SHACL과 같은 정의에서, 건수·통과율은 게이트에서, 신선도는 실행 리니지에서, 접근 권한은 규정 스페이스에서 나옵니다.{' '}
          <b className="text-gray-300">손으로 적는 카탈로그는 반드시 낡습니다.</b>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2 max-[900px]:grid-cols-2">
          <Kpi n={`${stats.withData}/${stats.total}`} ko="데이터 있는 데이터셋" sub="정의 대비 실적재" color="#38bdf8" />
          <Kpi n={stats.rows.toLocaleString()} ko="레코드" sub="이번 스냅샷" color="#34d399" />
          <Kpi n={stats.links.toLocaleString()} ko="연결" sub="맥락의 양" color="#a78bfa" />
          <Kpi
            n={`${stats.unitCoverage.withUnit}/${stats.unitCoverage.numeric}`}
            ko="단위 표기"
            sub="수치 필드 중"
            color={stats.unitCoverage.withUnit === stats.unitCoverage.numeric ? '#34d399' : '#f59e0b'}
          />
          <Kpi n={String(stats.runs)} ko="적재 실행" sub={stats.lastRunAt ? stats.lastRunAt.slice(11, 19) : '없음'} color="#f472b6" />
        </div>

        {!!gaps.length && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[11px] font-black tracking-wide text-amber-400">카탈로그가 비어 있는 칸 — 이게 가장 중요한 정보입니다</div>
            {gaps.map((g) => (
              <div key={g.ko} className="rounded-lg border px-3 py-2" style={{ borderColor: '#f59e0b33', background: '#f59e0b0d' }}>
                <div className="text-[12px] font-bold text-amber-200">
                  {g.ko} <span className="tabular-nums">{g.n}</span>개
                </div>
                <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{g.why}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="데이터셋 목록"
        right={
          <div className="flex gap-1">
            {(['전체', '데이터 있음', '빈 데이터셋'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  filter === f ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[11.5px]">
            <thead className="text-[10.5px] text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="py-2 pr-3 font-semibold">데이터셋</th>
                <th className="py-2 pr-3 font-semibold">스페이스</th>
                <th className="py-2 pr-3 text-right font-semibold">건수</th>
                <th className="py-2 pr-3 text-right font-semibold">통과율</th>
                <th className="py-2 pr-3 text-right font-semibold">필드</th>
                <th className="py-2 pr-3 text-right font-semibold">연결</th>
                <th className="py-2 pr-3 font-semibold">표준</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const links = d.upstream.reduce((n, x) => n + x.links, 0) + d.downstream.reduce((n, x) => n + x.links, 0)
                return (
                  <tr
                    key={d.id}
                    onClick={() => setOpenId(d.id === openId ? null : d.id)}
                    className={`cursor-pointer border-b border-gray-800/60 hover:bg-gray-800/40 ${d.id === openId ? 'bg-sky-500/[0.07]' : ''}`}
                  >
                    <td className="py-2 pr-3">
                      <span className="font-bold text-gray-100">{d.ko}</span>
                      {d.sensitive && <span className="ml-1 rounded bg-rose-400/15 px-1 py-px text-[9px] font-black text-rose-300">개인정보</span>}
                      <span className="ml-1.5 font-mono text-[10px] text-gray-600">{d.id}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-400">{d.spaceKo}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${d.rows ? 'text-gray-200' : 'text-gray-600'}`}>{d.rows}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {d.pass === null ? (
                        <span className="text-gray-600">미측정</span>
                      ) : (
                        <span style={{ color: d.pass === 100 ? '#34d399' : '#f59e0b' }}>{d.pass}%</span>
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${d.fields.length ? 'text-gray-300' : 'text-amber-400'}`}>{d.fields.length}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${links ? 'text-violet-300' : 'text-gray-600'}`}>{links}</td>
                    <td className="py-2 pr-3 text-[10.5px] text-gray-500">{d.align.length ? d.align.map((a) => a.term).join(', ') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[10.5px] text-gray-600">행을 누르면 스키마·리니지·접근 권한이 열립니다.</div>
      </Panel>

      {open && <Detail d={open} role={role} jump={jump} />}

      <Panel title="실행 리니지 — 신선도의 근거" right={<span className="text-[11px] text-gray-500">prov:Activity</span>}>
        <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
          17차에서 레코드마다 검증 스탬프를 붙였지만 스탬프는 <b className="text-gray-200">문법 버전</b>만 알았습니다. 이제 게이트 실행 한 번이{' '}
          <b className="text-gray-200">활동(prov:Activity)</b>으로 남고, 스탬프가 그 활동을 가리킵니다 — 「이 판정은 <b>어느 실행</b>이 만들었나」에
          답할 수 있습니다.
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11.5px]">
            <thead className="text-[10.5px] text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="py-2 pr-3 font-semibold">활동</th>
                <th className="py-2 pr-3 font-semibold">시각</th>
                <th className="py-2 pr-3 font-semibold">문법</th>
                <th className="py-2 pr-3 text-right font-semibold">입력 노드</th>
                <th className="py-2 pr-3 text-right font-semibold">통과</th>
                <th className="py-2 pr-3 text-right font-semibold">격리</th>
                <th className="py-2 pr-3 text-right font-semibold">소요</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b border-gray-800/60">
                  <td className="py-1.5 pr-3 font-mono text-[10.5px] text-sky-300">{r.id.replace('qdi:', '')}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10.5px] tabular-nums text-gray-400">{simIso(r.at).slice(11, 19)}</td>
                  <td className="py-1.5 pr-3 text-gray-300">{r.version}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-400">{r.used.nodes}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-400">{r.generated.passed}</td>
                  <td className={`py-1.5 pr-3 text-right tabular-nums ${r.generated.held ? 'text-rose-400' : 'text-gray-600'}`}>{r.generated.held}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">{r.ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 break-keep text-[10.5px] leading-relaxed text-gray-500">
          실행 횟수가 있다는 것 자체가 근거입니다 — <b className="text-gray-400">「격리 0건」이 검사를 안 한 결과인지</b>는 이 표를 봐야 갈립니다.
          실서비스에서는 이 이력이 OpenLineage 이벤트로 리니지 저장소에 쌓입니다.
        </div>
      </Panel>
    </div>
  )
}

function Detail({ d, role, jump }: { d: Dataset; role: RoleId; jump: Jump }) {
  const myDeny = d.denied.find((x) => x.role === role)
  return (
    <Panel
      title={`${d.ko} — 스키마 · 리니지 · 권한`}
      right={<span className="font-mono text-[11px] text-gray-500">{d.id}</span>}
    >
      {d.note && <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">{d.note}</div>}

      {myDeny && (
        <div className="mt-2 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed" style={{ borderColor: '#f43f5e44', background: '#f43f5e12', color: '#fda4af' }}>
          🔒 <b>«{roleOf(role).ko}» 역할은 이 데이터셋을 그대로 볼 수 없습니다</b> — {myDeny.why}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div>
          <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">스키마 — SHACL과 같은 정의</div>
          {d.fields.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-[11px]">
                <thead className="text-[10px] text-gray-500">
                  <tr className="border-b border-gray-800">
                    <th className="py-1.5 pr-2 font-semibold">필드</th>
                    <th className="py-1.5 pr-2 font-semibold">자료형</th>
                    <th className="py-1.5 pr-2 font-semibold">단위</th>
                    <th className="py-1.5 pr-2 font-semibold">범위 · 값</th>
                  </tr>
                </thead>
                <tbody>
                  {d.fields.map((f) => (
                    <tr key={f.name} className="border-b border-gray-800/60 align-top">
                      <td className="py-1.5 pr-2">
                        <span className="font-mono text-[10.5px] text-gray-200">{f.name}</span>
                        {f.required && <span className="ml-1 text-[9px] font-black text-rose-400">필수</span>}
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-[10px] text-gray-500">{f.datatype.replace('xsd:', '')}</td>
                      <td className="py-1.5 pr-2">
                        {f.unit ? (
                          <span className="rounded bg-emerald-400/15 px-1 py-px text-[10px] font-bold text-emerald-300">{f.unit}</span>
                        ) : (
                          <span className="text-[10px] text-gray-700">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 break-keep text-[10.5px] text-gray-500">
                        {f.oneOf ? f.oneOf.join(' · ') : f.min !== undefined || f.max !== undefined ? `${f.min ?? ''} ~ ${f.max ?? ''}` : f.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border px-3 py-2 break-keep text-[11px] leading-relaxed" style={{ borderColor: '#f59e0b33', background: '#f59e0b0d', color: '#fcd34d' }}>
              속성 스키마가 없습니다 — 노드는 만들어지는데 <b>값이 검사받지 않습니다</b>. 다음 개정 후보입니다.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">리니지 — 무엇에서 와서 무엇을 먹이나</div>
            <div className="space-y-1">
              <Lin label="상류" rows={d.upstream} color="#38bdf8" empty="들어오는 연결이 없습니다 — 원천에서 바로 만들어지는 데이터입니다" />
              <Lin label="하류" rows={d.downstream} color="#a78bfa" empty="나가는 연결이 없습니다 — 이 데이터는 아무것도 먹이지 않습니다" />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">품질 · 신선도</div>
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
              레코드 <b className="tabular-nums text-gray-200">{d.rows}</b>건 중 격리{' '}
              <b className="tabular-nums text-gray-200">{d.held}</b>건 ·{' '}
              {d.pass === null ? (
                <b className="text-gray-500">통과율 미측정(0건)</b>
              ) : (
                <>
                  통과율 <b className="tabular-nums" style={{ color: d.pass === 100 ? '#34d399' : '#f59e0b' }}>{d.pass}%</b>
                </>
              )}
              <div className="mt-1 text-[10.5px] text-gray-500">DQV의 품질 측정에 해당합니다 — 게이트가 실제로 돌린 결과입니다.</div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">접근 권한 — 규정 스페이스</div>
            <div className="flex flex-wrap gap-1">
              {d.readers.map((r) => (
                <span key={r} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-300">
                  {roleOf(r).ko}
                </span>
              ))}
              {d.denied.map((x) => (
                <span key={x.role} title={x.why} className="cursor-help rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-300">
                  {roleOf(x.role).ko} 제한
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => jump('live')}
          className="rounded-md border border-sky-500/40 bg-sky-500/12 px-3 py-1.5 text-[11.5px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ⑨ 이 규칙들이 실제로 도는지 보기 →
        </button>
        <button
          onClick={() => jump('export')}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-[11.5px] font-bold text-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ⑬ Croissant으로 내보내기 →
        </button>
      </div>
    </Panel>
  )
}

function Lin({ label, rows, color, empty }: { label: string; rows: { ko: string; rel: string; links: number }[]; color: string; empty: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
      <div className="text-[10px] font-black tracking-wide" style={{ color }}>
        {label}
      </div>
      {rows.length ? (
        <div className="mt-1 space-y-0.5">
          {rows.slice(0, 6).map((r, i) => (
            <div key={`${r.ko}-${r.rel}-${i}`} className="flex items-baseline gap-1.5 text-[11px]">
              <span className="font-bold text-gray-200">{r.ko}</span>
              <span className="text-[10px] text-gray-500">«{r.rel}»</span>
              <span className="ml-auto tabular-nums text-[10.5px] text-gray-400">{r.links}</span>
            </div>
          ))}
          {rows.length > 6 && <div className="text-[10px] text-gray-600">외 {rows.length - 6}종</div>}
        </div>
      ) : (
        <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-600">{empty}</div>
      )}
    </div>
  )
}

function Kpi({ n, ko, sub, color }: { n: string; ko: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
      <div className="text-xl font-black tabular-nums" style={{ color }}>
        {n}
      </div>
      <div className="mt-0.5 text-[11.5px] font-bold text-gray-300">{ko}</div>
      <div className="text-[10px] text-gray-600">{sub}</div>
    </div>
  )
}
