import { useSyncExternalStore } from 'react'

/**
 * 발행된 조치 저장소 — **아무것도 import하지 않는다.**
 *
 * `rdf.ts`(그래프를 만드는 쪽)와 `action.ts`(조치를 검사하고 발행하는 쪽)가 둘 다 이 목록을 필요로 한다.
 * 어느 한쪽에 두면 순환 의존이 된다. `rules.ts` 때와 같은 이유로 빈 모듈로 뺐다.
 *
 * 발행된 조치는 **엔진이 만든 조치와 같은 자격으로 그래프에 들어간다.** 그래야
 * ⑤ 근거 사슬이 걷고, ⑨ SHACL이 검사하고, ⑩이 격리할 수 있고, ⑭ 카탈로그가 센다.
 * 별도 목록으로 관리하면 「발행했다」가 다시 연극이 된다.
 */

export type IssuedAction = {
  /** qdi:iss-<actionId>-<차량>-<순번> — 내용 기반. 목록 순번을 쓰면 스냅샷이 바뀔 때 남의 레코드를 가리킨다 */
  iri: string
  actionId: string
  /** 만들어지는 노드 타입 (조치 스페이스) */
  creates: string
  label: string
  vehicleId: string
  /** 이 조치가 붙는 성과 노드 IRI */
  targetIri: string
  targetKo: string
  /** 관계 어휘 — 문법에서 온 것 */
  via: string
  at: number
  /** 누가 냈나 (역할 id) */
  by: string
  byKo: string
  /** 불이익이 될 수 있는 조치의 승인자 — 「불이익 결정 자동화 금지」 */
  approvedBy?: string
  props: Record<string, string | number>
  /** 이 발행을 기록한 활동 */
  runId: string
  /** 발행 당시 문법 버전 */
  version: string
}

let list: IssuedAction[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const nextSeq = () => (seq += 1)
export const issuedList = () => list

export function push(a: IssuedAction) {
  list = [a, ...list]
  emit()
}

/** 철회 — 발행은 되돌릴 수 있어야 한다. 다만 이력은 활동으로 남는다 */
export function withdraw(iri: string) {
  list = list.filter((a) => a.iri !== iri)
  emit()
}

export function clearIssued() {
  list = []
  seq = 0
  emit()
}

export function useIssued(): IssuedAction[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => list,
  )
}
