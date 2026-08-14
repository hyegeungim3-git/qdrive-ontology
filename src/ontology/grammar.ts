import { useSyncExternalStore } from 'react'
import { META_EDGES, type SpaceId } from './meta'
import { REL_META, TYPE_PROPS } from './standards'
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
 *   ⑪ 내보내기가 새 버전으로 나온다.
 * 그렇지 않으면 «발행했다»는 말을 믿을 근거가 없다.
 *
 * 정의(META_EDGES·REL_META·TYPE_PROPS)를 제자리에서 고치는 이유는, 이 정의를 읽는 화면이
 * 열 곳이 넘어서다. 대신 모듈 적재 시점의 원본을 스냅샷으로 떠 두고 언제든 되돌릴 수 있게 했다.
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

export type Release = {
  version: string
  at: number
  approvedBy: string
  amendments: Amendment[]
}

/* ── 원본 스냅샷 — 되돌리기의 근거 ── */
const BASE = {
  edges: structuredClone(META_EDGES),
  rel: structuredClone(REL_META),
  props: structuredClone(TYPE_PROPS),
  fuelMax: FUEL_LIMIT.max,
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
const nextVersion = () => `v1.${releases.length + 1}`

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

/* ── 실제 반영 ── */
function apply(a: Amendment) {
  const p = a.payload as Record<string, never>
  switch (a.kind) {
    case 'relAdd': {
      const { from, to, rel, bow } = p as unknown as { from: SpaceId; to: SpaceId; rel: string; bow?: number }
      const edge = META_EDGES.find((e) => e.from === from && e.to === to)
      if (edge) {
        if (!edge.relations.includes(rel)) edge.relations.push(rel)
      } else {
        // 새 방향을 여는 경우 — 곡률을 함께 넣는다. 직선으로 두면 사이의 노드를 관통해 그려진다.
        META_EDGES.push({ from, to, relations: [rel], desc: `${a.ko} (개정으로 추가)`, bow: bow ?? 70 })
      }
      break
    }
    case 'requiredOff': {
      const { rel } = p as unknown as { rel: string }
      if (REL_META[rel]) REL_META[rel].required = false
      break
    }
    case 'enumAdd': {
      const { type, prop, code } = p as unknown as { type: string; prop: string; code: string }
      const def = TYPE_PROPS[type]?.find((x) => x.name === prop)
      if (def?.oneOf && !def.oneOf.includes(code)) def.oneOf.push(code)
      break
    }
    case 'rangeAdjust': {
      const { type, prop, max } = p as unknown as { type: string; prop: string; max: number }
      const def = TYPE_PROPS[type]?.find((x) => x.name === prop)
      if (def) def.max = max
      break
    }
    case 'thresholdAdjust': {
      const { max } = p as unknown as { max: number }
      FUEL_LIMIT.max = max
      break
    }
    case 'domainRuleOff': {
      const { rule } = p as unknown as { rule: string }
      DISABLED_RULES.add(rule)
      break
    }
  }
}

/** 개정안을 발행한다 — 여기서 문법이 실제로 바뀐다 */
export function publish(approvedBy: string, at: number): Release | null {
  if (!draft.length) return null
  draft.forEach(apply)
  const r: Release = { version: nextVersion(), at, approvedBy, amendments: draft }
  releases = [...releases, r]
  draft = []
  emit()
  return r
}

/** 전체 되돌리기 — 원본 스냅샷으로 복원한다. 배열·객체의 정체성은 유지해야 모든 화면이 같이 되돌아간다. */
export function revertAll() {
  META_EDGES.length = 0
  META_EDGES.push(...structuredClone(BASE.edges))
  Object.keys(REL_META).forEach((k) => delete REL_META[k])
  Object.assign(REL_META, structuredClone(BASE.rel))
  Object.keys(TYPE_PROPS).forEach((k) => delete TYPE_PROPS[k])
  Object.assign(TYPE_PROPS, structuredClone(BASE.props))
  FUEL_LIMIT.max = BASE.fuelMax
  DISABLED_RULES.clear()
  releases = []
  draft = []
  emit()
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
