import { currentVersion } from './grammar'
import { clock } from './validity'
import { roleOf, type RoleId } from './policy'
import type { GateResult } from './gate'
import type { Cite, Conf } from './agent'

/**
 * 보고서 산출 — **대화를 넘길 수 있는 문서로 바꾼다.**
 *
 * 채팅은 물어본 사람만 본다. 실제 업무는 «그래서 문서로 주세요»에서 끝난다.
 * 그런데 LLM이 쓴 보고서의 문제는 **읽는 사람이 숫자를 확인할 방법이 없다**는 것이다.
 * 그래서 이 보고서는 세 가지를 반드시 함께 낸다.
 *
 *  1. **모든 수치에 근거 노드** — 어느 IRI에서 나온 값인지가 문장 옆에 붙는다
 *  2. **못 하는 것** — 각 절과 종합에 남긴다. 못 하는 것이 없는 보고서는 의심스럽다
 *  3. **규칙이 막은 질의** — 물어봤지만 답하면 안 되는 것이었음을 기록한다.
 *     이건 «안 한 일»의 기록이라 보통은 어디에도 안 남는다
 *
 * 그리고 **종합 등급은 가장 약한 근거를 따른다.** 실측 세 절에 추정 한 절이 섞이면
 * 보고서 등급은 추정이다 — 평균을 내면 약한 근거가 강한 근거 뒤에 숨는다.
 *
 * 규정과의 연결: 「원본 내보내기」는 역할에 따라 막히지만 그 금지 사유가
 * **«집계·보고서로 받습니다»**였다. 이 보고서가 그 문장의 실행이다 — 모든 역할이 받을 수 있다.
 */

export type Section = {
  q: string
  /** 시나리오 — 무엇을 물은 것인가 */
  kind: string
  answer: string
  cites: Cite[]
  conf: Conf
  limits: string[]
  blocked?: { q: string; why: string }
}

const ORDER: Conf['level'][] = ['미측정', '정성', '추정', '환산', '실측']
/** 가장 약한 근거가 보고서의 등급 — 평균을 내면 약한 근거가 강한 근거 뒤에 숨는다 */
export function weakest(secs: Section[]): Conf | null {
  if (!secs.length) return null
  return secs.reduce((a, b) => (ORDER.indexOf(b.conf.level) < ORDER.indexOf(a.conf.level) ? b : a)).conf
}

const KIND_KO: Record<string, string> = {
  trip: '운행 1회 분석',
  policy: '정책 수립 검토',
  safety: '안전 운전 진단',
  carbon: '온실가스 산정',
  measure: '감축 수단별 기여',
  gap: '데이터 확보 계획',
  unknown: '답변 불가',
}

const uniq = (xs: string[]) => [...new Set(xs)]

export function buildReport(secs: Section[], g: GateResult, role: RoleId): string {
  const w = weakest(secs)
  const nCite = secs.reduce((n, s) => n + s.cites.length, 0)
  const blocked = secs.filter((s) => s.blocked)
  const L: string[] = []

  L.push('# 대구 시내버스 운행 데이터 분석 보고서')
  L.push('')
  L.push(`> 온톨로지 기반 근거 분석 · 문법 ${currentVersion()} · 작성 ${roleOf(role).ko}`)
  L.push('')

  /* 머리말 — 「왜 이 문서를 믿을 수 있나」를 맨 앞에 둔다.
     뒤에 두면 읽는 사람이 이미 숫자를 믿거나 안 믿기로 정한 뒤다. */
  L.push('## 이 보고서를 어떻게 확인하나')
  L.push('')
  L.push('| | |')
  L.push('|---|---|')
  L.push(`| 근거 노드 | **${nCite}개** — 모든 수치에 어느 노드에서 나왔는지가 붙어 있습니다 |`)
  L.push(`| 종합 근거 등급 | **${w ? `${w.level} · 신뢰도 상한 ${w.pct}%` : '—'}** ${w ? `(${w.why.replace(/\*\*/g, '')})` : ''} |`)
  L.push(`| 답하지 못한 것 | **${uniq(secs.flatMap((s) => s.limits)).length}건** — 아래 별도 절에 전부 적었습니다 |`)
  L.push(`| 규칙이 막은 질의 | **${blocked.length}건** — 물었지만 답하면 안 되는 것이었습니다 |`)
  L.push('')
  L.push('종합 등급은 **가장 약한 근거**를 따릅니다. 평균을 내면 약한 근거가 강한 근거 뒤에 숨습니다.')
  L.push('')

  if (!secs.length) {
    L.push('*아직 분석 항목이 없습니다. 에이전트에 질문을 하면 이 자리에 절이 생깁니다.*')
    return L.join('\n')
  }

  L.push('---')
  L.push('')
  secs.forEach((s, i) => {
    L.push(`## ${i + 1}. ${KIND_KO[s.kind] ?? '분석'}`)
    L.push('')
    L.push(`**질문** — ${s.q}`)
    L.push('')
    L.push(s.answer.replace(/\*\*/g, '**'))
    L.push('')
    if (s.cites.length) {
      L.push('### 근거')
      L.push('')
      L.push('| 스페이스 | 노드 | 값 | IRI |')
      L.push('|---|---|---|---|')
      s.cites.forEach((c) => L.push(`| ${c.space} | ${c.label} | ${c.value ?? '—'} | \`${c.iri}\` |`))
      L.push('')
    }
    L.push(`**근거 등급** — ${s.conf.level} · 신뢰도 상한 ${s.conf.pct}%. ${s.conf.why.replace(/\*\*/g, '')}`)
    L.push('')
    if (s.limits.length) {
      L.push('**이 항목이 답하지 못하는 것**')
      L.push('')
      s.limits.forEach((x) => L.push(`- ${x}`))
      L.push('')
    }
    if (s.blocked) {
      L.push(`**규칙이 막은 질의** — “${s.blocked.q}”`)
      L.push('')
      L.push(`> ${s.blocked.why}`)
      L.push('')
    }
  })

  L.push('---')
  L.push('')
  L.push('## 이 보고서가 답하지 못한 것')
  L.push('')
  L.push('데이터로 답할 수 없는 것을 적지 않으면, 읽는 사람은 **답한 범위를 실제보다 넓게** 이해합니다.')
  L.push('')
  uniq(secs.flatMap((s) => s.limits)).forEach((x) => L.push(`- ${x}`))
  L.push('')

  if (blocked.length) {
    L.push('## 규칙이 실행 전에 막은 질의')
    L.push('')
    L.push('아래 질의는 **문법에 없는 관계**를 쓰거나 **규정이 금지한 범위**였습니다.')
    L.push('답을 만들어 낸 뒤 걸러낸 것이 아니라 **실행하기 전에** 막았습니다.')
    L.push('')
    L.push('| 막힌 질의 | 사유 |')
    L.push('|---|---|')
    blocked.forEach((s) => L.push(`| ${s.blocked!.q} | ${s.blocked!.why.replace(/\*\*/g, '')} |`))
    L.push('')
  }

  L.push('## 재현 정보')
  L.push('')
  L.push('같은 시점·같은 문법으로 다시 돌리면 같은 숫자가 나옵니다.')
  L.push('')
  L.push('| 항목 | 값 |')
  L.push('|---|---|')
  L.push(`| 문법 버전 | ${currentVersion()} |`)
  L.push(`| 검증 시각 | ${clock(g.at)} (시뮬레이션 시각) |`)
  L.push(`| 그래프 규모 | 노드 ${g.graph.subjects}개 · 트리플 ${g.graph.triples}개 |`)
  L.push(`| 적재 검증 | ${g.ms}ms · 위반으로 하류에서 제외된 레코드 ${g.held.size}건 |`)
  L.push(`| 작성 역할 | ${roleOf(role).ko} (${roleOf(role).org}) — 이 역할이 볼 수 있는 범위에서만 조립됐습니다 |`)
  L.push('')
  L.push('> 격리 **0건**이 곧 «데이터가 깨끗하다»는 뜻은 아닙니다. 검사를 실제로 돌렸는지 함께 확인해야 합니다.')
  L.push('')
  L.push('## 확인')
  L.push('')
  L.push('| 작성 | 검토 | 승인 |')
  L.push('|---|---|---|')
  L.push('| | | |')
  L.push('')
  L.push(`*이 문서는 온톨로지 그래프에서 자동 조립됐습니다. 문장의 모든 수치는 위 IRI로 되짚을 수 있습니다.*`)

  return L.join('\n')
}

/** 기계가 받아 쓰도록 — 근거 IRI가 그대로 들어간다 */
export function buildReportJson(secs: Section[], g: GateResult, role: RoleId): string {
  const w = weakest(secs)
  return JSON.stringify(
    {
      '@context': { '@vocab': 'https://qdrive.ai/ontology/' },
      title: '대구 시내버스 운행 데이터 분석 보고서',
      grammarVersion: currentVersion(),
      author: { role, ko: roleOf(role).ko },
      /* 보고서 등급은 최저 등급을 따른다 — JSON을 받아 쓰는 쪽도 같은 규칙을 알아야 한다 */
      confidence: w ? { level: w.level, cap: w.pct / 100, rule: 'weakest-of-sections' } : null,
      provenance: {
        simTime: clock(g.at),
        nodes: g.graph.subjects,
        triples: g.graph.triples,
        validationMs: g.ms,
        heldRecords: g.held.size,
      },
      sections: secs.map((s) => ({
        kind: s.kind,
        question: s.q,
        answer: s.answer.replace(/\*\*/g, ''),
        confidence: { level: s.conf.level, cap: s.conf.pct / 100 },
        evidence: s.cites.map((c) => ({ '@id': c.iri, label: c.label, space: c.space, value: c.value ?? null })),
        limitations: s.limits.map((x) => x.replace(/\*\*/g, '')),
        blockedQuery: s.blocked ? { query: s.blocked.q, reason: s.blocked.why.replace(/\*\*/g, '') } : null,
      })),
      limitations: uniq(secs.flatMap((s) => s.limits)).map((x) => x.replace(/\*\*/g, '')),
    },
    null,
    2,
  )
}
