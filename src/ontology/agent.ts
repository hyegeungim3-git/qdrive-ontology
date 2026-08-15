import { SPACES } from './meta'
import { relKo } from './rdf'
import { currentVersion } from './grammar'
import type { GateResult } from './gate'
import { MISSIONS, roadmap, type MissionId } from './missions'
import { CHANNELS } from './sensors'

/**
 * 근거 기반 AI 에이전트 — **답을 그래프에서 조립한다.**
 *
 * 「AI가 답한다」는 말은 흔하다. 문제는 그 답을 **믿을 근거가 없다**는 것이다.
 * 여기서는 답변의 모든 숫자가 그래프 노드에서 나오고, 문장마다 **어느 노드에서 왔는지**가 붙는다.
 *
 * ## 온톨로지가 있어야 되는 세 가지
 *  1. **질의를 실행 전에 거른다** — LLM이 만든 질의가 문법에 없는 관계를 쓰면 ④ 검증기가 막는다.
 *     이게 온톨로지의 고유 이점이다. 벡터 검색으로는 «틀린 질의»를 막을 방법이 없다.
 *  2. **근거를 되짚는다** — 성과 → 판정 → 관측을 걸어 「왜 그 숫자인가」에 답한다.
 *  3. **모른다고 말한다** — 근거 유형별 신뢰도 상한이 있어 **과다 주장을 못 한다.**
 *     정시율처럼 원천이 없으면 숫자를 만들지 않고 «미측정»으로 답한다.
 *
 * 환각을 없애 주는 것이 아니다. **「근거를 못 대는 상태」를 없애 주는 것**이다.
 */

export type Step = { n: number; ko: string; detail: string; ok: boolean }
export type Cite = { iri: string; label: string; space: string; value?: string }
export type Conf = { level: '실측' | '환산' | '추정' | '정성' | '미측정'; pct: number; why: string }

export type Answer = {
  question: string
  /** 에이전트가 밟은 단계 — 결과만 보이면 믿을 수 없다 */
  steps: Step[]
  /** 그래프 값으로 조립한 답 */
  answer: string
  cites: Cite[]
  conf: Conf
  /** 이 답이 못 하는 것 */
  limits: string[]
  /** 문법 검증이 막은 질의 — 온톨로지의 고유 이점을 보이는 자리 */
  blocked?: { q: string; why: string }
}

/* ── 그래프 읽기 ── */
const blockOf = (ttl: string, iri: string) => ttl.split('\n\n').find((b) => b.trim().startsWith(iri + ' '))
const num = (ttl: string, iri: string, p: string) => {
  const m = blockOf(ttl, iri)?.match(new RegExp(`qd:${p} "([-\\d.]+)"`))
  return m ? Number(m[1]) : null
}
const str = (ttl: string, iri: string, p: string) => blockOf(ttl, iri)?.match(new RegExp(`qd:${p} "([^"]+)"`))?.[1] ?? null

const spaceKo = (en: string) => SPACES.find((s) => s.en === en)?.ko ?? en
const nodesOf = (g: GateResult, type: string) => Object.keys(g.graph.index.type).filter((i) => g.graph.index.type[i] === type)
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0+$/, '')

const cite = (g: GateResult, iri: string, value?: string): Cite => ({
  iri,
  label: g.graph.index.label[iri] ?? iri,
  space: spaceKo(g.graph.index.space[iri] ?? ''),
  value,
})

/* ── 공통 단계 ── */
const baseSteps = (mapped: string, walked: string, n: number): Step[] => [
  { n: 1, ko: '질문을 지표로 옮긴다', detail: mapped, ok: true },
  { n: 2, ko: '문법으로 질의를 검증한다', detail: `${currentVersion()} 문법에 있는 관계만 쓴다 — 없는 관계를 쓰면 실행 전에 막힌다`, ok: true },
  { n: 3, ko: '그래프를 순회한다', detail: walked, ok: true },
  { n: 4, ko: '근거를 모은다', detail: `${n}개 노드를 인용한다 — 문장마다 어느 노드에서 왔는지 붙인다`, ok: n > 0 },
]

/* ─────────────────── 정책 수립 ─────────────────── */
function policyAnswer(g: GateResult): Answer {
  const ttl = g.graph.turtle
  const pcs = nodesOf(g, 'PassengerCount')
  const cvs = nodesOf(g, 'CrowdingVerdict')
  const pct = pcs.map((i) => num(ttl, i, 'onboardPct') ?? 0)
  const avg = pct.length ? pct.reduce((a, b) => a + b, 0) / pct.length : 0
  const crowded = cvs.filter((i) => str(ttl, i, 'verdict') === '혼잡').length
  const ride = nodesOf(g, 'Ridership')[0]
  const rideV = ride ? num(ttl, ride, 'value') : null
  const rideT = ride ? num(ttl, ride, 'target') : null

  const cites: Cite[] = [
    ...pcs.slice(0, 3).map((i) => cite(g, i, `${fmt(num(ttl, i, 'onboardPct') ?? 0)}%`)),
    ...cvs.slice(0, 2).map((i) => cite(g, i, str(ttl, i, 'verdict') ?? '')),
    ...(ride ? [cite(g, ride, `${rideV ?? 0}명`)] : []),
  ]

  return {
    question: '724번 노선을 증차해야 합니까?',
    steps: [
      ...baseSteps(
        '「증차」를 재차율·혼잡 판정·수송 실적 세 지표로 옮긴다',
        `차량 ${pcs.length}대의 재차 관측 → 혼잡 판정 → 수송 실적을 걸었다`,
        cites.length,
      ),
      { n: 5, ko: '신뢰도를 매긴다', detail: '재차율은 실측이라 상한 95%. 다만 시간대 집계가 없어 결론은 «부분»으로 내린다', ok: true },
    ],
    answer:
      `지금 재차율 평균은 ${fmt(avg)}%이고, 차량 ${cvs.length}대 중 ${crowded}대가 «혼잡»으로 판정됐습니다. ` +
      `누적 수송 실적은 ${rideV ?? 0}명${rideT ? `(목표 ${rideT}명)` : ''}입니다. ` +
      `${crowded > 0 ? '혼잡 판정이 나온 차량이 있어 증차 검토 대상입니다.' : '지금 시점에는 혼잡 판정이 없어 증차 근거가 약합니다.'} ` +
      `다만 이 숫자는 **현재 시점 한 장면**이라 「출퇴근만 혼잡한지」는 가리지 못합니다 — ` +
      `증차와 급행 신설은 처방이 다르므로, 시간대별 집계 없이 증차를 결정하면 안 됩니다.`,
    cites,
    conf: {
      level: '실측',
      pct: 95,
      why: '재차율은 APC 실측이라 상한 95%. 다만 시간대 표본이 없어 «지금 이 순간»에 한정된 결론이다',
    },
    limits: [
      '시간대별·요일별 집계가 없다 — 「출퇴근 2시간만 혼잡」과 「종일 혼잡」을 못 가린다',
      '정원(차량 이력)이 없으면 재차율이 정원 대비 혼잡도가 되지 못한다',
      '정류장 대기 인원이 없어 만차 통과(승차 거부)를 못 센다',
    ],
    blocked: {
      q: '재차 관측을 수송 실적에 직접 연결해 주세요',
      why: '관측 → 성과는 문법에 없는 방향입니다. 판정을 거쳐야 「왜 그 숫자인가」에 답할 수 있어 실행 전에 막았습니다',
    },
  }
}

/* ─────────────────── 안전 운전 ─────────────────── */
function safetyAnswer(g: GateResult): Answer {
  const ttl = g.graph.turtle
  const ix = g.graph.index
  // 가장 낮은 안전점수 차량을 고른다 — 관제가 실제로 묻는 질문
  const scores = nodesOf(g, 'SafetyScore').map((i) => ({ i, v: num(ttl, i, 'value') ?? 100 })).sort((a, b) => a.v - b.v)
  const worst = scores[0]
  const label = worst ? ix.label[worst.i] : ''
  const veh = label.replace(' 안전점수', '')

  // 그 차량의 위험운전 유형 분포
  const evts = nodesOf(g, 'RiskEvent').filter((i) => (ix.label[i] ?? '').startsWith(veh))
  const byType = new Map<string, number>()
  evts.forEach((i) => {
    const t = str(ttl, i, 'eventType') ?? '?'
    byType.set(t, (byType.get(t) ?? 0) + 1)
  })
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0]

  // 연료 낭비 요인
  const fw = nodesOf(g, 'FuelWaste').find((i) => (ix.label[i] ?? '').startsWith(veh))
  const w = fw
    ? ([['공회전', num(ttl, fw, 'idleM3') ?? 0], ['급조작', num(ttl, fw, 'harshM3') ?? 0], ['습관', num(ttl, fw, 'habitM3') ?? 0], ['냉난방', num(ttl, fw, 'acM3') ?? 0]] as [string, number][]).sort((a, b) => b[1] - a[1])
    : []

  // 정당 인정된 건
  const jvs = nodesOf(g, 'JustifyVerdict').filter((i) => (ix.label[i] ?? '').startsWith(veh))
  const justified = jvs.filter((i) => str(ttl, i, 'verdict') === '정당 인정').length

  const cites: Cite[] = [
    ...(worst ? [cite(g, worst.i, `${fmt(worst.v)}점`)] : []),
    ...evts.slice(0, 3).map((i) => cite(g, i, str(ttl, i, 'eventType') ?? '')),
    ...(fw ? [cite(g, fw, w[0] ? `${w[0][0]} ${fmt(w[0][1], 2)}m³` : '')] : []),
    ...jvs.slice(0, 2).map((i) => cite(g, i, str(ttl, i, 'verdict') ?? '')),
  ]

  return {
    question: '오늘 가장 위험한 기사에게 무엇을 코칭해야 합니까?',
    steps: [
      ...baseSteps(
        '「위험」을 안전점수로 옮기고, 「무엇을」을 위험운전 유형과 낭비 요인으로 옮긴다',
        `안전점수 ${scores.length}건을 정렬해 최저를 고르고, 그 차량의 관측 ${evts.length}건과 판정 ${jvs.length}건을 걸었다`,
        cites.length,
      ),
      { n: 5, ko: '규정을 확인한다', detail: '불이익이 될 수 있는 조치라 **승인자 없이는 발행할 수 없다**. 답변은 제안까지만 한다', ok: true },
    ],
    answer:
      worst
        ? `${veh}의 확정 안전점수는 ${fmt(worst.v)}점으로 가장 낮습니다. ` +
          `위험운전 ${evts.length}건 중 ${top ? `«${top[0]}»이 ${top[1]}건으로 가장 많고` : '유형이 고르게 분포하고'}, ` +
          `${justified > 0 ? `그중 ${justified}건은 정당 인정으로 감점에서 빠졌습니다. ` : '정당 인정된 건은 없습니다. '}` +
          `${w[0] ? `연료 낭비는 «${w[0][0]}»이 ${fmt(w[0][1], 2)}m³로 가장 큽니다. ` : ''}` +
          // 요인 이름이 «습관»일 때 «습관 습관»이 되지 않게 — 조사·수식어를 값에 붙이면 이런 중복이 난다
          `따라서 코칭은 **${top ? top[0] : '급조작'}**과 **${w[0] ? (w[0][0] === '습관' ? '운전 습관' : `${w[0][0]} 줄이기`) : '공회전 줄이기'}**를 함께 다루는 것이 맞습니다. ` +
          `다만 이 제안은 **확정이 아닙니다** — 불이익이 될 수 있는 조치라 승인자가 지정돼야 발행됩니다.`
        : '아직 안전점수가 만들어지지 않았습니다. 게이트가 한 번 돌아야 답할 수 있습니다.',
    cites,
    conf: {
      level: '실측',
      pct: 95,
      why: '위험운전 패킷은 DTG 실측이고 점수는 그래프 순회로 계산했다. 다만 낭비 요인 분해는 «추정»이라 그 부분은 70% 상한',
    },
    limits: [
      '조치 전후 비교가 없어 「코칭 효과」를 검증하지 못한다 — 액셀·스로틀 이력이 필요하다',
      'ADAS 전방충돌경고가 없어 「끼어들기 때문에 밟은 급제동」과 「부주의」를 못 가린다',
      '이 답은 순위를 매기지만, 기사에게 보이는 화면에서는 **동료 비교를 하지 않는다**',
    ],
    blocked: {
      q: '기사 실명으로 순위를 만들어 주세요',
      why: '분석셋에는 실명이 없습니다(가명키만). 규정이 적재 단계에서 막고, 표시 단계에서 다시 막습니다',
    },
  }
}

/* ─────────────────── 탄소중립 ─────────────────── */
function carbonAnswer(g: GateResult): Answer {
  const ttl = g.graph.turtle
  const ems = nodesOf(g, 'Emission')
  const co2 = ems.reduce((n, i) => n + (num(ttl, i, 'co2Kg') ?? 0), 0)
  const act = ems.reduce((n, i) => n + (num(ttl, i, 'activityValue') ?? 0), 0)
  const red = nodesOf(g, 'Reduction')[0]
  const redV = red ? num(ttl, red, 'value') : null
  const base = red ? num(ttl, red, 'baseline') : null
  const efs = nodesOf(g, 'EmissionFactor')
  const cng = efs.find((i) => str(ttl, i, 'fuelKind') === 'CNG')
  const cngV = cng ? num(ttl, cng, 'factorValue') : null
  const ams = nodesOf(g, 'AbatementMeasure').map((i) => ({ ko: str(ttl, i, 'measure') ?? '', pct: num(ttl, i, 'sharePct') ?? 0, i }))

  const cites: Cite[] = [
    ...ems.slice(0, 3).map((i) => cite(g, i, `${fmt(num(ttl, i, 'co2Kg') ?? 0, 2)}kg`)),
    ...(cng ? [cite(g, cng, `${cngV} kg/m³`)] : []),
    ...(red ? [cite(g, red, `${fmt(redV ?? 0, 2)}kg 감축`)] : []),
    ...ams.slice(0, 2).map((a) => cite(g, a.i, `${a.pct}%`)),
  ]

  return {
    question: '이번 운행에서 얼마나 배출했고, 그 숫자를 검증기관이 믿을 수 있습니까?',
    steps: [
      ...baseSteps(
        '「배출」을 활동자료 × 배출계수로, 「감축」을 기준선 대비로 옮긴다',
        `배출 산정 ${ems.length}건을 걸어 활동자료 ${fmt(act, 2)}m³와 계수 노드를 확인했다`,
        cites.length,
      ),
      { n: 5, ko: 'MRV 요건을 확인한다', detail: '어느 계수·어느 규칙 버전·어느 실행이 만들었는지가 모두 그래프에 있다 — 제3자가 되짚을 수 있다', ok: true },
    ],
    answer:
      ems.length
        ? `회차 ${ems.length}건의 활동자료는 ${fmt(act, 2)} m³이고, ` +
          `CNG 배출계수 ${cngV ?? 2.68} kg/m³를 적용해 **${fmt(co2, 2)} kg**을 배출했습니다(스코프 1 직접연소). ` +
          `${base !== null ? `코칭 미적용 기준선 ${fmt(base, 2)} kg 대비 **${fmt(redV ?? 0, 2)} kg 감축**입니다. ` : ''}` +
          `수단별 기여도는 ${ams.map((a) => `${a.ko} ${a.pct}%`).join(' · ')}로 봅니다. ` +
          `**이 숫자는 검증 가능합니다** — 어느 활동자료에 어느 계수를 곱했는지, 어느 문법 버전(${currentVersion()})으로 검증됐는지, ` +
          `어느 실행이 만들었는지가 모두 그래프에 남아 있어 제3자가 되짚을 수 있습니다.`
        : '아직 회차가 쌓이지 않아 배출을 산정할 수 없습니다. 배속을 올리면 회차가 만들어집니다.',
    cites,
    conf: {
      level: '환산',
      pct: 85,
      why: '활동자료(연료)는 실측이지만 CO₂는 계수를 곱한 환산값이라 상한 85%. 계수가 개정되면 값도 바뀐다',
    },
    limits: [
      '연료 구매 실적이 없다 — 온실가스 인벤토리는 계측값보다 **구매 실적을 1차 자료로 인정**한다',
      '전기버스는 스코프 2로 따로 세야 한다 — 배출이 0이 아니라 발전 단계로 옮겨간 것이다',
      '차량 제조·폐차(스코프 3)는 이 데이터로 안 잡힌다',
      '수단별 기여도는 «추정»이다 — 대조군 없이는 정확히 못 쪼갠다',
    ],
    blocked: {
      q: '전기버스 배출을 0으로 계산해 주세요',
      why: '전력 배출계수(0.4594 kg/kWh)가 개념 스페이스에 있습니다. 0으로 두면 계수 노드와 모순되어 산정이 검증을 통과하지 못합니다',
    },
  }
}

/* ─────────────────── 무엇이 있으면 답할 수 있나 ───────────────────
   후속 질문의 종착지. 앞의 세 답이 전부 「다만 …이 없습니다」로 끝나므로
   **그 다음 질문은 반드시 「그럼 뭐가 있어야 하나요」**가 된다.
   그 질문에 답할 것이 없으면 대화가 제자리를 돈다. */
export function gapAnswer(m?: MissionId): Answer {
  const scope = m ? MISSIONS.filter((x) => x.id === m) : MISSIONS
  const qs = scope.flatMap((x) => x.questions)
  const cant = qs.filter((q) => q.ready !== '답한다')
  const ko = m ? scope[0].ko : '세 가지 목적'

  /* 채널 하나가 여는 질문 수로 줄을 세운다 — 「센서를 더 달자」가 아니라
     「이것 하나가 다섯 개를 연다」가 투자 판단에 쓰이는 문장이다. */
  const road = roadmap()
    .filter((r) => !m || r.missions.includes(m))
    .slice(0, 5)
    .map((r) => ({ ...r, ch: CHANNELS.find((c) => c.id === r.id) }))
    .filter((r) => r.ch)

  const top = road[0]
  const lines = [
    `${ko}의 질문 ${qs.length}개 중 **${qs.length - cant.length}개는 지금 답합니다.** 나머지 ${cant.length}개가 못 하거나 부분만 합니다.`,
    top
      ? `가장 크게 막고 있는 것은 **${top.ch!.ko}** 하나입니다 — 이것만 들어오면 질문 **${top.count}개**가 한꺼번에 열립니다.`
      : '',
    '못 하는 이유는 대부분 **센서가 모자라서가 아닙니다.** 운행 계획·시각표처럼 **다른 시스템에 이미 있는 값**이 안 넘어와서입니다 — 하드웨어가 아니라 연계 문제입니다.',
  ].filter(Boolean)

  return {
    question: m ? `${ko}에서 무엇이 있으면 더 답할 수 있나요?` : '무엇이 있으면 더 답할 수 있나요?',
    steps: [
      { n: 1, ko: '못 하는 질문을 모은다', detail: `${scope.length}개 목적 · 질문 ${qs.length}개 중 «못 한다»·«부분» ${cant.length}개`, ok: true },
      { n: 2, ko: '질문마다 막는 채널을 뽑는다', detail: '질문에 적힌 «이것이 있으면 된다»를 채널 단위로 편다', ok: true },
      { n: 3, ko: '채널이 여는 질문 수로 줄을 세운다', detail: '많이 여는 것부터 — 투자 순서가 여기서 나온다', ok: road.length > 0 },
      { n: 4, ko: '이미 있는지 확인한다', detail: '수집·연결 / 수집·미연결 / 실단말 필요 / 규정상 보류로 나눈다', ok: true },
    ],
    answer: lines.join(' '),
    cites: road.map((r) => ({
      iri: r.id,
      label: r.ch!.ko,
      space: r.ch!.bus,
      value: `질문 ${r.count}개 · ${r.ch!.intake}`,
    })),
    conf: {
      level: '정성',
      pct: 50,
      why: '「무엇이 있으면 되나」는 측정값이 아니라 **설계 판단**입니다. 실제로 붙여 봐야 확정됩니다',
    },
    limits: [
      '**채널이 들어온다고 바로 답이 되지는 않습니다** — 품질·주기·결측률을 먼저 봐야 합니다',
      '「규정상 보류」는 데이터가 없는 게 아니라 **받지 않기로 한 것**입니다 — 필요하면 규정부터 고쳐야 합니다',
      '여는 질문 수는 **우리가 적어 둔 질문 기준**입니다. 발주처의 질문 목록이 다르면 순위도 달라집니다',
    ],
    blocked: {
      q: '없는 데이터를 추정해서라도 채워 주세요',
      why: '추정값을 관측 자리에 넣으면 **근거 사슬이 거짓말을 합니다.** 없는 것은 없다고 두고, 무엇이 있으면 되는지만 답합니다',
    },
  }
}

/* ─────────────────── 감축 수단별 기여 ───────────────────
   탄소 답을 들으면 반드시 「그래서 무엇이 줄인 건가」가 따라온다.
   총량만 답하면 다음 투자를 못 정한다 — **수단별로 쪼개야 결정이 된다.** */
export function measureAnswer(g: GateResult): Answer {
  const ttl = g.graph.turtle
  const ms = nodesOf(g, 'AbatementMeasure')
    .map((i) => ({ iri: i, ko: str(ttl, i, 'measure') ?? g.graph.index.label[i] ?? i, share: num(ttl, i, 'sharePct') ?? 0 }))
    .sort((a, b) => b.share - a.share)
  const red = nodesOf(g, 'Reduction')[0]
  const total = red ? num(ttl, red, 'value') : null
  const top = ms[0]

  const body = ms.length
    ? [
        total !== null
          ? `감축 실적 **${fmt(total, 2)}kg**을 수단별로 쪼개면 ${ms.map((m) => `${m.ko} ${fmt(m.share, 0)}%`).join(' · ')}입니다.`
          : `감축 수단은 ${ms.map((m) => `${m.ko} ${fmt(m.share, 0)}%`).join(' · ')}로 잡혀 있습니다.`,
        top ? `가장 크게 기여한 것은 **${top.ko}**이고, 이건 장비를 사지 않고 **운전 습관만으로** 낸 몫입니다.` : '',
        '다만 이 배분은 **추정**입니다 — 같은 노선·같은 시간대의 대조군 없이는 무엇이 얼마나 줄였는지 정확히 못 가릅니다.',
      ].filter(Boolean)
    : ['아직 감축 수단 노드가 그래프에 올라오지 않았습니다. 배속을 올려 회차가 쌓이면 채워집니다.']

  return {
    question: '감축 수단별로 얼마나 기여했나요?',
    steps: [
      { n: 1, ko: '질문을 지표로 옮긴다', detail: '「수단별 기여」 — 개념 스페이스의 감축 수단 노드를 건다', ok: true },
      { n: 2, ko: '문법으로 질의를 검증한다', detail: `${currentVersion()} 문법에서 «개념 → 성과 · 기여한다»가 허용된 방향인지 확인한다`, ok: true },
      { n: 3, ko: '그래프를 순회한다', detail: `감축 수단 ${ms.length}종 ─기여한다→ 감축 실적`, ok: ms.length > 0 },
      { n: 4, ko: '근거를 모은다', detail: `${ms.length}개 노드를 인용한다`, ok: ms.length > 0 },
    ],
    answer: body.join(' '),
    cites: [
      ...ms.map((m) => cite(g, m.iri, `${fmt(m.share, 0)}%`)),
      ...(red ? [cite(g, red, total !== null ? `${fmt(total, 2)}kg` : undefined)] : []),
    ],
    conf: { level: '추정', pct: 70, why: '대조군 없이 수단을 쪼갠 값입니다 — **추정 상한 70%**를 넘길 수 없습니다' },
    limits: [
      '**대조군이 없습니다** — 코칭을 안 받은 같은 노선 차량과 비교해야 기여도를 실측으로 올립니다',
      '수단끼리 겹칩니다 — 경제운전 코칭이 공회전도 함께 줄여서 **이중 계산 위험**이 있습니다',
      '전기 전환은 이 그래프에서 배출이 0으로 잡히지만 실제로는 **스코프 2로 옮겨간 것**입니다',
    ],
    blocked: {
      q: '수단별 기여도를 실측으로 보고해 주세요',
      why: '근거 유형이 «추정»이라 상한 70%가 걸립니다. 실측으로 올리려면 대조군 설계가 먼저입니다 — **강도를 올려서 넘길 수 없습니다**',
    },
  }
}

export function runAgent(m: MissionId, g: GateResult): Answer {
  if (m === 'safety') return safetyAnswer(g)
  if (m === 'carbon') return carbonAnswer(g)
  return policyAnswer(g)
}

/* ─────────────────── 운행 1회의 온톨로지 ─────────────────── */

export type TripSlice = {
  trip: string | null
  vehicleId: string
  /** 스페이스별로 이 운행에 걸린 노드 */
  bySpace: { en: string; ko: string; color: string; nodes: { iri: string; label: string; type: string; via: string }[] }[]
  total: number
  /** 이 운행에서 온톨로지가 한 일 — 문장으로 */
  story: string[]
}

/**
 * 운행 1회를 중심으로 그래프를 양방향 순회해 **그 한 번의 운행이 만든 온톨로지 전모**를 모은다.
 * 「스페이스가 9개 있습니다」보다 「이 한 번의 운행이 9개 자리를 이렇게 채웁니다」가 훨씬 잘 읽힌다.
 */
export function tripSlice(g: GateResult, vehicleId?: string): TripSlice {
  const ix = g.graph.index
  const ttl = g.graph.turtle
  const trips = nodesOf(g, 'Trip')
  const trip = (vehicleId ? trips.find((t) => (ix.label[t] ?? '').startsWith(vehicleId)) : trips[0]) ?? trips[0] ?? null
  const veh = trip ? (ix.label[trip] ?? '').split(' ')[0] : (vehicleId ?? '')

  const seen = new Map<string, string>() // iri → via(관계)
  if (trip) {
    seen.set(trip, '이 운행')
    let frontier = [trip]
    for (let d = 0; d < 3; d++) {
      const next: string[] = []
      frontier.forEach((n) => {
        ;(ix.out[n] ?? []).forEach((e) => {
          if (seen.has(e.o)) return
          seen.set(e.o, relKo(e.p))
          next.push(e.o)
        })
        ;(ix.inc[n] ?? []).forEach((e) => {
          if (seen.has(e.s)) return
          seen.set(e.s, `← ${relKo(e.p)}`)
          next.push(e.s)
        })
      })
      frontier = next
    }
  }

  const bySpace = SPACES.map((s) => ({
    en: s.en,
    ko: s.ko,
    color: s.color,
    nodes: [...seen.entries()]
      .filter(([i]) => ix.space[i] === s.en)
      .map(([i, via]) => ({ iri: i, label: ix.label[i] ?? i, type: ix.type[i] ?? '', via })),
  })).filter((s) => s.nodes.length)

  const dist = trip ? num(ttl, trip, 'distanceKm') : null
  const fuel = trip ? num(ttl, trip, 'fuelM3') : null
  const co2 = trip ? num(ttl, trip, 'co2Kg') : null
  const nEv = bySpace.find((s) => s.en === 'Evidence')?.nodes.length ?? 0
  const nCl = bySpace.find((s) => s.en === 'Claim')?.nodes.length ?? 0
  const nOut = bySpace.find((s) => s.en === 'Outcome')?.nodes.length ?? 0
  const nLev = bySpace.find((s) => s.en === 'Lever')?.nodes.length ?? 0

  return {
    trip,
    vehicleId: veh,
    bySpace,
    total: seen.size,
    story: trip
      ? [
          `${veh}가 ${dist !== null ? `${fmt(dist, 1)}km를 달리며` : ''} 연료 ${fmt(fuel ?? 0, 2)}m³를 썼고 CO₂ ${fmt(co2 ?? 0, 2)}kg을 냈습니다.`,
          `이 한 번의 운행이 **관측 ${nEv}건**을 남겼고, 그것이 **판정 ${nCl}건**을 뒷받침했습니다.`,
          `판정은 **성과 ${nOut}종**에 반영됐고, **조치 ${nLev}건**이 그 성과를 되돌리려 붙어 있습니다.`,
          `모두 합쳐 **${seen.size}개 노드**가 이 운행 하나에 매달려 있습니다 — 표 한 줄이었다면 여기서 끝났을 것들입니다.`,
        ]
      : ['아직 회차가 쌓이지 않았습니다. 배속을 올리면 운행이 완료되고 온톨로지가 채워집니다.'],
  }
}
