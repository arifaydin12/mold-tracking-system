import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { authApi } from '../api'
import { parseApiError } from '../api/client.js'
import { LANGUAGES } from '../i18n.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { PERMISSIONS, can } from '../utils/permissions.js'
import { cleanPayload, validatePasswordChange, validateProfile } from '../utils/validation.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Field from '../components/ui/Field.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import { RoleBadge } from '../components/ui/Badge.jsx'

function Section({ title, description, children }) {
    return (
        <section className="card grid gap-6 p-6 lg:grid-cols-3">
            <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            <div className="lg:col-span-2">{children}</div>
        </section>
    )
}

function ProfileForm() {
    const { t } = useTranslation()
    const toast = useToast()
    const { user, setUser } = useAuth()
    const [values, setValues] = useState({ full_name: user.full_name, email: user.email ?? '', department: user.department ?? '' })
    const [errors, setErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        const found = validateProfile(values)
        setErrors(found)
        if (Object.keys(found).length) return
        setBusy(true)
        try {
            const res = await authApi.updateProfile(cleanPayload(values, { nullable: ['email', 'department'] }))
            setUser(res.user)
            toast.success(t('settings.profile_saved'))
        } catch (err) {
            const parsed = parseApiError(err)
            if (Object.keys(parsed.fields).length) setErrors(parsed.fields)
            else toast.error(parsed.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <Field label={t('users.f_username')}>
                <input className="input" value={user.username} disabled readOnly />
            </Field>
            <div>
                <span className="label">{t('users.f_role')}</span>
                <div className="flex h-[38px] items-center">
                    <RoleBadge value={user.role} />
                </div>
            </div>
            <Field label={t('users.f_full_name')} error={errors.full_name} required>
                <input className="input" value={values.full_name} onChange={set('full_name')} maxLength={100} autoComplete="name" />
            </Field>
            <Field label={t('users.f_email')} error={errors.email}>
                <input className="input" type="email" value={values.email} onChange={set('email')} maxLength={120} autoComplete="email" />
            </Field>
            <Field label={t('users.f_department')} error={errors.department} className="sm:col-span-2">
                <input className="input" value={values.department} onChange={set('department')} maxLength={60} />
            </Field>
            <div className="sm:col-span-2">
                <button type="submit" className="btn-primary" disabled={busy}>
                    {busy && <Spinner />}
                    {t('common.save_changes')}
                </button>
            </div>
        </form>
    )
}

function PasswordForm() {
    const { t } = useTranslation()
    const toast = useToast()
    const { applySession } = useAuth()
    const empty = { current_password: '', new_password: '', confirm_password: '' }
    const [values, setValues] = useState(empty)
    const [errors, setErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        const found = validatePasswordChange(values)
        setErrors(found)
        if (Object.keys(found).length) return
        setBusy(true)
        try {
            const session = await authApi.changePassword({ current_password: values.current_password, new_password: values.new_password })
            applySession(session)
            setValues(empty)
            toast.success(t('settings.password_changed'))
        } catch (err) {
            const parsed = parseApiError(err)
            if (Object.keys(parsed.fields).length) setErrors(parsed.fields)
            else toast.error(parsed.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={submit} noValidate className="max-w-md space-y-4">
            <Field label={t('settings.current_password')} error={errors.current_password} required>
                <input className="input" type="password" value={values.current_password} onChange={set('current_password')} autoComplete="current-password" />
            </Field>
            <Field label={t('settings.new_password')} error={errors.new_password} required hint={t('validation.password_hint')}>
                <input className="input" type="password" value={values.new_password} onChange={set('new_password')} autoComplete="new-password" />
            </Field>
            <Field label={t('settings.confirm_password')} error={errors.confirm_password} required>
                <input className="input" type="password" value={values.confirm_password} onChange={set('confirm_password')} autoComplete="new-password" />
            </Field>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.password_note')}</p>
            <button type="submit" className="btn-primary" disabled={busy}>
                {busy && <Spinner />}
                {t('settings.change_password')}
            </button>
        </form>
    )
}

function Choice({ checked, onChange, children, name, value, lang }) {
    return (
        <label className={`relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-500 ${checked ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-200' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`} lang={lang}>
            <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
            <span className="flex items-center gap-2">{children}</span>
            {checked && <Check className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />}
        </label>
    )
}

export default function SettingsPage() {
    const { t, i18n } = useTranslation()
    usePageTitle(t('nav.settings'))
    const { user } = useAuth()
    const { theme, setTheme } = useTheme()
    const current = (i18n.resolvedLanguage || 'en').slice(0, 2)

    return (
        <>
            <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
            <div className="space-y-6">
                <Section title={t('settings.profile')} description={t('settings.profile_desc')}>
                    <ProfileForm />
                </Section>
                <Section title={t('settings.security')} description={t('settings.security_desc')}>
                    <PasswordForm />
                </Section>
                <Section title={t('settings.language')} description={t('settings.language_desc')}>
                    <fieldset>
                        <legend className="sr-only">{t('settings.language')}</legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {LANGUAGES.map((l) => (
                                <Choice key={l.code} name="language" value={l.code} lang={l.code} checked={current === l.code} onChange={() => i18n.changeLanguage(l.code)}>
                                    {l.label}
                                </Choice>
                            ))}
                        </div>
                    </fieldset>
                </Section>
                <Section title={t('settings.appearance')} description={t('settings.appearance_desc')}>
                    <fieldset>
                        <legend className="sr-only">{t('settings.appearance')}</legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                ['light', Sun],
                                ['dark', Moon],
                                ['system', Monitor],
                            ].map(([value, Icon]) => (
                                <Choice key={value} name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)}>
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                    {t(`theme.${value}`)}
                                </Choice>
                            ))}
                        </div>
                    </fieldset>
                </Section>
                <Section title={t('settings.access')} description={t('settings.access_desc', { role: t(`roles.${user.role}`) })}>
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t(`roles.${user.role}_desc`)}</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {Object.keys(PERMISSIONS).map((p) => {
                            const allowed = can(user.role, p)
                            return (
                                <li key={p} className={`flex items-center gap-2 text-sm ${allowed ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 line-through dark:text-slate-500'}`}>
                                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${allowed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800'}`} aria-hidden="true">
                                        {allowed && <Check className="h-3 w-3" />}
                                    </span>
                                    {t(`settings.perm_${p.replace(':', '_')}`)}
                                    <span className="sr-only">{allowed ? t('settings.allowed') : t('settings.not_allowed')}</span>
                                </li>
                            )
                        })}
                    </ul>
                </Section>
            </div>
        </>
    )
}
