import { useState } from 'react'
import { Panel } from '../components/ui'
import { META_EDGES, RELATION_GLOSSARY, SPACES, spaceOf } from './meta'
import { META_LAYERS, SPACE_IMPACTS } from './impactmeta'
import { buildShacl } from './shacl'
import { REL_META, SPACE_ALIGN, STANDARDS, TYPE_ALIGN } from './standards'

/**
 * ⑧ 내보내기 — 문법을 표준 형식으로 꺼낸다.
 * "우리끼리만 아는 구조"가 아니라는 증명. 다른 도시·사업자에게 이 파일만 넘기면 된다.
 */

const slug = (en: string) => en.replace(/[^A-Za-z0-9]/g, '')
const relSlug = (ko: string) => REL_META[ko]?.en ?? slug(ko)

function buildJsonLd() {
  return JSON.stringify(
    {
      '@context': {
        '@vocab': 'https://qdrive.ai/ontology/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        ko: 'https://qdrive.ai/ontology/ko',
      },
      '@id': 'https://qdrive.ai/ontology/v1.0',
      version: '1.0.0',
      title: 'Qdrive 대구 시내버스 운행 온톨로지',
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
  const L: string[] = ['// Qdrive 온톨로지 v1.0 — Neo4j 스키마', '// 노드 키 제약조건']
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
    '# Qdrive 온톨로지 문법 v1.0',
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

const FORMATS = [
  { key: 'jsonld', ko: 'JSON-LD', ext: 'jsonld', mime: 'application/ld+json', desc: '연결 데이터 표준 — 그대로 트리플 스토어에 적재', build: buildJsonLd },
  { key: 'ttl', ko: 'Turtle (OWL)', ext: 'ttl', mime: 'text/turtle', desc: 'RDF/OWL — domain·range로 문법이 강제된다', build: buildTurtle },
  { key: 'cypher', ko: 'Cypher', ext: 'cypher', mime: 'text/plain', desc: 'Neo4j 제약조건 + 문법 위반 감사 질의', build: buildCypher },
  { key: 'shacl', ko: 'SHACL 제약', ext: 'shacl.ttl', mime: 'text/turtle', desc: '실제로 막는 규칙 — 적재 시점 검사', build: buildShacl },
  { key: 'md', ko: '문법 명세서', ext: 'md', mime: 'text/markdown', desc: '사람이 읽는 문서 — 협약·제안서 첨부용', build: buildMarkdown },
] as const

export default function Export() {
  const [key, setKey] = useState<(typeof FORMATS)[number]['key']>('jsonld')
  const [copied, setCopied] = useState(false)
  const f = FORMATS.find((x) => x.key === key)!
  const text = f.build()

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
    a.download = `qdrive-ontology-v1.0.${f.ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-3">
      <Panel
        title="내보내기 — 우리끼리만 아는 구조가 아니다"
        right={<span className="text-[11px] text-gray-500">{text.split('\n').length}줄 · {(text.length / 1024).toFixed(1)}KB</span>}
      >
        <div className="grid grid-cols-5 gap-2 max-[1000px]:grid-cols-3 max-[640px]:grid-cols-2">
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
                <div className={`text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{x.ko}</div>
                <div className="mt-0.5 break-keep text-[10.5px] leading-relaxed text-gray-500">{x.desc}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-600">.{x.ext}</div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-sky-500/40 bg-sky-500/12 px-3 py-1.5 text-[12px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {copied ? '✓ 복사됨' : '📋 복사'}
          </button>
          <button
            onClick={download}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/12 px-3 py-1.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ⬇ 파일로 저장
          </button>
          <span className="text-[11px] text-gray-500">qdrive-ontology-v1.0.{f.ext}</span>
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
