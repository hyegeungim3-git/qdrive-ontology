import { useEffect, useState } from 'react'
import { ink } from './ink'
import { Emph } from '../components/ui'
import { SOURCES, adapt, coverage, sourceOf, type MapStatus } from './adapter'
import { validateTurtle } from './validate'

/**
 * 역방향 적재 — ③ 표준 정렬의 네 번째 탭.
 *
 * 정렬표는 «우리 어휘가 표준 어디에 붙는가»를 말한다. 여기는 반대다 —
 * **표준으로 온 데이터를 우리가 받을 수 있는가.** 정렬만 하고 받지 못하면 문서 장식이다.
 *
 * 화면이 답해야 하는 것은 «지원합니다»가 아니라 넷이다:
 * 무엇이 무엇이 되나 / 무엇을 안 받나 / 같은 차량인 걸 어떻게 아나 / 그래서 통과하나.
 * 마지막은 말이 아니라 **⑨와 같은 SHACL을 실제로 돌려서** 답한다.
 */

const TONE: Record<MapStatus, { c: string; ko: string }> = {
  그대로: { c: '#34d399', ko: '그대로' },
  환산: { c: '#38bdf8', ko: '환산' },
  조합: { c: '#a78bfa', ko: '조합' },
  '문법에 없음': { c: '#f59e0b', ko: '문법에 없음' },
  '규정상 거부': { c: '#f43f5e', ko: '규정상 거부' },
}

export default function Inbound() {
  const [id, setId] = useState(SOURCES[0].id)
  const [bad, setBad] = useState(false)
  const [res, setRes] = useState<Awaited<ReturnType<typeof validateTurtle>> | null>(null)
  const [busy, setBusy] = useState(false)

  const src = sourceOf(id)
  const out = adapt(src, bad)
  const cov = coverage()

  useEffect(() => {
    let live = true
    setBusy(true)
    setRes(null)
    validateTurtle(out.turtle).then((r) => {
      if (live) {
        setRes(r)
        setBusy(false)
      }
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, bad])

  return (
    <div className="space-y-3">
      <div className="break-keep text-[12.5px] leading-relaxed text-gray-400">
        위 표들은 <b className="text-gray-200">우리 어휘가 표준 어디에 붙는가</b>를 말합니다. 여기는 반대 방향입니다 —{' '}
        <b className="text-gray-200">표준으로 온 데이터를 우리가 받을 수 있는가.</b> 정렬만 하고 받지 못하면 그 정렬은 문서 장식입니다. 그리고
        발주처가 가장 실무적으로 묻는 질문이 이것입니다: <b className="text-gray-300">「우리 데이터를 어떻게 넣습니까」</b>
      </div>

      <div className="grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
        {SOURCES.map((s) => {
          const on = s.id === id
          return (
            <button
              key={s.id}
              onClick={() => setId(s.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                on ? 'border-sky-400/60 bg-sky-400/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
              }`}
            >
              <div className={`text-[12.5px] font-bold ${on ? 'text-gray-50' : 'text-gray-300'}`}>{s.ko}</div>
              <div className="mt-0.5 text-[10px] text-gray-600">{s.org}</div>
              <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-500">
                <Emph t={s.what} cls="text-gray-300" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div>
          <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">원문 — {src.format}</div>
          <pre className="max-h-[220px] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-[11.5px] leading-relaxed text-gray-400">
            <code>{src.raw}</code>
          </pre>
          <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d' }}>
            <div className="text-[11px] font-black text-violet-300">엔티티 해소 — 같은 차량인 걸 어떻게 아나</div>
            <div className="mt-1 font-mono text-[10.5px] text-gray-300">
              {out.resolved.from} → {out.resolved.to}
            </div>
            <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-500">
              <Emph t={out.resolved.how} cls="text-gray-300" />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">옮긴 결과 — 우리 문법의 Turtle</div>
          <pre className="max-h-[220px] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-[11.5px] leading-relaxed text-emerald-300/80">
            <code>{out.turtle}</code>
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setBad(!bad)}
              className={`rounded-md border px-2.5 max-[640px]:min-h-[40px] py-1 text-[11px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 ${
                bad ? 'border-rose-500/50 bg-rose-500/15 text-rose-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200'
              }`}
            >
              {bad ? '⚠ 오염된 원천으로 보는 중' : '원천이 잘못 보내면?'}
            </button>
            {busy && <span className="text-[11px] text-gray-500">검사 중…</span>}
            {res && (
              <span className={`text-[11.5px] font-bold ${res.conforms ? 'text-emerald-400' : 'text-rose-400'}`}>
                {res.conforms ? '✅ SHACL 통과 — 적재 가능' : `✗ 위반 ${res.results.length}건 — 격리`}
              </span>
            )}
          </div>
          {res && !res.conforms && (
            <div className="mt-1.5 space-y-1">
              {res.results.slice(0, 4).map((r, i) => (
                <div key={i} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: '#f43f5e44', background: '#f43f5e10' }}>
                  <div className="font-mono text-[10px] text-rose-300">
                    {r.focus} · {r.path} · {r.constraint}
                  </div>
                  <div className="mt-0.5 break-keep text-[11.5px] leading-relaxed text-gray-400">{r.message}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: '#a78bfa33', background: '#a78bfa0d' }}>
            <div className="text-[11px] font-black text-violet-300">원천만으로는 문법을 지킬 수 없다</div>
            <div className="mt-1 break-keep text-[11.5px] leading-relaxed text-gray-400">
              처음 돌렸을 때 <b className="text-gray-300">관측만 있고 판정이 없어</b> «뒷받침한다» 필수 관계가 위반이었습니다. 어느 표준도 판정을
              주지 않기 때문입니다. 그래서 어댑터가 판정을 <b className="text-gray-300">«검토 대기»</b>로 만듭니다 — 원천이 들어왔다고 감점이
              자동 확정되면 「불이익 결정 자동화 금지」를 어깁니다. <b className="text-gray-300">비워 둔 decidedBy가 그 규정의 실행입니다.</b>
            </div>
          </div>
          <div className="mt-2 break-keep text-[11.5px] leading-relaxed text-gray-500">
            이 검사는 <b className="text-gray-400">⑨ 실검증과 같은 셰이프 그래프</b>를 씁니다 — 적재 경로만 다르고 규칙은 하나여야 합니다.
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-black tracking-wide text-gray-500">
          필드 매핑 — 받는 것 {out.taken}개 · 안 받는 것 {out.dropped}개
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[11.5px]">
            <thead className="text-[10.5px] text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="py-2 pr-3 font-semibold">외부 필드</th>
                <th className="py-2 pr-3 font-semibold">샘플</th>
                <th className="py-2 pr-3 font-semibold">처리</th>
                <th className="py-2 pr-3 font-semibold">우리 속성</th>
                <th className="py-2 pr-3 font-semibold">왜</th>
              </tr>
            </thead>
            <tbody>
              {src.fields.map((f) => {
                const t = TONE[f.status]
                const kept = f.status === '그대로' || f.status === '환산' || f.status === '조합'
                return (
                  <tr key={f.ext} className={`border-b border-gray-800/60 align-top ${kept ? '' : 'bg-amber-400/[0.04]'}`}>
                    <td className="py-1.5 pr-3">
                      <div className="font-mono text-[10.5px] text-gray-200">{f.ext}</div>
                      <div className="text-[10px] text-gray-600">{f.extKo}</div>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[10.5px] text-gray-500">{f.sample}</td>
                    <td className="py-1.5 pr-3">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ color: ink(t.c), background: `${t.c}1a` }}>
                        {t.ko}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      {f.to ? (
                        <>
                          <span className="font-mono text-[10.5px] text-emerald-300">{f.to}</span>
                          <div className="text-[10px] text-gray-600">{f.node}</div>
                        </>
                      ) : (
                        <span className="text-[10.5px] text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 break-keep text-[11.5px] leading-relaxed text-gray-500">
                      <Emph t={f.why} cls="text-gray-300" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#f59e0b33', background: '#f59e0b0d' }}>
          <div className="text-[11.5px] font-bold text-amber-300">이 원천에 없는 것 — 먼저 적는다</div>
          <div className="mt-1 space-y-1">
            {src.missing.map((m) => (
              <div key={m.ko} className="break-keep text-[11.5px] leading-relaxed text-gray-400">
                <b className="text-amber-200">{m.ko}</b> — <Emph t={m.why} cls="text-amber-100" />
              </div>
            ))}
          </div>
          <div className="mt-1.5 break-keep text-[11.5px] leading-relaxed text-gray-500">
            「이 표준을 지원합니다」는 대개 <b className="text-gray-400">무엇을 못 받는지</b>를 안 적어서 성립합니다.
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2.5">
          <div className="text-[11.5px] font-bold text-gray-200">세 원천을 합치면</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {cov.filled.map((t) => (
              <span key={t} className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-1.5 break-keep text-[11.5px] leading-relaxed text-gray-500">
            노드 타입 <b className="text-gray-300">{cov.filled.length}종</b>을 채웁니다. 나머지는 원천이 아니라{' '}
            <b className="text-gray-300">판단</b>이 만듭니다 — 판정·성과·조치는 사람과 규칙이 만드는 것이라 어느 표준에도 없습니다.{' '}
            <b className="text-gray-400">그 빈자리가 이 온톨로지의 존재 이유입니다.</b>
          </div>
        </div>
      </div>
    </div>
  )
}
