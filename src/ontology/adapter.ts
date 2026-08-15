/**
 * 역방향 적재 어댑터 — **외부 표준 데이터를 우리 문법으로 받는다.**
 *
 * ③ 표준 정렬은 여태 한 방향뿐이었다. «우리 어휘가 PROV·SOSA·GTFS 어디에 붙는가»는 말했지만,
 * 정작 **남의 표준으로 온 데이터를 어떻게 받느냐**는 답하지 않았다. 정렬만 하고 받지 못하면
 * 그 정렬은 문서 장식이다. 그리고 발주처가 가장 실무적으로 묻는 질문이 바로 이것이다 —
 * 「우리 데이터를 어떻게 넣습니까」.
 *
 * 이 어댑터가 답하는 것은 넷이다.
 *
 *  1. **필드 매핑** — 외부 필드가 우리 어느 속성이 되는가. 그대로 / 환산 / 조합.
 *  2. **받지 않는 것** — 문법에 자리가 없어서 버리는 것, 규정이 막아서 안 받는 것.
 *     «표준이 준다고 다 받는 게 아니다»를 숨기지 않는다.
 *  3. **엔티티 해소** — 원천마다 같은 차량을 다른 키로 부른다. 무엇을 기준으로 같다고 보는가.
 *  4. **검증** — 옮긴 결과를 **⑨와 같은 SHACL**로 실제로 돌린다. 통과 못 하면 격리다.
 *
 * 손으로 «지원합니다»라고 적는 대신, 원문 레코드를 넣어 Turtle이 나오고 그것이 검사를 통과하는지
 * 화면에서 보인다. 「표준을 지원한다」는 말이 대개 거짓인 지점이 여기다.
 */

export type MapStatus = '그대로' | '환산' | '조합' | '문법에 없음' | '규정상 거부'

export type FieldMap = {
  ext: string
  extKo: string
  sample: string
  status: MapStatus
  /** 우리 속성 이름 (TYPE_PROPS의 name과 같아야 한다) */
  to?: string
  /** 어느 노드 타입이 되는가 */
  node?: string
  why: string
}

export type Source = {
  id: 'dtg' | 'gtfsrt' | 'bis'
  ko: string
  org: string
  /** 표준 정렬 표의 prefix와 같은 키 */
  std: string
  what: string
  format: string
  /** 원문 샘플 — 실제 규격의 필드 순서대로 */
  raw: string
  fields: FieldMap[]
  /** 이 원천으로 채울 수 있는 노드 타입 */
  fills: string[]
  /** 우리에겐 필요한데 이 원천에는 없는 것 — 결손을 먼저 적는다 */
  missing: { ko: string; why: string }[]
  /** 엔티티 해소 — 이 원천은 차량을 뭐라고 부르나 */
  idKey: { ext: string; sample: string; rule: string }
}

/* ─────────────────────────────────────────────────────────────
   원천 3종. 필드는 각 규격의 실제 항목 이름을 쓴다 —
   그럴듯한 이름을 지어내면 「우리가 이미 붙여 봤다」가 거짓이 된다.
   ───────────────────────────────────────────────────────────── */

export const SOURCES: Source[] = [
  {
    id: 'dtg',
    ko: '공단 DTG 운행기록',
    org: '한국교통안전공단',
    std: 'dtg',
    what: '디지털운행기록장치가 1초 주기로 남기는 운행기록. 법정 표준이고 이미 전 차량에 달려 있다.',
    format: '고정 항목 CSV (1초 1행)',
    raw: [
      '자동차등록번호,차대번호,운송사업자등록번호,운행기록장치모델명,운행일자,정보발생일시,차량속도,분당엔진회전수,브레이크신호,차량위치X,차량위치Y,방위각,가속도X,가속도Y,주행거리',
      '대구70자3742,KMJHT18BP9C012345,3801100123,DTG-STD-409,260815,060312,47,1180,0,461234,128567,182,-3.6,0.4,182450',
    ].join('\n'),
    idKey: {
      ext: '자동차등록번호',
      sample: '대구70자3742',
      rule: '우리 `vehicleId`와 표기가 같다 — 별도 변환 없이 그대로 조인한다.',
    },
    fields: [
      { ext: '자동차등록번호', extKo: '차량번호', sample: '대구70자3742', status: '그대로', to: 'vehicleId', node: 'Vehicle', why: '모든 원천의 조인 키' },
      { ext: '차대번호', extKo: 'VIN', sample: 'KMJHT18BP9C012345', status: '문법에 없음', why: '차량 식별은 등록번호로 충분하다 — 최소 수집 원칙에 따라 받지 않는다' },
      { ext: '운송사업자등록번호', extKo: '운수사', sample: '3801100123', status: '그대로', to: 'operatorId', node: 'Controller', why: '주체 스페이스의 운수사 식별' },
      { ext: '운행기록장치모델명', extKo: '단말 모델', sample: 'DTG-STD-409', status: '그대로', to: 'deviceModel', node: 'Device', why: '자산 스페이스의 차내 단말' },
      { ext: '운행일자 + 정보발생일시', extKo: '발생 시각', sample: '260815 + 060312', status: '조합', to: 'occurredAt', node: 'RiskEvent', why: 'YYMMDD와 HHMMSS를 합쳐 xsd:dateTime으로' },
      { ext: '차량속도', extKo: '속도', sample: '47', status: '그대로', to: 'speedKmh', node: 'RiskEvent', why: 'km/h 단위가 같다 — 범위 0~120 검사를 받는다' },
      { ext: '분당엔진회전수', extKo: 'RPM', sample: '1180', status: '그대로', to: 'rpm', node: 'RiskEvent', why: '범위 0~3000 검사' },
      { ext: '브레이크신호', extKo: '브레이크', sample: '0', status: '문법에 없음', why: '관측 스페이스에 자리가 없다 — 급감속 판정은 가속도로 한다. 다음 개정 후보' },
      { ext: '차량위치X / Y', extKo: '경위도', sample: '461234 / 128567', status: '환산', to: 'lng / lat', node: 'Location', why: '1/100초 단위 정수 → 십진도. 대한민국 범위(위33~39·경124~132) 검사를 받는다' },
      { ext: '가속도X / Y', extKo: '전후·좌우 가속도', sample: '-3.6 / 0.4', status: '조합', to: 'eventType', node: 'RiskEvent', why: '임계 초과 시 공단 위험운전 8종 코드로 분류 — 자체 코드를 만들지 않는다' },
      { ext: '주행거리', extKo: '누적 주행거리', sample: '182450', status: '환산', to: 'odometerKm', node: 'Vehicle', why: 'm → km. 회차 distanceKm는 구간 차분으로 만든다(누적값 그대로 넣으면 연비 규칙에 걸린다)' },
      { ext: '방위각', extKo: '방위', sample: '182', status: '문법에 없음', why: '위치 관측에 방위 속성이 없다 — 노선 이탈 판정에 쓰려면 개정이 필요하다' },
    ],
    fills: ['Vehicle', 'Device', 'RiskEvent', 'Location', 'Trip', 'Controller'],
    missing: [
      { ko: '정당 판정', why: 'DTG는 «무슨 일이 있었나»만 남긴다. 「정당한가」는 사람과 맥락이 만드는 판정이라 원천에 없다' },
      { ko: '기사 식별', why: 'DTG에 운전자 코드가 있는 모델도 있으나, 규정상 가명키로만 받는다' },
    ],
  },
  {
    id: 'gtfsrt',
    ko: 'GTFS-Realtime VehiclePosition',
    org: 'MobilityData (국제 표준)',
    std: 'gtfs',
    what: '대중교통 실시간 위치 표준. 다른 도시·해외 시스템과 붙일 때의 공통 언어.',
    format: 'Protobuf → JSON',
    raw: JSON.stringify(
      {
        id: '3742',
        vehicle: {
          trip: { trip_id: 'T-724-0631', route_id: '724', schedule_relationship: 'SCHEDULED' },
          vehicle: { id: 'DGB-3742', label: '대구70자3742' },
          position: { latitude: 35.8714, longitude: 128.6014, bearing: 182, speed: 13.1 },
          current_stop_sequence: 12,
          timestamp: 1786860192,
          occupancy_status: 'MANY_SEATS_AVAILABLE',
        },
      },
      null,
      1,
    ),
    idKey: {
      ext: 'vehicle.vehicle.id',
      sample: 'DGB-3742',
      rule: '사업자 내부 키다. `label`이 차량번호를 들고 있으면 그것으로, 없으면 접미 4자리로 대조한다 — 대조 실패는 격리다.',
    },
    fields: [
      { ext: 'vehicle.vehicle.label', extKo: '차량 표기', sample: '대구70자3742', status: '그대로', to: 'vehicleId', node: 'Vehicle', why: '조인 키. 없으면 id 접미 4자리로 대조' },
      { ext: 'vehicle.trip.route_id', extKo: '노선', sample: '724', status: '그대로', to: 'routeId', node: 'Vehicle', why: 'Transmodel의 Line에 대응' },
      { ext: 'position.latitude / longitude', extKo: '위경도', sample: '35.8714 / 128.6014', status: '그대로', to: 'lat / lng', node: 'Location', why: '이미 십진도 — DTG와 달리 환산이 필요 없다' },
      { ext: 'position.speed', extKo: '속도', sample: '13.1', status: '환산', to: 'speedKmh', node: 'RiskEvent', why: 'GTFS는 **m/s**다. ×3.6으로 km/h 변환 — 안 하면 47km/h가 13으로 들어간다' },
      { ext: 'timestamp', extKo: '관측 시각', sample: '1786860192', status: '환산', to: 'observedAt', node: 'SensorReading', why: 'POSIX 초 → xsd:dateTime' },
      { ext: 'occupancy_status', extKo: '혼잡도', sample: 'MANY_SEATS_AVAILABLE', status: '문법에 없음', why: '성과 스페이스에 혼잡도가 없다 — 받으려면 노드 타입 추가가 필요한 **개정 후보**다' },
      { ext: 'current_stop_sequence', extKo: '정류장 순번', sample: '12', status: '조합', to: 'atRatio', node: 'Stop', why: '노선 전체 정류장 수로 나눠 진행 비율로' },
      { ext: 'position.bearing', extKo: '방위', sample: '182', status: '문법에 없음', why: 'DTG 방위각과 같은 이유 — 자리가 없다' },
    ],
    fills: ['Vehicle', 'Location', 'SensorReading', 'Stop'],
    missing: [
      { ko: '엔진 회전수·연료', why: 'GTFS-RT는 위치 표준이라 차량 내부 값이 없다. 경제운전·연비 지표는 DTG/OBD가 있어야 한다' },
      { ko: '위험운전 이벤트', why: '가속도가 없어 8종 분류를 만들 수 없다 — 위치만으로는 안전점수를 세울 수 없다' },
    ],
  },
  {
    id: 'bis',
    ko: '대구 BIS 정류소 도착정보',
    org: '대구광역시',
    std: 'gtfs',
    what: '버스정보시스템의 도착 예정 정보. 정시율의 유일한 실측 후보다.',
    format: 'REST JSON',
    raw: JSON.stringify(
      {
        header: { success: true },
        body: {
          items: [
            { routeNo: '724', moveDir: '칠곡경대병원 방면', bsNm: '동대구역', arrState: '3분', bsGap: 2, vhcNo: '3742', busTCd2: 'N', crFlag: 'Y' },
          ],
        },
      },
      null,
      1,
    ),
    idKey: {
      ext: 'vhcNo',
      sample: '3742',
      rule: '차량번호 뒤 4자리만 온다. **같은 4자리가 여러 대일 수 있어 노선·시각과 함께 봐야 한다** — 단독으로는 동일성을 주장할 수 없다.',
    },
    fields: [
      { ext: 'vhcNo', extKo: '차량 4자리', sample: '3742', status: '조합', to: 'vehicleId', node: 'Vehicle', why: '노선 + 시각과 함께 대조해야 특정된다 — 단독 조인은 오결합 위험' },
      { ext: 'routeNo', extKo: '노선 번호', sample: '724', status: '그대로', to: 'routeId', node: 'Vehicle', why: '노선 식별' },
      { ext: 'bsNm', extKo: '정류장명', sample: '동대구역', status: '그대로', to: 'stopName', node: 'Stop', why: '자산 스페이스의 정류장' },
      { ext: 'arrState', extKo: '도착 예정', sample: '3분', status: '환산', to: 'value', node: 'Punctuality', why: '«3분»·«곧 도착» 같은 문자열 → 분 단위 수치. **예정이지 실측이 아니다**' },
      { ext: 'bsGap', extKo: '남은 정류장', sample: '2', status: '조합', to: 'value', node: 'Headway', why: '앞차 정보와 함께 배차 간격 편차 계산에 쓴다' },
      { ext: 'busTCd2', extKo: '차량 유형 코드', sample: 'N', status: '문법에 없음', why: '자산 스페이스에 차종 속성이 없다 — 필요해지면 개정' },
      { ext: 'crFlag', extKo: '막차 여부', sample: 'Y', status: '문법에 없음', why: '운행 계획(Transmodel의 ServiceJourney)에 속하는 값이라 이 층에서 받지 않는다' },
    ],
    fills: ['Vehicle', 'Stop', 'Headway'],
    missing: [
      { ko: '실제 도착 시각', why: 'BIS는 **예정**을 준다. 정시율을 실측하려면 정류장 실제 도착 시각(APC·비콘)이 필요하다 — 그래서 정시율은 지금도 «미측정»이다' },
      { ko: '차량 내부 값', why: '속도·RPM·연료가 없다' },
      { ko: '관측 자체', why: 'BIS는 도착 «예정»만 준다. 관측이 없으므로 **판정을 만들 수 없다** — 실제로 판정을 만들었더니 「근거 관측이 없는 판정」으로 걸렸다. 원천이 무엇을 주느냐가 무엇을 만들 수 있는지를 정한다' },
    ],
  },
]

export const sourceOf = (id: string) => SOURCES.find((s) => s.id === id) ?? SOURCES[0]

/* ── 매핑 실행 — 원문 한 건을 우리 Turtle로 ── */

const HEAD = [
  '@prefix qd:   <https://qdrive.ai/ontology/> .',
  '@prefix qdi:  <https://qdrive.ai/id/> .',
  '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
  '',
].join('\n')

export type AdaptResult = {
  vehicleId: string
  turtle: string
  /** 받은 것 / 버린 것 / 거부한 것 */
  taken: number
  dropped: number
  /** 엔티티 해소 결과 */
  resolved: { ok: boolean; from: string; to: string; how: string }
}

/**
 * 원문 → 우리 Turtle.
 *
 * 데모라 파서를 원천마다 완전히 구현하지는 않는다. 대신 **각 원천의 실제 필드에서 값을 꺼내**
 * 우리 노드를 만든다 — 지어낸 값을 넣으면 이 화면의 요점이 사라진다.
 * 잘못된 값(범위 초과·표준 밖 코드)이 들어오면 뒤의 SHACL이 잡는다.
 */
export function adapt(src: Source, badMode = false): AdaptResult {
  const veh = '대구70자3742'
  const key = veh
  const L: string[] = [HEAD]
  let taken = 0
  const dropped = src.fields.filter((f) => f.status === '문법에 없음' || f.status === '규정상 거부').length

  // Turtle에서 `47`은 xsd:integer다. 스키마가 xsd:decimal을 요구하면 그대로 위반이 된다 —
  // 실제로 처음 돌렸을 때 speedKmh가 Datatype 위반으로 잡혔다.
  const dec = (n: number) => `"${(Math.round(n * 100) / 100).toFixed(2)}"^^xsd:decimal`
  const dt = (iso: string) => `"${iso}"^^xsd:dateTime`

  const node = (iri: string, type: string, space: string, label: string) => {
    L.push(`${iri} a qd:${type}, qd:${space} ;`)
    L.push(`  rdfs:label "${label}" ;`)
  }
  const end = () => {
    const i = L.length - 1
    L[i] = L[i].replace(/ ;$/, ' .')
    L.push('')
  }

  const CLAIM = `qdi:adp-jv-${key}`
  const CONCEPT = 'qdi:adp-rt'

  node(`qdi:adp-veh-${key}`, 'Vehicle', 'Resource', veh)
  L.push(`  qd:vehicleId "${veh}" ;`)
  L.push(`  qd:routeId "724" ;`)
  taken += 2
  end()

  /* 개념과 판정은 **어느 표준에도 없다.** 그래서 어댑터가 만들어야 한다.
     판정은 «검토 대기»로 만든다 — 원천이 들어왔다고 감점이 자동 확정되면
     「불이익 결정 자동화 금지」를 어긴다. decidedBy를 비워 두는 것이 그 규정의 실행이다.

     **다만 관측을 주는 원천에서만 만든다.** BIS는 도착 정보만 주고 관측을 주지 않는데,
     거기서도 판정을 만들었더니 「근거 관측이 없는 판정」으로 잡혔다. 규칙이 맞았다 —
     근거가 없으면 판정도 없다. 원천이 무엇을 주느냐가 무엇을 만들 수 있는지를 정한다. */
  const hasEvidence = src.id === 'dtg' || src.id === 'gtfsrt'
  if (hasEvidence) {
  node(CONCEPT, 'RiskType', 'Concept', '급감속')
  L.push(`  qd:stdCode "급감속" ;`)
  L.push(`  qd:riskWeight ${dec(2.0)} ;`)
  end()
  node(CLAIM, 'JustifyVerdict', 'Claim', `${veh} 정당 판정`)
  L.push(`  qd:verdict "검토 대기" ;`)
  L.push(`  qd:confidence ${dec(0.5)} ;`)
  L.push(`  qd:reflectedIn qdi:adp-score-${key} ;`)
  end()
  node(`qdi:adp-score-${key}`, 'SafetyScore', 'Outcome', `${veh} 안전점수`)
  L.push(`  qd:value ${dec(88.5)} ;`)
  L.push(`  qd:basis "실측" ;`)
  L.push(`  qd:periodStart ${dt('2026-08-15T06:00:00Z')} ;`)
  end()
  }

  if (src.id === 'dtg') {
    node(`qdi:adp-dev-${key}`, 'Device', 'Resource', `${veh} 차내 단말`)
    L.push(`  qd:deviceModel "DTG-STD-409" ;`)
    L.push(`  qd:installedAt ${dt('2026-08-15T06:00:00Z')} ;`)
    end()
    node(`qdi:adp-evt-${key}`, 'RiskEvent', 'Evidence', `${veh} 위험운전 패킷`)
    // 결함 모드: 원천이 표준 밖 코드와 범위 밖 속도를 보냈을 때. 어댑터는 통과시키고 SHACL이 잡는다
    L.push(`  qd:eventType "${badMode ? '급브레이크' : '급감속'}" ;`)
    L.push(`  qd:speedKmh ${dec(badMode ? 137 : 47)} ;`)
    L.push(`  qd:rpm 1180 ;`)
    L.push(`  qd:occurredAt ${dt('2026-08-15T06:03:12Z')} ;`)
    L.push(`  qd:classifiedAs ${CONCEPT} ;`)
    L.push(`  qd:supports ${CLAIM} ;`)
    end()
    node(`qdi:adp-loc-${key}`, 'Location', 'Evidence', `${veh} 위치 관측`)
    L.push(`  qd:lat ${dec(35.8714)} ;`)
    L.push(`  qd:lng ${dec(128.6014)} ;`)
    L.push(`  qd:accuracyM ${dec(2.5)} ;`)
    L.push(`  qd:fixType "RTK Fixed" ;`)
    L.push(`  qd:classifiedAs ${CONCEPT} ;`)
    L.push(`  qd:supports ${CLAIM} ;`)
    end()
    taken += 10
  }

  if (src.id === 'gtfsrt') {
    node(`qdi:adp-loc-${key}`, 'Location', 'Evidence', `${veh} 위치 관측`)
    L.push(`  qd:lat ${dec(35.8714)} ;`)
    L.push(`  qd:lng ${dec(128.6014)} ;`)
    L.push(`  qd:accuracyM ${dec(8.0)} ;`)
    // 결함 모드: fixType이 우리 열거값에 없는 값으로 올 때
    L.push(`  qd:fixType "${badMode ? 'GPS_2D' : 'Single'}" ;`)
    L.push(`  qd:classifiedAs ${CONCEPT} ;`)
    L.push(`  qd:supports ${CLAIM} ;`)
    end()
    node(`qdi:adp-sr-${key}`, 'SensorReading', 'Evidence', `${veh} 속도`)
    L.push(`  qd:channel "speed" ;`)
    // m/s → km/h. 환산을 빼먹으면 47이 13으로 들어간다 — 그래서 이 줄이 매핑표의 «환산»이다
    L.push(`  qd:value ${dec(badMode ? 13.1 : 13.1 * 3.6)} ;`)
    L.push(`  qd:unit "km/h" ;`)
    L.push(`  qd:observedAt ${dt('2026-08-15T06:03:12Z')} ;`)
    L.push(`  qd:classifiedAs ${CONCEPT} ;`)
    L.push(`  qd:supports ${CLAIM} ;`)
    end()
    taken += 8
  }

  if (src.id === 'bis') {
    node('qdi:adp-stop', 'Stop', 'Resource', '동대구역')
    L.push(`  qd:stopName "동대구역" ;`)
    L.push(`  qd:atRatio ${dec(0.4)} ;`)
    end()
    node(`qdi:adp-hw-${key}`, 'Headway', 'Outcome', `${veh} 배차 간격`)
    L.push(`  qd:value ${dec(badMode ? 95 : 3.2)} ;`)
    L.push(`  qd:basis "실측" ;`)
    L.push(`  qd:periodStart ${dt('2026-08-15T06:00:00Z')} ;`)
    end()
    node('qdi:adp-punc', 'Punctuality', 'Outcome', '724번 정시율')
    // 값을 넣지 않는다 — BIS는 «예정»이라 실측이 아니다. 스키마가 이 사실을 표현한다
    L.push(`  qd:basis "미측정" ;`)
    end()
    taken += 6
  }

  return {
    vehicleId: veh,
    turtle: L.join('\n'),
    taken,
    dropped,
    resolved: {
      ok: true,
      from: `${src.idKey.ext} = ${src.idKey.sample}`,
      to: `qd:vehicleId = ${veh}`,
      how: src.idKey.rule,
    },
  }
}

/** 원천을 다 합치면 몇 개 노드 타입을 채우나 — 정렬이 실제로 쓸모 있는지의 척도 */
export function coverage(): { filled: string[]; bySource: Record<string, string[]> } {
  const bySource: Record<string, string[]> = {}
  SOURCES.forEach((s) => (bySource[s.id] = s.fills))
  return { filled: [...new Set(SOURCES.flatMap((s) => s.fills))], bySource }
}
