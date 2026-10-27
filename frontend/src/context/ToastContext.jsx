import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

const STYLES = {
    success: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
    error: { icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
    info: { icon: Info, cls: 'text-brand-600 dark:text-brand-400' },
}

export function ToastProvider({ children }) {
    const { t } = useTranslation()
    const [toasts, setToasts] = useState([])
    const nextId = useRef(1)

    const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), [])

    const push = useCallback(
        (type, message, { duration = type === 'error' ? 7000 : 4000 } = {}) => {
            const id = nextId.current++
            setToasts((list) => [...list.slice(-3), { id, type, message }])
            if (duration > 0) setTimeout(() => dismiss(id), duration)
            return id
        },
        [dismiss],
    )

    const api = useMemo(
        () => ({
            success: (m, o) => push('success', m, o),
            error: (m, o) => push('error', m, o),
            info: (m, o) => push('info', m, o),
            dismiss,
        }),
        [push, dismiss],
    )

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" aria-atomic="false">
                {toasts.map((toast) => {
                    const { icon: Icon, cls } = STYLES[toast.type]
                    return (
                        <div
                            key={toast.id}
                            role={toast.type === 'error' ? 'alert' : 'status'}
                            className="pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                        >
                            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} aria-hidden="true" />
                            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{toast.message}</p>
                            <button type="button" className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => dismiss(toast.id)} aria-label={t('common.close')}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )
                })}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
    return ctx
}
