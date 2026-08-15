import { CHANNELS } from './sensors'

/**
 * 데이터 자산 전수 — **수집 → 생성 → 활용.**
 *
 * 수집 항목만 적으면 절반이다. 시스템이 **만들어 내는 것**과 그것이 **나가는 곳**까지 세야
 * 「이 시스템이 다루는 데이터」가 다 적힌다. 실무에서 사고가 나는 자리도 대개 뒤쪽이다 —
 * 「원본은 5년 보관인데 그걸로 만든 분석셋은 몇 년인가」, 「이 지표를 누가 어디서 보는가」.
 *
 * ## 생성 데이터가 수집 데이터보다 위험하다
 * 수집값은 틀리면 센서를 고치면 된다. **생성값은 틀려도 그럴듯해 보인다.**
 * 그래서 생성물마다 **어디서 왔고(from) · 어떻게 만들었고(method) · 얼마나 믿을 만한지(confidence)**를
 * 함께 적는다. 이 셋이 없는 생성값은 쓰면 안 된다.
 *
 * ## 활용처를 적으면 파급이 보인다
 * 「이 값을 고치면 어디가 흔들리나」는 활용처 목록이 있어야 답한다.
 * ⑦ 영향 분석이 하는 일을 데이터 단위로 미리 적어 두는 것이다.
 */

export type Stage = '수집' | '생성' | '활용'

export type ProducedKind = '판정' | '성과' | '조치' | 'AI 산출' | '메타' | '파생 지표'
export type Method = '규칙' | '집계' | '그래프 순회' | '모델' | '사람 확정'
export type Conf = '실측' | '환산' | '추정' | '정성' | '미측정'

export type Produced = {
  id: string
  ko: string
  kind: ProducedKind
  /** 무엇에서 만들어지나 */
  from: string
  method: Method
  conf: Conf
  /** 지금 실제로 만들어지나 */
  live: boolean
  /** 보존 기간 */
  keep: string
  note: string
}

export const PRODUCED: Produced[] = [
  /* ── 판정 — 관측에 대한 «판단». 사람의 책임이 걸리는 자리 ── */
  { id: 'jv', ko: '정당 판정', kind: '판정', from: '위험운전 패킷 + 날씨 + 소명', method: '규칙', conf: '추정', live: true, keep: '3년', note: '감점할지 면제할지. **확정에는 담당자가 필요하다** — 자동 확정은 규정이 막는다' },
  { id: 'cv', ko: '민원 사실 판정', kind: '판정', from: '민원 + 그 시각 DTG + 위치', method: '규칙', conf: '추정', live: true, keep: '3년', note: '민원 내용과 실제 기록을 대조. 사실/사실 아님/확인 불가 3종' },
  { id: 'rc', ko: '노선 준수 판정', kind: '판정', from: '위치 관측 + 인가노선', method: '규칙', conf: '실측', live: true, keep: '5년', note: '정산 검증의 근거라 원본과 같은 기간 보관' },
  { id: 'fp', ko: '고장 예측', kind: '판정', from: '센서 측정 시계열', method: '모델', conf: '추정', live: true, keep: '3년', note: '냉각수온·브레이크 마모 추세. 예측이므로 신뢰도 상한이 낮다' },
  { id: 'bv', ko: '몰림 판정', kind: '판정', from: '위치 관측 + 앞뒤차 간격', method: '규칙', conf: '실측', live: true, keep: '1년', note: '정상/몰림/벌어짐. 배차 권고의 근거' },
  { id: 'crv', ko: '혼잡 판정', kind: '판정', from: '재차 관측 + 정원', method: '규칙', conf: '실측', live: true, keep: '1년', note: '여유/보통/혼잡. **정원이 없으면 재차율이 혼잡도가 되지 못한다**' },
  { id: 'em', ko: '배출 산정', kind: '판정', from: '회차 연료 × 배출계수', method: '규칙', conf: '환산', live: true, keep: '5년', note: '**계산이 아니라 판정으로 둔다** — 어느 계수를 썼는지가 함께 남아야 검증된다' },
  { id: 'fw', ko: '연료 낭비 분해', kind: '판정', from: '회차 연료 + 기준선 + 조작 이력', method: '규칙', conf: '추정', live: true, keep: '1년', note: '공회전·급조작·습관·냉난방 4요인. 코칭 대상을 정한다' },
  { id: 'ce', ko: '코칭 효과 판정', kind: '판정', from: '조치 전후 행동 지표', method: '집계', conf: '추정', live: false, keep: '3년', note: '**아직 못 만든다** — 조치 전후 비교가 없어 「원래 좋아지던 중」과 못 가린다' },

  /* ── 성과 — 바뀐 숫자. 정책과 평가가 여기에 붙는다 ── */
  { id: 'score', ko: '안전점수', kind: '성과', from: '위험운전 패킷 + 정당 판정 + 감점 가중치', method: '그래프 순회', conf: '실측', live: true, keep: '3년', note: '**단말 값이 아니라 그래프를 걸어 다시 계산한 값.** 격리분과 정당 인정분은 감점에서 빠진다' },
  { id: 'eco', ko: '경제운전 점수', kind: '성과', from: '관성주행 · 공회전 비율', method: '집계', conf: '실측', live: true, keep: '3년', note: '연료 절감의 행동 지표' },
  { id: 'fuelsave', ko: '연료 절감률', kind: '성과', from: '실측 연료 vs 기준선 연료', method: '집계', conf: '실측', live: true, keep: '5년', note: '기준선 대비라 유가·날씨가 제거된 순수 효과' },
  { id: 'co2', ko: 'CO₂ 감축량', kind: '성과', from: '연료 절감량 × 배출계수', method: '규칙', conf: '환산', live: true, keep: '5년', note: '온실가스 이행실적 보고에 쓰인다' },
  { id: 'punc', ko: '정시율', kind: '성과', from: '(도착 실측 − 계획 시각)', method: '집계', conf: '미측정', live: false, keep: '3년', note: '**둘 다 없어서 못 만든다.** 값을 지어내지 않고 「미측정」으로 둔다' },
  { id: 'hw', ko: '배차 간격 편차', kind: '성과', from: '앞차 간격 − 이상 간격', method: '집계', conf: '실측', live: true, keep: '1년', note: '몰림·벌어짐의 정량' },
  { id: 'ride', ko: '수송 실적', kind: '성과', from: '누적 승차 인원', method: '집계', conf: '실측', live: true, keep: '5년', note: '배차 효과의 최종 지표' },
  { id: 'red', ko: '감축 실적', kind: '성과', from: '기준선 배출 − 실제 배출', method: '집계', conf: '환산', live: true, keep: '5년', note: '**기준선 없는 감축 주장은 검증이 안 된다**' },
  { id: 'loadf', ko: '실차율', kind: '성과', from: '실차거리 / 총주행거리', method: '집계', conf: '실측', live: false, keep: '5년', note: '**아직 못 만든다** — 운행 상태 구분이 없어 공차를 못 가린다' },

  /* ── 조치 — 사람이 내리는 행동. 쓰기 경로가 온톨로지를 통과한다 ── */
  { id: 'coach', ko: '실시간 코칭', kind: '조치', from: '위험운전 패킷 + 낭비 요인', method: '사람 확정', conf: '실측', live: true, keep: '3년', note: '불이익이 될 수 있어 **승인자가 필수**. 발행 기록이 그래프에 남는다' },
  { id: 'disp', ko: '배차 권고', kind: '조치', from: '몰림 판정', method: '사람 확정', conf: '실측', live: true, keep: '1년', note: '관제가 승인 후 실행' },
  { id: 'pm', ko: '예지정비 작업지시', kind: '조치', from: '고장 예측', method: '사람 확정', conf: '추정', live: true, keep: '5년', note: '정비 이력과 연결돼 재발 분석의 근거가 된다' },
  { id: 'inc', ko: '안전 인센티브', kind: '조치', from: '안전점수 + 운전군', method: '사람 확정', conf: '추정', live: true, keep: '3년', note: '보상은 불이익이 아니지만 **기준이 공개돼야** 신뢰가 된다' },
  { id: 'elec', ko: '전기 전환 계획', kind: '조치', from: '감축 실적 + 충전 인프라', method: '사람 확정', conf: '추정', live: true, keep: '영구', note: '투자 결정이라 근거를 오래 보관한다' },

  /* ── AI 산출 — 가장 유용하고 가장 조심해야 한다 ── */
  { id: 'ai.eviden', ko: '민원 증빙 자동매칭', kind: 'AI 산출', from: '민원 텍스트 + 시각 + 위치 + DTG', method: '모델', conf: '추정', live: true, keep: '3년', note: '**AI 판단은 판정이 아니라 초안이다.** 사람이 확정해야 효력이 생긴다' },
  { id: 'ai.demand', ko: '수요·지연 예측', kind: 'AI 산출', from: '날씨 + 과거 승하차 + 교통', method: '모델', conf: '추정', live: true, keep: '1년', note: '예측은 빗나갈 수 있다 — 신뢰도 상한 70%' },
  { id: 'ai.coach', ko: '코칭 문구 생성', kind: 'AI 산출', from: '낭비 요인 + 위험운전 유형', method: '모델', conf: '정성', live: false, keep: '1년', note: '**표현이 사람을 다치게 할 수 있다.** 결핍·비난이 아니라 지원 표현으로' },
  { id: 'ai.report', ko: '정책 보고서 초안', kind: 'AI 산출', from: '성과 + 집단 집계 + 근거 사슬', method: '모델', conf: '정성', live: false, keep: '3년', note: '근거 사슬을 인용해야 초안이 검증 가능해진다' },
  { id: 'ai.anom', ko: '이상 탐지', kind: 'AI 산출', from: '센서 시계열', method: '모델', conf: '추정', live: false, keep: '1년', note: '고장 예측의 앞단. 오탐이 많으면 아무도 안 본다' },
  { id: 'ai.nlq', ko: '자연어 질의 응답', kind: 'AI 산출', from: '문법(CAG) + 그래프 질의(TAG)', method: '모델', conf: '정성', live: false, keep: '없음', note: '**문법 검증기가 LLM 질의를 실행 전에 거른다** — 온톨로지의 고유 이점' },

  /* ── 메타 — 데이터에 대한 데이터. 감사와 신뢰가 여기 걸린다 ── */
  { id: 'stamp', ko: '검증 스탬프', kind: '메타', from: '적재 게이트 실행', method: '규칙', conf: '실측', live: true, keep: '원본과 동일', note: '레코드마다 «어느 문법으로 검증됐나». **발행은 소급하지 않는다**' },
  { id: 'lineage', ko: '실행 리니지', kind: '메타', from: '게이트 · 조치 발행', method: '규칙', conf: '실측', live: true, keep: '5년', note: 'prov:Activity. **「격리 0건」이 깨끗한 건지 검사를 안 한 건지**는 이걸 봐야 갈린다' },
  { id: 'quar', ko: '격리 이력', kind: '메타', from: 'SHACL 위반 + 처리 기록', method: '규칙', conf: '실측', live: true, keep: '1년', note: '담당자 사유 원문까지 남는다 — 감사 때 그 문장이 근거가 된다' },
  { id: 'rel', ko: '개정 이력', kind: '메타', from: '문법 발행', method: '사람 확정', conf: '실측', live: true, keep: '영구', note: '**규격 파일만으로는 절반.** 왜 그렇게 됐는지가 있어야 다음 개정 때 같은 논쟁을 안 한다' },
  { id: 'valid', ko: '유효 구간', kind: '메타', from: '배정 · 규정 시행일', method: '규칙', conf: '실측', live: true, keep: '영구', note: '「그때 그 규정이 있었나」에 답한다' },
  { id: 'cat', ko: '데이터 카탈로그', kind: '메타', from: '정의 + 게이트 + 리니지 + 규정', method: '집계', conf: '실측', live: true, keep: '상시', note: '**손으로 적지 않는다.** 손으로 적는 카탈로그는 반드시 낡는다' },
  { id: 'dqv', ko: '품질 측정', kind: '메타', from: '게이트 통과/격리', method: '집계', conf: '실측', live: true, keep: '1년', note: 'DQV. 데이터셋마다 통과율이 붙는다' },
  { id: 'access', ko: '접근 로그', kind: '메타', from: '역할 × 조회', method: '규칙', conf: '실측', live: false, keep: '3년', note: '**아직 안 만든다** — 실서비스에서는 누가 무엇을 봤는지가 감사 대상이다' },

  /* ── 파생 지표 — 다른 값에서 계산되는 숫자 ── */
  { id: 'd.occ', ko: '재차율', kind: '파생 지표', from: '재차 인원 / 정원', method: '집계', conf: '실측', live: true, keep: '1년', note: '정원이 있어야 «%»가 된다' },
  { id: 'd.kwh', ko: '전비 (km/kWh)', kind: '파생 지표', from: '주행거리 / 충전 전력량', method: '집계', conf: '실측', live: false, keep: '3년', note: '전기버스 감축량의 활동자료' },
  { id: 'd.cancel', ko: '결행률', kind: '파생 지표', from: '(계획 − 실제) / 계획', method: '집계', conf: '실측', live: false, keep: '5년', note: '**계획이 없으면 「안 한 것」을 셀 수 없다**' },
  { id: 'd.conf', ko: '신뢰도 등급', kind: '파생 지표', from: '근거 유형', method: '규칙', conf: '실측', live: true, keep: '값과 동일', note: '실측 95% · 환산 85% · 추정 70% · 정성 50%. **상한을 못 넘는다**' },
  { id: 'd.zone', ko: '위험 구간 밀도', kind: '파생 지표', from: '위험운전 위치 격자 집계', method: '집계', conf: '실측', live: true, keep: '3년', note: '「그 기사가 문제」와 「그 구간이 문제」를 가른다' },
  { id: 'd.waste', ko: '낭비 요인 비중', kind: '파생 지표', from: '연료 낭비 4요인', method: '집계', conf: '추정', live: true, keep: '1년', note: '무엇부터 코칭할지가 여기서 정해진다' },
]

/* ─────────────────────────── 활용처 ─────────────────────────── */

export type ConsumerKind = '화면' | '파일' | '연계' | 'AI' | '보고'

export type Consumer = {
  id: string
  ko: string
  kind: ConsumerKind
  who: string
  cycle: string
  uses: string
  live: boolean
  note: string
}

export const CONSUMERS: Consumer[] = [
  /* 화면 — 운영 플랫폼 + 이 도구 */
  { id: 'v.city', ko: '시티 대시보드', kind: '화면', who: '대구시', cycle: '실시간', uses: '성과 · 집단 집계', live: true, note: '노선·통계 단위. 개인 식별 정보는 안 내려간다' },
  { id: 'v.op', ko: '운수사 관제', kind: '화면', who: '운수사', cycle: '실시간', uses: '안전점수 · 몰림 판정 · 위험운전', live: true, note: '자사 차량 범위만' },
  { id: 'v.driver', ko: '기사 앱', kind: '화면', who: '기사', cycle: '실시간', uses: '내 점수 · 근거 사슬 · 코칭', live: true, note: '**자기 차량 1대만.** 동료 비교는 개인 평가 도구가 된다' },
  { id: 'v.steward', ko: '데이터 관리자', kind: '화면', who: '데이터 책임자', cycle: '실시간', uses: '격리 큐 · 카탈로그 · 리니지', live: true, note: '관리 권한이 열람 권한을 주지는 않는다 — 실명은 못 본다' },
  { id: 'v.settle', ko: '정산 검증', kind: '화면', who: '대구시 · 운수사', cycle: '월', uses: '노선 준수 · 회차 · (공차)', live: true, note: '재정지원 산정의 근거' },
  { id: 'v.policy', ko: '정책 보고서', kind: '화면', who: '대구시', cycle: '분기', uses: '성과 · 목표 · 집단 비교', live: true, note: '근거 사슬을 인용해야 보고서가 검증 가능해진다' },
  { id: 'v.carbon', ko: '탄소중립 분석', kind: '화면', who: '대구시 · 검증기관', cycle: '월·연', uses: '배출 산정 · 감축 실적 · 수단별 기여', live: true, note: 'MRV 되짚기가 여기서 시작된다' },
  { id: 'v.studio', ko: '온톨로지 스튜디오', kind: '화면', who: '전체', cycle: '상시', uses: '문법 · 그래프 · 카탈로그', live: true, note: '이 도구 자체' },

  /* 파일 — 밖으로 나가는 산출물 */
  { id: 'f.jsonld', ko: 'JSON-LD', kind: '파일', who: '연계 시스템', cycle: '개정 시', uses: '문법 + 개정 이력', live: true, note: '기계가 읽는 규격' },
  { id: 'f.ttl', ko: 'Turtle (OWL)', kind: '파일', who: '그래프 DB', cycle: '개정 시', uses: '문법 · 인스턴스', live: true, note: 'domain·range로 문법을 강제한다' },
  { id: 'f.cypher', ko: 'Cypher', kind: '파일', who: 'Neo4j', cycle: '개정 시', uses: '제약조건 + 감사 질의', live: true, note: '적재 후 문법 위반을 찾는 질의가 포함' },
  { id: 'f.shacl', ko: 'SHACL', kind: '파일', who: '적재 파이프라인', cycle: '개정 시', uses: '검증 규칙', live: true, note: '실제로 막는 것은 이 파일이다' },
  { id: 'f.spec', ko: '문법 명세서', kind: '파일', who: '협약 상대', cycle: '개정 시', uses: '문법 전체', live: true, note: '사람이 읽는 문서' },
  { id: 'f.audit', ko: '격리 이력', kind: '파일', who: '감사', cycle: '요청 시', uses: '격리 + 처리 + 사유', live: true, note: '규정 보호 규칙의 우회 여부가 표로 나온다' },
  { id: 'f.change', ko: '개정 이력', kind: '파일', who: '협약 상대', cycle: '개정 시', uses: '버전별 변경 + 근거', live: true, note: '왜 이렇게 됐나' },
  { id: 'f.prod', ko: '실서비스 대응표', kind: '파일', who: '발주처', cycle: '요청 시', uses: '데모↔실서비스 격차', live: true, note: '제안서 첨부' },
  { id: 'f.howto', ko: '사용 안내서', kind: '파일', who: '전체', cycle: '요청 시', uses: '흐름 + 경로', live: true, note: '회의 자료' },
  { id: 'f.croissant', ko: 'Croissant', kind: '파일', who: 'AI 팀', cycle: '상시', uses: '학습셋 서술 + 프로버넌스 + 이용 정책', live: true, note: '값에 의미·단위·한계가 붙어서 나간다' },

  /* 연계 — 다른 시스템으로 */
  { id: 'x.tic', ko: '시 교통정보센터', kind: '연계', who: '대구시', cycle: '실시간', uses: '위치 · 배차 간격', live: false, note: '실서비스 연동 대상' },
  { id: 'x.bis', ko: 'BIS 도착정보', kind: '연계', who: '시민', cycle: '실시간', uses: '위치 · 도착 예정', live: false, note: '양방향 — 받기도 하고 주기도 한다' },
  { id: 'x.molit', ko: '국토부 운행기록 제출', kind: '연계', who: '정부', cycle: '월', uses: 'DTG 원본', live: false, note: '법정 제출. 원본 그대로여야 한다' },
  { id: 'x.ghg', ko: '온실가스 인벤토리', kind: '연계', who: '대구시 · 환경부', cycle: '연', uses: '배출 산정 + 연료 구매 실적', live: false, note: '**계측값보다 구매 실적을 1차 자료로 인정**한다' },
  { id: 'x.settle', ko: '정산 시스템', kind: '연계', who: '대구시', cycle: '월', uses: '회차 · 노선 준수 · 운송수입', live: false, note: '준공영제 재정지원 산정' },
  { id: 'x.insure', ko: '보험 · 사고 조사', kind: '연계', who: '보험사 · 경찰', cycle: '사고 시', uses: '충격 · 위치 · 영상', live: false, note: '**별도 절차로만.** 상시 제공 대상이 아니다' },

  /* AI */
  { id: 'a.train', ko: '학습셋 공급', kind: 'AI', who: 'AI 팀', cycle: '주', uses: 'Croissant + 그래프', live: true, note: '의미·단위·한계가 붙은 상태로' },
  { id: 'a.tag', ko: '그래프 질의 (TAG)', kind: 'AI', who: 'AI 에이전트', cycle: '요청 시', uses: '인스턴스 그래프', live: false, note: '**LLM이 만든 질의를 문법 검증기가 실행 전에 거른다**' },
  { id: 'a.cag', ko: '문법 선적재 (CAG)', kind: 'AI', who: 'AI 에이전트', cycle: '상시', uses: '문법 전체 26KB', live: false, note: '검색할 필요 없이 통째로 컨텍스트에' },
  { id: 'a.rag', ko: '자연어 진입 (RAG)', kind: 'AI', who: '시민 · 담당자', cycle: '요청 시', uses: '카탈로그 + 용어', live: false, note: '「연비가 왜 나빠졌지」를 어느 지표로 옮길지' },

  /* 보고 */
  { id: 'r.audit', ko: '감사 제출', kind: '보고', who: '감사기관', cycle: '요청 시', uses: '격리 · 리니지 · 개정 이력', live: true, note: '「격리 0건」이 검사를 안 한 결과인지까지 함께' },
  { id: 'r.settle', ko: '재정지원 정산', kind: '보고', who: '대구시', cycle: '월', uses: '회차 · 노선 준수 · (공차)', live: true, note: '공차 구분이 없으면 산정이 흔들린다' },
  { id: 'r.eval', ko: '경영·서비스 평가', kind: '보고', who: '대구시', cycle: '연', uses: '성과 + 결행 + 민원', live: false, note: '평가식(가중치·목표)이 규정에 없어 아직 등급을 못 낸다' },
  { id: 'r.ghg', ko: '온실가스 이행실적', kind: '보고', who: '환경부 · 대구시', cycle: '연', uses: '배출 산정 + 감축 실적 + 근거', live: true, note: '**제3자가 되짚을 수 있는 형태**여야 인정된다' },
  { id: 'r.acc', ko: '사고 조사', kind: '보고', who: '경찰 · 보험', cycle: '사고 시', uses: '충격 · 위치 · 근무 이력', live: false, note: '연속 운전 시간이 사고 원인 조사의 단골 항목이다' },
]

/* ─────────────────────────── 통계 ─────────────────────────── */

export function flowStats() {
  const p = PRODUCED
  const c = CONSUMERS
  return {
    collected: CHANNELS.length,
    collectedLive: CHANNELS.filter((x) => x.intake === '수집·연결').length,
    produced: p.length,
    producedLive: p.filter((x) => x.live).length,
    consumers: c.length,
    consumersLive: c.filter((x) => x.live).length,
    total: CHANNELS.length + p.length + c.length,
    byKind: (['판정', '성과', '조치', 'AI 산출', '메타', '파생 지표'] as ProducedKind[]).map((k) => ({
      k,
      n: p.filter((x) => x.kind === k).length,
      live: p.filter((x) => x.kind === k && x.live).length,
    })),
    byConsumer: (['화면', '파일', '연계', 'AI', '보고'] as ConsumerKind[]).map((k) => ({
      k,
      n: c.filter((x) => x.kind === k).length,
      live: c.filter((x) => x.kind === k && x.live).length,
    })),
  }
}

export const CONF_TONE: Record<Conf, string> = {
  실측: '#34d399',
  환산: '#38bdf8',
  추정: '#fbbf24',
  정성: '#a78bfa',
  미측정: '#64748b',
}

export const KIND_TONE: Record<ProducedKind, string> = {
  판정: '#f43f5e',
  성과: '#38bdf8',
  조치: '#fbbf24',
  'AI 산출': '#a78bfa',
  메타: '#64748b',
  '파생 지표': '#34d399',
}
