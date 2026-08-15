import { useEffect, useRef, useState } from 'react'
import { KpiCard } from './components/ui'
import DemoControls from './components/DemoControls'
import { toggleTheme, useTheme } from './theme'
import { useSim } from './sim/store'
import ActiveMeta from './ontology/ActiveMeta'
import Chain from './ontology/Chain'
import Export, { FORMAT_COUNT } from './ontology/Export'
// 파일명 주의: 컴포넌트를 Grammar.tsx로 두면 저장소 grammar.ts와 Windows에서 충돌한다 (TS1149)
import Grammar from './ontology/GrammarView'
import Impact from './ontology/Impact'
import Live from './ontology/Live'
// 파일명 주의: 컴포넌트를 Quarantine.tsx로 두면 저장소 quarantine.ts와 Windows에서 충돌한다 (TS1149)
import Quarantine from './ontology/QuarantineView'
import Release from './ontology/Release'
import Compare from './ontology/Compare'
import { currentVersion, useDraft, useGrammar } from './ontology/grammar'
import Simulator from './ontology/Simulator'
import StdAlign from './ontology/StdAlign'
import SpaceGraph from './ontology/SpaceGraph'
import Validator from './ontology/Validator'
import { LEVERS, META_EDGES, SPACES } from './ontology/meta'
import { qStats, useQuarantine } from './ontology/quarantine'
import { runGate } from './ontology/gate'
import Catalog from './ontology/CatalogView'
import Guide from './ontology/Guide'
import AgentChat from './ontology/AgentChat'
import { ROLES, setRole, useRole } from './ontology/policy'
import type { Jump, Preset, StepId } from './ontology/nav'
import type { FaultId } from './ontology/rdf'
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
    // 화면이 14개가 되면서 첫인상이 «패널이 많다»가 됐다. 진입로를 앞에 둔다.
    ko: '안내', desc: '처음이면 여기부터',
    steps: [{ id: 'guide', n: '⓪', label: '시작하기', desc: '전체 흐름 한눈에' }],
  },
  {
    ko: '정의', desc: '무엇을 무엇과 잇는가',
    steps: [
      { id: 'spaces', n: '①', label: '데이터 자리', desc: '데이터가 놓이는 9개 자리' },
      { id: 'grammar', n: '②', label: '연결 규칙', desc: '허용된 연결만 만든다' },
      { id: 'standards', n: '③', label: '국제 표준', desc: '표준에 맞추고 받아온다' },
      { id: 'validator', n: '④', label: '규칙 시험', desc: '정말 막히는지 눌러보기' },
    ],
  },
  {
    ko: '활용', desc: '그래서 무엇에 쓰나',
    steps: [
      { id: 'chain', n: '⑤', label: '근거 따라가기', desc: '이 숫자가 어디서 왔나' },
      { id: 'sim', n: '⑥', label: '조치와 효과', desc: '조치하면 얼마나 좋아지나' },
      { id: 'impact', n: '⑦', label: '변경 영향', desc: '바꾸면 어디까지 번지나' },
    ],
  },
  {
    ko: '운영', desc: '어떻게 관리하나',
    steps: [
      { id: 'meta', n: '⑧', label: '데이터 설명서', desc: '출처·품질·권한 12가지' },
      { id: 'live', n: '⑨', label: '규칙 검사', desc: '진짜 막히는지 돌려본다' },
      { id: 'quarantine', n: '⑩', label: '막힌 데이터', desc: '누가 어떻게 풀어 주나' },
    ],
  },
  {
    ko: '개정', desc: '규칙을 고친다',
    steps: [
      { id: 'release', n: '⑪', label: '새 버전 내기', desc: '고친 규칙을 실제 적용' },
      { id: 'compare', n: '⑫', label: '버전 비교', desc: '무엇이 달라졌나' },
      { id: 'export', n: '⑬', label: '파일로 받기', desc: `표준 형식 ${FORMAT_COUNT}가지` },
    ],
  },
  {
    // 화면 번호는 뒤에 붙인다 — 원문자가 코드 주석에서 목록 기호로도 쓰여
    // 기존 번호를 밀면 «⑨ 실검증»이 «⑩»으로 조용히 바뀐 것처럼 보이는 자리가 100군데 넘는다.
    ko: '공급', desc: 'AI가 받아 쓰도록',
    steps: [{ id: 'catalog', n: '⑭', label: '데이터 목록', desc: '무엇이 있고 어디서 왔나' }],
  },
] as const

const PLATFORM = 'https://hyegeungim3-git.github.io/qdrive-unified/'

/**
 * 화면마다 «이 화면은 무엇에 답하나»를 한 문장으로.
 *
 * 각 화면은 저마다 정직하게 만들었지만, 처음 여는 사람에게는 패널 제목만으로 무엇을 보는지
 * 알기 어려웠다. 화면 안에 흩어 놓지 않고 **한 곳에서 관리**한다 — 문구가 갈라지지 않게.
 */
const ASKS: Record<string, string> = {
  guide: '데이터가 어디로 들어와서 어디로 나가는지 한 장으로 봅니다.',
  spaces: '우리 데이터는 어떤 자리에 놓이나요? 9개 자리와 실제 연결을 봅니다.',
  grammar: '어떤 연결을 만들 수 있나요? 그중 시간이 흐르면 바뀌는 연결은 무엇인가요?',
  standards: '우리 용어가 국제 표준의 어디에 해당하나요? 표준 데이터를 받아올 수도 있나요?',
  validator: '이 연결이 정말 막히는지 직접 눌러서 확인해 보세요.',
  chain: '이 점수는 왜 이 숫자인가요? 성과에서 원본 기록까지 거꾸로 따라갑니다.',
  sim: '조치를 하면 성과가 얼마나 좋아지나요? 실제로 조치를 내려볼 수도 있습니다.',
  impact: '규칙 하나를 바꾸면 어느 화면까지 영향을 받나요?',
  meta: '데이터를 설명하는 데이터입니다. 출처·품질·권한을 누가 관리하나요?',
  live: '규칙이 진짜로 막는지 봅니다. 일부러 잘못된 데이터를 넣어 보세요.',
  quarantine: '막힌 데이터는 어디로 가고, 누가 풀어 주나요?',
  release: '규칙을 고쳐서 새 버전을 내보냅니다. 내보내면 다른 화면의 답도 바뀝니다.',
  compare: '이전 버전과 무엇이 달라졌나요?',
  export: `이 구조를 다른 곳에 넘기려면? ${FORMAT_COUNT}가지 파일로 내려받습니다.`,
  catalog: '어떤 데이터가 있고, 어디서 왔고, 얼마나 믿을 만한가요?',
}

/** 그룹을 펼친 평평한 순서 — 이전/다음 이동과 «몇 번째»에 쓴다.
    GROUPS가 as const라 flatMap이 좁은 유니온으로 추론된다 → 타입을 명시한다. */
type Step = { id: StepId; n: string; label: string; desc: string }
const FLAT: Step[] = GROUPS.flatMap((g) => g.steps as readonly Step[])

export default function App() {
  const snap = useSim()
  const theme = useTheme()
  /* 에이전트는 «온톨로지를 들여다보는» 스튜디오와 성격이 달라 화면 흐름에 끼우지 않고 **따로** 뒀다.
     발주처가 실제로 쓰게 될 모습이 이쪽이다. */
  const [agentMode, setAgentMode] = useState(false)
  const [step, setStep] = useState<StepId>('guide')
  const stepIx = FLAT.findIndex((x) => x.id === step)
  const cur = FLAT[stepIx]
  const prev = stepIx > 0 ? FLAT[stepIx - 1] : null
  const next = stepIx >= 0 && stepIx < FLAT.length - 1 ? FLAT[stepIx + 1] : null
  // 화면 이동 시 조건까지 들고 간다. seq는 같은 화면으로 다시 넘어와도 프리셋이 다시 먹게 하는 리마운트 키.
  const [preset, setPreset] = useState<Preset>({})
  // ⑨에서 주입한 결함은 ⑩을 다녀와도 유지된다
  const [faults, setFaults] = useState<Set<FaultId>>(new Set())
  // 결함을 바꾸면 게이트를 즉시 다시 돌린다 — 하류 숫자가 바로 따라와야 «막았다»가 사실이 된다
  const applyFaults = (f: Set<FaultId>) => {
    setFaults(f)
    faultsRef.current = f
    void runGate(snapRef.current, f)
  }
  // ①의 메타/인스턴스 뷰도 마찬가지 — ⑤로 넘어갔다 돌아오면 보던 그래프가 남아 있어야 한다
  const [spaceView, setSpaceView] = useState<'meta' | 'instance'>('meta')
  const [seq, setSeq] = useState(0)
  const jump: Jump = (s, p) => {
    setPreset(p ?? {})
    setSeq((n) => n + 1)
    setStep(s)
  }

  /**
   * 온톨로지 적재 게이트를 주기적으로 돌린다 — 이 앱의 데이터 흐름이 여기를 지난다.
   * 250ms 스냅샷마다 돌리면 검증(약 100ms)이 CPU를 먹으므로 3초 간격(마이크로배치).
   * 실서비스의 적재 파이프라인도 같은 성격이다 — 순서가 같고 규모만 다르다.
   */
  const snapRef = useRef(snap)
  snapRef.current = snap
  const faultsRef = useRef<Set<FaultId>>(new Set())
  useEffect(() => {
    void runGate(snapRef.current, faultsRef.current)
    const t = setInterval(() => void runGate(snapRef.current, faultsRef.current), 3000)
    return () => clearInterval(t)
  }, [])

  const role = useRole()
  const held = qStats(useQuarantine()).held
  // 발행하면 문법 정의 자체가 바뀐다 — 화면이 옛 정의를 들고 있으면 안 되므로 통째로 다시 그린다
  const gv = `${currentVersion()}·${useGrammar().length}`
  const draftCount = useDraft().length
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
          {/* 누가 보고 있는가 — 규정이 막는 대상이 정해져야 규정이 작동한다 */}
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap text-[10px] font-semibold text-gray-600">보는 사람</span>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                title={`${r.org} · ${r.basis}`}
                className={`whitespace-nowrap rounded-md border px-2 py-1 max-[640px]:min-h-[40px] text-[11px] font-bold focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  role === r.id ? 'border-amber-400/60 bg-amber-400/15 text-amber-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
                }`}
              >
                {r.ko}
              </button>
            ))}
          </div>
          <DemoControls snap={snap} />
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`whitespace-nowrap rounded-md border px-2.5 py-1 max-[640px]:min-h-[40px] text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
              agentMode
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
            }`}
            title="온톨로지 위에서 도는 AI 에이전트 — 채팅·에이전트 두 형태"
          >
            {agentMode ? '← 스튜디오로' : '🤖 AI 에이전트'}
          </button>
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
            className="whitespace-nowrap rounded-md border border-gray-800 bg-gray-900 px-2.5 max-[640px]:min-h-[40px] py-1 text-xs font-semibold text-gray-300 hover:text-gray-100"
            title="라이트/다크 모드 전환"
          >
            {theme === 'dark' ? '☀️ 밝게' : '🌙 다크'}
          </button>
        </div>
      </header>

      {agentMode ? (
        <main className="flex-1 space-y-4 p-4">
          <AgentChat />
        </main>
      ) : (
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
            문법 {currentVersion()} · 9 스페이스 · 관계 {relations}종
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

        {/* 단계가 늘 때마다 가로 스크롤이 길어지지 않게, 그룹 단위로 줄바꿈한다.
            폭은 단계 수에 비례시킨다 — 균등 분배하면 단계가 많은 그룹의 라벨이 잘린다. */}
        <div className="flex flex-wrap gap-3">
          {GROUPS.map((g) => (
            <div key={g.ko} className="min-w-0" style={{ flexGrow: g.steps.length, flexBasis: g.steps.length * 152 }}>
                <div className="mb-1 flex items-baseline gap-1.5 px-0.5">
                  <span className="text-[11px] font-black text-pink-300">{g.ko}</span>
                  <span className="truncate text-[10.5px] text-gray-600">{g.desc}</span>
                </div>
                {/* 좁은 화면에서는 그룹이 한 줄을 통째로 쓰므로 2열로 접는다 — 4열이면 한글 라벨이 잘린다.
                    단계가 하나뿐인 그룹은 1열로 둔다 — 2열로 두면 버튼이 절반 폭만 받아 라벨이 잘린다. */}
                <div
                  className={`grid gap-2 ${g.steps.length === 1 ? 'grid-cols-1' : 'max-[640px]:grid-cols-2'} ${
                    g.steps.length === 4 ? 'grid-cols-4' : g.steps.length === 3 ? 'grid-cols-3' : 'grid-cols-1'
                  }`}
                >
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
                          {s.id === 'quarantine' && held > 0 && (
                            <span className="ml-auto shrink-0 rounded-full border border-rose-400/50 bg-rose-400/15 px-1.5 text-[10px] font-black tabular-nums text-rose-300">
                              {held}
                            </span>
                          )}
                          {s.id === 'release' && draftCount > 0 && (
                            <span className="ml-auto shrink-0 rounded-full border border-emerald-400/50 bg-emerald-400/15 px-1.5 text-[10px] font-black tabular-nums text-emerald-300">
                              {draftCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[10.5px] leading-tight text-gray-500">{s.desc}</div>
                      </button>
                    )
                  })}
                </div>
            </div>
          ))}
        </div>

        {/* 화면마다 «이 화면은 무엇에 답하나»를 한 줄로. 처음 여는 사람은 패널 제목만으로는 모른다. */}
        <div className="flex items-center gap-2 rounded-xl border border-pink-400/25 bg-pink-400/[0.07] px-4 py-2.5">
          <span className="shrink-0 text-[15px] font-black text-pink-300">{cur?.n}</span>
          <span className="shrink-0 text-[13.5px] font-bold text-gray-100">{cur?.label}</span>
          <span className="break-keep text-[12px] leading-relaxed text-gray-400">{ASKS[step] ?? ''}</span>
        </div>

        <div key={gv}>
          {step === 'guide' && <Guide jump={jump} />}
          {step === 'spaces' && <SpaceGraph snap={snap} onGoto={jump} view={spaceView} setView={setSpaceView} />}
          {step === 'grammar' && <Grammar />}
          {step === 'standards' && <StdAlign />}
          {step === 'validator' && <Validator key={`v${seq}`} preset={preset.validator} />}
          {step === 'chain' && <Chain key={`c${seq}`} snap={snap} preset={preset.chain} />}
          {step === 'sim' && <Simulator snap={snap} jump={jump} />}
          {step === 'impact' && <Impact key={`i${seq}`} preset={preset.impact} />}
          {step === 'meta' && <ActiveMeta onGoto={jump} />}
          {step === 'live' && <Live key={`l${seq}`} snap={snap} onGoto={jump} faults={faults} setFaults={applyFaults} preset={preset.live} />}
          {step === 'quarantine' && <Quarantine snap={snap} onGoto={jump} />}
          {step === 'release' && <Release snap={snap} onGoto={jump} />}
          {step === 'compare' && <Compare onGoto={jump} />}
          {step === 'export' && <Export />}
          {step === 'catalog' && <Catalog jump={jump} />}
        </div>

        {/* 화면을 순서대로 훑을 수 있게. 어디까지 봤는지도 함께 보인다. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => prev && setStep(prev.id as StepId)}
            disabled={!prev}
            className="flex-1 rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5 text-left transition-colors hover:border-gray-700 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <div className="text-[10.5px] text-gray-600">← 이전</div>
            <div className="truncate text-[12.5px] font-bold text-gray-300">{prev ? `${prev.n} ${prev.label}` : '처음입니다'}</div>
          </button>
          <span className="shrink-0 rounded-lg bg-gray-800/60 px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-gray-400">
            {FLAT.findIndex((x) => x.id === step) + 1} / {FLAT.length}
          </span>
          <button
            onClick={() => next && setStep(next.id as StepId)}
            disabled={!next}
            className="flex-1 rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5 text-right transition-colors hover:border-gray-700 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <div className="text-[10.5px] text-gray-600">다음 →</div>
            <div className="truncate text-[12.5px] font-bold text-gray-300">{next ? `${next.n} ${next.label}` : '마지막입니다'}</div>
          </button>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12.5px] leading-relaxed text-gray-500">
          🧭 <b className="text-gray-300">왜 규칙을 먼저 정할까요?</b> 데이터가 늘 때마다 용어를 새로 만들면, 나중에 다른 도시나 다른 회사
          데이터와 합칠 수 없습니다. 자리와 연결을 먼저 정해 두면 새 데이터는 <b className="text-gray-300">기존 자리에 꽂기만</b> 하면 됩니다.{' '}
          <a href={PLATFORM} target="_blank" rel="noreferrer" className="text-sky-400 underline-offset-2 hover:underline">
            운영 플랫폼
          </a>
          의 커넥터·계보와 같은 구조를 의미 층에서 한 번 더 지키는 것입니다.
        </div>
      </main>
      )}
    </div>
  )
}
