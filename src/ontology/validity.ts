/**
 * 시간 유효성 — **언제부터 언제까지 성립하는 관계인가.**
 *
 * 여기까지 그래프의 모든 관계는 «항상 참»이었다. 「기사 D-001이 3742호를 운전한다」가
 * 시간과 무관하게 단언돼 있었다. 그러면 두 질문에 답할 수 없다.
 *  - 「3월에는 누가 몰았나」 — 지금 배정만 알고 과거를 모른다
 *  - 「이 판정이 났을 때 그 규정이 이미 있었나」 — 규정에 시행일이 없다
 *
 * ## 두 개의 시간
 * - **유효 시간(valid time)** — 현실에서 언제부터 언제까지 참인가. 여기서 다루는 것.
 * - **기록 시간(transaction time)** — 우리가 언제 그것을 알았나. 이미 갖고 있다 —
 *   검증 스탬프(어느 문법으로)와 실행 리니지(`prov:Activity`)가 그것이다.
 *   둘을 함께 가지면 **이중 시간(bitemporal)** 이 된다.
 *
 * ## 모든 관계에 시간을 붙이지 않는다
 * 이게 이 모듈의 요점이다. **인과 관계는 사후에 바뀌지 않는다.**
 * 「이 관측이 이 판정을 뒷받침했다」는 나중에 거짓이 되지 않는다 — 바뀌는 것은 판정이지
 * 관계가 아니다. 반면 배정·권한·규정은 **기간이 있는 사실**이다.
 * 어떤 관계가 시간을 갖고 어떤 관계는 안 갖는지를 구분하는 것 자체가 문법의 성숙도다.
 * 전부 붙이면 그래프만 부풀고 아무것도 더 답하지 못한다.
 */

/** 시간을 갖는 관계와 그 이유 */
export const TEMPORAL: Record<string, string> = {
  운전한다: '기사는 교대한다. 오전 배정과 오후 배정이 다르다',
  관리한다: '관리 책임은 이관된다',
  조회권한: '권한은 부여·회수된다 — 「언제부터 볼 수 있었나」가 감사 대상이다',
  승인권한: '권한은 부여·회수된다',
  보호한다: '규정에 시행일이 있다. 시행 전에는 아무것도 보호하지 않는다',
  제한한다: '규정에 시행일이 있다',
  '등급을 매긴다': '등급 체계는 개정된다',
  허용한다: '규정에 시행일이 있다',
  금지한다: '규정에 시행일이 있다 — 시행 전 행위에 소급하지 않는다',
  '승인을 요구한다': '규정에 시행일이 있다',
}

/** 시간을 갖지 않는 관계와 그 이유 — 「왜 없는지」가 더 중요하다 */
export const TIMELESS: Record<string, string> = {
  뒷받침한다: '사후에 바뀌지 않는다. 관측이 판정을 뒷받침했다는 사실은 그대로다 — 바뀌는 것은 판정이다',
  반박한다: '같은 이유. 반박한 사실 자체는 남는다',
  반영된다: '반영된 시점의 사실이다. 나중에 점수가 바뀌어도 「그때 반영됐다」는 참이다',
  분류된다: '관측은 시점이 고정된 사건이다. 분류 체계가 바뀌면 새 관측부터 적용한다',
  생성한다: '생성은 사건이지 상태가 아니다',
  기록된다: '같은 이유',
}

export const isTemporal = (relKo: string) => relKo in TEMPORAL
export const whyTime = (relKo: string) => TEMPORAL[relKo] ?? TIMELESS[relKo] ?? ''

/* ─────────────────── 규정 시행일 ───────────────────
   미시행 규정은 **실제로 아무것도 막지 않는다.** 그래프에 관계를 만들지 않고,
   SHACL 도메인 규칙도 생성하지 않는다. 「시행 예정이라 아직 안 막습니다」를
   화면 문구로만 적으면 그것은 다시 연극이다. */

export type PolicyValidity = {
  id: string
  ko: string
  /** 시뮬레이션 초 기준 시행 시각 */
  from: number
  /** 폐지 시각 — 없으면 계속 유효 */
  to?: number
  basis: string
}

export const POLICY_VALIDITY: PolicyValidity[] = [
  { id: 'pol-access-city', ko: '접근 권한 — 시', from: 0, basis: '데이터 제공 협약 체결일' },
  { id: 'pol-access-op', ko: '접근 권한 — 운수사', from: 0, basis: '운송사업 면허일' },
  { id: 'pol-retention-raw', ko: '원본 보존 5년', from: 0, basis: '교통안전법 시행일' },
  { id: 'pol-pseudo', ko: '가명 처리', from: 0, basis: '개인정보보호법 개정 시행일' },
  // 시행 예정 — 이 데모에서 시간이 흐르면 실제로 켜진다.
  // 06:00 시작이므로 simTime 1800 = 06:30. 배속 60×면 30초쯤 뒤에 시행된다.
  { id: 'pol-noauto', ko: '불이익 결정 자동화 금지', from: 1800, basis: '자동화 결정 대응권 조항 — 유예기간 후 시행' },
]

/** 게이트가 돌 때마다 현재 시각을 알려 준다 — 셰이프 생성이 시각을 알아야 규칙을 켜고 끌 수 있다 */
let now = 0
export const setNow = (t: number) => {
  now = t
}
export const nowSim = () => now

export const policyActive = (id: string, at = now) => {
  const p = POLICY_VALIDITY.find((x) => x.id === id)
  if (!p) return true
  return at >= p.from && (p.to === undefined || at < p.to)
}

export const policyOf = (id: string) => POLICY_VALIDITY.find((x) => x.id === id)

/** 셰이프 캐시 키에 넣는다 — 시행 상태가 바뀌면 셰이프를 다시 만들어야 한다 */
export const activeSignature = (at = now) =>
  POLICY_VALIDITY.map((p) => (policyActive(p.id, at) ? '1' : '0')).join('')

/* ─────────────────── 기사 교대 ───────────────────
   엔진이 주는 배정을 바꾸지 않는다. 대신 **그 배정이 언제까지 유효한지**를 붙인다.
   「지금 누가 모나」와 「그때 누가 몰았나」가 다른 질문이라는 것을 그래프가 말하게 하는 것이 목적. */

/** 교대 길이(시뮬레이션 초) — 4시간 근무를 데모 시간으로 압축 */
export const SHIFT_SEC = 1200

export const shiftAt = (t: number) => {
  const n = Math.floor(t / SHIFT_SEC)
  return { n: n + 1, from: n * SHIFT_SEC, to: (n + 1) * SHIFT_SEC }
}

/** 시뮬레이션 초 → ISO. lineage와 같은 기준시(06:00)를 쓴다 */
export const iso = (t: number) => new Date(Date.UTC(2026, 7, 15, 6, 0, 0) + Math.round(t * 1000)).toISOString()

/** 화면용 시:분:초 */
export const clock = (t: number) => iso(t).slice(11, 19)

/** 남은 시간(초) — 시행 예정 규정의 카운트다운 */
export const untilActive = (id: string, at = now) => {
  const p = policyOf(id)
  if (!p || at >= p.from) return 0
  return Math.round(p.from - at)
}
