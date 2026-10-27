/**
 * Donut chart drawn with SVG stroke-dasharray segments (no chart library).
 * segments: [{ key, label, value, color }]
 */
export default function DonutChart({ segments, centerLabel, centerValue, ariaLabel, size = 176, stroke = 22 }) {
    const total = segments.reduce((n, s) => n + s.value, 0)
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    let offset = 0

    return (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
                    {total > 0 &&
                        segments
                            .filter((s) => s.value > 0)
                            .map((s) => {
                                const len = (s.value / total) * c
                                const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0
                                const dash = `${Math.max(len - gap, 0)} ${c - Math.max(len - gap, 0)}`
                                const el = (
                                    <circle
                                        key={s.key}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={r}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={stroke}
                                        strokeDasharray={dash}
                                        strokeDashoffset={-offset}
                                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                                    />
                                )
                                offset += len
                                return el
                            })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{centerValue}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{centerLabel}</span>
                </div>
            </div>
            <ul className="grid w-full gap-2 text-sm">
                {segments.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                            {s.label}
                        </span>
                        <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                            {s.value}
                            {total > 0 && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{Math.round((s.value / total) * 100)}%</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
