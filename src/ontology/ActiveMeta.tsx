import { useState } from 'react'
import { Panel } from '../components/ui'
import { SPACES, spaceOf, type SpaceId } from './meta'
import { META_LAYERS, SPACE_META, metaValue } from './impactmeta'

/**
 * ⑤ 액티브 메타데이터 — 노드마다 따라다니는 4계층 12속성.
 * "이 데이터를 얼마나 믿을 수 있고, 얼마나 조심해서 다뤄야 하나"를 값으로 들고 다닌다.
 */
export default function ActiveMeta() {
  const [pick, setPick] = useState<SpaceId>('evidence')
  const sp = spaceOf(pick)
  const pii = SPACE_META[pick].pii

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
                    <div className="text-[10.5px] font-semibold text-gray-500">{a.ko}</div>
                    <div className="break-keep text-[11.5px] leading-relaxed text-gray-200">{metaValue(pick, a.key)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 break-keep text-[11.5px] leading-relaxed text-gray-300">
          <b className="text-emerald-400">계보 · 의존성 · 사용량 · 파급은 손으로 적지 않습니다</b> — 문법(스페이스·관계)에서 계산됩니다. 관계를 하나
          추가하면 의존성과 파급이 자동으로 갱신되므로, 메타데이터가 실제와 어긋날 일이 없습니다.
        </div>
      </Panel>
    </div>
  )
}
