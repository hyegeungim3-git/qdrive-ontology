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
  | '운행 계획'
  | '차량 이력'
  | '정산·원가'
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
  /* ── 운행 계획 — **여기가 가장 크게 비어 있다.**
     정시율·결행·첫막차·공차 같은 정책 질문은 대부분 「계획」이 없어서 못 답한다.
     센서를 아무리 늘려도 계획 없이는 «계획 대비»를 못 잰다.
     공차 논란이 대표적이다 — 실제로 얼마를 빈 차로 달렸는지는 운행 상태 구분이 있어야 나온다. ── */
  { id: 'op.state', ko: '운행 상태 구분', bus: '운행 계획', range: '영업/회송/공차대기/차고지', hz: '변화 시', sens: '일반', intake: '실단말 필요', use: '**공차 논란의 핵심.** 승객 없이 달린 구간을 가려야 실차율과 재정지원 산정이 맞는다' },
  { id: 'op.deadheadKm', ko: '공차 거리', bus: '운행 계획', unit: 'km', hz: '회차', sens: '일반', intake: '실단말 필요', use: '차고지↔기점 회송 거리. 표준운송원가에 반영되므로 **부풀리면 재정 누수**가 된다' },
  { id: 'op.revenueKm', ko: '실차 거리', bus: '운행 계획', unit: 'km', hz: '회차', sens: '일반', intake: '실단말 필요', use: '승객을 태우고 달린 거리 — 실차율 = 실차/총주행' },
  { id: 'garage.loc', ko: '차고지 위치', bus: '운행 계획', hz: '정적', sens: '일반', intake: '실단말 필요', use: '차고지가 멀면 공차가 늘어난다 — **차고지 입지 정책의 근거**' },
  { id: 'plan.timetable', ko: '운행 시각표', bus: '운행 계획', hz: '1일', sens: '일반', intake: '실단말 필요', use: '**정시율의 나머지 절반.** 실제 도착 시각만으로는 정시성을 못 잰다' },
  { id: 'plan.trips', ko: '계획 운행횟수', bus: '운행 계획', unit: '회', hz: '1일', sens: '일반', intake: '실단말 필요', use: '계획 대비 실제 = 결행률. 준공영제 부정수급 검증의 기본' },
  { id: 'op.cancel', ko: '결행 사유 코드', bus: '운행 계획', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '차량 고장인지 기사 결원인지 — 사유가 있어야 책임이 갈린다' },
  { id: 'op.firstLast', ko: '첫차·막차 시각', bus: '운행 계획', hz: '1일', sens: '일반', intake: '실단말 필요', use: '첫막차 준수는 민원 상위 항목이다' },
  { id: 'stop.skip', ko: '무정차 통과', bus: '운행 계획', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '**민원 1위.** 하차벨·문 개폐·정류장 접근을 함께 봐야 «지나쳤다»가 성립한다' },
  { id: 'stop.door', ko: '승하차 문 개폐', bus: '운행 계획', hz: '발생 시', sens: '일반', intake: '실단말 필요', use: '정차했는지 서다 갔는지를 가른다' },
  { id: 'stop.waiting', ko: '정류장 대기 인원', bus: '운행 계획', unit: '명', hz: '1분', sens: '준민감', intake: '실단말 필요', use: '만차 통과·증차 근거. 정류장 센서나 영상 집계가 필요하다' },
  { id: 'lane.busOnly', ko: '전용차로 구간 준수', bus: '운행 계획', hz: '1초', sens: '일반', intake: '실단말 필요', use: 'RTK급 위치 + 전용차로 GIS가 있어야 차로 단위로 판정된다' },

  /* ── 차량 이력 — 사고·안전 뉴스는 대개 «몇 년 된 차인가»로 시작한다 ── */
  { id: 'veh.regDate', ko: '차량 등록일 (차령)', bus: '차량 이력', unit: '년', hz: '정적', sens: '일반', intake: '실단말 필요', use: '대·폐차 계획과 안전 사고 상관 분석' },
  { id: 'veh.lowFloor', ko: '저상버스 여부', bus: '차량 이력', hz: '정적', sens: '일반', intake: '실단말 필요', use: '교통약자 접근성 — 저상 배차 비율이 정책 목표다' },
  { id: 'veh.capacity', ko: '정원 (좌석·입석)', bus: '차량 이력', unit: '명', hz: '정적', sens: '일반', intake: '실단말 필요', use: '재차 인원을 **혼잡도(%)로 환산**하려면 정원이 있어야 한다' },
  { id: 'veh.fuelKind', ko: '연료 종류 (CNG/전기/수소)', bus: '차량 이력', hz: '정적', sens: '일반', intake: '수집·미연결', use: '배출계수를 고르는 기준. 차량마다 계수가 다르다' },

  /* ── 정산·원가 — 요금 인상과 재정지원의 근거는 결국 원가다 ── */
  { id: 'cost.fuel', ko: '연료 구매 실적', bus: '정산·원가', unit: '원 / m³', hz: '1월', sens: '내부', intake: '실단말 필요', use: '**온실가스 인벤토리의 1차 자료.** 차량 계측과 대조해 누락·과다를 잡는다' },
  { id: 'power.meter', ko: '충전 전력량 계량', bus: '정산·원가', unit: 'kWh', hz: '세션', sens: '내부', intake: '실단말 필요', use: '전기버스 스코프 2 배출 산정 — 차량 SOC가 아니라 **계량기 값**이 인정된다' },
  { id: 'cost.labor', ko: '인건비 · 운전시간', bus: '정산·원가', unit: '원 / h', hz: '1월', sens: '내부', intake: '실단말 필요', use: '표준운송원가 구성. 대당 운송원가 산정' },
  { id: 'cost.maint', ko: '정비비 실적', bus: '정산·원가', unit: '원', hz: '발생 시', sens: '내부', intake: '실단말 필요', use: '예지정비의 효과를 «비용 절감»으로 환산한다' },
  { id: 'fare.revenue', ko: '운송수입', bus: '정산·원가', unit: '원', hz: '1일', sens: '내부', intake: '실단말 필요', use: '재정지원금 = 표준운송원가 − 운송수입. 지원금 산정의 한 축' },
  { id: 'fare.transfer', ko: '환승 집계', bus: '정산·원가', unit: '건', hz: '1일', sens: '준민감', intake: '실단말 필요', use: '환승 할인 재정 부담. **개인 이력이 아니라 집계로만** 받는다' },
  { id: 'od.matrix', ko: '승하차 정류장 집계 (OD)', bus: '정산·원가', hz: '1일', sens: '준민감', intake: '실단말 필요', use: '노선 신설·폐지의 근거. 교통카드를 **가명·집계 처리**해서만 쓴다' },

  /* ── EV·환경 보강 ── */
  { id: 'charge.station', ko: '충전소 위치 · 가동률', bus: 'EV 배터리', unit: '%', hz: '10분', sens: '일반', intake: '실단말 필요', use: '전기버스 증차가 가능한지는 차량이 아니라 **충전 인프라**가 정한다' },
  { id: 'ev.efficiency', ko: '전비 (km/kWh)', bus: 'EV 배터리', unit: 'km/kWh', hz: '회차', sens: '일반', intake: '실단말 필요', use: '전기버스 감축량 산정의 활동자료' },
  { id: 'env.airq', ko: '노선 주변 대기질', bus: '환경', unit: '㎍/㎥', hz: '1시간', sens: '일반', intake: '실단말 필요', use: '전기 전환의 대기질 개선 효과를 지역 단위로 본다' },

  /* ── 위치 보강 ── */
  { id: 'gnss.dr', ko: '추측항법 (DR) 보정', bus: '위치·자세', hz: '1초', sens: '일반', intake: '실단말 필요', use: '터널·지하 구간의 GPS 음영 — 없으면 그 구간 판정을 통째로 보류해야 한다' },
]

export const BUSES: Bus[] = ['DTG', 'OBD/CAN', 'EV 배터리', '위치·자세', '승객', '정류장·운행', '운행 계획', '차량 이력', '정산·원가', '차량 상태', '안전·영상', '환경', '사람·근무']

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
