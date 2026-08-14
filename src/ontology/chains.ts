import { ROUTES } from '../sim/routes'
import type { SimSnapshot } from '../sim/types'

/**
 * 근거 사슬 정의 — 성과 지표마다 "이 숫자가 어디서 왔나"를 다르게 되짚는다.
 *
 * 지표마다 근거의 성격이 다르다:
 *  · 안전점수는 이벤트 판정이 쌓인 것
 *  · 연료 절감은 반사실(코칭 미적용 가정)과의 차이
 *  · CO₂는 연료 실측의 환산
 *  · 정시율은 아직 실측 원천이 없다 — 그 사실도 사슬에 적는다
 */

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  const s = Math.floor(sec) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export const shortId = (id: string) => id.slice(-4) + '호'

export type Line = { k: string; v: string }
export type Basis = '실측' | '환산' | '추정' | '정성' | '미측정'

export type ChainView = {
  /** 성과 칸 */
  value: string
  unit: string
  subject: string
  outcomeLines: Line[]
  basis: Basis
  /** 판정 칸 */
  claimTitle: string
  claimBig?: { n: number; label: string; color: string }[]
  claimLines: Line[]
  claimNote?: string
  claimEmpty?: string
  /** 관측 칸 */
  evidenceTitle: string
  evidenceRows: { a: string; b: string; c: string; ok?: boolean }[]
  evidenceMore?: number
  evidenceEmpty?: string
  /** 조치·맥락·규정 */
  leverLines: Line[]
  leverNote: string
  contextLines: Line[]
  policyWarn: string
  policyLines: Line[]
  /** 조립 문장 */
  sentence: string
}

export type Metric = {
  key: string
  ko: string
  space: '성과'
  /** 대상 선택이 필요한 지표인가 (차량별) */
  perVehicle: boolean
  short: (s: SimSnapshot, vid?: string) => string
  build: (s: SimSnapshot, vid?: string) => ChainView
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/* ─────────── 안전점수 (차량별) ─────────── */
const safety: Metric = {
  key: 'safety', ko: '안전점수', space: '성과', perVehicle: true,
  short: (s, vid) => {
    const v = s.vehicles.find((x) => x.id === vid) ?? s.vehicles[0]
    return v ? `${Math.round(v.score)}점` : '—'
  },
  build: (s, vid) => {
    const v = s.vehicles.find((x) => x.id === vid) ?? s.vehicles[0]
    const events = s.events.filter((e) => e.vehicleId === v.id)
    const justified = events.filter((e) => e.justified)
    const deducted = events.filter((e) => !e.justified)
    const pleas = s.pleas.filter((p) => p.vehicleId === v.id)
    const trips = s.trips.filter((t) => t.vehicleId === v.id)
    const byType = [...new Set(deducted.map((e) => e.eventType))].map((t) => ({ t, n: deducted.filter((e) => e.eventType === t).length }))
    const route = ROUTES.find((r) => r.id === v.routeId)
    return {
      value: String(Math.round(v.score)), unit: '점', subject: `안전점수 · ${v.driverName}`, basis: '실측',
      outcomeLines: [
        { k: '경제운전', v: `${Math.round(v.ecoScore)}점` },
        { k: '주행', v: `${v.distanceKm.toFixed(1)}km` },
        { k: '회차', v: `${trips.length}회` },
      ],
      claimTitle: '정당 판정',
      claimBig: [
        { n: deducted.length, label: '감점', color: '#fb7185' },
        { n: justified.length, label: '정당 인정', color: '#34d399' },
      ],
      claimLines: byType.slice(0, 4).map((b) => ({ k: b.t, v: `${b.n}건 감점` })),
      claimNote: justified.length > 0 ? `정당 인정 ${justified.length}건 — 감점이 복원됐습니다` : undefined,
      claimEmpty: events.length === 0 ? '오늘 판정이 없습니다' : undefined,
      evidenceTitle: 'DTG 409 위험운전 패킷',
      evidenceRows: events.slice(0, 5).map((e) => ({ a: clock(e.simTime), b: e.eventType, c: `${Math.round(e.speedKmh)}km/h`, ok: e.justified })),
      evidenceMore: Math.max(0, events.length - 5),
      evidenceEmpty: events.length === 0 ? '기록된 패킷이 없습니다' : undefined,
      leverLines: [
        { k: '실시간 코칭', v: `${events.length}회 발화` },
        { k: '상황 설명', v: pleas.length > 0 ? `${pleas.length}건 (${pleas.filter((p) => p.status === '인정').length} 인정)` : '없음' },
      ],
      leverNote: '감지 즉시 코칭이 나가고, 기사가 설명하면 관제가 검토합니다.',
      contextLines: [
        { k: '날씨', v: `${s.weather.condition} ${s.weather.tempC}℃` },
        { k: '노선', v: route?.name ?? '—' },
        { k: '앞차 간격', v: v.headway ? `${v.headway.frontGapMin.toFixed(1)}분 (${v.headway.status})` : '—' },
      ],
      policyWarn: '불이익 결정 자동화 금지 — 이 점수가 평가·징계로 이어지는 확정은 담당자가 합니다.',
      policyLines: [
        { k: '가명 처리', v: '분석셋은 가명키' },
        { k: '보존', v: '원본 5년' },
      ],
      sentence:
        `${shortId(v.id)}(${v.driverName} 기사)의 안전점수 ${Math.round(v.score)}점은 ` +
        (deducted.length > 0 ? `${byType.map((b) => `${b.t} ${b.n}건`).join(' · ')}의 감점 판정이 반영된 값입니다. ` : '오늘 감점 판정이 없습니다. ') +
        (justified.length > 0 ? `그중 ${justified.length}건은 방어운전으로 인정돼 감점이 복원됐습니다. ` : '') +
        (events.length > 0 ? `근거 패킷은 ${events.slice(0, 3).map((e) => clock(e.simTime)).join(' · ')}에 기록돼 있습니다.` : ''),
    }
  },
}

/* ─────────── 경제운전 점수 (차량별) ─────────── */
const eco: Metric = {
  key: 'eco', ko: '경제운전 점수', space: '성과', perVehicle: true,
  short: (s, vid) => {
    const v = s.vehicles.find((x) => x.id === vid) ?? s.vehicles[0]
    return v ? `${Math.round(v.ecoScore)}점` : '—'
  },
  build: (s, vid) => {
    const v = s.vehicles.find((x) => x.id === vid) ?? s.vehicles[0]
    const w = v.fuelWaste
    const total = w.idle + w.harsh + w.habit + w.ac
    const route = ROUTES.find((r) => r.id === v.routeId)
    const harshCnt = s.events.filter((e) => e.vehicleId === v.id).length
    return {
      value: String(Math.round(v.ecoScore)), unit: '점', subject: `경제운전 · ${v.driverName}`, basis: '실측',
      outcomeLines: [
        { k: '누적 연료', v: `${v.fuelM3.toFixed(2)}m³` },
        { k: '연비', v: v.fuelM3 > 0 ? `${(v.distanceKm / v.fuelM3).toFixed(2)}km/m³` : '—' },
        { k: '낭비 합계', v: `${total.toFixed(3)}m³` },
      ],
      claimTitle: '연료 낭비 요인 판정',
      claimLines: [
        { k: '공회전', v: `${w.idle.toFixed(3)}m³` },
        { k: '급조작', v: `${w.harsh.toFixed(3)}m³` },
        { k: '운전 습관', v: `${w.habit.toFixed(3)}m³` },
        { k: '냉난방', v: `${w.ac.toFixed(3)}m³` },
      ],
      claimNote: '요인별로 나눠야 어떤 코칭을 할지 정할 수 있습니다',
      evidenceTitle: 'OBD 연료분사 · DTG 급조작',
      evidenceRows: [
        { a: 'OBD', b: 'fuelRate 적분', c: `${v.fuelM3.toFixed(2)}m³` },
        { a: 'DTG', b: '급조작 건수', c: `${harshCnt}건` },
        { a: 'OBD', b: '공회전 시간', c: `${(w.idle * 4000).toFixed(0)}초 상당` },
        { a: 'OBD', b: 'RPM 현재', c: `${Math.round(v.rpm)}` },
      ],
      leverLines: [
        { k: '예측형 에코코칭', v: '정류장 접근 시 발떼기 안내' },
        { k: '공회전 코칭', v: '5분 이상 대기 시 시동 끄기' },
      ],
      leverNote: '낭비 요인 중 코칭으로 줄일 수 있는 것만 골라 개입합니다.',
      contextLines: [
        { k: '날씨', v: `${s.weather.condition} ${s.weather.tempC}℃` },
        { k: '노선', v: route?.name ?? '—' },
        { k: '냉난방 부하', v: s.weather.condition === '폭염' ? '높음' : '보통' },
      ],
      policyWarn: '연료 낭비는 기사 개인 평가가 아니라 코칭 대상 선정에만 씁니다.',
      policyLines: [{ k: '가명 처리', v: '분석셋은 가명키' }],
      sentence:
        `${shortId(v.id)}의 경제운전 ${Math.round(v.ecoScore)}점은 누적 연료 ${v.fuelM3.toFixed(2)}m³ 중 ` +
        `공회전 ${w.idle.toFixed(3)} · 급조작 ${w.harsh.toFixed(3)} · 습관 ${w.habit.toFixed(3)}m³의 낭비 판정에서 나온 값입니다. ` +
        `근거는 OBD 연료분사 적분과 DTG 급조작 ${harshCnt}건입니다.`,
    }
  },
}

/* ─────────── 연료 절감률 (전체) ─────────── */
const fuel: Metric = {
  key: 'fuel', ko: '연료 절감률', space: '성과', perVehicle: false,
  short: (s) => `${s.kpi.fuelSavedPct.toFixed(2)}%`,
  build: (s) => {
    const base = s.vehicles.reduce((n, v) => n + v.baselineFuelM3, 0)
    const act = s.vehicles.reduce((n, v) => n + v.fuelM3, 0)
    const saved = Math.max(0, base - act)
    const byPersona = (['A', 'B', 'C'] as const).map((p) => {
      const vs = s.vehicles.filter((v) => v.persona === p)
      const b = vs.reduce((n, v) => n + v.baselineFuelM3, 0)
      const a = vs.reduce((n, v) => n + v.fuelM3, 0)
      return { p, label: p === 'A' ? '모범군' : p === 'B' ? '평균군' : '코칭 대상군', pct: b > 0 ? ((b - a) / b) * 100 : 0, n: vs.length }
    })
    return {
      value: s.kpi.fuelSavedPct.toFixed(2), unit: '%', subject: '연료 절감률 · 실증 9대 전체', basis: '실측',
      outcomeLines: [
        { k: '코칭 없을 때 예상', v: `${base.toFixed(2)}m³` },
        { k: '실측', v: `${act.toFixed(2)}m³` },
        { k: '절감량', v: `${saved.toFixed(2)}m³` },
      ],
      claimTitle: '귀속 판정 — 정말 우리 덕분인가',
      claimLines: byPersona.map((g) => ({ k: `${g.label} (${g.n}대)`, v: `${g.pct.toFixed(2)}% 개선` })),
      claimNote: '개선여지가 큰 군에서 효과가 크다 — 코칭이 원인이라는 A/B 지문',
      evidenceTitle: '반사실 비교 — 같은 주행, 코칭만 뺀 가정',
      evidenceRows: [
        { a: '기준선', b: 'baselineFuelM3', c: `${base.toFixed(2)}m³` },
        { a: '실측', b: 'OBD fuelRate 적분', c: `${act.toFixed(2)}m³` },
        { a: '차이', b: '유가·날씨 제거된 순효과', c: `${saved.toFixed(2)}m³` },
        { a: '표본', b: '실증 차량', c: `${s.vehicles.length}대` },
      ],
      leverLines: [
        { k: '실시간 코칭', v: `${s.kpi.totalEvents}회 발화` },
        { k: '예측형 에코코칭', v: '상시 동작' },
      ],
      leverNote: '조치를 껐을 때의 값이 곧 기준선입니다 — 그래서 귀속을 주장할 수 있습니다.',
      contextLines: [
        { k: '날씨', v: `${s.weather.condition} ${s.weather.tempC}℃` },
        { k: '배출계수', v: '2.68 kgCO₂/L (상수)' },
        { k: '누적 주행', v: `${s.kpi.totalDistanceKm.toFixed(1)}km` },
      ],
      policyWarn: '성과가 검증 게이트를 통과하지 못하면 과금하지 않습니다.',
      policyLines: [
        { k: '검증', v: '기준선·효과확인·교차검증·불확실성' },
        { k: '공개', v: '시민 리포트에 노출' },
      ],
      sentence:
        `연료 절감률 ${s.kpi.fuelSavedPct.toFixed(2)}%는 코칭을 하지 않았다면 썼을 연료 ${base.toFixed(2)}m³와 실측 ${act.toFixed(2)}m³의 차이입니다. ` +
        `같은 주행에서 코칭만 뺀 비교라 유가·날씨 같은 외부요인이 제거됩니다. ` +
        `개선율이 ${byPersona.map((g) => `${g.label} ${g.pct.toFixed(1)}%`).join(' · ')}로 나타나 — 개선여지가 큰 군에서 효과가 크다는 것이 코칭이 원인이라는 증거입니다.`,
    }
  },
}

/* ─────────── CO₂ 감축 (전체) ─────────── */
const co2: Metric = {
  key: 'co2', ko: 'CO₂ 감축', space: '성과', perVehicle: false,
  short: (s) => `${s.kpi.totalCo2SavedKg.toFixed(1)}kg`,
  build: (s) => {
    const base = s.vehicles.reduce((n, v) => n + v.baselineFuelM3, 0)
    const act = s.vehicles.reduce((n, v) => n + v.fuelM3, 0)
    const saved = Math.max(0, base - act)
    const kg = s.kpi.totalCo2SavedKg
    return {
      value: kg.toFixed(1), unit: 'kg', subject: 'CO₂ 감축 · 실증 9대 전체', basis: '환산',
      outcomeLines: [
        { k: '절감 연료', v: `${saved.toFixed(2)}m³` },
        { k: '소나무 환산', v: `${(kg / 6.6 * 365 / 365).toFixed(1)}그루·년 상당` },
        { k: '크레딧 환산', v: `${((kg / 1000) * 8900).toFixed(0)}원 상당` },
      ],
      claimTitle: '환산 판정 — 계수를 곱한 값',
      claimLines: [
        { k: '산식', v: '절감 연료 × 배출계수' },
        { k: '배출계수', v: '2.68 kgCO₂/L (상수 카탈로그)' },
        { k: '방법론', v: 'KOC 외부사업 기준' },
      ],
      claimNote: '실측이 아니라 환산 — 근거 유형을 반드시 표기합니다',
      evidenceTitle: '연료 실측 (환산의 입력)',
      evidenceRows: [
        { a: 'OBD', b: '실측 연료', c: `${act.toFixed(2)}m³` },
        { a: '기준선', b: '코칭 미적용 가정', c: `${base.toFixed(2)}m³` },
        { a: '차이', b: '절감 연료', c: `${saved.toFixed(2)}m³` },
        { a: '상수', b: '배출계수', c: '2.68' },
      ],
      leverLines: [
        { k: '실시간 코칭', v: '연료 절감을 통해 간접 기여' },
        { k: '전기 전환', v: '3차 — 가장 큰 손잡이' },
      ],
      leverNote: 'CO₂는 직접 줄이는 것이 아니라 연료를 줄여서 줄어듭니다.',
      contextLines: [
        { k: '연료 종류', v: 'CNG (전환 시 전력 계수 별도)' },
        { k: '집계 기간', v: '오늘 누적' },
        { k: '검증 제출', v: '검증기관 · 월 단위' },
      ],
      policyWarn: '탄소 실적은 검증기관 제출 전까지 «환산»으로만 표기합니다.',
      policyLines: [
        { k: '공개', v: '시민 리포트에 노출' },
        { k: '보존', v: '산식·계수 이력 포함' },
      ],
      sentence:
        `CO₂ 감축 ${kg.toFixed(1)}kg은 절감 연료 ${saved.toFixed(2)}m³에 배출계수 2.68을 곱한 환산값입니다. ` +
        `연료는 OBD 실측이지만 CO₂는 계수를 곱한 값이라 근거 유형이 «환산»이고, 검증기관 제출 전까지 그렇게 표기합니다.`,
    }
  },
}

/* ─────────── 정시율 (아직 실측 원천이 없다) ─────────── */
const punctual: Metric = {
  key: 'punctual', ko: '정시율', space: '성과', perVehicle: false,
  short: () => '미측정',
  build: (s) => {
    const withHeadway = s.vehicles.filter((v) => v.headway?.frontId)
    const bunching = withHeadway.filter((v) => v.headway!.status === 'bunching').length
    const gap = withHeadway.filter((v) => v.headway!.status === 'gap').length
    return {
      value: '—', unit: '', subject: '정시율 · 실측 원천 없음', basis: '미측정',
      outcomeLines: [
        { k: '현재 상태', v: '실측 불가' },
        { k: '필요 원천', v: 'BMS 배차원장 (3차)' },
        { k: '대체 지표', v: '배차 간격 편차 (아래)' },
      ],
      claimTitle: '판정 없음 — 근거가 없으면 판정도 없다',
      claimLines: [
        { k: '계획 대비 실적', v: '배차원장 미연동' },
        { k: '지금 할 수 있는 것', v: '앞차 간격 몰림 판정' },
        { k: '몰림', v: `${bunching}대` },
        { k: '벌어짐', v: `${gap}대` },
      ],
      claimNote: '정시율을 추정으로 만들어내지 않습니다 — 없으면 없다고 적습니다',
      evidenceTitle: '지금 있는 관측 (정시율의 대체)',
      evidenceRows: withHeadway.slice(0, 5).map((v) => ({
        a: shortId(v.id),
        b: `앞차 ${v.headway!.frontGapMin.toFixed(1)}분`,
        c: v.headway!.status === 'normal' ? '정상' : v.headway!.status === 'bunching' ? '몰림' : '벌어짐',
        ok: v.headway!.status === 'normal',
      })),
      evidenceEmpty: withHeadway.length === 0 ? '아직 배차 간격 관측이 없습니다' : undefined,
      leverLines: [
        { k: '배차 권고', v: `${s.recommendations.length}건 생성` },
        { k: '실행', v: '담당자 승인 후' },
      ],
      leverNote: '몰림을 풀면 간격 편차가 줄고, 그것이 정시율로 이어집니다.',
      contextLines: [
        { k: '날씨', v: `${s.weather.condition} · 지연예보 +${s.weather.delayForecastMin}분` },
        { k: '돌발', v: `${s.incidents.length}건` },
        { k: '연동 예정', v: '3차 — BMS 배차원장' },
      ],
      policyWarn: '측정 원천이 없는 지표는 숫자를 만들지 않습니다 — 「미측정」으로 둡니다.',
      policyLines: [{ k: '개선 조건', v: 'BMS 조회 권한 확보' }],
      sentence:
        `정시율은 지금 실측할 수 없습니다. 계획 대비 실적을 보려면 BMS 배차원장이 필요한데 3차 연동 대상이기 때문입니다. ` +
        `대신 지금 있는 관측으로 배차 간격 편차를 봅니다 — 몰림 ${bunching}대 · 벌어짐 ${gap}대. ` +
        `없는 숫자를 추정으로 만들어내지 않는 것이 이 사슬의 원칙입니다.`,
    }
  },
}

/* ─────────── 배차 간격 편차 (전체) ─────────── */
const headway: Metric = {
  key: 'headway', ko: '배차 간격 편차', space: '성과', perVehicle: false,
  short: (s) => {
    const w = s.vehicles.filter((v) => v.headway?.frontId)
    return w.length ? `${avg(w.map((v) => Math.abs(v.headway!.frontGapMin - v.headway!.idealMin))).toFixed(2)}분` : '—'
  },
  build: (s) => {
    const w = s.vehicles.filter((v) => v.headway?.frontId)
    const dev = avg(w.map((v) => Math.abs(v.headway!.frontGapMin - v.headway!.idealMin)))
    const bunching = w.filter((v) => v.headway!.status === 'bunching')
    return {
      value: dev.toFixed(2), unit: '분', subject: '이상 간격 대비 평균 편차', basis: '실측',
      outcomeLines: [
        { k: '앞차 있는 차량', v: `${w.length}대` },
        { k: '몰림', v: `${bunching.length}대` },
        { k: '이상 간격', v: w[0]?.headway ? `${w[0].headway.idealMin}분` : '—' },
      ],
      claimTitle: '몰림 판정',
      claimBig: [
        { n: bunching.length, label: '몰림', color: '#fb7185' },
        { n: w.length - bunching.length, label: '정상', color: '#34d399' },
      ],
      claimLines: bunching.slice(0, 3).map((v) => ({ k: shortId(v.id), v: `앞차 ${v.headway!.frontGapMin.toFixed(1)}분` })),
      claimNote: '몰림이면 뒤차가 벌어진다 — 노선 전체가 함께 흔들립니다',
      evidenceTitle: 'RTK · BIS 위치 교차',
      evidenceRows: w.slice(0, 5).map((v) => ({
        a: shortId(v.id),
        b: `앞차 ${v.headway!.frontGapMin.toFixed(1)}분`,
        c: `이상 ${v.headway!.idealMin}분`,
        ok: v.headway!.status === 'normal',
      })),
      evidenceEmpty: w.length === 0 ? '아직 간격 관측이 없습니다' : undefined,
      leverLines: [
        { k: '배차 권고', v: `${s.recommendations.length}건` },
        { k: '승인 대기', v: `${s.recommendations.filter((r) => r.status === '대기').length}건` },
      ],
      leverNote: '정류장 추가 대기를 권고하고, 담당자가 승인하면 실행됩니다.',
      contextLines: [
        { k: '날씨', v: `${s.weather.condition}` },
        { k: '지연예보', v: `+${s.weather.delayForecastMin}분` },
        { k: '돌발', v: `${s.incidents.length}건` },
      ],
      policyWarn: '배차 조정은 기사 평가가 아니라 운행 품질 관리입니다.',
      policyLines: [{ k: '실행', v: '승인 후에만' }],
      sentence:
        `배차 간격 편차 ${dev.toFixed(2)}분은 앞차 간격과 이상 간격의 차이를 ${w.length}대 평균한 값입니다. ` +
        `현재 몰림 ${bunching.length}대가 판정됐고, 근거는 RTK cm급 위치와 BIS 3초 스트림의 교차 관측입니다. ` +
        `조치는 배차 권고 ${s.recommendations.length}건 — 실행은 담당자 승인 후입니다.`,
    }
  },
}

export const METRICS: Metric[] = [safety, eco, fuel, co2, headway, punctual]

export const BASIS_TONE: Record<Basis, string> = {
  실측: 'bg-emerald-500/15 text-emerald-400',
  환산: 'bg-sky-500/15 text-sky-400',
  추정: 'bg-amber-500/15 text-amber-400',
  정성: 'bg-gray-700/40 text-gray-400',
  미측정: 'bg-red-500/15 text-red-400',
}
