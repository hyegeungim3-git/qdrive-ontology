import { META_EDGES, SPACES, spaceOf } from './meta'
import { REL_META, TYPE_PROPS } from './standards'

/**
 * SHACL 셰이프 생성 — OWL은 어휘를 정의할 뿐 검사하지 않는다. 실제로 막는 것은 SHACL이다.
 *
 * 세 종류의 제약을 낸다.
 *  1) 속성 제약 — 필수 여부 · 자료형 · 값 범위 · 열거값
 *  2) 관계 제약 — 도착 클래스 · 카디널리티 · 필수 관계
 *  3) 문법 제약 — 정의되지 않은 방향의 관계를 막는 닫힌(closed) 셰이프
 */

const slug = (en: string) => en.replace(/[^A-Za-z0-9]/g, '')

/** 심각도 — 핵심 사슬을 어기면 Violation, 나머지는 Warning */
const severityOf = (core: boolean) => (core ? 'sh:Violation' : 'sh:Warning')

export function buildShacl(): string {
  const L: string[] = [
    '@prefix qd:   <https://qdrive.ai/ontology/> .',
    '@prefix sh:   <http://www.w3.org/ns/shacl#> .',
    '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
    '@prefix geo:  <http://www.opengis.net/ont/geosparql#> .',
    '',
    '# ═══════════════════════════════════════════════════════════',
    '# Qdrive 온톨로지 SHACL 제약 v1.0',
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
      L.push(`    sh:severity ${severityOf(!!e.core)} ;`)
      L.push(`    sh:message "«${r}»의 도착은 ${spaceOf(e.to).ko}여야 합니다 (${m.card}${m.required ? ' · 필수' : ''})"@ko ;`)
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
    L.push(`qd:${s.en}ClosedShape a sh:NodeShape ;`)
    L.push(`  sh:targetClass qd:${s.en} ;`)
    L.push('  sh:closed true ;')
    L.push(`  sh:ignoredProperties ( rdf:type ${outs.join(' ')} ) ;`)
    L.push(`  sh:severity sh:Violation ;`)
    L.push(`  sh:message "${s.ko}에서 나갈 수 있는 관계는 ${outs.length}종뿐입니다"@ko .`)
    L.push('')
  })

  /* ── 4) 도메인 규칙 — 문법을 넘어선 업무 원칙 ── */
  L.push('# ── 4. 도메인 규칙 — 문법이 아니라 업무 원칙 ──', '')
  L.push('# 판정은 근거(관측) 없이 존재할 수 없다')
  L.push('qd:ClaimNeedsEvidenceShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:Claim ;')
  L.push('  sh:property [')
  L.push('    sh:path [ sh:inversePath qd:supports ] ;')
  L.push('    sh:minCount 1 ;')
  L.push('    sh:severity sh:Violation ;')
  L.push('    sh:message "근거 관측이 없는 판정은 만들 수 없습니다"@ko ;')
  L.push('  ] .')
  L.push('')
  L.push('# 불이익으로 이어지는 판정은 사람이 확정해야 한다')
  L.push('qd:NoAutoAdverseShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:JustifyVerdict ;')
  L.push('  sh:property [')
  L.push('    sh:path qd:decidedBy ;')
  L.push('    sh:minCount 1 ;')
  L.push('    sh:severity sh:Violation ;')
  L.push('    sh:message "감점 확정에는 담당자(decidedBy)가 반드시 있어야 합니다 — 자동 확정 금지"@ko ;')
  L.push('  ] .')
  L.push('')
  L.push('# 기사 식별정보는 분석셋에 들어올 수 없다')
  L.push('qd:DriverPseudonymShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:Driver ;')
  L.push('  sh:property [')
  L.push('    sh:path qd:driverName ;')
  L.push('    sh:maxCount 0 ;')
  L.push('    sh:severity sh:Violation ;')
  L.push('    sh:message "분석셋에는 실명(driverName)을 둘 수 없습니다 — 가명키만 허용"@ko ;')
  L.push('  ] .')
  L.push('')
  L.push('# 회차 연료는 구간값이어야 한다 (누적값 금지)')
  L.push('qd:TripFuelSegmentShape a sh:NodeShape ;')
  L.push('  sh:targetClass qd:Trip ;')
  L.push('  sh:sparql [')
  L.push('    sh:severity sh:Violation ;')
  L.push('    sh:message "회차 연료가 직전 회차보다 단조 증가합니다 — 누적값이 들어온 것으로 보입니다"@ko ;')
  L.push('    sh:select """')
  L.push('      SELECT $this WHERE {')
  L.push('        $this qd:fuelM3 ?f ; qd:performedBy ?v ; qd:startTime ?t .')
  L.push('        ?prev qd:performedBy ?v ; qd:startTime ?pt ; qd:fuelM3 ?pf .')
  L.push('        FILTER (?pt < ?t && ?f > ?pf * 1.8)')
  L.push('      }""" ;')
  L.push('  ] .')

  return L.join('\n')
}

/** 셰이프 개수 요약 */
export function shaclStats() {
  const propShapes = Object.values(TYPE_PROPS).reduce((n, p) => n + p.length, 0)
  const relShapes = META_EDGES.reduce((n, e) => n + e.relations.length, 0)
  const closed = SPACES.length
  const domain = 4
  return { nodeShapes: Object.keys(TYPE_PROPS).length + new Set(META_EDGES.map((e) => e.from)).size + closed + domain, propShapes, relShapes, closed, domain }
}
