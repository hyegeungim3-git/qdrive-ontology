import { useState } from 'react'
import { Panel } from '../components/ui'
import { Drawer, Sec } from './ui'
import { ACTIONS, clearAll, qStats, reopen, resolve, useQuarantine, waiverBlock, type QAction, type QItem } from './quarantine'
import type { SimSnapshot } from '../sim/types'

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

export default function Quarantine({ snap, onGoto }: { snap: SimSnapshot; onGoto: (s: 'live') => void }) {
  const list = useQuarantine()
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'held' | 'done'>('held')
  const [note, setNote] = useState('')
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
              className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
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
            { ko: '영향받는 성과', v: s.outcomes.length, sub: s.outcomes.slice(0, 2).join(' · ') || '없음', tone: '#38bdf8' },
          ].map((k) => (
            <div key={k.ko} className="rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2.5">
              <div className="text-[10.5px] font-semibold text-gray-500">{k.ko}</div>
              <div className="text-[19px] font-black tabular-nums" style={{ color: k.tone }}>
                {k.v}
              </div>
              <div className="truncate text-[10.5px] text-gray-500">{k.sub}</div>
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
              className="mt-3 rounded-md border border-pink-400/50 bg-pink-400/15 px-3 py-1.5 text-[11.5px] font-bold text-pink-200 hover:bg-pink-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
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
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 ${
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

          <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
            🔗 <b className="text-gray-300">운영 플랫폼과의 관계</b> — 데이터 관리자의 품질 격리 큐는 룰별 <b className="text-gray-300">건수</b>를 다룹니다(6개
            룰 · 재처리 이력). 여기는 SHACL이 위반 노드를 정확히 지목하므로 <b className="text-gray-300">레코드 단위</b>로 다루고, 하류 영향을 관계로 계산합니다.
            둘은 같은 원칙 위에 있습니다 — 격리된 레코드는 버리지 않고, 원인을 고치면 재처리되며, 그 이력 자체가 관리의 근거가 됩니다.{' '}
            <a href={PLATFORM_QUALITY} target="_blank" rel="noreferrer" className="text-sky-400 underline-offset-2 hover:underline">
              운영 플랫폼 데이터 관리자
            </a>
          </div>
        </Panel>
      )}

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
              <div className="rounded-lg border px-3 py-2 break-keep text-[12px] leading-relaxed" style={{ borderColor: '#fb718555', background: '#fb718514', color: '#fecdd3' }}>
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
                      className="mb-2 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed"
                      style={{ borderColor: '#f59e0b55', background: '#f59e0b14', color: '#fcd34d' }}
                    >
                      ⛔ <b>예외 승인 불가</b> — {block}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {ACTIONS.map((a) => {
                      const blocked = a.id === '예외 승인' && !!block
                      const needNote = a.needsNote && !note.trim()
                      const off = blocked || needNote || !who.trim()
                      return (
                        <button
                          key={a.id}
                          onClick={() => act(a.id)}
                          disabled={off}
                          title={blocked ? block : needNote ? '사유를 적어야 승인할 수 있습니다' : undefined}
                          className="w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
                          style={{ borderColor: `${a.tone}55`, background: `${a.tone}12` }}
                        >
                          <div className="text-[12.5px] font-bold" style={{ color: a.tone }}>
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
                  <div className="text-[12.5px] font-bold" style={{ color: STATUS_TONE[open.status] }}>
                    {open.status}
                  </div>
                  <div className="mt-1 text-[11.5px] text-gray-400">
                    {open.decidedBy} · {open.doneAt !== undefined ? hhmm(open.doneAt) : '—'}
                  </div>
                  {open.note && <div className="mt-1.5 break-keep text-[11.5px] leading-relaxed text-gray-300">“{open.note}”</div>}
                </div>
                <button
                  onClick={() => {
                    reopen(open.id)
                  }}
                  className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11.5px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
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
            className="whitespace-nowrap rounded-md border border-sky-500/40 bg-sky-500/12 px-2 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            처리하기
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-black"
              style={{ color: STATUS_TONE[i.status], background: `${STATUS_TONE[i.status]}1f`, border: `1px solid ${STATUS_TONE[i.status]}55` }}
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
