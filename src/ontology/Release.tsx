import { useState } from 'react'
import { Panel } from '../components/ui'
import { analyse } from './impactmeta'
import { META_EDGES, spaceOf } from './meta'
import { currentVersion, publish, removeFromDraft, revertAll, useDraft, useGrammar, type Amendment } from './grammar'
import type { SimSnapshot } from '../sim/types'
import type { Jump } from './nav'
import { can, denyReason, roleOf, useRole } from './policy'
import { revalidateAll, useGate } from './gate'

/**
 * ⑪ 문법 발행 — 제안에서 멈추지 않는다.
 *
 * ⑩이 «이 규칙을 고치자»고 말하는 데서 끝나면 온톨로지는 여전히 손으로 고치는 문서다.
 * 여기서 개정안을 승인하고 버전을 올리면 **문법이 실제로 바뀐다** — ④가 그 조합을 허용하고,
 * ⑨가 같은 결함을 더 이상 잡지 않고, ⑫가 새 버전으로 나온다.
 */

const hhmm = (s: number) => `${String(Math.floor(s / 3600) + 5).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`

const KIND_TONE: Record<Amendment['kind'], string> = {
  relAdd: '#a78bfa',
  requiredOff: '#38bdf8',
  enumAdd: '#34d399',
  rangeAdjust: '#f59e0b',
  thresholdAdjust: '#f59e0b',
  domainRuleOff: '#fb7185',
}

/** 핵심 사슬을 느슨하게 하는 개정은 따로 표시한다 — 승인 화면에서 조용히 지나가면 안 된다 */
const isSensitive = (a: Amendment) => a.kind === 'domainRuleOff'

export default function Release({ snap, onGoto }: { snap: SimSnapshot; onGoto: Jump }) {
  const draft = useDraft()
  const releases = useGrammar()
  const role = useRole()
  const gate = useGate()
  // 규정이 막는다 — 문법 발행은 데이터 책임자만
  const mayPublish = can(role, 'publishGrammar')
  const [who, setWho] = useState('데이터 책임자')
  const [ack, setAck] = useState(false)

  const v = currentVersion()
  const relations = new Set(META_EDGES.flatMap((e) => e.relations)).size
  const edges = META_EDGES.length
  const sensitive = draft.filter(isSensitive)
  const canPublish = mayPublish && draft.length > 0 && who.trim() !== '' && (sensitive.length === 0 || ack)

  // 개정안 전체가 건드리는 범위 — 항목별 영향의 합집합
  const merged = draft.reduce(
    (acc, a) => {
      const r = analyse(a.space, a.change)
      r.ids.forEach((i) => acc.ids.add(`${i.id} ${i.ko}`))
      r.spaces.forEach((s) => acc.spaces.add(spaceOf(s).ko))
      acc.spaces.add(spaceOf(a.space).ko)
      r.services.forEach((s) => acc.services.add(s.name))
      return acc
    },
    { ids: new Set<string>(), spaces: new Set<string>(), services: new Set<string>() },
  )

  return (
    <div className="space-y-3">
      <Panel
        title="⑪ 문법 발행 — 제안에서 멈추지 않는다"
        right={
          releases.length > 0 && (
            <button
              onClick={revertAll}
              className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              v1.0으로 되돌리기
            </button>
          )
        }
      >
        <p className="mb-3 break-keep text-[12.5px] leading-relaxed text-gray-400">
          ⑩의 역제안을 개정안에 담아 여기서 발행합니다. <b className="text-gray-200">발행하면 문법이 실제로 바뀝니다</b> — 버전 라벨만 올라가는 것이
          아니라, ④ 문법 검증이 그 조합을 허용하고 ⑨ SHACL이 같은 결함을 더 이상 잡지 않으며 ⑫ 내보내기가 새 버전으로 나옵니다.
        </p>

        {/* 권한이 없으면 개정안을 담기 전에 알아야 한다 — 다 담고 나서 막히면 화가 난다 */}
        {!mayPublish && (
          <div
            className="mb-3 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed"
            style={{ borderColor: '#f59e0b55', background: '#f59e0b14', color: '#fcd34d' }}
          >
            🔒 <b>«{roleOf(role).ko}» 역할에는 문법 발행 권한이 없습니다</b> — {denyReason(role, 'publishGrammar')} 개정안을 담아 제안하는 것까지는
            할 수 있습니다.
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 max-[820px]:grid-cols-2">
          {[
            { ko: '현재 버전', v: v, sub: releases.length ? `개정 ${releases.length}회` : '최초 정의', tone: '#f472b6' },
            { ko: '관계 어휘', v: `${relations}종`, sub: `${edges}개 방향`, tone: '#34d399' },
            { ko: '개정안 대기', v: `${draft.length}건`, sub: draft.length ? '승인 대기' : '비어 있음', tone: draft.length ? '#f59e0b' : '#6b7280' },
            { ko: '민감 개정', v: `${sensitive.length}건`, sub: sensitive.length ? '핵심 사슬 완화' : '없음', tone: sensitive.length ? '#fb7185' : '#6b7280' },
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
      </Panel>

      <Panel title={`개정안 (초안) — ${draft.length}건`}>
        {draft.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-6 text-center">
            <div className="text-[13px] font-bold text-gray-300">개정안이 비어 있습니다</div>
            <div className="mt-1 break-keep text-[11.5px] text-gray-500">
              ⑩ 격리 큐에서 «규칙 재검토» 진단이 나온 규칙을 펼치면 «개정안에 담기» 버튼이 나옵니다.
            </div>
            <button
              onClick={() => onGoto('quarantine')}
              className="mt-3 rounded-md border border-pink-400/50 bg-pink-400/15 px-3 py-1.5 text-[11.5px] font-bold text-pink-200 hover:bg-pink-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              ⑩ 격리 큐로 가기 →
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {draft.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border px-3.5 py-3"
                  style={{ borderColor: `${KIND_TONE[a.kind]}44`, background: `${KIND_TONE[a.kind]}0d` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-bold" style={{ color: KIND_TONE[a.kind] }}>
                          {a.ko}
                        </span>
                        {isSensitive(a) && (
                          <span className="rounded border border-rose-400/50 bg-rose-400/15 px-1.5 py-px text-[10px] font-black text-rose-300">
                            핵심 사슬 완화
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-400">{a.detail}</div>
                    </div>
                    <button
                      onClick={() => removeFromDraft(a.id)}
                      className="shrink-0 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      빼기
                    </button>
                  </div>
                  <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2">
                    <div className="text-[10.5px] font-semibold text-gray-500">이 개정을 요구한 근거</div>
                    <div className="mt-0.5 break-keep text-[11.5px] text-gray-300">
                      규칙 <span className="font-mono text-violet-300">{a.id}</span> 로 격리 후{' '}
                      <b className="text-amber-300">예외 승인 {a.basis.waived}건</b>
                      {a.basis.held > 0 && <span className="text-gray-500"> · 보류 {a.basis.held}건</span>}
                    </div>
                    {a.basis.notes.length > 0 && (
                      <div className="mt-1 border-l-2 border-gray-700 pl-2 break-keep text-[10.5px] leading-relaxed text-gray-500">
                        {a.basis.notes.map((n) => `“${n}”`).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-3.5 py-3">
              <div className="text-[12px] font-black text-violet-200">개정안 전체가 흔드는 범위</div>
              <div className="mt-0.5 break-keep text-[11px] text-gray-500">
                항목별 영향의 합집합입니다 — 여러 개정을 한 번에 발행하면 전파도 합쳐집니다.
              </div>
              <div className="mt-2 space-y-1.5 text-[11.5px]">
                <div className="flex flex-wrap gap-x-2">
                  <span className="w-[68px] shrink-0 font-semibold text-gray-500">영향 범주</span>
                  <span className="flex flex-wrap gap-1">
                    {[...merged.ids].map((i) => (
                      <span key={i} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-300">
                        {i}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="w-[68px] shrink-0 font-semibold text-gray-500">스페이스</span>
                  <span className="text-gray-300">{[...merged.spaces].join(' · ')}</span>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <span className="w-[68px] shrink-0 font-semibold text-gray-500">화면</span>
                  <span className="text-gray-300">
                    {merged.services.size}개 — {[...merged.services].slice(0, 6).join(' · ')}
                    {merged.services.size > 6 && ' …'}
                  </span>
                </div>
              </div>
            </div>

            {/* 승인 */}
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/50 px-3.5 py-3">
              <div className="text-[12px] font-black text-gray-200">발행 승인</div>
              <label className="mt-2 block text-[11px] font-semibold text-gray-400">
                승인자
                <input
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  className="mt-1 w-full max-w-[320px] rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-[12px] text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </label>

              {sensitive.length > 0 && (
                <label className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 shrink-0 accent-rose-400" />
                  <span className="break-keep text-[11.5px] leading-relaxed text-rose-100">
                    이 개정안에는 <b>핵심 사슬을 느슨하게 하는 항목 {sensitive.length}건</b>이 들어 있습니다. 발행하면 «근거 없는 판정»이 만들어질 수
                    있게 됩니다 — 그 위험을 알고 승인합니다.
                  </span>
                </label>
              )}

              {!mayPublish && (
                <div
                  className="mb-2 rounded-lg border px-3 py-2 break-keep text-[11.5px] leading-relaxed"
                  style={{ borderColor: '#f59e0b55', background: '#f59e0b14', color: '#fcd34d' }}
                >
                  🔒 <b>«{roleOf(role).ko}» 역할에는 문법 발행 권한이 없습니다</b> — {denyReason(role, 'publishGrammar')}
                </div>
              )}
              <button
                onClick={() => onGoto('compare')}
                className="mt-2.5 mr-2 rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-[12px] font-bold text-sky-200 hover:bg-sky-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                ⑫ 반영하면 무엇이 바뀌나 보기 →
              </button>
              <button
                onClick={() => {
                  publish(who.trim(), snap.simTime)
                  setAck(false)
                }}
                disabled={!canPublish}
                className="mt-2.5 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-[12.5px] font-black text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                문법 발행 — {v} → v1.{releases.length + 1}
              </button>
              <div className="mt-2 break-keep text-[11px] leading-relaxed text-gray-500">
                발행해도 <b className="text-gray-400">이미 격리된 레코드는 자동으로 풀리지 않습니다.</b> 새 문법은 앞으로 들어오는 데이터에 적용되고,
                과거 판정을 소급할지는 별도 결정입니다 — 규칙이 바뀌었다고 지난 판정이 조용히 뒤집히면 그게 더 위험합니다.
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* 발행은 소급하지 않는다 — 그 말이 사실인지 여기서 숫자로 보인다 */}
      {gate.stamped.stale > 0 && (
        <Panel
          title="옛 문법으로 검증된 레코드"
          right={
            <button
              onClick={revalidateAll}
              className="rounded-md border border-amber-400/50 bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-400/25 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              지금 문법으로 재검증
            </button>
          }
        >
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 break-keep text-[12px] leading-relaxed text-amber-100">
            현재 문법은 <b>{gate.version}</b>인데, <b>{gate.stamped.stale}건</b>의 레코드가 그 이전 문법으로 검증된 스탬프를 달고 있습니다.
            <div className="mt-1.5 text-[11.5px] text-gray-300">
              발행은 소급하지 않기 때문입니다 — 새 문법은 앞으로 들어오는 데이터에 적용되고, 이미 검증된 레코드는 그대로 둡니다. 규칙이 바뀌었다고 지난
              판정이 조용히 뒤집히면 그게 더 위험합니다. <b className="text-amber-200">소급할지는 결정이어야 합니다</b> — 오른쪽 버튼이 그 결정입니다.
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="개정 이력"
        right={<span className="text-[11px] text-gray-500">무엇이 왜 바뀌었나</span>}
      >
        {releases.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-5 text-center break-keep text-[12px] text-gray-500">
            아직 개정이 없습니다 — 현재 문법은 최초 정의 <b className="text-gray-300">v1.0</b> 그대로입니다.
          </div>
        ) : (
          <div className="space-y-2">
            {[...releases].reverse().map((r) => (
              <div key={r.version} className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[14px] font-black text-emerald-300">{r.version}</span>
                  <span className="text-[11.5px] text-gray-400">
                    {hhmm(r.at)} · 승인 {r.approvedBy} · {r.amendments.length}건
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {r.amendments.map((a) => (
                    <li key={a.id} className="break-keep text-[11.5px] leading-relaxed text-gray-300">
                      <span style={{ color: KIND_TONE[a.kind] }}>●</span> {a.ko}
                      <span className="text-gray-500">
                        {' '}
                        — 근거: <span className="font-mono">{a.id}</span> 예외 승인 {a.basis.waived}건
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onGoto('compare')}
                    className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    ⑫ 무엇이 바뀌었나 →
                  </button>
                  <button
                    onClick={() => onGoto('validator')}
                    className="rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    ④ 문법 검증에서 확인 →
                  </button>
                  <button
                    onClick={() => onGoto('live')}
                    className="rounded-md border border-pink-400/40 bg-pink-400/10 px-2 py-1 text-[11px] font-bold text-pink-200 hover:bg-pink-400/20 focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    ⑨ 실검증에서 확인 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
          📜 <b className="text-gray-300">개정의 근거가 이력에 남습니다</b> — 「누가 언제 승인했나」만이 아니라 「무슨 데이터가 이 개정을 요구했나」까지.
          격리 몇 건이 예외 승인으로 풀렸고 담당자가 뭐라고 적었는지가 개정 사유입니다. 문법이 누군가의 취향으로 바뀌지 않았다는 증거가 됩니다.
        </div>
      </Panel>
    </div>
  )
}
