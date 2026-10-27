import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarClock, History, ShieldCheck, Wrench } from 'lucide-react'
import { isDemo, parseApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'
import Field from '../components/ui/Field.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { RoleBadge } from '../components/ui/Badge.jsx'
import { LanguageSwitcher, ThemeToggle } from '../components/layout/Controls.jsx'
import { DemoBadge } from '../components/layout/DemoBanner.jsx'

const DEMO_ACCOUNTS = [
    { username: 'admin', role: 'admin' },
    { username: 'engineer', role: 'engineer' },
    { username: 'viewer', role: 'viewer' },
]
const DEMO_PASSWORD = 'Demo-2026'

export default function Login() {
    const { t } = useTranslation()
    usePageTitle(t('auth.sign_in'))
    const { status, login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [values, setValues] = useState({ username: '', password: '' })
    const [errors, setErrors] = useState({})
    const [formError, setFormError] = useState(null)
    const [busy, setBusy] = useState(false)

    if (status === 'authenticated') return <Navigate to={location.state?.from || '/'} replace />

    const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        const next = {}
        if (!values.username.trim()) next.username = { key: 'required' }
        if (!values.password) next.password = { key: 'required' }
        setErrors(next)
        setFormError(null)
        if (Object.keys(next).length) return

        setBusy(true)
        try {
            await login(values.username.trim(), values.password)
            navigate(location.state?.from || '/', { replace: true })
        } catch (err) {
            const parsed = parseApiError(err)
            setFormError(parsed.status === 401 ? t('auth.invalid_credentials') : parsed.status === 429 ? t('auth.too_many_attempts') : parsed.code === 'network_error' ? t('errors.network_message') : parsed.message)
            setBusy(false)
        }
    }

    const features = [
        { icon: History, title: t('auth.feature_history_title'), text: t('auth.feature_history_text') },
        { icon: CalendarClock, title: t('auth.feature_deadlines_title'), text: t('auth.feature_deadlines_text') },
        { icon: Wrench, title: t('auth.feature_maintenance_title'), text: t('auth.feature_maintenance_text') },
        { icon: ShieldCheck, title: t('auth.feature_audit_title'), text: t('auth.feature_audit_text') },
    ]

    return (
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" aria-hidden="true" />
                <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-10 w-10 rounded-xl" />
                    <span className="text-lg font-semibold">{t('app.name')}</span>
                </div>
                <div className="relative max-w-lg">
                    <h2 className="text-4xl font-semibold leading-tight tracking-tight">{t('auth.hero_title')}</h2>
                    <p className="mt-4 text-lg text-brand-100">{t('auth.hero_text')}</p>
                    <ul className="mt-10 grid gap-6 sm:grid-cols-2">
                        {features.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold">{title}</span>
                                    <span className="block text-sm text-brand-100/90">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="relative text-sm text-brand-200/80">{t('auth.footer')}</p>
            </aside>

            <main className="flex flex-col px-6 py-6 sm:px-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 lg:invisible">
                        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8 rounded-lg" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('app.short_name')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>

                <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
                    <DemoBadge className="mb-6 self-start" />
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{t('auth.title')}</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('auth.subtitle')}</p>

                    <form onSubmit={submit} noValidate className="mt-8 space-y-5">
                        {formError && (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                {formError}
                            </div>
                        )}
                        <Field label={t('auth.username')} error={errors.username} required>
                            <input className="input" value={values.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus />
                        </Field>
                        <Field label={t('auth.password')} error={errors.password} required>
                            <input className="input" type="password" value={values.password} onChange={set('password')} autoComplete="current-password" />
                        </Field>
                        <button type="submit" className="btn-primary w-full !py-2.5" disabled={busy}>
                            {busy && <Spinner />}
                            {busy ? t('auth.signing_in') : t('auth.sign_in')}
                        </button>
                    </form>

                    {isDemo && (
                        <section className="mt-8 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700" aria-labelledby="demo-accounts">
                            <h2 id="demo-accounts" className="text-sm font-semibold text-slate-900 dark:text-white">
                                {t('auth.demo_accounts')}
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('auth.demo_hint', { password: DEMO_PASSWORD })}</p>
                            <ul className="mt-3 space-y-2">
                                {DEMO_ACCOUNTS.map((a) => (
                                    <li key={a.username} className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2">
                                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{a.username}</code>
                                            <RoleBadge value={a.role} />
                                        </span>
                                        <button type="button" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setValues({ username: a.username, password: DEMO_PASSWORD })}>
                                            {t('auth.fill_in')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </main>
        </div>
    )
}
