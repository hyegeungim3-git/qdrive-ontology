import { useState } from 'react'
import { Panel } from '../components/ui'
import type { SimSnapshot } from '../sim/types'
import { ROUTES } from '../sim/routes'
import { spaceOf } from './meta'

/**
 * ⑥ 근거 사슬 — "이 숫자는 어디서 왔나"를 역추적한다.
 *
 * 성과(안전점수) ←반영된다─ 판정(감점/정당) ←뒷받침한다─ 관측(위험운전 패킷)
 *                  ↑올린다                                   ↑맥락
 *              조치(코칭·상황설명)                        맥락(날씨)
 *
 * 온톨로지가 있어야 되는 이유가 여기서 눈에 보인다 — 어떤 수치든 원 패킷까지 거슬러 갈 수 있다.
 */

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  const s = Math.floor(sec) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
const shortId = (id: string) => id.slice(-4) + '호'

export default function Chain({ snap }: { snap: SimSnapshot }) {
  const [vid, setVid] = useState<string | null>(null)
  const v = snap.vehicles.find((x) => x.id === vid) ?? snap.vehicles[0]
  if (!v) return <Panel title="근거 사슬">엔진이 아직 차량을 만들지 않았습니다.</Panel>

  const route = ROUTES.find((r) => r.id === v.routeId)
  const events = snap.events.filter((e) => e.vehicleId === v.id)
  const justified = events.filter((e) => e.justified)
  const deducted = events.filter((e) => !e.justified)
  const pleas = snap.pleas.filter((p) => p.vehicleId === v.id)
  const trips = snap.trips.filter((t) => t.vehicleId === v.id)
  const byType = [...new Set(deducted.map((e) => e.eventType))].map((t) => ({ t, n: deducted.filter((e) => e.eventType === t).length }))

  const S = {
    outcome: spaceOf('outcome'),
    claim: spaceOf('claim'),
    evidence: spaceOf('evidence'),
    lever: spaceOf('lever'),
    ctx: spaceOf('concept'),
    policy: spaceOf('policy'),
  }

  /** 방어 문장 — 실데이터로 조립 */
  const sentence =
    `${shortId(v.id)}(${v.driverName} 기사)의 안전점수 ${Math.round(v.score)}점은 ` +
    (deducted.length > 0
      ? `${byType.map((b) => `${b.t} ${b.n}건`).join(' · ')}의 감점 판정이 반영된 값입니다. `
      : '오늘 감점 판정이 없습니다. ') +
    (justified.length > 0 ? `그중 ${justified.length}건은 방어운전으로 인정돼 감점이 복원됐습니다. ` : '') +
    (events.length > 0 ? `근거 패킷은 ${events.slice(0, 3).map((e) => clock(e.simTime)).join(' · ')}에 기록돼 있습니다.` : '')

  return (
    <div className="space-y-3">
      <Panel title="대상 선택 — 어느 차량의 점수를 되짚을까" right={<span className="text-[11px] text-gray-500">실증 {snap.vehicles.length}대</span>}>
        <div className="flex flex-wrap gap-1.5">
          {snap.vehicles.map((x) => {
            const on = x.id === v.id
            return (
              <button
                key={x.id}
                onClick={() => setVid(x.id)}
                className={`rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  on ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="text-[12px] font-bold">{shortId(x.id)}</div>
                <div className="text-[10.5px] opacity-75">
                  {x.driverName} · {Math.round(x.score)}점
                </div>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title={`근거 사슬 — ${shortId(v.id)} 안전점수 ${Math.round(v.score)}점`}
        right={<span className="text-[11px] text-gray-500">오른쪽에서 왼쪽으로 읽으면 "왜"가 나옵니다</span>}
      >
        <div className="grid grid-cols-[1.1fr_1fr_1.1fr] gap-2 max-[1000px]:grid-cols-1">
          {/* 성과 */}
          <Step space={S.outcome} title="성과" rel="이 숫자가 결과">
            <div className="text-center">
              <div className="text-3xl font-black tabular-nums" style={{ color: S.outcome.color }}>
                {Math.round(v.score)}
                <span className="ml-1 text-sm font-bold text-gray-500">점</span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">안전점수 · {v.driverName}</div>
            </div>
            <Row k="경제운전" v={`${Math.round(v.ecoScore)}점`} />
            <Row k="주행" v={`${v.distanceKm.toFixed(1)}km`} />
            <Row k="회차" v={`${trips.length}회`} />
          </Step>

          {/* 판정 */}
          <Step space={S.claim} title="판정" rel="← 반영된다">
            {events.length === 0 ? (
              <Empty>오늘 판정이 없습니다</Empty>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3">
                  <Big n={deducted.length} label="감점" color="#fb7185" />
                  <Big n={justified.length} label="정당 인정" color="#34d399" />
                </div>
                <div className="mt-1.5 space-y-1">
                  {byType.slice(0, 4).map((b) => (
                    <Row key={b.t} k={b.t} v={`${b.n}건 감점`} />
                  ))}
                </div>
                {justified.length > 0 && (
                  <div className="mt-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10.5px] leading-relaxed text-emerald-300">
                    정당 인정 {justified.length}건 — 감점이 복원됐습니다
                  </div>
                )}
              </>
            )}
          </Step>

          {/* 관측 */}
          <Step space={S.evidence} title="관측" rel="← 뒷받침한다">
            {events.length === 0 ? (
              <Empty>기록된 패킷이 없습니다</Empty>
            ) : (
              <div className="space-y-1">
                {events.slice(0, 5).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/50 px-2 py-1">
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-gray-500">{clock(e.simTime)}</span>
                    <span className="text-[11.5px] font-bold text-gray-200">{e.eventType}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-gray-500">{Math.round(e.speedKmh)}km/h</span>
                    {e.justified && <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[9.5px] font-bold text-emerald-400">인정</span>}
                  </div>
                ))}
                {events.length > 5 && <div className="text-center text-[10.5px] text-gray-600">외 {events.length - 5}건</div>}
              </div>
            )}
          </Step>
        </div>

        {/* 개입 층 */}
        <div className="mt-2 grid grid-cols-3 gap-2 max-[1000px]:grid-cols-1">
          <Step space={S.lever} title="조치" rel="↑ 올린다 · 개입">
            <Row k="실시간 코칭" v={`${events.length}회 발화`} />
            <Row k="상황 설명" v={pleas.length > 0 ? `${pleas.length}건 (${pleas.filter((p) => p.status === '인정').length} 인정)` : '없음'} />
            <div className="mt-1 break-keep text-[10.5px] leading-relaxed text-gray-500">
              감지 즉시 코칭이 나가고, 기사가 설명하면 관제가 검토합니다.
            </div>
          </Step>
          <Step space={S.ctx} title="맥락" rel="판정 보정">
            <Row k="날씨" v={`${snap.weather.condition} ${snap.weather.tempC}℃`} />
            <Row k="노선" v={route?.name ?? '—'} />
            <Row k="앞차 간격" v={v.headway ? `${v.headway.frontGapMin.toFixed(1)}분 (${v.headway.status})` : '—'} />
            <div className="mt-1 break-keep text-[10.5px] leading-relaxed text-gray-500">
              같은 급감속도 폭우·정류장 접근이면 판정이 달라집니다.
            </div>
          </Step>
          <Step space={S.policy} title="규정" rel="판정 확정의 조건">
            <div className="rounded border border-red-500/25 bg-red-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-gray-300">
              <b className="text-red-400">불이익 결정 자동화 금지</b> — 이 점수가 평가·징계로 이어지는 확정은 담당자가 합니다.
            </div>
            <Row k="가명 처리" v="분석셋은 가명키" />
            <Row k="보존" v="원본 5년" />
          </Step>
        </div>

        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2.5">
          <div className="mb-1 text-[11px] font-bold text-sky-300">이 점수를 설명해야 한다면</div>
          <div className="break-keep text-[12.5px] leading-relaxed text-gray-200">{sentence}</div>
        </div>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          이 문장은 미리 써 둔 것이 아니라 <b className="text-gray-300">지금 데이터에서 사슬을 따라 조립된 것</b>입니다. 온톨로지가 없으면 안전점수는 그냥 숫자이고, 있으면 언제·무엇 때문에·어떻게 복원됐는지까지 따라갈 수 있습니다.
        </div>
      </Panel>
    </div>
  )
}

function Step({ space, title, rel, children }: { space: { ko: string; en: string; color: string }; title: string; rel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${space.color}44`, background: `${space.color}0d` }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-black" style={{ color: space.color }}>
          {title}
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-gray-500">{rel}</span>
      </div>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-800/50 py-1 last:border-0">
      <span className="shrink-0 text-[10.5px] text-gray-500">{k}</span>
      <span className="truncate text-right text-[11.5px] font-semibold text-gray-300">{v}</span>
    </div>
  )
}
function Big({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-black tabular-nums" style={{ color }}>
        {n}
      </div>
      <div className="text-[10.5px] text-gray-500">{label}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-4 text-center text-[11px] text-gray-600">{children}</div>
}
