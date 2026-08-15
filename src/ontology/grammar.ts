import { useSyncExternalStore } from 'react'
import { META_EDGES, spaceOf, type MetaEdge, type SpaceId } from './meta'
import { REL_META, TYPE_PROPS, type PropDef, type RelMeta } from './standards'
import { DISABLED_RULES, FUEL_LIMIT } from './rules'
export { DISABLED_RULES } from './rules'
import type { ChangeKind } from './impactmeta'

/**
 * 문법 발행 — 개정안을 실제로 반영하고 버전을 올린다.
 *
 * 여기가 고리의 마지막 마디다. ⑩이 «이 규칙을 고치자»고 제안하는 데서 멈추면, 온톨로지는 여전히
 * 손으로 고쳐야 하는 문서다. 발행이 버전 라벨만 바꾸는 것도 마찬가지 — 그건 연극이다.
 *
 * 그래서 **발행하면 문법 정의 자체를 갈아끼운다.** 발행 뒤에는
 *   ④ 문법 검증이 그 조합을 허용하고,
 *   ⑨ SHACL이 같은 결함을 더 이상 잡지 않고,
 *   ⑬ 내보내기가 새 버전으로 나온다.
 *
 * 구조: **파생은 순수 함수, 반영은 별도 단계**로 나눈다.
 *   derive(스냅샷, 개정안) → 새 스냅샷   (부작용 없음 — 발행 전 미리보기를 같은 함수로 낸다)
 *   commit(스냅샷)                        (여기서만 살아 있는 정의를 갈아끼운다)
 * 이렇게 두면 «발행하면 무엇이 바뀌나»를 발행하기 전에 정확히 계산할 수 있다.
 */

export type AmendKind = 'relAdd' | 'requiredOff' | 'enumAdd' | 'rangeAdjust' | 'thresholdAdjust' | 'domainRuleOff'

export type Amendment = {
  /** 근거가 된 규칙 (constraint:path) — 개정안 하나에 같은 규칙이 두 번 들어가지 않게 */
  id: string
  kind: AmendKind
  ko: string
  detail: string
  /** ⑦ 영향 분석에 그대로 넘기는 좌표 */
  space: SpaceId
  change: ChangeKind
  /** 이 개정을 요구한 이력 */
  basis: { held: number; waived: number; notes: string[] }
  payload: Record<string, unknown>
}

/** 어느 한 시점의 문법 전체 */
export type Snapshot = {
  edges: MetaEdge[]
  rel: Record<string, RelMeta>
  props: Record<string, PropDef[]>
  fuelMax: number
  disabled: string[]
}

export type Release = {
  version: string
  at: number
  approvedBy: string
  amendments: Amendment[]
  /** 발행 직후의 문법 — 버전 간 비교의 근거 */
  snapshot: Snapshot
}

const snap = (): Snapshot => ({
  edges: structuredClone(META_EDGES),
  rel: structuredClone(REL_META),
  props: structuredClone(TYPE_PROPS),
  fuelMax: FUEL_LIMIT.max,
  disabled: [...DISABLED_RULES],
})

/** 최초 정의 v1.0 — 되돌리기와 비교의 기준점 */
const BASE: Snapshot = snap()

/* ── 파생 (순수) ── */
export function derive(from: Snapshot, amendments: Amendment[]): Snapshot {
  const s = structuredClone(from)
  amendments.forEach((a) => {
    const p = a.payload as Record<string, never>
    switch (a.kind) {
      case 'relAdd': {
        const { from: f, to, rel, bow } = p as unknown as { from: SpaceId; to: SpaceId; rel: string; bow?: number }
        const edge = s.edges.find((e) => e.from === f && e.to === to)
        if (edge) {
          if (!edge.relations.includes(rel)) edge.relations.push(rel)
        } else {
          // 새 방향을 여는 경우 — 곡률을 함께 넣는다. 직선으로 두면 사이의 노드를 관통해 그려진다.
          s.edges.push({ from: f, to, relations: [rel], desc: `${a.ko} (개정으로 추가)`, bow: bow ?? 70 })
        }
        break
      }
      case 'requiredOff': {
        const { rel } = p as unknown as { rel: string }
        if (s.rel[rel]) s.rel[rel].required = false
        break
      }
      case 'enumAdd': {
        const { type, prop, code } = p as unknown as { type: string; prop: string; code: string }
        const def = s.props[type]?.find((x) => x.name === prop)
        if (def?.oneOf && !def.oneOf.includes(code)) def.oneOf.push(code)
        break
      }
      case 'rangeAdjust': {
        const { type, prop, max } = p as unknown as { type: string; prop: string; max: number }
        const def = s.props[type]?.find((x) => x.name === prop)
        if (def) def.max = max
        break
      }
      case 'thresholdAdjust': {
        const { max } = p as unknown as { max: number }
        s.fuelMax = max
        break
      }
      case 'domainRuleOff': {
        const { rule } = p as unknown as { rule: string }
        if (!s.disabled.includes(rule)) s.disabled.push(rule)
        break
      }
    }
  })
  return s
}

/**
 * 반영 — 살아 있는 정의를 갈아끼운다.
 * 배열·객체의 **정체성을 유지**해야 한다. 새 객체를 대입하면 이미 import한 화면들이 옛 참조를 계속 본다.
 */
function commit(s: Snapshot) {
  META_EDGES.length = 0
  META_EDGES.push(...structuredClone(s.edges))
  Object.keys(REL_META).forEach((k) => delete REL_META[k])
  Object.assign(REL_META, structuredClone(s.rel))
  Object.keys(TYPE_PROPS).forEach((k) => delete TYPE_PROPS[k])
  Object.assign(TYPE_PROPS, structuredClone(s.props))
  FUEL_LIMIT.max = s.fuelMax
  DISABLED_RULES.clear()
  s.disabled.forEach((r) => DISABLED_RULES.add(r))
}

/* ── 상태 ── */
let draft: Amendment[] = []
let releases: Release[] = []
const listeners = new Set<() => void>()
const emit = () => {
  draft = [...draft]
  releases = [...releases]
  listeners.forEach((l) => l())
}

export const currentVersion = () => (releases.length ? releases[releases.length - 1].version : 'v1.0')
export const currentSnapshot = (): Snapshot => (releases.length ? releases[releases.length - 1].snapshot : BASE)
/** 버전 목록 — 비교 화면의 선택지 */
export const versions = () => ['v1.0', ...releases.map((r) => r.version)]
export const snapshotOf = (version: string): Snapshot =>
  version === 'v1.0' ? BASE : (releases.find((r) => r.version === version)?.snapshot ?? BASE)

export function addToDraft(a: Amendment): boolean {
  if (draft.some((x) => x.id === a.id)) return false
  draft = [...draft, a]
  emit()
  return true
}
export function removeFromDraft(id: string) {
  draft = draft.filter((x) => x.id !== id)
  emit()
}

/** 개정안을 발행한다 — 여기서 문법이 실제로 바뀐다 */
export function publish(approvedBy: string, at: number): Release | null {
  if (!draft.length) return null
  const next = derive(currentSnapshot(), draft)
  commit(next)
  const r: Release = { version: `v1.${releases.length + 1}`, at, approvedBy, amendments: draft, snapshot: next }
  releases = [...releases, r]
  draft = []
  emit()
  return r
}

/** 전체 되돌리기 — 최초 정의로 복원한다 */
export function revertAll() {
  commit(BASE)
  releases = []
  draft = []
  emit()
}

/* ═══════════════ 버전 비교 ═══════════════
   개정의 값어치는 «무엇이 늘었나»만이 아니라 «무엇이 그대로인가»에도 있다.
   그래서 바뀐 것만 세지 않고, 안 바뀐 항목 수도 함께 낸다. */

export type DiffKind = 'add' | 'remove' | 'change'
export type DiffRow = { area: string; key: string; before: string; after: string; kind: DiffKind }

export type Diff = {
  rows: DiffRow[]
  /** 요약 수치 — 나란히 놓을 좌우 값 */
  stats: { ko: string; before: string; after: string; moved: boolean }[]
}

const edgeKey = (e: { from: SpaceId; to: SpaceId }) => `${e.from}→${e.to}`
const edgeKo = (e: { from: SpaceId; to: SpaceId }) => `${spaceOf(e.from).ko} → ${spaceOf(e.to).ko}`
const relCount = (s: Snapshot) => new Set(s.edges.flatMap((e) => e.relations)).size
const comboCount = (s: Snapshot) => s.edges.reduce((n, e) => n + e.relations.length, 0)

export function diff(a: Snapshot, b: Snapshot): Diff {
  const rows: DiffRow[] = []

  /* 관계 방향 — 늘어난 방향 · 사라진 방향 */
  const aEdges = new Map(a.edges.map((e) => [edgeKey(e), e]))
  const bEdges = new Map(b.edges.map((e) => [edgeKey(e), e]))
  bEdges.forEach((e, k) => {
    if (!aEdges.has(k)) rows.push({ area: '관계 방향', key: edgeKo(e), before: '없음', after: `허용 (${e.relations.join(' · ')})`, kind: 'add' })
  })
  aEdges.forEach((e, k) => {
    if (!bEdges.has(k)) rows.push({ area: '관계 방향', key: edgeKo(e), before: `허용 (${e.relations.join(' · ')})`, after: '없음', kind: 'remove' })
  })

  /* 방향별 관계 어휘 */
  bEdges.forEach((be, k) => {
    const ae = aEdges.get(k)
    if (!ae) return
    const added = be.relations.filter((r) => !ae.relations.includes(r))
    const removed = ae.relations.filter((r) => !be.relations.includes(r))
    added.forEach((r) => rows.push({ area: '관계 어휘', key: `${edgeKo(be)} «${r}»`, before: '쓸 수 없음', after: '허용', kind: 'add' }))
    removed.forEach((r) => rows.push({ area: '관계 어휘', key: `${edgeKo(be)} «${r}»`, before: '허용', after: '쓸 수 없음', kind: 'remove' }))
  })

  /* 관계 메타 — 필수 지정·카디널리티 */
  Object.keys(b.rel).forEach((ko) => {
    const x = a.rel[ko]
    const y = b.rel[ko]
    if (!x || !y) return
    if (x.required !== y.required)
      rows.push({ area: '필수 지정', key: `«${ko}»`, before: x.required ? '필수' : '선택', after: y.required ? '필수' : '선택', kind: 'change' })
    if (x.card !== y.card) rows.push({ area: '카디널리티', key: `«${ko}»`, before: x.card, after: y.card, kind: 'change' })
  })

  /* 노드 타입 속성 — 열거값·값 범위 */
  Object.keys(b.props).forEach((type) => {
    const ap = a.props[type]
    const bp = b.props[type]
    if (!ap || !bp) return
    bp.forEach((y) => {
      const x = ap.find((p) => p.name === y.name)
      if (!x) {
        rows.push({ area: '속성', key: `${type}.${y.name}`, before: '없음', after: '추가됨', kind: 'add' })
        return
      }
      const ax = x.oneOf ?? []
      const ay = y.oneOf ?? []
      ay.filter((v) => !ax.includes(v)).forEach((v) => rows.push({ area: '열거값', key: `${type}.${y.name}`, before: `${ax.length}종`, after: `«${v}» 추가 (${ay.length}종)`, kind: 'add' }))
      ax.filter((v) => !ay.includes(v)).forEach((v) => rows.push({ area: '열거값', key: `${type}.${y.name}`, before: `«${v}» 포함`, after: '제거됨', kind: 'remove' }))
      if (x.max !== y.max) rows.push({ area: '값 범위', key: `${type}.${y.name} 상한`, before: String(x.max ?? '없음'), after: String(y.max ?? '없음'), kind: 'change' })
      if (x.min !== y.min) rows.push({ area: '값 범위', key: `${type}.${y.name} 하한`, before: String(x.min ?? '없음'), after: String(y.min ?? '없음'), kind: 'change' })
      if (x.required !== y.required)
        rows.push({ area: '속성 필수', key: `${type}.${y.name}`, before: x.required ? '필수' : '선택', after: y.required ? '필수' : '선택', kind: 'change' })
    })
  })

  /* 도메인 규칙 · 임계값 */
  const ruleKo: Record<string, string> = { ClaimNeedsEvidence: '「근거 없는 판정 금지」' }
  b.disabled.filter((r) => !a.disabled.includes(r)).forEach((r) => rows.push({ area: '도메인 규칙', key: ruleKo[r] ?? r, before: '적용', after: '해제됨', kind: 'remove' }))
  a.disabled.filter((r) => !b.disabled.includes(r)).forEach((r) => rows.push({ area: '도메인 규칙', key: ruleKo[r] ?? r, before: '해제됨', after: '적용', kind: 'add' }))
  if (a.fuelMax !== b.fuelMax)
    rows.push({ area: '임계값', key: '회차 연비 상한 (m³/km)', before: a.fuelMax.toFixed(1), after: b.fuelMax.toFixed(1), kind: 'change' })

  const stat = (ko: string, x: string, y: string) => ({ ko, before: x, after: y, moved: x !== y })
  return {
    rows,
    stats: [
      stat('관계 방향', `${a.edges.length}개`, `${b.edges.length}개`),
      stat('관계 어휘', `${relCount(a)}종`, `${relCount(b)}종`),
      stat('허용 조합', `${comboCount(a)}`, `${comboCount(b)}`),
      stat('필수 관계', `${Object.values(a.rel).filter((r) => r.required).length}종`, `${Object.values(b.rel).filter((r) => r.required).length}종`),
      stat('도메인 규칙', `${4 - a.disabled.length}종`, `${4 - b.disabled.length}종`),
      stat('회차 연비 상한', `${a.fuelMax.toFixed(1)}`, `${b.fuelMax.toFixed(1)}`),
    ],
  }
}

export function useGrammar() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => releases,
  )
}
export function useDraft() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => draft,
  )
}
