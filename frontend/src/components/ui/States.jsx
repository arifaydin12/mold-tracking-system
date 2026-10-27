import { useTranslation } from 'react-i18next'
import { AlertTriangle, Inbox } from 'lucide-react'

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            {message && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}

/** error: the object returned by parseApiError(). */
export function ErrorState({ error, onRetry, compact = false }) {
    const { t } = useTranslation()
    const forbidden = error?.status === 403
    const network = error?.code === 'network_error'
    const title = forbidden ? t('errors.forbidden_title') : network ? t('errors.network_title') : t('errors.generic_title')
    const message = forbidden ? t('errors.forbidden_message') : network ? t('errors.network_message') : error?.message || t('errors.generic_message')
    return (
        <div role="alert" className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
            {onRetry && !forbidden && (
                <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
                    {t('common.retry')}
                </button>
            )}
        </div>
    )
}
