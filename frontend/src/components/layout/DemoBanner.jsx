import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { isDemo } from '../../api/client.js'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'

/** Resets the in-browser demo database and returns to the sign-in screen. */
export function useDemoReset() {
    const [busy, setBusy] = useState(false)
    const reset = async () => {
        // The literal comparison lets the bundler drop the demo store from non-demo builds.
        if (import.meta.env.VITE_DEMO !== 'true') return
        setBusy(true)
        const { resetDemo } = await import('../../demo/store.js')
        await resetDemo()
        try {
            localStorage.removeItem('mts.session')
        } catch {
            /* ignore */
        }
        window.location.hash = '#/login'
        window.location.reload()
    }
    return { busy, reset }
}

/** Pill that is always visible in the demo build. */
export function DemoBadge({ className = '' }) {
    const { t } = useTranslation()
    if (!isDemo) return null
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200 ${className}`}>
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            {t('demo.badge')}
        </span>
    )
}

export default function DemoBanner() {
    const { t } = useTranslation()
    const [confirming, setConfirming] = useState(false)
    const { busy, reset } = useDemoReset()
    if (!isDemo) return null
    return (
        <>
            <div role="region" aria-label={t('demo.badge')} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200" data-testid="demo-banner">
                <span className="flex items-center gap-1.5 font-medium">
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('demo.badge')}
                </span>
                <button type="button" className="inline-flex items-center gap-1 rounded font-semibold underline-offset-2 hover:underline" onClick={() => setConfirming(true)}>
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    {t('demo.reset')}
                </button>
            </div>
            <ConfirmDialog open={confirming} title={t('demo.reset_title')} message={t('demo.reset_message')} confirmLabel={t('demo.reset')} busy={busy} danger onConfirm={reset} onCancel={() => setConfirming(false)} />
        </>
    )
}
