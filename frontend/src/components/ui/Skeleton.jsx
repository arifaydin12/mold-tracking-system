export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={`skeleton ${className}`} aria-hidden="true" />

export function TableSkeleton({ rows = 8, cols = 6 }) {
    return (
        <tbody aria-hidden="true">
            {Array.from({ length: rows }, (_, r) => (
                <tr key={r} className="border-t border-slate-100 dark:border-slate-800">
                    {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="px-4 py-4">
                            <Skeleton className={`h-4 ${c === 1 ? 'w-40' : c === 0 ? 'w-20' : 'w-16'}`} />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    )
}

export function CardSkeleton({ lines = 3, className = '' }) {
    return (
        <div className={`card-padded space-y-3 ${className}`} aria-hidden="true">
            <Skeleton className="h-4 w-1/3" />
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
            ))}
        </div>
    )
}
