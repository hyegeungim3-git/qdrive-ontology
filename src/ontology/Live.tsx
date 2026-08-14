import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Panel } from '../components/ui'
import { FAULTS, type FaultId } from './rdf'
import { enqueue, qStats, useQuarantine } from './quarantine'
import { runValidation, type Finding, type RunResult } from './validate'
import type { SimSnapshot } from '../sim/types'

/**
 * ⑨ SHACL 실검증 — 제약을 "생성"하는 것과 "돌리는" 것은 다르다.
 *
 * 지금 이 순간의 엔진 상태를 RDF 데이터 그래프로 옮기고, W3C SHACL 구현체에 그대로 넣는다.
 * 결함을 주입하면 정말로 막히는 것을 눈으로 본다 — 막힌다고 말하는 대신.
 */

const SEV: Record<Finding['severity'], { ko: string; fg: string; bg: string; bd: string }> = {
  Violation: { ko: '위반', fg: '#fda4af', bg: 'rgba(251,113,133,0.12)', bd: 'rgba(251,113,133,0.4)' },
  Warning: { ko: '경고', fg: '#fcd34d', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.4)' },
  Info: { ko: '참고', fg: '#93c5fd', bg: 'rgba(56,189,248,0.12)', bd: 'rgba(56,189,248,0.4)' },
}

const FAMILY_TONE: Record<string, string> = { 속성: '#22d3ee', 관계: '#34d399', 문법: '#a78bfa', 도메인: '#fb7185' }

export default function Live({ snap, onGoto }: { snap: SimSnapshot; onGoto: (s: 'quarantine') => void }) {
  const [faults, setFaults] = useState<Set<FaultId>>(new Set())
  const [res, setRes] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(0)
  const [tab, setTab] = useState<'result' | 'data' | 'shapes'>('result')
  const queue = useQuarantine()
  // 스냅샷은 250ms마다 바뀐다 — 검증은 누른 순간의 상태로만 돌린다(결과가 손안에서 흔들리지 않게)
  const latest = useRef(snap)
  latest.current = snap

  const run = useCallback(async (f: Set<FaultId>) => {
    setBusy(true)
    const r = await runValidation(latest.current, f)
    setRes(r)
    // 걸린 레코드는 말로 끝내지 않고 실제로 격리 큐에 넣는다 — 같은 레코드·같은 제약은 중복 적재되지 않는다
    setSent(enqueue(r.findings, latest.current.simTime))
    setBusy(false)
  }, [])

  useEffect(() => {
    void run(new Set())
    // 최초 1회만 — 이후는 사용자가 누를 때
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id: FaultId) => {
    const next = new Set(faults)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFaults(next)
    void run(next)
  }

  const counts = useMemo(() => {
    const f = res?.findings ?? []
    return { v: f.filter((x) => x.severity === 'Violation').length, w: f.filter((x) => x.severity === 'Warning').length }
  }, [res])

  const ok = res && !res.error && res.conforms

  return (
    <div className="space-y-3">
      <Panel
        title="⑨ SHACL 실검증 — 지금 이 데이터가 제약을 지키는가"
        right={
          <div className="flex items-center gap-2">
            {faults.size > 0 && (
              <button
                onClick={() => {
                  setFaults(new Set())
                  void run(new Set())
                }}
                className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                결함 모두 해제
              </button>
            )}
            <button
              onClick={() => void run(faults)}
              disabled={busy}
              className="rounded-md border border-pink-400/50 bg-pink-400/15 px-3 py-1 text-[11px] font-bold text-pink-200 hover:bg-pink-400/25 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {busy ? '검증 중…' : '↻ 지금 상태로 다시 검증'}
            </button>
          </div>
        }
      >
        <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
          앞 단계의 제약은 <b className="text-gray-200">생성</b>까지였습니다. 여기서는 시뮬레이터가 지금 내보내는 값을 RDF 데이터 그래프로 옮겨,{' '}
          <b className="text-gray-200">W3C SHACL 구현체(rdf-validate-shacl)에 그대로 넣어 돌립니다.</b> 아래 결함을 켜면 정말로 걸리는지 바로 보입니다.
        </p>

        {/* 판정 배너 */}
        <div
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-4 py-3"
          style={{
            borderColor: res?.error ? SEV.Violation.bd : ok ? 'rgba(52,211,153,0.4)' : SEV.Violation.bd,
            background: res?.error ? SEV.Violation.bg : ok ? 'rgba(52,211,153,0.1)' : SEV.Violation.bg,
          }}
        >
          <div className="text-[15px] font-black" style={{ color: res?.error ? SEV.Violation.fg : ok ? '#6ee7b7' : SEV.Violation.fg }}>
            {res?.error ? '⚠ 검증 실행 실패' : ok ? '✅ conforms — 위반 없음' : `✗ conforms = false · 위반 ${counts.v}건${counts.w ? ` · 경고 ${counts.w}건` : ''}`}
          </div>
          {res && !res.error && (
            <div className="text-[11.5px] text-gray-400">
              셰이프 <b className="text-gray-200">{res.shapeQuads.toLocaleString()}</b> 트리플 · 데이터{' '}
              <b className="text-gray-200">{res.dataQuads.toLocaleString()}</b> 트리플 / 노드 <b className="text-gray-200">{res.graph.subjects}</b>개 ·{' '}
              <b className="text-gray-200">{res.ms}ms</b>
            </div>
          )}
          {res?.error && <div className="text-[11.5px] text-gray-300">{res.error}</div>}
        </div>

        {/* 격리 큐로의 인계 — 「막았다」로 끝내지 않는다 */}
        {qStats(queue).total > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5">
            <span className="text-[12px] font-bold text-sky-200">
              {sent > 0 ? `↳ 격리 큐로 ${sent}건 넘겼습니다` : '↳ 격리 큐에 쌓인 레코드가 있습니다'}
            </span>
            <span className="text-[11.5px] text-gray-400">
              보류 중 <b className="text-gray-200">{qStats(queue).held}</b>건 · 처리 완료 <b className="text-gray-200">{qStats(queue).done}</b>건
              {qStats(queue).blocked > 0 && <span className="ml-1 text-amber-300">· 예외 승인 불가 {qStats(queue).blocked}건</span>}
            </span>
            <button
              onClick={() => onGoto('quarantine')}
              className="ml-auto whitespace-nowrap rounded-md border border-sky-400/50 bg-sky-400/15 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑩ 격리 큐에서 처리 →
            </button>
          </div>
        )}

        {/* 결함 주입 */}
        <div className="mb-1.5 flex items-baseline gap-2">
          <h4 className="text-[12px] font-black tracking-wide text-pink-300">결함 주입</h4>
          <span className="break-keep text-[10.5px] text-gray-500">일부러 규칙을 깨 본다 — 각 항목은 서로 다른 제약에 걸리도록 만들어져 있다</span>
        </div>
        <div className="grid grid-cols-4 gap-2 max-[1100px]:grid-cols-2 max-[620px]:grid-cols-1">
          {FAULTS.map((f) => {
            const on = faults.has(f.id)
            const tone = FAMILY_TONE[f.family] ?? '#94a3b8'
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                aria-pressed={on}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-pink-400/60 bg-pink-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[9.5px] font-black"
                    style={{ color: tone, background: `${tone}1f`, border: `1px solid ${tone}55` }}
                  >
                    {f.family}
                  </span>
                  <span className={`truncate text-[12px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{f.ko}</span>
                  <span className="ml-auto shrink-0 text-[11px]">{on ? '🔴' : '⚪'}</span>
                </div>
                <div className="mt-1 break-keep text-[10.5px] leading-snug text-gray-500">{f.desc}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-600">→ {f.expect}</div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title={
          <span>
            검증 결과
            {res && !res.error && <span className="ml-2 text-[11px] font-semibold text-gray-500">{res.findings.length}건</span>}
          </span>
        }
        right={
          <div className="flex gap-1">
            {(
              [
                ['result', '결과'],
                ['data', '데이터 그래프'],
                ['shapes', '셰이프'],
              ] as const
            ).map(([k, ko]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  tab === k ? 'border-sky-400/50 bg-sky-400/15 text-sky-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
                }`}
              >
                {ko}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'result' && (
          <>
            {res && !res.error && res.findings.length === 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-6 text-center">
                <div className="text-[13px] font-bold text-emerald-300">엔진이 내보내는 데이터가 제약을 전부 지키고 있습니다</div>
                <div className="mt-1 break-keep text-[11.5px] text-gray-500">
                  위 결함 중 하나를 켜 보세요. 어느 제약이 어떤 노드에서 걸리는지 여기에 그대로 나옵니다.
                </div>
              </div>
            )}
            {res && res.findings.length > 0 && (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                      <th className="py-1.5 pr-2 font-semibold">심각도</th>
                      <th className="py-1.5 pr-2 font-semibold">대상 노드</th>
                      <th className="py-1.5 pr-2 font-semibold">경로</th>
                      <th className="py-1.5 pr-2 font-semibold">걸린 제약</th>
                      <th className="py-1.5 font-semibold">메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.findings.map((f, i) => {
                      const s = SEV[f.severity]
                      return (
                        <tr key={i} className="border-b border-gray-800/60 align-top">
                          <td className="py-1.5 pr-2">
                            <span
                              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-black"
                              style={{ color: s.fg, background: s.bg, border: `1px solid ${s.bd}` }}
                            >
                              {s.ko}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">
                            <div className="font-mono text-[11px] text-gray-300">{f.focus}</div>
                            {f.focusLabel && <div className="break-keep text-[10.5px] text-gray-500">{f.focusLabel}</div>}
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-[11px] text-sky-300">{f.path}</td>
                          <td className="py-1.5 pr-2">
                            <span className="whitespace-nowrap font-mono text-[11px] text-violet-300">sh:{f.constraint}</span>
                            {f.engine === 'JS' && (
                              <span className="ml-1 whitespace-nowrap rounded bg-gray-800 px-1 py-0.5 text-[9.5px] font-bold text-gray-400">보조 검사</span>
                            )}
                          </td>
                          <td className="py-1.5 break-keep text-gray-400">{f.message}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
              ⓘ <b className="text-gray-300">엔진이 못 하는 것도 적어 둡니다</b> — 브라우저 검증기(rdf-validate-shacl)는{' '}
              <span className="font-mono text-gray-400">sh:sparql</span> 기반 제약을 지원하지 않습니다. 그래서 「회차 연료 누적값」 규칙만 같은 조건을
              JS로 따로 돌리고 결과에 <b className="text-gray-300">보조 검사</b>로 표시했습니다. 내보내기 파일에는 원래대로{' '}
              <span className="font-mono text-gray-400">sh:sparql</span> 형태로 들어갑니다 — 서버측 검증기(TopBraid·pySHACL)는 이것도 돌립니다.
            </div>
          </>
        )}

        {tab === 'data' && res && (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {res.graph.byClass.slice(0, 18).map((c) => (
                <span key={c.ko} className="rounded-md border border-gray-800 bg-gray-900 px-1.5 py-0.5 font-mono text-[10.5px] text-gray-400">
                  {c.ko} <b className="text-gray-200">{c.n}</b>
                </span>
              ))}
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3 font-mono text-[10.5px] leading-relaxed text-gray-400">
              {res.graph.turtle}
            </pre>
          </>
        )}

        {tab === 'shapes' && res && (
          <pre className="max-h-[420px] overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3 font-mono text-[10.5px] leading-relaxed text-gray-400">
            {res.shapesTurtle}
          </pre>
        )}
      </Panel>
    </div>
  )
}
