import { useSyncExternalStore } from 'react'
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
