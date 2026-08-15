import { META_EDGES, SPACES, spaceOf } from './meta'
import { REL_META, TYPE_PROPS } from './standards'
import { DISABLED_RULES, FUEL_LIMIT, perKm } from './rules'
import { currentVersion } from './grammar'
import { policyActive } from './validity'

/**
 * SHACL 셰이프 생성 — OWL은 어휘를 정의할 뿐 검사하지 않는다. 실제로 막는 것은 SHACL이다.
 *
 * 세 종류의 제약을 낸다.
 *  1) 속성 제약 — 필수 여부 · 자료형 · 값 범위 · 열거값
 *  2) 관계 제약 — 도착 클래스 · 카디널리티 · 필수 관계
 *  3) 문법 제약 — 정의되지 않은 방향의 관계를 막는 닫힌(closed) 셰이프
 */

const slug = (en: string) => en.replace(/[^A-Za-z0-9]/g, '')

export { FUEL_LIMIT, perKm } from './rules'

/** 심각도 — 핵심 사슬이거나 필수 관계면 Violation, 나머지는 Warning */
const severityOf = (core: boolean, required: boolean) => (core || required ? 'sh:Violation' : 'sh:Warning')

/** 받침 유무에 따라 «이어야/여야» — 메시지가 어색하면 규칙도 대충 만든 것처럼 보인다 */
const eoya = (ko: string) => {
  const c = ko.charCodeAt(ko.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? '이어야' : '여야'
}

/**
 * @param opts.sparql  sh:sparql 제약을 포함할지. 내보내기 파일에는 넣지만,
 *                     브라우저 검증 엔진(rdf-validate-shacl)은 SPARQL 제약을 지원하지 않아
 *                     실검증 화면에서는 빼고 같은 규칙을 JS로 따로 돌린다.
 */
export function buildShacl(opts: { sparql?: boolean } = {}): string {
  const withSparql = opts.sparql !== false
  const L: string[] = [
    '@prefix qd:   <https://qdrive.ai/ontology/> .',
    '@prefix sh:   <http://www.w3.org/ns/shacl#> .',
    '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
    '@prefix geo:  <http://www.opengis.net/ont/geosparql#> .',
    '@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '',
    '# ═══════════════════════════════════════════════════════════',
    `# Qdrive 온톨로지 SHACL 제약 ${currentVersion()}`,
    '#',
    '# 적재 시점에 이 셰이프로 검사한다. 통과하지 못한 레코드는 저장되지 않고',
    '# 보류 큐로 간다 — 데이터 관리자의 품질 격리 큐와 같은 원리.',
    '# ═══════════════════════════════════════════════════════════',
    '',
  ]

  /* ── 1) 노드 타입별 속성 제약 ── */
  L.push('# ── 1. 속성 제약 — 필수·자료형·값 범위 ──', '')
  Object.entries(TYPE_PROPS).forEach(([type, props]) => {
    const space = SPACES.find((s) => s.types.some((t) => slug(t.en) === type))
    const ko = space?.types.find((t) => slug(t.en) === type)?.ko ?? type
    L.push(`qd:${type}Shape a sh:NodeShape ;`)
    L.push(`  sh:targetClass qd:${type} ;`)
    L.push(`  sh:name "${ko} 제약"@ko ;`)
    props.forEach((p, i) => {
      const last = i === props.length - 1
      L.push('  sh:property [')
      L.push(`    sh:path qd:${p.name} ;`)
      L.push(`    sh:datatype ${p.datatype} ;`)
      if (p.required) L.push('    sh:minCount 1 ;')
      L.push('    sh:maxCount 1 ;')
      if (p.min !== undefined) L.push(`    sh:minInclusive ${p.min} ;`)
      if (p.max !== undefined) L.push(`    sh:maxInclusive ${p.max} ;`)
      if (p.oneOf) L.push(`    sh:in ( ${p.oneOf.map((x) => `"${x}"`).join(' ')} ) ;`)
      L.push(`    sh:severity ${p.required ? 'sh:Violation' : 'sh:Warning'} ;`)
      L.push(`    sh:message "${ko}의 ${p.name}${p.note ? ` — ${p.note}` : ''}"@ko ;`)
      L.push(`  ]${last ? ' .' : ' ;'}`)
    })
    L.push('')
  })

  /* ── 2) 관계 제약 ── */
  L.push('# ── 2. 관계 제약 — 도착 클래스·카디널리티·필수 관계 ──', '')
  const bySpace = new Map<string, typeof META_EDGES>()
  META_EDGES.forEach((e) => {
    const arr = bySpace.get(e.from) ?? []
    arr.push(e)
    bySpace.set(e.from, arr)
  })
  bySpace.forEach((edges, from) => {
    const sp = spaceOf(from as never)
    L.push(`qd:${sp.en}RelationShape a sh:NodeShape ;`)
    L.push(`  sh:targetClass qd:${sp.en} ;`)
    L.push(`  sh:name "${sp.ko} 관계 제약"@ko ;`)
    const all = edges.flatMap((e) => e.relations.map((r) => ({ r, e })))
    all.forEach(({ r, e }, i) => {
      const m = REL_META[r]
      const last = i === all.length - 1
      L.push('  sh:property [')
      L.push(`    sh:path qd:${m.en} ;`)
      L.push(`    sh:class qd:${spaceOf(e.to).en} ;`)
      L.push('    sh:nodeKind sh:IRI ;')
      if (m.required) L.push('    sh:minCount 1 ;')
      if (m.card === '1:1' || m.card === 'N:1') L.push('    sh:maxCount 1 ;')
      L.push(`    sh:severity ${severityOf(!!e.core, m.required)} ;`)
      L.push(`    sh:message "«${r}»의 도착은 ${spaceOf(e.to).ko}${eoya(spaceOf(e.to).ko)} 합니다 (${m.card}${m.required ? ' · 필수' : ''})"@ko ;`)
      L.push(`  ]${last ? ' .' : ' ;'}`)
    })
    L.push('')
  })

  /* ── 3) 문법 제약 — 정의되지 않은 관계 차단 ── */
  L.push('# ── 3. 문법 제약 — 문법에 없는 관계는 만들 수 없다 ──')
  L.push('# 각 스페이스의 노드는 아래 목록 밖의 관계를 가질 수 없다 (sh:closed).')
  L.push('')
  SPACES.forEach((s) => {
    const outs = META_EDGES.filter((e) => e.from === s.id).flatMap((e) => e.relations.map((r) => `qd:${REL_META[r].en}`))
    // 이 스페이스에 선 노드 타입들이 가질 수 있는 자료 속성 — 닫힌 셰이프는 관계뿐 아니라
    // 속성까지 전부 열거해야 한다. 빠뜨리면 정상 레코드가 통째로 위반으로 잡힌다.
    const props = [...new Set(s.types.flatMap((t) => (TYPE_PROPS[slug(t.en)] ?? []).map((p) => `qd:${p.name}`)))]
    const allowed = ['rdf:type', 'rdfs:label', ...outs, ...props]
    L.push(`qd:${s.en}ClosedShape a sh:NodeShape ;`)
    L.push(`  sh:targetClass qd:${s.en} ;`)
    L.push('  sh:closed true ;')
    L.push(`  sh:ignoredProperties ( ${allowed.join(' ')} ) ;`)
    L.push(`  sh:severity sh:Violation ;`)
    L.push(`  sh:message "${s.ko}에서 나갈 수 있는 관계는 ${outs.length}종뿐입니다 — 문법에 없는 술어는 쓸 수 없습니다"@ko .`)
    L.push('')
  })

  /* ── 4) 도메인 규칙 — 문법을 넘어선 업무 원칙 ──
     셰이프 IRI에 **Rule 접두사**를 붙인다. 노드 타입 셰이프가 `qd:${type}Shape`로 생성되므로
     규칙 이름이 노드 타입 이름과 겹치면 **같은 IRI의 셰이프 둘이 RDF에서 하나로 합쳐진다.**
     실제로 규정 노드 타입 NoAutoAdverse에 속성 스키마를 정의하자 정당 판정이 legalBasis를,
     규정 노드가 decidedBy를 요구받았다. 이름 공간이 하나라는 것을 잊기 쉽다. */
  L.push('# ── 4. 도메인 규칙 — 문법이 아니라 업무 원칙 ──', '')
  // 문법 개정으로 꺼진 규칙은 아예 내보내지 않는다 — 꺼 놓고 파일에는 남기면 어느 쪽이 진짜인지 알 수 없다
  if (!DISABLED_RULES.has('ClaimNeedsEvidence')) {
    L.push('# 판정은 근거(관측) 없이 존재할 수 없다')
    L.push('qd:RuleClaimNeedsEvidenceShape a sh:NodeShape ;')
    L.push('  sh:targetClass qd:Claim ;')
    L.push('  sh:property [')
    L.push('    sh:path [ sh:inversePath qd:supports ] ;')
    L.push('    sh:minCount 1 ;')
    L.push('    sh:severity sh:Violation ;')
    L.push('    sh:message "근거 관측이 없는 판정은 만들 수 없습니다"@ko ;')
    L.push('  ] .')
    L.push('')
  }
  /* 규정에 시행일이 있다. **미시행 규정은 셰이프를 만들지 않는다** —
     「시행 예정이라 아직 안 막습니다」를 화면 문구로만 적으면 그것은 다시 연극이다.
     시행 시각이 지나면 이 규칙이 생기고, 그때부터 실제로 막힌다. */
  if (policyActive('pol-noauto')) {
  // 「확정된」 판정에만 담당자를 요구한다. 처음에는 모든 정당 판정에 걸었는데,
  // 역방향 적재 어댑터가 원천 데이터로 만든 «검토 대기» 판정까지 담당자를 요구받았다.
  // 아직 확정하지 않은 판정에 확정자를 적으라는 것은 규칙이 틀린 것이다 —
  // 오히려 «검토 대기로 들어와서 사람이 확정한다»가 이 규정이 원하는 흐름이다.
  L.push('# 확정된 판정은 사람이 확정해야 한다 — 검토 대기는 담당자 없이 존재할 수 있다')
  L.push('qd:RuleNoAutoAdverseShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:JustifyVerdict ;')
  L.push('  sh:or (')
  L.push('    [ sh:property [ sh:path qd:verdict ; sh:hasValue "검토 대기" ; ] ]')
  L.push('    [ sh:property [ sh:path qd:decidedBy ; sh:minCount 1 ; ] ]')
  L.push('  ) ;')
  L.push('  sh:severity sh:Violation ;')
  L.push('  sh:message "확정 판정에는 담당자(decidedBy)가 반드시 있어야 합니다 — 자동 확정 금지. 미확정이면 verdict를 «검토 대기»로 두십시오"@ko .')
  L.push('')
  } else {
    L.push('# 「불이익 결정 자동화 금지」는 아직 시행 전이라 제약을 만들지 않습니다 — 시행일 이후 생성됩니다')
    L.push('')
  }
  L.push('# 기사 식별정보는 분석셋에 들어올 수 없다')
  L.push('qd:RuleDriverPseudonymShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:Driver ;')
  L.push('  sh:property [')
  L.push('    sh:path qd:driverName ;')
  L.push('    sh:maxCount 0 ;')
  L.push('    sh:severity sh:Violation ;')
  L.push('    sh:message "분석셋에는 실명(driverName)을 둘 수 없습니다 — 가명키만 허용"@ko ;')
  L.push('  ] .')
  L.push('')
  if (!withSparql) return L.join('\n')

  L.push('# 회차 연료는 구간값이어야 한다 (누적값 금지)')
  L.push(`# 시내버스 CNG 실측 소모는 ${perKm(FUEL_LIMIT.min)}~${perKm(FUEL_LIMIT.max)} m³/km 범위에 모인다.`)
  L.push('# 누적값이 들어오면 회차가 거듭될수록 거리 대비 연료가 끝없이 커진다 — 그 지점을 잡는다.')
  L.push('qd:RuleTripFuelSegmentShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:Trip ;')
  L.push('  sh:sparql [')
  L.push('    sh:severity sh:Violation ;')
  L.push(`    sh:message "회차 연료가 주행거리 대비 과다합니다 (${perKm(FUEL_LIMIT.max)} m³/km 초과) — 구간값이 아니라 누적값이 들어온 것으로 보입니다"@ko ;`)
  L.push('    sh:select """')
  L.push('      SELECT $this ?f ?d WHERE {')
  L.push('        $this qd:fuelM3 ?f ; qd:distanceKm ?d .')
  L.push(`        FILTER (?d > 0 && ?f / ?d > ${perKm(FUEL_LIMIT.max)})`)
  L.push('      }""" ;')
  L.push('  ] .')

  return L.join('\n')
}

/**
 * 이 노드 타입에 **적용되는 제약 목록**.
 *
 * ⑨는 위반만 보여준다. 그런데 «이 레코드는 괜찮은가»를 물으러 온 사람에게 «위반 없음»만 답하면
 * 무엇을 검사했는지 알 수 없다. 통과한 검사도 보여야 «검사를 하긴 한 건가»에 답이 된다.
 * 발행으로 문법이 바뀌면 이 목록도 같이 바뀐다 — 셰이프를 만드는 곳과 같은 정의를 읽기 때문.
 */
export type ShapeCheck = { family: '속성' | '관계' | '문법' | '도메인'; name: string; detail: string; path: string; constraint?: string }

export function shapesFor(type: string, spaceEn: string): ShapeCheck[] {
  const out: ShapeCheck[] = []

  ;(TYPE_PROPS[type] ?? []).forEach((p) => {
    const bits = [p.datatype.replace('xsd:', '').replace('geo:', '')]
    if (p.required) bits.push('필수')
    if (p.min !== undefined || p.max !== undefined) bits.push(`${p.min ?? ''}~${p.max ?? ''}`)
    if (p.oneOf) bits.push(`${p.oneOf.length}종 중 하나`)
    out.push({ family: '속성', name: p.name, detail: bits.join(' · '), path: p.name })
  })

  META_EDGES.filter((e) => spaceOf(e.from).en === spaceEn).forEach((e) => {
    e.relations.forEach((r) => {
      const m = REL_META[r]
      out.push({
        family: '관계',
        name: `«${r}»`,
        detail: `도착 ${spaceOf(e.to).ko} · ${m.card}${m.required ? ' · 필수' : ''}`,
        path: m.en,
      })
    })
  })

  const sp = SPACES.find((s) => s.en === spaceEn)
  if (sp) {
    const outs = META_EDGES.filter((e) => e.from === sp.id).flatMap((e) => e.relations)
    out.push({ family: '문법', name: 'sh:closed', detail: `${sp.ko}에서 나갈 수 있는 관계 ${outs.length}종 밖은 금지`, path: '', constraint: 'Closed' })
  }

  // 도메인 규칙은 특정 타입에만 걸린다 — 안 걸리는 규칙을 «통과»로 적으면 거짓이다
  if (spaceEn === 'Claim' && !DISABLED_RULES.has('ClaimNeedsEvidence'))
    out.push({ family: '도메인', name: '근거 없는 판정 금지', detail: '뒷받침하는 관측이 하나 이상 있어야 한다', path: '← supports' })
  if (type === 'JustifyVerdict') out.push({ family: '도메인', name: '감점 자동 확정 금지', detail: '확정 담당자(decidedBy)가 있어야 한다', path: 'decidedBy' })
  if (type === 'Driver') out.push({ family: '도메인', name: '분석셋 실명 금지', detail: '실명(driverName)을 둘 수 없다 — 가명키만', path: 'driverName' })
  if (type === 'Trip')
    out.push({
      family: '도메인',
      name: '회차 연료 누적값 탐지',
      detail: `주행거리 대비 ${perKm(FUEL_LIMIT.max)} m³/km 초과 금지`,
      path: 'fuelM3',
      constraint: 'SPARQL',
    })

  return out
}

/** 셰이프 개수 요약 */
export function shaclStats() {
  const propShapes = Object.values(TYPE_PROPS).reduce((n, p) => n + p.length, 0)
  const relShapes = META_EDGES.reduce((n, e) => n + e.relations.length, 0)
  const closed = SPACES.length
  const domain = 4
  return { nodeShapes: Object.keys(TYPE_PROPS).length + new Set(META_EDGES.map((e) => e.from)).size + closed + domain, propShapes, relShapes, closed, domain }
}
