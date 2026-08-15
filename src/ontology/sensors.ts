/**
 * 수집 항목 전수 — **시내버스 한 대가 실제로 만들어 내는 데이터.**
 *
 * 지금까지 그래프가 받던 것은 속도·RPM·위치·연료 정도였다. 실제 차량은 그보다 훨씬 많이 낸다.
 * 무엇을 받을 수 있고, 그중 무엇을 **지금 받고 있고**, 무엇을 **아직 안 받는지**를 한 곳에 적는다.
 *
 * 이 표의 값어치는 «많이 적었다»가 아니라 **격차를 숨기지 않는 데** 있다.
 * 「이 표준을 지원합니다」는 대개 못 받는 항목을 안 적어서 성립한다.
 *
 * ## 민감도가 수집 여부를 정한다
 * 다 모을 수 있다고 다 모으는 것이 아니다. 운전자 상태 감시(졸음·시선)와 실내 영상은
 * 기술적으로 가장 쉽고 **법적으로 가장 어렵다.** 규정 스페이스가 그 판단을 들고 있어야 하고,
 * 이 표는 그 판단을 항목마다 적어 둔다.
 *
 * ## 주기가 규모를 정한다
 * 1초 주기 채널 하나가 차량 200대면 하루 1,700만 건이다. 「수집한다」와 「1초마다 수집한다」는
 * 저장·검증 설계가 완전히 다르다. 그래서 주기를 반드시 함께 적는다.
 */

export type Bus =
  | 'DTG'
  | 'OBD/CAN'
  | 'EV 배터리'
  | '위치·자세'
  | '승객'
  | '정류장·운행'
  | '차량 상태'
  | '안전·영상'
  | '환경'
  | '사람·근무'

/** 개인정보 민감도 — 규정 스페이스가 취급을 정한다 */
export type Sens = '일반' | '내부' | '준민감' | '민감'

/** 지금 이 데모의 그래프가 받고 있나 */
export type Intake =
  | '수집·연결'   // 그래프에 노드/속성으로 들어가 있다
  | '수집·미연결' // 엔진에는 있는데 그래프가 아직 안 받는다
  | '실단말 필요' // 시뮬레이터에 없다. 실차 연동 시 들어온다
  | '규정상 보류' // 기술로는 되는데 규정이 막는다

export type Channel = {
  id: string
  ko: string
  bus: Bus
  unit?: string
  range?: string
  /** 수집 주기 */
  hz: string
  sens: Sens
  intake: Intake
  /** 우리 문법의 어느 자리로 들어가나 */
  to?: string
  /** 무엇을 판단하는 데 쓰이나 */
  use: string
}

export const CHANNELS: Channel[] = [
  /* ── DTG — 법정 운행기록. 이미 전 차량에 달려 있다 ── */
  { id: 'dtg.vehicleId', ko: '자동차등록번호', bus: 'DTG', hz: '1초', sens: '내부', intake: '수집·연결', to: '자산 · 차량.vehicleId', use: '모든 원천의 조인 키' },
  { id: 'dtg.vin', ko: '차대번호', bus: 'DTG', hz: '1회', sens: '내부', intake: '규정상 보류', use: '등록번호로 충분 — 최소 수집 원칙에 따라 받지 않는다' },
  { id: 'dtg.operatorId', ko: '운송사업자등록번호', bus: 'DTG', hz: '1회', sens: '일반', intake: '수집·연결', to: '주체 · 관제.operatorId', use: '자사 범위 권한 판정' },
  { id: 'dtg.device', ko: '운행기록장치 모델명', bus: 'DTG', hz: '1회', sens: '일반', intake: '수집·연결', to: '자산 · 차내 단말.deviceModel', use: '단말 세대별 정확도 보정' },
  { id: 'dtg.time', ko: '정보발생일시', bus: 'DTG', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · occurredAt', use: '모든 사건의 시각 기준' },
  { id: 'dtg.speed', ko: '차량속도', bus: 'DTG', unit: 'km/h', range: '0~120', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위험운전.speedKmh', use: '과속·급조작 판정' },
  { id: 'dtg.rpm', ko: '분당엔진회전수', bus: 'DTG', unit: 'rpm', range: '0~3000', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위험운전.rpm', use: '공회전·고회전 습관' },
  { id: 'dtg.brake', ko: '브레이크 신호', bus: 'DTG', unit: '0/1', hz: '1초', sens: '일반', intake: '실단말 필요', use: '급제동과 엔진브레이크 구분 — 지금은 가속도로만 판정' },
  { id: 'dtg.gps', ko: '차량위치 X/Y', bus: 'DTG', unit: '°', range: '위33~39 · 경124~132', hz: '1초', sens: '준민감', intake: '수집·연결', to: '관측 · 위치.lat/lng', use: '노선 준수·이탈 판정' },
  { id: 'dtg.heading', ko: '방위각', bus: 'DTG', unit: '°', range: '0~359', hz: '1초', sens: '일반', intake: '수집·미연결', use: '역주행·회차 판정 — 엔진에는 있는데 그래프가 아직 안 받는다' },
  { id: 'dtg.accX', ko: '가속도 X (전후)', bus: 'DTG', unit: 'm/s²', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위험운전.eventType', use: '급가속·급감속·급정지 8종 분류의 근거' },
  { id: 'dtg.accY', ko: '가속도 Y (좌우)', bus: 'DTG', unit: 'm/s²', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위험운전.eventType', use: '급진로변경·급좌우회전 판정' },
  { id: 'dtg.odo', ko: '누적 주행거리', bus: 'DTG', unit: 'm', hz: '1초', sens: '일반', intake: '수집·연결', to: '자산 · 차량.odometerKm', use: '정비 주기 · 회차 거리 차분' },

  /* ── OBD/CAN — 엔진·구동계. 연비와 정비의 근거가 여기 있다 ── */
  { id: 'obd.load', ko: '엔진 부하율', bus: 'OBD/CAN', unit: '%', range: '0~100', hz: '1초', sens: '일반', intake: '실단말 필요', use: '경사·적재 보정 — 같은 속도라도 부하가 다르면 연비가 다르다' },
  { id: 'obd.coolant', ko: '냉각수 온도', bus: 'OBD/CAN', unit: '℃', range: '-40~130', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 센서 측정', use: '과열 예측 — 예지정비의 주 신호' },
  { id: 'obd.throttle', ko: '스로틀 개도', bus: 'OBD/CAN', unit: '%', hz: '1초', sens: '일반', intake: '실단말 필요', use: '급조작 습관 · 관성주행 판정 정밀화' },
  { id: 'obd.pedal', ko: '액셀 페달 위치', bus: 'OBD/CAN', unit: '%', hz: '1초', sens: '일반', intake: '실단말 필요', use: '경제운전 점수의 직접 근거' },
  { id: 'obd.fuelRate', ko: '순간 연료소비', bus: 'OBD/CAN', unit: 'm³/h', hz: '1초', sens: '일반', intake: '수집·미연결', use: '구간 연비 — 지금은 회차 단위 합계만 받는다' },
  { id: 'obd.fuelLevel', ko: '연료 잔량', bus: 'OBD/CAN', unit: '%', range: '0~100', hz: '10초', sens: '일반', intake: '실단말 필요', use: '충전·주유 계획' },
  { id: 'obd.gear', ko: '변속기 기어단', bus: 'OBD/CAN', hz: '1초', sens: '일반', intake: '실단말 필요', use: '변속 습관 · 엔진브레이크 사용률' },
  { id: 'obd.oilTemp', ko: '엔진 오일 온도', bus: 'OBD/CAN', unit: '℃', hz: '10초', sens: '일반', intake: '실단말 필요', use: '정비 주기 예측' },
  { id: 'obd.battV', ko: '배터리 전압', bus: 'OBD/CAN', unit: 'V', range: '10~15', hz: '10초', sens: '일반', intake: '실단말 필요', use: '시동 불량 예측' },
  { id: 'obd.idle', ko: '공회전 시간', bus: 'OBD/CAN', unit: 's', hz: '누적', sens: '일반', intake: '수집·미연결', use: '연료 낭비 요인 분해 — 엔진에는 있는데 그래프가 아직 안 받는다' },
  { id: 'obd.dpf', ko: 'DPF 차압 · 재생 상태', bus: 'OBD/CAN', unit: 'kPa', hz: '10초', sens: '일반', intake: '실단말 필요', use: '매연저감장치 막힘 예측 (디젤)' },
  { id: 'obd.nox', ko: 'NOx 배출 농도', bus: 'OBD/CAN', unit: 'ppm', hz: '1초', sens: '일반', intake: '실단말 필요', use: '실주행 배출 검증 · 환경 규제 대응' },
  { id: 'obd.dtc', ko: '고장 코드 (DTC)', bus: 'OBD/CAN', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '고장 원인 분류 — P/C/B/U 4계열' },

  /* ── EV 배터리 — 전기버스 전환의 근거 ── */
  { id: 'ev.soc', ko: '배터리 잔량 (SOC)', bus: 'EV 배터리', unit: '%', range: '0~100', hz: '1초', sens: '일반', intake: '실단말 필요', use: '운행 가능 거리 · 충전 계획' },
  { id: 'ev.soh', ko: '배터리 건강도 (SOH)', bus: 'EV 배터리', unit: '%', range: '0~100', hz: '1일', sens: '일반', intake: '실단말 필요', use: '열화 판정 — 교체 시점과 잔존가치' },
  { id: 'ev.cellDelta', ko: '셀 전압 편차', bus: 'EV 배터리', unit: 'mV', hz: '10초', sens: '일반', intake: '실단말 필요', use: '셀 불균형 — 화재 전조' },
  { id: 'ev.packTemp', ko: '팩 최고/최저 온도', bus: 'EV 배터리', unit: '℃', hz: '10초', sens: '일반', intake: '실단말 필요', use: '열관리 · 급속충전 제한 판정' },
  { id: 'ev.regen', ko: '회생제동 회수량', bus: 'EV 배터리', unit: 'kWh', hz: '구간', sens: '일반', intake: '실단말 필요', use: '경제운전 점수의 EV판 근거' },
  { id: 'ev.charge', ko: '충전 세션', bus: 'EV 배터리', unit: 'kWh', hz: '세션', sens: '일반', intake: '실단말 필요', use: '전비 · 충전 인프라 부하 분석' },
  { id: 'ev.insul', ko: '절연저항', bus: 'EV 배터리', unit: 'MΩ', hz: '1분', sens: '일반', intake: '실단말 필요', use: '감전·누전 위험 판정' },

  /* ── 위치·자세 — RTK + IMU ── */
  { id: 'gnss.rtk', ko: 'RTK 측위 품질', bus: '위치·자세', range: 'Fixed/Float/Single', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위치.fixType', use: '위치 신뢰도 — 노선 이탈 판정의 전제' },
  { id: 'gnss.acc', ko: '측위 오차', bus: '위치·자세', unit: 'm', range: '0~50', hz: '1초', sens: '일반', intake: '수집·연결', to: '관측 · 위치.accuracyM', use: '오차가 크면 이탈 판정을 보류한다' },
  { id: 'gnss.sats', ko: '위성 수 · HDOP', bus: '위치·자세', hz: '1초', sens: '일반', intake: '실단말 필요', use: '터널·고층 구간의 측위 품질 설명' },
  { id: 'imu.gyro', ko: '3축 자이로 (롤·피치·요)', bus: '위치·자세', unit: '°/s', hz: '10~50Hz', sens: '일반', intake: '실단말 필요', use: '전복 위험 · 급조작 정밀 판정' },
  { id: 'map.link', ko: '노선 매칭 결과', bus: '위치·자세', hz: '1초', sens: '일반', intake: '수집·연결', to: '자산 · 노선.authorizedPath', use: '인가노선 대비 이탈 거리 — 정산 검증 기준' },

  /* ── 승객 — APC · 교통카드 ── */
  { id: 'apc.board', ko: '정류장별 승차 인원', bus: '승객', unit: '명', hz: '정류장', sens: '일반', intake: '수집·미연결', use: '수요 분석 · 배차 최적화 — 엔진 누적값은 있는데 정류장 단위가 없다' },
  { id: 'apc.alight', ko: '정류장별 하차 인원', bus: '승객', unit: '명', hz: '정류장', sens: '일반', intake: '실단말 필요', use: '구간 수요 · OD 추정' },
  { id: 'apc.onboard', ko: '재차 인원 · 재차율', bus: '승객', unit: '%', range: '0~100', hz: '10초', sens: '일반', intake: '수집·미연결', use: '혼잡도 판정 — 엔진에 있는데 그래프가 아직 안 받는다' },
  { id: 'apc.wheelchair', ko: '휠체어·교통약자 승하차', bus: '승객', hz: '발생 시', sens: '준민감', intake: '실단말 필요', use: '저상버스 배차 · 정차 시간 보정' },
  { id: 'card.tag', ko: '교통카드 태그', bus: '승객', hz: '발생 시', sens: '민감', intake: '규정상 보류', use: '개인 이동 이력이 된다 — 집계값만 받고 원본은 받지 않는다' },
  { id: 'bell', ko: '하차벨', bus: '승객', unit: '0/1', hz: '발생 시', sens: '일반', intake: '수집·미연결', use: '정차 예측 · 급제동 사전 경고' },

  /* ── 정류장·운행 ── */
  { id: 'stop.arrive', ko: '정류장 도착 시각', bus: '정류장·운행', hz: '정류장', sens: '일반', intake: '수집·미연결', use: '**정시율의 전제** — 지금 정시율이 「미측정」인 이유가 이것이다' },
  { id: 'stop.dwell', ko: '정차 시간', bus: '정류장·운행', unit: 's', hz: '정류장', sens: '일반', intake: '수집·미연결', use: '승하차 소요 · 지연 원인 분해' },
  { id: 'plan.schedule', ko: '운행 계획 시각', bus: '정류장·운행', hz: '1일', sens: '일반', intake: '실단말 필요', use: '**계획 대비 편차 = 정시성.** 실측 도착 시각만으로는 못 잰다' },
  { id: 'headway', ko: '앞차·뒤차 간격', bus: '정류장·운행', unit: '분', hz: '10초', sens: '일반', intake: '수집·연결', to: '성과 · 배차 간격.value', use: '몰림·벌어짐 판정' },
  { id: 'route.compliance', ko: '노선 준수 여부', bus: '정류장·운행', hz: '회차', sens: '일반', intake: '수집·연결', to: '판정 · 노선 준수', use: '정산 검증' },

  /* ── 차량 상태·정비 ── */
  { id: 'tpms', ko: '타이어 공기압 · 온도', bus: '차량 상태', unit: 'bar / ℃', hz: '1분', sens: '일반', intake: '실단말 필요', use: '연비 손실 · 파열 위험' },
  { id: 'brake.wear', ko: '브레이크 라이닝 마모', bus: '차량 상태', unit: '%', hz: '1일', sens: '일반', intake: '수집·연결', to: '판정 · 고장 예측', use: '교체 시점 예측' },
  { id: 'door', ko: '도어 개폐 횟수·상태', bus: '차량 상태', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '도어 고장 예측 · 정차 검증' },
  { id: 'hvac', ko: '냉난방 가동 · 실내 온도', bus: '차량 상태', unit: '℃', hz: '1분', sens: '일반', intake: '수집·미연결', use: '연료 낭비 요인 중 냉난방 — 엔진에 분해값이 있다' },
  { id: 'co2.cabin', ko: '실내 CO₂ 농도', bus: '차량 상태', unit: 'ppm', hz: '1분', sens: '일반', intake: '실단말 필요', use: '환기 판정 · 혼잡도 보조 지표' },
  { id: 'maint.history', ko: '정비 이력', bus: '차량 상태', hz: '발생 시', sens: '내부', intake: '수집·연결', to: '조치 · 예지정비', use: '고장 재발 분석 · 부품 수명' },

  /* ── 안전·영상 — 가장 유용하고 가장 민감하다 ── */
  { id: 'adas.fcw', ko: '전방충돌경고 (FCW)', bus: '안전·영상', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '위험 상황 — 급제동이 방어운전인지 가리는 근거' },
  { id: 'adas.ldw', ko: '차선이탈경고 (LDW)', bus: '안전·영상', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '졸음·주의분산 간접 신호' },
  { id: 'impact', ko: '충격 감지 (G-force)', bus: '안전·영상', unit: 'G', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '사고 자동 신고 · 보험 처리' },
  { id: 'dsm.drowsy', ko: '운전자 졸음·주의분산', bus: '안전·영상', hz: '발생 시', sens: '민감', intake: '규정상 보류', use: '**기술로는 되고 법으로는 어렵다.** 개인에 대한 상시 감시라 별도 동의·목적 제한이 필요하다' },
  { id: 'cam.front', ko: '전방 영상', bus: '안전·영상', hz: '상시', sens: '준민감', intake: '규정상 보류', use: '사고 시점만 보존 — 상시 보관은 목적 초과' },
  { id: 'cam.cabin', ko: '실내 영상', bus: '안전·영상', hz: '상시', sens: '민감', intake: '규정상 보류', use: '승객·기사 얼굴이 담긴다. 사건 발생 시 별도 절차로만' },

  /* ── 환경 ── */
  { id: 'env.weather', ko: '날씨 · 기온 · 강수', bus: '환경', unit: '℃ / mm', hz: '10분', sens: '일반', intake: '수집·미연결', use: '**맥락 판정** — 폭우 중 급제동은 방어운전일 수 있다' },
  { id: 'env.road', ko: '노면 상태', bus: '환경', hz: '10분', sens: '일반', intake: '실단말 필요', use: '결빙·습윤 시 급조작 판정 완화' },
  { id: 'env.traffic', ko: '구간 통행속도', bus: '환경', unit: 'km/h', hz: '5분', sens: '일반', intake: '실단말 필요', use: '지연이 기사 탓인지 정체 탓인지 가른다' },
  { id: 'env.slope', ko: '도로 경사도', bus: '환경', unit: '%', hz: '정적', sens: '일반', intake: '실단말 필요', use: '연비 보정 — 오르막 구간을 벌점에서 제외' },
  { id: 'env.pm', ko: '미세먼지 농도', bus: '환경', unit: '㎍/㎥', hz: '1시간', sens: '일반', intake: '실단말 필요', use: '환경 정책 연계 · 전기버스 효과 산정' },

  /* ── 사람·근무 ── */
  { id: 'duty.shift', ko: '교대 시각 · 배정', bus: '사람·근무', hz: '교대', sens: '준민감', intake: '수집·연결', to: '규정 · 유효 구간', use: '「그때 누가 몰았나」 — 배정에 기간이 있다' },
  { id: 'duty.continuous', ko: '연속 운전 시간', bus: '사람·근무', unit: '분', hz: '1분', sens: '준민감', intake: '실단말 필요', use: '**법정 관리 대상.** 4시간 초과 시 휴게 의무' },
  { id: 'duty.rest', ko: '휴게 시간', bus: '사람·근무', unit: '분', hz: '발생 시', sens: '준민감', intake: '실단말 필요', use: '근로기준·안전 규정 준수 확인' },
  { id: 'driver.name', ko: '기사 실명', bus: '사람·근무', hz: '1회', sens: '민감', intake: '규정상 보류', use: '분석셋에는 가명키만 — SHACL이 실명 유입을 막는다' },
  { id: 'driver.pseudo', ko: '기사 가명키', bus: '사람·근무', hz: '1회', sens: '준민감', intake: '수집·연결', to: '주체 · 기사.driverPseudoId', use: '개인 식별 없이 운전군 분석' },
  { id: 'driver.persona', ko: '운전 성향 분류', bus: '사람·근무', hz: '1일', sens: '준민감', intake: '수집·미연결', use: '운전군 묶기 — 엔진에 있는데 그래프가 아직 안 받는다' },
  { id: 'complaint', ko: '민원 접수·처리', bus: '사람·근무', hz: '발생 시', sens: '준민감', intake: '수집·연결', to: '판정 · 민원 사실 판정', use: '민원 사실 여부 자동 대조' },
  { id: 'plea', ko: '기사 소명', bus: '사람·근무', hz: '발생 시', sens: '준민감', intake: '수집·연결', to: '관측 · 상황 설명', use: '감점에 대한 반론 — 사람의 말도 관측이다' },
]

export const BUSES: Bus[] = ['DTG', 'OBD/CAN', 'EV 배터리', '위치·자세', '승객', '정류장·운행', '차량 상태', '안전·영상', '환경', '사람·근무']

export const INTAKE_TONE: Record<Intake, string> = {
  '수집·연결': '#34d399',
  '수집·미연결': '#fbbf24',
  '실단말 필요': '#64748b',
  '규정상 보류': '#f43f5e',
}

export const SENS_TONE: Record<Sens, string> = {
  일반: '#64748b',
  내부: '#38bdf8',
  준민감: '#fbbf24',
  민감: '#f43f5e',
}

export function sensorStats() {
  const by = (i: Intake) => CHANNELS.filter((c) => c.intake === i).length
  return {
    total: CHANNELS.length,
    linked: by('수집·연결'),
    pending: by('수집·미연결'),
    needDevice: by('실단말 필요'),
    blocked: by('규정상 보류'),
    buses: BUSES.length,
    /** 1초 주기 채널 수 — 규모 산정의 핵심 */
    perSecond: CHANNELS.filter((c) => c.hz === '1초').length,
  }
}

/** 차량 200대 · 1일 18시간 운행 기준 하루 몇 건인가 */
export function dailyVolume(vehicles = 200, hours = 18) {
  const perSec = CHANNELS.filter((c) => c.hz === '1초').length
  return {
    vehicles,
    hours,
    perSecondChannels: perSec,
    perDay: perSec * vehicles * hours * 3600,
  }
}
