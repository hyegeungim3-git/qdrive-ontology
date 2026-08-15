import { useEffect, useRef, useState } from 'react'
import { Emph } from '../components/ui'
import { runAgent, tripSlice, type Answer } from './agent'
import { useGate } from './gate'
import { currentVersion } from './grammar'
import { roleOf, useRole } from './policy'
import type { MissionId } from './missions'

/**
 * AI 에이전트 — **스튜디오와 분리된 별도 모드.**
 *
 * ⓪~⑭는 «온톨로지를 들여다보는» 화면이고, 여기는 «온톨로지 위에서 도는 서비스»다.
 * 발주처가 실제로 쓰게 될 모습은 이쪽이라 화면 흐름에 끼워 넣지 않고 따로 뒀다.
 *
 * 두 형태를 한 화면에서 전환한다.
 *  - **채팅**: 사용자가 실제로 보게 될 모습. 답과 근거만 보인다.
 *  - **에이전트**: 그 답이 나오기까지 **무엇을 호출했는지**가 보인다.
 *    도구 호출로 적으면 「LLM이 지어낸 게 아니다」가 눈에 들어온다.
 *
 * 답할 수 없는 질문에는 **답할 수 없다고 답한다.** 그럴듯하게 지어내는 것보다
 * 「이 데이터가 있으면 답할 수 있습니다」가 낫다 — 그게 이 시스템이 파는 것이다.
 */

type Msg =
  | { role: 'user'; text: string }
  | { role: 'agent'; kind: 'answer'; ans: Answer; calls: Call[] }
  | { role: 'agent'; kind: 'trip'; calls: Call[] }
  | { role: 'agent'; kind: 'unknown'; text: string; need: string[]; calls: Call[] }

type Call = { fn: string; arg: string; out: string; ok: boolean }

const PRESETS: { q: string; tag: string; c: string }[] = [
  { q: '이번 운행 1회에서 온톨로지가 무엇을 했나요?', tag: '대표 시연', c: '#f472b6' },
  { q: '724번 노선을 증차해야 합니까?', tag: '정책 수립', c: '#38bdf8' },
  { q: '오늘 가장 위험한 기사에게 무엇을 코칭해야 합니까?', tag: '안전 운전', c: '#fb7185' },
  { q: '이번 운행에서 얼마나 배출했고, 검증기관이 믿을 수 있습니까?', tag: '탄소중립', c: '#34d399' },
]

/** 질문 → 시나리오. 실서비스에서는 LLM이 하지만, **매핑 결과를 반드시 보여 줘야** 한다 */
function route(q: string): { kind: 'trip' | MissionId | 'unknown'; why: string } {
  const t = q.replace(/\s/g, '')
  /* 구체적인 주제를 **먼저** 본다. 처음에는 「운행」을 맨 앞에 뒀다가
     «이번 운행에서 얼마나 배출했고»가 탄소가 아니라 운행 1회로 분류됐다 —
     넓은 패턴을 앞에 두면 좁은 패턴이 영영 안 걸린다. */
  if (/배출|탄소|감축|co2|검증기관|온실/i.test(t)) return { kind: 'carbon', why: '「탄소중립」으로 인식 — 배출 산정·기준선·계수를 건다' }
  if (/위험|코칭|기사|안전|점수|감점/.test(t)) return { kind: 'safety', why: '「안전 운전」으로 인식 — 안전점수·위험운전·낭비 요인을 건다' }
  if (/증차|감차|노선|배차|수요|혼잡|정책/.test(t)) return { kind: 'policy', why: '「정책 수립」으로 인식 — 재차율·혼잡 판정·수송 실적을 건다' }
  if (/운행|1회|한번|온톨로지/.test(t)) return { kind: 'trip', why: '「운행 1회」로 인식 — 회차 노드를 중심으로 그래프를 펼친다' }
  return { kind: 'unknown', why: '지표로 옮길 수 없는 질문 — 지어내지 않고 못 한다고 답한다' }
}

export default function AgentChat() {
  const gate = useGate()
  const role = useRole()
  const [mode, setMode] = useState<'chat' | 'agent'>('chat')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, busy])

  const ask = (q: string) => {
    if (!q.trim() || busy) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setBusy(true)
    // 실제 호출처럼 보이게 한 박자 둔다 — 즉답하면 «미리 적어 둔 것»처럼 읽힌다
    window.setTimeout(() => {
      const r = route(q)
      const base: Call[] = [
        { fn: 'grammar.load', arg: currentVersion(), out: `스페이스 9 · 관계 30종`, ok: true },
        { fn: 'intent.map', arg: `"${q.slice(0, 22)}${q.length > 22 ? '…' : ''}"`, out: r.why, ok: r.kind !== 'unknown' },
      ]
      if (r.kind === 'unknown') {
        setMsgs((m) => [
          ...m,
          {
            role: 'agent',
            kind: 'unknown',
            text: '이 질문은 지금 답할 수 없습니다. 그럴듯하게 지어내는 대신 무엇이 없어서 못 하는지 적겠습니다.',
            need: [
              '질문을 우리 지표로 옮길 수 없습니다 — 증차·코칭·배출처럼 그래프에 있는 개념으로 물어 주세요',
              '없는 지표를 물으면 만들어 내지 않습니다. 정시율처럼 원천이 없는 것은 「미측정」으로만 답합니다',
            ],
            calls: base,
          },
        ])
        setBusy(false)
        return
      }
      if (r.kind === 'trip') {
        const s = tripSlice(gate)
        setMsgs((m) => [
          ...m,
          {
            role: 'agent',
            kind: 'trip',
            calls: [
              ...base,
              { fn: 'graph.find', arg: "type='Trip'", out: s.trip ? `${s.vehicleId} 회차 1건` : '회차 없음', ok: !!s.trip },
              { fn: 'graph.walk', arg: 'depth=3 · 양방향', out: `노드 ${s.total}개 · 스페이스 ${s.bySpace.length}개`, ok: s.total > 0 },
            ],
          },
        ])
        setBusy(false)
        return
      }
      const ans = runAgent(r.kind, gate)
      setMsgs((m) => [
        ...m,
        {
          role: 'agent',
          kind: 'answer',
          ans,
          calls: [
            ...base,
            { fn: 'grammar.validate', arg: ans.blocked ? `"${ans.blocked.q.slice(0, 18)}…"` : '질의 관계 확인', out: ans.blocked ? '거부 — 문법에 없는 방향' : '통과', ok: !ans.blocked },
            { fn: 'graph.walk', arg: ans.steps[2]?.detail.slice(0, 30) ?? '', out: `노드 ${ans.cites.length}개 인용`, ok: ans.cites.length > 0 },
            { fn: 'confidence.cap', arg: ans.conf.level, out: `상한 ${ans.conf.pct}%`, ok: true },
            { fn: 'limits.collect', arg: '못 하는 것', out: `${ans.limits.length}건`, ok: true },
          ],
        },
      ])
      setBusy(false)
    }, 420)
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-4 py-3">
        <span className="text-[15px] font-black text-violet-300">🤖 AI 에이전트</span>
        <span className="break-keep text-[12px] leading-relaxed text-gray-400">
          온톨로지 <b className="text-gray-200">위에서 도는</b> 서비스입니다. 답의 모든 숫자가 그래프에서 나오고, 못 하는 것은 못 한다고 답합니다.
        </span>
        <div className="ml-auto flex shrink-0 gap-1">
          {(['chat', 'agent'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                mode === m ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'chat' ? '💬 채팅' : '⚙ 에이전트'}
            </button>
          ))}
        </div>
      </div>

      {/* 대화 */}
      <div className="min-h-[280px] rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-3">
        {!msgs.length && (
          <div className="py-6 text-center">
            <div className="break-keep text-[13px] text-gray-400">
              «{roleOf(role).ko}»로 접속했습니다. 아래 질문을 눌러 보세요.
            </div>
            <div className="mt-1 break-keep text-[11.5px] text-gray-600">
              역할을 바꾸면 볼 수 있는 것이 달라지고, 답변도 그 범위 안에서만 나옵니다.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {msgs.map((m, i) => (
            <div key={i}>
              {m.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500/15 px-3.5 py-2 break-keep text-[13px] leading-relaxed text-sky-100 ring-1 ring-sky-400/25">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 에이전트 모드: 도구 호출 */}
                  {mode === 'agent' && (
                    <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                      <div className="mb-1 text-[10.5px] font-black tracking-wide text-gray-600">도구 호출</div>
                      <div className="space-y-1">
                        {m.calls.map((c, j) => (
                          <div key={j} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px]">
                            <span className={c.ok ? 'text-emerald-400' : 'text-rose-400'}>{c.ok ? '✓' : '✗'}</span>
                            <span className="text-violet-300">{c.fn}</span>
                            <span className="text-gray-600">({c.arg})</span>
                            <span className="text-gray-500">→</span>
                            <span className="break-keep text-gray-300">{c.out}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-gray-800 bg-gray-900/70 px-3.5 py-3">
                    {m.kind === 'unknown' && (
                      <>
                        <div className="break-keep text-[13px] leading-relaxed text-gray-100">{m.text}</div>
                        <div className="mt-2 space-y-1">
                          {m.need.map((n) => (
                            <div key={n} className="break-keep text-[11.5px] leading-relaxed text-amber-200/80">
                              · {n}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {m.kind === 'trip' && <TripAnswer />}

                    {m.kind === 'answer' && (
                      <>
                        <div className="break-keep text-[13.5px] leading-relaxed text-gray-50">
                          <Emph t={m.ans.answer} cls="text-white" />
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {m.ans.cites.map((c) => (
                            <span key={c.iri} title={c.iri} className="rounded-lg border border-gray-800 bg-gray-950/60 px-2 py-1">
                              <span className="text-[10px] text-gray-600">{c.space}</span>{' '}
                              <span className="text-[11px] font-bold text-gray-300">{c.label}</span>
                              {c.value && <span className="ml-1 text-[11px] font-black text-emerald-400">{c.value}</span>}
                            </span>
                          ))}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-md px-2 py-1 text-[11px] font-black" style={{ background: '#34d3991a', color: '#6ee7b7' }}>
                            신뢰도 상한 {m.ans.conf.pct}% · {m.ans.conf.level}
                          </span>
                          <span className="break-keep text-[11px] leading-relaxed text-gray-500">{m.ans.conf.why}</span>
                        </div>

                        {m.ans.blocked && (
                          <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: '#f43f5e44', background: '#f43f5e10' }}>
                            <div className="text-[11.5px] font-black text-rose-300">문법 검증이 막은 질의</div>
                            <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-300">“{m.ans.blocked.q}”</div>
                            <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-rose-200/70">{m.ans.blocked.why}</div>
                          </div>
                        )}

                        <details className="mt-2 rounded-lg border border-gray-800 bg-gray-950/40 px-2.5 py-1.5">
                          <summary className="cursor-pointer text-[11.5px] font-bold text-amber-300">이 답이 못 하는 것 {m.ans.limits.length}가지</summary>
                          <div className="mt-1 space-y-1">
                            {m.ans.limits.map((l) => (
                              <div key={l} className="break-keep text-[11.5px] leading-relaxed text-gray-400">
                                · <Emph t={l} cls="text-amber-200" />
                              </div>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
              그래프를 걷는 중…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* 입력 */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.q}
              onClick={() => ask(p.q)}
              disabled={busy}
              className="rounded-lg border px-2.5 py-1.5 max-[640px]:min-h-[40px] text-left text-[11.5px] transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
              style={{ borderColor: `${p.c}44`, background: `${p.c}0d` }}
            >
              <span className="font-black" style={{ color: p.c }}>
                {p.tag}
              </span>
              <span className="ml-1.5 text-gray-300">{p.q}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(input)}
            placeholder="직접 물어보세요 — 답할 수 없으면 못 한다고 답합니다"
            className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-[13px] text-gray-100 placeholder:text-gray-600 focus-visible:ring-2 focus-visible:ring-sky-500"
          />
          <button
            onClick={() => ask(input)}
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-[13px] font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            묻기
          </button>
        </div>
      </div>

      <div className="rounded-xl border px-4 py-3 break-keep text-[12px] leading-relaxed" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d', color: '#ddd6fe' }}>
        <b>온톨로지가 환각을 없애 주지는 않습니다.</b> 없애 주는 것은 <b>「근거를 못 대는 상태」</b>입니다. 위 답변의 모든 숫자에는 어느 노드에서
        왔는지가 붙어 있고, 못 하는 것은 못 한다고 적혀 있습니다. <b>⚙ 에이전트</b>로 바꾸면 그 답이 나오기까지 무엇을 호출했는지가 보입니다 —
        특히 <b>문법 검증이 잘못된 질의를 실행 전에 거르는 것</b>이 벡터 검색만으로는 안 되는 부분입니다.
      </div>
    </div>
  )
}

/** 운행 1회 — 스페이스별로 펼친다 */
function TripAnswer() {
  const gate = useGate()
  const s = tripSlice(gate)
  return (
    <>
      <div className="space-y-1">
        {s.story.map((t, i) => (
          <div key={i} className="break-keep text-[13px] leading-relaxed text-gray-50">
            <Emph t={t} cls="text-white" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 max-[820px]:grid-cols-2 max-[520px]:grid-cols-1">
        {s.bySpace.map((sp) => (
          <div key={sp.en} className="rounded-lg border bg-gray-950/40 px-2 py-1.5" style={{ borderColor: `${sp.color}3a` }}>
            <div className="flex items-baseline gap-1">
              <span className="text-[11.5px] font-black" style={{ color: sp.color }}>
                {sp.ko}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-gray-500">{sp.nodes.length}</span>
            </div>
            <div className="mt-0.5 space-y-0.5">
              {sp.nodes.slice(0, 4).map((n) => (
                <div key={n.iri} className="truncate text-[10.5px] text-gray-400">
                  {n.label} <span style={{ color: sp.color }}>«{n.via}»</span>
                </div>
              ))}
              {sp.nodes.length > 4 && <div className="text-[10px] text-gray-600">외 {sp.nodes.length - 4}개</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
        이 운행을 표로 적으면 <span className="font-mono text-gray-400">차량번호 · 거리 · 연료 · CO₂</span> 네 칸입니다. 그 네 칸으로는 「연료를
        왜 더 썼나」도 「이 감점이 정당한가」도 답할 수 없습니다.
      </div>
    </>
  )
}
