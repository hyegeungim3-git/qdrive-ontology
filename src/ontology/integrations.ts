/**
 * 연계 시스템 — **데이터는 차량에서만 오지 않는다.**
 *
 * 지금 흐름도는 원천이 DTG·GTFS·BIS 셋뿐인데, 실제 운영에서는 훨씬 넓은 생태계와 붙는다.
 * 노선망은 국가표준노드링크가, 날씨는 기상청이, 충전 이력은 충전사업자가, 차령은 자동차등록정보가 준다.
 *
 * ## 밖에서 받는 것이 «원천»인지 «남이 만든 판정»인지 구분해야 한다
 * 이게 이 표의 핵심이다. 교통카드 정산 시스템이 주는 승하차 수치는 **우리가 관측한 것이 아니라
 * 이미 남이 집계한 값**이다. 그런 값을 우리 관측처럼 다루면 «누가 만든 숫자인지»를 잃는다.
 * PROV-O의 `prov:wasAttributedTo`가 그 자리다 — 받은 값에는 **만든 주체**가 함께 따라와야 한다.
 *
 * 그래서 항목마다 `gives`를 «원천 관측 / 집계·판정 / 기준 정보»로 나눈다.
 *  - **원천 관측**: 우리가 검증하고 우리 판정을 만든다
 *  - **집계·판정**: 남의 결론이다. 근거를 되짚을 수 없으면 신뢰도를 낮춰 받는다
 *  - **기준 정보**: 노선망·차적처럼 «사실로 받아들이는» 참조 데이터
 *
 * ## 방향도 적는다
 * 연계는 받기만 하는 게 아니다. BIS에는 위치를 **주고**, 국토부에는 운행기록을 **제출**한다.
 * 주는 쪽이 있으면 «우리 데이터가 밖에 나간다»는 뜻이고, 그때 규정이 다시 걸린다.
 */

export type OrgKind = '국가·표준' | '시·지자체' | '교통카드·정산' | '차량·충전' | '환경·에너지' | '안전·보험' | '사내 시스템' | '국제 표준'
export type Gives = '원천 관측' | '집계·판정' | '기준 정보'
export type Dir = '받는다' | '준다' | '주고받는다'
export type Status = '연동됨' | '연동 예정' | '협의 필요'

export type Integration = {
  id: string
  ko: string
  org: string
  kind: OrgKind
  gives: Gives
  dir: Dir
  /** 무엇을 주고받나 */
  what: string
  /** 어떤 형식·프로토콜로 */
  how: string
  status: Status
  /** 주의할 점 — 이게 없으면 목록이 그냥 이름 나열이 된다 */
  note: string
}

export const INTEGRATIONS: Integration[] = [
  /* ── 국가·표준 ── */
  { id: 'ts.dtg', ko: '디지털운행기록 (DTG)', org: '한국교통안전공단', kind: '국가·표준', gives: '원천 관측', dir: '주고받는다', what: '1초 주기 운행기록 · 위험운전 8종', how: '고정 항목 CSV · 공단 제출 규격', status: '연동됨', note: '**법정 표준이라 이미 전 차량에 달려 있다.** 제출 의무도 있어 양방향이다' },
  { id: 'ts.veh', ko: '자동차등록정보 (차적)', org: '국토교통부 · 공단', kind: '국가·표준', gives: '기준 정보', dir: '받는다', what: '차령 · 차종 · 정원 · 검사 이력', how: 'API 조회', status: '협의 필요', note: '**정원이 있어야 재차 인원이 혼잡도(%)가 된다.** 지금 못 하는 판정의 원인 중 하나' },
  { id: 'ts.driver', ko: '운수종사자 관리', org: '한국교통안전공단', kind: '국가·표준', gives: '기준 정보', dir: '받는다', what: '자격 · 교육 이수 · 위반 이력', how: 'API 조회', status: '협의 필요', note: '개인정보라 **가명키로 매칭**해야 한다. 실명 조인은 규정이 막는다' },
  { id: 'nodelink', ko: '국가표준노드링크', org: '국토교통부', kind: '국가·표준', gives: '기준 정보', dir: '받는다', what: '도로망 · 링크 ID · 제한속도', how: 'SHP / GeoJSON', status: '연동 예정', note: '**노선 매칭의 기준.** 이게 있어야 이탈 거리를 «어느 링크에서»까지 말한다' },
  { id: 'tago', ko: 'TAGO 대중교통정보', org: '국토교통부', kind: '국가·표준', gives: '기준 정보', dir: '받는다', what: '전국 노선 · 정류장 표준 코드', how: 'OpenAPI', status: '연동 예정', note: '다른 도시와 합칠 때 **정류장 코드가 같아야** 데이터가 붙는다' },
  { id: 'molit.sub', ko: '운행기록 제출', org: '국토교통부', kind: '국가·표준', gives: '원천 관측', dir: '준다', what: 'DTG 원본', how: '법정 제출 규격', status: '연동 예정', note: '**원본 그대로** 나가야 한다 — 가공한 값은 제출 자료가 아니다' },

  /* ── 시·지자체 ── */
  { id: 'bis', ko: '버스정보시스템 (BIS)', org: '대구광역시', kind: '시·지자체', gives: '집계·판정', dir: '주고받는다', what: '도착 예정 · 정류장 정보 / 우리 위치를 제공', how: 'REST JSON', status: '연동됨', note: '**도착 «예정»이지 실측이 아니다.** 정시율의 근거로 쓰려면 실제 도착 시각이 따로 필요하다' },
  { id: 'tic', ko: '교통정보센터 (소통)', org: '대구광역시', kind: '시·지자체', gives: '기준 정보', dir: '받는다', what: '구간 통행속도 · 돌발 · 공사', how: 'OpenAPI · DATEX II', status: '연동 예정', note: '지연이 **기사 탓인지 정체 탓인지**를 가른다 — 없으면 억울한 감점이 생긴다' },
  { id: 'utis', ko: '신호 · C-ITS', org: '대구광역시', kind: '시·지자체', gives: '기준 정보', dir: '주고받는다', what: '신호 주기 · V2X 경고', how: 'C-ITS (WAVE/LTE-V2X)', status: '협의 필요', note: '대구는 C-ITS 실증 도시. **신호 우선(TSP)** 효과 측정의 전제' },
  { id: 'smartcity', ko: '스마트시티 통합플랫폼', org: '대구광역시', kind: '시·지자체', gives: '집계·판정', dir: '주고받는다', what: 'CCTV 연계 · 돌발 상황 공유', how: '표준 연계 규격', status: '협의 필요', note: '영상은 **사건 발생 시 별도 절차로만.** 상시 연계는 목적 초과다' },
  { id: 'minwon', ko: '민원 접수 (국민신문고 등)', org: '대구광역시', kind: '시·지자체', gives: '집계·판정', dir: '받는다', what: '민원 내용 · 시각 · 노선', how: 'API / 파일', status: '연동됨', note: '민원 시각·위치로 그 시점 기록과 대조한다 — **자동 매칭은 초안이고 확정은 사람이** 한다' },
  { id: 'budget', ko: '재정 · 정산 시스템', org: '대구광역시', kind: '시·지자체', gives: '집계·판정', dir: '주고받는다', what: '표준운송원가 · 재정지원금 집행', how: '파일 · API', status: '연동 예정', note: '**공차 구분이 없으면 산정이 흔들린다** — 운행 상태가 여기서 필요해진다' },

  /* ── 교통카드·정산 ── */
  { id: 'card.settle', ko: '교통카드 정산', org: '정산사업자', kind: '교통카드·정산', gives: '집계·판정', dir: '받는다', what: '승하차 집계 · 환승 · 운송수입', how: '일 배치 파일', status: '연동 예정', note: '**개인 이동 이력이 아니라 집계로만** 받는다. 원본 태그는 받지 않는다' },
  { id: 'card.od', ko: 'OD 추정', org: '정산사업자 · 시', kind: '교통카드·정산', gives: '집계·판정', dir: '받는다', what: '승하차 정류장 쌍 집계', how: '월 배치', status: '협의 필요', note: '노선 신설·폐지의 근거. **가명·집계 처리 후에만** 쓴다' },

  /* ── 차량·충전 ── */
  { id: 'oem', ko: '제조사 텔레매틱스', org: '차량 제조사', kind: '차량·충전', gives: '원천 관측', dir: '받는다', what: '엔진·배터리 상세 · 고장 코드', how: 'OEM API · FMS 표준', status: '협의 필요', note: 'DTG보다 **훨씬 상세하다.** 다만 제조사마다 규격이 달라 FMS 표준으로 맞춰야 한다' },
  { id: 'ocpp', ko: '충전 인프라', org: '충전사업자 · 한전', kind: '차량·충전', gives: '원천 관측', dir: '받는다', what: '충전 세션 · 전력량 · 충전기 가동률', how: 'OCPP 1.6/2.0', status: '연동 예정', note: '**계량 전력량이 스코프 2 배출의 인정 자료.** 차량 SOC가 아니라 계량기 값이다' },
  { id: 'erp.maint', ko: '정비 전산 (ERP)', org: '운수사', kind: '사내 시스템', gives: '집계·판정', dir: '주고받는다', what: '정비 이력 · 부품 · 비용', how: 'DB 연계 · API', status: '연동 예정', note: '예지정비의 효과를 **비용 절감으로 환산**하려면 실제 정비비가 필요하다' },
  { id: 'fuel.card', ko: '주유·충전 카드', org: '카드사 · 운수사', kind: '사내 시스템', gives: '기준 정보', dir: '받는다', what: '연료 구매 실적 (양·금액)', how: '월 배치', status: '연동 예정', note: '**온실가스 인벤토리의 1차 자료.** 차량 계측과 대조해 누락·과다를 잡는다' },

  /* ── 환경·에너지 ── */
  { id: 'kma', ko: '기상청', org: '기상청', kind: '환경·에너지', gives: '기준 정보', dir: '받는다', what: '기온 · 강수 · 특보 · 노면', how: 'OpenAPI', status: '연동됨', note: '**폭우 중 급제동은 방어운전일 수 있다** — 맥락이 판정을 바꾼다' },
  { id: 'airkorea', ko: '에어코리아', org: '한국환경공단', kind: '환경·에너지', gives: '기준 정보', dir: '받는다', what: '미세먼지 · 대기질', how: 'OpenAPI', status: '연동 예정', note: '전기 전환의 대기질 개선 효과를 지역 단위로 본다' },
  { id: 'ghg', ko: '온실가스 종합정보', org: '환경부 · 온실가스센터', kind: '환경·에너지', gives: '기준 정보', dir: '주고받는다', what: '배출계수 최신본 / 이행실적 제출', how: '고시 · 제출 서식', status: '연동 예정', note: '**계수는 개정된다.** 계수를 코드 상수로 두면 개정을 못 따라간다 — 그래서 그래프 노드로 뒀다' },
  { id: 'kepco', ko: '전력 사용량', org: '한국전력', kind: '환경·에너지', gives: '기준 정보', dir: '받는다', what: '차고지 계량 전력량', how: '고객 API', status: '협의 필요', note: '충전기 값과 계량기 값이 다를 수 있다 — **인정되는 것은 계량기**' },

  /* ── 안전·보험 ── */
  { id: 'police', ko: '경찰 · 119', org: '경찰청 · 소방', kind: '안전·보험', gives: '집계·판정', dir: '주고받는다', what: '사고 접수 / 사고 시 자동 신고', how: '연계 규격', status: '협의 필요', note: '**사고 시에만.** 상시 연계 대상이 아니다' },
  { id: 'insure', ko: '보험사', org: '보험사', kind: '안전·보험', gives: '집계·판정', dir: '주고받는다', what: '사고 이력 · 요율 / 운전 데이터 제공', how: '파일 · API', status: '협의 필요', note: '운전 데이터가 **요율에 쓰이면 기사에게 불이익**이 된다 — 제공 범위에 동의가 필요하다' },

  /* ── 사내 시스템 ── */
  { id: 'hr', ko: '인사 · 근태', org: '운수사', kind: '사내 시스템', gives: '기준 정보', dir: '받는다', what: '교대 배정 · 연속운전 · 휴게', how: 'DB 연계', status: '연동 예정', note: '**연속 운전 시간은 법정 관리 대상.** 사고 원인 조사의 단골 항목이다' },
  { id: 'sched', ko: '배차 · 운행 계획', org: '운수사', kind: '사내 시스템', gives: '기준 정보', dir: '받는다', what: '시각표 · 계획 운행횟수 · 결행', how: 'DB 연계 · 파일', status: '연동 예정', note: '**여기가 가장 크게 비어 있다.** 정시율·결행·첫막차·공차가 전부 이것 하나에 걸려 있다' },

  /* ── 국제 표준 ── */
  { id: 'gtfs', ko: 'GTFS / GTFS-Realtime', org: 'MobilityData', kind: '국제 표준', gives: '원천 관측', dir: '주고받는다', what: '노선·시각표 정적 / 실시간 위치', how: 'Protobuf · ZIP', status: '연동됨', note: '다른 도시·해외와 붙을 때의 공통 언어. **속도가 m/s라 환산이 필요하다**' },
  { id: 'netex', ko: 'NeTEx / SIRI', org: 'CEN (유럽)', kind: '국제 표준', gives: '기준 정보', dir: '주고받는다', what: '노선망 정적(NeTEx) · 실시간 운행(SIRI)', how: 'XML', status: '협의 필요', note: 'Transmodel 계열. **우리 자산·성과 스페이스가 이미 여기에 정렬돼 있다**' },
  { id: 'datex', ko: 'DATEX II', org: 'CEN (유럽)', kind: '국제 표준', gives: '기준 정보', dir: '받는다', what: '도로 교통 상황 · 돌발', how: 'XML', status: '협의 필요', note: '교통정보센터 연계의 국제 규격판' },
  { id: 'mqtt', ko: '스트리밍 (MQTT/Kafka)', org: '자체 · 클라우드', kind: '국제 표준', gives: '원천 관측', dir: '주고받는다', what: '실시간 이벤트 전송로', how: 'MQTT · Kafka', status: '연동 예정', note: '**규모가 커지면 파일 배치로는 못 버틴다** — 1초 채널 22개 × 200대' },
]

export const ORG_KINDS: OrgKind[] = ['국가·표준', '시·지자체', '교통카드·정산', '차량·충전', '환경·에너지', '안전·보험', '사내 시스템', '국제 표준']

export const GIVES_TONE: Record<Gives, string> = {
  '원천 관측': '#34d399',
  '집계·판정': '#fbbf24',
  '기준 정보': '#38bdf8',
}

export const STATUS_TONE: Record<Status, string> = {
  연동됨: '#34d399',
  '연동 예정': '#fbbf24',
  '협의 필요': '#64748b',
}

export function integrationStats() {
  const I = INTEGRATIONS
  return {
    total: I.length,
    orgs: new Set(I.map((x) => x.org)).size,
    linked: I.filter((x) => x.status === '연동됨').length,
    planned: I.filter((x) => x.status === '연동 예정').length,
    talk: I.filter((x) => x.status === '협의 필요').length,
    /** 밖으로 나가는 것 — 규정이 다시 걸리는 자리 */
    outbound: I.filter((x) => x.dir === '준다' || x.dir === '주고받는다').length,
    byGives: (['원천 관측', '집계·판정', '기준 정보'] as Gives[]).map((g) => ({ g, n: I.filter((x) => x.gives === g).length })),
    byKind: ORG_KINDS.map((k) => ({ k, n: I.filter((x) => x.kind === k).length })),
  }
}
