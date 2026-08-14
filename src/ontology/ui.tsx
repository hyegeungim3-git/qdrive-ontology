import { useEffect, type ReactNode } from 'react'

/** 우측 상세 드로어 — ESC·배경 클릭으로 닫힘 */
export function Drawer({
  open,
  title,
  sub,
  onClose,
  children,
}: {
  open: boolean
  title: ReactNode
  sub?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[3000] flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[560px] flex-col border-l border-gray-800 bg-gray-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="상세 보기"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-5 py-3.5">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-black text-gray-50">{title}</div>
            {sub && <div className="mt-0.5 truncate text-[11.5px] text-gray-500">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ✕ 닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  )
}

/** 드로어 내부 섹션 */
export function Sec({ t, right, children }: { t: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-[12px] font-black tracking-wide text-sky-300">{t}</h4>
        {right}
      </div>
      {children}
    </section>
  )
}

