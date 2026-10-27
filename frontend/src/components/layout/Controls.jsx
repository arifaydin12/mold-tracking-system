import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe, Moon, Sun } from 'lucide-react'
import { LANGUAGES } from '../../i18n.js'
import { useTheme } from '../../context/ThemeContext.jsx'

/** Closes a popover on outside click or Escape. */
function usePopover() {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
        const onKey = (e) => e.key === 'Escape' && setOpen(false)
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])
    return { open, setOpen, ref }
}

export function LanguageSwitcher({ align = 'right' }) {
    const { t, i18n } = useTranslation()
    const { open, setOpen, ref } = usePopover()
    const current = (i18n.resolvedLanguage || 'en').slice(0, 2)

    return (
        <div className="relative" ref={ref}>
            <button type="button" className="btn-ghost !px-2.5" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`${t('common.language')} ${current.toUpperCase()}`}>
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase">{current}</span>
            </button>
            {open && (
                <div
                    role="menu"
                    aria-label={t('common.language')}
                    className={`absolute z-40 mt-2 w-40 animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    {LANGUAGES.map((l) => (
                        <button
                            key={l.code}
                            type="button"
                            role="menuitemradio"
                            aria-checked={l.code === current}
                            lang={l.code}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                            onClick={() => {
                                i18n.changeLanguage(l.code)
                                setOpen(false)
                            }}
                        >
                            {l.label}
                            {l.code === current && <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function ThemeToggle() {
    const { t } = useTranslation()
    const { resolved, toggle } = useTheme()
    return (
        <button type="button" className="btn-icon" onClick={toggle} aria-label={resolved === 'dark' ? t('theme.switch_to_light') : t('theme.switch_to_dark')} title={resolved === 'dark' ? t('theme.light') : t('theme.dark')}>
            {resolved === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
    )
}
