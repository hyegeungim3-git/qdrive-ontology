import { useState } from 'react'
import { Emph } from '../components/ui'
import { BUSES, CHANNELS, INTAKE_TONE, SENS_TONE, dailyVolume, sensorStats, type Bus, type Intake } from './sensors'

/**
 * 수집 항목 — ③ 국제 표준의 다섯 번째 탭.
 *
 * 「무엇을 수집합니까」에 목록으로 답하는 화면. 다만 목록만 길게 적으면
 * «많이 모은다»는 인상만 남고 **정작 중요한 것을 못 본다.** 그래서 세 가지를 함께 보인다.
 *
 *  1. **지금 받는 것 / 아직 안 받는 것** — 격차를 숨기지 않는다
 *  2. **왜 안 받는지** — 실단말이 없어서인지, 규정이 막아서인지는 완전히 다른 문제다
 *  3. **주기** — 1초 채널 하나가 200대면 하루 수백만 건이다. 「수집한다」와 「1초마다」는 설계가 다르다
 */
export default function SensorView() {
  const [bus, setBus] = useState<Bus | '전체'>('전체')
  const [only, setOnly] = useState<Intake | '전체'>('전체')
  const st = sensorStats()
  const vol = dailyVolume()

  const rows = CHANNELS.filter((c) => (bus === '전체' || c.bus === bus) && (only === '전체' || c.intake === only))

  return (
    <div className="space-y-3">
      <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
        시내버스 한 대가 실제로 만들어 내는 데이터입니다. 무엇을 받을 수 있고, 그중{' '}
        <b className="text-gray-200">무엇을 지금 받고 있고, 무엇을 아직 안 받는지</b>를 한 곳에 적었습니다. 이 표의 값어치는 «많이 적었다»가
        아니라 <b className="text-gray-200">격차를 숨기지 않는 데</b> 있습니다.
      </div>

      <div className="grid grid-cols-5 gap-2 max-[900px]:grid-cols-2">
        {[
          { n: String(st.total), ko: '수집 항목', sub: `${st.buses}개 계통`, c: '#e5e7eb' },
          { n: String(st.linked), ko: '지금 연결됨', sub: '그래프에 들어가 있다', c: INTAKE_TONE['수집·연결'] },
          { n: String(st.pending), ko: '엔진엔 있는데 미연결', sub: '연결하면 바로 늘어난다', c: INTAKE_TONE['수집·미연결'] },
          { n: String(st.needDevice), ko: '실단말 필요', sub: '실차 연동 시 들어온다', c: INTAKE_TONE['실단말 필요'] },
          { n: String(st.blocked), ko: '규정상 보류', sub: '기술이 아니라 법의 문제', c: INTAKE_TONE['규정상 보류'] },
        ].map((k) => (
          <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
            <div className="text-xl font-black tabular-nums" style={{ color: k.c }}>
              {k.n}
            </div>
            <div className="mt-0.5 text-[12px] font-bold text-gray-300">{k.ko}</div>
            <div className="text-[11px] text-gray-600">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#38bdf833', background: '#38bdf80d' }}>
        <div className="text-[12px] font-black text-sky-300">주기가 규모를 정합니다</div>
        <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
          1초 주기 채널이 <b className="text-gray-200">{vol.perSecondChannels}개</b>입니다. 차량 {vol.vehicles}대가 하루 {vol.hours}시간
          운행하면 <b className="text-sky-300 tabular-nums">{vol.perDay.toLocaleString()}건</b>이 쌓입니다.{' '}
          <b className="text-gray-300">「수집한다」와 「1초마다 수집한다」는 저장·검증 설계가 완전히 다릅니다.</b> 그래서 주기를 항목마다 함께
          적었습니다.
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['전체', ...BUSES] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBus(b as Bus | '전체')}
            className={`rounded-md px-2 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
              bus === b ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {b}
            <span className="ml-1 text-[10px] text-gray-600">{b === '전체' ? CHANNELS.length : CHANNELS.filter((c) => c.bus === b).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {(['전체', '수집·연결', '수집·미연결', '실단말 필요', '규정상 보류'] as const).map((i) => (
          <button
            key={i}
            onClick={() => setOnly(i as Intake | '전체')}
            className={`rounded-md px-2 py-1 max-[640px]:min-h-[40px] text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
              only === i ? 'ring-1' : 'bg-gray-800/40 text-gray-500 hover:text-gray-300'
            }`}
            style={only === i ? { color: i === '전체' ? '#e5e7eb' : INTAKE_TONE[i as Intake], background: `${i === '전체' ? '#e5e7eb' : INTAKE_TONE[i as Intake]}1a` } : undefined}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-[12px]">
          <thead className="text-[11px] text-gray-500">
            <tr className="border-b border-gray-800">
              <th className="py-2 pr-3 font-semibold">항목</th>
              <th className="py-2 pr-3 font-semibold">계통</th>
              <th className="py-2 pr-3 font-semibold">단위 · 범위</th>
              <th className="py-2 pr-3 font-semibold">주기</th>
              <th className="py-2 pr-3 font-semibold">민감도</th>
              <th className="py-2 pr-3 font-semibold">상태</th>
              <th className="py-2 pr-3 font-semibold">무엇에 쓰나</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/60 align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-bold text-gray-100">{c.ko}</div>
                  <div className="font-mono text-[10px] text-gray-600">{c.id}</div>
                </td>
                <td className="py-1.5 pr-3 text-[11.5px] text-gray-500">{c.bus}</td>
                <td className="py-1.5 pr-3 text-[11.5px] text-gray-400">
                  {c.unit ?? '—'}
                  {c.range && <div className="text-[10.5px] text-gray-600">{c.range}</div>}
                </td>
                <td className="py-1.5 pr-3 text-[11.5px] tabular-nums text-gray-400">{c.hz}</td>
                <td className="py-1.5 pr-3">
                  <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: SENS_TONE[c.sens], background: `${SENS_TONE[c.sens]}1a` }}>
                    {c.sens}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-black" style={{ color: INTAKE_TONE[c.intake], background: `${INTAKE_TONE[c.intake]}1a` }}>
                    {c.intake}
                  </span>
                  {c.to && <div className="mt-0.5 text-[10.5px] text-emerald-400/80">→ {c.to}</div>}
                </td>
                <td className="py-1.5 pr-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
                  <Emph t={c.use} cls="text-gray-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#f43f5e33', background: '#f43f5e0d' }}>
          <div className="text-[12px] font-black text-rose-300">다 모을 수 있다고 다 모으는 것이 아닙니다</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            운전자 상태 감시(졸음·시선)와 실내 영상은 <b className="text-gray-200">기술적으로 가장 쉽고 법적으로 가장 어렵습니다.</b> 개인에 대한
            상시 감시라 별도 동의와 목적 제한이 필요합니다. 교통카드 태그는 개인 이동 이력이 되므로 집계값만 받고 원본은 받지 않습니다. 이
            판단은 화면이 아니라 <b className="text-gray-200">규정 스페이스</b>가 들고 있고, SHACL이 실제로 막습니다.
          </div>
        </div>
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#fbbf2433', background: '#fbbf240d' }}>
          <div className="text-[12px] font-black text-amber-300">정시율이 아직 「미측정」인 이유</div>
          <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
            정류장 <b className="text-gray-200">실제 도착 시각</b>과 <b className="text-gray-200">운행 계획 시각</b> 둘 다 있어야 정시성을 잽니다.
            지금은 둘 다 없습니다. 관측을 아무리 늘려도 이 둘이 없으면 정시율은 만들 수 없습니다 —{' '}
            <b className="text-gray-300">그래서 숫자를 지어내지 않고 「미측정」으로 둡니다.</b> 무엇이 더 필요한지가 이 표에 적혀 있습니다.
          </div>
        </div>
      </div>
    </div>
  )
}
