import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Pencil, Plus, Power, Search, SearchX, UserX, Users as UsersIcon } from 'lucide-react'
import { usersApi } from '../api'
import { parseApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { formatDateTime, initials } from '../utils/format.js'
import { ROLES } from '../utils/permissions.js'
import { cleanPayload, passwordProblem, validateUser } from '../utils/validation.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { TableSkeleton } from '../components/ui/Skeleton.jsx'
import { EmptyState, ErrorState } from '../components/ui/States.jsx'
import { Badge, RoleBadge } from '../components/ui/Badge.jsx'
import Modal from '../components/ui/Modal.jsx'
import Field from '../components/ui/Field.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'

function UserFormModal({ open, user, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const editing = Boolean(user)
    const [values, setValues] = useState({})
    const [errors, setErrors] = useState({})
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!open) return
        setValues(user ? { full_name: user.full_name, email: user.email ?? '', department: user.department ?? '', role: user.role } : { username: '', password: '', full_name: '', email: '', department: '', role: 'viewer' })
        setErrors({})
    }, [open, user])

    const set = (f) => (e) => setValues((v) => ({ ...v, [f]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        const found = validateUser(values, { creating: !editing })
        setErrors(found)
        if (Object.keys(found).length) return
        setBusy(true)
        try {
            const payload = cleanPayload(values, { nullable: ['email', 'department'] })
            const res = editing ? await usersApi.update(user.id, payload) : await usersApi.create(payload)
            toast.success(editing ? t('users.saved_toast', { name: res.data.full_name }) : t('users.created_toast', { name: res.data.full_name }))
            onSaved()
        } catch (err) {
            const parsed = parseApiError(err)
            if (Object.keys(parsed.fields).length) setErrors(parsed.fields)
            else if (parsed.status === 409) setErrors(editing ? {} : { username: parsed.message })
            if (!Object.keys(parsed.fields).length) toast.error(parsed.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            busy={busy}
            title={editing ? t('users.edit_title') : t('users.new_title')}
            description={editing ? `@${user.username}` : t('users.new_description')}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="user-form" className="btn-primary" disabled={busy}>
                        {busy && <Spinner />}
                        {editing ? t('common.save_changes') : t('users.create')}
                    </button>
                </>
            }
        >
            <form id="user-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
                {!editing && (
                    <>
                        <Field label={t('users.f_username')} error={errors.username} required hint={t('users.username_hint')}>
                            <input className="input" value={values.username ?? ''} onChange={set('username')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                        </Field>
                        <Field label={t('users.f_password')} error={errors.password} required hint={t('validation.password_hint')}>
                            <input className="input" type="password" value={values.password ?? ''} onChange={set('password')} autoComplete="new-password" />
                        </Field>
                    </>
                )}
                <Field label={t('users.f_full_name')} error={errors.full_name} required>
                    <input className="input" value={values.full_name ?? ''} onChange={set('full_name')} maxLength={100} />
                </Field>
                <Field label={t('users.f_email')} error={errors.email}>
                    <input className="input" type="email" value={values.email ?? ''} onChange={set('email')} maxLength={120} />
                </Field>
                <Field label={t('users.f_department')} error={errors.department}>
                    <input className="input" value={values.department ?? ''} onChange={set('department')} maxLength={60} />
                </Field>
                <Field label={t('users.f_role')} error={errors.role}>
                    <select className="input" value={values.role ?? 'viewer'} onChange={set('role')}>
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {t(`roles.${r}`)}
                            </option>
                        ))}
                    </select>
                </Field>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">{t(`roles.${values.role || 'viewer'}_desc`)}</p>
            </form>
        </Modal>
    )
}

function ResetPasswordModal({ user, onClose }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        setPassword('')
        setError(null)
    }, [user])

    const submit = async (e) => {
        e.preventDefault()
        const problem = passwordProblem(password)
        setError(problem)
        if (problem) return
        setBusy(true)
        try {
            await usersApi.resetPassword(user.id, password)
            toast.success(t('users.reset_toast', { name: user.full_name }))
            onClose()
        } catch (err) {
            const parsed = parseApiError(err)
            setError(parsed.fields.new_password || parsed.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open={Boolean(user)}
            onClose={onClose}
            busy={busy}
            size="sm"
            title={t('users.reset_title')}
            description={user ? `${user.full_name} (@${user.username})` : ''}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="reset-form" className="btn-primary" disabled={busy}>
                        {busy && <Spinner />}
                        {t('users.reset_action')}
                    </button>
                </>
            }
        >
            <form id="reset-form" onSubmit={submit} noValidate className="space-y-3">
                <Field label={t('users.f_new_password')} error={error} required hint={t('validation.password_hint')}>
                    <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </Field>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('users.reset_note')}</p>
            </form>
        </Modal>
    )
}

export default function UsersPage() {
    const { t, i18n } = useTranslation()
    usePageTitle(t('nav.users'))
    const lng = i18n.language
    const toast = useToast()
    const { user: me } = useAuth()

    const [search, setSearch] = useState('')
    const debounced = useDebounced(search.trim(), 300)
    const [role, setRole] = useState('')
    const [active, setActive] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [formUser, setFormUser] = useState(undefined) // undefined = closed, null = create
    const [resetUser, setResetUser] = useState(null)
    const [toggling, setToggling] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => setPage(1), [debounced, role, active, pageSize])

    const query = useMemo(
        () => ({ search: debounced || undefined, role: role || undefined, is_active: active || undefined, page, page_size: pageSize, sort: 'full_name', order: 'asc' }),
        [debounced, role, active, page, pageSize],
    )
    const { data, error, loading, reload } = useAsync(() => usersApi.list(query), [query])
    const rows = data?.data || []
    const hasFilters = Boolean(debounced || role || active)

    const toggleActive = async () => {
        setBusy(true)
        try {
            await usersApi.update(toggling.id, { is_active: !toggling.is_active })
            toast.success(toggling.is_active ? t('users.deactivated_toast', { name: toggling.full_name }) : t('users.activated_toast', { name: toggling.full_name }))
            setToggling(null)
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
            setToggling(null)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <PageHeader
                title={t('users.title')}
                subtitle={data ? t('users.subtitle', { count: data.meta.total }) : t('users.subtitle_loading')}
                actions={
                    <button type="button" className="btn-primary" onClick={() => setFormUser(null)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('users.new')}
                    </button>
                }
            />
            <div className="card">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row" role="search">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input type="search" className="input !pl-9" placeholder={t('users.search_placeholder')} aria-label={t('users.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <select className="input sm:!w-40" aria-label={t('users.f_role')} value={role} onChange={(e) => setRole(e.target.value)}>
                        <option value="">{t('users.all_roles')}</option>
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {t(`roles.${r}`)}
                            </option>
                        ))}
                    </select>
                    <select className="input sm:!w-40" aria-label={t('users.f_status')} value={active} onChange={(e) => setActive(e.target.value)}>
                        <option value="">{t('users.all_statuses')}</option>
                        <option value="true">{t('users.active')}</option>
                        <option value="false">{t('users.inactive')}</option>
                    </select>
                </div>

                <div className="relative overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                        <caption className="sr-only">{t('users.title')}</caption>
                        <thead className="bg-slate-50 dark:bg-slate-900/60">
                            <tr>
                                <th scope="col" className="th">{t('users.f_user')}</th>
                                <th scope="col" className="th">{t('users.f_role')}</th>
                                <th scope="col" className="th">{t('users.f_department')}</th>
                                <th scope="col" className="th">{t('users.f_status')}</th>
                                <th scope="col" className="th">{t('users.f_last_login')}</th>
                                <th scope="col" className="th text-right"><span className="sr-only">{t('common.actions')}</span></th>
                            </tr>
                        </thead>
                        {loading && !data ? (
                            <TableSkeleton rows={6} cols={6} />
                        ) : (
                            <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? 'opacity-60' : ''}`}>
                                {rows.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="td">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
                                                    {initials(u.full_name)}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-900 dark:text-white">
                                                        {u.full_name}
                                                        {u.id === me.id && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">({t('users.you')})</span>}
                                                    </p>
                                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="td"><RoleBadge value={u.role} /></td>
                                        <td className="td">{u.department || <span className="text-slate-500 dark:text-slate-400">—</span>}</td>
                                        <td className="td"><Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? t('users.active') : t('users.inactive')}</Badge></td>
                                        <td className="td whitespace-nowrap">{u.last_login_at ? formatDateTime(u.last_login_at, lng) : <span className="text-slate-500 dark:text-slate-400">{t('users.never')}</span>}</td>
                                        <td className="td">
                                            <div className="flex justify-end gap-0.5">
                                                <button type="button" className="btn-icon" onClick={() => setFormUser(u)} aria-label={t('users.edit_user', { name: u.full_name })} title={t('common.edit')}>
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button type="button" className="btn-icon" onClick={() => setResetUser(u)} aria-label={t('users.reset_for', { name: u.full_name })} title={t('users.reset_title')}>
                                                    <KeyRound className="h-4 w-4" />
                                                </button>
                                                {u.id !== me.id && (
                                                    <button type="button" className={`btn-icon ${u.is_active ? 'hover:!text-red-600' : 'hover:!text-emerald-600'}`} onClick={() => setToggling(u)} aria-label={u.is_active ? t('users.deactivate_user', { name: u.full_name }) : t('users.activate_user', { name: u.full_name })} title={u.is_active ? t('users.deactivate') : t('users.activate')}>
                                                        {u.is_active ? <UserX className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        )}
                    </table>
                </div>
                {error && !data && <ErrorState error={error} onRetry={reload} />}
                {!loading && !error && rows.length === 0 && <EmptyState icon={hasFilters ? SearchX : UsersIcon} title={t('users.empty_title')} message={hasFilters ? t('molds.empty_filtered_message') : undefined} />}
                {data && rows.length > 0 && <Pagination meta={data.meta} onPage={setPage} onPageSize={setPageSize} />}
            </div>

            <UserFormModal
                open={formUser !== undefined}
                user={formUser}
                onClose={() => setFormUser(undefined)}
                onSaved={() => {
                    setFormUser(undefined)
                    reload()
                }}
            />
            <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
            <ConfirmDialog
                open={Boolean(toggling)}
                danger={toggling?.is_active}
                busy={busy}
                title={toggling?.is_active ? t('users.deactivate_title') : t('users.activate_title')}
                message={toggling ? (toggling.is_active ? t('users.deactivate_message', { name: toggling.full_name }) : t('users.activate_message', { name: toggling.full_name })) : ''}
                confirmLabel={toggling?.is_active ? t('users.deactivate') : t('users.activate')}
                onConfirm={toggleActive}
                onCancel={() => setToggling(null)}
            />
        </>
    )
}
