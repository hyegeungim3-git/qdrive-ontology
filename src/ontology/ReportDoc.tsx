import { Fragment } from 'react'
import { currentVersion } from './grammar'
import { clock } from './validity'
import { roleOf, type RoleId } from './policy'
import { weakest, type Section } from './report'
import type { GateResult } from './gate'

/**
 * 공문서 서식 미리보기 — **운영 플랫폼의 「정책 보고서 에이전트」와 같은 서식.**
 *
 * 앞서는 Markdown 원문을 그대로 보여 줬다. 정확하긴 한데 받는 사람 입장에서는
 * «파일 하나»이지 «문서»가 아니다. 발주처가 실제로 결재에 올리는 모양이어야
 * 「이대로 쓰면 되겠다」가 된다. 그래서 운영 플랫폼이 이미 쓰는 서식을 그대로 가져왔다 —
 * 관인 머리·문서번호·개조식 본문·표·붙임·결재란·꼬리말.
 *
 * ## 두 가지를 지켰다
 *  1. **종이는 언제나 흰색이다.** 테마를 따라가지 않는다 — 인쇄물은 다크 모드가 없고,
 *     문서는 화면 설정과 무관하게 같은 모양이어야 한다. 그래서 이 안에서는
 *     테마 토큰을 쓰지 않고 색을 직접 적는다.
 *  2. **내용은 우리 것이다.** 서식만 빌려 왔다. 근거 노드 표·근거 등급·못 하는 것·
 *     규칙이 막은 질의는 이 도구에만 있는 절이고, 그게 이 보고서를 믿을 근거다.
 */

const NAVY = '#0b4da2'
const BAND = '#eaf2fb'
const INK = '#111827'
const DIM = '#4b5563'
const LINE = '#d1d5db'

const KIND_KO: Record<string, string> = {
  trip: '운행 1회 분석',
  policy: '정책 수립 검토',
  safety: '안전 운전 진단',
  carbon: '온실가스 산정',
  measure: '감축 수단별 기여',
  gap: '데이터 확보 계획',
  unknown: '답변 불가',
}

/** 개조식 — 마크다운 강조를 굵게, 나머지는 그대로 */
function Body({ t }: { t: string }) {
  return (
    <>
      {t.split('**').map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))}
    </>
  )
}

function SecTitle({ n, ko }: { n: number; ko: string }) {
  return (
    <div className="mt-4 mb-1.5 border-l-[3px] px-2 py-1 text-[12.5px] font-bold" style={{ borderColor: NAVY, background: BAND, color: NAVY }}>
      {n}. {ko}
    </div>
  )
}

/** 근거 표기 — 「어디서 나온 값인가」를 문서에 남기는 자리 */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded px-2 py-1 text-[11px]" style={{ background: '#f3f4f6', color: DIM }}>
      {children}
    </div>
  )
}

export default function ReportDoc({ secs, gate, role }: { secs: Section[]; gate: GateResult; role: RoleId }) {
  const w = weakest(secs)
  const nCite = secs.reduce((n, s) => n + s.cites.length, 0)
  const blocked = secs.filter((s) => s.blocked)
  const limits = [...new Set(secs.flatMap((s) => s.limits))]
  const docNo = `대구-버스운영과-2026-온톨로지-${String(secs.length).padStart(3, '0')}`

  return (
    <div id="qd-report-doc" className="overflow-auto rounded-lg" style={{ background: '#fff', color: INK, maxHeight: '34rem' }}>
      {/* ── 관인 머리 ── */}
      <div className="flex items-center justify-between px-6 py-3" style={{ background: NAVY }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-black" style={{ background: '#fff', color: NAVY }}>
            大
          </span>
          <div className="leading-tight">
            <div className="text-[12.5px] font-black text-white">대구광역시</div>
            <div className="text-[9px] tracking-[0.14em] text-white/70">DAEGU METROPOLITAN CITY</div>
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-[11.5px] font-bold text-white">버스운영과</div>
          <div className="text-[9.5px] text-white/70">{docNo}</div>
        </div>
      </div>
      <div style={{ height: 3, background: '#facc15' }} />

      <div className="px-6 pb-6 pt-5">
        {/* ── 표제 ── */}
        <div className="text-center">
          <div className="inline-block border-b-2 pb-1 text-[19px] font-black tracking-tight" style={{ color: NAVY, borderColor: NAVY }}>
            운행 데이터 분석 결과보고
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: DIM }}>
            온톨로지 근거 분석 — 모든 수치에 근거 노드가 붙어 있습니다
          </div>
        </div>

        {/* ── 머리표 ── */}
        <table className="mt-4 w-full border-collapse text-[11.5px]">
          <tbody>
            {[
              ['수신', '내부결재', '문서번호', docNo],
              ['담당 부서', '버스운영과', '분석 기준', `${clock(gate.at)} (시뮬레이션 시각)`],
              ['작성 역할', `${roleOf(role).ko} · ${roleOf(role).org}`, '적용 문법', `${currentVersion()} — 그래프 노드 ${gate.graph.subjects}개`],
            /* 라벨·값 두 쌍을 한 줄에 — Fragment로 감쌀 때 **키는 Fragment에** 붙여야 한다.
               안쪽 td에만 붙이면 React가 «목록의 자식에 키가 없다»고 경고한다. */
            ].map((r) => (
              <tr key={r[0]}>
                {[0, 2].map((i) => (
                  <Fragment key={i}>
                    <td className="border px-2 py-1 font-bold" style={{ borderColor: LINE, background: '#f3f4f6', color: NAVY, width: '13%' }}>
                      {r[i]}
                    </td>
                    <td className="border px-2 py-1" style={{ borderColor: LINE, width: '37%' }}>
                      {r[i + 1]}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── 요약 지표 ── */}
        <div className="mt-4 border-l-[3px] px-2 py-1 text-[12.5px] font-bold" style={{ borderColor: NAVY, background: BAND, color: NAVY }}>
          이 보고서를 어떻게 확인하나
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 max-[720px]:grid-cols-2">
          {[
            { n: String(secs.length), ko: '분석 항목', sub: '질문 하나가 한 절', c: '#eef2ff', t: '#3730a3' },
            { n: String(nCite), ko: '근거 노드', sub: '수치마다 되짚기 가능', c: '#ecfdf5', t: '#065f46' },
            { n: w ? `${w.pct}%` : '—', ko: `신뢰도 상한 · ${w?.level ?? '—'}`, sub: '가장 약한 근거를 따름', c: '#fffbeb', t: '#92400e' },
            { n: String(limits.length), ko: '답하지 못한 것', sub: '숨기지 않고 문서에', c: '#fef2f2', t: '#991b1b' },
          ].map((k) => (
            <div key={k.ko} className="rounded border px-2.5 py-2 text-center" style={{ borderColor: LINE, background: k.c }}>
              <div className="text-[19px] font-black tabular-nums" style={{ color: k.t }}>
                {k.n}
              </div>
              <div className="mt-0.5 break-keep text-[11px] font-bold" style={{ color: INK }}>
                {k.ko}
              </div>
              <div className="break-keep text-[9.5px]" style={{ color: DIM }}>
                {k.sub}
              </div>
            </div>
          ))}
        </div>
        <Note>
          ※ 종합 등급은 <b>가장 약한 근거</b>를 따릅니다 — 평균을 내면 약한 근거가 강한 근거 뒤에 숨습니다.
          {w ? ` 현재 최저 등급은 «${w.level}»입니다.` : ''}
        </Note>

        {!secs.length && (
          <div className="mt-6 rounded border border-dashed px-4 py-8 text-center text-[12px]" style={{ borderColor: LINE, color: DIM }}>
            아직 분석 항목이 없습니다. 위에서 <b>「⚡ 대표 6항목 한 번에」</b>를 누르거나 에이전트에 질문하면 이 자리에 절이 생깁니다.
          </div>
        )}

        {/* ── 본문 절 ── */}
        {secs.map((s, i) => (
          <div key={`${s.kind}-${i}`}>
            <SecTitle n={i + 1} ko={KIND_KO[s.kind] ?? '분석'} />
            <div className="mb-1.5 text-[11px]" style={{ color: DIM }}>
              질의 — {s.q}
            </div>
            <div className="mb-2 break-keep pl-1 text-[12px] leading-relaxed">
              ○ <Body t={s.answer} />
            </div>

            {!!s.cites.length && (
              <>
                <div className="mb-1 text-[11px] font-bold" style={{ color: NAVY }}>
                  [표 {i + 1}] 근거 노드 — 이 절의 수치가 나온 자리
                </div>
                <div className="mb-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[11px]">
                    <thead>
                      <tr>
                        {['스페이스', '노드', '값', '노드 식별자(IRI)'].map((h) => (
                          <th key={h} className="border px-1.5 py-1 font-bold text-white" style={{ borderColor: LINE, background: NAVY }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.cites.map((c, j) => (
                        <tr key={`${c.iri}-${j}`} style={{ background: j % 2 ? '#f9fafb' : '#fff' }}>
                          <td className="border px-1.5 py-1 text-center" style={{ borderColor: LINE }}>
                            {c.space}
                          </td>
                          <td className="border px-1.5 py-1" style={{ borderColor: LINE }}>
                            {c.label}
                          </td>
                          <td className="border px-1.5 py-1 text-center tabular-nums" style={{ borderColor: LINE }}>
                            {c.value ?? '—'}
                          </td>
                          <td className="border px-1.5 py-1 font-mono text-[10px]" style={{ borderColor: LINE, color: DIM }}>
                            {c.iri}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <Note>
              ※ 근거등급: <b style={{ color: INK }}>{s.conf.level} · 신뢰도 상한 {s.conf.pct}%</b> — <Body t={s.conf.why} />
            </Note>

            {!!s.limits.length && (
              <div className="mb-2 pl-1 text-[11.5px] leading-relaxed">
                {s.limits.map((x, j) => (
                  <div key={j} style={{ color: DIM }}>
                    - <Body t={x} />
                  </div>
                ))}
              </div>
            )}

            {s.blocked && (
              <div className="mb-2 rounded border-l-[3px] px-2.5 py-1.5 text-[11px]" style={{ borderColor: '#dc2626', background: '#fef2f2' }}>
                <b style={{ color: '#991b1b' }}>규칙이 실행 전에 막은 질의</b> — “{s.blocked.q}”
                <div className="mt-0.5" style={{ color: DIM }}>
                  {s.blocked.why.replace(/\*\*/g, '')}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ── 붙임 ── */}
        {!!secs.length && (
          <>
            <div className="mt-5 rounded px-3 py-2.5" style={{ background: '#f9fafb', border: `1px solid ${LINE}` }}>
              <div className="mb-1 text-[12px] font-bold" style={{ color: NAVY }}>
                붙임
              </div>
              <ol className="ml-4 list-decimal text-[11.5px] leading-relaxed" style={{ color: DIM }}>
                <li>이 보고서가 답하지 못한 것 — {limits.length}건 (아래)</li>
                <li>규칙이 실행 전에 막은 질의 — {blocked.length}건 (아래)</li>
                <li>재현 정보 — 문법 버전 · 그래프 규모 · 검증 소요 (아래)</li>
              </ol>
            </div>

            <div className="mt-3 border-l-[3px] px-2 py-1 text-[12px] font-bold" style={{ borderColor: NAVY, background: BAND, color: NAVY }}>
              붙임 1. 이 보고서가 답하지 못한 것
            </div>
            <div className="mt-1.5 mb-2 text-[11px]" style={{ color: DIM }}>
              데이터로 답할 수 없는 것을 적지 않으면, 읽는 사람은 답한 범위를 실제보다 넓게 이해합니다.
            </div>
            <div className="mb-2 pl-1 text-[11.5px] leading-relaxed">
              {limits.map((x, i) => (
                <div key={i} style={{ color: DIM }}>
                  ○ <Body t={x} />
                </div>
              ))}
            </div>

            {!!blocked.length && (
              <>
                <div className="mt-3 border-l-[3px] px-2 py-1 text-[12px] font-bold" style={{ borderColor: NAVY, background: BAND, color: NAVY }}>
                  붙임 2. 규칙이 실행 전에 막은 질의
                </div>
                <div className="mt-1.5 mb-1.5 text-[11px]" style={{ color: DIM }}>
                  답을 만들어 낸 뒤 걸러낸 것이 아니라 <b style={{ color: INK }}>실행하기 전에</b> 막았습니다.
                </div>
                <div className="mb-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[11px]">
                    <thead>
                      <tr>
                        {['막힌 질의', '사유'].map((h) => (
                          <th key={h} className="border px-1.5 py-1 font-bold text-white" style={{ borderColor: LINE, background: NAVY }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {blocked.map((s, i) => (
                        <tr key={i} style={{ background: i % 2 ? '#f9fafb' : '#fff' }}>
                          <td className="border px-1.5 py-1" style={{ borderColor: LINE, width: '34%' }}>
                            {s.blocked!.q}
                          </td>
                          <td className="border px-1.5 py-1 break-keep" style={{ borderColor: LINE, color: DIM }}>
                            {s.blocked!.why.replace(/\*\*/g, '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-3 border-l-[3px] px-2 py-1 text-[12px] font-bold" style={{ borderColor: NAVY, background: BAND, color: NAVY }}>
              붙임 3. 재현 정보
            </div>
            <table className="mt-1.5 mb-2 w-full border-collapse text-[11px]">
              <tbody>
                {[
                  ['문법 버전', currentVersion()],
                  ['검증 시각', `${clock(gate.at)} (시뮬레이션 시각)`],
                  ['그래프 규모', `노드 ${gate.graph.subjects}개 · 트리플 ${gate.graph.triples}개`],
                  ['적재 검증', `${gate.ms}ms · 위반으로 하류에서 제외된 레코드 ${gate.held.size}건`],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td className="border px-2 py-1 font-bold" style={{ borderColor: LINE, background: '#f3f4f6', color: NAVY, width: '22%' }}>
                      {r[0]}
                    </td>
                    <td className="border px-2 py-1" style={{ borderColor: LINE }}>
                      {r[1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Note>
              ※ 격리 <b style={{ color: INK }}>0건</b>이 곧 «데이터가 깨끗하다»는 뜻은 아닙니다 — 검사를 실제로 돌렸는지 함께 확인해야 합니다.
            </Note>

            {/* ── 결재란 ── */}
            <table className="mt-5 w-full border-collapse text-[11.5px]">
              <tbody>
                <tr>
                  {['작성자', '검토자', '승인자'].map((h) => (
                    <td key={h} className="border px-2 py-1 text-center font-bold" style={{ borderColor: LINE, background: '#f3f4f6', color: NAVY }}>
                      {h}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border px-2 py-5 text-center text-[11px]" style={{ borderColor: LINE, color: DIM }}>
                    {roleOf(role).ko}
                  </td>
                  <td className="border px-2 py-5" style={{ borderColor: LINE }} />
                  <td className="border px-2 py-5" style={{ borderColor: LINE }} />
                </tr>
              </tbody>
            </table>
            <div className="mt-2 text-[10.5px]" style={{ color: DIM }}>
              ※ 본 문서는 Qdrive 온톨로지가 <b style={{ color: INK }}>그래프에서 자동 조립</b>한 초안이며, 담당자 검토·결재 후 확정됩니다. 문장의 모든
              수치는 위 노드 식별자(IRI)로 되짚을 수 있습니다.
            </div>
          </>
        )}
      </div>

      {/* ── 꼬리말 ── */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-t px-6 py-2.5 text-[10px]" style={{ borderColor: LINE, background: '#f9fafb', color: DIM }}>
        <span>대구광역시 버스운영과 · 대구광역시 중구 공평로 88</span>
        <span>
          작성 {clock(gate.at)} · {docNo}
        </span>
      </div>
    </div>
  )
}
