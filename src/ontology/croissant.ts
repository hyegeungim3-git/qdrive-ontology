import { currentVersion } from './grammar'
import { PERMISSIONS, ROLES } from './policy'
import { TYPE_ALIGN } from './standards'
import { allRuns, simIso } from './lineage'
import type { Dataset } from './catalog'

/**
 * Croissant — AI 학습셋 서술.
 *
 * MLCommons Croissant는 schema.org 위에 ML 데이터셋 서술을 얹은 규격이다. 2026-02의 **1.1**에서
 * 정확히 우리에게 필요한 것들이 들어왔다: 기계가 읽는 프로버넌스, 도메인 온톨로지와의 어휘 연결,
 * 구조화된 이용 정책, 거버넌스 태그.
 *
 * **여기서 속성명을 지어내지 않는다.** 1.1은 프로버넌스에 **W3C PROV-O**, 이용 규칙에 **ODRL**을
 * 그대로 채택하고 자체 속성을 새로 만들지 않는다고 명시한다. 그래서 이 파일은
 *  - Croissant 코어 속성(`cr:RecordSet` · `cr:Field` · `dataType` · `source` · `equivalentProperty` …)은 규격 그대로
 *  - 프로버넌스·이용 정책은 `prov:` · `odrl:` 표준 어휘로
 * 쓴다. 확인하지 못한 1.1 전용 철자는 쓰지 않는다.
 *
 * 이 파일이 「AI Ready Data」의 실체다. 세 가지가 값에 붙어서 나간다.
 *  1) **의미** — 필드마다 `equivalentProperty`로 우리 온톨로지 IRI를, `dataType`으로 표준 어휘를 가리킨다.
 *  2) **단위** — 수치 필드에 단위와 QUDT 단위 IRI. 이게 없으면 모델이 `0.54`를 해석할 수 없다.
 *  3) **한계** — 격리 건수·통과율·미측정 지표를 숨기지 않는다. 학습셋의 결손을 적는 것이 데이터 카드의 몫이다.
 */

const XSD_TO_CR: Record<string, string> = {
  'xsd:string': 'sc:Text',
  'xsd:decimal': 'sc:Float',
  'xsd:integer': 'sc:Integer',
  'xsd:dateTime': 'sc:DateTime',
  'xsd:boolean': 'sc:Boolean',
  'geo:wktLiteral': 'sc:Text',
}

const ONT = 'https://qdrive.ai/ontology/'

export function buildCroissant(list: Dataset[]): string {
  const runs = allRuns()
  const withData = list.filter((d) => d.rows > 0)
  const version = currentVersion()

  const doc = {
    '@context': {
      '@language': 'ko',
      '@vocab': 'https://schema.org/',
      cr: 'http://mlcommons.org/croissant/',
      sc: 'https://schema.org/',
      dct: 'http://purl.org/dc/terms/',
      prov: 'http://www.w3.org/ns/prov#',
      odrl: 'http://www.w3.org/ns/odrl/2/',
      dqv: 'http://www.w3.org/ns/dqv#',
      qudt: 'http://qudt.org/schema/qudt/',
      unit: 'http://qudt.org/vocab/unit/',
      qd: ONT,
      data: { '@id': 'cr:data', '@type': '@json' },
      dataType: { '@id': 'cr:dataType', '@type': '@vocab' },
      field: 'cr:field',
      recordSet: 'cr:recordSet',
      source: 'cr:source',
      references: 'cr:references',
      equivalentProperty: 'cr:equivalentProperty',
      key: 'cr:key',
      examples: 'cr:examples',
    },

    '@type': 'sc:Dataset',
    '@id': `${ONT}dataset/${version}`,
    'dct:conformsTo': 'http://mlcommons.org/croissant/1.0',
    name: 'qdrive-daegu-bus-operations',
    description:
      '대구 시내버스 운행 데이터의 의미 구조(온톨로지) 위에서 만들어진 학습셋 서술. ' +
      '관측 → 판정 → 성과 ← 조치의 인과 사슬을 그대로 담고 있어, 값뿐 아니라 그 값이 선 근거까지 함께 읽을 수 있습니다.',
    version: version.replace('v', '') + '.0',
    keywords: ['대구 시내버스', 'DTG', '위험운전', '안전점수', '온톨로지', 'SHACL', '지식그래프'],
    publisher: { '@type': 'sc:Organization', name: 'Qdrive' },
    isLiveDataset: true,
    inLanguage: 'ko',

    /* ── 이용 정책 — Croissant 1.1이 지정한 대로 ODRL 어휘로. 앱 안에만 살던 규정이 데이터에 붙어 나간다 ── */
    'odrl:hasPolicy': {
      '@type': 'odrl:Set',
      'odrl:uid': `${ONT}policy/access`,
      'odrl:permission': ROLES.flatMap((r) =>
        r.permits.map((p) => ({
          'odrl:assignee': { '@type': 'odrl:PartyCollection', 'odrl:source': `${ONT}role/${r.id}`, name: r.ko },
          'odrl:action': `qd:${p}`,
          name: PERMISSIONS.find((x) => x.id === p)?.ko ?? p,
        })),
      ),
      'odrl:prohibition': ROLES.flatMap((r) =>
        r.denies.map((d) => ({
          'odrl:assignee': { '@type': 'odrl:PartyCollection', 'odrl:source': `${ONT}role/${r.id}`, name: r.ko },
          'odrl:action': `qd:${d.p}`,
          'dct:description': d.why,
        })),
      ),
      'dct:description':
        '이 정책은 장식이 아니라 실행됩니다 — 적재 계층은 SHACL이, 표시 계층은 접근 정책이 막습니다. ' +
        '다만 데모의 표시 차단은 클라이언트에서 일어나므로, 실서비스에서는 서버가 애초에 내려주지 않아야 합니다.',
    },

    /* ── 프로버넌스 — PROV-O. 「이 데이터를 무엇이 언제 만들었나」 ── */
    'prov:wasGeneratedBy': runs.slice(0, 8).map((r) => ({
      '@id': r.id.replace('qdi:', `${ONT}run/`),
      '@type': 'prov:Activity',
      'prov:startedAtTime': simIso(r.at),
      'prov:endedAtTime': simIso(r.at + r.ms / 1000),
      'prov:wasAssociatedWith': { '@type': 'prov:SoftwareAgent', name: r.agent },
      'qd:grammarVersion': r.version,
      'qd:inputNodes': r.used.nodes,
      'qd:passedRecords': r.generated.passed,
      'qd:heldRecords': r.generated.held,
    })),

    distribution: [
      {
        '@type': 'cr:FileObject',
        '@id': 'graph-ttl',
        name: 'qdrive-graph.ttl',
        description: '인스턴스 그래프 — RDF Turtle. ⑬ 내보내기의 Turtle 형식과 같은 산출물입니다.',
        encodingFormat: 'text/turtle',
      },
      {
        '@type': 'cr:FileObject',
        '@id': 'shapes-ttl',
        name: 'qdrive-shapes.ttl',
        description: '이 데이터가 통과한 SHACL 제약. 학습 전에 무엇이 검사됐는지 알 수 있습니다.',
        encodingFormat: 'text/turtle',
      },
    ],

    /* ── RecordSet — 데이터셋 하나가 노드 타입 하나 ── */
    recordSet: withData.map((d) => ({
      '@type': 'cr:RecordSet',
      '@id': d.id.toLowerCase(),
      name: d.ko,
      description: d.note || `${d.spaceKo} 스페이스의 ${d.ko}`,
      // 도메인 온톨로지 연결 — 1.1의 «어휘 상호운용»
      dataType: `qd:${d.id}`,
      'dqv:hasQualityMeasurement': {
        '@type': 'dqv:QualityMeasurement',
        'dqv:isMeasurementOf': 'qd:gatePassRate',
        'dqv:value': d.pass,
        'dct:description': `레코드 ${d.rows}건 중 ${d.held}건 격리 — 적재 게이트 실측`,
      },
      ...(d.sensitive ? { 'odrl:hasPolicy': { '@type': 'odrl:Set', 'dct:description': '개인정보가 섞이는 데이터셋 — 가명 처리 후에만 학습에 사용' } } : {}),
      field: (d.fields.length ? d.fields : []).map((f) => ({
        '@type': 'cr:Field',
        '@id': `${d.id.toLowerCase()}/${f.name}`,
        name: f.name,
        description: f.note ?? '',
        dataType: XSD_TO_CR[f.datatype] ?? 'sc:Text',
        // 우리 온톨로지 속성을 가리킨다 — AI가 필드 이름이 아니라 «의미»로 붙을 수 있다
        equivalentProperty: `qd:${f.name}`,
        ...(f.unit ? { 'qudt:unit': f.qudt ?? f.unit, 'qudt:symbol': f.unit } : {}),
        ...(f.oneOf ? { 'sc:valueReference': f.oneOf } : {}),
        ...(f.min !== undefined ? { 'sc:minValue': f.min } : {}),
        ...(f.max !== undefined ? { 'sc:maxValue': f.max } : {}),
        'sc:valueRequired': f.required,
      })),
      ...(TYPE_ALIGN[d.id]?.length ? { 'sc:sameAs': TYPE_ALIGN[d.id].map((a) => a.term) } : {}),
    })),

    /* ── 데이터 카드 — 숨기지 않는 항목. 학습셋 서술의 절반은 «한계»다 ── */
    'sc:usageInfo': [
      '이 스냅샷은 시뮬레이터 엔진이 만든 데모 데이터입니다 — 실단말(DTG 409/521 · OBD/CAN · RTK) 연동 시 같은 구조로 대체됩니다.',
      '차량 9대 규모라 노선·시간대 편향이 있습니다. 실서비스 규모(일 1,700만 패킷)에서 분포가 달라집니다.',
      '정시율은 «미측정»으로 표기됩니다 — 원천이 없으면 숫자를 만들지 않습니다.',
      '격리된 레코드는 하류 집계에서 제외됩니다. 격리 건수가 0이면 검사를 안 했을 가능성도 함께 확인해야 합니다(prov:wasGeneratedBy의 실행 횟수).',
      '불이익 결정(평가·징계·정산 확정)에 이 데이터를 자동으로 쓰지 않습니다 — 규정 스페이스에 못 박혀 있습니다.',
    ],
    citeAs: `@misc{qdrive_${version.replace('v', 'v')},\n  title  = {Qdrive 대구 시내버스 운행 온톨로지 ${version}},\n  author = {Qdrive},\n  year   = {2026}\n}`,
  }

  return JSON.stringify(doc, null, 2)
}
