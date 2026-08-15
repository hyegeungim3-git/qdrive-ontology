import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ink } from './ink'
import { Panel } from '../components/ui'
import { nowSim, policyActive } from './validity'
import { FAULTS, type FaultId } from './rdf'
import { enqueue, qStats, useQuarantine } from './quarantine'
import { runValidation, type Finding, type RunResult } from './validate'
import { shapesFor } from './shacl'
import { stampOf } from './gate'
import { currentVersion } from './grammar'
import type { Jump } from './nav'
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

/**
 * 한 레코드의 검사 성적표.
 *
 * ⑨는 위반만 늘어놓는다. 그래프에서 «이 레코드는 괜찮은가»를 물으러 온 사람에게 «위반 없음»만
 * 답하면 **무엇을 검사했는지**를 알 수 없다. 그래서 적용된 제약을 전부 세우고 통과/위반을 표시한다.
 * 통과가 보여야 «검사를 하긴 한 건가»에 답이 된다.
 */
function RecordAudit({ res, iri, onClear }: { res: RunResult; iri: string; onClear: () => void }) {
  const ix = res.graph.index
  const type = ix.type[iri]
  const space = ix.space[iri]
  const label = ix.label[iri] ?? iri.replace('qdi:', '')
  const short = iri.replace('qdi:', '')

  if (!type) {
    return (
      <div className="mb-3 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 break-keep text-[12px] text-gray-400">
        <b className="text-gray-200">{short}</b> 은(는) 지금 데이터 그래프에 없습니다 — 그래프를 다시 뜬 뒤 사라진 레코드입니다.{' '}
        <button onClick={onClear} className="text-sky-400 underline-offset-2 hover:underline">
          전체 결과 보기
        </button>
      </div>
    )
  }

  const stamp = stampOf(iri)
  const now = currentVersion()
  const checks = shapesFor(type, space)
  const mine = res.findings.filter((f) => f.focusIri === iri)
  const failed = (c: ReturnType<typeof shapesFor>[number]) =>
    mine.filter((f) => (c.constraint ? f.constraint === c.constraint : f.path === c.path))
  const violated = checks.filter((c) => failed(c).length > 0).length
  const block = res.graph.turtle.split('\n\n').find((b) => b.trim().startsWith(iri + ' '))

  return (
    <div className="mb-3 rounded-xl border border-violet-400/30 bg-violet-400/[0.07] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-black text-violet-200">
            {label} <span className="font-mono text-[11px] font-semibold text-gray-500">{short}</span>
          </div>
          {/* 검증 스탬프 — 이 레코드가 어느 문법으로 검사됐나. 발행이 소급하지 않는다는 것의 증거. */}
          {stamp && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span
                className="rounded px-1.5 py-0.5 font-black"
                style={
                  stamp.version === now
                    ? { color: '#6ee7b7', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)' }
                    : { color: '#fcd34d', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.45)' }
                }
              >
                {stamp.version}으로 검증 · {stamp.status}
              </span>
              {stamp.version !== now && (
                <span className="break-keep text-amber-300">
                  지금 문법은 {now} — 이 레코드는 <b>옛 문법으로 검증</b>됐습니다. 발행은 소급하지 않습니다.
                </span>
              )}
            </div>
          )}
          <div className="mt-1 break-keep text-[11.5px] text-gray-400">
            {type} · {space} — 이 레코드에 적용된 제약 <b className="text-gray-200">{checks.length}</b>개 중{' '}
            {violated > 0 ? (
              <b className="text-rose-300">{violated}개 위반</b>
            ) : (
              <b className="text-emerald-300">전부 통과</b>
            )}
          </div>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 rounded-md border border-gray-700 bg-gray-900 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          전체 결과 보기
        </button>
      </div>

      <div className="mt-2.5 -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
              <th className="py-1.5 pr-2 font-semibold">계열</th>
              <th className="py-1.5 pr-2 font-semibold">검사</th>
              <th className="py-1.5 pr-2 font-semibold">내용</th>
              <th className="py-1.5 font-semibold">결과</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, i) => {
              const bad = failed(c)
              const tone = FAMILY_TONE[c.family] ?? '#94a3b8'
              return (
                <tr key={i} className="border-b border-gray-800/60 align-top">
                  <td className="py-1.5 pr-2">
                    <span
                      className="whitespace-nowrap rounded px-1 py-0.5 text-[11px] font-black"
                      style={{ color: ink(tone), background: `${tone}1f`, border: `1px solid ${tone}55` }}
                    >
                      {c.family}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 break-keep font-mono text-[11px] text-gray-300">{c.name}</td>
                  <td className="py-1.5 pr-2 break-keep text-gray-500">{c.detail}</td>
                  <td className="py-1.5 break-keep">
                    {bad.length ? (
                      <span className="font-bold text-rose-300">✗ {bad[0].message}</span>
                    ) : (
                      <span className="font-semibold text-emerald-300">✓ 통과</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {block && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] font-semibold text-gray-400 hover:text-gray-200">검사받은 실제 트리플 보기</summary>
          <pre className="mt-1.5 overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-2.5 font-mono text-[11.5px] leading-relaxed text-gray-400">
            {block}
          </pre>
        </details>
      )}
    </div>
  )
}

export default function Live({
  snap,
  onGoto,
  faults,
  setFaults,
  preset,
}: {
  snap: SimSnapshot
  onGoto: Jump
  // ⑩에 갔다 돌아와도 주입한 결함이 남아 있어야 한다 — 이 화면은 왕복을 전제로 만들어져 있다
  faults: Set<FaultId>
  setFaults: (f: Set<FaultId>) => void
  // 인스턴스 그래프에서 «이 레코드가 어떤 검사를 받았나»로 넘어온 경우
  preset?: { focusIri: string }
}) {
  const [focus, setFocus] = useState<string | null>(preset?.focusIri ?? null)
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
    // 마운트 시 1회 — 돌아왔을 때는 남아 있던 결함 그대로 다시 검증한다
    void run(faults)
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
                className="rounded-md border border-gray-700 bg-gray-900 px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                결함 모두 해제
              </button>
            )}
            <button
              onClick={() => void run(faults)}
              disabled={busy}
              className="rounded-md border border-pink-400/50 bg-pink-400/15 px-3 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-pink-200 hover:bg-pink-400/25 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-sky-500"
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
          <div className="text-[15px] font-black" style={{ color: ink(res?.error ? SEV.Violation.fg : ok ? '#6ee7b7' : SEV.Violation.fg)}}>
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

        {/* 레코드 성적표 — 그래프에서 «이 레코드는 괜찮은가»를 물으러 온 경우 */}
        {focus && res && !res.error && <RecordAudit res={res} iri={focus} onClear={() => setFocus(null)} />}

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
              className="ml-auto whitespace-nowrap rounded-md border border-sky-400/50 bg-sky-400/15 px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
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
                    className="shrink-0 rounded px-1 py-0.5 text-[11px] font-black"
                    style={{ color: ink(tone), background: `${tone}1f`, border: `1px solid ${tone}55` }}
                  >
                    {f.family}
                  </span>
                  <span className={`truncate text-[12px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{f.ko}</span>
                  <span className="ml-auto shrink-0 text-[11px]">{on ? '🔴' : '⚪'}</span>
                </div>
                <div className="mt-1 break-keep text-[11.5px] leading-snug text-gray-500">{f.desc}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-600">→ {f.expect}</div>
                {/* 규정에 시행일이 생기면서 「켰는데 안 걸린다」가 가능해졌다.
                    이유를 안 적으면 사용자에게는 고장으로 읽힌다 — 막힌 것과 고장난 것은 달라야 한다. */}
                {f.id === 'autoAdverse' && !policyActive('pol-noauto', nowSim()) && (
                  <div className="mt-1 rounded px-1.5 py-1 break-keep text-[10px] leading-snug text-amber-300" style={{ background: '#f59e0b14' }}>
                    ⏳ 이 규칙의 근거 규정이 <b>아직 시행 전</b>입니다 — 지금 켜도 걸리지 않습니다. ② 관계 문법에서 시행일을 확인하세요.
                  </div>
                )}
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
                className={`rounded-md border px-2 max-[640px]:min-h-[40px] py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 ${
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
                              style={{ color: ink(s.fg), background: s.bg, border: `1px solid ${s.bd}` }}
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
                              <span className="ml-1 whitespace-nowrap rounded bg-gray-800 px-1 py-0.5 text-[11px] font-bold text-gray-400">보조 검사</span>
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

            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12.5px] leading-relaxed text-gray-500">
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
            <pre className="max-h-[420px] overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3 font-mono text-[11.5px] leading-relaxed text-gray-400">
              {res.graph.turtle}
            </pre>
          </>
        )}

        {tab === 'shapes' && res && (
          <pre className="max-h-[420px] overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3 font-mono text-[11.5px] leading-relaxed text-gray-400">
            {res.shapesTurtle}
          </pre>
        )}
      </Panel>
    </div>
  )
}
