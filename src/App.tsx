import { useState } from 'react'
import { KpiCard } from './components/ui'
import DemoControls from './components/DemoControls'
import { toggleTheme, useTheme } from './theme'
import { useSim } from './sim/store'
import ActiveMeta from './ontology/ActiveMeta'
import Chain from './ontology/Chain'
import Export from './ontology/Export'
import Grammar from './ontology/Grammar'
import Impact from './ontology/Impact'
import Live from './ontology/Live'
import Simulator from './ontology/Simulator'
import StdAlign from './ontology/StdAlign'
import SpaceGraph from './ontology/SpaceGraph'
import Validator from './ontology/Validator'
import { LEVERS, META_EDGES, SPACES } from './ontology/meta'
import { fmt } from './ontology/util'

/**
 * Qdrive Ontology — 대구 시내버스 데이터의 의미 구조를 다루는 독립 도구.
 *
 * 운영 플랫폼(qdrive-unified)이 "데이터가 어떻게 들어오고 어떤 화면이 되나"를 다룬다면,
 * 여기는 "그 데이터가 무엇을 뜻하고 무엇을 움직이나"를 다룬다.
 *
 * 핵심 사슬:  관측 ─뒷받침→ 판정 ─반영→ 성과 ←올림─ 조치
 */

const GROUPS = [
  {
    ko: '정의', desc: '무엇이 무엇과 어떻게 연결되나',
    steps: [
      { id: 'spaces', n: '①', label: '스페이스', desc: '데이터가 서 있는 9개 자리' },
      { id: 'grammar', n: '②', label: '관계 문법', desc: '허용된 관계만 만든다' },
      { id: 'standards', n: '③', label: '표준 정렬', desc: '국제 표준 어디에 붙나' },
      { id: 'validator', n: '④', label: '문법 검증', desc: '정말 막히는지 눌러보기' },
    ],
  },
  {
    ko: '활용', desc: '그래서 무엇에 쓰나',
    steps: [
      { id: 'chain', n: '⑤', label: '근거 사슬', desc: '이 숫자가 어디서 왔나' },
      { id: 'sim', n: '⑥', label: '조치 시뮬레이션', desc: '손잡이를 당기면 성과가' },
      { id: 'impact', n: '⑦', label: '영향 분석', desc: '바꾸면 어디까지 흔들리나' },
    ],
  },
  {
    ko: '운영', desc: '어떻게 관리하고 넘기나',
    steps: [
      { id: 'meta', n: '⑧', label: '액티브 메타데이터', desc: '값에 대한 값 4계층 12속성' },
      { id: 'live', n: '⑨', label: 'SHACL 실검증', desc: '제약을 실제로 돌려본다' },
      { id: 'export', n: '⑩', label: '내보내기', desc: 'JSON-LD · OWL · SHACL' },
    ],
  },
] as const
type StepId = 'spaces' | 'grammar' | 'standards' | 'validator' | 'chain' | 'sim' | 'impact' | 'meta' | 'live' | 'export'

const PLATFORM = 'https://hyegeungim3-git.github.io/qdrive-unified/'

export default function App() {
  const snap = useSim()
  const theme = useTheme()
  const [step, setStep] = useState<StepId>('spaces')

  const typeCount = SPACES.reduce((n, s) => n + s.types.length, 0)
  const instances = SPACES.reduce((n, s) => n + s.types.reduce((m, t) => m + t.count(snap), 0), 0)
  const relations = new Set(META_EDGES.flatMap((e) => e.relations)).size
  const targets = LEVERS.reduce((n, l) => n + l.targets.length, 0)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-gray-950 px-5 py-2.5">
        <div className="whitespace-nowrap">
          <div className="text-lg font-black tracking-tight text-gray-50">
            Q<span className="text-pink-400">drive</span>
            <span className="ml-2 text-[11px] font-bold tracking-widest text-pink-300">ONTOLOGY</span>
          </div>
          <div className="text-[10px] text-gray-500">대구 시내버스 데이터의 의미 구조 — 스페이스 · 문법 · 조치 시뮬레이션</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DemoControls snap={snap} />
          <a
            href={PLATFORM}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:text-gray-100"
            title="Qdrive 운영 플랫폼 데모"
          >
            🔗 운영 플랫폼
          </a>
          <button
            onClick={toggleTheme}
            className="whitespace-nowrap rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:text-gray-100"
            title="라이트/다크 모드 전환"
          >
            {theme === 'dark' ? '☀️ 밝게' : '🌙 다크'}
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.2em] text-pink-400">META ONTOLOGY</div>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-gray-50">🧭 온톨로지 스튜디오</h2>
            <p className="mt-1 max-w-3xl break-keep text-[12.5px] leading-relaxed text-gray-400">
              운행 데이터가 <b className="text-gray-200">무엇을 뜻하고 무엇을 움직이나</b>를 다룹니다. 관측 → 판정 → 성과 ← 조치의 사슬을 문법으로 못
              박고, 그 관계를 따라 "이 조치를 당기면 성과가 얼마나 움직이는가"와 "이걸 바꾸면 어디까지 흔들리나"까지 계산합니다. 수치는 내장 시뮬레이터
              엔진의 실집계 — 배속을 올리면 실제로 늘어납니다.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-pink-400/30 bg-pink-400/10 px-2.5 py-1 text-[11px] font-bold text-pink-300">
            문법 v1.0 · 9 스페이스
          </span>
        </div>

        <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[720px]:grid-cols-2">
          <button onClick={() => setStep('spaces')} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
            <KpiCard label="스페이스" value="9" unit="개" sub={`노드 타입 ${typeCount}종`} accent="text-pink-400" />
          </button>
          <button onClick={() => setStep('spaces')} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
            <KpiCard label="인스턴스" value={fmt(instances)} unit="개" sub="엔진 실집계 · 배속 반영" accent="text-sky-400" />
          </button>
          <button onClick={() => setStep('grammar')} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
            <KpiCard label="관계 어휘" value={`${relations}`} unit="종" sub={`${META_EDGES.length}개 방향에만 허용`} accent="text-emerald-400" />
          </button>
          <button onClick={() => setStep('sim')} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
            <KpiCard label="조치 → 성과" value={`${LEVERS.length}`} unit="개 조치" sub={`성과 연결 ${targets}건 · 시뮬레이션 가능`} accent="text-amber-400" />
          </button>
          <button onClick={() => setStep('chain')} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
            <KpiCard label="근거 사슬 · 영향" value="4단" unit="역추적" sub="관측→판정→성과 · I1~I7 전파" accent="text-violet-400" />
          </button>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex min-w-[1180px] gap-3">
            {GROUPS.map((g) => (
              <div key={g.ko} className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-1.5 px-0.5">
                  <span className="text-[11px] font-black text-pink-300">{g.ko}</span>
                  <span className="truncate text-[10.5px] text-gray-600">{g.desc}</span>
                </div>
                <div className={`grid gap-2 ${g.steps.length === 4 ? 'grid-cols-4' : g.steps.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {g.steps.map((s) => {
                    const on = step === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStep(s.id)}
                        className={`rounded-xl border px-2.5 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          on ? 'border-pink-400/60 bg-pink-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`text-[13px] font-black ${on ? 'text-pink-300' : 'text-gray-600'}`}>{s.n}</span>
                          <span className={`truncate text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{s.label}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10.5px] leading-tight text-gray-500">{s.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {step === 'spaces' && <SpaceGraph snap={snap} />}
        {step === 'grammar' && <Grammar />}
        {step === 'standards' && <StdAlign />}
        {step === 'validator' && <Validator />}
        {step === 'chain' && <Chain snap={snap} />}
        {step === 'sim' && <Simulator snap={snap} />}
        {step === 'impact' && <Impact />}
        {step === 'meta' && <ActiveMeta />}
        {step === 'live' && <Live snap={snap} />}
        {step === 'export' && <Export />}

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
          🧭 <b className="text-gray-300">왜 문법을 먼저 정하나</b> — 데이터가 늘어날 때 관계 어휘를 그때그때 만들면, 나중에 다른 도시·다른 사업자
          데이터와 합칠 수 없습니다. 스페이스와 관계를 먼저 못 박아 두면 새 원천은 <b className="text-gray-300">기존 자리에 꽂기만</b> 하면 됩니다.{' '}
          <a href={PLATFORM} target="_blank" rel="noreferrer" className="text-sky-400 underline-offset-2 hover:underline">
            운영 플랫폼
          </a>
          의 커넥터·계보와 같은 구조를 의미 층에서 한 번 더 지키는 것입니다.
        </div>
      </main>
    </div>
  )
}
