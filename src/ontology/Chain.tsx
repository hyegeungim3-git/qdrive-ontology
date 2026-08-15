import { useState, type ReactNode } from 'react'
import { Panel } from '../components/ui'
import type { SimSnapshot } from '../sim/types'
import { spaceOf } from './meta'
import { BASIS_TONE, METRICS, shortId, type Line } from './chains'
import { mergeWalk, walkChain } from './chainwalk'
import { useGate } from './gate'

/**
 * ⑤ 근거 사슬 — "이 숫자는 어디서 왔나"를 역추적한다. 성과 지표 6종 전체.
 *
 * 성과 ←반영된다─ 판정 ←뒷받침한다─ 관측
 *   ↑올린다              ↑맥락 보정        ↑규정(확정 조건)
 * 조치
 *
 * 지표마다 근거의 성격이 다르다 — 실측·환산·미측정을 구분해 적는 것이 이 화면의 정직성.
 */
export default function Chain({ snap, preset }: { snap: SimSnapshot; preset?: { metric: string; vehicleId: string | null } }) {
  // 인스턴스 그래프에서 «이 레코드를 되짚어 보자»로 넘어온 경우, 그 좌표로 연다
  const [key, setKey] = useState(preset?.metric ?? 'safety')
  const [vid, setVid] = useState<string | null>(preset?.vehicleId ?? null)
  const gate = useGate()
  const metric = METRICS.find((m) => m.key === key)!
  const v = snap.vehicles.find((x) => x.id === vid) ?? snap.vehicles[0]

  if (!v) return <Panel title="근거 사슬">엔진이 아직 차량을 만들지 않았습니다.</Panel>

  /**
   * 사슬을 **그래프에서 걸어** 만든다. 손으로 쓴 빌더는 성과 값·맥락·규정만 담당하고,
   * 판정·관측·조치·개념 칸은 순회 결과가 덮는다 — 그래야 문법을 고치면 사슬이 실제로 달라진다.
   */
  const walk = walkChain(gate, key, v.id)
  const c = mergeWalk(metric.build(snap, v.id), walk)

  const S = {
    outcome: spaceOf('outcome'),
    claim: spaceOf('claim'),
    evidence: spaceOf('evidence'),
    lever: spaceOf('lever'),
    ctx: spaceOf('concept'),
    policy: spaceOf('policy'),
  }

  return (
    <div className="space-y-3">
      <Panel title="성과 지표 선택 — 어느 숫자를 되짚을까" right={<span className="text-[11px] text-gray-500">성과 스페이스 {METRICS.length}종</span>}>
        <div className="grid grid-cols-6 gap-2 max-[1100px]:grid-cols-3 max-[640px]:grid-cols-2">
          {METRICS.map((m) => {
            const on = m.key === key
            const view = m.build(snap, v.id)
            return (
              <button
                key={m.key}
                onClick={() => setKey(m.key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  on ? 'border-sky-400/60 bg-sky-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                }`}
              >
                <div className={`text-[12px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{m.ko}</div>
                <div className="mt-0.5 text-[15px] font-black tabular-nums" style={{ color: on ? S.outcome.color : undefined }}>
                  {m.short(snap, v.id)}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`rounded px-1 py-0.5 text-[9.5px] font-bold ${BASIS_TONE[view.basis]}`}>{view.basis}</span>
                  {m.perVehicle && <span className="text-[9.5px] text-gray-600">차량별</span>}
                </div>
              </button>
            )
          })}
        </div>

        {metric.perVehicle && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-bold text-gray-400">대상 차량</div>
            <div className="flex flex-wrap gap-1.5">
              {snap.vehicles.map((x) => {
                const on = x.id === v.id
                return (
                  <button
                    key={x.id}
                    onClick={() => setVid(x.id)}
                    className={`rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      on ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40' : 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="text-[12px] font-bold">{shortId(x.id)}</div>
                    <div className="text-[10.5px] opacity-75">{x.driverName}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="그래프 순회 — 문법이 허용한 관계만 따라 걷는다"
        right={<span className="text-[11px] text-gray-500">게이트 {gate.version} · 노드 {gate.graph.subjects}</span>}
      >
        {!walk.ok ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 break-keep text-[12px] leading-relaxed text-gray-400">
            ⓘ {walk.reason}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3.5 py-2.5 text-[12px]">
              <span className="font-black text-sky-200">{walk.outcome?.label}</span>
              {walk.claims.length > 0 && (
                <>
                  <span className="text-gray-500">←«{walk.claims[0].via}»←</span>
                  <span className="font-bold text-rose-300">판정 {walk.claims.length}</span>
                </>
              )}
              {walk.evidence.length > 0 && (
                <>
                  <span className="text-gray-500">←«{walk.evidence[0].via}»←</span>
                  <span className="font-bold text-cyan-300">관측 {walk.evidence.length}</span>
                </>
              )}
              {walk.levers.length > 0 && (
                <span className="text-gray-400">
                  · 조치 <b className="text-pink-300">{walk.levers.length}</b>←«{walk.levers[0].via}»
                </span>
              )}
              {walk.blocked > 0 && <span className="font-bold text-amber-300">· 게이트에 막혀 빠짐 {walk.blocked}</span>}
              {walk.claims.length === 0 && walk.evidence.length === 0 && walk.levers.length === 0 && (
                <span className="text-gray-500">— 이 성과에 닿은 경로가 그래프에 아직 없습니다(엔진이 아직 만들지 않은 성과입니다)</span>
              )}
              {walk.claims.length === 0 && walk.levers.length > 0 && (
                <span className="text-gray-500">— 판정을 거친 경로는 아직 없고, 조치만 붙어 있습니다</span>
              )}
            </div>

            {walk.direct.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 break-keep text-[12px] leading-relaxed text-amber-100">
                ⚠ <b>«관측 → 성과» 직접 경로 {walk.direct.length}건</b> — 판정을 거치지 않고 성과에 바로 붙은 관측입니다. 문법이 이 방향을 열어 줬기
                때문에 순회에 나타납니다. 문법 v1.0에서는 나올 수 없는 경로입니다.
              </div>
            )}

            <div className="mt-2 -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[560px] border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-[10.5px] text-gray-500">
                    <th className="py-1.5 pr-3 font-semibold">순회한 방향</th>
                    <th className="py-1.5 pr-3 font-semibold">문법이 허용한 어휘</th>
                    <th className="py-1.5 font-semibold">이 사슬에서 실제로 쓴 것</th>
                  </tr>
                </thead>
                <tbody>
                  {walk.allowed.map((a) => {
                    const hit = a.rels.filter((r) => walk.used.includes(r))
                    return (
                      <tr key={a.dir} className="border-b border-gray-800/60">
                        <td className="py-1.5 pr-3 font-semibold text-gray-300">{a.dir}</td>
                        <td className="py-1.5 pr-3 text-gray-500">{a.rels.length ? a.rels.join(' · ') : <span className="text-gray-600">문법에 없음</span>}</td>
                        <td className="py-1.5">
                          {hit.length ? (
                            <span className="font-bold text-emerald-300">{hit.join(' · ')}</span>
                          ) : (
                            <span className="text-gray-600">데이터에 없음</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2.5 break-keep text-[11.5px] leading-relaxed text-gray-500">
              🧭 술어를 코드에 적지 않고 <b className="text-gray-300">문법에서 꺼내</b> 걷습니다. 그래서 ⑪에서 문법을 발행해 «관측 → 성과»를 열면{' '}
              <b className="text-gray-300">이 표와 사슬이 실제로 달라집니다</b> — 아래 판정·관측 칸은 이 순회 결과로 채워집니다.
            </div>
          </>
        )}
      </Panel>

      <Panel
        title={`근거 사슬 — ${metric.ko} ${c.value}${c.unit}`}
        right={
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${BASIS_TONE[c.basis]}`}>근거 유형 {c.basis}</span>
            <span className="text-[11px] text-gray-500">오른쪽에서 왼쪽으로 읽으면 "왜"가 나옵니다</span>
          </div>
        }
      >
        <div className="grid grid-cols-[1.1fr_1fr_1.1fr] gap-2 max-[1000px]:grid-cols-1">
          <Step space={S.outcome} title="성과" rel="이 숫자가 결과">
            <div className="text-center">
              <div className="text-3xl font-black tabular-nums" style={{ color: S.outcome.color }}>
                {c.value}
                {c.unit && <span className="ml-1 text-sm font-bold text-gray-500">{c.unit}</span>}
              </div>
              <div className="mt-0.5 break-keep text-[11px] text-gray-500">{c.subject}</div>
            </div>
            {c.outcomeLines.map((l) => (
              <Row key={l.k} {...l} />
            ))}
          </Step>

          <Step space={S.claim} title="판정" rel="← 반영된다">
            <div className="mb-1 text-[11px] font-bold text-gray-400">{c.claimTitle}</div>
            {c.claimEmpty ? (
              <Empty>{c.claimEmpty}</Empty>
            ) : (
              <>
                {c.claimBig && (
                  <div className="flex items-center justify-center gap-3">
                    {c.claimBig.map((b) => (
                      <div key={b.label} className="text-center">
                        <div className="text-xl font-black tabular-nums" style={{ color: b.color }}>
                          {b.n}
                        </div>
                        <div className="text-[10.5px] text-gray-500">{b.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className={c.claimBig ? 'mt-1.5' : ''}>
                  {c.claimLines.map((l) => (
                    <Row key={l.k} {...l} />
                  ))}
                </div>
                {c.claimNote && (
                  <div className="mt-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 break-keep text-[10.5px] leading-relaxed text-emerald-300">
                    {c.claimNote}
                  </div>
                )}
              </>
            )}
          </Step>

          <Step space={S.evidence} title="관측" rel="← 뒷받침한다">
            <div className="mb-1 text-[11px] font-bold text-gray-400">{c.evidenceTitle}</div>
            {c.evidenceEmpty ? (
              <Empty>{c.evidenceEmpty}</Empty>
            ) : (
              <div className="space-y-1">
                {c.evidenceRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/50 px-2 py-1">
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-gray-500">{r.a}</span>
                    <span className="truncate text-[11.5px] font-bold text-gray-200">{r.b}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-gray-500">{r.c}</span>
                    {r.ok && <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[9.5px] font-bold text-emerald-400">정상</span>}
                  </div>
                ))}
                {!!c.evidenceMore && c.evidenceMore > 0 && <div className="text-center text-[10.5px] text-gray-600">외 {c.evidenceMore}건</div>}
              </div>
            )}
          </Step>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 max-[1000px]:grid-cols-1">
          <Step space={S.lever} title="조치" rel="↑ 올린다 · 개입">
            {c.leverLines.map((l) => (
              <Row key={l.k} {...l} />
            ))}
            <div className="mt-1 break-keep text-[10.5px] leading-relaxed text-gray-500">{c.leverNote}</div>
          </Step>
          <Step space={S.ctx} title="맥락" rel="판정 보정">
            {c.contextLines.map((l) => (
              <Row key={l.k} {...l} />
            ))}
          </Step>
          <Step space={S.policy} title="규정" rel="판정 확정의 조건">
            <div className="rounded border border-red-500/25 bg-red-500/10 px-2 py-1.5 break-keep text-[11px] leading-relaxed text-gray-300">
              {c.policyWarn}
            </div>
            {c.policyLines.map((l) => (
              <Row key={l.k} {...l} />
            ))}
          </Step>
        </div>

        <div className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2.5">
          <div className="mb-1 text-[11px] font-bold text-sky-300">이 숫자를 설명해야 한다면</div>
          <div className="break-keep text-[12.5px] leading-relaxed text-gray-200">{c.sentence}</div>
        </div>
        <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
          이 문장은 미리 써 둔 것이 아니라 <b className="text-gray-300">지금 데이터에서 사슬을 따라 조립된 것</b>입니다. 지표마다 근거의 성격이 달라서
          — 안전점수는 <b className="text-emerald-400">실측</b>, CO₂는 <b className="text-sky-400">환산</b>, 정시율은{' '}
          <b className="text-red-400">미측정</b> — 사슬도 다르게 그려집니다. <b className="text-gray-300">없는 숫자를 만들어내지 않는 것</b>이 원칙입니다.
        </div>
      </Panel>
    </div>
  )
}

function Step({ space, title, rel, children }: { space: { color: string }; title: string; rel: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${space.color}44`, background: `${space.color}0d` }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-black" style={{ color: space.color }}>
          {title}
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-gray-500">{rel}</span>
      </div>
      {children}
    </div>
  )
}
function Row({ k, v }: Line) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-800/50 py-1 last:border-0">
      <span className="shrink-0 text-[10.5px] text-gray-500">{k}</span>
      <span className="truncate text-right text-[11.5px] font-semibold text-gray-300">{v}</span>
    </div>
  )
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="py-4 text-center text-[11px] text-gray-600">{children}</div>
}
