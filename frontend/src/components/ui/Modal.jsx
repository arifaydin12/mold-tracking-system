import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

/**
 * Accessible modal dialog: focus moves into it, Tab is trapped, Escape closes it and focus
 * returns to the element that opened it. Clicking the backdrop also closes it.
 */
export default function Modal({ open, onClose, title, description, size = 'md', children, footer, busy = false }) {
    const { t } = useTranslation()
    const titleId = useId()
    const descId = useId()
    const panelRef = useRef(null)
    const returnFocus = useRef(null)
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!open) return undefined
        returnFocus.current = document.activeElement
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // Focus the first form field, falling back to the first focusable control (the close button).
        const panel = panelRef.current
        const firstField = panel?.querySelector('input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])')
        ;(firstField || panel?.querySelector(FOCUSABLE) || panel)?.focus()

        const onKey = (e) => {
            if (e.key === 'Escape' && !busy) {
                e.stopPropagation()
                onCloseRef.current?.()
                return
            }
            if (e.key !== 'Tab' || !panel) return
            const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.type !== 'hidden' && el.getAttribute('aria-hidden') !== 'true')
            if (!items.length) return
            const first = items[0]
            const last = items[items.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
            returnFocus.current?.focus?.()
        }
    }, [open, busy])

    if (!open) return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]" onMouseDown={() => !busy && onClose?.()} aria-hidden="true" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={`relative flex max-h-[92vh] w-full ${SIZES[size]} animate-pop-in flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl`}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
                            {title}
                        </h2>
                        {description && (
                            <p id={descId} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                {description}
                            </p>
                        )}
                    </div>
                    <button type="button" className="btn-icon -mr-2 -mt-1" onClick={onClose} disabled={busy} aria-label={t('common.close')}>
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">{footer}</div>}
            </div>
        </div>,
        document.body,
    )
}
