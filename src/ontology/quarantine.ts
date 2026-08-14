import { useSyncExternalStore } from 'react'
import { META_EDGES, SPACES, type SpaceId } from './meta'
import type { ChangeKind } from './impactmeta'
import { REL_META } from './standards'
import type { Finding } from './validate'

/**
 * 품질 격리 큐 — SHACL이 잡은 레코드가 실제로 「보류」되는 곳.
 *
 * 운영 플랫폼(데이터 관리자)의 격리 큐는 룰별 **건수**를 다룬다. 여기는 SHACL이 위반 노드를
 * 정확히 지목하므로 **레코드 단위**로 다룰 수 있고, 온톨로지가 있으니 한 가지를 더 할 수 있다 —
 * 이 레코드를 보류하면 **어떤 성과가 흔들리는지**를 관계를 걸어 계산해 함께 보여주는 것.
 *
 * 원칙 세 가지.
 *  1) 격리는 삭제가 아니다. 원본 그대로 보관하고, 하류(정제 저장소·분석셋)로만 안 내려보낸다.
 *  2) 어떤 위반은 예외 승인으로 통과시킬 수 없다. 규정이 «자동화하지 않는다»고 말한 것들.
 *  3) 처리에는 사람 이름이 남는다. 누가 무엇을 근거로 풀어 줬는지가 곧 감사 근거다.
 */

export type QAction = '재처리' | '예외 승인' | '원천 수정 요청'
export type QStatus = '격리' | QAction

export type QItem = {
  id: string
  /** 시뮬레이션 시각 (초) */
  at: number
  focusIri: string
  focus: string
  focusLabel: string
  focusType: string
  focusSpace: string
  path: string
  constraint: string
  severity: Finding['severity']
  message: string
  engine: Finding['engine']
  downstream: string[]
  status: QStatus
  note?: string
  decidedBy?: string
  /** 처리 시각 */
  doneAt?: number
}

/** 처리 방법 정의 — 왜 이 조치를 쓰는가 */
export const ACTIONS: { id: QAction; ko: string; desc: string; tone: string; needsNote: boolean }[] = [
  { id: '재처리', ko: '재처리', desc: '원인이 해소돼 다시 적재한다 — 단말 시각 보정·통신 복구 등', tone: '#38bdf8', needsNote: false },
  { id: '예외 승인', ko: '예외 승인', desc: '규칙은 맞지만 이 건은 정당하다고 담당자가 판단한다 — 사유가 남는다', tone: '#f59e0b', needsNote: true },
  { id: '원천 수정 요청', ko: '원천 수정 요청', desc: '원천 시스템이 잘못 보내고 있다 — 커넥터 담당에게 넘긴다', tone: '#a78bfa', needsNote: false },
]

/**
 * 예외 승인으로 풀 수 없는 위반.
 * 「불이익 결정은 자동화하지 않는다」·「분석셋에 실명을 두지 않는다」는 규정 스페이스에 못 박혀 있다.
 * 큐에서 클릭 한 번으로 우회할 수 있으면 그 규정은 장식이 된다.
 */
export const NO_WAIVER: Record<string, string> = {
  'MinCount:decidedBy':
    '「불이익 결정 자동화 금지」 규정에 걸립니다 — 예외 승인으로 통과시킬 수 없습니다. 담당자가 실제로 확정해야만 풀립니다.',
  'MaxCount:driverName': '「가명 처리」 규정에 걸립니다 — 실명이 섞인 레코드는 예외로 통과시킬 수 없습니다. 원천에서 제거해야 합니다.',
  'Closed:driverName': '문법에 없는 식별 정보입니다 — 예외 승인 대상이 아니라 원천 수정 대상입니다.',
}
export const waiverBlock = (i: QItem) => NO_WAIVER[`${i.constraint}:${i.path}`]

/* ── 저장소 ── */
let items: QItem[] = []
const listeners = new Set<() => void>()
const emit = () => {
  items = [...items]
  listeners.forEach((l) => l())
}

const keyOf = (f: { focusIri: string; constraint: string; path: string }) => `${f.focusIri}|${f.constraint}|${f.path}`

/** 검증 결과를 큐에 적재한다. 같은 레코드·같은 제약은 다시 넣지 않는다. */
export function enqueue(findings: Finding[], simTime: number): number {
  const known = new Set(items.map(keyOf))
  const fresh = findings.filter((f) => f.severity !== 'Info' && !known.has(keyOf(f)))
  if (!fresh.length) return 0
  items = [
    ...fresh.map((f) => ({
      id: keyOf(f),
      at: simTime,
      focusIri: f.focusIri,
      focus: f.focus,
      focusLabel: f.focusLabel,
      focusType: f.focusType,
      focusSpace: f.focusSpace,
      path: f.path,
      constraint: f.constraint,
      severity: f.severity,
      message: f.message,
      engine: f.engine,
      downstream: f.downstream,
      status: '격리' as QStatus,
    })),
    ...items,
  ]
  emit()
  return fresh.length
}

export function resolve(id: string, action: QAction, simTime: number, decidedBy: string, note?: string) {
  items = items.map((i) => (i.id === id ? { ...i, status: action, decidedBy, note, doneAt: simTime } : i))
  emit()
}

export function reopen(id: string) {
  items = items.map((i) => (i.id === id ? { ...i, status: '격리' as QStatus, decidedBy: undefined, note: undefined, doneAt: undefined } : i))
  emit()
}

export function clearAll() {
  items = []
  emit()
}

export function useQuarantine(): QItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => items,
  )
}

/** 큐 요약 — 배지·KPI용 */
export function qStats(list: QItem[]) {
  const held = list.filter((i) => i.status === '격리')
  return {
    total: list.length,
    held: held.length,
    done: list.length - held.length,
    blocked: held.filter((i) => !!waiverBlock(i)).length,
    outcomes: [...new Set(held.flatMap((i) => i.downstream))],
  }
}

/* ═══════════════ 격리 이력 → 액티브 메타데이터 ═══════════════
   「액티브」 메타데이터라고 이름 붙였으면 실제로 움직여야 한다.
   계보·의존성은 문법에서 나오지만, 사용량·파급은 **실제로 무슨 일이 있었나**에서 나온다.
   레코드가 격리됐다는 것은 그것이 하류로 안 내려갔다는 뜻이고, 그게 곧 사용량의 사실이다. */

export type SpaceBehavior = {
  /** 이 스페이스에서 격리된 총 레코드 */
  total: number
  held: number
  reprocessed: number
  waived: number
  sourceFix: number
  /** 격리로 하류 전달이 막힌 성과 */
  outcomes: string[]
  /** 걸린 규칙들 */
  rules: string[]
}

/** 스페이스 영문명(Evidence 등) 기준 — 데이터 그래프의 스페이스 클래스와 같은 값 */
export function spaceBehavior(list: QItem[], spaceEn: string): SpaceBehavior | null {
  const mine = list.filter((i) => i.focusSpace === spaceEn)
  if (!mine.length) return null
  const by = (s: QStatus) => mine.filter((i) => i.status === s).length
  return {
    total: mine.length,
    held: by('격리'),
    reprocessed: by('재처리'),
    waived: by('예외 승인'),
    sourceFix: by('원천 수정 요청'),
    outcomes: [...new Set(mine.filter((i) => i.status === '격리').flatMap((i) => i.downstream))],
    rules: [...new Set(mine.map((i) => `sh:${i.constraint} ${i.path}`))],
  }
}

/* ═══════════════ 규칙 역제안 ═══════════════
   큐는 규칙이 데이터에게 하는 말만 담는 곳이 아니다. 반대 방향도 있다.
   같은 규칙이 계속 예외 승인으로 풀린다면, 틀린 것은 데이터가 아니라 규칙일 수 있다.

   처리 방식의 분포가 곧 진단이다.
     예외 승인이 많다  → 규칙이 현실과 안 맞는다      (규칙을 고쳐라)
     재처리가 많다     → 원천이 일시적으로 흔들렸다   (규칙은 옳다, 단말·통신을 봐라)
     원천 수정 요청 많음 → 원천이 계속 잘못 보낸다     (커넥터를 고쳐라)

   단, 규정에서 온 규칙(NO_WAIVER)은 이 역제안의 대상이 아니다.
   예외가 쌓였다고 「불이익 결정 자동화 금지」를 완화하자고 말하면 안 된다 — 현실을 규칙에 맞춰야 한다. */

export type Verdict = '규칙 재검토' | '원천 점검' | '커넥터 점검' | '관찰 중'

export type RuleFeedback = {
  key: string
  constraint: string
  path: string
  /** 규칙이 실제로 뱉은 메시지 — 무슨 규칙인지 사람이 알아보게 */
  message: string
  total: number
  held: number
  reprocessed: number
  waived: number
  sourceFix: number
  verdict: Verdict
  suggestion: string
  /** 규정에서 온 규칙이라 완화 대상이 아닌 경우의 이유 */
  protectedBy?: string
  /** 담당자가 실제로 적은 사유 */
  notes: string[]
  spaces: string[]
}

/** 역제안이 켜지는 최소 건수 — 한 건으로 규칙을 바꾸자고 하면 그게 더 위험하다 */
export const FEEDBACK_MIN = 2

const SUGGEST: Record<string, string> = {
  In: '개념 스페이스의 코드 목록이 현실을 못 담고 있습니다. 다만 표준을 늘리기 전에 원천 매핑부터 보세요 — 표준 밖 값이 들어오는 건 대개 매핑 문제입니다.',
  MaxInclusive: '상한이 실측 분포와 안 맞습니다. 실제 값 분포를 다시 재고 임계값을 조정하세요.',
  MinInclusive: '하한이 실측 분포와 안 맞습니다. 실제 값 분포를 다시 재고 임계값을 조정하세요.',
  MinCount: '필수 지정이 과할 수 있습니다. 이 관계·속성이 정말 모든 레코드에 있어야 하는지 문법에서 다시 판단하세요.',
  MaxCount: '카디널리티가 현실과 다릅니다. 문법의 1:N·N:M 지정을 다시 보세요.',
  Closed: '문법에 없는 술어가 반복 유입됩니다. 관계 어휘에 추가할지, 원천에서 뺄지 결정해야 합니다.',
  SPARQL: '임계값을 실측 분포로 재산정하세요. 규칙의 방향은 맞지만 경계가 어긋난 경우입니다.',
}

/* ── 규칙을 고친다는 것은 문법을 고친다는 것 ──
   「임계값을 올리자」는 말은 듣기엔 작지만, 문법에서 보면 값 수정이고 그 스페이스에서 시작하는 전파가 있다.
   제안을 ⑦ 영향 분석이 이해하는 «스페이스 × 변경 유형»으로 환산해, 같은 전파 엔진에 그대로 넣는다.
   그래야 «고치자»와 «고치면 이만큼 흔들린다»가 같은 화면에서 붙는다. */
export type RuleChange = { change: ChangeKind; ko: string; space: SpaceId; note: string }

const CHANGE_OF: Record<string, { change: ChangeKind; ko: string; space?: SpaceId; note: string }> = {
  In: { change: 'create', ko: '개념 스페이스에 코드값 추가', space: 'concept', note: '표준 코드 목록을 늘리는 일 — 다른 도시·기관과의 호환이 함께 흔들린다' },
  MaxInclusive: { change: 'update', ko: '값 범위 상한 조정', note: '기준값을 고치는 일 — 이미 이 기준으로 만든 판정·집계를 다시 계산해야 한다' },
  MinInclusive: { change: 'update', ko: '값 범위 하한 조정', note: '기준값을 고치는 일 — 이미 이 기준으로 만든 판정·집계를 다시 계산해야 한다' },
  SPARQL: { change: 'update', ko: '도메인 규칙 임계값 재산정', note: '규칙의 방향은 두고 경계만 옮기는 일 — 과거 판정의 재평가 범위를 정해야 한다' },
  MinCount: { change: 'relRemove', ko: '필수 지정 해제 — 없어도 통과', note: '필수를 풀면 이 관계가 빈 레코드가 생긴다 — 그걸 전제로 짠 하류 계산이 흔들린다' },
  MaxCount: { change: 'relAdd', ko: '카디널리티 완화 — 여러 개 허용', note: '하나만 오던 자리에 여러 개가 온다 — 집계·조인 방식을 다시 봐야 한다' },
  Closed: { change: 'relAdd', ko: '관계 어휘에 추가 — 문법 확장', note: '문법에 새 방향을 여는 일 — 문법 v1.1로 올려야 하고 내보내기 산출물이 전부 바뀐다' },
}

const spaceIdOf = (en: string): SpaceId => SPACES.find((s) => s.en === en)?.id ?? 'evidence'

export function ruleChange(f: RuleFeedback): RuleChange | null {
  const c = CHANGE_OF[f.constraint]
  if (!c) return null
  return { change: c.change, ko: c.ko, space: c.space ?? spaceIdOf(f.spaces[0] ?? ''), note: c.note }
}

/**
 * 문법 밖 술어가 반복 유입될 때, ④ 문법 검증에서 눌러 볼 조합을 만든다.
 * 「이 관계를 여기서 쓰면 정말 막히나」를 큐에서 바로 확인할 수 있어야 한다.
 */
export function validatorPreset(f: RuleFeedback): { from: SpaceId; to: SpaceId; rel: string } | null {
  if (f.constraint !== 'Closed') return null
  const ko = Object.keys(REL_META).find((k) => REL_META[k].en === f.path)
  if (!ko) return null
  const from = spaceIdOf(f.spaces[0] ?? '')
  // 이 관계가 원래 허용된 방향의 도착지 — 출발만 바꿔 놓으면 ④가 «이 방향은 문법에 없다»고 답한다
  const to = META_EDGES.find((e) => e.relations.includes(ko))?.to
  if (!to || to === from) return null
  return { from, to, rel: ko }
}

export function ruleFeedback(list: QItem[]): RuleFeedback[] {
  const groups = new Map<string, QItem[]>()
  list.forEach((i) => {
    const k = `${i.constraint}:${i.path}`
    groups.set(k, [...(groups.get(k) ?? []), i])
  })

  return [...groups.entries()]
    .map(([key, items]) => {
      const n = (s: QStatus) => items.filter((i) => i.status === s).length
      const waived = n('예외 승인')
      const reprocessed = n('재처리')
      const sourceFix = n('원천 수정 요청')
      const resolved = waived + reprocessed + sourceFix
      const protectedBy = NO_WAIVER[key]

      let verdict: Verdict = '관찰 중'
      let suggestion = `아직 처리 이력이 적습니다 — 같은 규칙이 ${FEEDBACK_MIN}건 이상 같은 방식으로 풀리면 진단을 냅니다.`
      if (waived >= FEEDBACK_MIN && waived * 2 >= resolved) {
        verdict = '규칙 재검토'
        suggestion = SUGGEST[items[0].constraint] ?? '같은 규칙이 반복해서 예외로 풀립니다. 규칙 정의를 다시 보세요.'
      } else if (reprocessed >= FEEDBACK_MIN && reprocessed * 2 >= resolved) {
        verdict = '원천 점검'
        suggestion = '규칙은 유지하세요 — 재처리로 풀린 건이 많다는 것은 원천이 일시적으로 흔들렸다는 뜻입니다. 단말·통신 쪽을 보세요.'
      } else if (sourceFix >= FEEDBACK_MIN && sourceFix * 2 >= resolved) {
        verdict = '커넥터 점검'
        suggestion = '원천 시스템이 계속 규격을 어기고 있습니다. 커넥터의 정규화·매핑 규칙을 고쳐야 합니다.'
      }

      // 규정에서 온 규칙은 예외가 쌓여도 완화 대상이 아니다
      if (protectedBy && verdict === '규칙 재검토') verdict = '관찰 중'

      return {
        key,
        constraint: items[0].constraint,
        path: items[0].path,
        message: items[0].message,
        total: items.length,
        held: n('격리'),
        reprocessed,
        waived,
        sourceFix,
        verdict,
        suggestion: protectedBy
          ? '이 규칙은 규정에서 왔습니다 — 예외가 쌓여도 완화 근거가 되지 않습니다. 규칙이 아니라 현실을 고쳐야 합니다.'
          : suggestion,
        protectedBy,
        notes: items.map((i) => i.note).filter((x): x is string => !!x),
        spaces: [...new Set(items.map((i) => i.focusSpace))],
      }
    })
    .sort((a, b) => {
      const rank = (v: Verdict) => (v === '규칙 재검토' ? 0 : v === '커넥터 점검' ? 1 : v === '원천 점검' ? 2 : 3)
      return rank(a.verdict) - rank(b.verdict) || b.total - a.total
    })
}
