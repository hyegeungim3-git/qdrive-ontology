import { ROUTES } from '../sim/routes'
import { RISK_EVENT_TYPES } from '../sim/types'
import type { SimSnapshot } from '../sim/types'
import { REL_META } from './standards'
import { FUEL_PER_KM_MAX, FUEL_PER_KM_MIN, perKm } from './shacl'

/**
 * 시뮬레이터 스냅샷 → RDF 데이터 그래프(Turtle).
 *
 * SHACL은 셰이프만으로는 아무것도 증명하지 못한다. 검사받을 인스턴스가 있어야 한다.
 * 여기서 지금 이 순간의 엔진 상태를 온톨로지 문법 그대로 트리플로 옮긴다.
 *
 * 두 가지 규칙을 지킨다.
 *  - 인스턴스는 **노드 타입 클래스와 스페이스 클래스 양쪽**으로 타입을 붙인다.
 *    속성 셰이프는 노드 타입(qd:RiskEvent)을, 관계·닫힘 셰이프는 스페이스(qd:Evidence)를 target하기 때문.
 *  - 관계 술어는 문법(REL_META)에서 꺼내 쓴다. 영문 이름을 손으로 적으면 문법을 고칠 때 조용히 어긋난다.
 */

/** 관계 술어 — 한국어 관계명으로 문법에서 끌어온다. 없는 이름을 쓰면 즉시 터진다. */
const P = (ko: string): string => {
  const m = REL_META[ko]
  if (!m) throw new Error(`문법에 없는 관계: ${ko}`)
  return `qd:${m.en}`
}

/** 결함 주입 — 일부러 규칙을 깨서 SHACL이 정말로 잡는지 보이는 장치 */
export type FaultId = 'badEventType' | 'speedOver' | 'noClassify' | 'illegalRelation' | 'claimNoEvidence' | 'autoAdverse' | 'realName' | 'cumulativeFuel'

export const FAULTS: { id: FaultId; ko: string; desc: string; expect: string; family: string }[] = [
  { id: 'badEventType', ko: '표준 밖 이벤트 코드', desc: '위험운전 유형에 «급브레이크»를 넣는다 — 공단 표준 8종에 없는 말', expect: 'sh:in', family: '속성' },
  { id: 'speedOver', ko: '속도 범위 초과', desc: '시내버스 사양을 넘는 137km/h를 기록한다', expect: 'sh:maxInclusive', family: '속성' },
  { id: 'noClassify', ko: '필수 분류 누락', desc: '관측에서 «분류된다»를 뗀다 — 표준 코드 없이 저장', expect: 'sh:minCount', family: '관계' },
  { id: 'illegalRelation', ko: '문법 밖 관계', desc: '판정을 건너뛰고 관측을 성과에 바로 잇는다', expect: 'sh:closed', family: '문법' },
  { id: 'claimNoEvidence', ko: '근거 없는 판정', desc: '뒷받침하는 관측이 하나도 없는 감점 판정을 만든다', expect: 'sh:minCount · 역경로', family: '도메인' },
  { id: 'autoAdverse', ko: '감점 자동 확정', desc: '감점 판정에서 확정 담당자(decidedBy)를 지운다', expect: 'sh:minCount', family: '도메인' },
  { id: 'realName', ko: '기사 실명 노출', desc: '분석셋 기사 노드에 실명(driverName)을 붙인다', expect: 'sh:maxCount 0', family: '도메인' },
  { id: 'cumulativeFuel', ko: '회차 연료 누적값', desc: '회차마다 리셋해야 할 연료 계량을 리셋하지 않는다 — 누적 합계가 들어온다', expect: 'sh:sparql', family: '도메인' },
]

/** 시뮬레이션 시각(초) → xsd:dateTime. 첫차 시각을 기준점으로 고정한다(재현 가능하게). */
const BASE = Date.UTC(2026, 7, 14, 20, 0, 0) // 2026-08-14 05:00 KST
const iso = (simTime: number) => new Date(BASE + simTime * 1000).toISOString().replace(/\.\d+Z$/, 'Z')

const esc = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
const key = (s: string) => String(s).replace(/[^A-Za-z0-9가-힣]/g, '')
const dec = (n: number) => `"${(Math.round(n * 100) / 100).toFixed(2)}"^^xsd:decimal`
const int = (n: number) => `"${Math.round(n)}"^^xsd:integer`
const dt = (n: number) => `"${iso(n)}"^^xsd:dateTime`
const str = (s: string) => `"${esc(s)}"`

/**
 * 그래프 색인 — 격리된 레코드의 하류 영향을 계산하려면 관계를 걸어야 한다.
 * Turtle 문자열을 다시 파싱하지 않고, 만드는 김에 인접 정보를 같이 낸다.
 */
export type GraphIndex = {
  label: Record<string, string>
  /** 노드 타입 (RiskEvent 등) */
  type: Record<string, string>
  /** 스페이스 (Evidence 등) */
  space: Record<string, string>
  /** 나가는 간선 */
  out: Record<string, { p: string; o: string }[]>
}

export type GraphResult = { turtle: string; triples: number; subjects: number; byClass: { ko: string; n: number }[]; index: GraphIndex }

/**
 * 이 레코드가 보류되면 어디까지 흔들리나 — 관계를 따라 성과까지 걸어간다.
 * 관측 ─뒷받침한다→ 판정 ─반영된다→ 성과 가 기본 경로이고, 자산·주체는 자기가 만든 관측을 거쳐 닿는다.
 */
export function downstream(ix: GraphIndex, iri: string, maxDepth = 4): string[] {
  const seen = new Set<string>([iri])
  const hit = new Set<string>()
  let frontier = [iri]
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next: string[] = []
    frontier.forEach((n) => {
      ;(ix.out[n] ?? []).forEach(({ o }) => {
        if (seen.has(o)) return
        seen.add(o)
        if (ix.space[o] === 'Outcome') hit.add(ix.label[o] ?? o)
        else next.push(o)
      })
    })
    frontier = next
  }
  return [...hit]
}

export function buildDataGraph(snap: SimSnapshot, faults: Set<FaultId> = new Set()): GraphResult {
  const T: [string, string, string][] = []
  const add = (s: string, p: string, o: string) => {
    if (p && o) T.push([s, p, o])
  }
  /** 인스턴스 선언 — 노드 타입 + 스페이스 양쪽으로 타입을 붙인다 */
  const node = (iri: string, type: string, space: string, label: string) => {
    add(iri, 'a', `qd:${type}, qd:${space}`)
    add(iri, 'rdfs:label', str(label))
  }
  const on = (f: FaultId) => faults.has(f)

  /* ── 규정 ── */
  ;[
    ['pol-access-city', 'AccessPolicy', '시 — 노선·통계 범위'],
    ['pol-access-op', 'AccessPolicy', '운수사 — 자사 차량 범위'],
    ['pol-retention-raw', 'RetentionPolicy', '원본 보존 5년'],
    ['pol-pseudo', 'Pseudonymization', '기사 식별정보 분리'],
    ['pol-noauto', 'NoAutoAdverse', '불이익 결정 자동화 금지'],
  ].forEach(([k, t, l]) => node(`qdi:${k}`, t, 'Policy', l))

  /* ── 자산 ── */
  ROUTES.forEach((r) => {
    const iri = `qdi:route-${r.id}`
    node(iri, 'Route', 'Resource', r.name)
    add(iri, 'qd:routeName', str(r.name))
    // 인가노선 폴리라인 — GeoSPARQL WKT
    add(iri, 'qd:authorizedPath', `"LINESTRING(${r.points.slice(0, 6).map((p) => `${p[1]} ${p[0]}`).join(', ')})"^^geo:wktLiteral`)
    r.stops.slice(0, 3).forEach((s, i) => {
      const si = `qdi:stop-${r.id}-${i}`
      node(si, 'Stop', 'Resource', s.name)
      add(si, 'qd:stopName', str(s.name))
      add(si, 'qd:atRatio', dec(s.at))
    })
  })
  add('qdi:pol-retention-raw', P('보호한다'), ROUTES.map((r) => `qdi:route-${r.id}`).join(', '))
  add('qdi:pol-pseudo', P('제한한다'), `qdi:route-${ROUTES[0].id}`)

  const vehicles = snap.vehicles
  vehicles.forEach((v) => {
    const iri = `qdi:veh-${key(v.id)}`
    node(iri, 'Vehicle', 'Resource', v.id)
    add(iri, 'qd:vehicleId', str(v.id))
    add(iri, 'qd:routeId', str(v.routeId))
    add(iri, 'qd:odometerKm', dec(v.distanceKm))
    node(`qdi:dev-${key(v.id)}`, 'Device', 'Resource', `${v.id} 차내 단말`)
  })

  /* ── 주체 ── */
  const drivers = [...new Set(vehicles.map((v) => v.driverName))]
  drivers.forEach((d, i) => {
    const iri = `qdi:drv-${i + 1}`
    const pseudo = `D-${String(i + 1).padStart(3, '0')}`
    node(iri, 'Driver', 'Subject', `기사 ${pseudo}`)
    add(iri, 'qd:driverPseudoId', str(pseudo))
    add(iri, 'qd:operatorId', str('OP-대구1'))
    // 결함 주입: 가명 처리를 거치지 않은 실명이 분석셋에 흘러들어온 상황
    if (on('realName') && i < 2) add(iri, 'qd:driverName', str(d))
    const mine = vehicles.filter((v) => v.driverName === d).map((v) => `qdi:veh-${key(v.id)}`)
    add(iri, P('운전한다'), mine.join(', '))
  })
  node('qdi:ctl-1', 'Controller', 'Subject', '관제 담당 1')
  node('qdi:ofc-1', 'Officer', 'Subject', '담당 공무원')
  add('qdi:ctl-1', P('관리한다'), `qdi:veh-${key(vehicles[0]?.id ?? 'x')}`)
  add('qdi:pol-noauto', P('승인을 요구한다'), 'qdi:ctl-1')
  add('qdi:pol-access-city', P('허용한다'), 'qdi:ofc-1')
  add('qdi:pol-access-op', P('금지한다'), 'qdi:ofc-1')

  /* ── 개념 ── */
  RISK_EVENT_TYPES.forEach((t) => node(`qdi:rt-${key(t)}`, 'RiskType', 'Concept', t))
  ;['A', 'B', 'C'].forEach((g) => node(`qdi:grade-${g}`, 'RouteGrade', 'Concept', `효율 ${g}등급`))
  ;['CNG', 'EV'].forEach((f) => node(`qdi:fuel-${f}`, 'FuelType', 'Concept', f))

  /* ── 성과 ── */
  vehicles.forEach((v) => {
    const s = `qdi:score-${key(v.id)}`
    node(s, 'SafetyScore', 'Outcome', `${v.id} 안전점수`)
    add(s, 'qd:value', dec(v.score))
    add(s, 'qd:basis', str('실측'))
    add(s, 'qd:periodStart', dt(0))
    node(`qdi:eco-${key(v.id)}`, 'EcoScore', 'Outcome', `${v.id} 경제운전 점수`)
  })
  node('qdi:out-fuelsaving', 'FuelSaving', 'Outcome', '연료 절감률')
  node('qdi:out-co2', 'Co2Reduction', 'Outcome', 'CO₂ 감축량')
  ROUTES.forEach((r) => node(`qdi:punc-${r.id}`, 'Punctuality', 'Outcome', `${r.name} 정시율`))

  /* ── 집단 ── */
  ;[
    ['coh-model', '모범 운전군'],
    ['coh-avg', '평균 운전군'],
    ['coh-coach', '코칭 대상군'],
  ].forEach(([k, l]) => {
    node(`qdi:${k}`, 'DriverCohort', 'Community', l)
    add(`qdi:${k}`, P('묶는다'), 'qdi:rt-급가속')
  })
  node('qdi:clu-express', 'RouteCluster', 'Community', '급행군')
  add('qdi:clu-express', P('요약한다'), 'qdi:grade-A')

  /* ── 개념 → 성과 ── */
  add('qdi:rt-급가속', P('악화시킨다'), 'qdi:out-fuelsaving')
  add('qdi:grade-A', P('기여한다'), 'qdi:out-fuelsaving')
  add('qdi:fuel-CNG', P('제약한다'), 'qdi:out-co2')

  /* ── 관측 · 판정 · 조치 ──
     관측은 반드시 «분류된다»(어떤 표준 코드인가)와 «뒷받침한다»(무슨 판정의 근거인가)를 달고 다닌다.
     이 둘이 문법에서 필수로 선언돼 있어, 빠지면 SHACL이 잡는다. */
  // 결함은 한 건만 나지 않는다. 원천이 잘못되면 여러 레코드가 같이 틀린다 —
  // 그래야 「같은 규칙이 반복해서 걸린다」는 규칙 역제안의 전제도 실제로 성립한다.
  const hit = (f: FaultId, i: number, n = 2) => on(f) && i < n

  const events = snap.events.slice(0, 14)
  events.forEach((e, i) => {
    const ev = `qdi:evt-${i + 1}`
    const cl = `qdi:jv-${i + 1}`
    node(ev, 'RiskEvent', 'Evidence', `${e.vehicleId} ${e.eventType}`)
    add(ev, 'qd:eventType', str(hit('badEventType', i, 3) ? '급브레이크' : e.eventType))
    add(ev, 'qd:speedKmh', dec(hit('speedOver', i) ? 137 + i : e.speedKmh))
    add(ev, 'qd:rpm', int(e.rpm))
    add(ev, 'qd:occurredAt', dt(e.simTime))
    if (!hit('noClassify', i)) add(ev, P('분류된다'), `qdi:rt-${key(e.eventType)}`)
    add(ev, P('뒷받침한다'), cl)
    // 결함 주입: 판정을 건너뛰고 관측을 성과에 바로 잇는다 — 문법에 없는 방향
    if (hit('illegalRelation', i)) add(ev, P('반영된다'), `qdi:score-${key(e.vehicleId)}`)
    add(`qdi:veh-${key(e.vehicleId)}`, P('생성한다'), ev)

    node(cl, 'JustifyVerdict', 'Claim', `${e.vehicleId} 정당 판정`)
    add(cl, 'qd:verdict', str(e.justified ? '정당 인정' : '감점'))
    add(cl, 'qd:confidence', dec(e.justified ? 0.86 : 0.74))
    // 결함 주입: 불이익(감점)을 사람 확인 없이 확정
    if (!hit('autoAdverse', i)) add(cl, 'qd:decidedBy', str('관제 담당 1'))
    add(cl, P('반영된다'), `qdi:score-${key(e.vehicleId)}`)

    const co = `qdi:coach-${i + 1}`
    node(co, 'Coaching', 'Lever', `${e.vehicleId} 실시간 코칭`)
    add(co, 'qd:firedAt', dt(e.simTime))
    add(co, P('올린다'), `qdi:score-${key(e.vehicleId)}`)
  })

  // 결함 주입: 근거 관측이 하나도 없는 감점 판정
  if (on('claimNoEvidence')) {
    vehicles.slice(0, 2).forEach((v, k) => {
      const iri = `qdi:jv-orphan-${k + 1}`
      node(iri, 'JustifyVerdict', 'Claim', `${v.id} 근거 없는 감점 판정`)
      add(iri, 'qd:verdict', str('감점'))
      add(iri, 'qd:confidence', dec(0.55))
      add(iri, 'qd:decidedBy', str('관제 담당 1'))
      add(iri, P('반영된다'), `qdi:score-${key(v.id)}`)
    })
  }

  // 회차는 시간이 지나야 쌓인다. 누적값 결함은 회차 2건 이상이라야 드러나므로, 아직 덜 쌓였으면
  // 지금 달리는 차량으로 회차를 채운다 — 결함을 눌렀는데 아무 일도 없으면 규칙이 없는 것처럼 보인다.
  const real = snap.trips.slice(0, 10)
  const trips =
    on('cumulativeFuel') && real.length < 3
      ? [
          ...real,
          ...vehicles.slice(0, 3 - real.length).map((v, k) => {
            const km = Math.max(2, v.distanceKm)
            return {
              vehicleId: v.id,
              routeName: v.routeId,
              startSimTime: Math.max(0, snap.simTime - (k + 1) * 900),
              endSimTime: snap.simTime,
              distanceKm: km,
              fuelM3: km * 0.55, // 실측 회차 연비 중앙값
              co2Kg: km * 0.55 * 1.94,
            }
          }),
        ]
      : real
  // 결함 주입: 회차마다 리셋해야 할 연료 계량을 리셋하지 않은 상황 — 누적 합계가 들어온다
  let cumFuel = 0
  trips.forEach((t, i) => {
    cumFuel += t.fuelM3
    const tr = `qdi:trip-${i + 1}`
    const rc = `qdi:rc-${i + 1}`
    node(tr, 'Trip', 'Evidence', `${t.vehicleId} ${t.routeName} 회차`)
    add(tr, 'qd:startTime', dt(t.startSimTime))
    add(tr, 'qd:endTime', dt(t.endSimTime))
    add(tr, 'qd:distanceKm', dec(t.distanceKm))
    add(tr, 'qd:fuelM3', dec(on('cumulativeFuel') ? cumFuel : t.fuelM3))
    add(tr, 'qd:co2Kg', dec(t.co2Kg))
    add(tr, P('분류된다'), 'qdi:grade-A')
    add(tr, P('뒷받침한다'), rc)
    add(`qdi:veh-${key(t.vehicleId)}`, P('기록된다'), tr)

    node(rc, 'RouteCompliance', 'Claim', `${t.vehicleId} 노선 준수 판정`)
    add(rc, P('반영된다'), 'qdi:out-fuelsaving')
  })

  /* 센서·위치 관측 — 차량마다 한 점씩, 지금 상태 그대로 */
  vehicles.slice(0, 8).forEach((v, i) => {
    const sr = `qdi:sr-${i + 1}`
    const lo = `qdi:loc-${i + 1}`
    const fp = `qdi:fp-${i + 1}`
    node(fp, 'FaultPrediction', 'Claim', `${v.id} 고장 예측`)
    add(fp, P('반영된다'), 'qdi:out-co2')

    node(sr, 'SensorReading', 'Evidence', `${v.id} 엔진 회전수`)
    add(sr, 'qd:channel', str('engine_rpm'))
    add(sr, 'qd:value', dec(v.rpm))
    add(sr, 'qd:unit', str('rpm'))
    add(sr, 'qd:observedAt', dt(snap.simTime))
    add(sr, P('분류된다'), 'qdi:fuel-CNG')
    add(sr, P('뒷받침한다'), fp)

    node(lo, 'Location', 'Evidence', `${v.id} 현재 위치`)
    add(lo, 'qd:lat', dec(v.lat))
    add(lo, 'qd:lng', dec(v.lng))
    add(lo, 'qd:accuracyM', dec(0.03))
    add(lo, 'qd:fixType', str('RTK Fixed'))
    add(lo, P('분류된다'), 'qdi:grade-A')
    add(lo, P('뒷받침한다'), trips.length ? 'qdi:rc-1' : 'qdi:fp-1')
    add(`qdi:dev-${key(v.id)}`, P('생성한다'), lo)
  })

  /* 상황 설명(소명) */
  if (events.length) {
    snap.pleas.slice(0, 4).forEach((p, i) => {
      const pl = `qdi:plea-${i + 1}`
      node(pl, 'Plea', 'Evidence', `${p.vehicleId} 소명 — ${p.method}`)
      add(pl, P('분류된다'), `qdi:rt-${key(p.eventType)}`)
      add(pl, P('뒷받침한다'), 'qdi:jv-1')
    })
  }

  /* ── 조치 ── */
  snap.recommendations.slice(0, 4).forEach((r, i) => {
    const iri = `qdi:disp-${i + 1}`
    node(iri, 'DispatchAdvice', 'Lever', `${r.routeId} 배차 권고`)
    add(iri, P('안정시킨다'), `qdi:punc-${r.routeId}`)
  })
  snap.workOrders.slice(0, 3).forEach((w, i) => {
    const iri = `qdi:pm-${i + 1}`
    node(iri, 'PredictiveMaint', 'Lever', `${w.vehicleId} 작업지시`)
    add(iri, 'qd:kind', str(w.kind))
    add(iri, 'qd:status', str(w.status))
    add(iri, 'qd:estHours', dec(w.estHours))
    add(iri, P('최적화한다'), 'qdi:out-co2')
  })
  node('qdi:lev-incentive', 'Incentive', 'Lever', '안전 인센티브')
  add('qdi:lev-incentive', P('올린다'), `qdi:score-${key(vehicles[0]?.id ?? 'x')}`)
  add('qdi:lev-incentive', P('바꾼다'), 'qdi:rt-급가속')

  /* ── 직렬화 ── */
  const head = [
    '@prefix qd:   <https://qdrive.ai/ontology/> .',
    '@prefix qdi:  <https://qdrive.ai/id/> .',
    '@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .',
    '@prefix geo:  <http://www.opengis.net/ont/geosparql#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '',
    `# Qdrive 데이터 그래프 — 시뮬레이션 시각 ${iso(snap.simTime)} 스냅샷`,
    faults.size
      ? `# ⚠ 결함 주입 ${faults.size}건: ${[...faults].map((f) => FAULTS.find((x) => x.id === f)?.ko).join(' · ')}`
      : '# 결함 주입 없음 — 엔진이 실제로 내보내는 그대로',
    '',
    '',
  ]
  const bySubject = new Map<string, [string, string][]>()
  T.forEach(([s, p, o]) => {
    const arr = bySubject.get(s) ?? []
    arr.push([p, o])
    bySubject.set(s, arr)
  })
  const body: string[] = []
  bySubject.forEach((ts, s) => body.push(`${s} ${ts.map(([p, o]) => `${p} ${o}`).join(' ;\n  ')} .`))

  const classCount = new Map<string, number>()
  const index: GraphIndex = { label: {}, type: {}, space: {}, out: {} }
  T.forEach(([s, p, o]) => {
    if (p === 'a') {
      const [t, sp] = o.split(',').map((x) => x.trim().replace('qd:', ''))
      index.type[s] = t
      index.space[s] = sp
      classCount.set(t, (classCount.get(t) ?? 0) + 1)
    } else if (p === 'rdfs:label') {
      index.label[s] = o.slice(1, -1)
    } else {
      // 관계만 색인한다 — 리터럴은 걸어갈 수 없다
      o.split(',')
        .map((x) => x.trim())
        .filter((x) => x.startsWith('qdi:'))
        .forEach((target) => {
          ;(index.out[s] ??= []).push({ p, o: target })
        })
    }
  })

  return {
    turtle: head.join('\n') + body.join('\n\n') + '\n',
    triples: T.length,
    subjects: bySubject.size,
    byClass: [...classCount.entries()].map(([ko, n]) => ({ ko, n })).sort((a, b) => b.n - a.n),
    index,
  }
}

/**
 * sh:sparql 제약을 JS로 대신 검사한다.
 *
 * 브라우저 엔진(rdf-validate-shacl)이 SPARQL 기반 제약을 지원하지 않는다.
 * "엔진이 못 도니 규칙도 없는 셈 치자"는 하지 않는다 — 같은 규칙을 직접 돌리고,
 * 결과에는 엔진이 낸 것이 아니라는 표시를 달아 구분한다.
 */
export function checkFuelPerKm(turtle: string): { focus: string; label: string; msg: string }[] {
  return turtle
    .split('\n\n')
    .filter((b) => /\bqd:Trip\b/.test(b))
    .map((b) => ({
      iri: b.trim().split(/\s/)[0],
      label: b.match(/rdfs:label "([^"]+)"/)?.[1] ?? '',
      fuel: Number(b.match(/qd:fuelM3 "([\d.]+)"/)?.[1] ?? 0),
      dist: Number(b.match(/qd:distanceKm "([\d.]+)"/)?.[1] ?? 0),
    }))
    .filter((t) => t.dist > 0 && t.fuel / t.dist > FUEL_PER_KM_MAX)
    .map((t) => ({
      focus: t.iri,
      label: t.label,
      msg: `${t.dist}km 주행에 연료 ${t.fuel}m³ = ${(t.fuel / t.dist).toFixed(2)} m³/km — 상식 범위(${perKm(FUEL_PER_KM_MIN)}~${perKm(FUEL_PER_KM_MAX)} m³/km)를 벗어납니다. 구간값이 아니라 누적값이 들어온 것으로 보입니다`,
    }))
}
