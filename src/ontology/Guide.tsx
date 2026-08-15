import { Panel } from '../components/ui'
import { useGate } from './gate'
import { useLineage } from './lineage'
import { currentVersion } from './grammar'
import { useQuarantine } from './quarantine'
import { roleOf, useRole } from './policy'
import { POLICY_VALIDITY, clock, policyActive } from './validity'
import { missionStats } from './missions'
import { integrationStats } from './integrations'
import IntegrationView from './IntegrationView'
import type { Jump, StepId } from './nav'
import { Connections, Pipeline } from './Flow'

/**
 * ⓪ 시작하기 — 처음 여는 사람이 3분 안에 「이게 무엇이고 어떻게 도는가」를 잡게 하는 화면.
 *
 * 화면이 14개가 되면서 첫인상이 «패널이 많다»가 됐다. 각 화면은 저마다 정직하게 만들었지만,
 * **어떤 순서로 봐야 하는지**를 아무도 말해 주지 않았다. 그래서 여기에 셋을 둔다.
 *  1) 데이터가 어디서 들어와 어디로 나가는지 **한 장 흐름도**
 *  2) 지금 이 순간의 상태 — 흐름도가 그림이 아니라 실제로 돌고 있다는 증거
 *  3) **누구냐에 따라 다른 추천 경로** — 발주처 담당자와 개발자가 볼 것은 다르다
 *
 * 안내 화면은 «설명»이 아니라 «진입로»여야 한다. 그래서 모든 항목이 눌러서 이동한다.
 */

/* ── 추천 경로 ── */
type Tour = { who: string; why: string; c: string; steps: { n: string; id: StepId; ko: string; what: string }[] }

const TOURS: Tour[] = [
  {
    who: '처음 보는 분',
    why: '3분이면 이 도구가 무엇인지 알 수 있습니다',
    c: '#f472b6',
    steps: [
      { n: '①', id: 'spaces', ko: '데이터 자리', what: '데이터가 놓이는 9개 자리를 봅니다. “연결된 데이터”로 바꾸면 실제 연결선이 보입니다' },
      { n: '⑤', id: 'chain', ko: '근거 따라가기', what: '“안전점수 72점은 왜 72인가?”에 답합니다. 이 도구가 있는 이유입니다' },
      { n: '⑨', id: 'live', ko: '규칙 검사', what: '잘못된 데이터를 일부러 넣어 보세요. 규칙이 진짜로 막습니다' },
      { n: '⑩', id: 'quarantine', ko: '막힌 데이터', what: '막힌 것이 어디로 가고 누가 풀어 주는지 봅니다' },
      { n: '⑭', id: 'catalog', ko: '데이터 목록', what: '어떤 데이터가 있고, 어디서 왔고, 얼마나 믿을 만한지 봅니다' },
    ],
  },
  {
    who: '발주처 · 사업 담당',
    why: '“진짜 되나요?”와 “우리 데이터는 어떻게 넣나요?”에 답합니다',
    c: '#38bdf8',
    steps: [
      { n: '③', id: 'standards', ko: '국제 표준', what: 'DTG·GTFS·BIS 실제 데이터를 넣어 우리 형식으로 바꾸고 검사까지 해 봅니다' },
      { n: '⑥', id: 'sim', ko: '조치와 효과', what: '조치하면 성과가 얼마나 좋아지는지 보고, 실제로 조치를 내려 봅니다' },
      { n: '⑦', id: 'impact', ko: '변경 영향', what: '규칙 하나를 바꾸면 어느 화면까지 영향을 받는지 봅니다' },
      { n: '⑬', id: 'export', ko: '파일로 받기', what: '실서비스 대응표, 감사 기록, AI용 설명 파일을 내려받습니다' },
    ],
  },
  {
    who: '데이터 · 개발 담당',
    why: '규칙이 어디서 나와서 어디에 적용되는지 따라갑니다',
    c: '#34d399',
    steps: [
      { n: '②', id: 'grammar', ko: '연결 규칙', what: '만들 수 있는 연결과, 시간이 지나면 바뀌는 연결을 구분합니다' },
      { n: '④', id: 'validator', ko: '규칙 시험', what: '연결을 눌러 왜 막히는지 확인합니다. 만들 수 있는 조합은 전체의 1.4%뿐입니다' },
      { n: '⑧', id: 'meta', ko: '데이터 설명서', what: '출처·품질·권한 12가지와, 누가 무엇을 볼 수 있는지의 표' },
      { n: '⑪', id: 'release', ko: '새 버전 내기', what: '고칠 내용을 담아 새 버전을 내면 ④·⑤·⑨의 답이 실제로 바뀝니다' },
      { n: '⑫', id: 'compare', ko: '버전 비교', what: '이전 버전과 새 버전을 나란히 놓고 봅니다' },
    ],
  },
]

export default function Guide({ jump }: { jump: Jump }) {
  const gate = useGate()
  const runs = useLineage()
  const queue = useQuarantine()
  const role = useRole()
  const held = queue.filter((q) => q.status === '격리').length
  const pending = POLICY_VALIDITY.filter((p) => !policyActive(p.id, gate.at))
  const ms = missionStats()
  const ints = integrationStats()

  return (
    <div className="space-y-3">
      <Panel
        title="이 도구는 무엇을 하나 — 데이터가 들어와서 서비스로 나가기까지"
        right={<span className="text-[11px] text-gray-500">누르면 그 화면으로</span>}
      >
        <div className="break-keep text-[13px] leading-relaxed text-gray-300">
          버스 운행 데이터가 <b className="text-gray-100">무슨 뜻인지, 무엇을 바꾸는지</b> 보여주는 도구입니다.
          <br />
          흐름은 하나입니다. <b className="text-pink-300">기록하고 → 판단하고 → 성과가 바뀌고 → 조치로 되돌립니다.</b> 이 흐름을 규칙으로 정해 두면
          <b className="text-gray-100"> “AI가 왜 그렇게 판단했나”</b>에 답할 수 있습니다.
        </div>

        <div className="mt-3">
          <Pipeline jump={jump} />
        </div>

        {/* 흐름도만 보면 «한 줄로 지나간다»로 읽힌다. 실제 연결이 몇 개인지를 바로 아래에 붙인다. */}
        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-3">
          <div className="mb-1 text-[11.5px] font-black tracking-wide text-gray-400">데이터가 얼마나 연결돼 있나</div>
          <Connections jump={jump} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
          {[
            ['1. 들어올 때 검사합니다', '남의 용어로 온 데이터를 우리 용어로 바꾸고, 규칙에 맞는지 봅니다. 안 맞으면 들여보내지 않습니다.'],
            ['2. 통과한 것만 씁니다', '막힌 데이터는 점수와 집계에서 실제로 빠집니다. 잘못된 데이터를 넣어 보면 숫자가 바로 움직입니다.'],
            ['3. 규칙도 고칠 수 있습니다', '같은 곳에서 자꾸 막히면 규칙이 현실과 안 맞는 것입니다. 고쳐서 새 버전을 내면 검사 결과가 달라집니다.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
              <div className="text-[12px] font-bold text-gray-100">{t}</div>
              <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">{d}</div>
            </div>
          ))}
        </div>
      </Panel>

      <IntegrationView />

      <Panel title="지금 이 순간" right={<span className="text-[11px] text-gray-500">그림이 아니라 실제로 돌고 있습니다</span>}>
        <div className="grid grid-cols-6 gap-2 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2">
          {[
            { n: String(gate.graph.subjects || 0), ko: '그래프 노드', sub: `트리플 ${gate.graph.triples || 0}`, c: '#34d399' },
            { n: String(runs.length), ko: '적재 실행', sub: gate.at ? clock(gate.at) : '대기 중', c: '#f472b6' },
            { n: String(gate.held.size), ko: '격리된 레코드', sub: '하류에서 빠짐', c: gate.held.size ? '#fb7185' : '#64748b' },
            { n: String(held), ko: '큐 보류', sub: '처리 대기', c: held ? '#fbbf24' : '#64748b' },
            { n: `${ints.linked}/${ints.total}`, ko: '연계 시스템', sub: `기관 ${ints.orgs}곳`, c: '#38bdf8' },
            { n: currentVersion(), ko: '문법 버전', sub: `${gate.ms}ms 검증`, c: '#c084fc' },
          ].map((k) => (
            <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
              <div className="text-xl font-black tabular-nums" style={{ color: k.c }}>
                {k.n}
              </div>
              <div className="mt-0.5 text-[11.5px] font-bold text-gray-300">{k.ko}</div>
              <div className="text-[10px] text-gray-600">{k.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 break-keep text-[11px] leading-relaxed text-gray-500">
          지금은 <b className="text-gray-300">“{roleOf(role).ko}”</b>로 보고 있습니다. 맨 위에서 역할을 바꾸면 볼 수 있는 것과 할 수 있는 일이
          실제로 달라집니다. 규정이 화면을 막는 것을 직접 확인해 보세요.
        </div>
        {!!pending.length && (
          <div className="mt-2 rounded-lg border px-3 py-2 break-keep text-[11px] leading-relaxed" style={{ borderColor: '#f59e0b44', background: '#f59e0b12', color: '#fcd34d' }}>
            ⏳ <b>{pending.map((p) => p.ko).join(' · ')}</b>이(가) 아직 시행 전입니다({clock(pending[0].from)} 시행). 그 규정에서 나오는 SHACL 제약은
            아직 생성되지 않습니다 — 배속을 올려 시행 시각을 지나면 같은 결함이 걸리기 시작합니다.
          </div>
        )}
      </Panel>

      {/* 「다 됩니다」로 끝나면 발주처가 안 믿는다. 아직 안 되는 것을 진입 화면에 먼저 적는다. */}
      <Panel title="아직 안 되는 것" right={<span className="text-[11px] text-gray-500">숨기지 않습니다</span>}>
        <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
          목적별 질문 <b className="text-gray-200">{ms.questions}개</b> 중 지금 답하는 것은{' '}
          <b className="text-emerald-400">{ms.ready}개</b>입니다. 나머지는 <b className="text-amber-300">부분 {ms.partial}</b> ·{' '}
          <b className="text-gray-400">못 함 {ms.no}</b>입니다.
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
          {[
            ['정시율', '정류장 실제 도착 시각과 운행 계획 시각이 둘 다 없습니다. 관측을 늘려도 이 둘 없이는 못 만듭니다.'],
            ['공차 · 결행', '운행 상태 구분과 계획 운행횟수가 없습니다. 센서가 아니라 배차 시스템 연계가 필요합니다.'],
            ['코칭 효과', '조치 전후 비교가 없어 「원래 좋아지던 중」과 못 가립니다.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border px-3 py-2" style={{ borderColor: '#f59e0b2b', background: '#f59e0b0a' }}>
              <div className="text-[12.5px] font-bold text-amber-200">{t}</div>
              <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">{d}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => jump('sim')}
          className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 max-[640px]:min-h-[40px] text-[12px] font-bold text-amber-300 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ⑥ 목적별 활용에서 «무엇이 있으면 되는지» 보기 →
        </button>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          못 하는 이유가 데이터가 없어서인지, 규칙이 없어서인지, 연계가 없어서인지는 완전히 다른 문제입니다.
          <b className="text-gray-400"> 발주처는 「다 됩니다」보다 「이건 되고, 이건 이게 있어야 됩니다」를 신뢰합니다.</b>
        </div>
      </Panel>

      <Panel title="어떤 순서로 보면 되나" right={<span className="text-[11px] text-gray-500">누르면 바로 이동</span>}>
        <div className="space-y-3">
          {TOURS.map((t) => (
            <div key={t.who}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="rounded px-1.5 py-0.5 text-[11px] font-black" style={{ color: t.c, background: `${t.c}1a` }}>
                  {t.who}
                </span>
                <span className="break-keep text-[10.5px] text-gray-500">{t.why}</span>
              </div>
              <div className="space-y-1">
                {t.steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => jump(s.id)}
                    className="flex w-full items-start gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-2 text-left transition-colors hover:border-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <span className="mt-px shrink-0 rounded px-1 py-0.5 text-[10px] font-black tabular-nums" style={{ color: t.c, background: `${t.c}1a` }}>
                      {i + 1}
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold text-gray-100">
                      {s.n} {s.ko}
                    </span>
                    <span className="break-keep text-[11.5px] leading-relaxed text-gray-500">{s.what}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <Panel title="꼭 눌러 볼 것 세 가지">
          <div className="space-y-2">
            {[
              ['⑨에서 잘못된 데이터를 넣어 보기', '“표준 밖 코드”를 켜면 규칙이 잡아내고, ⑩에 쌓이고, ⑭의 통과율이 떨어집니다. 한 번 누르면 세 화면이 같이 움직입니다.', 'live' as StepId],
              ['맨 위에서 역할 바꿔 보기', '“기사”로 바꾸면 자기 차량 1대만 보입니다. “데이터 책임자”는 기사 이름을 못 봅니다. 관리 권한이 열람 권한을 주지는 않습니다.', 'chain' as StepId],
              ['⑪에서 새 버전 내 보기', '고칠 내용을 담아 새 버전을 내면 ④의 답이 ❌에서 ✅로 바뀌고 ⑤의 근거가 늘어납니다. 이름만 바뀌는 게 아닙니다.', 'release' as StepId],
            ].map(([t, d, id]) => (
              <button
                key={t as string}
                onClick={() => jump(id as StepId)}
                className="w-full rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-left transition-colors hover:border-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <div className="text-[12px] font-bold text-gray-100">{t as string}</div>
                <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">{d as string}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="읽는 법 — 이 도구가 지키는 약속">
          <div className="space-y-1.5">
            {[
              ['숫자는 모두 실제 계산입니다', '미리 적어 둔 숫자가 없습니다. 맨 위에서 배속을 올리면 실제로 늘어납니다.'],
              ['모르는 것은 “모른다”고 적습니다', '정시율은 잴 방법이 없어서 값을 만들지 않았습니다. 빈칸을 숫자로 채우지 않습니다.'],
              ['근거가 약하면 신뢰도도 낮습니다', '직접 잰 값 95%, 환산한 값 85%, 추정한 값 70%, 의견 50%. 이 한도를 넘지 못합니다.'],
              ['불리한 결정은 자동으로 하지 않습니다', '감점을 확정하려면 사람이 승인해야 합니다. 규정이 코드로 막고 있습니다.'],
              ['빈칸을 먼저 보여 줍니다', '⑭에서 “데이터가 0건인 항목”을 맨 위에 적습니다. 전부 초록불인 목록은 대개 검사를 안 한 것입니다.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                <div className="text-[11.5px] font-bold text-gray-200">{t}</div>
                <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">{d}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="어려운 말 풀이" right={<span className="text-[11px] text-gray-500">이 도구에서만 쓰는 말</span>}>
        <div className="grid grid-cols-2 gap-2 max-[900px]:grid-cols-1">
          {[
            ['온톨로지', '데이터끼리 어떻게 이어지는지 정해 둔 “뜻의 지도”입니다. 용어와 연결 규칙을 미리 못 박아 둡니다.'],
            ['스페이스 (자리)', '데이터를 놓는 9개 칸입니다. 규정·자산·주체·관측·개념·판정·집단·성과·조치.'],
            ['관측 · 판정 · 성과 · 조치', '기록한 사실 → 그에 대한 판단 → 바뀐 숫자 → 되돌리는 행동. 이 순서가 이 도구의 뼈대입니다.'],
            ['SHACL', '데이터가 규칙에 맞는지 검사하는 국제 표준입니다. 안 맞으면 들여보내지 않습니다.'],
            ['적재 게이트 (검사대)', '데이터가 들어올 때 검사하는 자리입니다. 통과한 것만 점수와 집계에 씁니다.'],
            ['격리', '규칙에 안 맞아 통과하지 못한 데이터입니다. 지우지 않고 따로 모아 사람이 처리합니다.'],
            ['가명키', '기사 이름 대신 쓰는 임시 번호(D-001)입니다. 개인정보를 분리하려고 씁니다.'],
            ['리니지 (이력)', '이 데이터를 언제 무엇이 만들었는지의 기록입니다. “언제 것인지”를 알 수 있습니다.'],
          ].map(([w, d]) => (
            <div key={w} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
              <div className="text-[12.5px] font-bold text-gray-100">{w}</div>
              <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-500">{d}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
