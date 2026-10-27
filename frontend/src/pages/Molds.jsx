import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Boxes, Eye, Pencil, Plus, RotateCcw, Search, SearchX, X } from 'lucide-react'
import { moldsApi, suppliersApi } from '../api'
import { parseApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAsync, useDebounced } from '../hooks/useAsync.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { daysUntil, formatDate, formatMoney } from '../utils/format.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import { TableSkeleton } from '../components/ui/Skeleton.jsx'
import { EmptyState, ErrorState } from '../components/ui/States.jsx'
import { PaymentBadge, StatusBadge } from '../components/ui/Badge.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import MoldFormModal, { MOLD_STATUSES, PAYMENT_STATUSES } from '../components/MoldFormModal.jsx'

const SORTABLE = ['code', 'name', 'status', 'supplier', 'deadline', 'cost']
const DEFAULTS = { sort: 'code', order: 'asc', page: '1', page_size: '20', archived: 'false' }

function SortHeader({ field, label, sort, order, onSort, className = '' }) {
    const { t } = useTranslation()
    const active = sort === field
    const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown
    return (
        <th scope="col" className={`th ${className}`} aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-slate-900 dark:hover:text-white" title={t('molds.sort_by', { field: label })}>
                {label}
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-600 dark:text-brand-400' : 'opacity-40'}`} aria-hidden="true" />
            </button>
        </th>
    )
}

export default function Molds() {
    const { t, i18n } = useTranslation()
    usePageTitle(t('nav.molds'))
    const lng = i18n.language
    const navigate = useNavigate()
    const toast = useToast()
    const { can } = useAuth()
    const [params, setParams] = useSearchParams()

    const get = (key) => params.get(key) ?? DEFAULTS[key] ?? ''
    const sort = SORTABLE.includes(get('sort')) ? get('sort') : DEFAULTS.sort
    const order = get('order') === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, Number(get('page')) || 1)
    const pageSize = [10, 20, 50].includes(Number(get('page_size'))) ? Number(get('page_size')) : 20
    const status = MOLD_STATUSES.includes(get('status')) ? get('status') : ''
    const payment = PAYMENT_STATUSES.includes(get('payment_status')) ? get('payment_status') : ''
    const supplierId = get('supplier_id')
    const archived = ['true', 'all'].includes(get('archived')) ? get('archived') : 'false'

    const [searchText, setSearchText] = useState(params.get('search') || '')
    const debouncedSearch = useDebounced(searchText.trim(), 300)

    const update = (changes, { keepPage = false } = {}) => {
        const next = new URLSearchParams(params)
        Object.entries(changes).forEach(([k, v]) => {
            if (v === '' || v === undefined || v === null || v === DEFAULTS[k]) next.delete(k)
            else next.set(k, String(v))
        })
        if (!keepPage && !('page' in changes)) next.delete('page')
        setParams(next, { replace: true })
    }

    // keep the URL in sync with the (debounced) search box
    useEffect(() => {
        if ((params.get('search') || '') !== debouncedSearch) update({ search: debouncedSearch })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch])

    const query = useMemo(
        () => ({ search: debouncedSearch || undefined, status: status || undefined, payment_status: payment || undefined, supplier_id: supplierId || undefined, archived, sort, order, page, page_size: pageSize }),
        [debouncedSearch, status, payment, supplierId, archived, sort, order, page, pageSize],
    )

    const { data, error, loading, reload } = useAsync(() => moldsApi.list(query), [query])
    const { data: suppliers } = useAsync(() => suppliersApi.list(), [])

    const [editing, setEditing] = useState(null)
    const [creating, setCreating] = useState(false)
    const [archiving, setArchiving] = useState(null)
    const [busy, setBusy] = useState(false)

    const onSort = (field) => update(field === sort ? { order: order === 'asc' ? 'desc' : 'asc' } : { sort: field, order: 'asc' })
    const hasFilters = Boolean(debouncedSearch || status || payment || supplierId || archived !== 'false')
    const clearFilters = () => {
        setSearchText('')
        setParams(new URLSearchParams(), { replace: true })
    }

    const confirmArchive = async () => {
        setBusy(true)
        try {
            await moldsApi.archive(archiving.id)
            toast.success(t('molds.archived_toast', { code: archiving.code }))
            setArchiving(null)
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
        } finally {
            setBusy(false)
        }
    }

    // The list rows omit long text fields (notes), so load the full record before editing.
    const openEdit = async (m) => {
        try {
            setEditing((await moldsApi.get(m.id)).data)
        } catch (err) {
            toast.error(parseApiError(err).message)
        }
    }

    const restore = async (m) => {
        try {
            await moldsApi.restore(m.id)
            toast.success(t('molds.restored_toast', { code: m.code }))
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
        }
    }

    const rows = data?.data || []
    const meta = data?.meta

    return (
        <>
            <PageHeader
                title={t('molds.title')}
                subtitle={meta ? t('molds.subtitle', { count: meta.total }) : t('molds.subtitle_loading')}
                actions={
                    can('molds:write') && (
                        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {t('molds.new')}
                        </button>
                    )
                }
            />

            <div className="card">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center" role="search">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input type="search" className="input !pl-9" placeholder={t('molds.search_placeholder')} aria-label={t('molds.search_label')} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
                        <select className="input lg:!w-36" aria-label={t('molds.f_status')} value={status} onChange={(e) => update({ status: e.target.value })}>
                            <option value="">{t('molds.all_statuses')}</option>
                            {MOLD_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {t(`status.${s}`)}
                                </option>
                            ))}
                        </select>
                        <select className="input lg:!w-44" aria-label={t('molds.f_supplier')} value={supplierId} onChange={(e) => update({ supplier_id: e.target.value })}>
                            <option value="">{t('molds.all_suppliers')}</option>
                            {(suppliers?.data || []).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        <select className="input lg:!w-36" aria-label={t('molds.f_payment')} value={payment} onChange={(e) => update({ payment_status: e.target.value })}>
                            <option value="">{t('molds.all_payments')}</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {t(`payment.${s}`)}
                                </option>
                            ))}
                        </select>
                        <select className="input lg:!w-36" aria-label={t('molds.register')} value={archived} onChange={(e) => update({ archived: e.target.value })}>
                            <option value="false">{t('molds.register_active')}</option>
                            <option value="true">{t('molds.register_archived')}</option>
                            <option value="all">{t('molds.register_all')}</option>
                        </select>
                    </div>
                    {hasFilters && (
                        <button type="button" className="btn-ghost" onClick={clearFilters}>
                            <X className="h-4 w-4" aria-hidden="true" />
                            {t('common.clear')}
                        </button>
                    )}
                </div>

                <div className="relative overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left">
                        <caption className="sr-only">{t('molds.title')}</caption>
                        <thead className="bg-slate-50 dark:bg-slate-900/60">
                            <tr>
                                <SortHeader field="code" label={t('molds.f_code')} sort={sort} order={order} onSort={onSort} />
                                <SortHeader field="name" label={t('molds.f_name')} sort={sort} order={order} onSort={onSort} />
                                <SortHeader field="status" label={t('molds.f_status')} sort={sort} order={order} onSort={onSort} />
                                <SortHeader field="supplier" label={t('molds.f_supplier')} sort={sort} order={order} onSort={onSort} />
                                <SortHeader field="deadline" label={t('molds.f_deadline')} sort={sort} order={order} onSort={onSort} />
                                <SortHeader field="cost" label={t('molds.col_cost')} sort={sort} order={order} onSort={onSort} className="text-right" />
                                <th scope="col" className="th">
                                    {t('molds.f_payment')}
                                </th>
                                <th scope="col" className="th text-right">
                                    <span className="sr-only">{t('common.actions')}</span>
                                </th>
                            </tr>
                        </thead>
                        {loading && !data ? (
                            <TableSkeleton rows={8} cols={8} />
                        ) : (
                            <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
                                {rows.map((m) => {
                                    const days = daysUntil(m.deadline)
                                    const open = ['trial', 'revision', 'maintenance'].includes(m.status)
                                    const overdue = open && days !== null && days < 0
                                    return (
                                        <tr key={m.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="td whitespace-nowrap font-medium">
                                                <Link to={`/molds/${m.id}`} className="text-brand-700 hover:underline dark:text-brand-300">
                                                    {m.code}
                                                </Link>
                                            </td>
                                            <td className="td max-w-[280px]">
                                                <p className="truncate font-medium text-slate-900 dark:text-white">{m.name}</p>
                                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{[m.project, m.material].filter(Boolean).join(' · ') || '—'}</p>
                                            </td>
                                            <td className="td">
                                                <div className="flex items-center gap-1.5">
                                                    <StatusBadge value={m.status} />
                                                    {m.is_archived && <span className="badge bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300">{t('molds.archived_badge')}</span>}
                                                </div>
                                            </td>
                                            <td className="td">{m.supplier_name || <span className="text-slate-500 dark:text-slate-400">—</span>}</td>
                                            <td className={`td whitespace-nowrap ${overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}`}>
                                                {formatDate(m.deadline, lng)}
                                                {overdue && <span className="block text-xs">{t('common.days_overdue', { count: Math.abs(days) })}</span>}
                                            </td>
                                            <td className="td text-right tabular-nums">{formatMoney(m.cost, lng)}</td>
                                            <td className="td">
                                                <PaymentBadge value={m.payment_status} />
                                            </td>
                                            <td className="td">
                                                <div className="flex justify-end gap-0.5">
                                                    <button type="button" className="btn-icon" onClick={() => navigate(`/molds/${m.id}`)} aria-label={t('molds.view_mold', { code: m.code })} title={t('common.view')}>
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {can('molds:write') && !m.is_archived && (
                                                        <button type="button" className="btn-icon" onClick={() => openEdit(m)} aria-label={t('molds.edit_mold', { code: m.code })} title={t('common.edit')}>
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {can('molds:archive') && !m.is_archived && (
                                                        <button type="button" className="btn-icon hover:!text-red-600" onClick={() => setArchiving(m)} aria-label={t('molds.archive_mold', { code: m.code })} title={t('molds.archive')}>
                                                            <Archive className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {can('molds:restore') && m.is_archived && (
                                                        <button type="button" className="btn-icon" onClick={() => restore(m)} aria-label={t('molds.restore_mold', { code: m.code })} title={t('molds.restore')}>
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        )}
                    </table>
                </div>

                {error && !data && <ErrorState error={error} onRetry={reload} />}
                {error && data && (
                    <p role="alert" className="border-t border-slate-200 px-4 py-2 text-sm text-red-600 dark:border-slate-800">
                        {error.message}
                    </p>
                )}
                {!loading && !error && rows.length === 0 && (
                    <EmptyState
                        icon={hasFilters ? SearchX : Boxes}
                        title={hasFilters ? t('molds.empty_filtered_title') : t('molds.empty_title')}
                        message={hasFilters ? t('molds.empty_filtered_message') : t('molds.empty_message')}
                        action={
                            hasFilters ? (
                                <button type="button" className="btn-secondary" onClick={clearFilters}>
                                    {t('common.clear')}
                                </button>
                            ) : (
                                can('molds:write') && (
                                    <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                                        <Plus className="h-4 w-4" aria-hidden="true" />
                                        {t('molds.new')}
                                    </button>
                                )
                            )
                        }
                    />
                )}
                {meta && rows.length > 0 && <Pagination meta={meta} onPage={(p) => update({ page: p }, { keepPage: true })} onPageSize={(s) => update({ page_size: s })} />}
            </div>

            <MoldFormModal
                open={creating || Boolean(editing)}
                mold={editing}
                onClose={() => {
                    setCreating(false)
                    setEditing(null)
                }}
                onSaved={(saved) => {
                    const wasCreating = creating
                    setCreating(false)
                    setEditing(null)
                    if (wasCreating) navigate(`/molds/${saved.id}`)
                    else reload()
                }}
            />
            <ConfirmDialog
                open={Boolean(archiving)}
                danger
                busy={busy}
                title={t('molds.archive_title')}
                message={archiving ? t('molds.archive_message', { code: archiving.code, name: archiving.name }) : ''}
                confirmLabel={t('molds.archive')}
                onConfirm={confirmArchive}
                onCancel={() => setArchiving(null)}
            />
        </>
    )
}
