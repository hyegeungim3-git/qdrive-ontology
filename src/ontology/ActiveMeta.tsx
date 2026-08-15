import { useState } from 'react'
import { Panel } from '../components/ui'
import { SPACES, spaceOf, type SpaceId } from './meta'
import { META_LAYERS, SPACE_META, metaValue } from './impactmeta'
import { spaceBehavior, useQuarantine, type SpaceBehavior } from './quarantine'
import type { Jump } from './nav'
import { PERMISSIONS, ROLES, can, denyReason, roleOf, useRole } from './policy'

/**
 * ⑤ 액티브 메타데이터 — 노드마다 따라다니는 4계층 12속성.
 * "이 데이터를 얼마나 믿을 수 있고, 얼마나 조심해서 다뤄야 하나"를 값으로 들고 다닌다.
 */
export default function ActiveMeta({ onGoto }: { onGoto: Jump }) {
  const [pick, setPick] = useState<SpaceId>('evidence')
  const sp = spaceOf(pick)
  const pii = SPACE_META[pick].pii
  // 격리 이력 — 계보·의존성이 문법에서 나온다면, 사용량·파급의 라이브 부분은 실제로 있었던 일에서 나온다
  const role = useRole()
  const queue = useQuarantine()
  const bhv = spaceBehavior(queue, sp.en)
  const anyQueue = queue.length > 0

  /** 요약 표에 보여줄 핵심 4속성 */
  const KEY_ATTRS = [
    { key: 'confidence' as const, ko: '신뢰도' },
    { key: 'freshness' as const, ko: '신선도' },
    { key: 'sensitivity' as const, ko: '민감도' },
    { key: 'maturity' as const, ko: '성숙도' },
  ]

  return (
    <div className="space-y-3">
      <Panel title="4계층 12속성 — 값이 아니라 값에 대한 값" right={<span className="text-[11px] text-gray-500">모든 스페이스에 공통 적용</span>}>
        <div className="grid grid-cols-4 gap-2 max-[900px]:grid-cols-2">
          {META_LAYERS.map((l) => (
            <div key={l.id} className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: l.color }} />
                <span className="text-[12.5px] font-bold" style={{ color: l.color }}>
                  {l.ko}
                </span>
              </div>
              <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-gray-500">{l.desc}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {l.attrs.map((a) => (
                  <span key={a.key} title={a.desc} className="cursor-help rounded bg-gray-800 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-300">
                    {a.ko}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          데이터 자체가 아니라 <b className="text-gray-300">그 데이터에 대한 사실</b>입니다. 이게 붙어 있어야 "이 숫자를 의회 보고에 써도 되나",
          "이 데이터를 외부에 줘도 되나"에 답할 수 있습니다.
        </div>
      </Panel>

      <Panel title="스페이스별 메타데이터" right={<span className="text-[11px] text-gray-500">행을 누르면 12속성 전체</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] text-gray-500">
                <th className="py-2 pr-3 font-semibold">스페이스</th>
                {KEY_ATTRS.map((a) => (
                  <th key={a.key} className="py-2 pr-3 font-semibold">
                    {a.ko}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPACES.map((s) => {
                const on = pick === s.id
                return (
                  <tr
                    key={s.id}
                    onClick={() => setPick(s.id)}
                    className={`cursor-pointer border-b border-gray-800/60 transition-colors hover:bg-gray-800/40 ${on ? 'bg-gray-800/50' : ''}`}
                  >
                    <td className="py-2 pr-3">
                      <span className="font-bold" style={{ color: s.color }}>
                        {s.ko}
                      </span>
                      {SPACE_META[s.id].pii && (
                        <span className="ml-1.5 rounded bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-bold text-red-400">개인정보</span>
                      )}
                    </td>
                    {KEY_ATTRS.map((a) => (
                      <td key={a.key} className="py-2 pr-3 break-keep text-gray-400">
                        {metaValue(s.id, a.key)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={`${sp.ko} — 12속성 전체`}
        right={
          pii ? (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10.5px] font-bold text-red-400">개인정보 취급 주의</span>
          ) : (
            <span className="text-[11px] text-gray-500">{sp.desc}</span>
          )
        }
      >
        <div className="grid grid-cols-4 gap-2.5 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {META_LAYERS.map((l) => (
            <div key={l.id} className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${l.color}44`, background: `${l.color}0d` }}>
              <div className="mb-1.5 text-[11.5px] font-black" style={{ color: l.color }}>
                {l.ko}
              </div>
              <div className="space-y-2">
                {l.attrs.map((a) => (
                  <div key={a.key}>
                    <div className="flex items-center gap-1">
                      <span className="text-[10.5px] font-semibold text-gray-500">{a.ko}</span>
                      {bhv && (a.key === 'usage' || a.key === 'effect') && (
                        <span className="rounded bg-rose-400/15 px-1 py-px text-[9px] font-black text-rose-300">라이브</span>
                      )}
                    </div>
                    <div className="break-keep text-[11.5px] leading-relaxed text-gray-200">{metaValue(pick, a.key)}</div>
                    {bhv && a.key === 'usage' && (
                      <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-rose-300">
                        + 격리로 하류 전달이 막힌 레코드 {bhv.total}건 (보류 {bhv.held} · 처리 {bhv.total - bhv.held})
                      </div>
                    )}
                    {bhv && a.key === 'effect' && (
                      <div className="mt-0.5 break-keep text-[11px] leading-relaxed text-rose-300">
                        + {bhv.outcomes.length ? `보류로 지금 흔들리는 성과: ${bhv.outcomes.join(' · ')}` : '보류 중인 레코드가 닿는 성과 없음'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 break-keep text-[11.5px] leading-relaxed text-gray-300">
          <b className="text-emerald-400">계보 · 의존성 · 사용량 · 파급은 손으로 적지 않습니다</b> — 문법(스페이스·관계)에서 계산됩니다. 관계를 하나
          추가하면 의존성과 파급이 자동으로 갱신되므로, 메타데이터가 실제와 어긋날 일이 없습니다. 여기에 더해{' '}
          <b className="text-rose-300">행동 계층은 격리 큐에서 실시간으로 갱신</b>됩니다 — 「액티브」라고 이름 붙였으면 실제로 움직여야 합니다.
        </div>
      </Panel>

      <Panel
        title="규정이 실제로 막는 것 — 지금 보는 사람 기준"
        right={
          <span className="text-[11px] text-gray-500">
            {roleOf(role).ko} · {roleOf(role).org}
          </span>
        }
      >
        <p className="mb-2.5 break-keep text-[12.5px] leading-relaxed text-gray-400">
          ③에서 규정 스페이스를 ODRL에 정렬해 놓고도, 정작 «시 담당자는 기사 실명을 못 본다»가 코드에 없으면 그 규정은 문서 장식입니다. 지금은{' '}
          <b className="text-gray-200">헤더의 «보는 사람»을 바꾸면 화면이 실제로 달라집니다</b> — 실명이 가명키로 바뀌고, 차량 범위가 좁아지고, 승인
          버튼이 잠깁니다.
        </p>

        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                <th className="py-1.5 pr-3 font-semibold">권한</th>
                {ROLES.map((r) => (
                  <th key={r.id} className={`py-1.5 pr-3 text-center font-semibold ${r.id === role ? 'text-amber-300' : ''}`}>
                    {r.ko}
                  </th>
                ))}
                <th className="py-1.5 font-semibold">지금 역할에 막혔다면 그 근거</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/60 align-top">
                  <td className="py-1.5 pr-3">
                    <div className="font-semibold text-gray-300">{p.ko}</div>
                    <div className="break-keep text-[10.5px] text-gray-600">{p.desc}</div>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.id} className={`py-1.5 pr-3 text-center font-bold ${r.id === role ? 'bg-amber-400/[0.06]' : ''}`}>
                      {can(r.id, p.id) ? <span className="text-emerald-300">허용</span> : <span className="text-rose-300">금지</span>}
                    </td>
                  ))}
                  <td className="py-1.5 break-keep text-gray-500">
                    {can(role, p.id) ? <span className="text-gray-600">—</span> : denyReason(role, p.id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
          ⚖️ <b className="text-gray-300">두 겹으로 막습니다</b> — <b className="text-gray-400">규정</b>은 «볼 수 있는 것»을(이 표),{' '}
          <b className="text-gray-400">SHACL</b>은 «들어올 수 있는 것»을(⑨) 막습니다. 실명이 원천에서 잘못 흘러들어오면 SHACL이 적재를 막고, 그래도
          화면에는 권한 없는 사람에게 보이지 않습니다. 한 겹만 있으면 어느 쪽이든 뚫립니다. 특히{' '}
          <b className="text-gray-300">데이터 책임자도 실명을 볼 수 없다는 것</b>이 요점입니다 — 관리 권한이 열람 권한을 주지 않습니다.
        </div>
      </Panel>

      <Panel
        title="격리 이력이 메타데이터를 갱신한다"
        right={
          <button
            onClick={() => onGoto('quarantine')}
            className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ⑩ 격리 큐 →
          </button>
        }
      >
        <p className="mb-2.5 break-keep text-[12.5px] leading-relaxed text-gray-400">
          계보·의존성은 <b className="text-gray-200">문법</b>에서 나옵니다. 사용량·파급의 라이브 부분은{' '}
          <b className="text-gray-200">실제로 있었던 일</b>에서 나옵니다 — 레코드가 격리됐다는 것은 그것이 하류로 안 내려갔다는 뜻이고, 그 자체가
          사용량의 사실입니다.
        </p>

        {!anyQueue ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-5 text-center break-keep text-[12px] text-gray-500">
            아직 격리 이력이 없습니다 — ⑨ 실검증에서 결함을 주입하면 여기 행동 계층이 실제로 움직입니다.
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[720px] border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                  <th className="py-1.5 pr-2 font-semibold">스페이스</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">격리 총</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">보류</th>
                  <th className="py-1.5 pr-2 font-semibold">걸린 규칙</th>
                  <th className="py-1.5 font-semibold">보류로 흔들리는 성과</th>
                </tr>
              </thead>
              <tbody>
                {SPACES.map((s) => ({ s, b: spaceBehavior(queue, s.en) }))
                  .filter((x): x is { s: (typeof SPACES)[number]; b: SpaceBehavior } => !!x.b)
                  .map(({ s, b }) => (
                    <tr
                      key={s.id}
                      onClick={() => setPick(s.id)}
                      className={`cursor-pointer border-b border-gray-800/60 align-top transition-colors hover:bg-gray-800/40 ${
                        pick === s.id ? 'bg-gray-800/50' : ''
                      }`}
                    >
                      <td className="py-1.5 pr-2 font-bold" style={{ color: s.color }}>
                        {s.ko}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-bold tabular-nums text-gray-200">{b.total}</td>
                      <td className={`py-1.5 pr-2 text-right font-bold tabular-nums ${b.held > 0 ? 'text-rose-300' : 'text-gray-600'}`}>{b.held}</td>
                      <td className="py-1.5 pr-2">
                        <div className="flex flex-wrap gap-1">
                          {b.rules.map((r) => (
                            <span key={r} className="whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10.5px] text-violet-300">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-1.5 break-keep text-gray-400">
                        {b.outcomes.length ? b.outcomes.join(' · ') : <span className="text-gray-600">없음</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
