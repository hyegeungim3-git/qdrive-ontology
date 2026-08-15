import { useEffect, useRef, useState } from 'react'
import { Emph } from '../components/ui'
import { gapAnswer, measureAnswer, runAgent, tripSlice, type Answer } from './agent'
import { useGate } from './gate'
import { currentVersion } from './grammar'
import { SPACES } from './meta'
import { REL_META } from './standards'
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
  | { role: 'agent'; kind: 'answer'; ans: Answer; calls: Call[]; follow: string[]; self: Kind }
  | { role: 'agent'; kind: 'trip'; calls: Call[]; follow: string[]; self: Kind }
  | { role: 'agent'; kind: 'unknown'; text: string; need: string[]; calls: Call[]; follow: string[]; self: Kind }

type Call = { fn: string; arg: string; out: string; ok: boolean }

/** 시나리오. gap은 «그럼 뭐가 있어야 하나요»의 종착지 — 후속 질문이 갈 곳이 있어야 대화가 돈다 */
type Kind = 'trip' | MissionId | 'gap' | 'measure' | 'unknown'

const PRESETS: { q: string; tag: string; c: string }[] = [
  /* 처음에는 «온톨로지가 무엇을 했나요»였다. 시스템이 주어인 질문은 아무도 던지지 않는다 —
     사용자가 궁금한 것은 도구가 한 일이 아니라 **자기가 무엇을 알 수 있는가**다. */
  { q: '이번 운행에서 데이터로 무엇까지 알 수 있나요?', tag: '대표 시연', c: '#f472b6' },
  { q: '724번 노선을 증차해야 합니까?', tag: '정책 수립', c: '#38bdf8' },
  { q: '오늘 가장 위험한 기사에게 무엇을 코칭해야 합니까?', tag: '안전 운전', c: '#fb7185' },
  { q: '이번 운행에서 얼마나 배출했고, 검증기관이 믿을 수 있습니까?', tag: '탄소중립', c: '#34d399' },
]

/** 더 물어볼 수 있는 것들 — 빈 화면에서 «이 넷만 되나»로 읽히지 않게 펼쳐 둔다 */
const MORE: string[] = [
  '무엇이 있으면 더 답할 수 있나요?',
  '정시율은 왜 못 답하나요?',
  '공차 거리를 알 수 있나요?',
  '이 노선의 혼잡은 어느 정도인가요?',
  '급가속이 연료를 얼마나 더 쓰게 하나요?',
  '전기버스로 바꾸면 배출이 0인가요?',
]

/**
 * 답변마다 붙는 **이어서 물어보기.**
 * 앞의 답이 전부 「다만 …이 없습니다」로 끝나므로 그 다음 질문은 정해져 있다 —
 * 사용자가 그 문장을 타이핑하게 두지 않고 눌러서 잇게 한다.
 */
const FOLLOW: Record<Kind, string[]> = {
  trip: [
    '이 운행에서 얼마나 배출했나요?',
    '이 차량 안전점수는 왜 그 점수인가요?',
    '무엇이 있으면 더 답할 수 있나요?',
  ],
  policy: [
    '이 판단에 쓰인 운행 하나를 보여 주세요',
    '증차 대신 코칭으로 배출을 줄일 수 있나요?',
    '무엇이 있으면 증차를 확실히 답할 수 있나요?',
  ],
  safety: [
    '코칭하면 배출도 줄어드나요?',
    '이 판단에 쓰인 운행 하나를 보여 주세요',
    '무엇이 있으면 안전을 더 정확히 볼 수 있나요?',
  ],
  carbon: [
    '감축 수단별로 얼마나 기여했나요?',
    /* «이 배출을 만든 운행»으로 적었더니 «배출»이 먼저 걸려 탄소로 되돌아갔다.
       필터가 걸러 줘서 화면에는 안 나갔지만, 칩 하나가 조용히 사라진 것이다 —
       칩 문구는 **가려는 시나리오의 말**로 적어야 한다. */
    '그 운행 한 번을 자세히 보여 주세요',
    '무엇이 있으면 검증기관이 더 믿을까요?',
  ],
  measure: [
    '그래서 이번에 얼마나 배출했나요?',
    '경제운전 코칭은 안전에도 도움이 되나요?',
    '무엇이 있으면 수단별 기여를 실측으로 올릴 수 있나요?',
  ],
  gap: [
    '이번 운행에서 데이터로 무엇까지 알 수 있나요?',
    '724번 노선을 증차해야 합니까?',
    '이번 운행에서 얼마나 배출했고, 검증기관이 믿을 수 있습니까?',
  ],
  unknown: [
    '이번 운행에서 데이터로 무엇까지 알 수 있나요?',
    '무엇이 있으면 더 답할 수 있나요?',
  ],
}

/** 질문 → 시나리오. 실서비스에서는 LLM이 하지만, **매핑 결과를 반드시 보여 줘야** 한다 */
function route(q: string): { kind: Kind; why: string; scope?: MissionId } {
  const t = q.replace(/\s/g, '')
  /* 「무엇이 있으면」류를 **맨 앞에서** 잡는다. 뒤에 두면 «무엇이 있으면 배출을»이
     탄소로 빠져 후속 질문이 원래 답으로 되돌아간다 — 대화가 제자리를 돈다. */
  if (/있으면|없나요|왜못|못답|더답|필요한데이터|무엇이필요/.test(t)) {
    const scope: MissionId | undefined = /배출|탄소|검증기관/.test(t) ? 'carbon' : /안전|위험|코칭|감점/.test(t) ? 'safety' : /증차|노선|배차|혼잡/.test(t) ? 'policy' : undefined
    return { kind: 'gap', why: '「무엇이 있으면 되나」로 인식 — 못 하는 질문과 그것을 여는 채널을 건다', scope }
  }
  /* 구체적인 주제를 **먼저** 본다. 처음에는 「운행」을 맨 앞에 뒀다가
     «이번 운행에서 얼마나 배출했고»가 탄소가 아니라 운행 1회로 분류됐다 —
     넓은 패턴을 앞에 두면 좁은 패턴이 영영 안 걸린다. */
  if (/수단별|수단마다|무엇이줄|어떤수단|경제운전.*기여|감축수단/.test(t)) return { kind: 'measure', why: '「수단별 기여」로 인식 — 개념 스페이스의 감축 수단을 건다' }
  if (/배출|탄소|감축|co2|검증기관|온실|전기버스/i.test(t)) return { kind: 'carbon', why: '「탄소중립」으로 인식 — 배출 산정·기준선·계수를 건다' }
  if (/위험|코칭|기사|안전|점수|감점|정당|급가속|급감속/.test(t)) return { kind: 'safety', why: '「안전 운전」으로 인식 — 안전점수·위험운전·낭비 요인을 건다' }
  if (/증차|감차|노선|배차|수요|혼잡|정책|재차/.test(t)) return { kind: 'policy', why: '「정책 수립」으로 인식 — 재차율·혼잡 판정·수송 실적을 건다' }
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
      const follow = FOLLOW[r.kind]
      const base: Call[] = [
        { fn: 'grammar.load', arg: currentVersion(), out: `스페이스 ${SPACES.length} · 관계 ${Object.keys(REL_META).length}종`, ok: true },
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
            follow,
            self: r.kind,
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
            follow,
            self: r.kind,
          },
        ])
        setBusy(false)
        return
      }
      /* gap은 그래프가 아니라 «질문 목록»을 건다 — 데이터가 없어서 못 하는 것을 답하는 자리라
         그래프를 순회해 봐야 없는 것이 나올 리 없다. 도구 호출도 그렇게 적는다. */
      const ans = r.kind === 'gap' ? gapAnswer(r.scope) : r.kind === 'measure' ? measureAnswer(gate) : runAgent(r.kind, gate)
      setMsgs((m) => [
        ...m,
        {
          role: 'agent',
          kind: 'answer',
          ans,
          calls: [
            ...base,
            { fn: 'grammar.validate', arg: ans.blocked ? `"${ans.blocked.q.slice(0, 18)}…"` : '질의 관계 확인', out: ans.blocked ? '거부 — 문법에 없는 방향' : '통과', ok: !ans.blocked },
            r.kind === 'gap'
              ? { fn: 'mission.gaps', arg: r.scope ?? '전체', out: `막는 채널 ${ans.cites.length}개`, ok: ans.cites.length > 0 }
              : { fn: 'graph.walk', arg: ans.steps[2]?.detail.slice(0, 30) ?? '', out: `노드 ${ans.cites.length}개 인용`, ok: ans.cites.length > 0 },
            { fn: 'confidence.cap', arg: ans.conf.level, out: `상한 ${ans.conf.pct}%`, ok: true },
            { fn: 'limits.collect', arg: '못 하는 것', out: `${ans.limits.length}건`, ok: true },
          ],
          follow,
          self: r.kind,
        },
      ])
      setBusy(false)
    }, 420)
  }

  /**
   * 이어서 물어보기 — 답변 아래에 붙는다.
   *
   * **지금 답과 같은 시나리오로 가는 칩은 거른다.** 검증에서 「감축 수단별로」를 눌렀더니
   * 탄소 답이 그대로 반복됐다 — 칩은 「다른 것을 보여 주겠다」는 약속이라 어기면 안 된다.
   * 목록을 손으로 적는 이상 또 틀릴 수 있으므로 화면에 나가기 전에 한 번 더 건다.
   */
  const Follow = ({ qs, self }: { qs: string[]; self: Kind }) => {
    const ok = qs.filter((q) => route(q).kind !== self)
    if (!ok.length) return null
    return (
    <div className="mt-2.5 border-t border-gray-800 pt-2">
      <div className="mb-1 text-[10.5px] font-black tracking-wide text-gray-600">이어서 물어보기</div>
      <div className="flex flex-wrap gap-1.5">
        {ok.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            disabled={busy}
            className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 max-[640px]:min-h-[40px] break-keep text-left text-[11.5px] text-violet-200 transition-colors hover:bg-violet-400/20 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-4 py-3">
        <span className="text-[15px] font-black text-violet-300">🤖 AI 에이전트</span>
        <span className="break-keep text-[12px] leading-relaxed text-gray-400">
          온톨로지 <b className="text-gray-200">위에서 도는</b> 서비스입니다. 답의 모든 숫자가 그래프에서 나오고, 못 하는 것은 못 한다고 답합니다.
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!!msgs.length && (
            <button
              onClick={() => setMsgs([])}
              className="mr-1 rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold text-gray-400 transition-colors hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ↺ 새 대화
            </button>
          )}
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
          <div className="py-5">
            <div className="text-center break-keep text-[13px] text-gray-300">
              «{roleOf(role).ko}»로 접속했습니다. <b className="text-violet-300">아래 질문을 눌러 보세요.</b>
            </div>
            <div className="mt-1 text-center break-keep text-[11.5px] text-gray-600">
              답한 뒤에는 <b className="text-gray-400">이어서 물어볼 질문</b>이 따라 나옵니다. 역할을 바꾸면 답변 범위도 달라집니다.
            </div>
            {/* 프리셋 넷만 보이면 «이것만 되나»로 읽힌다. 더 물어볼 수 있는 것을 처음부터 펼쳐 둔다 */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {MORE.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={busy}
                  className="rounded-full border border-gray-800 bg-gray-900/70 px-2.5 py-1 max-[640px]:min-h-[40px] break-keep text-[11.5px] text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {q}
                </button>
              ))}
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

                    <Follow qs={m.follow} self={m.self} />
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
