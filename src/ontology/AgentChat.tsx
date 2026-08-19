import { useEffect, useRef, useState } from 'react'
import { ink } from './ink'
import { Emph } from '../components/ui'
import { gapAnswer, measureAnswer, runAgent, tripSlice, type Answer } from './agent'
import { answerQuestion, type QaResult } from '../sim/ontologyQa'
import { useSim } from '../sim/store'
import { buildReport, buildReportJson, weakest, type Section } from './report'
import { copyToClipboard } from '../components/ui'
import ReportDoc from './ReportDoc'
import { useGate, type GateResult } from './gate'
import { currentVersion } from './grammar'
import { SPACES } from './meta'
import { REL_META } from './standards'
import { roleOf, useRole, type RoleId } from './policy'
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
  | { role: 'agent'; kind: 'answer'; ans: Answer; calls: Call[]; follow: string[]; self: Kind; sec: Section }
  | { role: 'agent'; kind: 'trip'; calls: Call[]; follow: string[]; self: Kind; sec: Section }
  | { role: 'agent'; kind: 'onto'; res: QaResult; calls: Call[]; follow: string[]; self: Kind; sec: Section }
  | { role: 'agent'; kind: 'unknown'; text: string; need: string[]; calls: Call[]; follow: string[]; self: Kind }

type Call = { fn: string; arg: string; out: string; ok: boolean }

/** 시나리오. gap은 «그럼 뭐가 있어야 하나요»의 종착지 — 후속 질문이 갈 곳이 있어야 대화가 돈다 */
type Kind = 'trip' | MissionId | 'gap' | 'measure' | 'onto' | 'unknown'

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
  '이 주행은 영업인가 공차인가',
  '이 급감속은 어떤 노선·날씨에서 났나',
  '이 차고지가 만든 공차는 얼마인가',
  '이 감축은 코칭 때문인가 유가 때문인가',
  '무엇이 있으면 더 답할 수 있나요?',
  '정시율은 왜 못 답하나요?',
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
  /* 공차·운행유형은 오래 「못 답하는 질문」이었다. 운행 단위에 유형·차고지 축이 붙으면서
     답이 나오게 됐으니, 후속 칩도 gap이 아니라 **나머지 세 질문**으로 잇는다. */
  onto: [
    '이 차고지가 만든 공차는 얼마인가',
    '이 감축은 코칭 때문인가 유가 때문인가',
    '무엇이 있으면 더 답할 수 있나요?',
  ],
  unknown: [
    '이번 운행에서 데이터로 무엇까지 알 수 있나요?',
    '무엇이 있으면 더 답할 수 있나요?',
  ],
}

/**
 * 「맥락이 붙으면 비로소 답할 수 있는 질문」 4종으로 가는 길.
 *
 * 일반 키워드 라우터를 그대로 앞에 두면 «724번 노선을 증차해야 합니까»가 «노선»에 걸려
 * 정책 시나리오를 가로챈다. 그래서 **이 시나리오에만 있는 말**(공차·영업·차고지·유가 …)이
 * 실제로 나온 질문만 여기로 보낸다.
 */
const ONTO_SIGNAL = /공차|영업|차고지|회송|운행유형|유가|급감속.*(노선|날씨)|(노선|날씨).*급감속/

/** 질문 → 시나리오. 실서비스에서는 LLM이 하지만, **매핑 결과를 반드시 보여 줘야** 한다 */
function route(q: string): { kind: Kind; why: string; scope?: MissionId } {
  const t = q.replace(/\s/g, '')
  /* 운행유형·차고지 축이 붙어 답이 가능해진 질문들. 「무엇이 있으면」보다 앞에 둔다 —
     «공차 거리를 알 수 있나요»는 이제 gap이 아니라 실제로 답이 나오는 질문이기 때문이다. */
  if (ONTO_SIGNAL.test(t)) return { kind: 'onto', why: '「운행 단위에 맥락이 붙어야 답하는 질문」으로 인식 — 운행유형·차고지·기상 축을 건다' }
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

  /**
   * 보고서 — **대화를 넘길 수 있는 문서로 바꾼다.**
   * 채팅은 물어본 사람만 본다. 업무는 「그래서 문서로 주세요」에서 끝난다.
   */
/**
 * 보고서 — **대화를 넘길 수 있는 문서로 바꾼다.**
 * 채팅은 물어본 사람만 본다. 업무는 「그래서 문서로 주세요」에서 끝난다.
 *
 * **모듈 스코프에 둔다.** 부모 안에서 정의하면 렌더마다 새 컴포넌트 타입이 되어
 * React가 언마운트 후 다시 만든다 — 게이트가 3초마다 도는 이 앱에서는
 * 그때마다 문서 스크롤이 맨 위로 튕겨 읽을 수가 없다.
 */
function ReportView({
  secs, gate, role, busy, runAll, docTab, setDocTab, copied, setCopied,
}: {
  secs: Section[]
  gate: GateResult
  role: RoleId
  busy: boolean
  runAll: () => void
  docTab: 'doc' | 'raw'
  setDocTab: (v: 'doc' | 'raw') => void
  copied: boolean
  setCopied: (v: boolean) => void
}) {
    const md = buildReport(secs, gate, role)
    const w = weakest(secs)
    const save = (text: string, ext: string, mime: string) => {
      const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
      const a = document.createElement('a')
      a.href = url
      a.download = `qdrive-분석보고서.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    }
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
          <div>
            <div className="text-[13px] font-black text-gray-100">분석 결과보고 — 공문서 서식</div>
            <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">
              지금까지 물어본 <b className="text-gray-300">{secs.length}개 항목</b>을 결재에 올릴 수 있는 서식으로 조립합니다 — 통계표·붙임·결재란까지.
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button
              onClick={runAll}
              disabled={busy}
              className="rounded-md border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⚡ 대표 6항목 한 번에
            </button>
            <button
              onClick={async () => {
                setCopied(await copyToClipboard(md))
                window.setTimeout(() => setCopied(false), 1600)
              }}
              disabled={!secs.length}
              className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-gray-300 hover:text-gray-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {copied ? '✓ 복사됨' : '📋 복사'}
            </button>
            <button
              onClick={() => save(md, 'md', 'text/markdown')}
              disabled={!secs.length}
              className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-gray-300 hover:text-gray-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⬇ Markdown
            </button>
            <button
              onClick={() => save(buildReportJson(secs, gate, role), 'json', 'application/ld+json')}
              disabled={!secs.length}
              className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-gray-300 hover:text-gray-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⬇ JSON-LD
            </button>
            <button
              onClick={() => window.print()}
              disabled={!secs.length}
              className="rounded-md border border-gray-700 bg-gray-800/60 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-gray-300 hover:text-gray-100 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              🖨 인쇄 / PDF
            </button>
          </div>
        </div>

        {!!secs.length && (
          <div className="grid grid-cols-4 gap-2 max-[820px]:grid-cols-2">
            {[
              { n: String(secs.length), ko: '분석 항목', sub: '질문 하나가 한 절', c: '#a78bfa' },
              { n: String(secs.reduce((a, s) => a + s.cites.length, 0)), ko: '근거 노드', sub: '수치마다 되짚기 가능', c: '#34d399' },
              /* 종합 등급은 최저 등급을 따른다 — 화면에도 그 이유를 적어 둬야 «왜 95가 아니지»가 안 생긴다 */
              { n: w ? `${w.pct}%` : '—', ko: `신뢰도 상한 · ${w?.level ?? '—'}`, sub: '가장 약한 근거를 따름', c: '#fbbf24' },
              { n: String(new Set(secs.flatMap((s) => s.limits)).size), ko: '못 하는 것', sub: '숨기지 않고 문서에', c: '#fb7185' },
            ].map((k) => (
              <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
                <div className="text-xl font-black tabular-nums" style={{ color: ink(k.c) }}>
                  {k.n}
                </div>
                <div className="mt-0.5 break-keep text-[11.5px] font-bold text-gray-300">{k.ko}</div>
                <div className="break-keep text-[11px] text-gray-600">{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {/* 문서 보기가 기본 — 받는 사람이 실제로 보게 될 모양이 먼저다.
                원문 텍스트는 다른 문서에 붙여 넣을 때 쓴다. */}
            {([['doc', '문서 보기'], ['raw', '원문 텍스트']] as const).map(([k, ko]) => (
              <button
                key={k}
                onClick={() => setDocTab(k)}
                className={`rounded-md border px-2.5 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  docTab === k ? 'border-sky-400/50 bg-sky-400/15 text-sky-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
                }`}
              >
                {ko}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-gray-600">
              {docTab === 'doc' ? `절 ${secs.length}개 · 근거 ${secs.reduce((a, x) => a + x.cites.length, 0)}개` : `${md.length.toLocaleString()}자`}
            </span>
          </div>
          {docTab === 'doc' ? (
            <ReportDoc secs={secs} gate={gate} role={role} />
          ) : (
            <pre className="max-h-[34rem] overflow-auto rounded-lg bg-gray-950 px-3 py-2.5 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-gray-300">
              {md}
            </pre>
          )}
        </div>

        <div className="rounded-xl border px-4 py-3 break-keep text-[12px] leading-relaxed text-emerald-200" style={{ borderColor: '#34d39933', background: '#34d3990d' }}>
          <b>규정이 「원본 그래프는 반출 대상이 아닙니다 — 집계·보고서로 받습니다」라고 적어 둔 자리입니다.</b> 원본 내보내기는 역할에 따라
          막히지만, 이 보고서는 <b>모든 역할이 받을 수 있습니다</b> — 실명은 이미 가려졌고 수치는 집계이며, 되짚을 IRI만 남습니다. 금지에 대안이
          없으면 그 규정은 지켜지지 않습니다.
        </div>
      </div>
    )
}

  /**
   * 이어서 물어보기 — 답변 아래에 붙는다.
   *
   * **지금 답과 같은 시나리오로 가는 칩은 거른다.** 검증에서 「감축 수단별로」를 눌렀더니
   * 탄소 답이 그대로 반복됐다 — 칩은 「다른 것을 보여 주겠다」는 약속이라 어기면 안 된다.
   * 목록을 손으로 적는 이상 또 틀릴 수 있으므로 화면에 나가기 전에 한 번 더 건다.
   */
function Follow({ qs, self, busy, ask }: { qs: string[]; self: Kind; busy: boolean; ask: (q: string) => void }) {
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

export default function AgentChat() {
  const gate = useGate()
  const role = useRole()
  const [mode, setMode] = useState<'chat' | 'agent' | 'report'>('chat')
  const [copied, setCopied] = useState(false)
  const [docTab, setDocTab] = useState<'doc' | 'raw'>('doc')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  /* 답은 «누른 순간»의 스냅샷으로 계산한다. setTimeout 안에서 읽으므로 ref로 최신값을 들고 간다 */
  const snap = useSim()
  const snapRef = useRef(snap)
  snapRef.current = snap

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
      if (r.kind === 'onto') {
        const res = answerQuestion(snapRef.current, q)
        if (res) {
          setMsgs((m) => [
            ...m,
            {
              role: 'agent',
              kind: 'onto',
              res,
              calls: [
                ...base,
                { fn: 'graph.walk', arg: res.path.join(' '), out: `근거 ${res.evidence.length}항목`, ok: !res.empty },
                { fn: 'engine.aggregate', arg: res.id, out: res.empty ? '아직 쌓인 데이터 없음' : '스냅샷에서 실계산', ok: !res.empty },
                { fn: 'limits.collect', arg: '못 하는 것', out: res.caveat ? '예시 상수 1건 고지' : '없음', ok: true },
              ],
              follow,
              self: r.kind,
              sec: {
                q,
                kind: 'trip',
                answer: `${res.headline} — ${res.detail.replace(/\*\*/g, '')}`,
                cites: res.evidence.map((e) => ({ iri: `qd:${res.id}/${e.k}`, label: e.k, space: '운행', value: e.v })),
                conf: res.caveat
                  ? { level: '환산', pct: 85, why: '회송거리는 예시 상수이며 나머지는 엔진 실측입니다' }
                  : { level: '실측', pct: 95, why: '지금 돌아가는 엔진의 집계값입니다' },
                limits: res.caveat ? [res.caveat] : ['이 답은 실증 9대 범위의 집계입니다 — 시 전체로 확대 해석하지 않습니다'],
              },
            },
          ])
          setBusy(false)
          return
        }
        /* 신호는 걸렸는데 어느 질문인지 못 좁힌 경우 — 지어내지 않고 못 한다고 답한다 */
        setMsgs((m) => [
          ...m,
          {
            role: 'agent',
            kind: 'unknown',
            text: '운행유형·차고지 쪽 질문 같은데, 어느 것을 묻는지 좁히지 못했습니다.',
            need: ['「이 주행은 영업인가 공차인가」처럼 물어 주세요 — 아래 칩을 눌러도 됩니다'],
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
            /* 운행 1회는 Answer가 아니라 그래프 조각이라 절을 여기서 만든다.
               스페이스마다 대표 노드 하나씩만 인용한다 — 86개를 전부 적으면 표가 보고서를 잡아먹는다. */
            sec: {
              q,
              kind: 'trip',
              answer: s.story.join(' ').replace(/\*\*/g, ''),
              cites: s.bySpace.map((sp) => ({ iri: sp.nodes[0].iri, label: sp.nodes[0].label, space: sp.ko, value: `이 운행에 걸린 노드 ${sp.nodes.length}개` })),
              conf: { level: '실측', pct: 95, why: '회차·관측은 단말이 낸 실측값입니다' },
              limits: [
                '한 회차만 펼친 것입니다 — 노선 전체의 경향은 이 표로 말할 수 없습니다',
                '운행 계획(시각표)이 없어 이 회차가 정시였는지는 판단하지 않았습니다',
              ],
            },
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
          sec: { q, kind: r.kind, answer: ans.answer, cites: ans.cites, conf: ans.conf, limits: ans.limits, blocked: ans.blocked },
        },
      ])
      setBusy(false)
    }, 420)
  }

  /* 절은 답을 만들 때 함께 만들어 둔다 — 나중에 화면에서 긁어모으면
     화면 표기와 문서가 갈라진다. 같은 질문을 두 번 물으면 뒤엣것만 남긴다. */
  const secs: Section[] = (() => {
    const byQ = new Map<string, Section>()
    msgs.forEach((m) => {
      if (m.role === 'agent' && 'sec' in m && m.sec) byQ.set(`${m.sec.kind}·${m.sec.q}`, m.sec)
    })
    return [...byQ.values()]
  })()

  /** 대표 질문 한 벌 — 「보고서 한 번에 만들기」가 이 순서로 돈다 */
  const runAll = async () => {
    const qs = [PRESETS[0].q, PRESETS[1].q, PRESETS[2].q, PRESETS[3].q, '감축 수단별로 얼마나 기여했나요?', '무엇이 있으면 더 답할 수 있나요?']
    for (const q of qs) {
      ask(q)
      // ask가 420ms 뒤에 답을 넣으므로 그보다 넉넉히 기다린다 — 겹치면 busy로 씹힌다
      await new Promise((r) => window.setTimeout(r, 620))
    }
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
          {(['chat', 'agent', 'report'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                mode === m ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'chat' ? '💬 채팅' : m === 'agent' ? '⚙ 에이전트' : `📄 보고서${secs.length ? ` ${secs.length}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {mode === 'report' ? (
        <ReportView secs={secs} gate={gate} role={role} busy={busy} runAll={runAll} docTab={docTab} setDocTab={setDocTab} copied={copied} setCopied={setCopied} />
      ) : (
      <>
      {/* 대화 */}
      <div className={`rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-3 ${msgs.length ? 'min-h-[280px]' : ''}`}>
        {/**
         * 빈 화면에서는 **여기 한 곳에만** 질문을 둔다.
         * 처음엔 예시를 대화 영역에, 프리셋을 입력창 위에 뒀더니 같은 성격의 것이 두 군데로 갈라져
         * «무엇을 눌러야 하나»가 됐다. 아래 프리셋 줄은 **대화가 시작된 뒤에만** 나온다 —
         * 그때는 «주제를 바꾸는 자리»라는 뜻이 분명해진다.
         */}
        {!msgs.length && (
          <div className="py-6">
            <div className="text-center break-keep text-[13px] text-gray-300">
              «{roleOf(role).ko}»로 접속했습니다. <b className="text-violet-300">궁금한 것을 눌러 보세요.</b>
            </div>
            {/* «답한 뒤에는 이어서 물어볼 질문이 따라 나옵니다»를 적었다가 뺐다.
                화면이 하는 일을 화면이 설명하면 잔소리가 된다 — 눌러 보면 아는 것은 적지 않는다. */}
            <div className="mt-1 text-center break-keep text-[11.5px] text-gray-600">
              역할을 바꾸면 볼 수 있는 것과 답변 범위가 달라집니다.
            </div>

            {/* 대표 넷 — 색으로 주제를 구분한다 */}
            <div className="mx-auto mt-4 grid max-w-[720px] grid-cols-2 gap-2 max-[560px]:grid-cols-1">
              {PRESETS.map((p) => (
                <button
                  key={p.q}
                  onClick={() => ask(p.q)}
                  disabled={busy}
                  className="rounded-lg border px-3 py-2.5 max-[640px]:min-h-[44px] text-left transition-colors hover:brightness-125 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
                  style={{ borderColor: `${p.c}44`, background: `${p.c}0d` }}
                >
                  <div className="text-[11px] font-black" style={{ color: ink(p.c) }}>
                    {p.tag}
                  </div>
                  <div className="mt-0.5 break-keep text-[12.5px] leading-relaxed text-gray-200">{p.q}</div>
                </button>
              ))}
            </div>

            {/* 넷만 보이면 «이것만 되나»로 읽힌다 — 더 물어볼 수 있는 것을 함께 펼친다 */}
            <div className="mx-auto mt-3 max-w-[720px]">
              <div className="mb-1.5 text-center text-[10.5px] font-black tracking-wide text-gray-600">이런 것도 물어볼 수 있습니다</div>
              <div className="flex flex-wrap justify-center gap-1.5">
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

                    {m.kind === 'onto' && (
                      <>
                        <div className="mb-2 flex flex-wrap items-center gap-1">
                          <span className="text-[10.5px] font-semibold text-gray-500">근거 사슬</span>
                          {m.res.path.map((p, k) => (
                            <span key={k} className="rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-300">
                              {p}
                            </span>
                          ))}
                        </div>
                        <div className="break-keep text-[13.5px] font-bold leading-relaxed text-gray-50">{m.res.headline}</div>
                        <div className="mt-1.5 break-keep text-[12.5px] leading-relaxed text-gray-300">
                          <Emph t={m.res.detail} cls="text-gray-100" />
                        </div>
                        {m.res.evidence.length > 0 && (
                          <div className="mt-2.5 overflow-x-auto rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-1.5">
                            <table className="w-full text-left text-[11.5px]">
                              <tbody>
                                {m.res.evidence.map((e, k) => (
                                  <tr key={k} className="border-b border-gray-800/50 last:border-0">
                                    <td className="w-[42%] py-1.5 pr-3 break-keep align-top text-gray-500">{e.k}</td>
                                    <td className="py-1.5 break-keep font-semibold text-gray-200">{e.v}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {m.res.caveat && (
                          <div className="mt-2 break-keep text-[11px] leading-relaxed text-amber-200/80">※ {m.res.caveat}</div>
                        )}
                      </>
                    )}

                    {m.kind === 'answer' && (
                      <>
                        <div className="break-keep text-[13.5px] leading-relaxed text-gray-50">
                          <Emph t={m.ans.answer} cls="text-gray-50" />
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
                          <span className="rounded-md px-2 py-1 text-[11px] font-black text-emerald-300" style={{ background: '#34d3991a' }}>
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

                    <Follow qs={m.follow} self={m.self} busy={busy} ask={ask} />
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
        {/* 대화가 시작된 뒤에만 — 그때는 «주제를 바꾸는 자리»라는 뜻이 분명하다.
            빈 화면에도 두면 같은 버튼이 두 군데에 있어 어느 쪽을 눌러야 하는지 헷갈린다. */}
        <div className={`flex-wrap gap-1.5 ${msgs.length ? 'flex' : 'hidden'}`}>
          {PRESETS.map((p) => (
            <button
              key={p.q}
              onClick={() => ask(p.q)}
              disabled={busy}
              className="rounded-lg border px-2.5 py-1.5 max-[640px]:min-h-[40px] text-left text-[11.5px] transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
              style={{ borderColor: `${p.c}44`, background: `${p.c}0d` }}
            >
              <span className="font-black" style={{ color: ink(p.c)}}>
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

      <div className="rounded-xl border px-4 py-3 break-keep text-[12px] leading-relaxed text-violet-200" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d' }}>
        <b>온톨로지가 환각을 없애 주지는 않습니다.</b> 없애 주는 것은 <b>「근거를 못 대는 상태」</b>입니다. 위 답변의 모든 숫자에는 어느 노드에서
        왔는지가 붙어 있고, 못 하는 것은 못 한다고 적혀 있습니다. <b>⚙ 에이전트</b>로 바꾸면 그 답이 나오기까지 무엇을 호출했는지가 보입니다 —
        특히 <b>문법 검증이 잘못된 질의를 실행 전에 거르는 것</b>이 벡터 검색만으로는 안 되는 부분입니다.
      </div>
      </>
      )}
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
            <Emph t={t} cls="text-gray-50" />
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 max-[820px]:grid-cols-2 max-[520px]:grid-cols-1">
        {s.bySpace.map((sp) => (
          <div key={sp.en} className="rounded-lg border bg-gray-950/40 px-2 py-1.5" style={{ borderColor: `${sp.color}3a` }}>
            <div className="flex items-baseline gap-1">
              <span className="text-[11.5px] font-black" style={{ color: ink(sp.color)}}>
                {sp.ko}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-gray-500">{sp.nodes.length}</span>
            </div>
            <div className="mt-0.5 space-y-0.5">
              {sp.nodes.slice(0, 4).map((n) => (
                <div key={n.iri} className="truncate text-[10.5px] text-gray-400">
                  {n.label} <span style={{ color: ink(sp.color)}}>«{n.via}»</span>
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
