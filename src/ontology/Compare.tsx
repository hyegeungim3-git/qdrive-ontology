import { useState } from 'react'
import { Panel } from '../components/ui'
import { spaceOf, type SpaceId } from './meta'
import { currentSnapshot, currentVersion, derive, diff, snapshotOf, useDraft, useGrammar, versions, type Snapshot } from './grammar'
import type { Jump } from './nav'

/**
 * ⑫ 문법 비교 — 개정 전후를 나란히 놓는다.
 *
 * 「v1.1로 올렸다」는 말만으로는 무엇이 달라졌는지 알 수 없다. 문법은 규격이라, 무엇이 늘었는지만큼
 * **무엇이 그대로인지**도 중요하다. 그래서 바뀐 항목만 세지 않고 안 바뀐 축도 함께 보인다.
 *
 * 발행 전에도 쓸 수 있다 — 개정안을 아직 안 올린 상태에서 «반영하면 이렇게 된다»를 같은 함수(derive)로
 * 계산해 보여준다. 승인 전에 결과를 볼 수 없는 승인 화면은 승인이 아니라 서명이다.
 */

const DRAFT = '__draft__'

const TONE: Record<string, { fg: string; bg: string; bd: string; ko: string }> = {
  add: { fg: '#6ee7b7', bg: 'rgba(52,211,153,0.12)', bd: 'rgba(52,211,153,0.4)', ko: '추가' },
  remove: { fg: '#fda4af', bg: 'rgba(251,113,133,0.12)', bd: 'rgba(251,113,133,0.4)', ko: '제거' },
  change: { fg: '#fcd34d', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.4)', ko: '변경' },
}

export default function Compare({ onGoto }: { onGoto: Jump }) {
  const releases = useGrammar()
  const draft = useDraft()
  const vs = versions()
  const hasDraft = draft.length > 0

  const [left, setLeft] = useState<string>('v1.0')
  const [right, setRight] = useState<string>(hasDraft ? DRAFT : currentVersion())

  const resolve = (v: string): Snapshot => (v === DRAFT ? derive(currentSnapshot(), draft) : snapshotOf(v))
  const label = (v: string) => (v === DRAFT ? `${currentVersion()} + 개정안 ${draft.length}건` : v)

  const A = resolve(left)
  const B = resolve(right)
  const d = diff(A, B)

  const options = [...vs, ...(hasDraft ? [DRAFT] : [])]

  return (
    <div className="space-y-3">
      <Panel
        title="⑫ 문법 비교 — 개정 전후를 나란히"
        right={<span className="text-[11px] text-gray-500">발행 전 미리보기도 같은 계산</span>}
      >
        <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
          «v1.1로 올렸다»는 말만으로는 무엇이 달라졌는지 알 수 없습니다. 문법은 규격이라{' '}
          <b className="text-gray-200">무엇이 늘었는지만큼 무엇이 그대로인지</b>도 중요합니다.{' '}
          {hasDraft && (
            <>
              지금은 <b className="text-emerald-300">아직 발행하지 않은 개정안 {draft.length}건</b>이 있어, 반영하면 어떻게 되는지도 골라 볼 수
              있습니다 — <b className="text-gray-200">승인 전에 결과를 볼 수 없는 승인은 서명일 뿐입니다.</b>
            </>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3 max-[720px]:grid-cols-1">
          <Picker ko="이전" value={left} onChange={setLeft} options={options} label={label} tone="#94a3b8" />
          <Picker ko="이후" value={right} onChange={setRight} options={options} label={label} tone="#f472b6" />
        </div>

        {/* 요약 — 좌우 나란히 */}
        <div className="mt-3 -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                <th className="py-1.5 pr-3 font-semibold">축</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{label(left)}</th>
                <th className="py-1.5 pr-3 text-center font-semibold"> </th>
                <th className="py-1.5 pr-3 font-semibold">{label(right)}</th>
                <th className="py-1.5 font-semibold">판정</th>
              </tr>
            </thead>
            <tbody>
              {d.stats.map((s) => (
                <tr key={s.ko} className="border-b border-gray-800/60">
                  <td className="py-1.5 pr-3 font-semibold text-gray-300">{s.ko}</td>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-gray-400">{s.before}</td>
                  <td className="py-1.5 pr-3 text-center text-gray-600">→</td>
                  <td className={`py-1.5 pr-3 font-bold tabular-nums ${s.moved ? 'text-emerald-300' : 'text-gray-400'}`}>{s.after}</td>
                  <td className="py-1.5 text-[11px]">
                    {s.moved ? <span className="font-bold text-emerald-300">바뀜</span> : <span className="text-gray-600">그대로</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={<span>변경 항목 {d.rows.length > 0 && <span className="ml-1 text-[11px] font-semibold text-gray-500">{d.rows.length}건</span>}</span>}
      >
        {d.rows.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-6 text-center">
            <div className="text-[13px] font-bold text-gray-300">두 문법이 같습니다</div>
            <div className="mt-1 break-keep text-[11.5px] text-gray-500">
              {left === right ? '같은 버전을 고르셨습니다 — 위에서 다른 버전을 선택해 보세요.' : '선택한 두 버전 사이에 달라진 항목이 없습니다.'}
            </div>
            {releases.length === 0 && !hasDraft && (
              <button
                onClick={() => onGoto('quarantine')}
                className="mt-3 rounded-md border border-pink-400/50 bg-pink-400/15 px-3 py-1.5 text-[11.5px] font-bold text-pink-200 hover:bg-pink-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                ⑩ 격리 큐에서 개정안 만들기 →
              </button>
            )}
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[760px] border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                  <th className="py-1.5 pr-2 font-semibold">구분</th>
                  <th className="py-1.5 pr-2 font-semibold">영역</th>
                  <th className="py-1.5 pr-2 font-semibold">항목</th>
                  <th className="py-1.5 pr-2 font-semibold">{label(left)}</th>
                  <th className="py-1.5 font-semibold">{label(right)}</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => {
                  const t = TONE[r.kind]
                  return (
                    <tr key={i} className="border-b border-gray-800/60 align-top">
                      <td className="py-1.5 pr-2">
                        <span
                          className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-black"
                          style={{ color: t.fg, background: t.bg, border: `1px solid ${t.bd}` }}
                        >
                          {t.ko}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-gray-500">{r.area}</td>
                      <td className="py-1.5 pr-2 break-keep font-semibold text-gray-200">{r.key}</td>
                      <td className="py-1.5 pr-2 break-keep text-gray-500 line-through decoration-gray-700">{r.before}</td>
                      <td className="py-1.5 break-keep font-semibold" style={{ color: t.fg }}>
                        {r.after}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="관계 문법 — 방향별로 나란히" right={<span className="text-[11px] text-gray-500">추가된 어휘는 초록 · 사라진 어휘는 취소선</span>}>
        <SideBySide a={A} b={B} leftKo={label(left)} rightKo={label(right)} />
        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12.5px] leading-relaxed text-gray-500">
          🧭 <b className="text-gray-300">문법 개정은 되돌릴 수 있어야 합니다</b> — 어느 버전에서 무엇이 열렸는지 이 화면으로 확인되고, ⑪에서 최초
          정의로 되돌리면 이 표도 그대로 되돌아갑니다. 「열어 봤더니 아니더라」를 감당할 수 없는 규격은 아무도 손대지 못합니다.
        </div>
      </Panel>
    </div>
  )
}

function Picker({
  ko,
  value,
  onChange,
  options,
  label,
  tone,
}: {
  ko: string
  value: string
  onChange: (v: string) => void
  options: string[]
  label: (v: string) => string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
      <div className="text-[10.5px] font-semibold text-gray-500">{ko}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o === value
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className="rounded-md border px-2 py-1 text-[11.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
              style={
                on
                  ? { borderColor: `${tone}88`, background: `${tone}22`, color: tone }
                  : { borderColor: '#1f2937', background: '#111827', color: '#9ca3af' }
              }
            >
              {label(o)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 방향별 어휘를 좌우로 놓는다 — 표 하나에 두 버전을 겹쳐 읽는 것보다 눈이 덜 피로하다 */
function SideBySide({ a, b, leftKo, rightKo }: { a: Snapshot; b: Snapshot; leftKo: string; rightKo: string }) {
  const key = (e: { from: SpaceId; to: SpaceId }) => `${e.from}→${e.to}`
  const all = [...new Set([...a.edges.map(key), ...b.edges.map(key)])]
  const find = (s: Snapshot, k: string) => s.edges.find((e) => key(e) === k)

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
        <thead>
          <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
            <th className="w-[170px] py-1.5 pr-2 font-semibold">방향</th>
            <th className="py-1.5 pr-2 font-semibold">{leftKo}</th>
            <th className="py-1.5 font-semibold">{rightKo}</th>
          </tr>
        </thead>
        <tbody>
          {all.map((k) => {
            const ae = find(a, k)
            const be = find(b, k)
            const ref = be ?? ae!
            const changed = (ae?.relations.join() ?? '') !== (be?.relations.join() ?? '')
            return (
              <tr key={k} className={`border-b border-gray-800/60 align-top ${changed ? 'bg-emerald-400/[0.05]' : ''}`}>
                <td className="py-1.5 pr-2 whitespace-nowrap font-bold" style={{ color: spaceOf(ref.from).color }}>
                  {spaceOf(ref.from).ko} <span className="text-gray-600">→</span>{' '}
                  <span style={{ color: spaceOf(ref.to).color }}>{spaceOf(ref.to).ko}</span>
                  {ref.core && <span className="ml-1 rounded bg-sky-400/15 px-1 py-px text-[11px] font-bold text-sky-300">핵심</span>}
                </td>
                <td className="py-1.5 pr-2">
                  {ae ? (
                    <Chips items={ae.relations} gone={be ? ae.relations.filter((r) => !be.relations.includes(r)) : ae.relations} />
                  ) : (
                    <span className="text-[10.5px] text-gray-600">방향 없음</span>
                  )}
                </td>
                <td className="py-1.5">
                  {be ? (
                    <Chips items={be.relations} added={ae ? be.relations.filter((r) => !ae.relations.includes(r)) : be.relations} />
                  ) : (
                    <span className="text-[10.5px] text-gray-600">방향 없음</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Chips({ items, added = [], gone = [] }: { items: string[]; added?: string[]; gone?: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((r) => {
        const isAdd = added.includes(r)
        const isGone = gone.includes(r)
        return (
          <span
            key={r}
            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${isGone ? 'line-through decoration-rose-400/70' : ''}`}
            style={
              isAdd
                ? { color: '#6ee7b7', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.45)' }
                : isGone
                  ? { color: '#fda4af', background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)' }
                  : { color: '#9ca3af', background: '#1f2937', border: '1px solid transparent' }
            }
          >
            {isAdd && '＋ '}
            {r}
          </span>
        )
      })}
    </div>
  )
}
