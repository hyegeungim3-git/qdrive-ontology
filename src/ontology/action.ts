import { META_EDGES, SPACES } from './meta'
import { REL_META, TYPE_PROPS } from './standards'
import { can, denyReason, roleOf, type Permission, type RoleId } from './policy'
import { currentVersion } from './grammar'
import { walkChain } from './chainwalk'
import { record as recordRun } from './lineage'
import { nextSeq, push, type IssuedAction } from './issued'
import type { GateResult } from './gate'

/**
 * 조치 발행 — **쓰기 경로가 온톨로지를 통과한다.**
 *
 * 여기까지 만든 것은 전부 «읽는 쪽»이었다. 엔진이 데이터를 내면 게이트가 검증하고 화면이 보여준다.
 * 정작 사람이 **무언가를 하는** 순간 — 코칭을 내리고, 배차를 조정하고, 정비를 지시하는 순간에는
 * 온톨로지가 아무 역할도 하지 않았다. ⑥ 조치 시뮬레이터는 «당기면 이만큼 오른다»를 계산만 했다.
 *
 * Palantir Foundry의 Ontology가 의미(Semantic) 층 위에 **운동(Kinetic) 층**을 두는 이유가 여기다.
 * Action Type이 데이터를 바꾸는 **유일한 경로**이고, 그 경로에 검증·제약·감사 흔적이 붙는다.
 *
 * 우리 버전은 네 겹으로 막는다. 넷 다 **이미 있는 정의에서** 나온다 — 새 규칙을 만들지 않았다.
 *
 * | 검사 | 근거 | 무엇을 묻나 |
 * |---|---|---|
 * | 문법 | `META_EDGES` · `REL_META` | 이 조치가 이 성과에 붙는 관계가 문법에 있나 |
 * | 규정 | `policy.ts` | 이 역할이 조치를 낼 수 있나. 불이익 조치에 승인자가 있나 |
 * | 스키마 | `TYPE_PROPS` | 만들려는 노드가 필수 속성을 채웠나 |
 * | 근거 | `walkChain` | **이 차량에 이 조치를 낼 근거가 그래프에 있나** |
 *
 * 마지막 것이 이 기능의 요점이다. 「근거 없는 판정은 만들지 않는다」를 판정에만 적용하고 조치에는
 * 적용하지 않으면 반쪽이다. 위험운전 기록이 하나도 없는 기사에게 코칭을 내리는 것은,
 * 근거 없는 감점과 같은 종류의 잘못이다. 그리고 그 판단을 **⑤ 근거 사슬과 같은 순회 함수**가 한다 —
 * 별도 계산을 만들면 「사슬은 비었는데 조치는 나가는」 상태가 생긴다.
 */

export type CheckSource = '문법' | '규정' | '스키마' | '근거'
export type Check = { source: CheckSource; ko: string; ok: boolean; why: string }

export type ParamDef = {
  key: string
  ko: string
  kind: 'text' | 'number' | 'select'
  options?: string[]
  required: boolean
  /** 어느 속성으로 그래프에 들어가는가 — TYPE_PROPS의 이름과 같아야 한다 */
  prop?: string
  placeholder?: string
}

export type ActionType = {
  id: string
  ko: string
  desc: string
  /** 만들어지는 노드 타입 (조치 스페이스) */
  creates: string
  /** 어느 성과에 붙나 — chainwalk의 지표 키 */
  metric: string
  /** 관계 어휘 — 문법에 있어야 통과한다 */
  via: string
  /** 기사에게 불이익이 될 수 있는가 — 「불이익 결정 자동화 금지」가 걸린다 */
  adverse: boolean
  params: ParamDef[]
}

export const ACTION_TYPES: ActionType[] = [
  {
    id: 'coaching',
    ko: '실시간 코칭 발행',
    desc: '급조작이 기록된 기사에게 코칭을 띄운다. 근거가 된 위험운전 패킷이 그래프에 있어야 한다.',
    creates: 'Coaching',
    metric: 'safety',
    via: '올린다',
    adverse: true,
    params: [
      { key: 'approvedBy', ko: '승인자', kind: 'text', required: true, prop: 'approvedBy', placeholder: '예: 관제 담당 1' },
      { key: 'message', ko: '코칭 문구', kind: 'text', required: false, placeholder: '예: 정류장 진입 시 감속을 미리' },
    ],
  },
  {
    id: 'dispatch',
    ko: '배차 권고 발행',
    desc: '앞차와 몰린 차량에 정류장 추가 대기를 권고한다. 몰림 판정이나 위치 관측이 근거다.',
    creates: 'DispatchAdvice',
    metric: 'headway',
    via: '안정시킨다',
    adverse: false,
    params: [{ key: 'holdSec', ko: '추가 대기(초)', kind: 'number', required: true, prop: 'holdSec', placeholder: '30' }],
  },
  {
    id: 'maint',
    ko: '예지정비 지시',
    desc: '센서 이상이 관측된 차량에 정비를 지시한다.',
    creates: 'PredictiveMaint',
    metric: 'co2',
    via: '최적화한다',
    adverse: false,
    params: [
      { key: 'kind', ko: '정비 항목', kind: 'select', options: ['냉각수', '브레이크 패드', 'DPF', '배터리'], required: true, prop: 'kind' },
      { key: 'estHours', ko: '예상 소요(h)', kind: 'number', required: true, prop: 'estHours', placeholder: '2' },
    ],
  },
]

export const actionOf = (id: string) => ACTION_TYPES.find((a) => a.id === id) ?? ACTION_TYPES[0]

/** 조치 발행 권한 — 규정 스페이스에서 온다 */
export const ISSUE: Permission = 'issueAction'

const LEVER_TYPES = new Set(SPACES.find((s) => s.id === 'lever')?.types.map((t) => t.en.replace(/[^A-Za-z0-9]/g, '')) ?? [])

/**
 * 발행 전 검사. **화면이 아니라 여기서 판정한다** — 버튼을 흐리게 만드는 것과
 * 「왜 안 되는지 말할 수 있는 것」은 다르다.
 */
export function checkAction(a: ActionType, params: Record<string, string>, role: RoleId, g: GateResult, vehicleId: string): Check[] {
  const out: Check[] = []

  /* ① 문법 — 이 조치 노드가 조치 스페이스에 있고, 이 관계가 조치→성과에 허용됐나 */
  const inLever = LEVER_TYPES.has(a.creates)
  const edge = META_EDGES.find((e) => e.from === 'lever' && e.to === 'outcome')
  const relOk = !!edge?.relations.includes(a.via)
  out.push({
    source: '문법',
    ko: `조치 → 성과 «${a.via}»`,
    ok: inLever && relOk,
    why: !inLever
      ? `${a.creates}는 조치 스페이스의 노드 타입이 아닙니다`
      : relOk
        ? `문법이 허용한 관계입니다 (${edge?.relations.join(' · ')}) · ${REL_META[a.via]?.en ?? ''}`
        : `«${a.via}»는 조치 → 성과에 허용되지 않은 어휘입니다`,
  })

  /* ② 규정 — 발행 권한 + 불이익 조치의 승인자 */
  const mayIssue = can(role, ISSUE)
  out.push({
    source: '규정',
    ko: '조치 발행 권한',
    ok: mayIssue,
    why: mayIssue ? `«${roleOf(role).ko}» 역할에 발행 권한이 있습니다` : denyReason(role, ISSUE),
  })
  if (a.adverse) {
    const approver = (params.approvedBy ?? '').trim()
    out.push({
      source: '규정',
      ko: '불이익 결정 자동화 금지 — 승인자',
      ok: !!approver,
      why: approver
        // 승인자는 자유 입력이라 받침을 알 수 없다 — 조사를 붙이지 않는다(«관제 담당 1가»가 나온다)
        ? `확정자: ${approver} — 사람이 승인한 기록이 노드에 남습니다`
        : '기사에게 불이익이 될 수 있는 조치는 승인자 없이 확정할 수 없습니다',
    })
  }

  /* ③ 스키마 — 만들 노드의 필수 값이 채워졌나.
     두 종류를 함께 본다. SHACL이 필수로 잡는 속성(TYPE_PROPS.required)과, 화면이 필수라고
     표시한 입력(ParamDef.required)이다. **후자를 강제하지 않으면 「필수」 표시가 거짓말이 된다** —
     실제로 배차 권고의 추가 대기가 그런 상태였다. */
  const props = TYPE_PROPS[a.creates] ?? []
  const empty = (key: string) => !(params[key] ?? '').trim()
  const missingProp = props
    .filter((p) => p.required)
    .map((p) => a.params.find((x) => x.prop === p.name))
    .filter((b): b is ParamDef => !!b && empty(b.key))
  const missingParam = a.params.filter((p) => p.required && empty(p.key) && !missingProp.includes(p))
  const missing = [...missingProp, ...missingParam]
  const needed = props.filter((p) => p.required).length + a.params.filter((p) => p.required).length
  out.push({
    source: '스키마',
    ko: `${a.creates} 필수 값`,
    ok: missing.length === 0,
    why: missing.length
      ? `비어 있는 필수 값: ${missing.map((m) => m.ko).join(', ')}`
      : `필수 ${needed}종이 채워졌습니다 — SHACL이 검사할 값입니다`,
  })

  /* ④ 근거 — ⑤ 근거 사슬과 **같은 순회**로 판단한다 */
  const walk = walkChain(g, a.metric, vehicleId)
  const nEv = walk.evidence.length + walk.direct.length
  const nCl = walk.claims.length
  out.push({
    source: '근거',
    ko: '이 차량에 근거가 있나',
    ok: walk.ok && nEv + nCl > 0,
    why: !walk.ok
      ? walk.reason ?? '이 지표는 그래프로 걸을 수 없습니다'
      : nEv + nCl > 0
        ? `관측 ${nEv}건 · 판정 ${nCl}건이 그래프에 있습니다 — ⑤ 근거 사슬과 같은 순회로 확인했습니다`
        : '이 차량에는 이 조치를 뒷받침할 관측·판정이 없습니다 — 근거 없는 조치는 만들지 않습니다',
  })

  return out
}

export const passed = (cs: Check[]) => cs.every((c) => c.ok)

/**
 * 발행. 검사를 통과한 것만 받는다 — 화면이 막았더라도 여기서 한 번 더 본다
 * (「막았다」를 UI에만 두면 우회 경로가 생긴다).
 */
export function issueAction(
  a: ActionType,
  params: Record<string, string>,
  role: RoleId,
  g: GateResult,
  vehicleId: string,
): { ok: false; checks: Check[] } | { ok: true; issued: IssuedAction } {
  const checks = checkAction(a, params, role, g, vehicleId)
  if (!passed(checks)) return { ok: false, checks }

  // 대상 성과 노드를 **그래프에서 찾는다** — IRI를 문자열로 조립하면 이름 규칙이 바뀔 때 조용히 틀린다
  const walk = walkChain(g, a.metric, vehicleId)
  const target = walk.outcome
  if (!target) return { ok: false, checks: [...checks, { source: '근거', ko: '대상 성과 노드', ok: false, why: '붙일 성과 노드를 그래프에서 찾지 못했습니다' }] }

  const n = nextSeq()
  const version = currentVersion()
  const run = recordRun({
    at: g.at,
    ms: 0,
    version,
    agent: `조치 발행 — ${roleOf(role).ko}`,
    used: { vehicles: 1, triples: 0, nodes: 0 },
    generated: { passed: 1, held: 0, stamped: 0 },
    status: '성공',
  })

  const issued: IssuedAction = {
    iri: `qdi:iss-${a.id}-${vehicleId.replace(/[^A-Za-z0-9가-힣]/g, '')}-${n}`,
    actionId: a.id,
    creates: a.creates,
    label: `${vehicleId} ${a.ko.replace(' 발행', '').replace(' 지시', '')} (발행)`,
    vehicleId,
    targetIri: target.iri,
    targetKo: target.label,
    via: a.via,
    at: g.at,
    by: role,
    byKo: roleOf(role).ko,
    approvedBy: (params.approvedBy ?? '').trim() || undefined,
    props: Object.fromEntries(
      a.params.filter((p) => p.prop && (params[p.key] ?? '').trim()).map((p) => [p.prop!, p.kind === 'number' ? Number(params[p.key]) : params[p.key].trim()]),
    ),
    runId: run.id,
    version,
  }
  push(issued)
  return { ok: true, issued }
}
