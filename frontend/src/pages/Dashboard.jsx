import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, Coins, Hammer, Wrench } from 'lucide-react'
import { statsApi } from '../api'
import { useAsync } from '../hooks/useAsync.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, formatMoney, formatNumber, formatRelative } from '../utils/format.js'
import PageHeader from '../components/ui/PageHeader.jsx'
import { CardSkeleton, Skeleton } from '../components/ui/Skeleton.jsx'
import { EmptyState, ErrorState } from '../components/ui/States.jsx'
import { StatusBadge, STATUS_HEX, MaintenanceStatusBadge } from '../components/ui/Badge.jsx'
import DonutChart from '../components/charts/DonutChart.jsx'
import CostBars from '../components/charts/CostBars.jsx'

const STATUS_ORDER = ['active', 'trial', 'revision', 'maintenance', 'retired']

const TONES = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
}

function KpiCard({ icon: Icon, tone, label, value, hint, to }) {
    const body = (
        <>
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone]}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        </>
    )
    const cls = 'card-padded block'
    return to ? (
        <Link to={to} className={`${cls} transition-shadow hover:shadow-md`}>
            {body}
        </Link>
    ) : (
        <div className={cls}>{body}</div>
    )
}

function DaysChip({ days }) {
    const { t } = useTranslation()
    const tone = days < 0 ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : days <= 7 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    const text = days < 0 ? t('common.days_overdue', { count: Math.abs(days) }) : days === 0 ? t('common.due_today') : t('common.days_left', { count: days })
    return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{text}</span>
}

function Panel({ title, subtitle, children, className = '', action }) {
    return (
        <section className={`card min-w-0 ${className}`}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </section>
    )
}

function DashboardSkeleton() {
    return (
        <div aria-busy="true" aria-live="polite">
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="card-padded space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <CardSkeleton className="lg:col-span-2" lines={5} />
                <CardSkeleton className="lg:col-span-3" lines={5} />
            </div>
        </div>
    )
}

export default function Dashboard() {
    const { t, i18n } = useTranslation()
    usePageTitle(t('nav.dashboard'))
    const lng = i18n.language
    const { user } = useAuth()
    const { data, error, loading, reload } = useAsync(() => statsApi.dashboard(), [])

    const header = <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.welcome', { name: user.full_name.split(' ')[0] })} />

    if (loading && !data) {
        return (
            <>
                {header}
                <DashboardSkeleton />
            </>
        )
    }
    if (error && !data) {
        return (
            <>
                {header}
                <div className="card">
                    <ErrorState error={error} onRetry={reload} />
                </div>
            </>
        )
    }

    const d = data.data
    const k = d.kpis
    const counts = Object.fromEntries(d.status_distribution.map((s) => [s.status, s.count]))
    const segments = STATUS_ORDER.map((s) => ({ key: s, label: t(`status.${s}`), value: counts[s] || 0, color: STATUS_HEX[s] }))
    const supplierRows = d.cost_by_supplier.slice(0, 7).map((s) => ({ label: s.supplier === 'Unassigned' ? t('common.unassigned') : s.supplier, primary: s.mold_cost, secondary: s.revision_cost }))

    return (
        <>
            {header}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3" aria-label={t('dashboard.kpis')}>
                <KpiCard icon={Boxes} tone="brand" label={t('dashboard.kpi_total')} value={formatNumber(k.total_molds, lng)} hint={t('dashboard.kpi_total_hint', { count: k.unpaid_molds })} to="/molds" />
                <KpiCard icon={CheckCircle2} tone="green" label={t('dashboard.kpi_active')} value={formatNumber(k.active_molds, lng)} hint={t('dashboard.kpi_active_hint')} to="/molds?status=active" />
                <KpiCard icon={Hammer} tone="violet" label={t('dashboard.kpi_revision')} value={formatNumber(k.in_revision, lng)} hint={t('dashboard.kpi_revision_hint')} to="/molds?status=revision" />
                <KpiCard icon={AlertTriangle} tone={k.overdue_deadlines > 0 ? 'red' : 'amber'} label={t('dashboard.kpi_overdue')} value={formatNumber(k.overdue_deadlines, lng)} hint={t('dashboard.kpi_overdue_hint', { count: k.due_soon })} />
                <KpiCard icon={Wrench} tone="sky" label={t('dashboard.kpi_maintenance')} value={formatNumber(k.maintenance_due, lng)} hint={t('dashboard.kpi_maintenance_hint')} />
                <KpiCard icon={Coins} tone="amber" label={t('dashboard.kpi_cost')} value={formatMoney(k.total_cost, lng, { compact: true })} hint={t('dashboard.kpi_cost_hint', { revisions: formatMoney(k.revision_cost, lng, { compact: true }) })} />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
                <Panel title={t('dashboard.status_title')} subtitle={t('dashboard.status_subtitle')} className="lg:col-span-2">
                    <DonutChart segments={segments} centerValue={formatNumber(k.total_molds, lng)} centerLabel={t('dashboard.molds_label')} ariaLabel={t('dashboard.status_title')} />
                </Panel>
                <Panel title={t('dashboard.supplier_title')} subtitle={t('dashboard.supplier_subtitle')} className="lg:col-span-3">
                    {supplierRows.length ? (
                        <CostBars rows={supplierRows} lng={lng} primaryLabel={t('dashboard.purchase_cost')} secondaryLabel={t('dashboard.revision_cost')} ariaLabel={t('dashboard.supplier_title')} />
                    ) : (
                        <EmptyState title={t('dashboard.no_costs')} />
                    )}
                </Panel>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel
                    title={t('dashboard.deadlines_title')}
                    subtitle={t('dashboard.deadlines_subtitle')}
                    action={
                        <Link to="/molds?sort=deadline&order=asc" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                            {t('common.view_all')}
                        </Link>
                    }
                >
                    {d.upcoming_deadlines.length === 0 ? (
                        <EmptyState icon={CalendarClock} title={t('dashboard.no_deadlines')} />
                    ) : (
                        <ul className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                            {d.upcoming_deadlines.map((m) => (
                                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <Link to={`/molds/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400">
                                            {m.code} <span className="font-normal text-slate-500 dark:text-slate-400">· {m.name}</span>
                                        </Link>
                                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <StatusBadge value={m.status} />
                                            <span>{formatDate(m.deadline, lng)}</span>
                                        </p>
                                    </div>
                                    <DaysChip days={m.days_left} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title={t('dashboard.maintenance_title')} subtitle={t('dashboard.maintenance_subtitle')}>
                    {d.maintenance_due.length === 0 ? (
                        <EmptyState icon={Wrench} title={t('dashboard.no_maintenance')} />
                    ) : (
                        <ul className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                            {d.maintenance_due.map((m) => (
                                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <Link to={`/molds/${m.mold_id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400">
                                            {m.code} <span className="font-normal text-slate-500 dark:text-slate-400">· {m.name}</span>
                                        </Link>
                                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <MaintenanceStatusBadge value={m.status} />
                                            <span className="truncate">{m.description}</span>
                                        </p>
                                    </div>
                                    <DaysChip days={m.days_left} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <Panel title={t('dashboard.activity_title')} subtitle={t('dashboard.activity_subtitle')}>
                {d.recent_activity.length === 0 ? (
                    <EmptyState title={t('dashboard.no_activity')} />
                ) : (
                    <ul className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                        {d.recent_activity.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                                <p className="min-w-0 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-medium text-slate-900 dark:text-white">{a.user_name || t('common.system')}</span>{' '}
                                    <span className="text-slate-500 dark:text-slate-400">{t(`audit.actions.${a.action.replace('.', '_')}`, { defaultValue: a.action })}</span>
                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{a.description}</span>
                                </p>
                                <time className="shrink-0 text-xs text-slate-500 dark:text-slate-400" dateTime={a.created_at}>
                                    {formatRelative(a.created_at, lng)}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </>
    )
}
