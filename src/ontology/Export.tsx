import { useState } from 'react'
import { Panel } from '../components/ui'
import { META_EDGES, RELATION_GLOSSARY, SPACES, spaceOf } from './meta'
import { META_LAYERS, SPACE_IMPACTS } from './impactmeta'
import { buildShacl } from './shacl'
import { REL_META, SPACE_ALIGN, STANDARDS, TYPE_ALIGN } from './standards'
import { ruleFeedback, useQuarantine, waiverBlock, type QItem } from './quarantine'
import { currentVersion, diff, snapshotOf, useGrammar, type Release } from './grammar'
import { can, denyReason, roleOf, useRole } from './policy'

/**
 * ⑧ 내보내기 — 문법을 표준 형식으로 꺼낸다.
 * "우리끼리만 아는 구조"가 아니라는 증명. 다른 도시·사업자에게 이 파일만 넘기면 된다.
 */

const slug = (en: string) => en.replace(/[^A-Za-z0-9]/g, '')
const relSlug = (ko: string) => REL_META[ko]?.en ?? slug(ko)

function buildJsonLd(releases: Release[] = []) {
  return JSON.stringify(
    {
      '@context': {
        '@vocab': 'https://qdrive.ai/ontology/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        ko: 'https://qdrive.ai/ontology/ko',
      },
      '@id': `https://qdrive.ai/ontology/${currentVersion()}`,
      version: currentVersion().replace('v', '') + '.0',
      title: 'Qdrive 대구 시내버스 운행 온톨로지',
      // 이 파일이 몇 번째 개정인지, 무엇이 왜 바뀌었는지를 파일 자체가 들고 다닌다
      revisions: releases.map((r) => ({
        version: r.version,
        approvedBy: r.approvedBy,
        amendments: r.amendments.map((a) => ({ kind: a.kind, ko: a.ko, basedOnRule: a.id, waivers: a.basis.waived })),
      })),
      standards: STANDARDS.map((x) => ({ '@id': x.prefix, uri: x.uri, ko: x.ko, org: x.org })),
      spaces: SPACES.map((s) => ({
        '@id': s.en,
        ko: s.ko,
        'rdfs:comment': s.desc,
        alignment: SPACE_ALIGN[s.id].map((a) => ({ standard: a.std, term: a.term, match: 'skos:' + a.match + 'Match', note: a.note })),
        nodeTypes: s.types.map((t) => ({
          '@id': slug(t.en),
          ko: t.ko,
          note: t.note,
          alignment: (TYPE_ALIGN[slug(t.en)] ?? []).map((a) => ({ standard: a.std, term: a.term, match: 'skos:' + a.match + 'Match' })),
        })),
        impactCategories: SPACE_IMPACTS[s.id],
      })),
      relations: META_EDGES.flatMap((e) =>
        e.relations.map((r) => {
          const m = REL_META[r]
          return {
            '@id': m.en,
            ko: r,
            'rdfs:domain': spaceOf(e.from).en,
            'rdfs:range': spaceOf(e.to).en,
            'rdfs:comment': RELATION_GLOSSARY[r] ?? '',
            'owl:inverseOf': m.inverse,
            cardinality: m.card,
            required: m.required,
            alignment: m.align ? { standard: m.align.std, term: m.align.term, match: 'skos:' + m.align.match + 'Match' } : null,
            core: !!e.core,
          }
        }),
      ),
      activeMetadata: META_LAYERS.map((l) => ({ '@id': l.id, ko: l.ko, attributes: l.attrs.map((a) => ({ '@id': a.key, ko: a.ko, note: a.desc })) })),
    },
    null,
    2,
  )
}

function buildTurtle() {
  const L: string[] = [
    '@prefix qd:   <https://qdrive.ai/ontology/> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix owl:  <http://www.w3.org/2002/07/owl#> .',
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    ...STANDARDS.filter((x) => x.key !== 'skos').map((x) => '@prefix ' + x.prefix + ': <' + x.uri + '> .'),
    '',
    'qd:Ontology a owl:Ontology ;',
    '  owl:versionInfo "1.0.0" ;',
    '  rdfs:label "Qdrive 대구 시내버스 운행 온톨로지"@ko .',
    '',
    '# ── 스페이스 (상위 클래스) ──',
  ]
  SPACES.forEach((s) => {
    L.push(`qd:${s.en} a owl:Class ;`)
    L.push(`  rdfs:label "${s.ko}"@ko ;`)
    L.push(`  rdfs:comment "${s.desc}"@ko .`)
    SPACE_ALIGN[s.id].forEach((a) => {
      L.push(`qd:${s.en} skos:${a.match}Match ${a.term.split(' ')[0]} .`)
    })
    s.types.forEach((t) => {
      L.push(`qd:${slug(t.en)} a owl:Class ; rdfs:subClassOf qd:${s.en} ; rdfs:label "${t.ko}"@ko .`)
      const ta = TYPE_ALIGN[slug(t.en)] ?? []
      ta.forEach((a) => L.push(`qd:${slug(t.en)} skos:${a.match}Match ${a.term.split(' ')[0]} .`))
    })
    L.push('')
  })
  L.push('# ── 관계 (도메인·레인지로 문법을 강제) ──')
  META_EDGES.forEach((e) => {
    e.relations.forEach((r) => {
      L.push(`qd:${relSlug(r)} a owl:ObjectProperty ;`)
      L.push(`  rdfs:label "${r}"@ko ;`)
      L.push(`  rdfs:domain qd:${spaceOf(e.from).en} ;`)
      L.push(`  rdfs:range  qd:${spaceOf(e.to).en} ;`)
      const m = REL_META[r]
      L.push(`  rdfs:comment "${(RELATION_GLOSSARY[r] ?? '').replace(/"/g, "'")} [${m.card}${m.required ? ' · 필수' : ''}]"@ko .`)
      if (m.align) L.push(`qd:${m.en} skos:${m.align.match}Match ${m.align.term.split(' ')[0]} .`)
    })
  })
  return L.join('\n')
}

function buildCypher() {
  const L: string[] = [`// Qdrive 온톨로지 ${currentVersion()} — Neo4j 스키마`, '// 노드 키 제약조건']
  SPACES.forEach((s) => {
    s.types.forEach((t) => {
      L.push(`CREATE CONSTRAINT ${slug(t.en).toLowerCase()}_id IF NOT EXISTS FOR (n:${slug(t.en)}) REQUIRE n.id IS UNIQUE;`)
    })
  })
  L.push('', '// 스페이스 라벨 — 모든 노드는 자기 스페이스 라벨도 함께 갖는다')
  SPACES.forEach((s) => {
    L.push(`// ${s.ko}: ${s.types.map((t) => slug(t.en)).join(', ')} → :${s.en}`)
  })
  L.push('', '// 문법 검사 — 정의되지 않은 방향의 관계를 찾는다 (적재 후 감사용)')
  L.push('MATCH (a)-[r]->(b)')
  L.push('WHERE NOT (')
  META_EDGES.forEach((e, i) => {
    const rels = e.relations.map((x) => `'${relSlug(x)}'`).join(', ')
    L.push(`  ${i === 0 ? '  ' : 'OR'} (a:${spaceOf(e.from).en} AND b:${spaceOf(e.to).en} AND type(r) IN [${rels}])`)
  })
  L.push(')')
  L.push('RETURN labels(a) AS from, type(r) AS rel, labels(b) AS to, count(*) AS violations;')
  return L.join('\n')
}

function buildMarkdown() {
  const L: string[] = [
    `# Qdrive 온톨로지 문법 ${currentVersion()}`,
    '',
    '대구 시내버스 운행 데이터의 의미 구조. 스페이스 9개와 그 사이에 허용된 관계만으로 이루어진다.',
    '',
    '## 핵심 사슬',
    '',
    '```',
    '관측(Evidence) ─뒷받침한다→ 판정(Claim) ─반영된다→ 성과(Outcome) ←올린다─ 조치(Lever)',
    '```',
    '',
    '## 스페이스',
    '',
    '| 스페이스 | English | 뜻 | 노드 타입 | 영향 범주 |',
    '|---|---|---|---|---|',
    ...SPACES.map((s) => `| ${s.ko} | ${s.en} | ${s.desc} | ${s.types.map((t) => t.ko).join(', ')} | ${SPACE_IMPACTS[s.id].join(', ')} |`),
    '',
    '## 관계 문법',
    '',
    '이 표 밖의 관계는 만들지 않는다.',
    '',
    '| 출발 | 도착 | 허용 관계 | 설명 |',
    '|---|---|---|---|',
    ...META_EDGES.map((e) => `| ${spaceOf(e.from).ko} | ${spaceOf(e.to).ko}${e.core ? ' **(핵심)**' : ''} | ${e.relations.join(', ')} | ${e.desc} |`),
    '',
    '## 관계 어휘 사전',
    '',
    ...[...new Set(META_EDGES.flatMap((e) => e.relations))].map((r) => `- **${r}** (\`${relSlug(r)}\`) — ${RELATION_GLOSSARY[r] ?? ''}`),
    '',
    '## 표준 정렬',
    '',
    '우리 어휘는 국제 표준 위에 서 있다. 정렬 강도는 SKOS 매핑 관계를 그대로 쓴다.',
    '',
    '| 표준 | 기관 | 무엇을 정의하나 |',
    '|---|---|---|',
    ...STANDARDS.map((x) => '| `' + x.prefix + ':` ' + x.ko + ' | ' + x.org + ' | ' + x.what + ' |'),
    '',
    '| 스페이스 | 표준 어휘 | 정렬 강도 |',
    '|---|---|---|',
    ...SPACES.flatMap((s) => SPACE_ALIGN[s.id].map((a) => '| ' + s.ko + ' | `' + a.term + '` | skos:' + a.match + 'Match |')),
    '',
    '## 액티브 메타데이터',
    '',
    '모든 노드에 따라다니는 4계층 12속성.',
    '',
    ...META_LAYERS.map((l) => `- **${l.ko}** (${l.desc}) — ${l.attrs.map((a) => a.ko).join(' · ')}`),
    '',
    '## 원칙',
    '',
    '- 표준 코드(공단 위험운전 8종)를 그대로 쓴다 — 자체 정의를 만들지 않는다.',
    '- 판정은 근거(관측) 없이 만들지 않는다.',
    '- 불이익 결정(평가·징계·정산 확정)은 자동화하지 않는다.',
    '- 계수의 근거 유형(실측/환산/추정/정성)에 따라 신뢰도 상한을 다르게 둔다.',
  ]
  return L.join('\n')
}

const hhmm = (s: number) => `${String(Math.floor(s / 3600) + 5).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`

/**
 * 문법 개정 이력.
 *
 * 다른 도시·사업자에게 문법 파일만 넘기면 «지금 이 규격»은 전달된다. 하지만 규격을 받아 쓰는 쪽이
 * 정말 알고 싶은 것은 **왜 이렇게 됐나**다 — 어떤 조항이 나중에 열렸고, 무엇이 그것을 요구했는지.
 * 그게 없으면 다음 개정 때 같은 논쟁을 처음부터 다시 한다.
 */
function buildChangelog(releases: Release[] = []): string {
  const L: string[] = [
    '# Qdrive 온톨로지 개정 이력',
    '',
    `현재 버전 **${currentVersion()}** · 개정 ${releases.length}회 · 최초 정의 v1.0`,
    '',
    '## 개정 원칙',
    '',
    '- **개정은 데이터가 요구할 때 한다.** 같은 규칙이 격리 큐에서 반복해서 예외 승인으로 풀리면, 틀린 것은 데이터가 아니라 규칙일 수 있다.',
    '- **규정에서 온 규칙은 완화 대상이 아니다.** 「불이익 결정 자동화 금지」·「가명 처리」는 예외가 쌓여도 개정안에 담기지 않는다 — 규칙이 아니라 현실을 고친다.',
    '- **핵심 사슬을 느슨하게 하는 개정은 별도 승인을 받는다.** 근거 없는 판정이 만들어질 수 있게 되는 변경이 조용히 지나가면 안 된다.',
    '- **발행은 소급하지 않는다.** 새 문법은 앞으로 들어오는 데이터에 적용되고, 이미 격리된 레코드는 자동으로 풀리지 않는다.',
    '',
  ]

  if (!releases.length) {
    L.push('## 개정 없음', '')
    L.push('최초 정의 **v1.0** 그대로입니다. 아직 문법을 고쳐야 할 만큼 반복된 예외가 없었다는 뜻입니다.')
    L.push('')
    L.push('개정 횟수가 0이라는 것은 그 자체로 나쁜 신호가 아닙니다 — 다만 **검증을 실제로 돌리고 있는지**는 격리 이력으로 함께 확인해야 합니다.')
    return L.join('\n')
  }

  releases.forEach((r, i) => {
    const before = snapshotOf(i === 0 ? 'v1.0' : releases[i - 1].version)
    const d = diff(before, r.snapshot)
    const prevKo = i === 0 ? 'v1.0' : releases[i - 1].version

    L.push(`## ${r.version}`, '')
    L.push(`${hhmm(r.at)} · 승인 **${r.approvedBy}** · 개정 ${r.amendments.length}건`, '')

    L.push('### 요약', '')
    L.push(`| 축 | ${prevKo} | ${r.version} | |`, '|---|---|---|---|')
    d.stats.forEach((s) => L.push(`| ${s.ko} | ${s.before} | ${s.after} | ${s.moved ? '**바뀜**' : '그대로' } |`))
    L.push('')

    if (d.rows.length) {
      L.push('### 무엇이 바뀌었나', '')
      L.push(`| 구분 | 영역 | 항목 | ${prevKo} | ${r.version} |`, '|---|---|---|---|---|')
      d.rows.forEach((x) => L.push(`| ${x.kind === 'add' ? '추가' : x.kind === 'remove' ? '제거' : '변경'} | ${x.area} | ${x.key} | ${x.before} | ${x.after} |`))
      L.push('')
    }

    L.push('### 왜 바꿨나', '')
    r.amendments.forEach((a, k) => {
      L.push(`${k + 1}. **${a.ko}**`)
      L.push(`   - 근거 규칙: \`${a.id}\` — 격리 후 예외 승인 **${a.basis.waived}건**${a.basis.held ? ` · 보류 ${a.basis.held}건` : ''}`)
      if (a.basis.notes.length) L.push(`   - 담당자 사유: ${a.basis.notes.map((n) => `“${n}”`).join(' · ')}`)
      L.push(`   - 영향 좌표: ${spaceOf(a.space).ko} × ${a.change}`)
      L.push(`   - 설명: ${a.detail}`)
    })
    L.push('')
  })

  const now = snapshotOf(currentVersion())
  L.push('## 현재 문법 요약', '')
  L.push('| 항목 | 값 |', '|---|---|')
  L.push(`| 버전 | ${currentVersion()} |`)
  L.push(`| 관계 방향 | ${now.edges.length}개 |`)
  L.push(`| 관계 어휘 | ${new Set(now.edges.flatMap((e) => e.relations)).size}종 |`)
  L.push(`| 허용 조합 | ${now.edges.reduce((n, e) => n + e.relations.length, 0)} |`)
  L.push(`| 필수 관계 | ${Object.values(now.rel).filter((x) => x.required).length}종 |`)
  L.push(`| 도메인 규칙 | ${4 - now.disabled.length}종 적용${now.disabled.length ? ` · ${now.disabled.length}종 해제됨` : ''} |`)
  L.push(`| 회차 연비 상한 | ${now.fuelMax.toFixed(1)} m³/km |`)

  return L.join('\n')
}

/**
 * 감사 제출용 격리 이력.
 *
 * 다른 형식은 전부 «문법»을 낸다. 이것만 «실제로 있었던 일»을 낸다.
 * 감사에서 물어보는 것은 셋이다 — 무엇이 막혔나, 누가 어떻게 풀었나,
 * 그리고 **규정에서 온 규칙이 예외로 우회되지 않았나**. 셋을 순서대로 답한다.
 */
function buildAudit(q: QItem[] = []): string {
  const L: string[] = ['# Qdrive 품질 격리 이력', '', '데이터 적재 시점 SHACL 검증에서 걸려 하류로 내려보내지 않은 레코드와 그 처리 내역입니다.', '']

  if (!q.length) {
    L.push('## 이력 없음', '', '격리된 레코드가 없습니다. ⑨ SHACL 실검증을 실행하면 위반 레코드가 큐에 쌓이고 여기에 기록됩니다.', '')
    L.push('격리 건수가 0이라는 것은 «검사를 안 했다»는 뜻일 수도 있으므로, 검증 실행 여부를 함께 확인해야 합니다.')
    return L.join('\n')
  }

  const held = q.filter((i) => i.status === '격리')
  const n = (s: string) => q.filter((i) => i.status === s).length
  const protectedItems = q.filter((i) => !!waiverBlock(i))
  const bypassed = protectedItems.filter((i) => i.status === '예외 승인')

  L.push('## 1. 요약', '')
  L.push('| 항목 | 건수 |', '|---|---|')
  L.push(`| 격리 총계 | ${q.length} |`)
  L.push(`| 보류 중 (하류 미전달) | ${held.length} |`)
  L.push(`| 재처리 | ${n('재처리')} |`)
  L.push(`| 예외 승인 | ${n('예외 승인')} |`)
  L.push(`| 원천 수정 요청 | ${n('원천 수정 요청')} |`)
  L.push('')

  L.push('## 2. 규정 보호 규칙의 우회 여부', '')
  L.push('「불이익 결정 자동화 금지」·「가명 처리」에서 온 규칙은 예외 승인으로 통과시킬 수 없도록 시스템이 막습니다.')
  L.push('')
  L.push(`- 해당 규칙으로 격리된 레코드: **${protectedItems.length}건**`)
  L.push(`- 그중 예외 승인으로 우회된 건: **${bypassed.length}건**${bypassed.length === 0 ? ' — 우회 없음' : ' ⚠ 확인 필요'}`)
  if (protectedItems.length) {
    L.push('')
    L.push('| 레코드 | 규칙 | 처리 | 담당자 |', '|---|---|---|---|')
    protectedItems.forEach((i) => L.push(`| ${i.focus} | sh:${i.constraint} ${i.path} | ${i.status} | ${i.decidedBy ?? '—'} |`))
  }
  L.push('')

  L.push('## 3. 격리 레코드 전체', '')
  L.push('| 격리 시각 | 레코드 | 스페이스 | 걸린 규칙 | 심각도 | 처리 | 담당자 | 처리 시각 | 사유 | 보류 시 흔들리는 성과 |')
  L.push('|---|---|---|---|---|---|---|---|---|---|')
  q.forEach((i) =>
    L.push(
      `| ${hhmm(i.at)} | ${i.focus}${i.focusLabel ? ` (${i.focusLabel})` : ''} | ${i.focusSpace} | sh:${i.constraint} \`${i.path}\` | ${i.severity} | ${i.status} | ${i.decidedBy ?? '—'} | ${i.doneAt !== undefined ? hhmm(i.doneAt) : '—'} | ${i.note ?? '—'} | ${i.downstream.join(' · ') || '없음'} |`,
    ),
  )
  L.push('')

  L.push('## 4. 규칙별 진단', '')
  L.push('처리 방식의 분포에서 나온 진단입니다. 예외 승인이 많으면 규칙을, 재처리가 많으면 원천을, 원천 수정 요청이 많으면 커넥터를 봐야 합니다.')
  L.push('')
  L.push('| 규칙 | 격리 | 재처리 | 예외 승인 | 수정 요청 | 진단 | 제안 |', '|---|---|---|---|---|---|---|')
  ruleFeedback(q).forEach((r) =>
    L.push(
      `| sh:${r.constraint} \`${r.path}\` | ${r.held} | ${r.reprocessed} | ${r.waived} | ${r.sourceFix} | ${r.verdict}${r.protectedBy ? ' (규정 보호)' : ''} | ${r.suggestion} |`,
    ),
  )
  L.push('')

  L.push('## 5. 처리 원칙', '')
  L.push('- **격리는 삭제가 아닙니다.** 원본 레코드는 그대로 보관하고 하류(정제 저장소·분석셋)로만 내려보내지 않습니다.')
  L.push('- 처리해도 레코드는 지워지지 않고 상태·담당자·사유만 붙습니다 — 「왜 이게 통과했나」에 답할 수 있어야 하기 때문입니다.')
  L.push('- 예외 승인에는 사유가 반드시 남습니다. 규정에서 온 규칙은 예외 승인 자체가 차단됩니다.')
  L.push('- 진단이 «규칙 재검토»로 나와도 규정에서 온 규칙은 완화 대상에 올리지 않습니다 — 규칙이 아니라 현실을 고쳐야 합니다.')

  return L.join('\n')
}

const FORMATS = [
  { key: 'jsonld', ko: 'JSON-LD', ext: 'jsonld', mime: 'application/ld+json', desc: '연결 데이터 표준 — 그대로 트리플 스토어에 적재', build: buildJsonLd },
  { key: 'ttl', ko: 'Turtle (OWL)', ext: 'ttl', mime: 'text/turtle', desc: 'RDF/OWL — domain·range로 문법이 강제된다', build: buildTurtle },
  { key: 'cypher', ko: 'Cypher', ext: 'cypher', mime: 'text/plain', desc: 'Neo4j 제약조건 + 문법 위반 감사 질의', build: buildCypher },
  { key: 'shacl', ko: 'SHACL 제약', ext: 'shacl.ttl', mime: 'text/turtle', desc: '실제로 막는 규칙 — 적재 시점 검사', build: buildShacl },
  { key: 'md', ko: '문법 명세서', ext: 'md', mime: 'text/markdown', desc: '사람이 읽는 문서 — 협약·제안서 첨부용', build: buildMarkdown },
  { key: 'audit', ko: '격리 이력', ext: 'md', mime: 'text/markdown', desc: '감사 제출용 — 무엇이 막혔고 누가 어떻게 풀었나', build: buildAudit, live: true },
  { key: 'changelog', ko: '개정 이력', ext: 'md', mime: 'text/markdown', desc: '문법이 왜 이렇게 됐나 — 버전별 변경과 근거', build: buildChangelog, live: true },
] as const

export default function Export() {
  const [key, setKey] = useState<(typeof FORMATS)[number]['key']>('jsonld')
  const [copied, setCopied] = useState(false)
  const queue = useQuarantine()
  const releases = useGrammar()
  const role = useRole()
  // 규정이 막는다 — 원본 그래프 반출은 권한이 필요하다
  const mayExport = can(role, 'exportRaw')
  const f = FORMATS.find((x) => x.key === key)!
  // 라이브 상태를 받는 형식만 따로 부른다 — 나머지는 문법에서만 나온다
  const text =
    f.key === 'audit' ? buildAudit(queue) : f.key === 'changelog' ? buildChangelog(releases) : f.key === 'jsonld' ? buildJsonLd(releases) : f.build()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const download = () => {
    const blob = new Blob([text], { type: f.mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download =
      f.key === 'audit' ? `qdrive-격리이력.${f.ext}` : f.key === 'changelog' ? `qdrive-개정이력.${f.ext}` : `qdrive-ontology-${currentVersion()}.${f.ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-3">
      <Panel
        title="내보내기 — 우리끼리만 아는 구조가 아니다"
        right={<span className="text-[11px] text-gray-500">{text.split('\n').length}줄 · {(text.length / 1024).toFixed(1)}KB</span>}
      >
        <div className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-2">
          {FORMATS.map((x) => {
            const on = x.key === key
            return (
              <button
                key={x.key}
                onClick={() => setKey(x.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{x.ko}</span>
                  {'live' in x && x.live && (
                    <span className="rounded bg-rose-400/15 px-1 py-px text-[9px] font-black text-rose-300">라이브</span>
                  )}
                </div>
                <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{x.desc}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-600">.{x.ext}</div>
              </button>
            )
          })}
        </div>

        {!mayExport && (
          <div
            className="mt-3 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed"
            style={{ borderColor: '#f59e0b55', background: '#f59e0b14', color: '#fcd34d' }}
          >
            🔒 <b>«{roleOf(role).ko}» 역할에는 원본 내보내기 권한이 없습니다</b> — {denyReason(role, 'exportRaw')} 아래 미리보기는 볼 수 있지만
            복사·저장은 잠깁니다.
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={copy}
            disabled={!mayExport}
            title={mayExport ? undefined : denyReason(role, 'exportRaw')}
            className="rounded-md border border-sky-500/40 bg-sky-500/12 px-3 py-1.5 text-[12px] font-bold text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {copied ? '✓ 복사됨' : '📋 복사'}
          </button>
          <button
            onClick={download}
            disabled={!mayExport}
            title={mayExport ? undefined : denyReason(role, 'exportRaw')}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ⬇ 파일로 저장
          </button>
          <span className="text-[11px] text-gray-500">
            {f.key === 'audit' ? 'qdrive-격리이력' : f.key === 'changelog' ? 'qdrive-개정이력' : `qdrive-ontology-${currentVersion()}`}.{f.ext}
          </span>
        </div>

        <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-300">
          <code>{text}</code>
        </pre>
      </Panel>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <Panel title="왜 표준 형식으로 꺼내나">
          <div className="space-y-2">
            {[
              ['다른 도시로', '같은 문법을 쓰면 대구에서 만든 학습셋과 다른 도시 데이터가 그대로 합쳐집니다.'],
              ['다른 사업자와', '컨소시엄·후속 사업자가 이 파일만 받으면 우리 구조를 그대로 이어받습니다.'],
              ['검증기관에', 'domain·range가 명시된 OWL은 "이 판정이 어떤 근거 위에 서 있나"를 기계가 검사할 수 있게 합니다.'],
              ['우리 자신에게', '문법이 코드 안에만 있으면 코드를 읽어야 압니다. 파일로 나오면 문서가 됩니다.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                <div className="text-[12.5px] font-bold text-gray-100">{t}</div>
                <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-gray-500">{d}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="적재 시 문법 검사 — Cypher 감사 질의">
          <div className="break-keep text-[11.5px] leading-relaxed text-gray-400">
            Cypher 탭의 마지막 질의는 <b className="text-gray-200">문법에 없는 관계를 찾아내는 감사 쿼리</b>입니다. 그래프 DB에 적재한 뒤 이 질의를
            돌려서 결과가 0행이면 문법이 지켜진 것이고, 행이 나오면 그 관계는 잘못 만들어진 것입니다.
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-[10.5px] leading-relaxed text-emerald-300">
            <code>{`MATCH (a)-[r]->(b)
WHERE NOT ( ...문법 조합... )
RETURN labels(a), type(r), labels(b), count(*);`}</code>
          </pre>
          <div className="mt-2 break-keep text-[11px] leading-relaxed text-gray-500">
            문법은 정의만 해 두면 지켜지지 않습니다. <b className="text-gray-300">적재 시점 검사 + 사후 감사 질의</b> 두 겹으로 강제해야 합니다.
          </div>
        </Panel>
      </div>
    </div>
  )
}
