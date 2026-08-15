import { useMemo, useState } from 'react'
import { Panel } from '../components/ui'
import { ACTION_TYPES, ISSUE, checkAction, issueAction, passed, type Check } from './action'
import { useIssued, withdraw } from './issued'
import { useGate } from './gate'
import { can, denyReason, roleOf, useRole, visibleVehicles } from './policy'
import type { Jump } from './nav'
import type { SimSnapshot } from '../sim/types'

/**
 * 조치 발행 — ⑥ 조치 시뮬레이션의 뒷부분.
 *
 * 시뮬레이션은 «당기면 이만큼 오른다»까지다. 여기서 **실제로 당긴다.**
 * 다만 당기기 전에 온톨로지가 네 가지를 묻고, 하나라도 아니면 발행되지 않는다.
 * 그리고 발행된 조치는 **엔진이 만든 조치와 같은 자격으로 그래프에 들어간다** —
 * ⑤ 근거 사슬의 조치 칸에 나타나고, ⑨가 검사하고, ⑭ 카탈로그가 센다.
 *
 * 화면이 검사 결과를 숨기지 않는 것이 중요하다. 버튼만 흐려 두면 «왜 안 되는지»를 말할 수 없고,
 * 그러면 그 규칙은 사용자에게 «고장»으로 읽힌다.
 */
export default function IssuePanel({ snap, jump }: { snap: SimSnapshot; jump: Jump }) {
  const gate = useGate()
  const role = useRole()
  const issued = useIssued()
  const [actionId, setActionId] = useState(ACTION_TYPES[0].id)
  const [params, setParams] = useState<Record<string, string>>({})
  const [done, setDone] = useState<string | null>(null)

  const a = ACTION_TYPES.find((x) => x.id === actionId) ?? ACTION_TYPES[0]
  const vehicles = visibleVehicles(role, snap)
  const [vehicleId, setVehicleId] = useState<string>('')
  const veh = vehicleId && vehicles.some((v) => v.id === vehicleId) ? vehicleId : (vehicles[0]?.id ?? '')

  const checks = useMemo(
    () => (gate.graph.triples && veh ? checkAction(a, params, role, gate, veh) : []),
    [a, params, role, gate, veh],
  )
  const ok = checks.length > 0 && passed(checks)
  const mayIssue = can(role, ISSUE)

  const set = (k: string, v: string) => {
    setParams((p) => ({ ...p, [k]: v }))
    setDone(null)
  }

  const submit = () => {
    const r = issueAction(a, params, role, gate, veh)
    if (r.ok) {
      setDone(r.issued.iri)
      setParams({})
    }
  }

  return (
    <Panel
      title="조치 발행 — 시뮬레이션에서 멈추지 않는다"
      right={<span className="text-[11px] text-gray-500">발행 {issued.length}건</span>}
    >
      <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
        여기까지는 전부 <b className="text-gray-200">읽는 쪽</b>이었습니다. 사람이 실제로 코칭을 내리고 배차를 조정하는 순간에는 온톨로지가 아무
        역할도 하지 않았습니다. 이제 <b className="text-gray-200">쓰기 경로가 온톨로지를 통과합니다</b> — 문법·규정·스키마·근거 네 겹을 지나야
        발행되고, 발행된 조치는 엔진이 만든 조치와 <b className="text-gray-200">같은 자격으로 그래프에 들어갑니다</b>.
      </div>

      {!mayIssue && (
        <div className="mt-3 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed" style={{ borderColor: '#f59e0b55', background: '#f59e0b14', color: '#fcd34d' }}>
          🔒 <b>«{roleOf(role).ko}» 역할에는 조치 발행 권한이 없습니다</b> — {denyReason(role, ISSUE)} 아래에서 검사 결과는 볼 수 있지만 발행은
          잠깁니다.
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
        {ACTION_TYPES.map((x) => {
          const on = x.id === a.id
          return (
            <button
              key={x.id}
              onClick={() => {
                setActionId(x.id)
                setParams({})
                setDone(null)
              }}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                on ? 'border-amber-400/60 bg-amber-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className={`text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{x.ko}</span>
                {x.adverse && <span className="rounded bg-rose-400/15 px-1 py-px text-[9px] font-black text-rose-300">불이익 가능</span>}
              </div>
              <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{x.desc}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-600">
                {x.creates} —«{x.via}»→ 성과
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
        <div className="space-y-2">
          <div className="text-[11px] font-black tracking-wide text-gray-500">대상 · 입력</div>
          <label className="block">
            <span className="text-[10.5px] text-gray-500">대상 차량</span>
            <select
              value={veh}
              onChange={(e) => {
                setVehicleId(e.target.value)
                setDone(null)
              }}
              className="mt-0.5 w-full rounded-md border border-gray-800 bg-gray-900 px-2 py-1.5 text-[12px] text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </label>
          {a.params.map((p) => (
            <label key={p.key} className="block">
              <span className="text-[10.5px] text-gray-500">
                {p.ko}
                {p.required && <span className="ml-1 text-rose-400">필수</span>}
              </span>
              {p.kind === 'select' ? (
                <select
                  value={params[p.key] ?? ''}
                  onChange={(e) => set(p.key, e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-gray-800 bg-gray-900 px-2 py-1.5 text-[12px] text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <option value="">선택하세요</option>
                  {p.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={p.kind === 'number' ? 'number' : 'text'}
                  value={params[p.key] ?? ''}
                  onChange={(e) => set(p.key, e.target.value)}
                  placeholder={p.placeholder}
                  className="mt-0.5 w-full rounded-md border border-gray-800 bg-gray-900 px-2 py-1.5 text-[12px] text-gray-200 placeholder:text-gray-600 focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              )}
            </label>
          ))}
        </div>

        <div>
          <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">온톨로지 검사 — 넷 다 통과해야 발행됩니다</div>
          <div className="space-y-1">
            {checks.length ? (
              checks.map((c, i) => <Row key={`${c.source}-${i}`} c={c} />)
            ) : (
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-[11px] text-gray-500">
                적재 게이트가 돌면 검사가 시작됩니다.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={submit}
          disabled={!ok || !mayIssue}
          title={!mayIssue ? denyReason(role, ISSUE) : ok ? undefined : '검사를 통과하지 못했습니다'}
          className="rounded-md border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-[12px] font-bold text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ⚡ 이 조치를 발행
        </button>
        {done && (
          <span className="break-keep text-[11.5px] text-emerald-300">
            ✓ 발행됐습니다 — 그래프에 노드로 들어갔습니다. 3초 뒤 게이트가 이 노드를 검사합니다.
          </span>
        )}
        {!ok && checks.length > 0 && (
          <span className="text-[11px] text-gray-500">
            통과 {checks.filter((c) => c.ok).length}/{checks.length}
          </span>
        )}
      </div>

      {!!issued.length && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">발행 이력 — 그래프에 들어간 조치</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-[11.5px]">
              <thead className="text-[10.5px] text-gray-500">
                <tr className="border-b border-gray-800">
                  <th className="py-2 pr-3 font-semibold">조치</th>
                  <th className="py-2 pr-3 font-semibold">붙은 성과</th>
                  <th className="py-2 pr-3 font-semibold">발행자 · 승인자</th>
                  <th className="py-2 pr-3 font-semibold">활동</th>
                  <th className="py-2 pr-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {issued.map((x) => (
                  <tr key={x.iri} className="border-b border-gray-800/60 align-top">
                    <td className="py-1.5 pr-3">
                      <div className="font-bold text-gray-100">{x.label}</div>
                      <div className="font-mono text-[10px] text-gray-600">{x.creates}</div>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-400">
                      «{x.via}» {x.targetKo}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-400">
                      {x.byKo}
                      {x.approvedBy && <div className="text-[10.5px] text-emerald-400">승인 {x.approvedBy}</div>}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[10.5px] text-sky-300">
                      {x.runId.replace('qdi:', '')}
                      <div className="text-[10px] text-gray-600">{x.version}</div>
                    </td>
                    <td className="py-1.5 pr-3">
                      <button
                        onClick={() => withdraw(x.iri)}
                        className="rounded border border-gray-700 px-1.5 py-0.5 text-[10.5px] text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        철회
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => jump('chain')}
              className="rounded-md border border-violet-500/40 bg-violet-500/12 px-3 py-1.5 text-[11.5px] font-bold text-violet-300 hover:bg-violet-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑤ 근거 사슬의 조치 칸에서 확인 →
            </button>
            <button
              onClick={() => jump('catalog')}
              className="rounded-md border border-sky-500/40 bg-sky-500/12 px-3 py-1.5 text-[11.5px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑭ 카탈로그에서 건수 확인 →
            </button>
          </div>
          <div className="mt-2 break-keep text-[10.5px] leading-relaxed text-gray-500">
            철회하면 그래프에서 노드가 빠지지만 <b className="text-gray-400">발행 활동(prov:Activity)은 남습니다</b> — 있었던 일을 지우지 않습니다.
          </div>
        </div>
      )}
    </Panel>
  )
}

const TONE: Record<string, string> = { 문법: '#38bdf8', 규정: '#f472b6', 스키마: '#a78bfa', 근거: '#34d399' }

function Row({ c }: { c: Check }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{ borderColor: c.ok ? '#34d39933' : '#f43f5e44', background: c.ok ? '#34d3990d' : '#f43f5e10' }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px]">{c.ok ? '✓' : '✗'}</span>
        <span className="rounded px-1 py-px text-[9.5px] font-black" style={{ color: TONE[c.source], background: `${TONE[c.source]}1a` }}>
          {c.source}
        </span>
        <span className="text-[11.5px] font-bold text-gray-200">{c.ko}</span>
      </div>
      <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed" style={{ color: c.ok ? '#9ca3af' : '#fda4af' }}>
        {c.why}
      </div>
    </div>
  )
}
