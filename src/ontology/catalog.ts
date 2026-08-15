import { SPACES, spaceOf, type SpaceId } from './meta'
import { REL_META, TYPE_ALIGN, TYPE_PROPS, type PropDef } from './standards'
import { META_EDGES } from './meta'
import { ROLES, type RoleId } from './policy'
import type { GateResult } from './gate'
import { allRuns, simIso } from './lineage'

/**
 * 데이터 카탈로그 — 「무엇이 있고, 어디서 왔고, 누가 볼 수 있고, 얼마나 믿을 만한가」.
 *
 * 3차에 DCAT을 「데이터셋 카탈로그일 뿐 온톨로지 층이 아니다」라며 도입하지 않았다.
 * 목표가 «문법을 정의한다»일 때는 맞는 판단이었다. 지금 목표는 «서비스가 그 위에서 돌고
 * **AI가 그 데이터를 받아 쓴다**»이고, 그러면 카탈로그가 없으면 AI는 **무엇이 있는지조차 모른다.**
 * RAG의 진입점도, 그래프 질의를 짜기 전 스키마 탐색도 결국 카탈로그다. 그래서 결정을 번복했다.
 *
 * 중요한 것은 **이 카탈로그를 손으로 적지 않는다**는 점이다. DataHub 같은 시스템이 커넥터로
 * 긁어모으는 것들을 우리는 이미 정의로 갖고 있다.
 *
 * | 카탈로그 항목 | 어디서 오나 |
 * |---|---|
 * | 스키마·자료형·단위·열거값 | `TYPE_PROPS` (SHACL과 같은 정의) |
 * | 상류·하류 리니지 | `META_EDGES` + 실그래프 인접 색인 |
 * | 건수·품질 | 게이트 결과 (통과/격리) |
 * | 신선도 | 실행 리니지 (`prov:Activity`) |
 * | 접근 권한 | 규정 스페이스 (`policy.ts`) |
 * | 표준 정렬 | `TYPE_ALIGN` |
 *
 * 손으로 적는 카탈로그는 반드시 낡는다. 파생되는 카탈로그만 살아 있다.
 */

export type FieldInfo = PropDef & { pk?: boolean }

export type Dataset = {
  /** 노드 타입 영문명 = 데이터셋 식별자 */
  id: string
  ko: string
  space: SpaceId
  spaceKo: string
  note: string
  /** 실그래프에 실제로 있는 건수 — 0이면 「정의는 있는데 데이터가 없다」 */
  rows: number
  held: number
  /** 게이트 통과율(DQV) — 건수가 0이면 null(«측정 못 함»과 «100%»는 다르다) */
  pass: number | null
  fields: FieldInfo[]
  /** 상류: 이 데이터셋으로 들어오는 관계 (누가 나를 만드나) */
  upstream: { type: string; ko: string; rel: string; links: number }[]
  /** 하류: 여기서 나가는 관계 (내가 무엇을 먹이나) */
  downstream: { type: string; ko: string; rel: string; links: number }[]
  /** 이 데이터셋을 볼 수 있는 역할 */
  readers: RoleId[]
  /** 볼 수 없는 역할과 그 근거 */
  denied: { role: RoleId; why: string }[]
  align: { std: string; term: string; match: string }[]
  /** 개인정보가 섞이는가 — 규정 스페이스가 답한다 */
  sensitive: boolean
}

/* 어느 노드 타입이 개인정보에 닿는가 — 규정 스페이스의 «가명 처리»가 걸리는 자리 */
const SENSITIVE = new Set(['Driver', 'Location', 'Plea', 'Coaching'])

/** 그 데이터셋을 못 보는 역할과 이유 — 권한을 «표»가 아니라 «데이터셋별»로 답한다 */
function access(typeEn: string): { readers: RoleId[]; denied: { role: RoleId; why: string }[] } {
  const readers: RoleId[] = []
  const denied: { role: RoleId; why: string }[] = []
  ROLES.forEach((r) => {
    if (typeEn === 'Driver' && !r.permits.includes('seeDriverName')) {
      denied.push({ role: r.id, why: r.denies.find((d) => d.p === 'seeDriverName')?.why ?? '실명 열람 권한 없음' })
      readers.push(r.id) // 가명키로는 볼 수 있다 — «못 본다»가 아니라 «가려서 본다»
      return
    }
    if (typeEn === 'Location' && !r.permits.includes('seeRawLocation')) {
      denied.push({ role: r.id, why: r.denies.find((d) => d.p === 'seeRawLocation')?.why ?? '원본 위치 이력 열람 권한 없음' })
      return
    }
    readers.push(r.id)
  })
  return { readers, denied }
}

/** 노드 타입 사이의 실연결 수 — 정의상 관계가 아니라 **실제로 몇 개 붙어 있나** */
function linkCounts(g: GateResult) {
  const ix = g.graph.index
  const out: Record<string, number> = {}
  Object.entries(ix.out).forEach(([s, es]) => {
    const from = ix.type[s]
    if (!from) return
    es.forEach((e) => {
      const to = ix.type[e.o]
      if (!to) return
      out[`${from}|${e.p}|${to}`] = (out[`${from}|${e.p}|${to}`] ?? 0) + 1
    })
  })
  return out
}

export function buildCatalog(g: GateResult): Dataset[] {
  const ix = g.graph.index
  const counts: Record<string, number> = {}
  const heldBy: Record<string, number> = {}
  Object.entries(ix.type).forEach(([iri, t]) => {
    counts[t] = (counts[t] ?? 0) + 1
    if (g.held.has(iri)) heldBy[t] = (heldBy[t] ?? 0) + 1
  })
  const links = linkCounts(g)

  /* 정의에 있는 노드 타입 전부를 낸다 — 데이터가 0건인 것도 숨기지 않는다.
     「정의는 있는데 한 건도 안 들어온 데이터셋」은 카탈로그가 답해야 할 질문이다. */
  const all: Dataset[] = []
  SPACES.forEach((s) => {
    s.types.forEach((t) => {
      const en = t.en.replace(/[^A-Za-z0-9]/g, '')
      const rows = counts[en] ?? 0
      const held = heldBy[en] ?? 0
      const { readers, denied } = access(en)

      const upstream: Dataset['upstream'] = []
      const downstream: Dataset['downstream'] = []
      META_EDGES.forEach((e) => {
        e.relations.forEach((rel) => {
          const p = `qd:${REL_META[rel]?.en ?? rel}`
          if (e.to === s.id) {
            spaceOf(e.from).types.forEach((ft) => {
              const fen = ft.en.replace(/[^A-Za-z0-9]/g, '')
              const n = links[`${fen}|${p}|${en}`] ?? 0
              if (n > 0) upstream.push({ type: fen, ko: ft.ko, rel, links: n })
            })
          }
          if (e.from === s.id) {
            spaceOf(e.to).types.forEach((tt) => {
              const ten = tt.en.replace(/[^A-Za-z0-9]/g, '')
              const n = links[`${en}|${p}|${ten}`] ?? 0
              if (n > 0) downstream.push({ type: ten, ko: tt.ko, rel, links: n })
            })
          }
        })
      })

      all.push({
        id: en,
        ko: t.ko,
        space: s.id,
        spaceKo: s.ko,
        note: t.note ?? '',
        rows,
        held,
        pass: rows > 0 ? Math.round(((rows - held) / rows) * 1000) / 10 : null,
        fields: TYPE_PROPS[en] ?? [],
        upstream,
        downstream,
        readers,
        denied,
        align: TYPE_ALIGN[en] ?? [],
        sensitive: SENSITIVE.has(en),
      })
    })
  })
  return all
}

export type CatalogStats = {
  total: number
  withData: number
  withSchema: number
  rows: number
  links: number
  /** 신선도 — 마지막 게이트 실행 */
  lastRunAt: string | null
  runs: number
  /** 필드 중 단위가 붙은 비율 (AI가 값을 해석할 수 있는가) */
  unitCoverage: { withUnit: number; numeric: number }
}

/**
 * 수치 필드에 단위가 붙어 있나 — AI가 `0.54`를 해석할 수 있는지의 지표.
 *
 * 다만 «단위를 스키마에 고정할 수 없는» 필드가 있다. 센서 측정의 value는 채널마다 단위가 달라서
 * 같은 레코드의 `unit` 필드가 값을 들고 다닌다. 그건 결손이 아니라 **다른 모델링**이므로
 * 억지로 고정 단위를 적어 커버리지를 채우지 않고, 데이터로 붙어 있는 경우도 «해석 가능»으로 센다.
 */
const unitCovered = (d: Dataset, f: FieldInfo) => !!f.unit || d.fields.some((x) => x.name === 'unit')

export function catalogStats(list: Dataset[]): CatalogStats {
  const runs = allRuns()
  const numeric = list.flatMap((d) => d.fields.map((f) => ({ d, f }))).filter(({ f }) => f.datatype.includes('decimal') || f.datatype.includes('integer'))
  return {
    total: list.length,
    withData: list.filter((d) => d.rows > 0).length,
    withSchema: list.filter((d) => d.fields.length > 0).length,
    rows: list.reduce((n, d) => n + d.rows, 0),
    links: list.reduce((n, d) => n + d.downstream.reduce((m, x) => m + x.links, 0), 0),
    lastRunAt: runs[0] ? simIso(runs[0].at) : null,
    runs: runs.length,
    unitCoverage: { withUnit: numeric.filter(({ d, f }) => unitCovered(d, f)).length, numeric: numeric.length },
  }
}

/**
 * 카탈로그가 답하지 못하는 것을 스스로 적는다.
 * 「전부 초록불」인 카탈로그는 대개 검사를 안 한 카탈로그다.
 */
export function catalogGaps(list: Dataset[]): { ko: string; n: number; why: string }[] {
  const g: { ko: string; n: number; why: string }[] = []
  const noData = list.filter((d) => d.rows === 0)
  if (noData.length) g.push({ ko: '데이터가 0건인 데이터셋', n: noData.length, why: '정의는 있으나 이 스냅샷에 인스턴스가 없습니다 — 원천 미연결이거나 아직 발생하지 않은 것입니다' })
  const noSchema = list.filter((d) => d.rows > 0 && d.fields.length === 0)
  if (noSchema.length) g.push({ ko: '속성 스키마가 없는 데이터셋', n: noSchema.length, why: '노드는 만들어지는데 속성 제약이 없습니다 — 검사받지 않는 데이터입니다' })
  const orphan = list.filter((d) => d.rows > 0 && !d.upstream.length && !d.downstream.length)
  if (orphan.length) g.push({ ko: '연결이 하나도 없는 데이터셋', n: orphan.length, why: '고립된 데이터는 근거 사슬에 들어가지 못합니다 — AI가 맥락을 못 만듭니다' })
  return g
}
