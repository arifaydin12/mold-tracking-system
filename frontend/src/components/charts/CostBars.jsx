import { formatMoney } from '../../utils/format.js'

/**
 * Horizontal stacked bars: purchase cost + revision cost per supplier.
 * rows: [{ label, primary, secondary, total }]
 */
export default function CostBars({ rows, primaryLabel, secondaryLabel, lng, ariaLabel }) {
    const max = Math.max(1, ...rows.map((r) => r.primary + r.secondary))
    return (
        <div role="img" aria-label={ariaLabel}>
            <ul className="space-y-3">
                {rows.map((r) => {
                    const total = r.primary + r.secondary
                    return (
                        <li key={r.label}>
                            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
                                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{formatMoney(total, lng, { compact: true })}</span>
                            </div>
                            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full bg-brand-500" style={{ width: `${(r.primary / max) * 100}%` }} />
                                <div className="h-full bg-violet-400" style={{ width: `${(r.secondary / max) * 100}%` }} />
                            </div>
                        </li>
                    )
                })}
            </ul>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden="true" />
                    {primaryLabel}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-400" aria-hidden="true" />
                    {secondaryLabel}
                </span>
            </div>
        </div>
    )
}
