import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../utils/format.js'

const PAGE_SIZES = [10, 20, 50]

/** Page numbers to show: always first/last, a window around the current page, "…" for gaps. */
export function pageWindow(page, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = new Set([1, totalPages, page - 1, page, page + 1])
    if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
    if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p))
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
    const out = []
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
        out.push(p)
    })
    return out
}

export default function Pagination({ meta, onPage, onPageSize, sizes = PAGE_SIZES }) {
    const { t, i18n } = useTranslation()
    if (!meta) return null
    const { page, page_size: pageSize, total, total_pages: totalPages } = meta
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(total, page * pageSize)
    const lng = i18n.language

    return (
        <nav className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row" aria-label={t('common.pagination')}>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <p>{t('common.showing', { from: formatNumber(from, lng), to: formatNumber(to, lng), total: formatNumber(total, lng) })}</p>
                {onPageSize && (
                    <label className="hidden items-center gap-2 sm:flex">
                        <span>{t('common.rows_per_page')}</span>
                        <select className="input !w-auto !py-1" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
                            {sizes.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            <div className="flex items-center gap-1">
                <button type="button" className="btn-icon" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('common.previous')}>
                    <ChevronLeft className="h-4 w-4" />
                </button>
                {pageWindow(page, totalPages).map((p, i) =>
                    p === '…' ? (
                        <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden="true">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p)}
                            aria-current={p === page ? 'page' : undefined}
                            aria-label={t('common.page_n', { n: p })}
                            className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors ${
                                p === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                        >
                            {p}
                        </button>
                    ),
                )}
                <button type="button" className="btn-icon" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label={t('common.next')}>
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </nav>
    )
}
