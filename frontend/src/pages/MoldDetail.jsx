import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, ArrowLeft, Beaker, Hammer, History, Pencil, Plus, RotateCcw, Trash2, Wrench } from 'lucide-react'
import { moldsApi, recordsApi } from '../api'
import { parseApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { daysUntil, formatDate, formatDateTime, formatMoney, formatNumber } from '../utils/format.js'
import { EmptyState, ErrorState } from '../components/ui/States.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import { MaintenanceStatusBadge, OutcomeBadge, PaymentBadge, StatusBadge } from '../components/ui/Badge.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import MoldFormModal from '../components/MoldFormModal.jsx'
import RecordFormModal from '../components/RecordFormModal.jsx'

const KIND_META = {
    trials: { icon: Beaker, ring: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', type: 'trial' },
    revisions: { icon: Hammer, ring: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', type: 'revision' },
    maintenance: { icon: Wrench, ring: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', type: 'maintenance' },
}
const FILTERS = ['all', 'trials', 'revisions', 'maintenance']

function Detail({ label, children }) {
    return (
        <div className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">{children || <span className="text-slate-500 dark:text-slate-400">—</span>}</dd>
        </div>
    )
}

function Stat({ label, value, sub }) {
    return (
        <div className="card-padded">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
    )
}

function DetailSkeleton() {
    return (
        <div aria-busy="true">
            <Skeleton className="mb-4 h-4 w-24" />
            <Skeleton className="mb-2 h-8 w-72" />
            <Skeleton className="mb-6 h-4 w-48" />
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="card-padded space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-7 w-24" />
                    </div>
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="card-padded space-y-4 lg:col-span-2">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
                <div className="card-padded space-y-3">
                    {Array.from({ length: 8 }, (_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TimelineEntry({ entry, lng, canEdit, canDelete, onEdit, onDelete }) {
    const { t } = useTranslation()
    const { kind, rec } = entry
    const { icon: Icon, ring, type } = KIND_META[kind]
    const future = daysUntil(entry.date) > 0

    const lines = []
    if (kind === 'trials') {
        lines.push([t('records.f_quantity'), formatNumber(rec.quantity, lng)])
        if (rec.material) lines.push([t('records.f_material'), rec.material])
        if (rec.color) lines.push([t('records.f_color'), rec.color])
        if (rec.operator) lines.push([t('records.f_operator'), rec.operator])
    } else if (kind === 'revisions') {
        if (rec.vendor) lines.push([t('records.f_vendor'), rec.vendor])
        lines.push([t('records.f_cost'), formatMoney(rec.cost, lng)])
    } else {
        if (rec.technician) lines.push([t('records.f_technician'), rec.technician])
        if (Number(rec.cost) > 0) lines.push([t('records.f_cost'), formatMoney(rec.cost, lng)])
    }
    const body = kind === 'trials' ? rec.result : kind === 'revisions' ? rec.work_done : rec.description
    const extra = kind === 'revisions' ? rec.notes : null

    return (
        <li className="relative flex gap-4 pb-6 last:pb-0">
            <span className="absolute left-5 top-10 -ml-px h-[calc(100%-2.5rem)] w-px bg-slate-200 last:hidden dark:bg-slate-800" aria-hidden="true" />
            <span className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ring}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t(`records.type_${type}`)}</h3>
                        {kind === 'trials' && <OutcomeBadge value={rec.outcome} />}
                        {kind === 'revisions' && <PaymentBadge value={rec.payment_status} />}
                        {kind === 'maintenance' && <MaintenanceStatusBadge value={rec.status} />}
                        {future && <span className="text-xs font-medium text-brand-600 dark:text-brand-400">{t('records.upcoming')}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <time className="text-xs text-slate-500 dark:text-slate-400" dateTime={entry.date}>
                            {formatDate(entry.date, lng)}
                        </time>
                        {canEdit && (
                            <button type="button" className="btn-icon !h-7 !w-7" onClick={() => onEdit(entry)} aria-label={t('records.edit_entry', { type: t(`records.type_${type}`), date: formatDate(entry.date, lng) })}>
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        )}
                        {canDelete && (
                            <button type="button" className="btn-icon !h-7 !w-7 hover:!text-red-600" onClick={() => onDelete(entry)} aria-label={t('records.delete_entry', { type: t(`records.type_${type}`), date: formatDate(entry.date, lng) })}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                {body && <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{body}</p>}
                {extra && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{extra}</p>}
                {lines.length > 0 && (
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        {lines.map(([k, v]) => (
                            <div key={k} className="flex gap-1.5">
                                <dt className="text-slate-500 dark:text-slate-400">{k}:</dt>
                                <dd className="font-medium text-slate-700 dark:text-slate-200">{v}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </li>
    )
}

export default function MoldDetail() {
    const { id } = useParams()
    const { t, i18n } = useTranslation()
    const lng = i18n.language
    const toast = useToast()
    const { can } = useAuth()
    const { data, error, loading, reload } = useAsync(() => moldsApi.get(id), [id])
    const mold = data?.data
    usePageTitle(mold ? `${mold.code} · ${mold.name}` : t('nav.molds'))

    const [filter, setFilter] = useState('all')
    const [editingMold, setEditingMold] = useState(false)
    const [recordModal, setRecordModal] = useState(null) // { kind, record }
    const [deleting, setDeleting] = useState(null)
    const [archiving, setArchiving] = useState(false)
    const [busy, setBusy] = useState(false)

    const entries = useMemo(() => {
        if (!mold) return []
        const all = [
            ...mold.trials.map((rec) => ({ kind: 'trials', date: rec.trial_date, rec })),
            ...mold.revisions.map((rec) => ({ kind: 'revisions', date: rec.revision_date, rec })),
            ...mold.maintenance.map((rec) => ({ kind: 'maintenance', date: rec.maintenance_date, rec })),
        ]
        return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.rec.id - a.rec.id))
    }, [mold])
    const shown = filter === 'all' ? entries : entries.filter((e) => e.kind === filter)

    if (loading && !data) return <DetailSkeleton />
    if (error && !data) {
        return (
            <>
                <Link to="/molds" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {t('detail.back')}
                </Link>
                <div className="card">
                    <ErrorState error={error.status === 404 ? { ...error, message: t('detail.not_found') } : error} onRetry={reload} />
                </div>
            </>
        )
    }

    const archived = mold.is_archived
    const canWriteRecords = can('records:write') && !archived
    const days = daysUntil(mold.deadline)
    const open = ['trial', 'revision', 'maintenance'].includes(mold.status)
    const counts = { all: entries.length, trials: mold.trials.length, revisions: mold.revisions.length, maintenance: mold.maintenance.length }

    const doArchive = async () => {
        setBusy(true)
        try {
            await moldsApi.archive(mold.id)
            toast.success(t('molds.archived_toast', { code: mold.code }))
            setArchiving(false)
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
        } finally {
            setBusy(false)
        }
    }
    const doRestore = async () => {
        try {
            await moldsApi.restore(mold.id)
            toast.success(t('molds.restored_toast', { code: mold.code }))
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
        }
    }
    const doDeleteRecord = async () => {
        setBusy(true)
        try {
            await recordsApi.remove(mold.id, deleting.kind, deleting.rec.id)
            toast.success(t('records.deleted_toast'))
            setDeleting(null)
            reload()
        } catch (err) {
            toast.error(parseApiError(err).message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <Link to="/molds" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('detail.back')}
            </Link>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{mold.code}</h1>
                        <StatusBadge value={mold.status} />
                        {archived && <span className="badge bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300">{t('molds.archived_badge')}</span>}
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{mold.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {can('molds:write') && !archived && (
                        <button type="button" className="btn-secondary" onClick={() => setEditingMold(true)}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            {t('common.edit')}
                        </button>
                    )}
                    {can('molds:archive') && !archived && (
                        <button type="button" className="btn-secondary !text-red-600 dark:!text-red-400" onClick={() => setArchiving(true)}>
                            <Archive className="h-4 w-4" aria-hidden="true" />
                            {t('molds.archive')}
                        </button>
                    )}
                    {can('molds:restore') && archived && (
                        <button type="button" className="btn-primary" onClick={doRestore}>
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t('molds.restore')}
                        </button>
                    )}
                </div>
            </div>

            {archived && (
                <div role="status" className="mb-6 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {t('detail.archived_notice', { date: formatDate(mold.archived_at, lng) })}
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label={t('detail.stat_purchase')} value={formatMoney(mold.totals.purchase_cost, lng)} sub={<PaymentBadge value={mold.payment_status} />} />
                <Stat label={t('detail.stat_revisions')} value={formatMoney(mold.totals.revision_cost, lng)} sub={t('detail.n_revisions', { count: mold.revisions.length })} />
                <Stat label={t('detail.stat_maintenance')} value={formatMoney(mold.totals.maintenance_cost, lng)} sub={t('detail.n_maintenance', { count: mold.maintenance.length })} />
                <Stat label={t('detail.stat_total')} value={formatMoney(mold.totals.total_cost, lng)} sub={t('detail.n_shots', { count: mold.totals.trial_shots, formatted: formatNumber(mold.totals.trial_shots, lng) })} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="card lg:col-span-2" aria-labelledby="timeline-title">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <h2 id="timeline-title" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                            <History className="h-5 w-5 text-slate-400" aria-hidden="true" />
                            {t('detail.timeline')}
                        </h2>
                        {canWriteRecords && (
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(KIND_META).map((kind) => (
                                    <button key={kind} type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => setRecordModal({ kind, record: null })}>
                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                        {t(`records.${KIND_META[kind].type}_add_short`)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 px-5 pt-4" role="group" aria-label={t('detail.filter_timeline')}>
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                type="button"
                                aria-pressed={filter === f}
                                onClick={() => setFilter(f)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                            >
                                {t(`detail.filter_${f}`)} <span className="opacity-70">{counts[f]}</span>
                            </button>
                        ))}
                    </div>
                    <div className="p-5">
                        {shown.length === 0 ? (
                            <EmptyState icon={History} title={t('detail.empty_timeline_title')} message={canWriteRecords ? t('detail.empty_timeline_message') : undefined} />
                        ) : (
                            <ol aria-label={t('detail.timeline')}>
                                {shown.map((entry) => (
                                    <TimelineEntry
                                        key={`${entry.kind}-${entry.rec.id}`}
                                        entry={entry}
                                        lng={lng}
                                        canEdit={canWriteRecords}
                                        canDelete={can('records:delete') && !archived}
                                        onEdit={(e) => setRecordModal({ kind: e.kind, record: e.rec })}
                                        onDelete={setDeleting}
                                    />
                                ))}
                            </ol>
                        )}
                    </div>
                </section>

                <section className="card h-fit" aria-labelledby="details-title">
                    <h2 id="details-title" className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
                        {t('detail.details')}
                    </h2>
                    <dl className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800">
                        <Detail label={t('molds.f_project')}>{mold.project}</Detail>
                        <Detail label={t('molds.f_supplier')}>{mold.supplier_name}</Detail>
                        <Detail label={t('molds.f_material')}>{mold.material}</Detail>
                        <Detail label={t('molds.f_cavities')}>{mold.cavities}</Detail>
                        <Detail label={t('molds.f_start')}>{mold.start_date && formatDate(mold.start_date, lng)}</Detail>
                        <Detail label={t('molds.f_deadline')}>
                            {mold.deadline && (
                                <span className={open && days < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                                    {formatDate(mold.deadline, lng)}
                                    {open && days < 0 && <span className="block text-xs">{t('common.days_overdue', { count: Math.abs(days) })}</span>}
                                    {open && days >= 0 && days <= 14 && <span className="block text-xs text-amber-700 dark:text-amber-400">{days === 0 ? t('common.due_today') : t('common.days_left', { count: days })}</span>}
                                </span>
                            )}
                        </Detail>
                        <Detail label={t('molds.f_payment')}>
                            <PaymentBadge value={mold.payment_status} />
                        </Detail>
                        <Detail label={t('detail.created')}>
                            {formatDateTime(mold.created_at, lng)}
                            {mold.created_by_name && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{mold.created_by_name}</span>}
                        </Detail>
                        {mold.updated_at && (
                            <Detail label={t('detail.updated')}>
                                {formatDateTime(mold.updated_at, lng)}
                                {mold.updated_by_name && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{mold.updated_by_name}</span>}
                            </Detail>
                        )}
                    </dl>
                    {mold.notes && (
                        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm text-slate-500 dark:text-slate-400">{t('molds.f_notes')}</h3>
                            <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{mold.notes}</p>
                        </div>
                    )}
                </section>
            </div>

            <MoldFormModal
                open={editingMold}
                mold={mold}
                onClose={() => setEditingMold(false)}
                onSaved={() => {
                    setEditingMold(false)
                    reload()
                }}
            />
            <RecordFormModal
                open={Boolean(recordModal)}
                kind={recordModal?.kind || 'trials'}
                record={recordModal?.record}
                moldId={mold.id}
                onClose={() => setRecordModal(null)}
                onSaved={() => {
                    setRecordModal(null)
                    reload()
                }}
            />
            <ConfirmDialog
                open={archiving}
                danger
                busy={busy}
                title={t('molds.archive_title')}
                message={t('molds.archive_message', { code: mold.code, name: mold.name })}
                confirmLabel={t('molds.archive')}
                onConfirm={doArchive}
                onCancel={() => setArchiving(false)}
            />
            <ConfirmDialog
                open={Boolean(deleting)}
                danger
                busy={busy}
                title={t('records.delete_title')}
                message={t('records.delete_message')}
                confirmLabel={t('common.delete')}
                onConfirm={doDeleteRecord}
                onCancel={() => setDeleting(null)}
            />
        </>
    )
}
