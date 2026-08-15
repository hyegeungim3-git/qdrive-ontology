import { useState } from 'react'
import { ink } from './ink'
import { Panel } from '../components/ui'
import { Drawer, Sec } from './ui'
import {
  ACTIONS,
  FEEDBACK_MIN,
  clearAll,
  qStats,
  reopen,
  resolve,
  ruleChange,
  ruleFeedback,
  toAmendment,
  useQuarantine,
  validatorPreset,
  waiverBlock,
  type QAction,
  type QItem,
  type RuleFeedback,
} from './quarantine'
import { analyse } from './impactmeta'
import { addToDraft } from './grammar'
import { heldSummary, useGate } from './gate'
import { can, denyReason, roleOf, useRole } from './policy'
import { spaceOf } from './meta'
import type { SimSnapshot } from '../sim/types'
import type { Jump } from './nav'

/**
 * ⑩ 격리 큐 — SHACL이 잡은 레코드가 실제로 보류되는 곳.
 * 검증은 «막았다»로 끝나지 않는다. 막힌 레코드를 누가 어떻게 푸는지까지가 데이터 관리다.
 */

const PLATFORM_QUALITY = 'https://hyegeungim3-git.github.io/qdrive-unified/'

const STATUS_TONE: Record<string, string> = {
  격리: '#fb7185',
  재처리: '#38bdf8',
  '예외 승인': '#f59e0b',
  '원천 수정 요청': '#a78bfa',
}

const hhmm = (s: number) => `${String(Math.floor(s / 3600) + 5).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`

export default function Quarantine({ snap, onGoto }: { snap: SimSnapshot; onGoto: Jump }) {
  const list = useQuarantine()
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'held' | 'done'>('held')
  const [note, setNote] = useState('')
  const role = useRole()
  // 규정이 막는다 — 예외 승인은 아무나 못 한다
  const mayWaive = can(role, 'approveWaiver')
  const [who, setWho] = useState('관제 담당 1')

  const s = qStats(list)
  const open = list.find((i) => i.id === openId) ?? null
  const shown = list.filter((i) => (tab === 'held' ? i.status === '격리' : i.status !== '격리'))
  const block = open ? waiverBlock(open) : undefined

  const act = (a: QAction) => {
    if (!open) return
    resolve(open.id, a, snap.simTime, who, note.trim() || undefined)
    setNote('')
    setOpenId(null)
  }

  return (
    <div className="space-y-3">
      <Panel
        title="⑩ 품질 격리 큐 — 막힌 레코드는 어디로 가나"
        right={
          list.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-md border border-gray-700 bg-gray-900 px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              큐 비우기
            </button>
          )
        }
      >
        <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
          ⑨에서 걸린 레코드가 여기로 넘어옵니다. <b className="text-gray-200">격리는 삭제가 아닙니다</b> — 원본은 그대로 두고 하류(정제 저장소·분석셋)로만
          내려보내지 않습니다. 온톨로지가 있어서 한 가지를 더 할 수 있습니다:{' '}
          <b className="text-gray-200">이 레코드를 보류하면 어떤 성과가 흔들리는지</b>를 관계를 걸어 계산해 함께 보여줍니다.
        </p>

        <div className="grid grid-cols-4 gap-2 max-[820px]:grid-cols-2">
          {[
            { ko: '보류 중', v: s.held, sub: '하류로 안 내려감', tone: '#fb7185' },
            { ko: '처리 완료', v: s.done, sub: '재처리·승인·수정 요청', tone: '#6ee7b7' },
            { ko: '예외 불가', v: s.blocked, sub: '규정상 승인으로 못 푼다', tone: '#f59e0b' },
            // 성과 이름을 두 개 이어 붙이면 375px 카드에서 잘린다 — 하나만 적고 나머지는 세어서 보인다
            {
              ko: '영향받는 성과',
              v: s.outcomes.length,
              sub: s.outcomes.length ? `${s.outcomes[0]}${s.outcomes.length > 1 ? ` 외 ${s.outcomes.length - 1}` : ''}` : '없음',
              tone: '#38bdf8',
            },
          ].map((k) => (
            <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
              <div className="text-[10.5px] font-semibold text-gray-500">{k.ko}</div>
              <div className="text-[19px] font-black tabular-nums" style={{ color: ink(k.tone)}}>
                {k.v}
              </div>
              <div className="break-keep text-[11.5px] leading-snug text-gray-500">{k.sub}</div>
            </div>
          ))}
        </div>

        {list.length === 0 && (
          <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-6 text-center">
            <div className="text-[13px] font-bold text-gray-300">큐가 비어 있습니다</div>
            <div className="mt-1 break-keep text-[11.5px] text-gray-500">
              ⑨ SHACL 실검증에서 결함을 주입하면 걸린 레코드가 자동으로 이 큐에 쌓입니다.
            </div>
            <button
              onClick={() => onGoto('live')}
              className="mt-3 rounded-md border border-pink-400/50 bg-pink-400/15 px-3 max-[640px]:min-h-[40px] py-1.5 text-[11.5px] font-bold text-pink-200 hover:bg-pink-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑨ 실검증으로 가기 →
            </button>
          </div>
        )}
      </Panel>

      {list.length > 0 && (
        <Panel
          title={<span>{tab === 'held' ? '보류 중인 레코드' : '처리 이력'}</span>}
          right={
            <div className="flex gap-1">
              {(
                [
                  ['held', `보류 ${s.held}`],
                  ['done', `처리 ${s.done}`],
                ] as const
              ).map(([k, ko]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-md border px-2 max-[640px]:min-h-[40px] py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    tab === k ? 'border-sky-400/50 bg-sky-400/15 text-sky-200' : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {ko}
                </button>
              ))}
            </div>
          }
        >
          {shown.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-5 text-center break-keep text-[12px] text-gray-500">
              {tab === 'held' ? '보류 중인 레코드가 없습니다 — 전부 처리됐습니다.' : '아직 처리한 레코드가 없습니다.'}
            </div>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[840px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                    <th className="py-1.5 pr-2 font-semibold">시각</th>
                    <th className="py-1.5 pr-2 font-semibold">레코드</th>
                    <th className="py-1.5 pr-2 font-semibold">걸린 규칙</th>
                    <th className="py-1.5 pr-2 font-semibold">보류 시 흔들리는 성과</th>
                    <th className="py-1.5 font-semibold">{tab === 'held' ? '조치' : '처리'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => (
                    <Row key={i.id} i={i} tab={tab} onOpen={() => setOpenId(i.id)} onReopen={() => reopen(i.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12.5px] leading-relaxed text-gray-500">
            🔗 <b className="text-gray-300">운영 플랫폼과의 관계</b> — 데이터 관리자의 품질 격리 큐는 룰별 <b className="text-gray-300">건수</b>를 다룹니다(6개
            룰 · 재처리 이력). 여기는 SHACL이 위반 노드를 정확히 지목하므로 <b className="text-gray-300">레코드 단위</b>로 다루고, 하류 영향을 관계로 계산합니다.
            둘은 같은 원칙 위에 있습니다 — 격리된 레코드는 버리지 않고, 원인을 고치면 재처리되며, 그 이력 자체가 관리의 근거가 됩니다.{' '}
            <a href={PLATFORM_QUALITY} target="_blank" rel="noreferrer" className="text-sky-400 underline-offset-2 hover:underline">
              운영 플랫폼 데이터 관리자
            </a>
          </div>
        </Panel>
      )}

      <Downstream />

      {s.done > 0 && <Feedback rows={ruleFeedback(list)} onGoto={onGoto} />}

      <Drawer
        open={!!open}
        onClose={() => {
          setOpenId(null)
          setNote('')
        }}
        title={open ? `${open.focusLabel || open.focus}` : ''}
        sub={open ? `${open.focus} · ${open.focusType} · sh:${open.constraint}` : ''}
      >
        {open && (
          <>
            <Sec t="왜 막혔나">
              <div className="rounded-lg border px-3 py-2 break-keep text-[12px] leading-relaxed text-rose-200" style={{ borderColor: '#fb718555', background: '#fb718514' }}>
                {open.message}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px]">
                <Chip>경로 {open.path}</Chip>
                <Chip>제약 sh:{open.constraint}</Chip>
                <Chip>{open.engine === 'JS' ? '보조 검사' : 'SHACL 엔진'}</Chip>
                <Chip>격리 {hhmm(open.at)}</Chip>
              </div>
            </Sec>

            <Sec t="보류하면 흔들리는 성과" right={<span className="text-[11px] text-gray-500">관계를 걸어 계산</span>}>
              {open.downstream.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {open.downstream.map((d) => (
                    <span key={d} className="rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[11.5px] font-semibold text-sky-200">
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 break-keep text-[11.5px] text-gray-500">
                  이 레코드에서 성과까지 닿는 경로가 없습니다 — 보류해도 지표는 흔들리지 않습니다.
                </div>
              )}
            </Sec>

            {open.status === '격리' ? (
              <>
                <Sec t="처리">
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">
                    확정 담당자
                    <input
                      value={who}
                      onChange={(e) => setWho(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-[12px] text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </label>
                  <label className="mb-2 block text-[11px] font-semibold text-gray-400">
                    사유 <span className="text-gray-600">(예외 승인은 필수)</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="무엇을 근거로 이렇게 처리했는지 — 감사 때 이 문장이 근거가 됩니다"
                      className="mt-1 w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-[12px] text-gray-100 placeholder:text-gray-600 focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </label>

                  {block && (
                    <div
                      className="mb-2 rounded-lg border px-3 py-2 break-keep text-[12.5px] leading-relaxed text-amber-300"
                      style={{ borderColor: '#f59e0b55', background: '#f59e0b14' }}
                    >
                      ⛔ <b>예외 승인 불가</b> — {block}
                    </div>
                  )}
                  {!mayWaive && (
                    <div
                      className="mb-2 rounded-lg border px-3 py-2 break-keep text-[12.5px] leading-relaxed text-amber-300"
                      style={{ borderColor: '#f59e0b55', background: '#f59e0b14' }}
                    >
                      🔒 <b>«{roleOf(role).ko}» 역할에는 예외 승인 권한이 없습니다</b> — {denyReason(role, 'approveWaiver')}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {ACTIONS.map((a) => {
                      const blocked = (a.id === '예외 승인' && !!block) || !mayWaive
                      const needNote = a.needsNote && !note.trim()
                      const off = blocked || needNote || !who.trim()
                      return (
                        <button
                          key={a.id}
                          onClick={() => act(a.id)}
                          disabled={off}
                          title={!mayWaive ? denyReason(role, 'approveWaiver') : blocked ? block : needNote ? '사유를 적어야 승인할 수 있습니다' : undefined}
                          className="w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
                          style={{ borderColor: `${a.tone}55`, background: `${a.tone}12` }}
                        >
                          <div className="text-[12.5px] font-bold" style={{ color: ink(a.tone)}}>
                            {a.ko}
                          </div>
                          <div className="break-keep text-[11px] leading-snug text-gray-400">{a.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </Sec>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 break-keep text-[11px] leading-relaxed text-gray-500">
                  처리해도 <b className="text-gray-300">원본 레코드는 지워지지 않습니다.</b> 상태와 담당자·사유만 붙습니다 — 나중에 「왜 이게 통과했나」를
                  물었을 때 답할 수 있어야 하기 때문입니다.
                </div>
              </>
            ) : (
              <Sec t="처리 결과">
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                  <div className="text-[12.5px] font-bold" style={{ color: ink(STATUS_TONE[open.status])}}>
                    {open.status}
                  </div>
                  <div className="mt-1 text-[11.5px] text-gray-400">
                    {open.decidedBy} · {open.doneAt !== undefined ? hhmm(open.doneAt) : '—'}
                  </div>
                  {open.note && <div className="mt-1.5 break-keep text-[12.5px] leading-relaxed text-gray-300">“{open.note}”</div>}
                </div>
                <button
                  onClick={() => {
                    reopen(open.id)
                  }}
                  className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 max-[640px]:min-h-[40px] py-1.5 text-[11.5px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  다시 격리로 되돌리기
                </button>
              </Sec>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}

/**
 * 하류 반영 — 「격리하면 하류로 안 내려간다」의 증거.
 *
 * 이 문장은 오래 적혀만 있었고 실제로는 아무 숫자도 안 바뀌었다. 지금은 적재 게이트(gate.ts)가
 * 검증에 걸린 레코드를 하류 집계에서 빼고, **안전점수를 개념 스페이스의 감점 가중치로 다시 계산**한다.
 * 그래서 결함을 켜면 여기 숫자가 실제로 움직인다.
 */
function Downstream() {
  const g = useGate()
  const d = g.downstream
  const rows: { ko: string; raw: number; passed: number; unit: string }[] = [
    { ko: '위험운전 패킷', raw: d.events.raw, passed: d.events.passed, unit: '건' },
    { ko: '운행 회차', raw: d.trips.raw, passed: d.trips.passed, unit: '건' },
    { ko: '연료 소모', raw: d.fuelM3.raw, passed: d.fuelM3.passed, unit: 'm³' },
    { ko: 'CO₂', raw: d.co2Kg.raw, passed: d.co2Kg.passed, unit: 'kg' },
  ]
  const moved = rows.filter((r) => r.raw !== r.passed)
  const blocked = d.scores.filter((s) => s.blocked > 0)
  const gap = d.scores.filter((s) => Math.abs(s.ontology - s.engine) >= 0.1)

  return (
    <Panel
      title="하류 반영 — 격리하면 실제로 무엇이 빠지나"
      right={
        <span className="text-[11px] text-gray-500">
          게이트 {g.version} · {g.ms}ms · {g.graph.subjects}개 노드 검사
        </span>
      }
    >
      <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
        이 앱의 데이터는 <b className="text-gray-200">엔진 → 온톨로지 게이트 → 화면</b> 순으로 흐릅니다. 게이트에 걸린 레코드는 아래 집계에서 빠지고,{' '}
        <b className="text-gray-200">안전점수는 개념 스페이스의 감점 가중치로 다시 계산</b>됩니다 — 엔진이 준 점수는 단말 참고치입니다.
      </p>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
              <th className="py-1.5 pr-3 font-semibold">하류 집계</th>
              <th className="py-1.5 pr-3 text-right font-semibold">게이트 이전</th>
              <th className="py-1.5 pr-3 text-center font-semibold"> </th>
              <th className="py-1.5 pr-3 text-right font-semibold">하류로 내려간 값</th>
              <th className="py-1.5 font-semibold">판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ko} className="border-b border-gray-800/60">
                <td className="py-1.5 pr-3 font-semibold text-gray-300">{r.ko}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">
                  {r.raw} {r.unit}
                </td>
                <td className="py-1.5 pr-3 text-center text-gray-600">→</td>
                <td className={`py-1.5 pr-3 text-right font-bold tabular-nums ${r.raw !== r.passed ? 'text-rose-300' : 'text-gray-300'}`}>
                  {r.passed} {r.unit}
                </td>
                <td className="py-1.5 text-[11px]">
                  {r.raw !== r.passed ? (
                    <span className="font-bold text-rose-300">−{Math.round((r.raw - r.passed) * 10) / 10} 차단</span>
                  ) : (
                    <span className="text-gray-600">전부 통과</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(blocked.length > 0 || gap.length > 0) && (
        <div className="mt-3 -mx-1 overflow-x-auto px-1">
          <div className="mb-1 text-[11px] font-black text-gray-400">안전점수 — 온톨로지가 계산한 확정값</div>
          <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                <th className="py-1.5 pr-3 font-semibold">차량</th>
                <th className="py-1.5 pr-3 text-right font-semibold">단말 참고치</th>
                <th className="py-1.5 pr-3 text-right font-semibold">온톨로지 확정</th>
                <th className="py-1.5 pr-3 text-right font-semibold">감점에 쓴 패킷</th>
                <th className="py-1.5 font-semibold">격리로 빠진 패킷</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set([...blocked, ...gap])].slice(0, 8).map((s) => (
                <tr key={s.vehicleId} className="border-b border-gray-800/60">
                  <td className="py-1.5 pr-3 font-semibold text-gray-300">{s.vehicleId}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500">{s.engine}</td>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-emerald-300">{s.ontology}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-400">{s.counted}</td>
                  <td className={`py-1.5 tabular-nums ${s.blocked > 0 ? 'font-bold text-rose-300' : 'text-gray-600'}`}>{s.blocked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {moved.length === 0 && blocked.length === 0 && (
        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] text-gray-500">
          지금은 막힌 레코드가 없어 게이트 앞뒤 값이 같습니다. ⑨에서 결함을 켜면 <b className="text-gray-300">이 표의 숫자가 실제로 줄어듭니다</b> —
          그게 「하류로 안 내려간다」의 증거입니다.
        </div>
      )}

      <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11px] leading-relaxed text-gray-500">
        ⓘ <b className="text-gray-300">두 가지를 그대로 밝힙니다.</b> ① 패킷이 격리되면 <b className="text-gray-400">그 차량의 점수는 오릅니다</b> — 감점의
        근거가 사라졌기 때문입니다. 「근거 없는 판정은 만들지 않는다」의 결과이지 점수를 봐주는 것이 아닙니다. ② 단말 참고치와 온톨로지 확정값이 벌어지는
        것은 계산 창이 다르기 때문입니다 — 단말은 운행 시작부터 누적하고, 온톨로지는{' '}
        <b className="text-gray-400">그래프에 올라온 최근 관측 구간</b>만 셉니다. 실서비스에서는 집계 구간을 규정으로 못 박아야 하는 지점입니다.
      </div>

      {g.held.size > 0 && (
        <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-3">
          <div className="text-[11.5px] font-black text-rose-200">하류로 못 내려간 레코드 {g.held.size}건</div>
          <div className="mt-1.5 space-y-0.5">
            {heldSummary(g)
              .slice(0, 6)
              .map((h) => (
                <div key={h.iri} className="break-keep text-[11px] text-gray-400">
                  <span className="font-mono text-gray-300">{h.iri}</span> {h.label && <span className="text-gray-500">· {h.label}</span>}{' '}
                  <span className="text-gray-600">— 끊긴 연결: {h.via}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

const VERDICT_TONE: Record<RuleFeedback['verdict'], string> = {
  '규칙 재검토': '#fb7185',
  '커넥터 점검': '#a78bfa',
  '원천 점검': '#38bdf8',
  '관찰 중': '#6b7280',
}

/**
 * 규칙 역제안 — 큐가 문법에게 말을 건다.
 * 여기까지 와야 고리가 닫힌다: 문법이 데이터를 막고, 막힌 이력이 문법을 고치자고 제안한다.
 */
function Feedback({ rows, onGoto }: { rows: RuleFeedback[]; onGoto: Jump }) {
  const live = rows.filter((r) => r.verdict !== '관찰 중')
  const [openKey, setOpenKey] = useState<string | null>(null)
  return (
    <Panel
      title="규칙 역제안 — 큐가 문법에게 말을 건다"
      right={<span className="text-[11px] text-gray-500">처리 {FEEDBACK_MIN}건 이상 같은 방향이면 진단</span>}
    >
      <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
        같은 규칙이 계속 <b className="text-gray-200">예외 승인</b>으로 풀린다면, 틀린 것은 데이터가 아니라 규칙일 수 있습니다.{' '}
        <b className="text-gray-200">처리 방식의 분포가 곧 진단</b>입니다 — 예외 승인이 많으면 규칙을, 재처리가 많으면 원천을, 원천 수정 요청이 많으면
        커넥터를 봐야 합니다.
      </p>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[820px] border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
              <th className="py-1.5 pr-2 font-semibold">규칙</th>
              <th className="py-1.5 pr-2 text-right font-semibold">격리</th>
              <th className="py-1.5 pr-2 text-right font-semibold">재처리</th>
              <th className="py-1.5 pr-2 text-right font-semibold">예외 승인</th>
              <th className="py-1.5 pr-2 text-right font-semibold">수정 요청</th>
              <th className="py-1.5 pr-2 font-semibold">진단</th>
              <th className="py-1.5 font-semibold">제안</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-gray-800/60 align-top">
                <td className="py-1.5 pr-2">
                  <div className="whitespace-nowrap font-mono text-[11px] text-violet-300">
                    sh:{r.constraint} <span className="text-sky-300">{r.path}</span>
                  </div>
                  <div className="break-keep text-[10.5px] text-gray-600">{r.spaces.join(' · ')}</div>
                </td>
                <Num v={r.held} />
                <Num v={r.reprocessed} tone="#38bdf8" />
                <Num v={r.waived} tone="#f59e0b" />
                <Num v={r.sourceFix} tone="#a78bfa" />
                <td className="py-1.5 pr-2">
                  <span
                    className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-black"
                    style={{
                      color: ink(VERDICT_TONE[r.verdict]),
                      background: `${VERDICT_TONE[r.verdict]}1f`,
                      border: `1px solid ${VERDICT_TONE[r.verdict]}55`,
                    }}
                  >
                    {r.verdict}
                  </span>
                  {r.protectedBy && <div className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-amber-400">규정 보호</div>}
                </td>
                <td className="py-1.5 break-keep text-gray-400">
                  {r.suggestion}
                  {r.notes.length > 0 && (
                    <div className="mt-1 border-l-2 border-gray-700 pl-2 text-[11.5px] leading-relaxed text-gray-500">
                      담당자 사유: {r.notes.map((n) => `“${n}”`).join(' · ')}
                    </div>
                  )}
                  {r.verdict === '규칙 재검토' && (
                    <>
                      <button
                        onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                        aria-expanded={openKey === r.key}
                        className="mt-1.5 rounded-md border border-rose-400/40 bg-rose-400/10 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        {openKey === r.key ? '▾' : '▸'} 이렇게 고치면 무엇이 흔들리나
                      </button>
                      {openKey === r.key && <RippleOfFix r={r} onGoto={onGoto} />}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12.5px] leading-relaxed text-gray-500">
        ⚖️ <b className="text-gray-300">완화하면 안 되는 규칙은 제외합니다</b> — 「불이익 결정 자동화 금지」·「가명 처리」처럼 규정에서 온 규칙은 예외가
        쌓여도 «규칙 재검토»로 올리지 않습니다. 예외가 많다는 건 그 규칙이 틀렸다는 뜻이 아니라{' '}
        <b className="text-gray-300">현실을 고쳐야 한다는 뜻</b>이기 때문입니다. 그렇지 않으면 이 화면 자체가 규정을 무력화하는 통로가 됩니다.
        {live.length === 0 && (
          <div className="mt-1.5 text-gray-500">
            지금은 진단으로 올라온 규칙이 없습니다 — 같은 규칙을 {FEEDBACK_MIN}건 이상 같은 방식으로 처리하면 여기에 나타납니다.
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * 「고치자」와 「고치면 이만큼 흔들린다」를 같은 자리에 붙인다.
 * 규칙 완화 제안을 ⑦이 이해하는 «스페이스 × 변경 유형»으로 환산해 같은 전파 엔진에 넣는다 —
 * 별도 계산을 새로 만들면 ⑦과 답이 갈라진다.
 */
function RippleOfFix({ r, onGoto }: { r: RuleFeedback; onGoto: Jump }) {
  const [sent, setSent] = useState<'added' | 'dup' | null>(null)
  const ch = ruleChange(r)
  if (!ch) return null
  const a = analyse(ch.space, ch.change)
  const preset = validatorPreset(r)
  const amend = toAmendment(r)

  return (
    <div className="mt-1.5 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2.5">
      <div className="text-[11.5px] font-bold text-rose-200">
        제안하는 문법 변경 — {spaceOf(ch.space).ko} · {ch.ko}
      </div>
      <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-gray-400">{ch.note}</div>

      <div className="mt-2 space-y-1.5 text-[11px]">
        <Line label="영향 범주">
          <span className="flex flex-wrap gap-1">
            {a.ids.map((i) => (
              <span key={i.id} title={i.q} className="cursor-help rounded bg-gray-800 px-1.5 py-0.5 font-semibold text-gray-300">
                {i.id} {i.ko}
              </span>
            ))}
          </span>
        </Line>
        <Line label="전파 스페이스">
          <span className="text-gray-300">
            {spaceOf(ch.space).ko}
            {a.spaces.length > 0 && <span className="text-gray-500"> → {a.spaces.map((s) => spaceOf(s).ko).join(' · ')}</span>}
          </span>
        </Line>
        <Line label="흔들리는 화면">
          <span className="text-gray-300">{a.services.map((s) => s.name).join(' · ')}</span>
        </Line>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {amend && (
          <button
            onClick={() => {
              const ok = addToDraft(amend)
              setSent(ok ? 'added' : 'dup')
            }}
            className="rounded-md border border-emerald-400/50 bg-emerald-400/15 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {sent === 'added' ? '✓ 개정안에 담겼습니다' : sent === 'dup' ? '이미 담겨 있습니다' : '＋ 개정안에 담기'}
          </button>
        )}
        {sent && (
          <button
            onClick={() => onGoto('release')}
            className="rounded-md border border-gray-700 bg-gray-900 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ⑪ 문법 발행으로 →
          </button>
        )}
        <button
          onClick={() => onGoto('impact', { impact: { space: ch.space, change: ch.change } })}
          className="rounded-md border border-violet-400/40 bg-violet-400/10 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          ⑦ 영향 분석에서 자세히 →
        </button>
        {preset && (
          <button
            onClick={() => onGoto('validator', { validator: preset })}
            className="rounded-md border border-sky-400/40 bg-sky-400/10 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ④ 문법 검증에서 이 조합 눌러보기 →
          </button>
        )}
      </div>

      <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
        ⓘ 이 표는 ⑦ 영향 분석과 <b className="text-gray-400">같은 전파 엔진</b>으로 계산합니다 — 여기서만 쓰는 별도 계산을 만들면 두 화면의 답이
        갈라집니다.
      </div>
    </div>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className="w-[68px] shrink-0 font-semibold text-gray-500">{label}</span>
      {children}
    </div>
  )
}

function Num({ v, tone }: { v: number; tone?: string }) {
  return (
    <td className="py-1.5 pr-2 text-right font-bold tabular-nums" style={{ color: ink(v > 0 ? (tone ?? '#e5e7eb') : '#4b5563')}}>
      {v}
    </td>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-gray-800 bg-gray-900 px-1.5 py-0.5 font-mono text-gray-400">{children}</span>
}

function Row({ i, tab, onOpen, onReopen }: { i: QItem; tab: 'held' | 'done'; onOpen: () => void; onReopen: () => void }) {
  const block = waiverBlock(i)
  return (
    <tr className="border-b border-gray-800/60 align-top transition-colors hover:bg-gray-800/30">
      <td className="py-1.5 pr-2 whitespace-nowrap font-mono text-[11px] text-gray-500">{hhmm(i.at)}</td>
      <td className="py-1.5 pr-2">
        <button onClick={onOpen} className="text-left focus-visible:ring-2 focus-visible:ring-sky-500">
          <div className="font-mono text-[11px] text-gray-300">{i.focus}</div>
          <div className="break-keep text-[10.5px] text-gray-500">{i.focusLabel || i.focusType}</div>
        </button>
      </td>
      <td className="py-1.5 pr-2">
        <div className="whitespace-nowrap font-mono text-[11px] text-violet-300">
          sh:{i.constraint} <span className="text-sky-300">{i.path}</span>
        </div>
        {block && <div className="mt-0.5 break-keep text-[10.5px] font-semibold text-amber-400">⛔ 예외 승인 불가</div>}
      </td>
      <td className="py-1.5 pr-2">
        {i.downstream.length ? (
          <div className="flex flex-wrap gap-1">
            {i.downstream.slice(0, 3).map((d) => (
              <span key={d} className="whitespace-nowrap rounded bg-sky-400/10 px-1.5 py-0.5 text-[10.5px] text-sky-200">
                {d}
              </span>
            ))}
            {i.downstream.length > 3 && <span className="text-[10.5px] text-gray-500">+{i.downstream.length - 3}</span>}
          </div>
        ) : (
          <span className="text-[10.5px] text-gray-600">없음</span>
        )}
      </td>
      <td className="py-1.5">
        {tab === 'held' ? (
          <button
            onClick={onOpen}
            className="whitespace-nowrap rounded-md border border-sky-500/40 bg-sky-500/12 px-2 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            처리하기
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-black"
              style={{ color: ink(STATUS_TONE[i.status]), background: `${STATUS_TONE[i.status]}1f`, border: `1px solid ${STATUS_TONE[i.status]}55` }}
            >
              {i.status}
            </span>
            <span className="whitespace-nowrap text-[10.5px] text-gray-500">{i.decidedBy}</span>
            <button onClick={onReopen} className="whitespace-nowrap text-[10.5px] text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline">
              되돌리기
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
