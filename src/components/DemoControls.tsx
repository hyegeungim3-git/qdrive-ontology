import { engine } from '../sim/store'
import type { SimSnapshot } from '../sim/types'
import { simClock } from './ui'

const SPEEDS = [1, 5, 20, 60]

/**
 * 데모 컨트롤 — 배속과 이벤트 트리거만.
 * 온톨로지의 인스턴스 수는 엔진 실집계라, 배속을 올리면 관측·판정·성과·조치가 실제로 늘어난다.
 */
export default function DemoControls({ snap }: { snap: SimSnapshot }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 max-[640px]:min-h-[40px] font-mono text-sm text-emerald-400">{simClock(snap.simTime)}</span>

      <div className="flex overflow-hidden rounded-md border border-gray-800">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => engine.setSpeed(s)}
            className={`px-2 py-1 max-[640px]:min-h-[40px] text-xs font-semibold transition-colors ${
              snap.speedMultiplier === s ? 'bg-pink-500 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
            title="배속 — 올리면 관측·판정·성과 인스턴스가 실제로 늘어납니다"
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        onClick={() => engine.togglePause()}
        className="whitespace-nowrap rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 max-[640px]:min-h-[40px] text-xs font-semibold text-gray-300 hover:text-gray-100"
      >
        {snap.running ? '⏸ 일시정지' : '▶ 재생'}
      </button>

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-dashed border-gray-800 px-2 py-1">
        <span className="mr-0.5 text-[10px] font-semibold text-gray-600">시연</span>
        <button
          onClick={() => engine.triggerRiskEvent()}
          className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 max-[640px]:min-h-[40px] text-[11px] font-bold text-red-300 hover:bg-red-500/20"
          title="위험운전 발생 → 관측·판정·조치가 함께 늘어납니다"
        >
          ⚡ 급감속
        </button>
        <button
          onClick={() => engine.triggerFault()}
          className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 max-[640px]:min-h-[40px] text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
          title="고장 징후 → 고장 예측(판정)·예지정비(조치)"
        >
          🔧 고장
        </button>
        <button
          onClick={() => engine.fileComplaint()}
          className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 max-[640px]:min-h-[40px] text-[11px] font-bold text-violet-300 hover:bg-violet-500/20"
          title="민원 접수 → 민원 사실 판정"
        >
          📢 민원
        </button>
        <button
          onClick={() => engine.forceRecommendation()}
          className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 max-[640px]:min-h-[40px] text-[11px] font-bold text-sky-300 hover:bg-sky-500/20"
          title="배차 권고 생성 → 조치"
        >
          🚌 배차
        </button>
        <button
          onClick={() => engine.cycleWeather()}
          className="rounded border border-gray-700 bg-gray-800/60 px-1.5 py-0.5 max-[640px]:min-h-[40px] text-[11px] font-bold text-gray-300 hover:text-gray-100"
          title="날씨 전환 → 운행 맥락"
        >
          ☀️ 날씨
        </button>
      </div>
    </div>
  )
}
