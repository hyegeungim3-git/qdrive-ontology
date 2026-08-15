import { useSyncExternalStore } from 'react'
import type { SimSnapshot, VehicleState } from '../sim/types'

/**
 * 규정이 실제로 막는다 — **접근 권한을 코드가 아니라 규정 스페이스에서 읽는다.**
 *
 * ③ 표준 정렬에서 규정 스페이스를 ODRL(Permission/Prohibition/Duty)에 맞춰 놓고도, 정작
 * «시 담당자는 기사 실명을 못 본다»가 코드 어디에도 없었다. 정렬만 하고 강제하지 않으면
 * 그 규정은 문서 장식이다. 공공 발주처가 가장 먼저 묻는 지점이기도 하다.
 *
 * 여기서 두 층을 분명히 나눈다.
 *   **규정**은 «볼 수 있는 것»을 막는다 (이 파일 — 표시 계층)
 *   **SHACL**은 «들어올 수 있는 것»을 막는다 (shacl.ts — 적재 계층)
 * 실명이 원천에서 잘못 흘러들어오면 SHACL이 잡고, 그래도 화면에는 권한 없는 사람에게 안 보인다.
 * 한 겹만 있으면 어느 쪽이든 뚫린다.
 */

export type Permission = 'seeDriverName' | 'seeAllVehicles' | 'seeRawLocation' | 'approveWaiver' | 'publishGrammar' | 'exportRaw'

export const PERMISSIONS: { id: Permission; ko: string; desc: string }[] = [
  { id: 'seeDriverName', ko: '기사 실명 열람', desc: '가명키가 아니라 실제 이름을 본다' },
  { id: 'seeAllVehicles', ko: '전 차량 범위', desc: '자기 차량 밖의 데이터를 본다' },
  { id: 'seeRawLocation', ko: '원본 위치 이력', desc: 'cm급 궤적 원본에 접근한다' },
  { id: 'approveWaiver', ko: '예외 승인', desc: '격리된 레코드를 예외로 통과시킨다' },
  { id: 'publishGrammar', ko: '문법 발행', desc: '개정안을 승인해 문법 버전을 올린다' },
  { id: 'exportRaw', ko: '원본 내보내기', desc: '데이터 그래프 원문을 파일로 받는다' },
]

export type RoleId = 'city' | 'operator' | 'driver' | 'steward'

export type Role = {
  id: RoleId
  ko: string
  org: string
  /** 이 역할의 권한이 어느 규정 노드에서 나오는가 */
  basis: string
  permits: Permission[]
  /** 금지된 권한과 그 근거 — «왜 안 되는지»를 말할 수 있어야 규정이다 */
  denies: { p: Permission; why: string }[]
}

export const ROLES: Role[] = [
  {
    id: 'city',
    ko: '시 담당자',
    org: '대구광역시',
    basis: '접근 권한 — 시는 노선·통계 범위',
    permits: ['seeAllVehicles'],
    denies: [
      { p: 'seeDriverName', why: '「가명 처리」 규정 — 시는 개인 단위가 아니라 노선·통계 단위로 봅니다' },
      { p: 'seeRawLocation', why: '원본 궤적은 준민감 정보입니다 — 집계된 값으로 제공됩니다' },
      { p: 'approveWaiver', why: '품질 예외 승인은 데이터를 만드는 쪽의 책임입니다' },
      { p: 'publishGrammar', why: '문법 개정은 데이터 책임자가 승인합니다' },
      { p: 'exportRaw', why: '원본 그래프는 반출 대상이 아닙니다 — 집계·보고서로 받습니다' },
    ],
  },
  {
    id: 'operator',
    ko: '운수사 관제',
    org: '대구버스운송',
    basis: '접근 권한 — 운수사는 자사 차량 범위',
    permits: ['seeDriverName', 'seeAllVehicles', 'seeRawLocation', 'approveWaiver'],
    denies: [
      { p: 'publishGrammar', why: '문법 개정은 데이터 책임자가 승인합니다 — 운수사는 제안까지' },
      { p: 'exportRaw', why: '원본 반출은 데이터 책임자 승인이 필요합니다' },
    ],
  },
  {
    id: 'driver',
    ko: '기사',
    org: '본인',
    basis: '접근 권한 — 기사는 자기 범위만',
    permits: ['seeDriverName', 'seeRawLocation'],
    denies: [
      { p: 'seeAllVehicles', why: '기사는 자기 차량만 봅니다 — 동료 비교는 개인 평가 도구가 됩니다' },
      { p: 'approveWaiver', why: '자기 데이터의 품질 판정을 스스로 승인할 수 없습니다' },
      { p: 'publishGrammar', why: '문법 개정 권한이 없습니다' },
      { p: 'exportRaw', why: '원본 반출 권한이 없습니다' },
    ],
  },
  {
    id: 'steward',
    ko: '데이터 책임자',
    org: 'Qdrive',
    basis: '접근 권한 + 가명 처리 — 분석셋을 관리하되 실명은 분리',
    permits: ['seeAllVehicles', 'approveWaiver', 'publishGrammar', 'exportRaw'],
    denies: [
      {
        p: 'seeDriverName',
        why: '「가명 처리」 규정 — 분석셋 관리자에게도 적용됩니다. 관리 권한이 열람 권한을 주지 않습니다',
      },
      { p: 'seeRawLocation', why: '원본 궤적은 운영 목적에만 열립니다 — 분석셋은 가공값으로 다룹니다' },
    ],
  },
]

export const roleOf = (id: RoleId) => ROLES.find((r) => r.id === id) ?? ROLES[3]
export const can = (id: RoleId, p: Permission) => roleOf(id).permits.includes(p)
export const denyReason = (id: RoleId, p: Permission) => roleOf(id).denies.find((d) => d.p === p)?.why ?? '이 역할에는 허용되지 않은 권한입니다'

/* ── 적용 ── */

/** 기사 실명 → 가명키. 권한이 없으면 화면 어디에도 실명이 나오지 않아야 한다. */
export function maskName(id: RoleId, name: string, snap?: SimSnapshot): string {
  if (can(id, 'seeDriverName')) return name
  const i = snap ? [...new Set(snap.vehicles.map((v) => v.driverName))].indexOf(name) : -1
  return i >= 0 ? `기사 D-${String(i + 1).padStart(3, '0')}` : '기사(가명)'
}

/** 문자열 안에 섞인 실명까지 지운다 — 문장 조립에 이름이 들어가는 자리가 있다 */
export function maskText(id: RoleId, text: string, snap: SimSnapshot): string {
  if (can(id, 'seeDriverName')) return text
  let out = text
  ;[...new Set(snap.vehicles.map((v) => v.driverName))].forEach((n) => {
    out = out.split(n).join(maskName(id, n, snap))
  })
  return out
}

/** 이 역할이 볼 수 있는 차량 — 기사는 자기 차량 한 대 */
export function visibleVehicles(id: RoleId, snap: SimSnapshot): VehicleState[] {
  if (can(id, 'seeAllVehicles')) return snap.vehicles
  return snap.vehicles.slice(0, 1)
}

/* ── 저장소 — 역할은 앱 전체가 공유한다 ── */
let role: RoleId = 'steward'
const listeners = new Set<() => void>()
export function setRole(r: RoleId) {
  role = r
  listeners.forEach((l) => l())
}
export function useRole(): RoleId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => role,
  )
}
